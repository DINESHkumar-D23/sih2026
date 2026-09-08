import React, { useState } from 'react';
import { Megaphone, X, Radio, Send } from 'lucide-react';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendBroadcast: (message: string) => void;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  isOpen,
  onClose,
  onSendBroadcast,
}) => {
  const [message, setMessage] = useState(
    'ALL PIT UNITS: DENSE FOG BELOW BENCH 06. REDUCE SPEED TO 12 KM/H. KEEP RETARDERS ENGAGED.'
  );

  if (!isOpen) return null;

  const quickAlerts = [
    'ALL PIT UNITS: DENSE FOG BELOW BENCH 06. REDUCE SPEED TO 12 KM/H.',
    'HAIRPIN 3 CONFLICT: ALL EMPTY DESCENT UNITS HOLD IN PASSING BAYS.',
    'CRUSHER 1 HOPPER CLEAR: INFLOW DUMPERS PROCEED AT 10 KM/H.',
    'SLIP HAZARD LEVEL 4 IN EFFECT: RETARDER BRAKING MANDATORY ON ALL RAMPS.',
    'EMERGENCY VEHICLE CLEARANCE: AMBULANCE ASCENDING MAIN INCLINE TO BENCH 04.',
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none"
    >
      <div className="w-full max-w-lg bg-[#0A0A0B] border border-[#262626] shadow-2xl overflow-hidden text-[#E0E0E0]">
        {/* Header */}
        <div className="p-3 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <span
              id="broadcast-title"
              className="font-mono text-sm font-bold text-blue-400 uppercase tracking-wider"
            >
              PRIORITY ALL-PIT BROADCAST (VHF CH 04)
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close broadcast dialog"
            className="p-1 hover:bg-[#18181A] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between font-mono text-xs text-slate-300 font-semibold">
            <span>TARGET: ALL PIT DUMPERS + SHOVELS + PIT SUPERVISORS</span>
            <span className="text-yellow-400 flex items-center gap-1.5 font-bold">
              <Radio className="w-3.5 h-3.5 text-yellow-400" aria-hidden="true" /> 156.20 MHz OVERRIDE
            </span>
          </div>

          <textarea
            rows={3}
            value={message}
            aria-label="Broadcast transmission message"
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-black border border-[#333333] p-2.5 font-mono text-xs sm:text-sm text-white font-medium focus:outline-hidden focus:border-blue-500 leading-relaxed"
            placeholder="Type priority dispatch transmission..."
          />

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-xs text-slate-400 uppercase font-bold">
              PRESET QUICK TRANSMISSIONS:
            </span>
            <div className="flex flex-col gap-1.5">
              {quickAlerts.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMessage(preset)}
                  className="text-left p-2 bg-black hover:bg-[#18181A] border border-[#262626] hover:border-blue-500/50 font-mono text-xs text-slate-200 hover:text-blue-300 font-medium transition-colors cursor-pointer leading-snug"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0F0F10] border-t border-[#262626] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#18181A] hover:bg-black text-white font-mono text-xs font-bold py-2 px-3.5 border border-[#333333] cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="button"
            disabled={!message.trim()}
            onClick={() => {
              if (message.trim()) {
                onSendBroadcast(message.trim());
                onClose();
              }
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold py-2 px-4 flex items-center gap-2 cursor-pointer border border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
            TRANSMIT PRIORITY DISPATCH
          </button>
        </div>
      </div>
    </div>
  );
};
