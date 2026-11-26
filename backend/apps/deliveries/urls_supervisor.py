from django.urls import path
from .views_supervisor import (
    SupervisorStatsView,
    SupervisorDriverRadarView,
    SupervisorLiveOrdersDispatchView,
    SupervisorManualDispatchView,
    SupervisorCashReconciliationView,
    SupervisorRecordSettlementView,
    SupervisorDriversRosterView,
    SupervisorDriverActionView
)
from .views_ops import (
    SupervisorTeamView,
    SupervisorTeamMemberDetailView,
    SupervisorAuditLogView,
    SupervisorPendingApprovalsView,
    SupervisorOpsAnalyticsView,
    SupervisorDeliveryZonesView
)

urlpatterns = [
    # Dashboard Fleet Overview Stats
    path('stats/', SupervisorStatsView.as_view(), name='supervisor-stats'),

    # Driver Radar & Live GPS Locations
    path('radar/', SupervisorDriverRadarView.as_view(), name='supervisor-driver-radar'),
    path('drivers/locations/', SupervisorDriverRadarView.as_view(), name='supervisor-drivers-locations'),

    # Live Orders Dispatch
    path('dispatch/orders/', SupervisorLiveOrdersDispatchView.as_view(), name='supervisor-dispatch-orders'),
    path('live-orders/', SupervisorLiveOrdersDispatchView.as_view(), name='supervisor-live-orders'),
    path('dispatch/assign/', SupervisorManualDispatchView.as_view(), name='supervisor-manual-dispatch'),

    # Cash Reconciliation & Settlements
    path('cash/reconciliation/', SupervisorCashReconciliationView.as_view(), name='supervisor-cash-reconciliation'),
    path('cash/settle/', SupervisorRecordSettlementView.as_view(), name='supervisor-record-settlement'),

    # Drivers Roster & Management
    path('drivers/', SupervisorDriversRosterView.as_view(), name='supervisor-drivers-roster'),
    path('drivers/<str:driver_id>/action/', SupervisorDriverActionView.as_view(), name='supervisor-driver-action'),

    # 👑 Ops Manager / Director Exclusive Endpoints (Talabat Architecture)
    path('ops/team/', SupervisorTeamView.as_view(), name='ops-team-list-create'),
    path('ops/team/<uuid:user_id>/', SupervisorTeamMemberDetailView.as_view(), name='ops-team-member-detail'),
    path('ops/audit-log/', SupervisorAuditLogView.as_view(), name='ops-audit-log'),
    path('ops/approvals/', SupervisorPendingApprovalsView.as_view(), name='ops-pending-approvals'),
    path('ops/approvals/<uuid:settlement_id>/', SupervisorPendingApprovalsView.as_view(), name='ops-approval-decision'),
    path('ops/analytics/', SupervisorOpsAnalyticsView.as_view(), name='ops-analytics-kpis'),
    path('ops/zones/', SupervisorDeliveryZonesView.as_view(), name='ops-delivery-zones'),
]
