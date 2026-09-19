// Central Type Definitions for NMDC Bailadila Sector 14-A MTC Digital Twin

export type NavScreen =
  | 'traffic-radar'
  | 'hardware-telemetry'
  | 'trip-logs'
  | 'settings';


export interface HaulCheckpoint {
  id: string;
  code: string;
  name: string;
  shortName: string;
  progress: number; // 0 to 1 along track
  elevationRL: number;
  speedLimitKmh: number;
  description: string;
}

export type UserRole = 'dispatcher' | 'observer';

export type VehicleCycleState =
  | 'EMPTY'
  | 'LOADING_AT_SHOVEL'
  | 'LOADED'
  | 'INCLINE_HAUL'
  | 'QUEUING'
  | 'DISCHARGING_AT_CRUSHER'
  | 'HELD_BY_MTC';

export interface VehicleTwin {
  id: string;
  label: string;
  type: '100T' | '240T';
  state: VehicleCycleState;
  preEstopState?: VehicleCycleState;
  preEstopTimer?: number;
  previousStateBeforeHold?: VehicleCycleState;
  payloadTons: number;
  material: 'High-Grade Fe' | 'Medium-Grade Fe' | 'Waste Rock' | 'Empty';
  speedKmh: number;
  targetSpeedKmh: number;
  maxSpeedLimit: number;
  pathId: 'main-incline' | 'shovel-02-spur' | 'waste-spur';
  pathProgress: number; // Progress parameter t in [0, 1]
  direction: 1 | -1; // 1 = uphill / loaded to crusher, -1 = downhill / empty to pit floor
  x: number;
  y: number;
  headingDeg: number;
  timerSeconds: number;
  retarderStatus: 'Nominal' | 'Engaged' | 'Check Required';
  tireTempC: number;
  operator: string;
  operatorContact: string;
  uwbDistM: number;
  inPassingBay: boolean;
  hazardEnvelope: boolean;
  mustHoldByMTC: boolean;
  dStopMeters: number;
}

export interface ConflictIncident {
  id: string;
  vehicleAId: string;
  vehicleBId: string;
  closingDistanceM: number;
  combinedClosingSpeedKmh: number;
  locationName: string;
  recommendedAction: string;
  mustHoldId: string;
  active: boolean;
  timestamp?: string;
}

export interface WeatherForecastHour {
  time: string;
  tempC: number;
  rainMm: number;
  windKmh: number;
  popPercent: number;
}

export interface WeatherData {
  temperatureC: number;
  apparentTemperatureC: number;
  relativeHumidity: number;
  rainMmHr: number;
  visibilityMeters: number;
  windSpeedKmh: number;
  windGustsKmh: number;
  windDirectionDeg: number;
  windDirectionCompass: string;
  surfacePressureHpa: number;
  cloudCoverPercent: number;
  cloudCeilingMeters: number;
  weatherCode: number;
  conditionText: string;
  surfaceCondition?: 'Wet' | 'Dry';
  frictionCoefficient: number;
  shiftRainfallMm: number;
  pitSumpInflowM3Hr: number;
  lightningRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  dewPointC: number;
  dgmsAdvisory: string;
  forecastHours?: WeatherForecastHour[];
  lastUpdated: string;
  isFallback: boolean;
}

export interface TripLogEntry {
  id: string;
  dumperId: string;
  operator: string;
  payloadTons: number;
  material: string;
  fePercentage: number;
  sourceBench: string;
  destination: string;
  cycleTimeMins: number;
  timestamp: string;
}

export interface CrusherData {
  id: string;
  name: string;
  type: string;
  capacityPercent: number;
  currentTph: number;
  targetTph: number;
  queueCount: number;
  activeTippingTruck: string;
  waitingTrucks: string[];
  hopperLevelMeters: number;
  apronFeederSpeed: number; // m/s
  rockBreakerActive: boolean;
}

export interface ShovelData {
  id: string;
  name: string;
  bench: string;
  grade: string;
  feGrade: number;
  operatingStatus: 'Operating' | 'Standby' | 'Relocating';
  currentBucketTonnage: number;
  cyclesThisShift: number;
  tonnageLoaded: number;
  activeTruck: string;
}

export interface ChokePointQueue {
  id: string;
  name: string;
  status: 'WARNING' | 'NORMAL FLOW' | 'CAUTION';
  vehiclesInQueue: number;
  description: string;
  bench: string;
  avgWaitMins: number;
}

export interface Esp32WifiTelemetry {
  connected: boolean;
  ipAddress: string;
  mode: 'HTTP_POLL' | 'WEBSOCKET';
  pollIntervalMs: number;
  rssiDbm?: number;
  ssid?: string;
  lastPingMs?: number;
  packetsCount: number;
  lastSeen?: string;
  errorMessage?: string;
  // Core Requested Sensors:
  smoke: {
    adc: number;
    ppm: number;
    smokeDetected: boolean;
    status: 'Clean' | 'Moderate' | 'Poor' | 'Hazardous';
  };
  dht: {
    temperatureC: number;
    humidityPercent: number;
    heatIndexC: number;
    dewPointC: number;
  };
  distance: {
    distanceMeters: number;
    distanceCm: number;
    alert: 'CLEAR' | 'PROXIMITY_WARNING' | 'COLLISION_CRITICAL';
  };
  rawPayload?: string;
}

export interface HardwareTelemetry {
  // 1. MQ-135 - Air Quality Sensor Module
  mq135: {
    ppm: number;
    rawAdc?: number;
    airQualityStatus: 'Clean' | 'Moderate' | 'Poor' | 'Hazardous';
    smokeDetected: boolean;
    co2EstimatedPpm: number;
    rawVoltage: number;
  };
  // 2. DHT22 - Temperature & Humidity Sensor Module
  dht22: {
    temperatureC: number;
    humidityPercent: number;
    heatIndexC: number;
    dewPointC: number;
  };
  // 3. LIDAR Sensor - 8M Range
  lidar8m: {
    distanceMeters: number; // 0.00 to 8.00m
    signalStrength: number; // 0 to 100%
    obstacleAlert: 'CLEAR' | 'PROXIMITY_WARNING' | 'COLLISION_CRITICAL';
    warningThresholdM: number;
    criticalThresholdM: number;
  };
  // 4. NEO 6M - GPS Module
  neo6mGps: {
    latitude: number;
    longitude: number;
    altitudeM: number;
    speedKmh: number;
    headingDeg: number;
    satellites: number;
    hdop: number;
    fixQuality: 'No Fix' | '2D Fix' | '3D Fix' | 'DGPS Fix';
    lastFixTime: string;
    rawNmea?: string;
  };
  // 5. MPU 6050 - Accelerometer & Gyroscope
  mpu6050: {
    accelX_g: number;
    accelY_g: number;
    accelZ_g: number;
    gyroX_dps: number;
    gyroY_dps: number;
    gyroZ_dps: number;
    pitchDeg: number;
    rollDeg: number;
    inclineGradePercent: number; // tan(pitch)*100
    vibrationG: number;
    rolloverHazard: boolean;
  };
  // 6. Mini Vibration Motors (2 Pcs)
  vibrationMotors: {
    motor1Active: boolean;
    motor2Active: boolean;
    mode: 'OFF' | 'INTERMITTENT_ALERT' | 'CONTINUOUS_ALARM';
    triggerReason: string;
    lastTriggeredTime?: string;
  };
  // 7. Stationary Checkpoint IoT Node (ESP32 + NRF24L01)
  checkpointStation?: {
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
  };
  // 8. Dedicated ESP32 Wi-Fi Node (Smoke, DHT, Distance)
  esp32Wifi?: Esp32WifiTelemetry;
  rawSerialLogs?: string[];
  // Hardware Ingestion Metadata
  connectionSource: 'WEB_SERIAL_USB' | 'WEBSOCKET' | 'ESP32_WIFI' | 'SIMULATOR';
  connected: boolean;
  serialPortName?: string;
  baudRate: number;
  lastReceivedTime: string;
  packetsReceived: number;
}

export interface SystemSettings {
  wsUrl: string;
  wsEnabled: boolean;
  weatherAutoSync: boolean;
  weatherIntervalSec: number;
  speedClampLimitKmh: number;
  autoEstopOnHazard: boolean;
  isAudioMuted: boolean;
  role: UserRole;
  simSpeedMultiplier: number;
  // Google Maps Configuration
  googleMapsType: 'hybrid' | 'satellite' | 'terrain' | 'roadmap';
  googleMapsApiKey?: string;
  autoCenterGps: boolean;
  // Hardware Telemetry Configuration
  serialBaudRate: 9600 | 115200 | 57600;
  lidarWarningThresholdM: number;
  lidarCriticalThresholdM: number;
  rolloverThresholdDeg: number;
  mq135HazardThresholdPpm: number;
  // ESP32 Wi-Fi Telemetry Configuration
  esp32WifiIp: string;
  esp32WifiMode: 'HTTP_POLL' | 'WEBSOCKET';
  esp32WifiPollIntervalMs: number;
  esp32WifiAutoConnect: boolean;
}

export interface RadioToast {
  id: string;
  message: string;
  channel: string;
}
