from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Address, PlatformSetting

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'phone_number', 'role', 'avatar']
        read_only_fields = ['id', 'role']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'password', 'first_name', 'last_name', 'email', 'phone_number', 'role']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user


class DriverRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    vehicle_type = serializers.ChoiceField(choices=['MOTORCYCLE', 'CAR', 'BICYCLE'], default='MOTORCYCLE')
    license_plate = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ['username', 'password', 'first_name', 'last_name', 'email', 'phone_number', 'vehicle_type', 'license_plate']

    def create(self, validated_data):
        from apps.deliveries.models import DriverProfile
        vehicle_type = validated_data.pop('vehicle_type', 'MOTORCYCLE')
        license_plate = validated_data.pop('license_plate', '')
        password = validated_data.pop('password')
        
        user = User.objects.create_user(
            password=password,
            role=User.Roles.DRIVER,
            is_active=False,  # pending admin approval
            **validated_data
        )

        DriverProfile.objects.create(
            user=user,
            vehicle_type=vehicle_type,
            license_plate=license_plate,
            is_online=False,
            is_busy=False
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')
        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError("اسم المستخدم أو كلمة المرور غير صحيحة")
        if not user.is_active:
            raise serializers.ValidationError("تم تعطيل هذا الحساب")
        
        refresh = RefreshToken.for_user(user)
        return {
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ['id', 'title', 'street', 'building_number', 'floor', 'apartment_number', 'delivery_instructions', 'latitude', 'longitude', 'is_default']
        read_only_fields = ['id']


class PlatformSettingPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSetting
        fields = ['google_maps_client_key', 'default_search_radius_km', 'platform_commission_percent']
