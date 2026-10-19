import {
  MeasurementDeduction,
  MeasurementDeductionStatus,
  StoppageReason,
  Equipment,
} from '../types';
import { OFFICIAL_MEASUREMENT_DEDUCTIONS } from '../data/officialDeductionsData';

export const STOPPAGE_REASONS: StoppageReason[] = [
  'Aguardando manutenção',
  'Falha mecânica',
  'Falha elétrica',
  'Aguardando peça',
  'Aguardando operador',
  'Aguardando fornecedor',
  'Aguardando mobilização',
  'Acidente',
  'Equipamento indisponível',
  'Outros',
];

export const DEDUCTION_STATUSES: {
  value: MeasurementDeductionStatus;
  label: string;
  badgeClass: string;
  description: string;
}[] = [
  {
    value: 'PARADO',
    label: 'PARADO',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
    description: 'Equipamento atualmente paralisado em campo aguardando liberação.',
  },
  {
    value: 'EM ANÁLISE',
    label: 'EM ANÁLISE',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    description: 'Paralisação registrada em análise pela medição / fiscalização.',
  },
  {
    value: 'FINALIZADO',
    label: 'FINALIZADO',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    description: 'Paralisação encerrada com data final definida.',
  },
  {
    value: 'DESCONTO CALCULADO',
    label: 'DESCONTO CALCULADO',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
    description: 'Memória de cálculo de desconto apurada e pronta para faturamento.',
  },
  {
    value: 'DESCONTO APLICADO',
    label: 'DESCONTO APLICADO',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    description: 'Desconto abatido no boletim de medição mensal do fornecedor.',
  },
];

/**
 * Retorna a data atual no formato YYYY-MM-DD
 */
export function getTodayDateIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata número em moeda brasileira BRL: R$ 45.000,00
 */
export function formatCurrencyBRL(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata data no formato DD/MM/AAAA
 */
export function formatDateDDMMAAAA(dateStr?: string | null): string {
  if (!dateStr || dateStr === '-') return '-';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return dateStr;
}

/**
 * Regra Principal 1: Valor da Diária = Valor da Medição ÷ 30
 */
export function calculateDailyRate(measurementValue: number): number {
  if (!measurementValue || measurementValue <= 0) return 0;
  return Math.round((measurementValue / 30) * 100) / 100;
}

/**
 * Regra Principal 2: Dias Parados = Data Final - Data Inicial + 1
 * Para equipamentos que continuam parados (sem data final), calcula até a data de hoje.
 * Ex: 01/09/2026 até 05/09/2026 = 5 dias.
 */
export function calculateDaysBetween(
  startDate: string,
  endDate?: string,
  isOngoing: boolean = false
): number {
  if (!startDate) return 0;

  const start = new Date(`${startDate}T00:00:00`);
  if (isNaN(start.getTime())) return 0;

  let end: Date;
  if (!endDate || isOngoing) {
    // Continua parado: até a data atual
    const today = getTodayDateIso();
    end = new Date(`${today}T00:00:00`);
  } else {
    end = new Date(`${endDate}T00:00:00`);
  }

  if (isNaN(end.getTime())) return 0;

  // Diferença em milissegundos
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Fórmula: Data Final - Data Inicial + 1 (inclusivo)
  if (diffDays < 0) return 0;
  return diffDays + 1;
}

/**
 * Regra Principal 3: Valor do Desconto = Valor da Diária × Quantidade de Dias Parados
 */
export function calculateDiscount(dailyRate: number, stoppedDays: number): number {
  if (!dailyRate || !stoppedDays || dailyRate <= 0 || stoppedDays <= 0) return 0;
  return Math.round(dailyRate * stoppedDays * 100) / 100;
}

/**
 * Controle de Duplicidade:
 * Impede que o mesmo equipamento tenha duas paralisações sobrepostas no mesmo período,
 * evitando desconto duplicado.
 */
export function checkStoppageOverlap(
  existingDeductions: MeasurementDeduction[],
  candidate: {
    equipmentId: string;
    prefix?: string;
    startDate: string;
    endDate?: string;
    isOngoing: boolean;
    id?: string;
  }
): boolean {
  if (!candidate.equipmentId || !candidate.startDate) return false;

  const candStart = candidate.startDate;
  // Se contínuo, consideramos em aberto até o futuro ou hoje
  const candEnd = candidate.isOngoing || !candidate.endDate ? '9999-12-31' : candidate.endDate;

  return existingDeductions.some((item) => {
    // Ignora o próprio registro sendo editado
    if (candidate.id && item.id === candidate.id) return false;

    // Apenas para o mesmo equipamento
    const sameEquipment =
      item.equipmentId === candidate.equipmentId ||
      (candidate.prefix && item.prefix && item.prefix.trim().toUpperCase() === candidate.prefix.trim().toUpperCase());

    if (!sameEquipment) return false;

    const itemStart = item.startDate;
    const itemEnd = item.isOngoing || !item.endDate ? '9999-12-31' : item.endDate;

    // Dois intervalos [A, B] e [C, D] se sobrepõem se e somente se:
    // max(A, C) <= min(B, D)
    return candStart <= itemEnd && candEnd >= itemStart;
  });
}

/**
 * Gera dados oficiais de paralisação e desconto baseados nos registros oficiais
 */
export function generateInitialDeductions(equipments: Equipment[] = []): MeasurementDeduction[] {
  return OFFICIAL_MEASUREMENT_DEDUCTIONS;
}

export { OFFICIAL_MEASUREMENT_DEDUCTIONS };
