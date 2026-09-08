import React, { useState, useEffect } from 'react';
import { AlertOctagon, X, RotateCcw } from 'lucide-react';

interface EmergencyStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmStop: () => void;
  isEmergencyActive: boolean;
  onResetEmergency: () => void;
}

export const EmergencyStopModal: React.FC<EmergencyStopModalProps> = ({
  isOpen,
  onClose,
  onConfirmStop,
  isEmergencyActive,
  onResetEmergency,
}) => {
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="estop-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs select-none"
    >
      <div className="w-full max-w-md bg-[#0A0A0B] border border-red-600 shadow-2xl overflow-hidden text-[#E0E0E0]">
        {/* Header */}
        <div className="p-3 bg-red-950/90 border-b border-red-600 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-400 animate-pulse" aria-hidden="true" />
            <span id="estop-title" className="font-mono text-sm font-bold tracking-wider uppercase">
              MINE EMERGENCY STOP PROTOCOL
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close emergency stop dialog"
            className="p-1 hover:bg-red-900 transition-colors cursor-pointer text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-3">
          {isEmergencyActive ? (
            <div className="p-4 bg-red-950/50 border border-red-600 flex flex-col items-center text-center gap-2.5">
              <span className="h-3.5 w-3.5 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono text-sm sm:text-base font-bold text-red-300 uppercase tracking-wider">
                ALL-PIT EMERGENCY STOP ACTIVE
              </span>
              <p className="font-sans text-xs sm:text-sm text-slate-200 leading-relaxed">
                Autonomous retarder interlocks engaged across all active dumpers. Haul operations halted at current locations with state fidelity preserved.
              </p>
              <button
                onClick={() => {
                  onResetEmergency();
                  onClose();
                }}
                className="mt-2 bg-blue-600 text-white font-mono text-xs font-bold py-2.5 px-4 border border-blue-400 hover:bg-blue-500 cursor-pointer flex items-center gap-2 transition-colors shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                RESET INTERLOCK &amp; RESUME OPERATIONS
              </button>
            </div>
          ) : (
            <>
              <div className="text-xs sm:text-sm font-sans text-slate-200 leading-relaxed">
                <p className="font-bold text-red-300 mb-1.5 font-mono text-xs sm:text-sm leading-snug">
                  WARNING: Broadcasts E-Stop override across VHF CH 04 and commands immediate hydraulic retarder braking on all active haul units.
                </p>
                <p className="text-slate-300 text-xs sm:text-[13px]">
                  Requires safety controller confirmation. Type <strong className="text-white font-mono bg-red-950/60 px-1 py-0.5 border border-red-800">STOP</strong> below to authorize command execution.
                </p>
              </div>

              <div className="flex flex-col gap-1 mt-1">
                <input
                  type="text"
                  autoFocus
                  aria-label="Type STOP to confirm emergency all-pit stop"
                  placeholder="Type 'STOP' to confirm"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && confirmInput === 'STOP') {
                      onConfirmStop();
                      onClose();
                    }
                  }}
                  className="bg-black border-2 border-red-500 text-red-200 font-mono text-sm sm:text-base px-3 py-2 focus:outline-hidden text-center uppercase font-bold tracking-widest placeholder:text-red-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 mt-1.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-[#18181A] hover:bg-black text-white font-mono text-xs font-bold py-2 border border-[#333333] cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  disabled={confirmInput !== 'STOP'}
                  onClick={() => {
                    onConfirmStop();
                    onClose();
                  }}
                  className={`font-mono text-xs font-bold py-2 border transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                    confirmInput === 'STOP'
                      ? 'bg-red-700 hover:bg-red-600 text-white border-red-400'
                      : 'bg-black text-slate-500 border-[#262626] cursor-not-allowed opacity-50'
                  }`}
                >
                  <AlertOctagon className="w-4 h-4" />
                  EXECUTE E-STOP
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
