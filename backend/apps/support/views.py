from rest_framework import viewsets, permissions, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.support.models import SupportTicket, TicketMessage
from apps.support.serializers import (
    SupportTicketListSerializer,
    SupportTicketDetailSerializer,
    SupportTicketCreateSerializer,
    TicketMessageSerializer
)

class SupportTicketViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user, 'role', '') == 'ADMIN':
            qs = SupportTicket.objects.all()
            category = self.request.query_params.get('category')
            ticket_status = self.request.query_params.get('status')
            priority = self.request.query_params.get('priority')
            if category:
                qs = qs.filter(category=category)
            if ticket_status:
                qs = qs.filter(status=ticket_status)
            if priority:
                qs = qs.filter(priority=priority)
            return qs.select_related('user', 'assigned_agent', 'order')
        return SupportTicket.objects.filter(user=user).select_related('user', 'assigned_agent', 'order')

    def get_serializer_class(self):
        if self.action == 'create':
            return SupportTicketCreateSerializer
        elif self.action == 'retrieve':
            return SupportTicketDetailSerializer
        return SupportTicketListSerializer

    @action(detail=True, methods=['post'], url_path='messages')
    def add_message(self, request, pk=None):
        ticket = self.get_object()

        # Check if user has permission
        if not (request.user == ticket.user or request.user.is_staff or getattr(request.user, 'role', '') == 'ADMIN'):
            return Response({'detail': 'غير مصرح لك بإرسال رسالة في هذه التذكرة.'}, status=status.HTTP_403_FORBIDDEN)

        if ticket.status == SupportTicket.Status.CLOSED:
            return Response({'detail': 'لا يمكن إرسال رسائل في تذكرة مغلقة.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = TicketMessageSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(ticket=ticket)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        ticket = self.get_object()
        user = request.user

        new_status = request.data.get('status')
        if not new_status or new_status not in SupportTicket.Status.values:
            return Response({'detail': 'حالة التذكرة غير صحيحة.'}, status=status.HTTP_400_BAD_REQUEST)

        # Non-staff users can only close their own ticket
        if not (user.is_staff or getattr(user, 'role', '') == 'ADMIN'):
            if new_status != SupportTicket.Status.CLOSED:
                return Response({'detail': 'يمكنك فقط إغلاق التذكرة الخاصة بك.'}, status=status.HTTP_403_FORBIDDEN)

        ticket.status = new_status
        if 'assigned_agent_id' in request.data and (user.is_staff or getattr(user, 'role', '') == 'ADMIN'):
            ticket.assigned_agent_id = request.data.get('assigned_agent_id')
        ticket.save()

        return Response(SupportTicketDetailSerializer(ticket, context={'request': request}).data)
