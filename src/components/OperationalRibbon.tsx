import React from 'react';
import { Shield, Gauge, CloudRain, Wind, AlertOctagon, Megaphone, Droplets, Thermometer, Zap, Cloud } from 'lucide-react';
import { WeatherData } from '../types';

interface OperationalRibbonProps {
  weather: WeatherData;
  speedLimitKmh?: number;
  onOpenBroadcast?: () => void;
  onOpenWeatherModal?: () => void;
}

export const OperationalRibbon: React.FC<OperationalRibbonProps> = ({
  weather,
  speedLimitKmh = 15,
  onOpenBroadcast,
  onOpenWeatherModal,
}) => {
  const isWet = weather.surfaceCondition === 'Wet' || weather.rainMmHr > 1.0;
  const slipLevel = isWet ? (weather.rainMmHr > 10 ? 5 : 4) : 1;

  return (
    <div
      role="region"
      aria-label="Environmental and road surface telemetry"
      className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 mb-2 bg-[#0F0F10] border border-[#262626] text-xs select-none"
    >
      {/* Weather & Road Hazard Telemetry */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {weather.visibilityMeters <= 50 ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#991b1b]/20 border border-[#ef4444]/50">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
            <span className="font-mono text-[9.5px] text-red-400 tracking-wider uppercase font-bold">
              PIT FOG: {weather.visibilityMeters}M VISIBILITY
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-950/20 border border-green-500/50">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="font-mono text-[9.5px] text-green-400 tracking-wider uppercase font-bold">
              VISIBILITY: {weather.visibilityMeters}M (CLEAR)
            </span>
          </div>
        )}

        {weather.lightningRisk !== 'LOW' && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-950/40 border border-yellow-500/50">
            <Zap className="w-2.5 h-2.5 text-yellow-400 animate-pulse" />
            <span className="font-mono text-[9px] text-yellow-300 font-bold uppercase">
              LIGHTNING: {weather.lightningRisk}
            </span>
          </div>
        )}

        <span className="text-[#333333] font-mono text-[10px] hidden sm:inline">|</span>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[9.5px] text-[#A3A3A3]">
          <span className="flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-orange-400" />
            TEMP:
            <strong className="text-white font-semibold ml-0.5">
              {weather.temperatureC.toFixed(1)}°C
            </strong>
          </span>

          <span className="text-[#333333]">•</span>

          <span className="flex items-center gap-1">
            <CloudRain className="w-3 h-3 text-blue-400" />
            RAIN:
            <strong className="text-yellow-400 font-semibold ml-0.5">
              {weather.rainMmHr.toFixed(1)} mm/h
            </strong>
          </span>

          <span className="text-[#333333]">•</span>

          <span className="flex items-center gap-1">
            <Droplets className="w-3 h-3 text-cyan-400" />
            HUMIDITY:
            <strong className="text-white font-semibold ml-0.5">
              {weather.relativeHumidity}%
            </strong>
          </span>

          <span className="text-[#333333]">•</span>

          <span className="flex items-center gap-1">
            <AlertOctagon className="w-3 h-3 text-red-400" />
            HAUL SURFACE:
            <strong className={`font-semibold ml-0.5 ${isWet ? 'text-red-400' : 'text-green-400'}`}>
              μ={weather.frictionCoefficient.toFixed(2)} (SLIP LVL {slipLevel})
            </strong>
          </span>

          <span className="text-[#333333] hidden md:inline">•</span>

          <span className="hidden md:flex items-center gap-1">
            <Wind className="w-3 h-3 text-[#888888]" />
            WIND: <span className="text-[#E0E0E0]">{weather.windDirectionCompass} {weather.windSpeedKmh} KM/H (GUSTS {weather.windGustsKmh})</span>
          </span>

          <span className="text-[#333333] hidden lg:inline">•</span>

          <span className="hidden lg:flex items-center gap-1 text-[#888888]">
            BARO: <span className="text-[#CCCCCC]">{weather.surfacePressureHpa.toFixed(0)} hPa</span>
          </span>
        </div>
      </div>

      {/* Safety Interlocks, Weather Details & Quick Broadcast */}
      <div className="flex items-center gap-1.5">
        {onOpenWeatherModal && (
          <button
            type="button"
            onClick={onOpenWeatherModal}
            className="flex items-center gap-1 bg-[#1A1A1E] hover:bg-[#2A2A30] text-cyan-300 border border-cyan-500/40 px-2 py-0.5 font-mono text-[8.5px] font-bold cursor-pointer transition-colors"
            title="Open comprehensive Pit Meteorological & Hydrology station"
          >
            <Cloud className="w-2.5 h-2.5 text-cyan-400" />
            <span>MET STATION</span>
          </button>
        )}

        <div className="flex items-center gap-1 bg-black px-2 py-0.5 border border-[#333333]">
          <Gauge className="w-2.5 h-2.5 text-yellow-400" />
          <span className="font-mono text-[8.5px] text-[#888888]">SPEED CAP:</span>
          <span className="font-mono text-[9px] text-yellow-400 font-bold">
            {speedLimitKmh} KM/H
          </span>
        </div>

        <div className="flex items-center gap-1 bg-black px-2 py-0.5 border border-[#ef4444]/40">
          <Shield className="w-2.5 h-2.5 text-red-400" />
          <span className="font-mono text-[8.5px] text-red-400 tracking-wider font-bold">
            INTERLOCK: AUTO-MTC
          </span>
        </div>

        {onOpenBroadcast && (
          <button
            type="button"
            onClick={onOpenBroadcast}
            className="flex items-center gap-1 bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-500/50 px-2 py-0.5 font-mono text-[8.5px] font-bold cursor-pointer transition-colors"
          >
            <Megaphone className="w-2.5 h-2.5" />
            <span>VHF CH 04</span>
          </button>
        )}
      </div>
    </div>
  );
};
