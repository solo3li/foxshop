from rest_framework import generics, viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import MenuCategory, MenuItem, ModifierGroup, Modifier
from .serializers import MenuCategoryWithItemsSerializer, MenuItemSerializer

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


class MerchantMenuItemViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MenuItem.objects.filter(category__restaurant__owner=self.request.user)


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
