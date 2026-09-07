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
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono tracking-wider uppercase font-bold text-[#E0E0E0]">
                NMDC BAILADILA / SECTOR 14-A
              </span>
              {wsStatus === 'CONNECTED' ? (
                <span className="flex items-center gap-1 bg-green-950/80 text-green-400 border border-green-600 px-1.5 py-0.2 font-mono text-[8.5px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  HARDWARE WS
                </span>
              ) : (
                <span className="flex items-center gap-1 bg-blue-950/80 text-blue-400 border border-blue-600 px-1.5 py-0.2 font-mono text-[8.5px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  SIM ENGINE
                </span>
              )}
            </div>
            <span className="font-mono text-[8.5px] text-[#888888] tracking-wider uppercase hidden sm:block">
              MINE TRAFFIC CONTROL (MTC) &amp; COLLISION AVOIDANCE
            </span>
          </div>
        </div>

        {/* Monsoon Fog Warning */}
        {fogVisibilityMeters <= 50 && (
          <div
            role="status"
            className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 bg-[#991b1b]/30 border border-[#ef4444]/60"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
            <span className="font-mono text-[9.5px] text-red-400 font-bold tracking-wider uppercase">
              FOG ADVISORY: VISIBILITY {fogVisibilityMeters}M
            </span>
          </div>
        )}
      </div>

      {/* Right Controls: Role, Audio, Fullscreen, E-Stop, Clocks */}
      <div className="flex items-center gap-1.5 md:gap-2.5">
        {/* Role Switcher */}
        <button
          onClick={onToggleRole}
          aria-label={`Toggle role, currently ${userRole}`}
          title="Click to toggle Dispatcher / Observer mode"
          className={`flex items-center gap-1 px-2 py-1 border font-mono text-[9.5px] font-bold cursor-pointer transition-colors ${
            userRole === 'dispatcher'
              ? 'bg-blue-950/60 border-blue-500 text-blue-400 hover:bg-blue-900/60'
              : 'bg-[#18181A] border-[#333333] text-gray-400 hover:text-white'
          }`}
        >
          {userRole === 'dispatcher' ? (
            <>
              <UserCheck className="w-3 h-3 text-blue-400" />
              <span>MTC DISPATCHER</span>
            </>
          ) : (
            <>
              <Eye className="w-3 h-3 text-gray-400" />
              <span>OBSERVER</span>
            </>
          )}
        </button>

        {/* Audio Mute Toggle */}
        <button
          onClick={onToggleMute}
          aria-label={isAudioMuted ? 'Unmute MTC audio' : 'Mute MTC audio'}
          title={isAudioMuted ? 'Audio Alerts Muted' : 'Audio Alerts Active'}
          className={`p-1.5 border font-mono text-[10px] cursor-pointer transition-colors ${
            isAudioMuted
              ? 'bg-yellow-950/40 border-yellow-600 text-yellow-400'
              : 'bg-black border-[#333333] text-gray-300 hover:text-white'
          }`}
        >
          {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Kiosk / Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit full screen kiosk mode' : 'Enter full screen kiosk mode'}
          title="Toggle Kiosk Display Mode"
          className="p-1.5 bg-black border border-[#333333] text-gray-300 hover:text-white cursor-pointer transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Emergency Stop Action Button */}
        <button
          onClick={onOpenEmergencyModal}
          aria-label="Open emergency all-pit stop protocol"
          className={`flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-bold border transition-colors cursor-pointer ${
            isEmergencyActive
              ? 'bg-red-700 text-white border-red-500 animate-pulse'
              : 'bg-red-950/80 hover:bg-red-900 border-red-600 text-red-300'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5 text-white" />
          <span className="hidden sm:inline">
            {isEmergencyActive ? 'E-STOP ACTIVE' : 'ALL-PIT E-STOP'}
          </span>
        </button>

        {/* Live Ticking Clock */}
        <div className="flex items-center gap-1.5 border-l border-[#262626] pl-2 md:pl-3">
          <Clock className="w-3.5 h-3.5 text-blue-400 hidden sm:block" aria-hidden="true" />
          <div className="flex flex-col text-right font-mono">
            <span className="text-[11px] md:text-[12px] font-light leading-none text-[#E0E0E0]">
              {istTimeStr}
            </span>
            <span className="text-[8.5px] text-[#888888] leading-tight hidden sm:block">
              {utcTimeStr}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
