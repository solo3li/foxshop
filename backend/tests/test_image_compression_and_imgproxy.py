import os
from io import BytesIO
import pytest
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory

from apps.accounts.models import User
from apps.menus.models import MenuCategory, MenuItem
from apps.payments.models import Currency
from apps.restaurants.models import Restaurant
from apps.support.models import SupportTicket, TicketMessage
from core.image_utils import build_imgproxy_url, clean_image_url


def _make_large_png(width=2000, height=1500, mode='RGB', name='photo.png'):
    """Create a large uncompressed PNG with varied pixel data to test real compression."""
    channels = 4 if mode == 'RGBA' else 3
    # Repeating pseudo-random block keeps generation instant (<10ms) while still yielding >1MB PNG
    block = os.urandom(256 * 256 * channels)
    needed = width * height * channels
    raw_pixels = (block * ((needed // len(block)) + 1))[:needed]
    img = Image.frombytes(mode, (width, height), raw_pixels)
    buf = BytesIO()
    img.save(buf, format='PNG')
    raw = buf.getvalue()
    return SimpleUploadedFile(name, raw, content_type='image/png'), len(raw)


@pytest.mark.django_db
def test_menu_item_image_is_compressed_to_webp_and_resized():
    Currency.objects.get_or_create(code='EGP', defaults={'name': 'جنيه مصري', 'symbol': 'ج.م'})
    owner = User.objects.create_user(username='img_merchant', password='pw', role=User.Roles.MERCHANT)
    rest = Restaurant.objects.create(
        owner=owner,
        name='Img Rest',
        address_text='Cairo',
        latitude=30.0444,
        longitude=31.2357,
    )
    cat = MenuCategory.objects.create(restaurant=rest, name='Burgers')
    uploaded, orig_size = _make_large_png(2000, 1500, mode='RGBA', name='burger.png')

    item = MenuItem.objects.create(category=cat, name='Big Burger', base_price='99.00', image=uploaded)

    assert item.image.name.endswith('.webp')
    item.image.open('rb')
    data = item.image.read()
    item.image.close()

    assert len(data) < orig_size * 0.5
    with Image.open(BytesIO(data)) as saved_img:
        assert saved_img.format == 'WEBP'
        assert saved_img.width <= 800
        assert saved_img.height <= 800
        assert saved_img.mode == 'RGBA'

    # Re-saving without changing image must not re-compress or alter name
    prev_name = item.image.name
    item.name = 'Big Burger Updated'
    item.save()
    assert item.image.name == prev_name


@pytest.mark.django_db
def test_user_avatar_and_restaurant_images_are_compressed():
    Currency.objects.get_or_create(code='EGP', defaults={'name': 'جنيه مصري', 'symbol': 'ج.م'})
    avatar_file, avatar_orig = _make_large_png(1200, 1200, name='me.png')
    user = User.objects.create_user(
        username='img_user',
        password='pw',
        role=User.Roles.MERCHANT,
        avatar=avatar_file,
    )
    assert user.avatar.name.endswith('.webp')
    user.avatar.open('rb')
    with Image.open(user.avatar) as av_img:
        assert av_img.format == 'WEBP'
        assert av_img.width <= 400
        assert av_img.height <= 400
    assert user.avatar.size < avatar_orig

    logo_file, _ = _make_large_png(1000, 1000, name='logo.png')
    cover_file, _ = _make_large_png(2400, 1200, name='cover.png')
    rest = Restaurant.objects.create(
        owner=user,
        name='Logo Cover Rest',
        address_text='Giza',
        latitude=30.0131,
        longitude=31.2089,
        logo=logo_file,
        cover_image=cover_file,
    )
    assert rest.logo.name.endswith('.webp')
    assert rest.cover_image.name.endswith('.webp')
    rest.cover_image.open('rb')
    with Image.open(rest.cover_image) as cov_img:
        assert cov_img.format == 'WEBP'
        assert cov_img.width <= 1200
        assert cov_img.height <= 600


@pytest.mark.django_db
def test_support_ticket_non_image_attachment_is_untouched():
    user = User.objects.create_user(username='sup_user', password='pw', role=User.Roles.CUSTOMER)
    ticket = SupportTicket.objects.create(user=user, subject='Audio Note')
    audio = SimpleUploadedFile('voice_note.mp3', b'ID3-fake-mp3-bytes', content_type='audio/mpeg')
    msg = TicketMessage.objects.create(ticket=ticket, sender=user, message_text='hi', attachment=audio)
    assert msg.attachment.name.endswith('.mp3')


def test_build_imgproxy_url_formats_minio_and_external_urls(settings):
    settings.IMGPROXY_ENABLED = True
    settings.IMGPROXY_PUBLIC_URL = ''
    settings.AWS_ACCESS_KEY_ID = 'minio_admin'
    settings.AWS_STORAGE_BUCKET_NAME = 'foxshop-media'
    settings.AWS_S3_CUSTOM_DOMAIN = '169.58.32.179:9120/foxshop-media'

    rf = RequestFactory()
    req = rf.get('/api/v1/customer/restaurants/', HTTP_HOST='169.58.32.179:8100')

    proxied_s3 = build_imgproxy_url(
        'http://169.58.32.179:9120/foxshop-media/menu_items/burger.webp',
        request=req,
        width=500,
        height=500,
        quality=75,
    )
    assert proxied_s3.startswith('http://169.58.32.179:8180/imgproxy/insecure/rs:fit:500:500/q:75/format:webp/')

    # External URL with query string
    proxied_ext = build_imgproxy_url(
        clean_image_url('/media/https%3A//images.unsplash.com/photo-123%3Fw%3D800'),
        request=req,
        width=400,
        height=400,
    )
    assert proxied_ext.startswith('http://169.58.32.179:8180/imgproxy/insecure/rs:fit:400:400/q:75/format:webp/')

    # testserver request keeps raw URL untouched for unit tests
    test_req = rf.get('/api/v1/customer/restaurants/', HTTP_HOST='testserver')
    raw = build_imgproxy_url('http://testserver/media/menu_items/burger.webp', request=test_req)
    assert raw == 'http://testserver/media/menu_items/burger.webp'

    # HTTPS via X-Forwarded-Proto or HTTPS Origin or .nip.io reverse proxy
    https_proto_req = rf.get(
        '/api/v1/customer/restaurants/',
        HTTP_HOST='api.example.com',
        HTTP_X_FORWARDED_PROTO='https',
    )
    proxied_https = build_imgproxy_url(
        'https://images.unsplash.com/photo-123?w=800',
        request=https_proto_req,
        width=400,
        height=400,
    )
    assert proxied_https.startswith('https://api.example.com/imgproxy/')

    https_origin_req = rf.get(
        '/api/v1/customer/restaurants/',
        HTTP_HOST='api-foxshop.169.58.32.179.nip.io',
        HTTP_ORIGIN='https://app-foxshop.169.58.32.179.nip.io',
    )
    proxied_nip = build_imgproxy_url(
        'https://images.unsplash.com/photo-123?w=800',
        request=https_origin_req,
        width=400,
        height=400,
    )
    assert proxied_nip.startswith('https://api-foxshop.169.58.32.179.nip.io/imgproxy/')
