import React, { useState } from 'react';
import {
  X,
  Truck,
  Wrench,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Package,
  Image as ImageIcon,
  ChevronRight,
  MapPin,
  Building,
  User,
  Gauge,
  Tag,
  FileText,
} from 'lucide-react';
import { CorrectiveMaintenance, Equipment } from '../../types';
import { PhotoLightboxModal } from './PhotoLightboxModal';

interface EquipmentCorrectiveHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefix: string;
  records: CorrectiveMaintenance[];
  equipments: Equipment[];
  onOpenRecordDetail: (record: CorrectiveMaintenance) => void;
}

export const EquipmentCorrectiveHistoryModal: React.FC<EquipmentCorrectiveHistoryModalProps> = ({
  isOpen,
  onClose,
  prefix,
  records,
  equipments,
  onOpenRecordDetail,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string } | null>(null);

  if (!isOpen || !prefix) return null;

  // Equipment info from Base de Dados (find by plate, prefix or code)
  const equipment = equipments.find(
    (e) =>
      (e.plate || '').toUpperCase() === prefix.toUpperCase() ||
      (e.prefix || '').toUpperCase() === prefix.toUpperCase() ||
      (e.code || '').toUpperCase() === prefix.toUpperCase()
  );

  // All corrective records for this equipment, sorted newest first
  const equipRecords = records
    .filter((r) => {
      const target = prefix.toUpperCase();
      const recPlate = (r.plate || '').toUpperCase();
      const recPrefix = (r.prefix || '').toUpperCase();
      const matchDirect = recPlate === target || recPrefix === target;
      const matchEquipId = equipment && r.equipmentId && r.equipmentId === equipment.id;
      const matchEquipPlates =
        equipment &&
        ((equipment.plate && recPlate === equipment.plate.toUpperCase()) ||
          (equipment.prefix && recPrefix === equipment.prefix.toUpperCase()));
      return matchDirect || matchEquipId || matchEquipPlates;
    })
    .sort((a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime());

  // Display primary Plate
  const displayPlate = equipment?.plate || equipRecords[0]?.plate || prefix;
  const secondaryPrefix = equipment?.prefix || equipRecords[0]?.prefix;

  // Aggregate stats
  const totalOs = equipRecords.length;
  const totalStoppedDays = equipRecords.reduce((acc, r) => acc + (r.stoppedDays || 0), 0);
  const lastRecord = equipRecords.length > 0 ? equipRecords[0] : null;

  // Collect all replaced parts
  const allReplacedParts = equipRecords
    .map((r) => r.replacedParts)
    .filter(Boolean)
    .join(', ')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const uniqueParts = Array.from(new Set(allReplacedParts));

  // Collect all photos
  const allPhotos = equipRecords.flatMap((r) =>
    (r.photos || []).map((p) => ({
      ...p,
      osNumber: r.osNumber,
      date: r.openDate,
      failureType: r.failureType,
    }))
  );

  // Failure categories for this equipment
  const failureFrequency = new Map<string, number>();
  equipRecords.forEach((r) => {
    const f = r.failureType || 'Outro';
    failureFrequency.set(f, (failureFrequency.get(f) || 0) + 1);
  });
  const sortedFailures = Array.from(failureFrequency.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div
        id="equip-history-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold font-mono tracking-tight text-white">{displayPlate}</h3>
                  {secondaryPrefix && secondaryPrefix !== displayPlate && (
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-400 text-black">
                      Pref: {secondaryPrefix}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    Histórico de Manutenções Corretivas
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {equipment?.type || equipRecords[0]?.equipmentType || 'Equipamento'} •{' '}
                  {equipment?.brand || equipRecords[0]?.brand || ''}{' '}
                  {equipment?.model || equipRecords[0]?.model || ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Equipment Master Info Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Fornecedor / Locadora</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  {equipment?.supplier || equipRecords[0]?.supplier || 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Obra Atual</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {equipment?.location || equipRecords[0]?.location || 'Não informada'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Placa</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {equipment?.plate || equipRecords[0]?.plate || '-'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Horímetro / KM Atual</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                  <Gauge className="w-3.5 h-3.5 text-slate-400" />
                  {equipment?.currentHourMeter ? `${equipment.currentHourMeter} h` : equipRecords[0]?.openMeter ? `${equipRecords[0].openMeter}` : 'Conforme apontamento'}
                </span>
              </div>
            </div>

            {/* Metrics Quick Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase">
                  Total de O.S. Abertas
                </span>
                <div className="text-2xl font-bold font-mono text-blue-900 dark:text-blue-100 mt-0.5">
                  {totalOs} <span className="text-xs font-normal">ocorrências</span>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl">
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 uppercase">
                  Dias de Máquina Parada
                </span>
                <div className="text-2xl font-bold font-mono text-rose-900 dark:text-rose-100 mt-0.5">
                  {totalStoppedDays} <span className="text-xs font-normal">dias acumulados</span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase">
                  Última Corretiva
                </span>
                <div className="text-sm font-bold text-amber-900 dark:text-amber-100 mt-1 truncate">
                  {lastRecord ? `${lastRecord.osNumber} (${lastRecord.openDate.split('-').reverse().join('/')})` : 'Nenhuma'}
                </div>
                <div className="text-[11px] text-amber-700 dark:text-amber-300 truncate mt-0.5">
                  {lastRecord?.failureType || '-'}
                </div>
              </div>
            </div>

            {/* Recurrent Failures & Replaced Parts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Failures Breakdown */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Falhas Recorrentes Deste Equipamento
                </h4>
                {sortedFailures.length === 0 ? (
                  <p className="text-slate-400">Nenhum registro de falha.</p>
                ) : (
                  <div className="space-y-1.5">
                    {sortedFailures.map(([f, count]) => (
                      <div key={f} className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/40 last:border-0">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{f}</span>
                        <span className="font-bold font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px]">
                          {count}x
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Replaced Parts */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-emerald-500" />
                  Histórico de Peças Substituídas
                </h4>
                {uniqueParts.length === 0 ? (
                  <p className="text-slate-400">Nenhuma peça listada nas ordens de serviço.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {uniqueParts.map((part, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px]"
                      >
                        {part}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chronological Timeline */}
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Linha do Tempo Cronológica das O.S.
              </h4>

              {equipRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Nenhuma manutenção corretiva registrada para este equipamento.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  {equipRecords.map((r) => {
                    const isCompleted = r.status === 'Concluída';
                    const isUnderAnalysis = r.status === 'Em Análise';
                    return (
                      <div key={r.id} className="relative group">
                        {/* Dot indicator */}
                        <div
                          className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                            isCompleted ? 'bg-emerald-500' : isUnderAnalysis ? 'bg-sky-500' : 'bg-amber-500'
                          }`}
                        />

                        {/* Timeline item card */}
                        <div
                          className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer"
                          onClick={() => onOpenRecordDetail(r)}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60">
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-sm text-blue-600 dark:text-blue-400">
                                {r.osNumber}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isCompleted
                                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                    : isUnderAnalysis
                                    ? 'bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                                    : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {r.status}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Abertura: {r.openDate.split('-').reverse().join('/')}
                                {r.completionDate && ` • Conclusão: ${r.completionDate.split('-').reverse().join('/')}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                              <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold font-mono">
                                {r.stoppedDays} {r.stoppedDays === 1 ? 'dia parado' : 'dias parados'}
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </div>

                          {/* Failure & Diagnostic */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <div>
                              <strong className="text-slate-800 dark:text-slate-200">Falha:</strong> {r.failureType}
                              {r.affectedSystem && <span className="text-slate-500"> ({r.affectedSystem})</span>}
                              <p className="text-slate-500 mt-0.5 line-clamp-2">{r.problemDescription}</p>
                            </div>

                            <div>
                              <strong className="text-slate-800 dark:text-slate-200">Serviço Realizado:</strong>
                              <p className="text-slate-500 mt-0.5 line-clamp-2">{r.servicePerformed || 'Em andamento'}</p>
                              {r.replacedParts && (
                                <p className="text-emerald-600 dark:text-emerald-400 mt-0.5 text-[11px] truncate">
                                  <strong>Peças:</strong> {r.replacedParts}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Photos thumbnail preview if any */}
                          {r.photos && r.photos.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                                {r.photos.length} fotos anexadas:
                              </span>
                              <div className="flex items-center gap-1.5 overflow-x-auto">
                                {r.photos.map((p) => {
                                  const isPdf = p.dataUrl.startsWith('data:application/pdf') || p.name.toLowerCase().endsWith('.pdf');
                                  return (
                                    <div
                                      key={p.id}
                                      className="w-8 h-8 rounded border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center bg-slate-100 dark:bg-slate-800"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPhoto({ url: p.dataUrl, name: p.name });
                                      }}
                                      title={p.name}
                                    >
                                      {isPdf ? (
                                        <FileText className="w-4 h-4 text-rose-600" />
                                      ) : (
                                        <img
                                          src={p.dataUrl}
                                          alt={p.name}
                                          className="w-full h-full object-cover"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gallery of all photos across all records */}
            {allPhotos.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  Galeria Geral de Evidências Fotográficas ({allPhotos.length})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {allPhotos.map((photo, pIdx) => {
                    const isPdf = photo.dataUrl.startsWith('data:application/pdf') || photo.name.toLowerCase().endsWith('.pdf');
                    return (
                      <div
                        key={pIdx}
                        className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer aspect-video flex items-center justify-center"
                        onClick={() => setSelectedPhoto({ url: photo.dataUrl, name: photo.name })}
                      >
                        {isPdf ? (
                          <div className="flex flex-col items-center justify-center p-2 text-center w-full h-full bg-rose-50 dark:bg-rose-950/30">
                            <FileText className="w-7 h-7 text-rose-600 mb-1" />
                            <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 line-clamp-1 px-1">
                              {photo.name}
                            </span>
                            <span className="text-[8px] text-rose-500 font-bold uppercase mt-0.5">
                              Documento PDF
                            </span>
                          </div>
                        ) : (
                          <img
                            src={photo.dataUrl}
                            alt={photo.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-white">
                          <span className="font-bold font-mono text-[10px]">{photo.osNumber}</span>
                          <span className="text-[9px] text-slate-300 truncate">{photo.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 dark:bg-slate-850 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
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
          title={`Evidência Fotográfica - ${displayPlate}`}
        />
      )}
    </>
  );
};
