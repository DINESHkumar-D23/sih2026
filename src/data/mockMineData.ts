import { SystemSettings } from '../types';

export const DEFAULT_SETTINGS: SystemSettings = {
  wsUrl: 'ws://localhost:8080',
  wsEnabled: false, // Default to false in production to prevent endless localhost retry loop!
  weatherAutoSync: true,
  weatherIntervalSec: 60,
  speedClampLimitKmh: 15,
  autoEstopOnHazard: false,
  isAudioMuted: false,
  role: 'dispatcher',
  simSpeedMultiplier: 1.0,
  googleMapsType: 'hybrid',
  autoCenterGps: true,
  serialBaudRate: 115200,
  lidarWarningThresholdM: 4.0,
  lidarCriticalThresholdM: 2.0,
  rolloverThresholdDeg: 15.0,
  mq135HazardThresholdPpm: 700,
};
