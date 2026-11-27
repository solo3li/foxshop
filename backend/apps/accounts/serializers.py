import re
from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from core.image_utils import build_imgproxy_url
from .models import User, Address, PlatformSetting

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'phone_number', 'role', 'avatar']
        read_only_fields = ['id', 'role']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['avatar'] = build_imgproxy_url(ret.get('avatar'), request=self.context.get('request'), width=300, height=300, quality=75)
        return ret


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

    def validate(self, attrs):
        lat = attrs.get('latitude')
        lng = attrs.get('longitude')
        if lat is not None and lng is not None:
            from apps.restaurants.models import DeliveryZone
            all_active_zones = list(DeliveryZone.objects.filter(is_active=True))
            if all_active_zones:
                polygon_zones = [z for z in all_active_zones if len(z.coordinates_list) >= 3]
                if not any(z.contains_point(float(lat), float(lng)) for z in polygon_zones):
                    raise serializers.ValidationError({
                        'non_field_errors': ['التوصيل غير متوفر في هذه المنطقة في الوقت الحالي.']
                    })
        return attrs


class PlatformSettingPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSetting
        fields = ['google_maps_client_key', 'default_search_radius_km', 'platform_commission_percent']


class PartnerRegisterSerializer(serializers.Serializer):
    """Creates a pending Merchant user + Restaurant linked to detected/selected DeliveryZone & StoreSector."""
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    phone_number = serializers.CharField(max_length=25)
    email = serializers.EmailField(required=False, allow_blank=True, default='')
    store_name = serializers.CharField(max_length=255)
    store_type = serializers.CharField(max_length=50, required=False, default='RESTAURANT')
    sector_id = serializers.UUIDField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    address_text = serializers.CharField(max_length=255)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    delivery_zone_id = serializers.UUIDField(required=False, allow_null=True)
    delivery_mode = serializers.ChoiceField(
        choices=['PLATFORM_MANAGED', 'STORE_OWN_FLEET'],
        default='PLATFORM_MANAGED'
    )

    def validate_username(self, value):
        clean = value.strip()
        if User.objects.filter(username__iexact=clean).exists():
            raise serializers.ValidationError("اسم المستخدم هذا مسجل مسبقاً")
        return clean

    def validate_phone_number(self, value):
        import phonenumbers
        from django.db.models import Q
        clean = value.strip()
        try:
            parsed = phonenumbers.parse(clean, "EG")
            if phonenumbers.is_valid_number(parsed):
                clean = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except Exception:
            pass
        digits = clean.lstrip('+0')
        if digits and User.objects.filter(Q(phone_number=clean) | Q(phone_number__endswith=digits)).exists():
            raise serializers.ValidationError("رقم الهاتف هذا مسجل مسبقاً بحساب آخر")
        return clean

    def create(self, validated_data):
        from django.db import transaction
        from apps.restaurants.models import Restaurant, DeliveryZone, StoreSector

        with transaction.atomic():
            user = User.objects.create_user(
                username=validated_data['username'],
                password=validated_data['password'],
                first_name=validated_data['first_name'],
                last_name=validated_data.get('last_name', ''),
                phone_number=validated_data['phone_number'],
                email=validated_data.get('email', ''),
                role=User.Roles.MERCHANT,
                is_active=False,  # Pending admin approval
            )

            sector_obj = None
            sector_id = validated_data.get('sector_id')
            store_type_code = (validated_data.get('store_type') or 'RESTAURANT').strip().upper()
            if sector_id:
                sector_obj = StoreSector.objects.filter(id=sector_id).first()
            if not sector_obj:
                sector_obj = StoreSector.objects.filter(code__iexact=store_type_code).first()
            if sector_obj:
                store_type_code = sector_obj.code

            lat = validated_data['latitude']
            lng = validated_data['longitude']

            restaurant = Restaurant.objects.create(
                owner=user,
                name=validated_data['store_name'].strip(),
                sector=sector_obj,
                store_type=store_type_code,
                delivery_mode=validated_data.get('delivery_mode', 'PLATFORM_MANAGED'),
                description=validated_data.get('description', ''),
                address_text=validated_data['address_text'].strip(),
                latitude=lat,
                longitude=lng,
                is_active=False,  # Pending admin approval
            )

            matched_zone = None
            all_active_zones = list(DeliveryZone.objects.filter(is_active=True))
            active_polygon_zones = [
                z for z in all_active_zones
                if len(z.coordinates_list) >= 3
            ]
            for z in active_polygon_zones:
                if z.contains_point(float(lat), float(lng)):
                    matched_zone = z
                    break

            if all_active_zones and not matched_zone:
                raise serializers.ValidationError({
                    'non_field_errors': ['التوصيل غير متوفر في هذه المنطقة في الوقت الحالي، يرجى تحديد موقع المتجر داخل حدود المناطق المرسومة على الخريطة.']
                })

            if not matched_zone:
                zone_id = validated_data.get('delivery_zone_id')
                if zone_id:
                    matched_zone = DeliveryZone.objects.filter(id=zone_id, is_active=True).first()
            if matched_zone:
                restaurant.delivery_zones.add(matched_zone)

            return {
                'user': user,
                'restaurant': restaurant,
                'zone': matched_zone,
            }
