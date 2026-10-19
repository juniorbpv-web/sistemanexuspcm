import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FuelEntry, FuelDispense, Equipment } from '../types';
import { formatDateBR, formatCurrency, formatLiters, formatHours, getTodayDateString } from './storage';
import { getMakmoCombustivelLogoBase64 } from './makmoLogoData';

/**
 * Exports Fuel Entries (Recebimento de Cargas) to a high-quality PDF
 * in the exact sequence as the table columns:
 * 1. Data
 * 2. Litros Recebidos
 * 3. Valor Total (R$)
 * 4. Fornecedor
 * 5. Nota Fiscal
 * 6. Destino
 * 7. Responsável
 * 8. Observações
 */
export function exportFuelEntriesToPDF(entries: FuelEntry[], filterInfo?: string): void {
  // Landscape orientation to fit all columns with generous spacing
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const todayStr = new Date().toLocaleDateString('pt-BR');
  const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Calculate totals
  const totalLiters = entries.reduce((acc, curr) => acc + (Number(curr.liters) || 0), 0);
  const totalValue = entries.reduce((acc, curr) => acc + (Number(curr.totalValue) || 0), 0);
  const avgPrice = totalLiters > 0 && totalValue > 0 ? totalValue / totalLiters : 0;

  // Header Banner in Corporate Deep Navy (#113861)
  doc.setFillColor(17, 56, 97);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Insert Makmo Combustível Circular Logo
  const logoDataUrl = getMakmoCombustivelLogoBase64();
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 14, 3, 20, 20);
    } catch (e) {
      console.warn('Could not render logo in PDF:', e);
    }
  }

  const textStartX = logoDataUrl ? 38 : 14;

  // Brand / Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('MAKMO INFRAESTRUTURA', textStartX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(32, 180, 167); // Makmo Teal #20b4a7
  doc.text('Relatório Oficial de Entradas de Diesel (Recebimento de Cargas)', textStartX, 18);

  // Emission info
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  const emitText = `Gerado em: ${todayStr} às ${nowTime}`;
  doc.text(emitText, pageWidth - 14, 11, { align: 'right' });

  if (filterInfo) {
    doc.text(filterInfo, pageWidth - 14, 18, { align: 'right' });
  }

  // Teal Accent Divider Stripe
  doc.setFillColor(32, 180, 167);
  doc.rect(0, 25, pageWidth, 1.2, 'F');

  // Summary Metrics Banner
  doc.setFillColor(240, 253, 250); // Light teal #f0fdfa
  doc.setDrawColor(32, 180, 167);
  doc.roundedRect(14, 30, pageWidth - 28, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 56, 97); // Makmo Navy

  const colW = (pageWidth - 28) / 4;
  
  // Metric 1: Total Cargas
  doc.text('Total de Cargas:', 18, 36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 56, 97);
  doc.text(`${entries.length} registro(s)`, 18, 41);

  // Metric 2: Litros Recebidos
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Volume Total Recebido:', 18 + colW, 36);
  doc.setTextColor(23, 138, 127); // Makmo Teal Dark
  doc.text(`${formatLiters(totalLiters)} L`, 18 + colW, 41);

  // Metric 3: Valor Total Investido
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Valor Total Financeiro:', 18 + colW * 2, 36);
  doc.setTextColor(17, 56, 97);
  doc.text(totalValue > 0 ? formatCurrency(totalValue) : 'Não informado', 18 + colW * 2, 41);

  // Metric 4: Preço Médio / L
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Preço Médio / Litro:', 18 + colW * 3, 36);
  doc.setTextColor(23, 138, 127);
  doc.text(avgPrice > 0 ? `R$ ${avgPrice.toFixed(2)}/L` : '-', 18 + colW * 3, 41);

  // Build Table Rows in EXACT sequence
  const tableData = entries.map((ent) => {
    const formattedDate = formatDateBR(ent.date);
    const litersStr = `+${formatLiters(ent.liters)} L`;
    const valStr = ent.totalValue !== undefined && ent.totalValue !== null
      ? `${formatCurrency(ent.totalValue)}${ent.liters > 0 ? `\n(R$ ${(ent.totalValue / ent.liters).toFixed(2)}/L)` : ''}`
      : '-';
    const supplierStr = ent.supplier || '-';
    const invoiceStr = ent.invoiceNumber || '-';
    const destinationStr = ent.destination || 'Tanque Central';
    const responsibleStr = ent.responsible || '-';
    const notesStr = ent.notes || '-';

    return [
      formattedDate,
      litersStr,
      valStr,
      supplierStr,
      invoiceStr,
      destinationStr,
      responsibleStr,
      notesStr,
    ];
  });

  // Table using jspdf-autotable
  autoTable(doc, {
    startY: 48,
    head: [[
      'Data',
      'Litros Recebidos',
      'Valor Total (R$)',
      'Fornecedor',
      'Nota Fiscal',
      'Destino',
      'Responsável',
      'Observações',
    ]],
    body: tableData,
    foot: [[
      'TOTAL ACUMULADO',
      `+${formatLiters(totalLiters)} L`,
      totalValue > 0 ? formatCurrency(totalValue) : '-',
      '-',
      '-',
      '-',
      '-',
      `${entries.length} carga(s) recebida(s)`,
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: [17, 56, 97], // Makmo Navy #113861
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    footStyles: {
      fillColor: [240, 253, 250],
      textColor: [17, 56, 97],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold', halign: 'center' }, // Data
      1: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: [23, 138, 127] }, // Litros
      2: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }, // Valor Total
      3: { cellWidth: 36 }, // Fornecedor
      4: { cellWidth: 26 }, // Nota Fiscal
      5: { cellWidth: 32 }, // Destino
      6: { cellWidth: 30 }, // Responsável
      7: { cellWidth: 'auto' }, // Observações
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageWidth - 14, doc.internal.pageSize.getHeight() - 7, { align: 'right' });
      doc.text(
        'Makmo Infraestrutura — Sistema de Controle de Combustível e Lubrificantes',
        14,
        doc.internal.pageSize.getHeight() - 7
      );
    },
  });

  const fileName = `makmo_entradas_diesel_${getTodayDateString()}.pdf`;
  doc.save(fileName);
}

/**
 * Builds Consolidated Dispenses (Abastecimentos dos Comboios) jsPDF document instance
 */
export function buildConsolidatedDispensesPDF(
  dispenses: FuelDispense[],
  equipments: Equipment[],
  filterInfo?: string,
  convoyFilter?: string
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const todayStr = new Date().toLocaleDateString('pt-BR');
  const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const totalLiters = dispenses.reduce((acc, curr) => acc + (Number(curr.liters) || 0), 0);

  // Header Banner in Corporate Deep Navy (#113861)
  doc.setFillColor(17, 56, 97);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Insert Makmo Combustível Circular Logo
  const logoDataUrl = getMakmoCombustivelLogoBase64();
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 14, 3, 20, 20);
    } catch (e) {
      console.warn('Could not render logo in PDF:', e);
    }
  }

  const textStartX = logoDataUrl ? 38 : 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('MAKMO INFRAESTRUTURA', textStartX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(32, 180, 167); // Makmo Teal #20b4a7
  doc.text(
    convoyFilter
      ? `Relatório de Saídas de Diesel • Comboio ${convoyFilter}`
      : 'Relatório Consolidado de Saídas de Diesel • Todos os Comboios',
    textStartX,
    18
  );

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Gerado em: ${todayStr} às ${nowTime}`, pageWidth - 14, 11, { align: 'right' });

  if (filterInfo) {
    doc.text(filterInfo, pageWidth - 14, 18, { align: 'right' });
  }

  // Teal Accent Divider Stripe
  doc.setFillColor(32, 180, 167);
  doc.rect(0, 25, pageWidth, 1.2, 'F');

  // Summary Metrics Banner
  doc.setFillColor(240, 253, 250); // Light teal #f0fdfa
  doc.setDrawColor(32, 180, 167);
  doc.roundedRect(14, 30, pageWidth - 28, 12, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 56, 97); // Makmo Navy
  doc.text(`Total de Abastecimentos: ${dispenses.length} registro(s)`, 18, 37.5);
  doc.setTextColor(23, 138, 127); // Makmo Teal Dark
  doc.text(`Subtotal Geral Dispensado: ${formatLiters(totalLiters)} L`, pageWidth / 2, 37.5);

  const tableData = dispenses.map((disp) => {
    const equip = equipments.find(
      (eq) =>
        (eq.plate && eq.plate.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase()) ||
        eq.code.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase() ||
        (eq.prefix && eq.prefix.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase())
    );
    const equipObra = disp.location || equip?.location || 'Não informada';
    const equipSupplier = disp.supplier || equip?.supplier || '-';
    const displayPlate = equip?.plate || disp.equipmentCode;

    const meterStr = disp.equipmentMeter !== undefined && !isNaN(disp.equipmentMeter)
      ? `${formatHours(disp.equipmentMeter)} ${disp.equipmentMeterUnit === 'KM' ? 'km' : 'h'}`
      : '-';

    return [
      formatDateBR(disp.date),
      disp.convoyPlate,
      `${displayPlate}${equip?.prefix && equip.prefix !== displayPlate ? ` (${equip.prefix})` : ''}`,
      disp.equipmentType || '-',
      equipSupplier,
      equipObra,
      meterStr,
      formatHours(disp.initialMeter),
      formatHours(disp.finalMeter),
      `${formatLiters(disp.liters)} L`,
      disp.operator || '-',
      disp.notes || '-',
    ];
  });

  autoTable(doc, {
    startY: 46,
    head: [[
      'Data',
      'Comboio',
      'Placa da Máquina',
      'Tipo',
      'Fornecedor',
      'Obra',
      'Horímetro/KM',
      'Iniciante',
      'Encerrante',
      'Litros (L)',
      'Operador/Resp.',
      'Observações',
    ]],
    body: tableData,
    foot: [[
      'SUBTOTAL',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      `${formatLiters(totalLiters)} L`,
      '-',
      `${dispenses.length} abastecimento(s)`,
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: [17, 56, 97], // Makmo Navy #113861
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      cellPadding: 1.8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    footStyles: {
      fillColor: [240, 253, 250], // Light Teal #f0fdfa
      textColor: [17, 56, 97], // Makmo Navy
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' }, // Data
      1: { cellWidth: 22, fontStyle: 'bold' }, // Comboio
      2: { cellWidth: 28, fontStyle: 'bold', textColor: [17, 56, 97] }, // Placa
      3: { cellWidth: 22 }, // Tipo
      4: { cellWidth: 24 }, // Fornecedor
      5: { cellWidth: 28 }, // Obra
      6: { cellWidth: 24, halign: 'right' }, // Horímetro
      7: { cellWidth: 18, halign: 'right' }, // Iniciante
      8: { cellWidth: 18, halign: 'right' }, // Encerrante
      9: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [23, 138, 127] }, // Litros
      10: { cellWidth: 24 }, // Operador
      11: { cellWidth: 'auto' }, // Observações
    },
    didDrawPage: (data) => {
      const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageWidth - 14, doc.internal.pageSize.getHeight() - 7, { align: 'right' });
      doc.text(
        'Makmo Infraestrutura — Histórico Consolidado de Abastecimentos',
        14,
        doc.internal.pageSize.getHeight() - 7
      );
    },
  });

  return doc;
}

/**
 * Exports Consolidated Dispenses (Abastecimentos dos Comboios) to a high-quality PDF
 */
export function exportConsolidatedDispensesToPDF(
  dispenses: FuelDispense[],
  equipments: Equipment[],
  filterInfo?: string,
  convoyFilter?: string
): void {
  const doc = buildConsolidatedDispensesPDF(dispenses, equipments, filterInfo, convoyFilter);
  const fileName = `makmo_abastecimentos_${convoyFilter ? `${convoyFilter}_` : 'consolidado_'}${getTodayDateString()}.pdf`;
  doc.save(fileName);
}
