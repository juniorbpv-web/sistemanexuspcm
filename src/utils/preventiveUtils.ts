import {
  Equipment,
  PreventivePlan,
  PreventiveCalculation,
  PreventiveIntervalType,
  PreventiveUnit,
  PreventiveStatus,
  AlertThresholds,
  PreventiveRecord,
} from '../types';

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  hoursWarning: 100, // Quando faltar <= 100 horas (para 250h): FAZER REVISÃO
  hoursUrgent: 50,
  kmWarning: 2000, // Quando faltar <= 2.000 km (para 10.000 km): FAZER REVISÃO
  kmUrgent: 1000,
};

export const PREVENTIVE_INTERVAL_OPTIONS: {
  label: PreventiveIntervalType;
  value: number;
  unit: PreventiveUnit;
}[] = [
  { label: '250 Horas', value: 250, unit: 'HORAS' },
  { label: '500 Horas', value: 500, unit: 'HORAS' },
  { label: '750 Horas', value: 750, unit: 'HORAS' },
  { label: '1.000 Horas', value: 1000, unit: 'HORAS' },
  { label: '2.000 Horas', value: 2000, unit: 'HORAS' },
  { label: '5.000 Horas', value: 5000, unit: 'HORAS' },
  { label: '10.000 KM', value: 10000, unit: 'KM' },
  { label: '20.000 KM', value: 20000, unit: 'KM' },
  { label: '30.000 KM', value: 30000, unit: 'KM' },
  { label: 'Outro', value: 0, unit: 'HORAS' },
];

/**
 * Returns default interval configuration based on equipment type.
 * Trucks and road vehicles default to 10.000 KM. Heavy machinery defaults to 250 Horas.
 */
export function getDefaultIntervalForEquipment(equipment: Equipment): {
  intervalType: PreventiveIntervalType;
  intervalUnit: PreventiveUnit;
  intervalValue: number;
} {
  const typeLower = (equipment.type || '').toLowerCase();
  const isVehicle =
    typeLower.includes('caminh') ||
    typeLower.includes('pipa') ||
    typeLower.includes('caçamba') ||
    typeLower.includes('cavalo') ||
    typeLower.includes('veículo') ||
    typeLower.includes('van') ||
    typeLower.includes('utilitário');

  if (isVehicle) {
    return {
      intervalType: '10.000 KM',
      intervalUnit: 'KM',
      intervalValue: 10000,
    };
  }

  return {
    intervalType: '250 Horas',
    intervalUnit: 'HORAS',
    intervalValue: 250,
  };
}

/**
 * Generates or derives an initial preventive plan for an equipment if none exists yet.
 */
export function createDefaultPlanForEquipment(equipment: Equipment): PreventivePlan {
  const defaultInt = getDefaultIntervalForEquipment(equipment);

  const isKm = defaultInt.intervalUnit === 'KM';

  return {
    id: `plan_${equipment.id}`,
    equipmentId: equipment.id,
    equipmentCode: equipment.prefix || equipment.plate || equipment.code,
    intervalType: defaultInt.intervalType,
    intervalUnit: defaultInt.intervalUnit,
    intervalValue: defaultInt.intervalValue,
    lastReviewDate: '',
    lastReviewHourMeter: isKm ? undefined : 0,
    lastReviewKm: isKm ? 0 : undefined,
    lastReviewNotes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Performs core preventive calculation for a single equipment and plan.
 */
export function calculateEquipmentPreventive(
  equipment: Equipment,
  plan: PreventivePlan,
  thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS
): PreventiveCalculation {
  const unit: PreventiveUnit = plan.intervalUnit || 'HORAS';
  const intervalVal = plan.intervalType === 'Outro' ? plan.customIntervalValue || 250 : plan.intervalValue || 250;

  let currentVal = 0;
  let lastReadingDate = equipment.updatedAt?.split('T')[0] || new Date().toISOString().split('T')[0];
  let lastReviewVal = 0;

  if (unit === 'KM') {
    currentVal = equipment.currentKm ?? 0;
    if (equipment.lastKmDate) lastReadingDate = equipment.lastKmDate;
    lastReviewVal = plan.lastReviewKm ?? 0;
  } else {
    currentVal = equipment.currentHourMeter ?? 0;
    if (equipment.lastHourMeterDate) lastReadingDate = equipment.lastHourMeterDate;
    lastReviewVal = plan.lastReviewHourMeter ?? 0;
  }

  // Próxima Revisão = Última Revisão + Intervalo
  const nextReviewVal = lastReviewVal + intervalVal;

  // Faltam / Excedente:
  // Menos Último KM/Hor menos Última Revisão:
  // Faltam = Intervalo - (Último KM/Hor - Última Revisão) = Próxima Revisão - Último KM/Hor
  const remainingVal = nextReviewVal - currentVal;
  const isOverdue = remainingVal <= 0;
  const overdueVal = isOverdue ? Math.abs(remainingVal) : 0;

  // Regra de Status:
  // Se for o intervalo de 250 Horas -> Mostrar "Fazer Revisão" quando chegar em 100 Horas (remainingVal <= 100)
  // Se for o intervalo de 10.000 KM -> Mostrar "Fazer Revisão" quando chegar em 2000 Km (remainingVal <= 2000)
  let reviewThreshold = 100;
  if (unit === 'KM') {
    reviewThreshold =
      plan.customThresholds?.warning ??
      (intervalVal === 10000 ? 2000 : Math.round(intervalVal * 0.2));
  } else {
    reviewThreshold =
      plan.customThresholds?.warning ??
      (intervalVal === 250 ? 100 : Math.round(intervalVal * 0.4));
  }

  let status: PreventiveStatus = 'EM_DIA';
  let statusLabel: 'EM DIA' | 'FAZER REVISÃO' | 'VENCIDA' = 'EM DIA';
  let statusColor: 'emerald' | 'amber' | 'rose' = 'emerald';

  if (isOverdue) {
    status = 'VENCIDA';
    statusLabel = 'VENCIDA';
    statusColor = 'rose';
  } else if (remainingVal <= reviewThreshold) {
    status = 'FAZER_REVISAO';
    statusLabel = 'FAZER REVISÃO';
    statusColor = 'amber';
  } else {
    status = 'EM_DIA';
    statusLabel = 'EM DIA';
    statusColor = 'emerald';
  }

  return {
    equipmentId: equipment.id,
    equipmentCode: equipment.prefix || equipment.plate || equipment.code,
    equipment,
    plan,
    unit,
    currentValue: currentVal,
    lastReadingDate,
    lastReviewValue: lastReviewVal,
    lastReviewDate: plan.lastReviewDate || '-',
    intervalValue: intervalVal,
    nextReviewValue: nextReviewVal,
    remainingValue: remainingVal,
    isOverdue,
    overdueValue: overdueVal,
    status,
    statusLabel,
    statusColor,
  };
}

/**
 * Checks whether an equipment has a registered preventive plan.
 * Control only starts from the moment a preventive has been registered.
 */
export function hasRegisteredPreventive(plan?: PreventivePlan | null): boolean {
  if (!plan) return false;
  const hasDate = Boolean(plan.lastReviewDate && plan.lastReviewDate.trim() !== '');
  const hasMeter = plan.lastReviewHourMeter !== undefined || plan.lastReviewKm !== undefined;
  return hasDate && hasMeter;
}

/**
 * Builds the calculations list for equipments that have a registered preventive plan.
 * An equipment is ONLY placed under active PCM control from the moment a preventive is registered.
 */
export function buildFleetPreventives(
  equipments: Equipment[],
  plans: PreventivePlan[],
  thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS
): PreventiveCalculation[] {
  const planMap = new Map<string, PreventivePlan>();
  plans.forEach((p) => {
    if (p.equipmentId && hasRegisteredPreventive(p)) {
      planMap.set(p.equipmentId, p);
    }
  });

  const controlledEquipments = equipments.filter((eq) => planMap.has(eq.id));

  return controlledEquipments.map((eq) => {
    const plan = planMap.get(eq.id)!;
    return calculateEquipmentPreventive(eq, plan, thresholds);
  });
}

/**
 * Formats value with unit (e.g. "2.750 h" or "135.000 km").
 */
export function formatMetricWithUnit(value: number | undefined | null, unit: PreventiveUnit): string {
  if (value === undefined || value === null || isNaN(value)) {
    return unit === 'KM' ? '0 km' : '0,0 h';
  }
  const formatted =
    unit === 'KM'
      ? Math.round(value).toLocaleString('pt-BR')
      : Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return `${formatted} ${unit === 'KM' ? 'km' : 'h'}`;
}

/**
 * Formats plain number according to unit (without appending the unit).
 */
export function formatMetricValue(value: number | undefined | null, unit: PreventiveUnit): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0';
  }
  return unit === 'KM'
    ? Math.round(value).toLocaleString('pt-BR')
    : Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Formats a review date into the Brazilian format DD/MM/2026 (or DD/MM/YYYY).
 * Handles ISO strings (YYYY-MM-DD) and ensures consistent Brazilian DD/MM/YYYY display.
 */
/**
 * Formats a date string into standard Brazilian format: DD/MM/AAAA
 */
export function formatDateDDMMAAAA(dateStr?: string | null): string {
  if (!dateStr || dateStr === '-' || dateStr.trim() === '') return '-';
  const trimmed = dateStr.trim();

  // If ISO string like 2026-09-20T12:00:00... extract date part
  const cleanDate = trimmed.split('T')[0];

  // Format YYYY-MM-DD
  const isoParts = cleanDate.split('-');
  if (isoParts.length === 3 && isoParts[0].length === 4) {
    const day = isoParts[2].padStart(2, '0');
    const month = isoParts[1].padStart(2, '0');
    const year = isoParts[0];
    return `${day}/${month}/${year}`;
  }

  // Format DD/MM/YYYY or DD-MM-YYYY
  const slashParts = trimmed.includes('/') ? trimmed.split('/') : trimmed.split('-');
  if (slashParts.length === 3) {
    // If first part is 4 digits, it's YYYY/MM/DD
    if (slashParts[0].length === 4) {
      const year = slashParts[0];
      const month = slashParts[1].padStart(2, '0');
      const day = slashParts[2].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
    // Else DD/MM/YYYY
    const day = slashParts[0].padStart(2, '0');
    const month = slashParts[1].padStart(2, '0');
    let year = slashParts[2];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${day}/${month}/${year}`;
  }

  // Try Date parsing fallback
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return trimmed;
}

export const formatReviewDate2026 = formatDateDDMMAAAA;

/**
 * Exports fleet preventive maintenance overview to a CSV file compatible with Excel.
 */
export function exportPreventivesToCSV(calculations: PreventiveCalculation[]): void {
  if (!calculations || calculations.length === 0) return;

  const headers = [
    'Equipamento',
    'Prefixo',
    'Placa',
    'Marca/Modelo',
    'Fornecedor',
    'Obra/Local',
    'Data',
    'Última Revisão (Valor)',
    'Unidade',
    'Última Leitura Atual',
    'Data do Último KM / Hor',
    'Intervalo',
    'Próxima Revisão',
    'Faltam / Excedente',
    'Status',
  ];

  const rows = calculations.map((c) => {
    const faltamText = c.isOverdue
      ? `Excedente: +${formatMetricWithUnit(c.overdueValue, c.unit)}`
      : `Faltam: ${formatMetricWithUnit(c.remainingValue, c.unit)}`;

    return [
      `"${c.equipment.type || ''}"`,
      `"${c.equipment.prefix || ''}"`,
      `"${c.equipment.plate || ''}"`,
      `"${c.equipment.brand || ''} ${c.equipment.model || ''}"`.trim(),
      `"${c.equipment.supplier || ''}"`,
      `"${c.equipment.location || ''}"`,
      formatDateDDMMAAAA(c.lastReviewDate),
      formatMetricValue(c.lastReviewValue, c.unit),
      c.unit,
      formatMetricValue(c.currentValue, c.unit),
      formatDateDDMMAAAA(c.lastReadingDate),
      formatMetricWithUnit(c.intervalValue, c.unit),
      formatMetricValue(c.nextReviewValue, c.unit),
      `"${faltamText}"`,
      c.statusLabel,
    ];
  });

  const csvContent =
    '\uFEFF' +
    headers.join(';') +
    '\n' +
    rows.map((row) => row.join(';')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const now = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `makmo_controle_preventivas_${now}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
