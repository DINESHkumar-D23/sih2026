import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  VehicleTwin,
  TripLogEntry,
  ConflictIncident,
  WeatherData,
  WeatherForecastHour,
  SystemSettings,
  RadioToast,
  NavScreen,
  UserRole,
  HardwareTelemetry,
} from './types';
import {
  DEFAULT_SETTINGS,
  INITIAL_VEHICLES,
  INITIAL_TRIP_LOGS,
} from './data/mockMineData';
import { INITIAL_HARDWARE_TELEMETRY } from './utils/hardwareReceiver';
import { audioSynth } from './utils/audio';
import {
  INCLINE_TRACK,
  samplePointAtDistance,
  calculateStoppingDistance,
  PASSING_BAY_ALPHA,
} from './utils/kinematics';
import {
  degToCompass,
  decodeWeatherCode,
  calculateFrictionCoeff,
  calculateSumpInflow,
  calculateLightningRisk,
  calculateDgmsAdvisory,
} from './utils/weatherUtils';

// Extracted Sub-Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { OperationalRibbon } from './components/OperationalRibbon';
import { RadarScreen } from './components/RadarScreen';
import { HardwareTelemetryScreen } from './components/HardwareTelemetryScreen';
import { TripLogsScreen } from './components/TripLogsScreen';
import { SettingsScreen } from './components/SettingsScreen';

// Modals
import { VehicleDetailModal } from './components/VehicleDetailModal';
import { EmergencyStopModal } from './components/EmergencyStopModal';
import { BroadcastModal } from './components/BroadcastModal';
import { WeatherModal } from './components/WeatherModal';
import { Esp32WifiModal } from './components/Esp32WifiModal';
import { simulateEsp32WifiPacket, startEsp32WifiPolling } from './utils/hardwareReceiver';

export function App() {
  // Navigation & UI State
  const [currentScreen, setCurrentScreen] = useState<NavScreen>('traffic-radar');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isEstopModalOpen, setIsEstopModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  const [isEsp32WifiModalOpen, setIsEsp32WifiModalOpen] = useState(false);
  const [radioNotice, setRadioNotice] = useState<RadioToast | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleTwin | null>(null);

  // Core MTC State
  const [vehicles, setVehicles] = useState<VehicleTwin[]>(INITIAL_VEHICLES);
  const [tripLogs, setTripLogs] = useState<TripLogEntry[]>(INITIAL_TRIP_LOGS);
  const [totalHauledTons, setTotalHauledTons] = useState<number>(31200);
  const [targetTons, setTargetTons] = useState<number>(40000);
  const [highGradeTons, setHighGradeTons] = useState<number>(18450);
  const [mediumGradeTons, setMediumGradeTons] = useState<number>(8250);
  const [wasteTons, setWasteTons] = useState<number>(4500);
  const [activeConflict, setActiveConflict] = useState<ConflictIncident | null>(null);
  const conflictChimePlayedRef = useRef(false);

  const [isEmergencyActive, setIsEmergencyActive] = useState<boolean>(false);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [wsStatus, setWsStatus] = useState<'CONNECTED' | 'FALLBACK_SIM'>('FALLBACK_SIM');

  // Real-Time Hardware Telemetry State (6 Sensors)
  const [hardwareTelemetry, setHardwareTelemetry] = useState<HardwareTelemetry>(INITIAL_HARDWARE_TELEMETRY);

  // Live Device GPS — used as the geo-anchor for weather fetches
  // Priority: NEO-6M USB sensor → Browser Geolocation API → hardcoded Bailadila fallback
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number; source: 'neo6m' | 'browser' | 'fallback' }>({
    lat: 18.67, lng: 81.25, source: 'fallback',
  });
  const deviceLocationRef = useRef({ lat: 18.67, lng: 81.25, source: 'fallback' as 'neo6m' | 'browser' | 'fallback' });

  const handleUpdateHardwareTelemetry = useCallback((data: Partial<HardwareTelemetry>) => {
    setHardwareTelemetry((prev) => {
      const next: HardwareTelemetry = {
        ...prev,
        ...data,
        mq135: data.mq135 ? { ...prev.mq135, ...data.mq135 } : prev.mq135,
        dht22: data.dht22 ? { ...prev.dht22, ...data.dht22 } : prev.dht22,
        lidar8m: data.lidar8m ? { ...prev.lidar8m, ...data.lidar8m } : prev.lidar8m,
        neo6mGps: data.neo6mGps ? { ...prev.neo6mGps, ...data.neo6mGps } : prev.neo6mGps,
        mpu6050: data.mpu6050 ? { ...prev.mpu6050, ...data.mpu6050 } : prev.mpu6050,
        vibrationMotors: data.vibrationMotors ? { ...prev.vibrationMotors, ...data.vibrationMotors } : prev.vibrationMotors,
        checkpointStation: data.checkpointStation ? { ...prev.checkpointStation, ...data.checkpointStation } : prev.checkpointStation,
        esp32Wifi: data.esp32Wifi ? { ...prev.esp32Wifi, ...data.esp32Wifi } : prev.esp32Wifi,
        rawSerialLogs: data.rawSerialLogs ? data.rawSerialLogs : prev.rawSerialLogs,
      };

      // Automated Hardware Interlocks:
      const isLidarHazard = next.lidar8m.distanceMeters <= (settings.lidarCriticalThresholdM || 2.0);
      const isMpuHazard = Math.abs(next.mpu6050.pitchDeg) > (settings.rolloverThresholdDeg || 15) || Math.abs(next.mpu6050.rollDeg) > (settings.rolloverThresholdDeg || 15);
      const isMqHazard = next.mq135.ppm > (settings.mq135HazardThresholdPpm || 700);

      if (isLidarHazard || isMpuHazard || isMqHazard) {
        next.vibrationMotors = {
          motor1Active: true,
          motor2Active: true,
          mode: isLidarHazard ? 'CONTINUOUS_ALARM' : 'INTERMITTENT_ALERT',
          triggerReason: isLidarHazard
            ? `LIDAR Obstacle Distance (${next.lidar8m.distanceMeters.toFixed(2)}m < 2.0m)`
            : isMpuHazard
            ? `Incline Tilt Warning (${next.mpu6050.pitchDeg.toFixed(1)}°)`
            : `MQ-135 Gas Hazard (${next.mq135.ppm} PPM)`,
          lastTriggeredTime: new Date().toLocaleTimeString(),
        };
      }

      return next;
    });
  }, [settings.lidarCriticalThresholdM, settings.rolloverThresholdDeg, settings.mq135HazardThresholdPpm]);

  // Weather State — initial sensible defaults replaced as soon as live API responds
  const [weather, setWeather] = useState<WeatherData>({
    temperatureC: 0,
    apparentTemperatureC: 0,
    relativeHumidity: 0,
    rainMmHr: 0,
    visibilityMeters: 100,
    windSpeedKmh: 0,
    windGustsKmh: 0,
    windDirectionDeg: 0,
    windDirectionCompass: '---',
    surfacePressureHpa: 0,
    cloudCoverPercent: 0,
    cloudCeilingMeters: 0,
    weatherCode: 0,
    conditionText: 'Fetching live data...',
    surfaceCondition: 'Dry',
    frictionCoefficient: 0.6,
    shiftRainfallMm: 0,
    pitSumpInflowM3Hr: 0,
    lightningRisk: 'LOW',
    dewPointC: 0,
    dgmsAdvisory: 'Awaiting live meteorological data from Open-Meteo API.',
    lastUpdated: '---',
    isFallback: true,
  });

  // ── LIVE DEVICE GPS FOR WEATHER ──────────────────────────────────────────
  // Keeps deviceLocationRef always current so fetchWeather (in useCallback)
  // reads the latest position without needing it in its dependency array.
  useEffect(() => {
    // If NEO-6M is plugged in and has a fix, prefer it over browser GPS
    if (
      hardwareTelemetry.connected &&
      hardwareTelemetry.neo6mGps?.latitude &&
      hardwareTelemetry.neo6mGps?.longitude &&
      hardwareTelemetry.neo6mGps?.fixQuality !== 'No Fix'
    ) {
      const loc = { lat: hardwareTelemetry.neo6mGps.latitude, lng: hardwareTelemetry.neo6mGps.longitude, source: 'neo6m' as const };
      deviceLocationRef.current = loc;
      setDeviceLocation(loc);
      return;
    }

    // Browser Geolocation API fallback
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'browser' as const };
        deviceLocationRef.current = loc;
        setDeviceLocation(loc);
      },
      () => { /* keep existing location on error */ },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [
    hardwareTelemetry.connected,
    hardwareTelemetry.neo6mGps?.latitude,
    hardwareTelemetry.neo6mGps?.longitude,
    hardwareTelemetry.neo6mGps?.fixQuality,
  ]);

  // Fetch Live Real Weather using the current device location
  const fetchWeather = useCallback(async () => {
    try {
      // Always read from the ref so we get the latest coords even in auto-sync intervals
      const gpsLat = deviceLocationRef.current.lat.toFixed(5);
      const gpsLng = deviceLocationRef.current.lng.toFixed(5);
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${gpsLat}&longitude=${gpsLng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility&hourly=temperature_2m,precipitation_probability,rain,wind_speed_10m&forecast_days=1&timezone=auto`
      );
      if (!res.ok) throw new Error('Weather fetch failed');
      const data = await res.json();
      const curr = data.current;
      const hourly = data.hourly;

      const rainVal = curr?.rain ?? curr?.precipitation ?? 0;
      const humidity = curr?.relative_humidity_2m ?? 0;
      const isWet = rainVal > 0.5 || humidity > 85;
      const code = curr?.weather_code ?? 0;
      const condition = decodeWeatherCode(code);
      const windSpeed = Math.round(curr?.wind_speed_10m ?? 0);
      const windGusts = Math.round(curr?.wind_gusts_10m ?? (windSpeed * 1.5));
      const windDeg = Math.round(curr?.wind_direction_10m ?? 0);
      const windCompass = degToCompass(windDeg);
      const visMeters = curr?.visibility ? Math.round(curr.visibility / 10) : 1000;
      const tempC = curr?.temperature_2m ?? 0;
      const apparentTempC = curr?.apparent_temperature ?? tempC;
      const dewPointC = Math.round((tempC - ((100 - humidity) / 5)) * 10) / 10;
      const pressureHpa = curr?.surface_pressure ?? 0;
      const cloudCover = curr?.cloud_cover ?? 0;
      const cloudCeiling = Math.max(60, Math.round(1000 - (cloudCover * 8)));
      const friction = calculateFrictionCoeff(isWet, rainVal);
      const sumpInflow = calculateSumpInflow(rainVal);
      const lightning = calculateLightningRisk(code, rainVal, cloudCover);
      const advisory = calculateDgmsAdvisory(isWet, visMeters, windGusts, lightning);

      // Hourly forecast slice
      let nextHours: WeatherForecastHour[] = [];
      if (hourly && Array.isArray(hourly.time)) {
        const nowIso = new Date().toISOString().slice(0, 13);
        const startIndex = hourly.time.findIndex((t: string) => t.startsWith(nowIso));
        const start = startIndex >= 0 ? startIndex : 0;
        nextHours = hourly.time.slice(start, start + 6).map((t: string, idx: number) => {
          const actualIndex = start + idx;
          const timeStr = t.split('T')[1] || t;
          return {
            time: timeStr.slice(0, 5),
            tempC: hourly.temperature_2m?.[actualIndex] ?? tempC,
            rainMm: hourly.rain?.[actualIndex] ?? 0,
            windKmh: hourly.wind_speed_10m?.[actualIndex] ?? windSpeed,
            popPercent: hourly.precipitation_probability?.[actualIndex] ?? 0,
          };
        });
      }

      setWeather({
        temperatureC: tempC,
        apparentTemperatureC: apparentTempC,
        relativeHumidity: humidity,
        rainMmHr: rainVal,
        visibilityMeters: visMeters,
        windSpeedKmh: windSpeed,
        windGustsKmh: windGusts,
        windDirectionDeg: windDeg,
        windDirectionCompass: windCompass,
        surfacePressureHpa: pressureHpa,
        cloudCoverPercent: cloudCover,
        cloudCeilingMeters: cloudCeiling,
        weatherCode: code,
        conditionText: condition.text,
        surfaceCondition: isWet ? 'Wet' : 'Dry',
        frictionCoefficient: friction,
        shiftRainfallMm: Math.round((rainVal * 2.5) * 10) / 10,
        pitSumpInflowM3Hr: sumpInflow,
        lightningRisk: lightning,
        dewPointC: dewPointC,
        dgmsAdvisory: advisory,
        forecastHours: nextHours.length > 0 ? nextHours : undefined,
        lastUpdated: new Date().toLocaleTimeString(),
        isFallback: false,
      });
    } catch {
      // Keep existing values on network failure
    }
  }, []);

  useEffect(() => {
    if (settings.weatherAutoSync) {
      fetchWeather();
      const timer = setInterval(fetchWeather, settings.weatherIntervalSec * 1000);
      return () => clearInterval(timer);
    }
  }, [settings.weatherAutoSync, settings.weatherIntervalSec, fetchWeather]);

  // ESP32 Wi-Fi Auto-Connect Polling Handler
  useEffect(() => {
    if (!settings.esp32WifiAutoConnect || !settings.esp32WifiIp) return;

    let isMounted = true;
    const cleanup = startEsp32WifiPolling(
      {
        ipAddress: settings.esp32WifiIp,
        pollIntervalMs: settings.esp32WifiPollIntervalMs || 1500,
      },
      (data: Partial<HardwareTelemetry>) => {
        if (isMounted) {
          handleUpdateHardwareTelemetry(data);
        }
      },
      () => {},
      (err: string) => {
        // Warning logged to debug console, silent in UI
        console.warn('ESP32 Wi-Fi Auto-connect poll warning:', err);
      }
    );

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [settings.esp32WifiAutoConnect, settings.esp32WifiIp, settings.esp32WifiPollIntervalMs, handleUpdateHardwareTelemetry]);

  // WebSocket Connection Handler — when connected, backend pushes real vehicle telemetry
  useEffect(() => {
    if (!settings.wsEnabled || !settings.wsUrl) {
      setWsStatus('FALLBACK_SIM');
      return;
    }

    let ws: WebSocket | null = null;
    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(settings.wsUrl);
        ws.onopen = () => {
          if (isMounted) setWsStatus('CONNECTED');
        };
        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.type === 'TELEMETRY' && Array.isArray(data.payload)) {
              setVehicles(data.payload);
            }
            if (data.type === 'TRIP_LOG' && data.payload) {
              setTripLogs((prev) => [data.payload, ...prev.slice(0, 49)]);
            }
          } catch {
            // ignore malformed payloads
          }
        };
        ws.onerror = () => {
          if (isMounted) setWsStatus('FALLBACK_SIM');
        };
        ws.onclose = () => {
          if (isMounted) {
            setWsStatus('FALLBACK_SIM');
            setVehicles(INITIAL_VEHICLES);
            retryTimer = setTimeout(connect, 10000);
          }
        };
      } catch {
        if (isMounted) setWsStatus('FALLBACK_SIM');
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) ws.close();
    };
  }, [settings.wsEnabled, settings.wsUrl]);

  // Kinematics & Collision Simulation Loop
  useEffect(() => {
    if (wsStatus === 'CONNECTED') return; // If hardware WS is providing telemetry, skip internal physics engine

    const intervalMs = 100; // 10 ticks per second
    const simInterval = setInterval(() => {
      setVehicles((prevVehicles) => {
        if (isEmergencyActive) {
          // When E-Stop is active, freeze all velocities to 0 with engaged retarders
          return prevVehicles.map((v) => ({
            ...v,
            speedKmh: 0,
            retarderStatus: 'Engaged',
          }));
        }

        const isWet = weather.surfaceCondition === 'Wet';
        const friction = isWet ? 0.35 : 0.6;
        const totalTrackLengthM = INCLINE_TRACK.totalLength; // 1420 meters

        // 1. Advance position along spline
        const updated = prevVehicles.map((v) => {
          const vehicle = { ...v };

          // Handle special loading/discharging states
          if (vehicle.state === 'LOADING_AT_SHOVEL') {
            vehicle.timerSeconds = (vehicle.timerSeconds || 0) + (intervalMs / 1000) * settings.simSpeedMultiplier;
            vehicle.speedKmh = 0;
            if (vehicle.timerSeconds > 10) {
              vehicle.state = 'INCLINE_HAUL';
              vehicle.payloadTons = vehicle.type === '240T' ? 210 : 85;
              vehicle.material = 'High-Grade Fe';
              vehicle.direction = 1; // Uphill towards crusher
              vehicle.targetSpeedKmh = 14;
              vehicle.timerSeconds = 0;
            }
            return vehicle;
          }

          if (vehicle.state === 'DISCHARGING_AT_CRUSHER') {
            vehicle.timerSeconds = (vehicle.timerSeconds || 0) + (intervalMs / 1000) * settings.simSpeedMultiplier;
            vehicle.speedKmh = 0;
            if (vehicle.timerSeconds > 8) {
              // Record completion in haul accounting
              const haulPayload = vehicle.payloadTons;
              setTotalHauledTons((prev) => prev + haulPayload);
              if (vehicle.material.includes('High')) {
                setHighGradeTons((prev) => prev + haulPayload);
              } else if (vehicle.material.includes('Medium')) {
                setMediumGradeTons((prev) => prev + haulPayload);
              } else {
                setWasteTons((prev) => prev + haulPayload);
              }

              // Add to trip logs
              const newLogEntry: TripLogEntry = {
                id: `LOG-${Math.floor(8820 + Math.random() * 900)}`,
                dumperId: vehicle.id,
                operator: vehicle.operator,
                payloadTons: haulPayload,
                material: vehicle.material,
                fePercentage: vehicle.material.includes('High') ? 66.4 : 62.0,
                sourceBench: 'Bench 07',
                destination: 'Primary Crusher 1',
                cycleTimeMins: parseFloat((20 + Math.random() * 4).toFixed(1)),
                timestamp: new Date().toLocaleTimeString('en-GB', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                }) + ' IST',
              };
              setTripLogs((prev) => [newLogEntry, ...prev.slice(0, 49)]);

              vehicle.state = 'EMPTY';
              vehicle.payloadTons = 0;
              vehicle.material = 'Empty';
              vehicle.direction = -1; // Downhill back to pit floor
              vehicle.targetSpeedKmh = 22;
              vehicle.timerSeconds = 0;
            }
            return vehicle;
          }

          if (vehicle.state === 'HELD_BY_MTC') {
            // Held by dispatcher inside Passing Bay Alpha
            vehicle.speedKmh = 0;
            vehicle.x = PASSING_BAY_ALPHA.x;
            vehicle.y = PASSING_BAY_ALPHA.y;
            return vehicle;
          }

          // Normal Incline Haul / Descent Motion
          const speedClamp = Math.min(vehicle.targetSpeedKmh, settings.speedClampLimitKmh);
          vehicle.speedKmh = speedClamp;
          const deltaDistanceM = (vehicle.speedKmh / 3.6) * (intervalMs / 1000) * settings.simSpeedMultiplier;
          const deltaProgress = (deltaDistanceM / totalTrackLengthM) * vehicle.direction;
          const newProgress = vehicle.pathProgress + deltaProgress;

          // Check End-of-Run Transitions:
          // Reached Primary Crusher (progress >= 0.97)
          if (vehicle.direction === 1 && newProgress >= 0.97) {
            vehicle.pathProgress = 0.98;
            vehicle.state = 'DISCHARGING_AT_CRUSHER';
            vehicle.speedKmh = 0;
            vehicle.timerSeconds = 0;
            return vehicle;
          }

          // Reached Pit Floor Shovel (progress <= 0.03)
          if (vehicle.direction === -1 && newProgress <= 0.03) {
            vehicle.pathProgress = 0.02;
            vehicle.state = 'LOADING_AT_SHOVEL';
            vehicle.speedKmh = 0;
            vehicle.timerSeconds = 0;
            return vehicle;
          }

          vehicle.pathProgress = Math.max(0.01, Math.min(0.99, newProgress));

          // Project coordinates along spline
          const sample = samplePointAtDistance(vehicle.pathProgress * totalTrackLengthM);
          vehicle.x = sample.x;
          vehicle.y = sample.y;
          vehicle.headingDeg = vehicle.direction === 1 ? sample.headingDeg : (sample.headingDeg + 180) % 360;

          // Dynamic Stopping Distance Calculation
          vehicle.dStopMeters = calculateStoppingDistance(
            vehicle.speedKmh,
            vehicle.direction,
            friction
          );

          // Retarder status: engaged on downhill runs
          vehicle.retarderStatus = vehicle.direction === -1 ? 'Engaged' : 'Nominal';

          return vehicle;
        });

        // 2. Collision Detection & Hazard Envelope Interlock
        let detectedConflict: ConflictIncident | null = null;
        let conflictPair: [string, string] | null = null;

        for (let i = 0; i < updated.length; i++) {
          for (let j = i + 1; j < updated.length; j++) {
            const vA = updated[i];
            const vB = updated[j];

            // Only check moving vehicles on the main haul ramp in opposing directions
            const bothMoving =
              (vA.state === 'INCLINE_HAUL' || vA.state === 'EMPTY') &&
              (vB.state === 'INCLINE_HAUL' || vB.state === 'EMPTY');
            const opposing = vA.direction !== vB.direction;

            if (bothMoving && opposing && !vA.inPassingBay && !vB.inPassingBay) {
              const distanceM = Math.abs(vA.pathProgress - vB.pathProgress) * totalTrackLengthM;
              const combinedStopM = vA.dStopMeters + vB.dStopMeters;

              // Collision proximity threshold: stopping distance buffer + 30m safety margin
              if (distanceM <= combinedStopM + 30) {
                conflictPair = [vA.id, vB.id];
                const downhillUnit = vA.direction === -1 ? vA : vB;
                const uphillUnit = vA.direction === 1 ? vA : vB;

                detectedConflict = {
                  id: `CONF-${Date.now()}`,
                  vehicleAId: uphillUnit.id,
                  vehicleBId: downhillUnit.id,
                  closingDistanceM: Math.round(distanceM),
                  combinedClosingSpeedKmh: uphillUnit.speedKmh + downhillUnit.speedKmh,
                  locationName: 'Hairpin 3 Switchback (RL 1,180m)',
                  mustHoldId: downhillUnit.id,
                  active: true,
                  recommendedAction: `Direct ${downhillUnit.id} to hold in Passing Bay Alpha. Uphill loaded ${uphillUnit.id} holds right-of-way.`,
                };
              }
            }
          }
        }

        // 3. Update Conflict & Hazard Flags
        setActiveConflict(detectedConflict);

        if (detectedConflict && !conflictChimePlayedRef.current) {
          audioSynth.playCollisionWarning(settings.isAudioMuted);
          conflictChimePlayedRef.current = true;

          // Auto-E-Stop if enabled in settings
          if (settings.autoEstopOnHazard) {
            setIsEmergencyActive(true);
            audioSynth.playEmergencyKlaxon(settings.isAudioMuted);
          }
        } else if (!detectedConflict) {
          conflictChimePlayedRef.current = false;
        }

        // Apply hazard flags to each vehicle
        return updated.map((v) => {
          if (conflictPair && (v.id === conflictPair[0] || v.id === conflictPair[1])) {
            return {
              ...v,
              hazardEnvelope: true,
              mustHoldByMTC: v.id === detectedConflict?.mustHoldId,
            };
          } else {
            return {
              ...v,
              hazardEnvelope: false,
              mustHoldByMTC: false,
            };
          }
        });
      });
    }, intervalMs);

    return () => clearInterval(simInterval);
  }, [
    wsStatus,
    isEmergencyActive,
    weather.surfaceCondition,
    settings.simSpeedMultiplier,
    settings.speedClampLimitKmh,
    settings.autoEstopOnHazard,
    settings.isAudioMuted,
  ]);

  // MTC Command: Hold Vehicle in Passing Bay Alpha
  const handleHoldVehicle = (vehicleId: string) => {
    audioSynth.playRadioClick(settings.isAudioMuted);
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id === vehicleId) {
          return {
            ...v,
            state: 'HELD_BY_MTC',
            inPassingBay: true,
            hazardEnvelope: false,
            mustHoldByMTC: false,
            speedKmh: 0,
            x: PASSING_BAY_ALPHA.x,
            y: PASSING_BAY_ALPHA.y,
          };
        }
        return {
          ...v,
          hazardEnvelope: false,
          mustHoldByMTC: false,
        };
      })
    );
    setActiveConflict(null);
    setRadioNotice({
      id: `TOAST-${Date.now()}-1`,
      channel: 'VHF CH 04',
      message: `MTC ORDER: UNIT ${vehicleId} DOCKED IN PASSING BAY 07-B. MAIN INCLINE CLEAR.`,
    });
  };

  // MTC Command: Clear Vehicle to Proceed
  const handleClearVehicle = (vehicleId: string) => {
    audioSynth.playRadioClick(settings.isAudioMuted);
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id === vehicleId) {
          const sample = samplePointAtDistance(v.pathProgress * INCLINE_TRACK.totalLength);
          return {
            ...v,
            state: v.payloadTons > 0 ? 'INCLINE_HAUL' : 'EMPTY',
            inPassingBay: false,
            speedKmh: v.targetSpeedKmh,
            x: sample.x,
            y: sample.y,
          };
        }
        return v;
      })
    );
    setRadioNotice({
      id: `TOAST-${Date.now()}-2`,
      channel: 'VHF CH 04',
      message: `MTC CLEARANCE: UNIT ${vehicleId} AUTHORIZED FOR MAIN INCLINE TRANSIT.`,
    });
  };

  // Radio Toast Timeout
  useEffect(() => {
    if (radioNotice) {
      const timer = setTimeout(() => {
        setRadioNotice(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [radioNotice]);

  // VHF Broadcast Transmission
  const handleSendBroadcast = (message: string) => {
    audioSynth.playRadioClick(settings.isAudioMuted);
    setRadioNotice({
      id: `TOAST-${Date.now()}-3`,
      channel: 'ALL-PIT DISPATCH (VHF CH 04)',
      message: message,
    });
  };

  // All-Pit Emergency Stop Confirmation
  const handleExecuteEstop = () => {
    setIsEmergencyActive(true);
    audioSynth.playEmergencyKlaxon(settings.isAudioMuted);
    setRadioNotice({
      id: `TOAST-${Date.now()}-4`,
      channel: 'SAFETY INTERLOCK',
      message: 'ALL-PIT EMERGENCY STOP ACTIVE. HYDRAULIC RETARDERS ENGAGED.',
    });
  };

  // Reset Emergency Stop
  const handleResetEstop = () => {
    setIsEmergencyActive(false);
    audioSynth.playRadioClick(settings.isAudioMuted);
    setRadioNotice({
      id: `TOAST-${Date.now()}-5`,
      channel: 'SAFETY INTERLOCK',
      message: 'EMERGENCY INTERLOCK CLEARED. NORMAL DISPATCH RESUMED.',
    });
  };

  // Role toggle
  const handleToggleRole = () => {
    setSettings((prev) => ({
      ...prev,
      role: prev.role === 'dispatcher' ? 'observer' : 'dispatcher',
    }));
  };

  // Mute toggle
  const handleToggleMute = () => {
    setSettings((prev) => ({
      ...prev,
      isAudioMuted: !prev.isAudioMuted,
    }));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0A0B] text-[#E0E0E0] font-sans antialiased">
      {/* 1. Primary Left Sidebar Navigation */}
      <Sidebar
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        onOpenEmergencyStop={() => setIsEstopModalOpen(true)}
        onOpenBroadcast={() => setIsBroadcastModalOpen(true)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isDesktopCollapsed={isDesktopSidebarCollapsed}
        onToggleDesktopCollapse={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
        hazardCount={activeConflict?.active ? 1 : 0}
        userRole={settings.role}
        isEmergencyActive={isEmergencyActive}
        weather={weather}
        onOpenWeatherModal={() => setIsWeatherModalOpen(true)}
        telemetry={hardwareTelemetry}
      />

      {/* 2. Main Viewport Canvas */}
      <div className={`flex-1 flex flex-col min-w-0 ${isDesktopSidebarCollapsed ? 'lg:pl-0' : 'lg:pl-64'} overflow-y-auto transition-all duration-200`}>
        {/* Top Header Bar */}
        <Header
          onToggleSidebar={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setIsMobileSidebarOpen((prev) => !prev);
            } else {
              setIsDesktopSidebarCollapsed((prev) => !prev);
            }
          }}
          isDesktopSidebarCollapsed={isDesktopSidebarCollapsed}
          wsStatus={wsStatus}
          fogVisibilityMeters={weather.visibilityMeters}
          isAudioMuted={settings.isAudioMuted}
          onToggleMute={handleToggleMute}
          userRole={settings.role}
          onToggleRole={handleToggleRole}
          onOpenEmergencyModal={() => setIsEstopModalOpen(true)}
          isEmergencyActive={isEmergencyActive}
          onOpenEsp32WifiModal={() => setIsEsp32WifiModalOpen(true)}
          esp32WifiConnected={Boolean(hardwareTelemetry.esp32Wifi?.connected)}
        />

        {/* Content Body Container */}
        <main
          role="main"
          className="flex-1 px-3 md:px-4 pt-16 pb-4 flex flex-col min-h-0"
        >
          {/* Operational Environmental & Safety Ribbon */}
          <OperationalRibbon
            weather={weather}
            speedLimitKmh={settings.speedClampLimitKmh}
            onOpenBroadcast={() => setIsBroadcastModalOpen(true)}
            onOpenWeatherModal={() => setIsWeatherModalOpen(true)}
            onOpenEsp32WifiModal={() => setIsEsp32WifiModalOpen(true)}
            telemetry={hardwareTelemetry}
          />

          {/* Active Screen Selection */}
          <div className="flex-1">
            {currentScreen === 'traffic-radar' && (
              <RadarScreen
                vehicles={vehicles}
                activeConflict={activeConflict}
                onSelectVehicle={(v) => setSelectedVehicle(v)}
                onHoldVehicle={handleHoldVehicle}
                onClearVehicle={handleClearVehicle}
                onOpenBroadcast={() => setIsBroadcastModalOpen(true)}
                totalHauledTons={totalHauledTons}
                targetTons={targetTons}
                radioNotice={radioNotice}
                userRole={settings.role}
                weather={weather}
                telemetry={hardwareTelemetry}
                onOpenEsp32WifiModal={() => setIsEsp32WifiModalOpen(true)}
                onSimulateEsp32WifiPacket={() => handleUpdateHardwareTelemetry(simulateEsp32WifiPacket(settings.esp32WifiIp))}
              />
            )}

            {currentScreen === 'hardware-telemetry' && (
              <HardwareTelemetryScreen
                telemetry={hardwareTelemetry}
                onUpdateTelemetry={handleUpdateHardwareTelemetry}
                userRole={settings.role}
                onOpenEsp32WifiModal={() => setIsEsp32WifiModalOpen(true)}
              />
            )}

            {currentScreen === 'trip-logs' && <TripLogsScreen tripLogs={tripLogs} />}

            {currentScreen === 'settings' && (
              <SettingsScreen
                settings={settings}
                onUpdateSettings={(newVals) => setSettings((prev) => ({ ...prev, ...newVals }))}
                wsStatus={wsStatus}
                onManualWeatherRefresh={fetchWeather}
                weather={weather}
                onOpenWeatherModal={() => setIsWeatherModalOpen(true)}
                onOpenEsp32WifiModal={() => setIsEsp32WifiModalOpen(true)}
              />
            )}
          </div>
        </main>
      </div>

      {/* 3. System Modals */}
      {/* Vehicle Telemetry & Dispatch Control Modal */}
      <VehicleDetailModal
        vehicle={selectedVehicle}
        onClose={() => setSelectedVehicle(null)}
        onHold={handleHoldVehicle}
        onClear={handleClearVehicle}
        userRole={settings.role}
      />

      {/* Pit Meteorology & Hydrology Telemetry Modal */}
      <WeatherModal
        isOpen={isWeatherModalOpen}
        onClose={() => setIsWeatherModalOpen(false)}
        weather={weather}
        onRefreshWeather={fetchWeather}
        telemetry={hardwareTelemetry}
        deviceLocation={deviceLocation}
        onOpenEsp32WifiModal={() => {
          setIsWeatherModalOpen(false);
          setIsEsp32WifiModalOpen(true);
        }}
      />

      {/* ESP32 Wi-Fi Telemetry & Sensor Hub Modal */}
      <Esp32WifiModal
        isOpen={isEsp32WifiModalOpen}
        onClose={() => setIsEsp32WifiModalOpen(false)}
        telemetry={hardwareTelemetry}
        onUpdateTelemetry={handleUpdateHardwareTelemetry}
        weather={weather}
      />

      {/* Emergency Stop Protocol Confirmation Modal */}
      <EmergencyStopModal
        isOpen={isEstopModalOpen}
        onClose={() => setIsEstopModalOpen(false)}
        onConfirmStop={handleExecuteEstop}
        isEmergencyActive={isEmergencyActive}
        onResetEmergency={handleResetEstop}
      />

      {/* VHF Priority Broadcast Modal */}
      <BroadcastModal
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
        onSendBroadcast={handleSendBroadcast}
      />
    </div>
  );
}
export default App;
