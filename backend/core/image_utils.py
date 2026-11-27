import base64
import logging
import os
import urllib.parse
from io import BytesIO

from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'}


def compress_uploaded_image(
    instance,
    field_name: str,
    max_size: tuple[int, int] = (1200, 1200),
    quality: int = 78,
    image_only: bool = False,
) -> bool:
    """
    Compress and resize a newly uploaded image field to WebP before saving to storage.
    Skips already-committed files so subsequent model saves do not re-process stored images.
    """
    if not getattr(settings, 'IMAGE_COMPRESSION_ENABLED', True):
        return False

    field_file = getattr(instance, field_name, None)
    if not field_file or getattr(field_file, '_committed', True):
        return False

    orig_name = getattr(field_file, 'name', '') or 'image.webp'
    ext = os.path.splitext(orig_name)[1].lower()
    if image_only and ext not in IMAGE_EXTENSIONS:
        return False

    try:
        if hasattr(field_file, 'seek'):
            field_file.seek(0)
        with Image.open(field_file) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGBA')
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            img.thumbnail(max_size, Image.Resampling.LANCZOS)

            output = BytesIO()
            img.save(output, format='WEBP', quality=quality, method=4)
            size = output.tell()
            output.seek(0)

        base_name = os.path.splitext(os.path.basename(orig_name))[0] or 'image'
        new_name = f'{base_name}.webp'
        compressed_file = InMemoryUploadedFile(
            file=output,
            field_name=field_name,
            name=new_name,
            content_type='image/webp',
            size=size,
            charset=None,
        )
        setattr(instance, field_name, compressed_file)
        return True
    except Exception as exc:
        logger.warning('Image compression skipped for %s.%s: %s', type(instance).__name__, field_name, exc)
        if hasattr(field_file, 'seek'):
            try:
                field_file.seek(0)
            except Exception:
                pass
        return False


def compress_model_images(instance, specs: list[tuple]) -> None:
    """Apply compress_uploaded_image across a list of (field_name, max_size, quality[, image_only]) specs."""
    for spec in specs:
        field_name, max_size, quality = spec[0], spec[1], spec[2]
        image_only = spec[3] if len(spec) > 3 else False
        compress_uploaded_image(instance, field_name, max_size=max_size, quality=quality, image_only=image_only)


def clean_image_url(val: str | None) -> str | None:
    """Fix external URLs that were previously double-prefixed with /media/ or /<bucket>/."""
    if not val:
        return val
    bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'foxshop-media')
    for marker in ('/media/http', f'/{bucket}/http'):
        if marker in val:
            idx = val.find(marker)
            prefix_len = len('/media/') if marker == '/media/http' else len(f'/{bucket}/')
            unquoted = urllib.parse.unquote(val[idx + prefix_len:])
            if unquoted.startswith('https:/') and not unquoted.startswith('https://'):
                return unquoted.replace('https:/', 'https://', 1)
            if unquoted.startswith('http:/') and not unquoted.startswith('http://'):
                return unquoted.replace('http:/', 'http://', 1)
            return unquoted
    return val


def _is_https_request(request) -> bool:
    if request is None:
        return False
    try:
        if request.is_secure() or getattr(request, 'scheme', '') == 'https':
            return True
    except Exception:
        pass

    meta = getattr(request, 'META', {}) or {}
    x_proto = str(meta.get('HTTP_X_FORWARDED_PROTO', '')).lower()
    if 'https' in x_proto:
        return True
    if str(meta.get('HTTP_X_FORWARDED_SSL', '')).lower() == 'on':
        return True
    if str(meta.get('HTTP_X_URL_SCHEME', '')).lower() == 'https':
        return True
    if 'proto=https' in str(meta.get('HTTP_FORWARDED', '')).lower():
        return True

    for header in ('HTTP_ORIGIN', 'HTTP_REFERER'):
        val = str(meta.get(header, '')).strip().lower()
        if val.startswith('https://'):
            return True

    try:
        host = request.get_host()
        if host.endswith('.nip.io') and ':' not in host:
            return True
    except Exception:
        pass

    return False


def _resolve_imgproxy_base(request) -> str:
    configured = getattr(settings, 'IMGPROXY_PUBLIC_URL', '').strip().rstrip('/')
    if configured:
        return configured

    host = request.get_host()
    if host.endswith(':8100'):
        host = host[:-5] + ':8180'
    scheme = 'https' if _is_https_request(request) else 'http'
    return f'{scheme}://{host}/imgproxy'


def _resolve_imgproxy_source(url: str) -> str | None:
    bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'foxshop-media')
    custom_domain = (getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', '') or '').strip('/')
    use_s3 = bool(getattr(settings, 'AWS_ACCESS_KEY_ID', None))

    if use_s3:
        key = None
        if custom_domain and custom_domain in url:
            key = url.split(custom_domain + '/', 1)[-1].lstrip('/')
        elif '/media/' in url and not url.startswith(('http://', 'https://')):
            key = url.split('/media/', 1)[-1].lstrip('/')
        elif f'/{bucket}/' in url:
            key = url.split(f'/{bucket}/', 1)[-1].lstrip('/')
        if key:
            key = urllib.parse.unquote(key.split('?', 1)[0])
            return f's3://{bucket}/{key}'

    if url.startswith(('http://', 'https://', 's3://')):
        return url
    return None


def build_imgproxy_url(
    url: str | None,
    request=None,
    width: int = 600,
    height: int = 600,
    quality: int = 75,
) -> str | None:
    """
    Wrap an image URL with imgproxy resizing & WebP compression when serving HTTP requests.
    """
    cleaned = clean_image_url(url)
    if not cleaned:
        return cleaned

    if not getattr(settings, 'IMGPROXY_ENABLED', True) or request is None:
        return cleaned

    try:
        host = request.get_host()
    except Exception:
        return cleaned

    if host.startswith('testserver'):
        return cleaned

    # Avoid double-wrapping an already proxied URL
    if '/imgproxy/' in cleaned:
        return cleaned

    source = _resolve_imgproxy_source(cleaned)
    if not source:
        return cleaned

    b64_source = base64.urlsafe_b64encode(source.encode('utf-8')).decode('ascii').rstrip('=')
    base = _resolve_imgproxy_base(request)
    return f'{base}/insecure/rs:fit:{width}:{height}/q:{quality}/format:webp/{b64_source}'
