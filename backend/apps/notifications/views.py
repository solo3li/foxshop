from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from .services import generate_centrifugo_connection_token

class CentrifugoTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        token = generate_centrifugo_connection_token(request.user.id)
        return Response({
            'token': token,
            'user_id': str(request.user.id)
        })
