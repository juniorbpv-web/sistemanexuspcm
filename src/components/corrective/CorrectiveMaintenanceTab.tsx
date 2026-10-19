import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Plus,
  FileDown,
  FileSpreadsheet,
  Printer,
  BarChart2,
  RefreshCw,
  SlidersHorizontal,
  Truck,
  CheckCircle,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  CorrectiveMaintenance,
  Equipment,
  CorrectiveFilterState,
} from '../../types';
import { CorrectiveDashboard } from './CorrectiveDashboard';
import { CorrectiveFilters } from './CorrectiveFilters';
import { CorrectiveTable } from './CorrectiveTable';
import { CorrectiveFormModal } from './CorrectiveFormModal';
import { CorrectiveDetailModal } from './CorrectiveDetailModal';
import { EquipmentCorrectiveHistoryModal } from './EquipmentCorrectiveHistoryModal';
import { PhotoLightboxModal } from './PhotoLightboxModal';
import { exportCorrectivesToCSV } from '../../utils/storage';
import { exportCorrectivesToPDF } from '../../utils/pdfCorrectiveExport';

interface CorrectiveMaintenanceTabProps {
  records: CorrectiveMaintenance[];
  equipments: Equipment[];
  onSaveRecord: (record: CorrectiveMaintenance) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onResetRecords?: () => Promise<void>;
  isLoading?: boolean;
}

const INITIAL_FILTERS: CorrectiveFilterState = {
  startDate: '',
  endDate: '',
  supplier: '',
  prefix: '',
  equipmentType: '',
  brand: '',
  model: '',
  location: '',
  status: '',
  failureType: '',
  mechanic: '',
  searchTerm: '',
};

export const CorrectiveMaintenanceTab: React.FC<CorrectiveMaintenanceTabProps> = ({
  records,
  equipments,
  onSaveRecord,
  onDeleteRecord,
  onResetRecords,
  isLoading = false,
}) => {
  // Filters State
  const [filters, setFilters] = useState<CorrectiveFilterState>(INITIAL_FILTERS);
  const [isDashboardVisible, setIsDashboardVisible] = useState(true);

  // Modals State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CorrectiveMaintenance | null>(null);

  const [detailRecord, setDetailRecord] = useState<CorrectiveMaintenance | null>(null);
  const [historyPrefix, setHistoryPrefix] = useState<string | null>(null);

  const [lightboxPhoto, setLightboxPhoto] = useState<{
    url: string;
    title: string;
    name?: string;
    photoId?: string;
  } | null>(null);
  const [pdfIncludePhotos, setPdfIncludePhotos] = useState<boolean>(true);
  const [showPdfOptionsModal, setShowPdfOptionsModal] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Filtering Logic
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Search term (OS, Prefix, Equipment, Plate, Supplier, Description)
      if (filters.searchTerm) {
        const query = filters.searchTerm.toLowerCase().trim();
        const matchOs = (r.osNumber || '').toLowerCase().includes(query);
        const matchPrefix = (r.prefix || '').toLowerCase().includes(query);
        const matchType = (r.equipmentType || '').toLowerCase().includes(query);
        const matchPlate = (r.plate || '').toLowerCase().includes(query);
        const matchSupplier = (r.supplier || '').toLowerCase().includes(query);
        const matchProblem = (r.problemDescription || '').toLowerCase().includes(query);
        const matchService = (r.servicePerformed || '').toLowerCase().includes(query);
        const matchMechanic = (r.mechanic || '').toLowerCase().includes(query);

        if (
          !matchOs &&
          !matchPrefix &&
          !matchType &&
          !matchPlate &&
          !matchSupplier &&
          !matchProblem &&
          !matchService &&
          !matchMechanic
        ) {
          return false;
        }
      }

      // Status
      if (filters.status && r.status !== filters.status) {
        return false;
      }

      // Plate / Prefix filter
      if (
        filters.prefix &&
        (r.plate || '').toUpperCase() !== filters.prefix.toUpperCase() &&
        (r.prefix || '').toUpperCase() !== filters.prefix.toUpperCase()
      ) {
        return false;
      }

      // Supplier
      if (filters.supplier && (r.supplier || '').toLowerCase() !== filters.supplier.toLowerCase()) {
        return false;
      }

      // Equipment Type
      if (
        filters.equipmentType &&
        (r.equipmentType || '').toLowerCase() !== filters.equipmentType.toLowerCase()
      ) {
        return false;
      }

      // Brand
      if (filters.brand && (r.brand || '').toLowerCase() !== filters.brand.toLowerCase()) {
        return false;
      }

      // Model
      if (filters.model && (r.model || '').toLowerCase() !== filters.model.toLowerCase()) {
        return false;
      }

      // Location
      if (filters.location && (r.location || '').toLowerCase() !== filters.location.toLowerCase()) {
        return false;
      }

      // Failure Type
      if (
        filters.failureType &&
        (r.failureType || '').toLowerCase() !== filters.failureType.toLowerCase()
      ) {
        return false;
      }

      // Mechanic
      if (
        filters.mechanic &&
        (r.mechanic || '').toLowerCase() !== filters.mechanic.toLowerCase()
      ) {
        return false;
      }

      // Start Date (openDate >= startDate)
      if (filters.startDate && r.openDate < filters.startDate) {
        return false;
      }

      // End Date (openDate <= endDate)
      if (filters.endDate && r.openDate > filters.endDate) {
        return false;
      }

      return true;
    });
  }, [records, filters]);

  // Handlers for quick dashboard drill-downs
  const handleSelectEquipmentFilter = (pfx: string) => {
    setFilters((prev) => ({ ...prev, prefix: pfx }));
  };

  const handleSelectSupplierFilter = (supp: string) => {
    setFilters((prev) => ({ ...prev, supplier: supp }));
  };

  const handleSelectFailureFilter = (fType: string) => {
    setFilters((prev) => ({ ...prev, failureType: fType }));
  };

  // Handlers for Modals
  const handleOpenNewForm = () => {
    setEditingRecord(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditForm = (rec: CorrectiveMaintenance) => {
    setEditingRecord(rec);
    setIsFormModalOpen(true);
  };

  const handleSaveForm = async (saved: CorrectiveMaintenance) => {
    await onSaveRecord(saved);
  };

  // Export handlers
  const handleExportCSV = () => {
    exportCorrectivesToCSV(filteredRecords);
  };

  const handleGeneratePDF = (withPhotos: boolean) => {
    const period =
      filters.startDate && filters.endDate
        ? `${filters.startDate.split('-').reverse().join('/')} até ${filters.endDate.split('-').reverse().join('/')}`
        : filters.startDate
        ? `A partir de ${filters.startDate.split('-').reverse().join('/')}`
        : 'Histórico Geral Consolidado';

    const filterTexts: string[] = [];
    if (filters.status) filterTexts.push(`Status: ${filters.status}`);
    if (filters.prefix) filterTexts.push(`Placa: ${filters.prefix}`);
    if (filters.supplier) filterTexts.push(`Fornecedor: ${filters.supplier}`);
    if (filters.failureType) filterTexts.push(`Falha: ${filters.failureType}`);

    exportCorrectivesToPDF(filteredRecords, {
      periodLabel: period,
      filterSummary: filterTexts.join(' • '),
      includePhotos: withPhotos,
      equipments,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="corretivas-realizadas-tab" className="space-y-4 sm:space-y-5 animate-fadeIn w-full min-w-0">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-tr from-blue-700 to-indigo-600 rounded-xl text-white shadow-md">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Corretivas Realizadas
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                PCM Ativo
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Registro, consulta, histórico fotográfico e indicadores analíticos de manutenções corretivas
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Nova Corretiva Button (Destacado) */}
          <button
            type="button"
            id="btn-nova-corretiva"
            onClick={handleOpenNewForm}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>➕ Nova Corretiva</span>
          </button>

          {/* Gerar Relatório PDF */}
          <button
            type="button"
            id="btn-pdf-corretivas"
            onClick={() => setShowPdfOptionsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl shadow-2xs transition-colors"
            title="Gerar Relatório em PDF"
          >
            <FileDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>📄 Relatório PDF</span>
          </button>

          {/* Exportar Excel */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl shadow-2xs transition-colors"
            title="Exportar para planilha Excel formatada"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Exportar Excel</span>
          </button>

          {/* Imprimir */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl shadow-2xs transition-colors"
            title="Imprimir Tela"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Zerar Informações de Corretivas */}
          {onResetRecords && (
            <button
              type="button"
              id="btn-zerar-corretivas"
              onClick={() => setShowResetConfirmModal(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 font-semibold text-xs rounded-xl shadow-2xs transition-colors"
              title="Zerar registros de manutenções corretivas para começar do zero"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Zerar Informações</span>
            </button>
          )}

          {/* Toggle Dashboard Metrics */}
          <button
            type="button"
            onClick={() => setIsDashboardVisible(!isDashboardVisible)}
            className={`p-2.5 rounded-xl border transition-colors ${
              isDashboardVisible
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
            title={isDashboardVisible ? 'Ocultar Dashboard Executivo' : 'Exibir Dashboard Executivo'}
          >
            <BarChart2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Dashboard (KPIs + Rankings + Recurrence) */}
      {isDashboardVisible && (
        <CorrectiveDashboard
          records={filteredRecords}
          onSelectEquipmentFilter={handleSelectEquipmentFilter}
          onSelectSupplierFilter={handleSelectSupplierFilter}
          onSelectFailureFilter={handleSelectFailureFilter}
          onOpenEquipmentHistory={(pfx) => setHistoryPrefix(pfx)}
        />
      )}

      {/* Advanced Filters & Search */}
      <CorrectiveFilters
        filters={filters}
        onFilterChange={setFilters}
        onResetFilters={() => setFilters(INITIAL_FILTERS)}
        records={records}
        equipments={equipments}
        totalMatches={filteredRecords.length}
      />

      {/* Main Table */}
      <CorrectiveTable
        records={filteredRecords}
        onViewDetail={(rec) => setDetailRecord(rec)}
        onEdit={(rec) => handleOpenEditForm(rec)}
        onDelete={async (id) => {
          await onDeleteRecord(id);
        }}
        onOpenEquipmentHistory={(pfx) => setHistoryPrefix(pfx)}
        onSelectPhoto={(url, title, name, photoId) => setLightboxPhoto({ url, title, name, photoId })}
      />

      {/* MODAL 1: Cadastro / Edição de Corretiva */}
      {isFormModalOpen && (
        <CorrectiveFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSave={handleSaveForm}
          equipments={equipments}
          editingRecord={editingRecord}
          existingRecords={records}
        />
      )}

      {/* MODAL 2: Detalhes da Ordem de Serviço */}
      {detailRecord && (
        <CorrectiveDetailModal
          isOpen={!!detailRecord}
          onClose={() => setDetailRecord(null)}
          record={detailRecord}
          onEdit={(rec) => {
            setDetailRecord(null);
            handleOpenEditForm(rec);
          }}
          onDelete={async (id) => {
            await onDeleteRecord(id);
            setDetailRecord(null);
          }}
          onOpenEquipmentHistory={(pfx) => {
            setDetailRecord(null);
            setHistoryPrefix(pfx);
          }}
        />
      )}

      {/* MODAL 3: Histórico Completo do Equipamento */}
      {historyPrefix && (
        <EquipmentCorrectiveHistoryModal
          isOpen={!!historyPrefix}
          onClose={() => setHistoryPrefix(null)}
          prefix={historyPrefix}
          records={records}
          equipments={equipments}
          onOpenRecordDetail={(rec) => {
            setHistoryPrefix(null);
            setDetailRecord(rec);
          }}
        />
      )}

      {/* MODAL 4: Visualizador de Fotos (Lightbox) */}
      {lightboxPhoto && (
        <PhotoLightboxModal
          isOpen={!!lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
          photoUrl={lightboxPhoto.url}
          photoName={lightboxPhoto.name}
          title={lightboxPhoto.title}
          photoId={lightboxPhoto.photoId}
        />
      )}

      {/* MODAL 5: Opções de Exportação PDF */}
      {showPdfOptionsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowPdfOptionsModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileDown className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Gerar Relatório PDF
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfOptionsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
              O relatório será gerado no layout oficial executivo Makmo Infraestrutura em formato A4 Paisagem, contemplando{' '}
              <strong>{filteredRecords.length}</strong> corretivas filtradas.
            </p>

            <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfIncludePhotos}
                  onChange={(e) => setPdfIncludePhotos(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    ☑ Incluir Fotos e Evidências no Relatório
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Cria uma página anexa com a galeria de fotos das manutenções, legenda da O.S. e placa do equipamento.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowPdfOptionsModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPdfOptionsModal(false);
                  handleGeneratePDF(pdfIncludePhotos);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <FileDown className="w-4 h-4" />
                <span>Exportar PDF Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Zero Out Correctives */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/70 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Zerar Informações de Corretivas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Limpar dados para começar novos lançamentos
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Tem certeza de que deseja <strong>zerar todos os registros de manutenções corretivas</strong>?
              Todas as ordens de serviço, fotos e históricos da aba de Corretivas serão removidos para que você possa iniciar novos cadastros do zero.
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
              <strong>Atenção:</strong> A Base de Dados de Equipamentos, Apontamentos Diários, Controle de Diesel, PCM Preventivas e Descontos permanecerão 100% intactos e inalterados.
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={async () => {
                  try {
                    setIsResetting(true);
                    if (onResetRecords) {
                      await onResetRecords();
                    }
                    setShowResetConfirmModal(false);
                  } finally {
                    setIsResetting(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? 'Zerando...' : 'Sim, Zerar Corretivas'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
