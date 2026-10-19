import React from 'react';
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle,
  Truck,
  Building2,
  TrendingUp,
  BarChart3,
  Layers,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { CorrectiveMaintenance, CorrectiveFilterState } from '../../types';

interface CorrectiveDashboardProps {
  records: CorrectiveMaintenance[];
  onSelectEquipmentFilter: (prefix: string) => void;
  onSelectSupplierFilter: (supplier: string) => void;
  onSelectFailureFilter: (failureType: string) => void;
  onOpenEquipmentHistory: (prefix: string) => void;
}

export const CorrectiveDashboard: React.FC<CorrectiveDashboardProps> = ({
  records,
  onSelectEquipmentFilter,
  onSelectSupplierFilter,
  onSelectFailureFilter,
  onOpenEquipmentHistory,
}) => {
  // 1. Executive Metrics
  const totalCorrectives = records.length;
  const uniqueEquipments = new Set(
    records.map((r) => (r.plate && r.plate.trim() !== '' ? r.plate.trim() : r.prefix)).filter(Boolean)
  ).size;
  const uniqueSuppliers = new Set(records.map((r) => r.supplier).filter(Boolean)).size;
  const totalStoppedDays = records.reduce((acc, r) => acc + (r.stoppedDays || 0), 0);
  const completedCount = records.filter((r) => r.status === 'Concluída').length;
  const analysisCount = records.filter((r) => r.status === 'Em Análise').length;
  const openCount = records.filter(
    (r) =>
      r.status === 'Aberta' ||
      r.status === 'Em Análise' ||
      r.status === 'Em manutenção' ||
      r.status === 'Aguardando peça' ||
      r.status === 'Aguardando fornecedor'
  ).length;

  // 2. Equipment Ranking (Machines that open most O.S.)
  const equipMap = new Map<
    string,
    {
      plate: string;
      prefix: string;
      equipmentType: string;
      supplier: string;
      osCount: number;
      stoppedDays: number;
      lastDate: string;
      topFailure: string;
      failureCounts: Record<string, number>;
    }
  >();

  records.forEach((r) => {
    const plt = (r.plate && r.plate.trim() !== '') ? r.plate.trim() : (r.prefix || 'Não inf.');
    if (!equipMap.has(plt)) {
      equipMap.set(plt, {
        plate: plt,
        prefix: r.prefix || '',
        equipmentType: r.equipmentType || '',
        supplier: r.supplier || '',
        osCount: 0,
        stoppedDays: 0,
        lastDate: r.openDate,
        topFailure: r.failureType || 'Outro',
        failureCounts: {},
      });
    }
    const item = equipMap.get(plt)!;
    item.osCount += 1;
    item.stoppedDays += r.stoppedDays || 0;
    if (r.openDate > item.lastDate) {
      item.lastDate = r.openDate;
    }
    const f = r.failureType || 'Outro';
    item.failureCounts[f] = (item.failureCounts[f] || 0) + 1;
  });

  // Calculate top failure per equipment
  equipMap.forEach((item) => {
    let bestF = 'Outro';
    let maxC = 0;
    for (const [f, c] of Object.entries(item.failureCounts)) {
      if (c > maxC) {
        maxC = c;
        bestF = f;
      }
    }
    item.topFailure = bestF;
  });

  const topEquipments = Array.from(equipMap.values())
    .sort((a, b) => b.osCount - a.osCount || b.stoppedDays - a.stoppedDays)
    .slice(0, 6);

  const maxEquipOsCount = topEquipments.length > 0 ? topEquipments[0].osCount : 1;

  // 3. Supplier Ranking
  const suppMap = new Map<
    string,
    {
      supplier: string;
      osCount: number;
      stoppedDays: number;
      equipments: Set<string>;
    }
  >();

  records.forEach((r) => {
    const supp = r.supplier || 'Não informado';
    if (!suppMap.has(supp)) {
      suppMap.set(supp, {
        supplier: supp,
        osCount: 0,
        stoppedDays: 0,
        equipments: new Set(),
      });
    }
    const item = suppMap.get(supp)!;
    item.osCount += 1;
    item.stoppedDays += r.stoppedDays || 0;
    item.equipments.add(r.prefix);
  });

  const topSuppliers = Array.from(suppMap.values())
    .sort((a, b) => b.osCount - a.osCount || b.stoppedDays - a.stoppedDays)
    .slice(0, 6);

  const maxSuppOsCount = topSuppliers.length > 0 ? topSuppliers[0].osCount : 1;

  // 4. Recurrence Analysis (Failure types)
  const failureStatsMap = new Map<string, { count: number; days: number }>();
  records.forEach((r) => {
    const f = r.failureType || 'Outro';
    if (!failureStatsMap.has(f)) {
      failureStatsMap.set(f, { count: 0, days: 0 });
    }
    const item = failureStatsMap.get(f)!;
    item.count += 1;
    item.days += r.stoppedDays || 0;
  });

  const topFailures = Array.from(failureStatsMap.entries())
    .map(([type, stats]) => ({
      type,
      count: stats.count,
      days: stats.days,
      pct: totalCorrectives > 0 ? (stats.count / totalCorrectives) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const maxFailureCount = topFailures.length > 0 ? topFailures[0].count : 1;

  // 5. Reincidência (Equipments with multiple failures)
  const reincidentEquipments = topEquipments.filter((e) => e.osCount >= 2);

  return (
    <div className="space-y-6 mb-8">
      {/* 6 Executive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total de Corretivas */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700">
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-900 dark:bg-slate-100" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total O.S.</span>
            <Wrench className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {totalCorrectives}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Todas as ocorrências</p>
        </div>

        {/* Equipamentos Afetados */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:border-cyan-300 dark:hover:border-cyan-800">
          <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-600" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Equipamentos</span>
            <Truck className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-400 font-mono">
            {uniqueEquipments}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Máquinas distintas</p>
        </div>

        {/* Fornecedores Envolvidos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:border-purple-300 dark:hover:border-purple-800">
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Fornecedores</span>
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 font-mono">
            {uniqueSuppliers}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Locadoras / Frota</p>
        </div>

        {/* Total de Dias Parados */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:border-rose-300 dark:hover:border-rose-800">
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-600" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Dias Parados</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
            {totalStoppedDays}
            <span className="text-xs font-normal text-slate-500 ml-1">dias</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Impacto acumulado</p>
        </div>

        {/* O.S. Concluídas */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:border-emerald-300 dark:hover:border-emerald-800">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Concluídas</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {completedCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {totalCorrectives > 0 ? `${((completedCount / totalCorrectives) * 100).toFixed(0)}% finalizadas` : '0%'}
          </p>
        </div>

        {/* O.S. Em Aberto */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:border-amber-300 dark:hover:border-amber-800">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Em Aberto</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
            {openCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {analysisCount > 0 ? `${analysisCount} em análise` : 'Em atendimento / peças'}
          </p>
        </div>
      </div>

      {/* Analytical Section: Rankings & Recurrence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: Equipamentos que Mais Abrem O.S. */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Equipamentos c/ Mais O.S.
                </h4>
                <p className="text-[11px] text-slate-400">Clique para filtrar ou ver histórico</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
              Top 6
            </span>
          </div>

          <div className="space-y-3">
            {topEquipments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhum registro encontrado.</p>
            ) : (
              topEquipments.map((eq, idx) => {
                const barWidth = `${Math.round((eq.osCount / maxEquipOsCount) * 100)}%`;
                const displayId = eq.plate || eq.prefix;
                return (
                  <div
                    key={displayId}
                    className="group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
                    onClick={() => onSelectEquipmentFilter(displayId)}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-[11px] font-bold text-slate-400">
                          {idx + 1}º
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {displayId}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate max-w-[130px]">
                          {eq.equipmentType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {eq.osCount} O.S.
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium">
                          {eq.stoppedDays}d
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: barWidth }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="truncate max-w-[140px]">Loc: {eq.supplier}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEquipmentHistory(displayId);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                      >
                        Ver Histórico <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Fornecedores que Mais Abrem O.S. */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Fornecedores c/ Mais O.S.
                </h4>
                <p className="text-[11px] text-slate-400">Clique para filtrar por fornecedor</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
              Ranking
            </span>
          </div>

          <div className="space-y-3">
            {topSuppliers.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhum registro encontrado.</p>
            ) : (
              topSuppliers.map((supp, idx) => {
                const barWidth = `${Math.round((supp.osCount / maxSuppOsCount) * 100)}%`;
                return (
                  <div
                    key={supp.supplier}
                    className="group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
                    onClick={() => onSelectSupplierFilter(supp.supplier)}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-[11px] font-bold text-slate-400">
                          {idx + 1}º
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 truncate max-w-[150px]">
                          {supp.supplier}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-purple-700 dark:text-purple-400 font-mono">
                          {supp.osCount} O.S.
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                          {supp.equipments.size} eq.
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
                      <div
                        className="bg-purple-600 dark:bg-purple-500 h-full rounded-full transition-all duration-500"
                        style={{ width: barWidth }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Total Parado: {supp.stoppedDays} dias</span>
                      <span className="text-purple-600 dark:text-purple-400 group-hover:underline">
                        Filtrar fornecedor →
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: Falhas Mais Recorrentes & Reincidência */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Falhas Mais Recorrentes
                  </h4>
                  <p className="text-[11px] text-slate-400">Distribuição por sistema da máquina</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
                Sistemas
              </span>
            </div>

            <div className="space-y-2.5">
              {topFailures.slice(0, 5).map((f) => {
                const barWidth = `${Math.round((f.count / maxFailureCount) * 100)}%`;
                return (
                  <div
                    key={f.type}
                    className="group cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    onClick={() => onSelectFailureFilter(f.type)}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                        {f.type}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {f.count}
                        </span>
                        <span className="text-[10px] text-slate-400">({f.pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-500"
                        style={{ width: barWidth }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reincidência Highlight Box */}
          {reincidentEquipments.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Reincidência de Falhas
                </span>
                <span className="text-[10px] text-slate-400">
                  {reincidentEquipments.length} máquinas c/ múltiplas O.S.
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {reincidentEquipments.map((eq) => {
                  const displayId = eq.plate || eq.prefix;
                  return (
                    <button
                      key={displayId}
                      type="button"
                      onClick={() => onOpenEquipmentHistory(displayId)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[11px] font-mono border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
                      title={`Ver histórico de ${displayId} (${eq.osCount} O.S., ${eq.stoppedDays} dias parados)`}
                    >
                      <span>{displayId}</span>
                      <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-1 rounded text-[10px] font-sans font-bold">
                        {eq.osCount}x
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
