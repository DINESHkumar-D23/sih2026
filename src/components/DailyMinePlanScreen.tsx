import React, { useState, useMemo } from 'react';
import {
  CalendarCheck,
  TrendingUp,
  Truck,
  CheckCircle2,
  Clock,
  Fuel,
  Factory,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Copy,
  Download,
  AlertCircle,
  BarChart3,
  Sliders,
  Zap,
} from 'lucide-react';
import { audioSynth } from '../utils/audio';

interface DailyMinePlanScreenProps {
  currentHauledTons: number;
  currentTargetTons: number;
  onUpdateTargetTons: (newTarget: number) => void;
  isAudioMuted?: boolean;
}

export const DailyMinePlanScreen: React.FC<DailyMinePlanScreenProps> = ({
  currentHauledTons,
  currentTargetTons,
  onUpdateTargetTons,
  isAudioMuted = false,
}) => {
  // User Input: Target M.Tonnes for the day
  const [targetTonsInput, setTargetTonsInput] = useState<number>(currentTargetTons);
  const [highGradePct, setHighGradePct] = useState<number>(60);
  const [medGradePct, setMedGradePct] = useState<number>(25);
  const [wastePct, setWastePct] = useState<number>(15);

  // Fleet distribution preference (% of tonnage allocated to 240T heavy dumpers vs 100T dumpers)
  const [heavyTruckAllocationPct, setHeavyTruckAllocationPct] = useState<number>(75);

  // Status feedback
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);

  // Pre-set targets for quick selection
  const quickTargetPresets = [20000, 30000, 40000, 50000, 65000, 80000];

  // Mathematical Calculations for the Perfect Trip Plan
  const planMetrics = useMemo(() => {
    const targetMT = Math.max(1000, targetTonsInput || 0);

    // Payload specifications
    const payload240T = 210; // Effective payload in metric tonnes for Cat 793D
    const payload100T = 85;  // Effective payload in metric tonnes for BEML BH85

    // Tonnage partition
    const tons240T = (targetMT * heavyTruckAllocationPct) / 100;
    const tons100T = targetMT - tons240T;

    // Number of trips required per dumper category
    const trips240T = Math.ceil(tons240T / payload240T);
    const trips100T = Math.ceil(tons100T / payload100T);
    const totalTrips = trips240T + trips100T;

    // Ore grade distribution in tonnes and trips
    const highGradeTons = (targetMT * highGradePct) / 100;
    const medGradeTons = (targetMT * medGradePct) / 100;
    const wasteTons = (targetMT * wastePct) / 100;

    const avgPayload = (tons240T + tons100T) / Math.max(1, totalTrips);
    const highGradeTrips = Math.ceil(highGradeTons / avgPayload);
    const medGradeTrips = Math.ceil(medGradeTons / avgPayload);
    const wasteTrips = Math.ceil(wasteTons / avgPayload);

    // 3-Shift breakdown (8 hours each: Shift A, B, C)
    const tripsPerShift = Math.ceil(totalTrips / 3);
    const tonsPerShift = Math.round(targetMT / 3);
    const tripsPerHour = parseFloat((totalTrips / 24).toFixed(1));
    const dispatchIntervalMinutes = parseFloat((60 / Math.max(0.1, tripsPerHour)).toFixed(1));

    // Fleet Sizing & Availability:
    // Standard cycle time: 20 minutes (3 trips / hour per truck)
    // Working hours per truck per day: 18 hours (allowing for shift handovers, refueling & inspections)
    const truckCapacityTripsPerDay = 18 * 3; // ~54 trips per truck/day
    const recommended240TFleet = Math.max(1, Math.ceil(trips240T / truckCapacityTripsPerDay));
    const recommended100TFleet = Math.max(1, Math.ceil(trips100T / truckCapacityTripsPerDay));
    const totalRecommendedFleet = recommended240TFleet + recommended100TFleet;

    // Crusher Capacity Requirement (TPH)
    const requiredCrusherTph = Math.round(targetMT / 24);

    // Fuel Consumption: ~0.64 Litres of diesel per Metric Tonne on 11% incline
    const estimatedDieselLiters = Math.round(targetMT * 0.64);
    const dieselPerTripLiters = parseFloat((estimatedDieselLiters / Math.max(1, totalTrips)).toFixed(1));

    // Progress towards target
    const currentProgressPct = Math.min(100, parseFloat(((currentHauledTons / targetMT) * 100).toFixed(1)));
    const remainingTons = Math.max(0, targetMT - currentHauledTons);
    const remainingTrips = Math.ceil(remainingTons / avgPayload);

    return {
      targetMT,
      totalTrips,
      trips240T,
      trips100T,
      payload240T,
      payload100T,
      highGradeTons,
      medGradeTons,
      wasteTons,
      highGradeTrips,
      medGradeTrips,
      wasteTrips,
      tripsPerShift,
      tonsPerShift,
      tripsPerHour,
      dispatchIntervalMinutes,
      recommended240TFleet,
      recommended100TFleet,
      totalRecommendedFleet,
      requiredCrusherTph,
      estimatedDieselLiters,
      dieselPerTripLiters,
      currentProgressPct,
      remainingTons,
      remainingTrips,
    };
  }, [targetTonsInput, heavyTruckAllocationPct, highGradePct, medGradePct, wastePct, currentHauledTons]);

  // Handle Apply to Dispatch
  const handleApplyToDispatch = () => {
    onUpdateTargetTons(planMetrics.targetMT);
    audioSynth.playRadioClick(isAudioMuted);
    setAppliedFeedback(`Daily target of ${planMetrics.targetMT.toLocaleString()} MT applied to active dispatch!`);
    setTimeout(() => setAppliedFeedback(null), 5000);
  };

  // Copy Plan Summary
  const handleCopyPlan = () => {
    const text = `
=== NMDC BAILADILA SECTOR 14-A DAILY MINE DISPATCH PLAN ===
Target Mined Output: ${planMetrics.targetMT.toLocaleString()} Metric Tonnes (MT)
Total Haul Trips Required: ${planMetrics.totalTrips} Trips
- 240T Cat 793D Heavy Dumpers: ${planMetrics.trips240T} trips (${planMetrics.recommended240TFleet} active trucks)
- 100T BEML BH85 Dumpers: ${planMetrics.trips100T} trips (${planMetrics.recommended100TFleet} active trucks)

SHIFT DISPATCH CADENCE (24-Hour Production):
- Trips per Shift (8-hr): ${planMetrics.tripsPerShift} trips (~${planMetrics.tonsPerShift.toLocaleString()} MT / shift)
- Average Dispatch Cadence: 1 dumper every ${planMetrics.dispatchIntervalMinutes} minutes (${planMetrics.tripsPerHour} trips/hr)
- Crusher Processing Feed Rate: ${planMetrics.requiredCrusherTph} TPH Continuous

ORE GRADE BREAKDOWN:
- High-Grade Iron Ore (66.4% Fe): ${planMetrics.highGradeTons.toLocaleString()} MT (${planMetrics.highGradeTrips} trips)
- Medium-Grade Iron Ore (62.0% Fe): ${planMetrics.medGradeTons.toLocaleString()} MT (${planMetrics.medGradeTrips} trips)
- Waste Rock / Overburden: ${planMetrics.wasteTons.toLocaleString()} MT (${planMetrics.wasteTrips} trips)

ESTIMATED RESOURCE CONSUMPTION:
- Total Diesel Consumption: ${planMetrics.estimatedDieselLiters.toLocaleString()} Liters (~${planMetrics.dieselPerTripLiters} L/trip)
Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
===========================================================
    `.trim();

    navigator.clipboard?.writeText(text);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 3000);
  };

  return (
    <div className="flex flex-col gap-4 text-[#E0E0E0] select-none pb-8 font-sans">
      {/* Top Header Banner */}
      <div className="bg-[#0A0A0B] border border-[#262626] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-950 border border-blue-500 text-blue-400">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-base md:text-lg font-bold text-white uppercase tracking-wider">
                DAILY MINE PRODUCTION &amp; TRIP PLANNER
              </h1>
              <span className="bg-amber-950 text-amber-300 border border-amber-600 font-mono text-[11px] font-bold px-2 py-0.5 uppercase">
                SECTOR 14-A
              </span>
            </div>
            <p className="font-mono text-xs text-slate-300 mt-0.5">
              Enter target metric tonnes to compute the perfect haulage trip schedule, shift breakdown &amp; fleet requirements.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleCopyPlan}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-[#17171a] hover:bg-[#262630] border border-[#3f3f46] text-slate-200 font-mono text-xs font-bold transition-colors cursor-pointer"
          >
            {copiedFeedback ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-blue-400" />}
            <span>{copiedFeedback ? 'COPIED!' : 'COPY PLAN'}</span>
          </button>

          <button
            type="button"
            onClick={handleApplyToDispatch}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold border border-blue-400 shadow-md transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>APPLY TO DISPATCH</span>
          </button>
        </div>
      </div>

      {appliedFeedback && (
        <div className="p-3 bg-green-950/80 border border-green-500 text-green-200 font-mono text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <span>{appliedFeedback}</span>
        </div>
      )}

      {/* Main Grid: Inputs on Left (4 cols), Calculated Plan on Right (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ==================== LEFT: INPUT PARAMETERS (col-span-4) ==================== */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Card 1: Target Metric Tonnes Input */}
          <div className="bg-[#0A0A0B] border border-[#262626] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <span className="font-mono text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Target Mined Output (M.Tonnes)
              </span>
              <span className="font-mono text-[11px] text-slate-400">TODAY'S GOAL</span>
            </div>

            {/* Custom Input Field */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs text-slate-300 font-semibold">
                DAILY TARGET IN METRIC TONNES (MT):
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min={1000}
                  max={200000}
                  step={500}
                  value={targetTonsInput}
                  onChange={(e) => setTargetTonsInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-[#111114] border-2 border-blue-500/70 focus:border-blue-400 text-white font-mono text-2xl font-bold py-2.5 px-3 outline-none"
                  placeholder="e.g. 40000"
                />
                <span className="absolute right-3 font-mono text-xs font-bold text-slate-400 pointer-events-none">
                  MT / DAY
                </span>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-col gap-1.5 mt-1">
              <span className="font-mono text-[11px] text-slate-400 font-medium">QUICK PRESETS:</span>
              <div className="grid grid-cols-3 gap-1.5">
                {quickTargetPresets.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTargetTonsInput(val)}
                    className={`py-1.5 text-xs font-mono font-bold border transition-colors cursor-pointer ${
                      targetTonsInput === val
                        ? 'bg-blue-600 text-white border-blue-400'
                        : 'bg-[#141418] text-slate-300 border-[#2b2b33] hover:text-white hover:border-slate-500'
                    }`}
                  >
                    {(val / 1000).toFixed(0)}k MT
                  </button>
                ))}
              </div>
            </div>

            {/* Real-Time Progress Context */}
            <div className="p-2.5 bg-[#111114] border border-[#2b2b33] flex flex-col gap-1.5 mt-1">
              <div className="flex justify-between items-center font-mono text-xs">
                <span className="text-slate-400">Current Hauled:</span>
                <span className="text-white font-bold">{currentHauledTons.toLocaleString()} MT</span>
              </div>
              <div className="w-full bg-[#1c1c22] h-2 border border-[#333338] overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${planMetrics.currentProgressPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center font-mono text-[11px]">
                <span className="text-blue-300 font-semibold">{planMetrics.currentProgressPct}% achieved</span>
                <span className="text-amber-400 font-semibold">{planMetrics.remainingTons.toLocaleString()} MT remaining</span>
              </div>
            </div>
          </div>

          {/* Card 2: Fleet Allocation Preference */}
          <div className="bg-[#0A0A0B] border border-[#262626] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <span className="font-mono text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                Fleet Payload Allocation
              </span>
              <span className="font-mono text-[11px] text-slate-400">TRUCK MIX</span>
            </div>

            <div className="flex flex-col gap-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Heavy 240T Cat 793D:</span>
                <span className="text-white font-bold text-sm">{heavyTruckAllocationPct}% ({planMetrics.trips240T} trips)</span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={heavyTruckAllocationPct}
                onChange={(e) => setHeavyTruckAllocationPct(parseInt(e.target.value, 10))}
                className="w-full cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>100T BEML BH85: {100 - heavyTruckAllocationPct}% ({planMetrics.trips100T} trips)</span>
                <span>210 MT vs 85 MT payload</span>
              </div>
            </div>
          </div>

          {/* Card 3: Ore Grade Partitioning */}
          <div className="bg-[#0A0A0B] border border-[#262626] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                Ore Grade Ratio
              </span>
              <span className="font-mono text-[11px] text-slate-400">GEOLOGY</span>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>High-Grade (66.4% Fe):</span>
                  <span className="text-white font-bold">{highGradePct}% ({planMetrics.highGradeTons.toLocaleString()} MT)</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={85}
                  value={highGradePct}
                  onChange={(e) => setHighGradePct(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer accent-green-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Medium-Grade (62.0% Fe):</span>
                  <span className="text-white font-bold">{medGradePct}% ({planMetrics.medGradeTons.toLocaleString()} MT)</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={60}
                  value={medGradePct}
                  onChange={(e) => setMedGradePct(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Waste Rock / Overburden:</span>
                  <span className="text-white font-bold">{wastePct}% ({planMetrics.wasteTons.toLocaleString()} MT)</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={wastePct}
                  onChange={(e) => setWastePct(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer accent-slate-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ==================== RIGHT: THE PERFECT TRIP PLAN (col-span-8) ==================== */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Top 3 Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Stat 1: Total Trips Required */}
            <div className="bg-[#0A0A0B] border border-[#262626] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400 uppercase font-bold">TOTAL TRIPS REQUIRED</span>
                <Truck className="w-4 h-4 text-blue-400" />
              </div>
              <div className="my-2">
                <span className="font-mono text-3xl font-bold text-white tracking-tight">
                  {planMetrics.totalTrips}
                </span>
                <span className="font-mono text-xs text-blue-400 ml-2 font-bold">TRIPS / 24H</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400 border-t border-[#222222] pt-1.5 flex justify-between">
                <span>240T: <strong className="text-white">{planMetrics.trips240T}</strong></span>
                <span>100T: <strong className="text-white">{planMetrics.trips100T}</strong></span>
              </div>
            </div>

            {/* Stat 2: Dispatch Cadence */}
            <div className="bg-[#0A0A0B] border border-[#262626] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400 uppercase font-bold">DISPATCH CADENCE</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="my-2">
                <span className="font-mono text-3xl font-bold text-amber-300 tracking-tight">
                  1 every {planMetrics.dispatchIntervalMinutes}m
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-400 border-t border-[#222222] pt-1.5">
                <span>Target Incline Flow: <strong className="text-white">{planMetrics.tripsPerHour} trips/hour</strong></span>
              </div>
            </div>

            {/* Stat 3: Recommended Active Fleet */}
            <div className="bg-[#0A0A0B] border border-[#262626] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400 uppercase font-bold">RECOMMENDED ACTIVE FLEET</span>
                <Zap className="w-4 h-4 text-green-400" />
              </div>
              <div className="my-2">
                <span className="font-mono text-3xl font-bold text-green-400 tracking-tight">
                  {planMetrics.totalRecommendedFleet}
                </span>
                <span className="font-mono text-xs text-slate-300 ml-2 font-bold">DUMPERS ACTIVE</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400 border-t border-[#222222] pt-1.5 flex justify-between">
                <span>{planMetrics.recommended240TFleet}x 240T Units</span>
                <span>{planMetrics.recommended100TFleet}x 100T Units</span>
              </div>
            </div>
          </div>

          {/* Shift-by-Shift Operational Schedule */}
          <div className="bg-[#0A0A0B] border border-[#262626] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  3-SHIFT PRODUCTION &amp; HAULAGE SCHEDULE
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">DGMS 8-HOUR STANDARD SHIFTS</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
              {/* Shift 1 */}
              <div className="bg-[#111114] border border-[#2b2b33] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-[#222226] pb-1.5">
                  <span className="font-bold text-blue-300">SHIFT 1 (MORNING)</span>
                  <span className="text-[11px] text-slate-400">06:00 - 14:00</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400">Shift Target:</span>
                  <span className="text-white font-bold text-base">{planMetrics.tonsPerShift.toLocaleString()} MT</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400">Trips to Dispatch:</span>
                  <span className="text-amber-400 font-bold text-base">{planMetrics.tripsPerShift} TRIPS</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-[#222226]">
                  <span>Avg Rate: ~{(planMetrics.tripsPerShift / 8).toFixed(1)} trips/hr</span>
                  <span>100% Retarder Check</span>
                </div>
              </div>

              {/* Shift 2 */}
              <div className="bg-[#111114] border border-[#2b2b33] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-[#222226] pb-1.5">
                  <span className="font-bold text-amber-300">SHIFT 2 (AFTERNOON)</span>
                  <span className="text-[11px] text-slate-400">14:00 - 22:00</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400">Shift Target:</span>
                  <span className="text-white font-bold text-base">{planMetrics.tonsPerShift.toLocaleString()} MT</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400">Trips to Dispatch:</span>
                  <span className="text-amber-400 font-bold text-base">{planMetrics.tripsPerShift} TRIPS</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-[#222226]">
                  <span>Avg Rate: ~{(planMetrics.tripsPerShift / 8).toFixed(1)} trips/hr</span>
                  <span>Rain Slippage Watch</span>
                </div>
              </div>

              {/* Shift 3 */}
              <div className="bg-[#111114] border border-[#2b2b33] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-[#222226] pb-1.5">
                  <span className="font-bold text-purple-300">SHIFT 3 (NIGHT)</span>
                  <span className="text-[11px] text-slate-400">22:00 - 06:00</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400">Shift Target:</span>
                  <span className="text-white font-bold text-base">{planMetrics.tonsPerShift.toLocaleString()} MT</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400">Trips to Dispatch:</span>
                  <span className="text-purple-300 font-bold text-base">{planMetrics.tripsPerShift} TRIPS</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-[#222226]">
                  <span>Avg Rate: ~{(planMetrics.tripsPerShift / 8).toFixed(1)} trips/hr</span>
                  <span>Dense Fog Protocol</span>
                </div>
              </div>
            </div>
          </div>

          {/* Plant & Environmental Resource Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Primary Crusher Hopper Feeding Rate */}
            <div className="bg-[#0A0A0B] border border-[#262626] p-4 flex flex-col justify-between font-mono text-xs">
              <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
                <Factory className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-white uppercase">PRIMARY CRUSHER 1 FEED CADENCE</span>
              </div>
              <div className="my-2 flex justify-between items-baseline">
                <span className="text-slate-400">Required Intake Rate:</span>
                <span className="text-white font-bold text-xl">{planMetrics.requiredCrusherTph} TPH</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Crusher Deck 1 rated capacity is 2,400 TPH. At {planMetrics.requiredCrusherTph} TPH average feed, hopper surge buffer is optimal with minimum dumping wait times.
              </p>
            </div>

            {/* Diesel & Environmental Footprint */}
            <div className="bg-[#0A0A0B] border border-[#262626] p-4 flex flex-col justify-between font-mono text-xs">
              <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
                <Fuel className="w-4 h-4 text-orange-400" />
                <span className="font-bold text-white uppercase">ESTIMATED DIESEL &amp; ENERGY</span>
              </div>
              <div className="my-2 flex justify-between items-baseline">
                <span className="text-slate-400">Daily Fuel Consumption:</span>
                <span className="text-orange-400 font-bold text-xl">{planMetrics.estimatedDieselLiters.toLocaleString()} L</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Estimated fuel burn of ~{planMetrics.dieselPerTripLiters} L per trip across the 11% gradient incline, accounting for loaded climbing and hydraulic retarder thermal dissipation.
              </p>
            </div>
          </div>

          {/* Detailed Ore Grade Breakdown Table */}
          <div className="bg-[#0A0A0B] border border-[#262626] p-4 flex flex-col gap-3 font-mono text-xs">
            <span className="font-bold text-white uppercase border-b border-[#262626] pb-2">
              TRIP ALLOCATION BY ORE CLASSIFICATION
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2a2a30] text-slate-400 text-[11px]">
                    <th className="py-1.5 px-2">CLASSIFICATION</th>
                    <th className="py-1.5 px-2">FE % GRADE</th>
                    <th className="py-1.5 px-2">TARGET TONNAGE</th>
                    <th className="py-1.5 px-2">EST. TRIPS</th>
                    <th className="py-1.5 px-2">DESTINATION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e24] text-slate-200">
                  <tr>
                    <td className="py-2 px-2 font-bold text-green-400">High-Grade Ore</td>
                    <td className="py-2 px-2">66.4% Fe</td>
                    <td className="py-2 px-2 font-bold text-white">{planMetrics.highGradeTons.toLocaleString()} MT</td>
                    <td className="py-2 px-2 font-bold text-blue-300">{planMetrics.highGradeTrips} trips</td>
                    <td className="py-2 px-2 text-slate-300">Crusher Hopper 1 (Bin A)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2 font-bold text-blue-400">Medium-Grade Ore</td>
                    <td className="py-2 px-2">62.0% Fe</td>
                    <td className="py-2 px-2 font-bold text-white">{planMetrics.medGradeTons.toLocaleString()} MT</td>
                    <td className="py-2 px-2 font-bold text-blue-300">{planMetrics.medGradeTrips} trips</td>
                    <td className="py-2 px-2 text-slate-300">Crusher Hopper 1 (Bin B)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2 font-bold text-slate-400">Waste Rock / Overburden</td>
                    <td className="py-2 px-2">&lt; 55% Fe</td>
                    <td className="py-2 px-2 font-bold text-white">{planMetrics.wasteTons.toLocaleString()} MT</td>
                    <td className="py-2 px-2 font-bold text-amber-300">{planMetrics.wasteTrips} trips</td>
                    <td className="py-2 px-2 text-slate-300">North Waste Dump Spur</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
