import React, { useState, useEffect } from 'react';
import { Equipment } from '../../types';
import { formatMetricWithUnit } from '../../utils/preventiveUtils';
import { X, Gauge, CheckCircle2, Calendar, AlertCircle } from 'lucide-react';

interface UpdateReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;
  onSaveReading: (updatedEquipment: Equipment) => void;
}

export const UpdateReadingModal: React.FC<UpdateReadingModalProps> = ({
  isOpen,
  onClose,
  equipment,
  onSaveReading,
}) => {
  if (!isOpen || !equipment) return null;

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [hourMeter, setHourMeter] = useState<string>(
    equipment.currentHourMeter ? String(equipment.currentHourMeter) : ''
  );
  const [km, setKm] = useState<string>(
    equipment.currentKm !== undefined ? String(equipment.currentKm) : ''
  );
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (equipment) {
      setHourMeter(equipment.currentHourMeter ? String(equipment.currentHourMeter) : '');
      setKm(equipment.currentKm !== undefined ? String(equipment.currentKm) : '');
      setDate(new Date().toISOString().split('T')[0]);
      setError(null);
    }
  }, [equipment]);

  const parseReadingValue = (val: string): number | undefined => {
    if (!val || val.trim() === '') return undefined;
    const clean = val.trim();
    const num = clean.includes(',')
      ? parseFloat(clean.replace(/\./g, '').replace(',', '.'))
      : parseFloat(clean);
    return isNaN(num) ? undefined : num;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipment) return;

    const parsedHours = parseReadingValue(hourMeter);
    const parsedKm = parseReadingValue(km);

    if (parsedHours === undefined && parsedKm === undefined) {
      setError('Por favor, informe ao menos o Horímetro ou a Quilometragem.');
      return;
    }

    const updatedEquipment: Equipment = {
      ...equipment,
      currentHourMeter: parsedHours !== undefined ? parsedHours : equipment.currentHourMeter,
      lastHourMeterDate: parsedHours !== undefined ? date : equipment.lastHourMeterDate,
      currentKm: parsedKm !== undefined ? parsedKm : equipment.currentKm,
      lastKmDate: parsedKm !== undefined ? date : equipment.lastKmDate,
      updatedAt: new Date().toISOString(),
    };

    onSaveReading(updatedEquipment);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-3.5 bg-[#f8fafc] dark:bg-[#0f172a] border-b border-[#dcdfe4] dark:border-[#22334d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-[#111827] dark:text-white">
              Atualizar Leitura do Equipamento
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-black dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div className="bg-[#f9fafb] dark:bg-[#0f172a] p-3 rounded-xl border border-[#e5e7eb] dark:border-[#1e293b]">
            <span className="font-bold text-sm text-[#111827] dark:text-white block">
              {equipment.prefix || equipment.plate || equipment.code} - {equipment.type}
            </span>
            <span className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] block">
              {equipment.brand || ''} {equipment.model || ''} • Obra: {equipment.location || '-'}
            </span>
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-[#e5e7eb] dark:border-[#1e293b] font-mono text-[11px]">
              <span>
                Últ. Hor: <strong>{formatMetricWithUnit(equipment.currentHourMeter, 'HORAS')}</strong>
              </span>
              <span>
                Últ. KM: <strong>{formatMetricWithUnit(equipment.currentKm ?? 0, 'KM')}</strong>
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
              Data da Leitura (DD/MM/AAAA): *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
                Novo Horímetro:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: 2650.0"
                  value={hourMeter}
                  onChange={(e) => setHourMeter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white font-mono"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-[#9ca3af]">
                  h
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
                Nova KM:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: 130000"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white font-mono"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-[#9ca3af]">
                  km
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4b5563] dark:text-[#9ca3af] mb-1">
              Origem da Leitura / Observações:
            </label>
            <input
              type="text"
              placeholder="Ex: Apontamento em campo pela manhã..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white"
            />
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#dcdfe4] dark:border-[#22334d]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#dcdfe4] dark:border-[#334155] text-[#374151] dark:text-[#cbd5e1] hover:bg-gray-100 dark:hover:bg-[#1e293b]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              Atualizar Leitura
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
