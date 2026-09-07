import React, { useState } from 'react';
import { FileText, Search, Download, Filter, CheckCircle } from 'lucide-react';
import { TripLogEntry } from '../types';

interface TripLogsScreenProps {
  tripLogs: TripLogEntry[];
}

export const TripLogsScreen: React.FC<TripLogsScreenProps> = ({ tripLogs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [materialFilter, setMaterialFilter] = useState('ALL');

  const filteredLogs = tripLogs.filter((log) => {
    const matchesSearch =
      log.dumperId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.operator.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.sourceBench.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.destination.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMaterial =
      materialFilter === 'ALL' || log.material.toUpperCase().includes(materialFilter);
    return matchesSearch && matchesMaterial;
  });

  const handleExportCSV = () => {
    const headers = [
      'Log ID',
      'Dumper ID',
      'Operator',
      'Payload (Tons)',
      'Material',
      'Fe %',
      'Source Bench',
      'Destination',
      'Cycle Time (Min)',
      'Timestamp',
    ];
    const rows = filteredLogs.map((log) => [
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

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      headers.join(',') +
      '\n' +
      rows.map((e) => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NMDC_Bailadila_TripLogs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-3 select-none text-[#E0E0E0] pb-6 font-sans">
      {/* Header & Controls */}
      <div className="bg-[#0A0A0B] border border-[#262626] p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          <div className="flex flex-col">
            <span className="font-mono text-[12px] font-bold text-white uppercase tracking-wider">
              HAULAGE TRIP LOGS &amp; CYCLE AUDIT
            </span>
            <span className="font-mono text-[9px] text-[#888888]">
              AUTOMATIC TIPPING LOGS FROM SURFACE RIM CRUSHER &amp; WASTE DUMP
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap font-mono text-[10px]">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[#888888]" />
            <input
              type="text"
              placeholder="Search truck, operator, bench..."
              value={searchTerm}
              aria-label="Search haul trip logs"
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-black border border-[#333333] pl-7 pr-3 py-1 text-white font-mono text-[10px] focus:outline-hidden focus:border-blue-500 w-52"
            />
          </div>

          {/* Filter Material */}
          <select
            value={materialFilter}
            aria-label="Filter trip logs by material"
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="bg-black border border-[#333333] text-white px-2 py-1 font-mono text-[10px] focus:outline-hidden"
          >
            <option value="ALL">ALL MATERIALS</option>
            <option value="HIGH">HIGH-GRADE Fe</option>
            <option value="MEDIUM">MEDIUM-GRADE Fe</option>
            <option value="WASTE">WASTE ROCK</option>
          </select>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="bg-blue-600 hover:bg-blue-500 text-white font-mono text-[10px] font-bold py-1 px-3 border border-blue-400 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3 h-3" />
            EXPORT CSV
          </button>
        </div>
      </div>

      {/* Trip Log Table */}
      <div className="bg-[#0A0A0B] border border-[#262626] overflow-x-auto">
        <table className="w-full text-left font-mono text-[10px] border-collapse">
          <thead>
            <tr className="bg-[#0F0F10] border-b border-[#262626] text-[#888888]">
              <th className="p-2.5">LOG RECEIPT</th>
              <th className="p-2.5">HAUL UNIT</th>
              <th className="p-2.5">OPERATOR</th>
              <th className="p-2.5">PAYLOAD</th>
              <th className="p-2.5">ORE GRADE</th>
              <th className="p-2.5">SOURCE BENCH</th>
              <th className="p-2.5">DESTINATION</th>
              <th className="p-2.5">CYCLE TIME</th>
              <th className="p-2.5">TIME (IST)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#18181A]">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-[#111113] transition-colors">
                <td className="p-2.5 text-blue-400 font-bold">{log.id}</td>
                <td className="p-2.5 text-white font-bold">{log.dumperId}</td>
                <td className="p-2.5 text-[#E0E0E0]">{log.operator}</td>
                <td className="p-2.5 text-white">{log.payloadTons} T</td>
                <td className="p-2.5">
                  <span
                    className={`px-1.5 py-0.2 border text-[8.5px] font-bold ${
                      log.material.includes('High')
                        ? 'bg-blue-950 text-blue-300 border-blue-500'
                        : log.material.includes('Medium')
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                        : 'bg-orange-950 text-orange-300 border-orange-500'
                    }`}
                  >
                    {log.material} ({log.fePercentage}% Fe)
                  </span>
                </td>
                <td className="p-2.5 text-[#888888]">{log.sourceBench}</td>
                <td className="p-2.5 text-[#E0E0E0]">{log.destination}</td>
                <td className="p-2.5 text-yellow-400 font-bold">{log.cycleTimeMins} min</td>
                <td className="p-2.5 text-[#888888]">{log.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
