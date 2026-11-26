import re
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
    phone_number = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ['username', 'password', 'first_name', 'last_name', 'email', 'phone_number']
        extra_kwargs = {
            'phone_number': {'validators': []},
        }

    def validate_username(self, value):
        val = value.strip()
        if User.objects.filter(username__iexact=val).exists():
            raise serializers.ValidationError("اسم المستخدم هذا مسجل مسبقاً، يرجى اختيار اسم آخر")
        return val

    def validate_phone_number(self, value):
        if value:
            clean = str(value).strip()
            import phonenumbers
            from django.db.models import Q
            try:
                parsed = phonenumbers.parse(clean, "EG")
                if phonenumbers.is_valid_number(parsed):
                    clean = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
            except Exception:
                pass
            digits = clean.lstrip('+0')
            if User.objects.filter(Q(phone_number=clean) | Q(phone_number__endswith=digits)).exists():
                raise serializers.ValidationError("رقم الهاتف هذا مسجل مسبقاً بحساب آخر")
            return clean
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.pop('role', None)
        try:
            user = User.objects.create_user(password=password, role=User.Roles.CUSTOMER, **validated_data)
            return user
        except Exception as e:
            from django.db import IntegrityError
            if isinstance(e, IntegrityError):
                err_str = str(e).lower()
                if 'phone_number' in err_str:
                    raise serializers.ValidationError({"phone_number": ["رقم الهاتف هذا مسجل مسبقاً بحساب آخر"]})
                if 'username' in err_str:
                    raise serializers.ValidationError({"username": ["اسم المستخدم هذا مسجل مسبقاً"]})
            raise serializers.ValidationError({"detail": "فشل إنشاء الحساب، يرجى التحقق من صحة البيانات"})


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
        # Normalize Arabic-indic numerals to ASCII digits
        arabic_digits = '٠١٢٣٤٥٦٧٨٩'
        english_digits = '0123456789'
        trans = str.maketrans(arabic_digits, english_digits)
        
        login_input = str(data.get('username', '')).strip().translate(trans)
        password = str(data.get('password', ''))
        
        # 1. Try standard Django username authentication
        user = authenticate(username=login_input, password=password)
        if not user and password.strip() != password:
            user = authenticate(username=login_input, password=password.strip())

        # 2. If not authenticated, check case-insensitive username, email, or phone
        if not user:
            from django.db.models import Q
            passwords_to_try = [password]
            if password.strip() != password:
                passwords_to_try.append(password.strip())

            # A. Username case-insensitive
            user_obj = User.objects.filter(username__iexact=login_input).first()
            
            # B. Email case-insensitive
            if not user_obj:
                user_obj = User.objects.filter(email__iexact=login_input).first()

            # C. Phone number matching (exact or cleaned digits)
            if not user_obj:
                digits = re.sub(r'\D', '', login_input)
                query = Q(phone_number=login_input)
                if len(digits) >= 7:
                    # Match by last 9 digits (standard Saudi/Egypt local number without country code or 0)
                    query |= Q(phone_number__endswith=digits[-9:])
                    query |= Q(phone_number__endswith=digits)
                user_obj = User.objects.filter(query).first()

            if user_obj:
                for p in passwords_to_try:
                    if user_obj.check_password(p):
                        user = user_obj
                        break

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
