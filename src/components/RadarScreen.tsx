import React, { useState } from 'react';
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
} from 'lucide-react';
import { VehicleTwin, ConflictIncident, RadioToast, UserRole } from '../types';
import { INCLINE_TRACK, PASSING_BAY_ALPHA, PASSING_BAY_BETA } from '../utils/kinematics';

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
}) => {
  const [viewPreset, setViewPreset] = useState<'overview' | 'hairpin3' | 'crusher'>('overview');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'warning' | 'queued' | 'hauling'>('all');

  // Layer toggles
  const [showBenchLines, setShowBenchLines] = useState(true);
  const [showPassingBays, setShowPassingBays] = useState(true);
  const [showBrakingRings, setShowBrakingRings] = useState(true);

  const isDispatcher = userRole === 'dispatcher';

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
    if (statusFilter === 'queued') return v.state === 'QUEUING' || v.state === 'LOADING_AT_SHOVEL' || v.state === 'DISCHARGING_AT_CRUSHER';
    if (statusFilter === 'hauling') return v.state === 'INCLINE_HAUL' || v.state === 'EMPTY';
    return true;
  });

  const progressPercent = Math.min(100, (totalHauledTons / targetTons) * 100);

  // SVG haul track path data string
  const trackPathData = INCLINE_TRACK.points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

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
            <span className="text-xs text-slate-300 font-bold uppercase">CANVAS PRESET &amp; LAYERS</span>
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
                <span>Dynamic Stopping Distance Envelopes</span>
              </label>
            </div>
          </div>
        </div>

        {/* ==================== CENTER COLUMN (col-span-6) ==================== */}
        <div className="lg:col-span-6 flex flex-col gap-2">
          {/* RADAR SVG DISPLAY CANVAS */}
          <div className="bg-[#050507] border border-[#333338] relative overflow-hidden flex flex-col">
            <div className="px-3.5 py-2 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-ping" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  DIGITAL TWIN // BAILADILA SECTOR 14-A HAUL ROAD
                </span>
              </div>
              <span className="font-mono text-xs text-slate-300 font-semibold">
                CATMULL-ROM SPLINE // 11% GRADE
              </span>
            </div>

            <div className="relative w-full aspect-4/3 bg-radial from-[#0d1117] to-[#050507] overflow-hidden">
              <svg
                viewBox={getViewBox()}
                className="w-full h-full cursor-crosshair"
                role="img"
                aria-label="Interactive Haul Road Radar Map for Sector 14-A"
              >
                <defs>
                  {/* Grid Pattern */}
                  <pattern id="radarGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#222834" strokeWidth="0.6" />
                  </pattern>

                  {/* Hazard Pulse Filter */}
                  <filter id="hazardGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
                    <feMerge>
                      <feMergeNode />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Radar Coordinate Grid */}
                <rect x="0" y="0" width="800" height="600" fill="url(#radarGrid)" />

                {/* Topographic Bench Contour Lines */}
                {showBenchLines && (
                  <g opacity="0.65" stroke="#475569" strokeWidth="1" fill="none" strokeDasharray="4,4">
                    {/* Pit Floor Bench 09 */}
                    <ellipse cx="120" cy="520" rx="90" ry="50" />
                    <text x="125" y="555" fill="#cbd5e1" fontSize="11" fontWeight="bold" fontFamily="monospace">RL 1,040M (PIT FLOOR)</text>

                    {/* Bench 07 */}
                    <ellipse cx="260" cy="440" rx="140" ry="70" />
                    <text x="265" y="480" fill="#cbd5e1" fontSize="11" fontWeight="bold" fontFamily="monospace">RL 1,120M (BENCH 07)</text>

                    {/* Hairpin 3 Switchback Ridge */}
                    <ellipse cx="440" cy="280" rx="180" ry="90" />
                    <text x="445" y="325" fill="#fca5a5" fontSize="11" fontWeight="bold" fontFamily="monospace">RL 1,180M (HAIRPIN 3 BLIND APEX)</text>

                    {/* Surface Rim */}
                    <ellipse cx="560" cy="80" rx="160" ry="70" />
                    <text x="565" y="115" fill="#93c5fd" fontSize="11" fontWeight="bold" fontFamily="monospace">RL 1,280M (CRUSHER RIM)</text>
                  </g>
                )}

                {/* Passing Bays */}
                {showPassingBays && (
                  <g>
                    {/* Bay Alpha near Hairpin 3 */}
                    <rect
                      x={PASSING_BAY_ALPHA.x - 22}
                      y={PASSING_BAY_ALPHA.y - 14}
                      width="44"
                      height="28"
                      fill="#0e1726"
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                      rx="2"
                    />
                    <text
                      x={PASSING_BAY_ALPHA.x}
                      y={PASSING_BAY_ALPHA.y + 22}
                      textAnchor="middle"
                      fill="#93c5fd"
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      PASSING BAY 07-B (ALPHA)
                    </text>

                    {/* Bay Beta near Bench 07 */}
                    <rect
                      x={PASSING_BAY_BETA.x - 20}
                      y={PASSING_BAY_BETA.y - 14}
                      width="40"
                      height="28"
                      fill="#0e1726"
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                      rx="2"
                    />
                    <text
                      x={PASSING_BAY_BETA.x}
                      y={PASSING_BAY_BETA.y + 22}
                      textAnchor="middle"
                      fill="#93c5fd"
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      PASSING BAY 04-A (BETA)
                    </text>
                  </g>
                )}

                {/* Incline Track Roadbed & Spine */}
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

                {/* Terminal Points: Shovels & Crushers */}
                {/* Pit Floor Shovel */}
                <circle cx="120" cy="520" r="16" fill="#14532d" stroke="#22c55e" strokeWidth="2" />
                <text x="120" y="525" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="bold">SHV-01</text>

                {/* Crusher 1 Hopper */}
                <polygon points="560,32 600,32 610,68 550,68" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2" />
                <text x="580" y="54" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="bold">CRUSHER 1</text>

                {/* Active Conflict Closing Line */}
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
                        x={midX - 35}
                        y={midY - 12}
                        width="70"
                        height="24"
                        fill="#000000"
                        stroke="#ef4444"
                        strokeWidth="1.5"
                        rx="2"
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

                {/* Vehicle Marker Render Loop */}
                {vehicles.map((v) => {
                  const isSelected = false;
                  const isHazard = v.hazardEnvelope;
                  const isHeld = v.state === 'HELD_BY_MTC';
                  const isDownhill = v.direction === -1;

                  // Vehicle marker color
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
                      {/* Dynamic Braking Circle */}
                      {showBrakingRings && (
                        <circle
                          cx={v.x}
                          cy={v.y}
                          r={Math.max(12, v.dStopMeters * 0.9)}
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
                          r="24"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2.5"
                          filter="url(#hazardGlow)"
                          className="animate-ping"
                          style={{ animationDuration: '1.4s' }}
                        />
                      )}

                      {/* Vehicle Body Representation */}
                      <circle
                        cx={v.x}
                        cy={v.y}
                        r="11"
                        fill="#09090b"
                        stroke={markerColor}
                        strokeWidth="2.5"
                        className="transition-colors group-hover:stroke-white"
                      />

                      {/* Directional Heading Vector */}
                      <g transform={`translate(${v.x}, ${v.y}) rotate(${v.headingDeg})`}>
                        <polygon points="0,-16 5,-7 -5,-7" fill={markerColor} />
                      </g>

                      {/* Vehicle Label Tag */}
                      <rect
                        x={v.x - 27}
                        y={v.y - 28}
                        width="54"
                        height="15"
                        fill="#000000"
                        stroke={markerColor}
                        strokeWidth="1.5"
                        rx="2"
                        opacity="0.95"
                      />
                      <text
                        x={v.x}
                        y={v.y - 17}
                        textAnchor="middle"
                        fill={isHazard ? '#fca5a5' : '#ffffff'}
                        fontSize="10.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {v.id} {v.speedKmh > 0 ? `${v.speedKmh.toFixed(0)}k` : '0k'}
                      </text>
                    </g>
                  );
                })}
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
