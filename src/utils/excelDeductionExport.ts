import { MeasurementDeduction } from '../types';
import { formatDateDDMMAAAA } from './deductionUtils';

/**
 * Exporta a listagem de Descontos em Medição para formato CSV compatível diretamente com o Microsoft Excel (padrão Brasil).
 * Utiliza delimitador ponto-e-vírgula (;) e BOM UTF-8 (\uFEFF) para garantir acentuação perfeita.
 */
export function exportDeductionsToExcel(deductions: MeasurementDeduction[], fileName = 'descontos_medicao_makmo'): void {
  const headers = [
    'Prefixo',
    'Equipamento',
    'Tipo',
    'Marca',
    'Modelo',
    'Fornecedor',
    'Obra',
    'Placa',
    'Operador',
    'Valor da Medição (R$)',
    'Valor da Diária (R$)',
    'Data Inicial',
    'Data Final',
    'Dias Parados',
    'Valor do Desconto (R$)',
    'Motivo da Paralisação',
    'Status',
    'Observação',
    'Criado Por',
    'Data de Criação',
    'Encerrado Por',
    'Data de Encerramento',
  ];

  const escapeCSV = (value: string | number | undefined | null) => {
    if (value === undefined || value === null) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = deductions.map((d) => [
    escapeCSV(d.prefix),
    escapeCSV(d.equipmentType),
    escapeCSV(d.type || d.equipmentType),
    escapeCSV(d.brand || '-'),
    escapeCSV(d.model || '-'),
    escapeCSV(d.supplier),
    escapeCSV(d.location),
    escapeCSV(d.plate || '-'),
    escapeCSV(d.operator || '-'),
    escapeCSV(d.measurementValue.toFixed(2).replace('.', ',')),
    escapeCSV(d.dailyRate.toFixed(2).replace('.', ',')),
    escapeCSV(formatDateDDMMAAAA(d.startDate)),
    escapeCSV(d.isOngoing || !d.endDate ? 'Em Aberto (Parado)' : formatDateDDMMAAAA(d.endDate)),
    escapeCSV(d.stoppedDays),
    escapeCSV(d.discountValue.toFixed(2).replace('.', ',')),
    escapeCSV(d.reason),
    escapeCSV(d.status),
    escapeCSV(d.notes || ''),
    escapeCSV(d.createdBy),
    escapeCSV(formatDateDDMMAAAA(d.createdAt.split('T')[0])),
    escapeCSV(d.closedBy || '-'),
    escapeCSV(d.closedAt ? formatDateDDMMAAAA(d.closedAt.split('T')[0]) : '-'),
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
