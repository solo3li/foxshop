import pytest
from rest_framework import status
from apps.accounts.models import PlatformSetting

@pytest.fixture(autouse=True)
def preserve_platform_settings():
    original = PlatformSetting.objects.filter(pk=1).first()
    orig_server = original.google_maps_server_key if original else ""
    orig_client = original.google_maps_client_key if original else ""
    orig_radius = original.default_search_radius_km if original else 10.0
    orig_commission = original.platform_commission_percent if original else 15.0
    yield
    if original:
        original.google_maps_server_key = orig_server
        original.google_maps_client_key = orig_client
        original.default_search_radius_km = orig_radius
        original.platform_commission_percent = orig_commission
        original.save()

@pytest.mark.django_db
def test_google_maps_setting_singleton_and_caching():
    setting = PlatformSetting.get_settings()
    setting.google_maps_server_key = "AIzaSyServerKeySecret123"
    setting.google_maps_client_key = "AIzaSyClientKeyPublic456"
    setting.default_search_radius_km = 12.5
    setting.save()

    # Re-fetch via singleton getter
    loaded = PlatformSetting.get_settings()
    assert loaded.google_maps_server_key == "AIzaSyServerKeySecret123"
    assert loaded.google_maps_client_key == "AIzaSyClientKeyPublic456"
    assert loaded.default_search_radius_km == 12.5

@pytest.mark.django_db
def test_public_platform_config_endpoint(api_client):
    setting = PlatformSetting.get_settings()
    setting.google_maps_server_key = "AIzaSyServerKeySecret123"
    setting.google_maps_client_key = "AIzaSyClientKeyPublic456"
    setting.save()

    response = api_client.get('/api/v1/auth/config/')
    assert response.status_code == status.HTTP_200_OK
    assert response.data['google_maps_client_key'] == "AIzaSyClientKeyPublic456"
    # Ensure server key is NEVER leaked in public API
    assert 'google_maps_server_key' not in response.data
