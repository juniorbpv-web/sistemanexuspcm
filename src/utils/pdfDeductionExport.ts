import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MeasurementDeduction, Equipment } from '../types';
import { formatCurrencyBRL, formatDateDDMMAAAA } from './deductionUtils';
import { getMakmoInfraestruturaBannerBase64 } from './makmoLogoData';
import { OFFICIAL_FLEET_DATA } from '../data/fleetData';
import { loadEquipments } from './storage';

export interface ExportDeductionsPDFOptions {
  periodLabel?: string;
  userName?: string;
  filterSummary?: string;
  equipments?: Equipment[];
}

export function exportDeductionsToPDF(
  deductions: MeasurementDeduction[],
  options: ExportDeductionsPDFOptions = {}
): void {
  // A4 Landscape orientation for rich multi-column reporting
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const allEquipments = options.equipments && options.equipments.length > 0
    ? options.equipments
    : (typeof window !== 'undefined' ? loadEquipments() : OFFICIAL_FLEET_DATA);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const today = new Date();
  const emissionDate = today.toLocaleDateString('pt-BR');
  const emissionTime = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // 1. Calculations & Aggregations
  const totalEquipments = new Set(deductions.map((d) => d.equipmentId || d.prefix)).size;
  const totalRecords = deductions.length;
  const totalStoppedDays = deductions.reduce((acc, d) => acc + (d.stoppedDays || 0), 0);
  const totalMeasurementValue = deductions.reduce((acc, d) => acc + (d.measurementValue || 0), 0);
  const totalDailyRates = deductions.reduce((acc, d) => acc + (d.dailyRate || 0), 0);
  const totalDiscount = deductions.reduce((acc, d) => acc + (d.discountValue || 0), 0);

  // Group by Supplier
  const supplierMap = new Map<string, { equipments: Set<string>; days: number; discount: number }>();
  deductions.forEach((d) => {
    const supp = d.supplier || 'Não Informado';
    if (!supplierMap.has(supp)) {
      supplierMap.set(supp, { equipments: new Set(), days: 0, discount: 0 });
    }
    const curr = supplierMap.get(supp)!;
    curr.equipments.add(d.prefix);
    curr.days += d.stoppedDays || 0;
    curr.discount += d.discountValue || 0;
  });

  // Group by Obra (Location)
  const obraMap = new Map<string, { equipments: Set<string>; days: number; discount: number }>();
  deductions.forEach((d) => {
    const loc = d.location || 'Não Informada';
    if (!obraMap.has(loc)) {
      obraMap.set(loc, { equipments: new Set(), days: 0, discount: 0 });
    }
    const curr = obraMap.get(loc)!;
    curr.equipments.add(d.prefix);
    curr.days += d.stoppedDays || 0;
    curr.discount += d.discountValue || 0;
  });

  // Ranking by Stopped Days
  const rankingList = [...deductions]
    .sort((a, b) => b.stoppedDays - a.stoppedDays)
    .slice(0, 5);

  // 2. Header Banner
  doc.setFillColor(21, 57, 91); // Makmo Navy #15395b
  doc.rect(0, 0, pageWidth, 28, 'F');

  const bannerLogo = getMakmoInfraestruturaBannerBase64();
  if (bannerLogo) {
    try {
      doc.addImage(bannerLogo, 'PNG', 12, 4, 54, 18);
    } catch (e) {
      console.warn('Could not insert Makmo logo in PDF:', e);
    }
  }

  const titleX = bannerLogo ? 70 : 14;

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('RELATÓRIO DE DESCONTO EM MEDIÇÃO', titleX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // Slate-300
  const subText = options.periodLabel
    ? `Período Analisado: ${options.periodLabel} • Apuração de Dias Parados e Deduções Contratuais`
    : `Apuração Oficial de Equipamentos Paralisados e Descontos em Medição`;
  doc.text(subText, titleX, 17);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(
    `Emissão: ${emissionDate} às ${emissionTime} • Responsável: ${options.userName || 'PCM / Medição'}`,
    titleX,
    22
  );

  // Status Badge in header top-right
  doc.setFillColor(32, 180, 167); // Makmo Teal
  doc.roundedRect(pageWidth - 62, 7, 50, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('AUDITORIA DE MEDIÇÃO', pageWidth - 37, 13, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`${totalRecords} registro(s) apurado(s)`, pageWidth - 37, 18, { align: 'center' });

  let currentY = 33;

  // 3. Resumo Executivo (Cards)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RESUMO EXECUTIVO', 12, currentY);

  currentY += 4;

  const cardWidth = (pageWidth - 24 - 16) / 5;
  const cardHeight = 16;
  const cards = [
    { label: 'EQUIPAMENTOS PARADOS', value: `${totalEquipments}`, sub: `${totalRecords} ocorrência(s)`, color: [225, 29, 72] },
    { label: 'TOTAL DIAS PARADOS', value: `${totalStoppedDays} dias`, sub: 'Tempo total acumulado', color: [217, 119, 6] },
    { label: 'VALOR TOTAL MEDIÇÃO', value: formatCurrencyBRL(totalMeasurementValue), sub: 'Base contratual', color: [15, 23, 42] },
    { label: 'VALOR TOTAL DIÁRIAS', value: formatCurrencyBRL(totalDailyRates), sub: 'Soma das diárias (÷30)', color: [2, 132, 199] },
    { label: 'TOTAL A DESCONTAR', value: formatCurrencyBRL(totalDiscount), sub: 'Dedução imediata', color: [16, 185, 129] },
  ];

  cards.forEach((c, idx) => {
    const cardX = 12 + idx * (cardWidth + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Left accent bar
    doc.setFillColor(c.color[0], c.color[1], c.color[2]);
    doc.rect(cardX, currentY, 2.5, cardHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, cardX + 5, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.value, cardX + 5, currentY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(c.sub, cardX + 5, currentY + 14);
  });

  currentY += cardHeight + 6;

  // 4. Detalhamento dos Descontos (Tabela Principal)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. DETALHAMENTO DE EQUIPAMENTOS PARADOS E DESCONTOS', 12, currentY);

  currentY += 3;

  const tableData = deductions.map((d) => {
    const startDateFormatted = formatDateDDMMAAAA(d.startDate);
    const endDateFormatted = d.isOngoing || !d.endDate ? 'Em aberto' : formatDateDDMMAAAA(d.endDate);
    const notesTrunc = d.notes ? (d.notes.length > 35 ? d.notes.substring(0, 33) + '...' : d.notes) : '-';

    // Resolução da Placa do Equipamento
    const prefix = d.prefix || '-';
    let plate = (d.plate && d.plate.trim() !== '' && d.plate !== '-') ? d.plate.trim() : '';

    if (!plate || plate === prefix) {
      const match =
        allEquipments.find(
          (eq) =>
            (d.equipmentId && eq.id === d.equipmentId) ||
            (d.prefix && eq.prefix && eq.prefix.toUpperCase() === d.prefix.toUpperCase()) ||
            (d.prefix && eq.code && eq.code.toUpperCase() === d.prefix.toUpperCase())
        ) ||
        OFFICIAL_FLEET_DATA.find(
          (eq) =>
            (d.equipmentId && eq.id === d.equipmentId) ||
            (d.prefix && eq.prefix && eq.prefix.toUpperCase() === d.prefix.toUpperCase()) ||
            (d.prefix && eq.code && eq.code.toUpperCase() === d.prefix.toUpperCase())
        );

      if (match?.plate && match.plate.trim() !== '' && match.plate !== '-') {
        plate = match.plate.trim();
      }
    }

    // Exibição de Prefixo e Placa
    let prefixPlateStr = prefix;
    if (plate && plate !== '-' && plate !== prefix) {
      prefixPlateStr = prefix !== '-' ? `${prefix}\n(${plate})` : plate;
    }

    return [
      prefixPlateStr,
      d.equipmentType || '-',
      d.supplier || '-',
      d.location || '-',
      formatCurrencyBRL(d.measurementValue),
      formatCurrencyBRL(d.dailyRate),
      startDateFormatted,
      endDateFormatted,
      `${d.stoppedDays} d`,
      formatCurrencyBRL(d.discountValue),
      d.reason || '-',
      d.status || '-',
      notesTrunc,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'PREFIXO / PLACA',
        'EQUIPAMENTO',
        'FORNECEDOR',
        'OBRA',
        'MEDIÇÃO',
        'DIÁRIA',
        'DATA INI.',
        'DATA FIM',
        'DIAS',
        'DESCONTO',
        'MOTIVO',
        'STATUS',
        'OBSERVAÇÃO',
      ],
    ],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: 1.6,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [21, 57, 91],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.6,
      halign: 'center',
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20, fontStyle: 'bold' }, // PREFIXO / PLACA
      1: { halign: 'left', cellWidth: 26 },                     // EQUIPAMENTO
      2: { halign: 'left', cellWidth: 23 },                     // FORNECEDOR
      3: { halign: 'left', cellWidth: 21 },                     // OBRA
      4: { halign: 'right', cellWidth: 22 },                    // MEDIÇÃO
      5: { halign: 'right', cellWidth: 20 },                    // DIÁRIA
      6: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },// DATA INI
      7: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },// DATA FIM
      8: { halign: 'center', cellWidth: 13, fontStyle: 'bold' },// DIAS
      9: { halign: 'right', cellWidth: 23, fontStyle: 'bold', textColor: [220, 38, 38] }, // DESCONTO
      10: { halign: 'left', cellWidth: 24 },                    // MOTIVO
      11: { halign: 'center', cellWidth: 21 },                  // STATUS
      12: { halign: 'left', cellWidth: 24 },                    // OBSERVAÇÃO
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawCell: (data) => {
      // Highlight Ongoing stoppage
      if (data.section === 'body' && data.column.index === 7) {
        if (String(data.cell.raw) === 'Em aberto') {
          data.cell.styles.textColor = [225, 29, 72];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 12, right: 12 },
  });

  // Position after main table
  // @ts-ignore
  let finalY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : currentY + 60;

  const boxHeight = 20;
  const bottomBoxY = pageHeight - boxHeight - 8; // 210 - 20 - 8 = 182mm (ancorado no final da folha)

  // Altura necessária para comportar Seção 3 + Seção 4 na mesma folha antes da Totalização
  const neededHeightForExecutiveSections = 68; // Seção 3 (~34mm) + Seção 4 (~28mm) + margens (~6mm)

  // Se o espaço restante na folha atual não for suficiente para enquadrar Seção 3 e Seção 4 juntas antes da totalização, cria nova folha
  if (finalY + neededHeightForExecutiveSections > bottomBoxY - 4) {
    doc.addPage('a4', 'landscape');
    finalY = 16;
  }

  // 5. Agrupamento para o Dashboard Evolução Mensal (Dias Parados & Valor de Descontos)
  const monthlyMap = new Map<
    string,
    { monthKey: string; monthLabel: string; days: number; discount: number; count: number }
  >();

  deductions.forEach((d) => {
    if (!d.startDate) return;
    const clean = d.startDate.split('T')[0];
    const parts = clean.split('-');
    if (parts.length < 2) return;
    const [year, month] = parts;
    const monthKey = `${year}-${month}`;
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mIndex = parseInt(month, 10) - 1;
    const monthShort = monthNames[mIndex] || month;
    const monthLabel = `${monthShort}/${year}`;

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { monthKey, monthLabel, days: 0, discount: 0, count: 0 });
    }
    const item = monthlyMap.get(monthKey)!;
    item.days += d.stoppedDays || 0;
    item.discount += d.discountValue || 0;
    item.count += 1;
  });

  const monthlyTrend = Array.from(monthlyMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  // Fallback caso não haja datas preenchidas
  if (monthlyTrend.length === 0 && deductions.length > 0) {
    const todayObj = new Date();
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const curLabel = `${monthNames[todayObj.getMonth()]}/${todayObj.getFullYear()}`;
    monthlyTrend.push({
      monthKey: 'atual',
      monthLabel: curLabel,
      days: totalStoppedDays,
      discount: totalDiscount,
      count: totalRecords,
    });
  }

  // Seção 3: Dashboard Evolução Mensal (Dias Parados & Valor de Descontos)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DASHBOARD EVOLUÇÃO MENSAL (DIAS PARADOS & VALOR DE DESCONTOS)', 12, finalY);

  finalY += 4;

  const chartX = 12;
  const chartY = finalY;
  const chartW = 126;
  const chartH = 34;

  // Container gráfico vetorial
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(chartX, chartY, chartW, chartH, 1.5, 1.5, 'FD');

  // Título e legenda do gráfico
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(30, 58, 138);
  doc.text('Acompanhamento Mensal: Dias vs. Descontos', chartX + 4, chartY + 5);

  // Legenda
  doc.setFillColor(13, 148, 136); // Teal-600
  doc.rect(chartX + 68, chartY + 2.5, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Dias Parados', chartX + 72, chartY + 4.5);

  doc.setFillColor(225, 29, 72); // Rose-600
  doc.rect(chartX + 96, chartY + 2.5, 2.5, 2.5, 'F');
  doc.text('Desconto (R$)', chartX + 100, chartY + 4.5);

  // Linha base do gráfico
  const baselineY = chartY + 27;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(chartX + 6, baselineY, chartX + chartW - 6, baselineY);

  const numMonths = monthlyTrend.length;
  const maxDays = Math.max(...monthlyTrend.map((m) => m.days), 1);
  const maxDiscount = Math.max(...monthlyTrend.map((m) => m.discount), 1);
  const availableBarH = 16; // Altura máxima da barra em mm
  const plotWidth = chartW - 16;
  const slotWidth = plotWidth / Math.max(numMonths, 1);
  const barWidth = Math.min(8, Math.max(3, slotWidth * 0.26));

  monthlyTrend.forEach((m, idx) => {
    const slotCenterX = chartX + 8 + (idx + 0.5) * slotWidth;

    // Barra 1: Dias Parados (Teal)
    const hDays = Math.max(1.5, (m.days / maxDays) * availableBarH);
    const xDays = slotCenterX - barWidth - 0.8;
    const yDays = baselineY - hDays;
    doc.setFillColor(13, 148, 136);
    doc.rect(xDays, yDays, barWidth, hDays, 'F');

    // Valor acima da barra 1
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.0);
    doc.setTextColor(13, 148, 136);
    doc.text(`${m.days}d`, xDays + barWidth / 2, yDays - 0.8, { align: 'center' });

    // Barra 2: Valor de Desconto (Rose)
    const hDisc = Math.max(1.5, (m.discount / maxDiscount) * availableBarH);
    const xDisc = slotCenterX + 0.8;
    const yDisc = baselineY - hDisc;
    doc.setFillColor(225, 29, 72);
    doc.rect(xDisc, yDisc, barWidth, hDisc, 'F');

    // Valor acima da barra 2
    const discK = m.discount >= 1000 ? `R$${(m.discount / 1000).toFixed(0)}k` : `R$${m.discount}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.0);
    doc.setTextColor(225, 29, 72);
    doc.text(discK, xDisc + barWidth / 2, yDisc - 0.8, { align: 'center' });

    // Rótulo do Mês abaixo da linha base
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(71, 85, 105);
    doc.text(m.monthLabel, slotCenterX, baselineY + 4, { align: 'center' });
  });

  // Tabela Analítica Mensal (Lado Direito)
  const tableX = chartX + chartW + 4;
  const tableW = pageWidth - 12 - tableX;

  const monthlyTableRows = monthlyTrend.map((m) => [
    m.monthLabel,
    `${m.count} ocorr.`,
    `${m.days} d`,
    formatCurrencyBRL(m.discount),
    formatCurrencyBRL(m.days > 0 ? m.discount / m.days : 0),
    `${totalDiscount > 0 ? ((m.discount / totalDiscount) * 100).toFixed(1) : '0.0'}%`,
  ]);

  const monthlyTableFoot = [
    [
      'TOTAL GERAL',
      `${totalRecords} ocorr.`,
      `${totalStoppedDays} d`,
      formatCurrencyBRL(totalDiscount),
      formatCurrencyBRL(totalStoppedDays > 0 ? totalDiscount / totalStoppedDays : 0),
      '100%',
    ],
  ];

  autoTable(doc, {
    startY: chartY,
    margin: { left: tableX, right: 12 },
    tableWidth: tableW,
    head: [['MÊS / ANO', 'OCORR.', 'DIAS PARADOS', 'VALOR DESCONTO', 'MÉDIA / DIA', 'PARTICIPAÇÃO']],
    body: monthlyTableRows,
    foot: monthlyTableFoot,
    theme: 'grid',
    styles: { fontSize: 6.0, cellPadding: 1.1, valign: 'middle' },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 5.8,
      halign: 'center',
      cellPadding: 1.4,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 6.0,
      cellPadding: 1.2,
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 22, textColor: [13, 148, 136] },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 28, textColor: [225, 29, 72] },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 21 },
    },
  });

  // Altura final da Seção 3
  // @ts-ignore
  const monthlyEndY = Math.max(chartY + chartH, doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 2 : chartY + chartH);
  let rankingY = monthlyEndY + 5;

  // Seção 4: Ranking e Resumos Executivos (3 Colunas)
  if (rankingY + 28 > bottomBoxY - 4) {
    doc.addPage('a4', 'landscape');
    rankingY = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('4. RANKING DE PARALISAÇÕES E RESUMOS POR FORNECEDOR / OBRA', 12, rankingY);

  rankingY += 4;

  const subColWidth = (pageWidth - 24 - 8) / 3;

  // Coluna A: Ranking de Equipamentos Parados (Top 5)
  const rankingData = rankingList.map((r, i) => [
    `${i + 1}º`,
    r.prefix,
    r.equipmentType,
    `${r.stoppedDays} d`,
    formatCurrencyBRL(r.discountValue),
  ]);

  let colAFinalY = rankingY + 24;
  let colBFinalY = rankingY + 24;
  let colCFinalY = rankingY + 24;

  autoTable(doc, {
    startY: rankingY,
    margin: { left: 12, right: pageWidth - 12 - subColWidth },
    tableWidth: subColWidth,
    head: [['#', 'PREFIXO', 'TIPO', 'DIAS', 'DESCONTO']],
    body: rankingData,
    theme: 'grid',
    pageBreak: 'avoid',
    styles: { fontSize: 6.2, cellPadding: 1.1, valign: 'middle' },
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.0, cellPadding: 1.4 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      2: { halign: 'left', cellWidth: 26 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      4: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
    },
  });
  // @ts-ignore
  colAFinalY = doc.lastAutoTable?.finalY || colAFinalY;

  // Coluna B: Resumo por Fornecedor (Top 5 ordenado por desconto + consolidado para enquadramento perfeito)
  const sortedSuppliers = Array.from(supplierMap.entries()).sort((a, b) => b[1].discount - a[1].discount);
  const displaySuppliers = sortedSuppliers.slice(0, 5);
  if (sortedSuppliers.length > 5) {
    const others = sortedSuppliers.slice(5);
    const otherEquips = new Set<string>();
    let otherDays = 0;
    let otherDiscount = 0;
    others.forEach(([, d]) => {
      d.equipments.forEach((eq) => otherEquips.add(eq));
      otherDays += d.days;
      otherDiscount += d.discount;
    });
    displaySuppliers.push([
      `Outros (${others.length})`,
      { equipments: otherEquips, days: otherDays, discount: otherDiscount },
    ]);
  }

  const supplierRows = displaySuppliers.map(([supp, data]) => [
    supp,
    `${data.equipments.size}`,
    `${data.days} d`,
    formatCurrencyBRL(data.discount),
  ]);

  autoTable(doc, {
    startY: rankingY,
    margin: { left: 12 + subColWidth + 4, right: 12 + subColWidth + 4 },
    tableWidth: subColWidth,
    head: [['FORNECEDOR', 'EQUIP.', 'DIAS PARADOS', 'VALOR DESCONTADO']],
    body: supplierRows,
    theme: 'grid',
    pageBreak: 'avoid',
    styles: { fontSize: 6.2, cellPadding: 1.1, valign: 'middle' },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.0, cellPadding: 1.4 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 32 },
      1: { halign: 'center', cellWidth: 14 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      3: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
    },
  });
  // @ts-ignore
  colBFinalY = doc.lastAutoTable?.finalY || colBFinalY;

  // Coluna C: Resumo por Obra (Top 5 ordenado por desconto + consolidado para enquadramento perfeito)
  const sortedObras = Array.from(obraMap.entries()).sort((a, b) => b[1].discount - a[1].discount);
  const displayObras = sortedObras.slice(0, 5);
  if (sortedObras.length > 5) {
    const others = sortedObras.slice(5);
    const otherEquips = new Set<string>();
    let otherDays = 0;
    let otherDiscount = 0;
    others.forEach(([, d]) => {
      d.equipments.forEach((eq) => otherEquips.add(eq));
      otherDays += d.days;
      otherDiscount += d.discount;
    });
    displayObras.push([
      `Outras (${others.length})`,
      { equipments: otherEquips, days: otherDays, discount: otherDiscount },
    ]);
  }

  const obraRows = displayObras.map(([loc, data]) => [
    loc,
    `${data.equipments.size}`,
    `${data.days} d`,
    formatCurrencyBRL(data.discount),
  ]);

  autoTable(doc, {
    startY: rankingY,
    margin: { left: 12 + (subColWidth + 4) * 2, right: 12 },
    tableWidth: subColWidth,
    head: [['OBRA / LOCAL', 'EQUIP.', 'DIAS PARADOS', 'VALOR DESCONTADO']],
    body: obraRows,
    theme: 'grid',
    pageBreak: 'avoid',
    styles: { fontSize: 6.2, cellPadding: 1.1, valign: 'middle' },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.0, cellPadding: 1.4 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 32 },
      1: { halign: 'center', cellWidth: 14 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      3: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
    },
  });
  // @ts-ignore
  colCFinalY = doc.lastAutoTable?.finalY || colCFinalY;

  // Determine bottom Y
  const maxSubY = Math.max(colAFinalY, colBFinalY, colCFinalY);

  // 6. TOTALIZAÇÃO GERAL (Sempre no Final Da Folha)
  // Se o conteúdo ultrapassar o limite antes do box no final da folha, adiciona uma nova página
  if (maxSubY > bottomBoxY - 4) {
    doc.addPage('a4', 'landscape');
  }

  const boxY = bottomBoxY;

  // Big highlight callout box (TOTALIZAÇÃO DA APURAÇÃO)
  doc.setFillColor(239, 246, 255); // Blue-50
  doc.setDrawColor(37, 99, 235); // Blue-600
  doc.roundedRect(12, boxY, pageWidth - 24, boxHeight, 2, 2, 'FD');

  doc.setFillColor(37, 99, 235);
  doc.rect(12, boxY, 4, boxHeight, 'F');

  // Left totals
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138); // Blue-900
  doc.text('TOTALIZAÇÃO DA APURAÇÃO:', 20, boxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`TOTAL GERAL DE DIAS PARADOS: ${totalStoppedDays} dias`, 20, boxY + 11);
  doc.text(
    `Fórmula: Diária = Medição ÷ 30 • Desconto = Diária × Dias Parados • Total Ocorrências: ${totalRecords}`,
    20,
    boxY + 16
  );

  // Right total highlight - O VALOR TOTAL A SER DESCONTADO DA MEDIÇÃO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(185, 28, 28); // Rose-700
  doc.text('VALOR TOTAL A SER DESCONTADO DA MEDIÇÃO:', pageWidth - 16, boxY + 7, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(220, 38, 38); // Rose-600
  doc.text(formatCurrencyBRL(totalDiscount), pageWidth - 16, boxY + 15, { align: 'right' });

  // 7. Page numbering & footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Makmo Infraestrutura • Módulo de Desconto em Medição • Documento Oficial de Auditoria Contratual`,
      12,
      pageHeight - 6
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 12, pageHeight - 6, { align: 'right' });
  }

  // Save the document
  const safeDate = emissionDate.replace(/\//g, '-');
  doc.save(`Relatorio_Desconto_Medicao_Makmo_${safeDate}.pdf`);
}
