import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bike,
  Car,
  Phone,
  Navigation,
  AlertTriangle,
  CheckCircle,
  Search,
  Layers,
  MapPin,
  Store,
  User as UserIcon,
  X,
  Compass,
  Route,
  Maximize2,
  Send,
  Zap,
  Info
} from 'lucide-react';
import type { DriverRadarItem } from '../types';
import { api } from '../api/client';
import L from 'leaflet';

interface RadarMapProps {
  drivers: DriverRadarItem[];
  codCeiling: number;
  onSelectDriverForDispatch?: (driver: DriverRadarItem) => void;
}

export const RadarMap: React.FC<RadarMapProps> = ({
  drivers,
  codCeiling,
  onSelectDriverForDispatch,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Map engine state: pure OpenStreetMap Leaflet (no Google Maps dependency)
  const [mapEngine, setMapEngine] = useState<'google' | 'leaflet'>('leaflet');
  const [googleMapsReady, setGoogleMapsReady] = useState<boolean>(false);
  const [googleApiKey, setGoogleApiKey] = useState<string>('');
  const [trafficEnabled, setTrafficEnabled] = useState<boolean>(false);

  // Leaflet refs
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.LayerGroup | null>(null);
  const leafletRouteRef = useRef<L.Polyline | null>(null);
  const leafletTripMarkersRef = useRef<L.LayerGroup | null>(null);

  // Google Maps refs
  const googleMapRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const googleTripMarkersRef = useRef<any[]>([]);
  const googleDirectionsRendererRef = useRef<any>(null);
  const googlePolylineRef = useRef<any>(null);
  const googleTrafficLayerRef = useRef<any>(null);

  const [selectedDriver, setSelectedDriver] = useState<DriverRadarItem | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'online' | 'busy' | 'over_debt'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Google Maps disabled: Supervisor Radar runs purely on OpenStreetMap + Leaflet + Redis/Centrifugo
  useEffect(() => {
    setMapEngine('leaflet');
  }, []);

  // Handle fallback if Google Maps fails
  useEffect(() => {
    (window as any).gm_authFailure = () => {
      console.warn('Google Maps authentication failed, switching to OpenStreetMap Leaflet');
      setMapEngine('leaflet');
    };
  }, []);

  // Filter drivers based on tabs & search
  const filteredDrivers = drivers.filter((d) => {
    if (filterMode === 'online' && (!d.is_online || d.is_busy)) return false;
    if (filterMode === 'busy' && !d.is_busy) return false;
    if (filterMode === 'over_debt' && !d.is_over_limit) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.phone_number.includes(q) ||
        d.license_plate.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Keep selectedDriver in sync with updated data
  useEffect(() => {
    if (selectedDriver) {
      const found = drivers.find((d) => d.id === selectedDriver.id);
      if (found) {
        setSelectedDriver(found);
      }
    }
  }, [drivers]);

  // Clean up Leaflet
  const cleanupLeaflet = useCallback(() => {
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      leafletMarkersRef.current = null;
      leafletRouteRef.current = null;
      leafletTripMarkersRef.current = null;
    }
  }, []);

  // Clean up Google Maps
  const cleanupGoogleMaps = useCallback(() => {
    googleMarkersRef.current.forEach((m) => m.setMap && m.setMap(null));
    googleMarkersRef.current = [];
    googleTripMarkersRef.current.forEach((m) => m.setMap && m.setMap(null));
    googleTripMarkersRef.current = [];
    if (googleDirectionsRendererRef.current) {
      googleDirectionsRendererRef.current.setMap(null);
      googleDirectionsRendererRef.current = null;
    }
    if (googlePolylineRef.current) {
      googlePolylineRef.current.setMap(null);
      googlePolylineRef.current = null;
    }
    googleMapRef.current = null;
  }, []);

  // Initialize Map whenever engine changes
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapEngine === 'google' && googleMapsReady && (window as any).google?.maps) {
      cleanupLeaflet();
      // Init Google Map
      const google = (window as any).google;
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 24.7136, lng: 46.6753 },
        zoom: 12,
        mapTypeId: 'roadmap',
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.LEFT_BOTTOM,
        },
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        ],
      });

      googleMapRef.current = map;
      googleDirectionsRendererRef.current = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#D70F64',
          strokeWeight: 5,
          strokeOpacity: 0.85,
        },
      });

      googleTrafficLayerRef.current = new google.maps.TrafficLayer();
    } else {
      // Init Leaflet Map with OpenStreetMap Standard Tiles (NO CARTO WATERMARK)
      cleanupGoogleMaps();
      if (!leafletMapRef.current && mapContainerRef.current) {
        // Clear container content first
        mapContainerRef.current.innerHTML = '';
        const map = L.map(mapContainerRef.current, {
          center: [24.7136, 46.6753],
          zoom: 12,
          zoomControl: false,
        });

        L.control.zoom({ position: 'bottomleft' }).addTo(map);

        // Standard OpenStreetMap Tile Layer - Crisp, Light, No Watermark, No API Key Required
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        leafletMarkersRef.current = L.layerGroup().addTo(map);
        leafletTripMarkersRef.current = L.layerGroup().addTo(map);
        leafletMapRef.current = map;
      }
    }

    return () => {
      // cleanup on unmount
    };
  }, [mapEngine, googleMapsReady, cleanupGoogleMaps, cleanupLeaflet]);

  // Traffic layer toggle for Google Maps
  useEffect(() => {
    if (googleTrafficLayerRef.current && googleMapRef.current) {
      googleTrafficLayerRef.current.setMap(trafficEnabled ? googleMapRef.current : null);
    }
  }, [trafficEnabled]);

  // -------------------------------------------------------------
  // RENDER MARKERS & ROUTES (LEAFLET)
  // -------------------------------------------------------------
  useEffect(() => {
    if (mapEngine !== 'leaflet' || !leafletMapRef.current || !leafletMarkersRef.current) return;

    const map = leafletMapRef.current;
    const markersLayer = leafletMarkersRef.current;
    const tripMarkersLayer = leafletTripMarkersRef.current;

    markersLayer.clearLayers();
    if (tripMarkersLayer) tripMarkersLayer.clearLayers();
    if (leafletRouteRef.current) {
      leafletRouteRef.current.remove();
      leafletRouteRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    // 1. Render Driver Markers
    filteredDrivers.forEach((driver) => {
      const lat = driver.latitude || 24.7136;
      const lng = driver.longitude || 46.6753;
      bounds.extend([lat, lng]);

      const isSelected = selectedDriver?.id === driver.id;

      // Status color
      let bgColor = '#10b981'; // emerald online
      let statusText = 'متصل ومستعد';
      let statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

      if (driver.is_busy) {
        bgColor = '#f59e0b'; // amber busy
        statusText = 'مشغول في مهمة';
        statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
      } else if (!driver.is_online) {
        bgColor = '#64748b'; // slate offline
        statusText = 'غير متصل';
        statusBadgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
      }

      if (driver.is_over_limit) {
        bgColor = '#ef4444'; // red debt exceeded
        statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
      }

      const vehicleSvg =
        driver.vehicle_type === 'CAR'
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;

      const iconHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="
            width: ${isSelected ? '44px' : '36px'};
            height: ${isSelected ? '44px' : '36px'};
            border-radius: 50%;
            background-color: ${bgColor};
            border: ${isSelected ? '3px solid #D70F64' : '2.5px solid #ffffff'};
            box-shadow: 0 4px 12px rgba(15,23,42,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            transition: all 0.2s ease;
          ">
            ${vehicleSvg}
          </div>
          ${
            driver.is_over_limit
              ? `<div style="
                  position: absolute;
                  top: -4px;
                  right: -4px;
                  background: #ef4444;
                  color: #fff;
                  font-size: 9px;
                  font-weight: bold;
                  padding: 1px 4px;
                  border-radius: 6px;
                  border: 1px solid #fff;
                ">سقف</div>`
              : ''
          }
          ${
            isSelected
              ? `<div style="
                  position: absolute;
                  bottom: -18px;
                  background: #0f172a;
                  color: #ffffff;
                  font-size: 10px;
                  font-weight: bold;
                  padding: 1px 6px;
                  border-radius: 6px;
                  white-space: nowrap;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                ">${driver.name}</div>`
              : ''
          }
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-driver-pin',
        html: iconHtml,
        iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
        iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18],
        popupAnchor: [0, -22],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const popupHtml = `
        <div style="font-family: 'Cairo', sans-serif; min-width: 210px; text-align: right; direction: rtl; color: #0f172a;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
            <strong style="color: #0f172a; font-size: 13px;">${driver.name}</strong>
            <span style="font-size: 10px; padding: 2px 7px; border-radius: 8px; font-weight: bold; background: ${bgColor}18; color: ${bgColor};">
              ${statusText}
            </span>
          </div>
          <div style="font-size: 11px; color: #475569; line-height: 1.6;">
            <div><strong>الهاتف:</strong> <a href="tel:${driver.phone_number}" style="color: #0284c7; font-weight: bold; text-decoration: none;">${driver.phone_number || '-'}</a></div>
            <div><strong>المركبة:</strong> ${driver.vehicle_type_display} (${driver.license_plate || 'بدون لوحة'})</div>
            <div><strong>التقييم:</strong> ${driver.rating} من 5 (${driver.total_delivered_orders} طلب)</div>
            <div style="margin-top: 4px; padding: 4px 8px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0;">
              <strong>الكاش بيده:</strong> <span style="font-weight: bold; color: ${driver.is_over_limit ? '#ef4444' : '#10b981'};">${driver.cash_in_hand} ج.م</span>
              <span style="font-size: 10px; color: #64748b;">/ سقف ${driver.cod_max_ceiling}</span>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        setSelectedDriver(driver);
      });

      markersLayer.addLayer(marker);
    });

    // 2. Render Active Delivery Route if selected driver has an active trip
    if (selectedDriver && selectedDriver.active_trip && tripMarkersLayer) {
      const trip = selectedDriver.active_trip;
      const driverLat = selectedDriver.latitude || 24.7136;
      const driverLng = selectedDriver.longitude || 46.6753;
      const restLat = trip.restaurant_latitude || 24.7136;
      const restLng = trip.restaurant_longitude || 46.6753;
      const custLat = trip.customer_latitude || 24.715;
      const custLng = trip.customer_longitude || 46.678;

      const tripBounds = L.latLngBounds([
        [driverLat, driverLng],
        [restLat, restLng],
        [custLat, custLng],
      ]);

      // Restaurant Marker
      const restIconHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background-color: #059669;
            border: 2px solid #ffffff;
            box-shadow: 0 4px 10px rgba(5,150,105,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>
          </div>
          <div style="
            position: absolute;
            bottom: -18px;
            background: #059669;
            color: #ffffff;
            font-size: 10px;
            font-weight: bold;
            padding: 1px 6px;
            border-radius: 6px;
            white-space: nowrap;
          ">استلام: ${trip.restaurant_name}</div>
        </div>
      `;
      const restMarker = L.marker([restLat, restLng], {
        icon: L.divIcon({
          className: 'custom-rest-pin',
          html: restIconHtml,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      });
      restMarker.bindPopup(`
        <div style="font-family: 'Cairo'; direction: rtl; text-align: right; color: #0f172a;">
          <strong style="font-size: 12px; color: #059669;">نقطة الاستلام: ${trip.restaurant_name}</strong>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${trip.restaurant_address || 'عنوان المتجر'}</div>
        </div>
      `);
      tripMarkersLayer.addLayer(restMarker);

      // Customer Marker
      const custIconHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background-color: #6366f1;
            border: 2px solid #ffffff;
            box-shadow: 0 4px 10px rgba(99,102,241,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          </div>
          <div style="
            position: absolute;
            bottom: -18px;
            background: #4f46e5;
            color: #ffffff;
            font-size: 10px;
            font-weight: bold;
            padding: 1px 6px;
            border-radius: 6px;
            white-space: nowrap;
          ">وجهة: ${trip.customer_name || 'العميل'}</div>
        </div>
      `;
      const custMarker = L.marker([custLat, custLng], {
        icon: L.divIcon({
          className: 'custom-cust-pin',
          html: custIconHtml,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      });
      custMarker.bindPopup(`
        <div style="font-family: 'Cairo'; direction: rtl; text-align: right; color: #0f172a;">
          <strong style="font-size: 12px; color: #4f46e5;">وجهة التسليم: ${trip.customer_name || 'العميل'}</strong>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${trip.customer_address || 'عنوان العميل'}</div>
        </div>
      `);
      tripMarkersLayer.addLayer(custMarker);

      // Route Path Line: Driver -> Restaurant -> Customer
      const routePoints: [number, number][] = [
        [driverLat, driverLng],
        [restLat, restLng],
        [custLat, custLng],
      ];

      const polyline = L.polyline(routePoints, {
        color: '#D70F64',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
      }).addTo(map);

      leafletRouteRef.current = polyline;

      // Fit trip bounds smoothly
      map.fitBounds(tripBounds, { padding: [80, 80], maxZoom: 15 });
    } else if (filteredDrivers.length > 0 && bounds.isValid() && !selectedDriver) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [filteredDrivers, selectedDriver, mapEngine]);

  // -------------------------------------------------------------
  // RENDER MARKERS & ROUTES (GOOGLE MAPS)
  // -------------------------------------------------------------
  useEffect(() => {
    if (mapEngine !== 'google' || !googleMapRef.current || !(window as any).google?.maps) return;

    const google = (window as any).google;
    const map = googleMapRef.current;

    // Clear old Google Markers
    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];
    googleTripMarkersRef.current.forEach((m) => m.setMap(null));
    googleTripMarkersRef.current = [];

    if (googlePolylineRef.current) {
      googlePolylineRef.current.setMap(null);
      googlePolylineRef.current = null;
    }
    if (googleDirectionsRendererRef.current) {
      googleDirectionsRendererRef.current.setDirections({ routes: [] });
    }

    const bounds = new google.maps.LatLngBounds();

    filteredDrivers.forEach((driver) => {
      const lat = driver.latitude || 24.7136;
      const lng = driver.longitude || 46.6753;
      const pos = { lat, lng };
      bounds.extend(pos);

      let pinColor = '#10b981'; // online
      if (driver.is_busy) pinColor = '#f59e0b';
      else if (!driver.is_online) pinColor = '#64748b';
      if (driver.is_over_limit) pinColor = '#ef4444';

      const isSelected = selectedDriver?.id === driver.id;

      // Custom SVG Marker Icon for Google Maps
      const markerSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? 44 : 36}" height="${isSelected ? 44 : 36}" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="${pinColor}" stroke="${isSelected ? '#D70F64' : '#ffffff'}" stroke-width="${isSelected ? 3 : 2}" />
          <path d="M12 18l4 4l8-8" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
        </svg>
      `;

      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: driver.name,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg)}`,
          scaledSize: new google.maps.Size(isSelected ? 44 : 36, isSelected ? 44 : 36),
          anchor: new google.maps.Point(isSelected ? 22 : 18, isSelected ? 22 : 18),
        },
      });

      marker.addListener('click', () => {
        setSelectedDriver(driver);
      });

      googleMarkersRef.current.push(marker);
    });

    // If a driver with an active trip is selected, render Restaurant, Customer, and Directions
    if (selectedDriver && selectedDriver.active_trip) {
      const trip = selectedDriver.active_trip;
      const driverPos = { lat: selectedDriver.latitude || 24.7136, lng: selectedDriver.longitude || 46.6753 };
      const restPos = { lat: trip.restaurant_latitude || 24.7136, lng: trip.restaurant_longitude || 46.6753 };
      const custPos = { lat: trip.customer_latitude || 24.715, lng: trip.customer_longitude || 46.678 };

      // Restaurant marker
      const restSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
          <rect width="36" height="36" x="1" y="1" rx="10" fill="#059669" stroke="#ffffff" stroke-width="2" />
          <path d="M10 14h18M13 14v10M25 14v10M10 24h18" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;
      const restMarker = new google.maps.Marker({
        position: restPos,
        map,
        title: `المتجر: ${trip.restaurant_name}`,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(restSvg)}`,
          scaledSize: new google.maps.Size(38, 38),
          anchor: new google.maps.Point(19, 19),
        },
      });
      googleTripMarkersRef.current.push(restMarker);

      // Customer marker
      const custSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
          <rect width="36" height="36" x="1" y="1" rx="10" fill="#6366f1" stroke="#ffffff" stroke-width="2" />
          <path d="M12 26v-8l7-6l7 6v8z" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;
      const custMarker = new google.maps.Marker({
        position: custPos,
        map,
        title: `وجهة العميل: ${trip.customer_name || 'العميل'}`,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(custSvg)}`,
          scaledSize: new google.maps.Size(38, 38),
          anchor: new google.maps.Point(19, 19),
        },
      });
      googleTripMarkersRef.current.push(custMarker);

      // Attempt Google DirectionsService (driving route)
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: driverPos,
          destination: custPos,
          waypoints: [{ location: restPos, stopover: true }],
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result: any, status: string) => {
          if (status === 'OK' && result && googleDirectionsRendererRef.current) {
            googleDirectionsRendererRef.current.setDirections(result);
          } else {
            // Direct Polyline fallback if directions quota or api is restricted
            const polyline = new google.maps.Polyline({
              path: [driverPos, restPos, custPos],
              geodesic: true,
              strokeColor: '#D70F64',
              strokeOpacity: 0.85,
              strokeWeight: 4,
              map,
            });
            googlePolylineRef.current = polyline;
          }
        }
      );

      const tripBounds = new google.maps.LatLngBounds();
      tripBounds.extend(driverPos);
      tripBounds.extend(restPos);
      tripBounds.extend(custPos);
      map.fitBounds(tripBounds, { top: 70, right: 70, bottom: 70, left: 70 });
    } else if (filteredDrivers.length > 0 && !bounds.isEmpty() && !selectedDriver) {
      map.fitBounds(bounds);
    }
  }, [filteredDrivers, selectedDriver, mapEngine]);

  // Center/focus on specific coordinate
  const handleCenterOn = (lat: number, lng: number, zoom: number = 15) => {
    if (mapEngine === 'google' && googleMapRef.current) {
      googleMapRef.current.panTo({ lat, lng });
      googleMapRef.current.setZoom(zoom);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.setView([lat, lng], zoom, { animate: true });
    }
  };

  const handleFocusDriver = (driver: DriverRadarItem) => {
    setSelectedDriver(driver);
    if (driver.latitude && driver.longitude) {
      handleCenterOn(driver.latitude, driver.longitude, 15);
    }
  };

  const handleFitEntireRoute = () => {
    if (!selectedDriver?.active_trip) return;
    const trip = selectedDriver.active_trip;
    const pts = [
      [selectedDriver.latitude || 24.7136, selectedDriver.longitude || 46.6753],
      [trip.restaurant_latitude || 24.7136, trip.restaurant_longitude || 46.6753],
      [trip.customer_latitude || 24.715, trip.customer_longitude || 46.678],
    ];

    if (mapEngine === 'google' && googleMapRef.current) {
      const google = (window as any).google;
      const b = new google.maps.LatLngBounds();
      pts.forEach(([lat, lng]) => b.extend({ lat, lng }));
      googleMapRef.current.fitBounds(b, { top: 70, right: 70, bottom: 70, left: 70 });
    } else if (leafletMapRef.current) {
      const b = L.latLngBounds(pts as any);
      leafletMapRef.current.fitBounds(b, { padding: [70, 70] });
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-4">
      {/* Map Main Canvas (3 columns on large screen) */}
      <div className="lg:col-span-3 relative h-[540px] lg:h-[680px] w-full bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Top Floating Controls */}
        <div className="absolute top-4 right-4 z-[400] flex flex-wrap gap-2 items-center">
          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filterMode === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              الكل ({drivers.length})
            </button>
            <button
              onClick={() => setFilterMode('online')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                filterMode === 'online'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              متاح للطلب ({drivers.filter((d) => d.is_online && !d.is_busy).length})
            </button>
            <button
              onClick={() => setFilterMode('busy')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                filterMode === 'busy'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              في رحلة ({drivers.filter((d) => d.is_busy).length})
            </button>
            <button
              onClick={() => setFilterMode('over_debt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                filterMode === 'over_debt'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              تجاوزوا السقف ({drivers.filter((d) => d.is_over_limit).length})
            </button>
          </div>

          {/* Map Engine Indicator: Pure OSM + Redis */}
          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            <span>OSM + Redis مباشر</span>
          </div>
        </div>

        {/* Live Trip Tracking HUD Overlay (When a Driver with Active Trip is Selected) */}
        {selectedDriver && selectedDriver.active_trip && (
          <div className="absolute top-20 right-4 z-[400] max-w-sm w-full bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl transition animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary-50 text-primary border border-primary-100 flex items-center justify-center">
                  <Route className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    تتبع الرحلة #{selectedDriver.active_trip.order_number}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {selectedDriver.active_trip.status_display}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDriver(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Path Steps */}
            <div className="space-y-2.5 text-xs">
              {/* 1. Driver Location */}
              <div className="flex items-start justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <div>
                    <div className="font-bold text-slate-800">موقع الكابتن الحالي</div>
                    <div className="text-[11px] text-slate-500">{selectedDriver.name}</div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    selectedDriver.latitude &&
                    selectedDriver.longitude &&
                    handleCenterOn(selectedDriver.latitude, selectedDriver.longitude, 16)
                  }
                  className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                >
                  تركيز
                </button>
              </div>

              {/* 2. Restaurant Pickup Location */}
              <div className="flex items-start justify-between bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold text-emerald-900">
                      {selectedDriver.active_trip.restaurant_name}
                    </div>
                    <div className="text-[11px] text-emerald-700">
                      {selectedDriver.active_trip.restaurant_address || 'عنوان المتجر'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    selectedDriver.active_trip?.restaurant_latitude &&
                    selectedDriver.active_trip?.restaurant_longitude &&
                    handleCenterOn(
                      selectedDriver.active_trip.restaurant_latitude,
                      selectedDriver.active_trip.restaurant_longitude,
                      16
                    )
                  }
                  className="px-2 py-1 rounded-lg bg-white border border-emerald-200 text-[10px] font-bold text-emerald-800 hover:bg-emerald-50"
                >
                  تركيز
                </button>
              </div>

              {/* 3. Customer Destination Location */}
              <div className="flex items-start justify-between bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-bold text-indigo-900">
                      {selectedDriver.active_trip.customer_name || 'العميل'}
                    </div>
                    <div className="text-[11px] text-indigo-700">
                      {selectedDriver.active_trip.customer_address || 'عنوان التسليم'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    selectedDriver.active_trip?.customer_latitude &&
                    selectedDriver.active_trip?.customer_longitude &&
                    handleCenterOn(
                      selectedDriver.active_trip.customer_latitude,
                      selectedDriver.active_trip.customer_longitude,
                      16
                    )
                  }
                  className="px-2 py-1 rounded-lg bg-white border border-indigo-200 text-[10px] font-bold text-indigo-800 hover:bg-indigo-50"
                >
                  تركيز
                </button>
              </div>
            </div>

            {/* Trip Action Footer */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                المسافة: <strong className="text-slate-800">{selectedDriver.active_trip.distance_km || 0} كم</strong>
              </div>
              <button
                onClick={handleFitEntireRoute}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition shadow-sm shadow-primary/20"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>عرض كامل المسار</span>
              </button>
            </div>
          </div>
        )}

        {/* Selected Idle Driver Quick Card */}
        {selectedDriver && !selectedDriver.active_trip && (
          <div className="absolute top-20 right-4 z-[400] max-w-sm w-full bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl transition animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    selectedDriver.is_online ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {selectedDriver.vehicle_type === 'CAR' ? <Car className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900">{selectedDriver.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {selectedDriver.is_online ? 'متصل ومتاح للطلب' : 'غير متصل حالياً'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDriver(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>الهاتف:</span>
                <a href={`tel:${selectedDriver.phone_number}`} className="font-bold text-sky-600 hover:underline">
                  {selectedDriver.phone_number || '-'}
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span>المركبة:</span>
                <span className="font-medium text-slate-800">
                  {selectedDriver.vehicle_type_display} ({selectedDriver.license_plate})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>الكاش بيده:</span>
                <span
                  className={`font-bold ${selectedDriver.is_over_limit ? 'text-rose-600' : 'text-emerald-600'}`}
                >
                  {selectedDriver.cash_in_hand} ج.م / سقف {codCeiling} ج.م
                </span>
              </div>
            </div>

            {onSelectDriverForDispatch && selectedDriver.is_online && (
              <button
                onClick={() => onSelectDriverForDispatch(selectedDriver)}
                className="w-full mt-3 py-2 px-3 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-primary/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>تكليف بطلب في لوحة التوزيع</span>
              </button>
            )}
          </div>
        )}

        {/* Map Legend */}
        <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-md text-[11px] text-slate-700 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>متاح</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>مشغول برحلة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            <span>غير متصل</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>تجاوز السقف</span>
          </div>
        </div>
      </div>

      {/* Driver List & Interactive Radar Panel (1 column on large screen) */}
      <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-r border-slate-200 bg-white flex flex-col h-[400px] lg:h-[680px]">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" />
              <span>كباتن الرادار ({filteredDrivers.length})</span>
            </h3>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث بالاسم، الهاتف أو اللوحة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition shadow-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          </div>
        </div>

        {/* Drivers List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
          {filteredDrivers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              لا يوجد كباتن مطابقين للبحث أو الفلتر
            </div>
          ) : (
            filteredDrivers.map((driver) => {
              const isSelected = selectedDriver?.id === driver.id;
              return (
                <div
                  key={driver.id}
                  onClick={() => handleFocusDriver(driver)}
                  className={`p-3 rounded-2xl cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-primary-50 border border-primary-200 shadow-sm'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                        driver.is_over_limit
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : driver.is_busy
                          ? 'bg-amber-50 text-amber-600 border border-amber-200'
                          : driver.is_online
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {driver.vehicle_type === 'CAR' ? <Car className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">{driver.name}</span>
                        {driver.is_busy ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                            في رحلة
                          </span>
                        ) : driver.is_online ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                            متاح
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            أوفلاين
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>{driver.phone_number || 'بدون هاتف'}</span>
                        <span>•</span>
                        <span>{driver.license_plate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left">
                    <div
                      className={`text-xs font-extrabold ${
                        driver.is_over_limit ? 'text-rose-600' : 'text-slate-800'
                      }`}
                    >
                      {driver.cash_in_hand} ج.م
                    </div>
                    <div className="text-[10px] text-slate-400">كاش بيده</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Driver Quick Bar */}
        {selectedDriver && (
          <div className="p-3 bg-slate-50 border-t border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-extrabold text-slate-900">{selectedDriver.name}</span>
              <a
                href={`tel:${selectedDriver.phone_number}`}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-white hover:bg-slate-100 rounded-lg text-sky-700 font-bold border border-slate-200 shadow-sm"
              >
                <Phone className="w-3 h-3 text-sky-600" />
                <span>اتصال</span>
              </a>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span>الكاش المحصل: {selectedDriver.cash_in_hand} ج.م</span>
              {selectedDriver.is_over_limit ? (
                <span className="text-rose-700 font-bold">متجاوز السقف ({codCeiling} ج.م)</span>
              ) : (
                <span className="text-emerald-700 font-semibold">ضمن السقف المسموح</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
