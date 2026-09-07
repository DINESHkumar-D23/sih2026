import React, { useEffect } from 'react';
import { X, Truck, AlertTriangle, ShieldCheck, Gauge, Thermometer, Radio, Navigation, ShieldAlert } from 'lucide-react';
import { VehicleTwin, UserRole } from '../types';

interface VehicleDetailModalProps {
  vehicle: VehicleTwin | null;
  onClose: () => void;
  onHold: (id: string) => void;
  onClear: (id: string) => void;
  userRole?: UserRole;
}

export const VehicleDetailModal: React.FC<VehicleDetailModalProps> = ({
  vehicle,
  onClose,
  onHold,
  onClear,
  userRole = 'dispatcher',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (vehicle) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vehicle, onClose]);

  if (!vehicle) return null;

  const isDispatcher = userRole === 'dispatcher';
  const approxRL = Math.round(1040 + vehicle.pathProgress * 240);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vehicle-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none"
    >
      <div className="w-full max-w-lg bg-[#0A0A0B] border border-[#262626] shadow-2xl overflow-hidden text-[#E0E0E0]">
        {/* Modal Header */}
        <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-black border border-blue-400">
              <Truck className="w-5 h-5 text-blue-400" aria-hidden="true" />
            </div>
            <div>
              <div id="vehicle-detail-title" className="font-mono text-sm font-bold text-white flex items-center gap-2">
                {vehicle.id} // {vehicle.label}
                {vehicle.hazardEnvelope && (
                  <span className="bg-red-950 text-red-200 text-xs px-2 py-0.5 font-bold border border-red-500 animate-pulse">
                    CONFLICT ALERT
                  </span>
                )}
                {vehicle.state === 'HELD_BY_MTC' && (
                  <span className="bg-yellow-950 text-yellow-200 text-xs px-2 py-0.5 font-bold border border-yellow-500">
                    HELD BY MTC
                  </span>
                )}
                {vehicle.state === 'INCLINE_HAUL' && (
                  <span className="bg-[#0F0F10] text-blue-300 text-xs px-2 py-0.5 font-bold border border-blue-500">
                    INCLINE HAUL
                  </span>
                )}
                {vehicle.state === 'EMPTY' && (
                  <span className="bg-[#0F0F10] text-green-300 text-xs px-2 py-0.5 font-bold border border-green-500">
                    DESCENDING EMPTY
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-slate-300 font-semibold mt-0.5">
                OPERATOR: {vehicle.operator} ({vehicle.operatorContact}) • RL {approxRL}M
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close vehicle telemetry modal"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-[#1e1e24] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 flex flex-col gap-3">
          {/* Proximity / Conflict warning if present */}
          {vehicle.hazardEnvelope && (
            <div className="p-3 bg-red-950/50 border border-red-500 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs font-mono">
                <span className="text-red-300 font-bold">HAZARD INTERCEPT: </span>
                <span className="text-white font-medium">
                  Closing distance {vehicle.uwbDistM}m on single-lane haul ramp. Stopping distance envelope required: {vehicle.dStopMeters}m.
                  {vehicle.mustHoldByMTC ? ' MTC designates this unit MUST HOLD in passing bay.' : ' This unit has uphill right-of-way.'}
                </span>
              </div>
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-black p-2.5 border border-[#2a2a30]">
              <span className="font-mono text-xs text-slate-300 block uppercase font-bold">PAYLOAD &amp; GRADE</span>
              <span className="font-mono text-lg text-white font-bold block mt-0.5">
                {vehicle.payloadTons} T
              </span>
              <span className="font-mono text-xs text-blue-300 font-semibold block mt-0.5 truncate">
                {vehicle.material}
              </span>
            </div>

            <div className="bg-black p-2.5 border border-[#2a2a30]">
              <span className="font-mono text-xs text-slate-300 block uppercase font-bold">CURRENT SPEED</span>
              <span className={`font-mono text-lg font-bold block mt-0.5 ${vehicle.speedKmh > vehicle.maxSpeedLimit ? 'text-red-300' : 'text-yellow-300'}`}>
                {vehicle.speedKmh.toFixed(1)} km/h
              </span>
              <span className="font-mono text-xs text-slate-300 font-medium block mt-0.5">
                Cap: {vehicle.maxSpeedLimit} km/h
              </span>
            </div>

            <div className="bg-black p-2.5 border border-[#2a2a30]">
              <span className="font-mono text-xs text-slate-300 block uppercase font-bold">CALC STOPPING DIST</span>
              <span className="font-mono text-lg text-orange-300 font-bold block mt-0.5">
                {vehicle.dStopMeters} M
              </span>
              <span className="font-mono text-xs text-slate-300 font-medium block mt-0.5">
                Grade: {vehicle.direction === 1 ? '+11%' : '-11%'}
              </span>
            </div>
          </div>

          {/* Secondary Telemetry Grid */}
          <div className="grid grid-cols-3 gap-2 font-mono text-xs">
            <div className="bg-black p-2.5 border border-[#2a2a30]">
              <span className="text-slate-300 block font-bold">RETARDER STATUS</span>
              <span className={`font-bold text-sm mt-1 block ${vehicle.retarderStatus === 'Engaged' ? 'text-yellow-300' : 'text-green-300'}`}>
                {vehicle.retarderStatus}
              </span>
            </div>

            <div className="bg-black p-2.5 border border-[#2a2a30]">
              <span className="text-slate-300 block font-bold">TIRE TEMP</span>
              <span className="text-white font-bold text-sm mt-1 block">
                {vehicle.tireTempC}°C
              </span>
            </div>

            <div className="bg-black p-2.5 border border-[#2a2a30]">
              <span className="text-slate-300 block font-bold">PASSING BAY</span>
              <span className={`font-bold text-sm mt-1 block ${vehicle.inPassingBay ? 'text-blue-300' : 'text-slate-400'}`}>
                {vehicle.inPassingBay ? 'DOCKED IN BAY' : 'ON MAIN RAMP'}
              </span>
            </div>
          </div>

          {/* Path progress bar */}
          <div className="bg-black p-3 border border-[#2a2a30] flex flex-col gap-1.5">
            <div className="flex justify-between font-mono text-xs text-slate-300 font-semibold">
              <span>PIT FLOOR BENCH 09 (RL 1040M)</span>
              <span className="text-white font-bold">PROGRESS: {(vehicle.pathProgress * 100).toFixed(1)}%</span>
              <span>CRUSHER 1 HOPPER (RL 1280M)</span>
            </div>
            <div className="w-full bg-[#18181A] h-2.5 border border-[#333338] overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${Math.max(2, vehicle.pathProgress * 100)}%` }}
              />
            </div>
          </div>

          {!isDispatcher && (
            <div className="p-2.5 bg-[#18181A] border border-yellow-600/50 text-xs font-mono text-yellow-300 flex items-center gap-2 font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Observer Mode Active — Dispatcher credentials required to issue override directives.
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-3 bg-[#0F0F10] border-t border-[#333338] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#18181A] hover:bg-black text-slate-200 font-mono text-xs font-bold py-2 px-4 border border-[#44444c] cursor-pointer transition-colors"
          >
            DISMISS
          </button>

          <div className="flex items-center gap-2">
            {vehicle.state === 'HELD_BY_MTC' ? (
              <button
                type="button"
                disabled={!isDispatcher}
                onClick={() => {
                  onClear(vehicle.id);
                  onClose();
                }}
                className="bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono text-xs font-bold py-2 px-4 border border-green-400 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                CLEAR FOR DEPARTURE
              </button>
            ) : (
              <button
                type="button"
                disabled={!isDispatcher}
                onClick={() => {
                  onHold(vehicle.id);
                  onClose();
                }}
                className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-mono text-xs font-bold py-2 px-4 border border-yellow-400 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <AlertTriangle className="w-4 h-4" />
                COMMAND MTC HOLD IN BAY
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
