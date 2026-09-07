import React from 'react';
import { ArrowUpRight, TrendingUp, Download, PieChart, Layers, CheckCircle } from 'lucide-react';
import { SHOVELS } from '../data/mockMineData';
import { TripLogEntry } from '../types';

interface HaulageProductionScreenProps {
  totalHauledTons: number;
  highGradeTons: number;
  mediumGradeTons: number;
  wasteTons: number;
  targetTons?: number;
  tripLogs: TripLogEntry[];
}

export const HaulageProductionScreen: React.FC<HaulageProductionScreenProps> = ({
  totalHauledTons,
  highGradeTons,
  mediumGradeTons,
  wasteTons,
  targetTons = 40000,
  tripLogs,
}) => {
  const progressPercent = Math.min(100, (totalHauledTons / targetTons) * 100);
  const currentTph = Math.round(totalHauledTons / 5.75);

  const handleExportCSV = () => {
    const headers = ['Log ID', 'Dumper ID', 'Operator', 'Payload (Tons)', 'Material', 'Fe %', 'Source Bench', 'Destination', 'Cycle Time (Min)', 'Timestamp'];
    const rows = tripLogs.map((log) => [
      log.id,
      log.dumperId,
      `"${log.operator}"`,
      log.payloadTons,
      `"${log.material}"`,
      log.fePercentage,
      `"${log.sourceBench}"`,
      `"${log.destination}"`,
      log.cycleTimeMins,
      `"${log.timestamp}"`,
    ]);

    const summarySection = [
      ['--- SHIFT A HANDOVER SUMMARY REPORT ---'],
      ['Mine Location', 'NMDC Bailadila Sector 14-A'],
      ['Shift Period', 'Shift A (06:00 - 14:00 IST)'],
      ['Total Hauled Tonnage', `${totalHauledTons} Tons`],
      ['High-Grade Fe Tonnage', `${highGradeTons} Tons`],
      ['Medium-Grade Fe Tonnage', `${mediumGradeTons} Tons`],
      ['Waste Rock Tonnage', `${wasteTons} Tons`],
      ['Average Instantaneous TPH', `${currentTph} TPH`],
      ['Target Completion', `${progressPercent.toFixed(1)}%`],
      ['--------------------------------------'],
      [],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      summarySection.map((e) => e.join(',')).join('\n') +
      headers.join(',') +
      '\n' +
      rows.map((e) => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NMDC_Bailadila_ShiftA_Handover_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-3 select-none text-[#E0E0E0] pb-6 font-sans">
      {/* Top Banner Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
        <div className="bg-[#0A0A0B] border border-[#333338] p-3 flex flex-col justify-between">
          <div>
            <span className="font-mono text-xs text-slate-300 font-bold uppercase">TOTAL HAULED (SHIFT A)</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-mono text-2xl text-white font-bold">{totalHauledTons.toLocaleString()}</span>
              <span className="font-mono text-xs text-slate-300 font-bold">TONS</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="w-full bg-[#18181A] h-2 overflow-hidden border border-[#333338]">
              <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="font-mono text-xs text-blue-300 font-semibold mt-1.5 block">
              {progressPercent.toFixed(1)}% of {targetTons.toLocaleString()} T Target (5.75 hrs elapsed)
            </span>
          </div>
        </div>

        <div className="bg-[#0A0A0B] border border-[#333338] p-3 flex flex-col justify-between">
          <div>
            <span className="font-mono text-xs text-slate-300 font-bold uppercase">INSTANTANEOUS RUN RATE</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-mono text-2xl text-green-400 font-bold">{currentTph.toLocaleString()}</span>
              <span className="font-mono text-xs text-slate-300 font-bold">TPH</span>
            </div>
          </div>
          <span className="font-mono text-xs text-green-300 font-semibold mt-2.5 flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5" /> Exceeds baseline production quota
          </span>
        </div>

        <div className="bg-[#0A0A0B] border border-[#333338] p-3 flex flex-col justify-between">
          <div>
            <span className="font-mono text-xs text-slate-300 font-bold uppercase">AVG DUMPER CYCLE TIME</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-mono text-2xl text-yellow-300 font-bold">22.4</span>
              <span className="font-mono text-xs text-slate-300 font-bold">MIN</span>
            </div>
          </div>
          <span className="font-mono text-xs text-yellow-200 font-medium mt-2.5 block">
            Monsoon wet road clamp enforces 15 km/h cap
          </span>
        </div>

        <div className="bg-[#0A0A0B] border border-[#333338] p-3 flex flex-col justify-between">
          <div>
            <span className="font-mono text-xs text-slate-300 font-bold uppercase">DISPATCH FLEET UTILIZATION</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-mono text-2xl text-blue-300 font-bold">91.2%</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportCSV}
            className="mt-2.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold py-2 px-3 border border-blue-400 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT HANDOVER CSV
          </button>
        </div>
      </div>

      {/* Material Grade Breakdown & Shovels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left 6 Cols: Ore Grade Breakdown */}
        <div className="lg:col-span-6 flex flex-col gap-2.5">
          <div className="bg-[#0A0A0B] border border-[#333338] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-blue-400" />
                <span className="font-mono font-bold text-xs text-blue-300 uppercase tracking-wider">
                  Material Grade Accounting
                </span>
              </div>
            </div>

            <div className="p-3.5 flex flex-col gap-3 font-mono text-xs">
              {/* High-Grade Fe */}
              <div className="bg-black p-3 border border-[#2a2a30]">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-blue-300 font-bold">HIGH-GRADE HEMATITE (65-68% Fe)</span>
                  <span className="text-white font-bold text-sm">{highGradeTons.toLocaleString()} T</span>
                </div>
                <div className="w-full bg-[#18181A] h-2.5 border border-[#333338] overflow-hidden">
                  <div
                    className="bg-blue-500 h-full"
                    style={{ width: `${(highGradeTons / totalHauledTons) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-300 font-medium mt-1.5 block">
                  {((highGradeTons / totalHauledTons) * 100).toFixed(1)}% of total haul • Discharged to Primary Crusher 1
                </span>
              </div>

              {/* Medium-Grade Fe */}
              <div className="bg-black p-3 border border-[#2a2a30]">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-cyan-300 font-bold">MEDIUM-GRADE SILICEOUS (60-64% Fe)</span>
                  <span className="text-white font-bold text-sm">{mediumGradeTons.toLocaleString()} T</span>
                </div>
                <div className="w-full bg-[#18181A] h-2.5 border border-[#333338] overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full"
                    style={{ width: `${(mediumGradeTons / totalHauledTons) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-300 font-medium mt-1.5 block">
                  {((mediumGradeTons / totalHauledTons) * 100).toFixed(1)}% of total haul • Discharged to Crusher 2 Jaw Feed
                </span>
              </div>

              {/* Waste Rock */}
              <div className="bg-black p-3 border border-[#2a2a30]">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-orange-300 font-bold">OVERBURDEN &amp; WASTE ROCK</span>
                  <span className="text-white font-bold text-sm">{wasteTons.toLocaleString()} T</span>
                </div>
                <div className="w-full bg-[#18181A] h-2.5 border border-[#333338] overflow-hidden">
                  <div
                    className="bg-orange-500 h-full"
                    style={{ width: `${(wasteTons / totalHauledTons) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-300 font-medium mt-1.5 block">
                  {((wasteTons / totalHauledTons) * 100).toFixed(1)}% of total haul • Discharged to North Waste Dump 03
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Shovel Fleet Operations */}
        <div className="lg:col-span-6 flex flex-col gap-2.5">
          <div className="bg-[#0A0A0B] border border-[#333338] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#0F0F10] border-b border-[#333338] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-green-400" />
                <span className="font-mono font-bold text-xs text-green-300 uppercase tracking-wider">
                  Shovel Face Productivity
                </span>
              </div>
            </div>

            <div className="p-3.5 flex flex-col gap-2.5 font-mono text-xs">
              {SHOVELS.map((shv) => (
                <div key={shv.id} className="bg-black p-3 border border-[#2a2a30] flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold text-sm">{shv.name}</span>
                    <span className="bg-green-950 text-green-300 border border-green-500 text-xs px-2 py-0.5 font-bold">
                      {shv.operatingStatus}
                    </span>
                  </div>
                  <div className="text-slate-300 text-xs font-medium">
                    {shv.bench} • {shv.grade} ({shv.feGrade}% Fe)
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-200 mt-1 pt-1.5 border-t border-[#222226] font-semibold">
                    <span>Shift Cycles: {shv.cyclesThisShift}</span>
                    <span className="text-blue-300 font-bold">{shv.tonnageLoaded.toLocaleString()} Tons Loaded</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
