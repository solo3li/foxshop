from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.core.cache import cache
from .models import DriverProfile, DeliveryTrip
from .serializers import DriverProfileSerializer, DeliveryTripDetailSerializer, UpdateGPSInputSerializer, VerifyOTPInputSerializer
from .services import update_driver_gps
from apps.orders.models import Order
from apps.notifications.services import publish_centrifugo_event

class DriverProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = DriverProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, _ = DriverProfile.objects.get_or_create(user=self.request.user)
        return profile


class DriverToggleOnlineView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile, _ = DriverProfile.objects.get_or_create(user=request.user)
        profile.is_online = not profile.is_online
        profile.save(update_fields=['is_online'])
        return Response({
            'is_online': profile.is_online,
            'message': f"الكابتن الآن {'متصل ومستعد لاستقبال الطلبات' if profile.is_online else 'غير متصل'}"
        })


class DriverUpdateGPSView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = UpdateGPSInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update_driver_gps(
            driver_user=request.user,
            latitude=serializer.validated_data['latitude'],
            longitude=serializer.validated_data['longitude']
        )
        return Response({'status': 'ok'})


class DriverCurrentTripView(generics.RetrieveAPIView):
    serializer_class = DeliveryTripDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        trip = DeliveryTrip.objects.filter(
            driver=self.request.user,
            status__in=[
                DeliveryTrip.Status.OFFERED,
                DeliveryTrip.Status.ACCEPTED,
                DeliveryTrip.Status.ARRIVED_AT_STORE,
                DeliveryTrip.Status.PICKED_UP,
                DeliveryTrip.Status.ARRIVED_AT_CUSTOMER
            ]
        ).first()
        return trip


class DriverAcceptTripView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        from django.db.models import Q
        trip = DeliveryTrip.objects.filter(
            Q(id=id) & (Q(driver=request.user) | Q(last_offered_to=request.user)),
            status=DeliveryTrip.Status.OFFERED
        ).first()

        if not trip:
            return Response({'error': 'عرض التوصيل غير متوفر أو تم سحبه/انتهت مهلته'}, status=status.HTTP_404_NOT_FOUND)

        trip.driver = request.user
        trip.status = DeliveryTrip.Status.ACCEPTED
        trip.accepted_at = timezone.now()
        trip.save(update_fields=['driver', 'status', 'accepted_at'])

        if hasattr(request.user, 'driver_profile'):
            profile = request.user.driver_profile
            profile.is_busy = True
            profile.save(update_fields=['is_busy'])

        # Notify Customer and Restaurant
        publish_centrifugo_event(
            channel=f"orders:order_{trip.order.id}",
            event_type="DRIVER_ASSIGNED",
            data={'driver_name': request.user.username, 'driver_phone': request.user.phone_number}
        )

        return Response({'message': 'تم قبول الطلب بنجاح', 'trip': DeliveryTripDetailSerializer(trip).data})


class DriverRejectTripView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        from .dispatch import handle_driver_timeout_or_rejection
        handle_driver_timeout_or_rejection(trip_id=id, driver_id=request.user.id)
        return Response({'message': 'تم رفض العرض وتوجيهه للكابتن التالي'})


class DriverPickupOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        try:
            trip = DeliveryTrip.objects.get(id=id, driver=request.user)
        except DeliveryTrip.DoesNotExist:
            return Response({'error': 'رحلة التوصيل غير موجودة'}, status=status.HTTP_404_NOT_FOUND)

        trip.status = DeliveryTrip.Status.PICKED_UP
        trip.picked_up_at = timezone.now()
        trip.save(update_fields=['status', 'picked_up_at'])

        trip.order.transition_to(Order.Status.ON_THE_WAY, note="استلم الكابتن الطلب وهو في الطريق للعميل")

        # Real-time event
        publish_centrifugo_event(
            channel=f"orders:order_{trip.order.id}",
            event_type="ORDER_PICKED_UP",
            data={'status': Order.Status.ON_THE_WAY, 'otp': trip.delivery_otp}
        )

        return Response({'message': 'تم تأكيد الاستلام من المطعم وبدء التوصيل للعميل', 'trip': DeliveryTripDetailSerializer(trip).data})


class DriverVerifyOTPAndCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        try:
            trip = DeliveryTrip.objects.get(id=id, driver=request.user)
        except DeliveryTrip.DoesNotExist:
            return Response({'error': 'رحلة التوصيل غير موجودة'}, status=status.HTTP_404_NOT_FOUND)

        serializer = VerifyOTPInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        otp = serializer.validated_data['otp']

        success = trip.verify_otp_and_complete(otp)
        if not success:
            return Response({'error': 'كود التحقق (OTP) غير صحيح! يرجى التأكد من العميل.'}, status=status.HTTP_400_BAD_REQUEST)

        # Real-time event
        publish_centrifugo_event(
            channel=f"orders:order_{trip.order.id}",
            event_type="ORDER_DELIVERED",
            data={'status': Order.Status.DELIVERED}
        )

        return Response({'message': 'تم إثبات التسليم وإكمال الطلب بنجاح 🍕🦊', 'trip': DeliveryTripDetailSerializer(trip).data})


class DriverShiftView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        status_val = request.data.get('status', 'TOGGLE').upper()
        profile, _ = DriverProfile.objects.get_or_create(user=request.user)

        if status_val == 'ONLINE':
            profile.is_online = True
            msg = "الكابتن الآن متصل ومستعد للعمل 🟢"
        elif status_val == 'BREAK':
            profile.is_online = False
            msg = "الكابتن الآن في استراحة مؤقتة 🟡"
        elif status_val == 'OFFLINE':
            profile.is_online = False
            msg = "تم إنهاء الوردية، الكابتن غير متصل 🔴"
        else:
            profile.is_online = not profile.is_online
            msg = f"الكابتن الآن {'متصل' if profile.is_online else 'غير متصل'}"

        profile.save(update_fields=['is_online'])
        return Response({
            'is_online': profile.is_online,
            'status': 'ONLINE' if profile.is_online else ('BREAK' if status_val == 'BREAK' else 'OFFLINE'),
            'message': msg
        })


class DriverTripsListView(generics.ListAPIView):
    serializer_class = DeliveryTripDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        status_filter = self.request.query_params.get('status')
        qs = DeliveryTrip.objects.filter(driver=self.request.user).select_related(
            'order__restaurant', 'order__customer'
        ).prefetch_related('order__items__modifiers').order_by('-offered_at')

        if status_filter and status_filter.upper() != 'ALL':
            if status_filter.upper() == 'COMPLETED':
                qs = qs.filter(status=DeliveryTrip.Status.COMPLETED)
            elif status_filter.upper() == 'CANCELLED':
                qs = qs.filter(status=DeliveryTrip.Status.CANCELLED)
            elif status_filter.upper() == 'ACTIVE':
                qs = qs.filter(status__in=[
                    DeliveryTrip.Status.OFFERED,
                    DeliveryTrip.Status.ACCEPTED,
                    DeliveryTrip.Status.ARRIVED_AT_STORE,
                    DeliveryTrip.Status.PICKED_UP,
                    DeliveryTrip.Status.ARRIVED_AT_CUSTOMER,
                ])
            else:
                qs = qs.filter(status=status_filter.upper())
        return qs


class DriverTripDetailView(generics.RetrieveAPIView):
    serializer_class = DeliveryTripDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return DeliveryTrip.objects.filter(driver=self.request.user).select_related(
            'order__restaurant', 'order__customer'
        ).prefetch_related('order__items__modifiers')


class DriverRouteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        try:
            trip = DeliveryTrip.objects.select_related('order__restaurant', 'order__customer').get(id=id, driver=request.user)
        except DeliveryTrip.DoesNotExist:
            return Response({'error': 'الرحلة غير موجودة'}, status=status.HTTP_404_NOT_FOUND)

        driver_profile = getattr(request.user, 'driver_profile', None)
        origin_lat = request.data.get('origin_lat') or (driver_profile.current_latitude if driver_profile else None)
        origin_lon = request.data.get('origin_lon') or (driver_profile.current_longitude if driver_profile else None)

        if not origin_lat or not origin_lon:
            return Response({'error': 'تعذر تحديد موقع الانطلاق (GPS غير متوفر)'}, status=status.HTTP_400_BAD_REQUEST)

        # Destination logic
        is_to_store = trip.status in [DeliveryTrip.Status.OFFERED, DeliveryTrip.Status.ACCEPTED, DeliveryTrip.Status.ARRIVED_AT_STORE]
        if is_to_store:
            dest_lat = trip.order.restaurant.latitude
            dest_lon = trip.order.restaurant.longitude
            dest_name = trip.order.restaurant.name
            dest_type = 'RESTAURANT'
        else:
            addr = dict(trip.order.delivery_address_snapshot or {})
            dest_lat = addr.get('latitude')
            dest_lon = addr.get('longitude')
            if (not dest_lat or not dest_lon) and trip.order.delivery_address:
                dest_lat = trip.order.delivery_address.latitude
                dest_lon = trip.order.delivery_address.longitude
            dest_name = (trip.order.customer.first_name if trip.order.customer else None) or 'العميل'
            dest_type = 'CUSTOMER'

        if not dest_lat or not dest_lon:
            return Response({'error': 'إحداثيات الوجهة غير متوفرة'}, status=status.HTTP_400_BAD_REQUEST)

        origin_lat = float(origin_lat)
        origin_lon = float(origin_lon)
        dest_lat = float(dest_lat)
        dest_lon = float(dest_lon)

        cache_key = f"route:{round(origin_lat, 3)},{round(origin_lon, 3)}->{round(dest_lat, 3)},{round(dest_lon, 3)}"
        cached_data = cache.get(cache_key)
        if cached_data:
            cached_data['is_cached'] = True
            return Response(cached_data)

        from apps.accounts.models import PlatformSetting
        settings = PlatformSetting.get_settings()
        api_key = settings.google_maps_server_key

        polyline_points = ""
        distance_km = round(trip.distance_km or 0.0, 2)
        duration_mins = 15

        if api_key:
            try:
                import requests
                url = (
                    f"https://maps.googleapis.com/maps/api/directions/json"
                    f"?origin={origin_lat},{origin_lon}&destination={dest_lat},{dest_lon}"
                    f"&key={api_key}&language=ar&mode=driving"
                )
                resp = requests.get(url, timeout=5)
                g_data = resp.json()
                if g_data.get('status') == 'OK' and g_data.get('routes'):
                    route = g_data['routes'][0]
                    polyline_points = route['overview_polyline']['points']
                    leg = route['legs'][0]
                    distance_km = round(leg['distance']['value'] / 1000.0, 2)
                    duration_mins = round(leg['duration']['value'] / 60.0)
            except Exception:
                pass

        result = {
            'phase': dest_type,
            'destination_name': dest_name,
            'origin': {'latitude': origin_lat, 'longitude': origin_lon},
            'destination': {'latitude': dest_lat, 'longitude': dest_lon},
            'polyline': polyline_points,
            'distance_km': distance_km,
            'duration_minutes': duration_mins,
            'is_cached': False
        }

        cache.set(cache_key, result, timeout=600)
        return Response(result)


class DriverAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.accounts.models import PlatformSetting
        from django.db.models import Sum
        from datetime import timedelta

        profile = getattr(request.user, 'driver_profile', None)
        if not profile:
            profile, _ = DriverProfile.objects.get_or_create(user=request.user)

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        month_start = today_start.replace(day=1)

        completed_trips = DeliveryTrip.objects.filter(
            driver=request.user,
            status=DeliveryTrip.Status.COMPLETED
        )

        today_trips = completed_trips.filter(completed_at__gte=today_start)
        week_trips = completed_trips.filter(completed_at__gte=week_start)
        month_trips = completed_trips.filter(completed_at__gte=month_start)

        earnings_today = today_trips.aggregate(total=Sum('driver_earnings'))['total'] or 0
        earnings_week = week_trips.aggregate(total=Sum('driver_earnings'))['total'] or 0
        earnings_month = month_trips.aggregate(total=Sum('driver_earnings'))['total'] or 0

        distance_total = completed_trips.aggregate(total=Sum('distance_km'))['total'] or 0

        settings = PlatformSetting.get_settings()
        cod_ceiling = settings.cod_max_ceiling

        return Response({
            'total_delivered': profile.total_delivered_orders,
            'rating': profile.rating,
            'cash_in_hand': str(profile.cash_in_hand),
            'cod_max_ceiling': str(cod_ceiling),
            'earnings_today': str(earnings_today),
            'earnings_week': str(earnings_week),
            'earnings_month': str(earnings_month),
            'trips_today_count': today_trips.count(),
            'trips_week_count': week_trips.count(),
            'total_distance_km': round(float(distance_total), 1),
            'vehicle_type': profile.get_vehicle_type_display(),
            'license_plate': profile.license_plate,
            'is_online': profile.is_online,
        })
