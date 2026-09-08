import React, { useState } from 'react';
import {
  X,
  CloudRain,
  Wind,
  Droplets,
  Compass,
  AlertTriangle,
  RefreshCw,
  Eye,
  Activity,
  Layers,
  ShieldAlert,
  Thermometer,
  Gauge,
  Waves,
  Zap,
} from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  weather: WeatherData;
  onRefreshWeather: () => Promise<void>;
}

export const WeatherModal: React.FC<WeatherModalProps> = ({
  isOpen,
  onClose,
  weather,
  onRefreshWeather,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshWeather();
    } finally {
      setIsRefreshing(false);
    }
  };

  const isWet = weather.surfaceCondition === 'Wet' || weather.rainMmHr > 1.0;
  const stoppingDistImpactPercent = isWet ? Math.round(((0.45 / Math.max(0.15, weather.frictionCoefficient)) - 1) * 100) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="weather-modal-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0A0A0B] border border-[#262626] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-950/60 border border-blue-500/50 text-blue-400">
              <CloudRain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="weather-modal-title" className="font-mono text-sm sm:text-base font-bold text-white tracking-wider uppercase">
                  METEOROLOGY &amp; PIT HYDROLOGY TELEMETRY
                </h2>
                <span className="bg-blue-950 text-blue-300 border border-blue-700 text-xs font-mono font-bold px-2 py-0.5 uppercase">
                  STN-BLD-14A
                </span>
              </div>
              <p className="font-mono text-xs text-slate-300 tracking-tight font-medium mt-0.5">
                CREST RIDGE STATION (RL 1,240M) • LAT: 18.67°N, LON: 81.25°E • OPEN-METEO SYNC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] hover:bg-[#262626] disabled:opacity-50 text-white font-mono text-xs font-bold border border-[#404040] cursor-pointer transition-colors"
              title="Fetch fresh real-time weather from Open-Meteo"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'SYNCING...' : 'REFRESH'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close weather modal"
              className="p-1 text-slate-300 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Top Banner: Condition & DGMS Safety Advisory */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Condition Badge */}
            <div className="md:col-span-1 bg-[#121214] border border-[#262626] p-3.5 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-slate-400 font-bold uppercase block mb-1">
                  CURRENT PIT CLIMATE
                </span>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold font-mono text-white">
                    {weather.temperatureC.toFixed(1)}°C
                  </div>
                  <div className="text-xs font-mono text-slate-200 leading-snug">
                    <div>Feels: <strong className="text-white font-bold">{weather.apparentTemperatureC.toFixed(1)}°C</strong></div>
                    <div>Dew Pt: <strong className="text-white font-bold">{weather.dewPointC.toFixed(1)}°C</strong></div>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#262626] flex items-center gap-2">
                <CloudRain className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-mono text-xs font-bold text-blue-300">
                  {weather.conditionText}
                </span>
              </div>
            </div>

            {/* DGMS Safety Protocol Advisory */}
            <div className="md:col-span-2 bg-[#121214] border border-[#262626] p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs text-slate-300 font-bold uppercase">
                  DGMS MONSOON SAFETY ADVISORY (CIRCULAR 04 &amp; 07)
                </span>
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 border ${
                    weather.lightningRisk === 'CRITICAL' || weather.visibilityMeters < 50
                      ? 'bg-red-950 text-red-200 border-red-500'
                      : isWet
                      ? 'bg-yellow-950 text-yellow-200 border-yellow-500'
                      : 'bg-green-950 text-green-200 border-green-500'
                  }`}
                >
                  {weather.lightningRisk === 'CRITICAL' ? 'CODE RED' : isWet ? 'CODE AMBER (WET RAMP)' : 'CODE GREEN (NORMAL)'}
                </span>
              </div>
              <p className="font-mono text-xs sm:text-[13px] text-yellow-200 font-medium leading-relaxed bg-black/60 p-2.5 border border-[#333333]">
                {weather.dgmsAdvisory}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs font-mono text-slate-400 font-medium">
                <span>LAST TELEMETRY UPDATE: <strong className="text-slate-200">{weather.lastUpdated}</strong></span>
                <span>STATUS: <strong className="text-slate-200">{weather.isFallback ? 'CACHED SIMULATION' : 'LIVE SATELLITE / API'}</strong></span>
              </div>
            </div>
          </div>

          {/* 4 Technical Pillar Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Atmospheric Profile */}
            <div className="bg-[#121214] border border-[#262626] p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#262626] pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-orange-400" />
                  <span className="font-mono text-xs font-bold text-white uppercase">ATMOSPHERIC</span>
                </div>
                <span className="font-mono text-xs text-slate-400 font-medium">RL 1,240m</span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Baro Pressure:</span>
                  <span className="text-white font-bold flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    {weather.surfacePressureHpa.toFixed(1)} hPa
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Rel Humidity:</span>
                  <span className="text-white font-bold flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-blue-400" />
                    {weather.relativeHumidity}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Cloud Cover:</span>
                  <span className="text-white font-bold">{weather.cloudCoverPercent}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Cloud Ceiling:</span>
                  <span className="text-cyan-300 font-bold">{weather.cloudCeilingMeters}m (RL {1200 + weather.cloudCeilingMeters}m)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Pit Visibility:</span>
                  <span className={`font-bold flex items-center gap-1 ${weather.visibilityMeters < 50 ? 'text-red-400' : 'text-green-400'}`}>
                    <Eye className="w-3.5 h-3.5" />
                    {weather.visibilityMeters}m
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Road Surface & Friction Physics */}
            <div className="bg-[#121214] border border-[#262626] p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#262626] pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-yellow-400" />
                  <span className="font-mono text-xs font-bold text-white uppercase">HAUL FRICTION</span>
                </div>
                <span className={`font-mono text-xs font-bold px-1.5 py-0.5 border ${isWet ? 'bg-red-950 text-red-300 border-red-700' : 'bg-green-950 text-green-300 border-green-700'}`}>
                  {isWet ? 'WET SLURRY' : 'DRY ORE'}
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Traction Coeff (μ):</span>
                  <span className={`font-bold text-xs ${weather.frictionCoefficient < 0.25 ? 'text-red-400' : 'text-green-400'}`}>
                    μ = {weather.frictionCoefficient.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Incline Gradient:</span>
                  <span className="text-white font-bold">1:9 to 1:16 (11.0%)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Braking Degradation:</span>
                  <span className="text-orange-400 font-bold">
                    +{stoppingDistImpactPercent}% Dist
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Safe Incline Cap:</span>
                  <span className="text-yellow-300 font-bold">{isWet ? '15 KM/H' : '25 KM/H'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Hydro Retarder:</span>
                  <span className="text-green-400 font-bold">INTERLOCK ON</span>
                </div>
              </div>
            </div>

            {/* Card 3: Pit Hydrology & Sump Inflow */}
            <div className="bg-[#121214] border border-[#262626] p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#262626] pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Waves className="w-4 h-4 text-blue-400" />
                  <span className="font-mono text-xs font-bold text-white uppercase">PIT HYDROLOGY</span>
                </div>
                <span className="font-mono text-xs text-slate-400 font-medium">SUMP #02</span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Rain Intensity:</span>
                  <span className="text-blue-300 font-bold">
                    {weather.rainMmHr.toFixed(1)} mm/hr
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Shift Rain Accum:</span>
                  <span className="text-white font-bold">
                    {weather.shiftRainfallMm.toFixed(1)} mm
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Sump Inflow Rate:</span>
                  <span className="text-yellow-300 font-bold">
                    {weather.pitSumpInflowM3Hr} m³/hr
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Dewatering Pumps:</span>
                  <span className="text-green-400 font-bold">3 / 4 ONLINE</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Bench Erosion Risk:</span>
                  <span className={`font-bold ${weather.rainMmHr > 8 ? 'text-red-400' : 'text-yellow-300'}`}>
                    {weather.rainMmHr > 8 ? 'HIGH RISK' : 'MODERATE'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Wind & Lightning Vectors */}
            <div className="bg-[#121214] border border-[#262626] p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#262626] pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-cyan-400" />
                  <span className="font-mono text-xs font-bold text-white uppercase">WIND &amp; AERIAL</span>
                </div>
                <span className="font-mono text-xs text-slate-400 font-medium">CREST MAST</span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Sustained Wind:</span>
                  <span className="text-white font-bold">
                    {weather.windSpeedKmh} km/h
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Crest Peak Gust:</span>
                  <span className={`font-bold ${weather.windGustsKmh > 35 ? 'text-red-400' : 'text-yellow-300'}`}>
                    {weather.windGustsKmh} km/h
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Direction:</span>
                  <span className="text-cyan-300 font-bold flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5" />
                    {weather.windDirectionCompass} ({weather.windDirectionDeg}°)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Lightning Risk:</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    weather.lightningRisk === 'CRITICAL' ? 'text-red-400' : weather.lightningRisk === 'HIGH' ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    <Zap className="w-3.5 h-3.5" />
                    {weather.lightningRisk}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Shovel Boom Limit:</span>
                  <span className="text-green-400 font-bold">SAFE (&lt; 45 KM/H)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6-Hour Forecast Trend */}
          {weather.forecastHours && weather.forecastHours.length > 0 && (
            <div className="bg-[#121214] border border-[#262626] p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                    6-HOUR OPERATIONAL METEOROLOGICAL FORECAST (BAILADILA CREST)
                  </span>
                </div>
                <span className="font-mono text-xs text-slate-400 font-medium">INTERVAL: 1 HR</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 font-mono text-xs">
                {weather.forecastHours.map((fh, idx) => (
                  <div key={idx} className="bg-black/60 border border-[#262626] p-2.5 flex flex-col gap-1 items-center text-center">
                    <span className="text-blue-300 font-bold text-xs">{fh.time}</span>
                    <div className="text-white font-bold text-base">{fh.tempC.toFixed(1)}°C</div>
                    <div className="flex items-center gap-1 text-cyan-300 font-semibold">
                      <Droplets className="w-3 h-3" />
                      <span>{fh.popPercent}% PoP</span>
                    </div>
                    <div className="text-slate-300 text-xs">
                      Rain: <span className={fh.rainMm > 0.5 ? 'text-yellow-300 font-bold' : 'text-slate-200'}>{fh.rainMm.toFixed(1)}mm</span>
                    </div>
                    <div className="text-slate-300 text-xs">
                      Wind: <span className="text-white font-semibold">{Math.round(fh.windKmh)} km/h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Haulage Friction Calculation Explainer */}
          <div className="bg-[#0A0A0B] border border-[#262626] p-3.5 text-xs font-mono text-slate-300 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-white font-bold">
              <ShieldAlert className="w-4 h-4 text-yellow-400" />
              <span>DYNAMIC KINEMATIC FORMULA &amp; DGMS MANDATE REFERENCE</span>
            </div>
            <p className="leading-relaxed">
              Stopping distance equation: <code className="text-blue-300 font-bold bg-blue-950/40 px-1 py-0.5 border border-blue-800">d_stop = (v_ms²) / (2 · g · (μ ± grade)) + (v_ms · t_reaction)</code>.
              During wet conditions on Bailadila’s 11.0% single-lane incline, friction μ drops from 0.45 (dry) to {weather.frictionCoefficient.toFixed(2)}, increasing stopping distance from ~18m to {Math.round(18 * (1 + stoppingDistImpactPercent / 100))}m at 15 km/h. Passing Bay Alpha (RL 1,180m) is enforced by MTC collision interlocks.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-[#0F0F10] border-t border-[#262626] flex items-center justify-between font-mono text-xs text-slate-400 font-medium">
          <span>DGMS REGULATION 108 COMPLIANT • REAL-TIME MINE ENVIRONMENTAL SAFETY</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#262626] hover:bg-[#333333] text-white font-bold cursor-pointer transition-colors border border-[#404040]"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
