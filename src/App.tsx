import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  VehicleTwin,
  TripLogEntry,
  WeatherData,
  WeatherForecastHour,
  SystemSettings,
  ConflictIncident,
  RadioToast,
  NavScreen,
  UserRole,
} from './types';
import {
  DEFAULT_SETTINGS,
  INITIAL_VEHICLES,
  INITIAL_TRIP_LOGS,
} from './data/mockMineData';
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
import { ClearanceQueueScreen } from './components/ClearanceQueueScreen';
import { HaulageProductionScreen } from './components/HaulageProductionScreen';
import { CrusherHoppersScreen } from './components/CrusherHoppersScreen';
import { TripLogsScreen } from './components/TripLogsScreen';
import { SettingsScreen } from './components/SettingsScreen';

// Modals
import { VehicleDetailModal } from './components/VehicleDetailModal';
import { EmergencyStopModal } from './components/EmergencyStopModal';
import { BroadcastModal } from './components/BroadcastModal';
import { WeatherModal } from './components/WeatherModal';

export function App() {
  // Navigation & UI State
  const [currentScreen, setCurrentScreen] = useState<NavScreen>('traffic-radar');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isEstopModalOpen, setIsEstopModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleTwin | null>(null);
  const [radioNotice, setRadioNotice] = useState<RadioToast | null>(null);

  // Core MTC State
  const [vehicles, setVehicles] = useState<VehicleTwin[]>(INITIAL_VEHICLES);
  const [tripLogs, setTripLogs] = useState<TripLogEntry[]>(INITIAL_TRIP_LOGS);
  const [totalHauledTons, setTotalHauledTons] = useState<number>(31200);
  const [highGradeTons, setHighGradeTons] = useState<number>(18450);
  const [mediumGradeTons, setMediumGradeTons] = useState<number>(8250);
  const [wasteTons, setWasteTons] = useState<number>(4500);

  const [activeConflict, setActiveConflict] = useState<ConflictIncident | null>(null);
  const [isEmergencyActive, setIsEmergencyActive] = useState<boolean>(false);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [wsStatus, setWsStatus] = useState<'CONNECTED' | 'FALLBACK_SIM'>('FALLBACK_SIM');

  // Weather State
  const [weather, setWeather] = useState<WeatherData>({
    temperatureC: 22.4,
    apparentTemperatureC: 25.1,
    relativeHumidity: 94,
    rainMmHr: 4.8,
    visibilityMeters: 40, // Monsoon dense fog advisory
    windSpeedKmh: 14,
    windGustsKmh: 27,
    windDirectionDeg: 240,
    windDirectionCompass: 'WSW',
    surfacePressureHpa: 938.2,
    cloudCoverPercent: 92,
    cloudCeilingMeters: 140,
    weatherCode: 63,
    conditionText: 'Moderate Monsoon Downpour',
    surfaceCondition: 'Wet',
    frictionCoefficient: 0.22,
    shiftRainfallMm: 28.4,
    pitSumpInflowM3Hr: 408,
    lightningRisk: 'MODERATE',
    dewPointC: 21.3,
    dgmsAdvisory: 'DGMS CIRCULAR 04: MANDATORY HYDRAULIC RETARDER ACTIVE. MINIMUM 50M FOLLOWING DISTANCE ON 11% GRADE.',
    forecastHours: [
      { time: '16:00', tempC: 23.1, popPercent: 88, rainMm: 3.2, windKmh: 14 },
      { time: '17:00', tempC: 22.8, popPercent: 85, rainMm: 2.6, windKmh: 12 },
      { time: '18:00', tempC: 22.2, popPercent: 70, rainMm: 1.4, windKmh: 10 },
      { time: '19:00', tempC: 21.9, popPercent: 55, rainMm: 0.8, windKmh: 9 },
      { time: '20:00', tempC: 21.6, popPercent: 40, rainMm: 0.2, windKmh: 7 },
      { time: '21:00', tempC: 21.4, popPercent: 25, rainMm: 0.0, windKmh: 6 },
    ],
    lastUpdated: new Date().toLocaleTimeString(),
    isFallback: false,
  });

  const conflictChimePlayedRef = useRef(false);

  // Fetch Open-Meteo Weather for Bailadila Sector 14-A (Kirandul: 18.67, 81.25)
  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=18.67&longitude=81.25&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility&hourly=temperature_2m,precipitation_probability,rain,wind_speed_10m&forecast_days=1&timezone=Asia%2FKolkata'
      );
      if (!res.ok) throw new Error('Weather fetch failed');
      const data = await res.json();
      const curr = data.current;
      const hourly = data.hourly;

      const rainVal = curr?.rain ?? curr?.precipitation ?? 0;
      const humidity = curr?.relative_humidity_2m ?? 92;
      const isWet = rainVal > 0.5 || humidity > 85;
      const code = curr?.weather_code ?? 63;
      const condition = decodeWeatherCode(code);
      const windSpeed = Math.round(curr?.wind_speed_10m ?? 12);
      const windGusts = Math.round(curr?.wind_gusts_10m ?? (windSpeed * 1.5));
      const windDeg = Math.round(curr?.wind_direction_10m ?? 240);
      const windCompass = degToCompass(windDeg);
      const visMeters = curr?.visibility ? Math.round(curr.visibility / 10) : 50;
      const tempC = curr?.temperature_2m ?? 23;
      const apparentTempC = curr?.apparent_temperature ?? (tempC + 2);
      const dewPointC = Math.round((tempC - ((100 - humidity) / 5)) * 10) / 10;
      const pressureHpa = curr?.surface_pressure ?? 938.1;
      const cloudCover = curr?.cloud_cover ?? 85;
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
        shiftRainfallMm: Math.round((24.0 + rainVal * 2.5) * 10) / 10,
        pitSumpInflowM3Hr: sumpInflow,
        lightningRisk: lightning,
        dewPointC: dewPointC,
        dgmsAdvisory: advisory,
        forecastHours: nextHours.length > 0 ? nextHours : undefined,
        lastUpdated: new Date().toLocaleTimeString(),
        isFallback: false,
      });
    } catch {
      // Keep sensible defaults on network restriction
    }
  }, []);

  useEffect(() => {
    if (settings.weatherAutoSync) {
      fetchWeather();
      const timer = setInterval(fetchWeather, settings.weatherIntervalSec * 1000);
      return () => clearInterval(timer);
    }
  }, [settings.weatherAutoSync, settings.weatherIntervalSec, fetchWeather]);

  // WebSocket Connection Handler
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

  // Radio Toast Timeout
  useEffect(() => {
    if (radioNotice) {
      const timer = setTimeout(() => {
        setRadioNotice(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [radioNotice]);

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

              // Transition to empty descent
              vehicle.state = 'EMPTY';
              vehicle.payloadTons = 0;
              vehicle.material = 'Empty';
              vehicle.direction = -1; // Downhill towards pit floor
              vehicle.targetSpeedKmh = 20;
              vehicle.timerSeconds = 0;
            }
            return vehicle;
          }

          // If held by MTC, dock in passing bay and freeze
          if (vehicle.state === 'HELD_BY_MTC') {
            vehicle.speedKmh = 0;
            vehicle.inPassingBay = true;
            vehicle.x = PASSING_BAY_ALPHA.x;
            vehicle.y = PASSING_BAY_ALPHA.y;
            vehicle.retarderStatus = 'Engaged';
            return vehicle;
          }

          // Normal travel
          const clampedSpeed = Math.min(vehicle.targetSpeedKmh, settings.speedClampLimitKmh);
          vehicle.speedKmh = clampedSpeed;

          // Compute step distance in meters: (speed km/h / 3.6) * dt_seconds * multiplier
          const dtSec = (intervalMs / 1000) * settings.simSpeedMultiplier;
          const distStepM = (vehicle.speedKmh / 3.6) * dtSec;
          const progressDelta = distStepM / totalTrackLengthM;

          let newProgress = vehicle.pathProgress + progressDelta * vehicle.direction;

          // Check track boundaries
          if (newProgress >= 0.98 && vehicle.direction === 1) {
            newProgress = 0.98;
            vehicle.state = 'DISCHARGING_AT_CRUSHER';
          } else if (newProgress <= 0.02 && vehicle.direction === -1) {
            newProgress = 0.02;
            vehicle.state = 'LOADING_AT_SHOVEL';
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

            // Only check vehicles with opposing travel directions that are not safely docked in bays
            if (vA.direction !== vB.direction && !vA.inPassingBay && !vB.inPassingBay) {
              const dx = (vA.x - vB.x) * 1.2;
              const dy = (vA.y - vB.y) * 1.2;
              const distanceM = Math.round(Math.hypot(dx, dy));

              vA.uwbDistM = distanceM;
              vB.uwbDistM = distanceM;

              // Collision threshold based on closing stopping distances
              const closingThreshold = Math.max(45, (vA.dStopMeters + vB.dStopMeters) * 0.7);

              if (distanceM < closingThreshold) {
                conflictPair = [vA.id, vB.id];
                const downhillUnit = vA.direction === -1 ? vA : vB;
                const uphillUnit = vA.direction === 1 ? vA : vB;

                detectedConflict = {
                  id: `CONF-${Date.now()}`,
                  vehicleAId: uphillUnit.id,
                  vehicleBId: downhillUnit.id,
                  closingDistanceM: distanceM,
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

        // 3. Update Conflict & Hazard Flags (with Clean Reset!)
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

        // Apply hazard flags to each vehicle (or cleanly reset if cleared)
        return updated.map((v) => {
          if (conflictPair && (v.id === conflictPair[0] || v.id === conflictPair[1])) {
            return {
              ...v,
              hazardEnvelope: true,
              mustHoldByMTC: v.id === detectedConflict?.mustHoldId,
            };
          } else {
            // HAZARD RESET: ensure hazard flag is cleared!
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
    isEmergencyActive,
    settings.simSpeedMultiplier,
    settings.speedClampLimitKmh,
    settings.autoEstopOnHazard,
    settings.isAudioMuted,
    weather.surfaceCondition,
    wsStatus,
  ]);

  // MTC Command: Hold Vehicle in Passing Bay
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
        // If opposing vehicle had a hazard envelope, clear it as well
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

  const hazardCount = vehicles.filter((v) => v.hazardEnvelope).length;

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
        hazardCount={hazardCount}
        userRole={settings.role}
        isEmergencyActive={isEmergencyActive}
        weather={weather}
        onOpenWeatherModal={() => setIsWeatherModalOpen(true)}
      />

      {/* 2. Main Viewport Canvas */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 overflow-y-auto">
        {/* Top Header Bar */}
        <Header
          onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          wsStatus={wsStatus}
          fogVisibilityMeters={weather.visibilityMeters}
          isAudioMuted={settings.isAudioMuted}
          onToggleMute={handleToggleMute}
          userRole={settings.role}
          onToggleRole={handleToggleRole}
          onOpenEmergencyModal={() => setIsEstopModalOpen(true)}
          isEmergencyActive={isEmergencyActive}
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
          />

          {/* Active Screen Selection */}
          <div className="flex-1">
            {currentScreen === 'traffic-radar' && (
              <RadarScreen
                vehicles={vehicles}
                activeConflict={activeConflict}
                onSelectVehicle={setSelectedVehicle}
                onHoldVehicle={handleHoldVehicle}
                onClearVehicle={handleClearVehicle}
                onOpenBroadcast={() => setIsBroadcastModalOpen(true)}
                totalHauledTons={totalHauledTons}
                targetTons={40000}
                radioNotice={radioNotice}
                userRole={settings.role}
                weather={weather}
              />
            )}

            {currentScreen === 'clearance-queue' && (
              <ClearanceQueueScreen
                vehicles={vehicles}
                activeConflict={activeConflict}
                onHoldVehicle={handleHoldVehicle}
                onClearVehicle={handleClearVehicle}
                userRole={settings.role}
              />
            )}

            {currentScreen === 'haulage-production' && (
              <HaulageProductionScreen
                totalHauledTons={totalHauledTons}
                highGradeTons={highGradeTons}
                mediumGradeTons={mediumGradeTons}
                wasteTons={wasteTons}
                targetTons={40000}
                tripLogs={tripLogs}
              />
            )}

            {currentScreen === 'crusher-hoppers' && <CrusherHoppersScreen />}

            {currentScreen === 'trip-logs' && <TripLogsScreen tripLogs={tripLogs} />}

            {currentScreen === 'settings' && (
              <SettingsScreen
                settings={settings}
                onUpdateSettings={(newVals) => setSettings((prev) => ({ ...prev, ...newVals }))}
                wsStatus={wsStatus}
                onManualWeatherRefresh={fetchWeather}
                weather={weather}
                onOpenWeatherModal={() => setIsWeatherModalOpen(true)}
              />
            )}
          </div>
        </main>
      </div>

      {/* 3. System Modals */}
      {/* Pit Meteorology & Hydrology Telemetry Modal */}
      <WeatherModal
        isOpen={isWeatherModalOpen}
        onClose={() => setIsWeatherModalOpen(false)}
        weather={weather}
        onRefreshWeather={fetchWeather}
      />

      {/* Vehicle Telemetry Detail Modal */}
      <VehicleDetailModal
        vehicle={selectedVehicle}
        onClose={() => setSelectedVehicle(null)}
        onHold={handleHoldVehicle}
        onClear={handleClearVehicle}
        userRole={settings.role}
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
