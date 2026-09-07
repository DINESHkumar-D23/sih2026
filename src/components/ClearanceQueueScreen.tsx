import React from 'react';
import { TrafficCone, AlertTriangle, ShieldCheck, ShieldAlert, CheckCircle, Navigation } from 'lucide-react';
import { VehicleTwin, ConflictIncident, UserRole } from '../types';
import { CHOKE_POINTS } from '../data/mockMineData';

interface ClearanceQueueScreenProps {
  vehicles: VehicleTwin[];
  activeConflict: ConflictIncident | null;
  onHoldVehicle: (vehicleId: string) => void;
  onClearVehicle: (vehicleId: string) => void;
  userRole?: UserRole;
}

export const ClearanceQueueScreen: React.FC<ClearanceQueueScreenProps> = ({
  vehicles,
  activeConflict,
  onHoldVehicle,
  onClearVehicle,
  userRole = 'dispatcher',
}) => {
  const isDispatcher = userRole === 'dispatcher';
  const heldVehicles = vehicles.filter((v) => v.state === 'HELD_BY_MTC');
  const hazardVehicles = vehicles.filter((v) => v.hazardEnvelope);

  return (
    <div className="flex flex-col gap-3 select-none text-[#E0E0E0] pb-6 font-sans">
      {/* Top Banner Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <div className="bg-[#0A0A0B] border border-[#333338] p-3.5 flex flex-col gap-1">
          <span className="font-mono text-xs text-slate-300 font-bold uppercase">
            CHOKE POINTS MONITORED
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl text-white font-bold">3</span>
            <span className="font-mono text-xs text-slate-300 font-bold">CRITICAL SECTORS</span>
          </div>
          <span className="font-mono text-xs text-yellow-300 font-semibold mt-1">
            Hairpin 3 Switchback (11% Incline) Active
          </span>
        </div>

        <div className="bg-[#0A0A0B] border border-[#333338] p-3.5 flex flex-col gap-1">
          <span className="font-mono text-xs text-slate-300 font-bold uppercase">
            ACTIVE MTC CONFLICTS
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={`font-mono text-2xl font-bold ${hazardVehicles.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {hazardVehicles.length > 0 ? '1 INTERLOCK' : '0 CLEAR'}
            </span>
          </div>
          <span className="font-mono text-xs text-slate-300 font-medium mt-1">
            {hazardVehicles.length > 0 ? 'Opposing headings on single lane' : 'All single lanes nominal'}
          </span>
        </div>

        <div className="bg-[#0A0A0B] border border-[#333338] p-3.5 flex flex-col gap-1">
          <span className="font-mono text-xs text-slate-300 font-bold uppercase">
            UNITS IN PASSING BAYS
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl text-yellow-300 font-bold">
              {heldVehicles.length}
            </span>
            <span className="font-mono text-xs text-slate-300 font-bold">DUMPERS HELD</span>
          </div>
          <span className="font-mono text-xs text-blue-300 font-semibold mt-1">
            Passing Bay 07-B (Alpha) &amp; Bay 04-A (Beta)
          </span>
        </div>
      </div>

      {/* Main Section: Choke Points & Dynamic Braking Physics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left 7 Columns: Choke Point Status */}
        <div className="lg:col-span-7 flex flex-col gap-2.5">
          <div className="bg-[#0A0A0B] border border-[#333338] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrafficCone className="w-4 h-4 text-yellow-400" />
                <span className="font-mono font-bold text-xs text-yellow-300 uppercase tracking-wider">
                  Choke Point Queues &amp; Passing Priority
                </span>
              </div>
            </div>

            <div className="p-3 flex flex-col gap-2.5 font-mono text-xs">
              {CHOKE_POINTS.map((cp) => (
                <div
                  key={cp.id}
                  className="bg-black p-3.5 border border-[#2a2a30] flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{cp.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 font-bold border ${
                          cp.status === 'WARNING'
                            ? 'bg-red-950 text-red-200 border-red-500 animate-pulse'
                            : cp.status === 'CAUTION'
                            ? 'bg-yellow-950 text-yellow-200 border-yellow-500'
                            : 'bg-green-950 text-green-300 border-green-500'
                        }`}
                      >
                        {cp.status}
                      </span>
                    </div>
                    <span className="text-slate-300 font-medium">Avg Wait: <strong className="text-white">{cp.avgWaitMins} min</strong></span>
                  </div>

                  <p className="text-slate-200 text-xs font-sans leading-relaxed">
                    {cp.description}
                  </p>

                  <div className="flex items-center justify-between pt-1.5 border-t border-[#222226] text-xs text-slate-300 font-semibold">
                    <span>LOCATION: {cp.bench}</span>
                    <span>QUEUE DEPTH: {cp.vehiclesInQueue} UNITS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Dynamic Stopping Formula Breakdown */}
        <div className="lg:col-span-5 flex flex-col gap-2.5">
          <div className="bg-[#0A0A0B] border border-[#333338] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-400" />
                <span className="font-mono font-bold text-xs text-blue-300 uppercase tracking-wider">
                  MTC Kinematic Braking Model
                </span>
              </div>
            </div>

            <div className="p-3.5 flex flex-col gap-3 font-mono text-xs">
              <div className="bg-black p-3 border border-[#2a2a30]">
                <span className="text-blue-300 font-bold block mb-1.5 text-xs">
                  PHYSICAL STOPPING DISTANCE FORMULA:
                </span>
                <code className="text-white block font-mono text-xs font-semibold bg-[#111113] p-2 border border-[#333338]">
                  d_stop = (v² / (2 · g · (μ ± θ))) + d_reaction
                </code>
                <div className="mt-2.5 text-slate-200 flex flex-col gap-1 text-xs font-medium">
                  <span>• v = Vehicle velocity (m/s)</span>
                  <span>• g = 9.81 m/s² (Gravitational constant)</span>
                  <span>• μ = Surface friction (0.35 Wet / 0.60 Dry)</span>
                  <span>• θ = 0.11 (11% Incline Grade)</span>
                  <span>• d_reaction = 10 meters (Buffer margin)</span>
                </div>
              </div>

              {/* Table of active vehicles with stopping distances */}
              <div className="bg-black border border-[#2a2a30] p-2.5 flex flex-col gap-1.5">
                <span className="text-slate-300 font-bold uppercase text-xs">
                  ACTIVE FLEET CALIBRATION:
                </span>
                {vehicles.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-1 border-b border-[#222226] text-xs">
                    <span className="text-white font-bold">{v.id}</span>
                    <span className="text-slate-300 font-medium">{v.direction === 1 ? 'Uphill (+11%)' : 'Downhill (-11%)'}</span>
                    <span className="text-yellow-300 font-bold">{v.speedKmh.toFixed(0)} km/h</span>
                    <span className="text-orange-300 font-bold">{v.dStopMeters}m d_stop</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
