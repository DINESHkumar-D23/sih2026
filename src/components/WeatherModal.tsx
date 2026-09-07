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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
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
                <h2 id="weather-modal-title" className="font-mono text-sm font-bold text-white tracking-wider uppercase">
                  METEOROLOGY &amp; PIT HYDROLOGY TELEMETRY
                </h2>
                <span className="bg-blue-950 text-blue-400 border border-blue-800 text-[9px] font-mono font-bold px-1.5 py-0.5 uppercase">
                  STN-BLD-14A
                </span>
              </div>
              <p className="font-mono text-[9.5px] text-[#888888] tracking-tight">
                CREST RIDGE STATION (RL 1,240M) • LAT: 18.67°N, LON: 81.25°E • OPEN-METEO SYNC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#171717] hover:bg-[#262626] disabled:opacity-50 text-gray-300 font-mono text-[10px] font-bold border border-[#333333] cursor-pointer transition-colors"
              title="Fetch fresh real-time weather from Open-Meteo"
            >
              <RefreshCw className={`w-3 h-3 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'SYNCING...' : 'REFRESH'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close weather modal"
              className="p-1 text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors"
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
            <div className="md:col-span-1 bg-[#121214] border border-[#262626] p-3 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[9px] text-[#888888] font-bold uppercase block mb-1">
                  CURRENT PIT CLIMATE
                </span>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-light font-mono text-white">
                    {weather.temperatureC.toFixed(1)}°C
                  </div>
                  <div className="text-[10px] font-mono text-[#A3A3A3] leading-tight">
                    <div>Feels: <strong className="text-white">{weather.apparentTemperatureC.toFixed(1)}°C</strong></div>
                    <div>Dew Pt: <strong className="text-white">{weather.dewPointC.toFixed(1)}°C</strong></div>
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-[#1F1F22] flex items-center gap-2">
                <CloudRain className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-mono text-[10.5px] font-semibold text-blue-200">
                  {weather.conditionText}
                </span>
              </div>
            </div>

            {/* DGMS Safety Protocol Advisory */}
            <div className="md:col-span-2 bg-[#121214] border border-[#262626] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[9px] text-[#888888] font-bold uppercase">
                  DGMS MONSOON SAFETY ADVISORY (CIRCULAR 04 &amp; 07)
                </span>
                <span
                  className={`font-mono text-[9px] font-bold px-1.5 py-0.2 border ${
                    weather.lightningRisk === 'CRITICAL' || weather.visibilityMeters < 50
                      ? 'bg-red-950 text-red-300 border-red-600'
                      : isWet
                      ? 'bg-yellow-950 text-yellow-300 border-yellow-600'
                      : 'bg-green-950 text-green-300 border-green-600'
                  }`}
                >
                  {weather.lightningRisk === 'CRITICAL' ? 'CODE RED' : isWet ? 'CODE AMBER (WET RAMP)' : 'CODE GREEN (NORMAL)'}
                </span>
              </div>
              <p className="font-mono text-[10.5px] text-yellow-300 leading-relaxed bg-black/40 p-2 border border-[#262626]">
                {weather.dgmsAdvisory}
              </p>
              <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-[#888888]">
                <span>LAST TELEMETRY UPDATE: {weather.lastUpdated}</span>
                <span>STATUS: {weather.isFallback ? 'CACHED SIMULATION' : 'LIVE SATELLITE / API'}</span>
              </div>
            </div>
          </div>

          {/* 4 Technical Pillar Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Atmospheric Profile */}
            <div className="bg-[#121214] border border-[#262626] p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#262626] pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                  <span className="font-mono text-[10px] font-bold text-white uppercase">ATMOSPHERIC</span>
                </div>
                <span className="font-mono text-[9px] text-[#888888]">RL 1,240m</span>
              </div>

              <div className="space-y-1.5 font-mono text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Baro Pressure:</span>
                  <span className="text-white font-semibold flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-cyan-400" />
                    {weather.surfacePressureHpa.toFixed(1)} hPa
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Rel Humidity:</span>
                  <span className="text-white font-semibold flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-blue-400" />
                    {weather.relativeHumidity}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Cloud Cover:</span>
                  <span className="text-white font-semibold">{weather.cloudCoverPercent}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Cloud Ceiling:</span>
                  <span className="text-cyan-300 font-semibold">{weather.cloudCeilingMeters}m (RL {1200 + weather.cloudCeilingMeters}m)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Pit Visibility:</span>
                  <span className={`font-semibold flex items-center gap-1 ${weather.visibilityMeters < 50 ? 'text-red-400' : 'text-green-400'}`}>
                    <Eye className="w-3 h-3" />
                    {weather.visibilityMeters}m
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Road Surface & Friction Physics */}
            <div className="bg-[#121214] border border-[#262626] p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#262626] pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="font-mono text-[10px] font-bold text-white uppercase">HAUL FRICTION</span>
                </div>
                <span className={`font-mono text-[9px] font-bold px-1 border ${isWet ? 'bg-red-950 text-red-400 border-red-700' : 'bg-green-950 text-green-400 border-green-700'}`}>
                  {isWet ? 'WET SLURRY' : 'DRY ORE'}
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Traction Coeff (μ):</span>
                  <span className={`font-bold text-[11px] ${weather.frictionCoefficient < 0.25 ? 'text-red-400' : 'text-green-400'}`}>
                    μ = {weather.frictionCoefficient.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Incline Gradient:</span>
                  <span className="text-white font-semibold">1:9 to 1:16 (11.0%)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Braking Degradation:</span>
                  <span className="text-orange-400 font-semibold">
                    +{stoppingDistImpactPercent}% Dist
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Safe Incline Cap:</span>
                  <span className="text-yellow-400 font-bold">{isWet ? '15 KM/H' : '25 KM/H'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Hydro Retarder:</span>
                  <span className="text-green-400 font-semibold">INTERLOCK ON</span>
                </div>
              </div>
            </div>

            {/* Card 3: Pit Hydrology & Sump Inflow */}
            <div className="bg-[#121214] border border-[#262626] p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#262626] pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-mono text-[10px] font-bold text-white uppercase">PIT HYDROLOGY</span>
                </div>
                <span className="font-mono text-[9px] text-[#888888]">SUMP #02</span>
              </div>

              <div className="space-y-1.5 font-mono text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Rain Intensity:</span>
                  <span className="text-blue-300 font-bold">
                    {weather.rainMmHr.toFixed(1)} mm/hr
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Shift Rain Accum:</span>
                  <span className="text-white font-semibold">
                    {weather.shiftRainfallMm.toFixed(1)} mm
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Sump Inflow Rate:</span>
                  <span className="text-yellow-400 font-semibold">
                    {weather.pitSumpInflowM3Hr} m³/hr
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Dewatering Pumps:</span>
                  <span className="text-green-400 font-semibold">3 / 4 ONLINE</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Bench Erosion Risk:</span>
                  <span className={`font-semibold ${weather.rainMmHr > 8 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {weather.rainMmHr > 8 ? 'HIGH RISK' : 'MODERATE'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Wind & Lightning Vectors */}
            <div className="bg-[#121214] border border-[#262626] p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#262626] pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-mono text-[10px] font-bold text-white uppercase">WIND &amp; AERIAL</span>
                </div>
                <span className="font-mono text-[9px] text-[#888888]">CREST MAST</span>
              </div>

              <div className="space-y-1.5 font-mono text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Sustained Wind:</span>
                  <span className="text-white font-semibold">
                    {weather.windSpeedKmh} km/h
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Crest Peak Gust:</span>
                  <span className={`font-bold ${weather.windGustsKmh > 35 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {weather.windGustsKmh} km/h
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Direction:</span>
                  <span className="text-cyan-300 font-semibold flex items-center gap-1">
                    <Compass className="w-3 h-3" />
                    {weather.windDirectionCompass} ({weather.windDirectionDeg}°)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Lightning Risk:</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    weather.lightningRisk === 'CRITICAL' ? 'text-red-400' : weather.lightningRisk === 'HIGH' ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    <Zap className="w-3 h-3" />
                    {weather.lightningRisk}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#888888]">Shovel Boom Limit:</span>
                  <span className="text-green-400 font-semibold">SAFE (&lt; 45 KM/H)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6-Hour Forecast Trend */}
          {weather.forecastHours && weather.forecastHours.length > 0 && (
            <div className="bg-[#121214] border border-[#262626] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-mono text-[10px] font-bold text-white uppercase tracking-wider">
                    6-HOUR OPERATIONAL METEOROLOGICAL FORECAST (BAILADILA CREST)
                  </span>
                </div>
                <span className="font-mono text-[9px] text-[#888888]">INTERVAL: 1 HR</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 font-mono text-[9.5px]">
                {weather.forecastHours.map((fh, idx) => (
                  <div key={idx} className="bg-black/50 border border-[#262626] p-2 flex flex-col gap-1 items-center text-center">
                    <span className="text-blue-400 font-bold text-[10px]">{fh.time}</span>
                    <div className="text-white font-light text-sm">{fh.tempC.toFixed(1)}°C</div>
                    <div className="flex items-center gap-1 text-cyan-300">
                      <Droplets className="w-2.5 h-2.5" />
                      <span>{fh.popPercent}% PoP</span>
                    </div>
                    <div className="text-[#888888] text-[8.5px]">
                      Rain: <span className={fh.rainMm > 0.5 ? 'text-yellow-400 font-semibold' : 'text-gray-400'}>{fh.rainMm.toFixed(1)}mm</span>
                    </div>
                    <div className="text-[#888888] text-[8.5px]">
                      Wind: <span className="text-gray-300">{Math.round(fh.windKmh)} km/h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Haulage Friction Calculation Explainer */}
          <div className="bg-[#0A0A0B] border border-[#262626] p-3 text-[10px] font-mono text-[#888888] flex flex-col gap-1">
            <div className="flex items-center gap-1 text-white font-bold">
              <ShieldAlert className="w-3 h-3 text-yellow-400" />
              <span>DYNAMIC KINEMATIC FORMULA &amp; DGMS MANDATE REFERENCE</span>
            </div>
            <p className="leading-relaxed">
              Stopping distance equation: <code className="text-blue-300">d_stop = (v_ms²) / (2 · g · (μ ± grade)) + (v_ms · t_reaction)</code>.
              During wet conditions on Bailadila’s 11.0% single-lane incline, friction μ drops from 0.45 (dry) to {weather.frictionCoefficient.toFixed(2)}, increasing stopping distance from ~18m to {Math.round(18 * (1 + stoppingDistImpactPercent / 100))}m at 15 km/h. Passing Bay Alpha (RL 1,180m) is enforced by MTC collision interlocks.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-[#0F0F10] border-t border-[#262626] flex items-center justify-between font-mono text-[9px] text-[#888888]">
          <span>DGMS REGULATION 108 COMPLIANT • REAL-TIME MINE ENVIRONMENTAL SAFETY</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-[#262626] hover:bg-[#333333] text-white font-bold cursor-pointer transition-colors"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
