import {
  Equipment,
  DailyLog,
  FuelDispense,
  FuelEntry,
  ConvoyPlate,
  PreventivePlan,
  PreventiveRecord,
  AlertThresholds,
  MeasurementDeduction,
  CorrectiveMaintenance,
  AppConvoy,
} from '../types';
import { generateInitialDeductions, OFFICIAL_MEASUREMENT_DEDUCTIONS } from './deductionUtils';
import {
  INITIAL_EQUIPMENTS,
  INITIAL_LOGS,
  INITIAL_FUEL_DISPENSES,
  INITIAL_FUEL_ENTRIES,
} from '../data/initialData';
import {
  INITIAL_PREVENTIVE_PLANS,
  INITIAL_PREVENTIVE_RECORDS,
} from '../data/initialPreventiveData';
import { INITIAL_CORRECTIVE_MAINTENANCES } from '../data/initialCorrectiveData';
import { DEFAULT_ALERT_THRESHOLDS } from './preventiveUtils';

const EQUIPMENTS_KEY = 'pde_equipments_v1';
const FLEET_SYNC_KEY = 'makmo_fleet_sync_v12';
const DAILY_LOGS_KEY = 'pde_dailylogs_v1';
const DAILY_LOGS_SYNC_KEY = 'makmo_daily_logs_sync_v3';
const THEME_KEY = 'pde_theme_v1';
const FUEL_DISPENSES_KEY = 'pde_fuel_dispenses_v1';
const FUEL_ENTRIES_KEY = 'pde_fuel_entries_v1';
const FUEL_SYNC_KEY = 'makmo_fuel_sync_v12';
const PREVENTIVE_PLANS_KEY = 'makmo_preventive_plans_v1';
const PREVENTIVE_SYNC_KEY = 'makmo_preventive_sync_v5';
const PREVENTIVE_RECORDS_KEY = 'makmo_preventive_records_v1';
const ALERT_THRESHOLDS_KEY = 'makmo_alert_thresholds_v1';
const MEASUREMENT_DEDUCTIONS_KEY = 'makmo_measurement_deductions_v1';
const MEASUREMENT_DEDUCTIONS_SYNC_KEY = 'makmo_measurement_deductions_sync_v4';

export function loadEquipments(): Equipment[] {
  try {
    const raw = localStorage.getItem(EQUIPMENTS_KEY);
    const syncDone = localStorage.getItem(FLEET_SYNC_KEY) === 'true';

    if (!raw) {
      localStorage.setItem(EQUIPMENTS_KEY, JSON.stringify(INITIAL_EQUIPMENTS));
      localStorage.setItem(FLEET_SYNC_KEY, 'true');
      return INITIAL_EQUIPMENTS;
    }

    const stored: Equipment[] = JSON.parse(raw);

    // If sync not done or duplicate IDs detected, run safe merge
    const hasDupes = new Set(stored.map((e) => e.id)).size !== stored.length;

    if (!syncDone || hasDupes) {
      // Merge official fleet updates into stored fleet
      const storedMapByPrefix = new Map<string, Equipment>();
      const storedMapByPlate = new Map<string, Equipment>();
      const storedMapById = new Map<string, Equipment>();

      stored.forEach((eq) => {
        if (eq.id) storedMapById.set(eq.id, eq);
        if (eq.prefix) storedMapByPrefix.set(eq.prefix.toUpperCase(), eq);
        if (eq.plate) storedMapByPlate.set(eq.plate.toUpperCase(), eq);
      });

      const merged: Equipment[] = [];
      const handledStoredIds = new Set<string>();

      INITIAL_EQUIPMENTS.forEach((official) => {
        const normPrefix = official.prefix ? official.prefix.toUpperCase() : '';
        const normPlate = official.plate ? official.plate.toUpperCase() : '';
        const existing =
          storedMapById.get(official.id) ||
          (normPrefix ? storedMapByPrefix.get(normPrefix) : null) ||
          (normPlate ? storedMapByPlate.get(normPlate) : null);

        if (existing) {
          handledStoredIds.add(existing.id);
          merged.push({
            ...official,
            ...existing,
            id: official.id,
            code: existing.code || official.code,
            type: existing.type || official.type,
            plate: existing.plate || official.plate,
            prefix: existing.prefix || official.prefix,
            model: existing.model || official.model,
            brand: existing.brand || official.brand,
            supplier: existing.supplier || official.supplier,
            location: existing.location || official.location,
            chassis: existing.chassis || official.chassis,
            mobilizationDate: existing.mobilizationDate || official.mobilizationDate,
            demobilizationDate: existing.demobilizationDate || official.demobilizationDate,
            photoUrl: existing.photoUrl || official.photoUrl,
            obra_id: existing.obra_id || official.obra_id,
            projectId: existing.projectId || official.projectId,
            brandModel: existing.brandModel || official.brandModel,
            operator: existing.operator || official.operator,
            currentHourMeter:
              official.currentHourMeter !== undefined && official.currentHourMeter > (existing.currentHourMeter || 0)
                ? official.currentHourMeter
                : existing.currentHourMeter !== undefined
                ? existing.currentHourMeter
                : official.currentHourMeter || 0,
            lastHourMeterDate:
              official.currentHourMeter !== undefined && official.currentHourMeter > (existing.currentHourMeter || 0) && official.lastHourMeterDate
                ? official.lastHourMeterDate
                : existing.lastHourMeterDate || official.lastHourMeterDate,
            currentKm: Math.max(official.currentKm || 0, existing.currentKm || 0),
            lastKmDate: existing.lastKmDate || official.lastKmDate,
            files: existing.files && existing.files.length > 0 ? existing.files : official.files,
            updatedAt: existing.updatedAt || new Date().toISOString(),
          });
        } else {
          merged.push(official);
        }
      });

      // Retain custom equipments created by users
      stored.forEach((eq) => {
        if (!handledStoredIds.has(eq.id)) {
          merged.push(eq);
        }
      });

      // Ensure strictly unique IDs across the result
      const deduplicated: Equipment[] = [];
      const seenIds = new Set<string>();
      for (const eq of merged) {
        if (!seenIds.has(eq.id)) {
          seenIds.add(eq.id);
          deduplicated.push(eq);
        } else {
          const uniqueId = `eq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          seenIds.add(uniqueId);
          deduplicated.push({ ...eq, id: uniqueId });
        }
      }

      localStorage.setItem(EQUIPMENTS_KEY, JSON.stringify(deduplicated));
      localStorage.setItem(FLEET_SYNC_KEY, 'true');
      return deduplicated;
    }

    return stored;
  } catch (err) {
    console.error('Error reading equipments from localStorage', err);
    return INITIAL_EQUIPMENTS;
  }
}

export function saveEquipments(data: Equipment[], allowEmpty = false): void {
  try {
    if (!allowEmpty && (!data || data.length === 0)) {
      console.warn('Blocked attempt to overwrite equipments with empty array');
      return;
    }
    // Sanitize large base64 attachments from localStorage to prevent quota exceeded errors
    // Full base64 is safely retained in IndexedDB
    const sanitized = data.map((eq) => {
      if (!eq.files || eq.files.length === 0) return eq;
      return {
        ...eq,
        files: eq.files.map((f) => {
          if (f.dataUrl && f.dataUrl.length > 80 * 1024) {
            return { ...f, dataUrl: '' };
          }
          return f;
        }),
      };
    });
    localStorage.setItem(EQUIPMENTS_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('LocalStorage saveEquipments warning, trying minimal payload:', err);
    try {
      const minimal = data.map((eq) => ({
        ...eq,
        files: eq.files?.map((f) => ({ ...f, dataUrl: '' })),
      }));
      localStorage.setItem(EQUIPMENTS_KEY, JSON.stringify(minimal));
    } catch (e) {
      console.error('Error saving equipments to localStorage', e);
    }
  }
}

export function sortDailyLogsAscending(logs: DailyLog[]): DailyLog[] {
  return [...logs].sort((a, b) => {
    // 1. Data em ordem crescente (do mais antigo para o mais recente)
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    // 2. Horímetro inicial crescente
    if (a.initialHourMeter !== b.initialHourMeter) {
      return a.initialHourMeter - b.initialHourMeter;
    }
    // 3. Ordem de criação
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}

export function loadDailyLogs(): DailyLog[] {
  try {
    const raw = localStorage.getItem(DAILY_LOGS_KEY);
    const syncDone = localStorage.getItem(DAILY_LOGS_SYNC_KEY) === 'true';

    if (!raw) {
      const sortedInitial = sortDailyLogsAscending(INITIAL_LOGS);
      localStorage.setItem(DAILY_LOGS_KEY, JSON.stringify(sortedInitial));
      localStorage.setItem(DAILY_LOGS_SYNC_KEY, 'true');
      return sortedInitial;
    }

    let parsed: DailyLog[] = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];

    // Safe non-destructive merge: preserve all existing user logs and backfill initial logs
    if (!syncDone) {
      const logsMap = new Map<string, DailyLog>();
      INITIAL_LOGS.forEach((l) => logsMap.set(l.id, l));
      parsed.forEach((l) => logsMap.set(l.id, l)); // User logs take precedence
      const merged = sortDailyLogsAscending(Array.from(logsMap.values()));
      localStorage.setItem(DAILY_LOGS_KEY, JSON.stringify(merged));
      localStorage.setItem(DAILY_LOGS_SYNC_KEY, 'true');
      return merged;
    }

    return sortDailyLogsAscending(parsed);
  } catch (err) {
    console.error('Error reading daily logs from localStorage', err);
    return sortDailyLogsAscending(INITIAL_LOGS);
  }
}

export function saveDailyLogs(data: DailyLog[], allowEmpty = false): void {
  try {
    if (!allowEmpty && (!data || data.length === 0)) {
      console.warn('Blocked attempt to overwrite daily logs with empty array');
      return;
    }
    localStorage.setItem(DAILY_LOGS_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Error saving daily logs to localStorage', err);
  }
}

export function loadSavedTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // ignore
  }
  return 'dark'; // Industrial dark mode feels great by default or light
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function formatHours(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0,0';
  return Number(val).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

/**
 * Exports daily logs array to a CSV file compatible with Excel PT-BR (semicolon delimited with UTF-8 BOM)
 */
export function exportDailyLogsToCSV(logs: DailyLog[]): void {
  if (!logs || logs.length === 0) {
    return;
  }

  const sorted = sortDailyLogsAscending(logs);

  const headers = [
    'Data',
    'Placa/Prefixo',
    'Tipo de Equipamento',
    'Marca e Modelo',
    'Operador/Motorista',
    'Obra/Local',
    'Horímetro Inicial',
    'Horímetro Final',
    'Horas Trabalhadas',
    'Horas em Manutenção',
    'Observações',
  ];

  const rows = sorted.map((log) => [
    formatDateBR(log.date),
    `"${log.equipmentCode || ''}"`,
    `"${log.equipmentType || ''}"`,
    `"${log.equipmentBrandModel || ''}"`,
    `"${log.operator || ''}"`,
    `"${log.location || ''}"`,
    formatHours(log.initialHourMeter),
    formatHours(log.finalHourMeter),
    formatHours(log.workedHours),
    formatHours(log.maintenanceHours || 0),
    `"${(log.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent =
    '\uFEFF' + // UTF-8 BOM for Microsoft Excel
    headers.join(';') +
    '\n' +
    rows.map((row) => row.join(';')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = getTodayDateString();
  link.setAttribute('href', url);
  link.setAttribute('download', `makmo_apontamentos_equipamentos_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function clearFuelLocalStorage(): void {
  try {
    localStorage.setItem(FUEL_DISPENSES_KEY, JSON.stringify([]));
    localStorage.setItem(FUEL_ENTRIES_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Error clearing fuel localStorage', err);
  }
}

export function loadFuelDispenses(): FuelDispense[] {
  try {
    const raw = localStorage.getItem(FUEL_DISPENSES_KEY);
    const sync779Done = localStorage.getItem('makmo_fuel_sync_v779') === 'true';

    if (!raw) {
      localStorage.setItem(FUEL_DISPENSES_KEY, JSON.stringify(INITIAL_FUEL_DISPENSES));
      localStorage.setItem(FUEL_SYNC_KEY, 'true');
      localStorage.setItem('makmo_fuel_sync_v779', 'true');
      return INITIAL_FUEL_DISPENSES;
    }
    let parsed: FuelDispense[] = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];

    if (!sync779Done || parsed.length < INITIAL_FUEL_DISPENSES.length) {
      const dispMap = new Map<string, FuelDispense>();
      INITIAL_FUEL_DISPENSES.forEach((d) => dispMap.set(d.id, d));
      parsed.forEach((d) => {
        // preserve any custom added records by user with different IDs
        if (!dispMap.has(d.id)) {
          dispMap.set(d.id, d);
        }
      });
      const merged = Array.from(dispMap.values()).map((d) => ({
        ...d,
        convoyPlate: (d.convoyPlate as string) === 'SFC2C66' ? 'SPF2C66' : d.convoyPlate,
      }));
      localStorage.setItem(FUEL_DISPENSES_KEY, JSON.stringify(merged));
      localStorage.setItem(FUEL_SYNC_KEY, 'true');
      localStorage.setItem('makmo_fuel_sync_v779', 'true');
      return merged;
    }

    return parsed.map((d) => ({
      ...d,
      convoyPlate: (d.convoyPlate as string) === 'SFC2C66' ? 'SPF2C66' : d.convoyPlate,
    }));
  } catch (err) {
    console.error('Error reading fuel dispenses from localStorage', err);
    return INITIAL_FUEL_DISPENSES;
  }
}

export function saveFuelDispenses(data: FuelDispense[], allowEmpty = false): void {
  try {
    if (!allowEmpty && (!data || data.length === 0)) {
      console.warn('Blocked attempt to overwrite fuel dispenses with empty array');
      return;
    }
    localStorage.setItem(FUEL_DISPENSES_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Error saving fuel dispenses to localStorage', err);
  }
}

export function loadFuelEntries(): FuelEntry[] {
  try {
    const raw = localStorage.getItem(FUEL_ENTRIES_KEY);
    const sync28Done = localStorage.getItem('makmo_fuel_entries_sync_v28') === 'true';

    if (!raw) {
      localStorage.setItem(FUEL_ENTRIES_KEY, JSON.stringify(INITIAL_FUEL_ENTRIES));
      localStorage.setItem(FUEL_SYNC_KEY, 'true');
      localStorage.setItem('makmo_fuel_entries_sync_v28', 'true');
      return INITIAL_FUEL_ENTRIES;
    }
    let parsed: FuelEntry[] = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];

    const legacyPlaceholderIds = ['entry-rtw-001', 'entry-dza-001', 'entry-spf-001'];

    if (!sync28Done || parsed.length < INITIAL_FUEL_ENTRIES.length) {
      const entryMap = new Map<string, FuelEntry>();
      INITIAL_FUEL_ENTRIES.forEach((e) => entryMap.set(e.id, e));
      parsed.forEach((e) => {
        if (!legacyPlaceholderIds.includes(e.id) && !entryMap.has(e.id)) {
          entryMap.set(e.id, e); // Existing user records take precedence!
        }
      });
      const merged = Array.from(entryMap.values()).map((e) => ({
        ...e,
        destination: e.destination ? e.destination.replace(/SFC2C66/g, 'SPF2C66') : e.destination,
      }));
      localStorage.setItem(FUEL_ENTRIES_KEY, JSON.stringify(merged));
      localStorage.setItem(FUEL_SYNC_KEY, 'true');
      localStorage.setItem('makmo_fuel_entries_sync_v28', 'true');
      return merged;
    }

    return parsed
      .filter((e) => !legacyPlaceholderIds.includes(e.id))
      .map((e) => ({
        ...e,
        destination: e.destination ? e.destination.replace(/SFC2C66/g, 'SPF2C66') : e.destination,
      }));
  } catch (err) {
    console.error('Error reading fuel entries from localStorage', err);
    return INITIAL_FUEL_ENTRIES;
  }
}

export function saveFuelEntries(data: FuelEntry[], allowEmpty = false): void {
  try {
    if (!allowEmpty && (!data || data.length === 0)) {
      console.warn('Blocked attempt to overwrite fuel entries with empty array');
      return;
    }
    localStorage.setItem(FUEL_ENTRIES_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('LocalStorage quota limit reached when saving fuel entries; saving lightweight metadata cache...', err);
    try {
      // In case base64 attachments exceed the 5MB browser quota, keep all fields (including totalValue, unitPrice, liters, attachmentName)
      // and strip only heavy base64 strings so localStorage never fails.
      const lightweight = data.map((entry) => {
        if (entry.attachmentUrl && entry.attachmentUrl.length > 50000) {
          return { ...entry, attachmentUrl: '' };
        }
        return entry;
      });
      localStorage.setItem(FUEL_ENTRIES_KEY, JSON.stringify(lightweight));
    } catch (innerErr) {
      console.error('Error saving fuel entries to localStorage', innerErr);
    }
  }
}

export interface ConvoyFuelSummary {
  convoyPlate: ConvoyPlate;
  convoyName: string;
  entriesLiters: number;
  dispensedLiters: number;
  balance: number;
  dispenseCount: number;
  latestMeter: number;
}

export function getConvoyFuelSummary(
  convoyPlate: ConvoyPlate,
  entries: FuelEntry[],
  dispenses: FuelDispense[]
): ConvoyFuelSummary {
  const isSpf = convoyPlate === 'SPF2C66' || (convoyPlate as string) === 'SFC2C66';
  const convoyEntries = entries
    .filter((e) => {
      if (!e.destination) return false;
      const cleanDest = e.destination.toUpperCase().replace(/[-\s]/g, '');
      if (isSpf) {
        return cleanDest.includes('SPF2C66') || cleanDest.includes('SFC2C66');
      }
      return cleanDest.includes(convoyPlate.toUpperCase().replace(/[-\s]/g, ''));
    })
    .reduce((acc, curr) => acc + (curr.liters || 0), 0);

  const convoyDispenses = dispenses.filter((d) => {
    if (isSpf) {
      return d.convoyPlate === 'SPF2C66' || (d.convoyPlate as string) === 'SFC2C66';
    }
    return d.convoyPlate === convoyPlate;
  });
  const totalDispensed = convoyDispenses.reduce((acc, curr) => acc + (curr.liters || 0), 0);
  const balance = Number((convoyEntries - totalDispensed).toFixed(1));

  const sortedDispenses = [...convoyDispenses].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  const latestMeter = sortedDispenses.length > 0 ? sortedDispenses[0].finalMeter || 0 : 0;

  const names: Record<string, string> = {
    RTW1C01: 'Comboio RTW1C01',
    DZA7G30: 'Comboio DZA7G30',
    SPF2C66: 'Comboio SPF2C66',
    SFC2C66: 'Comboio SPF2C66',
  };

  return {
    convoyPlate,
    convoyName: names[convoyPlate] || `Comboio ${convoyPlate}`,
    entriesLiters: Number(convoyEntries.toFixed(1)),
    dispensedLiters: Number(totalDispensed.toFixed(1)),
    balance,
    dispenseCount: convoyDispenses.length,
    latestMeter,
  };
}

export function formatLiters(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0,0';
  return Number(val).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

export function formatCurrency(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
  return Number(val).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrencyInput(valueStr: string): number | undefined {
  if (!valueStr || typeof valueStr !== 'string' || valueStr.trim() === '') return undefined;
  let cleaned = valueStr.trim().replace(/^R\$\s?/, '').replace(/\s/g, '').trim();
  if (!cleaned) return undefined;

  // If contains both '.' and ',' (e.g. 15.000,50 or 15,000.50)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Brazilian format: 15.000,50 -> 15000.50
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 15,000.50 -> 15000.50
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Only comma used: 15000,50 or 15,00 -> 15000.50
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.')) {
    // Only dot used: could be 15.000 (thousands) or 15.50 (decimal)
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      // Multiple dots: e.g. 1.000.000 -> 1000000
      cleaned = cleaned.replace(/\./g, '');
    } else if (parts.length === 2 && parts[1].length === 3 && parseInt(parts[1], 10) === 0) {
      // Thousand integer without cents: e.g. 15.000 -> 15000
      cleaned = cleaned.replace('.', '');
    }
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) || parsed < 0 ? undefined : Number(parsed.toFixed(2));
}

/**
 * Export fuel dispenses to CSV pulling:
 * Data, Comboio, Máquina / Prefixo, Tipo, Obra, Horímetro / KM, Iniciante, Encerrante, Litros (L), Operador / Resp., Observações
 */
export function exportFuelReportToCSV(
  _entries: FuelEntry[],
  dispenses: FuelDispense[],
  filterDate?: string,
  equipments: Equipment[] = [],
  customFilename?: string
): void {
  const filteredDispenses = filterDate ? dispenses.filter((d) => d.date <= filterDate) : dispenses;

  const headers = [
    'Data',
    'Comboio',
    'Placa',
    'Equipamento',
    'Fornecedor',
    'Obra',
    'Horímetro',
    'Iniciante',
    'Encerrante',
    'Litros',
  ];

  const rows = filteredDispenses.map((d) => {
    const equip = equipments.find(
      (eq) =>
        (eq.plate && eq.plate.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase()) ||
        eq.code.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase() ||
        (eq.prefix && eq.prefix.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase())
    );
    const equipObra = d.location || equip?.location || '063/064';
    const equipSupplier = d.supplier || equip?.supplier || '-';
    const machinePlate = equip?.plate || d.equipmentCode || '-';
    const machineType = (
      d.equipmentType ||
      equip?.type ||
      equip?.equipmentType ||
      equip?.model ||
      equip?.prefix ||
      d.equipmentCode ||
      '-'
    ).toUpperCase();
    
    // Export only pure numeric value without 'HORAS' or 'KM'
    let meterVal = '';
    if (d.equipmentMeter !== undefined && d.equipmentMeter !== null) {
      if (typeof d.equipmentMeter === 'number' && !isNaN(d.equipmentMeter)) {
        meterVal = Number.isInteger(d.equipmentMeter)
          ? String(d.equipmentMeter)
          : Number(d.equipmentMeter).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
      } else {
        meterVal = String(d.equipmentMeter)
          .replace(/\b(horas|hora|km|h)\b/gi, '')
          .trim();
      }
    }

    return [
      formatDateBR(d.date),
      `"${d.convoyPlate || ''}"`,
      `"${machinePlate}"`,
      `"${machineType}"`,
      `"${equipSupplier}"`,
      `"${equipObra}"`,
      `"${meterVal}"`,
      formatHours(d.initialMeter),
      formatHours(d.finalMeter),
      formatLiters(d.liters),
    ];
  });

  const csvContent =
    '\uFEFF' + // UTF-8 BOM for Microsoft Excel
    headers.join(';') +
    '\n' +
    rows.map((row) => row.join(';')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = getTodayDateString();
  const filename = customFilename || `makmo_relatorio_abastecimentos_${today}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// PREVENTIVE MAINTENANCE STORAGE HELPERS
// ==========================================

export function clearPreventiveLocalStorage(): void {
  try {
    localStorage.setItem(PREVENTIVE_PLANS_KEY, JSON.stringify([]));
    localStorage.setItem(PREVENTIVE_RECORDS_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Error clearing preventive localStorage', err);
  }
}

export function loadPreventivePlans(): PreventivePlan[] {
  try {
    const raw = localStorage.getItem(PREVENTIVE_PLANS_KEY);
    const syncDone = localStorage.getItem(PREVENTIVE_SYNC_KEY) === 'true';

    if (!raw || !syncDone) {
      localStorage.setItem(PREVENTIVE_PLANS_KEY, JSON.stringify(INITIAL_PREVENTIVE_PLANS));
      localStorage.setItem(PREVENTIVE_SYNC_KEY, 'true');
      return INITIAL_PREVENTIVE_PLANS;
    }

    const parsed = JSON.parse(raw);
    const stored: PreventivePlan[] = Array.isArray(parsed) ? parsed : [];

    // Merge official preventive plans so new plans are automatically incorporated
    const planMap = new Map<string, PreventivePlan>();
    stored.forEach((p) => {
      const key = p.equipmentId || p.id;
      planMap.set(key, p);
    });

    let hasUpdates = false;
    INITIAL_PREVENTIVE_PLANS.forEach((official) => {
      const key = official.equipmentId || official.id;
      const existing = planMap.get(key);
      if (!existing) {
        planMap.set(key, official);
        hasUpdates = true;
      } else if (
        existing.lastReviewDate !== official.lastReviewDate ||
        existing.lastReviewHourMeter !== official.lastReviewHourMeter ||
        existing.lastReviewKm !== official.lastReviewKm ||
        existing.intervalValue !== official.intervalValue
      ) {
        planMap.set(key, { ...existing, ...official });
        hasUpdates = true;
      }
    });

    const result = Array.from(planMap.values());
    if (hasUpdates) {
      localStorage.setItem(PREVENTIVE_PLANS_KEY, JSON.stringify(result));
    }

    return result;
  } catch (err) {
    console.error('Error reading preventive plans from localStorage', err);
    return INITIAL_PREVENTIVE_PLANS;
  }
}

export function savePreventivePlans(plans: PreventivePlan[]): void {
  try {
    localStorage.setItem(PREVENTIVE_PLANS_KEY, JSON.stringify(plans));
  } catch (err) {
    console.error('Error saving preventive plans to localStorage', err);
  }
}

export function loadPreventiveRecords(): PreventiveRecord[] {
  try {
    const raw = localStorage.getItem(PREVENTIVE_RECORDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const stored: PreventiveRecord[] = Array.isArray(parsed) ? parsed : [];

    const recordMap = new Map<string, PreventiveRecord>();
    stored.forEach((r) => recordMap.set(r.id, r));
    INITIAL_PREVENTIVE_RECORDS.forEach((r) => recordMap.set(r.id, r));

    const result = Array.from(recordMap.values());
    if (!raw || stored.length !== result.length || !localStorage.getItem(PREVENTIVE_SYNC_KEY)) {
      localStorage.setItem(PREVENTIVE_RECORDS_KEY, JSON.stringify(result));
      localStorage.setItem(PREVENTIVE_SYNC_KEY, 'true');
    }
    return result;
  } catch (err) {
    console.error('Error reading preventive records from localStorage', err);
    return INITIAL_PREVENTIVE_RECORDS;
  }
}

export function savePreventiveRecords(records: PreventiveRecord[]): void {
  try {
    // Strip large attachment data from localStorage to avoid quota errors
    const sanitized = records.map((rec) => ({
      ...rec,
      attachments: rec.attachments?.map((att) => ({
        ...att,
        dataUrl: att.dataUrl && att.dataUrl.length > 50000 ? '' : att.dataUrl,
      })),
    }));
    localStorage.setItem(PREVENTIVE_RECORDS_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.error('Error saving preventive records to localStorage', err);
  }
}

export function loadAlertThresholds(): AlertThresholds {
  try {
    const raw = localStorage.getItem(ALERT_THRESHOLDS_KEY);
    if (!raw) {
      localStorage.setItem(ALERT_THRESHOLDS_KEY, JSON.stringify(DEFAULT_ALERT_THRESHOLDS));
      return DEFAULT_ALERT_THRESHOLDS;
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ALERT_THRESHOLDS, ...parsed };
  } catch {
    return DEFAULT_ALERT_THRESHOLDS;
  }
}

export function saveAlertThresholds(thresholds: AlertThresholds): void {
  try {
    localStorage.setItem(ALERT_THRESHOLDS_KEY, JSON.stringify(thresholds));
  } catch (err) {
    console.error('Error saving alert thresholds to localStorage', err);
  }
}

// ==========================================
// DESCONTO EM MEDIÇÃO (DIAS PARADOS)
// ==========================================

export function loadMeasurementDeductions(equipments: Equipment[] = []): MeasurementDeduction[] {
  try {
    const raw = localStorage.getItem(MEASUREMENT_DEDUCTIONS_KEY);
    const syncDone = localStorage.getItem(MEASUREMENT_DEDUCTIONS_SYNC_KEY) === 'true';

    if (!raw || !syncDone) {
      const initial = generateInitialDeductions(equipments.length > 0 ? equipments : loadEquipments());
      localStorage.setItem(MEASUREMENT_DEDUCTIONS_KEY, JSON.stringify(initial));
      localStorage.setItem(MEASUREMENT_DEDUCTIONS_SYNC_KEY, 'true');
      return initial;
    }

    const parsed = JSON.parse(raw);
    const stored: MeasurementDeduction[] = Array.isArray(parsed) ? parsed : [];

    // Ensure official deductions are present and retain any custom user deductions
    const deductionMap = new Map<string, MeasurementDeduction>();
    OFFICIAL_MEASUREMENT_DEDUCTIONS.forEach((d) => deductionMap.set(d.id, d));
    stored.forEach((d) => {
      if (!deductionMap.has(d.id)) {
        deductionMap.set(d.id, d);
      }
    });

    const result = Array.from(deductionMap.values());
    localStorage.setItem(MEASUREMENT_DEDUCTIONS_KEY, JSON.stringify(result));
    localStorage.setItem(MEASUREMENT_DEDUCTIONS_SYNC_KEY, 'true');
    return result;
  } catch (err) {
    console.error('Error reading measurement deductions from localStorage', err);
    return generateInitialDeductions(equipments);
  }
}

export function saveMeasurementDeductions(deductions: MeasurementDeduction[]): void {
  try {
    localStorage.setItem(MEASUREMENT_DEDUCTIONS_KEY, JSON.stringify(deductions));
  } catch (err) {
    console.error('Error saving measurement deductions to localStorage', err);
  }
}

// ==========================================
// CORRETIVAS REALIZADAS (PCM CORRETIVAS)
// ==========================================

const CORRECTIVE_MAINTENANCES_KEY = 'makmo_corrective_maintenances_v1';
const CORRECTIVE_SYNC_KEY = 'makmo_corrective_sync_v3';

export function loadCorrectiveMaintenances(): CorrectiveMaintenance[] {
  try {
    const raw = localStorage.getItem(CORRECTIVE_MAINTENANCES_KEY);
    const syncDone = localStorage.getItem(CORRECTIVE_SYNC_KEY) === 'true';

    if (!raw || !syncDone) {
      // Merge official INITIAL_CORRECTIVE_MAINTENANCES
      const existing: CorrectiveMaintenance[] = raw ? JSON.parse(raw) : [];
      const map = new Map<string, CorrectiveMaintenance>();
      INITIAL_CORRECTIVE_MAINTENANCES.forEach((item) => map.set(item.id, item));
      if (Array.isArray(existing)) {
        existing.forEach((item) => {
          if (item && item.id) {
            map.set(item.id, item);
          }
        });
      }
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime()
      );
      localStorage.setItem(CORRECTIVE_MAINTENANCES_KEY, JSON.stringify(merged));
      localStorage.setItem(CORRECTIVE_SYNC_KEY, 'true');
      return merged;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_CORRECTIVE_MAINTENANCES;
  } catch (err) {
    console.error('Error reading corrective maintenances from localStorage', err);
    return INITIAL_CORRECTIVE_MAINTENANCES;
  }
}

export function saveCorrectiveMaintenances(records: CorrectiveMaintenance[]): void {
  try {
    localStorage.setItem(CORRECTIVE_MAINTENANCES_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('LocalStorage save quota warning for corrective maintenances, trying optimized payload:', err);
    try {
      // In case localStorage quota (5MB) is ever exceeded, store lightweight metadata in localStorage
      // Full photo dataUrls are safely maintained in IndexedDB and memory
      const sanitized = records.map((rec) => ({
        ...rec,
        photos: rec.photos?.map((p) => ({
          id: p.id,
          name: p.name,
          dataUrl: p.dataUrl && p.dataUrl.length > 200000 ? '' : p.dataUrl,
          size: p.size,
          uploadedAt: p.uploadedAt,
          isHeavyAttachment: true,
        })) || [],
      }));
      localStorage.setItem(CORRECTIVE_MAINTENANCES_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.error('Error saving corrective maintenances to localStorage', e);
    }
  }
}

export function clearCorrectiveLocalStorage(): void {
  try {
    localStorage.setItem(CORRECTIVE_MAINTENANCES_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Error clearing corrective localStorage', err);
  }
}

export function exportCorrectivesToCSV(records: CorrectiveMaintenance[], filenamePrefix = 'makmo_corretivas_realizadas'): void {
  const headers = [
    'O.S.',
    'STATUS',
    'DATA ABERTURA',
    'DATA CONCLUSAO',
    'DIAS PARADOS',
    'PLACA',
    'EQUIPAMENTO',
    'MARCA',
    'MODELO',
    'PREFIXO',
    'FORNECEDOR',
    'OBRA',
    'HORIMETRO/KM ABERTURA',
    'HORIMETRO/KM CONCLUSAO',
    'TIPO DE FALHA',
    'SISTEMA/COMPONENTE',
    'DESCRICAO DO PROBLEMA',
    'DIAGNOSTICO',
    'SERVICO REALIZADO',
    'PECAS SUBSTITUIDAS',
    'MECANICO RESPONSAVEL',
    'QTD FOTOS',
    'OBSERVACOES',
  ];

  const rows = records.map((c) => [
    `"${c.osNumber || ''}"`,
    `"${c.status || ''}"`,
    c.openDate ? c.openDate.split('-').reverse().join('/') : '',
    c.completionDate ? c.completionDate.split('-').reverse().join('/') : '',
    c.stoppedDays ?? 0,
    `"${c.plate || c.prefix || ''}"`,
    `"${c.equipmentType || ''}"`,
    `"${c.brand || ''}"`,
    `"${c.model || ''}"`,
    `"${c.prefix || ''}"`,
    `"${c.supplier || ''}"`,
    `"${c.location || ''}"`,
    c.openMeter ?? '',
    c.completionMeter ?? '',
    `"${c.failureType || ''}"`,
    `"${(c.affectedSystem || '').replace(/"/g, '""')}"`,
    `"${(c.problemDescription || '').replace(/"/g, '""')}"`,
    `"${(c.diagnosis || '').replace(/"/g, '""')}"`,
    `"${(c.servicePerformed || '').replace(/"/g, '""')}"`,
    `"${(c.replacedParts || '').replace(/"/g, '""')}"`,
    `"${(c.mechanic || '').replace(/"/g, '""')}"`,
    c.photos?.length || 0,
    `"${(c.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent =
    '\uFEFF' + // UTF-8 BOM for Microsoft Excel
    headers.join(';') +
    '\n' +
    rows.map((row) => row.join(';')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// GESTÃO DINÂMICA DE COMBOIOS POR OBRA
// ==========================================

export const DEFAULT_CONVOYS: AppConvoy[] = [
  {
    id: 'convoy-rtw1c01',
    plate: 'RTW1C01',
    name: 'Comboio RTW1C01',
    prefix: 'CMB-01',
    description: 'Caminhão Comboio RTW1C01 • Makmo Infraestrutura',
    capacity: 5000,
    location: '063/064',
    obra_id: '063/064',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'convoy-dza7g30',
    plate: 'DZA7G30',
    name: 'Comboio DZA7G30',
    prefix: 'CMB-02',
    description: 'Caminhão Comboio DZA7G30 • Makmo Infraestrutura',
    capacity: 5000,
    location: '063/064',
    obra_id: '063/064',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'convoy-spf2c66',
    plate: 'SPF2C66',
    name: 'Comboio SPF2C66',
    prefix: 'CMB-03',
    description: 'Caminhão Comboio SPF2C66 • Makmo Infraestrutura',
    capacity: 5000,
    location: '063/064',
    obra_id: '063/064',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
];

const CUSTOM_CONVOYS_KEY = 'makmo_fleet_custom_convoys_v1';

export function loadCustomConvoys(): AppConvoy[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CONVOYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading custom convoys from localStorage', err);
    return [];
  }
}

export function saveCustomConvoys(convoys: AppConvoy[]): void {
  try {
    localStorage.setItem(CUSTOM_CONVOYS_KEY, JSON.stringify(convoys));
  } catch (err) {
    console.error('Error saving custom convoys to localStorage', err);
  }
}

/**
 * Retorna os comboios disponíveis para a obra selecionada:
 * - Para a Obra 063/064 (e Visão Global Geral 'all'): preserva os 3 comboios originais (RTW1C01, DZA7G30, SPF2C66) mais comboios cadastrados.
 * - Para a Obra 062 - PA e TODAS as novas obras cadastradas futuramente: os comboios RTW1C01, DZA7G30 e SPF2C66 NÃO são criados/exibidos.
 * - O usuário pode cadastrar novos comboios dinamicamente para qualquer obra.
 */
export function getConvoysForProject(projectCode: string): AppConvoy[] {
  const custom = loadCustomConvoys();
  const cleanCode = (projectCode || '').toUpperCase().trim();
  const is062 = cleanCode.includes('062');
  const is063064 = cleanCode.includes('063') || cleanCode.includes('064') || cleanCode === '063/064';
  const isAll = cleanCode === 'ALL' || cleanCode === '';

  // Filtra comboios personalizados vinculados a esta obra
  const matchedCustom = custom.filter((c) => {
    if (isAll) return true;
    if (!c.location && !c.obra_id) return true;
    const loc = (c.location || c.obra_id || '').toUpperCase();
    return loc.includes(cleanCode) || cleanCode.includes(loc);
  });

  // Obra 062 - PA e Novas Obras: NÃO incluir RTW1C01, DZA7G30, SPF2C66
  if (is062 || (!is063064 && !isAll)) {
    return matchedCustom.filter((c) => {
      const pl = c.plate.toUpperCase();
      return pl !== 'RTW1C01' && pl !== 'DZA7G30' && pl !== 'SPF2C66' && pl !== 'SFC2C66';
    });
  }

  // Obra 063/064 ou Visão Global (All): inclui padrão histórico + customizados
  const customPlates = new Set(matchedCustom.map((c) => c.plate.toUpperCase()));
  const standardConvoys = DEFAULT_CONVOYS.filter((d) => !customPlates.has(d.plate.toUpperCase()));
  return [...standardConvoys, ...matchedCustom];
}



