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
          className="fixed top-16 right-6 z-50 bg-[#0F0F10] border border-blue-500 text-[#E0E0E0] px-4 py-2 shadow-2xl flex items-center gap-3 animate-bounce"
        >
          <Radio className="w-4 h-4 text-blue-400 animate-pulse" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="font-mono text-[8.5px] text-blue-400 font-bold uppercase tracking-widest">
              {radioNotice.channel}
            </span>
            <span className="font-mono text-[11px] font-semibold">{radioNotice.message}</span>
          </div>
        </div>
      )}

      {/* Primary 3-Column Docked Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 w-full">
        {/* ==================== LEFT COLUMN (col-span-3) ==================== */}
        <div className="lg:col-span-3 flex flex-col gap-2">
          {/* CARD 1: SHIFT HAULAGE PROGRESS */}
          <div className="bg-[#0A0A0B] border border-[#262626] flex flex-col overflow-hidden">
            <div className="px-3 py-2 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-mono font-bold text-[10px] text-blue-400 uppercase tracking-wider">
                  Shift Haulage Progress
                </span>
              </div>
              <span className="font-mono text-[9px] bg-black text-blue-400 px-1.5 py-0.5 border border-[#333333] font-bold">
                {progressPercent.toFixed(1)}% TARGET
              </span>
            </div>

            <div className="p-2.5 flex flex-col gap-2">
              <div className="flex flex-col gap-1 bg-black p-2 border border-[#222222]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-[#888888] tracking-wider uppercase font-bold">
                    HAULED TO DATE
                  </span>
                  <span className="font-mono text-[9px] text-blue-400 bg-[#0F0F10] px-1 py-0.2 border border-[#262626]">
                    TARGET {targetTons.toLocaleString()} T
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-0.5">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-[22px] text-white font-light tracking-tight">
                      {totalHauledTons.toLocaleString()}
                    </span>
                    <span className="font-mono text-[10px] text-[#888888]">T</span>
                  </div>
                </div>

                <div className="w-full bg-[#18181A] h-1.5 overflow-hidden border border-[#333333] mt-1">
                  <div
                    className="bg-blue-500 h-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: ACTIVE COLLISION & MTC INTERLOCK */}
          <div className="bg-[#0A0A0B] border border-[#262626] flex flex-col overflow-hidden">
            <div className="px-3 py-2 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-red-400" />
                <span className="font-mono font-bold text-[10px] text-red-400 uppercase tracking-wider">
                  MTC Collision Interlock
                </span>
              </div>
              {activeConflict && activeConflict.active ? (
                <span className="font-mono text-[8.5px] bg-red-950 text-red-400 px-1.5 py-0.2 border border-red-500 font-bold animate-pulse">
                  CRITICAL PROXIMITY
                </span>
              ) : (
                <span className="font-mono text-[8.5px] bg-green-950 text-green-400 px-1.5 py-0.2 border border-green-500 font-bold">
                  HAUL ROAD CLEAR
                </span>
              )}
            </div>

            <div className="p-2.5 flex flex-col gap-2">
              {activeConflict && activeConflict.active ? (
                <div className="bg-red-950/20 border border-red-600/60 p-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between font-mono text-[9px]">
                    <span className="text-red-400 font-bold">
                      CONVERGENCE: {activeConflict.vehicleAId} ↔ {activeConflict.vehicleBId}
                    </span>
                    <span className="text-white font-bold">{activeConflict.closingDistanceM}m</span>
                  </div>
                  <div className="text-[9.5px] font-mono text-[#CCCCCC] leading-tight">
                    {activeConflict.recommendedAction}
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    <button
                      type="button"
                      disabled={!isDispatcher}
                      onClick={() => onHoldVehicle(activeConflict.mustHoldId)}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-mono text-[9px] font-bold py-1 px-2 cursor-pointer transition-colors"
                    >
                      COMMAND HOLD {activeConflict.mustHoldId}
                    </button>
                    <button
                      type="button"
                      disabled={!isDispatcher}
                      onClick={() => onClearVehicle(activeConflict.vehicleAId)}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono text-[9px] font-bold py-1 px-2 cursor-pointer transition-colors"
                    >
                      CLEAR {activeConflict.vehicleAId}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-black border border-[#222222] p-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="font-mono text-[9.5px] text-[#A3A3A3]">
                    No immediate head-to-head convergence detected on single-lane segments. Dynamic stopping buffers nominal.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* CARD 3: CAMERA & LAYER CONTROLS */}
          <div className="bg-[#0A0A0B] border border-[#262626] p-2.5 flex flex-col gap-2 font-mono text-[10px]">
            <span className="text-[9px] text-[#888888] font-bold uppercase">CANVAS PRESET &amp; LAYERS</span>
            <div className="grid grid-cols-3 gap-1">
              {(['overview', 'hairpin3', 'crusher'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setViewPreset(preset)}
                  className={`py-1 text-[9px] font-bold uppercase border cursor-pointer transition-colors ${
                    viewPreset === preset
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-black text-[#888888] border-[#222222] hover:text-white'
                  }`}
                >
                  {preset === 'overview' ? 'OVERVIEW' : preset === 'hairpin3' ? 'HAIRPIN 3' : 'CRUSHER'}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1 mt-1 text-[9px] text-[#A3A3A3]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBenchLines}
                  onChange={(e) => setShowBenchLines(e.target.checked)}
                  className="cursor-pointer"
                />
                <span>Bench Contours (RL 1040-1280M)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPassingBays}
                  onChange={(e) => setShowPassingBays(e.target.checked)}
                  className="cursor-pointer"
                />
                <span>Passing Bays Alpha &amp; Beta</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
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
          <div className="bg-[#050507] border border-[#262626] relative overflow-hidden flex flex-col">
            <div className="px-3 py-1.5 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                <span className="font-mono text-[10.5px] font-bold text-white uppercase tracking-wider">
                  DIGITAL TWIN // BAILADILA SECTOR 14-A HAUL ROAD
                </span>
              </div>
              <span className="font-mono text-[9px] text-[#888888]">
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
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1f242e" strokeWidth="0.5" />
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
                  <g opacity="0.35" stroke="#374151" strokeWidth="0.8" fill="none" strokeDasharray="3,3">
                    {/* Pit Floor Bench 09 */}
                    <ellipse cx="120" cy="520" rx="90" ry="50" />
                    <text x="125" y="555" fill="#6b7280" fontSize="8" fontFamily="monospace">RL 1,040M (PIT FLOOR)</text>

                    {/* Bench 07 */}
                    <ellipse cx="260" cy="440" rx="140" ry="70" />
                    <text x="265" y="480" fill="#6b7280" fontSize="8" fontFamily="monospace">RL 1,120M (BENCH 07)</text>

                    {/* Hairpin 3 Switchback Ridge */}
                    <ellipse cx="440" cy="280" rx="180" ry="90" />
                    <text x="445" y="325" fill="#ef4444" fontSize="8" fontFamily="monospace">RL 1,180M (HAIRPIN 3 BLIND APEX)</text>

                    {/* Surface Rim */}
                    <ellipse cx="560" cy="80" rx="160" ry="70" />
                    <text x="565" y="115" fill="#60a5fa" fontSize="8" fontFamily="monospace">RL 1,280M (CRUSHER RIM)</text>
                  </g>
                )}

                {/* Passing Bays */}
                {showPassingBays && (
                  <g>
                    {/* Bay Alpha near Hairpin 3 */}
                    <rect
                      x={PASSING_BAY_ALPHA.x - 20}
                      y={PASSING_BAY_ALPHA.y - 12}
                      width="40"
                      height="24"
                      fill="#0e1726"
                      stroke="#3b82f6"
                      strokeWidth="1.2"
                      strokeDasharray="2,2"
                      rx="2"
                    />
                    <text
                      x={PASSING_BAY_ALPHA.x}
                      y={PASSING_BAY_ALPHA.y + 18}
                      textAnchor="middle"
                      fill="#60a5fa"
                      fontSize="7.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      PASSING BAY 07-B (ALPHA)
                    </text>

                    {/* Bay Beta near Bench 07 */}
                    <rect
                      x={PASSING_BAY_BETA.x - 18}
                      y={PASSING_BAY_BETA.y - 12}
                      width="36"
                      height="24"
                      fill="#0e1726"
                      stroke="#3b82f6"
                      strokeWidth="1.2"
                      strokeDasharray="2,2"
                      rx="2"
                    />
                    <text
                      x={PASSING_BAY_BETA.x}
                      y={PASSING_BAY_BETA.y + 18}
                      textAnchor="middle"
                      fill="#60a5fa"
                      fontSize="7.5"
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
                <circle cx="120" cy="520" r="14" fill="#14532d" stroke="#22c55e" strokeWidth="1.5" />
                <text x="120" y="524" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">SHV-01</text>

                {/* Crusher 1 Hopper */}
                <polygon points="565,35 595,35 605,65 555,65" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.5" />
                <text x="580" y="53" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">CRUSHER 1</text>

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
                        strokeWidth="2"
                        strokeDasharray="4,4"
                      />
                      <rect
                        x={midX - 28}
                        y={midY - 10}
                        width="56"
                        height="20"
                        fill="#000000"
                        stroke="#ef4444"
                        strokeWidth="1"
                        rx="2"
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        textAnchor="middle"
                        fill="#f87171"
                        fontSize="8"
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
                          fill={isHazard ? 'rgba(239, 68, 68, 0.15)' : 'none'}
                          stroke={markerColor}
                          strokeWidth="1"
                          strokeDasharray={isHazard ? 'none' : '3,3'}
                          opacity={isHazard ? 0.8 : 0.4}
                          className={isHazard ? 'animate-pulse' : ''}
                        />
                      )}

                      {/* Hazard Pulsing Envelope */}
                      {isHazard && (
                        <circle
                          cx={v.x}
                          cy={v.y}
                          r="22"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2"
                          filter="url(#hazardGlow)"
                          className="animate-ping"
                          style={{ animationDuration: '1.4s' }}
                        />
                      )}

                      {/* Vehicle Body Representation */}
                      <circle
                        cx={v.x}
                        cy={v.y}
                        r="10"
                        fill="#09090b"
                        stroke={markerColor}
                        strokeWidth="2"
                        className="transition-colors group-hover:stroke-white"
                      />

                      {/* Directional Heading Vector */}
                      <g transform={`translate(${v.x}, ${v.y}) rotate(${v.headingDeg})`}>
                        <polygon points="0,-14 4,-6 -4,-6" fill={markerColor} />
                      </g>

                      {/* Vehicle Label Tag */}
                      <rect
                        x={v.x - 22}
                        y={v.y - 24}
                        width="44"
                        height="12"
                        fill="#000000"
                        stroke={markerColor}
                        strokeWidth="1"
                        rx="1"
                        opacity="0.9"
                      />
                      <text
                        x={v.x}
                        y={v.y - 15}
                        textAnchor="middle"
                        fill={isHazard ? '#fca5a5' : '#ffffff'}
                        fontSize="7.5"
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
              <div className="absolute bottom-2 left-2 bg-black/80 border border-[#262626] p-2 flex flex-col gap-1 font-mono text-[8.5px] text-[#A3A3A3] backdrop-blur-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>LOADED UPHILL (RIGHT OF WAY)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span>EMPTY DOWNHILL (YIELDS TO BAY)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <span>HELD IN PASSING BAY</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span>CRITICAL CLOSING CONFLICT</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== RIGHT COLUMN (col-span-3) ==================== */}
        <div className="lg:col-span-3 flex flex-col gap-2">
          {/* VEHICLE ROSTER CARD */}
          <div className="bg-[#0A0A0B] border border-[#262626] flex flex-col overflow-hidden">
            <div className="px-3 py-2 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-mono font-bold text-[10px] text-blue-400 uppercase tracking-wider">
                  Live Fleet Roster ({vehicles.length})
                </span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="p-1.5 bg-black border-b border-[#222222] flex items-center gap-1 flex-wrap font-mono text-[8.5px]">
              {(['all', 'critical', 'warning', 'queued', 'hauling'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setStatusFilter(filterKey)}
                  className={`px-1.5 py-0.5 border uppercase cursor-pointer transition-colors ${
                    statusFilter === filterKey
                      ? 'bg-blue-600 text-white border-blue-400 font-bold'
                      : 'bg-[#141416] text-[#888888] border-[#262626] hover:text-white'
                  }`}
                >
                  {filterKey}
                </button>
              ))}
            </div>

            {/* Scrollable Vehicle List */}
            <div className="p-1.5 flex flex-col gap-1 max-h-[460px] overflow-y-auto font-mono text-[9.5px]">
              {filteredVehicles.map((v) => {
                const isConflict = v.hazardEnvelope;
                const isHeld = v.state === 'HELD_BY_MTC';

                return (
                  <div
                    key={v.id}
                    className={`p-2 bg-black border flex flex-col gap-1 transition-all ${
                      isConflict
                        ? 'border-red-500 bg-red-950/20'
                        : isHeld
                        ? 'border-yellow-600/70 bg-yellow-950/10'
                        : 'border-[#222222] hover:border-[#444444]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        onClick={() => onSelectVehicle(v)}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="font-bold text-white hover:text-blue-400">{v.id}</span>
                        <span className="text-[8px] text-[#888888]">({v.type})</span>
                        {isConflict && (
                          <span className="text-[8px] text-red-400 font-bold bg-red-950 px-1 border border-red-500 animate-pulse">
                            HAZARD
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-white font-bold">{v.speedKmh.toFixed(0)} km/h</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[8.5px] text-[#888888]">
                      <span>{v.material} ({v.payloadTons}T)</span>
                      <span>Stop: {v.dStopMeters}m</span>
                    </div>

                    {/* Quick MTC Control buttons */}
                    <div className="flex items-center gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => onSelectVehicle(v)}
                        className="flex-1 bg-[#18181A] hover:bg-[#222225] text-gray-300 text-[8.5px] py-0.5 border border-[#333333] cursor-pointer"
                      >
                        TELEMETRY
                      </button>

                      {isHeld ? (
                        <button
                          type="button"
                          disabled={!isDispatcher}
                          onClick={() => onClearVehicle(v.id)}
                          className="flex-1 bg-green-800 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[8.5px] font-bold py-0.5 border border-green-500 cursor-pointer"
                        >
                          CLEAR
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!isDispatcher}
                          onClick={() => onHoldVehicle(v.id)}
                          className="flex-1 bg-yellow-800 hover:bg-yellow-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[8.5px] font-bold py-0.5 border border-yellow-500 cursor-pointer"
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
