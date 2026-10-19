import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Equipment, DailyLog } from '../types';
import {
  getTodayDateString,
  formatDateBR,
  formatHours,
  exportDailyLogsToCSV,
  sortDailyLogsAscending,
} from '../utils/storage';
import { exportDailyLogsToPDF } from '../utils/pdfDailyLogExport';
import {
  ClipboardCheck,
  Search,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  User,
  MapPin,
  Clock,
  Wrench,
  Gauge,
  Download,
  ChevronDown,
  Info,
  Check,
  FileText,
  Building2,
  Plus,
} from 'lucide-react';
import { DailyHoursLineChart } from './DailyHoursLineChart';
import { UserRole } from '../types';

interface DailyLogTabProps {
  equipments: Equipment[];
  dailyLogs: DailyLog[];
  onSaveDailyLog: (log: Omit<DailyLog, 'id' | 'createdAt'>) => { success: boolean; message: string };
  onUpdateDailyLog?: (log: DailyLog) => { success: boolean; message: string };
  onDeleteDailyLog: (id: string) => void;
  onNavigateToDatabase: () => void;
  userRole?: UserRole;
}

export const DailyLogTab: React.FC<DailyLogTabProps> = ({
  equipments,
  dailyLogs,
  onSaveDailyLog,
  onUpdateDailyLog,
  onDeleteDailyLog,
  onNavigateToDatabase,
  userRole = 'admin',
}) => {
  const isDeveloper = userRole === 'admin' || userRole === 'gestor' || userRole === 'developer';
  const isReadOnly = userRole === 'visualizador';

  // Form State
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [selectedPlate, setSelectedPlate] = useState('');
  const [operator, setOperator] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [initialHourMeter, setInitialHourMeter] = useState<string>('');
  const [finalHourMeter, setFinalHourMeter] = useState<string>('');
  const [maintenanceHours, setMaintenanceHours] = useState<string>('0');
  const [notes, setNotes] = useState('');

  // Autocomplete UI state
  const [isPlateDropdownOpen, setIsPlateDropdownOpen] = useState(false);
  const plateDropdownRef = useRef<HTMLDivElement>(null);

  // Form error or hint state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete log confirmation
  const [logToDelete, setLogToDelete] = useState<DailyLog | null>(null);

  // Filter state for the history log table (same model as Histórico de Abastecimentos)
  const [filterDate, setFilterDate] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('');

  // Close plate dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (plateDropdownRef.current && !plateDropdownRef.current.contains(event.target as Node)) {
        setIsPlateDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find equipment corresponding to typed/selected plate
  const matchedEquipment = useMemo(() => {
    if (!selectedPlate.trim()) return null;
    const cleanPlate = selectedPlate.trim().toUpperCase();
    const rawClean = cleanPlate.replace(/[-\s/]/g, '');

    return (
      equipments.find((eq) => {
        const c = eq.code.toUpperCase();
        const pl = (eq.plate || '').toUpperCase();
        const pr = (eq.prefix || '').toUpperCase();
        if (c === cleanPlate || pl === cleanPlate || pr === cleanPlate) return true;
        if (c.replace(/[-\s/]/g, '') === rawClean) return true;
        if (pl && pl.replace(/[-\s/]/g, '') === rawClean) return true;
        if (pr && pr.replace(/[-\s/]/g, '') === rawClean) return true;
        return false;
      }) || null
    );
  }, [selectedPlate, equipments]);

  // Handle choosing or confirming an equipment
  const applyEquipmentData = (eq: Equipment) => {
    setSelectedPlate(eq.prefix || eq.plate || eq.code);
    setIsPlateDropdownOpen(false);
    setOperator(eq.operator || '');
    if (eq.location) {
      setLocation(eq.location);
    }
    // Set initial hour meter from the equipment's current hour meter
    setInitialHourMeter(String(eq.currentHourMeter));
    setFinalHourMeter(''); // Reset final to prompt new input
    setErrorMessage(null);
  };

  // Autocomplete suggestions based on input
  const plateSuggestions = useMemo(() => {
    const q = selectedPlate.trim().toUpperCase();
    if (!q) return equipments;
    return equipments.filter(
      (eq) =>
        eq.code.toUpperCase().includes(q) ||
        (eq.plate && eq.plate.toUpperCase().includes(q)) ||
        (eq.prefix && eq.prefix.toUpperCase().includes(q)) ||
        eq.type.toUpperCase().includes(q) ||
        eq.operator.toUpperCase().includes(q) ||
        (eq.model && eq.model.toUpperCase().includes(q)) ||
        (eq.brand && eq.brand.toUpperCase().includes(q)) ||
        (eq.supplier && eq.supplier.toUpperCase().includes(q))
    );
  }, [selectedPlate, equipments]);

  // Helper for flexible Brazilian/international number parsing (e.g. "1.500,5" or "1500.5")
  const parseHourValue = (val: string): number => {
    if (!val) return NaN;
    const clean = val.trim();
    if (clean.includes(',')) {
      return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(clean);
  };

  // Live calculation of worked hours
  const calculation = useMemo(() => {
    const init = parseHourValue(initialHourMeter);
    const fin = parseHourValue(finalHourMeter);

    if (isNaN(init) || isNaN(fin) || finalHourMeter.trim() === '') {
      return { isValid: false, workedHours: 0, error: null };
    }

    if (fin < init) {
      return {
        isValid: false,
        workedHours: 0,
        error: 'Horímetro Final não pode ser menor que o Horímetro Inicial!',
      };
    }

    const diff = Number((fin - init).toFixed(2));
    return { isValid: true, workedHours: diff, error: null };
  }, [initialHourMeter, finalHourMeter]);

  // Submit Daily Log
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPlate = selectedPlate.trim().toUpperCase();
    if (!cleanPlate) {
      setErrorMessage('Informe ou selecione a Placa/Prefixo do equipamento.');
      return;
    }

    // Validation 1: Plate must be registered in the database
    if (!matchedEquipment) {
      setErrorMessage(
        `O equipamento com placa/prefixo "${cleanPlate}" não está cadastrado na Base de Dados. Cadastre-o na aba "Base de Dados" antes de lançar.`
      );
      return;
    }

    const initVal = parseHourValue(initialHourMeter);
    const finVal = parseHourValue(finalHourMeter);

    if (isNaN(initVal) || initVal < 0) {
      setErrorMessage('Horímetro Inicial inválido.');
      return;
    }

    if (isNaN(finVal) || finVal < 0) {
      setErrorMessage('Informe o Horímetro Final após o turno.');
      return;
    }

    // Validation 2: Final Hour Meter >= Initial Hour Meter
    if (finVal < initVal) {
      setErrorMessage(
        `O Horímetro Final (${formatHours(finVal)}) não pode ser menor que o Horímetro Inicial (${formatHours(initVal)}).`
      );
      return;
    }

    const maintVal = parseHourValue(maintenanceHours || '0');
    const validMaint = isNaN(maintVal) || maintVal < 0 ? 0 : maintVal;
    const workedHours = Number((finVal - initVal).toFixed(2));

    if (editingLogId) {
      const existing = dailyLogs.find((l) => l.id === editingLogId);
      if (!existing) {
        setErrorMessage('Apontamento não encontrado para edição.');
        return;
      }

      const updatedLog: DailyLog = {
        ...existing,
        equipmentId: matchedEquipment.id,
        equipmentCode: matchedEquipment.prefix || matchedEquipment.plate || matchedEquipment.code,
        equipmentType: matchedEquipment.type,
        equipmentBrandModel: matchedEquipment.brandModel,
        date: date || getTodayDateString(),
        operator: operator.trim() || matchedEquipment.operator || 'Não informado',
        location: location.trim() || matchedEquipment.location || 'Sem obra definida',
        initialHourMeter: initVal,
        finalHourMeter: finVal,
        workedHours,
        maintenanceHours: validMaint,
        notes: notes.trim(),
      };

      if (onUpdateDailyLog) {
        const result = onUpdateDailyLog(updatedLog);
        if (result.success) {
          handleCancelEdit();
        } else {
          setErrorMessage(result.message);
        }
      }
      return;
    }

    const result = onSaveDailyLog({
      equipmentId: matchedEquipment.id,
      equipmentCode: matchedEquipment.code,
      equipmentType: matchedEquipment.type,
      equipmentBrandModel: matchedEquipment.brandModel,
      date: date || getTodayDateString(),
      operator: operator.trim() || matchedEquipment.operator || 'Não informado',
      location: location.trim() || matchedEquipment.location || 'Sem obra definida',
      initialHourMeter: initVal,
      finalHourMeter: finVal,
      workedHours,
      maintenanceHours: validMaint,
      notes: notes.trim(),
    });

    if (result.success) {
      // Reset entry form for next entry (preserve date and location for operator convenience)
      setSelectedPlate('');
      setInitialHourMeter('');
      setFinalHourMeter('');
      setMaintenanceHours('0');
      setNotes('');
      setErrorMessage(null);
    } else {
      setErrorMessage(result.message);
    }
  };

  const handleStartEdit = (log: DailyLog) => {
    setEditingLogId(log.id);
    setSelectedPlate(log.equipmentCode);
    setDate(log.date);
    setOperator(log.operator || '');
    setLocation(log.location || '');
    setInitialHourMeter(String(log.initialHourMeter));
    setFinalHourMeter(String(log.finalHourMeter));
    setMaintenanceHours(String(log.maintenanceHours || 0));
    setNotes(log.notes || '');
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingLogId(null);
    setSelectedPlate('');
    setInitialHourMeter('');
    setFinalHourMeter('');
    setMaintenanceHours('0');
    setNotes('');
    setErrorMessage(null);
  };

  // Filtered daily logs organized in ascending order by date (do mais antigo ao mais recente)
  const filteredLogs = useMemo(() => {
    const q = filterEquipment.trim().toUpperCase();
    const matched = dailyLogs.filter((log) => {
      const matchDate = !filterDate || log.date === filterDate;
      const matchSearch =
        !q ||
        log.equipmentCode.toUpperCase().includes(q) ||
        (log.equipmentType || '').toUpperCase().includes(q) ||
        (log.location || '').toUpperCase().includes(q) ||
        (log.operator || '').toUpperCase().includes(q);
      return matchDate && matchSearch;
    });
    return sortDailyLogsAscending(matched);
  }, [dailyLogs, filterDate, filterEquipment]);

  // Aggregate stats from filtered logs
  const summaryStats = useMemo(() => {
    let totalWorked = 0;
    let totalMaintenance = 0;
    filteredLogs.forEach((log) => {
      totalWorked += log.workedHours || 0;
      totalMaintenance += log.maintenanceHours || 0;
    });
    return {
      count: filteredLogs.length,
      totalWorked: Number(totalWorked.toFixed(1)),
      totalMaintenance: Number(totalMaintenance.toFixed(1)),
    };
  }, [filteredLogs]);

  // Quick increment helper for final hourmeter (+0.5h, +1.0h, +8.0h)
  const addHoursToFinal = (hoursToAdd: number) => {
    const base =
      finalHourMeter.trim() !== ''
        ? parseFloat(finalHourMeter.replace(',', '.'))
        : parseFloat(initialHourMeter.replace(',', '.')) || 0;

    if (!isNaN(base)) {
      const updated = Number((base + hoursToAdd).toFixed(1));
      setFinalHourMeter(String(updated));
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">
      {/* Top Banner Card for Gestão de Frotas */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3 sm:p-4 border border-[#dcdfe4] dark:border-[#333333] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
            <ClipboardCheck className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6]">
                Gestão de Frotas — Apontamento de Parte Diária
              </h2>
              <span className="px-2 py-0.5 rounded bg-amber-500 text-black font-mono font-bold text-xs">
                FROTAS & OBRAS
              </span>
            </div>
            <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
              Controle diário de horímetros, horas operacionais e manutenções da frota de máquinas e equipamentos
            </p>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333]">
            <span className="text-[#6b7280] dark:text-[#9ca3af]">Total Horas: </span>
            <strong className="font-mono text-amber-600 dark:text-amber-400 font-bold">
              {formatHours(summaryStats.totalWorked)} h
            </strong>
          </div>
          <div className="px-2.5 py-1 rounded bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333]">
            <span className="text-[#6b7280] dark:text-[#9ca3af]">Apontamentos: </span>
            <strong className="font-mono text-[#111827] dark:text-[#f3f4f6]">
              {dailyLogs.length}
            </strong>
          </div>
          {equipments.length === 0 && (
            <button
              onClick={onNavigateToDatabase}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-bold bg-amber-500 text-black rounded hover:bg-amber-400 shadow-xs"
            >
              <span>Cadastrar Equipamentos</span>
            </button>
          )}
        </div>
      </div>

      {/* Lançamento Form Card */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3 sm:p-4 border border-[#dcdfe4] dark:border-[#333333] shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#eaecef] dark:border-[#262626]">
          <h3 className="text-sm sm:text-base font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6] flex items-center gap-2">
            {editingLogId ? (
              <>
                <Edit2 className="w-4 h-4 text-amber-500" />
                <span>Editar Lançamento de Horas — Parte Diária</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
                  Modo Edição
                </span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-amber-500" />
                <span>Novo Lançamento de Horas — Parte Diária</span>
              </>
            )}
          </h3>
          {editingLogId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs text-[#6b7280] dark:text-[#9ca3af] hover:text-amber-500 underline"
            >
              Cancelar Edição
            </button>
          )}
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-3 p-2.5 text-xs rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-in fade-in"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Main Entry Form - High Density Compact Grid */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Top Row: Placa/Prefixo (Autocomplete) & Equipamento Status */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3">
            {/* Placa/Prefixo with Autocomplete (5 cols) */}
            <div className="md:col-span-5 relative" ref={plateDropdownRef}>
              <label
                htmlFor="input-plate-autocomplete"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                1. Placa / Prefixo do Equipamento <span className="text-amber-500">*</span>
              </label>

              <div className="relative">
                <input
                  id="input-plate-autocomplete"
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="Digite ou selecione a placa..."
                  value={selectedPlate}
                  onChange={(e) => {
                    setSelectedPlate(e.target.value.toUpperCase());
                    setIsPlateDropdownOpen(true);
                  }}
                  onFocus={() => setIsPlateDropdownOpen(true)}
                  className={`w-full h-8 pl-2.5 pr-8 bg-[#f8fafc] dark:bg-[#121212] border rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers font-bold text-xs uppercase focus:outline-none focus:border-amber-500 ${
                    matchedEquipment
                      ? 'border-amber-500 ring-1 ring-amber-500/20'
                      : 'border-[#dcdfe4] dark:border-[#333333]'
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setIsPlateDropdownOpen((prev) => !prev)}
                  className="absolute right-2 top-2 text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]"
                  aria-label="Abrir lista de placas"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Autocomplete dropdown suggestions */}
              {isPlateDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded shadow-xl z-40 divide-y divide-[#eaecef] dark:divide-[#262626] animate-in fade-in duration-100">
                  {plateSuggestions.length === 0 ? (
                    <div className="p-2.5 text-xs text-[#6b7280] dark:text-[#9ca3af] text-center">
                      Nenhum equipamento encontrado com este prefixo.
                    </div>
                  ) : (
                    plateSuggestions.map((eq) => (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => applyEquipmentData(eq)}
                        className="w-full text-left px-2.5 py-2 hover:bg-[#f1f3f5] dark:hover:bg-[#262626] flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono-numbers font-bold text-xs text-[#111827] dark:text-amber-400">
                              {eq.prefix || eq.code}
                            </span>
                            {eq.plate && (
                              <span className="text-[11px] font-mono px-1 rounded bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1]">
                                {eq.plate}
                              </span>
                            )}
                            <span className="text-xs font-semibold text-[#4b5563] dark:text-[#d1d5db]">
                              {eq.type}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                            {eq.operator ? `Op: ${eq.operator}` : 'Sem operador'} •{' '}
                            {eq.model || eq.brandModel || 'Sem modelo'}
                            {eq.brand ? ` (${eq.brand})` : ''}
                            {eq.supplier ? ` • Forn: ${eq.supplier}` : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block">Último horímetro</span>
                          <span className="font-mono-numbers text-xs font-semibold text-[#111827] dark:text-amber-400">
                            {formatHours(eq.currentHourMeter)} h
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Feedback indicator - Informações destacadas em amarelo */}
              <div className="mt-1">
                {matchedEquipment ? (
                  <div className="p-2 rounded-lg bg-amber-400/15 dark:bg-amber-500/20 border-2 border-amber-400 dark:border-amber-500/70 text-xs text-amber-950 dark:text-amber-100 flex items-center justify-between flex-wrap gap-2 animate-fadeIn shadow-2xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black font-mono text-xs shadow-2xs">
                        Prefixo: {matchedEquipment.prefix || matchedEquipment.code}
                      </span>
                      {matchedEquipment.plate && (
                        <span className="px-1.5 py-0.5 rounded bg-white/90 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-[11px] font-bold border border-amber-300 dark:border-amber-600">
                          Placa: {matchedEquipment.plate}
                        </span>
                      )}
                      <span className="font-bold text-amber-950 dark:text-amber-100">
                        {matchedEquipment.type}
                      </span>
                    </div>
                    <div className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
                      Obra: {matchedEquipment.location || '-'} • Op: {matchedEquipment.operator || '-'}
                    </div>
                  </div>
                ) : selectedPlate.trim() ? (
                  <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Equipamento não cadastrado na Base de Dados.</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                    Puxe da frota cadastrada para preenchimento rápido.
                  </span>
                )}
              </div>
            </div>

            {/* Data do Apontamento (3 cols) */}
            <div className="md:col-span-3">
              <label
                htmlFor="input-log-date"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Data <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-log-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-8 px-2 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] font-medium text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
              <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">Data do turno de operação.</span>
            </div>

            {/* Obra / Local (4 cols - preenchido mas editável) */}
            <div className="md:col-span-4">
              <label
                htmlFor="input-log-location"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Obra / Local de Trabalho
              </label>
              <div className="relative">
                <input
                  id="input-log-location"
                  type="text"
                  placeholder="Ex: Obra Rodovia Norte"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
              <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                Preenchido com o padrão, editável para este dia.
              </span>
            </div>
          </div>

          {/* Second Row: Operador, Horímetro Inicial, Horímetro Final, Manutenção */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Operador / Motorista (preenchido automaticamente, editável) */}
            <div>
              <label
                htmlFor="input-log-operator"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Operador / Motorista
              </label>
              <input
                id="input-log-operator"
                type="text"
                placeholder="Nome do operador no turno"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                Preenchido com o operador cadastrado.
              </span>
            </div>

            {/* Horímetro Inicial (Auto-preenchido com a última leitura salva) */}
            <div>
              <label
                htmlFor="input-log-initial-hourmeter"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Horímetro Inicial <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-log-initial-hourmeter"
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  placeholder="0.0"
                  value={initialHourMeter}
                  onChange={(e) => setInitialHourMeter(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-8 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers font-bold text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="absolute right-2 top-1.5 text-[11px] font-bold text-[#9ca3af] font-mono">
                  hrs
                </span>
              </div>
              <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">Última leitura registrada na base.</span>
            </div>

            {/* Horímetro Final (Entrada do operador) */}
            <div>
              <label
                htmlFor="input-log-final-hourmeter"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Horímetro Final <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-log-final-hourmeter"
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  placeholder="Leitura final..."
                  value={finalHourMeter}
                  onChange={(e) => setFinalHourMeter(e.target.value)}
                  className={`w-full h-8 pl-2.5 pr-8 bg-[#f8fafc] dark:bg-[#121212] border rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers font-bold text-xs focus:outline-none ${
                    calculation.error
                      ? 'border-rose-500 ring-1 ring-rose-500/30'
                      : 'border-[#dcdfe4] dark:border-[#333333] focus:border-amber-500'
                  }`}
                />
                <span className="absolute right-2 top-1.5 text-[11px] font-bold text-[#9ca3af] font-mono">
                  hrs
                </span>
              </div>

              {/* Quick increment buttons (+4h, +8h, +8.5h) */}
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] text-[#9ca3af]">Atalhos:</span>
                {[4, 8, 8.5].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => addHoursToFinal(hrs)}
                    title={`Adicionar +${hrs}h ao horímetro inicial`}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f1f3f5] dark:bg-[#262626] hover:bg-amber-500/20 text-[#4b5563] dark:text-[#d1d5db] border border-[#dcdfe4] dark:border-[#333333] cursor-pointer"
                  >
                    +{hrs}h
                  </button>
                ))}
              </div>
            </div>

            {/* Horas em Manutenção (Opcional) */}
            <div>
              <label
                htmlFor="input-log-maintenance"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Horas Manutenção <span className="text-[#9ca3af] font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <input
                  id="input-log-maintenance"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                  value={maintenanceHours}
                  onChange={(e) => setMaintenanceHours(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-8 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="absolute right-2 top-1.5 text-[11px] font-bold text-[#9ca3af] font-mono">
                  hrs
                </span>
              </div>
              <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">Tempo parado para reparos.</span>
            </div>
          </div>

          {/* Third Row: Observações & Live Total Card */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3 items-end pt-0.5">
            {/* Observações adicionais */}
            <div className="md:col-span-7">
              <label
                htmlFor="input-log-notes"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
              >
                Observações do Turno <span className="text-[#9ca3af] font-normal">(opcional)</span>
              </label>
              <input
                id="input-log-notes"
                type="text"
                placeholder="Ex: Escavação da vala B, abastecimento de 150L, troca de mangueira..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Calculated Total Display */}
            <div className="md:col-span-5">
              <div
                className={`h-8 px-3 rounded border flex items-center justify-between transition-colors ${
                  calculation.error
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200'
                    : calculation.isValid && calculation.workedHours > 0
                    ? 'bg-amber-500/10 border-amber-500/30 text-[#111827] dark:text-[#f3f4f6]'
                    : 'bg-[#f8fafc] dark:bg-[#141414] border-[#dcdfe4] dark:border-[#333333] text-[#6b7280] dark:text-[#9ca3af]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                    Total Horas Trabalhadas:
                  </span>
                  <span className="text-[10px] opacity-75 font-mono hidden sm:inline">(Final − Inicial)</span>
                </div>

                <div className="text-right">
                  {calculation.error ? (
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      Inválido (Final &lt; Inicial)
                    </span>
                  ) : (
                    <div className="font-mono-numbers font-bold text-base text-amber-600 dark:text-amber-400">
                      {formatHours(calculation.workedHours)}{' '}
                      <span className="text-xs font-normal text-[#6b7280] dark:text-[#9ca3af]">
                        h
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-[#eaecef] dark:border-[#262626]">
            <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                {editingLogId
                  ? 'Ao salvar as alterações, o apontamento e o horímetro de referência serão recalculados.'
                  : 'Ao salvar, o Horímetro Inicial desta máquina será atualizado automaticamente na Base de Dados.'}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {editingLogId && (
                <button
                  type="button"
                  id="btn-cancel-edit-daily-log"
                  onClick={handleCancelEdit}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#4b5563] dark:text-[#d1d5db] transition-colors"
                >
                  Cancelar Edição
                </button>
              )}
              <button
                id="btn-save-daily-log"
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-8 px-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded text-xs transition-colors shadow-xs"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{editingLogId ? 'Salvar Alterações' : 'Salvar Apontamento'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Gráfico de Linha: Horas Trabalhadas vs Manutenção */}
      <DailyHoursLineChart logs={filteredLogs} />

      {/* History Table - Mesmo modelo do Histórico de Abastecimentos */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3 sm:p-4 border border-[#dcdfe4] dark:border-[#333333] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#eaecef] dark:border-[#262626]">
          <div>
            <h3 className="text-sm sm:text-base font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6] flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Apontamentos Realizados — Gestão de Frotas
            </h3>
            <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
              Histórico de horas e horímetros da frota ({filteredLogs.length} itens encontrados)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              id="btn-export-pdf-daily-logs"
              onClick={() => {
                const filterDesc = filterDate || filterEquipment
                  ? `Filtros: ${filterDate ? `Data: ${formatDateBR(filterDate)}` : ''}${filterDate && filterEquipment ? ' • ' : ''}${filterEquipment ? `Busca: "${filterEquipment}"` : ''}`
                  : undefined;
                exportDailyLogsToPDF(filteredLogs, equipments, {
                  obraLabel: 'Frotas & Obras',
                  filterInfo: filterDesc,
                  userName: 'Gestão Operacional',
                });
              }}
              disabled={filteredLogs.length === 0}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded bg-[#113861] hover:bg-[#0d2f54] text-white disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-xs border border-[#1b4d82] transition-colors shadow-xs cursor-pointer"
              title="Exportar apontamentos de Parte Diária em documento PDF consolidado com a identidade Makmo"
            >
              <FileText className="w-3.5 h-3.5 text-[#20b4a7]" />
              <span>Exportar Relatório PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Controls - Mesmo modelo do Histórico de Abastecimentos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#9ca3af]" />
            <input
              id="filter-date-input"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full h-7.5 pl-8 pr-2.5 text-xs bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#9ca3af]" />
            <input
              id="filter-equipment-input"
              type="text"
              placeholder="Filtrar por placa da máquina, tipo ou obra..."
              value={filterEquipment}
              onChange={(e) => setFilterEquipment(e.target.value)}
              className="w-full h-7.5 pl-8 pr-2.5 text-xs bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500 font-mono uppercase"
            />
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333] flex items-center gap-1.5">
            <span className="text-[#6b7280] dark:text-[#9ca3af]">Total Horas Trabalhadas:</span>
            <strong className="font-mono text-amber-600 dark:text-amber-400 font-bold">
              {formatHours(summaryStats.totalWorked)} h
            </strong>
          </div>
          <div className="px-2.5 py-1 rounded bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333] flex items-center gap-1.5">
            <span className="text-[#6b7280] dark:text-[#9ca3af]">Apontamentos:</span>
            <strong className="font-mono text-[#111827] dark:text-[#f3f4f6]">
              {summaryStats.count}
            </strong>
          </div>
          {summaryStats.totalMaintenance > 0 && (
            <div className="px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <span className="text-[11px]">Horas em Manutenção:</span>
              <strong className="font-mono font-bold">
                {formatHours(summaryStats.totalMaintenance)} h
              </strong>
            </div>
          )}
          {(filterDate || filterEquipment) && (
            <button
              type="button"
              onClick={() => {
                setFilterDate('');
                setFilterEquipment('');
              }}
              className="px-2 py-0.5 rounded text-[11px] text-[#6b7280] hover:text-amber-600 dark:hover:text-amber-400 underline ml-auto cursor-pointer"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Table - Mesmo modelo do Histórico de Abastecimentos */}
        <div className="overflow-x-auto border border-[#eaecef] dark:border-[#262626] rounded-md">
          <table className="w-full min-w-[950px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] dark:bg-[#141414] text-[#4b5563] dark:text-[#9ca3af] uppercase text-[10px] font-bold tracking-wider border-b border-[#eaecef] dark:border-[#262626]">
                <th className="p-2.5">Data</th>
                <th className="p-2.5">Placa da Máquina</th>
                <th className="p-2.5">Tipo</th>
                <th className="p-2.5">Obra</th>
                <th className="p-2.5 text-right font-mono">Iniciante</th>
                <th className="p-2.5 text-right font-mono">Encerrante</th>
                <th className="p-2.5 text-right font-mono">Horas Trab. (h)</th>
                <th className="p-2.5 text-right font-mono">Manutenção</th>
                <th className="p-2.5">Operador / Resp.</th>
                <th className="p-2.5">Observações</th>
                <th className="p-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaecef] dark:divide-[#262626]">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const equip = equipments.find(
                    (eq) =>
                      (eq.plate && eq.plate.trim().toUpperCase() === log.equipmentCode.trim().toUpperCase()) ||
                      eq.code.trim().toUpperCase() === log.equipmentCode.trim().toUpperCase() ||
                      (eq.prefix && eq.prefix.trim().toUpperCase() === log.equipmentCode.trim().toUpperCase())
                  );
                  const equipObra = log.location || equip?.location || 'Não informada';
                  const displayPlate = equip?.plate || log.equipmentCode;

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-amber-500/5 transition-colors text-[#111827] dark:text-[#f3f4f6] ${
                        editingLogId === log.id ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      <td className="p-2.5 font-mono whitespace-nowrap">{formatDateBR(log.date)}</td>
                      <td className="p-2.5 font-mono whitespace-nowrap">
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {displayPlate}
                        </span>
                        {equip?.prefix && equip.prefix !== displayPlate && (
                          <span className="ml-1 text-[10px] text-[#6b7280] dark:text-[#9ca3af] font-normal">
                            ({equip.prefix})
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af]">
                        {log.equipmentType || equip?.type || '-'}
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#f1f3f5] dark:bg-[#262626] text-[#374151] dark:text-[#d1d5db] border border-[#dcdfe4] dark:border-[#383838]">
                          <Building2 className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>{equipObra}</span>
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono">{formatHours(log.initialHourMeter)}</td>
                      <td className="p-2.5 text-right font-mono">{formatHours(log.finalHourMeter)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10">
                        {formatHours(log.workedHours)} h
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {log.maintenanceHours > 0 ? (
                          <span className="text-rose-500 font-semibold">
                            {formatHours(log.maintenanceHours)} h
                          </span>
                        ) : (
                          <span className="text-[#9ca3af]">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af]">{log.operator || '-'}</td>
                      <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af] max-w-xs truncate" title={log.notes}>
                        {log.notes || '-'}
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          {!isReadOnly && (
                            <button
                              type="button"
                              id={`btn-edit-log-${log.id}`}
                              onClick={() => handleStartEdit(log)}
                              title="Editar este lançamento"
                              className="p-1 rounded text-[#9ca3af] hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isDeveloper && !isReadOnly && (
                            <button
                              type="button"
                              id={`btn-delete-log-${log.id}`}
                              onClick={() => setLogToDelete(log)}
                              title="Excluir este apontamento"
                              className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-xs text-[#9ca3af]">
                    <div className="font-semibold text-sm text-[#4b5563] dark:text-[#9ca3af] mb-1">
                      {dailyLogs.length === 0
                        ? 'Esta obra ainda não possui dados cadastrados.'
                        : 'Nenhum registro encontrado para os filtros selecionados.'}
                    </div>
                    <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                      {dailyLogs.length === 0
                        ? 'Nenhum registro encontrado. Lance os apontamentos de horas das máquinas para iniciar o histórico.'
                        : 'Nenhum registro encontrado.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeveloper && logToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1f1f1f] rounded-lg max-w-md w-full p-4 sm:p-5 border border-[#dcdfe4] dark:border-[#333333] shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirmar Exclusão de Apontamento</span>
            </div>
            <p className="text-xs text-[#4b5563] dark:text-[#d1d5db]">
              Deseja realmente excluir o apontamento de{' '}
              <strong>{formatHours(logToDelete.workedHours)} Horas</strong> para o equipamento{' '}
              <strong>{logToDelete.equipmentCode}</strong> ({logToDelete.location || 'Obra'}) em{' '}
              <strong>{formatDateBR(logToDelete.date)}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#eaecef] dark:border-[#2f2f2f]">
              <button
                type="button"
                onClick={() => setLogToDelete(null)}
                className="px-3 py-1.5 rounded border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-delete-log"
                onClick={() => {
                  onDeleteDailyLog(logToDelete.id);
                  setLogToDelete(null);
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Excluir Apontamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
