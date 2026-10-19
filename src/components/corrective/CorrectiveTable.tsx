import React, { useState } from 'react';
import {
  Wrench,
  Camera,
  Eye,
  Edit2,
  Trash2,
  Clock,
  Calendar,
  AlertCircle,
  Truck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  History,
} from 'lucide-react';
import { CorrectiveMaintenance, CorrectiveStatus } from '../../types';

interface CorrectiveTableProps {
  records: CorrectiveMaintenance[];
  onViewDetail: (record: CorrectiveMaintenance) => void;
  onEdit: (record: CorrectiveMaintenance) => void;
  onDelete: (id: string) => void;
  onOpenEquipmentHistory: (prefix: string) => void;
  onSelectPhoto: (photoUrl: string, title: string, name?: string, photoId?: string) => void;
}

export const CorrectiveTable: React.FC<CorrectiveTableProps> = ({
  records,
  onViewDetail,
  onEdit,
  onDelete,
  onOpenEquipmentHistory,
  onSelectPhoto,
}) => {
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const totalPages = Math.ceil(records.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentRecords = records.slice(startIndex, startIndex + itemsPerPage);

  const getStatusBadge = (status: CorrectiveStatus) => {
    switch (status) {
      case 'Concluída':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Concluída
          </span>
        );
      case 'Em Análise':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            Em Análise
          </span>
        );
      case 'Aberta':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Aberta
          </span>
        );
      case 'Em manutenção':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Em manutenção
          </span>
        );
      case 'Aguardando peça':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            Aguardando peça
          </span>
        );
      case 'Aguardando fornecedor':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            Aguardando fornecedor
          </span>
        );
      case 'Cancelada':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            Cancelada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          {/* Table Header */}
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700/80">
            <tr>
              <th scope="col" className="py-3 px-3.5 whitespace-nowrap">
                O.S.
              </th>
              <th scope="col" className="py-3 px-3 whitespace-nowrap">
                Abertura / Conc.
              </th>
              <th scope="col" className="py-3 px-3 whitespace-nowrap">
                Placa
              </th>
              <th scope="col" className="py-3 px-3 whitespace-nowrap">
                Equipamento
              </th>
              <th scope="col" className="py-3 px-3 whitespace-nowrap">
                Fornecedor / Obra
              </th>
              <th scope="col" className="py-3 px-4 min-w-[200px]">
                Falha & Componente
              </th>
              <th scope="col" className="py-3 px-4 min-w-[200px]">
                Serviço Realizado
              </th>
              <th scope="col" className="py-3 px-3 text-center whitespace-nowrap">
                Status da OS
              </th>
              <th scope="col" className="py-3 px-3 text-center whitespace-nowrap">
                Parado
              </th>
              <th scope="col" className="py-3 px-2.5 text-center whitespace-nowrap">
                Fotos
              </th>
              <th scope="col" className="py-3 px-3.5 text-right whitespace-nowrap">
                Ações
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {currentRecords.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-14 text-center text-slate-400">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 border border-blue-100 dark:border-blue-900/50">
                    <Wrench className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {records.length === 0
                      ? 'Esta obra ainda não possui dados cadastrados.'
                      : 'Nenhum registro encontrado.'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Nenhum registro encontrado. Módulo zerado e pronto para novos lançamentos. Clique no botão <strong>"➕ Nova Corretiva"</strong> acima para registrar a primeira ordem de serviço desta obra.
                  </p>
                </td>
              </tr>
            ) : (
              currentRecords.map((r) => {
                const photoCount = r.photos ? r.photos.length : 0;
                return (
                  <tr
                    key={r.id}
                    onClick={() => onViewDetail(r)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    {/* O.S. Number */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-bold font-mono text-blue-600 dark:text-blue-400 group-hover:underline">
                        {r.osNumber}
                      </span>
                    </td>

                    {/* Dates */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-mono text-slate-800 dark:text-slate-200">
                        {r.openDate ? r.openDate.split('-').reverse().join('/') : '-'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {r.completionDate
                          ? r.completionDate.split('-').reverse().join('/')
                          : r.status === 'Concluída'
                          ? 'Concluída'
                          : 'Em andamento'}
                      </div>
                    </td>

                    {/* Plate with Equipment History link */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEquipmentHistory(r.plate || r.prefix);
                        }}
                        className="inline-flex items-center gap-1 font-bold font-mono text-slate-900 dark:text-slate-100 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 transition-colors"
                        title="Ver histórico desta máquina"
                      >
                        <span>{r.plate || r.prefix}</span>
                        <History className="w-3 h-3 text-slate-400" />
                      </button>
                    </td>

                    {/* Equipment Type */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {r.equipmentType}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {r.brand || ''} {r.model || ''}
                      </div>
                    </td>

                    {/* Supplier & Location */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                        {r.supplier}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                        {r.location}
                      </div>
                    </td>

                    {/* Failure & Component */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {r.failureType}
                      </div>
                      {r.affectedSystem && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          • {r.affectedSystem}
                        </div>
                      )}
                    </td>

                    {/* Service Performed */}
                    <td className="py-3 px-4">
                      <div className="text-slate-700 dark:text-slate-300 line-clamp-2 text-xs">
                        {r.servicePerformed || r.problemDescription}
                      </div>
                      {r.mechanic && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Mec: {r.mechanic}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {getStatusBadge(r.status)}
                    </td>

                    {/* Stopped Days */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/60">
                        {r.stoppedDays} {r.stoppedDays === 1 ? 'dia' : 'dias'}
                      </span>
                    </td>

                    {/* Photos Count & Icon */}
                    <td className="py-3 px-2.5 text-center whitespace-nowrap">
                      {photoCount > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (r.photos && r.photos.length === 1) {
                              const p = r.photos[0];
                              onSelectPhoto(p.dataUrl || '', `${r.osNumber} - ${r.plate || r.prefix}`, p.name, p.id);
                            } else {
                              onViewDetail(r);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                          title="Clique para ver evidências fotográficas"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span className="font-bold text-xs">{photoCount}</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">-</span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onViewDetail(r)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Ver Detalhes da O.S."
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(r)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Editar Corretiva"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Confirma a exclusão da ordem de serviço ${r.osNumber}?`)) {
                              onDelete(r.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Excluir Corretiva"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({records.length} registros no total)
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-xs">{currentPage}</span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
