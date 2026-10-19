import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipment } from '../types';
import { formatDateBR, getTodayDateString, formatHours } from './storage';
import { getMakmoInfraestruturaBannerBase64 } from './makmoLogoData';

/**
 * Normalizes date display format to DD/MM/AAAA
 */
export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return '-';
  const clean = dateStr.trim();
  // If already DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  // If YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const [y, m, d] = clean.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }
  return formatDateBR(clean);
}

/**
 * Exports equipments list to professional Excel (.xlsx) file
 * Sequence: Equipamento, Placa, Prefixo, Modelo, Marca, Fornecedor, Obra, Chassi, Data de Desmobilização
 */
export async function exportEquipmentsToExcel(
  equipments: Equipment[],
  obraLabel = 'Geral'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Makmo Gestão de Frotas';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Base de Equipamentos', {
    views: [{ showGridLines: true }],
  });

  // Title Row
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `MAKMO INFRAESTRUTURA • BASE DE DADOS DE EQUIPAMENTOS - ${obraLabel.toUpperCase()}`;
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 30;

  // Subtitle info
  sheet.mergeCells('A2:I2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Data de emissão: ${formatDateBR(getTodayDateString())} | Total de máquinas: ${equipments.length}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF4B5563' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 18;

  // Header Row - Sequence:
  // 1. Equipamento, 2. Placa, 3. Prefixo, 4. Modelo, 5. Marca, 6. Fornecedor, 7. Obra, 8. Chassi, 9. Data de Mobilização, 10. Data de Desmobilização
  const headers = [
    'Equipamento',
    'Placa',
    'Prefixo',
    'Modelo',
    'Marca',
    'Fornecedor',
    'Obra',
    'Chassi',
    'Data de Mobilização',
    'Data de Desmobilização',
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF113861' }, // Makmo Navy #113861
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      bottom: { style: 'medium', color: { argb: 'FF20B4A7' } }, // Makmo Teal
      right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
    };
  });

  // Data Rows
  equipments.forEach((eq, idx) => {
    const row = sheet.addRow([
      eq.type || '-',
      eq.plate || '-',
      eq.prefix || eq.code || '-',
      eq.model || (eq.brandModel ? eq.brandModel : '-'),
      eq.brand || '-',
      eq.supplier || 'Frota Própria',
      eq.location || '-',
      eq.chassis || '-',
      formatDisplayDate(eq.mobilizationDate),
      formatDisplayDate(eq.demobilizationDate),
    ]);

    row.height = 20;
    const isEven = idx % 2 === 0;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 2 || colNumber === 3 || colNumber === 8 || colNumber === 9 || colNumber === 10 ? 'center' : 'left',
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF9FAFB' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });

  // Adjust column widths
  sheet.columns = [
    { width: 28 }, // 1. Equipamento
    { width: 14 }, // 2. Placa
    { width: 14 }, // 3. Prefixo
    { width: 22 }, // 4. Modelo
    { width: 20 }, // 5. Marca
    { width: 24 }, // 6. Fornecedor
    { width: 20 }, // 7. Obra
    { width: 24 }, // 8. Chassi
    { width: 24 }, // 9. Data de Desmobilização
  ];

  // Write and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeObra = obraLabel.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
  a.download = `Equipamentos_${safeObra}_${getTodayDateString()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ExportEquipmentsPDFOptions {
  obraLabel?: string;
  userName?: string;
  action?: 'download' | 'print' | 'preview';
}

/**
 * Exports equipments list to professional PDF file calibrated specifically for A4 Landscape printing (297mm x 210mm)
 * - Safe printable margins (10mm left, 10mm right, 14mm bottom)
 * - Column widths strictly calibrated to 277mm usable width (no overflow, no column truncation)
 * - Corporate Makmo header with official logo banner
 * - KPI summary cards on page 1 (Total Máquinas, Frota Própria, Locados, Horímetro Total Acumulado)
 * - Multi-page support with repeated headers (`showHead: 'everyPage'`) and avoidance of mid-row splits (`rowPageBreak: 'avoid'`)
 * - Two-pass footer with accurate page numbers "Página X de Y" and corporate standard disclaimer
 * - Direct print mode support (action: 'print')
 */
export function exportEquipmentsToPDF(
  equipments: Equipment[],
  obraLabel = 'Todas as Obras (Visão Global)',
  options?: ExportEquipmentsPDFOptions
): string | void {
  const action = options?.action || 'download';
  const userName = options?.userName || 'Administrador do Sistema';
  const effectiveObra = options?.obraLabel || obraLabel;

  // A4 Landscape: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const today = new Date();
  const todayStr = today.toLocaleDateString('pt-BR');
  const nowTime = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Official Makmo Brand Palette
  const BRAND_NAVY: [number, number, number] = [17, 56, 97]; // #113861
  const BRAND_TEAL: [number, number, number] = [32, 180, 167]; // #20b4a7
  const BRAND_GRAY_TEXT: [number, number, number] = [100, 116, 139]; // Slate 500

  // Metrics calculation
  const totalEquipments = equipments.length;
  const frotaPropria = equipments.filter(
    (e) => !e.supplier || e.supplier.trim() === '' || e.supplier.toLowerCase().includes('própria')
  ).length;
  const frotaLocada = totalEquipments - frotaPropria;
  const totalHours = equipments.reduce((acc, eq) => acc + (Number(eq.currentHourMeter) || 0), 0);
  const activeCount = equipments.filter((e) => !e.demobilizationDate).length;

  // 1. Corporate Header Banner (0 - 22mm)
  doc.setFillColor(...BRAND_NAVY);
  doc.rect(0, 0, pageWidth, 22, 'F');

  // Insert Makmo Infraestrutura Logo Banner
  const bannerLogo = getMakmoInfraestruturaBannerBase64();
  if (bannerLogo) {
    try {
      doc.addImage(bannerLogo, 'PNG', 10, 3, 50, 16);
    } catch {
      // Fallback
    }
  }

  const titleX = bannerLogo ? 64 : 10;

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('MAKMO INFRAESTRUTURA • BASE DE DADOS DE EQUIPAMENTOS', titleX, 10);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_TEAL);
  doc.text(
    `Relatório Oficial de Frota & Cadastro Técnico • Impressão Formato A4 • ${effectiveObra.toUpperCase()}`,
    titleX,
    16
  );

  // Emission Metadata on Right
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`Emissão: ${todayStr} às ${nowTime}`, pageWidth - 10, 9.5, { align: 'right' });
  doc.setTextColor(203, 213, 225);
  doc.text(`Emitido por: ${userName}`, pageWidth - 10, 14.5, { align: 'right' });
  doc.setTextColor(...BRAND_TEAL);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${totalEquipments} equipamentos`, pageWidth - 10, 19, { align: 'right' });

  // Teal divider accent line
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(0, 22, pageWidth, 1.2, 'F');

  // 2. Summary KPI Strip on Page 1 (25mm to 36mm)
  const kpiY = 25;
  const kpiHeight = 10.5;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.roundedRect(10, kpiY, 277, kpiHeight, 1.5, 1.5, 'FD');

  const cardW = 277 / 4;

  // KPI 1: Total Equipamentos
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...BRAND_GRAY_TEXT);
  doc.text('TOTAL DE EQUIPAMENTOS', 14, kpiY + 4);
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND_NAVY);
  doc.text(`${totalEquipments} cadastrados (${activeCount} ativos)`, 14, kpiY + 8.5);

  // KPI 2: Frota Própria
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...BRAND_GRAY_TEXT);
  doc.text('FROTA PRÓPRIA', 14 + cardW, kpiY + 4);
  doc.setFontSize(9.5);
  doc.setTextColor(16, 185, 129); // Emerald 600
  doc.text(`${frotaPropria} máquinas (${totalEquipments > 0 ? Math.round((frotaPropria / totalEquipments) * 100) : 0}%)`, 14 + cardW, kpiY + 8.5);

  // KPI 3: Locados / Terceiros
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...BRAND_GRAY_TEXT);
  doc.text('LOCADOS / TERCEIROS', 14 + cardW * 2, kpiY + 4);
  doc.setFontSize(9.5);
  doc.setTextColor(217, 119, 6); // Amber 600
  doc.text(`${frotaLocada} máquinas (${totalEquipments > 0 ? Math.round((frotaLocada / totalEquipments) * 100) : 0}%)`, 14 + cardW * 2, kpiY + 8.5);

  // KPI 4: Horímetro Acumulado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...BRAND_GRAY_TEXT);
  doc.text('HORÍMETRO TOTAL ACUMULADO', 14 + cardW * 3, kpiY + 4);
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND_NAVY);
  doc.text(`${formatHours(totalHours)} h`, 14 + cardW * 3, kpiY + 8.5);

  // Table Data - Exactly calibrated to 277mm printable width (10mm left + 10mm right margin)
  const head = [
    [
      '#',
      'Equipamento',
      'Placa',
      'Prefixo',
      'Modelo',
      'Marca',
      'Fornecedor',
      'Obra',
      'Chassi',
      'Mobilização',
      'Desmobilização',
      'Horímetro (h)',
    ],
  ];

  const body = equipments.map((eq, idx) => [
    String(idx + 1),
    eq.type || '-',
    eq.plate || '-',
    eq.prefix || eq.code || '-',
    eq.model || (eq.brandModel ? eq.brandModel : '-'),
    eq.brand || '-',
    eq.supplier || 'Frota Própria',
    eq.location || '-',
    eq.chassis || '-',
    formatDisplayDate(eq.mobilizationDate),
    formatDisplayDate(eq.demobilizationDate),
    eq.currentHourMeter !== undefined && eq.currentHourMeter !== null && String(eq.currentHourMeter).trim() !== ''
      ? formatHours(Number(eq.currentHourMeter))
      : '-',
  ]);

  autoTable(doc, {
    startY: 38,
    margin: { left: 10, right: 10, top: 13, bottom: 14 },
    head,
    body,
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      fontSize: 7.2,
      cellPadding: { top: 1.8, bottom: 1.8, left: 1.2, right: 1.2 },
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: BRAND_NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5,
      cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8, fontStyle: 'normal', textColor: [100, 116, 139] }, // #
      1: { halign: 'left', cellWidth: 32, fontStyle: 'bold' }, // Equipamento
      2: { halign: 'center', cellWidth: 20, fontStyle: 'bold' }, // Placa
      3: { halign: 'center', cellWidth: 18, fontStyle: 'bold' }, // Prefixo
      4: { halign: 'left', cellWidth: 27 }, // Modelo
      5: { halign: 'left', cellWidth: 24 }, // Marca
      6: { halign: 'left', cellWidth: 30 }, // Fornecedor
      7: { halign: 'left', cellWidth: 24 }, // Obra
      8: { halign: 'center', cellWidth: 28, fontSize: 6.8 }, // Chassi
      9: { halign: 'center', cellWidth: 22 }, // Mobilização
      10: { halign: 'center', cellWidth: 22 }, // Desmobilização
      11: { halign: 'right', cellWidth: 22, fontStyle: 'bold' }, // Horímetro (h)
    },
    didDrawPage: (data) => {
      // Mini-header for pages 2+
      if (data.pageNumber > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...BRAND_NAVY);
        doc.text(
          `MAKMO INFRAESTRUTURA • BASE DE DADOS DE EQUIPAMENTOS • ${effectiveObra.toUpperCase()} (Continuação)`,
          10,
          8
        );
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...BRAND_GRAY_TEXT);
        doc.text(`Emissão: ${todayStr}`, 287, 8, { align: 'right' });
        doc.setDrawColor(...BRAND_TEAL);
        doc.setLineWidth(0.3);
        doc.line(10, 9.5, 287, 9.5);
      }
    },
  });

  // Second Pass: Footer with accurate Total Page Count and Print Margin Protection
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Safe dividing line at y = 199mm
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(10, 199, 287, 199);

    // Footer description & page count at y = 203.5mm
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND_GRAY_TEXT);
    doc.text(
      'Makmo Infraestrutura • Base de Dados de Equipamentos • Documento Oficial Formatado para Folha A4 Paisagem (297 x 210 mm)',
      10,
      203.5
    );
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Página ${i} de ${totalPages}`,
      287,
      203.5,
      { align: 'right' }
    );
  }

  const safeObra = effectiveObra.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
  const filename = `Equipamentos_${safeObra}_${getTodayDateString()}.pdf`;

  if (action === 'print') {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.open(blobUrl, '_blank');
        }
      }, 300);
    };
    return blobUrl;
  }

  if (action === 'preview') {
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  }

  // Default: download file
  doc.save(filename);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

/**
 * Parses uploaded Excel or CSV file to import equipments with Chassi and Desmobilizacao
 */
export async function parseEquipmentsFromExcel(
  file: File,
  defaultLocation?: string
): Promise<Array<Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>>> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Nenhuma planilha encontrada no arquivo Excel.');
  }

  const result: Array<Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>> = [];

  // Identify column indices based on header row
  let headerRowIndex = 1;
  let colEquip = -1;
  let colPlaca = -1;
  let colPrefixo = -1;
  let colModelo = -1;
  let colMarca = -1;
  let colFornecedor = -1;
  let colObra = -1;
  let colChassi = -1;
  let colMob = -1;
  let colDesmob = -1;
  let colHorimetro = -1;

  worksheet.eachRow((row, rowNumber) => {
    if (headerRowIndex === 1) {
      const values = row.values as Array<any>;
      const hasKeywords = values.some(
        (v) =>
          typeof v === 'string' &&
          /equipamento|placa|prefixo|modelo|marca|fornecedor|obra|chassi/i.test(v)
      );
      if (hasKeywords) {
        headerRowIndex = rowNumber;
        values.forEach((v, idx) => {
          if (typeof v === 'string') {
            const low = v.toLowerCase();
            if (low.includes('equipamento') || low.includes('tipo')) colEquip = idx;
            else if (low.includes('placa')) colPlaca = idx;
            else if (low.includes('prefixo') || low.includes('código') || low.includes('codigo')) colPrefixo = idx;
            else if (low.includes('modelo')) colModelo = idx;
            else if (low.includes('marca')) colMarca = idx;
            else if (low.includes('fornecedor') || low.includes('locador')) colFornecedor = idx;
            else if (low.includes('obra') || low.includes('local')) colObra = idx;
            else if (low.includes('chassi')) colChassi = idx;
            else if (low.includes('desmobiliza') || low.includes('desmobilização')) colDesmob = idx;
            else if (low.includes('mobiliza') || low.includes('mobilização')) colMob = idx;
            else if (low.includes('horímetro') || low.includes('horimetro')) colHorimetro = idx;
          }
        });
        return;
      }
    }

    if (rowNumber > headerRowIndex) {
      const rowVals = row.values as Array<any>;
      const rawType = colEquip > -1 ? String(rowVals[colEquip] || '').trim() : '';
      const rawPlate = colPlaca > -1 ? String(rowVals[colPlaca] || '').trim().toUpperCase() : '';
      const rawPrefix = colPrefixo > -1 ? String(rowVals[colPrefixo] || '').trim().toUpperCase() : '';
      const rawModel = colModelo > -1 ? String(rowVals[colModelo] || '').trim() : '';
      const rawBrand = colMarca > -1 ? String(rowVals[colMarca] || '').trim() : '';
      const rawSupplier = colFornecedor > -1 ? String(rowVals[colFornecedor] || '').trim() : 'Frota Própria';
      const rawLocation = colObra > -1 ? String(rowVals[colObra] || '').trim() : defaultLocation || '';
      const rawChassi = colChassi > -1 ? String(rowVals[colChassi] || '').trim() : '';
      const rawMobVal = colMob > -1 ? rowVals[colMob] : '';
      let mobStr = '';
      if (rawMobVal instanceof Date) {
        const d = String(rawMobVal.getDate()).padStart(2, '0');
        const m = String(rawMobVal.getMonth() + 1).padStart(2, '0');
        const y = rawMobVal.getFullYear();
        mobStr = `${d}/${m}/${y}`;
      } else if (rawMobVal) {
        mobStr = String(rawMobVal).trim();
      }

      const rawDesmobVal = colDesmob > -1 ? rowVals[colDesmob] : '';
      let desmobStr = '';
      if (rawDesmobVal instanceof Date) {
        const d = String(rawDesmobVal.getDate()).padStart(2, '0');
        const m = String(rawDesmobVal.getMonth() + 1).padStart(2, '0');
        const y = rawDesmobVal.getFullYear();
        desmobStr = `${d}/${m}/${y}`;
      } else if (rawDesmobVal) {
        desmobStr = String(rawDesmobVal).trim();
      }

      const rawHorimetro = colHorimetro > -1 ? parseFloat(String(rowVals[colHorimetro] || '0').replace(',', '.')) : 0;

      // Only add if there is minimum identification
      if (rawType || rawPlate || rawPrefix) {
        const cleanCode = rawPrefix || rawPlate || `EQ-${result.length + 1}`;
        result.push({
          type: rawType || 'Equipamento',
          plate: rawPlate,
          prefix: rawPrefix,
          model: rawModel,
          brand: rawBrand,
          supplier: rawSupplier || 'Frota Própria',
          location: rawLocation || defaultLocation || '',
          chassis: rawChassi,
          mobilizationDate: mobStr || undefined,
          demobilizationDate: desmobStr,
          code: cleanCode,
          currentHourMeter: isNaN(rawHorimetro) ? 0 : rawHorimetro,
        });
      }
    }
  });

  return result;
}
