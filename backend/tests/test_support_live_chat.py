import pytest
from unittest.mock import patch
from apps.accounts.models import User
from apps.support.models import SupportTicket, TicketMessage

@pytest.mark.django_db
def test_support_ticket_creation_and_messaging(customer_user, api_client):
    api_client.force_authenticate(user=customer_user)

    payload = {
        'category': 'ORDER_ISSUE',
        'priority': 'HIGH',
        'subject': 'تأخر في استلام الوجبة',
        'initial_message': 'مرحباً، الطلب تأخر أكثر من نصف ساعة وأحتاج مساعدة.'
    }

    with patch('apps.support.services.publish_centrifugo_event') as mock_publish:
        res = api_client.post('/api/v1/support/tickets/', payload)
        assert res.status_code == 201
        assert 'ticket_number' in res.data
        assert res.data['ticket_number'].startswith('TCK-')
        assert mock_publish.called

        ticket_id = res.data['id']

        # Add another message
        msg_payload = {
            'message_text': 'هل من تحديث بخصوص الكابتن؟'
        }
        res_msg = api_client.post(f'/api/v1/support/tickets/{ticket_id}/messages/', msg_payload)
        assert res_msg.status_code == 201
        assert res_msg.data['message_text'] == msg_payload['message_text']

@pytest.mark.django_db
def test_internal_notes_visibility(customer_user, api_client):
    staff_user = User.objects.create_user(
        username='staff_agent',
        password='password123',
        is_staff=True,
        role=User.Roles.ADMIN
    )

    ticket = SupportTicket.objects.create(
        user=customer_user,
        user_role='CUSTOMER',
        subject='استفسار عن الخصم'
    )
    # Public message
    TicketMessage.objects.create(
        ticket=ticket,
        sender=customer_user,
        message_text='مرحبا، هل الكوبون فعال؟'
    )
    # Internal note by staff
    TicketMessage.objects.create(
        ticket=ticket,
        sender=staff_user,
        message_text='ملاحظة لفريق العمل: تم تعويض العميل بنقاط محفظة.',
        is_internal_note=True
    )

    # Customer retrieves ticket: internal note MUST NOT be visible
    api_client.force_authenticate(user=customer_user)
    res_customer = api_client.get(f'/api/v1/support/tickets/{ticket.id}/')
    assert res_customer.status_code == 200
    messages = res_customer.data['messages']
    assert len(messages) == 1
    assert messages[0]['message_text'] == 'مرحبا، هل الكوبون فعال؟'

    # Staff retrieves ticket: internal note MUST be visible
    api_client.force_authenticate(user=staff_user)
    res_staff = api_client.get(f'/api/v1/support/tickets/{ticket.id}/')
    assert res_staff.status_code == 200
    staff_messages = res_staff.data['messages']
    assert len(staff_messages) == 2

@pytest.mark.django_db
def test_customer_can_close_ticket(customer_user, api_client):
    ticket = SupportTicket.objects.create(
        user=customer_user,
        user_role='CUSTOMER',
        subject='استفسار محلول',
        status=SupportTicket.Status.OPEN
    )

    api_client.force_authenticate(user=customer_user)
    res = api_client.patch(f'/api/v1/support/tickets/{ticket.id}/status/', {'status': 'CLOSED'})
    assert res.status_code == 200
    ticket.refresh_from_db()
    assert ticket.status == SupportTicket.Status.CLOSED
