import React, { useState, useEffect, useMemo } from 'react';
import {
  Equipment,
  PreventivePlan,
  PreventiveIntervalType,
  PreventiveUnit,
} from '../../types';
import {
  PREVENTIVE_INTERVAL_OPTIONS,
  formatMetricWithUnit,
} from '../../utils/preventiveUtils';
import {
  X,
  Pencil,
  Calendar,
  Gauge,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';

interface EditPreventiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PreventivePlan | null;
  equipment: Equipment | null;
  onSavePlan: (updatedPlan: PreventivePlan) => void;
  onUpdateEquipment?: (updatedEquipment: Equipment) => void;
}

export const EditPreventiveModal: React.FC<EditPreventiveModalProps> = ({
  isOpen,
  onClose,
  plan,
  equipment,
  onSavePlan,
  onUpdateEquipment,
}) => {
  if (!isOpen || !plan || !equipment) return null;

  const isKm = plan.intervalUnit === 'KM';

  // Form states initialized with current plan values
  const [intervalType, setIntervalType] = useState<PreventiveIntervalType>(plan.intervalType);
  const [customIntervalValue, setCustomIntervalValue] = useState<string>(
    plan.customIntervalValue ? String(plan.customIntervalValue) : ''
  );
  const [lastReviewDate, setLastReviewDate] = useState<string>(
    plan.lastReviewDate || new Date().toISOString().split('T')[0]
  );
  const [lastReviewValueInput, setLastReviewValueInput] = useState<string>(
    isKm
      ? String(plan.lastReviewKm ?? 0)
      : String(plan.lastReviewHourMeter ?? 0)
  );
  const [currentValueInput, setCurrentValueInput] = useState<string>(
    isKm
      ? String(equipment.currentKm ?? 0)
      : String(equipment.currentHourMeter ?? 0)
  );
  const [syncCurrentMeter, setSyncCurrentMeter] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>(plan.lastReviewNotes || '');

  // Reset form when plan changes
  useEffect(() => {
    if (plan && equipment) {
      const isKmMode = plan.intervalUnit === 'KM';
      setIntervalType(plan.intervalType);
      setCustomIntervalValue(plan.customIntervalValue ? String(plan.customIntervalValue) : '');
      setLastReviewDate(plan.lastReviewDate || new Date().toISOString().split('T')[0]);
      setLastReviewValueInput(
        isKmMode
          ? String(plan.lastReviewKm ?? 0)
          : String(plan.lastReviewHourMeter ?? 0)
      );
      setCurrentValueInput(
        isKmMode
          ? String(equipment.currentKm ?? 0)
          : String(equipment.currentHourMeter ?? 0)
      );
      setNotes(plan.lastReviewNotes || '');
    }
  }, [plan, equipment]);

  // Helper for flexible Brazilian/international number parsing (e.g. "1.500,5" or "1500.5")
  const parseInputValue = (val: string): number => {
    if (!val || val.trim() === '') return 0;
    const clean = val.trim();
    const num = clean.includes(',')
      ? parseFloat(clean.replace(/\./g, '').replace(',', '.'))
      : parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Derived interval value
  const numericInterval = useMemo(() => {
    if (intervalType === 'Outro') {
      const val = parseInputValue(customIntervalValue);
      return val <= 0 ? 250 : val;
    }
    const option = PREVENTIVE_INTERVAL_OPTIONS.find((opt) => opt.label === intervalType);
    return option ? option.value : (isKm ? 10000 : 250);
  }, [intervalType, customIntervalValue, isKm]);

  // Real-time calculation preview
  const previewCalculation = useMemo(() => {
    const lastRevVal = parseInputValue(lastReviewValueInput);
    const currVal = parseInputValue(currentValueInput);
    const nextRev = lastRevVal + numericInterval;
    const remaining = nextRev - currVal;
    const isOverdue = remaining <= 0;
    const overdue = isOverdue ? Math.abs(remaining) : 0;

    let reviewThreshold = 100;
    if (isKm) {
      reviewThreshold = numericInterval === 10000 ? 2000 : Math.round(numericInterval * 0.2);
    } else {
      reviewThreshold = numericInterval === 250 ? 100 : Math.round(numericInterval * 0.4);
    }

    let status = 'EM_DIA';
    let statusLabel = 'EM DIA';
    let statusBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';

    if (isOverdue) {
      status = 'VENCIDA';
      statusLabel = 'VENCIDA';
      statusBg = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
    } else if (remaining <= reviewThreshold) {
      status = 'FAZER_REVISAO';
      statusLabel = 'FAZER REVISÃO';
      statusBg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    }

    return {
      nextRev,
      remaining,
      isOverdue,
      overdue,
      status,
      statusLabel,
      statusBg,
    };
  }, [lastReviewValueInput, currentValueInput, numericInterval, isKm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const lastRevVal = parseInputValue(lastReviewValueInput);
    const currVal = parseInputValue(currentValueInput);

    // Build updated plan
    const updatedPlan: PreventivePlan = {
      ...plan,
      intervalType,
      intervalValue: numericInterval,
      customIntervalValue: intervalType === 'Outro' ? numericInterval : undefined,
      lastReviewDate: lastReviewDate || new Date().toISOString().split('T')[0],
      lastReviewHourMeter: isKm ? undefined : lastRevVal,
      lastReviewKm: isKm ? lastRevVal : undefined,
      lastReviewNotes: notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    onSavePlan(updatedPlan);

    // If user chose to sync the equipment's current meter/KM
    if (syncCurrentMeter && onUpdateEquipment) {
      const updatedEq: Equipment = {
        ...equipment,
        currentHourMeter: isKm ? equipment.currentHourMeter : currVal,
        currentKm: isKm ? currVal : equipment.currentKm,
        lastHourMeterDate: isKm ? equipment.lastHourMeterDate : lastReviewDate,
        lastKmDate: isKm ? lastReviewDate : equipment.lastKmDate,
        updatedAt: new Date().toISOString(),
      };
      onUpdateEquipment(updatedEq);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-2xl max-w-xl w-full p-4 sm:p-5 shadow-2xl space-y-4 my-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#f1f5f9] dark:border-[#1e293b]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#111827] dark:text-white">
                Editar Manutenção Preventiva
              </h3>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                {equipment.prefix || equipment.plate || equipment.code} • {equipment.type} (
                {equipment.brand || ''} {equipment.model || ''})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94a3b8] hover:text-[#111827] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Intervalo de Preventiva */}
          <div>
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1] mb-1">
              Intervalo de Manutenção Preventiva:
            </label>
            <select
              value={intervalType}
              onChange={(e) => setIntervalType(e.target.value as PreventiveIntervalType)}
              className="w-full text-xs font-medium py-2 px-3 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {PREVENTIVE_INTERVAL_OPTIONS.filter((opt) => opt.unit === plan.intervalUnit).map(
                (opt) => (
                  <option key={opt.label} value={opt.label}>
                    {opt.label}
                  </option>
                )
              )}
              <option value="Outro">Outro intervalo personalizado</option>
            </select>
          </div>

          {/* Custom interval value input if 'Outro' */}
          {intervalType === 'Outro' && (
            <div>
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1] mb-1">
                Valor do Intervalo ({isKm ? 'KM' : 'Horas'}):
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={customIntervalValue}
                onChange={(e) => setCustomIntervalValue(e.target.value)}
                placeholder={isKm ? 'Ex: 15000' : 'Ex: 350'}
                className="w-full text-xs font-mono py-2 px-3 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Data da Última Revisão e Valor da Última Revisão */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1] mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>Data da Última Revisão (DD/MM/AAAA):</span>
              </label>
              <input
                type="date"
                required
                value={lastReviewDate}
                onChange={(e) => setLastReviewDate(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1] mb-1 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-500" />
                <span>Última Revisão ({isKm ? 'KM' : 'Horímetro'}):</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={lastReviewValueInput}
                onChange={(e) => setLastReviewValueInput(e.target.value)}
                placeholder="0"
                className="w-full text-xs font-mono font-bold py-2 px-3 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Leitura Atual do Equipamento */}
          <div className="p-3 bg-slate-50 dark:bg-[#0b1322] rounded-xl border border-slate-200 dark:border-[#1e293b] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#334155] dark:text-[#cbd5e1] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Último {isKm ? 'KM' : 'Horímetro'} Atual da Máquina:</span>
              </label>
              <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                Usado para calcular Faltam/Excedente
              </span>
            </div>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={currentValueInput}
              onChange={(e) => setCurrentValueInput(e.target.value)}
              className="w-full text-xs font-mono font-bold py-2 px-3 bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-blue-600 dark:text-blue-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <label className="flex items-center gap-2 pt-1 text-[11px] text-[#475569] dark:text-[#94a3b8] cursor-pointer">
              <input
                type="checkbox"
                checked={syncCurrentMeter}
                onChange={(e) => setSyncCurrentMeter(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Atualizar também o horímetro/KM cadastrado na base do equipamento</span>
            </label>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1] mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#64748b]" />
              <span>Observações da Revisão (Opcional):</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Troca de óleo de motor e filtros realizada na oficina central."
              className="w-full text-xs py-2 px-3 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Live Preview Card */}
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Projeção da Tabela com esta alteração:</span>
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${previewCalculation.statusBg}`}
              >
                {previewCalculation.statusLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-white dark:bg-[#161f30] p-2 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] block font-sans">
                  Próxima Revisão:
                </span>
                <span className="font-bold text-[#0f172a] dark:text-white">
                  {formatMetricWithUnit(previewCalculation.nextRev, plan.intervalUnit)}
                </span>
              </div>
              <div className="bg-white dark:bg-[#161f30] p-2 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] block font-sans">
                  {previewCalculation.isOverdue ? 'Excedente:' : 'Faltam:'}
                </span>
                <span
                  className={
                    previewCalculation.isOverdue
                      ? 'font-black text-rose-600 dark:text-rose-400'
                      : previewCalculation.status === 'FAZER_REVISAO'
                      ? 'font-black text-amber-600 dark:text-amber-400'
                      : 'font-bold text-emerald-600 dark:text-emerald-400'
                  }
                >
                  {previewCalculation.isOverdue
                    ? `-${formatMetricWithUnit(previewCalculation.overdue, plan.intervalUnit)}`
                    : formatMetricWithUnit(previewCalculation.remaining, plan.intervalUnit)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#f1f5f9] dark:border-[#1e293b]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#475569] dark:text-[#cbd5e1] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
