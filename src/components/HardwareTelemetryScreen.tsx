import React, { useState } from 'react';
import {
  Cpu,
  Radio,
  Wind,
  Thermometer,
  Eye,
  Navigation,
  Activity,
  Vibrate,
  Zap,
  AlertTriangle,
  CheckCircle,
  Play,
  Square,
  Sliders,
  RefreshCw,
  Usb,
  Wifi,
  Compass,
  Gauge,
  Droplets,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { HardwareTelemetry, UserRole } from '../types';
import {
  isWebSerialSupported,
  connectWebSerial,
  disconnectWebSerial,
  sendWebSerialCommand,
  sendWebSocketCommand,
  simulateEsp32CheckpointPacket,
} from '../utils/hardwareReceiver';

interface HardwareTelemetryScreenProps {
  telemetry: HardwareTelemetry;
  onUpdateTelemetry: (data: Partial<HardwareTelemetry>) => void;
  userRole?: UserRole;
  onOpenEsp32WifiModal?: () => void;
}

export const HardwareTelemetryScreen: React.FC<HardwareTelemetryScreenProps> = ({
  telemetry,
  onUpdateTelemetry,
  userRole = 'dispatcher',
  onOpenEsp32WifiModal,
}) => {
  const [isConnectingSerial, setIsConnectingSerial] = useState(false);
  const [serialError, setSerialError] = useState<string | null>(null);
  const [isTestModeOpen, setIsTestModeOpen] = useState(false);
  const [hapticTriggerFeedback, setHapticTriggerFeedback] = useState<string | null>(null);

  const isDispatcher = userRole === 'dispatcher';

  // Handle Web Serial Connect
  const handleConnectSerial = async () => {
    setSerialError(null);
    setIsConnectingSerial(true);
    try {
      const portName = await connectWebSerial(
        telemetry.baudRate || 115200,
        (newData) => {
          onUpdateTelemetry({
            ...newData,
            connected: true,
            connectionSource: 'WEB_SERIAL_USB',
            lastReceivedTime: new Date().toLocaleTimeString(),
            packetsReceived: telemetry.packetsReceived + 1,
          });
        },
        (err) => {
          setSerialError(err);
          onUpdateTelemetry({ connected: false });
        }
      );

      if (portName) {
        onUpdateTelemetry({
          connected: true,
          connectionSource: 'WEB_SERIAL_USB',
          serialPortName: portName,
          lastReceivedTime: new Date().toLocaleTimeString(),
        });
      }
    } finally {
      setIsConnectingSerial(false);
    }
  };

  const handleDisconnectSerial = async () => {
    await disconnectWebSerial();
    onUpdateTelemetry({
      connected: false,
      connectionSource: 'SIMULATOR',
      serialPortName: undefined,
    });
  };

  // Test trigger for the 2 Mini Vibration Motors
  const handleTriggerVibration = async () => {
    onUpdateTelemetry({
      vibrationMotors: {
        motor1Active: true,
        motor2Active: true,
        mode: 'INTERMITTENT_ALERT',
        triggerReason: 'Manual Dispatcher Haptic Test Pulse',
        lastTriggeredTime: new Date().toLocaleTimeString(),
      },
    });

    // Send hardware command over serial and websocket
    await sendWebSerialCommand('CMD:VIBRATE=1');
    sendWebSocketCommand({ command: 'VIBRATE', state: 1, durationMs: 1500 });

    setHapticTriggerFeedback('Haptic pulse sent to Motor 1 & Motor 2 (1.5s)!');

    setTimeout(async () => {
      onUpdateTelemetry({
        vibrationMotors: {
          motor1Active: false,
          motor2Active: false,
          mode: 'OFF',
          triggerReason: 'Nominal Operations',
        },
      });
      await sendWebSerialCommand('CMD:VIBRATE=0');
      sendWebSocketCommand({ command: 'VIBRATE', state: 0 });
      setHapticTriggerFeedback(null);
    }, 1500);
  };

  const lidarDist = telemetry.lidar8m.distanceMeters;
  const isLidarCritical = lidarDist <= telemetry.lidar8m.criticalThresholdM;
  const isLidarWarning = !isLidarCritical && lidarDist <= telemetry.lidar8m.warningThresholdM;

  const isMqHazardous = telemetry.mq135.airQualityStatus === 'Hazardous';
  const isMqPoor = telemetry.mq135.airQualityStatus === 'Poor';

  return (
    <div className="flex flex-col gap-3.5 select-none text-[#E0E0E0] pb-8 font-sans">
      {/* 1. Header Banner & USB Connection Bar */}
      <div className="bg-[#0A0A0B] border border-[#27272a] p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-950 border border-blue-500 text-blue-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-base font-bold text-white tracking-wider uppercase">
                HARDWARE TELEMETRY HUB // REAL-TIME SENSOR INGESTION
              </h1>
              <span
                className={`font-mono text-[11px] font-bold px-2 py-0.5 border ${
                  telemetry.connected
                    ? 'bg-green-950 text-green-300 border-green-500 animate-pulse'
                    : 'bg-blue-950 text-blue-300 border-blue-500'
                }`}
              >
                {telemetry.connected
                  ? `${telemetry.connectionSource} ONLINE`
                  : 'STANDBY / SIMULATOR READY'}
              </span>
            </div>
            <p className="font-mono text-xs text-slate-300 mt-0.5">
              Live data from MQ-135 Gas, DHT22 Temp/Hum, LIDAR 8M, NEO-6M GPS, MPU-6050 &amp; 2x Vibration Motors.
            </p>
          </div>
        </div>

        {/* USB / Web Serial & Simulator Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {telemetry.connected ? (
            <button
              type="button"
              onClick={handleDisconnectSerial}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-3 py-2 bg-red-950 hover:bg-red-900 border border-red-500 text-red-200 font-mono text-xs font-bold transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>DISCONNECT {telemetry.serialPortName || 'HARDWARE'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isConnectingSerial}
              onClick={handleConnectSerial}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold border border-blue-400 shadow-md transition-colors cursor-pointer"
            >
              <Usb className="w-4 h-4" />
              <span>{isConnectingSerial ? 'CONNECTING COM...' : 'CONNECT USB SERIAL (COM)'}</span>
            </button>
          )}

          {onOpenEsp32WifiModal && (
            <button
              type="button"
              onClick={onOpenEsp32WifiModal}
              className={`px-3 py-2 border font-mono text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                telemetry.esp32Wifi?.connected
                  ? 'bg-cyan-950 text-cyan-200 border-cyan-400 shadow-xs'
                  : 'bg-[#10141d] hover:bg-[#192230] text-cyan-300 border-cyan-500'
              }`}
              title="Connect or configure ESP32 Wi-Fi Telemetry Station (Smoke, DHT, Distance)"
            >
              <Wifi className={`w-3.5 h-3.5 ${telemetry.esp32Wifi?.connected ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
              <span>{telemetry.esp32Wifi?.connected ? 'ESP32 WI-FI ONLINE' : 'CONFIG ESP32 WI-FI'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onUpdateTelemetry(simulateEsp32CheckpointPacket(1))}
            className="px-3 py-2 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-500 font-mono text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Inject real-time ESP32 packet (DHT22, MQ-135 ADC, NRF24 DATA SENT)"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="whitespace-nowrap">SIMULATE ESP32 PACKET</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTestModeOpen(!isTestModeOpen)}
            className={`px-3 py-2 border font-mono text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              isTestModeOpen
                ? 'bg-amber-600 text-white border-amber-400'
                : 'bg-[#141418] text-slate-300 border-[#333338] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isTestModeOpen ? 'HIDE TEST BENCH' : 'HARDWARE TEST BENCH'}</span>
          </button>
        </div>
      </div>

      {serialError && (
        <div className="p-3.5 bg-red-950/90 border-2 border-red-500 text-red-200 font-mono text-xs flex flex-col gap-2 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-red-300">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{serialError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSerialError(null)}
              className="text-slate-400 hover:text-white px-2 py-0.5 border border-red-800 text-[11px] cursor-pointer"
            >
              DISMISS
            </button>
          </div>

          <div className="bg-black/80 p-2.5 border border-red-800/60 text-[11px] text-slate-300 flex flex-col gap-1 leading-relaxed">
            <span className="text-yellow-300 font-bold">
              💡 HOW TO FIX: "Failed to execute 'open' on 'SerialPort'"
            </span>
            <span>
              1. <strong>Close the Arduino IDE Serial Monitor</strong>: Windows COM ports are strictly single-client. If the Serial Monitor or Serial Plotter in the Arduino IDE is open, close it!
            </span>
            <span>
              2. <strong>Close any other serial terminal</strong>: Ensure PuTTY, VS Code Serial Monitor, or other browser tabs accessing the port are closed.
            </span>
            <span>
              3. <strong>Click "CONNECT USB SERIAL (COM)"</strong> again and select your ESP32 port.
            </span>
          </div>
        </div>
      )}

      {hapticTriggerFeedback && (
        <div className="p-3 bg-green-950/80 border border-green-500 text-green-200 font-mono text-xs font-bold flex items-center gap-2 animate-bounce">
          <Vibrate className="w-4 h-4 text-green-400 shrink-0 animate-spin" />
          <span>{hapticTriggerFeedback}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DEDICATED ESP32 WI-FI WEATHER & IOT TELEMETRY STATION (SMOKE, DHT, DIST) */}
      {/* ========================================================================= */}
      <div className="bg-[#090C12] border-2 border-cyan-500/70 p-4 shadow-xl flex flex-col gap-3 font-mono">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#1c2738] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-950 border border-cyan-400 text-cyan-300">
              <Wifi className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  ESP32 WI-FI WEATHER &amp; SENSOR HUB // SMOKE &bull; DHT &bull; DISTANCE
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 border font-bold ${
                    telemetry.esp32Wifi?.connected
                      ? 'bg-green-950 text-green-300 border-green-500 animate-pulse'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  {telemetry.esp32Wifi?.connected ? 'WI-FI STREAM ONLINE' : 'WI-FI STANDBY'}
                </span>
              </div>
              <span className="text-xs text-slate-400 block">
                Target IP: <strong className="text-cyan-300">{telemetry.esp32Wifi?.ipAddress || '192.168.4.1'}</strong> &bull; Mode: {telemetry.esp32Wifi?.mode || 'HTTP_POLL'} &bull; Packets: {telemetry.esp32Wifi?.packetsCount || 0}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenEsp32WifiModal && (
              <button
                type="button"
                onClick={onOpenEsp32WifiModal}
                className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500 text-cyan-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>CONFIG WI-FI</span>
              </button>
            )}
          </div>
        </div>

        {/* 3-Column Real-time Metrics Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Smoke Sensor */}
          <div className="bg-black p-3 border border-[#1b2636] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-amber-400 font-bold flex items-center gap-1 uppercase">
                  <Wind className="w-3.5 h-3.5" />
                  <span>SMOKE / GAS SENSOR</span>
                </span>
                <span className="text-[10px] text-slate-400">GPIO 34</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold text-white">
                    {telemetry.esp32Wifi?.smoke.adc ?? telemetry.mq135.rawAdc ?? 412}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">ADC</span>
                </div>
                <div className="text-right">
                  <span className="text-amber-300 font-bold text-lg">
                    {telemetry.esp32Wifi?.smoke.ppm ?? telemetry.mq135.ppm ?? 395}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">PPM</span>
                </div>
              </div>
              <div className="mt-2 w-full bg-[#18181c] h-2 border border-[#333338] overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, ((telemetry.esp32Wifi?.smoke.adc ?? telemetry.mq135.rawAdc ?? 412) / 2000) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#18202d] flex justify-between text-[10px]">
              <span className="text-slate-400">Status:</span>
              <span className="text-green-300 font-bold">
                {telemetry.esp32Wifi?.smoke.status ?? telemetry.mq135.airQualityStatus ?? 'Clean'}
              </span>
            </div>
          </div>

          {/* DHT Microclimate Sensor */}
          <div className="bg-black p-3 border border-[#1b2636] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-cyan-400 font-bold flex items-center gap-1 uppercase">
                  <Thermometer className="w-3.5 h-3.5" />
                  <span>DHT22 MICROCLIMATE</span>
                </span>
                <span className="text-[10px] text-slate-400">GPIO 4</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold text-white">
                    {(telemetry.esp32Wifi?.dht.temperatureC ?? telemetry.dht22.temperatureC ?? 24.2).toFixed(1)}°C
                  </span>
                  <span className="text-[10px] text-slate-400 block">TEMPERATURE</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-cyan-300">
                    {telemetry.esp32Wifi?.dht.humidityPercent ?? telemetry.dht22.humidityPercent ?? 78}%
                  </span>
                  <span className="text-[10px] text-slate-400 block">HUMIDITY</span>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#18202d] flex justify-between text-[10px] text-slate-400">
              <span>Heat: {telemetry.esp32Wifi?.dht.heatIndexC ?? telemetry.dht22.heatIndexC ?? 25.1}°C</span>
              <span>Dew: {telemetry.esp32Wifi?.dht.dewPointC ?? telemetry.dht22.dewPointC ?? 20.3}°C</span>
            </div>
          </div>

          {/* Distance / Proximity Sensor */}
          <div className="bg-black p-3 border border-[#1b2636] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-yellow-400 font-bold flex items-center gap-1 uppercase">
                  <Eye className="w-3.5 h-3.5" />
                  <span>DISTANCE / PROXIMITY</span>
                </span>
                <span className="text-[10px] text-slate-400">TRIG 5 / ECHO 18</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold text-white">
                    {(telemetry.esp32Wifi?.distance.distanceMeters ?? telemetry.lidar8m.distanceMeters ?? 5.42).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">METERS</span>
                </div>
                <div className="text-right">
                  <span className="text-yellow-300 font-bold text-base">
                    {telemetry.esp32Wifi?.distance.distanceCm ?? Math.round((telemetry.lidar8m.distanceMeters ?? 5.42) * 100)}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">CM</span>
                </div>
              </div>
              <div className="mt-2 w-full bg-[#18181c] h-2 border border-[#333338] overflow-hidden relative">
                <div className="absolute top-0 bottom-0 left-[25%] w-0.5 bg-red-500" />
                <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-yellow-500" />
                <div
                  className="h-full bg-yellow-500 transition-all duration-200"
                  style={{
                    width: `${Math.min(100, ((telemetry.esp32Wifi?.distance.distanceMeters ?? telemetry.lidar8m.distanceMeters ?? 5.4) / 8.0) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#18202d] flex justify-between text-[10px]">
              <span className="text-slate-400">Obstacle Alert:</span>
              <span className="text-cyan-300 font-bold">
                {telemetry.esp32Wifi?.distance.alert ?? telemetry.lidar8m.obstacleAlert ?? 'CLEAR'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEDICATED STATIONARY CHECKPOINT ESP32 & NRF24L01 CONTROLLER PANEL */}
      {/* ========================================================================= */}
      <div className="bg-[#090B10] border-2 border-cyan-500/60 p-4 shadow-xl flex flex-col gap-3 font-mono">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#20293a] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-950 border border-cyan-500 text-cyan-300">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  STATIONARY CHECKPOINT IOT NODE // ESP32 + NRF24L01 + DHT22 + MQ-135
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/80 text-blue-200 border border-blue-500 font-bold rounded-xs">
                  NODE1
                </span>
              </div>
              <span className="text-xs text-slate-400 block">
                Ingesting Pin 4 (DHT22), Pin 34 (MQ-135 ADC), and CE:27/CSN:5 (NRF24L01 250kbps)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 border font-bold flex items-center gap-1.5 ${
                telemetry.checkpointStation?.nrfStatus === 'DATA SENT'
                  ? 'bg-green-950 text-green-300 border-green-500 animate-pulse'
                  : 'bg-black text-slate-400 border-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span>NRF24: {telemetry.checkpointStation?.nrfStatus || 'STANDBY'}</span>
            </span>

            <span className="text-xs px-2 py-1 bg-black border border-[#2c3345] text-cyan-300 font-bold">
              115200 BAUD
            </span>
          </div>
        </div>

        {/* 4-Column Sensor Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* 1. Station Identity */}
          <div className="bg-black p-3 border border-[#1f2838] flex flex-col justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-bold">CHECKPOINT ASSIGNMENT</span>
              <span className="text-base text-cyan-300 font-bold mt-1 block">
                {telemetry.checkpointStation?.checkpointCode || 'CP-01'}: {telemetry.checkpointStation?.checkpointName || 'Pit Floor Sump Gate'}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Haul Ramp RL 1,050m &bull; Speed Cap: 20 km/h
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-[#18202d] text-[10px] text-slate-500">
              Checkpoint ID: {telemetry.checkpointStation?.checkpointId || 1}
            </div>
          </div>

          {/* 2. DHT22 */}
          <div className="bg-black p-3 border border-[#1f2838] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                  <span>DHT22 SENSOR</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-bold">PIN 4</span>
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <div>
                  <span className="text-2xl font-bold text-white">{telemetry.dht22.temperatureC.toFixed(1)}°C</span>
                  <span className="text-[10px] text-slate-400 block">TEMP</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-cyan-300">{telemetry.dht22.humidityPercent}%</span>
                  <span className="text-[10px] text-slate-400 block">HUMIDITY</span>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#18202d] flex justify-between text-[10px] text-slate-400">
              <span>Heat Index: {telemetry.dht22.heatIndexC}°C</span>
              <span>Dew: {telemetry.dht22.dewPointC}°C</span>
            </div>
          </div>

          {/* 3. MQ-135 ADC */}
          <div className="bg-black p-3 border border-[#1f2838] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  <span>MQ-135 AIR</span>
                </span>
                <span className="text-[10px] text-amber-400 font-bold">PIN 34 (ADC)</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">
                  {telemetry.mq135.rawAdc ?? telemetry.checkpointStation?.mq135Adc ?? 412}
                </span>
                <span className="text-xs text-slate-400 font-bold">/ 4095 ADC</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-cyan-300 font-bold">{telemetry.mq135.ppm} PPM</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 font-bold rounded-xs ${
                    telemetry.mq135.airQualityStatus === 'Clean'
                      ? 'bg-green-950 text-green-300 border border-green-600'
                      : 'bg-yellow-950 text-yellow-300 border border-yellow-600'
                  }`}
                >
                  {telemetry.mq135.airQualityStatus}
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#18202d] text-[10px] text-slate-400 flex justify-between">
              <span>Voltage: {telemetry.mq135.rawVoltage}V</span>
              <span className={telemetry.mq135.smokeDetected ? 'text-red-400 font-bold' : 'text-green-400 font-semibold'}>
                {telemetry.mq135.smokeDetected ? 'Fumes Detected' : 'Air Nominal'}
              </span>
            </div>
          </div>

          {/* 4. NRF24L01 Link */}
          <div className="bg-black p-3 border border-[#1f2838] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-purple-400" />
                  <span>NRF24L01 TRANSCEIVER</span>
                </span>
                <span className="text-[10px] text-purple-300 font-bold">2.4 GHz</span>
              </div>
              <div className="mt-1 flex flex-col gap-0.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Address:</span>
                  <span className="text-white font-bold">{telemetry.checkpointStation?.nrfAddress || 'NODE1'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Data Rate:</span>
                  <span className="text-cyan-300 font-bold">250 KBPS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PA Level:</span>
                  <span className="text-slate-200">RF24_PA_LOW</span>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#18202d] text-[10px] text-slate-400 flex justify-between">
              <span>CE: 27 &bull; CSN: 5</span>
              <span className="text-green-400 font-bold">
                {telemetry.checkpointStation?.lastReceived || 'Online'}
              </span>
            </div>
          </div>
        </div>

        {/* Live ESP32 Serial Terminal Monitor */}
        <div className="bg-[#050508] border border-[#1e2535] p-2.5 rounded-xs">
          <div className="flex items-center justify-between border-b border-[#181e2b] pb-1.5 mb-2 text-[11px]">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>LIVE ESP32 SERIAL MONITOR STREAM (115200 BAUD)</span>
            </span>
            <span className="text-slate-500">USB COM / Web Serial Reader</span>
          </div>

          <div className="bg-black/90 p-2 border border-[#141a26] text-[11px] font-mono text-cyan-300 max-h-24 overflow-y-auto flex flex-col gap-0.5 select-text">
            {telemetry.rawSerialLogs && telemetry.rawSerialLogs.length > 0 ? (
              telemetry.rawSerialLogs.map((line, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-slate-600 select-none">&gt;</span>
                  <span className={line.includes('ERROR') ? 'text-red-400' : line.includes('OK') ? 'text-green-400' : line.includes('DATA SENT') ? 'text-cyan-200 font-bold' : 'text-slate-200'}>
                    {line}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-500 italic">
                Awaiting serial transmission from ESP32... Click "CONNECT USB SERIAL" or "SIMULATE ESP32 PACKET".
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Optional Hardware Test Bench Sliders for bench-testing */}
      {isTestModeOpen && (
        <div className="p-4 bg-[#0F0F12] border-2 border-amber-500/80 flex flex-col gap-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-amber-500/40 pb-2">
            <span className="font-bold text-amber-300 uppercase flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              INTERACTIVE HARDWARE TEST BENCH (CALIBRATION SLIDERS)
            </span>
            <span className="text-slate-400 text-[11px]">BENCH TESTING WITHOUT PHYSICAL USB</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* MQ-135 slider */}
            <div className="flex flex-col gap-1 bg-black p-2.5 border border-[#2a2a30]">
              <div className="flex justify-between text-slate-300 font-bold">
                <span>MQ-135 AIR PPM:</span>
                <span className="text-white">{telemetry.mq135.ppm} PPM</span>
              </div>
              <input
                type="range"
                min={200}
                max={1600}
                step={10}
                value={telemetry.mq135.ppm}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const status = val > 1000 ? 'Hazardous' : val > 700 ? 'Poor' : val > 450 ? 'Moderate' : 'Clean';
                  onUpdateTelemetry({
                    mq135: {
                      ...telemetry.mq135,
                      ppm: val,
                      airQualityStatus: status,
                      smokeDetected: val > 800,
                      co2EstimatedPpm: Math.round(val * 1.06),
                    },
                  });
                }}
                className="cursor-pointer accent-blue-500"
              />
            </div>

            {/* LIDAR 8M slider */}
            <div className="flex flex-col gap-1 bg-black p-2.5 border border-[#2a2a30]">
              <div className="flex justify-between text-slate-300 font-bold">
                <span>LIDAR 8M DISTANCE:</span>
                <span className="text-amber-300">{telemetry.lidar8m.distanceMeters.toFixed(2)} M</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={8.0}
                step={0.05}
                value={telemetry.lidar8m.distanceMeters}
                onChange={(e) => {
                  const d = Number(e.target.value);
                  const alert = d <= 2.0 ? 'COLLISION_CRITICAL' : d <= 4.0 ? 'PROXIMITY_WARNING' : 'CLEAR';
                  onUpdateTelemetry({
                    lidar8m: {
                      ...telemetry.lidar8m,
                      distanceMeters: parseFloat(d.toFixed(2)),
                      obstacleAlert: alert,
                    },
                    // If critical, auto-trigger vibration motors
                    vibrationMotors: {
                      ...telemetry.vibrationMotors,
                      motor1Active: d <= 2.0,
                      motor2Active: d <= 2.0,
                      mode: d <= 2.0 ? 'CONTINUOUS_ALARM' : 'OFF',
                      triggerReason: d <= 2.0 ? 'LIDAR Obstacle Distance < 2.0m' : 'Nominal Operations',
                    },
                  });
                }}
                className="cursor-pointer accent-amber-500"
              />
            </div>

            {/* MPU-6050 Pitch slider */}
            <div className="flex flex-col gap-1 bg-black p-2.5 border border-[#2a2a30]">
              <div className="flex justify-between text-slate-300 font-bold">
                <span>MPU-6050 PITCH (GRADE):</span>
                <span className="text-white">{telemetry.mpu6050.pitchDeg.toFixed(1)}° ({telemetry.mpu6050.inclineGradePercent}%)</span>
              </div>
              <input
                type="range"
                min={-20}
                max={20}
                step={0.5}
                value={telemetry.mpu6050.pitchDeg}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  const grade = parseFloat((Math.tan((Math.abs(p) * Math.PI) / 180) * 100).toFixed(1));
                  const isHazard = Math.abs(p) > 15;
                  onUpdateTelemetry({
                    mpu6050: {
                      ...telemetry.mpu6050,
                      pitchDeg: p,
                      inclineGradePercent: grade,
                      rolloverHazard: isHazard,
                    },
                    vibrationMotors: {
                      ...telemetry.vibrationMotors,
                      motor1Active: isHazard,
                      motor2Active: isHazard,
                      mode: isHazard ? 'INTERMITTENT_ALERT' : 'OFF',
                      triggerReason: isHazard ? 'Incline Pitch > 15° Alert' : 'Nominal Operations',
                    },
                  });
                }}
                className="cursor-pointer accent-cyan-500"
              />
            </div>

            {/* DHT22 Temp slider */}
            <div className="flex flex-col gap-1 bg-black p-2.5 border border-[#2a2a30]">
              <div className="flex justify-between text-slate-300 font-bold">
                <span>DHT22 TEMP:</span>
                <span className="text-orange-400">{telemetry.dht22.temperatureC.toFixed(1)}°C</span>
              </div>
              <input
                type="range"
                min={10}
                max={45}
                step={0.5}
                value={telemetry.dht22.temperatureC}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  onUpdateTelemetry({
                    dht22: {
                      ...telemetry.dht22,
                      temperatureC: t,
                    },
                  });
                }}
                className="cursor-pointer accent-orange-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Primary 6-Sensor Live Instrument Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* ========================================================================= */}
        {/* COMPONENT 1: MQ 135 - AIR QUALITY SENSOR */}
        {/* ========================================================================= */}
        <div className="bg-[#0A0A0B] border border-[#26262a] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#26262a] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  MQ-135 AIR QUALITY SENSOR
                </span>
              </div>
              <span
                className={`font-mono text-[10px] font-bold px-2 py-0.5 border ${
                  isMqHazardous
                    ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                    : isMqPoor
                    ? 'bg-yellow-950 text-yellow-300 border-yellow-500'
                    : 'bg-green-950 text-green-300 border-green-500'
                }`}
              >
                {telemetry.mq135.airQualityStatus.toUpperCase()}
              </span>
            </div>

            <div className="flex items-baseline justify-between mb-3">
              <div>
                <span className="font-mono text-3xl font-bold text-white tracking-tight">
                  {telemetry.mq135.ppm}
                </span>
                <span className="font-mono text-xs text-cyan-300 font-bold ml-1.5">PPM</span>
              </div>
              <div className="font-mono text-xs text-slate-300 font-semibold text-right">
                <span>VOLTAGE: {telemetry.mq135.rawVoltage}V</span>
              </div>
            </div>

            {/* Gauge bar */}
            <div className="w-full bg-[#18181a] h-2.5 border border-[#333338] overflow-hidden mb-3">
              <div
                className={`h-full transition-all duration-300 ${
                  isMqHazardous ? 'bg-red-500' : isMqPoor ? 'bg-yellow-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(100, (telemetry.mq135.ppm / 1200) * 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-xs bg-black p-2.5 border border-[#222226]">
              <div>
                <span className="text-slate-400 block">CO₂ EST:</span>
                <span className="text-white font-bold">{telemetry.mq135.co2EstimatedPpm} PPM</span>
              </div>
              <div>
                <span className="text-slate-400 block">SMOKE / FUMES:</span>
                <span className={`font-bold ${telemetry.mq135.smokeDetected ? 'text-red-400' : 'text-green-400'}`}>
                  {telemetry.mq135.smokeDetected ? 'DETECTED!' : 'CLEAR'}
                </span>
              </div>
            </div>
          </div>

          <div className="font-mono text-[10px] text-slate-400 pt-2 border-t border-[#222226] mt-3">
            HSN: 85389000 &bull; Calibrated for CO₂, Benzene, Smoke &amp; Ammonia
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COMPONENT 2: DHT22 - TEMPERATURE & HUMIDITY MODULE */}
        {/* ========================================================================= */}
        <div className="bg-[#0A0A0B] border border-[#26262a] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#26262a] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-orange-400" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  DHT22 TEMP &amp; HUMIDITY MODULE
                </span>
              </div>
              <span className="font-mono text-[10px] bg-black text-slate-300 px-2 py-0.5 border border-[#333338] font-bold">
                MICROCLIMATE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-black p-2.5 border border-[#222226]">
                <span className="font-mono text-xs text-slate-400 block font-bold">AMBIENT TEMP</span>
                <span className="font-mono text-2xl font-bold text-white block mt-0.5">
                  {telemetry.dht22.temperatureC.toFixed(1)}°C
                </span>
                <span className="font-mono text-[11px] text-orange-400 font-semibold mt-0.5 block">
                  Feels: {telemetry.dht22.heatIndexC}°C
                </span>
              </div>

              <div className="bg-black p-2.5 border border-[#222226]">
                <span className="font-mono text-xs text-slate-400 block font-bold">REL HUMIDITY</span>
                <span className="font-mono text-2xl font-bold text-cyan-300 block mt-0.5">
                  {telemetry.dht22.humidityPercent}%
                </span>
                <span className="font-mono text-[11px] text-blue-400 font-semibold mt-0.5 block">
                  Dew Pt: {telemetry.dht22.dewPointC}°C
                </span>
              </div>
            </div>

            {/* Dew Point / Moisture Warning */}
            <div className="p-2.5 bg-[#121215] border border-[#222226] font-mono text-xs flex items-center justify-between">
              <span className="text-slate-300">Ramp Moisture Risk:</span>
              <span className={`font-bold ${telemetry.dht22.humidityPercent > 85 ? 'text-red-300' : 'text-green-300'}`}>
                {telemetry.dht22.humidityPercent > 85 ? 'HIGH CONDENSATION' : 'DRY SURFACE'}
              </span>
            </div>
          </div>

          <div className="font-mono text-[10px] text-slate-400 pt-2 border-t border-[#222226] mt-3">
            HSN: 85389000 &bull; High Precision ±0.5°C &amp; ±2% RH Range
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COMPONENT 3: LIDAR SENSOR - 8M RANGE */}
        {/* ========================================================================= */}
        <div className="bg-[#0A0A0B] border border-[#26262a] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#26262a] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-yellow-400" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  LIDAR SENSOR (8M OPTICAL)
                </span>
              </div>
              <span
                className={`font-mono text-[10px] font-bold px-2 py-0.5 border ${
                  isLidarCritical
                    ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                    : isLidarWarning
                    ? 'bg-yellow-950 text-yellow-300 border-yellow-500'
                    : 'bg-green-950 text-green-300 border-green-500'
                }`}
              >
                {telemetry.lidar8m.obstacleAlert.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-baseline justify-between mb-2">
              <div>
                <span className={`font-mono text-3xl font-bold tracking-tight ${isLidarCritical ? 'text-red-400' : isLidarWarning ? 'text-yellow-300' : 'text-white'}`}>
                  {telemetry.lidar8m.distanceMeters.toFixed(2)}
                </span>
                <span className="font-mono text-xs text-slate-300 font-bold ml-1.5">METERS (OF 8.0M)</span>
              </div>
              <span className="font-mono text-xs text-slate-300 font-semibold">
                SIGNAL: {telemetry.lidar8m.signalStrength}%
              </span>
            </div>

            {/* Distance Bar */}
            <div className="w-full bg-[#18181a] h-3 border border-[#333338] overflow-hidden mb-3 relative">
              {/* Threshold lines */}
              <div className="absolute top-0 bottom-0 left-[25%] w-0.5 bg-red-500 z-10" title="Critical 2.0m" />
              <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-yellow-500 z-10" title="Warning 4.0m" />
              <div
                className={`h-full transition-all duration-200 ${
                  isLidarCritical ? 'bg-red-500' : isLidarWarning ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, (telemetry.lidar8m.distanceMeters / 8.0) * 100)}%` }}
              />
            </div>

            <div className="bg-black p-2.5 border border-[#222226] font-mono text-xs flex items-center justify-between">
              <span className="text-slate-400">HAPTIC INTERLOCK:</span>
              <span className={`font-bold ${isLidarCritical ? 'text-red-400 animate-pulse' : 'text-slate-300'}`}>
                {isLidarCritical ? 'VIBRATION MOTORS ENGAGED' : 'STANDBY (> 2.0M)'}
              </span>
            </div>
          </div>

          <div className="font-mono text-[10px] text-slate-400 pt-2 border-t border-[#222226] mt-3">
            HSN: 85389000 &bull; ToF Laser Distance Measurement (0.1m - 8.0m)
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COMPONENT 4: NEO 6M - GPS MODULE */}
        {/* ========================================================================= */}
        <div className="bg-[#0A0A0B] border border-[#26262a] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#26262a] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-400" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  NEO-6M GPS RECEIVER
                </span>
              </div>
              <span className="font-mono text-[10px] bg-blue-950 text-blue-300 px-2 py-0.5 border border-blue-500 font-bold">
                {telemetry.neo6mGps.fixQuality} ({telemetry.neo6mGps.satellites} SATS)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2 font-mono text-xs">
              <div className="bg-black p-2 border border-[#222226]">
                <span className="text-slate-400 block">LATITUDE</span>
                <span className="text-white font-bold text-sm block mt-0.5">
                  {telemetry.neo6mGps.latitude.toFixed(6)}°N
                </span>
              </div>
              <div className="bg-black p-2 border border-[#222226]">
                <span className="text-slate-400 block">LONGITUDE</span>
                <span className="text-white font-bold text-sm block mt-0.5">
                  {telemetry.neo6mGps.longitude.toFixed(6)}°E
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-black p-2 border border-[#222226] mb-2">
              <div>
                <span className="text-slate-400 block">SPEED</span>
                <span className="text-yellow-300 font-bold text-sm">{telemetry.neo6mGps.speedKmh.toFixed(1)} km/h</span>
              </div>
              <div>
                <span className="text-slate-400 block">ALTITUDE</span>
                <span className="text-white font-bold text-sm">RL {telemetry.neo6mGps.altitudeM}m</span>
              </div>
              <div>
                <span className="text-slate-400 block">HEADING</span>
                <span className="text-cyan-300 font-bold text-sm">{telemetry.neo6mGps.headingDeg}°</span>
              </div>
            </div>

            {/* NMEA Snippet */}
            <div className="p-1.5 bg-[#0e0e11] border border-[#222226] font-mono text-[10px] text-slate-400 truncate">
              {telemetry.neo6mGps.rawNmea || `$GPRMC,FIX,LAT=${telemetry.neo6mGps.latitude},LON=${telemetry.neo6mGps.longitude}`}
            </div>
          </div>

          <div className="font-mono text-[10px] text-slate-400 pt-2 border-t border-[#222226] mt-3">
            HSN: 85389000 &bull; High Sensitivity 50-Channel GPS Engine (NEO-6M)
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COMPONENT 5: MPU 6050 - ACCELEROMETER & GYROSCOPE */}
        {/* ========================================================================= */}
        <div className="bg-[#0A0A0B] border border-[#26262a] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#26262a] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  MPU-6050 ACCELEROMETER &amp; GYRO
                </span>
              </div>
              <span
                className={`font-mono text-[10px] font-bold px-2 py-0.5 border ${
                  telemetry.mpu6050.rolloverHazard
                    ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                    : 'bg-green-950 text-green-300 border-green-500'
                }`}
              >
                {telemetry.mpu6050.rolloverHazard ? 'ROLLOVER DANGER!' : 'STABILITY NORMAL'}
              </span>
            </div>

            {/* Pitch / Incline Grade */}
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <span className="font-mono text-3xl font-bold text-white tracking-tight">
                  {telemetry.mpu6050.inclineGradePercent.toFixed(1)}%
                </span>
                <span className="font-mono text-xs text-purple-300 font-bold ml-1.5">INCLINE GRADE</span>
              </div>
              <div className="font-mono text-xs text-slate-300 font-semibold text-right">
                <span>PITCH: {telemetry.mpu6050.pitchDeg.toFixed(1)}° &bull; ROLL: {telemetry.mpu6050.rollDeg.toFixed(1)}°</span>
              </div>
            </div>

            {/* 3-Axis Acceleration */}
            <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-black p-2.5 border border-[#222226] mb-2">
              <div>
                <span className="text-slate-400 block">ACCEL X</span>
                <span className="text-white font-bold">{telemetry.mpu6050.accelX_g.toFixed(2)}g</span>
              </div>
              <div>
                <span className="text-slate-400 block">ACCEL Y</span>
                <span className="text-white font-bold">{telemetry.mpu6050.accelY_g.toFixed(2)}g</span>
              </div>
              <div>
                <span className="text-slate-400 block">ACCEL Z</span>
                <span className="text-white font-bold">{telemetry.mpu6050.accelZ_g.toFixed(2)}g</span>
              </div>
            </div>

            <div className="flex justify-between items-center bg-[#121215] p-2 border border-[#222226] font-mono text-xs">
              <span className="text-slate-400">CHASSIS VIBRATION:</span>
              <span className="text-cyan-300 font-bold">{telemetry.mpu6050.vibrationG.toFixed(2)} G-RMS</span>
            </div>
          </div>

          <div className="font-mono text-[10px] text-slate-400 pt-2 border-t border-[#222226] mt-3">
            HSN: 85389000 &bull; 6-Axis MotionTracking (3-Axis Gyro + 3-Axis Accel)
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COMPONENT 6: MINI VIBRATION MOTORS (2 PCS) */}
        {/* ========================================================================= */}
        <div className="bg-[#0A0A0B] border border-[#26262a] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#26262a] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Vibrate className="w-4 h-4 text-red-400" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  MINI VIBRATION MOTORS (2x)
                </span>
              </div>
              <span
                className={`font-mono text-[10px] font-bold px-2 py-0.5 border ${
                  telemetry.vibrationMotors.motor1Active || telemetry.vibrationMotors.motor2Active
                    ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                    : 'bg-black text-slate-400 border-[#333338]'
                }`}
              >
                {telemetry.vibrationMotors.mode}
              </span>
            </div>

            {/* Motor 1 and Motor 2 visual status */}
            <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-xs">
              <div
                className={`p-3 border flex flex-col items-center gap-1 transition-all ${
                  telemetry.vibrationMotors.motor1Active
                    ? 'bg-red-950/60 border-red-500 text-red-200'
                    : 'bg-black border-[#222226] text-slate-400'
                }`}
              >
                <span className="font-bold">MOTOR 1 (PRIMARY)</span>
                <span className={`text-xs font-bold ${telemetry.vibrationMotors.motor1Active ? 'text-red-400 animate-ping' : 'text-slate-500'}`}>
                  {telemetry.vibrationMotors.motor1Active ? '● VIBRATING' : 'IDLE'}
                </span>
              </div>

              <div
                className={`p-3 border flex flex-col items-center gap-1 transition-all ${
                  telemetry.vibrationMotors.motor2Active
                    ? 'bg-red-950/60 border-red-500 text-red-200'
                    : 'bg-black border-[#222226] text-slate-400'
                }`}
              >
                <span className="font-bold">MOTOR 2 (CABIN)</span>
                <span className={`text-xs font-bold ${telemetry.vibrationMotors.motor2Active ? 'text-red-400 animate-ping' : 'text-slate-500'}`}>
                  {telemetry.vibrationMotors.motor2Active ? '● VIBRATING' : 'IDLE'}
                </span>
              </div>
            </div>

            <div className="bg-black p-2.5 border border-[#222226] font-mono text-xs mb-3">
              <span className="text-slate-400 block text-[11px]">ACTIVE TRIGGER REASON:</span>
              <span className="text-white font-bold text-xs mt-0.5 block truncate">
                {telemetry.vibrationMotors.triggerReason}
              </span>
            </div>

            {/* Manual Test Trigger Button */}
            <button
              type="button"
              disabled={!isDispatcher}
              onClick={handleTriggerVibration}
              className="w-full bg-red-950 hover:bg-red-900 border border-red-500 text-red-200 font-mono text-xs font-bold py-2 px-3 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md disabled:opacity-40"
            >
              <Zap className="w-4 h-4 text-red-400" />
              <span>TEST HAPTIC PULSE (1.5 SEC)</span>
            </button>
          </div>

          <div className="font-mono text-[10px] text-slate-400 pt-2 border-t border-[#222226] mt-3">
            HSN: 85011011 &bull; 3V Coreless Mini Vibration Actuators (Qty: 2)
          </div>
        </div>
      </div>
    </div>
  );
};
export default HardwareTelemetryScreen;
