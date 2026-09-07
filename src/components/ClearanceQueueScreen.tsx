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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="bg-[#0A0A0B] border border-[#262626] p-3 flex flex-col gap-1">
          <span className="font-mono text-[9px] text-[#888888] font-bold uppercase">
            CHOKE POINTS MONITORED
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[22px] text-white font-light">3</span>
            <span className="font-mono text-[10px] text-[#888888]">CRITICAL SECTORS</span>
          </div>
          <span className="font-mono text-[9px] text-yellow-400 mt-1">
            Hairpin 3 Switchback (11% Incline) Active
          </span>
        </div>

        <div className="bg-[#0A0A0B] border border-[#262626] p-3 flex flex-col gap-1">
          <span className="font-mono text-[9px] text-[#888888] font-bold uppercase">
            ACTIVE MTC CONFLICTS
          </span>
          <div className="flex items-baseline gap-1">
            <span className={`font-mono text-[22px] font-light ${hazardVehicles.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {hazardVehicles.length > 0 ? '1 INTERLOCK' : '0 CLEAR'}
            </span>
          </div>
          <span className="font-mono text-[9px] text-[#888888] mt-1">
            {hazardVehicles.length > 0 ? 'Opposing headings on single lane' : 'All single lanes nominal'}
          </span>
        </div>

        <div className="bg-[#0A0A0B] border border-[#262626] p-3 flex flex-col gap-1">
          <span className="font-mono text-[9px] text-[#888888] font-bold uppercase">
            UNITS IN PASSING BAYS
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[22px] text-yellow-400 font-light">
              {heldVehicles.length}
            </span>
            <span className="font-mono text-[10px] text-[#888888]">DUMPERS HELD</span>
          </div>
          <span className="font-mono text-[9px] text-blue-400 mt-1">
            Passing Bay 07-B (Alpha) &amp; Bay 04-A (Beta)
          </span>
        </div>
      </div>

      {/* Main Section: Choke Points & Dynamic Braking Physics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left 7 Columns: Choke Point Status */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          <div className="bg-[#0A0A0B] border border-[#262626] overflow-hidden">
            <div className="px-3 py-2 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrafficCone className="w-3.5 h-3.5 text-yellow-400" />
                <span className="font-mono font-bold text-[10.5px] text-yellow-400 uppercase tracking-wider">
                  Choke Point Queues &amp; Passing Priority
                </span>
              </div>
            </div>

            <div className="p-3 flex flex-col gap-2 font-mono text-[10px]">
              {CHOKE_POINTS.map((cp) => (
                <div
                  key={cp.id}
                  className="bg-black p-3 border border-[#222222] flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-[11px]">{cp.name}</span>
                      <span
                        className={`text-[8.5px] px-1.5 py-0.2 font-bold border ${
                          cp.status === 'WARNING'
                            ? 'bg-red-950 text-red-400 border-red-500 animate-pulse'
                            : cp.status === 'CAUTION'
                            ? 'bg-yellow-950 text-yellow-400 border-yellow-500'
                            : 'bg-green-950 text-green-400 border-green-500'
                        }`}
                      >
                        {cp.status}
                      </span>
                    </div>
                    <span className="text-[#888888]">Avg Wait: {cp.avgWaitMins} min</span>
                  </div>

                  <p className="text-[#A3A3A3] text-[9.5px] font-sans leading-relaxed">
                    {cp.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-[#18181A] text-[9px] text-[#666666]">
                    <span>LOCATION: {cp.bench}</span>
                    <span>QUEUE DEPTH: {cp.vehiclesInQueue} UNITS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Dynamic Stopping Formula Breakdown */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          <div className="bg-[#0A0A0B] border border-[#262626] overflow-hidden">
            <div className="px-3 py-2 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-mono font-bold text-[10.5px] text-blue-400 uppercase tracking-wider">
                  MTC Kinematic Braking Model
                </span>
              </div>
            </div>

            <div className="p-3 flex flex-col gap-2.5 font-mono text-[9.5px]">
              <div className="bg-black p-2.5 border border-[#222222]">
                <span className="text-blue-400 font-bold block mb-1">
                  PHYSICAL STOPPING DISTANCE FORMULA:
                </span>
                <code className="text-[#CCCCCC] block font-mono text-[10px] bg-[#111113] p-1.5 border border-[#333333]">
                  d_stop = (v² / (2 · g · (μ ± θ))) + d_reaction
                </code>
                <div className="mt-2 text-[#888888] flex flex-col gap-1 text-[8.5px]">
                  <span>• v = Vehicle velocity (m/s)</span>
                  <span>• g = 9.81 m/s² (Gravitational constant)</span>
                  <span>• μ = Surface friction (0.35 Wet / 0.60 Dry)</span>
                  <span>• θ = 0.11 (11% Incline Grade)</span>
                  <span>• d_reaction = 10 meters (Buffer margin)</span>
                </div>
              </div>

              {/* Table of active vehicles with stopping distances */}
              <div className="bg-black border border-[#222222] p-2 flex flex-col gap-1">
                <span className="text-[#888888] font-bold uppercase text-[8.5px]">
                  ACTIVE FLEET CALIBRATION:
                </span>
                {vehicles.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-0.5 border-b border-[#18181A] text-[9px]">
                    <span className="text-white font-bold">{v.id}</span>
                    <span className="text-[#888888]">{v.direction === 1 ? 'Uphill (+11%)' : 'Downhill (-11%)'}</span>
                    <span className="text-yellow-400">{v.speedKmh.toFixed(0)} km/h</span>
                    <span className="text-orange-400 font-bold">{v.dStopMeters}m d_stop</span>
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
