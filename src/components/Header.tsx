import React, { useState, useEffect } from 'react';
import {
  Clock,
  Radio,
  Menu,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Shield,
  ShieldAlert,
  AlertOctagon,
  UserCheck,
  Eye,
} from 'lucide-react';
import { UserRole } from '../types';

interface HeaderProps {
  onToggleSidebar?: () => void;
  wsStatus: 'CONNECTED' | 'FALLBACK_SIM';
  fogVisibilityMeters: number;
  isAudioMuted: boolean;
  onToggleMute: () => void;
  userRole: UserRole;
  onToggleRole: () => void;
  onOpenEmergencyModal: () => void;
  isEmergencyActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  wsStatus,
  fogVisibilityMeters,
  isAudioMuted,
  onToggleMute,
  userRole,
  onToggleRole,
  onOpenEmergencyModal,
  isEmergencyActive,
}) => {
  const [time, setTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Format IST time
  const istTimeStr =
    time.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
    }) + ' IST';

  // Format UTC time
  const utcTimeStr =
    time.toLocaleTimeString('en-GB', {
      timeZone: 'UTC',
      hour12: false,
    }) + ' UTC';

  return (
    <header
      role="banner"
      className="fixed top-0 left-0 lg:left-64 right-0 h-14 bg-[#0F0F10] border-b border-[#262626] z-40 flex items-center justify-between px-3 md:px-4 select-none"
    >
      {/* Left: Branding & Pit shift status */}
      <div className="flex items-center gap-2 md:gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-1.5 text-[#E0E0E0] hover:bg-[#1A1A1D] border border-[#262626] rounded-xs cursor-pointer"
            aria-label="Toggle navigation sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono tracking-wider uppercase font-bold text-white">
                NMDC BAILADILA / SECTOR 14-A
              </span>
              {wsStatus === 'CONNECTED' ? (
                <span className="flex items-center gap-1.5 bg-green-950 text-green-300 border border-green-500 px-2 py-0.5 font-mono text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  HARDWARE WS
                </span>
              ) : (
                <span className="flex items-center gap-1.5 bg-blue-950 text-blue-300 border border-blue-500 px-2 py-0.5 font-mono text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  SIM ENGINE
                </span>
              )}
            </div>
            <span className="font-mono text-[11px] text-slate-300 font-medium tracking-wider uppercase hidden sm:block">
              MINE TRAFFIC CONTROL (MTC) &amp; COLLISION AVOIDANCE
            </span>
          </div>
        </div>

        {/* Monsoon Fog Warning */}
        {fogVisibilityMeters <= 50 && (
          <div
            role="status"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-[#991b1b]/40 border border-red-500"
          >
            <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
            <span className="font-mono text-[11px] text-red-200 font-bold tracking-wider uppercase">
              FOG ADVISORY: VISIBILITY {fogVisibilityMeters}M
            </span>
          </div>
        )}
      </div>

      {/* Right Controls: Role, Audio, Fullscreen, E-Stop, Clocks */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Role Switcher */}
        <button
          onClick={onToggleRole}
          aria-label={`Toggle role, currently ${userRole}`}
          title="Click to toggle Dispatcher / Observer mode"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 border font-mono text-[11px] font-bold cursor-pointer transition-colors ${
            userRole === 'dispatcher'
              ? 'bg-blue-950/80 border-blue-400 text-blue-300 hover:bg-blue-900'
              : 'bg-[#1e1e24] border-[#444444] text-slate-200 hover:text-white'
          }`}
        >
          {userRole === 'dispatcher' ? (
            <>
              <UserCheck className="w-3.5 h-3.5 text-blue-300" />
              <span>MTC DISPATCHER</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-slate-200" />
              <span>OBSERVER</span>
            </>
          )}
        </button>

        {/* Audio Mute Toggle */}
        <button
          onClick={onToggleMute}
          aria-label={isAudioMuted ? 'Unmute MTC audio' : 'Mute MTC audio'}
          title={isAudioMuted ? 'Audio Alerts Muted' : 'Audio Alerts Active'}
          className={`p-2 border font-mono text-xs cursor-pointer transition-colors ${
            isAudioMuted
              ? 'bg-yellow-950/60 border-yellow-500 text-yellow-300'
              : 'bg-black border-[#444444] text-slate-200 hover:text-white'
          }`}
        >
          {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Kiosk / Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit full screen kiosk mode' : 'Enter full screen kiosk mode'}
          title="Toggle Kiosk Display Mode"
          className="p-2 bg-black border border-[#444444] text-slate-200 hover:text-white cursor-pointer transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Emergency Stop Action Button */}
        <button
          onClick={onOpenEmergencyModal}
          aria-label="Open emergency all-pit stop protocol"
          className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-bold border transition-colors cursor-pointer ${
            isEmergencyActive
              ? 'bg-red-600 text-white border-red-400 animate-pulse'
              : 'bg-red-950 hover:bg-red-900 border-red-500 text-red-200'
          }`}
        >
          <AlertOctagon className="w-4 h-4 text-white" />
          <span className="hidden sm:inline">
            {isEmergencyActive ? 'E-STOP ACTIVE' : 'ALL-PIT E-STOP'}
          </span>
        </button>

        {/* Live Ticking Clock */}
        <div className="flex items-center gap-2 border-l border-[#333333] pl-2.5 md:pl-3.5">
          <Clock className="w-4 h-4 text-blue-400 hidden sm:block" aria-hidden="true" />
          <div className="flex flex-col text-right font-mono">
            <span className="text-xs md:text-sm font-semibold leading-none text-white">
              {istTimeStr}
            </span>
            <span className="text-[11px] text-slate-300 font-medium leading-tight hidden sm:block">
              {utcTimeStr}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
