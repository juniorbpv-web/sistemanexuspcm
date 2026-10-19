import React, { useState, useEffect } from 'react';
import {
  Equipment,
  PreventivePlan,
  PreventiveRecord,
  PreventiveIntervalType,
  PreventiveUnit,
  PreventiveAttachment,
} from '../../types';
import {
  PREVENTIVE_INTERVAL_OPTIONS,
  formatMetricWithUnit,
} from '../../utils/preventiveUtils';
import {
  X,
  Wrench,
  Calendar,
  Gauge,
  FileText,
  User,
  Paperclip,
  CheckCircle2,
  Trash2,
  Upload,
} from 'lucide-react';

interface RegisterPreventiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipments: Equipment[];
  plans: PreventivePlan[];
  initialEquipment?: Equipment | null;
  onSaveRecord: (
    record: PreventiveRecord,
    updatedPlan?: PreventivePlan,
    updatedEquipment?: Equipment
  ) => void;
}

export const RegisterPreventiveModal: React.FC<RegisterPreventiveModalProps> = ({
  isOpen,
  onClose,
  equipments,
  plans,
  initialEquipment,
  onSaveRecord,
}) => {
  if (!isOpen) return null;

  // Selected Equipment
  const [selectedEqId, setSelectedEqId] = useState<string>(
    initialEquipment?.id || (equipments[0]?.id ?? '')
  );

  // Form fields
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [hourMeterInput, setHourMeterInput] = useState<string>('');
  const [kmInput, setKmInput] = useState<string>('');
  const [preventiveType, setPreventiveType] = useState<PreventiveIntervalType>('250 Horas');
  const [servicesPerformed, setServicesPerformed] = useState<string>(
    'Troca de óleo de motor 15W40, substituição dos filtros de óleo lubrificante, combustível primário/secundário e filtro de ar.'
  );
  const [partsReplaced, setPartsReplaced] = useState<string>(
    '1x Filtro lubrificante, 1x Filtro de combustível, 1x Filtro sedimentador, 20L Óleo 15W40 CI-4.'
  );
  const [responsible, setResponsible] = useState<string>('Oficina Central / Mecânico Responsável');
  const [cost, setCost] = useState<string>('');
  const [workOrderNumber, setWorkOrderNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [attachments, setAttachments] = useState<PreventiveAttachment[]>([]);
  const [updateEquipmentCurrentMeters, setUpdateEquipmentCurrentMeters] = useState<boolean>(true);

  // Sync initial equipment or defaults
  useEffect(() => {
    const eq = equipments.find((e) => e.id === selectedEqId) || initialEquipment || equipments[0];
    if (eq) {
      const plan = plans.find((p) => p.equipmentId === eq.id);
      setPreventiveType(plan?.intervalType || (eq.currentKm ? '10.000 KM' : '250 Horas'));
      setHourMeterInput(eq.currentHourMeter ? String(eq.currentHourMeter) : '');
      setKmInput(eq.currentKm ? String(eq.currentKm) : '');
    }
  }, [selectedEqId, initialEquipment, equipments, plans]);

  const currentEquipment = equipments.find((e) => e.id === selectedEqId);
  const currentPlan = currentEquipment ? plans.find((p) => p.equipmentId === currentEquipment.id) : null;

  // Handle file uploads (OS / Photos / Invoices)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string;
        const newAtt: PreventiveAttachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          fileType: file.type || 'application/octet-stream',
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          dataUrl,
          uploadedAt: new Date().toISOString(),
        };
        setAttachments((prev) => [...prev, newAtt]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  // Helper for flexible Brazilian/international number parsing (e.g. "1.500,5" or "1500.5")
  const parseInputValue = (val: string): number | undefined => {
    if (!val || val.trim() === '') return undefined;
    const clean = val.trim();
    const num = clean.includes(',')
      ? parseFloat(clean.replace(/\./g, '').replace(',', '.'))
      : parseFloat(clean);
    return isNaN(num) ? undefined : num;
  };

  // Submit and Save
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEquipment) return;

    const parsedHours = parseInputValue(hourMeterInput);
    const parsedKm = parseInputValue(kmInput);

    // Determine interval value & unit
    let intervalValue = 250;
    let unit: PreventiveUnit = 'HORAS';
    const opt = PREVENTIVE_INTERVAL_OPTIONS.find((o) => o.label === preventiveType);
    if (opt && opt.label !== 'Outro') {
      intervalValue = opt.value;
      unit = opt.unit;
    } else if (currentPlan) {
      intervalValue = currentPlan.intervalValue;
      unit = currentPlan.intervalUnit;
    }

    // Calculate next review value
    const baseValue = unit === 'KM' ? (parsedKm ?? 0) : (parsedHours ?? 0);
    const nextReviewValue = baseValue + intervalValue;

    const recordId = `prev_rec_${Date.now()}`;
    const newRecord: PreventiveRecord = {
      id: recordId,
      equipmentId: currentEquipment.id,
      equipmentCode: currentEquipment.prefix || currentEquipment.plate || currentEquipment.code,
      date,
      hourMeter: parsedHours,
      km: parsedKm,
      type: preventiveType,
      intervalType: preventiveType,
      intervalValue,
      intervalUnit: unit,
      nextReviewValue,
      servicesPerformed,
      partsReplaced,
      responsible,
      cost: parseInputValue(cost),
      workOrderNumber: workOrderNumber || undefined,
      notes: notes || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: new Date().toISOString(),
    };

    // 1. Prepare updated plan with new last review info
    const updatedPlan: PreventivePlan = {
      id: currentPlan?.id || `plan_${currentEquipment.id}`,
      equipmentId: currentEquipment.id,
      equipmentCode: currentEquipment.prefix || currentEquipment.plate || currentEquipment.code,
      intervalType: preventiveType,
      intervalUnit: unit,
      intervalValue,
      lastReviewDate: date,
      lastReviewHourMeter: parsedHours,
      lastReviewKm: parsedKm,
      lastReviewNotes: servicesPerformed,
      createdAt: currentPlan?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 2. Prepare updated equipment reading if checkbox is checked
    let updatedEquipment: Equipment | undefined;
    if (updateEquipmentCurrentMeters) {
      updatedEquipment = {
        ...currentEquipment,
        currentHourMeter: parsedHours !== undefined && parsedHours > (currentEquipment.currentHourMeter || 0)
          ? parsedHours
          : currentEquipment.currentHourMeter,
        lastHourMeterDate: parsedHours !== undefined ? date : currentEquipment.lastHourMeterDate,
        currentKm: parsedKm !== undefined && parsedKm > (currentEquipment.currentKm || 0)
          ? parsedKm
          : currentEquipment.currentKm,
        lastKmDate: parsedKm !== undefined ? date : currentEquipment.lastKmDate,
        updatedAt: new Date().toISOString(),
      };
    }

    onSaveRecord(newRecord, updatedPlan, updatedEquipment);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#161f30] border border-[#dcdfe4] dark:border-[#22334d] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#f8fafc] dark:bg-[#0f172a] border-b border-[#dcdfe4] dark:border-[#22334d] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#111827] dark:text-white">
                Registrar Preventiva Realizada
              </h3>
              <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                Lançamento no Histórico PCM e recalibração automática da próxima revisão
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#111827] dark:text-[#9ca3af] dark:hover:text-white hover:bg-[#e5e7eb] dark:hover:bg-[#1e293b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Equipment Selector */}
          <div>
            <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
              Equipamento da Frota: *
            </label>
            <select
              value={selectedEqId}
              onChange={(e) => setSelectedEqId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white font-medium"
              required
            >
              {equipments.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.prefix || eq.plate || eq.code} - {eq.type} ({eq.brand || ''} {eq.model || ''}) — Obra: {eq.location || '-'}
                </option>
              ))}
            </select>
          </div>

          {/* Date, Horímetro e KM */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
                Data da Preventiva (DD/MM/AAAA): *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
                Horímetro na Revisão:
              </label>
              <input
                type="text"
                placeholder="Ex: 2540.5"
                value={hourMeterInput}
                onChange={(e) => setHourMeterInput(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
                Quilometragem (KM):
              </label>
              <input
                type="text"
                placeholder="Ex: 125400"
                value={kmInput}
                onChange={(e) => setKmInput(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Tipo de Preventiva & Nº da OS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
                Tipo de Preventiva: *
              </label>
              <select
                value={preventiveType}
                onChange={(e) => setPreventiveType(e.target.value as PreventiveIntervalType)}
                className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white font-semibold"
                required
              >
                {PREVENTIVE_INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.label}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
                Nº da Ordem de Serviço (OS):
              </label>
              <input
                type="text"
                placeholder="Ex: OS-2025-089"
                value={workOrderNumber}
                onChange={(e) => setWorkOrderNumber(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Serviços Realizados */}
          <div>
            <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
              Serviços Realizados: *
            </label>
            <textarea
              rows={2}
              value={servicesPerformed}
              onChange={(e) => setServicesPerformed(e.target.value)}
              placeholder="Descreva as operações de manutenção executadas..."
              className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white"
              required
            />
          </div>

          {/* Peças e Filtros Trocados */}
          <div>
            <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
              Peças, Lubrificantes e Filtros Substituídos: *
            </label>
            <textarea
              rows={2}
              value={partsReplaced}
              onChange={(e) => setPartsReplaced(e.target.value)}
              placeholder="Ex: 1x Filtro lubrificante, 1x Filtro combustível, 20L Óleo 15W40..."
              className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white"
              required
            />
          </div>

          {/* Responsável e Custo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
                Responsável / Mecânico / Oficina: *
              </label>
              <input
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="Ex: Mecânico Carlos Silva / Oficina Makmo"
                className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db] mb-1">
                Custo da Manutenção (R$):
              </label>
              <input
                type="text"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Ex: 1850.00"
                className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-medium text-[#4b5563] dark:text-[#9ca3af] mb-1">
              Observações Adicionais:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Equipamento liberado para operação na obra..."
              className="w-full px-3 py-1.5 bg-white dark:bg-[#0b1322] border border-[#dcdfe4] dark:border-[#334155] rounded-lg text-[#111827] dark:text-white"
            />
          </div>

          {/* Anexos (Comprovantes / Fotos / OS) */}
          <div className="pt-2 border-t border-[#dcdfe4] dark:border-[#22334d]">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-[#374151] dark:text-[#d1d5db]">
                Anexos (Comprovantes / Ordem de Serviço / Fotos):
              </label>
              <label className="cursor-pointer text-xs font-semibold px-2.5 py-1 rounded bg-[#f3f4f6] dark:bg-[#1e293b] hover:bg-[#e5e7eb] dark:hover:bg-[#334155] text-blue-600 dark:text-blue-400 flex items-center gap-1 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Adicionar Arquivo
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate font-medium text-[#1e293b] dark:text-[#e2e8f0]">
                        {att.name}
                      </span>
                      <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                        ({Math.round((att.sizeBytes || 0) / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="text-rose-500 hover:text-rose-600 p-1"
                      title="Remover anexo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkbox auto-update equipment meter */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="updateEquipmentMeters"
              checked={updateEquipmentCurrentMeters}
              onChange={(e) => setUpdateEquipmentCurrentMeters(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="updateEquipmentMeters" className="text-xs text-[#374151] dark:text-[#cbd5e1] font-medium cursor-pointer">
              Atualizar também o horímetro / quilometragem atual na Base de Dados do Equipamento
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#dcdfe4] dark:border-[#22334d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#dcdfe4] dark:border-[#334155] text-[#374151] dark:text-[#cbd5e1] hover:bg-gray-100 dark:hover:bg-[#1e293b] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              Concluir & Salvar Preventiva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
