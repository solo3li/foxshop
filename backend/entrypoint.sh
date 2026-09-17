#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
if [ -n "$DATABASE_HOST" ]; then
  while ! nc -z "$DATABASE_HOST" "${DATABASE_PORT:-5432}"; do
    sleep 0.5
  done
  echo "PostgreSQL is up and running!"
fi

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Ensuring Superuser exists..."
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from apps.accounts.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@foxshop.com', 'admin123', role='ADMIN')
    print('Superuser admin created successfully!')
else:
    print('Superuser admin already exists.')
"

echo "Collecting static files..."
python manage.py collectstatic --noinput --clear || true

exec "$@"
