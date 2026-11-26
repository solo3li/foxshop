import pytest
import datetime
from decimal import Decimal
from django.utils import timezone
from django.db import IntegrityError, transaction
from apps.accounts.models import User
from apps.deliveries.models import (
    DeliveryZone,
    ShiftSlot,
    DriverShiftBooking,
    DriverProfile,
    haversine_distance_km
)


@pytest.fixture
def driver_user(db):
    user = User.objects.create_user(
        username='shift_driver_test',
        password='testpassword123',
        phone_number='+201000000001',
        role=User.Roles.DRIVER,
        is_active=True
    )
    # DriverProfile may be auto-created by signal or manual
    profile, _ = DriverProfile.objects.get_or_create(
        user=user,
        defaults={
            'vehicle_type': DriverProfile.VehicleTypes.MOTORCYCLE,
            'license_plate': 'SHF-101',
            'is_online': True,
        }
    )
    return user


@pytest.fixture
def delivery_zone(db):
    return DeliveryZone.objects.create(
        name="منطقة المعادي",
        code="MAADI_01",
        city="القاهرة",
        description="منطقة المعادي ودجلة",
        center_latitude=Decimal("29.960200"),
        center_longitude=Decimal("31.256900"),
        radius_km=5.0,
        polygon_coordinates=[
            {"lat": 29.97, "lng": 31.25},
            {"lat": 29.95, "lng": 31.26}
        ],
        is_active=True
    )


@pytest.mark.django_db
class TestDeliveryZoneGeofencing:
    def test_zone_creation_and_attributes(self, delivery_zone):
        assert delivery_zone.name == "منطقة المعادي"
        assert delivery_zone.code == "MAADI_01"
        assert delivery_zone.radius_km == 5.0
        assert delivery_zone.description == "منطقة المعادي ودجلة"
        assert len(delivery_zone.polygon_coordinates) == 2
        assert "MAADI_01" in str(delivery_zone)

    def test_contains_point_inside(self, delivery_zone):
        # Point 100 meters away from center
        inside_lat = 29.9610
        inside_lng = 31.2570
        assert delivery_zone.contains_point(inside_lat, inside_lng) is True

    def test_contains_point_outside(self, delivery_zone):
        # Point 20km away in Heliopolis
        outside_lat = 30.0870
        outside_lng = 31.3200
        assert delivery_zone.contains_point(outside_lat, outside_lng) is False

    def test_contains_point_boundary(self, delivery_zone):
        # 1 degree latitude is approx 111.19 km
        # 4.5 km north: 4.5 / 111.19 ≈ 0.04047 deg
        lat_just_inside = float(delivery_zone.center_latitude) + (4.8 / 111.19)
        lng_center = float(delivery_zone.center_longitude)
        dist_inside = delivery_zone.distance_to_center(lat_just_inside, lng_center)
        assert dist_inside <= 5.0
        assert delivery_zone.contains_point(lat_just_inside, lng_center) is True

        # 5.3 km north: 5.3 / 111.19 ≈ 0.04766 deg
        lat_just_outside = float(delivery_zone.center_latitude) + (5.3 / 111.19)
        dist_outside = delivery_zone.distance_to_center(lat_just_outside, lng_center)
        assert dist_outside > 5.0
        assert delivery_zone.contains_point(lat_just_outside, lng_center) is False

    def test_contains_point_edge_cases(self, delivery_zone):
        assert delivery_zone.contains_point(None, None) is False
        assert delivery_zone.contains_point(29.96, None) is False
        assert delivery_zone.contains_point("invalid", "coords") is False


@pytest.mark.django_db
class TestShiftSlotModel:
    def test_shift_slot_creation_and_properties(self, delivery_zone):
        shift_date = datetime.date(2026, 11, 20)
        start = datetime.time(9, 0)
        end = datetime.time(17, 0)

        slot = ShiftSlot.objects.create(
            zone=delivery_zone,
            name="شفت الصباح",
            date=shift_date,
            start_time=start,
            end_time=end,
            capacity=10,
            booked_count=3,
            status=ShiftSlot.Status.PUBLISHED,
            is_active=True
        )

        assert slot.remaining_capacity == 7
        assert slot.is_full is False
        assert "شفت الصباح" in str(slot)

        # Slot filled to capacity
        slot.booked_count = 10
        assert slot.remaining_capacity == 0
        assert slot.is_full is True

        # Over-capacity edge case safety
        slot.booked_count = 12
        assert slot.remaining_capacity == 0
        assert slot.is_full is True

    def test_shift_slot_datetimes_standard_and_overnight(self, delivery_zone):
        today = timezone.localdate()

        # Regular daytime shift
        day_slot = ShiftSlot.objects.create(
            zone=delivery_zone,
            name="شفت نهاري",
            date=today,
            start_time=datetime.time(10, 0),
            end_time=datetime.time(18, 0),
            capacity=5
        )
        assert day_slot.start_datetime.date() == today
        assert day_slot.start_datetime.hour == 10
        assert day_slot.end_datetime.date() == today
        assert day_slot.end_datetime.hour == 18
        assert day_slot.start_datetime < day_slot.end_datetime

        # Overnight shift (22:00 -> 04:00 next day)
        night_slot = ShiftSlot.objects.create(
            zone=delivery_zone,
            name="شفت مسائي ممتد",
            date=today,
            start_time=datetime.time(22, 0),
            end_time=datetime.time(4, 0),
            capacity=5
        )
        assert night_slot.start_datetime.date() == today
        assert night_slot.end_datetime.date() == today + datetime.timedelta(days=1)
        assert night_slot.start_datetime < night_slot.end_datetime


@pytest.mark.django_db
class TestDriverShiftBookingModel:
    def test_booking_lifecycle_and_check_in(self, driver_user, delivery_zone):
        shift = ShiftSlot.objects.create(
            zone=delivery_zone,
            name="شفت الظهيرة",
            date=datetime.date(2026, 11, 20),
            start_time=datetime.time(12, 0),
            end_time=datetime.time(16, 0),
            capacity=5
        )

        booking = DriverShiftBooking.objects.create(
            driver=driver_user,
            shift=shift,
            status=DriverShiftBooking.Status.BOOKED
        )

        assert booking.status == DriverShiftBooking.Status.BOOKED
        assert booking.booking_status == 'BOOKED'
        assert booking.attendance_status == 'BOOKED'
        assert booking.is_geofence_verified is False
        assert booking.check_in_time is None
        assert "شفت الظهيرة" in str(booking)

        # Check-in update
        now = timezone.now()
        booking.check_in_time = now
        booking.check_in_latitude = Decimal("29.960500")
        booking.check_in_longitude = Decimal("29.257000")
        booking.check_in_distance_km = 0.15
        booking.is_geofence_verified = True
        booking.status = DriverShiftBooking.Status.CHECKED_IN
        booking.save()

        booking.refresh_from_db()
        assert booking.status == DriverShiftBooking.Status.CHECKED_IN
        assert booking.is_geofence_verified is True
        assert booking.check_in_distance_km == 0.15
        assert booking.check_in_time is not None

    def test_unique_active_booking_constraint(self, driver_user, delivery_zone):
        shift = ShiftSlot.objects.create(
            zone=delivery_zone,
            name="شفت المساء",
            date=datetime.date(2026, 11, 21),
            start_time=datetime.time(17, 0),
            end_time=datetime.time(21, 0),
            capacity=5
        )

        # First booking succeeds
        booking1 = DriverShiftBooking.objects.create(
            driver=driver_user,
            shift=shift,
            status=DriverShiftBooking.Status.BOOKED
        )

        # Duplicate active booking fails due to UniqueConstraint
        with transaction.atomic():
            with pytest.raises(IntegrityError):
                DriverShiftBooking.objects.create(
                    driver=driver_user,
                    shift=shift,
                    status=DriverShiftBooking.Status.BOOKED
                )

        # If first booking is CANCELLED, new booking can be made
        booking1.status = DriverShiftBooking.Status.CANCELLED
        booking1.save()

        booking2 = DriverShiftBooking.objects.create(
            driver=driver_user,
            shift=shift,
            status=DriverShiftBooking.Status.BOOKED
        )
        assert booking2.id != booking1.id
        assert booking2.status == DriverShiftBooking.Status.BOOKED


@pytest.mark.django_db
class TestDriverProfileAdherenceAndPriority:
    def test_driver_profile_defaults(self, driver_user):
        profile = driver_user.driver_profile
        assert profile.adherence_rate == Decimal("100.00")
        assert profile.priority_tier == DriverProfile.PriorityTier.STANDARD
        assert profile.total_booked_shifts == 0
        assert profile.attended_shifts == 0
        assert profile.late_shifts == 0
        assert profile.absent_shifts == 0

    def test_driver_profile_updates_and_aliases(self, driver_user):
        profile = driver_user.driver_profile
        profile.priority_tier = DriverProfile.PriorityTier.GOLD
        profile.adherence_rate = Decimal("97.50")
        profile.total_booked_shifts = 20
        profile.attended_shifts = 18
        profile.late_shifts = 1
        profile.absent_shifts = 1
        profile.save()

        profile.refresh_from_db()
        assert profile.priority_tier == 'GOLD'
        assert profile.adherence_rate == Decimal("97.50")
        assert profile.completed_shifts == 18
        assert profile.missed_shifts == 1

        # Test property setter aliases
        profile.completed_shifts = 19
        profile.missed_shifts = 2
        assert profile.attended_shifts == 19
        assert profile.absent_shifts == 2
