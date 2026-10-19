import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CorrectiveMaintenance, Equipment } from '../types';
import { getMakmoInfraestruturaBannerBase64 } from './makmoLogoData';
import { formatDateBR } from './storage';

export interface ExportCorrectivesPDFOptions {
  periodLabel?: string;
  userName?: string;
  filterSummary?: string;
  includePhotos?: boolean;
  equipments?: Equipment[];
}

export function exportCorrectivesToPDF(
  records: CorrectiveMaintenance[],
  options: ExportCorrectivesPDFOptions = {}
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const today = new Date();
  const emissionDate = today.toLocaleDateString('pt-BR');
  const emissionTime = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Helper to resolve plate instead of prefix
  const getRecordPlate = (r: CorrectiveMaintenance): string => {
    if (r.plate && r.plate.trim() !== '') return r.plate.trim();
    if (options.equipments && options.equipments.length > 0) {
      const eq = options.equipments.find(
        (e) =>
          (r.equipmentId && e.id === r.equipmentId) ||
          (r.prefix && (e.prefix === r.prefix || e.code === r.prefix)) ||
          (r.plate && (e.plate === r.plate || e.code === r.plate))
      );
      if (eq?.plate && eq.plate.trim() !== '') return eq.plate.trim();
    }
    return r.prefix || 'S/ Placa';
  };

  // 1. Calculations & Metrics
  const totalRecords = records.length;
  const uniqueEquipments = new Set(records.map((r) => getRecordPlate(r))).size;
  const uniqueSuppliers = new Set(records.map((r) => r.supplier).filter(Boolean)).size;
  const totalStoppedDays = records.reduce((acc, r) => acc + (r.stoppedDays || 0), 0);
  const completedRecords = records.filter((r) => r.status === 'Concluída').length;
  const openRecords = records.filter(
    (r) =>
      r.status === 'Aberta' ||
      r.status === 'Em Análise' ||
      r.status === 'Em manutenção' ||
      r.status === 'Aguardando peça' ||
      r.status === 'Aguardando fornecedor'
  ).length;

  // Equipment Ranking (by Plate)
  const equipCountMap = new Map<string, { plate: string; count: number; days: number; type: string; supplier: string }>();
  records.forEach((r) => {
    const plt = getRecordPlate(r);
    if (!equipCountMap.has(plt)) {
      equipCountMap.set(plt, { plate: plt, count: 0, days: 0, type: r.equipmentType || '', supplier: r.supplier || '' });
    }
    const item = equipCountMap.get(plt)!;
    item.count += 1;
    item.days += r.stoppedDays || 0;
  });
  const topEquipments = Array.from(equipCountMap.values())
    .sort((a, b) => b.count - a.count || b.days - a.days)
    .slice(0, 5);

  // Supplier Ranking
  const supplierCountMap = new Map<string, { count: number; days: number; equipSet: Set<string> }>();
  records.forEach((r) => {
    const supp = r.supplier || 'Não inf.';
    if (!supplierCountMap.has(supp)) {
      supplierCountMap.set(supp, { count: 0, days: 0, equipSet: new Set() });
    }
    const item = supplierCountMap.get(supp)!;
    item.count += 1;
    item.days += r.stoppedDays || 0;
    item.equipSet.add(getRecordPlate(r));
  });
  const topSuppliers = Array.from(supplierCountMap.entries())
    .map(([supplier, d]) => ({ supplier, count: d.count, days: d.days, equips: d.equipSet.size }))
    .sort((a, b) => b.count - a.count || b.days - a.days)
    .slice(0, 5);

  // Failures breakdown
  const failureCountMap = new Map<string, number>();
  records.forEach((r) => {
    const f = r.failureType || 'Outro';
    failureCountMap.set(f, (failureCountMap.get(f) || 0) + 1);
  });
  const topFailures = Array.from(failureCountMap.entries())
    .map(([type, count]) => ({ type, count, pct: totalRecords > 0 ? (count / totalRecords) * 100 : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 2. Header Banner
  doc.setFillColor(21, 57, 91); // Makmo Navy #15395b
  doc.rect(0, 0, pageWidth, 26, 'F');

  const bannerLogo = getMakmoInfraestruturaBannerBase64();
  if (bannerLogo) {
    try {
      doc.addImage(bannerLogo, 'PNG', 12, 3.5, 52, 19);
    } catch (e) {
      console.warn('Could not insert Makmo logo in PDF:', e);
    }
  }

  const titleX = bannerLogo ? 68 : 14;

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('RELATÓRIO DE MANUTENÇÕES CORRETIVAS REALIZADAS (PCM)', titleX, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const subText = options.periodLabel
    ? `Período Analisado: ${options.periodLabel} • Histórico Operacional de Falhas, Serviços e Dias Parados`
    : `Histórico Operacional de Falhas, Peças Substituídas e Dias Parados`;
  doc.text(subText, titleX, 16);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Emissão: ${emissionDate} às ${emissionTime} • PCM Makmo Infraestrutura${options.filterSummary ? ` • Filtros: ${options.filterSummary}` : ''}`,
    titleX,
    21
  );

  // 3. KPI Cards Strip
  const cardY = 30;
  const cardHeight = 15;
  const numCards = 6;
  const marginX = 14;
  const cardGap = 4;
  const totalCardsWidth = pageWidth - marginX * 2;
  const cardWidth = (totalCardsWidth - cardGap * (numCards - 1)) / numCards;

  const kpis = [
    { label: 'TOTAL CORRETIVAS', val: `${totalRecords} O.S.`, color: [30, 41, 59] },
    { label: 'EQUIPAMENTOS', val: `${uniqueEquipments} unid.`, color: [14, 116, 144] },
    { label: 'FORNECEDORES', val: `${uniqueSuppliers} emp.`, color: [109, 40, 217] },
    { label: 'DIAS PARADOS', val: `${totalStoppedDays} dias`, color: [225, 29, 72] },
    { label: 'O.S. CONCLUÍDAS', val: `${completedRecords}`, color: [16, 185, 129] },
    { label: 'O.S. EM ABERTO', val: `${openRecords}`, color: [234, 88, 12] },
  ];

  kpis.forEach((k, idx) => {
    const x = marginX + idx * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'FD');

    // Accent line at bottom
    doc.setFillColor(k.color[0], k.color[1], k.color[2]);
    doc.rect(x, cardY + cardHeight - 1.5, cardWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, x + 3, cardY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(k.color[0], k.color[1], k.color[2]);
    doc.text(k.val, x + 3, cardY + 11.5);
  });

  // 4. Compact Summary Tables: Equipments Ranking & Failures Recurrence
  const summaryY = cardY + cardHeight + 4;
  
  // Left: Top Equipments table
  autoTable(doc, {
    startY: summaryY,
    margin: { left: 14, right: pageWidth / 2 + 3 },
    theme: 'grid',
    head: [['RANKING EQUIPAMENTOS COM MAIS O.S. (PLACA)', 'TIPO', 'O.S.', 'DIAS']],
    body: topEquipments.length > 0 ? topEquipments.map((e, idx) => [
      `${idx + 1}º ${e.plate}`,
      e.type,
      `${e.count} O.S.`,
      `${e.days} d`,
    ]) : [['Nenhum registro', '-', '-', '-']],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42 },
      1: { cellWidth: 50 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 20 },
    },
  });

  // Right: Top Failures & Suppliers
  autoTable(doc, {
    startY: summaryY,
    margin: { left: pageWidth / 2 + 3, right: 14 },
    theme: 'grid',
    head: [['FALHAS MAIS RECORRENTES', 'QTD O.S.', '% TOTAL', 'FORNECEDOR DESTAQUE']],
    body: topFailures.length > 0 ? topFailures.map((f, idx) => {
      const topSupp = topSuppliers[idx]?.supplier || '-';
      return [
        f.type,
        `${f.count} O.S.`,
        `${f.pct.toFixed(0)}%`,
        topSupp,
      ];
    }) : [['Nenhuma falha registrada', '-', '-', '-']],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 20 },
      3: { cellWidth: 42 },
    },
  });

  // 5. Main Table: Detalhes das Corretivas Realizadas
  const lastTableFinalY = (doc as any).lastAutoTable.finalY || 80;
  const mainTableY = Math.max(lastTableFinalY + 5, 80);

  const tableRows = records.map((r) => [
    r.osNumber || '-',
    r.openDate ? r.openDate.split('-').reverse().join('/') : '-',
    r.completionDate ? r.completionDate.split('-').reverse().join('/') : (r.status === 'Concluída' ? 'Sim' : 'Em andamento'),
    getRecordPlate(r),
    r.equipmentType || '-',
    r.supplier || '-',
    r.location || '-',
    `${r.failureType || ''}${r.affectedSystem ? `\n• ${r.affectedSystem}` : ''}`,
    r.servicePerformed || r.problemDescription || '-',
    r.mechanic || '-',
    `${r.stoppedDays ?? 0} d`,
    r.status || '-',
  ]);

  autoTable(doc, {
    startY: mainTableY,
    margin: { left: 14, right: 14, bottom: 12 },
    theme: 'grid',
    head: [[
      'Nº O.S.',
      'ABERTURA',
      'CONCLUSÃO',
      'PLACA',
      'EQUIPAMENTO',
      'FORNECEDOR',
      'OBRA',
      'FALHA / COMPONENTE',
      'SERVIÇO REALIZADO',
      'MECÂNICO',
      'PARADO',
      'STATUS',
    ]],
    body: tableRows,
    styles: {
      fontSize: 6.5,
      cellPadding: 1.8,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [21, 57, 91],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 7,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 18 },
      1: { cellWidth: 16 },
      2: { cellWidth: 18 },
      3: { fontStyle: 'bold', cellWidth: 16 },
      4: { cellWidth: 26 },
      5: { cellWidth: 24 },
      6: { cellWidth: 20 },
      7: { cellWidth: 40 },
      8: { cellWidth: 44 },
      9: { cellWidth: 22 },
      10: { halign: 'center', fontStyle: 'bold', cellWidth: 13 },
      11: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Color status badge column
      if (data.section === 'body' && data.column.index === 11) {
        const val = String(data.cell.raw);
        if (val === 'Concluída') {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (val === 'Em Análise') {
          data.cell.styles.textColor = [2, 132, 199];
        } else if (val === 'Aberta' || val === 'Em manutenção') {
          data.cell.styles.textColor = [234, 88, 12];
        } else if (val.includes('Aguardando')) {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
    },
  });

  // 6. Optional Photo Annex Section
  if (options.includePhotos) {
    const recordsWithPhotos = records.filter((r) => r.photos && r.photos.length > 0);
    if (recordsWithPhotos.length > 0) {
      doc.addPage();

      // Header for Photo Annex
      doc.setFillColor(21, 57, 91);
      doc.rect(0, 0, pageWidth, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text('ANEXO FOTOGRÁFICO DE EVIDÊNCIAS TÉCNICAS (CORRETIVAS)', 14, 12);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`Total de registros fotográficos anexados: ${recordsWithPhotos.reduce((a, r) => a + r.photos.length, 0)} imagens`, 14, 17);

      let photoX = 14;
      let photoY = 28;
      const photoWidth = 82;
      const photoHeight = 54;
      const photoMargin = 6;

      recordsWithPhotos.forEach((rec) => {
        rec.photos.forEach((photo) => {
          // Check if space on current page
          if (photoY + photoHeight + 16 > pageHeight) {
            doc.addPage();
            photoX = 14;
            photoY = 20;
          }

          // Photo Frame Box
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(203, 213, 225);
          doc.roundedRect(photoX, photoY, photoWidth, photoHeight + 14, 2, 2, 'FD');

          // Render image
          if (photo.dataUrl && photo.dataUrl.startsWith('data:image')) {
            try {
              // Supports JPEG, PNG, SVG
              const format = photo.dataUrl.includes('png') ? 'PNG' : (photo.dataUrl.includes('svg') ? 'PNG' : 'JPEG');
              doc.addImage(photo.dataUrl, format, photoX + 2, photoY + 2, photoWidth - 4, photoHeight - 4);
            } catch (err) {
              doc.setFillColor(226, 232, 240);
              doc.rect(photoX + 2, photoY + 2, photoWidth - 4, photoHeight - 4, 'F');
              doc.setFontSize(8);
              doc.setTextColor(100, 116, 139);
              doc.text('Imagem Anexada', photoX + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
            }
          }

          // Photo Caption
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(30, 41, 59);
          doc.text(`${rec.osNumber} • ${getRecordPlate(rec)} (${rec.equipmentType})`, photoX + 3, photoY + photoHeight + 4);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(100, 116, 139);
          const caption = photo.name || rec.failureType || 'Evidência fotográfica';
          doc.text(caption.length > 45 ? caption.substring(0, 42) + '...' : caption, photoX + 3, photoY + photoHeight + 9);

          // Advance grid
          photoX += photoWidth + photoMargin;
          if (photoX + photoWidth > pageWidth - 14) {
            photoX = 14;
            photoY += photoHeight + 14 + photoMargin;
          }
        });
      });
    }
  }

  // Add Page Numbers and Footers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Makmo Infraestrutura • Sistema de Gestão de Frotas e Obras (PCM Corretivas) • Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Save the PDF
  const todayStr = today.toISOString().split('T')[0];
  doc.save(`makmo_relatorio_corretivas_pcm_${todayStr}.pdf`);
}
