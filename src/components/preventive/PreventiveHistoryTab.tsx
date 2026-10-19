import React, { useState, useMemo } from 'react';
import {
  PreventiveRecord,
  Equipment,
  UserRole,
} from '../../types';
import { formatMetricWithUnit, formatDateDDMMAAAA } from '../../utils/preventiveUtils';
import {
  Search,
  Calendar,
  Filter,
  Download,
  Trash2,
  Eye,
  Paperclip,
  Wrench,
  X,
  FileText,
  DollarSign,
  User,
} from 'lucide-react';

interface PreventiveHistoryTabProps {
  records: PreventiveRecord[];
  equipments: Equipment[];
  onDeleteRecord: (id: string) => void;
  userRole?: UserRole;
}

export const PreventiveHistoryTab: React.FC<PreventiveHistoryTabProps> = ({
  records,
  equipments,
  onDeleteRecord,
  userRole = 'developer',
}) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEqId, setSelectedEqId] = useState<string>('todos');
  const [selectedType, setSelectedType] = useState<string>('todos');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modal for viewing record details & attachments
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<PreventiveRecord | null>(
    null
  );

  // Equipment lookup map
  const equipmentMap = useMemo(() => {
    const map = new Map<string, Equipment>();
    equipments.forEach((e) => map.set(e.id, e));
    return map;
  }, [equipments]);

  // Unique types from records
  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.type) set.add(r.type);
    });
    return Array.from(set).sort();
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const code = (rec.equipmentCode || '').toLowerCase();
        const services = (rec.servicesPerformed || '').toLowerCase();
        const parts = (rec.partsReplaced || '').toLowerCase();
        const resp = (rec.responsible || '').toLowerCase();
        const os = (rec.workOrderNumber || '').toLowerCase();
        const eq = equipmentMap.get(rec.equipmentId);
        const eqType = (eq?.type || '').toLowerCase();

        const match =
          code.includes(q) ||
          services.includes(q) ||
          parts.includes(q) ||
          resp.includes(q) ||
          os.includes(q) ||
          eqType.includes(q);

        if (!match) return false;
      }

      // Equipment filter
      if (selectedEqId !== 'todos' && rec.equipmentId !== selectedEqId) return false;

      // Type filter
      if (selectedType !== 'todos' && rec.type !== selectedType) return false;

      // Date range filter
      if (startDate && rec.date < startDate) return false;
      if (endDate && rec.date > endDate) return false;

      return true;
    });
  }, [records, searchTerm, selectedEqId, selectedType, startDate, endDate, equipmentMap]);

  // Export history to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;

    const headers = [
      'Data',
      'Prefixo',
      'Equipamento',
      'Horimetro',
      'KM',
      'Tipo Preventiva',
      'Proxima Revisao',
      'Servicos Realizados',
      'Pecas Substituidas',
      'Responsavel',
      'N_OS',
      'Custo_RS',
      'Observacoes',
    ];

    const rows = filteredRecords.map((r) => {
      const eq = equipmentMap.get(r.equipmentId);
      return [
        r.date,
        `"${r.equipmentCode || ''}"`,
        `"${eq?.type || ''}"`,
        r.hourMeter !== undefined ? r.hourMeter : '',
        r.km !== undefined ? r.km : '',
        `"${r.type || ''}"`,
        r.nextReviewValue !== undefined ? r.nextReviewValue : '',
        `"${(r.servicesPerformed || '').replace(/"/g, '""')}"`,
        `"${(r.partsReplaced || '').replace(/"/g, '""')}"`,
        `"${(r.responsible || '').replace(/"/g, '""')}"`,
        `"${r.workOrderNumber || ''}"`,
        r.cost || '',
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `makmo_historico_preventivas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="pcm-history-tab" className="space-y-3.5">
      {/* Search and Filters Header (Requirement 10) */}
      <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar no histórico por prefixo, equipamento, peças, serviços ou responsável..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors shadow-xs"
              title="Exportar histórico de manutenções para Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Filters Multi-Select Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[#f3f4f6] dark:border-[#1e293b]">
          {/* Equipamento */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] mb-1">
              Equipamento:
            </label>
            <select
              value={selectedEqId}
              onChange={(e) => setSelectedEqId(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-md text-[#111827] dark:text-white"
            >
              <option value="todos">Todos os Equipamentos ({equipments.length})</option>
              {equipments.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.prefix || eq.plate || eq.code} - {eq.type}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Preventiva */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] mb-1">
              Tipo de Preventiva:
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-md text-[#111827] dark:text-white"
            >
              <option value="todos">Todos os Tipos</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Período De */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] mb-1">
              Data Inicial (DD/MM/AAAA):
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs py-1 px-2 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-md text-[#111827] dark:text-white font-mono"
            />
          </div>

          {/* Período Até */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] mb-1">
              Data Final (DD/MM/AAAA):
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs py-1 px-2 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-md text-[#111827] dark:text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* History Records Table (Requirement 10) */}
      <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f8fafc] dark:bg-[#0f172a] border-b border-[#dcdfe4] dark:border-[#22334d] text-[#475569] dark:text-[#94a3b8] font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3">Data (DD/MM/AAAA)</th>
                <th className="py-3 px-3">Equipamento / Prefixo</th>
                <th className="py-3 px-3">Horímetro / KM</th>
                <th className="py-3 px-3">Tipo de Preventiva</th>
                <th className="py-3 px-3">Serviços Realizados</th>
                <th className="py-3 px-3">Peças Trocadas</th>
                <th className="py-3 px-3">Responsável</th>
                <th className="py-3 px-3 text-center">Anexos</th>
                <th className="py-3 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] dark:divide-[#1e293b]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 px-4">
                    <div className="flex flex-col items-center justify-center space-y-2 text-[#6b7280] dark:text-[#9ca3af]">
                      <Wrench className="w-8 h-8 text-blue-500/50" />
                      <p className="font-semibold text-sm text-[#374151] dark:text-[#e2e8f0]">
                        {records.length === 0
                          ? 'Histórico de Manutenções Preventivas (PCM) zerado'
                          : 'Nenhum registro encontrado com os filtros selecionados'}
                      </p>
                      <p className="text-xs max-w-md text-[#6b7280] dark:text-[#9ca3af]">
                        {records.length === 0
                          ? 'Nenhum registro de preventiva foi cadastrado ainda. O módulo está pronto para começar a incluir os dados do zero.'
                          : 'Tente alterar ou limpar os filtros de busca para encontrar os registros desejados.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const eq = equipmentMap.get(rec.equipmentId);
                  const hasAttachments = rec.attachments && rec.attachments.length > 0;

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                    >
                      {/* Data */}
                      <td className="py-2.5 px-3 font-mono font-medium text-[#1e293b] dark:text-[#e2e8f0] whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs">
                          <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>{formatDateDDMMAAAA(rec.date)}</span>
                        </div>
                        {rec.workOrderNumber && (
                          <span className="block text-[10px] text-blue-500 font-mono mt-0.5">
                            {rec.workOrderNumber}
                          </span>
                        )}
                      </td>

                      {/* Equipamento / Prefixo */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-[#111827] dark:text-white">
                          <span className="font-mono bg-[#f1f5f9] dark:bg-[#0b1322] px-1.5 py-0.5 rounded border border-[#e2e8f0] dark:border-[#1e293b] mr-1.5">
                            {rec.equipmentCode}
                          </span>
                          {eq?.type || ''}
                        </div>
                        <div className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                          {eq?.brand || ''} {eq?.model || ''}
                        </div>
                      </td>

                      {/* Horímetro / KM */}
                      <td className="py-2.5 px-3 font-mono">
                        {rec.hourMeter !== undefined && (
                          <div className="font-semibold text-blue-600 dark:text-blue-400">
                            {formatMetricWithUnit(rec.hourMeter, 'HORAS')}
                          </div>
                        )}
                        {rec.km !== undefined && (
                          <div className="text-emerald-600 dark:text-emerald-400">
                            {formatMetricWithUnit(rec.km, 'KM')}
                          </div>
                        )}
                      </td>

                      {/* Tipo de Preventiva */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          {rec.type}
                        </span>
                        {rec.nextReviewValue !== undefined && (
                          <div className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] mt-0.5">
                            Próx: {rec.nextReviewValue}
                          </div>
                        )}
                      </td>

                      {/* Serviços Realizados */}
                      <td className="py-2.5 px-3 max-w-[200px] text-[#334155] dark:text-[#cbd5e1] truncate" title={rec.servicesPerformed}>
                        {rec.servicesPerformed}
                      </td>

                      {/* Peças Trocadas */}
                      <td className="py-2.5 px-3 max-w-[180px] text-[#475569] dark:text-[#94a3b8] truncate" title={rec.partsReplaced}>
                        {rec.partsReplaced}
                      </td>

                      {/* Responsável */}
                      <td className="py-2.5 px-3 text-[#475569] dark:text-[#94a3b8] whitespace-nowrap">
                        {rec.responsible}
                        {rec.cost !== undefined && (
                          <span className="block text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            R$ {rec.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>

                      {/* Anexos */}
                      <td className="py-2.5 px-3 text-center">
                        {hasAttachments ? (
                          <button
                            onClick={() => setSelectedRecordForDetail(rec)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900 hover:bg-blue-100"
                          >
                            <Paperclip className="w-3 h-3" />
                            {rec.attachments!.length}
                          </button>
                        ) : (
                          <span className="text-[#9ca3af] dark:text-[#64748b]">-</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedRecordForDetail(rec)}
                            className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-colors"
                            title="Ver detalhes da preventiva"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {userRole !== 'reader' && (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Deseja realmente remover o registro de preventiva do equipamento ${rec.equipmentCode} de ${rec.date}?`
                                  )
                                ) {
                                  onDeleteRecord(rec.id);
                                }
                              }}
                              className="p-1.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-500 transition-colors"
                              title="Excluir registro do histórico"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-2.5 bg-[#f8fafc] dark:bg-[#0f172a] border-t border-[#dcdfe4] dark:border-[#22334d] flex items-center justify-between text-xs text-[#64748b] dark:text-[#9ca3af]">
          <span>
            Total: <strong>{filteredRecords.length}</strong> manutenções registradas
          </span>
          <span className="text-[11px]">Histórico perpétuo de manutenções preventivas</span>
        </div>
      </div>

      {/* Record Detail Modal with Attachments */}
      {selectedRecordForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="px-5 py-3.5 bg-[#f8fafc] dark:bg-[#0f172a] border-b border-[#dcdfe4] dark:border-[#22334d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-sm text-[#111827] dark:text-white">
                  Detalhes da Manutenção Preventiva - {selectedRecordForDetail.equipmentCode}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecordForDetail(null)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[#f9fafb] dark:bg-[#0f172a] p-3 rounded-xl border border-[#e5e7eb] dark:border-[#1e293b]">
                <div>
                  <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[10px]">Data (DD/MM/AAAA):</span>
                  <span className="font-bold font-mono text-[#111827] dark:text-white">
                    {formatDateDDMMAAAA(selectedRecordForDetail.date)}
                  </span>
                </div>
                <div>
                  <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[10px]">Tipo de Preventiva:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {selectedRecordForDetail.type}
                  </span>
                </div>
                <div>
                  <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[10px]">Horímetro:</span>
                  <span className="font-bold font-mono text-[#111827] dark:text-white">
                    {selectedRecordForDetail.hourMeter !== undefined
                      ? `${selectedRecordForDetail.hourMeter} h`
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[10px]">Quilometragem:</span>
                  <span className="font-bold font-mono text-[#111827] dark:text-white">
                    {selectedRecordForDetail.km !== undefined
                      ? `${selectedRecordForDetail.km} km`
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[10px]">Responsável:</span>
                  <span className="font-bold text-[#111827] dark:text-white">
                    {selectedRecordForDetail.responsible}
                  </span>
                </div>
                <div>
                  <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[10px]">Ordem de Serviço:</span>
                  <span className="font-bold font-mono text-[#111827] dark:text-white">
                    {selectedRecordForDetail.workOrderNumber || '-'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-[#374151] dark:text-[#d1d5db] block mb-1">
                  Serviços Realizados:
                </span>
                <p className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] text-[#1e293b] dark:text-[#e2e8f0]">
                  {selectedRecordForDetail.servicesPerformed}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold text-[#374151] dark:text-[#d1d5db] block mb-1">
                  Peças & Lubrificantes Utilizados:
                </span>
                <p className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] text-[#1e293b] dark:text-[#e2e8f0]">
                  {selectedRecordForDetail.partsReplaced}
                </p>
              </div>

              {selectedRecordForDetail.notes && (
                <div>
                  <span className="text-[11px] font-bold text-[#374151] dark:text-[#d1d5db] block mb-1">
                    Observações:
                  </span>
                  <p className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] text-[#1e293b] dark:text-[#e2e8f0]">
                    {selectedRecordForDetail.notes}
                  </p>
                </div>
              )}

              {/* Attachments list and previews */}
              {selectedRecordForDetail.attachments && selectedRecordForDetail.attachments.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-[#374151] dark:text-[#d1d5db] block mb-1">
                    Comprovantes / Fotos / Arquivos ({selectedRecordForDetail.attachments.length}):
                  </span>
                  <div className="space-y-2">
                    {selectedRecordForDetail.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-2.5 rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="truncate font-medium text-[#111827] dark:text-white">
                            {att.name}
                          </span>
                        </div>
                        {att.dataUrl && (
                          <a
                            href={att.dataUrl}
                            download={att.name}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition-colors shrink-0"
                          >
                            Baixar
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-[#f8fafc] dark:bg-[#0f172a] border-t border-[#dcdfe4] dark:border-[#22334d] flex justify-end">
              <button
                onClick={() => setSelectedRecordForDetail(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-[#1e293b] text-gray-800 dark:text-gray-200 hover:bg-gray-300 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
