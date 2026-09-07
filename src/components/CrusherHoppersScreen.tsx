import React from 'react';
import { Factory, AlertTriangle, CheckCircle, Gauge, Activity } from 'lucide-react';
import { CRUSHERS } from '../data/mockMineData';

export const CrusherHoppersScreen: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 select-none text-[#E0E0E0] pb-6 font-sans">
      {/* Top Banner */}
      <div className="bg-[#0A0A0B] border border-[#333338] p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Factory className="w-5 h-5 text-blue-400" />
          <div className="flex flex-col">
            <span className="font-mono text-sm font-bold text-white uppercase tracking-wider">
              SURFACE RIM CRUSHER &amp; HOPPER DISCHARGE COMPLEX
            </span>
            <span className="font-mono text-xs text-slate-300 font-semibold">
              RL 1,280M • PRIMARY GYRATORY 01 &amp; SECONDARY JAW 02
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 bg-green-950 text-green-300 border border-green-500 font-bold">
            CONVEYOR SYSTEM NOMINAL
          </span>
        </div>
      </div>

      {/* 3 Hopper Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CRUSHERS.map((crusher) => (
          <div
            key={crusher.id}
            className="bg-[#0A0A0B] border border-[#333338] flex flex-col overflow-hidden"
          >
            <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
              <span className="font-mono font-bold text-xs text-blue-300 uppercase truncate">
                {crusher.name}
              </span>
              <span className="font-mono text-xs text-slate-300 bg-black px-2 py-0.5 border border-[#333338] font-medium">
                {crusher.type}
              </span>
            </div>

            <div className="p-3.5 flex flex-col gap-3 font-mono text-xs">
              {/* Hopper Level Gauge */}
              <div className="bg-black p-3 border border-[#2a2a30] flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 uppercase font-bold">HOPPER SURGE LEVEL:</span>
                  <span className={`font-bold ${crusher.capacityPercent > 80 ? 'text-red-300' : 'text-green-300'}`}>
                    {crusher.hopperLevelMeters}m ({crusher.capacityPercent}%)
                  </span>
                </div>
                <div className="w-full bg-[#18181A] h-3 border border-[#333338] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      crusher.capacityPercent > 80 ? 'bg-red-500' : crusher.capacityPercent > 65 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${crusher.capacityPercent}%` }}
                  />
                </div>
              </div>

              {/* Throughput & Feeder */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-black p-2.5 border border-[#2a2a30]">
                  <span className="text-slate-300 text-xs font-bold block">CURRENT TPH</span>
                  <span className="text-white text-lg font-bold block mt-0.5">
                    {crusher.currentTph}
                  </span>
                  <span className="text-slate-300 text-[11px] block font-medium">Target: {crusher.targetTph}</span>
                </div>

                <div className="bg-black p-2.5 border border-[#2a2a30]">
                  <span className="text-slate-300 text-xs font-bold block">APRON FEEDER</span>
                  <span className="text-yellow-300 text-lg font-bold block mt-0.5">
                    {crusher.apronFeederSpeed} m/s
                  </span>
                  <span className="text-slate-300 text-[11px] block font-medium">Speed Nom</span>
                </div>
              </div>

              {/* Active Tipping Status */}
              <div className="bg-black p-2.5 border border-[#2a2a30] flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-300 font-medium">ACTIVE TIPPING TRUCK:</span>
                  <span className="text-white font-bold">{crusher.activeTippingTruck}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300 font-medium">WAITING QUEUE:</span>
                  <span className="text-blue-300 font-bold">
                    {crusher.waitingTrucks.length > 0 ? crusher.waitingTrucks.join(', ') : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300 font-medium">ROCK BREAKER:</span>
                  <span className={crusher.rockBreakerActive ? 'text-yellow-300 font-bold' : 'text-slate-400 font-semibold'}>
                    {crusher.rockBreakerActive ? 'ENGAGED (OVERSIZE)' : 'STANDBY'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
