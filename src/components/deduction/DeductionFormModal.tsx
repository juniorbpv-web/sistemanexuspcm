import React, { useState, useEffect, useMemo } from 'react';
import {
  Equipment,
  MeasurementDeduction,
  MeasurementDeductionStatus,
  StoppageReason,
  AuthUser,
} from '../../types';
import {
  calculateDailyRate,
  calculateDaysBetween,
  calculateDiscount,
  checkStoppageOverlap,
  formatCurrencyBRL,
  getTodayDateIso,
  STOPPAGE_REASONS,
  DEDUCTION_STATUSES,
} from '../../utils/deductionUtils';
import {
  X,
  Calculator,
  AlertTriangle,
  Calendar,
  DollarSign,
  Truck,
  Building2,
  FileText,
  CheckCircle2,
  Search,
} from 'lucide-react';

interface DeductionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deduction: MeasurementDeduction) => void;
  equipments: Equipment[];
  existingDeductions: MeasurementDeduction[];
  deductionToEdit?: MeasurementDeduction | null;
  currentUser?: AuthUser | null;
}

export const DeductionFormModal: React.FC<DeductionFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  equipments,
  existingDeductions,
  deductionToEdit,
  currentUser,
}) => {
  // Equipment search & selection
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  // Form fields
  const [prefix, setPrefix] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [type, setType] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [supplier, setSupplier] = useState('');
  const [location, setLocation] = useState('');
  const [operator, setOperator] = useState('');
  const [plate, setPlate] = useState('');

  const [measurementValue, setMeasurementValue] = useState<number>(0);
  const [measurementInputStr, setMeasurementInputStr] = useState('');
  const [startDate, setStartDate] = useState(getTodayDateIso());
  const [endDate, setEndDate] = useState('');
  const [isOngoing, setIsOngoing] = useState(false);

  const [reason, setReason] = useState<StoppageReason | string>('Falha mecânica');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<MeasurementDeductionStatus>('PARADO');

  // Error & validation feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calculationFeedback, setCalculationFeedback] = useState<string | null>(null);

  // Filtered equipment list for quick lookup
  const filteredEquipments = useMemo(() => {
    if (!equipmentSearch.trim()) return equipments.slice(0, 30);
    const query = equipmentSearch.toLowerCase().trim();
    return equipments
      .filter((eq) => {
        const prefixMatch = eq.prefix?.toLowerCase().includes(query);
        const codeMatch = eq.code?.toLowerCase().includes(query);
        const typeMatch = eq.type?.toLowerCase().includes(query);
        const modelMatch = eq.model?.toLowerCase().includes(query);
        const brandMatch = eq.brand?.toLowerCase().includes(query);
        const plateMatch = eq.plate?.toLowerCase().includes(query);
        const supplierMatch = eq.supplier?.toLowerCase().includes(query);
        const locationMatch = eq.location?.toLowerCase().includes(query);
        return (
          prefixMatch ||
          codeMatch ||
          typeMatch ||
          modelMatch ||
          brandMatch ||
          plateMatch ||
          supplierMatch ||
          locationMatch
        );
      })
      .slice(0, 30);
  }, [equipments, equipmentSearch]);

  // Handle Equipment Selection & Auto-fill
  const handleSelectEquipment = (eq: Equipment) => {
    setSelectedEquipment(eq);
    setPrefix(eq.prefix || eq.code || '');
    setEquipmentType(eq.type || '');
    setType(eq.type || '');
    setBrand(eq.brand || '');
    setModel(eq.model || '');
    setSupplier(eq.supplier || 'MAKMO');
    setLocation(eq.location || 'Obra Geral');
    setOperator(eq.operator || '');
    setPlate(eq.plate || '');

    // Auto-fill measurement value if configured on the equipment
    if (eq.measurementValue && eq.measurementValue > 0) {
      setMeasurementValue(eq.measurementValue);
      setMeasurementInputStr(eq.measurementValue.toString());
    }

    setEquipmentSearch(`${eq.prefix || eq.code} - ${eq.type} (${eq.supplier || 'MAKMO'})`);
    setIsDropdownOpen(false);
    setErrorMessage(null);
  };

  // Populate data when editing an existing deduction
  useEffect(() => {
    if (deductionToEdit) {
      const matchEq = equipments.find((e) => e.id === deductionToEdit.equipmentId || e.prefix === deductionToEdit.prefix);
      if (matchEq) setSelectedEquipment(matchEq);

      setPrefix(deductionToEdit.prefix);
      setEquipmentType(deductionToEdit.equipmentType);
      setType(deductionToEdit.type || deductionToEdit.equipmentType);
      setBrand(deductionToEdit.brand || '');
      setModel(deductionToEdit.model || '');
      setSupplier(deductionToEdit.supplier);
      setLocation(deductionToEdit.location);
      setOperator(deductionToEdit.operator || '');
      setPlate(deductionToEdit.plate || '');

      setMeasurementValue(deductionToEdit.measurementValue);
      setMeasurementInputStr(deductionToEdit.measurementValue.toString());
      setStartDate(deductionToEdit.startDate);
      setEndDate(deductionToEdit.endDate || '');
      setIsOngoing(deductionToEdit.isOngoing);

      if (STOPPAGE_REASONS.includes(deductionToEdit.reason as StoppageReason)) {
        setReason(deductionToEdit.reason);
      } else {
        setReason('Outros');
        setCustomReason(deductionToEdit.reason);
      }

      setNotes(deductionToEdit.notes || '');
      setStatus(deductionToEdit.status);
      setEquipmentSearch(`${deductionToEdit.prefix} - ${deductionToEdit.equipmentType}`);
    } else {
      // Reset form
      setSelectedEquipment(null);
      setEquipmentSearch('');
      setPrefix('');
      setEquipmentType('');
      setType('');
      setBrand('');
      setModel('');
      setSupplier('');
      setLocation('');
      setOperator('');
      setPlate('');
      setMeasurementValue(0);
      setMeasurementInputStr('');
      setStartDate(getTodayDateIso());
      setEndDate('');
      setIsOngoing(true); // default ongoing stoppage
      setReason('Falha mecânica');
      setCustomReason('');
      setNotes('');
      setStatus('PARADO');
      setErrorMessage(null);
      setCalculationFeedback(null);
    }
  }, [deductionToEdit, isOpen, equipments]);

  // Dynamic calculations
  const dailyRate = useMemo(() => calculateDailyRate(measurementValue), [measurementValue]);

  const stoppedDays = useMemo(() => {
    return calculateDaysBetween(startDate, isOngoing ? undefined : endDate, isOngoing);
  }, [startDate, endDate, isOngoing]);

  const discountValue = useMemo(() => {
    return calculateDiscount(dailyRate, stoppedDays);
  }, [dailyRate, stoppedDays]);

  // Sync status with ongoing toggle
  const handleOngoingToggle = (checked: boolean) => {
    setIsOngoing(checked);
    if (checked) {
      setEndDate('');
      if (status === 'FINALIZADO' || status === 'DESCONTO CALCULADO') {
        setStatus('PARADO');
      }
    } else {
      if (!endDate) setEndDate(getTodayDateIso());
      if (status === 'PARADO') {
        setStatus('FINALIZADO');
      }
    }
  };

  const handleCalculateClick = () => {
    if (!measurementValue || measurementValue <= 0) {
      setErrorMessage('Informe um Valor de Medição válido para calcular a diária e o desconto.');
      return;
    }
    setCalculationFeedback(
      `Cálculo atualizado: ${formatCurrencyBRL(measurementValue)} ÷ 30 = ${formatCurrencyBRL(
        dailyRate
      )}/dia × ${stoppedDays} dias = ${formatCurrencyBRL(discountValue)}`
    );
    setErrorMessage(null);
  };

  const handleSave = () => {
    setErrorMessage(null);

    // Validations
    if (!prefix || !equipmentType) {
      setErrorMessage('Selecione um equipamento existente na frota.');
      return;
    }

    if (!measurementValue || measurementValue <= 0) {
      setErrorMessage('O valor da medição é obrigatório e deve ser maior que zero.');
      return;
    }

    if (!startDate) {
      setErrorMessage('Informe a data inicial da paralisação.');
      return;
    }

    if (!isOngoing && !endDate) {
      setErrorMessage('Informe a data final da paralisação ou marque a opção "Equipamento continua parado".');
      return;
    }

    if (!isOngoing && endDate && endDate < startDate) {
      setErrorMessage('A data final não pode ser anterior à data inicial.');
      return;
    }

    // CONTROLE DE DUPLICIDADE (Section 13)
    // Impedir que o mesmo equipamento tenha duas paralisações sobrepostas no mesmo período
    const equipmentIdToTest = selectedEquipment?.id || deductionToEdit?.equipmentId || prefix;
    const hasOverlap = checkStoppageOverlap(existingDeductions, {
      equipmentId: equipmentIdToTest,
      prefix,
      startDate,
      endDate: isOngoing ? undefined : endDate,
      isOngoing,
      id: deductionToEdit?.id,
    });

    if (hasOverlap) {
      setErrorMessage('Já existe uma paralisação registrada para este equipamento neste período.');
      return;
    }

    const effectiveReason = reason === 'Outros' && customReason.trim() ? customReason.trim() : reason;
    const nowIso = new Date().toISOString();
    const userIdentifier = currentUser?.username || currentUser?.name || 'pcm@makmo.com.br';

    let historyLog = deductionToEdit?.history ? [...deductionToEdit.history] : [];

    if (deductionToEdit) {
      historyLog.push({
        id: `hist-${Date.now()}`,
        timestamp: nowIso,
        user: userIdentifier,
        action: !isOngoing && endDate ? 'ENCERRAMENTO' : 'EDIÇÃO',
        description: `Alteração de dados. Medição: ${formatCurrencyBRL(measurementValue)}, Diária: ${formatCurrencyBRL(
          dailyRate
        )}, Dias: ${stoppedDays}, Desconto: ${formatCurrencyBRL(discountValue)}, Status: ${status}.`,
      });
    } else {
      historyLog.push({
        id: `hist-${Date.now()}`,
        timestamp: nowIso,
        user: userIdentifier,
        action: 'CRIAÇÃO',
        description: `Abertura de paralisação para ${prefix} (${equipmentType}). Motivo: ${effectiveReason}. Medição: ${formatCurrencyBRL(
          measurementValue
        )}, Diária: ${formatCurrencyBRL(dailyRate)}, Dias: ${stoppedDays}, Desconto: ${formatCurrencyBRL(discountValue)}.`,
      });
    }

    const deductionRecord: MeasurementDeduction = {
      id: deductionToEdit?.id || `ded-${Date.now()}`,
      equipmentId: selectedEquipment?.id || deductionToEdit?.equipmentId || `eq-${prefix}`,
      prefix,
      equipmentType,
      type: type || equipmentType,
      brand,
      model,
      supplier: supplier || 'MAKMO',
      location: location || 'Obra Geral',
      operator,
      plate,
      measurementValue,
      dailyRate,
      startDate,
      endDate: isOngoing ? '' : endDate,
      isOngoing,
      stoppedDays,
      discountValue,
      reason: effectiveReason,
      notes,
      status: isOngoing && status !== 'PARADO' ? 'PARADO' : status,
      createdBy: deductionToEdit?.createdBy || userIdentifier,
      createdAt: deductionToEdit?.createdAt || nowIso,
      updatedAt: nowIso,
      closedAt: !isOngoing && endDate ? (deductionToEdit?.closedAt || nowIso) : undefined,
      closedBy: !isOngoing && endDate ? (deductionToEdit?.closedBy || userIdentifier) : undefined,
      history: historyLog,
    };

    onSave(deductionRecord);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {deductionToEdit ? 'Editar Desconto em Medição' : 'Novo Registro de Desconto em Medição'}
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Apuração contratual de equipamentos paralisados na obra
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

        {/* Form Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-medium animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Feedback Banner */}
          {calculationFeedback && (
            <div className="flex items-start gap-2.5 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{calculationFeedback}</span>
            </div>
          )}

          {/* 1. SELEÇÃO DO EQUIPAMENTO (Obrigatório Base Existente) */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-600" />
                1. Seleção do Equipamento (Base da Frota Makmo)
              </label>
              <span className="text-[11px] text-slate-700 dark:text-slate-300">
                Obrigatoriamente da base existente
              </span>
            </div>

            {/* Search Combobox */}
            <div className="relative">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquise por Prefixo, Equipamento, Placa, Modelo ou Fornecedor..."
                  value={equipmentSearch}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setEquipmentSearch(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-medium"
                />
                {equipmentSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setEquipmentSearch('');
                      setIsDropdownOpen(true);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Dropdown list */}
              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredEquipments.length > 0 ? (
                      filteredEquipments.map((eq) => (
                        <button
                          key={eq.id}
                          type="button"
                          onClick={() => handleSelectEquipment(eq)}
                          className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white mr-2">
                              {eq.prefix || eq.code}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">
                              {eq.type}
                            </span>
                            {eq.model && (
                              <span className="text-slate-700 dark:text-slate-300 text-[11px] ml-1.5">
                                • {eq.brand} {eq.model}
                              </span>
                            )}
                          </div>
                          <div className="text-right text-[11px] text-slate-700 dark:text-slate-300">
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                              {eq.supplier || 'MAKMO'}
                            </span>
                            <span className="ml-1.5">{eq.location}</span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-slate-400">
                        Nenhum equipamento encontrado com este termo
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Auto-filled visual summary cards destacadas em amarelo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
              <div className="p-2 bg-amber-400/15 dark:bg-amber-500/20 rounded-lg border-2 border-amber-400 dark:border-amber-500/70 shadow-2xs">
                <span className="text-[10px] text-amber-900 dark:text-amber-300 block uppercase font-bold">Prefixo</span>
                <span className="font-mono font-black text-amber-950 dark:text-amber-100 text-sm truncate block">
                  {prefix || '-'}
                </span>
              </div>
              <div className="p-2 bg-amber-400/15 dark:bg-amber-500/20 rounded-lg border-2 border-amber-400 dark:border-amber-500/70 shadow-2xs">
                <span className="text-[10px] text-amber-900 dark:text-amber-300 block uppercase font-bold">Equipamento / Tipo</span>
                <span className="font-bold text-amber-950 dark:text-amber-100 truncate block">
                  {equipmentType || '-'}
                </span>
              </div>
              <div className="p-2 bg-amber-400/15 dark:bg-amber-500/20 rounded-lg border-2 border-amber-400 dark:border-amber-500/70 shadow-2xs">
                <span className="text-[10px] text-amber-900 dark:text-amber-300 block uppercase font-bold">Fornecedor</span>
                <span className="font-semibold text-amber-950 dark:text-amber-100 truncate block">
                  {supplier || '-'}
                </span>
              </div>
              <div className="p-2 bg-amber-400/15 dark:bg-amber-500/20 rounded-lg border-2 border-amber-400 dark:border-amber-500/70 shadow-2xs">
                <span className="text-[10px] text-amber-900 dark:text-amber-300 block uppercase font-bold">Obra Atual</span>
                <span className="font-semibold text-amber-950 dark:text-amber-100 truncate block">
                  {location || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. DADOS DO DESCONTO & PARALISAÇÃO */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              2. Dados da Medição e Período de Paralisação
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Valor da Medição */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Valor da Medição Contratual (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={measurementInputStr}
                    onChange={(e) => {
                      setMeasurementInputStr(e.target.value);
                      const num = parseFloat(e.target.value) || 0;
                      setMeasurementValue(num);
                    }}
                    className="w-full pl-9 pr-3 py-2 text-sm font-bold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 mt-1 block">
                  Base mensal utilizada para cálculo da diária (÷ 30)
                </span>
              </div>

              {/* Data Inicial */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data Inicial da Paralisação *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 mt-1 block">
                  Início da indisponibilidade
                </span>
              </div>

              {/* Data Final */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Data Final da Paralisação
                  </label>
                </div>
                <input
                  type="date"
                  disabled={isOngoing}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg font-medium ${
                    isOngoing
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                  }`}
                />
                {/* Ongoing Checkbox */}
                <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isOngoing}
                    onChange={(e) => handleOngoingToggle(e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                    Equipamento continua parado (sem data final)
                  </span>
                </label>
              </div>
            </div>

            {/* 3. CÁLCULO AUTOMÁTICO & DESTAQUE (Cards de Conferência) */}
            <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-emerald-50/80 dark:from-slate-800/60 dark:via-slate-800/40 dark:to-emerald-950/30 p-4 rounded-xl border border-blue-200 dark:border-slate-700 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  Memória de Cálculo Automático
                </span>
                <button
                  type="button"
                  onClick={handleCalculateClick}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-900/50 hover:bg-blue-200/70 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  Calcular Desconto
                </button>
              </div>

              {/* 4 Highlight Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] text-slate-700 dark:text-slate-300 uppercase font-semibold block">
                    Valor da Medição
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate block mt-0.5">
                    {formatCurrencyBRL(measurementValue)}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] text-slate-700 dark:text-slate-300 uppercase font-semibold block">
                    Valor da Diária (÷ 30)
                  </span>
                  <span className="text-sm font-bold text-sky-600 dark:text-sky-400 truncate block mt-0.5">
                    {formatCurrencyBRL(dailyRate)}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] text-slate-700 dark:text-slate-300 uppercase font-semibold block">
                    Dias Parados
                  </span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
                    {stoppedDays} {stoppedDays === 1 ? 'dia' : 'dias'}
                  </span>
                  {isOngoing && (
                    <span className="text-[9px] text-rose-500 font-medium block">
                      (calculado até hoje)
                    </span>
                  )}
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded-lg border border-emerald-300 dark:border-emerald-700/80 shadow-2xs">
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-bold block">
                    Valor do Desconto
                  </span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 truncate block mt-0.5">
                    {formatCurrencyBRL(discountValue)}
                  </span>
                </div>
              </div>

              {/* Explicit formula badge */}
              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono bg-white/80 dark:bg-slate-900/80 p-2 rounded-md border border-slate-200 dark:border-slate-700/60 text-center">
                Fórmula: {formatCurrencyBRL(measurementValue)} ÷ 30 = {formatCurrencyBRL(dailyRate)}/dia ×{' '}
                {stoppedDays} {stoppedDays === 1 ? 'dia' : 'dias'} ={' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {formatCurrencyBRL(discountValue)}
                </strong>
              </div>
            </div>

            {/* Motivo e Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Motivo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo da Paralisação *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STOPPAGE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                {reason === 'Outros' && (
                  <input
                    type="text"
                    placeholder="Especifique o motivo detalhado..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full mt-2 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status da Apuração *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MeasurementDeductionStatus)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  {DEDUCTION_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 mt-1 block">
                  {DEDUCTION_STATUSES.find((s) => s.value === status)?.description}
                </span>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Observações Operacionais / Parecer Técnico
              </label>
              <textarea
                rows={2}
                placeholder="Detalhes adicionais sobre a quebra, comunicação com a locadora, liberação, etc..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="text-xs text-slate-700 dark:text-slate-300">
            {isOngoing ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                Status Atual: EQUIPAMENTO PARADO
              </span>
            ) : (
              <span>Paralisação encerrada em {endDate || '-'}</span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Salvar Desconto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
