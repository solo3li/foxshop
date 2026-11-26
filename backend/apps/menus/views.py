import os
import uuid
import re
from rest_framework import generics, viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.files.storage import default_storage
from .models import MenuCategory, MenuItem, ModifierGroup, Modifier
from .serializers import MenuCategoryWithItemsSerializer, MenuItemSerializer, MenuCategorySerializer
from rest_framework.exceptions import ValidationError
from apps.restaurants.models import Restaurant


class CustomerRestaurantMenuListView(generics.ListAPIView):
    serializer_class = MenuCategoryWithItemsSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        restaurant_id = self.kwargs.get('restaurant_id')
        return MenuCategory.objects.filter(restaurant_id=restaurant_id).prefetch_related('items__modifier_groups__modifiers')


class CustomerMenuItemDetailView(generics.RetrieveAPIView):
    serializer_class = MenuItemSerializer
    permission_classes = [permissions.AllowAny]
    queryset = MenuItem.objects.all()
    lookup_field = 'id'


class MerchantMenuCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = MenuCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff or getattr(self.request.user, 'role', '') == 'ADMIN':
            return MenuCategory.objects.all().order_by('order', 'name')
        return MenuCategory.objects.filter(restaurant__owner=self.request.user).order_by('order', 'name')

    def perform_create(self, serializer):
        restaurant = serializer.validated_data.get('restaurant')
        if not restaurant:
            restaurant = Restaurant.objects.filter(owner=self.request.user).first()
            if not restaurant:
                raise ValidationError({'error': 'لا يوجد مطعم مرتبط بحسابك لإضافة تصنيف إليه'})
        serializer.save(restaurant=restaurant)


class MerchantMenuItemViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        if self.request.user.is_staff or getattr(self.request.user, 'role', '') == 'ADMIN':
            return MenuItem.objects.all().order_by('name')
        return MenuItem.objects.filter(category__restaurant__owner=self.request.user).order_by('name')

    def perform_create(self, serializer):
        category = serializer.validated_data.get('category')
        if not category:
            raise ValidationError({'category': 'التصنيف مطلوب'})
        if not (self.request.user.is_staff or getattr(self.request.user, 'role', '') == 'ADMIN'):
            if category.restaurant.owner != self.request.user:
                raise ValidationError({'category': 'ليس لديك صلاحية لإضافة صنف لهذا التصنيف'})
        serializer.save()


class MerchantMenuItemImageUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get('image') or request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'لم يتم إرسال أي ملف صورة'}, status=status.HTTP_400_BAD_REQUEST)

        # Allowed extensions
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        ext = os.path.splitext(file_obj.name)[1].lower()
        if ext not in allowed_extensions:
            return Response({
                'error': f'صيغة الملف غير مدعومة. الصيغ المسموحة هي: {", ".join(allowed_extensions)}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Max size: 10MB
        if file_obj.size > 10 * 1024 * 1024:
            return Response({'error': 'حجم الصورة يتجاوز الحد الأقصى المسموح (10 ميجابايت)'}, status=status.HTTP_400_BAD_REQUEST)

        clean_name = re.sub(r'[^a-zA-Z0-9_\.-]', '_', file_obj.name)
        filename = f"menu_items/{uuid.uuid4().hex[:10]}_{clean_name}"
        saved_path = default_storage.save(filename, file_obj)
        url = default_storage.url(saved_path)

        return Response({
            'url': url,
            'path': saved_path,
            'filename': file_obj.name,
            'message': 'تم رفع صورة الصنف بنجاح'
        }, status=status.HTTP_201_CREATED)


class MerchantToggleItemAvailabilityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            item = MenuItem.objects.get(pk=pk, category__restaurant__owner=request.user)
        except MenuItem.DoesNotExist:
            return Response({'error': 'الصنف غير موجود أو ليس لديك صلاحية'}, status=status.HTTP_404_NOT_FOUND)

        item.is_available = not item.is_available
        item.save(update_fields=['is_available'])
        return Response({
            'item_id': item.id,
            'is_available': item.is_available,
            'message': f"تم تحويل حالة الصنف إلى {'متوفر' if item.is_available else 'غير متوفر (86)'}"
        })
