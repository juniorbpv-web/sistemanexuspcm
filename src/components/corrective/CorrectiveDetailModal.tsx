import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  Truck,
  Building,
  MapPin,
  Calendar,
  Clock,
  Gauge,
  Package,
  User,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Edit2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { CorrectiveMaintenance, CorrectivePhoto } from '../../types';
import { PhotoLightboxModal } from './PhotoLightboxModal';
import { getCorrectivePhotoFromIndexedDB } from '../../services/correctiveFilesService';

interface CorrectiveDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: CorrectiveMaintenance | null;
  onEdit: (record: CorrectiveMaintenance) => void;
  onDelete: (id: string) => void;
  onOpenEquipmentHistory: (prefix: string) => void;
}

export const CorrectiveDetailModal: React.FC<CorrectiveDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  onEdit,
  onDelete,
  onOpenEquipmentHistory,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string; photoId?: string } | null>(null);
  const [photosList, setPhotosList] = useState<CorrectivePhoto[]>(record?.photos || []);

  useEffect(() => {
    let active = true;
    const current = record?.photos || [];
    setPhotosList(current);

    if (current.some((p) => !p.dataUrl)) {
      Promise.all(
        current.map(async (p) => {
          if (p.dataUrl) return p;
          const cached = await getCorrectivePhotoFromIndexedDB(p.id);
          return cached?.dataUrl ? { ...p, dataUrl: cached.dataUrl } : p;
        })
      ).then((updated) => {
        if (active) setPhotosList(updated);
      }).catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [record]);

  if (!isOpen || !record) return null;

  const isCompleted = record.status === 'Concluída';

  return (
    <>
      <div
        id="corrective-detail-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6 transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold font-mono tracking-tight text-white">{record.osNumber}</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      record.status === 'Concluída'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : record.status === 'Em Análise'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {record.status}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Ordem de Serviço de Manutenção Corretiva (PCM)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(record)}
                className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Editar Ordem de Serviço"
              >
                <Edit2 className="w-4 h-4 text-blue-400" />
                <span className="hidden sm:inline">Editar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Confirma a exclusão da ordem de serviço ${record.osNumber}?`)) {
                    onDelete(record.id);
                    onClose();
                  }
                }}
                className="p-2 text-slate-300 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Excluir Ordem de Serviço"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Excluir</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
            {/* Equipment Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Equipamento Vinculado
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEquipmentHistory(record.plate || record.prefix);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Ver Histórico de {record.plate || record.prefix} <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Placa</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-mono">
                    {record.plate || record.prefix}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Tipo / Equipamento</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {record.equipmentType}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Marca / Modelo</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {record.brand || '-'} {record.model || ''}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Placa</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    {record.plate || '-'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Fornecedor</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    {record.supplier}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Obra / Local</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {record.location}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Operador</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {record.operator || 'Não informado'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Horímetro / KM</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                    <Gauge className="w-3.5 h-3.5 text-slate-400" />
                    {record.openMeter ? `Abert: ${record.openMeter}` : ''}
                    {record.completionMeter ? ` • Conc: ${record.completionMeter}` : ''}
                    {!record.openMeter && !record.completionMeter ? '-' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Dates & Stopped Time Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <span className="text-slate-400 block text-[10px] uppercase font-bold flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" /> Data de Abertura
                </span>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200 font-mono mt-0.5 block">
                  {record.openDate ? record.openDate.split('-').reverse().join('/') : '-'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <span className="text-slate-400 block text-[10px] uppercase font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Data de Conclusão
                </span>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200 font-mono mt-0.5 block">
                  {record.completionDate ? record.completionDate.split('-').reverse().join('/') : 'Em andamento'}
                </span>
              </div>

              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50">
                <span className="text-rose-700 dark:text-rose-300 block text-[10px] uppercase font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-500" /> Tempo de Máquina Parada
                </span>
                <span className="font-bold text-base text-rose-700 dark:text-rose-300 font-mono mt-0.5 block">
                  {record.stoppedDays} {record.stoppedDays === 1 ? 'dia' : 'dias'}
                  {record.stoppedHours ? ` (${record.stoppedHours} horas)` : ''}
                </span>
              </div>
            </div>

            {/* Failure & Diagnostic Details */}
            <div className="space-y-4 text-xs">
              <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/40">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {record.failureType}
                  </span>
                  {record.affectedSystem && (
                    <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 rounded text-[11px] font-medium">
                      {record.affectedSystem}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-slate-700 dark:text-slate-300">
                  <div>
                    <strong className="text-slate-900 dark:text-slate-100 block mb-0.5">
                      Descrição do Problema:
                    </strong>
                    <p className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30 text-xs">
                      {record.problemDescription}
                    </p>
                  </div>

                  {record.diagnosis && (
                    <div>
                      <strong className="text-slate-900 dark:text-slate-100 block mb-0.5">
                        Diagnóstico Técnico:
                      </strong>
                      <p className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30 text-xs">
                        {record.diagnosis}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Performed & Parts */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 space-y-3">
                <div>
                  <strong className="text-slate-900 dark:text-slate-100 block mb-0.5 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-emerald-600" />
                    Serviço Realizado:
                  </strong>
                  <p className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-xs text-slate-700 dark:text-slate-300">
                    {record.servicePerformed || 'Intervenção em andamento pelo mecânico responsável.'}
                  </p>
                </div>

                {record.replacedParts && (
                  <div>
                    <strong className="text-slate-900 dark:text-slate-100 block mb-0.5 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-emerald-600" />
                      Peças Substituídas:
                    </strong>
                    <p className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-xs font-mono text-emerald-800 dark:text-emerald-300">
                      {record.replacedParts}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs pt-1 text-slate-600 dark:text-slate-400">
                  <span>
                    <strong>Mecânico Responsável:</strong> {record.mechanic || 'Não informado'}
                  </span>
                </div>
              </div>

              {/* Notes if any */}
              {record.notes && (
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <strong className="text-slate-700 dark:text-slate-300 block mb-1">Observações Gerais:</strong>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">{record.notes}</p>
                </div>
              )}
            </div>

            {/* Photos Section */}
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                Evidências Fotográficas ({photosList.length})
              </h4>

              {photosList.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                  Nenhuma foto anexada a esta Ordem de Serviço.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photosList.map((p) => {
                    const isPdf = p.dataUrl.startsWith('data:application/pdf') || p.name.toLowerCase().endsWith('.pdf');
                    return (
                      <div
                        key={p.id}
                        className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer aspect-video flex items-center justify-center"
                        onClick={() => setSelectedPhoto({ url: p.dataUrl, name: p.name, photoId: p.id })}
                      >
                        {isPdf ? (
                          <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-rose-50 dark:bg-rose-950/30">
                            <FileText className="w-8 h-8 text-rose-600 mb-1" />
                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                              {p.name}
                            </span>
                            <span className="text-[9px] text-rose-500 font-bold uppercase mt-0.5">
                              Documento PDF
                            </span>
                          </div>
                        ) : (
                          <img
                            src={p.dataUrl}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-white">
                          <span className="text-[10px] text-slate-300 truncate">{p.name}</span>
                          <span className="text-[9px] text-blue-400">
                            {isPdf ? 'Clique para visualizar PDF' : 'Clique para ampliar'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 dark:bg-slate-850 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Cadastrado em {new Date(record.createdAt).toLocaleDateString('pt-BR')}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox for photo inspection */}
      {selectedPhoto && (
        <PhotoLightboxModal
          isOpen={true}
          onClose={() => setSelectedPhoto(null)}
          photoUrl={selectedPhoto.url}
          photoName={selectedPhoto.name}
          title={`${record.osNumber} - ${record.plate || record.prefix}`}
          photoId={selectedPhoto.photoId}
        />
      )}
    </>
  );
};
