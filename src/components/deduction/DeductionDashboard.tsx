import React, { useMemo } from 'react';
import {
  MeasurementDeduction,
  DeductionFilterState,
} from '../../types';
import {
  formatCurrencyBRL,
  STOPPAGE_REASONS,
  DEDUCTION_STATUSES,
} from '../../utils/deductionUtils';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Coins,
  DollarSign,
  Filter,
  RefreshCw,
  TrendingDown,
  X,
  PieChart as PieChartIcon,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Line,
  ComposedChart,
} from 'recharts';

interface DeductionDashboardProps {
  deductions: MeasurementDeduction[];
  filteredDeductions: MeasurementDeduction[];
  filters: DeductionFilterState;
  onFilterChange: (filters: DeductionFilterState) => void;
  onResetFilters: () => void;
  uniqueLocations: string[];
  uniqueSuppliers: string[];
  uniquePrefixes: string[];
  uniqueEquipmentTypes: string[];
}

const COLORS = [
  '#2563eb', // blue
  '#0d9488', // teal
  '#e11d48', // rose
  '#d97706', // amber
  '#7c3aed', // violet
  '#059669', // emerald
  '#db2777', // pink
  '#475569', // slate
  '#ca8a04', // yellow
  '#0284c7', // light blue
];

export const DeductionDashboard: React.FC<DeductionDashboardProps> = ({
  deductions,
  filteredDeductions,
  filters,
  onFilterChange,
  onResetFilters,
  uniqueLocations,
  uniqueSuppliers,
  uniquePrefixes,
  uniqueEquipmentTypes,
}) => {
  // 1. Calculations for KPIs
  const stats = useMemo(() => {
    const totalRecords = filteredDeductions.length;
    const ongoingRecords = filteredDeductions.filter((d) => d.isOngoing || d.status === 'PARADO');
    const uniqueEquipments = new Set(filteredDeductions.map((d) => d.prefix)).size;

    const totalDays = filteredDeductions.reduce((acc, d) => acc + (d.stoppedDays || 0), 0);
    const totalDailyRates = filteredDeductions.reduce((acc, d) => acc + (d.dailyRate || 0), 0);
    const totalDiscounts = filteredDeductions.reduce((acc, d) => acc + (d.discountValue || 0), 0);
    const totalMeasurement = filteredDeductions.reduce((acc, d) => acc + (d.measurementValue || 0), 0);

    const avgDays = totalRecords > 0 ? (totalDays / totalRecords).toFixed(1) : '0';
    const avgDailyRate = totalRecords > 0 ? totalDailyRates / totalRecords : 0;

    // Highest stoppage equipment
    const sortedByDays = [...filteredDeductions].sort((a, b) => (b.stoppedDays || 0) - (a.stoppedDays || 0));
    const topStopped = sortedByDays.length > 0 ? sortedByDays[0] : null;

    return {
      totalRecords,
      ongoingCount: ongoingRecords.length,
      uniqueEquipments,
      totalDays,
      totalDailyRates,
      avgDailyRate,
      totalDiscounts,
      totalMeasurement,
      avgDays,
      topStopped,
    };
  }, [filteredDeductions]);

  // 2. Chart 1: Dias Parados por Prefixo (Top 10)
  const chartDaysByPrefix = useMemo(() => {
    const prefixMap = new Map<string, { prefix: string; days: number; equipmentType: string }>();
    filteredDeductions.forEach((d) => {
      const p = d.prefix;
      if (!prefixMap.has(p)) {
        prefixMap.set(p, { prefix: p, days: 0, equipmentType: d.equipmentType });
      }
      prefixMap.get(p)!.days += d.stoppedDays || 0;
    });
    return Array.from(prefixMap.values())
      .sort((a, b) => b.days - a.days)
      .slice(0, 10);
  }, [filteredDeductions]);

  // 3. Chart 2: Valor de Desconto por Equipamento (Top 10)
  const chartDiscountByEquipment = useMemo(() => {
    const prefixMap = new Map<string, { prefix: string; discount: number; equipmentType: string }>();
    filteredDeductions.forEach((d) => {
      const p = d.prefix;
      if (!prefixMap.has(p)) {
        prefixMap.set(p, { prefix: p, discount: 0, equipmentType: d.equipmentType });
      }
      prefixMap.get(p)!.discount += d.discountValue || 0;
    });
    return Array.from(prefixMap.values())
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 10);
  }, [filteredDeductions]);

  // 4. Chart 3: Dias Parados por Fornecedor
  const chartDaysBySupplier = useMemo(() => {
    const suppMap = new Map<string, { name: string; days: number; discount: number }>();
    filteredDeductions.forEach((d) => {
      const s = d.supplier || 'Outro';
      if (!suppMap.has(s)) {
        suppMap.set(s, { name: s, days: 0, discount: 0 });
      }
      const curr = suppMap.get(s)!;
      curr.days += d.stoppedDays || 0;
      curr.discount += d.discountValue || 0;
    });
    return Array.from(suppMap.values())
      .sort((a, b) => b.days - a.days)
      .slice(0, 8);
  }, [filteredDeductions]);

  // 5. Chart 4: Motivos das Paralisações
  const chartReasons = useMemo(() => {
    const reasonMap = new Map<string, number>();
    filteredDeductions.forEach((d) => {
      const r = d.reason || 'Outros';
      reasonMap.set(r, (reasonMap.get(r) || 0) + 1);
    });
    return Array.from(reasonMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDeductions]);

  // 6. Chart 5: Evolução Mensal (Mês a Mês: Dias Parados e Valor dos Descontos)
  const chartMonthlyTrend = useMemo(() => {
    const monthsMap = new Map<string, { monthKey: string; monthLabel: string; days: number; discount: number; count: number }>();
    filteredDeductions.forEach((d) => {
      if (!d.startDate) return;
      const [year, month] = d.startDate.split('-');
      const monthKey = `${year}-${month}`;
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthLabel = `${monthNames[parseInt(month, 10) - 1]}/${year.slice(2)}`;

      if (!monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, { monthKey, monthLabel, days: 0, discount: 0, count: 0 });
      }
      const item = monthsMap.get(monthKey)!;
      item.days += d.stoppedDays || 0;
      item.discount += d.discountValue || 0;
      item.count += 1;
    });
    return Array.from(monthsMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredDeductions]);

  const hasActiveFilters = Boolean(
    filters.startDate ||
      filters.endDate ||
      filters.location ||
      filters.supplier ||
      filters.prefix ||
      filters.equipmentType ||
      filters.status ||
      filters.reason ||
      filters.searchTerm
  );

  return (
    <div id="deduction-dashboard-container" className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Equipamentos Parados */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Equipamentos Parados
            </span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-lg text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.uniqueEquipments}
            </span>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              ({stats.ongoingCount} em aberto)
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
            {stats.totalRecords} paralisações no período
          </p>
        </div>

        {/* Card 2: Total de Dias Parados */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Total Dias Parados
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.totalDays}
            </span>
            <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">dias</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
            Tempo acumulado de paralisação
          </p>
        </div>

        {/* Card 3: Valor Total das Diárias */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-sky-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Total das Diárias
            </span>
            <div className="p-2 bg-sky-50 dark:bg-sky-950/40 rounded-lg text-sky-600 dark:text-sky-400">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-slate-900 dark:text-white truncate block">
              {formatCurrencyBRL(stats.totalDailyRates)}
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
            Média: {formatCurrencyBRL(stats.avgDailyRate)}/dia
          </p>
        </div>

        {/* Card 4: VALOR TOTAL DE DESCONTOS (Destaque Principal) */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-white to-emerald-500/5 dark:from-emerald-950/30 dark:via-slate-900 dark:to-emerald-950/20 border-2 border-emerald-500/40 dark:border-emerald-500/30 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Total de Descontos
            </span>
            <div className="p-2 bg-emerald-500 text-white rounded-lg shadow-sm">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 truncate block">
              {formatCurrencyBRL(stats.totalDiscounts)}
            </span>
          </div>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-1 font-medium">
            Dedução a abater na medição
          </p>
        </div>

        {/* Card 5: Maior Tempo Parado */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Maior Tempo Parado
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-purple-600 dark:text-purple-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            {stats.topStopped ? (
              <>
                <span className="text-lg font-bold text-slate-900 dark:text-white truncate block">
                  {stats.topStopped.prefix} • {stats.topStopped.stoppedDays} dias
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 truncate mt-1">
                  {stats.topStopped.equipmentType} ({stats.topStopped.supplier})
                </p>
              </>
            ) : (
              <span className="text-sm text-slate-400">Nenhum registro</span>
            )}
          </div>
        </div>

        {/* Card 6: Média de Dias Parados */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Média de Dias
            </span>
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.avgDays}
            </span>
            <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">dias / paralisação</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
            Impacto médio por evento
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-sm">
            <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Filtros do Dashboard e Tabela</span>
            {hasActiveFilters && (
              <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full font-medium">
                Filtros ativos
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
          {/* Período De */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Período Até */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Obra */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Obra
            </label>
            <select
              value={filters.location}
              onChange={(e) => onFilterChange({ ...filters, location: e.target.value })}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas as Obras</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Fornecedor */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Fornecedor
            </label>
            <select
              value={filters.supplier}
              onChange={(e) => onFilterChange({ ...filters, supplier: e.target.value })}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Fornecedores</option>
              {uniqueSuppliers.map((supp) => (
                <option key={supp} value={supp}>
                  {supp}
                </option>
              ))}
            </select>
          </div>

          {/* Prefixo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Prefixo
            </label>
            <select
              value={filters.prefix}
              onChange={(e) => onFilterChange({ ...filters, prefix: e.target.value })}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Prefixos</option>
              {uniquePrefixes.map((pfx) => (
                <option key={pfx} value={pfx}>
                  {pfx}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Status</option>
              {DEDUCTION_STATUSES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Motivo da Paralisação */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Motivo
            </label>
            <select
              value={filters.reason}
              onChange={(e) => onFilterChange({ ...filters, reason: e.target.value })}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Motivos</option>
              {STOPPAGE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 5 Recharts Charts (Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Dias Parados por Prefixo */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Dias Parados por Prefixo (Top 10)
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Quantidade acumulada de dias de paralisação por equipamento
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            {chartDaysByPrefix.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDaysByPrefix} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="prefix"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-700">
                            <p className="font-bold">{data.prefix}</p>
                            <p className="text-slate-300">{data.equipmentType}</p>
                            <p className="text-amber-400 font-semibold mt-1">
                              Dias Parados: {data.days} dias
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="days" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Dias Parados" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado para exibir neste filtro
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Valor de Desconto por Equipamento */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Valor de Desconto por Equipamento (Top 10)
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Impacto financeiro apurado em Reais (R$)
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            {chartDiscountByEquipment.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDiscountByEquipment} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="prefix"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-700">
                            <p className="font-bold">{data.prefix}</p>
                            <p className="text-slate-300">{data.equipmentType}</p>
                            <p className="text-emerald-400 font-semibold mt-1">
                              Desconto: {formatCurrencyBRL(data.discount)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="discount" fill="#10b981" radius={[4, 4, 0, 0]} name="Desconto (R$)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado para exibir neste filtro
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 3: Dias Parados por Fornecedor */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                Dias Parados por Fornecedor
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Quantidade total de dias parados agrupada por fornecedor/locadora
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            {chartDaysBySupplier.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartDaysBySupplier}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    width={80}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-700">
                            <p className="font-bold">{data.name}</p>
                            <p className="text-amber-400 font-medium">Dias Parados: {data.days} dias</p>
                            <p className="text-emerald-400 font-medium">
                              Desconto Total: {formatCurrencyBRL(data.discount)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="days" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Dias Parados" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado para exibir
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 4: Motivos das Paralisações */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-rose-600" />
                Motivos das Paralisações
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Frequência de ocorrências por categoria de paralisação
              </p>
            </div>
          </div>
          <div className="h-64 w-full flex items-center">
            {chartReasons.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartReasons}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {chartReasons.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg border border-slate-700">
                            <p className="font-bold">{data.name}</p>
                            <p className="text-rose-400">{data.value} ocorrência(s)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado para exibir
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 5: Evolução Mensal (Full Width Span) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                Evolução Mensal (Dias Parados & Valor de Descontos)
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Acompanhamento temporal mês a mês dos dias parados e impacto monetário acumulado
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            {chartMonthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartMonthlyTrend} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    label={{ value: 'Dias Parados', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
                    label={{ value: 'Desconto (R$)', angle: 90, position: 'insideRight', fontSize: 10, fill: '#64748b' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-700">
                            <p className="font-bold">{data.monthLabel}</p>
                            <p className="text-blue-400">Dias Parados: {data.days} dias</p>
                            <p className="text-emerald-400 font-semibold">
                              Desconto: {formatCurrencyBRL(data.discount)}
                            </p>
                            <p className="text-slate-300">{data.count} registro(s)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar yAxisId="left" dataKey="days" fill="#eab308" radius={[4, 4, 0, 0]} name="Dias Parados" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="discount"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    name="Desconto Acumulado (R$)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado para exibir neste período
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
