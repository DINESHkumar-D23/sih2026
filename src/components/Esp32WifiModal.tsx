import React, { useState } from 'react';
import {
  X,
  Wifi,
  Radio,
  Wind,
  Thermometer,
  Eye,
  Activity,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  Sliders,
  Globe,
} from 'lucide-react';
import { HardwareTelemetry, WeatherData, Esp32WifiTelemetry } from '../types';
import {
  startEsp32WifiPolling,
  stopEsp32WifiPolling,
  testEsp32WifiPing,
  connectEsp32WebSocket,
  disconnectEsp32WebSocket,
  simulateEsp32WifiPacket,
  normalizeEsp32Url,
} from '../utils/hardwareReceiver';

interface Esp32WifiModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: HardwareTelemetry;
  onUpdateTelemetry: (data: Partial<HardwareTelemetry>) => void;
  weather?: WeatherData;
}

export const Esp32WifiModal: React.FC<Esp32WifiModalProps> = ({
  isOpen,
  onClose,
  telemetry,
  onUpdateTelemetry,
  weather,
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'metrics' | 'firmware'>('config');
  const [ipAddress, setIpAddress] = useState(telemetry.esp32Wifi?.ipAddress || '192.168.4.1');
  const [connectionMode, setConnectionMode] = useState<'HTTP_POLL' | 'WEBSOCKET'>(telemetry.esp32Wifi?.mode || 'HTTP_POLL');
  const [pollIntervalMs, setPollIntervalMs] = useState(telemetry.esp32Wifi?.pollIntervalMs || 1500);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs: number; error?: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const espWifi: Esp32WifiTelemetry = telemetry.esp32Wifi || {
    connected: false,
    ipAddress: '192.168.4.1',
    mode: 'HTTP_POLL' as const,
    pollIntervalMs: 1500,
    packetsCount: 0,
    smoke: {
      adc: telemetry.mq135.rawAdc ?? 412,
      ppm: telemetry.mq135.ppm,
      smokeDetected: telemetry.mq135.smokeDetected,
      status: telemetry.mq135.airQualityStatus,
    },
    dht: {
      temperatureC: telemetry.dht22.temperatureC,
      humidityPercent: telemetry.dht22.humidityPercent,
      heatIndexC: telemetry.dht22.heatIndexC,
      dewPointC: telemetry.dht22.dewPointC,
    },
    distance: {
      distanceMeters: telemetry.lidar8m.distanceMeters,
      distanceCm: Math.round(telemetry.lidar8m.distanceMeters * 100),
      alert: telemetry.lidar8m.obstacleAlert,
    },
  };

  const handleTestPing = async () => {
    setIsTestingPing(true);
    setPingResult(null);
    try {
      const res = await testEsp32WifiPing(ipAddress);
      setPingResult(res);
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleConnectWifi = () => {
    setIsConnecting(true);
    if (connectionMode === 'HTTP_POLL') {
      startEsp32WifiPolling(
        { ipAddress, pollIntervalMs },
        (data) => onUpdateTelemetry(data),
        (status) => {
          onUpdateTelemetry({
            esp32Wifi: {
              ...espWifi,
              ...status,
              connected: status.connected ?? true,
            },
          });
        },
        (err) => {
          console.warn('ESP32 Polling warning:', err);
        }
      );
    } else {
      connectEsp32WebSocket(
        ipAddress,
        (data) => onUpdateTelemetry(data),
        (status) => {
          onUpdateTelemetry({
            esp32Wifi: {
              ...espWifi,
              ...status,
              connected: status.connected ?? true,
            },
          });
        },
        (err) => console.warn('ESP32 WS warning:', err)
      );
    }
    setIsConnecting(false);
  };

  const handleDisconnectWifi = () => {
    stopEsp32WifiPolling();
    disconnectEsp32WebSocket();
    onUpdateTelemetry({
      connected: false,
      connectionSource: 'SIMULATOR',
      esp32Wifi: {
        ...espWifi,
        connected: false,
        lastSeen: `Disconnected at ${new Date().toLocaleTimeString()}`,
      },
    });
  };

  const handleSimulatePacket = () => {
    const packet = simulateEsp32WifiPacket(ipAddress);
    onUpdateTelemetry(packet);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ARDUINO_FIRMWARE_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="esp32-wifi-modal-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0A0A0C] border-2 border-cyan-500/70 w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden font-sans text-[#E0E0E0]">
        {/* Header Bar */}
        <div className="px-4 py-3 bg-[#0c1017] border-b border-[#1c2738] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-950/80 border border-cyan-500 text-cyan-300">
              <Wifi className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="esp32-wifi-modal-title" className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  ESP32 WI-FI WEATHER &amp; SENSOR HUB
                </h2>
                <span
                  className={`font-mono text-[11px] px-2 py-0.5 border font-bold ${
                    espWifi.connected
                      ? 'bg-green-950 text-green-300 border-green-500 animate-pulse'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  {espWifi.connected ? 'WI-FI LINK ACTIVE' : 'DISCONNECTED / STANDBY'}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-400 mt-0.5">
                Real-Time Ingestion for Smoke (MQ-135/2), DHT (Temp/Hum), and Distance (Ultrasonic/LIDAR).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSimulatePacket}
              className="px-2.5 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-500 font-mono text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Simulate incoming ESP32 packet"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="hidden sm:inline">TEST PACKET</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 py-2 bg-[#080a0f] border-b border-[#18202d] flex items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-xs'
                : 'bg-black text-slate-400 border-[#262c3a] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>WI-FI CONFIGURATION</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('metrics')}
            className={`px-3 py-1.5 font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'metrics'
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-xs'
                : 'bg-black text-slate-400 border-[#262c3a] hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>RECEIVED METRICS (SMOKE &bull; DHT &bull; DIST)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('firmware')}
            className={`px-3 py-1.5 font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'firmware'
                ? 'bg-purple-950 text-purple-300 border-purple-500 shadow-xs'
                : 'bg-black text-slate-400 border-[#262c3a] hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>ESP32 ARDUINO CODE</span>
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="p-4 overflow-y-auto space-y-4 font-mono text-xs">
          {/* TAB 1: WI-FI CONFIGURATION */}
          {activeTab === 'config' && (
            <div className="flex flex-col gap-4">
              {/* Connection Status Card */}
              <div className="bg-[#0d131f] border border-[#22324b] p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 border ${espWifi.connected ? 'bg-green-950/80 border-green-500 text-green-300' : 'bg-black border-slate-700 text-slate-500'}`}>
                    <Radio className={`w-5 h-5 ${espWifi.connected ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">
                        {espWifi.connected ? `CONNECTED TO ${espWifi.ipAddress}` : 'READY TO CONNECT VIA WI-FI'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-black border border-slate-700 text-slate-300">
                        {espWifi.mode}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Packets Ingested: <strong className="text-cyan-300">{espWifi.packetsCount}</strong> &bull; Latency: <strong className="text-yellow-300">{espWifi.lastPingMs || 0} ms</strong> &bull; Last Seen: {espWifi.lastSeen || 'Standby'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {espWifi.connected ? (
                    <button
                      type="button"
                      onClick={handleDisconnectWifi}
                      className="flex-1 sm:flex-initial px-4 py-2 bg-red-950 hover:bg-red-900 border border-red-500 text-red-200 font-bold cursor-pointer transition-colors"
                    >
                      DISCONNECT
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isConnecting}
                      onClick={handleConnectWifi}
                      className="flex-1 sm:flex-initial px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold border border-blue-400 shadow-md cursor-pointer transition-colors"
                    >
                      {isConnecting ? 'CONNECTING...' : 'CONNECT & STREAM'}
                    </button>
                  )}
                </div>
              </div>

              {/* IP Configuration Inputs */}
              <div className="bg-black p-4 border border-[#202736] flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#18202d] pb-2">
                  <span className="font-bold text-slate-200 uppercase">1. ESP32 Wi-Fi Address &amp; Presets</span>
                  <span className="text-slate-400 text-[11px]">Connect to the same Wi-Fi router or ESP32 SoftAP</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="esp-ip-input" className="text-slate-300 font-bold text-xs flex justify-between">
                    <span>ESP32 IP ADDRESS / HOSTNAME:</span>
                    <span className="text-cyan-400 font-normal">Target: {normalizeEsp32Url(ipAddress)}</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="esp-ip-input"
                      type="text"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="192.168.4.1 or 192.168.1.150"
                      className="flex-1 bg-[#0b0e14] border border-[#283244] p-2.5 text-white font-mono text-sm focus:outline-hidden focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      disabled={isTestingPing}
                      onClick={handleTestPing}
                      className="px-3.5 py-2 bg-[#172030] hover:bg-[#202d44] border border-[#2d3d57] text-cyan-300 font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingPing ? 'animate-spin' : ''}`} />
                      <span>{isTestingPing ? 'PINGING...' : 'TEST PING'}</span>
                    </button>
                  </div>
                </div>

                {/* Preset IP Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-400 text-[11px] mr-1">Quick Presets:</span>
                  {[
                    { label: 'AP Mode (192.168.4.1)', val: '192.168.4.1' },
                    { label: 'Local IP (192.168.1.150)', val: '192.168.1.150' },
                    { label: 'mDNS (esp32.local)', val: 'esp32.local' },
                    { label: 'Localhost Proxy (:8080)', val: 'localhost:8080' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setIpAddress(preset.val)}
                      className="px-2 py-1 bg-[#121620] hover:bg-[#1a2030] text-slate-300 hover:text-white border border-[#252e40] text-[11px] cursor-pointer transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {pingResult && (
                  <div
                    className={`p-2.5 border text-xs flex items-center justify-between ${
                      pingResult.success
                        ? 'bg-green-950/60 border-green-500 text-green-200'
                        : 'bg-red-950/60 border-red-500 text-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {pingResult.success ? <CheckCircle className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                      <span>
                        {pingResult.success
                          ? `ESP32 Wi-Fi station responded! Latency: ${pingResult.latencyMs} ms`
                          : `Ping Failed: ${pingResult.error}`}
                      </span>
                    </div>
                    {pingResult.success && <span className="font-bold text-green-300">ONLINE</span>}
                  </div>
                )}
              </div>

              {/* Protocol & Polling Rate */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Protocol Toggle */}
                <div className="bg-black p-3.5 border border-[#202736] flex flex-col gap-2">
                  <span className="font-bold text-slate-200 uppercase">2. Ingestion Protocol</span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setConnectionMode('HTTP_POLL')}
                      className={`p-2.5 border text-left cursor-pointer transition-colors flex flex-col gap-1 ${
                        connectionMode === 'HTTP_POLL'
                          ? 'bg-blue-950 border-blue-500 text-white'
                          : 'bg-[#0d1016] border-[#252e40] text-slate-400'
                      }`}
                    >
                      <span className="font-bold text-xs text-blue-300">HTTP REST POLLING</span>
                      <span className="text-[10px] leading-tight">Fetches /data JSON from ESP32 WebServer (Port 80)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConnectionMode('WEBSOCKET')}
                      className={`p-2.5 border text-left cursor-pointer transition-colors flex flex-col gap-1 ${
                        connectionMode === 'WEBSOCKET'
                          ? 'bg-purple-950 border-purple-500 text-white'
                          : 'bg-[#0d1016] border-[#252e40] text-slate-400'
                      }`}
                    >
                      <span className="font-bold text-xs text-purple-300">WEBSOCKET CLIENT</span>
                      <span className="text-[10px] leading-tight">Persistent 2-way stream ws://...:81/ws</span>
                    </button>
                  </div>
                </div>

                {/* Polling Interval Slider */}
                <div className="bg-black p-3.5 border border-[#202736] flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-200 uppercase">3. Polling Rate</span>
                    <span className="text-cyan-300 font-bold">{pollIntervalMs} ms ({Math.round(1000 / pollIntervalMs)} Hz)</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={5000}
                    step={100}
                    value={pollIntervalMs}
                    onChange={(e) => setPollIntervalMs(Number(e.target.value))}
                    className="cursor-pointer accent-cyan-400 mt-2"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>500ms (High Speed)</span>
                    <span>1500ms (Standard)</span>
                    <span>5000ms (Low Power)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RECEIVED METRICS (SMOKE, DHT, DISTANCE) */}
          {activeTab === 'metrics' && (
            <div className="flex flex-col gap-4">
              {/* 3 Core Sensor Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. SMOKE SENSOR */}
                <div className="bg-[#0b0e14] border-2 border-amber-500/60 p-3.5 flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#20293a] pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Wind className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-white uppercase">SMOKE / AIR QUALITY</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 border ${
                          espWifi.smoke.status === 'Hazardous'
                            ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                            : espWifi.smoke.status === 'Poor'
                            ? 'bg-yellow-950 text-yellow-300 border-yellow-500'
                            : 'bg-green-950 text-green-300 border-green-500'
                        }`}
                      >
                        {espWifi.smoke.status}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mb-2">
                      <div>
                        <span className="text-3xl font-bold text-white tracking-tight">
                          {espWifi.smoke.adc}
                        </span>
                        <span className="text-slate-400 ml-1.5 text-xs">/ 4095 ADC</span>
                      </div>
                      <div className="text-right">
                        <span className="text-cyan-300 font-bold text-base">{espWifi.smoke.ppm}</span>
                        <span className="text-slate-400 ml-1 text-xs">PPM</span>
                      </div>
                    </div>

                    {/* Visual Bar */}
                    <div className="w-full bg-[#18181c] h-2.5 border border-[#33333a] overflow-hidden mb-2">
                      <div
                        className={`h-full transition-all duration-300 ${
                          espWifi.smoke.adc > 1200 ? 'bg-red-500' : espWifi.smoke.adc > 600 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, (espWifi.smoke.adc / 2000) * 100)}%` }}
                      />
                    </div>

                    <div className="bg-black p-2 border border-[#1b2333] flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">SMOKE DETECTED:</span>
                      <span className={espWifi.smoke.smokeDetected ? 'text-red-400 font-bold animate-pulse' : 'text-green-400 font-semibold'}>
                        {espWifi.smoke.smokeDetected ? '⚠ FUMES DETECTED' : 'CLEAR'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 pt-2 border-t border-[#18202d] mt-2">
                    ESP32 ADC Pin 34 &bull; Calibrated for CO / Smoke
                  </div>
                </div>

                {/* 2. DHT SENSOR */}
                <div className="bg-[#0b0e14] border-2 border-cyan-500/60 p-3.5 flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#20293a] pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-orange-400" />
                        <span className="font-bold text-white uppercase">DHT22 MICROCLIMATE</span>
                      </div>
                      <span className="text-[10px] bg-black text-cyan-300 border border-cyan-700 px-2 py-0.5 font-bold">
                        PIN 4
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="bg-black p-2 border border-[#1b2333]">
                        <span className="text-slate-400 text-[10px] block">TEMPERATURE</span>
                        <span className="text-2xl font-bold text-white block mt-0.5">
                          {espWifi.dht.temperatureC.toFixed(1)}°C
                        </span>
                        <span className="text-[10px] text-orange-400 block">
                          Heat: {espWifi.dht.heatIndexC}°C
                        </span>
                      </div>

                      <div className="bg-black p-2 border border-[#1b2333]">
                        <span className="text-slate-400 text-[10px] block">HUMIDITY</span>
                        <span className="text-2xl font-bold text-cyan-300 block mt-0.5">
                          {espWifi.dht.humidityPercent}%
                        </span>
                        <span className="text-[10px] text-blue-400 block">
                          Dew: {espWifi.dht.dewPointC}°C
                        </span>
                      </div>
                    </div>

                    {weather && (
                      <div className="bg-black p-2 border border-[#1b2333] text-[11px] flex justify-between items-center">
                        <span className="text-slate-400">Google Weather Delta:</span>
                        <span className="text-yellow-300 font-bold">
                          Δ {(Math.abs(espWifi.dht.temperatureC - weather.temperatureC)).toFixed(1)}°C / Δ {(Math.abs(espWifi.dht.humidityPercent - weather.relativeHumidity))}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 pt-2 border-t border-[#18202d] mt-2">
                    Digital 1-Wire Pin 4 &bull; Ingesting live ground ambient
                  </div>
                </div>

                {/* 3. DISTANCE SENSOR */}
                <div className="bg-[#0b0e14] border-2 border-yellow-500/60 p-3.5 flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#20293a] pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-yellow-400" />
                        <span className="font-bold text-white uppercase">DISTANCE / PROXIMITY</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 border ${
                          espWifi.distance.alert === 'COLLISION_CRITICAL'
                            ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                            : espWifi.distance.alert === 'PROXIMITY_WARNING'
                            ? 'bg-yellow-950 text-yellow-300 border-yellow-500'
                            : 'bg-green-950 text-green-300 border-green-500'
                        }`}
                      >
                        {espWifi.distance.alert.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mb-2">
                      <div>
                        <span className="text-3xl font-bold text-white tracking-tight">
                          {espWifi.distance.distanceMeters.toFixed(2)}
                        </span>
                        <span className="text-slate-400 ml-1.5 text-xs">METERS</span>
                      </div>
                      <div className="text-right">
                        <span className="text-yellow-300 font-bold text-base">{espWifi.distance.distanceCm}</span>
                        <span className="text-slate-400 ml-1 text-xs">CM</span>
                      </div>
                    </div>

                    {/* Proximity Threshold Bar */}
                    <div className="w-full bg-[#18181c] h-2.5 border border-[#33333a] overflow-hidden mb-2 relative">
                      <div className="absolute top-0 bottom-0 left-[25%] w-0.5 bg-red-500" title="Critical 2.0m" />
                      <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-yellow-500" title="Warning 4.0m" />
                      <div
                        className={`h-full transition-all duration-300 ${
                          espWifi.distance.distanceMeters <= 2.0
                            ? 'bg-red-500'
                            : espWifi.distance.distanceMeters <= 4.0
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, (espWifi.distance.distanceMeters / 8.0) * 100)}%` }}
                      />
                    </div>

                    <div className="bg-black p-2 border border-[#1b2333] flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">HAZARD INTERLOCK:</span>
                      <span className={espWifi.distance.distanceMeters <= 2.0 ? 'text-red-400 font-bold animate-pulse' : 'text-green-400 font-semibold'}>
                        {espWifi.distance.distanceMeters <= 2.0 ? 'BRAKING MANDATORY' : 'ENVELOPE NOMINAL'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 pt-2 border-t border-[#18202d] mt-2">
                    Ultrasonic / LIDAR Trigger: 5 &bull; Echo: 18
                  </div>
                </div>
              </div>

              {/* DUAL COMPARISON: GOOGLE REGIONAL WEATHER vs ESP32 FIELD WEATHER */}
              {weather && (
                <div className="bg-[#090D14] border border-blue-500/60 p-3.5">
                  <div className="flex items-center justify-between border-b border-[#1c2738] pb-2 mb-3">
                    <span className="font-bold text-white uppercase flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-400" />
                      DUAL TELEMETRY COMPARISON: GOOGLE REGIONAL WEATHER vs ESP32 WI-FI GROUND TRUTH
                    </span>
                    <span className="text-[11px] text-cyan-300 font-bold">BOTH ACTIVE</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-black p-2.5 border border-[#182130]">
                      <span className="text-slate-400 text-[10px] block">TEMPERATURE</span>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="text-white font-bold text-base">{weather.temperatureC.toFixed(1)}°C (Google)</span>
                        <span className="text-cyan-300 font-bold text-base">{espWifi.dht.temperatureC.toFixed(1)}°C (ESP32)</span>
                      </div>
                      <span className="text-[10px] text-yellow-300 mt-1 block">
                        Delta: {(espWifi.dht.temperatureC - weather.temperatureC).toFixed(1)}°C
                      </span>
                    </div>

                    <div className="bg-black p-2.5 border border-[#182130]">
                      <span className="text-slate-400 text-[10px] block">HUMIDITY</span>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="text-white font-bold text-base">{weather.relativeHumidity}% (Google)</span>
                        <span className="text-cyan-300 font-bold text-base">{espWifi.dht.humidityPercent}% (ESP32)</span>
                      </div>
                      <span className="text-[10px] text-yellow-300 mt-1 block">
                        Delta: {(espWifi.dht.humidityPercent - weather.relativeHumidity)}% RH
                      </span>
                    </div>

                    <div className="bg-black p-2.5 border border-[#182130]">
                      <span className="text-slate-400 text-[10px] block">ATMOSPHERE / SMOKE</span>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="text-white font-bold text-xs">{weather.conditionText}</span>
                        <span className="text-amber-300 font-bold text-xs">{espWifi.smoke.ppm} PPM</span>
                      </div>
                      <span className="text-[10px] text-green-300 mt-1 block">
                        Status: {espWifi.smoke.status}
                      </span>
                    </div>

                    <div className="bg-black p-2.5 border border-[#182130]">
                      <span className="text-slate-400 text-[10px] block">ROAD &amp; CLEARANCE</span>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="text-white font-bold text-xs">μ={weather.frictionCoefficient.toFixed(2)}</span>
                        <span className="text-yellow-300 font-bold text-xs">{espWifi.distance.distanceMeters.toFixed(2)}m</span>
                      </div>
                      <span className="text-[10px] text-cyan-300 mt-1 block">
                        Clearance: {espWifi.distance.alert}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw JSON Stream Monitor */}
              <div className="bg-black p-3 border border-[#1f2838]">
                <div className="flex items-center justify-between border-b border-[#18202d] pb-1.5 mb-2 text-[11px]">
                  <span className="font-bold text-slate-300">RAW ESP32 WI-FI JSON STREAM</span>
                  <span className="text-cyan-400">{espWifi.packetsCount} PACKETS RECEIVED</span>
                </div>
                <pre className="p-2.5 bg-[#07090e] border border-[#141a24] text-[11px] text-cyan-300 overflow-x-auto whitespace-pre-wrap select-text">
                  {espWifi.rawPayload ||
                    JSON.stringify(
                      {
                        smoke: espWifi.smoke.adc,
                        ppm: espWifi.smoke.ppm,
                        temp: espWifi.dht.temperatureC,
                        hum: espWifi.dht.humidityPercent,
                        distance: espWifi.distance.distanceMeters,
                        ip: ipAddress,
                        status: 'OK',
                      },
                      null,
                      2
                    )}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: ESP32 ARDUINO C++ CODE */}
          {activeTab === 'firmware' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-[#12141c] p-3 border border-[#262c3c]">
                <div>
                  <span className="font-bold text-white text-xs block">ESP32 ARDUINO C++ FIRMWARE (READY TO FLASH)</span>
                  <span className="text-slate-400 text-[11px]">
                    Includes Wi-Fi SoftAP mode (192.168.4.1), HTTP WebServer on port 80 serving /data, MQ Smoke on Pin 34, DHT on Pin 4, and HC-SR04 on Pins 5/18.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-green-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'COPIED!' : 'COPY SKETCH'}</span>
                </button>
              </div>

              {/* Pin Mapping Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="bg-black p-2 border border-[#202736]">
                  <span className="text-cyan-400 font-bold block">1. NRF24L01 SPI CONNECTIONS</span>
                  <span className="text-slate-300 block">CE &rarr; GPIO 4 &bull; CSN &rarr; GPIO 5</span>
                  <span className="text-cyan-300 font-bold block">SCK &rarr; 18 &bull; MISO &rarr; 19 &bull; MOSI &rarr; 23</span>
                  <span className="text-yellow-300 font-bold block">VCC &rarr; 3.3V (with 10µF Cap)</span>
                </div>
                <div className="bg-black p-2 border border-[#202736]">
                  <span className="text-orange-400 font-bold block">2. NRF24 RF CONFIGURATION</span>
                  <span className="text-slate-300 block">Address: "00001" &bull; Channel: 108</span>
                  <span className="text-slate-300 block">DataRate: 250 kbps &bull; PA: LOW</span>
                  <span className="text-green-300 font-bold block">Rx Buffer: temp, hum, smoke</span>
                </div>
                <div className="bg-black p-2 border border-[#202736]">
                  <span className="text-purple-400 font-bold block">3. WI-FI HTTP SERVER</span>
                  <span className="text-slate-300 block">SoftAP SSID: ESP32-WEATHER-STATION</span>
                  <span className="text-cyan-300 font-bold block">Default Gateway: 192.168.4.1</span>
                  <span className="text-amber-300 font-bold block">Endpoint: http://192.168.4.1/data</span>
                </div>
              </div>

              {/* Code block */}
              <div className="bg-black border border-[#202736] max-h-96 overflow-y-auto p-3">
                <pre className="text-[11px] text-green-300 font-mono select-text whitespace-pre-wrap leading-relaxed">
                  {ARDUINO_FIRMWARE_CODE}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-4 py-2.5 bg-[#0a0d13] border-t border-[#18202d] flex items-center justify-between font-mono text-xs">
          <span className="text-slate-400">
            STATUS: <strong className={espWifi.connected ? 'text-green-300' : 'text-slate-300'}>{espWifi.connected ? 'ONLINE' : 'OFFLINE'}</strong> &bull; TARGET: {normalizeEsp32Url(ipAddress)}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1b2230] hover:bg-[#252e40] text-white font-bold cursor-pointer transition-colors border border-[#303c52]"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

export const ARDUINO_FIRMWARE_CODE = `/*
 * ==============================================================================
 * ESP32 NRF24L01 RECEIVER & WI-FI TELEMETRY GATEWAY BRIDGE
 * ==============================================================================
 * NMDC Central - Bailadila Haul Dispatch System
 *
 * This code runs on your ESP32 Receiver:
 *   1. Receives wireless packets from your field sensor node via NRF24L01 (2.4GHz RF)
 *      - Temperature (°C)
 *      - Humidity (%)
 *      - Smoke (MQ Analog / PPM)
 *      - Distance (Ultrasonic / Proximity)
 *   2. Starts a Wi-Fi Access Point ("ESP32-WEATHER-STATION", IP: 192.168.4.1)
 *      and/or connects to your local Wi-Fi router.
 *   3. Runs a high-performance HTTP WebServer serving GET /data with CORS enabled.
 *   4. Streams JSON telemetry directly into the NMDC Bailadila Dispatch Dashboard!
 *
 * Pin Connections (ESP32 to NRF24L01):
 *   - CE   -> GPIO 4
 *   - CSN  -> GPIO 5
 *   - SCK  -> GPIO 18
 *   - MISO -> GPIO 19
 *   - MOSI -> GPIO 23
 *   - VCC  -> 3.3V (Crucial: 3.3V ONLY, add a 10uF capacitor between VCC and GND)
 *   - GND  -> GND
 * ==============================================================================
 */

#include <SPI.h>
#include <nRF24L01.h>
#include <RF24.h>
#include <WiFi.h>
#include <WebServer.h>

#define CE_PIN 4
#define CSN_PIN 5

RF24 radio(CE_PIN, CSN_PIN);
const byte address[6] = "00001";

// Sensor Data Packet Structure matching Transmitter
struct SensorData {
  float temperature;
  float humidity;
  int smoke;
};

SensorData data;
float distanceMm = 11.0; // Distance value (modify if your packet transmits distance)
unsigned long packetsReceived = 0;
unsigned long lastPacketTime = 0;

// Web Server on port 80
WebServer server(80);

// Wi-Fi Configuration
// Mode A: ESP32 broadcasts its own Wi-Fi Hotspot (Access Point)
const char* ap_ssid = "ESP32-WEATHER-STATION";
const char* ap_password = ""; // Open Wi-Fi (connect directly with no password)

// Mode B: Local Wi-Fi Router (Uncomment and fill to connect to router instead)
// const char* router_ssid = "YOUR_WIFI_NAME";
// const char* router_password = "YOUR_WIFI_PASSWORD";

void handleDataEndpoint() {
  // Convert distance from mm to meters for radar collision engine
  float distanceMeters = distanceMm / 1000.0;
  
  // Convert smoke ADC to estimated PPM (0-4095 scale)
  int smokeVal = data.smoke;
  float smokePpm = (smokeVal > 2000) ? smokeVal : ((smokeVal / 4095.0) * 1800.0 + 200.0);

  // Build JSON Payload for Dashboard
  String json = "{";
  json += "\\"temperature\\":" + String(data.temperature, 2) + ",";
  json += "\\"humidity\\":" + String(data.humidity, 2) + ",";
  json += "\\"temp\\":" + String(data.temperature, 2) + ",";
  json += "\\"hum\\":" + String(data.humidity, 2) + ",";
  json += "\\"smoke\\":" + String(data.smoke) + ",";
  json += "\\"smokePpm\\":" + String((int)smokePpm) + ",";
  json += "\\"distance\\":" + String(distanceMeters, 3) + ",";
  json += "\\"dist\\":" + String(distanceMeters, 3) + ",";
  json += "\\"distanceMm\\":" + String(distanceMm, 1) + ",";
  json += "\\"distanceCm\\":" + String(distanceMm / 10.0, 1) + ",";
  json += "\\"packetsCount\\":" + String(packetsReceived) + ",";
  json += "\\"source\\":\\"NRF24_BRIDGE\\",";
  json += "\\"status\\":\\"OK\\",";
  json += "\\"rssi\\":" + String(WiFi.RSSI()) + ",";
  json += "\\"lastPacketAgeSec\\":" + String(lastPacketTime > 0 ? (millis() - lastPacketTime) / 1000 : 9999);
  json += "}";

  // Enable CORS so the browser dashboard can fetch from any origin
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
  server.send(200, "application/json", json);
}

void handleOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
  server.send(204);
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println();
  Serial.println("==================================================");
  Serial.println(" ESP32 NRF24 RECEIVER & WI-FI TELEMETRY GATEWAY");
  Serial.println(" NMDC Central - Bailadila Haul Dispatch System");
  Serial.println("==================================================");

  // 1. Initialize NRF24L01 Receiver
  Serial.println("Starting NRF24...");
  if (!radio.begin()) {
    Serial.println("[ERROR] NRF24 NOT DETECTED! Check wiring (CE=4, CSN=5, 3.3V)");
    while (1) {
      delay(1000);
    }
  }

  Serial.println("[OK] NRF24 DETECTED!");
  radio.setChannel(108);
  radio.setDataRate(RF24_250KBPS);
  radio.setPALevel(RF24_PA_LOW);
  radio.openReadingPipe(0, address);
  radio.startListening();
  Serial.println("[OK] NRF24 CONFIGURED & LISTENING on Channel 108");

  // 2. Start Wi-Fi Access Point (SoftAP)
  Serial.println("Starting Wi-Fi Access Point...");
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(ap_ssid, ap_password);
  
  // Optional: Connect to router if SSID specified
  // WiFi.begin(router_ssid, router_password);

  IPAddress myIP = WiFi.softAPIP();
  Serial.print("[OK] Wi-Fi AP Online! SSID: ");
  Serial.println(ap_ssid);
  Serial.print("     Gateway IP Address : ");
  Serial.println(myIP); // Default 192.168.4.1

  // 3. Configure Web Server Routes
  server.on("/data", HTTP_GET, handleDataEndpoint);
  server.on("/data", HTTP_OPTIONS, handleOptions);
  server.on("/metrics", HTTP_GET, handleDataEndpoint);
  server.on("/", HTTP_GET, handleDataEndpoint);
  server.begin();

  Serial.println("[OK] HTTP Telemetry Server Started on Port 80");
  Serial.println("==================================================");
  Serial.println("RECEIVER READY - Connect PC/Phone to Wi-Fi:");
  Serial.println("SSID: ESP32-WEATHER-STATION");
  Serial.println("Dashboard URL: http://192.168.4.1/data");
  Serial.println("==================================================");
}

void loop() {
  // 1. Handle incoming Wi-Fi requests from dashboard
  server.handleClient();

  // 2. Read wireless packets from NRF24
  if (radio.available()) {
    radio.read(&data, sizeof(data));
    packetsReceived++;
    lastPacketTime = millis();

    Serial.println();
    Serial.println("===== NRF24 SENSOR DATA RECEIVED =====");
    Serial.print("Temperature : ");
    Serial.print(data.temperature);
    Serial.println(" °C");

    Serial.print("Humidity    : ");
    Serial.print(data.humidity);
    Serial.println(" %");

    Serial.print("Smoke       : ");
    Serial.println(data.smoke);

    Serial.print("Distance    : ");
    Serial.print(distanceMm);
    Serial.println(" mm");
    Serial.println("======================================");
  }

  delay(2);
}
`;
export default Esp32WifiModal;
