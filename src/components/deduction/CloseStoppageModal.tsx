import React, { useState, useMemo } from 'react';
import { MeasurementDeduction, MeasurementDeductionStatus, AuthUser } from '../../types';
import {
  calculateDaysBetween,
  calculateDiscount,
  formatCurrencyBRL,
  formatDateDDMMAAAA,
  getTodayDateIso,
} from '../../utils/deductionUtils';
import { X, CheckCircle2, Clock, Calendar, AlertTriangle } from 'lucide-react';

interface CloseStoppageModalProps {
  isOpen: boolean;
  onClose: () => void;
  deduction: MeasurementDeduction | null;
  onConfirmClose: (updated: MeasurementDeduction) => void;
  currentUser?: AuthUser | null;
}

export const CloseStoppageModal: React.FC<CloseStoppageModalProps> = ({
  isOpen,
  onClose,
  deduction,
  onConfirmClose,
  currentUser,
}) => {
  const [endDate, setEndDate] = useState<string>(getTodayDateIso());
  const [targetStatus, setTargetStatus] = useState<MeasurementDeductionStatus>('FINALIZADO');
  const [closureNotes, setClosureNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stoppedDays = useMemo(() => {
    if (!deduction || !endDate) return 0;
    return calculateDaysBetween(deduction.startDate, endDate, false);
  }, [deduction, endDate]);

  const discountValue = useMemo(() => {
    if (!deduction) return 0;
    return calculateDiscount(deduction.dailyRate, stoppedDays);
  }, [deduction, stoppedDays]);

  if (!isOpen || !deduction) return null;

  const handleConfirm = () => {
    if (!endDate) {
      setErrorMessage('Informe a data final para encerrar a paralisação.');
      return;
    }
    if (endDate < deduction.startDate) {
      setErrorMessage('A data final não pode ser anterior à data inicial da paralisação.');
      return;
    }

    const nowIso = new Date().toISOString();
    const userIdentifier = currentUser?.username || currentUser?.name || 'pcm@makmo.com.br';

    const historyLog = [...(deduction.history || [])];
    historyLog.push({
      id: `hist-${Date.now()}`,
      timestamp: nowIso,
      user: userIdentifier,
      action: 'ENCERRAMENTO',
      description: `Paralisação encerrada no dia ${formatDateDDMMAAAA(
        endDate
      )}. Total de ${stoppedDays} dias parados apurados. Desconto final: ${formatCurrencyBRL(
        discountValue
      )}. Status definido para ${targetStatus}.${closureNotes ? ` Obs: ${closureNotes}` : ''}`,
    });

    const updated: MeasurementDeduction = {
      ...deduction,
      endDate,
      isOngoing: false,
      stoppedDays,
      discountValue,
      status: targetStatus,
      closedAt: nowIso,
      closedBy: userIdentifier,
      updatedAt: nowIso,
      notes: closureNotes
        ? `${deduction.notes ? deduction.notes + ' | ' : ''}Liberação: ${closureNotes}`
        : deduction.notes,
      history: historyLog,
    };

    onConfirmClose(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Encerrar Paralisação
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Fixar data de liberação e calcular o desconto definitivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Equipment Quick Info */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-700 dark:text-slate-300">Equipamento:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {deduction.prefix} • {deduction.equipmentType}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700 dark:text-slate-300">Fornecedor / Obra:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {deduction.supplier} ({deduction.location})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700 dark:text-slate-300">Início da Paralisação:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {formatDateDDMMAAAA(deduction.startDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700 dark:text-slate-300">Diária Contratual (÷30):</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formatCurrencyBRL(deduction.dailyRate)}
              </span>
            </div>
          </div>

          {/* End Date Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Data de Encerramento / Liberação *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          {/* Recalculated Values Card */}
          <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 text-center space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-semibold block">
                  Total Dias Parados
                </span>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {stoppedDays} dias
                </span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-semibold block">
                  Desconto Final
                </span>
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatCurrencyBRL(discountValue)}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono">
              Fórmula: {formatCurrencyBRL(deduction.dailyRate)} × {stoppedDays} dias = {formatCurrencyBRL(discountValue)}
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Atualizar Status Para
            </label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as MeasurementDeductionStatus)}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
            >
              <option value="FINALIZADO">FINALIZADO (Paralisação Encerrada)</option>
              <option value="DESCONTO CALCULADO">DESCONTO CALCULADO (Pronto para Faturamento)</option>
              <option value="DESCONTO APLICADO">DESCONTO APLICADO (Abatido na Medição)</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observações de Liberação (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Peça instalada, teste de carga realizado e equipamento reintegrado à frente de pavimentação..."
              value={closureNotes}
              onChange={(e) => setClosureNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Encerrar Paralisação
          </button>
        </div>
      </div>
    </div>
  );
};
