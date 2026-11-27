import logging
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q, Count
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.accounts.models import User, PlatformSetting
from apps.orders.models import Order
from apps.deliveries.models import (
    DriverProfile,
    DeliveryTrip,
    DeliveryOffer,
    DriverCashSettlement,
    DeliveryZone,
    SupervisorActionLog
)
from apps.deliveries.dispatch import send_manual_offer_to_drivers
from apps.notifications.services import publish_centrifugo_event, notify_driver_approved
from apps.restaurants.models import haversine_distance_km
from apps.deliveries.views_ops import log_supervisor_action, IsOpsManagerOrAdmin, IsSupervisorOrAbove

logger = logging.getLogger(__name__)


class IsSupervisorOrAdmin(permissions.BasePermission):
    """Allows access to authenticated staff, superusers, or users with role ADMIN, OPS_MANAGER, or SUPERVISOR."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (
                request.user.is_staff or
                request.user.is_superuser or
                getattr(request.user, 'role', '') in [
                    User.Roles.ADMIN,
                    User.Roles.OPS_MANAGER,
                    User.Roles.SUPERVISOR
                ]
            )
        )


class SupervisorStatsView(APIView):
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        settings = PlatformSetting.get_settings()
        cod_ceiling = float(settings.cod_max_ceiling)

        # Drivers queries
        driver_users = User.objects.filter(role=User.Roles.DRIVER)
        total_drivers = driver_users.count()
        pending_drivers = driver_users.filter(is_active=False).count()

        active_profiles = DriverProfile.objects.filter(user__is_active=True, user__role=User.Roles.DRIVER)
        online_drivers = active_profiles.filter(is_online=True).count()
        busy_drivers = active_profiles.filter(is_busy=True).count()
        offline_drivers = max(0, active_profiles.count() - online_drivers)

        # Cash stats
        cash_sum = active_profiles.aggregate(total=Sum('cash_in_hand'))['total'] or Decimal('0.00')
        over_ceiling_count = active_profiles.filter(cash_in_hand__gte=cod_ceiling).count()

        # Orders queries (Only platform-managed fleet orders)
        from apps.restaurants.models import Restaurant
        live_orders = Order.objects.filter(
            restaurant__delivery_mode=Restaurant.DeliveryMode.PLATFORM_MANAGED,
            status__in=[
                Order.Status.CONFIRMED,
                Order.Status.PREPARING,
                Order.Status.READY_FOR_PICKUP,
                Order.Status.ON_THE_WAY
            ]
        )
        total_live_orders = live_orders.count()

        # Unassigned orders: live orders where no DeliveryTrip exists OR trip driver is null / trip in DISPATCHING or MANUAL_DISPATCH_REQUIRED
        unassigned_orders = live_orders.filter(
            Q(delivery_trip__isnull=True) |
            Q(delivery_trip__driver__isnull=True) |
            Q(delivery_trip__status__in=[
                DeliveryTrip.Status.DISPATCHING,
                DeliveryTrip.Status.MANUAL_DISPATCH_REQUIRED,
                DeliveryTrip.Status.CANCELLED
            ])
        ).count()

        # Delivered today
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        delivered_today = DeliveryTrip.objects.filter(
            status=DeliveryTrip.Status.COMPLETED,
            completed_at__gte=today_start
        ).count()

        return Response({
            'fleet': {
                'total_drivers': total_drivers,
                'online_drivers': online_drivers,
                'busy_drivers': busy_drivers,
                'offline_drivers': offline_drivers,
                'pending_approval': pending_drivers,
            },
            'orders': {
                'live_orders': total_live_orders,
                'unassigned_orders': unassigned_orders,
                'delivered_today': delivered_today,
            },
            'cash': {
                'total_cash_in_market': float(cash_sum),
                'cod_max_ceiling': cod_ceiling,
                'drivers_over_ceiling': over_ceiling_count,
            }
        })


class SupervisorDriverRadarView(APIView):
    """Returns all drivers with current GPS, status, vehicle, and cash for the live map radar."""
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        settings = PlatformSetting.get_settings()
        cod_ceiling = float(settings.cod_max_ceiling)

        # Default fallback coordinates (Riyadh center)
        DEFAULT_LAT = 24.7136
        DEFAULT_LNG = 46.6753

        profiles = list(DriverProfile.objects.select_related('user').filter(user__role=User.Roles.DRIVER))

        # Optional filters
        online_only = request.query_params.get('online_only') == 'true'
        if online_only:
            profiles = [p for p in profiles if p.is_online]

        # Read real-time coordinates from Redis first (zero-lag over DB write-behind)
        redis_positions = {}
        try:
            import json
            from .services import get_redis_client
            r = get_redis_client()
            if r and profiles:
                keys = [f"driver:{p.user_id}:pos" for p in profiles]
                raw_vals = r.mget(keys)
                for p, raw in zip(profiles, raw_vals):
                    if raw:
                        redis_positions[str(p.user_id)] = json.loads(raw)
        except Exception:
            pass

        results = []
        for idx, p in enumerate(profiles):
            user = p.user
            r_pos = redis_positions.get(str(user.id))
            if r_pos and r_pos.get('latitude') is not None and r_pos.get('longitude') is not None:
                lat = float(r_pos['latitude'])
                lng = float(r_pos['longitude'])
            else:
                lat = float(p.current_latitude) if p.current_latitude else round(DEFAULT_LAT + (idx * 0.007 % 0.05), 6)
                lng = float(p.current_longitude) if p.current_longitude else round(DEFAULT_LNG + (idx * 0.009 % 0.05), 6)
            cash = float(p.cash_in_hand or 0.0)

            # Find active trip if any
            active_trip = None
            if p.is_busy:
                trip = DeliveryTrip.objects.filter(
                    driver=user,
                    status__in=[
                        DeliveryTrip.Status.ACCEPTED,
                        DeliveryTrip.Status.ARRIVED_AT_STORE,
                        DeliveryTrip.Status.PICKED_UP,
                        DeliveryTrip.Status.ARRIVED_AT_CUSTOMER
                    ]
                ).select_related('order', 'order__restaurant', 'order__customer', 'order__delivery_address').first()

                if trip and trip.order:
                    order = trip.order
                    restaurant = order.restaurant
                    customer = order.customer
                    addr_snap = order.delivery_address_snapshot or {}
                    deliv_lat = addr_snap.get('latitude') or (float(order.delivery_address.latitude) if order.delivery_address else None)
                    deliv_lng = addr_snap.get('longitude') or (float(order.delivery_address.longitude) if order.delivery_address else None)
                    deliv_text = addr_snap.get('street') or (order.delivery_address.street if order.delivery_address else 'عنوان العميل')

                    active_trip = {
                        'trip_id': str(trip.id),
                        'order_id': str(order.id),
                        'order_number': order.order_number,
                        'status': trip.status,
                        'status_display': trip.get_status_display(),
                        'restaurant_name': restaurant.name if restaurant else '',
                        'restaurant_store_type': getattr(restaurant, 'store_type', '') if restaurant else '',
                        'restaurant_address': restaurant.address_text if restaurant else '',
                        'restaurant_latitude': float(restaurant.latitude or 24.7136) if restaurant else 24.7136,
                        'restaurant_longitude': float(restaurant.longitude or 46.6753) if restaurant else 46.6753,
                        'customer_name': (customer.get_full_name() or customer.username) if customer else 'عميل',
                        'customer_phone': customer.phone_number if customer else '',
                        'customer_address': deliv_text,
                        'customer_latitude': float(deliv_lat or 24.7150),
                        'customer_longitude': float(deliv_lng or 46.6780),
                        'distance_km': float(trip.distance_km),
                        'driver_earnings': float(trip.driver_earnings),
                        'delivery_otp': trip.delivery_otp,
                    }

            is_over_limit = cash >= cod_ceiling
            limit_percent = round((cash / cod_ceiling) * 100, 1) if cod_ceiling > 0 else 0

            results.append({
                'id': str(user.id),
                'profile_id': p.id,
                'name': user.get_full_name() or user.username,
                'username': user.username,
                'phone_number': user.phone_number or '',
                'is_active': user.is_active,
                'is_online': p.is_online,
                'is_busy': p.is_busy,
                'vehicle_type': p.vehicle_type,
                'vehicle_type_display': p.get_vehicle_type_display(),
                'license_plate': p.license_plate,
                'latitude': lat,
                'longitude': lng,
                'cash_in_hand': cash,
                'cod_max_ceiling': cod_ceiling,
                'is_over_limit': is_over_limit,
                'limit_percent': limit_percent,
                'rating': float(p.rating),
                'total_delivered_orders': p.total_delivered_orders,
                'active_trip': active_trip,
            })

        return Response({
            'count': len(results),
            'cod_max_ceiling': cod_ceiling,
            'drivers': results
        })


class SupervisorLiveOrdersDispatchView(APIView):
    """Returns live orders requiring dispatching or monitoring."""
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        status_filter = request.query_params.get('status')
        unassigned_only = request.query_params.get('unassigned') == 'true'
        store_type = request.query_params.get('store_type')

        base_statuses = [
            Order.Status.CONFIRMED,
            Order.Status.PREPARING,
            Order.Status.READY_FOR_PICKUP,
            Order.Status.ON_THE_WAY
        ]
        from apps.restaurants.models import Restaurant
        base_qs = Order.objects.filter(restaurant__delivery_mode=Restaurant.DeliveryMode.PLATFORM_MANAGED)
        if status_filter and status_filter.upper() != 'ALL':
            qs = base_qs.filter(status=status_filter.upper())
        else:
            qs = base_qs.filter(status__in=base_statuses)

        if store_type and store_type.upper() != 'ALL':
            qs = qs.filter(restaurant__store_type=store_type.upper())

        if unassigned_only:
            qs = qs.filter(
                Q(delivery_trip__isnull=True) |
                Q(delivery_trip__driver__isnull=True) |
                Q(delivery_trip__status__in=[
                    DeliveryTrip.Status.DISPATCHING,
                    DeliveryTrip.Status.MANUAL_DISPATCH_REQUIRED,
                    DeliveryTrip.Status.CANCELLED
                ])
            )

        orders = qs.select_related(
            'restaurant', 'customer', 'delivery_address'
        ).prefetch_related(
            'delivery_offers__driver', 'items'
        ).order_by('-created_at')[:100]

        now = timezone.now()
        results = []

        for order in orders:
            elapsed_minutes = max(0, int((now - order.created_at).total_seconds() / 60))

            # Delivery Trip info
            trip_data = None
            assigned_driver = None
            has_assigned_driver = False

            trip = getattr(order, 'delivery_trip', None)
            if trip:
                trip_data = {
                    'id': str(trip.id),
                    'status': trip.status,
                    'status_display': trip.get_status_display(),
                    'delivery_otp': trip.delivery_otp,
                    'driver_earnings': float(trip.driver_earnings),
                    'distance_km': float(trip.distance_km),
                }
                if trip.driver:
                    has_assigned_driver = True
                    driver_profile = getattr(trip.driver, 'driver_profile', None)
                    assigned_driver = {
                        'id': str(trip.driver.id),
                        'name': trip.driver.get_full_name() or trip.driver.username,
                        'phone_number': trip.driver.phone_number or '',
                        'vehicle_type': driver_profile.vehicle_type if driver_profile else '',
                        'vehicle_type_display': driver_profile.get_vehicle_type_display() if driver_profile else '',
                    }

            # Pending offers
            pending_offers = order.delivery_offers.filter(status=DeliveryOffer.Status.PENDING, expires_at__gt=now)
            offered_drivers = [
                {
                    'id': str(o.driver.id),
                    'name': o.driver.get_full_name() or o.driver.username,
                    'phone_number': o.driver.phone_number or '',
                    'expires_at': o.expires_at.isoformat(),
                    'batch': o.batch_number
                }
                for o in pending_offers
            ]

            needs_driver = not has_assigned_driver or (trip and trip.status in [
                DeliveryTrip.Status.DISPATCHING,
                DeliveryTrip.Status.MANUAL_DISPATCH_REQUIRED
            ])

            # Address snapshot or direct address
            addr_snapshot = order.delivery_address_snapshot or {}
            deliv_lat = addr_snapshot.get('latitude') or (float(order.delivery_address.latitude) if order.delivery_address else None)
            deliv_lng = addr_snapshot.get('longitude') or (float(order.delivery_address.longitude) if order.delivery_address else None)
            deliv_text = addr_snapshot.get('street') or (order.delivery_address.street if order.delivery_address else 'عنوان العميل')

            results.append({
                'id': str(order.id),
                'order_number': order.order_number,
                'status': order.status,
                'status_display': order.get_status_display(),
                'payment_method': order.payment_method,
                'payment_method_display': order.get_payment_method_display(),
                'total_amount': float(order.total_amount),
                'delivery_fee': float(order.delivery_fee),
                'created_at': order.created_at.isoformat(),
                'elapsed_minutes': elapsed_minutes,
                'prep_time_minutes': order.prep_time_minutes,
                'restaurant': {
                    'id': str(order.restaurant.id),
                    'name': order.restaurant.name,
                    'store_type': order.restaurant.store_type,
                    'phone': getattr(order.restaurant, 'phone_number', '') or (order.restaurant.owner.phone_number if getattr(order.restaurant, 'owner', None) else ''),
                    'address': order.restaurant.address_text or '',
                    'latitude': float(order.restaurant.latitude or 24.7136),
                    'longitude': float(order.restaurant.longitude or 46.6753),
                },
                'customer': {
                    'id': str(order.customer.id) if order.customer else '',
                    'name': (order.customer.get_full_name() or order.customer.username) if order.customer else 'عميل',
                    'phone': order.customer.phone_number if order.customer else '',
                },
                'delivery_address': {
                    'text': deliv_text,
                    'latitude': float(deliv_lat or 24.7150),
                    'longitude': float(deliv_lng or 46.6780),
                },
                'items_count': order.items.count(),
                'has_assigned_driver': has_assigned_driver,
                'needs_driver': needs_driver,
                'assigned_driver': assigned_driver,
                'trip': trip_data,
                'pending_offers_count': len(offered_drivers),
                'offered_drivers': offered_drivers,
            })

        return Response({
            'count': len(results),
            'orders': results
        })


class SupervisorManualDispatchView(APIView):
    """Manual Dispatch: Assign order directly to a driver, or send an offer with timeout."""
    permission_classes = [IsSupervisorOrAdmin]

    def post(self, request):
        order_id = request.data.get('order_id')
        driver_id = request.data.get('driver_id')
        driver_ids = request.data.get('driver_ids') or ([] if not driver_id else [driver_id])
        mode = request.data.get('mode', 'offer') # 'offer' or 'direct'
        timeout_seconds = int(request.data.get('timeout_seconds', 60))

        if not order_id:
            return Response({'error': 'يرجى تحديد رقم الطلب (order_id)'}, status=status.HTTP_400_BAD_REQUEST)

        if not driver_ids:
            return Response({'error': 'يرجى تحديد كابتن واحد على الأقل'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.select_related('restaurant').get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'الطلب غير موجود'}, status=status.HTTP_404_NOT_FOUND)

        drivers = User.objects.filter(id__in=driver_ids, role=User.Roles.DRIVER)
        if not drivers.exists():
            return Response({'error': 'لم يتم العثور على الكباتن المحددين'}, status=status.HTTP_404_NOT_FOUND)

        # Mode 1: Send Offer (Driver can accept or reject)
        if mode == 'offer':
            offers = send_manual_offer_to_drivers(order=order, drivers=drivers, timeout_seconds=timeout_seconds)
            driver_names = ", ".join([d.get_full_name() or d.username for d in drivers])
            publish_centrifugo_event(
                channel="supervisor:operations",
                event_type="MANUAL_DISPATCH",
                data={
                    'order_id': str(order.id),
                    'order_number': order.order_number,
                    'mode': 'offer',
                    'offers_sent': len(offers),
                    'timestamp': timezone.now().isoformat()
                }
            )
            log_supervisor_action(
                request,
                SupervisorActionLog.ActionType.MANUAL_DISPATCH,
                target_type='Order',
                target_id=order.id,
                target_name=f"عرض طلب #{order.order_number}",
                details={'mode': 'offer', 'drivers': driver_names, 'offers_sent': len(offers)}
            )
            return Response({
                'message': f"تم إرسال عرض التوصيل للطلب #{order.order_number} إلى ({driver_names}) بنجاح 🚀",
                'mode': 'offer',
                'offers_sent': len(offers),
                'order_number': order.order_number,
                'timeout_seconds': timeout_seconds
            })

        # Mode 2: Direct Assignment (Supervisor directly assigns driver)
        driver = drivers.first()
        with transaction.atomic():
            now = timezone.now()
            driver_earnings = round(order.delivery_fee * Decimal('0.8'), 2)

            trip, created = DeliveryTrip.objects.get_or_create(
                order=order,
                defaults={
                    'driver': driver,
                    'status': DeliveryTrip.Status.ACCEPTED,
                    'distance_km': float(order.delivery_distance_km or 3.5),
                    'driver_earnings': driver_earnings,
                    'accepted_at': now,
                }
            )

            if not created:
                trip.driver = driver
                trip.status = DeliveryTrip.Status.ACCEPTED
                trip.accepted_at = now
                if not trip.driver_earnings:
                    trip.driver_earnings = driver_earnings
                trip.save(update_fields=['driver', 'status', 'accepted_at', 'driver_earnings'])

            # Set driver busy
            if hasattr(driver, 'driver_profile'):
                profile = driver.driver_profile
                profile.is_busy = True
                profile.save(update_fields=['is_busy'])

            # Expire any other pending offers for this order
            DeliveryOffer.objects.filter(
                order=order,
                status=DeliveryOffer.Status.PENDING
            ).update(status=DeliveryOffer.Status.EXPIRED)

            # Centrifugo notifications
            publish_centrifugo_event(
                channel=f"orders:order_{order.id}",
                event_type="DRIVER_ASSIGNED",
                data={
                    'driver_name': driver.get_full_name() or driver.username,
                    'driver_phone': driver.phone_number or '',
                    'trip_id': str(trip.id),
                    'is_manual_assignment': True
                }
            )

            # Direct driver notification
            trip_data = {
                'id': str(trip.id),
                'order_id': str(order.id),
                'order_number': order.order_number,
                'restaurant_name': order.restaurant.name if order.restaurant else '',
                'restaurant_address': order.restaurant.address_text if order.restaurant else '',
                'status': 'ACCEPTED',
                'driver_earnings': str(driver_earnings),
            }
            publish_centrifugo_event(f"orders:driver_{driver.id}", "NEW_ASSIGNED_TRIP", {'trip': trip_data, **trip_data})
            publish_centrifugo_event(f"driver_{driver.id}", "assigned_trip", trip_data)

            driver_name = driver.get_full_name() or driver.username
            publish_centrifugo_event(
                channel="supervisor:operations",
                event_type="MANUAL_DISPATCH",
                data={
                    'order_id': str(order.id),
                    'order_number': order.order_number,
                    'driver_id': str(driver.id),
                    'driver_name': driver_name,
                    'trip_id': str(trip.id),
                    'mode': 'direct',
                    'timestamp': now.isoformat()
                }
            )
            log_supervisor_action(
                request,
                SupervisorActionLog.ActionType.MANUAL_DISPATCH,
                target_type='Order',
                target_id=order.id,
                target_name=f"إسناد مباشر للطلب #{order.order_number}",
                details={'mode': 'direct', 'driver_id': str(driver.id), 'driver_name': driver_name, 'trip_id': str(trip.id)}
            )
            return Response({
                'message': f"تم تعيين الطلب #{order.order_number} مباشرة للكابتن ({driver_name}) بنجاح 🎉",
                'mode': 'direct',
                'order_number': order.order_number,
                'driver_name': driver_name,
                'trip_id': str(trip.id),
                'status': trip.status
            })


class SupervisorCashReconciliationView(APIView):
    """View fleet cash debt, drivers over ceiling, and recent settlements."""
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        settings = PlatformSetting.get_settings()
        cod_ceiling = float(settings.cod_max_ceiling)

        profiles = DriverProfile.objects.select_related('user').filter(
            user__role=User.Roles.DRIVER
        ).order_by('-cash_in_hand')

        drivers_list = []
        total_market_cash = 0.0
        over_limit_count = 0

        for p in profiles:
            cash = float(p.cash_in_hand or 0.0)
            total_market_cash += cash
            is_over = cash >= cod_ceiling
            if is_over:
                over_limit_count += 1

            pct = round((cash / cod_ceiling) * 100, 1) if cod_ceiling > 0 else 0

            # Last settlement
            last_settlement = p.user.cash_settlements.first()

            drivers_list.append({
                'id': str(p.user.id),
                'profile_id': p.id,
                'name': p.user.get_full_name() or p.user.username,
                'username': p.user.username,
                'phone_number': p.user.phone_number or '',
                'is_active': p.user.is_active,
                'is_online': p.is_online,
                'is_busy': p.is_busy,
                'vehicle_type': p.get_vehicle_type_display(),
                'cash_in_hand': cash,
                'cod_max_ceiling': cod_ceiling,
                'is_over_limit': is_over,
                'limit_percent': pct,
                'total_delivered_orders': p.total_delivered_orders,
                'last_settlement': {
                    'amount': float(last_settlement.amount),
                    'date': last_settlement.created_at.strftime('%Y-%m-%d %H:%M')
                } if last_settlement else None
            })

        # Recent settlements
        settlements_qs = DriverCashSettlement.objects.select_related('driver', 'supervisor')[:30]
        recent_settlements = [
            {
                'id': str(s.id),
                'driver_name': s.driver.get_full_name() or s.driver.username,
                'driver_phone': s.driver.phone_number or '',
                'supervisor_name': (s.supervisor.get_full_name() or s.supervisor.username) if s.supervisor else 'مشرف العمليات',
                'amount': float(s.amount),
                'balance_before': float(s.balance_before),
                'balance_after': float(s.balance_after),
                'status': s.status,
                'status_display': s.get_status_display(),
                'notes': s.notes or '',
                'created_at': s.created_at.strftime('%Y-%m-%d %H:%M'),
            }
            for s in settlements_qs
        ]

        pending_count = DriverCashSettlement.objects.filter(status=DriverCashSettlement.Status.PENDING_APPROVAL).count()

        return Response({
            'cod_max_ceiling': cod_ceiling,
            'supervisor_max_settlement_limit': float(getattr(settings, 'supervisor_max_settlement_limit', 500.00)),
            'pending_approvals_count': pending_count,
            'total_market_cash': round(total_market_cash, 2),
            'over_limit_count': over_limit_count,
            'total_drivers_count': len(drivers_list),
            'drivers': drivers_list,
            'recent_settlements': recent_settlements
        })


class SupervisorRecordSettlementView(APIView):
    """Record a cash collection/settlement from a driver (with graduated limit check)."""
    permission_classes = [IsSupervisorOrAdmin]

    def post(self, request):
        driver_id = request.data.get('driver_id')
        raw_amount = request.data.get('amount')
        notes = request.data.get('notes', '').strip()

        if not driver_id:
            return Response({'error': 'يرجى تحديد الكابتن (driver_id)'}, status=status.HTTP_400_BAD_REQUEST)

        # Support querying by user_id (UUID) or driver profile id (int)
        profile = None
        if str(driver_id).isdigit():
            profile = DriverProfile.objects.select_related('user').filter(id=int(driver_id)).first()
        if not profile:
            profile = DriverProfile.objects.select_related('user').filter(user_id=driver_id).first()

        if not profile:
            return Response({'error': 'الكابتن غير موجود'}, status=status.HTTP_404_NOT_FOUND)

        settings = PlatformSetting.get_settings()
        supervisor_limit = Decimal(str(getattr(settings, 'supervisor_max_settlement_limit', 500.00)))
        is_manager = bool(
            request.user.is_superuser or
            getattr(request.user, 'role', '') in [User.Roles.ADMIN, User.Roles.OPS_MANAGER]
        )

        with transaction.atomic():
            User.objects.select_for_update().get(id=request.user.id)
            profile = DriverProfile.objects.select_for_update().get(id=profile.id)
            balance_before = profile.cash_in_hand

            if raw_amount is None or str(raw_amount).strip().lower() in ['', 'all']:
                settle_amount = balance_before
            else:
                try:
                    settle_amount = Decimal(str(raw_amount))
                except Exception:
                    return Response({'error': 'قيمة المبلغ غير صحيحة'}, status=status.HTTP_400_BAD_REQUEST)

            if not settle_amount.is_finite():
                return Response({'error': 'قيمة المبلغ غير صحيحة'}, status=status.HTTP_400_BAD_REQUEST)

            if settle_amount <= Decimal('0.00'):
                return Response({'error': 'المبلغ يجب أن يكون أكبر من صفر'}, status=status.HTTP_400_BAD_REQUEST)

            driver_name = profile.user.get_full_name() or profile.user.username

            # F10: Enforce cumulative daily settlement cap per supervisor
            today = timezone.now().date()
            daily_settled = DriverCashSettlement.objects.filter(
                supervisor=request.user,
                status=DriverCashSettlement.Status.APPROVED,
                created_at__date=today
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            # If cumulative daily settlements + current amount exceed supervisor limit and user is NOT manager, require approval
            if (Decimal(str(daily_settled)) + settle_amount > supervisor_limit) and not is_manager:
                settlement = DriverCashSettlement.objects.create(
                    driver=profile.user,
                    supervisor=request.user if request.user.is_authenticated else None,
                    amount=settle_amount,
                    balance_before=balance_before,
                    balance_after=max(Decimal('0.00'), balance_before - settle_amount),
                    status=DriverCashSettlement.Status.PENDING_APPROVAL,
                    notes=notes or f"توريد كاش بقيمة {settle_amount} ج.م بانتظار موافقة مدير العمليات (تجاوز السقف اليومي التراكمي {supervisor_limit} ج.م)"
                )

                log_supervisor_action(
                    request,
                    SupervisorActionLog.ActionType.CASH_APPROVAL_REQUESTED,
                    target_type='DriverCashSettlement',
                    target_id=settlement.id,
                    target_name=f"طلب توريد كاش {settle_amount} ج.م للكابتن {driver_name}",
                    details={
                        'amount': float(settle_amount),
                        'daily_settled_before': float(daily_settled),
                        'supervisor_limit': float(supervisor_limit),
                        'driver_id': str(profile.user.id),
                        'driver_name': driver_name,
                    }
                )

                publish_centrifugo_event(
                    "supervisor:alerts",
                    "PENDING_CASH_APPROVAL",
                    {
                        'settlement_id': str(settlement.id),
                        'amount': float(settle_amount),
                        'driver_name': driver_name,
                        'supervisor_name': request.user.username,
                        'message': f"طلب توريد كاش بمبلغ {settle_amount} ج.م يتجاوز الحد اليومي التراكمي ويتطلب اعتماد مدير العمليات"
                    }
                )

                return Response({
                    'pending_approval': True,
                    'message': f"المبلغ التراكمي اليومي ({Decimal(str(daily_settled)) + settle_amount} ج.م) يتجاوز سقف المشرف ({supervisor_limit} ج.م). تم رفع السند لمدير العمليات للاعتماد ⏳",
                    'settlement_id': str(settlement.id),
                    'amount': float(settle_amount),
                    'balance_before': float(balance_before),
                    'balance_after': float(balance_before),
                    'driver_id': str(profile.user.id),
                    'driver_name': driver_name,
                    'status': 'PENDING_APPROVAL',
                    'created_at': settlement.created_at.strftime('%Y-%m-%d %H:%M')
                })

            # Normal or Manager-Approved flow
            balance_after = max(Decimal('0.00'), balance_before - settle_amount)
            profile.cash_in_hand = balance_after
            profile.save(update_fields=['cash_in_hand'])

            settlement = DriverCashSettlement.objects.create(
                driver=profile.user,
                supervisor=request.user if request.user.is_authenticated else None,
                amount=settle_amount,
                balance_before=balance_before,
                balance_after=balance_after,
                status=DriverCashSettlement.Status.APPROVED,
                approved_by=request.user if is_manager else None,
                approved_at=timezone.now() if is_manager else None,
                notes=notes or f"توريد كاش نقدي للمشرف {request.user.username}"
            )

            log_supervisor_action(
                request,
                SupervisorActionLog.ActionType.CASH_SETTLED,
                target_type='DriverCashSettlement',
                target_id=settlement.id,
                target_name=f"توريد كاش {settle_amount} ج.م للكابتن {driver_name}",
                details={'amount': float(settle_amount), 'driver_id': str(profile.user.id)}
            )

            # Centrifugo notify driver
            publish_centrifugo_event(
                f"orders:driver_{profile.user.id}",
                "CASH_SETTLED",
                {
                    'amount': float(settle_amount),
                    'new_balance': float(balance_after),
                    'message': f"تم توريد مبلغ {settle_amount} ج.م بنجاح. رصيد مديونيتك الحالي {balance_after} ج.م"
                }
            )

            # Centrifugo notify supervisor operations
            publish_centrifugo_event(
                channel="supervisor:operations",
                event_type="CASH_SETTLED",
                data={
                    'settlement_id': str(settlement.id),
                    'driver_id': str(profile.user.id),
                    'driver_name': driver_name,
                    'amount': float(settle_amount),
                    'balance_after': float(balance_after),
                    'timestamp': timezone.now().isoformat()
                }
            )

            return Response({
                'pending_approval': False,
                'message': f"تم تسجيل توريد مبلغ {settle_amount} ج.م من الكابتن ({driver_name}) بنجاح 💵✅",
                'settlement_id': str(settlement.id),
                'amount': float(settle_amount),
                'balance_before': float(balance_before),
                'balance_after': float(balance_after),
                'driver_id': str(profile.user.id),
                'driver_name': driver_name,
                'status': 'APPROVED',
                'created_at': settlement.created_at.strftime('%Y-%m-%d %H:%M')
            })


class SupervisorDriversRosterView(APIView):
    """List drivers with search and status filters (all, online, busy, offline, pending)."""
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        status_filter = request.query_params.get('status', 'all').lower()
        search_query = request.query_params.get('search', '').strip()

        qs = DriverProfile.objects.select_related('user').filter(user__role=User.Roles.DRIVER)

        if search_query:
            qs = qs.filter(
                Q(user__username__icontains=search_query) |
                Q(user__first_name__icontains=search_query) |
                Q(user__last_name__icontains=search_query) |
                Q(user__phone_number__icontains=search_query) |
                Q(license_plate__icontains=search_query)
            )

        if status_filter == 'online':
            qs = qs.filter(is_online=True, user__is_active=True)
        elif status_filter == 'busy':
            qs = qs.filter(is_busy=True, user__is_active=True)
        elif status_filter == 'offline':
            qs = qs.filter(is_online=False, user__is_active=True)
        elif status_filter == 'pending':
            qs = qs.filter(user__is_active=False)

        qs = qs.order_by('-user__is_active', '-is_online', '-created_at')

        settings = PlatformSetting.get_settings()
        cod_ceiling = float(settings.cod_max_ceiling)

        results = []
        for p in qs:
            cash = float(p.cash_in_hand or 0.0)
            results.append({
                'id': str(p.user.id),
                'profile_id': p.id,
                'name': p.user.get_full_name() or p.user.username,
                'username': p.user.username,
                'phone_number': p.user.phone_number or '',
                'is_active': p.user.is_active,
                'is_online': p.is_online,
                'is_busy': p.is_busy,
                'vehicle_type': p.vehicle_type,
                'vehicle_type_display': p.get_vehicle_type_display(),
                'license_plate': p.license_plate,
                'cash_in_hand': cash,
                'is_over_limit': cash >= cod_ceiling,
                'rating': float(p.rating),
                'total_delivered_orders': p.total_delivered_orders,
                'created_at': p.created_at.strftime('%Y-%m-%d'),
            })

        return Response({
            'count': len(results),
            'drivers': results
        })


class SupervisorDriverActionView(APIView):
    """Toggle driver approval, suspension, or online status."""
    permission_classes = [IsSupervisorOrAdmin]

    def post(self, request, driver_id):
        action_type = request.data.get('action', 'toggle_approve')

        # Support querying by user_id (UUID) or driver profile id (int)
        profile = None
        if str(driver_id).isdigit():
            profile = DriverProfile.objects.select_related('user').filter(id=int(driver_id)).first()
        if not profile:
            profile = DriverProfile.objects.select_related('user').filter(user_id=driver_id).first()

        if not profile:
            return Response({'error': 'الكابتن غير موجود'}, status=status.HTTP_404_NOT_FOUND)

        user = profile.user
        driver_name = user.get_full_name() or user.username

        if action_type in ['approve', 'toggle_approve']:
            if action_type == 'toggle_approve':
                user.is_active = not user.is_active
            else:
                user.is_active = True
            user.save(update_fields=['is_active'])

            if user.is_active:
                notify_driver_approved(user)
                log_supervisor_action(
                    request,
                    SupervisorActionLog.ActionType.DRIVER_APPROVED,
                    target_type='DriverProfile',
                    target_id=profile.id,
                    target_name=driver_name
                )
                msg = f"تم اعتماد وتفعيل حساب الكابتن ({driver_name}) بنجاح 🎉"
            else:
                log_supervisor_action(
                    request,
                    SupervisorActionLog.ActionType.DRIVER_DEACTIVATED,
                    target_type='DriverProfile',
                    target_id=profile.id,
                    target_name=driver_name
                )
                msg = f"تم تعطيل / إيقاف حساب الكابتن ({driver_name})"

            return Response({
                'message': msg,
                'driver_id': str(user.id),
                'is_active': user.is_active
            })

        elif action_type == 'toggle_online':
            profile.is_online = not profile.is_online
            profile.save(update_fields=['is_online'])
            log_supervisor_action(
                request,
                SupervisorActionLog.ActionType.DRIVER_STATUS_CHANGE,
                target_type='DriverProfile',
                target_id=profile.id,
                target_name=driver_name,
                details={'action': 'toggle_online', 'is_online': profile.is_online}
            )
            return Response({
                'message': f"الكابتن الآن {'متصل 🟢' if profile.is_online else 'غير متصل 🔴'}",
                'driver_id': str(user.id),
                'is_online': profile.is_online
            })

        elif action_type == 'toggle_busy':
            profile.is_busy = not profile.is_busy
            profile.save(update_fields=['is_busy'])
            log_supervisor_action(
                request,
                SupervisorActionLog.ActionType.DRIVER_STATUS_CHANGE,
                target_type='DriverProfile',
                target_id=profile.id,
                target_name=driver_name,
                details={'action': 'toggle_busy', 'is_busy': profile.is_busy}
            )
            return Response({
                'message': f"حالة انشغال الكابتن تغيرت إلى: {'مشغول في رحلة' if profile.is_busy else 'متاح للعمل'}",
                'driver_id': str(user.id),
                'is_busy': profile.is_busy
            })

        return Response({'error': f"إجراء غير معروف: {action_type}"}, status=status.HTTP_400_BAD_REQUEST)
