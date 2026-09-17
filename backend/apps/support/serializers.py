from rest_framework import serializers
from apps.support.models import SupportTicket, TicketMessage
from apps.support.services import broadcast_ticket_message

class TicketMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.SerializerMethodField()

    class Meta:
        model = TicketMessage
        fields = [
            'id', 'ticket', 'sender', 'sender_name', 'sender_role',
            'message_text', 'attachment', 'is_internal_note', 'created_at'
        ]
        read_only_fields = ['id', 'ticket', 'sender', 'created_at']

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username

    def get_sender_role(self, obj):
        return getattr(obj.sender, 'role', 'USER')

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['sender'] = user
        
        # Non-staff users cannot create internal notes
        if not (user.is_staff or user.role == 'ADMIN'):
            validated_data['is_internal_note'] = False

        message = super().create(validated_data)
        
        # Broadcast via Centrifugo
        broadcast_ticket_message(message)
        
        # Update ticket status if user responded
        ticket = message.ticket
        if user == ticket.user and ticket.status in [SupportTicket.Status.WAITING_USER, SupportTicket.Status.RESOLVED]:
            ticket.status = SupportTicket.Status.IN_PROGRESS
            ticket.save(update_fields=['status', 'updated_at'])
        elif user.is_staff and ticket.status == SupportTicket.Status.OPEN:
            ticket.status = SupportTicket.Status.IN_PROGRESS
            ticket.save(update_fields=['status', 'updated_at'])
            
        return message


class SupportTicketListSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_agent_name = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'ticket_number', 'user', 'user_name', 'user_role',
            'order', 'category', 'category_display', 'priority', 'priority_display',
            'status', 'status_display', 'subject', 'assigned_agent',
            'assigned_agent_name', 'last_message', 'created_at', 'updated_at'
        ]

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_assigned_agent_name(self, obj):
        if obj.assigned_agent:
            return obj.assigned_agent.get_full_name() or obj.assigned_agent.username
        return None

    def get_last_message(self, obj):
        last_msg = obj.messages.filter(is_internal_note=False).last()
        if last_msg:
            return {
                'sender_name': last_msg.sender.get_full_name() or last_msg.sender.username,
                'message_text': last_msg.message_text[:60],
                'created_at': last_msg.created_at
            }
        return None


class SupportTicketDetailSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_agent_name = serializers.SerializerMethodField()
    messages = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'ticket_number', 'user', 'user_name', 'user_role',
            'order', 'category', 'category_display', 'priority', 'priority_display',
            'status', 'status_display', 'subject', 'assigned_agent',
            'assigned_agent_name', 'messages', 'created_at', 'updated_at'
        ]

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_assigned_agent_name(self, obj):
        if obj.assigned_agent:
            return obj.assigned_agent.get_full_name() or obj.assigned_agent.username
        return None

    def get_messages(self, obj):
        user = self.context['request'].user
        qs = obj.messages.all()
        if not (user.is_staff or getattr(user, 'role', '') == 'ADMIN'):
            qs = qs.filter(is_internal_note=False)
        return TicketMessageSerializer(qs, many=True, context=self.context).data


class SupportTicketCreateSerializer(serializers.ModelSerializer):
    initial_message = serializers.CharField(write_only=True, required=True)
    attachment = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'ticket_number', 'order', 'category', 'priority',
            'subject', 'initial_message', 'attachment', 'created_at'
        ]
        read_only_fields = ['id', 'ticket_number', 'created_at']

    def create(self, validated_data):
        initial_message = validated_data.pop('initial_message')
        attachment = validated_data.pop('attachment', None)
        user = self.context['request'].user

        ticket = SupportTicket.objects.create(
            user=user,
            user_role=getattr(user, 'role', 'CUSTOMER'),
            **validated_data
        )

        msg = TicketMessage.objects.create(
            ticket=ticket,
            sender=user,
            message_text=initial_message,
            attachment=attachment
        )
        broadcast_ticket_message(msg)

        return ticket
