// NMDC Central - Hardware Telemetry Receiver
// Handles Real-Time Web Serial API (USB COM Port), WebSocket streaming,
// and hardware parsing for:
// 1. MQ 135 - Air Quality Sensor
// 2. DHT22 - Temperature & Humidity Sensor Module
// 3. LIDAR Sensor - 8M Range
// 4. NEO 6M - GPS Module
// 5. MPU 6050 - Accelerometer & Gyroscope
// 6. Mini Vibration Motors (2 Pcs)

import { HardwareTelemetry } from '../types';

export const INITIAL_HARDWARE_TELEMETRY: HardwareTelemetry = {
  mq135: {
    ppm: 395,
    airQualityStatus: 'Clean',
    smokeDetected: false,
    co2EstimatedPpm: 420,
    rawVoltage: 1.15,
  },
  dht22: {
    temperatureC: 24.2,
    humidityPercent: 78.5,
    heatIndexC: 25.1,
    dewPointC: 20.3,
  },
  lidar8m: {
    distanceMeters: 5.42,
    signalStrength: 92,
    obstacleAlert: 'CLEAR',
    warningThresholdM: 4.0,
    criticalThresholdM: 2.0,
  },
  neo6mGps: {
    latitude: 0,
    longitude: 0,
    altitudeM: 0,
    speedKmh: 0,
    headingDeg: 0,
    satellites: 0,
    hdop: 0,
    fixQuality: 'No Fix',
    lastFixTime: 'Awaiting Hardware',
  },
  mpu6050: {
    accelX_g: 0.04,
    accelY_g: 0.02,
    accelZ_g: 0.99,
    gyroX_dps: 0.3,
    gyroY_dps: -0.2,
    gyroZ_dps: 0.1,
    pitchDeg: 6.2,
    rollDeg: 1.4,
    inclineGradePercent: 10.9, // tan(6.2°)*100 ≈ 10.86%
    vibrationG: 0.08,
    rolloverHazard: false,
  },
  vibrationMotors: {
    motor1Active: false,
    motor2Active: false,
    mode: 'OFF',
    triggerReason: 'Nominal Operations',
  },
  connectionSource: 'WEB_SERIAL_USB',
  connected: false,
  baudRate: 115200,
  lastReceivedTime: new Date().toLocaleTimeString(),
  packetsReceived: 0,
};

// Web Serial Port instance reference
let activeSerialPort: any = null;
let serialReader: any = null;
let serialKeepReading = false;

// WebSocket instance reference
let activeWebSocket: WebSocket | null = null;

/**
 * Check if Web Serial API is supported in the current browser
 */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Connect to physical hardware via Browser Web Serial API (USB / COM Port)
 */
export async function connectWebSerial(
  baudRate: number = 115200,
  onData: (data: Partial<HardwareTelemetry>) => void,
  onError: (err: string) => void
): Promise<string | null> {
  if (!isWebSerialSupported()) {
    onError('Web Serial API not supported in this browser. Please use Google Chrome, Edge, or an updated Chromium browser.');
    return null;
  }

  try {
    // Request serial port from user
    const nav: any = navigator;
    activeSerialPort = await nav.serial.requestPort();
    await activeSerialPort.open({ baudRate });

    serialKeepReading = true;
    const textDecoder = new TextDecoderStream();
    activeSerialPort.readable.pipeTo(textDecoder.writable);
    serialReader = textDecoder.readable.getReader();

    let buffer = '';

    // Async reading loop
    (async () => {
      try {
        while (serialKeepReading && serialReader) {
          const { value, done } = await serialReader.read();
          if (done) break;
          if (value) {
            buffer += value;
            const lines = buffer.split('\n');
            // Keep the last partial line in buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed) {
                const parsed = parseHardwarePayload(trimmed);
                if (parsed) {
                  onData(parsed);
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (serialKeepReading) {
          onError(`Serial read error: ${err?.message || err}`);
        }
      }
    })();

    const portInfo = activeSerialPort.getInfo?.() || {};
    const infoStr = portInfo.usbVendorId ? `USB Device (VID: 0x${portInfo.usbVendorId.toString(16)})` : 'COM Port';
    return infoStr;
  } catch (err: any) {
    onError(`Could not open Serial Port: ${err?.message || err}`);
    return null;
  }
}

/**
 * Disconnect Web Serial Port
 */
export async function disconnectWebSerial(): Promise<void> {
  serialKeepReading = false;
  if (serialReader) {
    try {
      await serialReader.cancel();
      serialReader.releaseLock();
    } catch {
      // ignore
    }
    serialReader = null;
  }
  if (activeSerialPort) {
    try {
      await activeSerialPort.close();
    } catch {
      // ignore
    }
    activeSerialPort = null;
  }
}

/**
 * Send command back to Arduino/ESP32 over Web Serial
 */
export async function sendWebSerialCommand(cmd: string): Promise<boolean> {
  if (!activeSerialPort || !activeSerialPort.writable) return false;
  try {
    const encoder = new TextEncoder();
    const writer = activeSerialPort.writable.getWriter();
    await writer.write(encoder.encode(cmd + '\n'));
    writer.releaseLock();
    return true;
  } catch {
    return false;
  }
}

/**
 * Connect to Hardware WebSocket gateway (e.g. ws://localhost:8080 or ESP32 WiFi)
 */
export function connectHardwareWebSocket(
  url: string,
  onData: (data: Partial<HardwareTelemetry>) => void,
  onStatusChange: (status: 'CONNECTED' | 'DISCONNECTED') => void,
  onError: (err: string) => void
): () => void {
  try {
    const ws = new WebSocket(url);
    activeWebSocket = ws;

    ws.onopen = () => {
      onStatusChange('CONNECTED');
    };

    ws.onmessage = (event) => {
      try {
        const parsed = parseHardwarePayload(event.data);
        if (parsed) {
          onData(parsed);
        }
      } catch (err: any) {
        console.error('WS Parse Error:', err);
      }
    };

    ws.onerror = () => {
      onError('WebSocket connection error');
      onStatusChange('DISCONNECTED');
    };

    ws.onclose = () => {
      onStatusChange('DISCONNECTED');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      activeWebSocket = null;
    };
  } catch (err: any) {
    onError(`WebSocket init error: ${err?.message || err}`);
    onStatusChange('DISCONNECTED');
    return () => {};
  }
}

/**
 * Send command over WebSocket to hardware
 */
export function sendWebSocketCommand(cmd: object | string): boolean {
  if (!activeWebSocket || activeWebSocket.readyState !== WebSocket.OPEN) return false;
  try {
    const msg = typeof cmd === 'string' ? cmd : JSON.stringify(cmd);
    activeWebSocket.send(msg);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse raw serial/WebSocket payload from Arduino, ESP32, or Python gateway.
 * Supports:
 * 1. JSON payload:
 *    {"mq135": 412, "temp": 24.5, "hum": 78, "lidar": 3.42, "lat": 18.606, "lng": 81.226, "spd": 14.5, "pitch": 6.2, "roll": 1.4, "vib": 0}
 * 2. Comma / Key-Value format:
 *    MQ=412,TEMP=24.5,HUM=78.2,DIST=3.42,LAT=18.6063,LNG=81.2265,SPD=14.5,PITCH=6.2,ROLL=1.4,VIB=0
 */
export function parseHardwarePayload(rawText: string): Partial<HardwareTelemetry> | null {
  if (!rawText || typeof rawText !== 'string') return null;

  // Try JSON first
  if (rawText.startsWith('{') && rawText.endsWith('}')) {
    try {
      const obj = JSON.parse(rawText);
      return sanitizeHardwareObject(obj);
    } catch {
      // fall through to KV parsing
    }
  }

  // Key-Value parsing
  const pairs = rawText.split(/[,;\t]/);
  const kv: Record<string, number | string> = {};
  for (const pair of pairs) {
    const [k, v] = pair.split(/[=:]/);
    if (k && v !== undefined) {
      const key = k.trim().toUpperCase();
      const num = parseFloat(v.trim());
      kv[key] = isNaN(num) ? v.trim() : num;
    }
  }

  if (Object.keys(kv).length > 0) {
    return sanitizeKeyValueObject(kv);
  }

  return null;
}

function sanitizeHardwareObject(obj: any): Partial<HardwareTelemetry> {
  const result: Partial<HardwareTelemetry> = {};

  // 1. MQ-135
  const mqPpm = obj.mq135?.ppm ?? obj.ppm ?? obj.mq135;
  if (typeof mqPpm === 'number') {
    const status = mqPpm > 1000 ? 'Hazardous' : mqPpm > 700 ? 'Poor' : mqPpm > 450 ? 'Moderate' : 'Clean';
    result.mq135 = {
      ppm: Math.round(mqPpm),
      airQualityStatus: status,
      smokeDetected: mqPpm > 800,
      co2EstimatedPpm: Math.round(mqPpm * 1.06),
      rawVoltage: parseFloat(((mqPpm / 1000) * 3.3).toFixed(2)),
    };
  }

  // 2. DHT22
  const temp = obj.dht22?.temperatureC ?? obj.dht22?.temp ?? obj.temp ?? obj.temperature;
  const hum = obj.dht22?.humidityPercent ?? obj.dht22?.hum ?? obj.hum ?? obj.humidity;
  if (typeof temp === 'number' && typeof hum === 'number') {
    const heatIndex = Math.round((temp + (hum * 0.05) - 2) * 10) / 10;
    const dewPoint = Math.round((temp - ((100 - hum) / 5)) * 10) / 10;
    result.dht22 = {
      temperatureC: parseFloat(temp.toFixed(1)),
      humidityPercent: Math.round(hum),
      heatIndexC: heatIndex,
      dewPointC: dewPoint,
    };
  }

  // 3. LIDAR 8M
  const dist = obj.lidar8m?.distanceMeters ?? obj.lidar ?? obj.dist ?? obj.distance;
  if (typeof dist === 'number') {
    const d = Math.max(0, Math.min(8.0, dist));
    const alert = d <= 2.0 ? 'COLLISION_CRITICAL' : d <= 4.0 ? 'PROXIMITY_WARNING' : 'CLEAR';
    result.lidar8m = {
      distanceMeters: parseFloat(d.toFixed(2)),
      signalStrength: Math.round(Math.max(20, Math.min(100, 100 - (d / 8.0) * 40))),
      obstacleAlert: alert,
      warningThresholdM: 4.0,
      criticalThresholdM: 2.0,
    };
  }

  // 4. NEO-6M GPS
  const lat = obj.neo6mGps?.latitude ?? obj.lat;
  const lng = obj.neo6mGps?.longitude ?? obj.lng ?? obj.lon;
  if (typeof lat === 'number' && typeof lng === 'number') {
    const spd = obj.neo6mGps?.speedKmh ?? obj.spd ?? obj.speed ?? 0;
    const alt = obj.neo6mGps?.altitudeM ?? obj.alt ?? 1180;
    const heading = obj.neo6mGps?.headingDeg ?? obj.heading ?? 45;
    const sats = obj.neo6mGps?.satellites ?? obj.sats ?? 8;
    result.neo6mGps = {
      latitude: lat,
      longitude: lng,
      altitudeM: Math.round(alt),
      speedKmh: parseFloat(spd.toFixed(1)),
      headingDeg: Math.round(heading),
      satellites: Math.round(sats),
      hdop: 1.0,
      fixQuality: sats >= 4 ? '3D Fix' : sats >= 3 ? '2D Fix' : 'No Fix',
      lastFixTime: new Date().toLocaleTimeString(),
    };
  }

  // 5. MPU-6050
  const pitch = obj.mpu6050?.pitchDeg ?? obj.pitch;
  const roll = obj.mpu6050?.rollDeg ?? obj.roll;
  if (typeof pitch === 'number' || typeof roll === 'number') {
    const p = pitch ?? 0;
    const r = roll ?? 0;
    const gradePct = parseFloat((Math.tan((Math.abs(p) * Math.PI) / 180) * 100).toFixed(1));
    const isRollover = Math.abs(r) > 18 || Math.abs(p) > 22;
    result.mpu6050 = {
      accelX_g: obj.mpu6050?.accelX_g ?? obj.ax ?? 0.05,
      accelY_g: obj.mpu6050?.accelY_g ?? obj.ay ?? 0.02,
      accelZ_g: obj.mpu6050?.accelZ_g ?? obj.az ?? 0.98,
      gyroX_dps: obj.mpu6050?.gyroX_dps ?? 0,
      gyroY_dps: obj.mpu6050?.gyroY_dps ?? 0,
      gyroZ_dps: obj.mpu6050?.gyroZ_dps ?? 0,
      pitchDeg: parseFloat(p.toFixed(1)),
      rollDeg: parseFloat(r.toFixed(1)),
      inclineGradePercent: gradePct,
      vibrationG: parseFloat((obj.vibration ?? 0.08).toFixed(2)),
      rolloverHazard: isRollover,
    };
  }

  // 6. Vibration Motors
  const vib = obj.vibrationMotors?.motor1Active ?? obj.vib ?? obj.vibrate;
  if (vib !== undefined) {
    const isVib = Boolean(vib);
    result.vibrationMotors = {
      motor1Active: isVib,
      motor2Active: isVib,
      mode: isVib ? 'CONTINUOUS_ALARM' : 'OFF',
      triggerReason: isVib ? 'Proximity or Tilt Interlock' : 'Nominal Operations',
      lastTriggeredTime: isVib ? new Date().toLocaleTimeString() : undefined,
    };
  }

  return result;
}

function sanitizeKeyValueObject(kv: Record<string, any>): Partial<HardwareTelemetry> {
  const result: Partial<HardwareTelemetry> = {};

  // MQ135
  if (kv['MQ'] !== undefined || kv['MQ135'] !== undefined || kv['PPM'] !== undefined) {
    const ppm = Number(kv['MQ'] ?? kv['MQ135'] ?? kv['PPM']);
    const status = ppm > 1000 ? 'Hazardous' : ppm > 700 ? 'Poor' : ppm > 450 ? 'Moderate' : 'Clean';
    result.mq135 = {
      ppm: Math.round(ppm),
      airQualityStatus: status,
      smokeDetected: ppm > 800,
      co2EstimatedPpm: Math.round(ppm * 1.06),
      rawVoltage: parseFloat(((ppm / 1000) * 3.3).toFixed(2)),
    };
  }

  // DHT22
  if (kv['TEMP'] !== undefined || kv['HUM'] !== undefined) {
    const temp = Number(kv['TEMP'] ?? 24.0);
    const hum = Number(kv['HUM'] ?? 70.0);
    result.dht22 = {
      temperatureC: parseFloat(temp.toFixed(1)),
      humidityPercent: Math.round(hum),
      heatIndexC: Math.round((temp + (hum * 0.05) - 2) * 10) / 10,
      dewPointC: Math.round((temp - ((100 - hum) / 5)) * 10) / 10,
    };
  }

  // LIDAR 8M
  if (kv['DIST'] !== undefined || kv['LIDAR'] !== undefined) {
    const d = Math.max(0, Math.min(8.0, Number(kv['DIST'] ?? kv['LIDAR'])));
    result.lidar8m = {
      distanceMeters: parseFloat(d.toFixed(2)),
      signalStrength: Math.round(Math.max(20, Math.min(100, 100 - (d / 8.0) * 40))),
      obstacleAlert: d <= 2.0 ? 'COLLISION_CRITICAL' : d <= 4.0 ? 'PROXIMITY_WARNING' : 'CLEAR',
      warningThresholdM: 4.0,
      criticalThresholdM: 2.0,
    };
  }

  // GPS
  if (kv['LAT'] !== undefined && kv['LNG'] !== undefined) {
    const spd = Number(kv['SPD'] ?? 0);
    const alt = Number(kv['ALT'] ?? 1180);
    result.neo6mGps = {
      latitude: Number(kv['LAT']),
      longitude: Number(kv['LNG']),
      altitudeM: Math.round(alt),
      speedKmh: parseFloat(spd.toFixed(1)),
      headingDeg: Number(kv['HEAD'] ?? 45),
      satellites: Number(kv['SATS'] ?? 8),
      hdop: 1.0,
      fixQuality: '3D Fix',
      lastFixTime: new Date().toLocaleTimeString(),
    };
  }

  // MPU
  if (kv['PITCH'] !== undefined || kv['ROLL'] !== undefined) {
    const pitch = Number(kv['PITCH'] ?? 0);
    const roll = Number(kv['ROLL'] ?? 0);
    result.mpu6050 = {
      accelX_g: Number(kv['AX'] ?? 0.05),
      accelY_g: Number(kv['AY'] ?? 0.02),
      accelZ_g: Number(kv['AZ'] ?? 0.98),
      gyroX_dps: 0,
      gyroY_dps: 0,
      gyroZ_dps: 0,
      pitchDeg: parseFloat(pitch.toFixed(1)),
      rollDeg: parseFloat(roll.toFixed(1)),
      inclineGradePercent: parseFloat((Math.tan((Math.abs(pitch) * Math.PI) / 180) * 100).toFixed(1)),
      vibrationG: Number(kv['VIBG'] ?? 0.08),
      rolloverHazard: Math.abs(roll) > 18 || Math.abs(pitch) > 22,
    };
  }

  // Vibration
  if (kv['VIB'] !== undefined) {
    const isVib = Number(kv['VIB']) > 0;
    result.vibrationMotors = {
      motor1Active: isVib,
      motor2Active: isVib,
      mode: isVib ? 'CONTINUOUS_ALARM' : 'OFF',
      triggerReason: isVib ? 'Proximity or Tilt Alert' : 'Nominal Operations',
      lastTriggeredTime: isVib ? new Date().toLocaleTimeString() : undefined,
    };
  }

  return result;
}
