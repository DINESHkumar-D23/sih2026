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
  Mountain,
  Satellite,
  Activity,
  CloudFog,
  Droplets,
  RotateCcw,
  Compass,
  MapPin,
} from 'lucide-react';
import L from 'leaflet';
import { VehicleTwin, ConflictIncident, RadioToast, UserRole, WeatherData } from '../types';
import {
  INCLINE_TRACK,
  PASSING_BAY_ALPHA,
  PASSING_BAY_BETA,
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
}) => {
  // Active NMDC Mine Site
  const [activeMine, setActiveMine] = useState<'14A' | '14C' | 'DEP5' | 'DONI'>('14A');

  // Display Mode: Topographic Twin (Realistic), Satellite Orthophoto (GIS), or Tactical Radar (CAD)
  const [displayMode, setDisplayMode] = useState<'topographic' | 'satellite' | 'radar'>('topographic');
  const [viewPreset, setViewPreset] = useState<'overview' | 'hairpin3' | 'crusher'>('overview');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'warning' | 'queued' | 'hauling'>('all');

  // Layer toggles
  const [showBenchLines, setShowBenchLines] = useState(true);
  const [showPassingBays, setShowPassingBays] = useState(true);
  const [showBrakingRings, setShowBrakingRings] = useState(true);
  const [showWeatherFx, setShowWeatherFx] = useState(true);
  const [showHeadlights, setShowHeadlights] = useState(true);

  // Leaflet references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const vehicleMarkersRef = useRef<{ [key: string]: L.Marker }>({});
  const conflictLineRef = useRef<L.Polyline | null>(null);
  const haulRoadPolylineRef = useRef<L.Polyline | null>(null);
  const staticMarkersRef = useRef<L.Marker[]>([]);

  const isDispatcher = userRole === 'dispatcher';
  const currentMineInfo = NMDC_MINES[activeMine] || NMDC_MINES['14A'];

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

        // High-resolution Esri World Imagery (Satellite)
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            attribution: 'Esri World Imagery &mdash; NMDC Open-Cast Iron Ore Projects',
          }
        ).addTo(map);

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

        // Shovel 01 Marker
        const shovelGps = projectCanvasToGps(120, 520, activeMine);
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
        const crusherGps = projectCanvasToGps(580, 50, activeMine);
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

        staticMarkersRef.current = [shvMarker, cruMarker, mBayA, mBayB];
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

  // Update map view & markers when activeMine changes (if map is mounted)
  useEffect(() => {
    if (displayMode !== 'satellite') return;
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      const mine = NMDC_MINES[activeMine] || NMDC_MINES['14A'];
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
      const shovelGps = projectCanvasToGps(120, 520, activeMine);
      const crusherGps = projectCanvasToGps(580, 50, activeMine);
      const bayAlphaGps = projectCanvasToGps(PASSING_BAY_ALPHA.x, PASSING_BAY_ALPHA.y, activeMine);
      const bayBetaGps = projectCanvasToGps(PASSING_BAY_BETA.x, PASSING_BAY_BETA.y, activeMine);

      if (staticMarkersRef.current.length >= 4) {
        staticMarkersRef.current[0].setLatLng([shovelGps.lat, shovelGps.lng]);
        staticMarkersRef.current[1].setLatLng([crusherGps.lat, crusherGps.lng]);
        staticMarkersRef.current[2].setLatLng([bayAlphaGps.lat, bayAlphaGps.lng]);
        staticMarkersRef.current[3].setLatLng([bayBetaGps.lat, bayBetaGps.lng]);
      }
    } catch (err) {
      console.error('Safe map update notice:', err);
    }
  }, [activeMine, displayMode]);

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
        const color = isHazard ? '#ef4444' : isHeld ? '#eab308' : v.payloadTons > 0 ? '#3b82f6' : '#22c55e';

        const iconHtml = `
          <div style="transform: rotate(${v.headingDeg}deg); position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <!-- Truck body -->
            <div style="width: 24px; height: 32px; border-radius: 2px; border: 2px solid ${color}; background: ${isHazard ? '#7f1d1d' : '#09090b'}; box-shadow: 0 0 10px ${color}80; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 2px 0;">
              <div style="width: 14px; height: 8px; background: #facc15; border-radius: 1px;"></div>
              <div style="width: 16px; height: 12px; background: ${v.payloadTons > 0 ? '#881337' : '#44403c'}; border-radius: 1px;"></div>
            </div>
            <!-- Label tag -->
            <div style="transform: rotate(-${v.headingDeg}deg); position: absolute; top: -20px; padding: 1px 4px; background: rgba(0,0,0,0.9); font-size: 10px; font-family: monospace; font-weight: bold; color: white; border: 1px solid ${color}; white-space: nowrap;">
              ${v.id} ${v.speedKmh.toFixed(0)}k
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'leaflet-custom-vehicle',
          html: iconHtml,
          iconSize: [28, 36],
          iconAnchor: [14, 18],
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

  // Reset Leaflet to active mine center
  const handleResetSatelliteView = () => {
    if (!mapInstanceRef.current) return;
    try {
      const mine = NMDC_MINES[activeMine] || NMDC_MINES['14A'];
      mapInstanceRef.current.setView(mine.center, mine.zoom, { animate: true });
    } catch (err) {
      console.error('Reset satellite view notice:', err);
    }
  };

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

      {/* Primary 3-Column Docked Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 w-full">
        {/* ==================== LEFT COLUMN (col-span-3) ==================== */}
        <div className="lg:col-span-3 flex flex-col gap-2.5">
          {/* CARD 1: SHIFT HAULAGE PROGRESS */}
          <div className="bg-[#0A0A0B] border border-[#333338] flex flex-col overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="font-mono font-bold text-xs text-blue-300 uppercase tracking-wider">
                  Shift Haulage Progress
                </span>
              </div>
              <span className="font-mono text-xs bg-black text-blue-300 px-2 py-0.5 border border-blue-500/40 font-bold">
                {progressPercent.toFixed(1)}% TARGET
              </span>
            </div>

            <div className="p-3 flex flex-col gap-2">
              <div className="flex flex-col gap-1.5 bg-[#0c0c0e] p-2.5 border border-[#2a2a30]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-300 tracking-wider uppercase font-bold">
                    HAULED TO DATE
                  </span>
                  <span className="font-mono text-xs text-blue-300 bg-[#141418] px-1.5 py-0.5 border border-[#333338] font-bold">
                    TARGET {targetTons.toLocaleString()} T
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl text-white font-bold tracking-tight">
                      {totalHauledTons.toLocaleString()}
                    </span>
                    <span className="font-mono text-xs text-slate-300 font-bold">TONS</span>
                  </div>
                </div>

                <div className="w-full bg-[#18181A] h-2 overflow-hidden border border-[#333333] mt-1">
                  <div
                    className="bg-blue-500 h-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: ACTIVE COLLISION & MTC INTERLOCK */}
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
                <span>Bench Contours (RL 1040-1280M)</span>
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
                  checked={showBrakingRings}
                  onChange={(e) => setShowBrakingRings(e.target.checked)}
                  className="cursor-pointer"
                />
                <span>Dynamic Stopping Envelopes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={showHeadlights}
                  onChange={(e) => setShowHeadlights(e.target.checked)}
                  className="cursor-pointer"
                />
                <span>Volumetric Truck Headlights</span>
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
        </div>

        {/* ==================== CENTER COLUMN (col-span-6) ==================== */}
        <div className="lg:col-span-6 flex flex-col gap-2">
          {/* DISPLAY CANVAS CONTAINER */}
          <div className="bg-[#050507] border border-[#333338] relative overflow-hidden flex flex-col">
            {/* Mine Site Selector Bar & Canvas Header */}
            <div className="bg-[#0F0F10] border-b border-[#333338] flex flex-col">
              {/* Top Mine Tabs */}
              <div className="px-3 py-1.5 bg-[#09090b] border-b border-[#27272a] flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-amber-400 uppercase tracking-wider hidden sm:inline">NMDC PROJECT:</span>
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { id: '14A', name: 'SECTOR 14-A', tag: 'CG' },
                    { id: '14C', name: 'BAILADILA 14C', tag: 'CG' },
                    { id: 'DEP5', name: 'DEPOSIT-5 BACHELI', tag: 'CG' },
                    { id: 'DONI', name: 'DONIMALAI', tag: 'KA' },
                  ].map((mine) => (
                    <button
                      key={mine.id}
                      type="button"
                      onClick={() => setActiveMine(mine.id as any)}
                      className={`px-2.5 py-1 text-[11px] font-mono font-bold border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        activeMine === mine.id
                          ? 'bg-amber-600 text-white border-amber-400 shadow-sm'
                          : 'bg-[#141418] text-slate-300 border-[#2e2e36] hover:text-white hover:border-slate-500'
                      }`}
                    >
                      <span>{mine.name}</span>
                      <span className={`text-[9px] px-1 py-0.2 rounded-xs ${
                        activeMine === mine.id ? 'bg-amber-800 text-white' : 'bg-black/60 text-slate-400'
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

                {/* Visualization Mode Selector */}
                <div className="flex items-center gap-1 bg-black p-0.5 border border-[#333338] rounded-xs font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDisplayMode('topographic')}
                    className={`flex items-center gap-1.5 px-2 py-1 font-bold transition-all cursor-pointer ${
                      displayMode === 'topographic'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Photorealistic Open-Pit Topographic Digital Twin"
                  >
                    <Mountain className="w-3.5 h-3.5" />
                    <span>TOPOGRAPHIC</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDisplayMode('satellite')}
                    className={`flex items-center gap-1.5 px-2 py-1 font-bold transition-all cursor-pointer ${
                      displayMode === 'satellite'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Live Satellite Orthophoto (Esri World Imagery)"
                  >
                    <Satellite className="w-3.5 h-3.5" />
                    <span>SATELLITE</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDisplayMode('radar')}
                    className={`flex items-center gap-1.5 px-2 py-1 font-bold transition-all cursor-pointer ${
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

            {/* Viewport Area */}
            <div className="relative w-full aspect-4/3 bg-[#050507] overflow-hidden">
              {/* ========================================================================= */}
              {/* SATELLITE ORTHOPHOTO VIEW (LEAFLET + ESRI SATELLITE) */}
              {/* ========================================================================= */}
              <div
                style={{ display: displayMode === 'satellite' ? 'block' : 'none' }}
                className="w-full h-full relative"
              >
                <div ref={mapContainerRef} className="w-full h-full bg-[#0a0a0b]" />

                {/* Satellite HUD Overlay */}
                <div className="absolute top-2 left-2 z-[400] bg-black/90 border border-[#333338] px-3 py-2 flex flex-col gap-0.5 font-mono text-[11px] backdrop-blur-xs shadow-xl max-w-sm">
                  <div className="flex items-center gap-2 text-blue-400 font-bold">
                    <Satellite className="w-3.5 h-3.5 animate-pulse" />
                    <span>ESRI SATELLITE // {currentMineInfo.name.toUpperCase()}</span>
                  </div>
                  <div className="text-slate-200">
                    LOC: {currentMineInfo.location}, {currentMineInfo.state} | DATUM: WGS84
                  </div>
                  <div className="text-amber-400 font-semibold text-[10px]">
                    CENTER: {currentMineInfo.center[0].toFixed(3)}°N, {currentMineInfo.center[1].toFixed(3)}°E | {currentMineInfo.elevationRange}
                  </div>
                </div>

                {/* Reset Satellite Center Button */}
                <button
                  type="button"
                  onClick={handleResetSatelliteView}
                  className="absolute bottom-3 right-3 z-[400] bg-black/90 hover:bg-[#16161a] border border-[#44444c] text-white px-2.5 py-1.5 flex items-center gap-1.5 font-mono text-xs font-bold cursor-pointer transition-colors shadow-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                  <span>CENTER {activeMine}</span>
                </button>
              </div>

              {/* ========================================================================= */}
              {/* TOPOGRAPHIC DIGITAL TWIN & RADAR CAD VIEW (SVG) */}
              {/* ========================================================================= */}
              <div
                style={{ display: displayMode !== 'satellite' ? 'block' : 'none' }}
                className="w-full h-full relative"
              >
                <svg
                  viewBox={getViewBox()}
                  className="w-full h-full cursor-crosshair"
                  role="img"
                  aria-label="NMDC Bailadila Sector 14-A Haul Dispatch Digital Twin"
                >
                  <defs>
                    {/* Radar Grid Pattern */}
                    <pattern id="radarGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#222834" strokeWidth="0.6" />
                    </pattern>

                    {/* Dense Jungle / Forest Texture Pattern */}
                    <pattern id="jungleForestPattern" width="30" height="30" patternUnits="userSpaceOnUse">
                      <rect width="30" height="30" fill="#14532d" />
                      <circle cx="8" cy="8" r="7" fill="#166534" opacity="0.8" />
                      <circle cx="22" cy="10" r="8" fill="#15803d" opacity="0.65" />
                      <circle cx="15" cy="22" r="7.5" fill="#052e16" opacity="0.9" />
                      <circle cx="26" cy="24" r="5" fill="#166534" opacity="0.75" />
                      <circle cx="4" cy="24" r="5.5" fill="#15803d" opacity="0.6" />
                    </pattern>

                    {/* Iron Ore Hematite Soil Base Gradient */}
                    <radialGradient id="pitDepthGradient" cx="22%" cy="82%" r="92%">
                      <stop offset="0%" stopColor="#451a03" />
                      <stop offset="25%" stopColor="#78350f" />
                      <stop offset="50%" stopColor="#9a3412" />
                      <stop offset="75%" stopColor="#c2410c" />
                      <stop offset="100%" stopColor="#2e1005" />
                    </radialGradient>

                    {/* Exposed Hematite Bench Cut Vertical Faces */}
                    <linearGradient id="benchCutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ea580c" />
                      <stop offset="40%" stopColor="#c2410c" />
                      <stop offset="80%" stopColor="#9a3412" />
                      <stop offset="100%" stopColor="#7c2d12" />
                    </linearGradient>

                    {/* Exposed Laterite Road Surface Gradient */}
                    <linearGradient id="roadBaseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#7f1d1d" />
                      <stop offset="25%" stopColor="#b91c1c" />
                      <stop offset="50%" stopColor="#dc2626" />
                      <stop offset="75%" stopColor="#b91c1c" />
                      <stop offset="100%" stopColor="#7f1d1d" />
                    </linearGradient>

                    {/* Drainage Sump Water Pool Gradient (Teal/Blue Mineral Water) */}
                    <radialGradient id="sumpWaterGrad" cx="38%" cy="38%" r="62%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                      <stop offset="45%" stopColor="#0284c7" stopOpacity="0.9" />
                      <stop offset="80%" stopColor="#0369a1" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#075985" stopOpacity="1" />
                    </radialGradient>

                    {/* Forward Truck Headlight Volumetric Light Cone */}
                    <linearGradient id="headlightBeam" x1="0%" y1="100%" x2="0%" y2="0%">
                      <stop offset="0%" stopColor="#fef08a" stopOpacity="0.85" />
                      <stop offset="40%" stopColor="#fef9c3" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
                    </linearGradient>

                    {/* Crushed Ore Stockpile Gradient */}
                    <radialGradient id="orePileGrad" cx="35%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="#b91c1c" />
                      <stop offset="50%" stopColor="#881337" />
                      <stop offset="85%" stopColor="#4c0519" />
                      <stop offset="100%" stopColor="#1f0208" />
                    </radialGradient>

                    {/* Terraced Bench Cut 3D Shadow */}
                    <filter id="benchCutShadow" x="-15%" y="-15%" width="130%" height="130%">
                      <feDropShadow dx="3" dy="5" stdDeviation="4" floodColor="#1c0702" floodOpacity="0.9" />
                    </filter>

                    {/* Hazard Pulse Glow */}
                    <filter id="hazardGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
                      <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* ------------------------------------------------------------- */}
                  {/* BACKGROUND TERRAIN */}
                  {/* ------------------------------------------------------------- */}
                  {displayMode === 'topographic' ? (
                    // Photorealistic NMDC Iron Ore Open-Pit Background with Surrounding Jungle
                    <g>
                      {/* Deep Base Soil */}
                      <rect x="0" y="0" width="800" height="600" fill="#2a1005" />

                      {/* Surrounding Dense Green Forest Canopy (as in all NMDC Kirandul/Bacheli photos) */}
                      <rect x="0" y="0" width="800" height="600" fill="url(#jungleForestPattern)" />

                      {/* Open-Pit Excavation Cleared Zone with Stepped Orange-Red Iron Ore Hematite Soil */}
                      <path
                        d="M 20,400 Q 50,220 180,110 Q 340,30 520,30 Q 720,40 780,210 Q 790,380 680,510 Q 520,590 280,580 Q 80,570 20,400 Z"
                        fill="url(#pitDepthGradient)"
                      />

                      {/* Forest Edge Tree Fringe Ring */}
                      <path
                        d="M 20,400 Q 50,220 180,110 Q 340,30 520,30 Q 720,40 780,210 Q 790,380 680,510 Q 520,590 280,580 Q 80,570 20,400 Z"
                        fill="none"
                        stroke="#052e16"
                        strokeWidth="14"
                        strokeDasharray="10,6"
                        opacity="0.85"
                      />
                    </g>
                  ) : (
                    // Tactical CAD Wireframe Background
                    <>
                      <rect x="0" y="0" width="800" height="600" fill="#07090e" />
                      <rect x="0" y="0" width="800" height="600" fill="url(#radarGrid)" />
                    </>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* TOPOGRAPHIC BENCH TERRACES (RL 1040M - 1280M) */}
                  {/* ------------------------------------------------------------- */}
                  {displayMode === 'topographic' && (
                    <g filter="url(#benchCutShadow)">
                      {/* BENCH LEVEL 1 (OUTER RIM RL 1280M): Surface Crusher Plateau */}
                      <path
                        d="M 340,20 Q 540,15 720,50 Q 780,110 760,200 Q 640,140 480,110 Q 360,90 340,20 Z"
                        fill="#ea580c"
                        stroke="#c2410c"
                        strokeWidth="2"
                      />
                      {/* Exposed Highwall Face of Bench 1 */}
                      <path
                        d="M 340,20 Q 540,15 720,50 Q 780,110 760,200"
                        fill="none"
                        stroke="#9a3412"
                        strokeWidth="5"
                      />

                      {/* BENCH LEVEL 2 (RL 1220M): Upper Haul Ramp Cut */}
                      <path
                        d="M 220,130 Q 420,100 640,160 Q 720,240 680,330 Q 520,240 360,230 Q 230,220 220,130 Z"
                        fill="#c2410c"
                        stroke="#9a3412"
                        strokeWidth="2"
                      />
                      {/* Highwall Face */}
                      <path
                        d="M 220,130 Q 420,100 640,160 Q 720,240 680,330"
                        fill="none"
                        stroke="#7c2d12"
                        strokeWidth="5"
                      />

                      {/* BENCH LEVEL 3 (RL 1180M): Hairpin 3 Switchback Ridge */}
                      <path
                        d="M 140,240 Q 320,200 520,270 Q 640,360 560,450 Q 400,360 260,360 Q 150,330 140,240 Z"
                        fill="#b45309"
                        stroke="#78350f"
                        strokeWidth="2"
                      />
                      {/* Highwall Face */}
                      <path
                        d="M 140,240 Q 320,200 520,270 Q 640,360 560,450"
                        fill="none"
                        stroke="#713f12"
                        strokeWidth="5"
                      />

                      {/* BENCH LEVEL 4 (RL 1120M): Mid Pit Haul Ramp Cut */}
                      <path
                        d="M 60,350 Q 220,310 380,390 Q 480,480 380,540 Q 240,540 120,510 Q 50,450 60,350 Z"
                        fill="#92400e"
                        stroke="#78350f"
                        strokeWidth="2"
                      />
                      {/* Highwall Face */}
                      <path
                        d="M 60,350 Q 220,310 380,390 Q 480,480 380,540"
                        fill="none"
                        stroke="#451a03"
                        strokeWidth="5"
                      />

                      {/* BENCH LEVEL 5 (PIT FLOOR RL 1040M): Excavator Loading Basin */}
                      <ellipse
                        cx="120"
                        cy="520"
                        rx="105"
                        ry="62"
                        fill="#78350f"
                        stroke="#451a03"
                        strokeWidth="3"
                      />

                      {/* Pit Floor Drainage Sump (Deep Sump Basin with Turquoise Water Pond) */}
                      <g>
                        <ellipse
                          cx="90"
                          cy="550"
                          rx="46"
                          ry="26"
                          fill="url(#sumpWaterGrad)"
                          stroke="#7dd3fc"
                          strokeWidth="2"
                        />
                        <ellipse cx="90" cy="550" rx="34" ry="17" fill="none" stroke="#e0f2fe" strokeWidth="1" opacity="0.75" />
                        <ellipse cx="90" cy="550" rx="20" ry="9" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
                        <text
                          x="90"
                          y="554"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                          stroke="#0369a1"
                          strokeWidth="0.4"
                        >
                          SUMP-09
                        </text>
                      </g>
                    </g>
                  )}

                  {/* Topographic Bench Contour Lines (Toggleable) */}
                  {showBenchLines && (
                    <g
                      opacity={displayMode === 'topographic' ? 0.9 : 0.65}
                      stroke={displayMode === 'topographic' ? '#fbbf24' : '#475569'}
                      strokeWidth={displayMode === 'topographic' ? 1.5 : 1}
                      fill="none"
                      strokeDasharray={displayMode === 'topographic' ? '6,4' : '4,4'}
                    >
                      {/* Pit Floor Bench 09 */}
                      <ellipse cx="120" cy="520" rx="90" ry="50" />
                      <text
                        x="125"
                        y="555"
                        fill={displayMode === 'topographic' ? '#fef08a' : '#cbd5e1'}
                        fontSize="10.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                        stroke={displayMode === 'topographic' ? '#78350f' : 'none'}
                        strokeWidth={displayMode === 'topographic' ? 0.8 : 0}
                      >
                        RL 1,040M (PIT FLOOR &amp; SUMP)
                      </text>

                      {/* Bench 07 */}
                      <ellipse cx="260" cy="440" rx="140" ry="70" />
                      <text
                        x="265"
                        y="480"
                        fill={displayMode === 'topographic' ? '#fef08a' : '#cbd5e1'}
                        fontSize="10.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                        stroke={displayMode === 'topographic' ? '#78350f' : 'none'}
                        strokeWidth={displayMode === 'topographic' ? 0.8 : 0}
                      >
                        RL 1,120M (BENCH 07 HAUL RAMP)
                      </text>

                      {/* Hairpin 3 Switchback Ridge */}
                      <ellipse cx="440" cy="280" rx="180" ry="90" />
                      <text
                        x="445"
                        y="325"
                        fill={displayMode === 'topographic' ? '#fef08a' : '#fca5a5'}
                        fontSize="10.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                        stroke={displayMode === 'topographic' ? '#78350f' : 'none'}
                        strokeWidth={displayMode === 'topographic' ? 0.8 : 0}
                      >
                        RL 1,180M (HAIRPIN 3 BLIND APEX)
                      </text>

                      {/* Surface Rim */}
                      <ellipse cx="560" cy="80" rx="160" ry="70" />
                      <text
                        x="565"
                        y="115"
                        fill={displayMode === 'topographic' ? '#93c5fd' : '#93c5fd'}
                        fontSize="10.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                        stroke={displayMode === 'topographic' ? '#1e3a8a' : 'none'}
                        strokeWidth={displayMode === 'topographic' ? 0.8 : 0}
                      >
                        RL 1,280M (SURFACE CRUSHER RIM)
                      </text>
                    </g>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* PASSING BAYS */}
                  {/* ------------------------------------------------------------- */}
                  {showPassingBays && (
                    <g>
                      {/* Bay Alpha near Hairpin 3 */}
                      <g>
                        {/* Turnout Hardstand Gravel Base */}
                        <polygon
                          points={`${PASSING_BAY_ALPHA.x - 30},${PASSING_BAY_ALPHA.y - 18} ${PASSING_BAY_ALPHA.x + 30},${PASSING_BAY_ALPHA.y - 18} ${PASSING_BAY_ALPHA.x + 24},${PASSING_BAY_ALPHA.y + 16} ${PASSING_BAY_ALPHA.x - 24},${PASSING_BAY_ALPHA.y + 16}`}
                          fill={displayMode === 'topographic' ? '#451a03' : '#0e1726'}
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="4,4"
                        />
                        <text
                          x={PASSING_BAY_ALPHA.x}
                          y={PASSING_BAY_ALPHA.y + 26}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                          stroke="#0369a1"
                          strokeWidth="0.5"
                        >
                          BAY 07-B (ALPHA)
                        </text>
                      </g>

                      {/* Bay Beta near Bench 07 */}
                      <g>
                        <polygon
                          points={`${PASSING_BAY_BETA.x - 26},${PASSING_BAY_BETA.y - 18} ${PASSING_BAY_BETA.x + 26},${PASSING_BAY_BETA.y - 18} ${PASSING_BAY_BETA.x + 20},${PASSING_BAY_BETA.y + 16} ${PASSING_BAY_BETA.x - 20},${PASSING_BAY_BETA.y + 16}`}
                          fill={displayMode === 'topographic' ? '#451a03' : '#0e1726'}
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="4,4"
                        />
                        <text
                          x={PASSING_BAY_BETA.x}
                          y={PASSING_BAY_BETA.y + 26}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                          stroke="#0369a1"
                          strokeWidth="0.5"
                        >
                          BAY 04-A (BETA)
                        </text>
                      </g>
                    </g>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* HAUL ROADBED WITH DGMS SAFETY BERMS */}
                  {/* ------------------------------------------------------------- */}
                  {displayMode === 'topographic' ? (
                    // Realistic Compacted Laterite Red Haul Road with Safety Bund Walls
                    <g>
                      {/* Wide Mountain Cut Footprint */}
                      <path
                        d={trackPathData}
                        fill="none"
                        stroke="#451a03"
                        strokeWidth="34"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* DGMS Safety Berm Walls (Stone Windrow Bund along pit drop-offs) */}
                      <path
                        d={trackPathData}
                        fill="none"
                        stroke="#78350f"
                        strokeWidth="28"
                        strokeDasharray="7,4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.9"
                      />

                      {/* Crushed Ore Compacted Road Sub-base */}
                      <path
                        d={trackPathData}
                        fill="none"
                        stroke="#991b1b"
                        strokeWidth="22"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Vibrant Red Laterite Haul Road Top Surface (Identical to NMDC aerial photos) */}
                      <path
                        d={trackPathData}
                        fill="none"
                        stroke="url(#roadBaseGrad)"
                        strokeWidth="16"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Center Yellow Guideline with Amber Spacing */}
                      <path
                        d={trackPathData}
                        fill="none"
                        stroke="#fef08a"
                        strokeWidth="1.6"
                        strokeDasharray="6,10"
                        strokeLinecap="round"
                        opacity="0.85"
                      />

                      {/* Hairpin 3 Blind Apex Safety Reflector Barrier */}
                      <g transform="translate(440, 280)">
                        <circle r="15" fill="#7f1d1d" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5,4" />
                        <text
                          x="0"
                          y="4"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          11% GRADE
                        </text>
                      </g>
                    </g>
                  ) : (
                    // Tactical CAD Wireframe Road
                    <g>
                      <path
                        d={trackPathData}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="18"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={trackPathData}
                        fill="none"
                        stroke="#334155"
                        strokeWidth="12"
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
                    </g>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* MINING INFRASTRUCTURE: SHOVELS & CRUSHERS */}
                  {/* ------------------------------------------------------------- */}
                  {/* Pit Floor Electric Rope Shovel 01 */}
                  <g transform="translate(120, 520)">
                    {displayMode === 'topographic' ? (
                      // Realistic Shovel Excavator Model
                      <g>
                        {/* 18m Working Radius Ring */}
                        <circle r="26" fill="none" stroke="#22c55e" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
                        {/* Blasted Hematite Muckpile */}
                        <path d="M -30,-15 Q -10,-28 15,-20 Q 30,-5 25,10 Q 0,25 -25,12 Z" fill="#7f1d1d" opacity="0.5" />
                        {/* Dual Crawler Tracks */}
                        <rect x="-14" y="-12" width="6" height="24" rx="2" fill="#09090b" stroke="#27272a" strokeWidth="0.8" />
                        <rect x="8" y="-12" width="6" height="24" rx="2" fill="#09090b" stroke="#27272a" strokeWidth="0.8" />
                        {/* Revolving Cab Superstructure */}
                        <rect x="-9" y="-9" width="18" height="18" rx="2" fill="#15803d" stroke="#166534" strokeWidth="1.2" />
                        {/* Steel Lattice Boom extending outward */}
                        <line x1="0" y1="0" x2="-20" y2="-18" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
                        <rect x="-24" y="-22" width="8" height="8" rx="1" fill="#ca8a04" stroke="#713f12" strokeWidth="1" />
                        <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                          SHV-01
                        </text>
                      </g>
                    ) : (
                      // Tactical CAD Shovel Circle
                      <g>
                        <circle r="16" fill="#14532d" stroke="#22c55e" strokeWidth="2" />
                        <text y="5" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="bold">SHV-01</text>
                      </g>
                    )}
                  </g>

                  {/* Surface Primary Crusher 1 Hopper Deck */}
                  <g transform="translate(580, 50)">
                    {displayMode === 'topographic' ? (
                      // Realistic Gyratory Crusher Hopper Station
                      <g>
                        {/* ROM Ore Stockpile nearby */}
                        <ellipse cx="-45" cy="10" rx="26" ry="18" fill="url(#orePileGrad)" stroke="#7f1d1d" strokeWidth="1" />
                        <text x="-45" y="13" textAnchor="middle" fill="#fca5a5" fontSize="7.5" fontWeight="bold" fontFamily="monospace">
                          ROM PILE
                        </text>

                        {/* Concrete Tipping Apron with Hazard Striping */}
                        <polygon points="-24,18 24,18 30,-14 -30,-14" fill="#292524" stroke="#78716c" strokeWidth="1.5" />
                        <line x1="-20" y1="16" x2="20" y2="16" stroke="#eab308" strokeWidth="2" strokeDasharray="4,4" />

                        {/* Gyratory Crusher Hopper Pocket & Vibrating Grizzly */}
                        <rect x="-18" y="-12" width="36" height="24" rx="2" fill="#0f172a" stroke="#3b82f6" strokeWidth="2" />
                        <line x1="-14" y1="-4" x2="14" y2="-4" stroke="#64748b" strokeWidth="1.5" />
                        <line x1="-14" y1="2" x2="14" y2="2" stroke="#64748b" strokeWidth="1.5" />

                        {/* Enclosed Overland Conveyor Gantry */}
                        <line x1="18" y1="0" x2="55" y2="-10" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
                        <line x1="18" y1="0" x2="55" y2="-10" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />

                        <text x="0" y="3" textAnchor="middle" fill="#93c5fd" fontSize="9" fontWeight="bold" fontFamily="monospace">
                          CRUSHER 1
                        </text>
                      </g>
                    ) : (
                      // Tactical CAD Crusher Polygon
                      <g>
                        <polygon points="-20,-18 20,-18 30,18 -30,18" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2" />
                        <text y="4" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="bold">CRUSHER 1</text>
                      </g>
                    )}
                  </g>

                  {/* ------------------------------------------------------------- */}
                  {/* ACTIVE CONFLICT CLOSING VECTOR */}
                  {/* ------------------------------------------------------------- */}
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

                  {/* ------------------------------------------------------------- */}
                  {/* VEHICLES / HEAVY HAUL TRUCKS */}
                  {/* ------------------------------------------------------------- */}
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
                        {/* Forward Volumetric Truck Headlights (Topographic mode) */}
                        {showHeadlights && displayMode === 'topographic' && (
                          <g transform={`translate(${v.x}, ${v.y}) rotate(${v.headingDeg})`}>
                            <polygon
                              points="0,-12 -28,-75 28,-75"
                              fill="url(#headlightBeam)"
                              opacity={weather && weather.visibilityMeters < 80 ? 0.75 : 0.35}
                            />
                          </g>
                        )}

                        {/* Dynamic Braking Distance Envelope */}
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

                        {/* Hazard Pulsing Envelope */}
                        {isHazard && (
                          <circle
                            cx={v.x}
                            cy={v.y}
                            r="26"
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="2.5"
                            filter="url(#hazardGlow)"
                            className="animate-ping"
                            style={{ animationDuration: '1.4s' }}
                          />
                        )}

                        {/* REALISTIC CAT 777D / KOMATSU HD785 TRUCK MODEL */}
                        {displayMode === 'topographic' ? (
                          <g transform={`translate(${v.x}, ${v.y}) rotate(${v.headingDeg})`}>
                            {/* Ground Shadow */}
                            <rect
                              x="-12"
                              y="-18"
                              width="24"
                              height="36"
                              rx="3"
                              fill="#000000"
                              opacity="0.65"
                            />

                            {/* Heavy Mining Tires (2 Front Steer, 4 Dual Rear) */}
                            <rect x="-14.5" y="-15" width="4" height="9" rx="1.5" fill="#1c1917" stroke="#44403c" strokeWidth="0.8" />
                            <rect x="10.5" y="-15" width="4" height="9" rx="1.5" fill="#1c1917" stroke="#44403c" strokeWidth="0.8" />
                            <rect x="-15.5" y="5" width="5.5" height="12" rx="2" fill="#1c1917" stroke="#44403c" strokeWidth="0.8" />
                            <rect x="10" y="5" width="5.5" height="12" rx="2" fill="#1c1917" stroke="#44403c" strokeWidth="0.8" />

                            {/* Yellow Chassis & Cab Base */}
                            <rect
                              x="-11"
                              y="-16"
                              width="22"
                              height="32"
                              rx="3"
                              fill={isHazard ? '#7f1d1d' : isHeld ? '#854d0e' : '#ca8a04'}
                              stroke={markerColor}
                              strokeWidth="1.5"
                            />

                            {/* Front Engine Grille */}
                            <rect x="-7" y="-16" width="14" height="5" rx="1" fill="#292524" />
                            <line x1="-5" y1="-14" x2="5" y2="-14" stroke="#78716c" strokeWidth="0.8" />

                            {/* Left-Hand Operator Cab with Tinted Glass */}
                            <rect x="-10" y="-14" width="8" height="9" rx="1.5" fill="#0284c7" stroke="#075985" strokeWidth="1" />
                            <polygon points="-9,-13 -4,-13 -7,-6 -9,-6" fill="#bae6fd" opacity="0.75" />

                            {/* Dump Body Tray */}
                            <rect x="-10" y="-4" width="20" height="20" rx="2" fill="#57534e" stroke="#292524" strokeWidth="1.2" />

                            {/* Payload: High-Grade Hematite Red Ore vs Empty Steel Bed */}
                            {v.payloadTons > 0 ? (
                              <g>
                                <path
                                  d="M -7,-1 Q 0,-3 7,-1 Q 8,8 6,13 Q 0,15 -6,13 Z"
                                  fill="#881337"
                                  stroke="#4c0519"
                                  strokeWidth="0.8"
                                />
                                <circle cx="-2" cy="5" r="2" fill="#9f1239" opacity="0.8" />
                                <circle cx="3" cy="8" r="2" fill="#be123c" opacity="0.9" />
                              </g>
                            ) : (
                              <g opacity="0.5">
                                <line x1="-7" y1="1" x2="7" y2="1" stroke="#1c1917" strokeWidth="1" />
                                <line x1="-7" y1="6" x2="7" y2="6" stroke="#1c1917" strokeWidth="1" />
                                <line x1="-7" y1="11" x2="7" y2="11" stroke="#1c1917" strokeWidth="1" />
                              </g>
                            )}
                          </g>
                        ) : (
                          // Tactical CAD Wireframe Circle & Heading Arrow
                          <g>
                            <circle
                              cx={v.x}
                              cy={v.y}
                              r="11"
                              fill="#09090b"
                              stroke={markerColor}
                              strokeWidth="2.5"
                              className="transition-colors group-hover:stroke-white"
                            />
                            <g transform={`translate(${v.x}, ${v.y}) rotate(${v.headingDeg})`}>
                              <polygon points="0,-16 5,-7 -5,-7" fill={markerColor} />
                            </g>
                          </g>
                        )}

                        {/* Vehicle Telemetry Label Tag */}
                        <g>
                          <rect
                            x={v.x - 28}
                            y={v.y - 30}
                            width="56"
                            height="16"
                            fill="#000000"
                            stroke={markerColor}
                            strokeWidth="1.5"
                            rx="2"
                            opacity="0.95"
                          />
                          <text
                            x={v.x}
                            y={v.y - 18}
                            textAnchor="middle"
                            fill={isHazard ? '#fca5a5' : '#ffffff'}
                            fontSize="10"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {v.id} {v.speedKmh > 0 ? `${v.speedKmh.toFixed(0)}k` : '0k'}
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  {/* ------------------------------------------------------------- */}
                  {/* ATMOSPHERIC MONSOON MIST & WEATHER FX */}
                  {/* ------------------------------------------------------------- */}
                  {showWeatherFx && weather && (
                    <g pointerEvents="none">
                      {/* Low Visibility Mist Clouds */}
                      {weather.visibilityMeters <= 100 && (
                        <g opacity="0.35">
                          <ellipse cx="280" cy="240" rx="140" ry="70" fill="#cbd5e1" filter="blur(16px)" />
                          <ellipse cx="480" cy="340" rx="180" ry="80" fill="#94a3b8" filter="blur(20px)" />
                          <ellipse cx="160" cy="460" rx="120" ry="60" fill="#e2e8f0" filter="blur(14px)" />
                        </g>
                      )}

                      {/* Monsoon Rain Streaks */}
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
        </div>

        {/* ==================== RIGHT COLUMN (col-span-3) ==================== */}
        <div className="lg:col-span-3 flex flex-col gap-2.5">
          {/* VEHICLE ROSTER CARD */}
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
        </div>
      </div>
    </div>
  );
};
