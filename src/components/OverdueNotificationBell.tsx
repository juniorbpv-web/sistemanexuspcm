import React, { useEffect, useRef } from 'react';
import {
  Bell,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Wrench,
  Clock,
  MapPin,
  CheckCircle2,
  X,
  Gauge,
  ArrowRight,
} from 'lucide-react';
import { Equipment, PreventiveCalculation } from '../types';
import { formatMetricWithUnit } from '../utils/preventiveUtils';

export interface OverduePreventiveItem {
  equipment: Equipment;
  calc: PreventiveCalculation;
}

interface OverdueNotificationBellProps {
  overdueItems: OverduePreventiveItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onViewAllOverdue: () => void;
  onSelectEquipment: (equipmentId: string) => void;
}

export const OverdueNotificationBell: React.FC<OverdueNotificationBellProps> = ({
  overdueItems,
  isOpen,
  onToggle,
  onClose,
  onViewAllOverdue,
  onSelectEquipment,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const overdueCount = overdueItems.length;

  // Fechar ao clicar fora ou apertar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative inline-block" ref={panelRef}>
      {/* Botão do Sino com Badge Dinâmico */}
      <button
        id="btn-bell-preventive-overdue"
        type="button"
        onClick={onToggle}
        aria-label={`Notificações de preventivas vencidas (${overdueCount})`}
        aria-expanded={isOpen}
        title={
          overdueCount > 0
            ? `${overdueCount} equipamento(s) com manutenção preventiva VENCIDA. Clique para visualização rápida.`
            : 'Nenhuma preventiva vencida no momento'
        }
        className={`relative p-1.5 rounded-lg border transition-all h-7.5 w-7.5 flex items-center justify-center cursor-pointer ${
          overdueCount > 0
            ? 'border-rose-300 dark:border-rose-800/80 bg-rose-50/90 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 shadow-xs'
            : 'border-[#dcdfe4] dark:border-[#333333] bg-[#f8fafc] dark:bg-[#1e1e1e] text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:bg-[#edf2f7] dark:hover:bg-[#262626]'
        }`}
      >
        <Bell
          className={`w-3.5 h-3.5 transition-transform ${
            overdueCount > 0 ? 'animate-bell text-rose-600 dark:text-rose-400' : ''
          }`}
        />

        {/* Badge Dinâmico */}
        {overdueCount > 0 && (
          <span
            id="badge-overdue-count"
            className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 bg-rose-600 text-white font-mono font-black text-[9px] rounded-full flex items-center justify-center border-2 border-white dark:border-[#111625] shadow-sm animate-pulse"
          >
            {overdueCount > 99 ? '99+' : overdueCount}
          </span>
        )}
      </button>

      {/* Dropdown / Modal Flyout de Visualização Rápida */}
      {isOpen && (
        <div
          id="popover-overdue-preventives"
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header do Popover */}
          <div className="p-3 bg-gradient-to-r from-rose-50 to-amber-50/50 dark:from-rose-950/40 dark:to-[#161f30] border-b border-[#eaecef] dark:border-[#22334d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#111827] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>Preventivas Vencidas</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-rose-600 text-white">
                    {overdueCount}
                  </span>
                </h4>
                <p className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Equipamentos que atingiram ou ultrapassaram o limite de revisão
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-md text-[#6b7280] hover:text-[#111827] dark:text-[#9ca3af] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Lista de Máquinas Vencidas */}
          <div className="max-h-[320px] overflow-y-auto divide-y divide-[#eaecef] dark:divide-[#22334d]">
            {overdueCount === 0 ? (
              <div className="p-6 text-center text-xs text-[#6b7280] dark:text-[#9ca3af] flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <p className="font-semibold text-[#111827] dark:text-[#f3f4f6]">
                  Todas as revisões estão em dia!
                </p>
                <p className="text-[11px] opacity-75">
                  Nenhum equipamento da frota possui preventiva vencida no momento.
                </p>
              </div>
            ) : (
              overdueItems.map(({ equipment, calc }) => {
                const code = equipment.prefix || equipment.plate || equipment.code;
                const overdueAmount = calc.overdueValue || 0;
                const unit = calc.unit || 'HORAS';

                return (
                  <div
                    key={equipment.id}
                    onClick={() => onSelectEquipment(equipment.id)}
                    className="p-3 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 cursor-pointer transition-colors group flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-[#111827] dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                          {code}
                        </span>
                        {equipment.plate && equipment.plate !== code && (
                          <span className="text-[10px] font-mono text-[#6b7280] dark:text-[#9ca3af]">
                            ({equipment.plate})
                          </span>
                        )}
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          Vencida
                        </span>
                      </div>

                      <div className="text-[11px] text-[#4b5563] dark:text-[#cbd5e1] truncate mt-0.5">
                        {equipment.type || 'Equipamento'}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Gauge className="w-3 h-3 text-amber-500" />
                          Atual: {formatMetricWithUnit(calc.currentValue, unit)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold font-mono">
                          Excedente: +{formatMetricWithUnit(overdueAmount, unit)}
                        </span>
                      </div>

                      {equipment.location && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                          <MapPin className="w-2.5 h-2.5 text-blue-500" />
                          <span>{equipment.location}</span>
                          {equipment.supplier && (
                            <span className="opacity-75">• {equipment.supplier}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end shrink-0 pt-0.5">
                      <span className="p-1 rounded text-[#9ca3af] group-hover:text-rose-600 dark:group-hover:text-rose-400 group-hover:bg-rose-100 dark:group-hover:bg-rose-950 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé com Link para visualização completa no PCM */}
          <div className="p-2.5 bg-[#f8fafc] dark:bg-[#111625] border-t border-[#eaecef] dark:border-[#22334d] flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
              Clique em um item para abrir o PCM
            </span>

            <button
              id="btn-view-all-overdue"
              type="button"
              onClick={onViewAllOverdue}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <span>Ver todas no PCM</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
