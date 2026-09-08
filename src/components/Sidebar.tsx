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
  CalendarCheck,
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
      id: 'daily-mine-plan' as NavScreen,
      label: 'Daily Mine Plan',
      icon: CalendarCheck,
      badge: 'PLANNER',
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
              <div className="w-8 h-8 bg-blue-600 flex items-center justify-center font-bold text-white text-sm font-mono shadow-xs">
                MTC
              </div>
              <div className="flex flex-col">
                <span className="font-mono font-bold text-xs tracking-wider text-white uppercase leading-tight">
                  NMDC CENTRAL
                </span>
                <span className="font-mono text-[11px] text-blue-300 font-semibold tracking-widest uppercase">
                  SECTOR 14-A MTC
                </span>
              </div>
            </div>

            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Role Status Tag */}
          <div className="px-3.5 py-2 border-b border-[#222222] bg-black flex items-center justify-between font-mono text-[11px]">
            <span className="text-slate-300 font-bold uppercase">CONSOLE ACCESS:</span>
            <span
              className={`font-bold uppercase px-2 py-0.5 border ${
                userRole === 'dispatcher'
                  ? 'text-blue-300 border-blue-500 bg-blue-950/80'
                  : 'text-slate-200 border-slate-500 bg-slate-900/60'
              }`}
            >
              {userRole === 'dispatcher' ? 'MTC CONTROLLER' : 'SAFETY OBSERVER'}
            </span>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col p-2 gap-1">
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
                  className={`flex items-center justify-between w-full px-3 py-2.5 font-mono text-xs transition-colors cursor-pointer border ${
                    isActive
                      ? 'bg-blue-600/25 text-white font-bold border-blue-500 shadow-xs'
                      : 'text-slate-200 hover:text-white hover:bg-[#1c1c20] border-transparent font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-300'}`}
                    />
                    <span className="text-[12.5px]">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.badge && (
                      <span className="bg-red-950 text-red-200 text-xs px-2 py-0.5 font-bold border border-red-500 animate-pulse">
                        {item.badge}
                      </span>
                    )}
                    {item.hasPulse && !item.badge && (
                      <span className="bg-red-950 text-red-200 text-xs px-2 py-0.5 font-bold border border-red-500 animate-pulse">
                        {hazardCount} CONFLICT{hazardCount > 1 ? 'S' : ''}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Environmental Telemetry Card Widget */}
          {weather && (
            <div className="p-3 bg-[#111114] border border-[#262626] font-mono text-xs text-[#d1d5db]">
              <div className="flex items-center justify-between border-b border-[#262626] pb-2 mb-2.5">
                <span className="text-slate-300 font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <CloudRain className="w-4 h-4 text-blue-400" /> PIT ENVIRONMENT
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs px-1.5 py-0.5 bg-[#1c1c22] text-slate-200 font-semibold border border-slate-700">RL 1,240m</span>
                </div>
              </div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-white font-bold text-sm">{weather.temperatureC.toFixed(1)}°C</span>
                <span className="text-blue-300 text-xs font-semibold">{weather.rainMmHr.toFixed(1)} mm/h</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-300 font-medium mb-2">
                <span>μ={weather.frictionCoefficient.toFixed(2)} ({weather.surfaceCondition || 'Wet'})</span>
                <span>{weather.windDirectionCompass} {weather.windSpeedKmh} km/h</span>
              </div>
              {onOpenWeatherModal && (
                <button
                  type="button"
                  onClick={onOpenWeatherModal}
                  className="w-full bg-[#18181f] hover:bg-[#252530] text-cyan-200 border border-cyan-500/60 py-1.5 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
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
            className="w-full bg-[#16161a] hover:bg-[#222228] border border-blue-400 text-blue-200 font-mono text-xs font-bold py-2.5 px-3 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Megaphone className="w-4 h-4 text-blue-300" />
            <span>VHF CH 04 BROADCAST</span>
          </button>

          {/* All-Pit Emergency Stop */}
          <button
            type="button"
            onClick={onOpenEmergencyStop}
            className={`w-full font-mono text-xs font-bold py-2.5 px-3 flex items-center justify-center gap-2 border cursor-pointer transition-colors ${
              isEmergencyActive
                ? 'bg-red-600 text-white border-red-400 animate-pulse'
                : 'bg-red-950 hover:bg-red-900 border-red-500 text-red-200'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>{isEmergencyActive ? 'E-STOP INTERLOCK ACTIVE' : 'ALL-PIT E-STOP PROTOCOL'}</span>
          </button>

          <div className="text-[11px] font-mono text-slate-300 font-medium text-center mt-0.5">
            BAILADILA DEPOSIT 14-A • 11% GRADE
          </div>
        </div>
      </aside>
    </>
  );
};
