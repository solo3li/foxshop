from rest_framework import generics, viewsets, status, permissions, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Address, PlatformSetting
from .serializers import (
    UserSerializer, RegisterSerializer, DriverRegisterSerializer, LoginSerializer,
    AddressSerializer, PlatformSettingPublicSerializer, PartnerRegisterSerializer
)

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        return Response({
            'user': UserSerializer(user).data,
            'access': access_token,
            'refresh': refresh_token,
            'tokens': {
                'access': access_token,
                'refresh': refresh_token,
            },
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


class PartnerRegisterView(generics.CreateAPIView):
    serializer_class = PartnerRegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        zone = result.get('zone')
        restaurant = result['restaurant']
        return Response({
            'message': 'تم استلام طلب انضمام المتجر بنجاح! سيقوم فريق الإدارة بمراجعة الطلب وتفعيله قريباً.',
            'user': UserSerializer(result['user']).data,
            'restaurant_id': str(restaurant.id),
            'store_name': restaurant.name,
            'detected_zone': {
                'id': str(zone.id),
                'name': zone.name,
                'city': zone.city,
            } if zone else None,
            'is_pending_approval': True,
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
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_object(self):
        return self.request.user


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='set_default')
    def set_default(self, request, pk=None):
        address = self.get_object()
        Address.objects.filter(user=request.user, is_default=True).exclude(pk=address.pk).update(is_default=False)
        address.is_default = True
        address.save(update_fields=['is_default'])
        return Response(self.get_serializer(address).data)


class PublicPlatformConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        setting = PlatformSetting.get_settings()
        serializer = PlatformSettingPublicSerializer(setting)
        return Response(serializer.data)


class GeocodeSearchView(APIView):
    """
    Hybrid Address Search:
    - Uses Google Geocoding API (when server key is configured) for superior Arabic POI/place matching
    - Caches results in Redis for 24h to minimize API cost
    - Falls back to OpenStreetMap Nominatim automatically
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        import hashlib
        import requests
        from django.core.cache import cache

        q = (request.query_params.get('q') or '').strip()
        if len(q) < 2:
            return Response({'results': []})

        lat_param = request.query_params.get('lat')
        lng_param = request.query_params.get('lng')
        customer_coords = None
        if lat_param is not None and lng_param is not None:
            try:
                customer_coords = (float(lat_param), float(lng_param))
            except (ValueError, TypeError):
                customer_coords = None

        cache_key = f"geocode_search:{hashlib.md5(q.lower().encode('utf-8')).hexdigest()}"
        raw_results = cache.get(cache_key)
        is_cached = raw_results is not None

        if raw_results is None:
            raw_results = []
            setting = PlatformSetting.get_settings()
            api_key = getattr(setting, 'google_maps_server_key', '') or ''

            if api_key:
                try:
                    resp = requests.get(
                        'https://maps.googleapis.com/maps/api/geocode/json',
                        params={'address': q, 'key': api_key, 'language': 'ar'},
                        timeout=5,
                    )
                    g_data = resp.json()
                    if g_data.get('status') == 'OK':
                        for item in g_data.get('results', [])[:8]:
                            loc = item.get('geometry', {}).get('location', {})
                            if loc.get('lat') is not None and loc.get('lng') is not None:
                                raw_results.append({
                                    'display_name': item.get('formatted_address', q),
                                    'lat': float(loc['lat']),
                                    'lng': float(loc['lng']),
                                    'source': 'google',
                                })
                except Exception:
                    pass

            if not raw_results:
                try:
                    resp = requests.get(
                        'https://nominatim.openstreetmap.org/search',
                        params={'format': 'json', 'q': q, 'accept-language': 'ar', 'limit': 8},
                        headers={'User-Agent': 'FoxShopApp/1.0'},
                        timeout=5,
                    )
                    for item in resp.json()[:8]:
                        raw_results.append({
                            'display_name': item.get('display_name', q),
                            'lat': float(item['lat']),
                            'lng': float(item['lon']),
                            'source': 'osm',
                        })
                except Exception:
                    pass

            if raw_results:
                cache.set(cache_key, raw_results, timeout=86400)

        # Evaluate against active DeliveryZone polygons and prioritize customer's current polygon
        from apps.restaurants.models import DeliveryZone
        all_active_zones = list(DeliveryZone.objects.filter(is_active=True))
        active_zones = [
            z for z in all_active_zones
            if len(z.coordinates_list) >= 3
        ]

        customer_zone_id = None
        if customer_coords and active_zones:
            for z in active_zones:
                if z.contains_point(customer_coords[0], customer_coords[1]):
                    customer_zone_id = str(z.id)
                    break

        enriched = []
        for item in raw_results:
            matched_z = None
            if all_active_zones:
                for z in active_zones:
                    if z.contains_point(item['lat'], item['lng']):
                        matched_z = z
                        break
                is_in_zone = matched_z is not None
            else:
                is_in_zone = True

            is_current_zone = bool(
                customer_zone_id and matched_z and str(matched_z.id) == customer_zone_id
            )
            enriched.append({
                **item,
                'is_in_zone': is_in_zone,
                'is_current_zone': is_current_zone,
                'zone_id': str(matched_z.id) if matched_z else None,
                'zone_name': matched_z.name if matched_z else None,
            })

        # Priority: 1. Customer's current polygon, 2. Other active polygons, 3. Out-of-zone
        enriched.sort(key=lambda x: (not x['is_current_zone'], not x['is_in_zone']))

        return Response({'results': enriched, 'cached': is_cached})


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
