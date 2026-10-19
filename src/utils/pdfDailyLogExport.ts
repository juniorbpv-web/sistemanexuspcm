import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyLog, Equipment } from '../types';
import { formatDateBR, formatHours, getTodayDateString } from './storage';
import { getMakmoInfraestruturaBannerBase64 } from './makmoLogoData';

export interface DailyLogPDFOptions {
  obraLabel?: string;
  filterInfo?: string;
  userName?: string;
}

/**
 * Exports Daily Logs (Apontamentos de Parte Diária) to a formatted, executive-grade PDF
 * with the official visual identity of Makmo Infraestrutura.
 */
export function exportDailyLogsToPDF(
  logs: DailyLog[],
  equipments: Equipment[] = [],
  options: DailyLogPDFOptions = {}
): void {
  const {
    obraLabel = 'Todas as Obras',
    filterInfo,
    userName = 'Gestão Operacional',
  } = options;

  // Landscape A4 (297mm x 210mm) for maximum tabular readability
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const today = new Date();
  const todayStr = today.toLocaleDateString('pt-BR');
  const nowTime = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Official Makmo Brand Colors
  const BRAND_NAVY: [number, number, number] = [17, 56, 97]; // #113861
  const BRAND_TEAL: [number, number, number] = [32, 180, 167]; // #20b4a7
  const BRAND_TEAL_DARK: [number, number, number] = [23, 138, 127]; // #178a7f

  // Calculate Metrics
  const totalLogs = logs.length;
  const totalWorked = logs.reduce((acc, curr) => acc + (Number(curr.workedHours) || 0), 0);
  const totalMaint = logs.reduce((acc, curr) => acc + (Number(curr.maintenanceHours) || 0), 0);
  const distinctEquips = new Set(logs.map((l) => l.equipmentCode.trim().toUpperCase())).size;
  const avgWorked = totalLogs > 0 ? totalWorked / totalLogs : 0;

  // 1. Corporate Header Banner (Deep Navy #113861)
  doc.setFillColor(...BRAND_NAVY);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Insert Makmo Infraestrutura Logo Banner
  const bannerLogo = getMakmoInfraestruturaBannerBase64();
  if (bannerLogo) {
    try {
      doc.addImage(bannerLogo, 'PNG', 12, 3, 54, 18);
    } catch (e) {
      console.warn('Could not render logo in Daily Log PDF:', e);
    }
  }

  const textStartX = bannerLogo ? 70 : 14;

  // Title & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('RELATÓRIO DE APONTAMENTO DE PARTE DIÁRIA & HORÍMETROS', textStartX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_TEAL);
  doc.text(
    `Gestão de Frotas & Equipamentos • ${obraLabel.toUpperCase()} • Emissão Oficial`,
    textStartX,
    17
  );

  // Emission Metadata
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`Emissão: ${todayStr} às ${nowTime}`, pageWidth - 14, 11, { align: 'right' });
  doc.text(`Responsável: ${userName}`, pageWidth - 14, 17, { align: 'right' });

  if (filterInfo) {
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND_TEAL);
    doc.text(filterInfo, pageWidth - 14, 22, { align: 'right' });
  }

  // Teal Accent Divider Stripe
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(0, 25, pageWidth, 1.2, 'F');

  // 2. Summary KPI Metrics Strip
  const kpiY = 29;
  const kpiH = 14;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(12, kpiY, pageWidth - 24, kpiH, 2, 2, 'FD');

  const colWidth = (pageWidth - 24) / 5;

  // Metric 1: Total Apontamentos
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL APONTAMENTOS', 16, kpiY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_NAVY);
  doc.text(`${totalLogs} turno(s)`, 16, kpiY + 11);

  // Metric 2: Total Horas Trabalhadas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL HORAS TRABALHADAS', 16 + colWidth, kpiY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_TEAL_DARK);
  doc.text(`${formatHours(totalWorked)} h`, 16 + colWidth, kpiY + 11);

  // Metric 3: Total Horas Manutenção
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('HORAS EM MANUTENÇÃO', 16 + colWidth * 2, kpiY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(totalMaint > 0 ? 225 : 100, totalMaint > 0 ? 29 : 116, totalMaint > 0 ? 72 : 139);
  doc.text(`${formatHours(totalMaint)} h`, 16 + colWidth * 2, kpiY + 11);

  // Metric 4: Máquinas Distintas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('MÁQUINAS APONTADAS', 16 + colWidth * 3, kpiY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_NAVY);
  doc.text(`${distinctEquips} equipamento(s)`, 16 + colWidth * 3, kpiY + 11);

  // Metric 5: Média Horas / Turno
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('MÉDIA HORAS / APONTAMENTO', 16 + colWidth * 4, kpiY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`${formatHours(avgWorked)} h/turno`, 16 + colWidth * 4, kpiY + 11);

  // 3. Build Table Rows in EXACT sequence matching the system UI
  const tableData = logs.map((log) => {
    const equip = equipments.find(
      (eq) =>
        (eq.plate && eq.plate.trim().toUpperCase() === log.equipmentCode.trim().toUpperCase()) ||
        eq.code.trim().toUpperCase() === log.equipmentCode.trim().toUpperCase() ||
        (eq.prefix && eq.prefix.trim().toUpperCase() === log.equipmentCode.trim().toUpperCase())
    );

    const displayPlate = equip?.plate || log.equipmentCode;
    const prefixStr = equip?.prefix && equip.prefix !== displayPlate ? ` (${equip.prefix})` : '';
    const typeStr = log.equipmentType || equip?.type || '-';
    const obraStr = log.location || equip?.location || 'Não informada';
    const maintStr = log.maintenanceHours > 0 ? `${formatHours(log.maintenanceHours)} h` : '-';

    return [
      formatDateBR(log.date),
      `${displayPlate}${prefixStr}`,
      typeStr,
      obraStr,
      formatHours(log.initialHourMeter),
      formatHours(log.finalHourMeter),
      `${formatHours(log.workedHours)} h`,
      maintStr,
      log.operator || '-',
      log.notes || '-',
    ];
  });

  // Table rendering with jspdf-autotable
  autoTable(doc, {
    startY: 46,
    head: [[
      'Data',
      'Placa / Prefixo',
      'Tipo de Equipamento',
      'Obra / Local',
      'Horímetro Inicial',
      'Horímetro Final',
      'Horas Trab. (h)',
      'Manutenção',
      'Operador / Resp.',
      'Observações do Turno',
    ]],
    body: tableData,
    foot: [[
      'TOTAIS',
      `${distinctEquips} máquina(s)`,
      '-',
      '-',
      '-',
      '-',
      `${formatHours(totalWorked)} h`,
      totalMaint > 0 ? `${formatHours(totalMaint)} h` : '-',
      '-',
      `${totalLogs} apontamento(s) registrado(s)`,
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_NAVY,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    footStyles: {
      fillColor: [240, 253, 250], // Light Teal #f0fdfa
      textColor: BRAND_NAVY,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' }, // Data
      1: { cellWidth: 30, fontStyle: 'bold', textColor: BRAND_NAVY }, // Placa / Prefixo
      2: { cellWidth: 32 }, // Tipo
      3: { cellWidth: 32 }, // Obra
      4: { cellWidth: 22, halign: 'right' }, // Horímetro Inicial
      5: { cellWidth: 22, halign: 'right' }, // Horímetro Final
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: BRAND_TEAL_DARK }, // Horas Trabalhadas
      7: { cellWidth: 22, halign: 'right', textColor: [225, 29, 72] }, // Manutenção
      8: { cellWidth: 30 }, // Operador
      9: { cellWidth: 'auto' }, // Observações
    },
    didDrawPage: (data) => {
      // Institutional Footer with pagination and copyright
      const totalPages = doc.getNumberOfPages();
      const pageStr = `Página ${data.pageNumber} de ${totalPages}`;
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);

      // Left footer
      doc.text(
        'Makmo Infraestrutura • Sistema Integrado de Gestão de Frotas & Obras • Documento Oficial',
        12,
        pageHeight - 6
      );

      // Right footer
      doc.text(pageStr, pageWidth - 12, pageHeight - 6, { align: 'right' });
    },
  });

  const sanitizedObra = obraLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const fileName = `makmo_parte_diaria_${sanitizedObra}_${getTodayDateString()}.pdf`;
  doc.save(fileName);
}
