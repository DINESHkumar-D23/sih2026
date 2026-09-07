import React from 'react';
import {
  Sliders,
  Radio,
  CloudSun,
  Shield,
  Volume2,
  VolumeX,
  Gauge,
  UserCheck,
  Eye,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { SystemSettings, UserRole, WeatherData } from '../types';

interface SettingsScreenProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  wsStatus: 'CONNECTED' | 'FALLBACK_SIM';
  onManualWeatherRefresh: () => void;
  weather?: WeatherData;
  onOpenWeatherModal?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  wsStatus,
  onManualWeatherRefresh,
  weather,
  onOpenWeatherModal,
}) => {
  return (
    <div className="flex flex-col gap-3 select-none text-[#E0E0E0] pb-6 font-sans">
      {/* Top Banner */}
      <div className="bg-[#0A0A0B] border border-[#262626] p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-blue-400" />
          <div className="flex flex-col">
            <span className="font-mono text-[12px] font-bold text-white uppercase tracking-wider">
              MTC SYSTEM CONFIGURATION &amp; HARDWARE TELEMETRY
            </span>
            <span className="font-mono text-[9px] text-[#888888]">
              NETWORK PROTOCOLS, SAFETY INTERLOCKS &amp; SIMULATION ENGINE
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Card 1: Telemetry & WebSocket Connection */}
        <div className="bg-[#0A0A0B] border border-[#262626] overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-mono font-bold text-[10.5px] text-blue-400 uppercase tracking-wider">
                Telemetry Link (WebSocket / Hardware Gateway)
              </span>
            </div>
            <span
              className={`font-mono text-[8.5px] px-1.5 py-0.2 font-bold border ${
                wsStatus === 'CONNECTED'
                  ? 'bg-green-950 text-green-400 border-green-500'
                  : 'bg-blue-950 text-blue-400 border-blue-500'
              }`}
            >
              {wsStatus === 'CONNECTED' ? 'HARDWARE WS ONLINE' : 'AUTONOMOUS SIMULATION'}
            </span>
          </div>

          <div className="p-3 flex flex-col gap-3 font-mono text-[10px]">
            <div className="flex items-center justify-between bg-black p-2 border border-[#222222]">
              <div>
                <span className="text-white font-bold block">ENABLE WEBSOCKET CONNECTION</span>
                <span className="text-[#888888] text-[8.5px]">
                  When disabled, uses client-side kinematics with high physical fidelity
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.wsEnabled}
                aria-label="Enable WebSocket connection"
                onChange={(e) => onUpdateSettings({ wsEnabled: e.target.checked })}
                className="w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="ws-url-input" className="text-[#888888] text-[9px] uppercase font-bold">
                WEBSOCKET GATEWAY URL
              </label>
              <input
                id="ws-url-input"
                type="text"
                value={settings.wsUrl}
                disabled={!settings.wsEnabled}
                onChange={(e) => onUpdateSettings({ wsUrl: e.target.value })}
                placeholder="ws://localhost:8080"
                className="bg-black border border-[#333333] p-2 text-white font-mono text-[10px] focus:outline-hidden disabled:opacity-50"
              />
              <span className="text-[8.5px] text-[#666666]">
                Expects JSON packets: <code>{'{ type: "TELEMETRY", payload: VehicleTwin[] }'}</code>
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[#888888] text-[9px] uppercase font-bold">
                SIMULATION SPEED MULTIPLIER
              </span>
              <div className="grid grid-cols-4 gap-1">
                {[0.5, 1.0, 2.0, 5.0].map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => onUpdateSettings({ simSpeedMultiplier: mult })}
                    className={`py-1 text-[9px] font-bold border cursor-pointer transition-colors ${
                      settings.simSpeedMultiplier === mult
                        ? 'bg-blue-600 text-white border-blue-400'
                        : 'bg-black text-[#888888] border-[#222222] hover:text-white'
                    }`}
                  >
                    {mult}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: MTC Speed Clamps & Incline Safety */}
        <div className="bg-[#0A0A0B] border border-[#262626] overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-yellow-400" />
              <span className="font-mono font-bold text-[10.5px] text-yellow-400 uppercase tracking-wider">
                MTC Speed Clamps &amp; Braking Limits
              </span>
            </div>
          </div>

          <div className="p-3 flex flex-col gap-3 font-mono text-[10px]">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-white font-bold">HAUL RAMP SPEED CAP (11% GRADE):</span>
                <span className="text-yellow-400 font-bold">{settings.speedClampLimitKmh} KM/H</span>
              </div>
              <input
                type="range"
                min={10}
                max={25}
                step={1}
                aria-label="Speed clamp limit in km/h"
                value={settings.speedClampLimitKmh}
                onChange={(e) => onUpdateSettings({ speedClampLimitKmh: Number(e.target.value) })}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-[#666666]">
                <span>10 km/h (Dense Fog / Heavy Rain)</span>
                <span>15 km/h (Monsoon Standard)</span>
                <span>25 km/h (Dry Road Clear)</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-black p-2 border border-[#222222]">
              <div>
                <span className="text-white font-bold block">AUTO-TRIGGER E-STOP ON CONFLICT</span>
                <span className="text-[#888888] text-[8.5px]">
                  Automatically engages hydraulic retarders when closing distance &lt; 25m
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoEstopOnHazard}
                aria-label="Automatically trigger emergency stop on conflict"
                onChange={(e) => onUpdateSettings({ autoEstopOnHazard: e.target.checked })}
                className="w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between bg-black p-2 border border-[#222222]">
              <div>
                <span className="text-white font-bold block">AUDIO TONES &amp; RADIO SQUELCH</span>
                <span className="text-[#888888] text-[8.5px]">
                  Web Audio MTC conflict chimes and VHF radio feedback clicks
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ isAudioMuted: !settings.isAudioMuted })}
                aria-label={settings.isAudioMuted ? 'Unmute MTC audio' : 'Mute MTC audio'}
                className={`p-1.5 border font-mono text-[9px] font-bold cursor-pointer ${
                  settings.isAudioMuted
                    ? 'bg-yellow-950/50 border-yellow-600 text-yellow-400'
                    : 'bg-green-950/50 border-green-600 text-green-400'
                }`}
              >
                {settings.isAudioMuted ? 'MUTED' : 'ACTIVE'}
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Role & Permissions */}
        <div className="bg-[#0A0A0B] border border-[#262626] overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-mono font-bold text-[10.5px] text-blue-400 uppercase tracking-wider">
                Role-Based Access Control (RBAC)
              </span>
            </div>
          </div>

          <div className="p-3 flex flex-col gap-2 font-mono text-[10px]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ role: 'dispatcher' })}
                className={`p-2.5 border text-left cursor-pointer transition-colors ${
                  settings.role === 'dispatcher'
                    ? 'bg-blue-950/60 border-blue-500 text-white'
                    : 'bg-black border-[#222222] text-[#888888] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-blue-400 mb-0.5">
                  <UserCheck className="w-4 h-4" />
                  <span>MTC CONTROLLER</span>
                </div>
                <span className="text-[8.5px] text-[#A3A3A3] block leading-tight">
                  Full command authority: Issue HOLD / CLEAR orders, execute pit E-Stop, VHF broadcast.
                </span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ role: 'observer' })}
                className={`p-2.5 border text-left cursor-pointer transition-colors ${
                  settings.role === 'observer'
                    ? 'bg-blue-950/60 border-blue-500 text-white'
                    : 'bg-black border-[#222222] text-[#888888] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-gray-300 mb-0.5">
                  <Eye className="w-4 h-4" />
                  <span>SAFETY OBSERVER</span>
                </div>
                <span className="text-[8.5px] text-[#A3A3A3] block leading-tight">
                  Read-only telemetry view: Monitor radar, haul production, and review logs without command dispatch.
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 4: Open-Meteo Weather Sync */}
        <div className="bg-[#0A0A0B] border border-[#262626] overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CloudSun className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-mono font-bold text-[10.5px] text-cyan-400 uppercase tracking-wider">
                Bailadila Open-Meteo Weather Engine
              </span>
            </div>
          </div>

          <div className="p-3 flex flex-col gap-2 font-mono text-[10px]">
            <div className="flex items-center justify-between bg-black p-2 border border-[#222222]">
              <div>
                <span className="text-white font-bold block">AUTO-SYNC WITH OPEN-METEO API</span>
                <span className="text-[#888888] text-[8.5px]">
                  Coordinates: 18.67° N, 81.25° E (Bailadila Sector 14-A, Kirandul)
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.weatherAutoSync}
                aria-label="Auto-sync with Open-Meteo API"
                onChange={(e) => onUpdateSettings({ weatherAutoSync: e.target.checked })}
                className="w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#888888] text-[9px]">MANUAL RESYNC TRIGGER:</span>
              <button
                type="button"
                onClick={onManualWeatherRefresh}
                className="bg-[#18181A] hover:bg-black text-white font-mono text-[9px] font-bold py-1 px-3 border border-[#333333] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3 h-3 text-cyan-400" />
                SYNC LIVE WEATHER
              </button>
            </div>

            {weather && (
              <div className="bg-[#111113] p-2 border border-[#222222] flex flex-col gap-1 mt-1 text-[9px]">
                <div className="flex justify-between text-[#888888]">
                  <span>CURRENT READING:</span>
                  <span className="text-white font-bold">{weather.temperatureC.toFixed(1)}°C / {weather.rainMmHr.toFixed(1)} mm/h</span>
                </div>
                <div className="flex justify-between text-[#888888]">
                  <span>SURFACE FRICTION &amp; WIND:</span>
                  <span className="text-cyan-300">μ={weather.frictionCoefficient.toFixed(2)} • {weather.windDirectionCompass} {weather.windSpeedKmh} km/h</span>
                </div>
                <div className="flex justify-between text-[#888888]">
                  <span>BAROMETER &amp; VISIBILITY:</span>
                  <span className="text-gray-300">{weather.surfacePressureHpa.toFixed(0)} hPa • {weather.visibilityMeters}m</span>
                </div>
                {onOpenWeatherModal && (
                  <button
                    type="button"
                    onClick={onOpenWeatherModal}
                    className="mt-1 bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 border border-cyan-600/50 py-1 px-2 font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>LAUNCH METEOROLOGY &amp; HYDROLOGY CONSOLE</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
