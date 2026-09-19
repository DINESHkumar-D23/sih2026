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
  Wifi,
} from 'lucide-react';
import { SystemSettings, UserRole, WeatherData } from '../types';

interface SettingsScreenProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  wsStatus: 'CONNECTED' | 'FALLBACK_SIM';
  onManualWeatherRefresh: () => void;
  weather?: WeatherData;
  onOpenWeatherModal?: () => void;
  onOpenEsp32WifiModal?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  wsStatus,
  onManualWeatherRefresh,
  weather,
  onOpenWeatherModal,
  onOpenEsp32WifiModal,
}) => {
  return (
    <div className="flex flex-col gap-3 select-none text-[#E0E0E0] pb-6 font-sans">
      {/* Top Banner */}
      <div className="bg-[#0A0A0B] border border-[#333338] p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-blue-400" />
          <div className="flex flex-col">
            <span className="font-mono text-sm font-bold text-white uppercase tracking-wider">
              MTC SYSTEM CONFIGURATION &amp; HARDWARE TELEMETRY
            </span>
            <span className="font-mono text-xs text-slate-300 font-semibold">
              NETWORK PROTOCOLS, SAFETY INTERLOCKS &amp; SIMULATION ENGINE
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Card 1: Telemetry & WebSocket Connection */}
        <div className="bg-[#0A0A0B] border border-[#333338] overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400" />
              <span className="font-mono font-bold text-xs text-blue-300 uppercase tracking-wider">
                Telemetry Link (WebSocket / Hardware Gateway)
              </span>
            </div>
            <span
              className={`font-mono text-xs px-2 py-0.5 font-bold border ${
                wsStatus === 'CONNECTED'
                  ? 'bg-green-950 text-green-300 border-green-500'
                  : 'bg-blue-950 text-blue-300 border-blue-500'
              }`}
            >
              {wsStatus === 'CONNECTED' ? 'HARDWARE WS ONLINE' : 'AUTONOMOUS SIMULATION'}
            </span>
          </div>

          <div className="p-3.5 flex flex-col gap-3.5 font-mono text-xs">
            <div className="flex items-center justify-between bg-black p-3 border border-[#2a2a30]">
              <div>
                <span className="text-white font-bold block text-xs">ENABLE WEBSOCKET CONNECTION</span>
                <span className="text-slate-300 text-xs mt-0.5 block">
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

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ws-url-input" className="text-slate-300 text-xs uppercase font-bold">
                WEBSOCKET GATEWAY URL
              </label>
              <input
                id="ws-url-input"
                type="text"
                value={settings.wsUrl}
                disabled={!settings.wsEnabled}
                onChange={(e) => onUpdateSettings({ wsUrl: e.target.value })}
                placeholder="ws://localhost:8080"
                className="bg-black border border-[#333338] p-2.5 text-white font-mono text-xs focus:outline-hidden disabled:opacity-50 font-medium"
              />
              <span className="text-xs text-slate-400">
                Expects JSON packets: <code className="text-slate-200">{'{ type: "TELEMETRY", payload: VehicleTwin[] }'}</code>
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-slate-300 text-xs uppercase font-bold">
                SIMULATION SPEED MULTIPLIER
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[0.5, 1.0, 2.0, 5.0].map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => onUpdateSettings({ simSpeedMultiplier: mult })}
                    className={`py-1.5 text-xs font-bold border cursor-pointer transition-colors ${
                      settings.simSpeedMultiplier === mult
                        ? 'bg-blue-600 text-white border-blue-400 shadow-xs'
                        : 'bg-black text-slate-300 border-[#333338] hover:text-white'
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
        <div className="bg-[#0A0A0B] border border-[#333338] overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-yellow-400" />
              <span className="font-mono font-bold text-xs text-yellow-300 uppercase tracking-wider">
                MTC Speed Clamps &amp; Braking Limits
              </span>
            </div>
          </div>

          <div className="p-3.5 flex flex-col gap-3.5 font-mono text-xs">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white font-bold">HAUL RAMP SPEED CAP (11% GRADE):</span>
                <span className="text-yellow-300 font-bold text-sm">{settings.speedClampLimitKmh} KM/H</span>
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
              <div className="flex justify-between text-xs text-slate-300 font-medium">
                <span>10 km/h (Dense Fog / Heavy Rain)</span>
                <span>15 km/h (Monsoon Standard)</span>
                <span>25 km/h (Dry Road Clear)</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-black p-3 border border-[#2a2a30]">
              <div>
                <span className="text-white font-bold block text-xs">AUTO-TRIGGER E-STOP ON CONFLICT</span>
                <span className="text-slate-300 text-xs mt-0.5 block">
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

            <div className="flex items-center justify-between bg-black p-3 border border-[#2a2a30]">
              <div>
                <span className="text-white font-bold block text-xs">AUDIO TONES &amp; RADIO SQUELCH</span>
                <span className="text-slate-300 text-xs mt-0.5 block">
                  Web Audio MTC conflict chimes and VHF radio feedback clicks
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ isAudioMuted: !settings.isAudioMuted })}
                aria-label={settings.isAudioMuted ? 'Unmute MTC audio' : 'Mute MTC audio'}
                className={`px-3 py-1.5 border font-mono text-xs font-bold cursor-pointer ${
                  settings.isAudioMuted
                    ? 'bg-yellow-950/70 border-yellow-500 text-yellow-300'
                    : 'bg-green-950/70 border-green-500 text-green-300'
                }`}
              >
                {settings.isAudioMuted ? 'MUTED' : 'ACTIVE'}
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Role & Permissions */}
        <div className="bg-[#0A0A0B] border border-[#333338] overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span className="font-mono font-bold text-xs text-blue-300 uppercase tracking-wider">
                Role-Based Access Control (RBAC)
              </span>
            </div>
          </div>

          <div className="p-3.5 flex flex-col gap-2.5 font-mono text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onUpdateSettings({ role: 'dispatcher' })}
                className={`p-3 border text-left cursor-pointer transition-colors ${
                  settings.role === 'dispatcher'
                    ? 'bg-blue-950/80 border-blue-400 text-white shadow-xs'
                    : 'bg-black border-[#2a2a30] text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-blue-300 mb-1 text-sm">
                  <UserCheck className="w-4 h-4" />
                  <span>MTC CONTROLLER</span>
                </div>
                <span className="text-xs text-slate-200 block leading-normal font-medium">
                  Full command authority: Issue HOLD / CLEAR orders, execute pit E-Stop, VHF broadcast.
                </span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ role: 'observer' })}
                className={`p-3 border text-left cursor-pointer transition-colors ${
                  settings.role === 'observer'
                    ? 'bg-blue-950/80 border-blue-400 text-white shadow-xs'
                    : 'bg-black border-[#2a2a30] text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-200 mb-1 text-sm">
                  <Eye className="w-4 h-4" />
                  <span>SAFETY OBSERVER</span>
                </div>
                <span className="text-xs text-slate-200 block leading-normal font-medium">
                  Read-only telemetry view: Monitor radar, haul production, and review logs without command dispatch.
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 4: Open-Meteo Weather Sync */}
        <div className="bg-[#0A0A0B] border border-[#333338] overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudSun className="w-4 h-4 text-cyan-400" />
              <span className="font-mono font-bold text-xs text-cyan-300 uppercase tracking-wider">
                Bailadila Open-Meteo Weather Engine
              </span>
            </div>
          </div>

          <div className="p-3.5 flex flex-col gap-2.5 font-mono text-xs">
            <div className="flex items-center justify-between bg-black p-3 border border-[#2a2a30]">
              <div>
                <span className="text-white font-bold block text-xs">AUTO-SYNC WITH OPEN-METEO API</span>
                <span className="text-slate-300 text-xs mt-0.5 block">
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
              <span className="text-slate-300 text-xs font-semibold">MANUAL RESYNC TRIGGER:</span>
              <button
                type="button"
                onClick={onManualWeatherRefresh}
                className="bg-[#18181A] hover:bg-black text-white font-mono text-xs font-bold py-1.5 px-3.5 border border-[#333338] flex items-center gap-2 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                SYNC LIVE WEATHER
              </button>
            </div>

            {weather && (
              <div className="bg-[#111113] p-3 border border-[#2a2a30] flex flex-col gap-1.5 mt-1 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span className="font-semibold">CURRENT READING:</span>
                  <span className="text-white font-bold">{weather.temperatureC.toFixed(1)}°C / {weather.rainMmHr.toFixed(1)} mm/h</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="font-semibold">SURFACE FRICTION &amp; WIND:</span>
                  <span className="text-cyan-300 font-bold">μ={weather.frictionCoefficient.toFixed(2)} • {weather.windDirectionCompass} {weather.windSpeedKmh} km/h</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="font-semibold">BAROMETER &amp; VISIBILITY:</span>
                  <span className="text-slate-200 font-bold">{weather.surfacePressureHpa.toFixed(0)} hPa • {weather.visibilityMeters}m</span>
                </div>
                {onOpenWeatherModal && (
                  <button
                    type="button"
                    onClick={onOpenWeatherModal}
                    className="mt-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-200 border border-cyan-500 py-2 px-3 font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>LAUNCH METEOROLOGY &amp; HYDROLOGY CONSOLE</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 5: Google Maps Mapping Configuration */}
        <div className="bg-[#0A0A0B] border border-[#333338] overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-amber-300 uppercase tracking-wider">
                Google Maps &amp; Navigation Layers
              </span>
            </div>
            <span className="font-mono text-xs bg-amber-950 text-amber-200 border border-amber-500 px-2 py-0.5 font-bold">
              GOOGLE MAPS ENGINE
            </span>
          </div>

          <div className="p-3.5 flex flex-col gap-3 font-mono text-xs">
            <div className="flex flex-col gap-1.5">
              <span className="text-white font-bold">DEFAULT GOOGLE MAPS LAYER:</span>
              <div className="grid grid-cols-4 gap-2">
                {(['hybrid', 'satellite', 'terrain', 'roadmap'] as const).map((layer) => (
                  <button
                    key={layer}
                    type="button"
                    onClick={() => onUpdateSettings({ googleMapsType: layer })}
                    className={`py-1.5 text-xs font-bold uppercase border cursor-pointer transition-colors ${
                      settings.googleMapsType === layer
                        ? 'bg-amber-600 text-white border-amber-400 shadow-xs'
                        : 'bg-black text-slate-300 border-[#333338] hover:text-white'
                    }`}
                  >
                    {layer}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-black p-3 border border-[#2a2a30]">
              <div>
                <span className="text-white font-bold block text-xs">AUTO-CENTER ON NEO-6M GPS FIX</span>
                <span className="text-slate-300 text-xs mt-0.5 block">
                  Automatically keeps the radar map camera centered on the vehicle GPS coordinates
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoCenterGps}
                aria-label="Auto-center on GPS fix"
                onChange={(e) => onUpdateSettings({ autoCenterGps: e.target.checked })}
                className="w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="gmaps-api-key" className="text-slate-300 text-xs uppercase font-bold">
                GOOGLE MAPS API KEY (OPTIONAL)
              </label>
              <input
                id="gmaps-api-key"
                type="password"
                value={settings.googleMapsApiKey || ''}
                onChange={(e) => onUpdateSettings({ googleMapsApiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="bg-black border border-[#333338] p-2.5 text-white font-mono text-xs focus:outline-hidden font-medium"
              />
              <span className="text-xs text-slate-400">
                High-resolution Google satellite tiles are active by default with zero key required.
              </span>
            </div>
          </div>
        </div>

        {/* Card 6: Hardware Sensor Thresholds & Baud Rate */}
        <div className="bg-[#0A0A0B] border border-[#333338] overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-cyan-300 uppercase tracking-wider">
                Hardware Sensors &amp; Serial Baud Rate
              </span>
            </div>
            <span className="font-mono text-xs bg-cyan-950 text-cyan-200 border border-cyan-500 px-2 py-0.5 font-bold">
              6 SENSORS CALIBRATION
            </span>
          </div>

          <div className="p-3.5 flex flex-col gap-3 font-mono text-xs">
            <div className="flex flex-col gap-1.5">
              <span className="text-white font-bold">WEB SERIAL (USB COM) BAUD RATE:</span>
              <div className="grid grid-cols-3 gap-2">
                {([9600, 57600, 115200] as const).map((baud) => (
                  <button
                    key={baud}
                    type="button"
                    onClick={() => onUpdateSettings({ serialBaudRate: baud })}
                    className={`py-1.5 text-xs font-bold border cursor-pointer transition-colors ${
                      settings.serialBaudRate === baud
                        ? 'bg-cyan-600 text-white border-cyan-400 shadow-xs'
                        : 'bg-black text-slate-300 border-[#333338] hover:text-white'
                    }`}
                  >
                    {baud} BAUD
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-black p-2.5 border border-[#2a2a30]">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px] font-bold">LIDAR CRITICAL DISTANCE:</span>
                <span className="text-amber-300 font-bold">{settings.lidarCriticalThresholdM} METERS</span>
                <span className="text-[10px] text-slate-400">Triggers vibration motors automatically</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px] font-bold">MPU ROLLOVER ALARM:</span>
                <span className="text-purple-300 font-bold">{settings.rolloverThresholdDeg}° PITCH/ROLL</span>
                <span className="text-[10px] text-slate-400">Dynamic incline safety warning</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 7: ESP32 Wi-Fi Telemetry Station & Sensor Gateway */}
        <div className="bg-[#0A0A0B] border border-cyan-500/40 overflow-hidden flex flex-col md:col-span-2">
          <div className="px-3.5 py-2.5 bg-cyan-950/20 border-b border-cyan-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-cyan-400" />
              <span className="font-mono font-bold text-xs text-cyan-300 uppercase tracking-wider">
                ESP32 Wi-Fi Telemetry Station &amp; Sensor Hub (Smoke, DHT, Distance)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs bg-cyan-950 text-cyan-200 border border-cyan-500 px-2 py-0.5 font-bold">
                GROUND-TRUTH WEATHER &amp; PROXIMITY
              </span>
              {onOpenEsp32WifiModal && (
                <button
                  type="button"
                  onClick={onOpenEsp32WifiModal}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono text-xs font-bold px-2.5 py-1 flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>OPEN ESP32 CONSOLE</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
            {/* Column 1: IP & Presets */}
            <div className="flex flex-col gap-2 bg-black p-3 border border-[#2a2a30]">
              <label htmlFor="settings-esp32-ip" className="text-slate-300 text-xs uppercase font-bold">
                ESP32 IP / HOSTNAME
              </label>
              <input
                id="settings-esp32-ip"
                type="text"
                value={settings.esp32WifiIp}
                onChange={(e) => onUpdateSettings({ esp32WifiIp: e.target.value })}
                placeholder="192.168.4.1 or 192.168.1.150"
                className="bg-[#111113] border border-[#333338] p-2 text-cyan-300 font-mono text-xs focus:outline-hidden font-bold"
              />
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {[
                  { label: 'AP: 192.168.4.1', val: '192.168.4.1' },
                  { label: 'LAN: .150', val: '192.168.1.150' },
                  { label: 'mDNS', val: 'esp32.local' },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => onUpdateSettings({ esp32WifiIp: preset.val })}
                    className={`px-2 py-0.5 text-[10px] border cursor-pointer font-bold ${
                      settings.esp32WifiIp === preset.val
                        ? 'bg-cyan-900/60 border-cyan-400 text-white'
                        : 'bg-[#18181A] border-[#333338] text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">
                Default SoftAP IP is 192.168.4.1. Router Station mode uses DHCP LAN IP.
              </span>
            </div>

            {/* Column 2: Protocol & Auto-Connect */}
            <div className="flex flex-col gap-2 bg-black p-3 border border-[#2a2a30]">
              <span className="text-slate-300 text-xs uppercase font-bold">COMMUNICATION PROTOCOL</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ esp32WifiMode: 'HTTP_POLL' })}
                  className={`py-1.5 text-xs font-bold border cursor-pointer transition-colors ${
                    settings.esp32WifiMode === 'HTTP_POLL'
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-xs'
                      : 'bg-[#18181A] text-slate-400 border-[#333338] hover:text-white'
                  }`}
                >
                  HTTP POLLING (/data)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ esp32WifiMode: 'WEBSOCKET' })}
                  className={`py-1.5 text-xs font-bold border cursor-pointer transition-colors ${
                    settings.esp32WifiMode === 'WEBSOCKET'
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-xs'
                      : 'bg-[#18181A] text-slate-400 border-[#333338] hover:text-white'
                  }`}
                >
                  WEBSOCKET (ws://)
                </button>
              </div>

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#222]">
                <div>
                  <span className="text-white font-bold block text-xs">AUTO-CONNECT ON LOAD</span>
                  <span className="text-[10px] text-slate-400">Initiates Wi-Fi polling automatically</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.esp32WifiAutoConnect}
                  aria-label="Auto-connect to ESP32 on load"
                  onChange={(e) => onUpdateSettings({ esp32WifiAutoConnect: e.target.checked })}
                  className="w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            {/* Column 3: Polling Rate & Telemetry Summary */}
            <div className="flex flex-col gap-2 bg-black p-3 border border-[#2a2a30]">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 text-xs uppercase font-bold">POLL INTERVAL</span>
                <span className="text-cyan-300 font-bold">{settings.esp32WifiPollIntervalMs} ms</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[500, 1000, 1500, 3000].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => onUpdateSettings({ esp32WifiPollIntervalMs: rate })}
                    className={`py-1 text-[11px] font-bold border cursor-pointer ${
                      settings.esp32WifiPollIntervalMs === rate
                        ? 'bg-cyan-600 text-white border-cyan-400'
                        : 'bg-[#18181A] text-slate-400 border-[#333338] hover:text-white'
                    }`}
                  >
                    {rate < 1000 ? `${rate}ms` : `${rate / 1000}s`}
                  </button>
                ))}
              </div>

              <div className="mt-2 p-2 bg-[#12161A] border border-cyan-950 text-[11px] text-slate-300 flex flex-col gap-1">
                <span className="text-cyan-400 font-bold">Active Sensor Metrics:</span>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <span>• Smoke (MQ)</span>
                  <span>• DHT Temp/Hum</span>
                  <span>• Distance (US)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
