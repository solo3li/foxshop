from rest_framework import generics, viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Address, PlatformSetting
from .serializers import (
    UserSerializer, RegisterSerializer, DriverRegisterSerializer, LoginSerializer,
    AddressSerializer, PlatformSettingPublicSerializer
)

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


class DriverRegisterView(generics.CreateAPIView):
    serializer_class = DriverRegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            'message': 'تم تسجيل طلب انضمام الكابتن بنجاح، وحسابك الآن قيد مراجعة وتدقيق الإدارة',
            'user': UserSerializer(user).data,
            'is_pending_approval': True
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PublicPlatformConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        setting = PlatformSetting.get_settings()
        serializer = PlatformSettingPublicSerializer(setting)
        return Response(serializer.data)


class DriverCheckStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user_id = request.query_params.get('user_id')
        username = request.query_params.get('username')
        phone = request.query_params.get('phone')

        user = None
        if user_id:
            user = User.objects.filter(id=user_id, role=User.Roles.DRIVER).first()
        elif username:
            user = User.objects.filter(username=username, role=User.Roles.DRIVER).first()
        elif phone:
            user = User.objects.filter(phone_number=phone, role=User.Roles.DRIVER).first()

        if not user:
            return Response({'error': 'لم يتم العثور على حساب السائق'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'user_id': str(user.id),
            'username': user.username,
            'is_active': user.is_active,
            'status': 'ACTIVE' if user.is_active else 'PENDING',
            'message': 'تم تفعيل واعتماد الحساب بنجاح' if user.is_active else 'الحساب لا يزال قيد المراجعة والتدقيق'
        })
