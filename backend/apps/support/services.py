import logging
from apps.notifications.services import publish_centrifugo_event

logger = logging.getLogger(__name__)

def broadcast_ticket_message(ticket_message):
    """
    Broadcasts a new ticket chat message to Centrifugo channel support:ticket_{id}.
    If it's an internal note, it is only broadcast to internal support staff channel.
    """
    ticket = ticket_message.ticket
    sender = ticket_message.sender

    data = {
        'message_id': str(ticket_message.id),
        'ticket_id': str(ticket.id),
        'ticket_number': ticket.ticket_number,
        'sender_id': str(sender.id),
        'sender_name': sender.get_full_name() or sender.username,
        'sender_role': getattr(sender, 'role', 'USER'),
        'message_text': ticket_message.message_text,
        'attachment': ticket_message.attachment.url if ticket_message.attachment else None,
        'is_internal_note': ticket_message.is_internal_note,
        'created_at': ticket_message.created_at.isoformat() if ticket_message.created_at else None,
    }

    if ticket_message.is_internal_note:
        # Internal notes only visible to staff
        channel = "support:internal_notes"
        publish_centrifugo_event(channel, "new_internal_note", data)
    else:
        # Public message on ticket channel
        channel = f"support:ticket_{ticket.id}"
        publish_centrifugo_event(channel, "new_message", data)
        # Also notify general support channel for staff monitoring
        publish_centrifugo_event("support:inbox", "new_message", data)

    return True
