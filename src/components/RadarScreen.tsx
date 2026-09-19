import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Radio,
  Layers,
  Shield,
  Gauge,
  CheckCircle,
  Truck,
  Filter,
  Eye,
  Maximize2,
  Navigation,
  Satellite,
  Activity,
  CloudFog,
  Droplets,
  RotateCcw,
  Compass,
  MapPin,
  Flag,
  Milestone,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Cpu,
  Wind,
  Thermometer,
  Vibrate,
  Usb,
  Globe,
  Wifi,
} from 'lucide-react';
import L from 'leaflet';
import { VehicleTwin, ConflictIncident, RadioToast, UserRole, WeatherData, HardwareTelemetry } from '../types';
import {
  INCLINE_TRACK,
  PASSING_BAY_ALPHA,
  PASSING_BAY_BETA,
  HAUL_CHECKPOINTS,
  samplePointAtDistance,
  projectCanvasToGps,
  GEO_BOUNDS,
  NMDC_MINES,
} from '../utils/kinematics';

interface RadarScreenProps {
  vehicles: VehicleTwin[];
  activeConflict: ConflictIncident | null;
  onSelectVehicle: (vehicle: VehicleTwin) => void;
  onHoldVehicle: (vehicleId: string) => void;
  onClearVehicle: (vehicleId: string) => void;
  onOpenBroadcast: () => void;
  totalHauledTons: number;
  targetTons?: number;
  radioNotice: RadioToast | null;
  userRole?: UserRole;
  weather?: WeatherData;
  telemetry?: HardwareTelemetry;
  onOpenEsp32WifiModal?: () => void;
  onSimulateEsp32WifiPacket?: () => void;
}

export const RadarScreen: React.FC<RadarScreenProps> = ({
  vehicles,
  activeConflict,
  onSelectVehicle,
  onHoldVehicle,
  onClearVehicle,
  onOpenBroadcast,
  totalHauledTons,
  targetTons = 40000,
  radioNotice,
  userRole = 'dispatcher',
  weather,
  telemetry,
  onOpenEsp32WifiModal,
  onSimulateEsp32WifiPacket,
}) => {
  // Active NMDC Mine Site or Live Field Device Mode
  const [activeMine, setActiveMine] = useState<'DEVICE' | '14A' | '14C' | 'DEP5' | 'DONI'>('DEVICE');

  // Display Mode: Live Satellite Orthophoto (GIS) or Tactical Radar (CAD)
  const [displayMode, setDisplayMode] = useState<'satellite' | 'radar'>('satellite');
  const [googleMapsType, setGoogleMapsType] = useState<'hybrid' | 'satellite' | 'terrain' | 'roadmap'>('hybrid');
  const [followGps, setFollowGps] = useState<boolean>(true);
  const [viewPreset, setViewPreset] = useState<'overview' | 'hairpin3' | 'crusher'>('overview');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'warning' | 'queued' | 'hauling'>('all');

  // Layer toggles
  const [showBenchLines, setShowBenchLines] = useState(true);
  const [showPassingBays, setShowPassingBays] = useState(true);
  const [showCheckpoints, setShowCheckpoints] = useState(true);
  const [showBrakingRings, setShowBrakingRings] = useState(true);
  const [showWeatherFx, setShowWeatherFx] = useState(true);
  const [showHeadlights, setShowHeadlights] = useState(true);

  // Collapsible Dual-Side Panels State ("Two Tabs on Each Side")
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [leftTab, setLeftTab] = useState<'esp32wifi' | 'hardware' | 'interlock' | 'all'>('esp32wifi');
  const [rightTab, setRightTab] = useState<'roster' | 'checkpoints' | 'all'>('roster');

  // Trigger Leaflet map resize when panels collapse or expand
  useEffect(() => {
    const t1 = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 120);
    const t2 = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isLeftCollapsed, isRightCollapsed]);

  // Leaflet references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const googleTileLayerRef = useRef<L.TileLayer | null>(null);
  const vehicleMarkersRef = useRef<{ [key: string]: L.Marker }>({});
  const conflictLineRef = useRef<L.Polyline | null>(null);
  const haulRoadPolylineRef = useRef<L.Polyline | null>(null);
  const staticMarkersRef = useRef<L.Marker[]>([]);
  const checkpointMarkersRef = useRef<L.Marker[]>([]);

  // Real Device GPS (Browser Geolocation API / NEO-6M sensor)
  const deviceMarkerRef = useRef<L.Marker | null>(null);
  const deviceAccuracyCircleRef = useRef<L.Circle | null>(null);
  const [deviceGps, setDeviceGps] = useState<{
    lat: number; lng: number; accuracy: number; heading: number | null; speed: number | null; source: 'browser' | 'neo6m';
  } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const getGoogleMapsTileUrl = (type: 'hybrid' | 'satellite' | 'terrain' | 'roadmap') => {
    switch (type) {
      case 'satellite':
        return 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
      case 'terrain':
        return 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      case 'roadmap':
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      case 'hybrid':
      default:
        return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    }
  };

  const isDispatcher = userRole === 'dispatcher';
  const isDeviceMode = activeMine === 'DEVICE';
  const currentMineInfo =
    isDeviceMode && deviceGps
      ? {
          id: 'DEVICE',
          name: 'MTC Live Field Unit',
          subName: `Field Telemetry • ${deviceGps.source === 'neo6m' ? 'NEO-6M Hardware' : 'Real-Time Browser GPS'}`,
          location: `${deviceGps.lat.toFixed(4)}°N, ${deviceGps.lng.toFixed(4)}°E`,
          state: 'Live Device Position',
          center: [deviceGps.lat, deviceGps.lng] as [number, number],
          zoom: 16,
          bounds: {
            minLat: deviceGps.lat - 0.05,
            maxLat: deviceGps.lat + 0.05,
            minLng: deviceGps.lng - 0.05,
            maxLng: deviceGps.lng + 0.05,
          },
          elevationRange: 'Active Device Alt',
          grade: 'Terrain Ground Track',
        }
      : NMDC_MINES[activeMine as keyof typeof NMDC_MINES] || NMDC_MINES['14A'];

  // SVG viewBox adjusted for camera presets
  const getViewBox = () => {
    switch (viewPreset) {
      case 'hairpin3':
        return '200 180 380 280';
      case 'crusher':
        return '350 0 380 260';
      case 'overview':
      default:
        return '0 0 800 600';
    }
  };

  // Filtered roster vehicles
  const filteredVehicles = vehicles.filter((v) => {
    if (statusFilter === 'critical') return v.hazardEnvelope || v.mustHoldByMTC;
    if (statusFilter === 'warning') return v.state === 'HELD_BY_MTC';
    if (statusFilter === 'queued')
      return (
        v.state === 'QUEUING' ||
        v.state === 'LOADING_AT_SHOVEL' ||
        v.state === 'DISCHARGING_AT_CRUSHER'
      );
    if (statusFilter === 'hauling') return v.state === 'INCLINE_HAUL' || v.state === 'EMPTY';
    return true;
  });

  const progressPercent = Math.min(100, (totalHauledTons / targetTons) * 100);

  // SVG haul track path data string
  const trackPathData = INCLINE_TRACK.points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  // Live Haul Route Checkpoint Passage & Crossing Calculation
  const checkpointPassageData = HAUL_CHECKPOINTS.map((cp) => {
    const pt = samplePointAtDistance(cp.progress * INCLINE_TRACK.totalLength);
    const gps = projectCanvasToGps(pt.x, pt.y, activeMine);

    // Filter vehicles that have crossed this checkpoint in their current run
    const crossedVehicles = vehicles.filter((v) => {
      if (v.direction === 1) {
        return v.pathProgress >= cp.progress;
      } else {
        return v.pathProgress <= cp.progress;
      }
    });

    // Determine nearest approaching vehicle
    let nearestApproaching: { vehicle: VehicleTwin; distM: number } | null = null;
    vehicles.forEach((v) => {
      const isHeadingToward =
        (v.direction === 1 && v.pathProgress < cp.progress) ||
        (v.direction === -1 && v.pathProgress > cp.progress);
      if (isHeadingToward) {
        const distM = Math.round(Math.abs(v.pathProgress - cp.progress) * INCLINE_TRACK.totalLength);
        if (!nearestApproaching || distM < nearestApproaching.distM) {
          nearestApproaching = { vehicle: v, distM };
        }
      }
    });

    return {
      ...cp,
      x: pt.x,
      y: pt.y,
      gps,
      crossedVehicles,
      crossedCount: crossedVehicles.length,
      nearestApproaching,
    };
  });

  // --------------------------------------------------------------------------
  // LEAFLET SATELLITE MAP INITIALIZATION & CLEANUP
  // --------------------------------------------------------------------------
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // ignore
        }
        mapInstanceRef.current = null;
        vehicleMarkersRef.current = {};
        staticMarkersRef.current = [];
        checkpointMarkersRef.current = [];
        conflictLineRef.current = null;
        haulRoadPolylineRef.current = null;
      }
    };
  }, []);

  // Initialize or re-size Leaflet map ONLY when user switches to satellite mode
  useEffect(() => {
    if (displayMode !== 'satellite') return;
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      try {
        // Clear any dangling leaflet id on container
        if ((mapContainerRef.current as any)._leaflet_id) {
          try {
            delete (mapContainerRef.current as any)._leaflet_id;
          } catch {
            (mapContainerRef.current as any)._leaflet_id = undefined;
          }
        }

        const mine = NMDC_MINES[activeMine] || NMDC_MINES['14A'];

        const map = L.map(mapContainerRef.current, {
          center: mine.center,
          zoom: mine.zoom,
          zoomControl: false,
          attributionControl: false,
        });

        L.control.zoom({ position: 'topright' }).addTo(map);

        // High-resolution Google Maps Layer (Hybrid Satellite / Satellite / Terrain / Roadmap)
        const gTile = L.tileLayer(getGoogleMapsTileUrl(googleMapsType), {
          maxZoom: 20,
          attribution: 'Map data &copy; Google Maps &mdash; NMDC Open-Cast Projects',
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        }).addTo(map);
        googleTileLayerRef.current = gTile;

        // Haul Road Incline Path Polyline
        const pathGps = INCLINE_TRACK.points.map((pt) => {
          const { lat, lng } = projectCanvasToGps(pt.x, pt.y, activeMine);
          return [lat, lng] as [number, number];
        });

        haulRoadPolylineRef.current = L.polyline(pathGps, {
          color: '#f59e0b',
          weight: 6,
          opacity: 0.85,
          dashArray: '8, 8',
        }).addTo(map);

        // Shovel 01 Marker (Pit Floor extraction face)
        const shovelGps = projectCanvasToGps(140, 535, activeMine);
        const shovelIcon = L.divIcon({
          className: 'leaflet-shovel-icon',
          html: `
            <div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#052e16;border:2px solid #4ade80;color:#86efac;font-family:monospace;font-size:10px;font-weight:bold;box-shadow:0 4px 14px rgba(0,0,0,0.8);">
              SHV1
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        const shvMarker = L.marker([shovelGps.lat, shovelGps.lng], { icon: shovelIcon })
          .addTo(map)
          .bindPopup(`<b style="color:black;font-family:monospace;">ELECTRIC ROPE SHOVEL 01<br/>${mine.name} Floor</b>`);

        // Crusher 1 / Processing Plant Marker
        const crusherGps = projectCanvasToGps(575, 70, activeMine);
        const crusherIcon = L.divIcon({
          className: 'leaflet-crusher-icon',
          html: `
            <div style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;background:#172554;border:2px solid #60a5fa;color:#93c5fd;font-family:monospace;font-size:10px;font-weight:bold;box-shadow:0 4px 14px rgba(0,0,0,0.8);">
              PLT1
            </div>
          `,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });
        const cruMarker = L.marker([crusherGps.lat, crusherGps.lng], { icon: crusherIcon })
          .addTo(map)
          .bindPopup(`<b style="color:black;font-family:monospace;">PRIMARY CRUSHER &amp; SCREENING DECK<br/>${mine.name} Rim</b>`);

        // Passing Bays
        const bayAlphaGps = projectCanvasToGps(PASSING_BAY_ALPHA.x, PASSING_BAY_ALPHA.y, activeMine);
        const bayBetaGps = projectCanvasToGps(PASSING_BAY_BETA.x, PASSING_BAY_BETA.y, activeMine);

        const makeBayIcon = (name: string) =>
          L.divIcon({
            className: 'leaflet-bay-icon',
            html: `<div style="padding:2px 6px;background:rgba(23,37,84,0.9);border:1px solid #60a5fa;color:#bfdbfe;font-family:monospace;font-size:9px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.7);">${name}</div>`,
            iconSize: [80, 20],
            iconAnchor: [40, 10],
          });

        const mBayA = L.marker([bayAlphaGps.lat, bayAlphaGps.lng], { icon: makeBayIcon('BAY 07-B (ALPHA)') }).addTo(map);
        const mBayB = L.marker([bayBetaGps.lat, bayBetaGps.lng], { icon: makeBayIcon('BAY 04-A (BETA)') }).addTo(map);

        // Checkpoints CP-01 to CP-06
        const makeCpIcon = (cp: (typeof HAUL_CHECKPOINTS)[0]) =>
          L.divIcon({
            className: 'leaflet-checkpoint-icon',
            html: `
              <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
                <div style="padding:1.5px 5px;background:rgba(9,9,11,0.95);border:1.5px solid #0284c7;border-radius:4px;color:#38bdf8;font-family:monospace;font-size:9px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.8);margin-bottom:2px;display:flex;align-items:center;gap:3px;">
                  <span>🚩 ${cp.code}</span>
                </div>
                <div style="width:14px;height:14px;border-radius:50%;background:#0284c7;border:2px solid #ffffff;box-shadow:0 0 8px #0284c7;display:flex;align-items:center;justify-content:center;">
                  <div style="width:4px;height:4px;border-radius:50%;background:#ffffff;"></div>
                </div>
              </div>
            `,
            iconSize: [54, 34],
            iconAnchor: [27, 28],
          });

        const cpMarkers = HAUL_CHECKPOINTS.map((cp) => {
          const pt = samplePointAtDistance(cp.progress * INCLINE_TRACK.totalLength);
          const gps = projectCanvasToGps(pt.x, pt.y, activeMine);
          const isCp1 = cp.code === 'CP-1';
          const iotInfo = isCp1
            ? `<div style="margin-top:4px;padding:4px;background:#f0f9ff;border-left:3px solid #0284c7;font-size:10px;font-family:monospace;">` +
              `<b style="color:#0369a1;">ESP32 IoT Checkpoint Node (NODE1):</b><br/>` +
              `Temp: <b>${telemetry?.dht22.temperatureC.toFixed(1) ?? '24.2'}°C</b> &bull; Hum: <b>${telemetry?.dht22.humidityPercent ?? 78}%</b><br/>` +
              `MQ-135: <b>${telemetry?.mq135.rawAdc ?? telemetry?.checkpointStation?.mq135Adc ?? 412} ADC</b> (${telemetry?.mq135.ppm ?? 395} PPM)<br/>` +
              `NRF24: <b style="color:#16a34a;">${telemetry?.checkpointStation?.nrfStatus || 'DATA SENT'}</b>` +
              `</div>`
            : '';

          return L.marker([gps.lat, gps.lng], { icon: makeCpIcon(cp) })
            .addTo(map)
            .bindPopup(
              `<b style="color:#0284c7;font-family:monospace;">CHECKPOINT ${cp.code}: ${cp.name}</b><br/>` +
              `<span style="color:black;font-family:monospace;font-size:11px;">` +
              `Elevation: RL ${cp.elevationRL}m &bull; Speed Cap: ${cp.speedLimitKmh} km/h<br/>` +
              `${cp.description}</span>` +
              iotInfo
            );
        });

        staticMarkersRef.current = [shvMarker, cruMarker, mBayA, mBayB];
        checkpointMarkersRef.current = cpMarkers;
        mapInstanceRef.current = map;
      } catch (err) {
        console.error('Safe Leaflet initialization notice:', err);
      }
    }

    // Invalidate size once visible
    const timer = setTimeout(() => {
      try {
        mapInstanceRef.current?.invalidateSize();
      } catch {
        // ignore
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [displayMode, activeMine]);

  // Switch Google Maps Layer Type (Hybrid, Satellite, Terrain, Roadmap)
  useEffect(() => {
    if (googleTileLayerRef.current) {
      googleTileLayerRef.current.setUrl(getGoogleMapsTileUrl(googleMapsType));
    }
  }, [googleMapsType]);

  // Follow NEO-6M GPS coordinates on Google Maps
  useEffect(() => {
    if (displayMode !== 'satellite' || !followGps) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    if (telemetry?.neo6mGps?.latitude && telemetry?.neo6mGps?.longitude) {
      map.panTo([telemetry.neo6mGps.latitude, telemetry.neo6mGps.longitude], { animate: true });
    }
  }, [displayMode, followGps, telemetry?.neo6mGps?.latitude, telemetry?.neo6mGps?.longitude]);

  // Update map view & markers when activeMine changes (if map is mounted)
  useEffect(() => {
    if (displayMode !== 'satellite') return;
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      if (activeMine === 'DEVICE') {
        if (deviceGps) {
          map.flyTo([deviceGps.lat, deviceGps.lng], 16, { duration: 1.2 });
        }
        // Clear mine haul road polyline when viewing local device
        if (haulRoadPolylineRef.current) {
          haulRoadPolylineRef.current.setLatLngs([]);
        }
        // Hide mine-specific static markers in device mode
        staticMarkersRef.current.forEach((m) => m.setOpacity(0));
        checkpointMarkersRef.current.forEach((m) => m.setOpacity(0));
        return;
      }

      // Restore mine markers and road when a mine sector is selected
      staticMarkersRef.current.forEach((m) => m.setOpacity(1));
      checkpointMarkersRef.current.forEach((m) => m.setOpacity(1));

      const mine = NMDC_MINES[activeMine as keyof typeof NMDC_MINES] || NMDC_MINES['14A'];
      map.flyTo(mine.center, mine.zoom, { duration: 1.2 });

      // Update road line
      const pathGps = INCLINE_TRACK.points.map((pt) => {
        const { lat, lng } = projectCanvasToGps(pt.x, pt.y, activeMine);
        return [lat, lng] as [number, number];
      });
      if (haulRoadPolylineRef.current) {
        haulRoadPolylineRef.current.setLatLngs(pathGps);
      }

      // Update static markers
      const shovelGps = projectCanvasToGps(140, 535, activeMine);
      const crusherGps = projectCanvasToGps(575, 70, activeMine);
      const bayAlphaGps = projectCanvasToGps(PASSING_BAY_ALPHA.x, PASSING_BAY_ALPHA.y, activeMine);
      const bayBetaGps = projectCanvasToGps(PASSING_BAY_BETA.x, PASSING_BAY_BETA.y, activeMine);

      if (staticMarkersRef.current.length >= 4) {
        staticMarkersRef.current[0].setLatLng([shovelGps.lat, shovelGps.lng]);
        staticMarkersRef.current[1].setLatLng([crusherGps.lat, crusherGps.lng]);
        staticMarkersRef.current[2].setLatLng([bayAlphaGps.lat, bayAlphaGps.lng]);
        staticMarkersRef.current[3].setLatLng([bayBetaGps.lat, bayBetaGps.lng]);
      }

      // Update checkpoint marker positions
      HAUL_CHECKPOINTS.forEach((cp, idx) => {
        if (checkpointMarkersRef.current[idx]) {
          const pt = samplePointAtDistance(cp.progress * INCLINE_TRACK.totalLength);
          const gps = projectCanvasToGps(pt.x, pt.y, activeMine);
          checkpointMarkersRef.current[idx].setLatLng([gps.lat, gps.lng]);
        }
      });
    } catch (err) {
      console.error('Safe map update notice:', err);
    }
  }, [activeMine, displayMode, deviceGps]);

  // Update vehicles on the Leaflet map ONLY when satellite mode is active
  useEffect(() => {
    if (displayMode !== 'satellite') return;
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      vehicles.forEach((v) => {
        const { lat, lng } = projectCanvasToGps(v.x, v.y, activeMine);
        const isHazard = v.hazardEnvelope;
        const isHeld = v.state === 'HELD_BY_MTC';
        const color = isHazard ? '#ef4444' : isHeld ? '#f59e0b' : v.payloadTons > 0 ? '#2563eb' : '#16a34a';
        const puckBg = isHazard ? '#450a0a' : isHeld ? '#451a03' : v.payloadTons > 0 ? '#172554' : '#052e16';
        const iconStroke = isHazard ? '#fca5a5' : isHeld ? '#fde047' : v.payloadTons > 0 ? '#93c5fd' : '#86efac';

        // Authentic Google Maps GPS Navigation Puck Vehicle Icon
        const iconHtml = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
            <!-- Google Maps Floating Pill Label Tag -->
            <div style="position: absolute; top: -23px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; padding: 1.5px 6px; background: rgba(9, 9, 11, 0.95); border: 1.5px solid ${color}; border-radius: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; font-weight: 700; color: #ffffff; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.8); z-index: 10; pointer-events: none;">
              <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${color};"></span>
              <span>${v.id}</span>
              <span style="color:${color};font-weight:800;">${v.speedKmh > 0 ? `${v.speedKmh.toFixed(0)}k` : '0k'}</span>
            </div>

            <!-- Google Maps Navigation Puck rotating with heading -->
            <div style="transform: rotate(${v.headingDeg}deg); position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
              <!-- Google Maps Directional Heading Pointer Arrow -->
              <div style="position: absolute; top: -8px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 10px solid ${color}; filter: drop-shadow(0 -1px 2px rgba(0,0,0,0.7));"></div>

              <!-- Circular Base Puck -->
              <div style="width: 30px; height: 30px; border-radius: 50%; background: ${puckBg}; border: 2.5px solid ${color}; box-shadow: 0 3px 10px rgba(0,0,0,0.7), 0 0 10px ${color}80; display: flex; align-items: center; justify-content: center; ${isHazard ? 'animation: pulse 1s infinite;' : ''}">
                <!-- Top-Down Vehicle Vector (Google Maps Truck Icon) -->
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${iconStroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                  <path d="M15 18H9" />
                  <path d="M19 18h2a1 1 0 0 0 1-1v-5l-4-4h-3v10" />
                  <circle cx="7" cy="18" r="2" fill="${color}" />
                  <circle cx="17" cy="18" r="2" fill="${color}" />
                </svg>
              </div>
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'leaflet-custom-vehicle',
          html: iconHtml,
          iconSize: [36, 42],
          iconAnchor: [18, 24],
        });

        if (vehicleMarkersRef.current[v.id]) {
          vehicleMarkersRef.current[v.id].setLatLng([lat, lng]);
          vehicleMarkersRef.current[v.id].setIcon(customIcon);
        } else {
          const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
          marker.on('click', () => onSelectVehicle(v));
          vehicleMarkersRef.current[v.id] = marker;
        }
      });

      // Handle conflict line on satellite map
      if (activeConflict && activeConflict.active) {
        const vA = vehicles.find((v) => v.id === activeConflict.vehicleAId);
        const vB = vehicles.find((v) => v.id === activeConflict.vehicleBId);
        if (vA && vB) {
          const gpsA = projectCanvasToGps(vA.x, vA.y, activeMine);
          const gpsB = projectCanvasToGps(vB.x, vB.y, activeMine);
          if (conflictLineRef.current) {
            conflictLineRef.current.setLatLngs([
              [gpsA.lat, gpsA.lng],
              [gpsB.lat, gpsB.lng],
            ]);
          } else {
            conflictLineRef.current = L.polyline(
              [
                [gpsA.lat, gpsA.lng],
                [gpsB.lat, gpsB.lng],
              ],
              { color: '#ef4444', weight: 3, dashArray: '5, 5' }
            ).addTo(map);
          }
        }
      } else if (conflictLineRef.current) {
        conflictLineRef.current.remove();
        conflictLineRef.current = null;
      }
    } catch (err) {
      console.error('Safe vehicle marker update notice:', err);
    }
  }, [vehicles, activeConflict, onSelectVehicle, activeMine, displayMode]);

  // Reset Leaflet to active mine center or live device position
  const handleResetSatelliteView = () => {
    if (!mapInstanceRef.current) return;
    try {
      if (activeMine === 'DEVICE' && deviceGps) {
        mapInstanceRef.current.setView([deviceGps.lat, deviceGps.lng], 16, { animate: true });
        return;
      }
      const mine = NMDC_MINES[activeMine as keyof typeof NMDC_MINES] || NMDC_MINES['14A'];
      mapInstanceRef.current.setView(mine.center, mine.zoom, { animate: true });
    } catch (err) {
      console.error('Reset satellite view notice:', err);
    }
  };

  // ── REAL DEVICE LOCATION ────────────────────────────────────────────────────
  // Priority 1: NEO-6M USB sensor (when connected and fix available)
  // Priority 2: Browser Geolocation API (GPS / WiFi / cell triangulation)
  useEffect(() => {
    // If NEO-6M is connected and has a real fix, prefer it
    if (
      telemetry?.connected &&
      telemetry?.neo6mGps?.latitude &&
      telemetry?.neo6mGps?.longitude &&
      telemetry?.neo6mGps?.fixQuality !== 'No Fix'
    ) {
      setDeviceGps({
        lat: telemetry.neo6mGps.latitude,
        lng: telemetry.neo6mGps.longitude,
        accuracy: telemetry.neo6mGps.hdop * 5, // HDOP → approximate metres
        heading: telemetry.neo6mGps.headingDeg,
        speed: telemetry.neo6mGps.speedKmh,
        source: 'neo6m',
      });
      setGeoError(null);
      return; // NEO-6M is providing data — don't also start browser geolocation
    }

    // Fallback: use browser Geolocation API (works on phone / laptop GPS)
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by this browser.');
      return;
    }

    setGeoError(null);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDeviceGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed !== null ? pos.coords.speed * 3.6 : null, // m/s → km/h
          source: 'browser',
        });
        setGeoError(null);
      },
      (err) => {
        setGeoError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [
    telemetry?.connected,
    telemetry?.neo6mGps?.latitude,
    telemetry?.neo6mGps?.longitude,
    telemetry?.neo6mGps?.fixQuality,
  ]);

  // Render / update the device GPS puck on the Leaflet map
  useEffect(() => {
    if (displayMode !== 'satellite') return;
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!deviceGps) return;

    try {
      const heading = deviceGps.heading ?? 0;
      const speedTxt = deviceGps.speed !== null ? `${deviceGps.speed.toFixed(0)} km/h` : '-- km/h';
      const srcColor = deviceGps.source === 'neo6m' ? '#22d3ee' : '#a78bfa';
      const srcLabel = deviceGps.source === 'neo6m' ? 'NEO-6M' : 'GPS';

      const iconHtml = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:default;">
          <!-- Floating label -->
          <div style="position:absolute;top:-28px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:2px 7px;background:rgba(9,9,11,0.97);border:1.5px solid ${srcColor};border-radius:12px;font-family:ui-monospace,monospace;font-size:10px;font-weight:800;color:#ffffff;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,0.9);z-index:10;">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${srcColor};animation:ping 1s infinite;"></span>
            <span>MTC DEVICE</span>
            <span style="color:${srcColor};">${speedTxt}</span>
          </div>
          <!-- Accuracy ring pulse -->
          <div style="position:absolute;width:48px;height:48px;border-radius:50%;background:${srcColor}22;border:1.5px solid ${srcColor}66;animation:ping 1.5s ease-in-out infinite;"></div>
          <!-- Puck body rotating with heading -->
          <div style="transform:rotate(${heading}deg);position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;">
            <!-- Heading arrow -->
            <div style="position:absolute;top:-10px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid ${srcColor};filter:drop-shadow(0 -1px 3px rgba(0,0,0,0.8));"></div>
            <!-- Circle puck -->
            <div style="width:34px;height:34px;border-radius:50%;background:#0c0c14;border:2.5px solid ${srcColor};box-shadow:0 0 14px ${srcColor}99,0 3px 10px rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${srcColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
                <path d="M15 18H9"/>
                <path d="M19 18h2a1 1 0 0 0 1-1v-5l-4-4h-3v10"/>
                <circle cx="7" cy="18" r="2" fill="${srcColor}"/>
                <circle cx="17" cy="18" r="2" fill="${srcColor}"/>
              </svg>
            </div>
          </div>
          <!-- Source badge -->
          <div style="margin-top:2px;padding:1px 5px;background:rgba(0,0,0,0.85);border:1px solid ${srcColor}55;border-radius:4px;font-family:monospace;font-size:8px;font-weight:700;color:${srcColor};white-space:nowrap;">${srcLabel} LIVE</div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'leaflet-device-puck',
        html: iconHtml,
        iconSize: [48, 60],
        iconAnchor: [24, 38],
      });

      if (deviceMarkerRef.current) {
        deviceMarkerRef.current.setLatLng([deviceGps.lat, deviceGps.lng]);
        deviceMarkerRef.current.setIcon(icon);
      } else {
        deviceMarkerRef.current = L.marker([deviceGps.lat, deviceGps.lng], { icon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(
            `<b style="font-family:monospace;color:#7c3aed;">MTC DEVICE — THIS UNIT</b><br/>` +
            `<span style="font-family:monospace;font-size:11px;color:#333;">` +
            `Lat: ${deviceGps.lat.toFixed(6)}°N<br/>` +
            `Lng: ${deviceGps.lng.toFixed(6)}°E<br/>` +
            `Accuracy: ±${deviceGps.accuracy.toFixed(0)} m<br/>` +
            `Source: ${deviceGps.source === 'neo6m' ? 'NEO-6M USB Sensor' : 'Browser Geolocation API'}` +
            `</span>`
          );
      }

      // Accuracy radius circle
      if (deviceAccuracyCircleRef.current) {
        deviceAccuracyCircleRef.current.setLatLng([deviceGps.lat, deviceGps.lng]);
        deviceAccuracyCircleRef.current.setRadius(deviceGps.accuracy);
      } else {
        deviceAccuracyCircleRef.current = L.circle([deviceGps.lat, deviceGps.lng], {
          radius: deviceGps.accuracy,
          color: srcColor,
          fillColor: srcColor,
          fillOpacity: 0.06,
          weight: 1,
          dashArray: '4, 4',
        }).addTo(map);
      }

      // Auto-pan to device if followGps is on
      if (followGps) {
        map.panTo([deviceGps.lat, deviceGps.lng], { animate: true });
      }
    } catch (err) {
      console.error('Device GPS marker update error:', err);
    }
  }, [deviceGps, displayMode, followGps]);

  // Clean up device marker on unmount (handled in existing cleanup useEffect above)

  return (
    <div className="flex flex-col w-full text-[#E0E0E0] select-none pb-3 font-sans">
      {/* Radio Transmission Toast Notification */}
      {radioNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-16 right-6 z-50 bg-[#0F0F10] border-2 border-blue-400 text-white px-5 py-3 shadow-2xl flex items-center gap-3 animate-bounce"
        >
          <Radio className="w-5 h-5 text-blue-400 animate-pulse" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="font-mono text-xs text-blue-300 font-bold uppercase tracking-widest">
              {radioNotice.channel}
            </span>
            <span className="font-mono text-sm font-bold text-white">{radioNotice.message}</span>
          </div>
        </div>
      )}

      {/* Primary Docked / Collapsible Workspace Layout with Full Map Behind */}
      <div className="flex flex-col lg:flex-row gap-2.5 w-full items-stretch relative">
        {/* ==================== LEFT COLLAPSED HANDLE ==================== */}
        {isLeftCollapsed && (
          <div className="shrink-0 flex lg:flex-col items-center">
            <button
              type="button"
              onClick={() => setIsLeftCollapsed(false)}
              className="hidden lg:flex items-center gap-2 py-4 px-2 bg-[#0A0A0D] hover:bg-[#14141c] border border-[#333338] hover:border-cyan-400 text-cyan-300 font-mono text-xs font-bold [writing-mode:vertical-lr] rotate-180 cursor-pointer shadow-lg rounded-r transition-all"
              title="Expand Left Sensors & Safety Panel"
            >
              <ChevronsRight className="w-3.5 h-3.5 rotate-90 text-cyan-400" />
              <span>SENSORS &amp; SAFETY</span>
            </button>
            <button
              type="button"
              onClick={() => setIsLeftCollapsed(false)}
              className="lg:hidden w-full py-2 px-3 bg-[#0A0A0D] border border-[#333338] text-cyan-300 font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <ChevronsRight className="w-3.5 h-3.5 text-cyan-400" />
              <span>SHOW SENSORS &amp; SAFETY PANEL</span>
            </button>
          </div>
        )}

        {/* ==================== LEFT EXPANDED PANEL ==================== */}
        {!isLeftCollapsed && (
          <div className="w-full lg:w-[320px] xl:w-[340px] shrink-0 flex flex-col gap-2 transition-all">
            {/* Tab Bar Header with Collapse Button */}
            <div className="bg-[#0A0A0B] border border-[#333338] p-1.5 flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setLeftTab('esp32wifi')}
                  className={`px-2 py-1 text-[10.5px] font-bold border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    leftTab === 'esp32wifi'
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-400 shadow-xs'
                      : 'bg-black text-slate-400 border-[#2a2a30] hover:text-white'
                  }`}
                  title="View real-time ESP32 Wi-Fi telemetry (Smoke, DHT, Distance)"
                >
                  <Wifi className={`w-3 h-3 ${telemetry?.esp32Wifi?.connected ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
                  <span>ESP32 WI-FI</span>
                  {telemetry?.esp32Wifi?.connected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab('hardware')}
                  className={`px-2 py-1 text-[10.5px] font-bold border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    leftTab === 'hardware'
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-xs'
                      : 'bg-black text-slate-400 border-[#2a2a30] hover:text-white'
                  }`}
                >
                  <Cpu className="w-3 h-3 text-cyan-400" />
                  <span>SENSORS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab('interlock')}
                  className={`px-2 py-1 text-[10.5px] font-bold border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    leftTab === 'interlock'
                      ? 'bg-red-950 text-red-300 border-red-500 shadow-xs'
                      : 'bg-black text-slate-400 border-[#2a2a30] hover:text-white'
                  }`}
                >
                  <Shield className="w-3 h-3 text-red-400" />
                  <span>SAFETY &amp; LAYERS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab('all')}
                  className={`px-1.5 py-1 text-[10px] font-bold border transition-colors cursor-pointer ${
                    leftTab === 'all'
                      ? 'bg-slate-700 text-white border-slate-400'
                      : 'bg-black text-slate-500 border-[#2a2a30] hover:text-white'
                  }`}
                  title="Show both sensors and safety layers stacked"
                >
                  ALL
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsLeftCollapsed(true)}
                className="p-1 text-slate-400 hover:text-white hover:bg-[#1b1b22] border border-[#333338] ml-1 cursor-pointer transition-colors"
                title="Collapse Left Panel"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* CARD 0: DEDICATED SPECIAL PLACE FOR ESP32 WI-FI METRICS (SMOKE, DHT, DISTANCE) */}
            {(leftTab === 'esp32wifi' || leftTab === 'all') && (
              <div className="bg-[#090C12] border-2 border-cyan-500/70 flex flex-col overflow-hidden shadow-lg">
                <div className="px-3.5 py-2 bg-[#0c121e] border-b border-cyan-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <div>
                      <span className="font-mono font-bold text-xs text-white uppercase tracking-wider block">
                        ESP32 Wi-Fi Sensor Pod
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {telemetry?.esp32Wifi?.ipAddress || '192.168.4.1'} &bull; {telemetry?.esp32Wifi?.mode || 'HTTP_POLL'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 border font-bold flex items-center gap-1 ${
                        telemetry?.esp32Wifi?.connected
                          ? 'bg-green-950 text-green-300 border-green-500 animate-pulse'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${telemetry?.esp32Wifi?.connected ? 'bg-green-400' : 'bg-slate-500'}`} />
                      <span>{telemetry?.esp32Wifi?.connected ? 'ONLINE' : 'STANDBY'}</span>
                    </span>
                    {onOpenEsp32WifiModal && (
                      <button
                        type="button"
                        onClick={onOpenEsp32WifiModal}
                        className="px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-500 font-mono text-[10px] font-bold cursor-pointer transition-colors"
                        title="Configure ESP32 Wi-Fi IP and parameters"
                      >
                        CONFIG
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-2.5 flex flex-col gap-2 font-mono text-xs">
                  {/* DUAL COMPARISON BANNER: GOOGLE REGIONAL WEATHER vs ESP32 GROUND SENSORS */}
                  {weather && (
                    <div className="bg-black/90 p-2 border border-[#1b2636] flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px] border-b border-[#18202d] pb-1">
                        <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
                          <Globe className="w-3 h-3 text-blue-400" />
                          <span>GOOGLE WEATHER vs ESP32 GROUND</span>
                        </span>
                        <span className="text-cyan-300 font-bold">DUAL SYNC</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-0.5">
                        <div className="flex justify-between bg-[#0b0e14] p-1.5 border border-[#141b26]">
                          <span className="text-slate-400">Temp:</span>
                          <span>
                            <strong className="text-white">{weather.temperatureC.toFixed(1)}°C</strong>
                            <span className="text-slate-500 mx-0.5">vs</span>
                            <strong className="text-cyan-300">
                              {(telemetry?.esp32Wifi?.dht.temperatureC ?? telemetry?.dht22.temperatureC ?? 24.2).toFixed(1)}°C
                            </strong>
                          </span>
                        </div>
                        <div className="flex justify-between bg-[#0b0e14] p-1.5 border border-[#141b26]">
                          <span className="text-slate-400">Hum:</span>
                          <span>
                            <strong className="text-white">{weather.relativeHumidity}%</strong>
                            <span className="text-slate-500 mx-0.5">vs</span>
                            <strong className="text-blue-300">
                              {telemetry?.esp32Wifi?.dht.humidityPercent ?? telemetry?.dht22.humidityPercent ?? 78}%
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SENSOR 1: SMOKE / AIR QUALITY */}
                  <div className="p-2 bg-black border border-amber-500/40 flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-amber-400 flex items-center gap-1 uppercase">
                        <Wind className="w-3 h-3" />
                        <span>SMOKE / GAS (MQ-135 / MQ-2)</span>
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 border ${
                          (telemetry?.esp32Wifi?.smoke.status ?? telemetry?.mq135.airQualityStatus) === 'Hazardous'
                            ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                            : (telemetry?.esp32Wifi?.smoke.status ?? telemetry?.mq135.airQualityStatus) === 'Poor'
                            ? 'bg-yellow-950 text-yellow-300 border-yellow-500'
                            : 'bg-green-950 text-green-300 border-green-500'
                        }`}
                      >
                        {telemetry?.esp32Wifi?.smoke.status ?? telemetry?.mq135.airQualityStatus ?? 'Clean'}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-white font-bold text-lg">
                          {telemetry?.esp32Wifi?.smoke.adc ?? telemetry?.mq135.rawAdc ?? 412}
                        </span>
                        <span className="text-[10px] text-slate-400">/ 4095 ADC</span>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-300 font-bold text-sm">
                          {telemetry?.esp32Wifi?.smoke.ppm ?? telemetry?.mq135.ppm ?? 395} PPM
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-[#18181c] h-1.5 border border-[#333338] overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            ((telemetry?.esp32Wifi?.smoke.adc ?? telemetry?.mq135.rawAdc ?? 412) / 2000) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Fumes Sensor:</span>
                      <span
                        className={
                          telemetry?.esp32Wifi?.smoke.smokeDetected || telemetry?.mq135.smokeDetected
                            ? 'text-red-400 font-bold animate-pulse'
                            : 'text-green-400 font-semibold'
                        }
                      >
                        {telemetry?.esp32Wifi?.smoke.smokeDetected || telemetry?.mq135.smokeDetected
                          ? '⚠ FUMES DETECTED'
                          : 'AIR NOMINAL'}
                      </span>
                    </div>
                  </div>

                  {/* SENSOR 2: DHT22 (TEMPERATURE & HUMIDITY) */}
                  <div className="p-2 bg-black border border-cyan-500/40 flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-cyan-400 flex items-center gap-1 uppercase">
                        <Thermometer className="w-3 h-3" />
                        <span>DHT22 MICROCLIMATE</span>
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold">PIN 4</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <div className="bg-[#0c1017] p-1.5 border border-[#162130]">
                        <span className="text-[10px] text-slate-400 block">TEMP</span>
                        <span className="text-base font-bold text-white block mt-0.5">
                          {(telemetry?.esp32Wifi?.dht.temperatureC ?? telemetry?.dht22.temperatureC ?? 24.2).toFixed(1)}°C
                        </span>
                        <span className="text-[9px] text-orange-400 block">
                          Heat: {telemetry?.esp32Wifi?.dht.heatIndexC ?? telemetry?.dht22.heatIndexC ?? 25.1}°C
                        </span>
                      </div>
                      <div className="bg-[#0c1017] p-1.5 border border-[#162130]">
                        <span className="text-[10px] text-slate-400 block">HUMIDITY</span>
                        <span className="text-base font-bold text-cyan-300 block mt-0.5">
                          {telemetry?.esp32Wifi?.dht.humidityPercent ?? telemetry?.dht22.humidityPercent ?? 78}%
                        </span>
                        <span className="text-[9px] text-blue-400 block">
                          Dew: {telemetry?.esp32Wifi?.dht.dewPointC ?? telemetry?.dht22.dewPointC ?? 20.3}°C
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SENSOR 3: DISTANCE / PROXIMITY */}
                  <div className="p-2 bg-black border border-yellow-500/40 flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-yellow-400 flex items-center gap-1 uppercase">
                        <Eye className="w-3 h-3" />
                        <span>DISTANCE / PROXIMITY</span>
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 border ${
                          (telemetry?.esp32Wifi?.distance.alert ?? telemetry?.lidar8m.obstacleAlert) === 'COLLISION_CRITICAL'
                            ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                            : (telemetry?.esp32Wifi?.distance.alert ?? telemetry?.lidar8m.obstacleAlert) === 'PROXIMITY_WARNING'
                            ? 'bg-yellow-950 text-yellow-300 border-yellow-500'
                            : 'bg-green-950 text-green-300 border-green-500'
                        }`}
                      >
                        {telemetry?.esp32Wifi?.distance.alert ?? telemetry?.lidar8m.obstacleAlert ?? 'CLEAR'}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <div className="flex items-baseline gap-1">
                        <span className="text-white font-bold text-lg">
                          {(telemetry?.esp32Wifi?.distance.distanceMeters ?? telemetry?.lidar8m.distanceMeters ?? 5.42).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">METERS</span>
                      </div>
                      <span className="text-yellow-300 font-bold text-xs">
                        {telemetry?.esp32Wifi?.distance.distanceCm ?? Math.round((telemetry?.lidar8m.distanceMeters ?? 5.42) * 100)} CM
                      </span>
                    </div>
                    <div className="w-full bg-[#18181c] h-1.5 border border-[#333338] overflow-hidden relative">
                      <div className="absolute top-0 bottom-0 left-[25%] w-0.5 bg-red-500" />
                      <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-yellow-500" />
                      <div
                        className="h-full bg-yellow-500 transition-all duration-200"
                        style={{
                          width: `${Math.min(
                            100,
                            ((telemetry?.esp32Wifi?.distance.distanceMeters ?? telemetry?.lidar8m.distanceMeters ?? 5.4) / 8.0) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Actions & Diagnostics Bar */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#18202d] text-[10px]">
                    <span className="text-slate-400">
                      Packets: <strong className="text-cyan-300">{telemetry?.esp32Wifi?.packetsCount || 0}</strong> &bull; Latency: <strong className="text-yellow-300">{telemetry?.esp32Wifi?.lastPingMs || 0}ms</strong>
                    </span>
                    {onSimulateEsp32WifiPacket && (
                      <button
                        type="button"
                        onClick={onSimulateEsp32WifiPacket}
                        className="text-cyan-300 hover:text-white underline cursor-pointer font-bold"
                      >
                        SIMULATE PACKET
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CARD 1: REAL-TIME HARDWARE SENSOR TELEMETRY */}
            {(leftTab === 'hardware' || leftTab === 'all') && (
              <div className="bg-[#0A0A0B] border border-[#333338] flex flex-col overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span className="font-mono font-bold text-xs text-cyan-300 uppercase tracking-wider">
                  Real Hardware Stream
                </span>
              </div>
              <span
                className={`font-mono text-xs px-2 py-0.5 border font-bold ${
                  telemetry?.connected
                    ? 'bg-green-950 text-green-300 border-green-500 animate-pulse'
                    : 'bg-black text-slate-400 border-slate-700'
                }`}
              >
                {telemetry?.connected ? `${telemetry.connectionSource}` : 'SENSORS STANDBY (USB)'}
              </span>
            </div>

            <div className="p-2.5 flex flex-col gap-2 font-mono text-xs">
              {/* Sensor Quick Row 1: LIDAR 8M & MPU-6050 */}
              <div className="grid grid-cols-2 gap-1.5">
                {/* LIDAR 8M */}
                <div className={`p-2 bg-black border flex flex-col gap-0.5 ${
                  (telemetry?.lidar8m.distanceMeters ?? 5.4) <= 2.0
                    ? 'border-red-500 bg-red-950/40'
                    : (telemetry?.lidar8m.distanceMeters ?? 5.4) <= 4.0
                    ? 'border-yellow-500 bg-yellow-950/20'
                    : 'border-[#2a2a30]'
                }`}>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span className="font-bold uppercase">LIDAR 8M</span>
                    <Eye className="w-3 h-3 text-yellow-400" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white font-bold text-base">
                      {telemetry?.lidar8m.distanceMeters.toFixed(2) ?? '5.42'}
                    </span>
                    <span className="text-[10px] text-slate-400">METERS</span>
                  </div>
                  <span className={`text-[9px] font-bold ${
                    (telemetry?.lidar8m.distanceMeters ?? 5.4) <= 2.0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {(telemetry?.lidar8m.distanceMeters ?? 5.4) <= 2.0 ? 'COLLISION HAZARD' : 'CLEAR PATH'}
                  </span>
                </div>

                {/* MPU-6050 Incline */}
                <div className="p-2 bg-black border border-[#2a2a30] flex flex-col gap-0.5">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span className="font-bold uppercase">MPU-6050</span>
                    <Activity className="w-3 h-3 text-purple-400" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white font-bold text-base">
                      {telemetry?.mpu6050.inclineGradePercent.toFixed(1) ?? '10.9'}%
                    </span>
                    <span className="text-[10px] text-slate-400">GRADE</span>
                  </div>
                  <span className="text-[9px] text-purple-300 font-semibold">
                    PITCH: {telemetry?.mpu6050.pitchDeg.toFixed(1) ?? '6.2'}° &bull; ROLL: {telemetry?.mpu6050.rollDeg.toFixed(1) ?? '1.4'}°
                  </span>
                </div>
              </div>

              {/* Sensor Quick Row 2: MQ-135 & DHT22 */}
              <div className="grid grid-cols-2 gap-1.5">
                {/* MQ-135 Air */}
                <div className="p-2 bg-black border border-[#2a2a30] flex flex-col gap-0.5">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span className="font-bold uppercase">MQ-135 AIR</span>
                    <Wind className="w-3 h-3 text-cyan-400" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-white font-bold text-base">
                        {telemetry?.mq135.ppm ?? 395}
                      </span>
                      <span className="text-[10px] text-slate-400">PPM</span>
                    </div>
                    <span className="text-[10px] text-amber-300 font-semibold">
                      {telemetry?.mq135.rawAdc ?? telemetry?.checkpointStation?.mq135Adc ?? 412} ADC
                    </span>
                  </div>
                  <span className={`text-[9px] font-bold ${
                    (telemetry?.mq135.ppm ?? 395) > 700 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {telemetry?.mq135.airQualityStatus ?? 'Clean'}
                  </span>
                </div>

                {/* DHT22 Temp / Humidity */}
                <div className="p-2 bg-black border border-[#2a2a30] flex flex-col gap-0.5">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span className="font-bold uppercase">DHT22 METER</span>
                    <Thermometer className="w-3 h-3 text-orange-400" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white font-bold text-base">
                      {telemetry?.dht22.temperatureC.toFixed(1) ?? '24.2'}°C
                    </span>
                    <span className="text-[10px] text-cyan-400 font-bold">{telemetry?.dht22.humidityPercent ?? 78}% RH</span>
                  </div>
                  <span className="text-[9px] text-slate-400">
                    Feels {telemetry?.dht22.heatIndexC ?? 25}°C
                  </span>
                </div>
              </div>

              {/* Stationary Checkpoint ESP32 & NRF24L01 IoT Node */}
              <div className="p-2 bg-[#090E18] border border-cyan-500/50 flex flex-col gap-1 rounded-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-cyan-300 flex items-center gap-1">
                    <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                    <span>STATIONARY CHECKPOINT ESP32 (CP-01)</span>
                  </span>
                  <span className="px-1 py-0.2 bg-blue-950 text-blue-300 border border-blue-600 font-bold rounded-xs">
                    NODE1
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-300">
                  <span>NRF24: <strong className={telemetry?.checkpointStation?.nrfStatus === 'DATA SENT' ? 'text-green-400' : 'text-slate-300'}>{telemetry?.checkpointStation?.nrfStatus || 'DATA SENT'}</strong></span>
                  <span>ADC: <strong className="text-white">{telemetry?.mq135.rawAdc ?? telemetry?.checkpointStation?.mq135Adc ?? 412}</strong></span>
                  <span className="text-cyan-300 font-bold">{telemetry?.dht22.temperatureC.toFixed(1) ?? '24.2'}°C &bull; {telemetry?.dht22.humidityPercent ?? 78}%</span>
                </div>
              </div>

              {/* NEO-6M GPS & Mini Vibration Motors Bar */}
              <div className="p-2 bg-black border border-[#2a2a30] flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-slate-300">
                    NEO-6M:{' '}
                    {telemetry?.connected && telemetry?.neo6mGps.fixQuality !== 'No Fix' ? (
                      <>
                        <strong className="text-white">{telemetry.neo6mGps.satellites} Sats</strong> &bull;{' '}
                        <strong className="text-yellow-300">{telemetry.neo6mGps.speedKmh.toFixed(0)} km/h</strong>
                      </>
                    ) : deviceGps?.source === 'browser' ? (
                      <span className="text-purple-300 font-semibold">Device GPS (±{deviceGps.accuracy.toFixed(0)}m)</span>
                    ) : (
                      <span className="text-slate-500 font-semibold">Sensor Standby</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Vibrate className={`w-3.5 h-3.5 ${
                    telemetry?.vibrationMotors.motor1Active ? 'text-red-400 animate-spin' : 'text-slate-500'
                  }`} />
                  <span className={`text-[10px] font-bold ${
                    telemetry?.vibrationMotors.motor1Active ? 'text-red-300' : 'text-slate-400'
                  }`}>
                    {telemetry?.vibrationMotors.motor1Active ? 'HAPTIC ON' : 'HAPTIC IDLE'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CARD 2: ACTIVE COLLISION & MTC INTERLOCK and CARD 3: CAMERA & LAYER CONTROLS */}
        {(leftTab === 'interlock' || leftTab === 'all') && (
          <>
            <div className="bg-[#0A0A0B] border border-[#333338] flex flex-col overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-400" />
                <span className="font-mono font-bold text-xs text-red-300 uppercase tracking-wider">
                  MTC Collision Interlock
                </span>
              </div>
              {activeConflict && activeConflict.active ? (
                <span className="font-mono text-xs bg-red-950 text-red-200 px-2 py-0.5 border border-red-500 font-bold animate-pulse">
                  CRITICAL PROXIMITY
                </span>
              ) : (
                <span className="font-mono text-xs bg-green-950 text-green-300 px-2 py-0.5 border border-green-500 font-bold">
                  HAUL ROAD CLEAR
                </span>
              )}
            </div>

            <div className="p-3 flex flex-col gap-2">
              {activeConflict && activeConflict.active ? (
                <div className="bg-red-950/30 border border-red-500 p-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-red-300 font-bold">
                      CONVERGENCE: {activeConflict.vehicleAId} ↔ {activeConflict.vehicleBId}
                    </span>
                    <span className="text-white font-bold text-sm">{activeConflict.closingDistanceM}m</span>
                  </div>
                  <div className="text-xs font-mono text-slate-200 leading-normal font-medium">
                    {activeConflict.recommendedAction}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      disabled={!isDispatcher}
                      onClick={() => onHoldVehicle(activeConflict.mustHoldId)}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-mono text-xs font-bold py-2 px-2.5 cursor-pointer transition-colors"
                    >
                      COMMAND HOLD {activeConflict.mustHoldId}
                    </button>
                    <button
                      type="button"
                      disabled={!isDispatcher}
                      onClick={() => onClearVehicle(activeConflict.vehicleAId)}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono text-xs font-bold py-2 px-2.5 cursor-pointer transition-colors"
                    >
                      CLEAR {activeConflict.vehicleAId}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-black border border-[#2a2a30] p-2.5 flex items-center gap-2.5">
                  <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                  <span className="font-mono text-xs text-slate-200 leading-normal">
                    No immediate head-to-head convergence detected on single-lane segments. Dynamic stopping buffers nominal.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* CARD 3: CAMERA & LAYER CONTROLS */}
          <div className="bg-[#0A0A0B] border border-[#333338] p-3 flex flex-col gap-2.5 font-mono text-xs">
            <span className="text-xs text-slate-300 font-bold uppercase">CAMERA PRESET &amp; LAYERS</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['overview', 'hairpin3', 'crusher'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setViewPreset(preset)}
                  className={`py-1.5 text-xs font-bold uppercase border cursor-pointer transition-colors ${
                    viewPreset === preset
                      ? 'bg-blue-600 text-white border-blue-400 shadow-xs'
                      : 'bg-black text-slate-300 border-[#333338] hover:text-white'
                  }`}
                >
                  {preset === 'overview' ? 'OVERVIEW' : preset === 'hairpin3' ? 'HAIRPIN 3' : 'CRUSHER'}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5 mt-1 text-xs text-slate-200">
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={showBenchLines}
                  onChange={(e) => setShowBenchLines(e.target.checked)}
                  className="w-3.5 h-3.5 cursor-pointer"
                />
                <span>Elevation Contours (RL 1040-1280M)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={showPassingBays}
                  onChange={(e) => setShowPassingBays(e.target.checked)}
                  className="w-3.5 h-3.5 cursor-pointer"
                />
                <span>Passing Bays Alpha &amp; Beta</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={showCheckpoints}
                  onChange={(e) => setShowCheckpoints(e.target.checked)}
                  className="w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-cyan-300 font-bold">Route Checkpoints (CP-01 to 06)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={showBrakingRings}
                  onChange={(e) => setShowBrakingRings(e.target.checked)}
                  className="cursor-pointer"
                />
                <span>Dynamic Stopping Envelopes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={showWeatherFx}
                  onChange={(e) => setShowWeatherFx(e.target.checked)}
                  className="cursor-pointer"
                />
                <span>Monsoon Mist &amp; Weather FX</span>
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  )}

  {/* ==================== CENTER COLUMN (Expanding Map) ==================== */}
  <div className="flex-1 min-w-0 flex flex-col gap-2 transition-all">
    {/* DISPLAY CANVAS CONTAINER */}
          <div className="bg-[#050507] border border-[#333338] relative overflow-hidden flex flex-col">
            {/* Mine Site Selector Bar & Canvas Header */}
            <div className="bg-[#0F0F10] border-b border-[#333338] flex flex-col">
              {/* Top Mine Tabs */}
              <div className="px-3 py-1.5 bg-[#09090b] border-b border-[#27272a] flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-amber-400 uppercase tracking-wider hidden sm:inline">SECTOR / UNIT:</span>
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'DEVICE', name: '📍 MY FIELD UNIT', tag: deviceGps ? 'LIVE' : 'GPS' },
                    { id: '14A', name: 'SECTOR 14-A', tag: 'CG' },
                    { id: '14C', name: 'BAILADILA 14C', tag: 'CG' },
                    { id: 'DEP5', name: 'DEPOSIT-5 BACHELI', tag: 'CG' },
                    { id: 'DONI', name: 'DONIMALAI', tag: 'KA' },
                  ].map((mine) => (
                    <button
                      key={mine.id}
                      type="button"
                      onClick={() => {
                        setActiveMine(mine.id as any);
                        if (mine.id === 'DEVICE' && deviceGps) {
                          mapInstanceRef.current?.flyTo([deviceGps.lat, deviceGps.lng], 16, { duration: 1.0 });
                        }
                      }}
                      className={`px-2.5 py-1 text-[11px] font-mono font-bold border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        activeMine === mine.id
                          ? mine.id === 'DEVICE'
                            ? 'bg-purple-700 text-white border-purple-400 shadow-sm'
                            : 'bg-amber-600 text-white border-amber-400 shadow-sm'
                          : 'bg-[#141418] text-slate-300 border-[#2e2e36] hover:text-white hover:border-slate-500'
                      }`}
                    >
                      <span>{mine.name}</span>
                      <span className={`text-[9px] px-1 py-0.2 rounded-xs ${
                        activeMine === mine.id
                          ? 'bg-black/40 text-white font-bold'
                          : 'bg-black/60 text-slate-400'
                      }`}>
                        {mine.tag}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-header with Mine Info & Display Mode Selector */}
              <div className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-ping" />
                  <div className="flex flex-col">
                    <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                      {currentMineInfo.name} // {currentMineInfo.location}, {currentMineInfo.state}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {currentMineInfo.subName} &bull; {currentMineInfo.elevationRange} &bull; GRADE: {currentMineInfo.grade}
                    </span>
                  </div>
                </div>

                {/* Google Maps Layer Type & Mode Selector */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Google Maps Layer Type Switcher */}
                  {displayMode === 'satellite' && (
                    <div className="flex items-center gap-0.5 bg-black p-0.5 border border-[#333338] rounded-xs font-mono text-[10px]">
                      {(['hybrid', 'satellite', 'terrain', 'roadmap'] as const).map((gType) => (
                        <button
                          key={gType}
                          type="button"
                          onClick={() => setGoogleMapsType(gType)}
                          className={`px-2 py-0.5 font-bold uppercase transition-all cursor-pointer ${
                            googleMapsType === gType
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {gType}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Follow GPS Toggle */}
                  <button
                    type="button"
                    onClick={() => setFollowGps(!followGps)}
                    className={`flex items-center gap-1 px-2 py-1 font-mono text-[10px] font-bold border cursor-pointer transition-all ${
                      followGps
                        ? 'bg-green-950 text-green-300 border-green-500'
                        : 'bg-black text-slate-400 border-[#333338]'
                    }`}
                    title="Toggle auto-centering on NEO-6M GPS position"
                  >
                    <Navigation className={`w-3 h-3 ${followGps ? 'text-green-400 animate-pulse' : 'text-slate-500'}`} />
                    <span>{followGps ? 'GPS TRACK ON' : 'GPS TRACK OFF'}</span>
                  </button>

                  {/* Visualization Mode Selector */}
                  <div className="flex items-center gap-1 bg-black p-0.5 border border-[#333338] rounded-xs font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => setDisplayMode('satellite')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 font-bold transition-all cursor-pointer ${
                        displayMode === 'satellite'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Google Maps (Hybrid / Satellite / Terrain)"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>GOOGLE MAPS</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDisplayMode('radar')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 font-bold transition-all cursor-pointer ${
                        displayMode === 'radar'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Tactical CAD Wireframe Radar"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>RADAR CAD</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Viewport Area */}
            <div className="relative isolate z-0 w-full h-[75vh] min-h-[520px] bg-[#050507] overflow-hidden">
              {/* ========================================================================= */}
              {/* GOOGLE MAPS HYBRID SATELLITE VIEW (LEAFLET + GOOGLE MAPS) */}
              {/* ========================================================================= */}
              <div
                style={{ display: displayMode === 'satellite' ? 'block' : 'none' }}
                className="w-full h-full relative"
              >
                <div ref={mapContainerRef} className="w-full h-full bg-[#0a0a0b]" />

                {/* Google Maps HUD Overlay */}
                <div className="absolute top-2 left-2 z-[400] bg-black/90 border border-[#333338] px-3 py-2 flex flex-col gap-0.5 font-mono text-[11px] backdrop-blur-xs shadow-xl max-w-sm">
                  <div className="flex items-center gap-2 text-blue-400 font-bold">
                    <Globe className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>GOOGLE MAPS // {googleMapsType.toUpperCase()} // {currentMineInfo.name.toUpperCase()}</span>
                  </div>
                  <div className="text-slate-200 text-[10px]">
                    LOC: {currentMineInfo.location} &bull; {currentMineInfo.state} &bull; WGS84
                  </div>
                  <div className="text-amber-400 font-semibold text-[10px] flex items-center gap-1">
                    <span>GPS FIX:</span>
                    <span className="text-white font-mono">
                      {telemetry?.connected && telemetry?.neo6mGps?.fixQuality !== 'No Fix'
                        ? `${telemetry.neo6mGps.latitude.toFixed(5)}°N, ${telemetry.neo6mGps.longitude.toFixed(5)}°E`
                        : deviceGps
                        ? `${deviceGps.lat.toFixed(5)}°N, ${deviceGps.lng.toFixed(5)}°E`
                        : `${currentMineInfo.center[0].toFixed(3)}°N, ${currentMineInfo.center[1].toFixed(3)}°E`}
                    </span>
                    <span className="text-cyan-300 ml-1">
                      ({telemetry?.connected && telemetry?.neo6mGps?.fixQuality !== 'No Fix'
                        ? `${telemetry.neo6mGps.satellites} Sats`
                        : deviceGps
                        ? 'Live GPS'
                        : 'Mine Center'})
                    </span>
                  </div>
                  {/* Device GPS Status */}
                  <div className={`text-[10px] flex items-center gap-1.5 pt-0.5 border-t border-[#2a2a30] mt-0.5 ${deviceGps ? 'text-green-300' : geoError ? 'text-red-400' : 'text-slate-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${deviceGps ? 'bg-green-400 animate-ping' : geoError ? 'bg-red-400' : 'bg-slate-600'}`} />
                    {deviceGps
                      ? <span><strong>MTC DEVICE:</strong> {deviceGps.lat.toFixed(5)}°N, {deviceGps.lng.toFixed(5)}°E &bull; ±{deviceGps.accuracy.toFixed(0)}m &bull; <span className={deviceGps.source === 'neo6m' ? 'text-cyan-300' : 'text-purple-300'}>{deviceGps.source === 'neo6m' ? 'NEO-6M USB' : 'Browser GPS'}</span></span>
                      : geoError
                      ? <span>GPS: {geoError}</span>
                      : <span>Requesting GPS permission...</span>
                    }
                  </div>
                </div>

                {/* Reset Satellite Center Button */}
                <button
                  type="button"
                  onClick={handleResetSatelliteView}
                  className="absolute bottom-3 right-3 z-[400] bg-black/90 hover:bg-[#16161a] border border-[#44444c] text-white px-2.5 py-1.5 flex items-center gap-1.5 font-mono text-xs font-bold cursor-pointer transition-colors shadow-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                  <span>{activeMine === 'DEVICE' ? 'CENTER MY UNIT' : `CENTER ${activeMine}`}</span>
                </button>
              </div>

              {/* ========================================================================= */}
              {/* TACTICAL RADAR CAD VIEW (SVG) */}
              {/* ========================================================================= */}
              <div
                style={{ display: displayMode === 'radar' ? 'block' : 'none' }}
                className="w-full h-full relative"
              >
                <svg
                  viewBox={getViewBox()}
                  className="w-full h-full cursor-crosshair"
                  role="img"
                  aria-label="NMDC Bailadila Haul Dispatch Tactical CAD Radar"
                >
                  <defs>
                    {/* Radar Grid Pattern */}
                    <pattern id="radarGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1c2333" strokeWidth="0.6" />
                    </pattern>

                    {/* Hazard Pulse Glow */}
                    <filter id="hazardGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
                      <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Tactical CAD Wireframe Background */}
                  <rect x="0" y="0" width="800" height="600" fill="#07090e" />
                  <rect x="0" y="0" width="800" height="600" fill="url(#radarGrid)" />

                  {/* Elevation Contour Lines */}
                  {showBenchLines && (
                    <g opacity={0.65} stroke="#475569" strokeWidth={1} fill="none" strokeDasharray="4,4">
                      {/* Pit Floor Bench */}
                      <ellipse cx="120" cy="520" rx="90" ry="50" />
                      <text x="125" y="555" fill="#cbd5e1" fontSize="10" fontWeight="bold" fontFamily="monospace">
                        RL 1,040M (PIT FLOOR &amp; SUMP)
                      </text>

                      {/* Bench 07 */}
                      <ellipse cx="260" cy="440" rx="140" ry="70" />
                      <text x="265" y="480" fill="#cbd5e1" fontSize="10" fontWeight="bold" fontFamily="monospace">
                        RL 1,120M (BENCH 07 HAUL RAMP)
                      </text>

                      {/* Hairpin 3 Switchback Ridge */}
                      <ellipse cx="440" cy="280" rx="180" ry="90" />
                      <text x="445" y="325" fill="#fca5a5" fontSize="10" fontWeight="bold" fontFamily="monospace">
                        RL 1,180M (HAIRPIN 3 BLIND APEX)
                      </text>

                      {/* Surface Rim */}
                      <ellipse cx="560" cy="80" rx="160" ry="70" />
                      <text x="565" y="115" fill="#93c5fd" fontSize="10" fontWeight="bold" fontFamily="monospace">
                        RL 1,280M (SURFACE CRUSHER RIM)
                      </text>
                    </g>
                  )}

                  {/* Passing Bays Alpha & Beta */}
                  {showPassingBays && (
                    <g>
                      {/* Bay Alpha near Hairpin 3 */}
                      <g>
                        <polygon
                          points={`${PASSING_BAY_ALPHA.x - 30},${PASSING_BAY_ALPHA.y - 18} ${PASSING_BAY_ALPHA.x + 30},${PASSING_BAY_ALPHA.y - 18} ${PASSING_BAY_ALPHA.x + 24},${PASSING_BAY_ALPHA.y + 16} ${PASSING_BAY_ALPHA.x - 24},${PASSING_BAY_ALPHA.y + 16}`}
                          fill="#0e1726"
                          stroke="#38bdf8"
                          strokeWidth="1.8"
                          strokeDasharray="4,4"
                        />
                        <text
                          x={PASSING_BAY_ALPHA.x}
                          y={PASSING_BAY_ALPHA.y + 26}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                          stroke="#0369a1"
                          strokeWidth="0.4"
                        >
                          BAY 07-B (ALPHA)
                        </text>
                      </g>

                      {/* Bay Beta near Bench 07 */}
                      <g>
                        <polygon
                          points={`${PASSING_BAY_BETA.x - 26},${PASSING_BAY_BETA.y - 18} ${PASSING_BAY_BETA.x + 26},${PASSING_BAY_BETA.y - 18} ${PASSING_BAY_BETA.x + 20},${PASSING_BAY_BETA.y + 16} ${PASSING_BAY_BETA.x - 20},${PASSING_BAY_BETA.y + 16}`}
                          fill="#0e1726"
                          stroke="#38bdf8"
                          strokeWidth="1.8"
                          strokeDasharray="4,4"
                        />
                        <text
                          x={PASSING_BAY_BETA.x}
                          y={PASSING_BAY_BETA.y + 26}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                          stroke="#0369a1"
                          strokeWidth="0.4"
                        >
                          BAY 04-A (BETA)
                        </text>
                      </g>
                    </g>
                  )}

                  {/* Tactical CAD Wireframe Haul Road */}
                  <g>
                    <path
                      d={trackPathData}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="20"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={trackPathData}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={trackPathData}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="2"
                      strokeDasharray="6,6"
                      strokeLinecap="round"
                    />
                    {/* Hairpin 3 Gradient Callout */}
                    <g transform="translate(405, 260)">
                      <circle r="14" fill="#1e1e24" stroke="#eab308" strokeWidth="1.5" strokeDasharray="4,3" />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fill="#fef08a"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        11%
                      </text>
                    </g>
                  </g>

                  {/* Haul Route Checkpoint Sensors (CAD Wireframe) */}
                  {showCheckpoints && (
                    <g>
                      {checkpointPassageData.map((cp) => (
                        <g key={cp.id} transform={`translate(${cp.x}, ${cp.y})`}>
                          {/* Outer sensor pulse */}
                          <circle r="12" fill="#0284c7" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3,3" />
                          <circle r="4.5" fill="#38bdf8" />
                          <g transform="translate(0, -18)">
                            <rect
                              x="-27"
                              y="-8"
                              width="54"
                              height="16"
                              rx="3"
                              fill="#09090b"
                              stroke="#0284c7"
                              strokeWidth="1.2"
                              opacity="0.95"
                            />
                            <text
                              textAnchor="middle"
                              y="3.5"
                              fill="#38bdf8"
                              fontSize="8.5"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {cp.code} ({cp.crossedCount})
                            </text>
                          </g>
                        </g>
                      ))}
                    </g>
                  )}

                  {/* Pit Floor Electric Rope Shovel 01 */}
                  <g transform="translate(120, 520)">
                    <circle r="16" fill="#14532d" stroke="#22c55e" strokeWidth="2" />
                    <text y="4" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
                      SHV-01
                    </text>
                  </g>

                  {/* Surface Primary Crusher 1 Hopper Deck */}
                  <g transform="translate(580, 50)">
                    <polygon points="-20,-16 20,-16 26,16 -26,16" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2" />
                    <text y="4" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
                      CRUSHER 1
                    </text>
                  </g>

                  {/* Active Conflict Closing Vector */}
                  {activeConflict && activeConflict.active && (() => {
                    const vA = vehicles.find((v) => v.id === activeConflict.vehicleAId);
                    const vB = vehicles.find((v) => v.id === activeConflict.vehicleBId);
                    if (!vA || !vB) return null;
                    const midX = (vA.x + vB.x) / 2;
                    const midY = (vA.y + vB.y) / 2;

                    return (
                      <g>
                        <line
                          x1={vA.x}
                          y1={vA.y}
                          x2={vB.x}
                          y2={vB.y}
                          stroke="#ef4444"
                          strokeWidth="2.5"
                          strokeDasharray="5,5"
                        />
                        <rect
                          x={midX - 42}
                          y={midY - 13}
                          width="84"
                          height="26"
                          fill="#000000"
                          stroke="#ef4444"
                          strokeWidth="1.5"
                          rx="3"
                        />
                        <text
                          x={midX}
                          y={midY + 4}
                          textAnchor="middle"
                          fill="#fca5a5"
                          fontSize="11"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {activeConflict.closingDistanceM}m UWB
                        </text>
                      </g>
                    );
                  })()}

                  {/* Heavy Haul Trucks in CAD Wireframe */}
                  {vehicles.map((v) => {
                    const isHazard = v.hazardEnvelope;
                    const isHeld = v.state === 'HELD_BY_MTC';
                    const markerColor = isHazard
                      ? '#ef4444'
                      : isHeld
                      ? '#eab308'
                      : v.payloadTons > 0
                      ? '#3b82f6'
                      : '#22c55e';

                    return (
                      <g
                        key={v.id}
                        onClick={() => onSelectVehicle(v)}
                        className="cursor-pointer group"
                        tabIndex={0}
                        role="button"
                        aria-label={`Inspect vehicle ${v.id}, speed ${v.speedKmh.toFixed(1)} km/h`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onSelectVehicle(v);
                          }
                        }}
                      >
                        {/* Dynamic Stopping Envelope */}
                        {showBrakingRings && (
                          <circle
                            cx={v.x}
                            cy={v.y}
                            r={Math.max(14, v.dStopMeters * 0.9)}
                            fill={isHazard ? 'rgba(239, 68, 68, 0.2)' : 'none'}
                            stroke={markerColor}
                            strokeWidth="1.5"
                            strokeDasharray={isHazard ? 'none' : '4,4'}
                            opacity={isHazard ? 0.9 : 0.5}
                            className={isHazard ? 'animate-pulse' : ''}
                          />
                        )}

                        {/* Google Maps Style Navigation Puck Marker */}
                        <g transform={`translate(${v.x}, ${v.y}) rotate(${v.headingDeg})`}>
                          {/* Directional Chevron Pointer */}
                          <polygon
                            points="0,-20 -6,-12 6,-12"
                            fill={markerColor}
                            stroke="#ffffff"
                            strokeWidth="1"
                          />
                          {/* Circular Base Navigation Puck */}
                          <circle
                            r="13"
                            fill={isHazard ? '#450a0a' : isHeld ? '#451a03' : v.payloadTons > 0 ? '#172554' : '#052e16'}
                            stroke={markerColor}
                            strokeWidth="2.5"
                          />
                          {/* Top-Down Truck Vector (Google Maps Vehicle Icon) */}
                          <g transform="translate(-7.5, -7.5) scale(0.65)">
                            <path
                              d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2 M15 18H9 M19 18h2a1 1 0 0 0 1-1v-5l-4-4h-3v10"
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="7" cy="18" r="2.5" fill={markerColor} />
                            <circle cx="17" cy="18" r="2.5" fill={markerColor} />
                          </g>
                        </g>

                        {/* Google Maps Floating Pill Tag */}
                        <g transform={`translate(${v.x}, ${v.y - 28})`}>
                          <rect
                            x="-28"
                            y="-9"
                            width="56"
                            height="18"
                            rx="9"
                            fill="#09090b"
                            stroke={markerColor}
                            strokeWidth="1.5"
                            opacity="0.95"
                          />
                          <circle cx="-19" cy="0" r="2.5" fill={markerColor} />
                          <text
                            x="4"
                            y="3.5"
                            textAnchor="middle"
                            fill={isHazard ? '#fca5a5' : '#ffffff'}
                            fontSize="9"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {v.id} {v.speedKmh > 0 ? `${v.speedKmh.toFixed(0)}k` : '0k'}
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  {/* Atmospheric Weather Overlay */}
                  {showWeatherFx && weather && (
                    <g pointerEvents="none">
                      {weather.visibilityMeters <= 100 && (
                        <g opacity="0.35">
                          <ellipse cx="280" cy="240" rx="140" ry="70" fill="#cbd5e1" filter="blur(16px)" />
                          <ellipse cx="480" cy="340" rx="180" ry="80" fill="#94a3b8" filter="blur(20px)" />
                          <ellipse cx="160" cy="460" rx="120" ry="60" fill="#e2e8f0" filter="blur(14px)" />
                        </g>
                      )}

                      {weather.rainMmHr > 0 && (
                        <g stroke="#93c5fd" strokeWidth="0.8" opacity="0.4" strokeDasharray="8,16">
                          <line x1="100" y1="0" x2="80" y2="600" />
                          <line x1="250" y1="0" x2="230" y2="600" />
                          <line x1="400" y1="0" x2="380" y2="600" />
                          <line x1="550" y1="0" x2="530" y2="600" />
                          <line x1="700" y1="0" x2="680" y2="600" />
                        </g>
                      )}
                    </g>
                  )}
                </svg>

                {/* Map Legend Overlay */}
                <div className="absolute bottom-2 left-2 bg-black/90 border border-[#333338] p-2.5 flex flex-col gap-1.5 font-mono text-xs text-slate-200 font-medium backdrop-blur-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>LOADED UPHILL (RIGHT OF WAY)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    <span>EMPTY DOWNHILL (YIELDS TO BAY)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span>HELD IN PASSING BAY</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                    <span className="text-red-300 font-bold">CRITICAL CLOSING CONFLICT</span>
                  </div>
                </div>

                {/* Weather Indicator in Canvas */}
                {weather && (
                  <div className="absolute top-2 right-2 bg-black/85 border border-[#333338] px-2.5 py-1.5 flex items-center gap-2 font-mono text-[11px] backdrop-blur-xs">
                    <CloudFog className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-slate-300">
                      VIS: <strong className="text-white">{weather.visibilityMeters}m</strong> | RAIN:{' '}
                      <strong className="text-white">{weather.rainMmHr}mm/h</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* HAUL INCLINE ROUTE CHECKPOINTS TRANSIT TRACKER */}
          <div className="bg-[#0A0A0B] border border-[#333338] p-3 flex flex-col gap-2 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#26262b] pb-2">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white uppercase tracking-wider text-[11px] sm:text-xs">
                  HAUL ROAD CHECKPOINT TRANSIT TRACKER (CP-01 to CP-06)
                </span>
              </div>
              <span className="text-[10px] text-slate-400 hidden sm:inline">LIVE DUMPER CROSSING STATUS</span>
            </div>

            {/* Checkpoints Sequence Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
              {checkpointPassageData.map((cp) => {
                const isCrossedAny = cp.crossedCount > 0;
                return (
                  <div
                    key={cp.id}
                    className={`p-2 border flex flex-col gap-1 rounded-xs transition-all ${
                      isCrossedAny
                        ? 'bg-[#0e1726]/80 border-cyan-500/60 shadow-xs'
                        : 'bg-[#111114] border-[#27272f]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 text-[11px] flex items-center gap-1">
                        <span>{cp.code}</span>
                      </span>
                      <span
                        className={`text-[9px] px-1 py-0.2 font-bold rounded-xs ${
                          isCrossedAny ? 'bg-cyan-900 text-cyan-200 border border-cyan-600' : 'bg-black/60 text-slate-400'
                        }`}
                      >
                        {cp.crossedCount} PASSED
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-300 font-semibold truncate" title={cp.name}>
                      {cp.shortName}
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-slate-400">
                      <span>RL {cp.elevationRL}m</span>
                      <span className="text-yellow-400 font-semibold">{cp.speedLimitKmh}k cap</span>
                    </div>

                    {/* Dumpers that crossed this checkpoint */}
                    <div className="mt-1 pt-1 border-t border-[#1f2937] flex flex-wrap gap-1 min-h-[22px] items-center">
                      {cp.crossedVehicles.length > 0 ? (
                        cp.crossedVehicles.slice(0, 3).map((v) => (
                          <span
                            key={v.id}
                            onClick={() => onSelectVehicle(v)}
                            className={`text-[9px] font-bold px-1 py-0.2 rounded-xs border cursor-pointer hover:scale-105 transition-transform ${
                              v.direction === 1
                                ? 'bg-blue-950 text-blue-200 border-blue-600'
                                : 'bg-green-950 text-green-200 border-green-600'
                            }`}
                            title={`Inspect ${v.id} (${v.direction === 1 ? 'Uphill Loaded' : 'Downhill Empty'}, ${v.speedKmh.toFixed(0)} km/h)`}
                          >
                            {v.id} {v.direction === 1 ? '↑' : '↓'}
                          </span>
                        ))
                      ) : (
                        <span className="text-[9px] text-slate-500 italic">None yet</span>
                      )}
                      {cp.crossedVehicles.length > 3 && (
                        <span className="text-[9px] text-slate-300">+{cp.crossedVehicles.length - 3}</span>
                      )}
                    </div>

                    {/* ESP32 Checkpoint IoT Node live sensor ribbon */}
                    {cp.code === 'CP-1' && (
                      <div className="mt-1 pt-1 border-t border-[#1f2937] flex items-center justify-between text-[9px] bg-cyan-950/40 px-1.5 py-0.5 rounded-xs border border-cyan-500/40">
                        <span className="text-cyan-300 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                          <span>ESP32:</span>
                        </span>
                        <span className="text-slate-200 font-mono">
                          {telemetry?.dht22.temperatureC.toFixed(1)}°C &bull; {telemetry?.dht22.humidityPercent}% &bull; MQ:{telemetry?.mq135.rawAdc ?? telemetry?.checkpointStation?.mq135Adc ?? 412}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ==================== RIGHT COLLAPSED HANDLE ==================== */}
        {isRightCollapsed && (
          <div className="shrink-0 flex lg:flex-col items-center">
            <button
              type="button"
              onClick={() => setIsRightCollapsed(false)}
              className="hidden lg:flex items-center gap-2 py-4 px-2 bg-[#0A0A0D] hover:bg-[#14141c] border border-[#333338] hover:border-blue-400 text-blue-300 font-mono text-xs font-bold [writing-mode:vertical-lr] cursor-pointer shadow-lg rounded-l transition-all"
              title="Expand Right Fleet & Checkpoints Panel"
            >
              <ChevronsLeft className="w-3.5 h-3.5 rotate-90 text-blue-400" />
              <span>FLEET &amp; AUDIT ({vehicles.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRightCollapsed(false)}
              className="lg:hidden w-full py-2 px-3 bg-[#0A0A0D] border border-[#333338] text-blue-300 font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
              <span>SHOW FLEET &amp; AUDIT PANEL ({vehicles.length})</span>
            </button>
          </div>
        )}

        {/* ==================== RIGHT EXPANDED PANEL ==================== */}
        {!isRightCollapsed && (
          <div className="w-full lg:w-[330px] xl:w-[350px] shrink-0 flex flex-col gap-2 transition-all">
            {/* Tab Bar Header with Collapse Button */}
            <div className="bg-[#0A0A0B] border border-[#333338] p-1.5 flex items-center justify-between font-mono text-xs">
              <button
                type="button"
                onClick={() => setIsRightCollapsed(true)}
                className="p-1 text-slate-400 hover:text-white hover:bg-[#1b1b22] border border-[#333338] mr-1 cursor-pointer transition-colors"
                title="Collapse Right Panel"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 flex-1 overflow-x-auto justify-end">
                <button
                  type="button"
                  onClick={() => setRightTab('roster')}
                  className={`px-2 py-1 text-[10.5px] font-bold border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    rightTab === 'roster'
                      ? 'bg-blue-950 text-blue-300 border-blue-500 shadow-xs'
                      : 'bg-black text-slate-400 border-[#2a2a30] hover:text-white'
                  }`}
                >
                  <Truck className="w-3 h-3 text-blue-400" />
                  <span>FLEET ({vehicles.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('checkpoints')}
                  className={`px-2 py-1 text-[10.5px] font-bold border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    rightTab === 'checkpoints'
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-xs'
                      : 'bg-black text-slate-400 border-[#2a2a30] hover:text-white'
                  }`}
                >
                  <Milestone className="w-3 h-3 text-cyan-400" />
                  <span>CHECKPOINTS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('all')}
                  className={`px-1.5 py-1 text-[10px] font-bold border transition-colors cursor-pointer ${
                    rightTab === 'all'
                      ? 'bg-slate-700 text-white border-slate-400'
                      : 'bg-black text-slate-500 border-[#2a2a30] hover:text-white'
                  }`}
                  title="Show both live fleet and route checkpoints"
                >
                  ALL
                </button>
              </div>
            </div>

            {/* Content: CARD (Live Fleet Roster) */}
            {(rightTab === 'roster' || rightTab === 'all') && (
              <div className="bg-[#0A0A0B] border border-[#333338] flex flex-col overflow-hidden">
                <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-400" />
                    <span className="font-mono font-bold text-xs text-blue-300 uppercase tracking-wider">
                      Live Fleet Roster ({vehicles.length})
                    </span>
                  </div>
                </div>

            {/* Filter Tabs */}
            <div className="p-2 bg-black border-b border-[#2a2a30] flex items-center gap-1.5 flex-wrap font-mono text-xs">
              {(['all', 'critical', 'warning', 'queued', 'hauling'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setStatusFilter(filterKey)}
                  className={`px-2 py-1 border uppercase cursor-pointer transition-colors font-bold text-[11px] ${
                    statusFilter === filterKey
                      ? 'bg-blue-600 text-white border-blue-400 shadow-xs'
                      : 'bg-[#16161a] text-slate-300 border-[#333338] hover:text-white'
                  }`}
                >
                  {filterKey}
                </button>
              ))}
            </div>

            {/* Scrollable Vehicle List */}
            <div className="p-2 flex flex-col gap-1.5 max-h-[480px] overflow-y-auto font-mono text-xs">
              {filteredVehicles.map((v) => {
                const isConflict = v.hazardEnvelope;
                const isHeld = v.state === 'HELD_BY_MTC';

                return (
                  <div
                    key={v.id}
                    className={`p-2.5 bg-black border flex flex-col gap-1.5 transition-all ${
                      isConflict
                        ? 'border-red-500 bg-red-950/30 shadow-xs'
                        : isHeld
                        ? 'border-yellow-500 bg-yellow-950/20'
                        : 'border-[#2a2a30] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        onClick={() => onSelectVehicle(v)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <span className="font-bold text-white text-sm hover:text-blue-400">{v.id}</span>
                        <span className="text-xs text-slate-300 font-semibold">({v.type})</span>
                        {isConflict && (
                          <span className="text-xs text-red-200 font-bold bg-red-950 px-1.5 py-0.5 border border-red-500 animate-pulse">
                            HAZARD
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-white font-bold text-sm">{v.speedKmh.toFixed(0)} km/h</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                      <span>{v.material} ({v.payloadTons}T)</span>
                      <span>Stop: <strong className="text-white">{v.dStopMeters}m</strong></span>
                    </div>

                    {/* Quick MTC Control buttons */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={() => onSelectVehicle(v)}
                        className="flex-1 bg-[#1a1a20] hover:bg-[#262630] text-slate-200 text-xs font-bold py-1 px-2 border border-[#44444c] cursor-pointer transition-colors"
                      >
                        TELEMETRY
                      </button>

                      {isHeld ? (
                        <button
                          type="button"
                          disabled={!isDispatcher}
                          onClick={() => onClearVehicle(v.id)}
                          className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-1 px-2 border border-green-400 cursor-pointer transition-colors"
                        >
                          CLEAR
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!isDispatcher}
                          onClick={() => onHoldVehicle(v.id)}
                          className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-bold py-1 px-2 border border-yellow-400 cursor-pointer transition-colors"
                        >
                          HOLD
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

          {/* Content: CARD (Route Checkpoint Passing & Berm Speed Audit) */}
          {(rightTab === 'checkpoints' || rightTab === 'all') && (
            <div className="bg-[#0A0A0B] border border-[#333338] p-3 flex flex-col gap-2 font-mono text-xs overflow-y-auto max-h-[500px]">
              <div className="flex items-center justify-between border-b border-[#26262b] pb-2">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                    ROUTE CHECKPOINTS (CP-01 to 06)
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">PASS AUDIT</span>
              </div>

              <div className="flex flex-col gap-1.5">
                {checkpointPassageData.map((cp) => {
                  const isCrossedAny = cp.crossedCount > 0;
                  return (
                    <div
                      key={cp.id}
                      className={`p-2 border flex flex-col gap-1 rounded-xs transition-all ${
                        isCrossedAny
                          ? 'bg-[#0e1726]/80 border-cyan-500/60 shadow-xs'
                          : 'bg-[#111114] border-[#27272f]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-300 text-[11px] flex items-center gap-1">
                          <span>{cp.code}</span>
                          <span className="text-slate-400 text-[10px]">({cp.shortName})</span>
                        </span>
                        <span
                          className={`text-[9px] px-1 py-0.2 font-bold rounded-xs ${
                            isCrossedAny ? 'bg-cyan-900 text-cyan-200 border border-cyan-600' : 'bg-black/60 text-slate-400'
                          }`}
                        >
                          {cp.crossedCount} PASSED
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[9px] text-slate-400">
                        <span>RL {cp.elevationRL}m</span>
                        <span className="text-yellow-400 font-semibold">{cp.speedLimitKmh} km/h cap</span>
                      </div>

                      {/* Dumpers that crossed this checkpoint */}
                      <div className="mt-1 pt-1 border-t border-[#1f2937] flex flex-wrap gap-1 min-h-[22px] items-center">
                        {cp.crossedVehicles.length > 0 ? (
                          cp.crossedVehicles.slice(0, 4).map((v) => (
                            <span
                              key={v.id}
                              onClick={() => onSelectVehicle(v)}
                              className={`text-[9px] font-bold px-1 py-0.2 rounded-xs border cursor-pointer hover:scale-105 transition-transform ${
                                v.direction === 1
                                  ? 'bg-blue-950 text-blue-200 border-blue-600'
                                  : 'bg-green-950 text-green-200 border-green-600'
                              }`}
                              title={`Inspect ${v.id} (${v.direction === 1 ? 'Uphill Loaded' : 'Downhill Empty'}, ${v.speedKmh.toFixed(0)} km/h)`}
                            >
                              {v.id} {v.direction === 1 ? '↑' : '↓'}
                            </span>
                          ))
                        ) : (
                          <span className="text-[9px] text-slate-500 italic">No units passed yet</span>
                        )}
                      </div>

                      {/* ESP32 Checkpoint IoT Node live sensor ribbon */}
                      {cp.code === 'CP-1' && (
                        <div className="mt-1 pt-1 border-t border-[#1f2937] flex items-center justify-between text-[9px] bg-cyan-950/40 px-1.5 py-0.5 rounded-xs border border-cyan-500/40">
                          <span className="text-cyan-300 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            <span>ESP32 IOT:</span>
                          </span>
                          <span className="text-slate-200 font-mono">
                            {telemetry?.dht22.temperatureC.toFixed(1)}°C &bull; {telemetry?.dht22.humidityPercent}% &bull; MQ:{telemetry?.mq135.rawAdc ?? telemetry?.checkpointStation?.mq135Adc ?? 412} ADC
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);
};
