import React from 'react';
import { Factory, AlertTriangle, CheckCircle, Gauge, Activity } from 'lucide-react';
import { CRUSHERS } from '../data/mockMineData';

export const CrusherHoppersScreen: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 select-none text-[#E0E0E0] pb-6 font-sans">
      {/* Top Banner */}
      <div className="bg-[#0A0A0B] border border-[#262626] p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Factory className="w-5 h-5 text-blue-400" />
          <div className="flex flex-col">
            <span className="font-mono text-[12px] font-bold text-white uppercase tracking-wider">
              SURFACE RIM CRUSHER &amp; HOPPER DISCHARGE COMPLEX
            </span>
            <span className="font-mono text-[9px] text-[#888888]">
              RL 1,280M • PRIMARY GYRATORY 01 &amp; SECONDARY JAW 02
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[9.5px]">
          <span className="px-2 py-1 bg-green-950/80 text-green-400 border border-green-600 font-bold">
            CONVEYOR SYSTEM NOMINAL
          </span>
        </div>
      </div>

      {/* 3 Hopper Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CRUSHERS.map((crusher) => (
          <div
            key={crusher.id}
            className="bg-[#0A0A0B] border border-[#262626] flex flex-col overflow-hidden"
          >
            <div className="px-3 py-2 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
              <span className="font-mono font-bold text-[10.5px] text-blue-400 uppercase truncate">
                {crusher.name}
              </span>
              <span className="font-mono text-[8.5px] text-[#888888] bg-black px-1.5 py-0.2 border border-[#333333]">
                {crusher.type}
              </span>
            </div>

            <div className="p-3 flex flex-col gap-3 font-mono text-[10px]">
              {/* Hopper Level Gauge */}
              <div className="bg-black p-2.5 border border-[#222222] flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[9px]">
                  <span className="text-[#888888] uppercase font-bold">HOPPER SURGE LEVEL:</span>
                  <span className={`font-bold ${crusher.capacityPercent > 80 ? 'text-red-400' : 'text-green-400'}`}>
                    {crusher.hopperLevelMeters}m ({crusher.capacityPercent}%)
                  </span>
                </div>
                <div className="w-full bg-[#18181A] h-2.5 border border-[#333333] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      crusher.capacityPercent > 80 ? 'bg-red-500' : crusher.capacityPercent > 65 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${crusher.capacityPercent}%` }}
                  />
                </div>
              </div>

              {/* Throughput & Feeder */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-black p-2 border border-[#222222]">
                  <span className="text-[#888888] text-[8.5px] block">CURRENT TPH</span>
                  <span className="text-white text-[15px] font-bold block mt-0.5">
                    {crusher.currentTph}
                  </span>
                  <span className="text-[#888888] text-[8px] block">Target: {crusher.targetTph}</span>
                </div>

                <div className="bg-black p-2 border border-[#222222]">
                  <span className="text-[#888888] text-[8.5px] block">APRON FEEDER</span>
                  <span className="text-yellow-400 text-[15px] font-bold block mt-0.5">
                    {crusher.apronFeederSpeed} m/s
                  </span>
                  <span className="text-[#888888] text-[8px] block">Speed Nom</span>
                </div>
              </div>

              {/* Active Tipping Status */}
              <div className="bg-black p-2 border border-[#222222] flex flex-col gap-1 text-[9px]">
                <div className="flex justify-between">
                  <span className="text-[#888888]">ACTIVE TIPPING TRUCK:</span>
                  <span className="text-white font-bold">{crusher.activeTippingTruck}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">WAITING QUEUE:</span>
                  <span className="text-blue-400">
                    {crusher.waitingTrucks.length > 0 ? crusher.waitingTrucks.join(', ') : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">ROCK BREAKER:</span>
                  <span className={crusher.rockBreakerActive ? 'text-yellow-400 font-bold' : 'text-[#666666]'}>
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
