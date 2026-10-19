import React, { useState, useMemo } from 'react';
import {
  Equipment,
  PreventiveCalculation,
  PreventivePlan,
  PreventiveStatus,
  UserRole,
} from '../../types';
import {
  formatMetricWithUnit,
  formatMetricValue,
  formatDateDDMMAAAA,
  exportPreventivesToCSV,
  getDefaultIntervalForEquipment,
} from '../../utils/preventiveUtils';
import { exportPreventivesToPDF } from '../../utils/pdfPreventiveExport';
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  FileText,
  Wrench,
  Gauge,
  SlidersHorizontal,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Plus,
  Truck,
  ShieldCheck,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { EditPreventiveModal } from './EditPreventiveModal';

interface PreventiveTableProps {
  calculations: PreventiveCalculation[];
  equipments?: Equipment[];
  plans?: PreventivePlan[];
  initialStatus?: string;
  initialSearch?: string;
  onSelectEquipmentForDetail: (equipmentId: string) => void;
  onOpenRegisterModal: (equipment?: Equipment) => void;
  onOpenUpdateReadingModal: (equipment?: Equipment) => void;
  onSavePlan?: (plan: PreventivePlan) => void;
  onDeletePlan?: (planId: string, equipmentId: string) => void;
  onUpdateEquipment?: (equipment: Equipment) => void;
  userRole?: UserRole;
}

type SortField =
  | 'urgency'
  | 'nextReview'
  | 'prefix'
  | 'equipment'
  | 'plate'
  | 'supplier'
  | 'status'
  | 'location'
  | 'date'
  | 'lastReview'
  | 'currentValue'
  | 'readingDate'
  | 'interval'
  | 'remaining';
type SortOrder = 'asc' | 'desc';

export const PreventiveTable: React.FC<PreventiveTableProps> = ({
  calculations,
  equipments = [],
  plans = [],
  initialStatus,
  initialSearch,
  onSelectEquipmentForDetail,
  onOpenRegisterModal,
  onOpenUpdateReadingModal,
  onSavePlan,
  onDeletePlan,
  onUpdateEquipment,
  userRole = 'developer',
}) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [selectedType, setSelectedType] = useState<string>('todos');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('todos');
  const [selectedLocation, setSelectedLocation] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus || 'todos');
  const [selectedInterval, setSelectedInterval] = useState<string>('todos');

  // Modal states for Edit and Delete
  const [editingCalculation, setEditingCalculation] = useState<PreventiveCalculation | null>(null);
  const [deletingCalculation, setDeletingCalculation] = useState<PreventiveCalculation | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleConfirmDelete = async () => {
    if (!deletingCalculation || !onDeletePlan) return;
    setIsDeleting(true);
    try {
      await onDeletePlan(deletingCalculation.plan.id, deletingCalculation.equipmentId);
      setDeletingCalculation(null);
    } catch (err) {
      console.error('Erro ao excluir preventiva:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEditedPlan = (updatedPlan: PreventivePlan) => {
    if (onSavePlan) {
      onSavePlan(updatedPlan);
    }
    setEditingCalculation(null);
  };

  // Sorting
  const [sortField, setSortField] = useState<SortField>('urgency');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // View mode: 'controlled' (only registered preventives) or 'all' (entire fleet)
  const [viewMode, setViewMode] = useState<'controlled' | 'all'>('controlled');

  // Calculation map by equipmentId for fast lookup
  const calculationMap = useMemo(() => {
    const map = new Map<string, PreventiveCalculation>();
    calculations.forEach((c) => map.set(c.equipmentId, c));
    return map;
  }, [calculations]);

  // Extract unique options for filter dropdowns
  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    calculations.forEach((c) => {
      if (c.equipment.type) set.add(c.equipment.type);
    });
    if (equipments) {
      equipments.forEach((e) => {
        if (e.type) set.add(e.type);
      });
    }
    return Array.from(set).sort();
  }, [calculations, equipments]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    calculations.forEach((c) => {
      if (c.equipment.supplier) set.add(c.equipment.supplier);
    });
    if (equipments) {
      equipments.forEach((e) => {
        if (e.supplier) set.add(e.supplier);
      });
    }
    return Array.from(set).sort();
  }, [calculations, equipments]);

  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    calculations.forEach((c) => {
      if (c.equipment.location) set.add(c.equipment.location);
    });
    if (equipments) {
      equipments.forEach((e) => {
        if (e.location) set.add(e.location);
      });
    }
    return Array.from(set).sort();
  }, [calculations, equipments]);

  const uniqueIntervals = useMemo(() => {
    const set = new Set<string>();
    calculations.forEach((c) => {
      if (c.plan.intervalType) set.add(c.plan.intervalType);
    });
    return Array.from(set).sort();
  }, [calculations]);

  // Filtered fleet equipments for 'all' mode
  const filteredFleetEquipments = useMemo(() => {
    if (!equipments) return [];
    return equipments.filter((eq) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const prefix = (eq.prefix || '').toLowerCase();
        const plate = (eq.plate || '').toLowerCase();
        const type = (eq.type || '').toLowerCase();
        const model = (eq.model || '').toLowerCase();
        const brand = (eq.brand || '').toLowerCase();
        const supplier = (eq.supplier || '').toLowerCase();
        const loc = (eq.location || '').toLowerCase();
        const code = (eq.code || '').toLowerCase();

        const matches =
          prefix.includes(q) ||
          plate.includes(q) ||
          type.includes(q) ||
          model.includes(q) ||
          brand.includes(q) ||
          supplier.includes(q) ||
          loc.includes(q) ||
          code.includes(q);

        if (!matches) return false;
      }

      if (selectedType !== 'todos' && eq.type !== selectedType) return false;
      if (selectedSupplier !== 'todos' && eq.supplier !== selectedSupplier) return false;
      if (selectedLocation !== 'todos' && eq.location !== selectedLocation) return false;

      const calc = calculationMap.get(eq.id);
      if (selectedStatus !== 'todos') {
        if (selectedStatus === 'SEM_PREVENTIVA') {
          if (calc) return false;
        } else {
          if (!calc || calc.status !== selectedStatus) return false;
        }
      }

      return true;
    });
  }, [equipments, calculationMap, searchTerm, selectedType, selectedSupplier, selectedLocation, selectedStatus]);

  // Filtered and Sorted calculations
  const filteredCalculations = useMemo(() => {
    let list = calculations.filter((item) => {
      // Text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const prefix = (item.equipment.prefix || '').toLowerCase();
        const plate = (item.equipment.plate || '').toLowerCase();
        const type = (item.equipment.type || '').toLowerCase();
        const model = (item.equipment.model || '').toLowerCase();
        const brand = (item.equipment.brand || '').toLowerCase();
        const supplier = (item.equipment.supplier || '').toLowerCase();
        const loc = (item.equipment.location || '').toLowerCase();
        const code = (item.equipmentCode || '').toLowerCase();

        const matches =
          prefix.includes(q) ||
          plate.includes(q) ||
          type.includes(q) ||
          model.includes(q) ||
          brand.includes(q) ||
          supplier.includes(q) ||
          loc.includes(q) ||
          code.includes(q);

        if (!matches) return false;
      }

      // Dropdown filters
      if (selectedType !== 'todos' && item.equipment.type !== selectedType) return false;
      if (selectedSupplier !== 'todos' && item.equipment.supplier !== selectedSupplier) return false;
      if (selectedLocation !== 'todos' && item.equipment.location !== selectedLocation) return false;
      if (selectedStatus !== 'todos' && item.status !== selectedStatus) return false;
      if (selectedInterval !== 'todos' && item.plan.intervalType !== selectedInterval) return false;

      return true;
    });

    // Sort
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'urgency') {
        // Urgency: Vencidas (highest overdue first) -> Atenção -> Próxima -> Em Dia (highest remaining last)
        const statusWeight: Record<PreventiveStatus, number> = {
          VENCIDA: 1,
          FAZER_REVISAO: 2,
          ATENCAO: 3,
          PROXIMA: 4,
          EM_DIA: 5,
        };
        if (statusWeight[a.status] !== statusWeight[b.status]) {
          comparison = statusWeight[a.status] - statusWeight[b.status];
        } else if (a.status === 'VENCIDA') {
          comparison = b.overdueValue - a.overdueValue; // larger overdue first
        } else {
          comparison = a.remainingValue - b.remainingValue; // smaller remaining first
        }
      } else if (sortField === 'nextReview') {
        comparison = a.nextReviewValue - b.nextReviewValue;
      } else if (sortField === 'prefix') {
        comparison = (a.equipmentCode || '').localeCompare(b.equipmentCode || '');
      } else if (sortField === 'equipment') {
        comparison = (a.equipment.type || '').localeCompare(b.equipment.type || '');
      } else if (sortField === 'plate') {
        comparison = (a.equipment.plate || '').localeCompare(b.equipment.plate || '');
      } else if (sortField === 'supplier') {
        comparison = (a.equipment.supplier || '').localeCompare(b.equipment.supplier || '');
      } else if (sortField === 'location') {
        comparison = (a.equipment.location || '').localeCompare(b.equipment.location || '');
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === 'date') {
        comparison = (a.lastReviewDate || '').localeCompare(b.lastReviewDate || '');
      } else if (sortField === 'lastReview') {
        comparison = (a.lastReviewValue || 0) - (b.lastReviewValue || 0);
      } else if (sortField === 'currentValue') {
        comparison = (a.currentValue || 0) - (b.currentValue || 0);
      } else if (sortField === 'readingDate') {
        comparison = (a.lastReadingDate || '').localeCompare(b.lastReadingDate || '');
      } else if (sortField === 'interval') {
        comparison = (a.intervalValue || 0) - (b.intervalValue || 0);
      } else if (sortField === 'remaining') {
        comparison = (a.remainingValue ?? 0) - (b.remainingValue ?? 0);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [
    calculations,
    searchTerm,
    selectedType,
    selectedSupplier,
    selectedLocation,
    selectedStatus,
    selectedInterval,
    sortField,
    sortOrder,
  ]);

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportCSV = () => {
    exportPreventivesToCSV(filteredCalculations);
  };

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    try {
      const activeFilters: string[] = [];
      if (selectedStatus !== 'todos') activeFilters.push(`Status: ${selectedStatus.toUpperCase()}`);
      if (selectedInterval !== 'todos') activeFilters.push(`Intervalo: ${selectedInterval}`);
      if (selectedType !== 'todos') activeFilters.push(`Tipo: ${selectedType}`);
      if (selectedSupplier !== 'todos') activeFilters.push(`Fornecedor: ${selectedSupplier}`);
      if (selectedLocation !== 'todos') activeFilters.push(`Obra: ${selectedLocation}`);
      if (searchTerm.trim()) activeFilters.push(`Busca: "${searchTerm.trim()}"`);

      const filterInfo = activeFilters.length > 0
        ? `Filtros: ${activeFilters.join(' • ')} (${filteredCalculations.length} itens)`
        : `${filteredCalculations.length} equipamento(s) sob monitoramento ativo`;

      exportPreventivesToPDF(filteredCalculations, equipments, {
        title: 'ACOMPANHAMENTO DE PREVENTIVAS',
        filterInfo,
        viewMode,
      });
    } catch (err) {
      console.error('Erro ao exportar PDF de preventivas:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div id="pcm-general-table-view" className="space-y-3.5">
      {/* Search and Filters Header */}
      <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-xl p-3.5 shadow-xs space-y-3">
        {/* View mode toggle tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#f3f4f6] dark:border-[#1e293b]">
          <div className="flex items-center gap-1.5 p-1 bg-[#f1f5f9] dark:bg-[#0b1322] rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] text-xs">
            <button
              onClick={() => setViewMode('controlled')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'controlled'
                  ? 'bg-white dark:bg-[#161f30] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white'
              }`}
            >
              <span>Equipamentos em Controle</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  viewMode === 'controlled'
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {calculations.length}
              </span>
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'all'
                  ? 'bg-white dark:bg-[#161f30] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-blue-500" />
              <span>Todos da Frota</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  viewMode === 'all'
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {equipments?.length || 0}
              </span>
            </button>
          </div>

          <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">
            {viewMode === 'controlled' ? (
              <span>
                {calculations.length === 0
                  ? 'Tabela zerada — controle inicia na 1ª preventiva registrada'
                  : `${calculations.length} equipamento(s) sob acompanhamento ativo`}
              </span>
            ) : (
              <span>Frota completa: {equipments?.length || 0} equipamentos cadastrados</span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por prefixo, placa, equipamento, fornecedor ou obra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Register Preventive Button */}
            <button
              onClick={() => onOpenRegisterModal()}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-xs"
              title="Registrar nova manutenção preventiva"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Preventiva</span>
            </button>

            {/* Sort Dropdown / Quick Toggle */}
            <button
              onClick={() => handleToggleSort('urgency')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors ${
                sortField === 'urgency'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40'
                  : 'bg-white dark:bg-[#0b1322] text-[#374151] dark:text-[#cbd5e1] border-[#dcdfe4] dark:border-[#334155]'
              }`}
              title="Ordenar pelos equipamentos mais próximos da preventiva"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Mais Urgentes</span>
            </button>

            {/* Export Excel */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Exportar tabela de preventivas para Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar</span> Excel
            </button>

            {/* Export PDF */}
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF || filteredCalculations.length === 0}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Exportar acompanhamento de preventivas em PDF com layout oficial Makmo Infraestrutura"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isExportingPDF ? 'Gerando...' : 'Exportar PDF'}</span>
            </button>
          </div>
        </div>

        {/* Filters Multi-Select Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 border-t border-[#f3f4f6] dark:border-[#1e293b]">
          {/* Status Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] mb-1">
              Status:
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-md text-[#111827] dark:text-white"
            >
              <option value="todos">Todos os Status</option>
              <option value="VENCIDA">🔴 Vencidas</option>
              <option value="FAZER_REVISAO">🟡 Fazer Revisão</option>
              <option value="EM_DIA">🟢 Em Dia</option>
              {viewMode === 'all' && (
                <option value="SEM_PREVENTIVA">⚪ Sem Preventiva Registrada</option>
              )}
            </select>
          </div>

          {/* Tipo de Equipamento */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] mb-1">
              Equipamento:
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-md text-[#111827] dark:text-white"
            >
              <option value="todos">Todos os Equipamentos ({uniqueTypes.length})</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Fornecedor */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] mb-1">
              Fornecedor:
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-md text-[#111827] dark:text-white"
            >
              <option value="todos">Todos os Fornecedores</option>
              {uniqueSuppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Obra */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] mb-1">
              Obra / Local:
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-md text-[#111827] dark:text-white"
            >
              <option value="todos">Todas as Obras</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Intervalo */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] mb-1">
              Tipo de Intervalo:
            </label>
            <select
              value={selectedInterval}
              onChange={(e) => setSelectedInterval(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-md text-[#111827] dark:text-white"
            >
              <option value="todos">Todos os Intervalos</option>
              {uniqueIntervals.map((intv) => (
                <option key={intv} value={intv}>
                  {intv}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* General Table (Requirement 8) */}
      <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f8fafc] dark:bg-[#0f172a] border-b border-[#dcdfe4] dark:border-[#22334d] text-[#475569] dark:text-[#94a3b8] font-bold text-[11px] uppercase tracking-wider">
                {/* Equipamento */}
                <th
                  onClick={() => handleToggleSort('equipment')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                  title="Ordenar por Equipamento"
                >
                  <div className="flex items-center gap-1">
                    <span>Equipamento</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* Prefixo / Placa */}
                <th
                  onClick={() => handleToggleSort('prefix')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                  title="Ordenar por Prefixo / Placa"
                >
                  <div className="flex items-center gap-1">
                    <span>Prefixo / Placa</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* Fornecedor */}
                <th
                  onClick={() => handleToggleSort('supplier')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                  title="Ordenar por Fornecedor"
                >
                  <div className="flex items-center gap-1">
                    <span>Fornecedor</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* 4. Data (Última Revisão) */}
                <th
                  onClick={() => handleToggleSort('date')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                  title="Ordenar por Data da Última Revisão"
                >
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-500" />
                    <span>Data</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* 5. Última Revisão */}
                <th
                  onClick={() => handleToggleSort('lastReview')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                  title="Ordenar por Valor da Última Revisão"
                >
                  <div className="flex items-center gap-1">
                    <span>Última Revisão</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* 6. Último KM / Hor */}
                <th
                  onClick={() => handleToggleSort('currentValue')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                  title="Ordenar por Último KM / Hor"
                >
                  <div className="flex items-center gap-1">
                    <span>Último KM / Hor</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* 7. Data do Último KM / Hor */}
                <th
                  onClick={() => handleToggleSort('readingDate')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                  title="Ordenar por Data do Último KM / Hor"
                >
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-500" />
                    <span>Data do Último KM / Hor</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* 8. Intervalo */}
                <th
                  onClick={() => handleToggleSort('interval')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                  title="Ordenar por Intervalo"
                >
                  <div className="flex items-center gap-1">
                    <span>Intervalo</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* 9. Próxima Revisão */}
                <th
                  onClick={() => handleToggleSort('nextReview')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                  title="Ordenar por Próxima Revisão"
                >
                  <div className="flex items-center gap-1">
                    <span>Próxima Revisão</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* 10. Faltam / Excedente */}
                <th
                  onClick={() => handleToggleSort('urgency')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                  title="Ordenar por Faltam / Excedente"
                >
                  <div className="flex items-center gap-1">
                    <span>Faltam / Excedente</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* 11. Status */}
                <th
                  onClick={() => handleToggleSort('status')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                  title="Ordenar por Status"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* 12. Ações */}
                <th className="py-3 px-3 text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] dark:divide-[#1e293b]">
              {viewMode === 'controlled' && calculations.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-14 px-4 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                        <Wrench className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-bold text-[#111827] dark:text-white">
                        {equipments.length === 0
                          ? 'Esta obra ainda não possui dados cadastrados'
                          : 'Acompanhamento de Preventivas Zerado'}
                      </h4>
                      <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                        {equipments.length === 0
                          ? 'Nenhum registro encontrado. Cadastre os equipamentos desta obra para gerenciar preventivas.'
                          : 'Nenhum registro encontrado. Nenhum equipamento possui preventiva registrada no momento. O acompanhamento de preventivas, horímetros/KM, próxima revisão e faltam/excedente inicia a partir do momento em que a preventiva é registrada.'}
                      </p>
                      <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                        <button
                          onClick={() => onOpenRegisterModal()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow transition-all inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Registrar Primeira Preventiva</span>
                        </button>
                        {equipments && equipments.length > 0 && (
                          <button
                            onClick={() => setViewMode('all')}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5"
                          >
                            <Truck className="w-4 h-4 text-blue-500" />
                            <span>Ver Todos da Frota ({equipments.length})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : viewMode === 'controlled' ? (
                filteredCalculations.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-[#6b7280] dark:text-[#9ca3af] italic">
                      Nenhum equipamento encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredCalculations.map((item, index) => {
                    const statusBg =
                      item.status === 'VENCIDA'
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                        : item.status === 'FAZER_REVISAO' || item.status === 'ATENCAO' || item.status === 'PROXIMA'
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';

                    return (
                      <tr
                        key={`${item.equipmentId}-${index}`}
                        className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                      >
                        {/* Equipamento */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#111827] dark:text-white">
                            {item.equipment.type}
                          </div>
                          <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                            {item.equipment.brand || ''} {item.equipment.model || ''}
                          </div>
                        </td>

                        {/* Prefixo / Placa */}
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold bg-[#f1f5f9] dark:bg-[#0b1322] px-1.5 py-0.5 rounded border border-[#e2e8f0] dark:border-[#1e293b] text-[#1e293b] dark:text-[#e2e8f0]">
                            {item.equipmentCode}
                          </span>
                          {item.equipment.plate && item.equipment.prefix && item.equipment.plate !== item.equipment.prefix && (
                            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block font-mono">
                              {item.equipment.plate}
                            </span>
                          )}
                        </td>

                        {/* Fornecedor */}
                        <td className="py-2.5 px-3 text-[#475569] dark:text-[#94a3b8] truncate max-w-[120px]">
                          {item.equipment.supplier || '-'}
                          <span className="block text-[10px] text-[#9ca3af] dark:text-[#64748b]">
                            {item.equipment.location || '-'}
                          </span>
                        </td>

                        {/* 4. Data (Última Revisão) */}
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          {item.lastReviewDate && item.lastReviewDate !== '-' ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs whitespace-nowrap">
                              <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                              <span>{formatDateDDMMAAAA(item.lastReviewDate)}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#9ca3af] dark:text-[#64748b] italic">
                              Sem data
                            </span>
                          )}
                        </td>

                        {/* 5. Última Revisão */}
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          {item.lastReviewValue === 0 && !item.lastReviewDate ? (
                            <div className="font-medium text-[#64748b] dark:text-[#94a3b8]">
                              {formatMetricWithUnit(0, item.unit)}
                            </div>
                          ) : (
                            <div className="font-bold text-[#1e293b] dark:text-[#e2e8f0]">
                              {formatMetricWithUnit(item.lastReviewValue, item.unit)}
                            </div>
                          )}
                        </td>

                        {/* 6. Último KM / Hor */}
                        <td className="py-2.5 px-3 font-mono font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {formatMetricWithUnit(item.currentValue, item.unit)}
                        </td>

                        {/* 7. Data do Último KM / Hor */}
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          {item.lastReadingDate && item.lastReadingDate !== '-' ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-xs whitespace-nowrap">
                              <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>{formatDateDDMMAAAA(item.lastReadingDate)}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#9ca3af] dark:text-[#64748b] italic">
                              Sem data
                            </span>
                          )}
                        </td>

                        {/* 8. Intervalo */}
                        <td className="py-2.5 px-3 text-[#475569] dark:text-[#94a3b8] whitespace-nowrap">
                          <span className="bg-[#f8fafc] dark:bg-[#0b1322] px-1.5 py-0.5 rounded text-[11px] font-medium border border-[#e2e8f0] dark:border-[#1e293b]">
                            {item.plan.intervalType}
                          </span>
                        </td>

                        {/* 9. Próxima Revisão */}
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0f172a] dark:text-white whitespace-nowrap">
                          {formatMetricWithUnit(item.nextReviewValue, item.unit)}
                        </td>

                        {/* 10. Faltam / Excedente */}
                        <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                          {item.isOverdue ? (
                            <div>
                              <span className="text-rose-600 dark:text-rose-400 block font-black">
                                Excedente: -{formatMetricWithUnit(item.overdueValue, item.unit)}
                              </span>
                              <span className="text-[10px] text-rose-500 font-medium block">
                                (VENCIDA)
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span
                                className={
                                  item.status === 'FAZER_REVISAO' || item.status === 'ATENCAO' || item.status === 'PROXIMA'
                                    ? 'text-amber-600 dark:text-amber-400 block font-black'
                                    : 'text-emerald-600 dark:text-emerald-400 block font-bold'
                                }
                              >
                                Faltam: {formatMetricWithUnit(item.remainingValue, item.unit)}
                              </span>
                              {item.status === 'FAZER_REVISAO' && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                                  (Fazer Revisão)
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 11. Status */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide border ${statusBg}`}
                          >
                            {item.status === 'VENCIDA' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                            )}
                            {(item.status === 'FAZER_REVISAO' || item.status === 'ATENCAO' || item.status === 'PROXIMA') && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            )}
                            {item.status === 'EM_DIA' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            )}
                            {item.statusLabel}
                          </span>
                        </td>

                        {/* 12. Ações */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingCalculation(item)}
                              className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-colors"
                              title="Editar Preventiva"
                              aria-label="Editar Preventiva"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingCalculation(item)}
                              className="p-1.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 transition-colors"
                              title="Excluir Preventiva"
                              aria-label="Excluir Preventiva"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenRegisterModal(item.equipment)}
                              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                              title="Registrar Nova Revisão"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenUpdateReadingModal(item.equipment)}
                              className="p-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 transition-colors"
                              title="Atualizar Leitura Horímetro/KM"
                            >
                              <Gauge className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onSelectEquipmentForDetail(item.equipmentId)}
                              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-[#64748b] dark:text-[#cbd5e1] transition-colors"
                              title="Ver detalhes do plano"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                /* View Mode: ALL */
                filteredFleetEquipments.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-[#6b7280] dark:text-[#9ca3af] italic">
                      Nenhum equipamento encontrado na frota com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredFleetEquipments.map((eq, index) => {
                    const item = calculationMap.get(eq.id);

                    if (item) {
                      const statusBg =
                        item.status === 'VENCIDA'
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                          : item.status === 'FAZER_REVISAO' || item.status === 'ATENCAO' || item.status === 'PROXIMA'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';

                      return (
                        <tr
                          key={`${eq.id}-${index}`}
                          className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                        >
                          {/* Equipamento */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[#111827] dark:text-white">
                              {item.equipment.type}
                            </div>
                            <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                              {item.equipment.brand || ''} {item.equipment.model || ''}
                            </div>
                          </td>

                          {/* Prefixo / Placa */}
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold bg-[#f1f5f9] dark:bg-[#0b1322] px-1.5 py-0.5 rounded border border-[#e2e8f0] dark:border-[#1e293b] text-[#1e293b] dark:text-[#e2e8f0]">
                              {item.equipmentCode}
                            </span>
                            {item.equipment.plate && item.equipment.prefix && item.equipment.plate !== item.equipment.prefix && (
                              <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block font-mono">
                                {item.equipment.plate}
                              </span>
                            )}
                          </td>

                          {/* Fornecedor */}
                          <td className="py-2.5 px-3 text-[#475569] dark:text-[#94a3b8] truncate max-w-[120px]">
                            {item.equipment.supplier || '-'}
                            <span className="block text-[10px] text-[#9ca3af] dark:text-[#64748b]">
                              {item.equipment.location || '-'}
                            </span>
                          </td>

                          {/* 4. Data (Última Revisão) */}
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                            {item.lastReviewDate && item.lastReviewDate !== '-' ? (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs whitespace-nowrap">
                                <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span>{formatDateDDMMAAAA(item.lastReviewDate)}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#9ca3af] dark:text-[#64748b] italic">
                                Sem data
                              </span>
                            )}
                          </td>

                          {/* 5. Última Revisão */}
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                            <div className="font-bold text-[#1e293b] dark:text-[#e2e8f0]">
                              {formatMetricWithUnit(item.lastReviewValue, item.unit)}
                            </div>
                          </td>

                          {/* 6. Último KM / Hor */}
                          <td className="py-2.5 px-3 font-mono font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {formatMetricWithUnit(item.currentValue, item.unit)}
                          </td>

                          {/* 7. Data do Último KM / Hor */}
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                            {item.lastReadingDate && item.lastReadingDate !== '-' ? (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-xs whitespace-nowrap">
                                <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>{formatDateDDMMAAAA(item.lastReadingDate)}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#9ca3af] dark:text-[#64748b] italic">
                                Sem data
                              </span>
                            )}
                          </td>

                          {/* 8. Intervalo */}
                          <td className="py-2.5 px-3 text-[#475569] dark:text-[#94a3b8] whitespace-nowrap">
                            <span className="bg-[#f8fafc] dark:bg-[#0b1322] px-1.5 py-0.5 rounded text-[11px] font-medium border border-[#e2e8f0] dark:border-[#1e293b]">
                              {item.plan.intervalType}
                            </span>
                          </td>

                          {/* 9. Próxima Revisão */}
                          <td className="py-2.5 px-3 font-mono font-bold text-[#0f172a] dark:text-white whitespace-nowrap">
                            {formatMetricWithUnit(item.nextReviewValue, item.unit)}
                          </td>

                          {/* 10. Faltam / Excedente */}
                          <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                            {item.isOverdue ? (
                              <div>
                                <span className="text-rose-600 dark:text-rose-400 block font-black">
                                  Excedente: -{formatMetricWithUnit(item.overdueValue, item.unit)}
                                </span>
                                <span className="text-[10px] text-rose-500 font-medium block">
                                  (VENCIDA)
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span
                                  className={
                                    item.status === 'FAZER_REVISAO' || item.status === 'ATENCAO' || item.status === 'PROXIMA'
                                      ? 'text-amber-600 dark:text-amber-400 block font-black'
                                      : 'text-emerald-600 dark:text-emerald-400 block font-bold'
                                  }
                                >
                                  Faltam: {formatMetricWithUnit(item.remainingValue, item.unit)}
                                </span>
                                {item.status === 'FAZER_REVISAO' && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                                    (Fazer Revisão)
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* 11. Status */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide border ${statusBg}`}
                            >
                              {item.statusLabel}
                            </span>
                          </td>

                          {/* 12. Ações */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingCalculation(item)}
                                className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-colors"
                                title="Editar Preventiva"
                                aria-label="Editar Preventiva"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingCalculation(item)}
                                className="p-1.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 transition-colors"
                                title="Excluir Preventiva"
                                aria-label="Excluir Preventiva"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onOpenRegisterModal(item.equipment)}
                                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                                title="Registrar Nova Revisão"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onOpenUpdateReadingModal(item.equipment)}
                                className="p-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 transition-colors"
                                title="Atualizar Leitura Horímetro/KM"
                              >
                                <Gauge className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // Equipment without registered preventive yet
                    const isKm = eq.category === 'VEICULO_LEVE' || eq.category === 'CAMINHAO' || eq.unit === 'KM';
                    const defaultInt = getDefaultIntervalForEquipment(eq);
                    const readingDate = isKm
                      ? (eq.lastKmDate || eq.updatedAt?.split('T')[0])
                      : (eq.lastHourMeterDate || eq.updatedAt?.split('T')[0]);

                    return (
                      <tr
                        key={`${eq.id}-${index}`}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors opacity-85"
                      >
                        {/* Equipamento */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#111827] dark:text-white">
                            {eq.type}
                          </div>
                          <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                            {eq.brand || ''} {eq.model || ''}
                          </div>
                        </td>

                        {/* Prefixo / Placa */}
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold bg-[#f1f5f9] dark:bg-[#0b1322] px-1.5 py-0.5 rounded border border-[#e2e8f0] dark:border-[#1e293b] text-[#1e293b] dark:text-[#e2e8f0]">
                            {eq.prefix || eq.plate || eq.code}
                          </span>
                        </td>

                        {/* Fornecedor */}
                        <td className="py-2.5 px-3 text-[#475569] dark:text-[#94a3b8] truncate max-w-[120px]">
                          {eq.supplier || '-'}
                          <span className="block text-[10px] text-[#9ca3af] dark:text-[#64748b]">
                            {eq.location || '-'}
                          </span>
                        </td>

                        {/* 4. Data (Última Revisão) */}
                        <td className="py-2.5 px-3 text-[#94a3b8] dark:text-[#64748b] italic">
                          -
                        </td>

                        {/* 5. Última Revisão */}
                        <td className="py-2.5 px-3 text-[#94a3b8] dark:text-[#64748b] italic">
                          Sem registro
                        </td>

                        {/* 6. Último KM / Hor */}
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#1e293b] dark:text-[#e2e8f0] whitespace-nowrap">
                          {formatMetricWithUnit(
                            isKm ? eq.currentKm ?? 0 : eq.currentHourMeter ?? 0,
                            isKm ? 'KM' : 'HORAS'
                          )}
                        </td>

                        {/* 7. Data do Último KM / Hor */}
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          {readingDate && readingDate !== '-' ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-xs whitespace-nowrap">
                              <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>{formatDateDDMMAAAA(readingDate)}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#9ca3af] dark:text-[#64748b] italic">
                              -
                            </span>
                          )}
                        </td>

                        {/* 8. Intervalo */}
                        <td className="py-2.5 px-3 text-[#475569] dark:text-[#94a3b8] whitespace-nowrap">
                          <span className="bg-[#f8fafc] dark:bg-[#0b1322] px-1.5 py-0.5 rounded text-[11px] font-medium border border-[#e2e8f0] dark:border-[#1e293b]">
                            {defaultInt.intervalType}
                          </span>
                        </td>

                        {/* 9. Próxima Revisão */}
                        <td className="py-2.5 px-3 text-[#94a3b8] dark:text-[#64748b] italic">
                          -
                        </td>

                        {/* 10. Faltam / Excedente */}
                        <td className="py-2.5 px-3 text-[#94a3b8] dark:text-[#64748b] italic">
                          -
                        </td>

                        {/* 11. Status */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                            SEM PREVENTIVA
                          </span>
                        </td>

                        {/* 12. Ações */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => onOpenRegisterModal(eq)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                            title="Registrar Preventiva para iniciar controle"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Registrar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Footer counter */}
        <div className="p-2.5 bg-[#f8fafc] dark:bg-[#0f172a] border-t border-[#dcdfe4] dark:border-[#22334d] flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8]">
          <span>
            {viewMode === 'controlled' ? (
              <>
                Exibindo <strong>{filteredCalculations.length}</strong> de{' '}
                <strong>{calculations.length}</strong> equipamentos sob controle
              </>
            ) : (
              <>
                Exibindo <strong>{filteredFleetEquipments.length}</strong> de{' '}
                <strong>{equipments?.length || 0}</strong> equipamentos da frota (
                <strong>{calculations.length}</strong> em controle ativo)
              </>
            )}
          </span>
          <span className="text-[11px]">
            Cálculos automáticos em conformidade com as regras PCM Makmo
          </span>
        </div>
      </div>

      {/* Edit Preventive Modal */}
      <EditPreventiveModal
        isOpen={!!editingCalculation}
        onClose={() => setEditingCalculation(null)}
        plan={editingCalculation?.plan || null}
        equipment={editingCalculation?.equipment || null}
        onSavePlan={handleSaveEditedPlan}
        onUpdateEquipment={onUpdateEquipment}
      />

      {/* Delete Confirmation Modal */}
      {deletingCalculation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#111827] dark:text-white">
                  Excluir Manutenção Preventiva
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Você tem certeza que deseja excluir o controle de manutenção preventiva do equipamento{' '}
                  <strong className="text-[#111827] dark:text-white font-mono">
                    {deletingCalculation.equipmentCode}
                  </strong>{' '}
                  ({deletingCalculation.equipment.type})?
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                Ao excluir, o equipamento deixará de ser monitorado no Acompanhamento de Preventivas. O histórico de manutenções passadas permanecerá preservado e você poderá registrar uma nova preventiva quando desejar.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1f5f9] dark:border-[#1e293b]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingCalculation(null)}
                className="px-4 py-2 text-xs font-bold text-[#475569] dark:text-[#cbd5e1] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo...' : 'Sim, Excluir Preventiva'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
