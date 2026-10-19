import React, { useState, useMemo } from 'react';
import {
  Equipment,
  PreventivePlan,
  PreventiveRecord,
  PreventiveCalculation,
  UserRole,
} from '../types';
import {
  buildFleetPreventives,
  calculateEquipmentPreventive,
} from '../utils/preventiveUtils';
import { exportPreventivesToPDF } from '../utils/pdfPreventiveExport';
import { PreventiveDashboard } from './preventive/PreventiveDashboard';
import { PreventiveTable } from './preventive/PreventiveTable';
import { PreventiveHistoryTab } from './preventive/PreventiveHistoryTab';
import { RegisterPreventiveModal } from './preventive/RegisterPreventiveModal';
import { UpdateReadingModal } from './preventive/UpdateReadingModal';
import {
  Wrench,
  LayoutDashboard,
  ListFilter,
  History,
  Plus,
  Gauge,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  FileText,
  X,
} from 'lucide-react';

interface PreventiveMaintenanceTabProps {
  equipments: Equipment[];
  plans: PreventivePlan[];
  records: PreventiveRecord[];
  initialStatusFilter?: string;
  initialEquipmentId?: string;
  onSavePlan: (plan: PreventivePlan) => void;
  onDeletePlan?: (planId: string, equipmentId: string) => void;
  onSaveRecord: (
    record: PreventiveRecord,
    updatedPlan?: PreventivePlan,
    updatedEquipment?: Equipment
  ) => void;
  onDeleteRecord: (id: string) => void;
  onUpdateEquipment: (equipment: Equipment) => void;
  onResetPreventiveData?: () => Promise<void> | void;
  userRole?: UserRole;
}

type SubView = 'dashboard' | 'table' | 'history';

export const PreventiveMaintenanceTab: React.FC<PreventiveMaintenanceTabProps> = ({
  equipments,
  plans,
  records,
  initialStatusFilter,
  initialEquipmentId,
  onSavePlan,
  onDeletePlan,
  onSaveRecord,
  onDeleteRecord,
  onUpdateEquipment,
  onResetPreventiveData,
  userRole = 'developer',
}) => {
  const [activeSubView, setActiveSubView] = useState<SubView>('table');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(initialEquipmentId || null);

  // Reset confirmation state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [modalInitialEquipment, setModalInitialEquipment] = useState<Equipment | null>(null);

  const [isUpdateReadingModalOpen, setIsUpdateReadingModalOpen] = useState(false);
  const [updateReadingEquipment, setUpdateReadingEquipment] = useState<Equipment | null>(null);

  // Calculate preventive state only for equipments with a registered preventive
  const calculations: PreventiveCalculation[] = useMemo(() => {
    return buildFleetPreventives(equipments, plans);
  }, [equipments, plans]);

  // Handlers
  const handleSelectEquipmentForDetail = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
    const eq = equipments.find((e) => e.id === equipmentId);
    if (eq) {
      handleOpenRegisterModal(eq);
    }
  };

  const handleOpenRegisterModal = (equipment?: Equipment) => {
    setModalInitialEquipment(equipment || equipments[0] || null);
    setIsRegisterModalOpen(true);
  };

  const handleOpenUpdateReadingModal = (equipment?: Equipment) => {
    setUpdateReadingEquipment(equipment || equipments[0] || null);
    setIsUpdateReadingModalOpen(true);
  };

  const handleConfirmReset = async () => {
    if (!onResetPreventiveData) return;
    setIsResetting(true);
    try {
      await onResetPreventiveData();
      setIsResetConfirmOpen(false);
      setResetSuccessMessage(
        'Controle de Manutenção Preventiva (PCM) zerado com sucesso! Nenhuma outra informação foi alterada.'
      );
      setTimeout(() => setResetSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Erro ao zerar dados de preventiva:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Status counts for badge
  const countVencidas = calculations.filter((c) => c.status === 'VENCIDA').length;
  const countAtencao = calculations.filter((c) => c.status === 'ATENCAO' || c.status === 'PROXIMA').length;

  return (
    <div id="pcm-preventive-maintenance-tab" className="space-y-4 w-full min-w-0">
      {/* Top Banner & Navigation Sub-Tabs */}
      <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#dcdfe4] dark:border-[#22334d]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[#111827] dark:text-white tracking-tight">
                  Controle de Manutenção Preventiva (PCM)
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  <ShieldCheck className="w-3 h-3" />
                  Makmo Infraestrutura
                </span>
              </div>
              <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                Gestão integrada de horímetro, quilometragem, intervalos e previsão contínua de revisões
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {onResetPreventiveData && (
              <button
                onClick={() => setIsResetConfirmOpen(true)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1.5 transition-colors"
                title="Zerar todos os dados do PCM para iniciar do zero"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Zerar PCM</span>
              </button>
            )}

            <button
              onClick={() => {
                exportPreventivesToPDF(calculations, equipments, {
                  title: 'ACOMPANHAMENTO DE PREVENTIVAS',
                  filterInfo: `${calculations.length} equipamento(s) sob monitoramento ativo`,
                });
              }}
              disabled={calculations.length === 0}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Exportar relatório oficial de preventivas em PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar</span> PDF
            </button>

            <button
              onClick={() => handleOpenUpdateReadingModal()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#dcdfe4] dark:border-[#334155] text-[#374151] dark:text-[#cbd5e1] hover:bg-gray-100 dark:hover:bg-[#1e293b] flex items-center gap-1.5 transition-colors"
              title="Atualizar leitura de horímetro ou KM de um equipamento"
            >
              <Gauge className="w-3.5 h-3.5 text-amber-500" />
              <span>Atualizar Leitura</span>
            </button>

            <button
              onClick={() => handleOpenRegisterModal()}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-xs"
              title="Registrar nova preventiva executada"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Preventiva</span>
            </button>
          </div>
        </div>

        {resetSuccessMessage && (
          <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-medium">{resetSuccessMessage}</span>
          </div>
        )}

        {/* Sub-Navigation Buttons */}
        <div className="flex items-center gap-1.5 pt-3 overflow-x-auto">
          <button
            onClick={() => setActiveSubView('dashboard')}
            className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSubView === 'dashboard'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-[#f8fafc] dark:bg-[#0f172a] text-[#4b5563] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-white border border-[#e5e7eb] dark:border-[#1e293b]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard & Indicadores</span>
            {countVencidas > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-extrabold animate-pulse">
                {countVencidas}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubView('table')}
            className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSubView === 'table'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-[#f8fafc] dark:bg-[#0f172a] text-[#4b5563] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-white border border-[#e5e7eb] dark:border-[#1e293b]'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>Acompanhamento de Preventivas</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#e5e7eb] dark:bg-[#1e293b] text-[#374151] dark:text-[#cbd5e1] font-mono font-bold">
              {equipments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubView('history')}
            className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSubView === 'history'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-[#f8fafc] dark:bg-[#0f172a] text-[#4b5563] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-white border border-[#e5e7eb] dark:border-[#1e293b]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico de Preventivas</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono font-bold">
              {records.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area based on activeSubView */}
      {activeSubView === 'dashboard' && (
        <PreventiveDashboard
          calculations={calculations}
          records={records}
          equipments={equipments}
          onSelectEquipmentForDetail={handleSelectEquipmentForDetail}
          onOpenRegisterModal={handleOpenRegisterModal}
          onOpenUpdateReadingModal={handleOpenUpdateReadingModal}
        />
      )}

      {activeSubView === 'table' && (
        <PreventiveTable
          calculations={calculations}
          equipments={equipments}
          plans={plans}
          initialStatus={initialStatusFilter}
          initialSearch={
            initialEquipmentId
              ? equipments.find((e) => e.id === initialEquipmentId)?.prefix ||
                equipments.find((e) => e.id === initialEquipmentId)?.plate ||
                ''
              : undefined
          }
          onSelectEquipmentForDetail={handleSelectEquipmentForDetail}
          onOpenRegisterModal={handleOpenRegisterModal}
          onOpenUpdateReadingModal={handleOpenUpdateReadingModal}
          onSavePlan={onSavePlan}
          onDeletePlan={onDeletePlan}
          onUpdateEquipment={onUpdateEquipment}
          userRole={userRole}
        />
      )}

      {activeSubView === 'history' && (
        <PreventiveHistoryTab
          records={records}
          equipments={equipments}
          onDeleteRecord={onDeleteRecord}
          userRole={userRole}
        />
      )}

      {/* Register Preventive Modal (Requirement 9) */}
      <RegisterPreventiveModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        equipments={equipments}
        plans={plans}
        initialEquipment={modalInitialEquipment}
        onSaveRecord={onSaveRecord}
      />

      {/* Update Reading Modal (Requirement 11) */}
      <UpdateReadingModal
        isOpen={isUpdateReadingModalOpen}
        onClose={() => setIsUpdateReadingModalOpen(false)}
        equipment={updateReadingEquipment}
        onSaveReading={onUpdateEquipment}
      />

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-100 dark:bg-red-950/60 rounded-xl text-red-600 dark:text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#111827] dark:text-white">
                  Zerar Dados do PCM?
                </h3>
                <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] leading-relaxed">
                  Esta ação limpará todos os <strong>planos personalizados</strong> e o{' '}
                  <strong>histórico de revisões preventivas</strong> para que você comece os cadastros
                  completamente do zero.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200">
              <p className="font-semibold mb-1">O que NÃO será afetado:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-800 dark:text-blue-300">
                <li>A frota de equipamentos cadastrados permanece intacta.</li>
                <li>Os apontamentos da Parte Diária permanecem intactos.</li>
                <li>O controle e abastecimentos de Diesel permanecem intactos.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5e7eb] dark:border-[#1e293b]">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                disabled={isResetting}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#dcdfe4] dark:border-[#334155] text-[#374151] dark:text-[#cbd5e1] hover:bg-gray-100 dark:hover:bg-[#1e293b] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
              >
                {isResetting ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Zerando PCM...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirmar e Zerar PCM</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
