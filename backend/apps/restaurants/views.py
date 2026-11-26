from rest_framework import generics, viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from django.core.cache import cache
import hashlib
from .models import Restaurant, DeliveryZone, OperatingHours, haversine_distance_km
from .serializers import (
    RestaurantListSerializer, RestaurantDetailSerializer,
    OperatingHoursSerializer, SearchProductSerializer
)
from apps.menus.models import MenuItem


def invalidate_search_cache():
    """Atomic O(1) version invalidation on merchant inventory/status updates."""
    try:
        cache.incr('foxshop:search:version')
    except Exception:
        curr = cache.get('foxshop:search:version')
        new_ver = (int(curr) + 1) if curr is not None else 2
        cache.set('foxshop:search:version', new_ver, None)


class CustomerSearchView(APIView):
    """
    Universal instant search across stores, products, and barcodes with Redis caching
    and geofencing delivery zone enforcement.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        store_type = request.query_params.get('store_type', 'ALL').strip().upper()
        barcode = request.query_params.get('barcode', '').strip()
        lat_param = request.query_params.get('lat')
        lng_param = request.query_params.get('lng')

        customer_coords = None
        if lat_param is not None and lng_param is not None:
            try:
                customer_coords = (float(lat_param), float(lng_param))
            except (ValueError, TypeError):
                customer_coords = None

        # Build Redis cache key
        version = cache.get('foxshop:search:version')
        if version is None:
            version = 1
            cache.set('foxshop:search:version', 1, None)

        if customer_coords:
            grid = f"{customer_coords[0]:.2f}:{customer_coords[1]:.2f}"
        else:
            grid = "nogeo"

        norm_q = q.lower()
        norm_barcode = barcode.lower()
        query_sig = f"q={norm_q}&b={norm_barcode}"
        q_hash = hashlib.md5(query_sig.encode('utf-8')).hexdigest()[:12]
        cache_key = f"foxshop:search:v{version}:{store_type}:{grid}:{q_hash}"

        cached_response = cache.get(cache_key)
        if cached_response is not None:
            data = dict(cached_response)
            data['cached'] = True
            resp = Response(data, status=status.HTTP_200_OK)
            resp['X-Cache'] = 'HIT'
            resp['X-Cache-TTL'] = '120'
            return resp

        # 0. Meilisearch Integration with Graceful DB Fallback
        meili_used = False
        deliverable_stores = []
        deliverable_products = []

        if q:
            try:
                from apps.menus.meilisearch_service import search_meilisearch
                lat_val = customer_coords[0] if customer_coords else None
                lng_val = customer_coords[1] if customer_coords else None
                meili_res = search_meilisearch(q, lat=lat_val, lng=lng_val)
                if meili_res and (meili_res.get('restaurants') or meili_res.get('menu_items')):
                    rest_ids = [r['id'] for r in meili_res.get('restaurants', []) if isinstance(r, dict) and 'id' in r]
                    item_ids = [m['id'] for m in meili_res.get('menu_items', []) if isinstance(m, dict) and 'id' in m]
                    m_stores = []
                    m_products = []
                    if rest_ids:
                        qs = Restaurant.objects.filter(id__in=rest_ids, is_active=True)
                        if store_type and store_type != 'ALL':
                            qs = qs.filter(store_type=store_type)
                        m_stores = list(qs)
                    if item_ids:
                        qs = MenuItem.objects.filter(
                            id__in=item_ids, is_available=True, category__restaurant__is_active=True
                        ).select_related('category', 'category__restaurant')
                        if store_type and store_type != 'ALL':
                            qs = qs.filter(category__restaurant__store_type=store_type)
                        m_products = list(qs)

                    if m_stores or m_products:
                        meili_used = True
                        if customer_coords:
                            lat, lng = customer_coords
                            for rest in m_stores:
                                in_range, dist = rest.is_within_delivery_range(lat, lng)
                                if in_range:
                                    rest.computed_distance = round(dist, 2)
                                    deliverable_stores.append(rest)
                            deliverable_stores.sort(key=lambda x: getattr(x, 'computed_distance', 999))

                            rest_cache = {}
                            for item in m_products:
                                rest = item.category.restaurant
                                if rest.id not in rest_cache:
                                    in_range, _ = rest.is_within_delivery_range(lat, lng)
                                    rest_cache[rest.id] = in_range
                                if rest_cache[rest.id]:
                                    deliverable_products.append(item)
                        else:
                            deliverable_stores = m_stores[:20]
                            deliverable_products = m_products[:50]
            except Exception as e:
                logger.warning(f"Meilisearch query failed, falling back to DB: {e}")
                meili_used = False

        if not meili_used:
            # 1. Search Stores
            stores_qs = Restaurant.objects.filter(is_active=True)
            if store_type and store_type != 'ALL':
                stores_qs = stores_qs.filter(store_type=store_type)

            if q:
                stores_qs = stores_qs.filter(Q(name__icontains=q) | Q(description__icontains=q))
            elif barcode:
                stores_qs = stores_qs.filter(menu_categories__items__barcode__iexact=barcode).distinct()

            deliverable_stores = []
            if customer_coords:
                lat, lng = customer_coords
                for rest in stores_qs:
                    in_range, dist = rest.is_within_delivery_range(lat, lng)
                    if in_range:
                        rest.computed_distance = round(dist, 2)
                        deliverable_stores.append(rest)
                deliverable_stores.sort(key=lambda x: getattr(x, 'computed_distance', 999))
            else:
                deliverable_stores = list(stores_qs[:20])

            # 2. Search Products
            products_qs = MenuItem.objects.filter(
                is_available=True,
                category__restaurant__is_active=True
            ).select_related('category', 'category__restaurant')

            if store_type and store_type != 'ALL':
                products_qs = products_qs.filter(category__restaurant__store_type=store_type)

            if barcode:
                products_qs = products_qs.filter(barcode__iexact=barcode)
            elif q:
                products_qs = products_qs.filter(
                    Q(name__icontains=q) |
                    Q(description__icontains=q) |
                    Q(barcode__iexact=q) |
                    Q(sku__icontains=q)
                )

            deliverable_products = []
            if customer_coords:
                lat, lng = customer_coords
                rest_cache = {}
                for item in products_qs:
                    rest = item.category.restaurant
                    if rest.id not in rest_cache:
                        in_range, _ = rest.is_within_delivery_range(lat, lng)
                        rest_cache[rest.id] = in_range
                    if rest_cache[rest.id]:
                        deliverable_products.append(item)
                    if len(deliverable_products) >= 50:
                        break
            else:
                deliverable_products = list(products_qs[:50])

        stores_data = RestaurantListSerializer(deliverable_stores[:20], many=True, context={'request': request}).data
        products_data = SearchProductSerializer(deliverable_products, many=True, context={'request': request}).data

        response_data = {
            'query': q,
            'store_type': store_type,
            'total_stores': len(stores_data),
            'total_products': len(products_data),
            'cached': False,
            'stores': stores_data,
            'products': products_data
        }

        # Cache with 120s TTL
        cache.set(cache_key, dict(response_data, cached=True), 120)

        response = Response(response_data, status=status.HTTP_200_OK)
        response['X-Cache'] = 'MISS'
        response['X-Cache-TTL'] = '120'
        return response

class CustomerRestaurantListView(generics.ListAPIView):
    serializer_class = RestaurantListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Restaurant.objects.filter(is_active=True).prefetch_related('delivery_zones')
        search_query = self.request.query_params.get('q')
        if search_query:
            qs = qs.filter(Q(name__icontains=search_query) | Q(description__icontains=search_query))

        store_type = self.request.query_params.get('store_type')
        if store_type:
            qs = qs.filter(store_type=store_type.upper())

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
        invalidate_search_cache()

    def perform_update(self, serializer):
        serializer.save()
        invalidate_search_cache()

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_search_cache()


class MerchantToggleBusyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            restaurant = Restaurant.objects.get(pk=pk, owner=request.user)
        except Restaurant.DoesNotExist:
            return Response({'error': 'المطعم غير موجود أو ليس لديك صلاحية'}, status=status.HTTP_404_NOT_FOUND)

        restaurant.is_busy = not restaurant.is_busy
        restaurant.save(update_fields=['is_busy'])
        invalidate_search_cache()
        return Response({'is_busy': restaurant.is_busy, 'message': 'تم تغيير حالة الانشغال بنجاح'})


class MerchantUpdateStoreStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            restaurant = Restaurant.objects.get(pk=pk, owner=request.user)
        except Restaurant.DoesNotExist:
            return Response({'error': 'المطعم غير موجود أو ليس لديك صلاحية'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        if new_status == 'OPEN':
            restaurant.is_active = True
            restaurant.is_busy = False
        elif new_status == 'BUSY':
            restaurant.is_active = True
            restaurant.is_busy = True
        elif new_status == 'CLOSED':
            restaurant.is_active = False
            restaurant.is_busy = False
        else:
            return Response({'error': 'الحالة غير صالحة. الحالات المسموحة: OPEN, BUSY, CLOSED'}, status=status.HTTP_400_BAD_REQUEST)

        restaurant.save(update_fields=['is_active', 'is_busy'])
        invalidate_search_cache()
        return Response({
            'message': 'تم تحديث حالة المطعم بنجاح',
            'is_active': restaurant.is_active,
            'is_busy': restaurant.is_busy,
            'status': new_status
        })


class MerchantOperatingHoursView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            restaurant = Restaurant.objects.get(pk=pk, owner=request.user)
        except Restaurant.DoesNotExist:
            return Response({'error': 'المطعم غير موجود أو ليس لديك صلاحية'}, status=status.HTTP_404_NOT_FOUND)

        # Ensure all 7 days exist for this restaurant
        existing_days = {h.day: h for h in OperatingHours.objects.filter(restaurant=restaurant)}
        for day_val in range(7):
            if day_val not in existing_days:
                OperatingHours.objects.create(
                    restaurant=restaurant,
                    day=day_val,
                    opening_time='09:00:00',
                    closing_time='23:00:00',
                    is_closed=False
                )

        hours = OperatingHours.objects.filter(restaurant=restaurant).order_by('day')
        serializer = OperatingHoursSerializer(hours, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        try:
            restaurant = Restaurant.objects.get(pk=pk, owner=request.user)
        except Restaurant.DoesNotExist:
            return Response({'error': 'المطعم غير موجود أو ليس لديك صلاحية'}, status=status.HTTP_404_NOT_FOUND)

        hours_data = request.data.get('operating_hours', [])
        for item in hours_data:
            day = item.get('day')
            if day is not None:
                opening = item.get('opening_time') or '09:00:00'
                closing = item.get('closing_time') or '23:00:00'
                is_closed = bool(item.get('is_closed', False))

                OperatingHours.objects.update_or_create(
                    restaurant=restaurant,
                    day=int(day),
                    defaults={
                        'opening_time': opening,
                        'closing_time': closing,
                        'is_closed': is_closed
                    }
                )

        updated = OperatingHours.objects.filter(restaurant=restaurant).order_by('day')
        return Response({
            'message': 'تم حفظ ساعات العمل بنجاح',
            'operating_hours': OperatingHoursSerializer(updated, many=True).data
        })
