import pytest
from rest_framework import status
from apps.accounts.models import PlatformSetting

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
