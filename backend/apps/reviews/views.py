from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import OrderReview
from .serializers import OrderReviewCreateSerializer, OrderReviewDetailSerializer, MerchantReplySerializer

class CustomerCreateOrderReviewView(generics.CreateAPIView):
    serializer_class = OrderReviewCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['order_id'] = self.kwargs.get('order_id')
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        return Response({
            'message': 'تم نشر التقييم بنجاح وتحديث معدل النجوم فورا',
            'review': OrderReviewDetailSerializer(review).data
        }, status=status.HTTP_201_CREATED)


class RestaurantReviewsListView(generics.ListAPIView):
    serializer_class = OrderReviewDetailSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        restaurant_id = self.kwargs.get('restaurant_id')
        return OrderReview.objects.filter(restaurant_id=restaurant_id).select_related('customer', 'restaurant')


class MerchantReplyReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        try:
            review = OrderReview.objects.get(id=id, restaurant__owner=request.user)
        except OrderReview.DoesNotExist:
            return Response({'error': 'المراجعة غير موجودة أو لا تخص مطعمك.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = MerchantReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.update(review, serializer.validated_data)
        return Response({
            'message': 'تم تسجيل ردك على العميل بنجاح',
            'review': OrderReviewDetailSerializer(review).data
        })
