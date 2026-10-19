import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Equipment, FuelDispense, FuelEntry, ConvoyPlate, UserRole } from '../types';
import {
  formatDateBR,
  formatHours,
  formatLiters,
  getTodayDateString,
  exportFuelReportToCSV,
  getConvoyFuelSummary,
  parseCurrencyInput,
} from '../utils/storage';
import { exportFuelReportToExcel } from '../utils/excelFuelExport';
import { exportConsolidatedDispensesToPDF } from '../utils/pdfFuelExport';
import { validateInvoiceFile, readFileAsDataURL } from '../services/fuelFilesService';
import {
  Fuel,
  Search,
  Plus,
  Trash2,
  Calendar,
  User,
  Clock,
  Gauge,
  Check,
  AlertTriangle,
  Download,
  FileText,
  Info,
  Truck,
  Building2,
  CheckCircle2,
  TrendingDown,
  ArrowDownCircle,
  X,
  Edit2,
} from 'lucide-react';

interface ConvoyDispenseViewProps {
  convoyPlate: ConvoyPlate;
  convoyName: string;
  convoyDescription: string;
  equipments: Equipment[];
  dispenses: FuelDispense[];
  entries?: FuelEntry[];
  onSaveDispense: (dispense: Omit<FuelDispense, 'id' | 'createdAt'>) => { success: boolean; message: string };
  onUpdateDispense?: (dispense: FuelDispense) => { success: boolean; message: string };
  onDeleteDispense: (id: string) => void;
  onSaveEntry?: (entry: Omit<FuelEntry, 'id' | 'createdAt'>) => { success: boolean; message: string };
  onExportCSV: () => void;
  userRole?: UserRole;
}

export const ConvoyDispenseView: React.FC<ConvoyDispenseViewProps> = ({
  convoyPlate,
  convoyName,
  convoyDescription,
  equipments,
  dispenses,
  entries = [],
  onSaveDispense,
  onUpdateDispense,
  onDeleteDispense,
  onSaveEntry,
  onExportCSV,
  userRole = 'developer',
}) => {
  const isDeveloper = userRole === 'developer';

  // Convoy Summary (Balances and Loads)
  const convoySummary = useMemo(() => {
    return getConvoyFuelSummary(convoyPlate, entries, dispenses);
  }, [convoyPlate, entries, dispenses]);

  // Modal State for adding fuel carga to this convoy
  const [isCargaModalOpen, setIsCargaModalOpen] = useState(false);
  const [cargaLiters, setCargaLiters] = useState('');
  const [cargaTotalValue, setCargaTotalValue] = useState('');
  const [cargaInvoice, setCargaInvoice] = useState('');
  const [cargaSupplier, setCargaSupplier] = useState('Distribuidora Regional');
  const [cargaResponsible, setCargaResponsible] = useState('');
  const [cargaNotes, setCargaNotes] = useState('');
  const [cargaDate, setCargaDate] = useState(getTodayDateString());
  const [cargaError, setCargaError] = useState<string | null>(null);
  const [cargaAttachment, setCargaAttachment] = useState<{
    url?: string;
    name?: string;
    type?: 'PDF' | 'JPEG' | 'JPG';
    size?: number;
  } | null>(null);

  // Filter dispenses for this convoy
  const convoyDispenses = useMemo(() => {
    return dispenses.filter((d) => d.convoyPlate === convoyPlate);
  }, [dispenses, convoyPlate]);

  // Last reading from this convoy's pump
  const latestMeter = useMemo(() => {
    if (convoyDispenses.length === 0) return 0;
    // Sorted by date and created
    const sorted = [...convoyDispenses].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    return sorted[0].finalMeter || 0;
  }, [convoyDispenses]);

  // Form State
  const [selectedEquipmentCode, setSelectedEquipmentCode] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [initialMeter, setInitialMeter] = useState<string>(latestMeter > 0 ? String(latestMeter) : '');
  const [finalMeter, setFinalMeter] = useState<string>('');
  const [equipmentMeter, setEquipmentMeter] = useState<string>('');
  const [meterUnit, setMeterUnit] = useState<'HORAS' | 'KM'>('HORAS');
  const [operator, setOperator] = useState('');
  const [notes, setNotes] = useState('');

  // Dropdown Autocomplete state
  const [isEquipDropdownOpen, setIsEquipDropdownOpen] = useState(false);
  const equipDropdownRef = useRef<HTMLDivElement>(null);

  // Error/Success state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dispenseToDelete, setDispenseToDelete] = useState<FuelDispense | null>(null);
  const [editingDispenseId, setEditingDispenseId] = useState<string | null>(null);

  const handleStartEdit = (disp: FuelDispense) => {
    setEditingDispenseId(disp.id);
    setSelectedEquipmentCode(disp.equipmentCode);
    setDate(disp.date);
    setInitialMeter(String(disp.initialMeter));
    setFinalMeter(String(disp.finalMeter));
    setEquipmentMeter(disp.equipmentMeter !== undefined ? String(disp.equipmentMeter) : '');
    setMeterUnit(disp.equipmentMeterUnit || 'HORAS');
    setOperator(disp.operator || '');
    setNotes(disp.notes || '');
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingDispenseId(null);
    setSelectedEquipmentCode('');
    setFinalMeter('');
    setEquipmentMeter('');
    setOperator('');
    setNotes('');
    setErrorMessage(null);
    if (latestMeter > 0) {
      setInitialMeter(String(latestMeter));
    } else {
      setInitialMeter('');
    }
  };

  // Filter state for table
  const [filterDate, setFilterDate] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('');

  // Close equipment dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (equipDropdownRef.current && !equipDropdownRef.current.contains(event.target as Node)) {
        setIsEquipDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update initialMeter when latestMeter changes if not in editing mode
  useEffect(() => {
    if (!editingDispenseId && latestMeter > 0) {
      setInitialMeter(String(latestMeter));
    }
  }, [latestMeter, editingDispenseId]);

  // Matched equipment from fleet
  const matchedEquipment = useMemo(() => {
    if (!selectedEquipmentCode.trim()) return null;
    const clean = selectedEquipmentCode.trim().toUpperCase().replace(/[-\s]/g, '');
    return (
      equipments.find((eq) => {
        const pClean = (eq.plate || '').toUpperCase().replace(/[-\s]/g, '');
        const prClean = (eq.prefix || '').toUpperCase().replace(/[-\s]/g, '');
        const cClean = (eq.code || '').toUpperCase().replace(/[-\s]/g, '');
        return pClean === clean || prClean === clean || cClean === clean;
      }) || null
    );
  }, [selectedEquipmentCode, equipments]);

  // Autocomplete equipment suggestions
  const equipmentSuggestions = useMemo(() => {
    const q = selectedEquipmentCode.trim().toUpperCase().replace(/[-\s]/g, '');
    if (!q) return equipments;
    return equipments.filter((eq) => {
      const pClean = (eq.plate || '').toUpperCase().replace(/[-\s]/g, '');
      const prClean = (eq.prefix || '').toUpperCase().replace(/[-\s]/g, '');
      const cClean = (eq.code || '').toUpperCase().replace(/[-\s]/g, '');
      const tClean = (eq.type || '').toUpperCase();
      const lClean = (eq.location || '').toUpperCase();
      const oClean = (eq.operator || '').toUpperCase();
      return (
        pClean.includes(q) ||
        prClean.includes(q) ||
        cClean.includes(q) ||
        tClean.includes(q) ||
        lClean.includes(q) ||
        oClean.includes(q)
      );
    });
  }, [selectedEquipmentCode, equipments]);

  // Apply chosen equipment - Prefixo ao Selecionar
  const applyEquipment = (eq: Equipment) => {
    // Prefixo ao Selecionar: prioriza Prefixo cadastrado, depois código/placa
    const equipmentPrefix = eq.prefix || eq.code || eq.plate;
    setSelectedEquipmentCode(equipmentPrefix);
    setIsEquipDropdownOpen(false);
    if (eq.operator && !operator) {
      setOperator(eq.operator);
    }
    // Auto-detect unit: vehicles (caminhão, van, etc.) usually use KM, heavy machinery use Horímetro
    const isRoadVehicle = /caminh|van|pickup|pick-up|carro|veículo|veiculo/i.test(eq.type || '');
    setMeterUnit(isRoadVehicle ? 'KM' : 'HORAS');
    // Pre-populate with equipment's current meter from database if available
    if (eq.currentHourMeter && eq.currentHourMeter > 0) {
      setEquipmentMeter(String(eq.currentHourMeter));
    } else {
      setEquipmentMeter('');
    }
    setErrorMessage(null);
  };

  // Flexible number parser (e.g. "1.500,5" or "1500.5")
  const parseConvoyValue = (val: string): number => {
    if (!val) return NaN;
    const clean = val.trim();
    if (clean.includes(',')) {
      return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(clean);
  };

  // Live calculation: Total de Litros = Encerrante - Iniciante
  const calculation = useMemo(() => {
    const initVal = parseConvoyValue(initialMeter);
    const finVal = parseConvoyValue(finalMeter);

    if (isNaN(initVal) || isNaN(finVal) || finalMeter.trim() === '') {
      return { isValid: false, liters: 0, error: null };
    }

    if (finVal < initVal) {
      return {
        isValid: false,
        liters: 0,
        error: 'Hora/Km Encerrante não pode ser menor que o Iniciante!',
      };
    }

    const diff = Number((finVal - initVal).toFixed(2));
    return { isValid: true, liters: diff, error: null };
  }, [initialMeter, finalMeter]);

  // Quick increment buttons for liters (+50L, +100L, +200L, +300L)
  const addLiters = (litersToAdd: number) => {
    const base = parseConvoyValue(initialMeter || '0');
    if (!isNaN(base)) {
      const newFinal = Number((base + litersToAdd).toFixed(1));
      setFinalMeter(String(newFinal));
    }
  };

  // Handle Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = selectedEquipmentCode.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage('Informe o prefixo/placa do equipamento abastecido.');
      return;
    }

    if (!matchedEquipment) {
      setErrorMessage(`O equipamento "${cleanCode}" não foi encontrado na Base de Dados.`);
      return;
    }

    const initVal = parseConvoyValue(initialMeter);
    const finVal = parseConvoyValue(finalMeter);

    if (isNaN(initVal) || initVal < 0) {
      setErrorMessage('Informe uma leitura inicial válida para a bomba.');
      return;
    }

    if (isNaN(finVal) || finVal < 0) {
      setErrorMessage('Informe a leitura final (encerrante) da bomba.');
      return;
    }

    if (finVal < initVal) {
      setErrorMessage(
        `A leitura final (${formatHours(finVal)}) não pode ser menor que a leitura inicial (${formatHours(initVal)}).`
      );
      return;
    }

    const liters = Number((finVal - initVal).toFixed(2));
    const rawEquipVal = parseConvoyValue(equipmentMeter);
    const equipMeterVal = equipmentMeter.trim() !== '' && !isNaN(rawEquipVal) ? rawEquipVal : undefined;

    // Prefixo do Equipamento (Prefixo ao Selecionar)
    const equipmentCodeValue =
      matchedEquipment.prefix || matchedEquipment.code || matchedEquipment.plate;

    if (editingDispenseId) {
      const existing = convoyDispenses.find((d) => d.id === editingDispenseId);
      if (!existing) {
        setErrorMessage('Lançamento não encontrado para edição.');
        return;
      }

      const updatedDispense: FuelDispense = {
        ...existing,
        convoyPlate,
        equipmentCode: equipmentCodeValue,
        equipmentType: matchedEquipment.type,
        equipmentId: matchedEquipment.id,
        supplier: matchedEquipment.supplier || 'Frota Própria',
        location: matchedEquipment.location || 'Não informada',
        date: date || getTodayDateString(),
        initialMeter: initVal,
        finalMeter: finVal,
        liters,
        equipmentMeter: equipMeterVal !== undefined && !isNaN(equipMeterVal) ? equipMeterVal : undefined,
        equipmentMeterUnit: meterUnit,
        operator: operator.trim() || matchedEquipment.operator || 'Não informado',
        notes: notes.trim(),
      };

      if (onUpdateDispense) {
        const res = onUpdateDispense(updatedDispense);
        if (res.success) {
          handleCancelEdit();
        } else {
          setErrorMessage(res.message);
        }
      }
      return;
    }

    const res = onSaveDispense({
      convoyPlate,
      equipmentCode: equipmentCodeValue,
      equipmentType: matchedEquipment.type,
      equipmentId: matchedEquipment.id,
      supplier: matchedEquipment.supplier || 'Frota Própria',
      location: matchedEquipment.location || 'Não informada',
      date: date || getTodayDateString(),
      initialMeter: initVal,
      finalMeter: finVal,
      liters,
      equipmentMeter: equipMeterVal !== undefined && !isNaN(equipMeterVal) ? equipMeterVal : undefined,
      equipmentMeterUnit: meterUnit,
      operator: operator.trim() || matchedEquipment.operator || 'Não informado',
      notes: notes.trim(),
    });

    if (res.success) {
      // Advance initial meter to the new final meter
      setInitialMeter(String(finVal));
      setFinalMeter('');
      setSelectedEquipmentCode('');
      setEquipmentMeter('');
      setNotes('');
      setErrorMessage(null);
    } else {
      setErrorMessage(res.message);
    }
  };

  // Filtered list for table
  const filteredDispenses = useMemo(() => {
    return convoyDispenses.filter((d) => {
      const matchDate = !filterDate || d.date === filterDate;
      const equip = equipments.find(
        (eq) =>
          eq.code.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase() ||
          (eq.prefix && eq.prefix.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase()) ||
          (eq.plate && eq.plate.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase())
      );
      const equipObra = d.location || equip?.location || '';
      const equipSupplier = d.supplier || equip?.supplier || '';

      const searchUpper = filterEquipment.trim().toUpperCase();
      const matchEquip =
        !filterEquipment ||
        d.equipmentCode.toUpperCase().includes(searchUpper) ||
        (d.equipmentType && d.equipmentType.toUpperCase().includes(searchUpper)) ||
        equipObra.toUpperCase().includes(searchUpper) ||
        equipSupplier.toUpperCase().includes(searchUpper);

      return matchDate && matchEquip;
    });
  }, [convoyDispenses, filterDate, filterEquipment, equipments]);

  // Subtotal of liters in the filtered table
  const subtotalLiters = useMemo(() => {
    return filteredDispenses.reduce((acc, d) => acc + (Number(d.liters) || 0), 0);
  }, [filteredDispenses]);

  // Metrics for this comboio
  const stats = useMemo(() => {
    let totalLiters = 0;
    convoyDispenses.forEach((d) => {
      totalLiters += d.liters || 0;
    });
    const count = convoyDispenses.length;
    const avg = count > 0 ? Number((totalLiters / count).toFixed(1)) : 0;
    return {
      totalLiters: Number(totalLiters.toFixed(1)),
      count,
      avg,
      latestMeter,
    };
  }, [convoyDispenses, latestMeter]);

  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">
      {/* Top Banner Card for the Comboio */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3 sm:p-4 border border-[#dcdfe4] dark:border-[#333333] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Fuel className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6]">
                {convoyName}
              </h2>
              <span className="px-2 py-0.5 rounded bg-amber-500 text-black font-mono font-bold text-xs">
                {convoyPlate}
              </span>
            </div>
            <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
              {convoyDescription} • Registro de saídas de diesel pela leitura de Hora/Km da bomba
            </p>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Saldo Atual do Comboio */}
          <div
            className={`px-2.5 py-1 rounded border transition-colors ${
              convoySummary.balance >= 2000
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-rose-500/10 border-rose-500/30'
            }`}
          >
            <span className="text-[#6b7280] dark:text-[#9ca3af]">Saldo Atual: </span>
            <strong
              className={`font-mono font-bold ${
                convoySummary.balance >= 2000
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatLiters(convoySummary.balance)} L
            </strong>
          </div>

          <div className="px-2.5 py-1 rounded bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333]">
            <span className="text-[#6b7280] dark:text-[#9ca3af]">Cargas Recebidas: </span>
            <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              {formatLiters(convoySummary.entriesLiters)} L
            </strong>
          </div>

          <div className="px-2.5 py-1 rounded bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333]">
            <span className="text-[#6b7280] dark:text-[#9ca3af]">Total Abastecido: </span>
            <strong className="font-mono text-amber-600 dark:text-amber-400 font-bold">
              {formatLiters(stats.totalLiters)} L
            </strong>
          </div>

          <div className="px-2.5 py-1 rounded bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333]">
            <span className="text-[#6b7280] dark:text-[#9ca3af]">Abastecimentos: </span>
            <strong className="font-mono text-[#111827] dark:text-[#f3f4f6]">
              {stats.count}
            </strong>
          </div>

          {stats.latestMeter > 0 && (
            <div className="px-2.5 py-1 rounded bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333]">
              <span className="text-[#6b7280] dark:text-[#9ca3af]">Último Encerrante: </span>
              <strong className="font-mono text-[#111827] dark:text-[#f3f4f6]">
                {formatHours(stats.latestMeter)}
              </strong>
            </div>
          )}

          {onSaveEntry && (
            <button
              type="button"
              onClick={() => setIsCargaModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" />
              <span>Registrar Carga de Diesel</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal Registrar Carga de Combustível no Comboio */}
      {isCargaModalOpen && onSaveEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#eaecef] dark:border-[#262626]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <ArrowDownCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6]">
                    Registrar Carga de Diesel
                  </h3>
                  <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                    Destino: {convoyName} ({convoyPlate})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCargaError(null);
                  setIsCargaModalOpen(false);
                }}
                className="p-1 rounded-md text-[#6b7280] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:bg-[#f3f4f6] dark:hover:bg-[#262626]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cargaError && (
              <div
                role="alert"
                className="p-2.5 text-xs rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-2 animate-in fade-in"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{cargaError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCargaError(null);
                const l = parseFloat(cargaLiters.replace(',', '.'));
                if (!l || isNaN(l) || l <= 0) {
                  setCargaError('Informe uma litragem válida maior que zero.');
                  return;
                }
                const parsedTotal = parseCurrencyInput(cargaTotalValue);
                const unitP = parsedTotal && l > 0 ? Number((parsedTotal / l).toFixed(4)) : undefined;

                if (onSaveEntry) {
                  const res = onSaveEntry({
                    date: cargaDate,
                    liters: l,
                    totalValue: parsedTotal,
                    unitPrice: unitP,
                    supplier: cargaSupplier || 'Distribuidora Regional',
                    invoiceNumber: cargaInvoice || 'S/N',
                    destination: `Comboio ${convoyPlate}`,
                    responsible: cargaResponsible || 'Operador Responsável',
                    notes: cargaNotes || `Carga efetuada no Comboio ${convoyPlate}`,
                    attachmentUrl: cargaAttachment?.url,
                    attachmentName: cargaAttachment?.name,
                    attachmentType: cargaAttachment?.type,
                    attachmentSize: cargaAttachment?.size,
                  });
                  if (res && res.success === false) {
                    setCargaError(res.message);
                    return;
                  }
                }
                setIsCargaModalOpen(false);
                setCargaLiters('');
                setCargaTotalValue('');
                setCargaInvoice('');
                setCargaNotes('');
                setCargaAttachment(null);
                setCargaError(null);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                  Volume Recebido (Litros) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 5000"
                  value={cargaLiters}
                  onChange={(e) => setCargaLiters(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6] font-mono font-bold focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Data da Carga *
                  </label>
                  <input
                    type="date"
                    required
                    value={cargaDate}
                    onChange={(e) => setCargaDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Nota Fiscal (NF)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: NF-1234"
                    value={cargaInvoice}
                    onChange={(e) => setCargaInvoice(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Valor Total (R$) - Opcional
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 25.000,00"
                    value={cargaTotalValue}
                    onChange={(e) => setCargaTotalValue(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Fornecedor / Origem
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Ipiranga / Tanque Central"
                    value={cargaSupplier}
                    onChange={(e) => setCargaSupplier(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                  Responsável pelo Recebimento
                </label>
                <input
                  type="text"
                  placeholder="Nome do motorista / apontador"
                  value={cargaResponsible}
                  onChange={(e) => setCargaResponsible(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                  Anexar Nota Fiscal / Comprovante (PDF ou Foto)
                </label>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/jpg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const val = validateInvoiceFile(file);
                    if (!val.valid) {
                      setCargaError(val.error || 'Arquivo inválido. Formatos aceitos: PDF, JPG, JPEG.');
                      return;
                    }
                    const url = await readFileAsDataURL(file);
                    setCargaAttachment({
                      url,
                      name: file.name,
                      type: val.fileType,
                      size: file.size,
                    });
                  }}
                  className="w-full text-xs text-[#4b5563] dark:text-[#9ca3af] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-500/10 file:text-amber-700 dark:file:text-amber-400 hover:file:bg-amber-500/20 cursor-pointer"
                />
                {cargaAttachment && (
                  <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Arquivo selecionado: {cargaAttachment.name}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eaecef] dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => {
                    setCargaError(null);
                    setIsCargaModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#dcdfe4] dark:border-[#333333] text-xs font-bold text-[#4b5563] dark:text-[#9ca3af]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                >
                  Confirmar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lançamento Form */}
      <div
        className={`bg-white dark:bg-[#1a1a1a] rounded-lg p-3 sm:p-4 border shadow-xs transition-colors ${
          editingDispenseId
            ? 'border-amber-500/60 ring-2 ring-amber-500/20'
            : 'border-[#dcdfe4] dark:border-[#333333]'
        }`}
      >
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#eaecef] dark:border-[#262626]">
          <div className="flex items-center gap-2">
            {editingDispenseId ? (
              <Edit2 className="w-4 h-4 text-amber-500 animate-pulse" />
            ) : (
              <Plus className="w-4 h-4 text-amber-500" />
            )}
            <div>
              <h3 className="text-sm sm:text-base font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6]">
                {editingDispenseId
                  ? `Editar Lançamento de Abastecimento — ${convoyPlate}`
                  : `Novo Lançamento de Abastecimento — ${convoyPlate}`}
              </h3>
              {editingDispenseId && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  Modo de edição ativo
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editingDispenseId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-2.5 py-1 text-xs rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-[#374151] dark:text-[#d1d5db] font-semibold transition-colors"
              >
                Cancelar Edição
              </button>
            )}
            <span className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
              Campos com <span className="text-amber-500">*</span> obrigatórios
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-3 p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Row 1: Dados do Equipamento, Data e Aba Horímetro ou Km do Equipamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3">
            {/* Prefixo / Placa da Máquina (Prefixo ao Selecionar) */}
            <div className="lg:col-span-4 relative" ref={equipDropdownRef}>
              <label
                htmlFor={`input-fuel-equip-${convoyPlate}`}
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Prefixo / Placa do Equipamento <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <input
                  id={`input-fuel-equip-${convoyPlate}`}
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="Digite ou selecione o Prefixo ou Placa..."
                  value={selectedEquipmentCode}
                  onChange={(e) => {
                    setSelectedEquipmentCode(e.target.value);
                    setIsEquipDropdownOpen(true);
                  }}
                  onFocus={() => setIsEquipDropdownOpen(true)}
                  className="w-full h-8 pl-2.5 pr-8 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs font-mono uppercase focus:outline-none focus:border-amber-500 font-bold"
                />
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-[#9ca3af] pointer-events-none" />
              </div>

              {/* Autocomplete Dropdown - Prefixo em Destaque */}
              {isEquipDropdownOpen && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white dark:bg-[#1f1f1f] border border-[#dcdfe4] dark:border-[#333333] rounded-lg shadow-xl divide-y divide-[#eaecef] dark:divide-[#2f2f2f]">
                  {equipmentSuggestions.length > 0 ? (
                    equipmentSuggestions.slice(0, 10).map((eq) => {
                      const primaryPrefix = eq.prefix || eq.code || eq.plate;
                      return (
                        <button
                          key={eq.id}
                          type="button"
                          onClick={() => applyEquipment(eq)}
                          className="w-full text-left px-2.5 py-2 hover:bg-amber-500/10 text-xs flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                                {primaryPrefix}
                              </span>
                              {eq.plate && eq.plate !== primaryPrefix && (
                                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                  Placa: {eq.plate}
                                </span>
                              )}
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {eq.type}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {eq.operator ? `Op: ${eq.operator}` : 'Sem operador'} • {eq.location || 'Sem obra'}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                            {eq.currentHourMeter ? `${eq.currentHourMeter} h` : ''}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-2.5 text-xs text-[#9ca3af] text-center">
                      Nenhum equipamento encontrado na Base.
                    </div>
                  )}
                </div>
              )}

              {/* Informações Destacadas em Amarelo - Prefixo ao Selecionar */}
              {matchedEquipment && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-400/15 dark:bg-amber-500/20 border-2 border-amber-400 dark:border-amber-500/70 shadow-xs text-xs text-amber-950 dark:text-amber-100 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-amber-400/40">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-900 dark:text-amber-300">
                        Selecionado:
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black font-mono text-xs shadow-2xs">
                        Prefixo: {matchedEquipment.prefix || matchedEquipment.code}
                      </span>
                      {matchedEquipment.plate && (
                        <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-white/90 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-amber-300 dark:border-amber-600">
                          Placa: {matchedEquipment.plate}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200">
                      ✓ Base Makmo
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-amber-800 dark:text-amber-300 block">Tipo</span>
                      <span className="font-bold truncate block">{matchedEquipment.type}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-amber-800 dark:text-amber-300 block">Obra / Local</span>
                      <span className="font-medium truncate block">{matchedEquipment.location || 'Não informada'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-amber-800 dark:text-amber-300 block">Operador</span>
                      <span className="font-medium truncate block">{matchedEquipment.operator || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-amber-800 dark:text-amber-300 block">Horímetro Atual</span>
                      <span className="font-mono font-bold truncate block">
                        {matchedEquipment.currentHourMeter !== undefined ? `${matchedEquipment.currentHourMeter} h` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Data do Abastecimento */}
            <div className="lg:col-span-3">
              <label
                htmlFor={`input-fuel-date-${convoyPlate}`}
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Data <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <input
                  id={`input-fuel-date-${convoyPlate}`}
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Aba para Digitar o Horímetro ou Km do Equipamento */}
            <div className="lg:col-span-5 bg-amber-500/5 dark:bg-amber-500/5 p-2 rounded-lg border border-amber-500/20">
              <div className="flex items-center justify-between gap-1 mb-1">
                <label
                  htmlFor={`input-fuel-equip-meter-${convoyPlate}`}
                  className="text-[11px] font-bold uppercase tracking-wider text-[#374151] dark:text-[#e5e7eb] flex items-center gap-1"
                >
                  {meterUnit === 'KM' ? (
                    <Gauge className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <span>{meterUnit === 'KM' ? 'Km do Equipamento' : 'Horímetro do Equipamento'}</span>
                </label>

                {/* Aba seletora: Horímetro / Km */}
                <div
                  id={`tab-selector-meter-${convoyPlate}`}
                  className="inline-flex items-center p-0.5 rounded bg-white dark:bg-[#1f1f1f] border border-[#dcdfe4] dark:border-[#333333] text-[10px]"
                >
                  <button
                    type="button"
                    onClick={() => setMeterUnit('HORAS')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold transition-all ${
                      meterUnit === 'HORAS'
                        ? 'bg-amber-500 text-black font-bold shadow-xs'
                        : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-white'
                    }`}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span>Horímetro (h)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeterUnit('KM')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold transition-all ${
                      meterUnit === 'KM'
                        ? 'bg-amber-500 text-black font-bold shadow-xs'
                        : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-white'
                    }`}
                  >
                    <Gauge className="w-2.5 h-2.5" />
                    <span>Km</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  id={`input-fuel-equip-meter-${convoyPlate}`}
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder={
                    meterUnit === 'KM'
                      ? 'Digite o Km atual do veículo/caminhão...'
                      : 'Digite o Horímetro atual da máquina...'
                  }
                  value={equipmentMeter}
                  onChange={(e) => setEquipmentMeter(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-14 bg-white dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers text-xs font-bold focus:outline-none focus:border-amber-500"
                />
                <span className="absolute right-2.5 top-2 text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold uppercase">
                  {meterUnit === 'KM' ? 'Km' : 'Horas'}
                </span>
              </div>

              {matchedEquipment && (
                <div className="flex items-center justify-between text-[10px] text-[#6b7280] dark:text-[#9ca3af] mt-1">
                  <span>
                    Último na Base:{' '}
                    <strong className="font-mono text-[#111827] dark:text-[#f3f4f6]">
                      {formatHours(matchedEquipment.currentHourMeter)}{' '}
                      {meterUnit === 'KM' ? 'km' : 'h'}
                    </strong>
                  </span>
                  {equipmentMeter !== String(matchedEquipment.currentHourMeter) && (
                    <button
                      type="button"
                      onClick={() => setEquipmentMeter(String(matchedEquipment.currentHourMeter))}
                      className="text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                    >
                      Usar valor da base
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Leituras da Bomba do Comboio & Litros Calculados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 items-start pt-1">
            {/* Hora/Km Iniciante da Bomba */}
            <div className="lg:col-span-3">
              <label
                htmlFor={`input-fuel-init-${convoyPlate}`}
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Iniciante da Bomba <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <input
                  id={`input-fuel-init-${convoyPlate}`}
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  placeholder="0.0"
                  value={initialMeter}
                  onChange={(e) => setInitialMeter(e.target.value)}
                  className="w-full h-8 pl-2 pr-12 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers text-xs font-bold focus:outline-none focus:border-amber-500"
                />
                <span className="absolute right-2 top-2 text-[10px] text-[#9ca3af] font-mono font-bold">
                  bomba
                </span>
              </div>
            </div>

            {/* Hora/Km Encerrante da Bomba */}
            <div className="lg:col-span-4">
              <label
                htmlFor={`input-fuel-final-${convoyPlate}`}
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Encerrante da Bomba <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <input
                  id={`input-fuel-final-${convoyPlate}`}
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  placeholder="Leitura final da bomba..."
                  value={finalMeter}
                  onChange={(e) => setFinalMeter(e.target.value)}
                  className={`w-full h-8 pl-2 pr-12 bg-[#f8fafc] dark:bg-[#121212] border rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers text-xs font-bold focus:outline-none ${
                    calculation.error
                      ? 'border-rose-500 ring-1 ring-rose-500/30'
                      : 'border-[#dcdfe4] dark:border-[#333333] focus:border-amber-500'
                  }`}
                />
                <span className="absolute right-2 top-2 text-[10px] text-[#9ca3af] font-mono font-bold">
                  bomba
                </span>
              </div>

              {/* Quick increment buttons (+50L, +100L, +150L, +200L) */}
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] text-[#9ca3af]">Atalhos L:</span>
                {[50, 100, 150, 200].map((lit) => (
                  <button
                    key={lit}
                    type="button"
                    onClick={() => addLiters(lit)}
                    title={`Adicionar +${lit}L à leitura inicial da bomba`}
                    className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#f1f3f5] dark:bg-[#262626] hover:bg-amber-500/20 text-[#4b5563] dark:text-[#d1d5db] border border-[#dcdfe4] dark:border-[#333333]"
                  >
                    +{lit}L
                  </button>
                ))}
              </div>
            </div>

            {/* Live Total de Litros Card */}
            <div className="lg:col-span-5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5 opacity-0 pointer-events-none">
                Volume Calculado
              </label>
              <div
                className={`h-8 px-3 rounded flex items-center justify-between border transition-all ${
                  calculation.error
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : calculation.isValid
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-950 dark:text-amber-200'
                    : 'bg-[#f8fafc] dark:bg-[#121212] border-[#dcdfe4] dark:border-[#333333]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Fuel className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Total de Litros:
                  </span>
                </div>
                <div className="text-right flex items-baseline gap-1">
                  <span className="font-mono-numbers text-base font-bold text-amber-600 dark:text-amber-400">
                    {formatLiters(calculation.liters)}
                  </span>
                  <span className="text-xs font-bold text-[#6b7280] dark:text-[#9ca3af]">L</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Operador, Observações & Botão Salvar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 items-end pt-0.5">
            {/* Operador/Responsável (Opcional) */}
            <div className="lg:col-span-4">
              <label
                htmlFor={`input-fuel-operator-${convoyPlate}`}
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Operador / Responsável <span className="text-[#9ca3af] font-normal">(opcional)</span>
              </label>
              <input
                id={`input-fuel-operator-${convoyPlate}`}
                type="text"
                placeholder="Nome do operador ou motorista..."
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Observações */}
            <div className="lg:col-span-5">
              <label
                htmlFor={`input-fuel-notes-${convoyPlate}`}
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Observações <span className="text-[#9ca3af] font-normal">(opcional)</span>
              </label>
              <input
                id={`input-fuel-notes-${convoyPlate}`}
                type="text"
                placeholder="Ex: Abastecimento em campo, troca de turno, frente B..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Botão de Envio */}
            <div className="lg:col-span-3">
              <button
                id={`btn-save-fuel-${convoyPlate}`}
                type="submit"
                className={`w-full inline-flex items-center justify-center gap-1.5 h-8 px-4 font-bold rounded text-xs transition-colors shadow-xs ${
                  editingDispenseId
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-black'
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>
                  {editingDispenseId
                    ? 'Salvar Alterações do Abastecimento'
                    : 'Salvar Abastecimento'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* History Table for this Comboio */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3 sm:p-4 border border-[#dcdfe4] dark:border-[#333333] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#eaecef] dark:border-[#262626]">
          <div>
            <h3 className="text-sm sm:text-base font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6] flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Histórico de Abastecimentos — {convoyPlate}
            </h3>
            <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
              Registros de saídas de diesel deste comboio ({filteredDispenses.length} itens encontrados)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              <span className="text-[11px] font-sans font-semibold text-[#4b5563] dark:text-[#9ca3af]">
                Subtotal:
              </span>
              <span>{formatLiters(subtotalLiters)} L</span>
            </div>

            <button
              type="button"
              id={`btn-export-pdf-convoy-${convoyPlate.toLowerCase()}`}
              onClick={() => {
                const filterDesc = filterDate || filterEquipment
                  ? `Filtros: ${filterDate ? `Data: ${formatDateBR(filterDate)}` : ''}${filterDate && filterEquipment ? ' • ' : ''}${filterEquipment ? `Busca: "${filterEquipment}"` : ''}`
                  : undefined;
                exportConsolidatedDispensesToPDF(
                  filteredDispenses,
                  equipments,
                  filterDesc,
                  convoyPlate
                );
              }}
              disabled={filteredDispenses.length === 0}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded bg-[#113861] hover:bg-[#0d2f54] text-white disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-xs border border-[#1b4d82] transition-colors shadow-xs cursor-pointer"
              title={`Exportar abastecimentos do Comboio ${convoyPlate} em PDF com a identidade visual da Makmo`}
            >
              <FileText className="w-3.5 h-3.5 text-[#20b4a7]" />
              <span>Exportar PDF</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  await exportFuelReportToExcel(filteredDispenses, equipments, {
                    obraText: '063/064',
                    responsibleText: 'Roberto Jr',
                    customFilename: `makmo_abastecimentos_${convoyPlate.toLowerCase()}_${getTodayDateString()}.xlsx`,
                  });
                } catch (e) {
                  console.warn('Excel export error, using CSV fallback:', e);
                  exportFuelReportToCSV(
                    [],
                    filteredDispenses,
                    undefined,
                    equipments,
                    `makmo_abastecimentos_${convoyPlate.toLowerCase()}_${getTodayDateString()}.csv`
                  );
                }
              }}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded bg-black dark:bg-[#262626] text-amber-400 hover:bg-neutral-800 dark:hover:bg-[#333333] font-semibold text-xs border border-[#333333] transition-colors"
              title="Exportar relatório padronizado em Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#9ca3af]" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full h-7.5 pl-8 pr-2.5 text-xs bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#9ca3af]" />
            <input
              type="text"
              placeholder="Filtrar por placa da máquina, tipo ou obra..."
              value={filterEquipment}
              onChange={(e) => setFilterEquipment(e.target.value)}
              className="w-full h-7.5 pl-8 pr-2.5 text-xs bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500 font-mono uppercase"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-[#eaecef] dark:border-[#262626] rounded-md">
          <table className="w-full min-w-[950px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] dark:bg-[#141414] text-[#4b5563] dark:text-[#9ca3af] uppercase text-[10px] font-bold tracking-wider border-b border-[#eaecef] dark:border-[#262626]">
                <th className="p-2.5">Data</th>
                <th className="p-2.5">Prefixo / Placa</th>
                <th className="p-2.5">Tipo</th>
                <th className="p-2.5">Fornecedor</th>
                <th className="p-2.5">Obra</th>
                <th className="p-2.5 text-right font-mono">Horímetro / KM</th>
                <th className="p-2.5 text-right font-mono">Iniciante</th>
                <th className="p-2.5 text-right font-mono">Encerrante</th>
                <th className="p-2.5 text-right font-mono">Litros (L)</th>
                <th className="p-2.5">Operador / Resp.</th>
                <th className="p-2.5">Observações</th>
                <th className="p-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaecef] dark:divide-[#262626]">
              {filteredDispenses.length > 0 ? (
                filteredDispenses.map((disp) => {
                  const equip = equipments.find(
                    (eq) =>
                      (eq.prefix && eq.prefix.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase()) ||
                      (eq.plate && eq.plate.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase()) ||
                      eq.code.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase()
                  );
                  const equipObra = disp.location || equip?.location || 'Não informada';
                  const equipSupplier = disp.supplier || equip?.supplier || '-';
                  const primaryPrefix = equip?.prefix || disp.equipmentCode;

                  return (
                    <tr
                      key={disp.id}
                      className="hover:bg-amber-500/5 transition-colors text-[#111827] dark:text-[#f3f4f6]"
                    >
                      <td className="p-2.5 font-mono whitespace-nowrap">{formatDateBR(disp.date)}</td>
                      <td className="p-2.5 font-mono whitespace-nowrap">
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {primaryPrefix}
                        </span>
                        {equip?.plate && equip.plate !== primaryPrefix && (
                          <span className="ml-1 text-[10px] text-[#6b7280] dark:text-[#9ca3af] font-normal">
                            ({equip.plate})
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af]">{disp.equipmentType || '-'}</td>
                      <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af] whitespace-nowrap">{equipSupplier}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#f1f3f5] dark:bg-[#262626] text-[#374151] dark:text-[#d1d5db] border border-[#dcdfe4] dark:border-[#383838]">
                          <Building2 className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>{equipObra}</span>
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono whitespace-nowrap">
                        {disp.equipmentMeter !== undefined && !isNaN(disp.equipmentMeter) ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-[#f1f3f5] dark:bg-[#262626] text-[#111827] dark:text-[#f3f4f6] border border-[#dcdfe4] dark:border-[#383838]">
                            {disp.equipmentMeterUnit === 'KM' ? (
                              <Gauge className="w-3 h-3 text-amber-500 shrink-0" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                            )}
                            <span>
                              {formatHours(disp.equipmentMeter)}{' '}
                              {disp.equipmentMeterUnit === 'KM' ? 'km' : 'h'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[#9ca3af]">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono">{formatHours(disp.initialMeter)}</td>
                      <td className="p-2.5 text-right font-mono">{formatHours(disp.finalMeter)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10">
                        {formatLiters(disp.liters)} L
                      </td>
                      <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af]">{disp.operator || '-'}</td>
                      <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af] max-w-xs truncate">
                        {disp.notes || '-'}
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            id={`btn-edit-dispense-${disp.id}`}
                            onClick={() => handleStartEdit(disp)}
                            title="Editar este abastecimento"
                            className="p-1 rounded text-[#6b7280] hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            id={`btn-delete-dispense-${disp.id}`}
                            onClick={() => setDispenseToDelete(disp)}
                            title="Excluir este abastecimento"
                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-xs text-[#9ca3af]">
                    <div className="font-semibold text-sm text-[#4b5563] dark:text-[#9ca3af] mb-1">
                      {dispenses.length === 0
                        ? 'Esta obra ainda não possui dados cadastrados.'
                        : 'Nenhum registro encontrado para os filtros selecionados.'}
                    </div>
                    <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                      {dispenses.length === 0
                        ? 'Nenhum registro encontrado. Registre os abastecimentos deste comboio para iniciar o controle.'
                        : 'Nenhum registro encontrado.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredDispenses.length > 0 && (
              <tfoot>
                <tr className="bg-amber-500/10 dark:bg-amber-500/15 font-bold border-t-2 border-amber-500/30 text-[#111827] dark:text-[#f3f4f6]">
                  <td
                    colSpan={8}
                    className="p-2.5 text-right uppercase text-[11px] font-industrial tracking-wider text-[#374151] dark:text-[#d1d5db]"
                  >
                    Subtotal ({filteredDispenses.length}{' '}
                    {filteredDispenses.length === 1 ? 'abastecimento' : 'abastecimentos'}):
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/20 text-xs sm:text-sm whitespace-nowrap">
                    {formatLiters(subtotalLiters)} L
                  </td>
                  <td colSpan={3} className="p-2.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {dispenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1f1f1f] rounded-lg max-w-md w-full p-4 sm:p-5 border border-[#dcdfe4] dark:border-[#333333] shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirmar Exclusão de Abastecimento</span>
            </div>
            <p className="text-xs text-[#4b5563] dark:text-[#d1d5db]">
              Deseja realmente excluir o abastecimento de{' '}
              <strong>{formatLiters(dispenseToDelete.liters)} Litros</strong> para o equipamento{' '}
              <strong>{dispenseToDelete.equipmentCode}</strong> ({dispenseToDelete.location || 'Obra'}) em{' '}
              <strong>{formatDateBR(dispenseToDelete.date)}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#eaecef] dark:border-[#2f2f2f]">
              <button
                type="button"
                onClick={() => setDispenseToDelete(null)}
                className="px-3 py-1.5 rounded border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDispense(dispenseToDelete.id);
                  setDispenseToDelete(null);
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Excluir Abastecimento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
