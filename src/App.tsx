import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  VehicleTwin,
  TripLogEntry,
  WeatherData,
  WeatherForecastHour,
  SystemSettings,
  RadioToast,
  NavScreen,
  UserRole,
  HardwareTelemetry,
} from './types';
import { DEFAULT_SETTINGS } from './data/mockMineData';
import { INITIAL_HARDWARE_TELEMETRY } from './utils/hardwareReceiver';
import { audioSynth } from './utils/audio';
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
  const [radioNotice, setRadioNotice] = useState<RadioToast | null>(null);

  // Core MTC State — vehicles and trip logs are empty until a real WebSocket backend connects
  const [vehicles, setVehicles] = useState<VehicleTwin[]>([]);
  const [tripLogs, setTripLogs] = useState<TripLogEntry[]>([]);

  const [isEmergencyActive, setIsEmergencyActive] = useState<boolean>(false);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [wsStatus, setWsStatus] = useState<'CONNECTED' | 'FALLBACK_SIM'>('FALLBACK_SIM');

  // Real-Time Hardware Telemetry State (6 Sensors)
  const [hardwareTelemetry, setHardwareTelemetry] = useState<HardwareTelemetry>(INITIAL_HARDWARE_TELEMETRY);

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

  // Fetch Live Real Weather using GPS Coordinates (Bailadila: 18.67, 81.25 or NEO-6M live fix)
  const fetchWeather = useCallback(async () => {
    try {
      const gpsLat = hardwareTelemetry.neo6mGps?.latitude ? hardwareTelemetry.neo6mGps.latitude.toFixed(4) : '18.67';
      const gpsLng = hardwareTelemetry.neo6mGps?.longitude ? hardwareTelemetry.neo6mGps.longitude.toFixed(4) : '81.25';
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${gpsLat}&longitude=${gpsLng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility&hourly=temperature_2m,precipitation_probability,rain,wind_speed_10m&forecast_days=1&timezone=Asia%2FKolkata`
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
            setVehicles([]);
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
        hazardCount={0}
        userRole={settings.role}
        isEmergencyActive={isEmergencyActive}
        weather={weather}
        onOpenWeatherModal={() => setIsWeatherModalOpen(true)}
        telemetry={hardwareTelemetry}
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
            telemetry={hardwareTelemetry}
          />

          {/* Active Screen Selection */}
          <div className="flex-1">
            {currentScreen === 'traffic-radar' && (
              <RadarScreen
                vehicles={vehicles}
                activeConflict={null}
                onSelectVehicle={() => {}}
                onHoldVehicle={() => {}}
                onClearVehicle={() => {}}
                onOpenBroadcast={() => setIsBroadcastModalOpen(true)}
                totalHauledTons={0}
                targetTons={0}
                radioNotice={radioNotice}
                userRole={settings.role}
                weather={weather}
                telemetry={hardwareTelemetry}
              />
            )}

            {currentScreen === 'hardware-telemetry' && (
              <HardwareTelemetryScreen
                telemetry={hardwareTelemetry}
                onUpdateTelemetry={handleUpdateHardwareTelemetry}
                userRole={settings.role}
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
        telemetry={hardwareTelemetry}
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
