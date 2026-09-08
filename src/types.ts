// Central Type Definitions for NMDC Bailadila Sector 14-A MTC Digital Twin

export type NavScreen =
  | 'traffic-radar'
  | 'daily-mine-plan'
  | 'haulage-production'
  | 'clearance-queue'
  | 'crusher-hoppers'
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
}

export interface RadioToast {
  id: string;
  message: string;
  channel: string;
}
