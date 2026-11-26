import logging
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q, Count
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.accounts.models import User, PlatformSetting
from apps.deliveries.models import (
    DriverProfile,
    DeliveryTrip,
    DeliveryOffer,
    DriverCashSettlement,
    DeliveryZone,
    SupervisorActionLog
)
from apps.notifications.services import publish_centrifugo_event

logger = logging.getLogger(__name__)


class IsOpsManagerOrAdmin(permissions.BasePermission):
    """Allows access strictly to superusers or users with role ADMIN or OPS_MANAGER."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (
                request.user.is_superuser or
                getattr(request.user, 'role', '') in [User.Roles.ADMIN, User.Roles.OPS_MANAGER]
            )
        )


class IsSupervisorOrAbove(permissions.BasePermission):
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


def log_supervisor_action(request, action_type, target_type='', target_id='', target_name='', details=None):
    """Helper to record an immutable audit log entry for operations and supervisors."""
    try:
        user = request.user if request and request.user and request.user.is_authenticated else None
        role = getattr(user, 'role', 'ANONYMOUS') if user else 'SYSTEM'
        ip = None
        if request:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0].strip()
            else:
                ip = request.META.get('REMOTE_ADDR')

        return SupervisorActionLog.objects.create(
            actor=user,
            actor_role=role,
            action_type=action_type,
            target_type=target_type,
            target_id=str(target_id) if target_id else '',
            target_name=str(target_name) if target_name else '',
            details=details or {},
            ip_address=ip
        )
    except Exception as e:
        logger.warning(f"Failed to record supervisor action log: {e}")
        return None


class SupervisorTeamView(APIView):
    """Manage Supervisors and Ops Managers (List & Create)."""
    permission_classes = [IsOpsManagerOrAdmin]

    def get(self, request):
        search_query = request.query_params.get('search', '').strip()
        role_filter = request.query_params.get('role', 'all').strip().upper()

        qs = User.objects.filter(
            Q(role__in=[User.Roles.SUPERVISOR, User.Roles.OPS_MANAGER, User.Roles.ADMIN]) |
            Q(is_staff=True)
        ).prefetch_related('assigned_zones').order_by('-date_joined')

        if search_query:
            qs = qs.filter(
                Q(username__icontains=search_query) |
                Q(first_name__icontains=search_query) |
                Q(last_name__icontains=search_query) |
                Q(phone_number__icontains=search_query) |
                Q(email__icontains=search_query)
            )

        if role_filter != 'ALL':
            qs = qs.filter(role=role_filter)

        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        members = []
        for u in qs:
            dispatched_today = SupervisorActionLog.objects.filter(
                actor=u,
                action_type=SupervisorActionLog.ActionType.MANUAL_DISPATCH,
                created_at__gte=today_start
            ).count()

            settlements_today = DriverCashSettlement.objects.filter(
                supervisor=u,
                created_at__gte=today_start
            ).count()

            zones = [
                {'id': str(z.id), 'name': z.name, 'code': z.code, 'city': z.city}
                for z in u.assigned_zones.all()
            ]

            members.append({
                'id': str(u.id),
                'username': u.username,
                'full_name': u.get_full_name() or u.username,
                'email': u.email or '',
                'phone_number': u.phone_number or '',
                'role': u.role,
                'role_display': u.get_role_display(),
                'is_active': u.is_active,
                'is_staff': u.is_staff,
                'last_login': u.last_login.strftime('%Y-%m-%d %H:%M') if u.last_login else None,
                'date_joined': u.date_joined.strftime('%Y-%m-%d'),
                'assigned_zones': zones,
                'metrics': {
                    'dispatches_today': dispatched_today,
                    'settlements_today': settlements_today,
                }
            })

        return Response({
            'count': len(members),
            'members': members
        })

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()
        email = request.data.get('email', '').strip()
        phone_number = request.data.get('phone_number', '').strip()
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()
        role = request.data.get('role', User.Roles.SUPERVISOR).strip().upper()
        zone_ids = request.data.get('zone_ids', [])

        if not username:
            return Response({'error': 'اسم المستخدم مطلوب'}, status=status.HTTP_400_BAD_REQUEST)
        if not password or len(password) < 6:
            return Response({'error': 'كلمة المرور يجب أن لا تقل عن 6 أحرف'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'اسم المستخدم مسجل مسبقاً'}, status=status.HTTP_400_BAD_REQUEST)
        if phone_number and User.objects.filter(phone_number=phone_number).exists():
            return Response({'error': 'رقم الهاتف مسجل مسبقاً'}, status=status.HTTP_400_BAD_REQUEST)

        valid_roles = [User.Roles.SUPERVISOR, User.Roles.OPS_MANAGER]
        if role not in valid_roles:
            role = User.Roles.SUPERVISOR

        user = User.objects.create(
            username=username,
            email=email,
            phone_number=phone_number or None,
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_staff=True,
            is_active=True
        )
        user.set_password(password)
        user.save()

        if zone_ids:
            zones = DeliveryZone.objects.filter(id__in=zone_ids)
            user.assigned_zones.set(zones)

        log_supervisor_action(
            request,
            SupervisorActionLog.ActionType.SUPERVISOR_CREATED,
            target_type='User',
            target_id=user.id,
            target_name=user.get_full_name() or user.username,
            details={'role': role, 'username': username}
        )

        return Response({
            'message': f"تم إنشاء حساب ({user.get_full_name() or user.username}) بنجاح 🎉",
            'id': str(user.id),
            'username': user.username,
            'role': user.role,
            'role_display': user.get_role_display()
        }, status=status.HTTP_201_CREATED)


class SupervisorTeamMemberDetailView(APIView):
    """Update or toggle status of a supervisor / ops manager."""
    permission_classes = [IsOpsManagerOrAdmin]

    def patch(self, request, user_id):
        target_user = User.objects.filter(id=user_id).first()
        if not target_user:
            return Response({'error': 'المستخدم غير موجود'}, status=status.HTTP_404_NOT_FOUND)

        # Prevent non-superusers from modifying superusers or themselves maliciously
        if target_user.is_superuser and not request.user.is_superuser:
            return Response({'error': 'لا يمكنك تعديل حساب المدير العام الأعلى'}, status=status.HTTP_403_FORBIDDEN)

        updated_fields = []
        if 'is_active' in request.data:
            target_user.is_active = bool(request.data['is_active'])
            updated_fields.append('is_active')

        if 'role' in request.data:
            new_role = request.data['role'].strip().upper()
            if new_role in [User.Roles.SUPERVISOR, User.Roles.OPS_MANAGER, User.Roles.ADMIN]:
                target_user.role = new_role
                updated_fields.append('role')

        if 'first_name' in request.data:
            target_user.first_name = request.data['first_name'].strip()
            updated_fields.append('first_name')

        if 'last_name' in request.data:
            target_user.last_name = request.data['last_name'].strip()
            updated_fields.append('last_name')

        if 'phone_number' in request.data:
            target_user.phone_number = request.data['phone_number'].strip() or None
            updated_fields.append('phone_number')

        if 'password' in request.data and request.data['password']:
            pwd = request.data['password'].strip()
            if len(pwd) >= 6:
                target_user.set_password(pwd)
                updated_fields.append('password')

        if updated_fields:
            target_user.save()

        if 'zone_ids' in request.data:
            zones = DeliveryZone.objects.filter(id__in=request.data['zone_ids'])
            target_user.assigned_zones.set(zones)

        log_supervisor_action(
            request,
            SupervisorActionLog.ActionType.SUPERVISOR_STATUS_TOGGLE,
            target_type='User',
            target_id=target_user.id,
            target_name=target_user.get_full_name() or target_user.username,
            details={'updated_fields': updated_fields, 'is_active': target_user.is_active}
        )

        return Response({
            'message': f"تم تحديث بيانات الحساب ({target_user.username}) بنجاح ✅",
            'id': str(target_user.id),
            'is_active': target_user.is_active,
            'role': target_user.role
        })

    def delete(self, request, user_id):
        target_user = User.objects.filter(id=user_id).first()
        if not target_user:
            return Response({'error': 'المستخدم غير موجود'}, status=status.HTTP_404_NOT_FOUND)
        if target_user == request.user:
            return Response({'error': 'لا يمكنك تعطيل حسابك بنفسك'}, status=status.HTTP_400_BAD_REQUEST)

        target_user.is_active = False
        target_user.save(update_fields=['is_active'])

        log_supervisor_action(
            request,
            SupervisorActionLog.ActionType.SUPERVISOR_STATUS_TOGGLE,
            target_type='User',
            target_id=target_user.id,
            target_name=target_user.username,
            details={'action': 'deactivated'}
        )

        return Response({'message': f"تم تعطيل حساب ({target_user.username}) بنجاح"})


class SupervisorAuditLogView(APIView):
    """Streamlined Talabat-style Audit Log for Operations."""
    permission_classes = [IsOpsManagerOrAdmin]

    def get(self, request):
        action_type = request.query_params.get('action_type', '').strip()
        actor_id = request.query_params.get('actor_id', '').strip()
        search_query = request.query_params.get('search', '').strip()
        limit = min(int(request.query_params.get('limit', 60)), 200)

        qs = SupervisorActionLog.objects.select_related('actor').order_by('-created_at')

        if action_type:
            qs = qs.filter(action_type=action_type)
        if actor_id:
            qs = qs.filter(actor_id=actor_id)
        if search_query:
            qs = qs.filter(
                Q(target_name__icontains=search_query) |
                Q(actor__username__icontains=search_query) |
                Q(target_id__icontains=search_query)
            )

        logs = []
        for l in qs[:limit]:
            logs.append({
                'id': str(l.id),
                'action_type': l.action_type,
                'action_label': l.get_action_type_display(),
                'actor_id': str(l.actor.id) if l.actor else None,
                'actor_name': l.actor.get_full_name() or l.actor.username if l.actor else 'النظام',
                'actor_role': l.actor_role or (l.actor.role if l.actor else 'SYSTEM'),
                'target_type': l.target_type,
                'target_id': l.target_id,
                'target_name': l.target_name,
                'details': l.details,
                'ip_address': l.ip_address,
                'created_at': l.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            })

        return Response({
            'count': len(logs),
            'action_types': [
                {'value': choice[0], 'label': choice[1]}
                for choice in SupervisorActionLog.ActionType.choices
            ],
            'logs': logs
        })


class SupervisorPendingApprovalsView(APIView):
    """Review and decide on cash settlements exceeding supervisor limits."""
    permission_classes = [IsOpsManagerOrAdmin]

    def get(self, request):
        pending_qs = DriverCashSettlement.objects.filter(
            status=DriverCashSettlement.Status.PENDING_APPROVAL
        ).select_related('driver', 'supervisor').order_by('-created_at')

        results = []
        for s in pending_qs:
            results.append({
                'id': str(s.id),
                'driver_id': str(s.driver.id),
                'driver_name': s.driver.get_full_name() or s.driver.username,
                'driver_phone': s.driver.phone_number or '',
                'supervisor_id': str(s.supervisor.id) if s.supervisor else None,
                'supervisor_name': (s.supervisor.get_full_name() or s.supervisor.username) if s.supervisor else 'مشرف العمليات',
                'amount': float(s.amount),
                'balance_before': float(s.balance_before),
                'balance_after': float(s.balance_after),
                'notes': s.notes or '',
                'created_at': s.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            })

        return Response({
            'count': len(results),
            'pending_approvals': results
        })

    def post(self, request, settlement_id):
        action = request.data.get('action', '').strip().lower()
        reason = request.data.get('reason', '').strip()

        if action not in ['approve', 'reject']:
            return Response({'error': 'الإجراء المطلوب يجب أن يكون approve أو reject'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            settlement = (
                DriverCashSettlement.objects.select_for_update()
                .filter(id=settlement_id)
                .select_related('driver')
                .first()
            )
            if not settlement:
                return Response({'error': 'سند التوريد غير موجود'}, status=status.HTTP_404_NOT_FOUND)

            if settlement.supervisor_id == request.user.id:
                return Response(
                    {'error': 'لا يمكنك اعتماد أو رفض سند توريد قمت بإنشائه بنفسك'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if settlement.status != DriverCashSettlement.Status.PENDING_APPROVAL:
                return Response(
                    {'error': f'هذا السند تمت معالجته مسبقاً ({settlement.get_status_display()})'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            profile = DriverProfile.objects.select_for_update().filter(user=settlement.driver).first()
            if not profile:
                return Response({'error': 'ملف الكابتن غير موجود'}, status=status.HTTP_404_NOT_FOUND)

            if action == 'approve':
                balance_before = profile.cash_in_hand
                balance_after = max(Decimal('0.00'), balance_before - settlement.amount)

                profile.cash_in_hand = balance_after
                profile.save(update_fields=['cash_in_hand'])

                settlement.status = DriverCashSettlement.Status.APPROVED
                settlement.balance_before = balance_before
                settlement.balance_after = balance_after
                settlement.approved_by = request.user
                settlement.approved_at = timezone.now()
                settlement.save()

                # Centrifugo notify driver
                publish_centrifugo_event(
                    f"orders:driver_{profile.user.id}",
                    "CASH_SETTLED",
                    {
                        'amount': float(settlement.amount),
                        'new_balance': float(balance_after),
                        'message': f"تم اعتماد توريد مبلغ {settlement.amount} ج.م من قبل مدير العمليات. رصيدك الحالي {balance_after} ج.م"
                    }
                )

                log_supervisor_action(
                    request,
                    SupervisorActionLog.ActionType.CASH_APPROVED,
                    target_type='DriverCashSettlement',
                    target_id=settlement.id,
                    target_name=f"اعتماد توريد {settlement.amount} ج.م للكابتن {settlement.driver.username}",
                    details={'amount': float(settlement.amount), 'driver_id': str(settlement.driver.id)}
                )

                return Response({
                    'message': f"تم اعتماد توريد مبلغ {settlement.amount} ج.م بنجاح وتحديث مديونية الكابتن 💵✅",
                    'settlement_id': str(settlement.id),
                    'status': settlement.status,
                    'balance_after': float(balance_after)
                })

            else:  # reject
                settlement.status = DriverCashSettlement.Status.REJECTED
                settlement.rejection_reason = reason or "تم رفض السند بواسطة مدير العمليات"
                settlement.approved_by = request.user
                settlement.approved_at = timezone.now()
                settlement.save()

                log_supervisor_action(
                    request,
                    SupervisorActionLog.ActionType.CASH_REJECTED,
                    target_type='DriverCashSettlement',
                    target_id=settlement.id,
                    target_name=f"رفض توريد {settlement.amount} ج.م للكابتن {settlement.driver.username}",
                    details={'reason': settlement.rejection_reason}
                )

                return Response({
                    'message': f"تم رفض سند التوريد ({settlement.rejection_reason}) ❌",
                    'settlement_id': str(settlement.id),
                    'status': settlement.status
                })


class SupervisorOpsAnalyticsView(APIView):
    """Executive KPIs and Fleet Health Metrics for Operations Manager."""
    permission_classes = [IsOpsManagerOrAdmin]

    def get(self, request):
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Team metrics
        supervisors_qs = User.objects.filter(
            Q(role__in=[User.Roles.SUPERVISOR, User.Roles.OPS_MANAGER]) | Q(is_staff=True)
        )
        total_supervisors = supervisors_qs.count()
        active_supervisors = supervisors_qs.filter(is_active=True).count()

        # Audit activity today
        today_audits = SupervisorActionLog.objects.filter(created_at__gte=today_start)
        actions_today_count = today_audits.count()
        manual_dispatches_today = today_audits.filter(
            action_type=SupervisorActionLog.ActionType.MANUAL_DISPATCH
        ).count()

        # Approvals
        pending_approvals_count = DriverCashSettlement.objects.filter(
            status=DriverCashSettlement.Status.PENDING_APPROVAL
        ).count()

        approved_settlements_today = DriverCashSettlement.objects.filter(
            status=DriverCashSettlement.Status.APPROVED,
            created_at__gte=today_start
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # Leaderboard of supervisors today
        leaderboard_data = []
        for sup in supervisors_qs.filter(is_active=True)[:10]:
            sup_dispatches = today_audits.filter(actor=sup, action_type=SupervisorActionLog.ActionType.MANUAL_DISPATCH).count()
            sup_settlements = DriverCashSettlement.objects.filter(supervisor=sup, created_at__gte=today_start).count()
            sup_approved_drivers = today_audits.filter(actor=sup, action_type=SupervisorActionLog.ActionType.DRIVER_APPROVED).count()

            leaderboard_data.append({
                'id': str(sup.id),
                'name': sup.get_full_name() or sup.username,
                'role': sup.get_role_display(),
                'dispatches': sup_dispatches,
                'settlements': sup_settlements,
                'approved_drivers': sup_approved_drivers,
                'total_actions': sup_dispatches + sup_settlements + sup_approved_drivers
            })
        leaderboard_data.sort(key=lambda x: x['total_actions'], reverse=True)

        # Zones overview
        zones_overview = []
        for z in DeliveryZone.objects.filter(is_active=True):
            zones_overview.append({
                'id': str(z.id),
                'name': z.name,
                'code': z.code,
                'city': z.city,
                'radius_km': z.radius_km,
                'drivers_count': z.drivers.count(),
                'supervisors_count': z.supervisors.count()
            })

        # Recent 10 critical events
        recent_events = []
        for ev in today_audits.select_related('actor')[:10]:
            recent_events.append({
                'id': str(ev.id),
                'action_label': ev.get_action_type_display(),
                'actor_name': ev.actor.get_full_name() or ev.actor.username if ev.actor else 'النظام',
                'target_name': ev.target_name,
                'created_at': ev.created_at.strftime('%H:%M:%S')
            })

        return Response({
            'team': {
                'total_supervisors': total_supervisors,
                'active_supervisors': active_supervisors,
                'actions_today': actions_today_count,
            },
            'dispatches': {
                'manual_dispatches_today': manual_dispatches_today,
            },
            'cash': {
                'pending_approvals_count': pending_approvals_count,
                'approved_settlements_today': float(approved_settlements_today),
            },
            'leaderboard': leaderboard_data,
            'zones': zones_overview,
            'recent_events': recent_events
        })


class SupervisorDeliveryZonesView(APIView):
    """Operational Zones Management (Talabat Cluster Model)."""
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        zones = DeliveryZone.objects.prefetch_related('supervisors', 'drivers').all()
        results = []
        for z in zones:
            results.append({
                'id': str(z.id),
                'name': z.name,
                'code': z.code,
                'city': z.city,
                'center_latitude': float(z.center_latitude),
                'center_longitude': float(z.center_longitude),
                'radius_km': z.radius_km,
                'is_active': z.is_active,
                'drivers_count': z.drivers.count(),
                'supervisors': [
                    {'id': str(s.id), 'name': s.get_full_name() or s.username}
                    for s in z.supervisors.all()
                ],
                'created_at': z.created_at.strftime('%Y-%m-%d')
            })
        return Response({'count': len(results), 'zones': results})

    def post(self, request):
        if not IsOpsManagerOrAdmin().has_permission(request, self):
            return Response({'error': 'إضافة المناطق التشغيلية مخصص لمدير العمليات فقط'}, status=status.HTTP_403_FORBIDDEN)

        name = request.data.get('name', '').strip()
        code = request.data.get('code', '').strip().upper()
        city = request.data.get('city', 'القاهرة').strip()
        lat = request.data.get('center_latitude')
        lng = request.data.get('center_longitude')
        radius = float(request.data.get('radius_km', 5.0))

        if not name or not code or lat is None or lng is None:
            return Response({'error': 'يرجى تزويد الاسم والكود والإحداثيات الجغرافية للمنطقة'}, status=status.HTTP_400_BAD_REQUEST)

        if DeliveryZone.objects.filter(code=code).exists():
            return Response({'error': 'كود المنطقة مسجل مسبقاً'}, status=status.HTTP_400_BAD_REQUEST)

        zone = DeliveryZone.objects.create(
            name=name,
            code=code,
            city=city,
            center_latitude=Decimal(str(lat)),
            center_longitude=Decimal(str(lng)),
            radius_km=radius,
            is_active=True
        )

        supervisor_ids = request.data.get('supervisor_ids', [])
        if supervisor_ids:
            supervisors = User.objects.filter(id__in=supervisor_ids)
            zone.supervisors.set(supervisors)

        log_supervisor_action(
            request,
            SupervisorActionLog.ActionType.ZONE_CREATED,
            target_type='DeliveryZone',
            target_id=zone.id,
            target_name=f"{zone.name} ({zone.code})",
            details={'city': city, 'radius_km': radius}
        )

        return Response({
            'message': f"تم إنشاء منطقة التشغيل ({zone.name}) بنجاح 📍",
            'id': str(zone.id),
            'name': zone.name,
            'code': zone.code
        }, status=status.HTTP_201_CREATED)
