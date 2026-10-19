import React, { useState, useEffect, useMemo } from 'react';
import {
  Equipment,
  MeasurementDeduction,
  DeductionFilterState,
  AuthUser,
} from '../../types';
import {
  loadMeasurementDeductions,
  saveMeasurementDeductions,
} from '../../utils/storage';
import {
  subscribeMeasurementDeductions,
  saveMeasurementDeductionToFirestore,
  deleteMeasurementDeductionFromFirestore,
} from '../../services/firebaseService';
import { matchesSelectedProject, normalizeProjectCode } from '../../utils/authStorage';
import { exportDeductionsToPDF } from '../../utils/pdfDeductionExport';
import { exportDeductionsToExcel } from '../../utils/excelDeductionExport';
import { DeductionDashboard } from './DeductionDashboard';
import { DeductionTable } from './DeductionTable';
import { DeductionFormModal } from './DeductionFormModal';
import { CloseStoppageModal } from './CloseStoppageModal';
import { DeductionHistoryModal } from './DeductionHistoryModal';
import {
  Plus,
  FileText,
  FileSpreadsheet,
  RotateCcw,
  BarChart2,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
} from 'lucide-react';

interface MeasurementDeductionTabProps {
  equipments: Equipment[];
  currentUser?: AuthUser | null;
  selectedProject?: string;
}

const INITIAL_FILTERS: DeductionFilterState = {
  startDate: '',
  endDate: '',
  location: '',
  supplier: '',
  prefix: '',
  equipmentType: '',
  status: '',
  reason: '',
  searchTerm: '',
};

export const MeasurementDeductionTab: React.FC<MeasurementDeductionTabProps> = ({
  equipments,
  currentUser,
  selectedProject,
}) => {
  // Main state
  const [deductions, setDeductions] = useState<MeasurementDeduction[]>(() =>
    loadMeasurementDeductions(equipments)
  );
  const [filters, setFilters] = useState<DeductionFilterState>(INITIAL_FILTERS);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [deductionToEdit, setDeductionToEdit] = useState<MeasurementDeduction | null>(null);

  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [deductionToClose, setDeductionToClose] = useState<MeasurementDeduction | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [deductionToViewHistory, setDeductionToViewHistory] = useState<MeasurementDeduction | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. Firebase Real-time Synchronization
  useEffect(() => {
    const unsubscribe = subscribeMeasurementDeductions(
      (data) => {
        if (data) {
          setDeductions(data);
        }
      },
      (err) => {
        console.warn('Using local deductions data:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Extract Unique Filter Options from Data
  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    equipments.forEach((e) => e.location && set.add(e.location));
    deductions.forEach((d) => d.location && set.add(d.location));
    return Array.from(set).sort();
  }, [equipments, deductions]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    equipments.forEach((e) => e.supplier && set.add(e.supplier));
    deductions.forEach((d) => d.supplier && set.add(d.supplier));
    return Array.from(set).sort();
  }, [equipments, deductions]);

  const uniquePrefixes = useMemo(() => {
    const set = new Set<string>();
    deductions.forEach((d) => d.prefix && set.add(d.prefix));
    equipments.forEach((e) => e.prefix && set.add(e.prefix));
    return Array.from(set).sort();
  }, [equipments, deductions]);

  const uniqueEquipmentTypes = useMemo(() => {
    const set = new Set<string>();
    deductions.forEach((d) => d.equipmentType && set.add(d.equipmentType));
    equipments.forEach((e) => e.type && set.add(e.type));
    return Array.from(set).sort();
  }, [equipments, deductions]);

  // 3. Filtered Deductions
  const filteredDeductions = useMemo(() => {
    return deductions.filter((d) => {
      // Obra isolation
      if (selectedProject && selectedProject !== 'all') {
        if (!matchesSelectedProject(d.location, selectedProject, d.obra_id)) {
          return false;
        }
      }

      // Period filter: overlaps with [filters.startDate, filters.endDate]
      if (filters.startDate && d.startDate < filters.startDate) {
        if (!d.endDate || d.endDate < filters.startDate) return false;
      }
      if (filters.endDate && d.startDate > filters.endDate) {
        return false;
      }

      if (filters.location && d.location !== filters.location) return false;
      if (filters.supplier && d.supplier !== filters.supplier) return false;
      if (filters.prefix && d.prefix !== filters.prefix) return false;
      if (filters.equipmentType && d.equipmentType !== filters.equipmentType) return false;
      if (filters.status && d.status !== filters.status) return false;
      if (filters.reason && d.reason !== filters.reason) return false;

      // Text search
      if (filters.searchTerm) {
        const query = filters.searchTerm.toLowerCase();
        const matches =
          d.prefix.toLowerCase().includes(query) ||
          d.equipmentType.toLowerCase().includes(query) ||
          d.supplier.toLowerCase().includes(query) ||
          d.location.toLowerCase().includes(query) ||
          (d.operator && d.operator.toLowerCase().includes(query)) ||
          (d.notes && d.notes.toLowerCase().includes(query)) ||
          d.reason.toLowerCase().includes(query);
        if (!matches) return false;
      }

      return true;
    });
  }, [deductions, filters, selectedProject]);

  // 4. CRUD Handlers
  const handleSaveDeduction = async (newOrUpdated: MeasurementDeduction) => {
    try {
      const activeObra =
        selectedProject && selectedProject !== 'all'
          ? selectedProject
          : newOrUpdated.obra_id || newOrUpdated.location || '063/064';
      const enriched: MeasurementDeduction = {
        ...newOrUpdated,
        location:
          selectedProject && selectedProject !== 'all' && (!newOrUpdated.location || newOrUpdated.location.trim() === '')
            ? selectedProject
            : newOrUpdated.location,
        obra_id: activeObra,
        projectId: activeObra,
      };

      const updatedList = deductions.some((d) => d.id === enriched.id)
        ? deductions.map((d) => (d.id === enriched.id ? enriched : d))
        : [enriched, ...deductions];

      setDeductions(updatedList);
      saveMeasurementDeductions(updatedList);

      // Async Firestore push
      await saveMeasurementDeductionToFirestore(enriched);
      showToast(
        `Desconto de ${enriched.prefix} (${enriched.equipmentType}) salvo com sucesso!`,
        'success'
      );
    } catch (err) {
      console.error('Error saving deduction:', err);
      showToast('Registro salvo localmente. Sincronizando com Firestore...', 'success');
    }
  };

  const handleDeleteDeduction = async (id: string) => {
    try {
      const target = deductions.find((d) => d.id === id);
      const updatedList = deductions.filter((d) => d.id !== id);
      setDeductions(updatedList);
      saveMeasurementDeductions(updatedList);

      await deleteMeasurementDeductionFromFirestore(id);
      showToast(
        target ? `Registro de ${target.prefix} excluído.` : 'Registro de desconto excluído.',
        'success'
      );
    } catch (err) {
      console.error('Error deleting deduction:', err);
      showToast('Registro removido da base.', 'success');
    }
  };

  // 5. Action Triggers
  const handleOpenNewModal = () => {
    setDeductionToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (d: MeasurementDeduction) => {
    setDeductionToEdit(d);
    setIsFormModalOpen(true);
  };

  const handleOpenCloseModal = (d: MeasurementDeduction) => {
    setDeductionToClose(d);
    setIsCloseModalOpen(true);
  };

  const handleOpenHistoryModal = (d: MeasurementDeduction) => {
    setDeductionToViewHistory(d);
    setIsHistoryModalOpen(true);
  };

  // 6. Reports
  const handleGeneratePDF = () => {
    if (filteredDeductions.length === 0) {
      showToast('Não há registros para gerar relatório com os filtros atuais.', 'error');
      return;
    }
    const periodLabel =
      filters.startDate || filters.endDate
        ? `${filters.startDate || 'Início'} até ${filters.endDate || 'Atual'}`
        : 'Período Completo';

    exportDeductionsToPDF(filteredDeductions, {
      periodLabel,
      userName: currentUser?.name || currentUser?.username || 'PCM Makmo',
      equipments,
    });
    showToast('Relatório PDF oficial gerado com sucesso!', 'success');
  };

  const handleExportExcel = () => {
    if (filteredDeductions.length === 0) {
      showToast('Não há registros para exportar com os filtros atuais.', 'error');
      return;
    }
    exportDeductionsToExcel(filteredDeductions);
    showToast('Planilha Excel/CSV exportada com sucesso!', 'success');
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    showToast('Filtros redefinidos.', 'success');
  };

  return (
    <div id="measurement-deduction-tab-root" className="space-y-4 sm:space-y-5 pb-8 animate-fadeIn w-full min-w-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-rose-600 text-white border-rose-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header Banner & Primary Actions Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Desconto em Medição
              </h1>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                Controle de equipamentos paralisados na obra e cálculo automático de deduções contratuais
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons (Section 15) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* + NOVO DESCONTO */}
          <button
            onClick={handleOpenNewModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            + Novo Desconto
          </button>

          {/* GERAR PDF */}
          <button
            onClick={handleGeneratePDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4 text-teal-400" />
            Gerar PDF
          </button>

          {/* EXPORTAR EXCEL */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar Excel
          </button>

          {/* LIMPAR FILTROS */}
          <button
            onClick={handleResetFilters}
            title="Limpar todos os filtros"
            className="p-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Dashboard with KPIs, Filters, and 5 Charts */}
      <DeductionDashboard
        deductions={deductions}
        filteredDeductions={filteredDeductions}
        filters={filters}
        onFilterChange={setFilters}
        onResetFilters={handleResetFilters}
        uniqueLocations={uniqueLocations}
        uniqueSuppliers={uniqueSuppliers}
        uniquePrefixes={uniquePrefixes}
        uniqueEquipmentTypes={uniqueEquipmentTypes}
      />

      {/* Main Table Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-blue-600" />
            Tabela de Paralisações e Descontos em Medição
          </h2>
          <span className="text-xs text-slate-700 dark:text-slate-300">
            {filteredDeductions.length} de {deductions.length} registro(s)
          </span>
        </div>

        <DeductionTable
          deductions={filteredDeductions}
          onEdit={handleOpenEditModal}
          onDelete={handleDeleteDeduction}
          onCloseStoppage={handleOpenCloseModal}
          onViewHistory={handleOpenHistoryModal}
          searchTerm={filters.searchTerm}
          onSearchChange={(searchTerm) => setFilters({ ...filters, searchTerm })}
        />
      </div>

      {/* Modals */}
      <DeductionFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveDeduction}
        equipments={equipments}
        existingDeductions={deductions}
        deductionToEdit={deductionToEdit}
        currentUser={currentUser}
      />

      <CloseStoppageModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        deduction={deductionToClose}
        onConfirmClose={handleSaveDeduction}
        currentUser={currentUser}
      />

      <DeductionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        deduction={deductionToViewHistory}
      />
    </div>
  );
};
