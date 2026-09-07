import React from 'react';
import {
  Radar,
  TrendingUp,
  TrafficCone,
  Factory,
  FileText,
  Sliders,
  AlertOctagon,
  Megaphone,
  X,
  Radio,
  CloudRain,
  ExternalLink,
} from 'lucide-react';
import { NavScreen, UserRole, WeatherData } from '../types';

interface SidebarProps {
  currentScreen: NavScreen;
  onSelectScreen: (screen: NavScreen) => void;
  onOpenEmergencyStop: () => void;
  onOpenBroadcast: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  hazardCount?: number;
  userRole?: UserRole;
  isEmergencyActive?: boolean;
  weather?: WeatherData;
  onOpenWeatherModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onSelectScreen,
  onOpenEmergencyStop,
  onOpenBroadcast,
  isOpenMobile,
  onCloseMobile,
  hazardCount = 0,
  userRole = 'dispatcher',
  isEmergencyActive = false,
  weather,
  onOpenWeatherModal,
}) => {
  const navItems = [
    {
      id: 'traffic-radar' as NavScreen,
      label: 'Traffic Radar',
      icon: Radar,
      hasPulse: true,
    },
    {
      id: 'haulage-production' as NavScreen,
      label: 'Haulage & Production',
      icon: TrendingUp,
    },
    {
      id: 'clearance-queue' as NavScreen,
      label: 'Clearance Queue',
      icon: TrafficCone,
      badge: hazardCount > 0 ? `${hazardCount} HAZARD` : undefined,
      badgeType: 'error',
    },
    {
      id: 'crusher-hoppers' as NavScreen,
      label: 'Crusher Hoppers',
      icon: Factory,
    },
    {
      id: 'trip-logs' as NavScreen,
      label: 'Trip Logs',
      icon: FileText,
    },
    {
      id: 'settings' as NavScreen,
      label: 'System & WS Config',
      icon: Sliders,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden cursor-pointer"
          aria-hidden="true"
        />
      )}

      <aside
        role="navigation"
        aria-label="Main application navigation"
        className={`fixed left-0 top-0 h-full w-64 bg-[#0F0F10] border-r border-[#262626] z-50 flex flex-col justify-between select-none transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* App Header / Brand */}
          <div className="h-14 px-3.5 flex items-center justify-between border-b border-[#262626] bg-[#0A0A0B]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-blue-600 flex items-center justify-center font-bold text-white text-[12px] font-mono shadow-xs">
                MTC
              </div>
              <div className="flex flex-col">
                <span className="font-mono font-bold text-[11px] tracking-wider text-[#E0E0E0] uppercase leading-tight">
                  NMDC CENTRAL
                </span>
                <span className="font-mono text-[8.5px] text-blue-400 tracking-widest uppercase">
                  SECTOR 14-A MTC
                </span>
              </div>
            </div>

            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 text-[#888888] hover:text-white cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Role Status Tag */}
          <div className="px-3.5 py-2 border-b border-[#222222] bg-black flex items-center justify-between font-mono text-[9px]">
            <span className="text-[#888888] uppercase">CONSOLE ACCESS:</span>
            <span
              className={`font-bold uppercase px-1.5 py-0.2 border ${
                userRole === 'dispatcher'
                  ? 'text-blue-400 border-blue-600 bg-blue-950/40'
                  : 'text-gray-400 border-gray-600 bg-gray-900/40'
              }`}
            >
              {userRole === 'dispatcher' ? 'MTC CONTROLLER' : 'SAFETY OBSERVER'}
            </span>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col p-2 gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectScreen(item.id);
                    onCloseMobile();
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2 font-mono text-[11px] transition-colors cursor-pointer border ${
                    isActive
                      ? 'bg-blue-600/15 text-white font-semibold border-blue-500/50'
                      : 'text-[#A3A3A3] hover:text-[#E0E0E0] hover:bg-[#18181A] border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-[#888888]'}`}
                    />
                    <span>{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.badge && (
                      <span className="bg-red-950 text-red-400 text-[8.5px] px-1.5 py-0.2 font-bold border border-red-500 animate-pulse">
                        {item.badge}
                      </span>
                    )}
                    {item.hasPulse && !item.badge && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Environmental Telemetry Card in Sidebar */}
          {weather && (
            <div className="mx-3 my-2 p-2 bg-[#0A0A0B] border border-[#262626] font-mono text-[9.5px]">
              <div className="flex items-center justify-between text-[#888888] mb-1">
                <span className="flex items-center gap-1 font-bold text-cyan-400">
                  <CloudRain className="w-3 h-3" />
                  PIT ENVIRONMENT
                </span>
                <span className="text-[8px] px-1 bg-[#18181A] text-gray-300">RL 1,240m</span>
              </div>
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="text-white font-light text-[13px]">{weather.temperatureC.toFixed(1)}°C</span>
                <span className="text-blue-300 text-[9px]">{weather.rainMmHr.toFixed(1)} mm/h</span>
              </div>
              <div className="flex justify-between text-[8.5px] text-[#A3A3A3] mb-1.5">
                <span>μ={weather.frictionCoefficient.toFixed(2)} ({weather.surfaceCondition || 'Wet'})</span>
                <span>{weather.windDirectionCompass} {weather.windSpeedKmh} km/h</span>
              </div>
              {onOpenWeatherModal && (
                <button
                  type="button"
                  onClick={onOpenWeatherModal}
                  className="w-full bg-[#161619] hover:bg-[#222226] text-cyan-300 border border-cyan-700/50 py-1 text-[8.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  <span>MET HYDROLOGY DETAILS</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Actions: VHF Broadcast & E-Stop */}
        <div className="p-3 border-t border-[#262626] bg-[#0A0A0B] flex flex-col gap-2">
          {/* VHF Quick Broadcast Trigger */}
          <button
            type="button"
            onClick={onOpenBroadcast}
            className="w-full bg-[#141416] hover:bg-[#1A1A1D] border border-blue-500/40 text-blue-300 font-mono text-[10px] font-bold py-2 px-3 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Megaphone className="w-3.5 h-3.5 text-blue-400" />
            <span>VHF CH 04 BROADCAST</span>
          </button>

          {/* All-Pit Emergency Stop */}
          <button
            type="button"
            onClick={onOpenEmergencyStop}
            className={`w-full font-mono text-[10px] font-bold py-2 px-3 flex items-center justify-center gap-2 border cursor-pointer transition-colors ${
              isEmergencyActive
                ? 'bg-red-700 text-white border-red-500 animate-pulse'
                : 'bg-red-950/70 hover:bg-red-900 border-red-600 text-red-300'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>{isEmergencyActive ? 'E-STOP INTERLOCK ACTIVE' : 'ALL-PIT E-STOP PROTOCOL'}</span>
          </button>

          <div className="text-[8.5px] font-mono text-[#666666] text-center mt-0.5">
            BAILADILA DEPOSIT 14-A • 11% GRADE
          </div>
        </div>
      </aside>
    </>
  );
};
