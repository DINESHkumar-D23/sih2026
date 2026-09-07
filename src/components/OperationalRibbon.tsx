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
      className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 mb-2 bg-[#0e0e12] border border-[#2a2a30] text-xs select-none"
    >
      {/* Weather & Road Hazard Telemetry */}
      <div className="flex flex-wrap items-center gap-2.5 md:gap-3.5">
        {weather.visibilityMeters <= 50 ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/50 border border-red-500">
            <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
            <span className="font-mono text-xs text-red-200 tracking-wider uppercase font-bold">
              PIT FOG: {weather.visibilityMeters}M VISIBILITY
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-950/60 border border-green-500">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span className="font-mono text-xs text-green-300 tracking-wider uppercase font-bold">
              VISIBILITY: {weather.visibilityMeters}M (CLEAR)
            </span>
          </div>
        )}

        {weather.lightningRisk !== 'LOW' && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-950/60 border border-yellow-500">
            <Zap className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
            <span className="font-mono text-xs text-yellow-200 font-bold uppercase">
              LIGHTNING: {weather.lightningRisk}
            </span>
          </div>
        )}

        <span className="text-[#555555] font-mono text-xs hidden sm:inline">|</span>

        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs text-slate-200">
          <span className="flex items-center gap-1">
            <Thermometer className="w-3.5 h-3.5 text-orange-400" />
            <span>TEMP:</span>
            <strong className="text-white font-bold ml-0.5">
              {weather.temperatureC.toFixed(1)}°C
            </strong>
          </span>

          <span className="text-[#555555]">•</span>

          <span className="flex items-center gap-1">
            <CloudRain className="w-3.5 h-3.5 text-blue-400" />
            <span>RAIN:</span>
            <strong className="text-yellow-300 font-bold ml-0.5">
              {weather.rainMmHr.toFixed(1)} mm/h
            </strong>
          </span>

          <span className="text-[#555555]">•</span>

          <span className="flex items-center gap-1">
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
            <span>HUMIDITY:</span>
            <strong className="text-white font-bold ml-0.5">
              {weather.relativeHumidity}%
            </strong>
          </span>

          <span className="text-[#555555]">•</span>

          <span className="flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            <span>HAUL SURFACE:</span>
            <strong className={`font-bold ml-1 ${isWet ? 'text-red-300' : 'text-green-300'}`}>
              μ={weather.frictionCoefficient.toFixed(2)} (SLIP LVL {slipLevel})
            </strong>
          </span>

          <span className="text-[#555555] hidden md:inline">•</span>

          <span className="hidden md:flex items-center gap-1">
            <Wind className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300">WIND:</span>
            <span className="text-white font-bold">{weather.windDirectionCompass} {weather.windSpeedKmh} KM/H (GUSTS {weather.windGustsKmh})</span>
          </span>

          <span className="text-[#555555] hidden lg:inline">•</span>

          <span className="hidden lg:flex items-center gap-1 text-slate-300">
            <span>BARO:</span>
            <span className="text-white font-bold">{weather.surfacePressureHpa.toFixed(0)} hPa</span>
          </span>
        </div>
      </div>

      {/* Safety Interlocks, Weather Details & Quick Broadcast */}
      <div className="flex items-center gap-2">
        {onOpenWeatherModal && (
          <button
            type="button"
            onClick={onOpenWeatherModal}
            className="flex items-center gap-1.5 bg-[#18181f] hover:bg-[#282834] text-cyan-200 border border-cyan-400 px-2.5 py-1 font-mono text-xs font-bold cursor-pointer transition-colors"
            title="Open comprehensive Pit Meteorological & Hydrology station"
          >
            <Cloud className="w-3.5 h-3.5 text-cyan-400" />
            <span>MET STATION</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 bg-black px-2.5 py-1 border border-[#444444]">
          <Gauge className="w-3.5 h-3.5 text-yellow-400" />
          <span className="font-mono text-xs text-slate-300 font-semibold">SPEED CAP:</span>
          <span className="font-mono text-xs text-yellow-300 font-bold">
            {speedLimitKmh} KM/H
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-black px-2.5 py-1 border border-red-500/70">
          <Shield className="w-3.5 h-3.5 text-red-400" />
          <span className="font-mono text-xs text-red-300 tracking-wider font-bold">
            INTERLOCK: AUTO-MTC
          </span>
        </div>

        {onOpenBroadcast && (
          <button
            type="button"
            onClick={onOpenBroadcast}
            className="flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-blue-200 border border-blue-400 px-2.5 py-1 font-mono text-xs font-bold cursor-pointer transition-colors"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>VHF CH 04</span>
          </button>
        )}
      </div>
    </div>
  );
};
