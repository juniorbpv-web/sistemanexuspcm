import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { DailyLog } from '../types';
import { formatDateBR, formatHours } from '../utils/storage';
import { TrendingUp, Wrench, Clock, Activity, Calendar } from 'lucide-react';

interface DailyHoursLineChartProps {
  logs: DailyLog[];
}

interface ChartDataPoint {
  key: string;
  label: string;
  fullDate: string;
  horasTrabalhadas: number;
  horasManutencao: number;
  count: number;
  equipments: string;
}

export const DailyHoursLineChart: React.FC<DailyHoursLineChartProps> = ({ logs }) => {
  const [viewMode, setViewMode] = useState<'daily' | 'individual'>('daily');

  // Prepare chart data based on selected view mode
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!logs || logs.length === 0) return [];

    if (viewMode === 'daily') {
      // Group by date
      const groupedMap = new Map<
        string,
        {
          worked: number;
          maintenance: number;
          count: number;
          equipments: Set<string>;
        }
      >();

      logs.forEach((log) => {
        const d = log.date || 'Sem Data';
        const current = groupedMap.get(d) || {
          worked: 0,
          maintenance: 0,
          count: 0,
          equipments: new Set<string>(),
        };

        current.worked += log.workedHours || 0;
        current.maintenance += log.maintenanceHours || 0;
        current.count += 1;
        if (log.equipmentCode) current.equipments.add(log.equipmentCode);

        groupedMap.set(d, current);
      });

      // Sort chronological by date key
      const sortedKeys = Array.from(groupedMap.keys()).sort((a, b) => a.localeCompare(b));

      return sortedKeys.map((dateStr) => {
        const item = groupedMap.get(dateStr)!;
        // Format date short e.g. "04/09"
        let shortLabel = dateStr;
        if (dateStr.includes('-')) {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            shortLabel = `${parts[2]}/${parts[1]}`;
          }
        }

        return {
          key: dateStr,
          label: shortLabel,
          fullDate: formatDateBR(dateStr),
          horasTrabalhadas: Number(item.worked.toFixed(1)),
          horasManutencao: Number(item.maintenance.toFixed(1)),
          count: item.count,
          equipments: Array.from(item.equipments).join(', '),
        };
      });
    } else {
      // Individual log items in sequence
      return logs.map((log, idx) => {
        let shortLabel = log.equipmentCode || `#${idx + 1}`;
        let datePart = log.date;
        if (log.date && log.date.includes('-')) {
          const parts = log.date.split('-');
          if (parts.length === 3) {
            datePart = `${parts[2]}/${parts[1]}`;
          }
        }

        return {
          key: log.id || `log-${idx}`,
          label: `${shortLabel} (${datePart})`,
          fullDate: `${formatDateBR(log.date)} • ${log.equipmentCode}`,
          horasTrabalhadas: Number((log.workedHours || 0).toFixed(1)),
          horasManutencao: Number((log.maintenanceHours || 0).toFixed(1)),
          count: 1,
          equipments: log.equipmentCode,
        };
      });
    }
  }, [logs, viewMode]);

  // Overall totals for badge cards
  const metrics = useMemo(() => {
    let totalWorked = 0;
    let totalMaint = 0;
    logs.forEach((l) => {
      totalWorked += l.workedHours || 0;
      totalMaint += l.maintenanceHours || 0;
    });

    const totalHours = totalWorked + totalMaint;
    const availabilityRate =
      totalHours > 0 ? Number(((totalWorked / totalHours) * 100).toFixed(1)) : 100;

    return {
      totalWorked: Number(totalWorked.toFixed(1)),
      totalMaint: Number(totalMaint.toFixed(1)),
      availabilityRate,
      pointsCount: chartData.length,
    };
  }, [logs, chartData]);

  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-4 border border-[#dcdfe4] dark:border-[#333333] shadow-xs text-center">
        <Activity className="w-8 h-8 mx-auto text-[#9ca3af] mb-2 stroke-[1.5]" />
        <h4 className="text-sm font-bold text-[#111827] dark:text-[#f3f4f6]">
          Gráfico de Horas Trabalhadas vs. Manutenção
        </h4>
        <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-1 max-w-md mx-auto">
          Nenhum apontamento registrado com os filtros atuais. Lance novos turnos na Parte Diária
          para visualizar a evolução gráfica em linha.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3 sm:p-4 border border-[#dcdfe4] dark:border-[#333333] shadow-xs space-y-3 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#eaecef] dark:border-[#262626]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-amber-500/10 text-amber-500">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-sm sm:text-base font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6]">
              Gráfico: Horas Trabalhadas vs. Manutenção
            </h3>
          </div>
          <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-0.5">
            Acompanhamento temporal da produtividade operacional contra horas paradas para reparos.
          </p>
        </div>

        {/* View toggle (Por Data vs Por Apontamento) */}
        <div className="flex items-center gap-1 self-start sm:self-auto bg-[#f1f3f5] dark:bg-[#262626] p-0.5 rounded border border-[#dcdfe4] dark:border-[#333333]">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
              viewMode === 'daily'
                ? 'bg-white dark:bg-[#121212] text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Por Data</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('individual')}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
              viewMode === 'individual'
                ? 'bg-white dark:bg-[#121212] text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Individual</span>
          </button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2 sm:p-2.5 rounded bg-amber-500/10 border border-amber-500/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 block">
            Horas Trabalhadas
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono-numbers text-base sm:text-lg font-bold text-amber-950 dark:text-amber-300">
              {formatHours(metrics.totalWorked)}
            </span>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">hrs</span>
          </div>
        </div>

        <div className="p-2 sm:p-2.5 rounded bg-rose-500/10 border border-rose-500/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400 block">
            Horas Manutenção
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono-numbers text-base sm:text-lg font-bold text-rose-950 dark:text-rose-300">
              {formatHours(metrics.totalMaint)}
            </span>
            <span className="text-[10px] text-rose-700 dark:text-rose-400 font-semibold">hrs</span>
          </div>
        </div>

        <div className="p-2 sm:p-2.5 rounded bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#9ca3af] block">
            Disponibilidade
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono-numbers text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.availabilityRate}%
            </span>
            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">operacional</span>
          </div>
        </div>

        <div className="p-2 sm:p-2.5 rounded bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#9ca3af] block">
            Pontos no Gráfico
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono-numbers text-base sm:text-lg font-bold text-[#111827] dark:text-[#f3f4f6]">
              {metrics.pointsCount}
            </span>
            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
              {viewMode === 'daily' ? 'dias' : 'registros'}
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Line Chart Container */}
      <div className="h-64 sm:h-72 w-full pt-2 min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-15" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#888888' }}
              tickLine={{ stroke: '#888888' }}
              axisLine={{ stroke: '#cccccc' }}
            />
            <YAxis
              unit="h"
              tick={{ fontSize: 11, fill: '#888888' }}
              tickLine={{ stroke: '#888888' }}
              axisLine={{ stroke: '#cccccc' }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as ChartDataPoint;
                  return (
                    <div className="bg-white dark:bg-[#1f1f1f] p-2.5 rounded-md border border-[#dcdfe4] dark:border-[#333333] shadow-md text-xs space-y-1">
                      <p className="font-bold text-[#111827] dark:text-[#f3f4f6] border-b border-[#eaecef] dark:border-[#2f2f2f] pb-1">
                        {data.fullDate}
                      </p>
                      <div className="flex items-center justify-between gap-4 text-amber-700 dark:text-amber-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Horas Trabalhadas:
                        </span>
                        <strong className="font-mono">{formatHours(data.horasTrabalhadas)} h</strong>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-rose-700 dark:text-rose-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          Horas Manutenção:
                        </span>
                        <strong className="font-mono">{formatHours(data.horasManutencao)} h</strong>
                      </div>
                      {data.count > 1 && (
                        <div className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] pt-0.5 border-t border-[#eaecef] dark:border-[#2f2f2f]">
                          {data.count} apontamentos • Frota: {data.equipments}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={32}
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }}
            />
            <Line
              type="monotone"
              dataKey="horasTrabalhadas"
              name="Horas Trabalhadas"
              stroke="#20b4a7"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#20b4a7', strokeWidth: 1.5, stroke: '#ffffff' }}
              activeDot={{ r: 6, fill: '#20b4a7' }}
            />
            <Line
              type="monotone"
              dataKey="horasManutencao"
              name="Horas Manutenção"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#ef4444', strokeWidth: 1.5, stroke: '#ffffff' }}
              activeDot={{ r: 6, fill: '#ef4444' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
