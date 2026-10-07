from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from .services import generate_centrifugo_connection_token
from .models import Notification
from .serializers import NotificationSerializer

class CentrifugoTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        token = generate_centrifugo_connection_token(request.user.id)
        return Response({
            'token': token,
            'user_id': str(request.user.id)
        })

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        unread_count = self.get_queryset().filter(is_read=False).count()
        return Response({
            'unread_count': unread_count,
            'notifications': serializer.data
        })

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'status': 'marked_read', 'id': str(notification.id)})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'status': 'all_marked_read', 'updated_count': updated})

    @action(detail=False, methods=['delete', 'post'], url_path='clear-all')
    def clear_all(self, request):
        deleted_count, _ = self.get_queryset().delete()
        return Response({'status': 'cleared', 'deleted_count': deleted_count})
