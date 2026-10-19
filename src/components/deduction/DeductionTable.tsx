import React, { useState, useMemo } from 'react';
import { MeasurementDeduction } from '../../types';
import {
  formatCurrencyBRL,
  formatDateDDMMAAAA,
  DEDUCTION_STATUSES,
} from '../../utils/deductionUtils';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  History,
  AlertCircle,
  Eye,
  Calendar,
  Building2,
  Truck,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

interface DeductionTableProps {
  deductions: MeasurementDeduction[];
  onEdit: (deduction: MeasurementDeduction) => void;
  onDelete: (id: string) => void;
  onCloseStoppage: (deduction: MeasurementDeduction) => void;
  onViewHistory: (deduction: MeasurementDeduction) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

type SortField =
  | 'prefix'
  | 'equipmentType'
  | 'supplier'
  | 'location'
  | 'measurementValue'
  | 'dailyRate'
  | 'startDate'
  | 'stoppedDays'
  | 'discountValue'
  | 'status';

export const DeductionTable: React.FC<DeductionTableProps> = ({
  deductions,
  onEdit,
  onDelete,
  onCloseStoppage,
  onViewHistory,
  searchTerm,
  onSearchChange,
}) => {
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Sort deductions
  const sortedDeductions = useMemo(() => {
    return [...deductions].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number') {
        return sortOrder === 'asc' ? aVal - (bVal || 0) : (bVal || 0) - aVal;
      }

      return 0;
    });
  }, [deductions, sortField, sortOrder]);

  // Totals for filtered list
  const totals = useMemo(() => {
    const totalDays = deductions.reduce((acc, d) => acc + (d.stoppedDays || 0), 0);
    const totalMeasurement = deductions.reduce((acc, d) => acc + (d.measurementValue || 0), 0);
    const totalDaily = deductions.reduce((acc, d) => acc + (d.dailyRate || 0), 0);
    const totalDiscount = deductions.reduce((acc, d) => acc + (d.discountValue || 0), 0);
    return {
      totalDays,
      totalMeasurement,
      totalDaily,
      totalDiscount,
    };
  }, [deductions]);

  // Status Badge Helper
  const renderStatusBadge = (deduction: MeasurementDeduction) => {
    const isOngoing = deduction.isOngoing || deduction.status === 'PARADO';
    const statusMeta = DEDUCTION_STATUSES.find((s) => s.value === deduction.status);

    if (isOngoing) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
          <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
          PARADO
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
          statusMeta?.badgeClass || 'bg-slate-100 text-slate-700 border-slate-300'
        }`}
      >
        {deduction.status}
      </span>
    );
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 inline ml-1" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 inline ml-1" />
    );
  };

  return (
    <div id="deduction-table-container" className="space-y-4">
      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                <th
                  onClick={() => handleSort('prefix')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    Prefixo
                    {renderSortIndicator('prefix')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('equipmentType')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    Equipamento
                    {renderSortIndicator('equipmentType')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('supplier')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    Fornecedor
                    {renderSortIndicator('supplier')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('location')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    Obra
                    {renderSortIndicator('location')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('measurementValue')}
                  className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    Valor Medição
                    {renderSortIndicator('measurementValue')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('dailyRate')}
                  className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    Diária (÷30)
                    {renderSortIndicator('dailyRate')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('startDate')}
                  className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Período Parado
                    {renderSortIndicator('startDate')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('stoppedDays')}
                  className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Dias
                    {renderSortIndicator('stoppedDays')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('discountValue')}
                  className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-1 text-emerald-700 dark:text-emerald-400">
                    Desconto
                    {renderSortIndicator('discountValue')}
                  </div>
                </th>
                <th className="px-4 py-3">Motivo</th>
                <th
                  onClick={() => handleSort('status')}
                  className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Status
                    {renderSortIndicator('status')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sortedDeductions.length > 0 ? (
                sortedDeductions.map((d) => {
                  const isOngoing = d.isOngoing || d.status === 'PARADO';
                  return (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* Prefixo */}
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {d.prefix}
                        </span>
                      </td>

                      {/* Equipamento */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {d.equipmentType}
                        </div>
                        {d.model && (
                          <div className="text-[11px] text-slate-700 dark:text-slate-300">
                            {d.brand} {d.model}
                          </div>
                        )}
                      </td>

                      {/* Fornecedor */}
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {d.supplier}
                      </td>

                      {/* Obra */}
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <span className="bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded text-[11px]">
                          {d.location}
                        </span>
                      </td>

                      {/* Valor Medição */}
                      <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {formatCurrencyBRL(d.measurementValue)}
                      </td>

                      {/* Diária */}
                      <td className="px-4 py-3 text-right font-medium text-sky-700 dark:text-sky-400 whitespace-nowrap">
                        {formatCurrencyBRL(d.dailyRate)}
                      </td>

                      {/* Período */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {formatDateDDMMAAAA(d.startDate)}
                        </div>
                        <div className="text-[11px]">
                          {isOngoing || !d.endDate ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              Em aberto
                            </span>
                          ) : (
                            <span className="text-slate-700 dark:text-slate-300">
                              até {formatDateDDMMAAAA(d.endDate)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Dias */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="inline-block font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/50">
                          {d.stoppedDays} d
                        </span>
                      </td>

                      {/* Desconto */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatCurrencyBRL(d.discountValue)}
                        </span>
                      </td>

                      {/* Motivo */}
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[150px] truncate" title={d.reason}>
                        <span className="truncate block font-medium">{d.reason}</span>
                        {d.notes && (
                          <span className="text-[10px] text-slate-700 dark:text-slate-300 block truncate" title={d.notes}>
                            {d.notes}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {renderStatusBadge(d)}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Encerrar Paralisação (botão rápido se ongoing ou PARADO) */}
                          {isOngoing && (
                            <button
                              onClick={() => onCloseStoppage(d)}
                              title="Encerrar Paralisação"
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Histórico & Auditoria */}
                          <button
                            onClick={() => onViewHistory(d)}
                            title="Visualizar Histórico & Auditoria"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Editar */}
                          <button
                            onClick={() => onEdit(d)}
                            title="Editar Desconto"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Excluir */}
                          {deleteConfirmId === d.id ? (
                            <div className="flex items-center gap-1 animate-in fade-in">
                              <button
                                onClick={() => {
                                  onDelete(d.id);
                                  setDeleteConfirmId(null);
                                }}
                                className="px-2 py-1 bg-rose-600 text-white rounded text-[11px] font-bold hover:bg-rose-700"
                              >
                                Sim
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-1.5 py-1 text-slate-500 hover:text-slate-700 text-[11px]"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(d.id)}
                              title="Excluir Registro"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-medium">
                        {deductions.length === 0
                          ? 'Esta obra ainda não possui dados cadastrados.'
                          : 'Nenhum registro encontrado para os filtros selecionados.'}
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        {deductions.length === 0
                          ? 'Nenhum registro encontrado. Clique em "+ Novo Desconto" para registrar uma paralisação nesta obra.'
                          : 'Nenhum registro encontrado com estes critérios.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totalizer Bottom Bar (Seção 12 Destaque) */}
        {sortedDeductions.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-700 dark:text-slate-300">
              Mostrando <strong className="text-slate-800 dark:text-slate-200">{sortedDeductions.length}</strong> registro(s) •{' '}
              Total Geral de Dias Parados: <strong className="text-amber-700 dark:text-amber-400">{totals.totalDays} dias</strong>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="text-slate-700 dark:text-slate-300">
                Soma Medições: <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrencyBRL(totals.totalMeasurement)}</span>
              </div>
              <div className="text-slate-700 dark:text-slate-300">
                Soma Diárias: <span className="font-semibold text-sky-700 dark:text-sky-400">{formatCurrencyBRL(totals.totalDaily)}</span>
              </div>
              <div className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-[11px]">
                  Total a Descontar:
                </span>
                <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                  {formatCurrencyBRL(totals.totalDiscount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
