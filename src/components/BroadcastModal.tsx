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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none"
    >
      <div className="w-full max-w-lg bg-[#0A0A0B] border border-[#262626] shadow-2xl overflow-hidden text-[#E0E0E0]">
        {/* Header */}
        <div className="p-2.5 bg-[#0F0F10] border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <span
              id="broadcast-title"
              className="font-mono text-[12px] font-bold text-blue-400 uppercase tracking-wider"
            >
              PRIORITY ALL-PIT BROADCAST (VHF CH 04)
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close broadcast dialog"
            className="p-1 hover:bg-[#18181A] text-[#888888] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between font-mono text-[9px] text-[#888888]">
            <span>TARGET: ALL PIT DUMPERS + SHOVELS + PIT SUPERVISORS</span>
            <span className="text-yellow-400 flex items-center gap-1 font-bold">
              <Radio className="w-3 h-3 text-yellow-400" aria-hidden="true" /> 156.20 MHz OVERRIDE
            </span>
          </div>

          <textarea
            rows={3}
            value={message}
            aria-label="Broadcast transmission message"
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-black border border-[#262626] p-2 font-mono text-[11px] text-[#E0E0E0] focus:outline-hidden focus:border-blue-500"
            placeholder="Type priority dispatch transmission..."
          />

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] text-[#888888] uppercase font-bold">
              PRESET QUICK TRANSMISSIONS:
            </span>
            <div className="flex flex-col gap-1">
              {quickAlerts.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMessage(preset)}
                  className="text-left p-1.5 bg-black hover:bg-[#18181A] border border-[#222222] font-mono text-[9.5px] text-[#A3A3A3] hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-[#0F0F10] border-t border-[#262626] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#18181A] hover:bg-black text-[#E0E0E0] font-mono text-[10px] font-semibold py-1.5 px-3 border border-[#333333] cursor-pointer"
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
            className="bg-blue-600 hover:bg-blue-500 text-white font-mono text-[10px] font-bold py-1.5 px-3 flex items-center gap-1.5 cursor-pointer border border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-3 h-3" />
            TRANSMIT PRIORITY DISPATCH
          </button>
        </div>
      </div>
    </div>
  );
};
