from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
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
