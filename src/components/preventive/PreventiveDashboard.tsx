import React from 'react';
import {
  PreventiveCalculation,
  PreventiveRecord,
  Equipment,
} from '../../types';
import { formatMetricWithUnit } from '../../utils/preventiveUtils';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Wrench,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface PreventiveDashboardProps {
  calculations: PreventiveCalculation[];
  records: PreventiveRecord[];
  equipments: Equipment[];
  onSelectEquipmentForDetail: (equipmentId: string) => void;
  onOpenRegisterModal: (equipment?: Equipment) => void;
  onOpenUpdateReadingModal: (equipment?: Equipment) => void;
}

const STATUS_COLORS = {
  EM_DIA: '#10b981', // emerald-500
  FAZER_REVISAO: '#20b4a7', // Makmo Teal #20b4a7
  PROXIMA: '#20b4a7', // Makmo Teal #20b4a7
  ATENCAO: '#f97316', // orange-500
  VENCIDA: '#f43f5e', // rose-500
};

export const PreventiveDashboard: React.FC<PreventiveDashboardProps> = ({
  calculations,
  records,
  equipments,
  onSelectEquipmentForDetail,
  onOpenRegisterModal,
  onOpenUpdateReadingModal,
}) => {
  // Counts by status
  const totalEquipments = equipments.length;
  const countEmDia = calculations.filter((c) => c.status === 'EM_DIA').length;
  const countFazerRevisao = calculations.filter(
    (c) => c.status === 'FAZER_REVISAO' || c.status === 'PROXIMA' || c.status === 'ATENCAO'
  ).length;
  const countVencida = calculations.filter((c) => c.status === 'VENCIDA').length;

  // Preventives executed this month
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
  const preventivesThisMonth = records.filter((r) => r.date.startsWith(currentMonthPrefix)).length;

  // Filter urgent & overdue lists for visual alerts
  const overdueItems = calculations
    .filter((c) => c.status === 'VENCIDA')
    .sort((a, b) => b.overdueValue - a.overdueValue);

  const attentionItems = calculations
    .filter((c) => c.status === 'FAZER_REVISAO' || c.status === 'ATENCAO' || c.status === 'PROXIMA')
    .sort((a, b) => a.remainingValue - b.remainingValue);

  // Status Distribution Chart Data
  const statusPieData = [
    { name: 'Em Dia', value: countEmDia, color: STATUS_COLORS.EM_DIA },
    { name: 'Fazer Revisão', value: countFazerRevisao, color: STATUS_COLORS.FAZER_REVISAO },
    { name: 'Vencida', value: countVencida, color: STATUS_COLORS.VENCIDA },
  ].filter((d) => d.value > 0);

  // Preventives by Location (Obra)
  const locationCounts: Record<string, { emDia: number; alerta: number; vencida: number }> = {};
  calculations.forEach((c) => {
    const loc = c.equipment.location || 'Sem Obra';
    if (!locationCounts[loc]) {
      locationCounts[loc] = { emDia: 0, alerta: 0, vencida: 0 };
    }
    if (c.status === 'EM_DIA') locationCounts[loc].emDia++;
    else if (c.status === 'VENCIDA') locationCounts[loc].vencida++;
    else locationCounts[loc].alerta++;
  });

  const locationData = Object.entries(locationCounts)
    .map(([loc, stats]) => ({
      location: loc,
      'Em Dia': stats.emDia,
      'Próxima/Atenção': stats.alerta,
      Vencida: stats.vencida,
      total: stats.emDia + stats.alerta + stats.vencida,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Preventives by Supplier
  const supplierCounts: Record<string, number> = {};
  calculations.forEach((c) => {
    const sup = c.equipment.supplier || 'NÃO INFORMADO';
    supplierCounts[sup] = (supplierCounts[sup] || 0) + 1;
  });

  const supplierData = Object.entries(supplierCounts)
    .map(([supplier, total]) => ({
      supplier: supplier.length > 14 ? supplier.slice(0, 14) + '...' : supplier,
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Distribution by Interval Type
  const intervalCounts: Record<string, number> = {};
  calculations.forEach((c) => {
    const intLabel = c.plan.intervalType || 'Outro';
    intervalCounts[intLabel] = (intervalCounts[intLabel] || 0) + 1;
  });

  const intervalData = Object.entries(intervalCounts)
    .map(([interval, total]) => ({
      interval,
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return (
    <div id="pcm-dashboard-container" className="space-y-4">
      {/* 1. VISUAL ALERT BANNERS (REQUIREMENT 13) */}
      {(overdueItems.length > 0 || attentionItems.length > 0) && (
        <div id="pcm-visual-alerts" className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* 🔴 PREVENTIVAS VENCIDAS */}
          <div
            id="pcm-alert-vencidas"
            className="bg-rose-950/20 border border-rose-500/40 rounded-xl p-3.5 sm:p-4 relative overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-rose-500/20">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <h3 className="font-bold text-sm sm:text-base text-rose-500 tracking-wide">
                  PREVENTIVAS VENCIDAS ({overdueItems.length})
                </h3>
              </div>
              <span className="text-[11px] font-medium text-rose-400/80 bg-rose-500/10 px-2 py-0.5 rounded">
                Ação Imediata PCM
              </span>
            </div>

            {overdueItems.length === 0 ? (
              <p className="text-xs text-rose-300/70 italic py-2">
                Nenhuma preventiva vencida no momento. Excelente controle de frota!
              </p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {overdueItems.slice(0, 4).map((item) => (
                  <div
                    key={item.equipmentId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg bg-rose-900/30 hover:bg-rose-900/50 border border-rose-500/30 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-xs bg-rose-500/30 text-rose-200 px-1.5 py-0.5 rounded border border-rose-500/40 shrink-0">
                        {item.equipmentCode}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-rose-100 truncate">
                          {item.equipment.type} - {item.equipment.brand || ''} {item.equipment.model || ''}
                        </p>
                        <p className="text-[11px] text-rose-300/80">
                          Obra: {item.equipment.location || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <span className="text-xs font-bold text-rose-300 font-mono">
                        Vencida em +{formatMetricWithUnit(item.overdueValue, item.unit)}
                      </span>
                      <button
                        onClick={() => onOpenRegisterModal(item.equipment)}
                        className="text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 text-white px-2 py-1 rounded transition-colors flex items-center gap-1 shadow-sm shrink-0"
                        title="Registrar Preventiva deste equipamento"
                      >
                        <Wrench className="w-3 h-3" />
                        Registrar
                      </button>
                    </div>
                  </div>
                ))}
                {overdueItems.length > 4 && (
                  <p className="text-center text-[11px] text-rose-400/90 pt-1">
                    + {overdueItems.length - 4} outros equipamentos vencidos listados na tabela
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 🟠 PRÓXIMAS / ATENÇÃO */}
          <div
            id="pcm-alert-atencao"
            className="bg-amber-950/20 border border-amber-500/40 rounded-xl p-3.5 sm:p-4 relative overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-amber-500/20">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                <h3 className="font-bold text-sm sm:text-base text-amber-500 tracking-wide">
                  PRÓXIMAS DA REVISÃO / ATENÇÃO ({attentionItems.length})
                </h3>
              </div>
              <span className="text-[11px] font-medium text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded">
                Programar Oficina
              </span>
            </div>

            {attentionItems.length === 0 ? (
              <p className="text-xs text-amber-300/70 italic py-2">
                Nenhum equipamento próximo da margem de alerta.
              </p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {attentionItems.slice(0, 4).map((item) => (
                  <div
                    key={item.equipmentId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg bg-amber-900/30 hover:bg-amber-900/50 border border-amber-500/30 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-xs bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded border border-amber-500/40 shrink-0">
                        {item.equipmentCode}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-amber-100 truncate">
                          {item.equipment.type} - {item.equipment.brand || ''} {item.equipment.model || ''}
                        </p>
                        <p className="text-[11px] text-amber-300/80">
                          {item.status === 'ATENCAO' ? '🟠 ATENÇÃO' : '🟡 PRÓXIMA'} • Obra:{' '}
                          {item.equipment.location || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <span className="text-xs font-bold text-amber-300 font-mono">
                        Faltam: {formatMetricWithUnit(item.remainingValue, item.unit)}
                      </span>
                      <button
                        onClick={() => onSelectEquipmentForDetail(item.equipmentId)}
                        className="text-[11px] font-semibold bg-amber-600/80 hover:bg-amber-600 text-white px-2 py-1 rounded transition-colors flex items-center gap-1 shrink-0"
                        title="Ver controle do equipamento"
                      >
                        Ver
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {attentionItems.length > 4 && (
                  <p className="text-center text-[11px] text-amber-400/90 pt-1">
                    + {attentionItems.length - 4} outros equipamentos em alerta
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. KPI METRIC CARDS (REQUIREMENT 12) */}
      <div id="pcm-kpi-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* Total Frota */}
        <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[#6b7280] dark:text-[#9ca3af] text-xs font-medium">
            <span>Total Máquinas</span>
            <Truck className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#111827] dark:text-white mt-1">
            {totalEquipments}
          </p>
          <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
            Base de dados ativa
          </span>
        </div>

        {/* Em Dia */}
        <div className="bg-white dark:bg-[#161f30] border border-emerald-500/30 dark:border-emerald-500/30 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            <span>🟢 Em Dia</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {countEmDia}
          </p>
          <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
            {totalEquipments > 0 ? Math.round((countEmDia / totalEquipments) * 100) : 0}% da frota
          </span>
        </div>

        {/* Fazer Revisão */}
        <div className="bg-white dark:bg-[#161f30] border border-amber-500/30 dark:border-amber-500/30 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-medium">
            <span>🟡 Fazer Revisão</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {countFazerRevisao}
          </p>
          <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
            ≤100h / ≤2.000km
          </span>
        </div>

        {/* Vencidas */}
        <div className="bg-white dark:bg-[#161f30] border border-rose-500/30 dark:border-rose-500/30 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-medium">
            <span>🔴 Vencidas</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {countVencida}
          </p>
          <span className="text-[10px] text-rose-500 font-semibold">
            {countVencida > 0 ? 'Parada necessária' : 'Nenhuma'}
          </span>
        </div>

        {/* Realizadas no Mês */}
        <div className="bg-white dark:bg-[#161f30] border border-blue-500/30 dark:border-blue-500/30 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-medium">
            <span>Feitas no Mês</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {preventivesThisMonth}
          </p>
          <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
            {records.length} no histórico geral
          </span>
        </div>
      </div>

      {/* 3. CHARTS GRID (REQUIREMENT 12) */}
      <div id="pcm-charts-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* Chart 1: Donut Status */}
        <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-xl p-3.5 shadow-xs flex flex-col">
          <h4 className="text-xs font-bold text-[#111827] dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Status Geral das Preventivas
          </h4>
          <div className="h-56 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} máquinas`, name]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend verticalAlign="bottom" height={32} iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Preventivas por Obra */}
        <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-xl p-3.5 shadow-xs flex flex-col">
          <h4 className="text-xs font-bold text-[#111827] dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Equipamentos por Obra / Local
          </h4>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="location" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend verticalAlign="bottom" height={32} iconSize={10} />
                <Bar dataKey="Em Dia" stackId="a" fill={STATUS_COLORS.EM_DIA} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Próxima/Atenção" stackId="a" fill={STATUS_COLORS.ATENCAO} />
                <Bar dataKey="Vencida" stackId="a" fill={STATUS_COLORS.VENCIDA} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Distribuição por Tipo de Intervalo */}
        <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-xl p-3.5 shadow-xs flex flex-col">
          <h4 className="text-xs font-bold text-[#111827] dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Distribuição por Intervalo
          </h4>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={intervalData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="interval" type="category" width={80} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: any) => [`${value} máquinas`, 'Total']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
