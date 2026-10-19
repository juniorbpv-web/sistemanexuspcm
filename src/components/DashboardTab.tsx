import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  Area,
} from 'recharts';
import {
  LayoutDashboard,
  Fuel,
  Clock,
  Gauge,
  Building2,
  TrendingUp,
  Download,
  FileDown,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Layers,
  Search,
  RotateCcw,
  Info,
  Loader2,
  Share2,
  X,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  DailyLog,
  Equipment,
  FuelDispense,
  FuelEntry,
  AppProject,
  UserRole,
  ActiveTab,
} from '../types';
import {
  downloadChartContainerAsPng,
  downloadChartContainerAsPdf,
  exportCombinedChartsSlidePng,
  exportDashboardToPDF,
} from '../utils/dashboardExportUtils';

interface DashboardTabProps {
  equipments: Equipment[];
  dailyLogs: DailyLog[];
  fuelDispenses: FuelDispense[];
  fuelEntries?: FuelEntry[];
  projects?: AppProject[];
  selectedProject?: string;
  userRole?: UserRole;
  onNavigateToTab?: (tab: ActiveTab) => void;
}

// Visual color palette
const COLORS = [
  '#f59e0b', // Amber (Diesel)
  '#3b82f6', // Blue (Hours)
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

export const DashboardTab: React.FC<DashboardTabProps> = ({
  equipments,
  dailyLogs,
  fuelDispenses,
  projects = [],
  selectedProject = 'all',
  onNavigateToTab,
}) => {
  // Filters State
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | 'this-month' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>(selectedProject || 'all');
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Export Loading States
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingSlidePng, setIsExportingSlidePng] = useState(false);
  const [exportingChartId, setExportingChartId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Equipment lookup map for fast identification
  const equipmentMap = useMemo(() => {
    const map = new Map<string, Equipment>();
    equipments.forEach((eq) => {
      map.set(eq.id, eq);
      if (eq.code) map.set(eq.code.trim().toUpperCase(), eq);
      if (eq.prefix) map.set(eq.prefix.trim().toUpperCase(), eq);
      if (eq.plate) map.set(eq.plate.trim().toUpperCase(), eq);
    });
    return map;
  }, [equipments]);

  // Obra normalization helper
  const resolveObra = (item: { location?: string; obra_id?: string; projectId?: string; equipmentCode?: string; equipmentId?: string }) => {
    if (item.location && item.location.trim()) {
      const loc = item.location.trim().toUpperCase();
      if (loc.includes('064') || loc.includes('063')) return 'OBRA 063/064';
      if (loc.includes('062') || loc.includes('PA')) return 'OBRA 062 - PA';
      return item.location.trim();
    }
    if (item.obra_id) return item.obra_id;
    if (item.projectId) return item.projectId;

    const lookupCode = (item.equipmentCode || item.equipmentId || '').trim().toUpperCase();
    const matched = equipmentMap.get(lookupCode);
    if (matched?.location) {
      const loc = matched.location.trim().toUpperCase();
      if (loc.includes('064') || loc.includes('063')) return 'OBRA 063/064';
      if (loc.includes('062') || loc.includes('PA')) return 'OBRA 062 - PA';
      return matched.location.trim();
    }
    return 'OBRA 063/064';
  };

  // Distinct equipment types list for filter dropdown
  const equipmentTypesList = useMemo(() => {
    const types = new Set<string>();
    equipments.forEach((e) => {
      if (e.type && e.type.trim()) types.add(e.type.trim().toUpperCase());
    });
    dailyLogs.forEach((l) => {
      if (l.equipmentType && l.equipmentType.trim()) types.add(l.equipmentType.trim().toUpperCase());
    });
    fuelDispenses.forEach((f) => {
      if (f.equipmentType && f.equipmentType.trim()) types.add(f.equipmentType.trim().toUpperCase());
    });
    return Array.from(types).sort();
  }, [equipments, dailyLogs, fuelDispenses]);

  // Distinct projects / obras list
  const availableObras = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.name) set.add(p.name);
    });
    dailyLogs.forEach((l) => set.add(resolveObra(l)));
    fuelDispenses.forEach((f) => set.add(resolveObra(f)));
    equipments.forEach((e) => set.add(resolveObra(e)));
    return Array.from(set).filter(Boolean).sort();
  }, [projects, dailyLogs, fuelDispenses, equipments]);

  // Calculate Date Bounds
  const dateBounds = useMemo(() => {
    const now = new Date();
    if (dateFilter === '7d') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      return { start: past.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
    }
    if (dateFilter === '30d') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      return { start: past.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
    }
    if (dateFilter === 'this-month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: firstDay.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
    }
    if (dateFilter === 'custom') {
      return { start: startDate, end: endDate };
    }
    return { start: '', end: '' };
  }, [dateFilter, startDate, endDate]);

  // Filtered Logs
  const filteredDailyLogs = useMemo(() => {
    return dailyLogs.filter((log) => {
      if (dateBounds.start && log.date < dateBounds.start) return false;
      if (dateBounds.end && log.date > dateBounds.end) return false;

      const obra = resolveObra(log);
      if (projectFilter !== 'all' && obra.toLowerCase() !== projectFilter.toLowerCase()) return false;

      if (equipmentTypeFilter !== 'all') {
        const eqType = (log.equipmentType || equipmentMap.get(log.equipmentCode?.toUpperCase())?.type || '').toUpperCase();
        if (eqType !== equipmentTypeFilter.toUpperCase()) return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const code = (log.equipmentCode || '').toLowerCase();
        const op = (log.operator || '').toLowerCase();
        const type = (log.equipmentType || '').toLowerCase();
        if (!code.includes(query) && !op.includes(query) && !type.includes(query) && !obra.toLowerCase().includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [dailyLogs, dateBounds, projectFilter, equipmentTypeFilter, searchTerm, equipmentMap]);

  // Filtered Fuel Dispenses
  const filteredDispenses = useMemo(() => {
    return fuelDispenses.filter((dispense) => {
      if (dateBounds.start && dispense.date < dateBounds.start) return false;
      if (dateBounds.end && dispense.date > dateBounds.end) return false;

      const obra = resolveObra(dispense);
      if (projectFilter !== 'all' && obra.toLowerCase() !== projectFilter.toLowerCase()) return false;

      if (equipmentTypeFilter !== 'all') {
        const eqType = (dispense.equipmentType || equipmentMap.get(dispense.equipmentCode?.toUpperCase())?.type || '').toUpperCase();
        if (eqType !== equipmentTypeFilter.toUpperCase()) return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const code = (dispense.equipmentCode || '').toLowerCase();
        const convoy = (dispense.convoyPlate || '').toLowerCase();
        const type = (dispense.equipmentType || '').toLowerCase();
        if (!code.includes(query) && !convoy.includes(query) && !type.includes(query) && !obra.toLowerCase().includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [fuelDispenses, dateBounds, projectFilter, equipmentTypeFilter, searchTerm, equipmentMap]);

  // Overall Global KPI Metrics
  const globalKpis = useMemo(() => {
    const totalHours = filteredDailyLogs.reduce((acc, log) => acc + (log.workedHours || 0), 0);
    const totalLiters = filteredDispenses.reduce((acc, d) => acc + (d.liters || 0), 0);
    const globalEfficiency = totalHours > 0 ? totalLiters / totalHours : 0;

    const activeEquipmentCodes = new Set<string>();
    filteredDailyLogs.forEach((l) => l.equipmentCode && activeEquipmentCodes.add(l.equipmentCode.toUpperCase()));
    filteredDispenses.forEach((d) => d.equipmentCode && activeEquipmentCodes.add(d.equipmentCode.toUpperCase()));

    const uniqueObras = new Set<string>();
    filteredDailyLogs.forEach((l) => uniqueObras.add(resolveObra(l)));
    filteredDispenses.forEach((d) => uniqueObras.add(resolveObra(d)));

    return {
      totalHours,
      totalLiters,
      globalEfficiency,
      activeMachines: activeEquipmentCodes.size,
      activeObrasCount: uniqueObras.size,
      totalDispensesCount: filteredDispenses.length,
      totalLogsCount: filteredDailyLogs.length,
    };
  }, [filteredDailyLogs, filteredDispenses]);

  // Aggregation by Obra (Project)
  const obraEfficiencyData = useMemo(() => {
    const obraMap = new Map<
      string,
      {
        obra: string;
        liters: number;
        workedHours: number;
        machines: Set<string>;
        logCount: number;
        dispenseCount: number;
      }
    >();

    filteredDailyLogs.forEach((log) => {
      const obra = resolveObra(log);
      const existing = obraMap.get(obra) || {
        obra,
        liters: 0,
        workedHours: 0,
        machines: new Set<string>(),
        logCount: 0,
        dispenseCount: 0,
      };
      existing.workedHours += log.workedHours || 0;
      existing.logCount += 1;
      if (log.equipmentCode) existing.machines.add(log.equipmentCode.toUpperCase());
      obraMap.set(obra, existing);
    });

    filteredDispenses.forEach((dispense) => {
      const obra = resolveObra(dispense);
      const existing = obraMap.get(obra) || {
        obra,
        liters: 0,
        workedHours: 0,
        machines: new Set<string>(),
        logCount: 0,
        dispenseCount: 0,
      };
      existing.liters += dispense.liters || 0;
      existing.dispenseCount += 1;
      if (dispense.equipmentCode) existing.machines.add(dispense.equipmentCode.toUpperCase());
      obraMap.set(obra, existing);
    });

    const totalLitersAll = globalKpis.totalLiters || 1;

    return Array.from(obraMap.values())
      .map((item) => {
        const efficiency = item.workedHours > 0 ? Number((item.liters / item.workedHours).toFixed(1)) : 0;
        const percentOfFuel = Number(((item.liters / totalLitersAll) * 100).toFixed(1));
        return {
          obra: item.obra,
          shortObra: item.obra.replace(/^OBRA\s+/i, ''),
          liters: Math.round(item.liters),
          workedHours: Number(item.workedHours.toFixed(1)),
          efficiency,
          activeMachines: item.machines.size,
          percentOfFuel,
          logCount: item.logCount,
          dispenseCount: item.dispenseCount,
        };
      })
      .sort((a, b) => b.liters - a.liters);
  }, [filteredDailyLogs, filteredDispenses, globalKpis.totalLiters]);

  // Timeline Trend Data
  const timelineData = useMemo(() => {
    const dateMap = new Map<
      string,
      {
        date: string;
        label: string;
        liters: number;
        hours: number;
      }
    >();

    filteredDailyLogs.forEach((l) => {
      if (!l.date) return;
      const cur = dateMap.get(l.date) || {
        date: l.date,
        label: l.date.split('-').reverse().slice(0, 2).join('/'),
        liters: 0,
        hours: 0,
      };
      cur.hours += l.workedHours || 0;
      dateMap.set(l.date, cur);
    });

    filteredDispenses.forEach((d) => {
      if (!d.date) return;
      const cur = dateMap.get(d.date) || {
        date: d.date,
        label: d.date.split('-').reverse().slice(0, 2).join('/'),
        liters: 0,
        hours: 0,
      };
      cur.liters += d.liters || 0;
      dateMap.set(d.date, cur);
    });

    return Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        liters: Math.round(item.liters),
        hours: Number(item.hours.toFixed(1)),
        efficiency: item.hours > 0 ? Number((item.liters / item.hours).toFixed(1)) : 0,
      }));
  }, [filteredDailyLogs, filteredDispenses]);

  // Breakdown by Equipment Category / Type
  const categoryData = useMemo(() => {
    const catMap = new Map<
      string,
      {
        category: string;
        liters: number;
        hours: number;
        machines: Set<string>;
      }
    >();

    filteredDailyLogs.forEach((l) => {
      const type = (l.equipmentType || equipmentMap.get(l.equipmentCode?.toUpperCase())?.type || 'OUTROS').toUpperCase();
      const cur = catMap.get(type) || {
        category: type,
        liters: 0,
        hours: 0,
        machines: new Set<string>(),
      };
      cur.hours += l.workedHours || 0;
      if (l.equipmentCode) cur.machines.add(l.equipmentCode.toUpperCase());
      catMap.set(type, cur);
    });

    filteredDispenses.forEach((d) => {
      const type = (d.equipmentType || equipmentMap.get(d.equipmentCode?.toUpperCase())?.type || 'OUTROS').toUpperCase();
      const cur = catMap.get(type) || {
        category: type,
        liters: 0,
        hours: 0,
        machines: new Set<string>(),
      };
      cur.liters += d.liters || 0;
      if (d.equipmentCode) cur.machines.add(d.equipmentCode.toUpperCase());
      catMap.set(type, cur);
    });

    return Array.from(catMap.values())
      .map((c) => ({
        category: c.category,
        shortCategory: c.category.length > 18 ? c.category.slice(0, 16) + '...' : c.category,
        liters: Math.round(c.liters),
        hours: Number(c.hours.toFixed(1)),
        efficiency: c.hours > 0 ? Number((c.liters / c.hours).toFixed(1)) : 0,
        machinesCount: c.machines.size,
      }))
      .filter((c) => c.liters > 0 || c.hours > 0)
      .sort((a, b) => b.liters - a.liters)
      .slice(0, 8);
  }, [filteredDailyLogs, filteredDispenses, equipmentMap]);

  // Top Equipment Ranking
  const topMachinesRanking = useMemo(() => {
    const machineMap = new Map<
      string,
      {
        code: string;
        type: string;
        obra: string;
        liters: number;
        hours: number;
      }
    >();

    filteredDailyLogs.forEach((l) => {
      if (!l.equipmentCode) return;
      const code = l.equipmentCode.toUpperCase();
      const eq = equipmentMap.get(code);
      const cur = machineMap.get(code) || {
        code,
        type: l.equipmentType || eq?.type || 'Equipamento',
        obra: resolveObra(l),
        liters: 0,
        hours: 0,
      };
      cur.hours += l.workedHours || 0;
      machineMap.set(code, cur);
    });

    filteredDispenses.forEach((d) => {
      if (!d.equipmentCode) return;
      const code = d.equipmentCode.toUpperCase();
      const eq = equipmentMap.get(code);
      const cur = machineMap.get(code) || {
        code,
        type: d.equipmentType || eq?.type || 'Equipamento',
        obra: resolveObra(d),
        liters: 0,
        hours: 0,
      };
      cur.liters += d.liters || 0;
      machineMap.set(code, cur);
    });

    const list = Array.from(machineMap.values()).map((m) => ({
      ...m,
      liters: Math.round(m.liters),
      hours: Number(m.hours.toFixed(1)),
      efficiency: m.hours > 0 ? Number((m.liters / m.hours).toFixed(1)) : 0,
    }));

    return {
      topHours: [...list].sort((a, b) => b.hours - a.hours).slice(0, 5),
      topLiters: [...list].sort((a, b) => b.liters - a.liters).slice(0, 5),
    };
  }, [filteredDailyLogs, filteredDispenses, equipmentMap]);

  // Reset Filters
  const handleResetFilters = () => {
    setDateFilter('all');
    setStartDate('');
    setEndDate('');
    setProjectFilter('all');
    setEquipmentTypeFilter('all');
    setSearchTerm('');
  };

  // Export Full Executive PDF Report
  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      const periodText =
        dateFilter === '7d'
          ? 'Últimos 7 dias'
          : dateFilter === '30d'
          ? 'Últimos 30 dias'
          : dateFilter === 'this-month'
          ? 'Mês Atual'
          : dateFilter === 'custom' && startDate && endDate
          ? `${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`
          : 'Todo o Período';

      await exportDashboardToPDF({
        kpis: globalKpis,
        obraData: obraEfficiencyData,
        periodLabel: periodText,
        obraFilterLabel: projectFilter === 'all' ? 'Todas as Obras' : projectFilter,
      });
      showToast('Relatório Executivo gerado e baixado em PDF com sucesso!');
    } catch (err) {
      console.error('Falha ao gerar relatório PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export Combined Charts Slide as 1920x1080 PNG (PowerPoint ready)
  const handleExportSlidePng = async () => {
    setIsExportingSlidePng(true);
    try {
      const periodText =
        dateFilter === '7d'
          ? 'Últimos 7 dias'
          : dateFilter === '30d'
          ? 'Últimos 30 dias'
          : dateFilter === 'this-month'
          ? 'Mês Atual'
          : dateFilter === 'custom' && startDate && endDate
          ? `${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`
          : 'Todo o Período';

      const success = await exportCombinedChartsSlidePng({
        kpis: globalKpis,
        periodLabel: periodText,
        obraFilterLabel: projectFilter === 'all' ? 'Todas as Obras' : projectFilter,
      });
      if (success) {
        showToast('Slide de gráficos exportado com sucesso em PNG (1920x1080)!');
      }
    } catch (err) {
      console.error('Falha ao gerar slide PNG:', err);
    } finally {
      setIsExportingSlidePng(false);
    }
  };

  // Export Individual Chart to High-Resolution PNG
  const handleExportChartPng = async (containerId: string, filename: string, title: string) => {
    setExportingChartId(containerId);
    try {
      const success = await downloadChartContainerAsPng(containerId, filename, title);
      if (success) {
        showToast('Gráfico exportado com sucesso como imagem PNG!');
      }
    } catch (err) {
      console.error(`Erro ao exportar gráfico ${containerId}:`, err);
    } finally {
      setExportingChartId(null);
    }
  };

  // Export Individual Chart to Presentation PDF
  const handleExportChartPdf = async (
    containerId: string,
    filename: string,
    title: string,
    subtitle?: string,
    badge?: string
  ) => {
    setExportingChartId(containerId + '-pdf');
    try {
      const success = await downloadChartContainerAsPdf(containerId, filename, title, subtitle, badge);
      if (success) {
        showToast('Gráfico exportado com sucesso como documento PDF!');
      }
    } catch (err) {
      console.error(`Erro ao exportar gráfico em PDF ${containerId}:`, err);
    } finally {
      setExportingChartId(null);
    }
  };

  // Export CSV summary
  const handleExportCSV = () => {
    const headers = [
      'Obra',
      'Horas Trabalhadas (h)',
      'Diesel Consumido (L)',
      'Eficiência (L/h)',
      'Máquinas Ativas',
      'Participação Combustível (%)',
    ];

    const rows = obraEfficiencyData.map((o) => [
      `"${o.obra}"`,
      o.workedHours.toFixed(1),
      o.liters,
      o.efficiency.toFixed(1),
      o.activeMachines,
      `${o.percentOfFuel}%`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `eficiencia_frota_obras_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Planilha de eficiência exportada em CSV com sucesso!');
  };

  return (
    <div className="space-y-4 pb-8 animate-fadeIn relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-2xl border border-indigo-500/50 text-xs font-semibold backdrop-blur-md animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner / Executive Title em Azul Marinho Corporativo Makmo */}
      <div className="bg-gradient-to-r from-[#0b1d3a] via-[#113861] to-[#0f294a] text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-[#1b4d82] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-[#113861] border border-[#1b4d82] rounded-xl text-white shadow-md shadow-[#0b1d3a]/40">
              <LayoutDashboard className="w-6 h-6 text-[#20b4a7]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-industrial">
                  Dashboard de Eficiência da Frota
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1b4d82] text-blue-100 border border-blue-400/30 uppercase tracking-wider">
                  Visão Consolidada
                </span>
              </div>
              <p className="text-xs text-blue-100/90 mt-0.5">
                Monitoramento integrado de consumo de combustível (Diesel) e horas trabalhadas por obra
              </p>
            </div>
          </div>

          {/* Export & Actions Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Botão Principal: Central de Exportação de Gráficos (PNG / PDF) */}
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#113861] hover:bg-[#0d2f54] text-white rounded-lg text-xs font-bold transition-all shadow-md border border-[#1b4d82] cursor-pointer"
              title="Abrir Central de Exportação dos Gráficos (PNG para apresentações de slides ou Relatório em PDF)"
            >
              <Share2 className="w-4 h-4 text-[#20b4a7]" />
              <span>Exportar Gráficos (PNG / PDF)</span>
            </button>

            {/* Atalho Rápido 1: Slide PNG 16:9 */}
            <button
              type="button"
              onClick={handleExportSlidePng}
              disabled={isExportingSlidePng}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Baixar imagem em alta resolução (1920x1080) com os gráficos pronta para slides do PowerPoint"
            >
              {isExportingSlidePng ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gerando Slide...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Slide PNG</span>
                </>
              )}
            </button>

            {/* Atalho Rápido 2: Relatório PDF Executivo */}
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Gerar e baixar Relatório Executivo completo em formato PDF (A4 Paisagem)"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Relatório PDF</span>
                </>
              )}
            </button>

            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('fuel-control')}
                className="inline-flex items-center gap-1 px-3 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
              >
                <Fuel className="w-3.5 h-3.5 text-amber-400" />
                <span>Gestão Combustível</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Central de Exportação de Gráficos e Relatórios */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                    Central de Exportação de Gráficos & Relatórios
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecione o formato ideal para apresentações em slides, documentos internos ou reuniões
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4">
              {/* Option 1: Slide PNG 16:9 */}
              <div className="p-4 rounded-xl border-2 border-indigo-500/30 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 hover:border-indigo-500 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-amber-500 text-slate-950">
                        <ImageIcon className="w-4 h-4" />
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        Slide Executivo em Imagem PNG (1920x1080)
                      </h4>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                        Ideal para Slides
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Gera uma imagem panorâmica de alta resolução com cabeçalho corporativo Makmo, KPIs de frota, gráfico de consumo vs horas e gráfico de pizza de distribuição de diesel.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleExportSlidePng();
                      setIsExportModalOpen(false);
                    }}
                    disabled={isExportingSlidePng}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
                  >
                    {isExportingSlidePng ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Baixar Imagem (PNG)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Option 2: Full PDF Report */}
              <div className="p-4 rounded-xl border border-rose-500/30 dark:border-rose-500/20 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-500 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-rose-600 text-white">
                        <FileDown className="w-4 h-4" />
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        Relatório Executivo Completo em PDF (A4 Paisagem)
                      </h4>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30">
                        Oficial
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Documento formal completo com cabeçalho corporativo, cartões de KPIs, gráficos renderizados e tabela consolidada de eficiência detalhada por obra.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleExportPDF();
                      setIsExportModalOpen(false);
                    }}
                    disabled={isExportingPdf}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
                  >
                    {isExportingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Baixar Relatório (PDF)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Option 3: Individual Charts Exports */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Download de Gráficos Individuais
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Chart Item 1 */}
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        Consumo vs Horas por Obra
                      </p>
                      <p className="text-[11px] text-slate-500">Gráfico de barras comparativo</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleExportChartPng(
                            'dashboard-bar-chart-container',
                            'grafico_consumo_horas_obras',
                            'Consumo de Combustível vs Horas por Obra'
                          )
                        }
                        className="px-2 py-1 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 transition-colors"
                      >
                        PNG
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleExportChartPdf(
                            'dashboard-bar-chart-container',
                            'relatorio_consumo_horas_obras',
                            'CONSUMO DE COMBUSTÍVEL VS HORAS TRABALHADAS POR OBRA',
                            'Comparativo direto de diesel consumido (Litros) e esforço de frota (Horas)'
                          )
                        }
                        className="px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                      >
                        PDF
                      </button>
                    </div>
                  </div>

                  {/* Chart Item 2 */}
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        Distribuição de Diesel
                      </p>
                      <p className="text-[11px] text-slate-500">Gráfico de pizza / donut por obra</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleExportChartPng(
                            'dashboard-pie-chart-container',
                            'grafico_distribuicao_diesel_obras',
                            'Distribuição de Diesel por Obra'
                          )
                        }
                        className="px-2 py-1 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 transition-colors"
                      >
                        PNG
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleExportChartPdf(
                            'dashboard-pie-chart-container',
                            'relatorio_distribuicao_diesel_obras',
                            'DISTRIBUIÇÃO PERCENTUAL DE DIESEL POR OBRA',
                            'Proporção de litros consumidos em cada frente de serviço'
                          )
                        }
                        className="px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                      >
                        PDF
                      </button>
                    </div>
                  </div>

                  {/* Chart Item 3 */}
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        Evolução Temporal Diária
                      </p>
                      <p className="text-[11px] text-slate-500">Linha de tendência temporal</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleExportChartPng(
                            'dashboard-timeline-chart-container',
                            'grafico_evolucao_temporal_frota',
                            'Evolução Diária de Consumo e Horas'
                          )
                        }
                        className="px-2 py-1 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 transition-colors"
                      >
                        PNG
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleExportChartPdf(
                            'dashboard-timeline-chart-container',
                            'relatorio_evolucao_temporal_frota',
                            'EVOLUÇÃO TEMPORAL: CONSUMO E HORAS DIÁRIAS',
                            'Acompanhamento diário para detecção de picos de consumo ou paralisações'
                          )
                        }
                        className="px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                      >
                        PDF
                      </button>
                    </div>
                  </div>

                  {/* Chart Item 4 */}
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        Eficiência por Categoria
                      </p>
                      <p className="text-[11px] text-slate-500">Média L/h por tipo de máquina</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleExportChartPng(
                            'dashboard-category-chart-container',
                            'grafico_eficiencia_categorias_maquinas',
                            'Eficiência por Categoria de Máquina'
                          )
                        }
                        className="px-2 py-1 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 transition-colors"
                      >
                        PNG
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleExportChartPdf(
                            'dashboard-category-chart-container',
                            'relatorio_eficiencia_categorias_maquinas',
                            'EFICIÊNCIA POR CATEGORIA DE MÁQUINA (L/H)',
                            'Consumo por hora trabalhada discriminado por tipo de equipamento'
                          )
                        }
                        className="px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                      >
                        PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Makmo Infraestrutura • Todos os arquivos são formatados em alta definição.
              </span>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[160px] sm:min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar máquina, operador..."
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Period Filter Buttons */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                onClick={() => setDateFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  dateFilter === 'all'
                    ? 'bg-[#113861] text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tudo
              </button>
              <button
                onClick={() => setDateFilter('this-month')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  dateFilter === 'this-month'
                    ? 'bg-[#113861] text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Mês Atual
              </button>
              <button
                onClick={() => setDateFilter('30d')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  dateFilter === '30d'
                    ? 'bg-[#113861] text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                30 Dias
              </button>
              <button
                onClick={() => setDateFilter('7d')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  dateFilter === '7d'
                    ? 'bg-[#113861] text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                7 Dias
              </button>
              <button
                onClick={() => setDateFilter('custom')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  dateFilter === 'custom'
                    ? 'bg-[#113861] text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Datas
              </button>
            </div>

            {/* Custom Dates Inputs */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-1.5 animate-fadeIn">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                />
                <span className="text-slate-400 text-xs">até</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                />
              </div>
            )}

            {/* Obra Select */}
            <div className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium"
              >
                <option value="all">Todas as Obras</option>
                {availableObras.map((ob) => (
                  <option key={ob} value={ob}>
                    {ob}
                  </option>
                ))}
              </select>
            </div>

            {/* Equipment Type Select */}
            <div className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={equipmentTypeFilter}
                onChange={(e) => setEquipmentTypeFilter(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium max-w-[180px]"
              >
                <option value="all">Todos os Tipos</option>
                {equipmentTypesList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset Filters */}
          {(dateFilter !== 'all' || projectFilter !== 'all' || equipmentTypeFilter !== 'all' || searchTerm) && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Total Combustível */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Fuel className="w-16 h-16 text-amber-500" />
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Fuel className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Diesel Consumido
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-slate-50">
              {globalKpis.totalLiters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Litros</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{globalKpis.totalDispensesCount} abastecimentos</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {obraEfficiencyData.length} obras ativas
            </span>
          </div>
        </div>

        {/* KPI 2: Total Horas Trabalhadas */}
        <div className="bg-white dark:bg-white border border-slate-200 dark:border-slate-200 p-4 rounded-xl shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Clock className="w-16 h-16 text-[#113861]" />
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 rounded-lg bg-[#113861]/10 text-[#113861]">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Horas Trabalhadas
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#0b1d3a]">
              {globalKpis.totalHours.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-bold text-[#113861]">Horas</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{globalKpis.totalLogsCount} partes diárias</span>
            <span className="font-semibold text-slate-700">
              {globalKpis.activeMachines} máquinas
            </span>
          </div>
        </div>

        {/* KPI 3: Eficiência Global L/h */}
        <div className="bg-white dark:bg-white border border-slate-200 dark:border-slate-200 p-4 rounded-xl shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Gauge className="w-16 h-16 text-emerald-500" />
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600">
              <Gauge className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Eficiência Global
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#0b1d3a]">
              {globalKpis.globalEfficiency.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-bold text-emerald-600">L / Hora</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Índice de Consumo Médio</span>
            <span className="font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[10px]">
              {globalKpis.globalEfficiency > 0 ? 'Monitorado' : 'Sem Dados'}
            </span>
          </div>
        </div>

        {/* KPI 4: Máquinas em Operação */}
        <div className="bg-white dark:bg-white border border-slate-200 dark:border-slate-200 p-4 rounded-xl shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Truck className="w-16 h-16 text-[#113861]" />
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 rounded-lg bg-[#113861]/10 text-[#113861]">
              <Truck className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Frota Operacional
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#0b1d3a]">
              {globalKpis.activeMachines}
            </span>
            <span className="text-xs font-bold text-[#113861]">
              de {equipments.length} cadastradas
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              {equipments.length > 0 ? Math.round((globalKpis.activeMachines / equipments.length) * 100) : 0}% de mobilização
            </span>
            <span className="font-semibold text-slate-700">
              {globalKpis.activeObrasCount} obras
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Row 1: Consumo e Horas por Obra & Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico 1: Consumo Total de Combustível e Horas Trabalhadas por Obra */}
        <div className="lg:col-span-2 bg-white dark:bg-white border border-slate-200 dark:border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0b1d3a] flex items-center gap-2 font-industrial">
                  <BarChart className="w-4 h-4 text-[#113861]" />
                  Consumo de Combustível vs Horas Trabalhadas por Obra
                </h3>
                <p className="text-xs text-slate-500">
                  Comparativo direto de diesel consumido (Litros) e esforço de máquina (Horas)
                </p>
              </div>

              {/* Ações de Exportação do Gráfico 1 (PNG / PDF) */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    handleExportChartPng(
                      'dashboard-bar-chart-container',
                      'grafico_consumo_horas_obras',
                      'Makmo Infraestrutura • Consumo de Combustível vs Horas por Obra'
                    )
                  }
                  disabled={exportingChartId === 'dashboard-bar-chart-container'}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
                  title="Exportar este gráfico como imagem PNG para apresentações"
                >
                  {exportingChartId === 'dashboard-bar-chart-container' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                  )}
                  <span>PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleExportChartPdf(
                      'dashboard-bar-chart-container',
                      'relatorio_consumo_horas_obras',
                      'CONSUMO DE COMBUSTÍVEL VS HORAS TRABALHADAS POR OBRA',
                      'Comparativo direto de diesel consumido (Litros) e esforço de frota (Horas)'
                    )
                  }
                  disabled={exportingChartId === 'dashboard-bar-chart-container-pdf'}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
                  title="Exportar este gráfico como documento PDF"
                >
                  {exportingChartId === 'dashboard-bar-chart-container-pdf' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5 text-rose-500" />
                  )}
                  <span>PDF</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">Diesel (L)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-blue-500 inline-block" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">Horas (h)</span>
              </div>
            </div>
          </div>

          {obraEfficiencyData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              <Info className="w-6 h-6 mb-1 text-slate-300" />
              Nenhum dado encontrado para os filtros selecionados.
            </div>
          ) : (
            <div id="dashboard-bar-chart-container" className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={obraEfficiencyData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="shortObra"
                    angle={-15}
                    textAnchor="end"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#20b4a7"
                    tick={{ fontSize: 10, fill: '#20b4a7' }}
                    tickFormatter={(val) => `${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}L`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#3b82f6"
                    tick={{ fontSize: 10, fill: '#3b82f6' }}
                    tickFormatter={(val) => `${val}h`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1 z-50">
                          <p className="font-bold text-[#20b4a7]">{item.obra}</p>
                          <p className="flex justify-between gap-4 text-slate-300">
                            <span>Diesel Consumido:</span>
                            <span className="font-bold font-mono text-white">
                              {item.liters.toLocaleString('pt-BR')} L
                            </span>
                          </p>
                          <p className="flex justify-between gap-4 text-slate-300">
                            <span>Horas Trabalhadas:</span>
                            <span className="font-bold font-mono text-white">
                              {item.workedHours.toLocaleString('pt-BR')} h
                            </span>
                          </p>
                          <p className="flex justify-between gap-4 text-emerald-400 border-t border-slate-800 pt-1 font-semibold">
                            <span>Índice Eficiência:</span>
                            <span className="font-bold font-mono">{item.efficiency} L/h</span>
                          </p>
                          <p className="flex justify-between gap-4 text-slate-400 text-[10px]">
                            <span>Máquinas Ativas:</span>
                            <span>{item.activeMachines}</span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="liters"
                    name="Diesel (L)"
                    fill="#20b4a7"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="workedHours"
                    name="Horas Trabalhadas (h)"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Gráfico 2: Participação do Combustível por Obra (Donut) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-[#0b1d3a] flex items-center gap-2 font-industrial">
                <PieChart className="w-4 h-4 text-amber-500" />
                Distribuição de Diesel por Obra
              </h3>

              {/* Ações de Exportação do Gráfico 2 (PNG / PDF) */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    handleExportChartPng(
                      'dashboard-pie-chart-container',
                      'grafico_distribuicao_diesel_obras',
                      'Makmo Infraestrutura • Distribuição de Diesel por Obra'
                    )
                  }
                  disabled={exportingChartId === 'dashboard-pie-chart-container'}
                  className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                  title="Salvar gráfico em imagem PNG"
                >
                  {exportingChartId === 'dashboard-pie-chart-container' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ImageIcon className="w-3 h-3 text-amber-500" />
                  )}
                  <span>PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleExportChartPdf(
                      'dashboard-pie-chart-container',
                      'relatorio_distribuicao_diesel_obras',
                      'DISTRIBUIÇÃO PERCENTUAL DE DIESEL POR OBRA',
                      'Proporção de litros consumidos em cada frente de serviço'
                    )
                  }
                  disabled={exportingChartId === 'dashboard-pie-chart-container-pdf'}
                  className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                  title="Salvar gráfico em documento PDF"
                >
                  {exportingChartId === 'dashboard-pie-chart-container-pdf' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FileDown className="w-3 h-3 text-rose-500" />
                  )}
                  <span>PDF</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Proporção de litros consumidos em cada frente de serviço
            </p>
          </div>

          {obraEfficiencyData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-400 text-xs">
              Sem dados para distribuição
            </div>
          ) : (
            <div id="dashboard-pie-chart-container" className="h-56 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={obraEfficiencyData}
                    dataKey="liters"
                    nameKey="shortObra"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {obraEfficiencyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any, item: any) => [
                      `${Number(value).toLocaleString('pt-BR')} L (${item.payload.percentOfFuel}%)`,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: '1px solid #1e293b',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Total</span>
                <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-slate-100">
                  {globalKpis.totalLiters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}L
                </span>
              </div>
            </div>
          )}

          {/* Obra Legend Pills */}
          <div className="mt-2 flex flex-wrap gap-1.5 justify-center max-h-24 overflow-y-auto">
            {obraEfficiencyData.slice(0, 5).map((o, idx) => (
              <span
                key={o.obra}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="text-slate-700 dark:text-slate-300 truncate max-w-[90px]">
                  {o.shortObra}
                </span>
                <span className="font-mono text-slate-500 font-bold">{o.percentOfFuel}%</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Charts Row 2: Evolução Temporal & Eficiência por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico 3: Evolução Temporal (Consumo e Horas ao Longo do Tempo) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0b1d3a] flex items-center gap-2 font-industrial">
                <TrendingUp className="w-4 h-4 text-[#113861]" />
                Evolução Temporal: Consumo e Horas Diárias
              </h3>
              <p className="text-xs text-slate-500">
                Acompanhamento diário para detecção de picos de consumo ou paralisações
              </p>
            </div>

            {/* Ações de Exportação do Gráfico 3 (PNG / PDF) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  handleExportChartPng(
                    'dashboard-timeline-chart-container',
                    'grafico_evolucao_temporal_frota',
                    'Makmo Infraestrutura • Evolução Diária de Consumo e Horas'
                  )
                }
                disabled={exportingChartId === 'dashboard-timeline-chart-container'}
                className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                title="Salvar gráfico temporal em imagem PNG"
              >
                {exportingChartId === 'dashboard-timeline-chart-container' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ImageIcon className="w-3 h-3 text-emerald-500" />
                )}
                <span>PNG</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleExportChartPdf(
                    'dashboard-timeline-chart-container',
                    'relatorio_evolucao_temporal_frota',
                    'EVOLUÇÃO TEMPORAL: CONSUMO E HORAS DIÁRIAS',
                    'Acompanhamento diário para detecção de picos de consumo ou paralisações'
                  )
                }
                disabled={exportingChartId === 'dashboard-timeline-chart-container-pdf'}
                className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                title="Salvar gráfico temporal em documento PDF"
              >
                {exportingChartId === 'dashboard-timeline-chart-container-pdf' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileDown className="w-3 h-3 text-rose-500" />
                )}
                <span>PDF</span>
              </button>
            </div>
          </div>

          {timelineData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-slate-400 text-xs">
              Nenhum dado temporal encontrado
            </div>
          ) : (
            <div id="dashboard-timeline-chart-container" className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timelineData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis
                    yAxisId="liters"
                    stroke="#20b4a7"
                    tick={{ fontSize: 10, fill: '#20b4a7' }}
                    tickFormatter={(val) => `${val}L`}
                  />
                  <YAxis
                    yAxisId="hours"
                    orientation="right"
                    stroke="#3b82f6"
                    tick={{ fontSize: 10, fill: '#3b82f6' }}
                    tickFormatter={(val) => `${val}h`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: '1px solid #1e293b',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    yAxisId="liters"
                    type="monotone"
                    dataKey="liters"
                    name="Diesel (L)"
                    fill="#20b4a7"
                    stroke="#20b4a7"
                    fillOpacity={0.15}
                  />
                  <Line
                    yAxisId="hours"
                    type="monotone"
                    dataKey="hours"
                    name="Horas Trabalhadas (h)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Gráfico 4: Eficiência por Categoria de Equipamento */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0b1d3a] flex items-center gap-2 font-industrial">
                <Layers className="w-4 h-4 text-[#113861]" />
                Eficiência por Categoria de Máquina (L/h)
              </h3>
              <p className="text-xs text-slate-500">
                Consumo por hora trabalhada discriminado por tipo de equipamento
              </p>
            </div>

            {/* Ações de Exportação do Gráfico 4 (PNG / PDF) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  handleExportChartPng(
                    'dashboard-category-chart-container',
                    'grafico_eficiencia_categorias_maquinas',
                    'Makmo Infraestrutura • Eficiência por Categoria de Máquina'
                  )
                }
                disabled={exportingChartId === 'dashboard-category-chart-container'}
                className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                title="Salvar gráfico de categorias em imagem PNG"
              >
                {exportingChartId === 'dashboard-category-chart-container' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ImageIcon className="w-3 h-3 text-violet-500" />
                )}
                <span>PNG</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleExportChartPdf(
                    'dashboard-category-chart-container',
                    'relatorio_eficiencia_categorias_maquinas',
                    'EFICIÊNCIA POR CATEGORIA DE MÁQUINA (L/H)',
                    'Consumo por hora trabalhada discriminado por tipo de equipamento'
                  )
                }
                disabled={exportingChartId === 'dashboard-category-chart-container-pdf'}
                className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                title="Salvar gráfico de categorias em documento PDF"
              >
                {exportingChartId === 'dashboard-category-chart-container-pdf' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileDown className="w-3 h-3 text-rose-500" />
                )}
                <span>PDF</span>
              </button>
            </div>
          </div>

          {categoryData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-slate-400 text-xs">
              Nenhuma categoria com apontamentos
            </div>
          ) : (
            <div id="dashboard-category-chart-container" className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} unit=" L/h" />
                  <YAxis
                    dataKey="shortCategory"
                    type="category"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    width={110}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const c = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-lg border border-slate-800 text-xs space-y-1">
                          <p className="font-bold text-violet-400">{c.category}</p>
                          <p className="flex justify-between gap-3 text-slate-300">
                            <span>Eficiência Média:</span>
                            <span className="font-bold font-mono text-emerald-400">{c.efficiency} L/h</span>
                          </p>
                          <p className="flex justify-between gap-3 text-slate-300">
                            <span>Consumo Total:</span>
                            <span className="font-mono">{c.liters.toLocaleString('pt-BR')} L</span>
                          </p>
                          <p className="flex justify-between gap-3 text-slate-300">
                            <span>Horas Totais:</span>
                            <span className="font-mono">{c.hours.toLocaleString('pt-BR')} h</span>
                          </p>
                          <p className="flex justify-between gap-3 text-slate-400 text-[10px]">
                            <span>Máquinas na Categoria:</span>
                            <span>{c.machinesCount}</span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="efficiency" name="Índice L/h" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-cat-${index}`}
                        fill={entry.efficiency > 28 ? '#f43f5e' : entry.efficiency > 18 ? '#f59e0b' : '#10b981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Consolidated Table: Eficiência Detalhada por Obra */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#0b1d3a] flex items-center gap-2 font-industrial">
              <Building2 className="w-4 h-4 text-[#113861]" />
              Tabela Consolidada de Eficiência por Obra
            </h3>
            <p className="text-xs text-slate-500">
              Métricas auditadas de combustível, horas e índice de produtividade por frente de obra
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#113861] hover:bg-[#0b1d3a] text-white transition-colors cursor-pointer shadow-xs border border-[#1b4d82]"
            >
              <Download className="w-3.5 h-3.5 text-[#20b4a7]" />
              <span>Exportar Dados</span>
            </button>
            <span className="text-xs font-semibold text-slate-500">
              {obraEfficiencyData.length} obras identificadas
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#113861] text-white border-b border-[#0b1d3a] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3 font-bold">Obra / Frente</th>
                <th className="py-2.5 px-3 text-right font-bold">Horas Trabalhadas</th>
                <th className="py-2.5 px-3 text-right font-bold">Diesel Consumido</th>
                <th className="py-2.5 px-3 text-right font-bold">Eficiência (L/h)</th>
                <th className="py-2.5 px-3 text-center font-bold">Máquinas Ativas</th>
                <th className="py-2.5 px-3 text-center font-bold">Part. Diesel</th>
                <th className="py-2.5 px-3 text-center font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {obraEfficiencyData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Nenhum registro encontrado para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                obraEfficiencyData.map((row) => {
                  const isHighConsumption = row.efficiency > 26;
                  const isOptimal = row.efficiency > 0 && row.efficiency <= 18;
                  return (
                    <tr
                      key={row.obra}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{row.obra}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {row.workedHours.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} h
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        {row.liters.toLocaleString('pt-BR')} L
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-slate-50">
                        {row.efficiency > 0 ? `${row.efficiency.toFixed(1)} L/h` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {row.activeMachines} máq.
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {row.percentOfFuel}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {row.efficiency === 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Sem Leitura
                          </span>
                        ) : isOptimal ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center gap-1 mx-auto w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            Ótimo
                          </span>
                        ) : isHighConsumption ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center gap-1 mx-auto w-fit">
                            <AlertTriangle className="w-3 h-3" />
                            Atenção
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center gap-1 mx-auto w-fit">
                            Regular
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Ranking Row: Top Máquinas em Produtividade & Top Consumidoras */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Produtividade (Horas) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0b1d3a] flex items-center gap-2 font-industrial">
              <Clock className="w-4 h-4 text-[#113861]" />
              Top 5 Máquinas Mais Produtivas (Horas)
            </h4>
          </div>
          <div className="space-y-2">
            {topMachinesRanking.topHours.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Nenhum registro de horas</p>
            ) : (
              topMachinesRanking.topHours.map((item, idx) => (
                <div
                  key={item.code}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#113861]/10 text-[#113861] font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-[#0b1d3a]">{item.code}</span>
                      <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{item.type} • {item.obra}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-[#113861]">
                      {item.hours.toLocaleString('pt-BR')} h
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {item.efficiency > 0 ? `${item.efficiency} L/h` : '—'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Consumo (Litros de Diesel) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0b1d3a] flex items-center gap-2 font-industrial">
              <Fuel className="w-4 h-4 text-amber-500" />
              Top 5 Maiores Consumidoras de Diesel (Litros)
            </h4>
          </div>
          <div className="space-y-2">
            {topMachinesRanking.topLiters.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Nenhum registro de abastecimento</p>
            ) : (
              topMachinesRanking.topLiters.map((item, idx) => (
                <div
                  key={item.code}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{item.code}</span>
                      <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{item.type} • {item.obra}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {item.liters.toLocaleString('pt-BR')} L
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {item.efficiency > 0 ? `${item.efficiency} L/h` : '—'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
