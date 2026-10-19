import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PreventiveCalculation, Equipment } from '../types';
import { formatDateBR } from './storage';
import { formatMetricWithUnit, formatDateDDMMAAAA } from './preventiveUtils';
import { getMakmoInfraestruturaBannerBase64 } from './makmoLogoData';

export interface ExportPreventivesPDFOptions {
  title?: string;
  filterInfo?: string;
  viewMode?: 'controlled' | 'all';
  userName?: string;
}

/**
 * Builds the Preventive Maintenance Control / Acompanhamento de Preventivas jsPDF document instance
 * featuring the official Makmo Infraestrutura brand identity, executive KPIs, and detailed fleet status.
 */
export function buildPreventivesPDF(
  calculations: PreventiveCalculation[],
  equipments: Equipment[] = [],
  options: ExportPreventivesPDFOptions = {}
): jsPDF {
  // Landscape A4 orientation (297mm x 210mm) for optimal multi-column readability
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

  // Calculate KPIs
  const totalCount = calculations.length;
  const countEmDia = calculations.filter((c) => c.status === 'EM_DIA').length;
  const countAtencao = calculations.filter(
    (c) => c.status === 'ATENCAO' || c.status === 'PROXIMA' || c.status === 'FAZER_REVISAO'
  ).length;
  const countVencidas = calculations.filter((c) => c.status === 'VENCIDA').length;

  // 1. Corporate Header Banner (Deep Navy matching Makmo corporate guidelines)
  doc.setFillColor(21, 57, 91); // #15395b
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Insert Makmo Infraestrutura Vector Banner Logo
  const bannerLogo = getMakmoInfraestruturaBannerBase64();
  if (bannerLogo) {
    try {
      doc.addImage(bannerLogo, 'PNG', 12, 3, 56, 19);
    } catch (e) {
      console.warn('Could not render Makmo banner in PDF:', e);
    }
  }

  const titleStartX = bannerLogo ? 72 : 14;

  // Main Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text(options.title || 'CONTROLE E ACOMPANHAMENTO DE PREVENTIVAS', titleStartX, 11);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(32, 188, 169); // Teal #20bca9
  doc.text('Relatório Gerencial de Manutenções Preventivas, Horímetros e Previsão de Revisões', titleStartX, 17);

  // Emission Metadata on top right
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`Gerado em: ${todayStr} às ${nowTime}`, pageWidth - 14, 11, { align: 'right' });

  const filterText = options.filterInfo || `${totalCount} equipamento(s) sob monitoramento ativo`;
  doc.text(filterText, pageWidth - 14, 17, { align: 'right' });

  // Teal divider accent stripe
  doc.setFillColor(32, 188, 169);
  doc.rect(0, 27, pageWidth, 1.2, 'F');

  // 2. Executive KPI Cards Banner (y = 31mm to 44mm)
  const cardY = 31;
  const cardHeight = 13;
  const cardMargin = 12;
  const usableWidth = pageWidth - cardMargin * 2;
  const cardWidth = (usableWidth - 9) / 4;

  const kpis = [
    {
      title: 'TOTAL MONITORADO',
      value: `${totalCount} equipamentos`,
      color: [30, 41, 59], // Slate 800
      bg: [248, 250, 252],
      border: [226, 232, 240],
    },
    {
      title: 'PREVENTIVAS EM DIA',
      value: `${countEmDia} (${totalCount > 0 ? Math.round((countEmDia / totalCount) * 100) : 0}%)`,
      color: [5, 150, 105], // Emerald
      bg: [236, 253, 245],
      border: [167, 243, 208],
    },
    {
      title: 'ATENÇÃO / PRÓXIMAS',
      value: `${countAtencao} equipamentos`,
      color: [217, 119, 6], // Amber
      bg: [255, 251, 235],
      border: [253, 230, 138],
    },
    {
      title: 'CRÍTICO / VENCIDAS',
      value: `${countVencidas} equipamentos`,
      color: [220, 38, 38], // Rose / Red
      bg: [254, 242, 242],
      border: [254, 202, 202],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = cardMargin + idx * (cardWidth + 3);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
    doc.roundedRect(kpiX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, kpiX + 3.5, cardY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, kpiX + 3.5, cardY + 10);
  });

  // 3. Build Table Rows
  const tableData = calculations.map((c) => {
    // Equipment identifier
    const prefix = c.equipment.prefix || '-';
    const plate = c.equipment.plate && c.equipment.plate !== prefix ? c.equipment.plate : '';
    const prefixPlateStr = plate ? `${prefix}\n(${plate})` : prefix;

    const eqType = c.equipment.type || '-';
    const brandModel = `${c.equipment.brand || ''} ${c.equipment.model || ''}`.trim() || '-';
    const supplier = c.equipment.supplier || '-';
    const location = c.equipment.location || '-';

    // Data da Última Revisão no formato DD/MM/AAAA
    const dateFormatted = formatDateDDMMAAAA(c.lastReviewDate);

    // Última Revisão (Valor métrico)
    let lastReviewMetric = '-';
    if (c.lastReviewValue > 0 || (c.lastReviewDate && c.lastReviewDate !== '-')) {
      lastReviewMetric = formatMetricWithUnit(c.lastReviewValue, c.unit);
    } else {
      lastReviewMetric = 'Sem registro';
    }

    // Leitura Atual e Data da Leitura Atual
    const currentStr = formatMetricWithUnit(c.currentValue, c.unit);
    const readingDateFormatted = formatDateDDMMAAAA(c.lastReadingDate);

    // Intervalo
    const intervalStr = c.plan.intervalType || formatMetricWithUnit(c.intervalValue, c.unit);

    // Próxima Revisão
    const nextReviewStr = formatMetricWithUnit(c.nextReviewValue, c.unit);

    // Faltam / Excedente
    const faltamStr = c.isOverdue
      ? `+${formatMetricWithUnit(c.overdueValue, c.unit)}\n(Excedente)`
      : `${formatMetricWithUnit(c.remainingValue, c.unit)}\nrestantes`;

    return [
      c.statusLabel,
      prefixPlateStr,
      eqType,
      brandModel,
      supplier,
      location,
      dateFormatted,
      lastReviewMetric,
      currentStr,
      readingDateFormatted,
      intervalStr,
      nextReviewStr,
      faltamStr,
    ];
  });

  // 4. Generate AutoTable
  autoTable(doc, {
    startY: 47,
    head: [
      [
        'STATUS',
        'PREFIXO / PLACA',
        'TIPO DE EQUIPAMENTO',
        'MARCA / MODELO',
        'FORNECEDOR',
        'OBRA / LOCAL',
        'DATA',
        'ÚLTIMA REVISÃO',
        'LEITURA ATUAL',
        'DATA ÚLT. KM/HOR',
        'INTERVALO',
        'PRÓXIMA REVISÃO',
        'FALTAM / EXCED.',
      ],
    ],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7.0,
      cellPadding: 1.6,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [21, 57, 91], // Corporate Deep Blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
      cellPadding: 2.0,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 17, fontStyle: 'bold' }, // STATUS
      1: { halign: 'center', cellWidth: 19, fontStyle: 'bold' }, // PREFIXO
      2: { halign: 'left', cellWidth: 26 },                     // TIPO
      3: { halign: 'left', cellWidth: 22 },                     // MARCA/MODELO
      4: { halign: 'left', cellWidth: 20 },                     // FORNECEDOR
      5: { halign: 'left', cellWidth: 20 },                     // OBRA/LOCAL
      6: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },// DATA
      7: { halign: 'center', cellWidth: 20 },                   // ÚLTIMA REVISÃO
      8: { halign: 'center', cellWidth: 21, fontStyle: 'bold', textColor: [37, 99, 235] }, // LEITURA ATUAL
      9: { halign: 'center', cellWidth: 21, fontStyle: 'bold' },// DATA ÚLT. KM/HOR
      10: { halign: 'center', cellWidth: 17 },                  // INTERVALO
      11: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },// PRÓXIMA REVISÃO
      12: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },// FALTAM / EXCEDENTE
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Style Status Badges
      if (data.section === 'body' && data.column.index === 0) {
        const text = String(data.cell.raw);
        if (text === 'EM DIA') {
          data.cell.styles.textColor = [5, 150, 105]; // Emerald
          data.cell.styles.fillColor = [236, 253, 245];
        } else if (text === 'ATENÇÃO' || text === 'PRÓXIMA DA REVISÃO') {
          data.cell.styles.textColor = [217, 119, 6]; // Amber
          data.cell.styles.fillColor = [255, 251, 235];
        } else if (text === 'VENCIDA' || text === 'FAZER REVISÃO') {
          data.cell.styles.textColor = [220, 38, 38]; // Red
          data.cell.styles.fillColor = [254, 242, 242];
        }
      }

      // Highlight Overdue in Column 12 (Faltam / Excedente)
      if (data.section === 'body' && data.column.index === 12) {
        const text = String(data.cell.raw);
        if (text.includes('Excedente')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fillColor = [254, 242, 242];
        } else {
          data.cell.styles.textColor = [5, 150, 105];
        }
      }
    },
    margin: { top: 47, left: 12, right: 12, bottom: 12 },
    didDrawPage: (data) => {
      // Professional Footer
      const totalPages = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);

      // Footer divider line
      doc.setDrawColor(226, 232, 240);
      doc.line(12, pageHeight - 9, pageWidth - 12, pageHeight - 9);

      // Left footer
      doc.text(
        'MAKMO INFRAESTRUTURA • Sistema de Gestão de Frotas & PCM • Documento de Uso Interno',
        12,
        pageHeight - 5
      );

      // Right footer
      doc.text(
        `Página ${data.pageNumber} de ${totalPages}`,
        pageWidth - 12,
        pageHeight - 5,
        { align: 'right' }
      );
    },
  });

  return doc;
}

/**
 * Exports the Preventive Maintenance Control / Acompanhamento de Preventivas table to a professional PDF
 */
export function exportPreventivesToPDF(
  calculations: PreventiveCalculation[],
  equipments: Equipment[] = [],
  options: ExportPreventivesPDFOptions = {}
): void {
  const doc = buildPreventivesPDF(calculations, equipments, options);
  const today = new Date();
  const dateFormattedFile = today.toISOString().split('T')[0];
  doc.save(`makmo_acompanhamento_preventivas_${dateFormattedFile}.pdf`);
}
