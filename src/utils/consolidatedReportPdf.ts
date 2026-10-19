import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Equipment,
  DailyLog,
  PreventiveRecord,
  CorrectiveMaintenance,
  PreventivePlan,
} from '../types';
import { formatDateBR, getTodayDateString } from './storage';
import { getMakmoInfraestruturaBannerBase64 } from './makmoLogoData';

export interface ConsolidatedPDFOptions {
  obraLabel?: string;
  userName?: string;
  equipments: Equipment[];
  dailyLogs?: DailyLog[];
  preventiveRecords?: PreventiveRecord[];
  correctiveMaintenances?: CorrectiveMaintenance[];
  preventivePlans?: PreventivePlan[];
}

/**
 * Normalizes date display format to DD/MM/AAAA
 */
function formatDisplayDate(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return '-';
  const clean = dateStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const [y, m, d] = clean.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }
  return formatDateBR(clean);
}

/**
 * Generates and downloads a consolidated corporate-grade PDF report
 * containing all registered equipments, PCM preventive logs, corrective maintenance records,
 * and operational maintenance logs.
 */
export function exportConsolidatedReportPDF(options: ConsolidatedPDFOptions): void {
  const {
    obraLabel = 'Todas as Obras (Visão Global)',
    userName = 'Administrador do Sistema',
    equipments = [],
    dailyLogs = [],
    preventiveRecords = [],
    correctiveMaintenances = [],
    preventivePlans = [],
  } = options;

  // A4 Landscape: 297mm x 210mm
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

  // Palette: Official Makmo Brand Identity
  const BRAND_NAVY: [number, number, number] = [17, 56, 97]; // #113861
  const BRAND_TEAL: [number, number, number] = [32, 180, 167]; // #20b4a7
  const BRAND_SLATE: [number, number, number] = [30, 41, 59]; // Slate 800

  // Total metrics
  const totalEquipments = equipments.length;
  const totalPreventives = preventiveRecords.length;
  const totalCorrectives = correctiveMaintenances.length;
  const totalDailyLogs = dailyLogs.length;

  const totalHourMeters = equipments.reduce((acc, eq) => acc + (Number(eq.currentHourMeter) || 0), 0);
  const totalWorkedHours = dailyLogs.reduce((acc, log) => acc + (Number(log.workedHours) || 0), 0);

  // 1. Corporate Header Banner (Deep Navy #113861)
  doc.setFillColor(...BRAND_NAVY);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Insert Makmo Infraestrutura Logo
  const bannerLogo = getMakmoInfraestruturaBannerBase64();
  if (bannerLogo) {
    try {
      doc.addImage(bannerLogo, 'PNG', 12, 3, 54, 18);
    } catch {
      // Fallback text if image fail
    }
  }

  const titleX = bannerLogo ? 70 : 14;

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('RELATÓRIO CONSOLIDADO DA FROTA & HISTÓRICO DE MANUTENÇÃO', titleX, 10);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_TEAL);
  doc.text(
    `Base de Dados Oficial • Gestão de Equipamentos • PCM Preventivas & Corretivas • ${obraLabel.toUpperCase()}`,
    titleX,
    16
  );

  // Emission Metadata
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`Emissão: ${todayStr} às ${nowTime}`, pageWidth - 14, 10, { align: 'right' });
  doc.text(`Emitido por: ${userName}`, pageWidth - 14, 15, { align: 'right' });

  // Teal divider accent stripe
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(0, 25, pageWidth, 1.2, 'F');

  // 2. Executive KPI Summary Cards
  const kpiY = 29;
  const cardHeight = 13.5;
  const cardMargin = 12;
  const usableWidth = pageWidth - cardMargin * 2;
  const cardWidth = (usableWidth - 12) / 5;

  const kpis = [
    {
      title: 'EQUIPAMENTOS',
      value: `${totalEquipments} máquinas`,
      sub: `${preventivePlans.length} c/ plano PCM`,
      color: BRAND_NAVY,
      bg: [248, 250, 252],
    },
    {
      title: 'HORÍMETRO TOTAL',
      value: `${totalHourMeters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`,
      sub: 'Acumulado da frota',
      color: BRAND_NAVY,
      bg: [248, 250, 252],
    },
    {
      title: 'PREVENTIVAS PCM',
      value: `${totalPreventives} revisões`,
      sub: 'Ordens realizadas',
      color: [16, 149, 137], // Teal/Emerald
      bg: [240, 253, 250],
    },
    {
      title: 'CORRETIVAS',
      value: `${totalCorrectives} reparos`,
      sub: 'Histórico de falhas',
      color: [225, 29, 72], // Rose
      bg: [255, 241, 242],
    },
    {
      title: 'APONTAMENTOS FROTA',
      value: `${totalDailyLogs} registros`,
      sub: `${totalWorkedHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h trabalhadas`,
      color: [30, 41, 59],
      bg: [248, 250, 252],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = cardMargin + idx * (cardWidth + 3);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, kpiY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, x + 3, kpiY + 4);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 3, kpiY + 8.5);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, x + 3, kpiY + 12);
  });

  // Track vertical position
  let currentY = kpiY + cardHeight + 4;

  // ==========================================
  // SEÇÃO 1: INVENTÁRIO CONSOLIDADO DE EQUIPAMENTOS
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_NAVY);
  doc.text('1. BASE DE DADOS • INVENTÁRIO COMPLETO DE EQUIPAMENTOS', 12, currentY + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Total de ${totalEquipments} equipamento(s) cadastrado(s) para a obra selecionada`,
    pageWidth - 12,
    currentY + 3,
    { align: 'right' }
  );

  const equipmentsHead = [
    [
      '#',
      'Prefixo',
      'Equipamento',
      'Placa',
      'Marca / Modelo',
      'Fornecedor',
      'Obra / Local',
      'Chassi',
      'Horímetro (h)',
      'Operador',
      'Mobilização',
      'Desmobilização',
    ],
  ];

  const equipmentsBody = equipments.map((eq, idx) => [
    String(idx + 1),
    eq.prefix || eq.code || '-',
    eq.type || '-',
    eq.plate || '-',
    [eq.brand, eq.model].filter(Boolean).join(' ') || (eq.brandModel ? eq.brandModel : '-'),
    eq.supplier || 'Frota Própria',
    eq.location || '-',
    eq.chassis || '-',
    eq.currentHourMeter ? Number(eq.currentHourMeter).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0,0',
    eq.operator || '-',
    formatDisplayDate(eq.mobilizationDate),
    formatDisplayDate(eq.demobilizationDate),
  ]);

  autoTable(doc, {
    startY: currentY + 5,
    head: equipmentsHead,
    body: equipmentsBody,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: BRAND_NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 }, // #
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 18 }, // Prefixo
      2: { cellWidth: 30 }, // Equipamento
      3: { halign: 'center', cellWidth: 18 }, // Placa
      4: { cellWidth: 30 }, // Marca / Modelo
      5: { cellWidth: 28 }, // Fornecedor
      6: { cellWidth: 24 }, // Obra
      7: { halign: 'center', cellWidth: 28 }, // Chassi
      8: { halign: 'right', fontStyle: 'bold', cellWidth: 19 }, // Horímetro
      9: { cellWidth: 24 }, // Operador
      10: { halign: 'center', cellWidth: 23 }, // Mobilização
      11: { halign: 'center', cellWidth: 23 }, // Desmobilização
    },
    didDrawPage: (data) => {
      drawCorporateFooter(doc, data.pageNumber);
    },
  });

  // ==========================================
  // SEÇÃO 2: LOGS DE MANUTENÇÃO PREVENTIVA (PCM)
  // ==========================================
  // New page for PCM Preventivas
  doc.addPage();
  currentY = 16;

  // Header mini-bar for interior pages
  drawPageHeader(doc, '2. HISTÓRICO & LOGS DE MANUTENÇÃO PREVENTIVA (PCM)', obraLabel);

  if (preventiveRecords.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Nenhum registro de manutenção preventiva (PCM) cadastrado para os equipamentos selecionados.', 14, 28);
  } else {
    const preventiveHead = [
      [
        'Data',
        'Prefixo',
        'Equipamento',
        'Tipo de Revisão',
        'Horímetro (h)',
        'Próxima Revisão',
        'Responsável / Mecânico',
        'Peças / Lubrificantes Substituídos',
        'O.S. / Nº',
      ],
    ];

    const preventiveBody = preventiveRecords.map((rec) => [
      formatDisplayDate(rec.date),
      rec.equipmentCode || '-',
      rec.equipmentType || '-',
      rec.type || rec.intervalType || '-',
      rec.hourMeter ? `${Number(rec.hourMeter).toLocaleString('pt-BR')} h` : '-',
      rec.nextReviewValue ? `${Number(rec.nextReviewValue).toLocaleString('pt-BR')} h` : '-',
      rec.responsible || '-',
      rec.partsReplaced || rec.servicesPerformed || '-',
      rec.workOrderNumber || '-',
    ]);

    autoTable(doc, {
      startY: 23,
      head: preventiveHead,
      body: preventiveBody,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.6,
        valign: 'middle',
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [16, 149, 137], // Teal/Emerald PCM
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: [240, 253, 250],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 }, // Data
        1: { halign: 'center', fontStyle: 'bold', cellWidth: 20 }, // Prefixo
        2: { cellWidth: 32 }, // Equipamento
        3: { cellWidth: 32 }, // Tipo de Revisão
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 22 }, // Horímetro
        5: { halign: 'right', cellWidth: 24 }, // Próxima Revisão
        6: { cellWidth: 34 }, // Responsável
        7: { cellWidth: 65 }, // Peças / Lubrificantes
        8: { halign: 'center', cellWidth: 24 }, // OS
      },
      didDrawPage: (data) => {
        drawCorporateFooter(doc, data.pageNumber);
      },
    });
  }

  // ==========================================
  // SEÇÃO 3: LOGS DE MANUTENÇÃO CORRETIVA
  // ==========================================
  doc.addPage();
  drawPageHeader(doc, '3. HISTÓRICO & LOGS DE MANUTENÇÕES CORRETIVAS REALIZADAS', obraLabel);

  if (correctiveMaintenances.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Nenhuma ordem de manutenção corretiva cadastrada para os equipamentos selecionados.', 14, 28);
  } else {
    const correctiveHead = [
      [
        'O.S.',
        'Data',
        'Prefixo',
        'Equipamento',
        'Sistema Afetado',
        'Falha / Causa Diagnosticada',
        'Serviço Executado',
        'Horímetro (h)',
        'Mecânico / Técnico',
        'Status',
      ],
    ];

    const correctiveBody = correctiveMaintenances.map((c) => {
      const meterVal = c.completionMeter !== undefined ? c.completionMeter : c.openMeter;
      const unit = c.meterUnit === 'KM' ? 'km' : 'h';
      const meterStr = meterVal !== undefined ? `${Number(meterVal).toLocaleString('pt-BR')} ${unit}` : '-';

      return [
        c.osNumber || '-',
        formatDisplayDate(c.openDate),
        c.prefix || '-',
        c.equipmentType || '-',
        c.affectedSystem || c.failureType || '-',
        c.problemDescription || c.diagnosis || '-',
        c.servicePerformed || '-',
        meterStr,
        c.mechanic || '-',
        c.status || 'Concluída',
      ];
    });

    autoTable(doc, {
      startY: 23,
      head: correctiveHead,
      body: correctiveBody,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.6,
        valign: 'middle',
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [180, 35, 24], // Deep Amber/Rose Corretivas
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: [254, 242, 242],
      },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 22 }, // OS
        1: { halign: 'center', cellWidth: 18 }, // Data
        2: { halign: 'center', fontStyle: 'bold', cellWidth: 18 }, // Prefixo
        3: { cellWidth: 28 }, // Equipamento
        4: { cellWidth: 26 }, // Sistema Afetado
        5: { cellWidth: 50 }, // Falha
        6: { cellWidth: 50 }, // Serviço
        7: { halign: 'right', cellWidth: 18 }, // Horímetro
        8: { cellWidth: 26 }, // Mecânico
        9: { halign: 'center', fontStyle: 'bold', cellWidth: 17 }, // Status
      },
      didDrawPage: (data) => {
        drawCorporateFooter(doc, data.pageNumber);
      },
    });
  }

  // ==========================================
  // SEÇÃO 4: RESUMO DE APONTAMENTOS DIÁRIOS & OCORRÊNCIAS
  // ==========================================
  if (dailyLogs.length > 0) {
    doc.addPage();
    drawPageHeader(doc, '4. LOGS DIÁRIOS DA FROTA & APONTAMENTOS OPERACIONAIS', obraLabel);

    // Filter logs or take latest 80 logs sorted by date desc
    const sortedLogs = [...dailyLogs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100);

    const logsHead = [
      [
        'Data',
        'Prefixo / Placa',
        'Operador',
        'Localização / Obra',
        'Horímetro Inicial',
        'Horímetro Final',
        'Horas Trabalhadas',
        'Horas Manut.',
        'Observações / Ocorrências de Mecânica',
      ],
    ];

    const logsBody = sortedLogs.map((log) => [
      formatDisplayDate(log.date),
      log.equipmentCode || '-',
      log.operator || '-',
      log.location || '-',
      log.initialHourMeter ? Number(log.initialHourMeter).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0,0',
      log.finalHourMeter ? Number(log.finalHourMeter).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0,0',
      log.workedHours ? `${Number(log.workedHours).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` : '0,0 h',
      log.maintenanceHours ? `${Number(log.maintenanceHours).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` : '0,0 h',
      log.notes || '-',
    ]);

    autoTable(doc, {
      startY: 23,
      head: logsHead,
      body: logsBody,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        valign: 'middle',
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: BRAND_SLATE,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 18 }, // Data
        1: { halign: 'center', fontStyle: 'bold', cellWidth: 22 }, // Prefixo
        2: { cellWidth: 30 }, // Operador
        3: { cellWidth: 28 }, // Local
        4: { halign: 'right', cellWidth: 22 }, // Horímetro Inicial
        5: { halign: 'right', cellWidth: 22 }, // Horímetro Final
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 22 }, // Horas Trab
        7: { halign: 'right', cellWidth: 20 }, // Horas Manut
        8: { cellWidth: 87 }, // Ocorrências
      },
      didDrawPage: (data) => {
        drawCorporateFooter(doc, data.pageNumber);
      },
    });
  }

  // Final Signatures Block on last page
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 160;
  if (finalY < pageHeight - 35) {
    drawSignatures(doc, finalY, pageWidth);
  } else {
    doc.addPage();
    drawPageHeader(doc, 'TERMO DE EMISSÃO & APROVAÇÃO TÉCNICA', obraLabel);
    drawSignatures(doc, 45, pageWidth);
    drawCorporateFooter(doc, doc.getNumberOfPages());
  }

  // Save / Download PDF
  const safeObra = obraLabel.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
  const filename = `Relatorio_Consolidado_Equipamentos_Manutencao_${safeObra}_${getTodayDateString()}.pdf`;
  doc.save(filename);
}

/**
 * Draws internal page header bar
 */
function drawPageHeader(doc: jsPDF, title: string, obraLabel: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(17, 56, 97); // #113861
  doc.rect(0, 0, pageWidth, 16, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 12, 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(32, 180, 167); // Teal
  doc.text(`Makmo Infraestrutura • ${obraLabel.toUpperCase()}`, 12, 13.5);

  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`Relatório Consolidado de Frotas & PCM`, pageWidth - 12, 10, { align: 'right' });

  doc.setFillColor(32, 180, 167);
  doc.rect(0, 16, pageWidth, 0.8, 'F');
}

/**
 * Draws standard corporate footer on every page
 */
function drawCorporateFooter(doc: jsPDF, pageNumber: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(12, pageHeight - 10, pageWidth - 12, pageHeight - 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Makmo Infraestrutura • Sistema Integrado de Gestão de Frotas, Equipamentos & PCM',
    12,
    pageHeight - 6
  );

  doc.setFont('helvetica', 'bold');
  doc.text(
    `Página ${pageNumber} de ${totalPages}`,
    pageWidth - 12,
    pageHeight - 6,
    { align: 'right' }
  );
}

/**
 * Draws corporate signature lines
 */
function drawSignatures(doc: jsPDF, startY: number, pageWidth: number) {
  const boxWidth = 75;
  const col1X = 25;
  const col2X = pageWidth / 2 - boxWidth / 2;
  const col3X = pageWidth - col1X - boxWidth;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);

  // Line 1: Engenheiro / Responsável PCM
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(col1X, startY + 12, col1X + boxWidth, startY + 12);
  doc.setFont('helvetica', 'bold');
  doc.text('Responsável PCM / Manutenção', col1X + boxWidth / 2, startY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Controle & Planejamento Mecânico', col1X + boxWidth / 2, startY + 19.5, { align: 'center' });

  // Line 2: Gestor da Obra / Operações
  doc.line(col2X, startY + 12, col2X + boxWidth, startY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Gestor Operacional da Frota', col2X + boxWidth / 2, startY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Supervisão & Logística de Campo', col2X + boxWidth / 2, startY + 19.5, { align: 'center' });

  // Line 3: Engenharia / Diretoria
  doc.line(col3X, startY + 12, col3X + boxWidth, startY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Diretoria / Engenharia Residente', col3X + boxWidth / 2, startY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Makmo Infraestrutura', col3X + boxWidth / 2, startY + 19.5, { align: 'center' });
}
