from rest_framework import generics, viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from .models import Restaurant, DeliveryZone, OperatingHours, haversine_distance_km
from .serializers import RestaurantListSerializer, RestaurantDetailSerializer

class CustomerRestaurantListView(generics.ListAPIView):
    serializer_class = RestaurantListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Restaurant.objects.filter(is_active=True)
        search_query = self.request.query_params.get('q')
        if search_query:
            qs = qs.filter(Q(name__icontains=search_query) | Q(description__icontains=search_query))

        customer_lat = self.request.query_params.get('lat')
        customer_lng = self.request.query_params.get('lng')

        if customer_lat and customer_lng:
            try:
                lat = float(customer_lat)
                lng = float(customer_lng)
                filtered_restaurants = []
                for rest in qs:
                    in_range, dist = rest.is_within_delivery_range(lat, lng)
                    if in_range:
                        rest.computed_distance = round(dist, 2)
                        filtered_restaurants.append(rest)
                filtered_restaurants.sort(key=lambda x: getattr(x, 'computed_distance', 999))
                return filtered_restaurants
            except (ValueError, TypeError):
                pass
        return qs


class CustomerRestaurantDetailView(generics.RetrieveAPIView):
    serializer_class = RestaurantDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'id'

    def get_queryset(self):
        return Restaurant.objects.filter(is_active=True)


class MerchantRestaurantViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Allow merchant to manage their own restaurants (or admin to manage all)
        if self.request.user.is_staff or self.request.user.role == 'ADMIN':
            return Restaurant.objects.all()
        return Restaurant.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class MerchantToggleBusyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            restaurant = Restaurant.objects.get(pk=pk, owner=request.user)
        except Restaurant.DoesNotExist:
            return Response({'error': 'المطعم غير موجود أو ليس لديك صلاحية'}, status=status.HTTP_404_NOT_FOUND)

        restaurant.is_busy = not restaurant.is_busy
        restaurant.save(update_fields=['is_busy'])
        return Response({'is_busy': restaurant.is_busy, 'message': 'تم تغيير حالة الانشغال بنجاح'})
