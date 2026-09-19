// NMDC Central - Hardware Telemetry Receiver
// Handles Real-Time Web Serial API (USB COM Port), WebSocket streaming,
// and hardware parsing for:
// 1. MQ 135 - Air Quality Sensor
// 2. DHT22 - Temperature & Humidity Sensor Module
// 3. LIDAR Sensor - 8M Range
// 4. NEO 6M - GPS Module
// 5. MPU 6050 - Accelerometer & Gyroscope
// 6. Mini Vibration Motors (2 Pcs)

import { HardwareTelemetry, Esp32WifiTelemetry } from '../types';

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
  checkpointStation: {
    checkpointId: 1,
    checkpointCode: 'CP-01',
    checkpointName: 'Pit Floor Sump Gate',
    temperatureC: 24.2,
    humidityPercent: 78.5,
    mq135Adc: 412,
    mq135Ppm: 395,
    airQualityStatus: 'Clean',
    nrfStatus: 'IDLE',
    nrfAddress: 'NODE1',
    lastReceived: 'Standby',
  },
  esp32Wifi: {
    connected: false,
    ipAddress: '192.168.4.1',
    mode: 'HTTP_POLL',
    pollIntervalMs: 1500,
    rssiDbm: -58,
    ssid: 'ESP32-WEATHER-STATION',
    lastPingMs: 22,
    packetsCount: 0,
    lastSeen: 'Standby (Wi-Fi Config Ready)',
    smoke: {
      adc: 412,
      ppm: 395,
      smokeDetected: false,
      status: 'Clean',
    },
    dht: {
      temperatureC: 24.2,
      humidityPercent: 78.5,
      heatIndexC: 25.1,
      dewPointC: 20.3,
    },
    distance: {
      distanceMeters: 5.42,
      distanceCm: 542,
      alert: 'CLEAR',
    },
  },
  rawSerialLogs: [
    '[OK] Stationary Checkpoint ESP32 receiver ready',
    '[OK] Listening on Web Serial (115200 baud) or NRF24 bridge',
    '[OK] Checkpoint 1 (Pit Floor Sump Gate) - NODE1',
  ],
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

  // Clean up any existing port before requesting a new one
  if (activeSerialPort) {
    try {
      await disconnectWebSerial();
    } catch {
      // ignore
    }
  }

  try {
    const nav: any = navigator;
    activeSerialPort = await nav.serial.requestPort();

    // Open port if not already open
    if (!activeSerialPort.readable) {
      try {
        await activeSerialPort.open({
          baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          flowControl: 'none',
          bufferSize: 4096,
        });
      } catch (openErr: any) {
        const msg = String(openErr?.message || openErr).toLowerCase();
        const name = String(openErr?.name || '');

        if (
          name === 'NetworkError' ||
          msg.includes('failed to open') ||
          msg.includes('failed to execute') ||
          msg.includes('access denied') ||
          msg.includes('busy')
        ) {
          throw new Error(
            "COM PORT IN USE: The port is currently open in another program (such as the Arduino IDE Serial Monitor, VSCode, or PuTTY). " +
            "Please CLOSE the Arduino IDE Serial Monitor and click 'CONNECT USB SERIAL' again! (Windows allows only one program to use a COM port at a time)."
          );
        } else if (name === 'InvalidStateError') {
          // Port was already open, proceed
          console.warn('Port was already open, continuing to read stream.');
        } else {
          throw openErr;
        }
      }
    }

    serialKeepReading = true;
    const decoder = new TextDecoder();
    serialReader = activeSerialPort.readable.getReader();
    let buffer = '';

    // Async reading loop using direct getReader (avoids pipeTo lock issues)
    (async () => {
      try {
        while (serialKeepReading && serialReader) {
          const { value, done } = await serialReader.read();
          if (done) break;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
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
      } finally {
        if (serialReader) {
          try {
            serialReader.releaseLock();
          } catch {
            // ignore
          }
        }
      }
    })();

    const portInfo = activeSerialPort.getInfo?.() || {};
    const infoStr = portInfo.usbVendorId
      ? `USB Device (VID: 0x${portInfo.usbVendorId.toString(16).padStart(4, '0')})`
      : 'ESP32 COM Port';
    return infoStr;
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      onError('Port selection was cancelled.');
    } else {
      onError(err?.message || `Could not open Serial Port: ${err}`);
    }
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
    } catch {
      // ignore
    }
    try {
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

// ============================================================================
// ESP32 WI-FI TELEMETRY INGESTION (SMOKE, DHT, DISTANCE)
// ============================================================================

let activeEsp32PollingTimer: ReturnType<typeof setInterval> | null = null;
let activeEsp32WebSocket: WebSocket | null = null;
let esp32PacketsCount = 0;

export function normalizeEsp32Url(ipOrUrl: string, defaultPath = '/data'): string {
  let cleaned = (ipOrUrl || '').trim();
  if (!cleaned) cleaned = '192.168.4.1';
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `http://${cleaned}`;
  }
  try {
    const urlObj = new URL(cleaned);
    if (!urlObj.pathname || urlObj.pathname === '/') {
      urlObj.pathname = defaultPath;
    }
    return urlObj.toString();
  } catch {
    return cleaned.endsWith('/') ? `${cleaned}data` : `${cleaned}/data`;
  }
}

export function normalizeEsp32WsUrl(ipOrUrl: string, defaultPort = 81): string {
  let cleaned = (ipOrUrl || '').trim();
  if (!cleaned) cleaned = '192.168.4.1';
  if (cleaned.startsWith('http://')) {
    cleaned = cleaned.replace('http://', 'ws://');
  } else if (cleaned.startsWith('https://')) {
    cleaned = cleaned.replace('https://', 'wss://');
  } else if (!cleaned.startsWith('ws://') && !cleaned.startsWith('wss://')) {
    cleaned = `ws://${cleaned}`;
  }
  try {
    const urlObj = new URL(cleaned);
    if (!urlObj.port) {
      urlObj.port = String(defaultPort);
    }
    if (!urlObj.pathname || urlObj.pathname === '/') {
      urlObj.pathname = '/ws';
    }
    return urlObj.toString();
  } catch {
    return `${cleaned}:${defaultPort}/ws`;
  }
}

/**
 * Ping ESP32 Wi-Fi station to check connectivity and round-trip latency
 */
export async function testEsp32WifiPing(ipOrUrl: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const targetUrl = normalizeEsp32Url(ipOrUrl);
  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(targetUrl, { signal: controller.signal, mode: 'cors' });
    clearTimeout(timeout);
    const latencyMs = Math.round(performance.now() - startTime);
    if (res.ok) {
      return { success: true, latencyMs };
    } else {
      return { success: false, latencyMs, error: `HTTP ${res.status}: ${res.statusText}` };
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    const msg = err.name === 'AbortError' ? 'Ping timed out (>2.5s)' : (err.message || 'Cannot reach ESP32 IP');
    return { success: false, latencyMs, error: msg };
  }
}

/**
 * Start periodic HTTP polling against ESP32 Wi-Fi WebServer
 */
export function startEsp32WifiPolling(
  config: { ipAddress: string; pollIntervalMs?: number },
  onData: (data: Partial<HardwareTelemetry>) => void,
  onStatus: (status: Partial<Esp32WifiTelemetry>) => void,
  onError: (err: string) => void
): () => void {
  stopEsp32WifiPolling();

  const url = normalizeEsp32Url(config.ipAddress);
  const interval = Math.max(500, config.pollIntervalMs || 1500);

  const poll = async () => {
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(interval - 50, 3000));
      const res = await fetch(url, { signal: controller.signal, mode: 'cors' });
      clearTimeout(timeout);

      const latencyMs = Math.round(performance.now() - startTime);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const rawText = await res.text();
      esp32PacketsCount++;

      let parsed: Partial<HardwareTelemetry> | null = null;
      try {
        const json = JSON.parse(rawText);
        parsed = sanitizeHardwareObject(json);
      } catch {
        parsed = parseHardwarePayload(rawText);
      }

      if (parsed) {
        const espBlock: Esp32WifiTelemetry = {
          connected: true,
          ipAddress: config.ipAddress,
          mode: 'HTTP_POLL',
          pollIntervalMs: interval,
          lastPingMs: latencyMs,
          packetsCount: esp32PacketsCount,
          lastSeen: new Date().toLocaleTimeString(),
          rawPayload: rawText.length > 200 ? rawText.slice(0, 200) + '...' : rawText,
          smoke: {
            adc: parsed.mq135?.rawAdc ?? parsed.checkpointStation?.mq135Adc ?? 412,
            ppm: parsed.mq135?.ppm ?? 395,
            smokeDetected: parsed.mq135?.smokeDetected ?? false,
            status: parsed.mq135?.airQualityStatus ?? 'Clean',
          },
          dht: {
            temperatureC: parsed.dht22?.temperatureC ?? 24.2,
            humidityPercent: parsed.dht22?.humidityPercent ?? 78,
            heatIndexC: parsed.dht22?.heatIndexC ?? 25.1,
            dewPointC: parsed.dht22?.dewPointC ?? 20.3,
          },
          distance: {
            distanceMeters: parsed.lidar8m?.distanceMeters ?? 5.4,
            distanceCm: Math.round((parsed.lidar8m?.distanceMeters ?? 5.4) * 100),
            alert: parsed.lidar8m?.obstacleAlert ?? 'CLEAR',
          },
        };

        onData({
          ...parsed,
          connected: true,
          connectionSource: 'ESP32_WIFI',
          esp32Wifi: espBlock,
          lastReceivedTime: new Date().toLocaleTimeString(),
        });

        onStatus(espBlock);
      }
    } catch (err: any) {
      const msg = err.name === 'AbortError' ? 'Connection timeout' : (err.message || 'ESP32 Wi-Fi fetch error');
      onError(msg);
      onStatus({
        connected: false,
        ipAddress: config.ipAddress,
        errorMessage: `${msg}. Check ESP32 Wi-Fi connection and CORS header (Access-Control-Allow-Origin: *).`,
      });
    }
  };

  poll();
  activeEsp32PollingTimer = setInterval(poll, interval);

  return () => {
    stopEsp32WifiPolling();
  };
}

/**
 * Stop ESP32 Wi-Fi polling
 */
export function stopEsp32WifiPolling(): void {
  if (activeEsp32PollingTimer) {
    clearInterval(activeEsp32PollingTimer);
    activeEsp32PollingTimer = null;
  }
}

/**
 * Connect to ESP32 WebSocket server directly over Wi-Fi
 */
export function connectEsp32WebSocket(
  ipOrUrl: string,
  onData: (data: Partial<HardwareTelemetry>) => void,
  onStatus: (status: Partial<Esp32WifiTelemetry>) => void,
  onError: (err: string) => void
): () => void {
  disconnectEsp32WebSocket();
  const wsUrl = normalizeEsp32WsUrl(ipOrUrl);

  try {
    const ws = new WebSocket(wsUrl);
    activeEsp32WebSocket = ws;

    ws.onopen = () => {
      onStatus({
        connected: true,
        ipAddress: ipOrUrl,
        mode: 'WEBSOCKET',
        lastSeen: new Date().toLocaleTimeString(),
      });
    };

    ws.onmessage = (event) => {
      try {
        esp32PacketsCount++;
        let parsed: Partial<HardwareTelemetry> | null = null;
        try {
          const json = JSON.parse(event.data);
          parsed = sanitizeHardwareObject(json);
        } catch {
          parsed = parseHardwarePayload(event.data);
        }

        if (parsed) {
          const espBlock: Esp32WifiTelemetry = {
            connected: true,
            ipAddress: ipOrUrl,
            mode: 'WEBSOCKET',
            pollIntervalMs: 0,
            lastPingMs: 12,
            packetsCount: esp32PacketsCount,
            lastSeen: new Date().toLocaleTimeString(),
            rawPayload: String(event.data).slice(0, 200),
            smoke: {
              adc: parsed.mq135?.rawAdc ?? parsed.checkpointStation?.mq135Adc ?? 412,
              ppm: parsed.mq135?.ppm ?? 395,
              smokeDetected: parsed.mq135?.smokeDetected ?? false,
              status: parsed.mq135?.airQualityStatus ?? 'Clean',
            },
            dht: {
              temperatureC: parsed.dht22?.temperatureC ?? 24.2,
              humidityPercent: parsed.dht22?.humidityPercent ?? 78,
              heatIndexC: parsed.dht22?.heatIndexC ?? 25.1,
              dewPointC: parsed.dht22?.dewPointC ?? 20.3,
            },
            distance: {
              distanceMeters: parsed.lidar8m?.distanceMeters ?? 5.4,
              distanceCm: Math.round((parsed.lidar8m?.distanceMeters ?? 5.4) * 100),
              alert: parsed.lidar8m?.obstacleAlert ?? 'CLEAR',
            },
          };

          onData({
            ...parsed,
            connected: true,
            connectionSource: 'ESP32_WIFI',
            esp32Wifi: espBlock,
            lastReceivedTime: new Date().toLocaleTimeString(),
          });

          onStatus(espBlock);
        }
      } catch (err: any) {
        console.error('ESP32 WS Parse Error:', err);
      }
    };

    ws.onerror = () => {
      onError('ESP32 WebSocket error');
      onStatus({ connected: false, errorMessage: 'ESP32 WebSocket connection error' });
    };

    ws.onclose = () => {
      onStatus({ connected: false });
    };

    return () => {
      disconnectEsp32WebSocket();
    };
  } catch (err: any) {
    onError(`ESP32 WS init error: ${err?.message || err}`);
    onStatus({ connected: false, errorMessage: String(err?.message || err) });
    return () => {};
  }
}

/**
 * Disconnect ESP32 WebSocket
 */
export function disconnectEsp32WebSocket(): void {
  if (activeEsp32WebSocket) {
    try {
      activeEsp32WebSocket.close();
    } catch {
      // ignore
    }
    activeEsp32WebSocket = null;
  }
}

/**
 * Simulate an incoming ESP32 Wi-Fi telemetry packet (Smoke, DHT, Distance)
 */
export function simulateEsp32WifiPacket(ipAddress = '192.168.4.1'): Partial<HardwareTelemetry> {
  const temp = parseFloat((24 + Math.random() * 5).toFixed(1));
  const hum = parseFloat((55 + Math.random() * 25).toFixed(1));
  const adc = Math.round(350 + Math.random() * 280);
  const ppm = Math.round(Math.max(300, Math.min(2000, (adc / 4095.0) * 1800 + 200)));
  const distM = parseFloat((0.8 + Math.random() * 5.2).toFixed(2));
  const distCm = Math.round(distM * 100);
  const smokeStatus: 'Clean' | 'Moderate' | 'Poor' | 'Hazardous' =
    adc > 1400 ? 'Hazardous' : adc > 850 ? 'Poor' : adc > 520 ? 'Moderate' : 'Clean';
  const distAlert: 'CLEAR' | 'PROXIMITY_WARNING' | 'COLLISION_CRITICAL' =
    distM <= 2.0 ? 'COLLISION_CRITICAL' : distM <= 4.0 ? 'PROXIMITY_WARNING' : 'CLEAR';

  esp32PacketsCount++;

  const espBlock: Esp32WifiTelemetry = {
    connected: true,
    ipAddress,
    mode: 'HTTP_POLL',
    pollIntervalMs: 1500,
    rssiDbm: -54 - Math.round(Math.random() * 10),
    ssid: 'ESP32-WEATHER-STATION',
    lastPingMs: 18 + Math.round(Math.random() * 14),
    packetsCount: esp32PacketsCount,
    lastSeen: new Date().toLocaleTimeString(),
    smoke: {
      adc,
      ppm,
      smokeDetected: adc > 1100,
      status: smokeStatus,
    },
    dht: {
      temperatureC: temp,
      humidityPercent: Math.round(hum),
      heatIndexC: Math.round((temp + (hum * 0.05) - 2) * 10) / 10,
      dewPointC: Math.round((temp - ((100 - hum) / 5)) * 10) / 10,
    },
    distance: {
      distanceMeters: distM,
      distanceCm: distCm,
      alert: distAlert,
    },
    rawPayload: JSON.stringify({
      smoke: adc,
      ppm,
      temp,
      hum: Math.round(hum),
      distance: distM,
      rssi: -58,
      status: 'OK',
    }),
  };

  recordSerialLog(`[ESP32-WIFI] Pkt #${esp32PacketsCount}: Temp=${temp}°C, Hum=${hum}%, SmokeADC=${adc}, Dist=${distM}m`);

  return {
    connected: true,
    connectionSource: 'ESP32_WIFI',
    esp32Wifi: espBlock,
    dht22: {
      temperatureC: temp,
      humidityPercent: Math.round(hum),
      heatIndexC: espBlock.dht.heatIndexC,
      dewPointC: espBlock.dht.dewPointC,
    },
    mq135: {
      ppm,
      rawAdc: adc,
      airQualityStatus: smokeStatus,
      smokeDetected: adc > 1100,
      co2EstimatedPpm: Math.round(ppm * 1.06),
      rawVoltage: parseFloat(((adc / 4095.0) * 3.3).toFixed(2)),
    },
    lidar8m: {
      distanceMeters: distM,
      signalStrength: 95,
      obstacleAlert: distAlert,
      warningThresholdM: 4.0,
      criticalThresholdM: 2.0,
    },
    rawSerialLogs: [...recentSerialLogs],
    lastReceivedTime: new Date().toLocaleTimeString(),
  };
}

// Lookup table for Haul Incline Checkpoints
export const CHECKPOINT_LOOKUP: Record<number, { code: string; name: string }> = {
  1: { code: 'CP-01', name: 'Pit Floor Sump Gate' },
  2: { code: 'CP-02', name: 'Bench 08 Ramp Exit' },
  3: { code: 'CP-03', name: 'Passing Bay Beta (04-A)' },
  4: { code: 'CP-04', name: 'Hairpin 3 Blind Apex' },
  5: { code: 'CP-05', name: 'Passing Bay Alpha (07-B)' },
  6: { code: 'CP-06', name: 'Crusher 1 Hopper Gate' },
};

// Internal active buffer for multi-line ESP32 prints
interface Esp32CheckpointState {
  checkpointId: number;
  checkpointCode: string;
  checkpointName: string;
  temperatureC: number;
  humidityPercent: number;
  mq135Adc: number;
  mq135Ppm: number;
  airQualityStatus: 'Clean' | 'Moderate' | 'Poor' | 'Hazardous';
  nrfStatus: 'DATA SENT' | 'SEND FAILED' | 'IDLE';
  nrfAddress: string;
  lastReceived: string;
}

let activeCheckpointState: Esp32CheckpointState = {
  checkpointId: 1,
  checkpointCode: 'CP-01',
  checkpointName: 'Pit Floor Sump Gate',
  temperatureC: 24.2,
  humidityPercent: 78.5,
  mq135Adc: 412,
  mq135Ppm: 395,
  airQualityStatus: 'Clean',
  nrfStatus: 'IDLE',
  nrfAddress: 'NODE1',
  lastReceived: 'Standby',
};

const recentSerialLogs: string[] = [];
function recordSerialLog(line: string) {
  if (!line || line.startsWith('---') || line.startsWith('===')) return;
  recentSerialLogs.push(line);
  if (recentSerialLogs.length > 50) recentSerialLogs.shift();
}

/**
 * Simulate an incoming ESP32 Checkpoint RF/Serial packet for browser demo/testing
 */
export function simulateEsp32CheckpointPacket(checkpointId = 1): Partial<HardwareTelemetry> {
  const info = CHECKPOINT_LOOKUP[checkpointId] || { code: `CP-0${checkpointId}`, name: `Checkpoint ${checkpointId}` };
  const temp = parseFloat((23 + Math.random() * 5).toFixed(1));
  const hum = parseFloat((60 + Math.random() * 20).toFixed(1));
  const adc = Math.round(380 + Math.random() * 250);
  const ppm = Math.round(Math.max(300, Math.min(2000, (adc / 4095.0) * 1800 + 200)));
  const status: 'Clean' | 'Moderate' | 'Poor' | 'Hazardous' =
    adc > 1500 ? 'Hazardous' : adc > 900 ? 'Poor' : adc > 550 ? 'Moderate' : 'Clean';

  activeCheckpointState = {
    checkpointId,
    checkpointCode: info.code,
    checkpointName: info.name,
    temperatureC: temp,
    humidityPercent: hum,
    mq135Adc: adc,
    mq135Ppm: ppm,
    airQualityStatus: status,
    nrfStatus: 'DATA SENT',
    nrfAddress: 'NODE1',
    lastReceived: new Date().toLocaleTimeString(),
  };

  recordSerialLog(`Checkpoint ID : ${checkpointId}`);
  recordSerialLog(`Temperature   : ${temp} °C`);
  recordSerialLog(`Humidity      : ${hum} %`);
  recordSerialLog(`MQ-135 ADC    : ${adc}`);
  recordSerialLog(`NRF24          : DATA SENT`);

  return {
    connected: true,
    connectionSource: 'SIMULATOR',
    checkpointStation: { ...activeCheckpointState },
    dht22: {
      temperatureC: temp,
      humidityPercent: Math.round(hum),
      heatIndexC: Math.round((temp + (hum * 0.05) - 2) * 10) / 10,
      dewPointC: Math.round((temp - ((100 - hum) / 5)) * 10) / 10,
    },
    mq135: {
      ppm,
      rawAdc: adc,
      airQualityStatus: status,
      smokeDetected: adc > 1200,
      co2EstimatedPpm: Math.round(ppm * 1.06),
      rawVoltage: parseFloat(((adc / 4095.0) * 3.3).toFixed(2)),
    },
    rawSerialLogs: [...recentSerialLogs],
    lastReceivedTime: new Date().toLocaleTimeString(),
  };
}

/**
 * Parse raw serial/WebSocket payload from Arduino, ESP32, or Python gateway.
 * Supports:
 * 1. ESP32 Stationary Checkpoint multiline format (exact output from user code):
 *    Checkpoint ID : 1
 *    Temperature   : 26.50 °C
 *    Humidity      : 65.20 %
 *    MQ-135 ADC    : 412
 *    NRF24          : DATA SENT
 * 2. JSON payload:
 *    {"checkpointID": 1, "temperature": 26.5, "humidity": 65.2, "mq135": 412}
 * 3. Comma / Key-Value format:
 *    CP=1,TEMP=26.5,HUM=65.2,MQ=412
 */
export function parseHardwarePayload(rawText: string): Partial<HardwareTelemetry> | null {
  if (!rawText || typeof rawText !== 'string') return null;

  const trimmed = rawText.trim();
  recordSerialLog(trimmed);

  // 1. Check for ESP32 Stationary Checkpoint multiline format
  const cpMatch = trimmed.match(/checkpoint\s*id\s*[:=]\s*(\d+)/i);
  const tempMatch = trimmed.match(/temperature\s*[:=]\s*([0-9.]+)/i);
  const humMatch = trimmed.match(/humidity\s*[:=]\s*([0-9.]+)/i);
  const mqMatch = trimmed.match(/mq-?135(?:\s*adc)?\s*[:=]\s*(\d+)/i);
  const nrfMatch = trimmed.match(/nrf24\s*[:=]\s*(DATA\s*SENT|SEND\s*FAILED)/i);

  if (cpMatch || tempMatch || humMatch || mqMatch || nrfMatch) {
    if (cpMatch) activeCheckpointState.checkpointId = parseInt(cpMatch[1], 10);
    if (tempMatch) activeCheckpointState.temperatureC = parseFloat(tempMatch[1]);
    if (humMatch) activeCheckpointState.humidityPercent = parseFloat(humMatch[1]);
    if (mqMatch) {
      const adc = parseInt(mqMatch[1], 10);
      activeCheckpointState.mq135Adc = adc;
      const ppm = Math.round(Math.max(300, Math.min(2000, (adc / 4095.0) * 1800 + 200)));
      activeCheckpointState.mq135Ppm = ppm;
      activeCheckpointState.airQualityStatus = adc > 1500 ? 'Hazardous' : adc > 900 ? 'Poor' : adc > 550 ? 'Moderate' : 'Clean';
    }
    if (nrfMatch) {
      activeCheckpointState.nrfStatus = nrfMatch[1].toUpperCase().includes('SENT') ? 'DATA SENT' : 'SEND FAILED';
    }

    const info = CHECKPOINT_LOOKUP[activeCheckpointState.checkpointId] || {
      code: `CP-0${activeCheckpointState.checkpointId}`,
      name: `Checkpoint ${activeCheckpointState.checkpointId}`,
    };
    activeCheckpointState.checkpointCode = info.code;
    activeCheckpointState.checkpointName = info.name;
    activeCheckpointState.lastReceived = new Date().toLocaleTimeString();

    return {
      checkpointStation: { ...activeCheckpointState },
      dht22: {
        temperatureC: activeCheckpointState.temperatureC,
        humidityPercent: Math.round(activeCheckpointState.humidityPercent),
        heatIndexC: Math.round((activeCheckpointState.temperatureC + (activeCheckpointState.humidityPercent * 0.05) - 2) * 10) / 10,
        dewPointC: Math.round((activeCheckpointState.temperatureC - ((100 - activeCheckpointState.humidityPercent) / 5)) * 10) / 10,
      },
      mq135: {
        ppm: activeCheckpointState.mq135Ppm,
        rawAdc: activeCheckpointState.mq135Adc,
        airQualityStatus: activeCheckpointState.airQualityStatus,
        smokeDetected: activeCheckpointState.mq135Adc > 1200,
        co2EstimatedPpm: Math.round(activeCheckpointState.mq135Ppm * 1.06),
        rawVoltage: parseFloat(((activeCheckpointState.mq135Adc / 4095.0) * 3.3).toFixed(2)),
      },
      rawSerialLogs: [...recentSerialLogs],
      lastReceivedTime: new Date().toLocaleTimeString(),
    };
  }

  // 2. Try JSON format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      return sanitizeHardwareObject(obj);
    } catch {
      // fall through to KV parsing
    }
  }

  // 3. Key-Value parsing
  const pairs = trimmed.split(/[,;\t]/);
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

  // 1. Smoke / Air Quality (MQ-2 / MQ-135 / Smoke ADC / PPM)
  const smokeVal = obj.smoke ?? obj.smokeAdc ?? obj.smokePpm ?? obj.mq135?.ppm ?? obj.ppm ?? obj.mq135;
  const smokeAdcVal = typeof obj.smokeAdc === 'number' ? obj.smokeAdc : (typeof smokeVal === 'number' && smokeVal > 200 && smokeVal <= 4095 ? smokeVal : 412);
  let computedPpm = typeof obj.smokePpm === 'number' ? obj.smokePpm : (typeof smokeVal === 'number' ? (smokeVal > 2000 ? Math.round((smokeVal / 4095) * 1800 + 200) : smokeVal) : 395);
  if (typeof smokeVal === 'number' || typeof obj.smoke === 'object') {
    const rawNum = typeof smokeVal === 'number' ? smokeVal : (obj.smoke?.ppm ?? obj.smoke?.adc ?? 400);
    const status: 'Clean' | 'Moderate' | 'Poor' | 'Hazardous' =
      computedPpm > 1000 || smokeAdcVal > 1400 ? 'Hazardous' : computedPpm > 700 || smokeAdcVal > 850 ? 'Poor' : computedPpm > 450 || smokeAdcVal > 520 ? 'Moderate' : 'Clean';
    result.mq135 = {
      ppm: Math.round(computedPpm),
      rawAdc: smokeAdcVal,
      airQualityStatus: status,
      smokeDetected: computedPpm > 800 || smokeAdcVal > 1100,
      co2EstimatedPpm: Math.round(computedPpm * 1.06),
      rawVoltage: parseFloat(((smokeAdcVal / 4095.0) * 3.3).toFixed(2)),
    };
  }

  // 2. DHT (Temperature & Humidity)
  const temp = obj.dht?.temperature ?? obj.dht?.temp ?? obj.dht22?.temperatureC ?? obj.temp ?? obj.temperature;
  const hum = obj.dht?.humidity ?? obj.dht?.hum ?? obj.dht22?.humidityPercent ?? obj.hum ?? obj.humidity;
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

  // 3. Distance (HC-SR04 Ultrasonic / LIDAR / ToF)
  let rawDist = obj.distance ?? obj.dist ?? obj.distanceCm ?? obj.distanceMeters ?? obj.lidar8m?.distanceMeters ?? obj.lidar;
  if (typeof rawDist === 'number') {
    // If greater than 15, assume it was reported in centimeters (e.g. 180cm -> 1.8m)
    const distM = rawDist > 15 ? rawDist / 100.0 : rawDist;
    const d = Math.max(0, Math.min(8.0, distM));
    const alert = d <= 2.0 ? 'COLLISION_CRITICAL' : d <= 4.0 ? 'PROXIMITY_WARNING' : 'CLEAR';
    result.lidar8m = {
      distanceMeters: parseFloat(d.toFixed(2)),
      signalStrength: Math.round(Math.max(20, Math.min(100, 100 - (d / 8.0) * 40))),
      obstacleAlert: alert,
      warningThresholdM: 4.0,
      criticalThresholdM: 2.0,
    };
  }

  // If smoke, dht or distance fields were received from an ESP32 Wi-Fi source:
  if (result.mq135 || result.dht22 || result.lidar8m) {
    const smokeObj = result.mq135 || {
      ppm: 395,
      rawAdc: 412,
      smokeDetected: false,
      airQualityStatus: 'Clean' as const,
    };
    const dhtObj = result.dht22 || {
      temperatureC: 24.2,
      humidityPercent: 78,
      heatIndexC: 25.1,
      dewPointC: 20.3,
    };
    const distObj = result.lidar8m || {
      distanceMeters: 5.4,
      obstacleAlert: 'CLEAR' as const,
    };

    result.esp32Wifi = {
      connected: true,
      ipAddress: obj.ip ?? obj.ipAddress ?? '192.168.4.1',
      mode: obj.mode === 'WEBSOCKET' ? 'WEBSOCKET' : 'HTTP_POLL',
      pollIntervalMs: obj.pollIntervalMs ?? 1500,
      rssiDbm: obj.rssi ?? -56,
      ssid: obj.ssid ?? 'ESP32-WEATHER-STATION',
      lastPingMs: obj.ping ?? 20,
      packetsCount: esp32PacketsCount,
      lastSeen: new Date().toLocaleTimeString(),
      rawPayload: JSON.stringify(obj).slice(0, 200),
      smoke: {
        adc: smokeObj.rawAdc ?? 412,
        ppm: smokeObj.ppm,
        smokeDetected: smokeObj.smokeDetected,
        status: smokeObj.airQualityStatus,
      },
      dht: {
        temperatureC: dhtObj.temperatureC,
        humidityPercent: dhtObj.humidityPercent,
        heatIndexC: dhtObj.heatIndexC,
        dewPointC: dhtObj.dewPointC,
      },
      distance: {
        distanceMeters: distObj.distanceMeters,
        distanceCm: Math.round(distObj.distanceMeters * 100),
        alert: distObj.obstacleAlert,
      },
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

  // 7. Checkpoint Station (ESP32 / NRF24)
  const cpId = obj.checkpointID ?? obj.checkpointId ?? obj.cp;
  if (cpId !== undefined) {
    const idNum = Number(cpId);
    const info = CHECKPOINT_LOOKUP[idNum] || { code: `CP-0${idNum}`, name: `Checkpoint ${idNum}` };
    const tempVal = obj.temperature ?? obj.temp ?? 24.2;
    const humVal = obj.humidity ?? obj.hum ?? 78.5;
    const mqVal = obj.mq135 ?? obj.mq ?? 412;
    const ppmVal = typeof mqVal === 'number' && mqVal > 100
      ? Math.round(Math.max(300, Math.min(2000, (mqVal / 4095.0) * 1800 + 200)))
      : (obj.ppm ?? 395);
    const statusVal: 'Clean' | 'Moderate' | 'Poor' | 'Hazardous' =
      mqVal > 1500 ? 'Hazardous' : mqVal > 900 ? 'Poor' : mqVal > 550 ? 'Moderate' : 'Clean';

    result.checkpointStation = {
      checkpointId: idNum,
      checkpointCode: info.code,
      checkpointName: info.name,
      temperatureC: Number(tempVal),
      humidityPercent: Number(humVal),
      mq135Adc: Number(mqVal),
      mq135Ppm: ppmVal,
      airQualityStatus: statusVal,
      nrfStatus: obj.nrfStatus ?? 'DATA SENT',
      nrfAddress: obj.nrfAddress ?? 'NODE1',
      lastReceived: new Date().toLocaleTimeString(),
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

  // Checkpoint Station (ESP32 / NRF24)
  if (kv['CHECKPOINT'] !== undefined || kv['CP'] !== undefined || kv['CHECKPOINT ID'] !== undefined) {
    const idNum = Number(kv['CHECKPOINT'] ?? kv['CP'] ?? kv['CHECKPOINT ID']);
    const info = CHECKPOINT_LOOKUP[idNum] || { code: `CP-0${idNum}`, name: `Checkpoint ${idNum}` };
    const tempVal = Number(kv['TEMP'] ?? kv['TEMPERATURE'] ?? activeCheckpointState.temperatureC);
    const humVal = Number(kv['HUM'] ?? kv['HUMIDITY'] ?? activeCheckpointState.humidityPercent);
    const mqVal = Number(kv['MQ'] ?? kv['MQ135'] ?? kv['MQ-135 ADC'] ?? activeCheckpointState.mq135Adc);
    const ppmVal = Math.round(Math.max(300, Math.min(2000, (mqVal / 4095.0) * 1800 + 200)));
    const statusVal: 'Clean' | 'Moderate' | 'Poor' | 'Hazardous' =
      mqVal > 1500 ? 'Hazardous' : mqVal > 900 ? 'Poor' : mqVal > 550 ? 'Moderate' : 'Clean';

    result.checkpointStation = {
      checkpointId: idNum,
      checkpointCode: info.code,
      checkpointName: info.name,
      temperatureC: tempVal,
      humidityPercent: humVal,
      mq135Adc: mqVal,
      mq135Ppm: ppmVal,
      airQualityStatus: statusVal,
      nrfStatus: 'DATA SENT',
      nrfAddress: 'NODE1',
      lastReceived: new Date().toLocaleTimeString(),
    };
  }

  return result;
}
