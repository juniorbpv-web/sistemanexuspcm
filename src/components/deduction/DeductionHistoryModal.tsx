import React from 'react';
import { MeasurementDeduction } from '../../types';
import { formatCurrencyBRL, formatDateDDMMAAAA } from '../../utils/deductionUtils';
import { X, History, User, Calendar, Clock, ArrowRight, ShieldCheck } from 'lucide-react';

interface DeductionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  deduction: MeasurementDeduction | null;
}

export const DeductionHistoryModal: React.FC<DeductionHistoryModalProps> = ({
  isOpen,
  onClose,
  deduction,
}) => {
  if (!isOpen || !deduction) return null;

  const history = deduction.history || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Histórico & Auditoria de Paralisação
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {deduction.prefix} • {deduction.equipmentType} ({deduction.supplier})
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
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Current Status Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs">
            <div>
              <span className="text-[10px] text-slate-700 dark:text-slate-300 uppercase block">Status Atual</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                {deduction.status}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-700 dark:text-slate-300 uppercase block">Diária Contratual</span>
              <span className="font-bold text-sky-600 dark:text-sky-400 block mt-0.5">
                {formatCurrencyBRL(deduction.dailyRate)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-700 dark:text-slate-300 uppercase block">Dias Parados</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
                {deduction.stoppedDays} dias
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-700 dark:text-slate-300 uppercase block">Desconto Apurado</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {formatCurrencyBRL(deduction.discountValue)}
              </span>
            </div>
          </div>

          {/* Timeline Audit Logs */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Trilha de Auditoria e Alterações
            </h4>

            {history.length > 0 ? (
              <div className="relative pl-6 border-l-2 border-blue-200 dark:border-blue-900/50 space-y-5 my-2">
                {history.map((item, idx) => {
                  const dateFormatted = new Date(item.timestamp).toLocaleString('pt-BR');
                  return (
                    <div key={item.id || idx} className="relative">
                      {/* Node circle */}
                      <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-2xs" />

                      <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 shadow-2xs space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                            {item.action}
                          </span>
                          <span className="text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {dateFormatted}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                          {item.description}
                        </p>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>Responsável: </span>
                          <strong className="text-slate-700 dark:text-slate-300 font-medium">
                            {item.user || 'Sistema'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                Nenhum log de alteração registrado.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
