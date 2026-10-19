import ExcelJS from 'exceljs';
import { FuelDispense, Equipment, FuelEntry } from '../types';
import { formatDateBR, getTodayDateString } from './storage';

/**
 * Generates the official horizontal Makmo Combustível logo on a canvas
 * matching the user's specification image:
 * - "m", "mo" in Dark Navy (#0c2340)
 * - "a" and "k" (< chevron) in Teal (#20bca9)
 * - Fuel dispenser nozzle in Teal over "ak" with fuel droplet
 * - Teal divider lines flanking "C O M B U S T Í V E L"
 *
 * Returns a Base64 PNG data string for embedding in Excel files.
 */
const GEAR_PATH_EXCEL =
  'M 123.95 28.67 L 146.05 28.67 L 143.65 48.52 L 163.25 53.77 L 171.10 35.38 L 190.24 46.43 L 178.23 62.42 L 192.58 76.77 L 208.57 64.76 L 219.62 83.90 L 201.23 91.75 L 206.48 111.35 L 226.33 108.95 L 226.33 131.05 L 206.48 128.65 L 201.23 148.25 L 219.62 156.10 L 208.57 175.24 L 192.58 163.23 L 178.23 177.58 L 190.24 193.57 L 171.10 204.62 L 163.25 186.23 L 143.65 191.48 L 146.05 211.33 L 123.95 211.33 L 126.35 191.48 L 106.75 186.23 L 98.90 204.62 L 79.76 193.57 L 91.77 177.58 L 77.42 163.23 L 61.43 175.24 L 50.38 156.10 L 68.77 148.25 L 63.52 128.65 L 43.67 131.05 L 43.67 108.95 L 63.52 111.35 L 68.77 91.75 L 50.38 83.90 L 61.43 64.76 L 77.42 76.77 L 91.77 62.42 L 79.76 46.43 L 98.90 35.38 L 106.75 53.77 L 126.35 48.52 Z';

export function getMakmoCombustivelHorizontalLogoBase64(): string {
  if (typeof document === 'undefined') return '';

  try {
    const width = 800;
    const height = 240;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. Background in Corporate Deep Blue (#133863)
    ctx.fillStyle = '#133863';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Gear & Trend Arrow
    if (typeof Path2D !== 'undefined') {
      const pGear = new Path2D(GEAR_PATH_EXCEL);
      ctx.fillStyle = '#20bdae';
      ctx.fill(pGear);

      // Inner Hole
      ctx.fillStyle = '#133863';
      ctx.beginPath();
      ctx.arc(135, 120, 48, 0, Math.PI * 2);
      ctx.fill();

      // Trend Arrow
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(98, 138);
      ctx.lineTo(118, 114);
      ctx.lineTo(135, 131);
      ctx.lineTo(162, 94);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(170, 84);
      ctx.lineTo(148, 88);
      ctx.lineTo(162, 102);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Typography
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '400 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Sistema', 265, 84);

    ctx.font = '800 82px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PCM ', 265, 166);

    const pcmWidth = ctx.measureText('PCM ').width;
    ctx.fillStyle = '#20bdae';
    ctx.fillText('NEXUS', 265 + pcmWidth, 166);

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('Error rendering Sistema PCM NEXUS logo on canvas for Excel:', err);
    return '';
  }
}

export interface ExportFuelExcelOptions {
  obraText?: string;
  responsibleText?: string;
  customFilename?: string;
}

/**
 * Standardized Excel Export for Fuel Management (Gestão de Abastecimento).
 *
 * Sequence and Layout strictly identical to the user's standardized specification:
 * 1. Top Header:
 *    - Left: Official Makmo Combustível Logo (PNG Embedded)
 *    - Center: "GESTÃO DE ABASTECIMENTO" (Bold, 16pt)
 *    - Center: "OBRA: 063/064" (Bold, 14pt)
 *    - Center: "Responsável Roberto Jr" (Blue, 11pt)
 * 2. Table Column Headers (10 columns in EXACT sequence):
 *    1. Data
 *    2. Comboio
 *    3. Placa
 *    4. Equipamento
 *    5. Fornecedor
 *    6. Obra
 *    7. Horímetro
 *    8. Iniciante
 *    9. Encerrante
 *    10. Litros
 * 3. Color styling:
 *    - Header row: Steel Blue background (#366EA8 / #336699) with white bold text
 *    - Data rows: Clean, aligned cells with light grid borders
 *    - Numbers: Formatted with decimal precision and standard Excel accounting totals
 */
export async function exportFuelReportToExcel(
  dispenses: FuelDispense[],
  equipments: Equipment[] = [],
  options: ExportFuelExcelOptions = {}
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Makmo Infraestrutura';
  workbook.lastModifiedBy = 'Makmo Gestão de Abastecimento';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Abastecimentos', {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Setup Column Widths
  worksheet.columns = [
    { key: 'data', width: 14 }, // A: Data
    { key: 'comboio', width: 14 }, // B: Comboio
    { key: 'placa', width: 16 }, // C: Placa
    { key: 'equipamento', width: 28 }, // D: Equipamento
    { key: 'fornecedor', width: 22 }, // E: Fornecedor
    { key: 'obra', width: 16 }, // F: Obra
    { key: 'horimetro', width: 15 }, // G: Horímetro
    { key: 'iniciante', width: 14 }, // H: Iniciante
    { key: 'encerrante', width: 14 }, // I: Encerrante
    { key: 'litros', width: 16 }, // J: Litros
  ];

  // Set Row Heights for Header Section
  worksheet.getRow(1).height = 24;
  worksheet.getRow(2).height = 22;
  worksheet.getRow(3).height = 20;
  worksheet.getRow(4).height = 12; // Empty separator row
  worksheet.getRow(5).height = 26; // Table Header Row

  // Embed the Makmo Combustível Logo
  const logoDataUrl = getMakmoCombustivelHorizontalLogoBase64();
  if (logoDataUrl) {
    try {
      const base64Clean = logoDataUrl.replace(/^data:image\/png;base64,/, '');
      const imageId = workbook.addImage({
        base64: base64Clean,
        extension: 'png',
      });
      worksheet.addImage(imageId, {
        tl: { col: 0.1, row: 0.15 },
        ext: { width: 215, height: 60 },
        editAs: 'oneCell',
      });
    } catch (imgErr) {
      console.warn('Could not embed logo in Excel:', imgErr);
    }
  }

  // Determine Obra and Responsible text dynamically or from standard
  const uniqueObras = Array.from(new Set(dispenses.map((d) => d.location).filter(Boolean)));
  const defaultObra = uniqueObras.length === 1 ? uniqueObras[0] : '063/064';
  const obraText = options.obraText ? `OBRA: ${options.obraText}` : `OBRA: ${defaultObra}`;
  const responsibleText = options.responsibleText
    ? `Responsável ${options.responsibleText}`
    : 'Responsável Roberto Jr';

  // Title: "GESTÃO DE ABASTECIMENTO" (Merged D1:J1 or C1:J1)
  worksheet.mergeCells('C1:J1');
  const titleCell = worksheet.getCell('C1');
  titleCell.value = 'GESTÃO DE ABASTECIMENTO';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0A192F' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Subtitle: "OBRA: 063/064" (Merged D2:J2 or C2:J2)
  worksheet.mergeCells('C2:J2');
  const obraCell = worksheet.getCell('C2');
  obraCell.value = obraText;
  obraCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF000000' } };
  obraCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Responsible: "Responsável Roberto Jr" (Merged D3:J3 or C3:J3)
  worksheet.mergeCells('C3:J3');
  const respCell = worksheet.getCell('C3');
  respCell.value = responsibleText;
  respCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1D4ED8' } }; // Blue color matching user screenshot
  respCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Table Headers (Row 5) in exact sequence requested:
  // Data | Comboio | Placa | Equipamento | Fornecedor | Obra | Horímetro | Iniciante | Encerrante | Litros
  const headers = [
    'Data',
    'Comboio',
    'Placa',
    'Equipamento',
    'Fornecedor',
    'Obra',
    'Horímetro',
    'Iniciante',
    'Encerrante',
    'Litros',
  ];

  const headerRow = worksheet.getRow(5);
  headers.forEach((headerText, index) => {
    const colNumber = index + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = headerText;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366EA8' }, // Corporate Steel-Blue matching the user's reference image
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: false,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF2A5785' } },
      left: { style: 'thin', color: { argb: 'FF2A5785' } },
      bottom: { style: 'medium', color: { argb: 'FF1C3D60' } },
      right: { style: 'thin', color: { argb: 'FF2A5785' } },
    };
  });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };

  let currentRowIdx = 6;
  let totalLiters = 0;

  if (dispenses.length === 0) {
    const emptyRow = worksheet.getRow(currentRowIdx);
    emptyRow.height = 24;
    worksheet.mergeCells(`A${currentRowIdx}:J${currentRowIdx}`);
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = 'Nenhum registro de abastecimento para o filtro selecionado.';
    emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B7280' } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyCell.border = thinBorder;
    currentRowIdx++;
  } else {
    dispenses.forEach((d) => {
      const equip = equipments.find(
        (eq) =>
          (eq.plate && eq.plate.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase()) ||
          eq.code.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase() ||
          (eq.prefix && eq.prefix.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase())
      );

      const dataStr = formatDateBR(d.date);
      const comboioStr = d.convoyPlate || '';
      const placaStr = equip?.plate || d.equipmentCode || '-';
      const equipamentoStr = (
        d.equipmentType ||
        equip?.type ||
        equip?.equipmentType ||
        equip?.model ||
        equip?.prefix ||
        d.equipmentCode ||
        '-'
      ).toUpperCase();
      const fornecedorStr = d.supplier || equip?.supplier || '-';
      const obraStr = d.location || equip?.location || defaultObra;

      // Numerical Horímetro parsing
      let horimetroVal: number | string = '-';
      if (d.equipmentMeter !== undefined && d.equipmentMeter !== null) {
        if (typeof d.equipmentMeter === 'number' && !isNaN(d.equipmentMeter)) {
          horimetroVal = d.equipmentMeter;
        } else {
          const parsed = parseFloat(
            String(d.equipmentMeter)
              .replace(/\b(horas|hora|km|h)\b/gi, '')
              .replace(',', '.')
              .trim()
          );
          horimetroVal = !isNaN(parsed) ? parsed : String(d.equipmentMeter).trim();
        }
      }

      const inicianteVal = Number(d.initialMeter) || 0;
      const encerranteVal = Number(d.finalMeter) || 0;
      const litrosVal = Number(d.liters) || 0;
      totalLiters += litrosVal;

      const row = worksheet.getRow(currentRowIdx);
      row.height = 20;

      // 1. Data (Centered)
      const c1 = row.getCell(1);
      c1.value = dataStr;
      c1.alignment = { vertical: 'middle', horizontal: 'center' };
      c1.font = { name: 'Calibri', size: 10 };
      c1.border = thinBorder;

      // 2. Comboio (Centered)
      const c2 = row.getCell(2);
      c2.value = comboioStr;
      c2.alignment = { vertical: 'middle', horizontal: 'center' };
      c2.font = { name: 'Calibri', size: 10, bold: true };
      c2.border = thinBorder;

      // 3. Placa (Centered)
      const c3 = row.getCell(3);
      c3.value = placaStr;
      c3.alignment = { vertical: 'middle', horizontal: 'center' };
      c3.font = { name: 'Calibri', size: 10, bold: true };
      c3.border = thinBorder;

      // 4. Equipamento (Left-aligned)
      const c4 = row.getCell(4);
      c4.value = equipamentoStr;
      c4.alignment = { vertical: 'middle', horizontal: 'left' };
      c4.font = { name: 'Calibri', size: 10 };
      c4.border = thinBorder;

      // 5. Fornecedor (Left-aligned)
      const c5 = row.getCell(5);
      c5.value = fornecedorStr;
      c5.alignment = { vertical: 'middle', horizontal: 'left' };
      c5.font = { name: 'Calibri', size: 10 };
      c5.border = thinBorder;

      // 6. Obra (Centered)
      const c6 = row.getCell(6);
      c6.value = obraStr;
      c6.alignment = { vertical: 'middle', horizontal: 'center' };
      c6.font = { name: 'Calibri', size: 10 };
      c6.border = thinBorder;

      // 7. Horímetro (Right-aligned / Centered)
      const c7 = row.getCell(7);
      c7.value = horimetroVal;
      c7.alignment = { vertical: 'middle', horizontal: 'right' };
      c7.font = { name: 'Calibri', size: 10 };
      if (typeof horimetroVal === 'number') {
        c7.numFmt = Number.isInteger(horimetroVal) ? '#,##0' : '#,##0.0';
      }
      c7.border = thinBorder;

      // 8. Iniciante (Right-aligned numeric)
      const c8 = row.getCell(8);
      c8.value = inicianteVal;
      c8.alignment = { vertical: 'middle', horizontal: 'right' };
      c8.font = { name: 'Calibri', size: 10 };
      c8.numFmt = '#,##0.0';
      c8.border = thinBorder;

      // 9. Encerrante (Right-aligned numeric)
      const c9 = row.getCell(9);
      c9.value = encerranteVal;
      c9.alignment = { vertical: 'middle', horizontal: 'right' };
      c9.font = { name: 'Calibri', size: 10 };
      c9.numFmt = '#,##0.0';
      c9.border = thinBorder;

      // 10. Litros (Right-aligned numeric)
      const c10 = row.getCell(10);
      c10.value = litrosVal;
      c10.alignment = { vertical: 'middle', horizontal: 'right' };
      c10.font = { name: 'Calibri', size: 10, bold: true };
      c10.numFmt = '#,##0.0';
      c10.border = thinBorder;

      currentRowIdx++;
    });

    // Summary / Total Row
    const totalRow = worksheet.getRow(currentRowIdx);
    totalRow.height = 22;

    worksheet.mergeCells(`A${currentRowIdx}:I${currentRowIdx}`);
    const labelTotalCell = totalRow.getCell(1);
    labelTotalCell.value = 'TOTAL GERAL DE LITROS:';
    labelTotalCell.alignment = { vertical: 'middle', horizontal: 'right' };
    labelTotalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F2937' } };
    labelTotalCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };

    // Border across merged cells
    for (let c = 1; c <= 9; c++) {
      totalRow.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'double', color: { argb: 'FF111827' } },
        left: c === 1 ? { style: 'thin', color: { argb: 'FF9CA3AF' } } : undefined,
      };
    }

    const valueTotalCell = totalRow.getCell(10);
    // Use formula if rows exist, or direct total
    const startRow = 6;
    const endRow = currentRowIdx - 1;
    valueTotalCell.value = {
      formula: `SUM(J${startRow}:J${endRow})`,
      result: Number(totalLiters.toFixed(1)),
    };
    valueTotalCell.numFmt = '#,##0.0';
    valueTotalCell.alignment = { vertical: 'middle', horizontal: 'right' };
    valueTotalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
    valueTotalCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFDE047' }, // Soft yellow highlight on total liters
    };
    valueTotalCell.border = {
      top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      bottom: { style: 'double', color: { argb: 'FF111827' } },
      right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
    };
  }

  // Generate and download XLSX buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = getTodayDateString();
  const filename = options.customFilename || `makmo_relatorio_abastecimentos_${today}.xlsx`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports Fuel Entries (Recebimento de Cargas) to a styled Excel worksheet (.xlsx)
 * matching the columns and layout of the system table:
 * 1. Data
 * 2. Litros Recebidos
 * 3. Valor Total (R$)
 * 4. Valor Unitário (R$/L)
 * 5. Fornecedor
 * 6. Nota Fiscal
 * 7. Destino
 * 8. Responsável
 * 9. Observações
 */
export async function exportFuelEntriesToExcel(
  entries: FuelEntry[],
  options: { filterInfo?: string; customFilename?: string } = {}
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Makmo Infraestrutura';
  workbook.lastModifiedBy = 'Makmo Gestão de Combustível';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Recebimento de Cargas', {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Column widths matching the columns
  worksheet.columns = [
    { key: 'data', width: 14 },
    { key: 'litros', width: 18 },
    { key: 'valorTotal', width: 20 },
    { key: 'valorUnitario', width: 18 },
    { key: 'fornecedor', width: 25 },
    { key: 'notaFiscal', width: 16 },
    { key: 'destino', width: 22 },
    { key: 'responsavel', width: 25 },
    { key: 'observacoes', width: 35 },
  ];

  // Set Row Heights for Header Section
  worksheet.getRow(1).height = 24;
  worksheet.getRow(2).height = 22;
  worksheet.getRow(3).height = 20;
  worksheet.getRow(4).height = 12; // Empty separator row
  worksheet.getRow(5).height = 26; // Table Header Row

  // Embed the Makmo Combustível Logo
  const logoDataUrl = getMakmoCombustivelHorizontalLogoBase64();
  if (logoDataUrl) {
    try {
      const base64Clean = logoDataUrl.replace(/^data:image\/png;base64,/, '');
      const imageId = workbook.addImage({
        base64: base64Clean,
        extension: 'png',
      });
      worksheet.addImage(imageId, {
        tl: { col: 0.1, row: 0.15 },
        ext: { width: 215, height: 60 },
        editAs: 'oneCell',
      });
    } catch (imgErr) {
      console.warn('Could not embed logo in Excel:', imgErr);
    }
  }

  // Title: "ENTRADAS DE DIESEL (RECEBIMENTO DE CARGAS)" (Merged C1:I1)
  worksheet.mergeCells('C1:I1');
  const titleCell = worksheet.getCell('C1');
  titleCell.value = 'ENTRADAS DE DIESEL (RECEBIMENTO DE CARGAS)';
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0A192F' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Subtitle: "OBRA: 063/064"
  worksheet.mergeCells('C2:I2');
  const obraCell = worksheet.getCell('C2');
  obraCell.value = options.filterInfo ? `OBRA: 063/064 • ${options.filterInfo}` : 'OBRA: 063/064';
  obraCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF000000' } };
  obraCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Responsible: "Responsável Roberto Jr"
  worksheet.mergeCells('C3:I3');
  const respCell = worksheet.getCell('C3');
  respCell.value = 'Responsável Roberto Jr';
  respCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1D4ED8' } };
  respCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Table Headers (Row 5)
  const headers = [
    'Data',
    'Litros Recebidos',
    'Valor Total (R$)',
    'Valor Unitário (R$/L)',
    'Fornecedor',
    'Nota Fiscal',
    'Destino',
    'Responsável',
    'Observações',
  ];

  const headerRow = worksheet.getRow(5);
  headers.forEach((headerText, index) => {
    const colNumber = index + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = headerText;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF113861' }, // Corporate Deep Navy
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNumber === 2 || colNumber === 3 || colNumber === 4 ? 'right' : 'center',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0A2540' } },
      bottom: { style: 'medium', color: { argb: 'FF0A2540' } },
      left: { style: 'thin', color: { argb: 'FF2A4E7A' } },
      right: { style: 'thin', color: { argb: 'FF2A4E7A' } },
    };
  });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  };

  let currentRowIdx = 6;
  let totalLiters = 0;
  let totalValue = 0;

  entries.forEach((ent, rowIdx) => {
    const row = worksheet.getRow(currentRowIdx);
    row.height = 20;
    const isEven = rowIdx % 2 === 0;
    const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF9FAFB';

    const lVal = Number(ent.liters) || 0;
    const vVal = ent.totalValue !== undefined && ent.totalValue !== null ? Number(ent.totalValue) : null;
    const unitPrice = vVal !== null && lVal > 0 ? vVal / lVal : (ent.unitPrice || null);

    totalLiters += lVal;
    if (vVal !== null) totalValue += vVal;

    // Col 1: Data
    const c1 = row.getCell(1);
    c1.value = formatDateBR(ent.date);
    c1.alignment = { vertical: 'middle', horizontal: 'center' };
    c1.font = { name: 'Calibri', size: 10 };
    c1.border = thinBorder;
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };

    // Col 2: Litros Recebidos
    const c2 = row.getCell(2);
    c2.value = lVal;
    c2.numFmt = '#,##0.0';
    c2.alignment = { vertical: 'middle', horizontal: 'right' };
    c2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } }; // Emerald bold
    c2.border = thinBorder;
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF0FDF4' : 'FFE8F8EE' } };

    // Col 3: Valor Total (R$)
    const c3 = row.getCell(3);
    c3.value = vVal !== null ? vVal : '-';
    if (vVal !== null) c3.numFmt = '"R$" #,##0.00';
    c3.alignment = { vertical: 'middle', horizontal: 'right' };
    c3.font = { name: 'Calibri', size: 10, bold: vVal !== null };
    c3.border = thinBorder;
    c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };

    // Col 4: Valor Unitário (R$/L)
    const c4 = row.getCell(4);
    c4.value = unitPrice !== null ? unitPrice : '-';
    if (unitPrice !== null) c4.numFmt = '"R$" #,##0.00"/L"';
    c4.alignment = { vertical: 'middle', horizontal: 'right' };
    c4.font = { name: 'Calibri', size: 10 };
    c4.border = thinBorder;
    c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };

    // Col 5: Fornecedor
    const c5 = row.getCell(5);
    c5.value = ent.supplier || '-';
    c5.alignment = { vertical: 'middle', horizontal: 'left' };
    c5.font = { name: 'Calibri', size: 10 };
    c5.border = thinBorder;
    c5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };

    // Col 6: Nota Fiscal
    const c6 = row.getCell(6);
    c6.value = ent.invoiceNumber || '-';
    c6.alignment = { vertical: 'middle', horizontal: 'center' };
    c6.font = { name: 'Calibri', size: 10 };
    c6.border = thinBorder;
    c6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };

    // Col 7: Destino
    const c7 = row.getCell(7);
    c7.value = ent.destination || 'Comboio SPF2C66';
    c7.alignment = { vertical: 'middle', horizontal: 'left' };
    c7.font = { name: 'Calibri', size: 10 };
    c7.border = thinBorder;
    c7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };

    // Col 8: Responsável
    const c8 = row.getCell(8);
    c8.value = ent.responsible || '-';
    c8.alignment = { vertical: 'middle', horizontal: 'left' };
    c8.font = { name: 'Calibri', size: 10 };
    c8.border = thinBorder;
    c8.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };

    // Col 9: Observações
    const c9 = row.getCell(9);
    c9.value = ent.notes || '-';
    c9.alignment = { vertical: 'middle', horizontal: 'left' };
    c9.font = { name: 'Calibri', size: 9 };
    c9.border = thinBorder;
    c9.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };

    currentRowIdx++;
  });

  // Summary / Total Row
  if (entries.length > 0) {
    const totalRow = worksheet.getRow(currentRowIdx);
    totalRow.height = 24;

    const labelCell = totalRow.getCell(1);
    labelCell.value = 'TOTAL GERAL:';
    labelCell.alignment = { vertical: 'middle', horizontal: 'right' };
    labelCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF111827' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    labelCell.border = {
      top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      bottom: { style: 'double', color: { argb: 'FF111827' } },
      left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
    };

    // Litros Total
    const startRow = 6;
    const endRow = currentRowIdx - 1;
    const litrosCell = totalRow.getCell(2);
    litrosCell.value = { formula: `SUM(B${startRow}:B${endRow})`, result: Number(totalLiters.toFixed(2)) };
    litrosCell.numFmt = '#,##0.0';
    litrosCell.alignment = { vertical: 'middle', horizontal: 'right' };
    litrosCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF065F46' } };
    litrosCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Light green fill
    litrosCell.border = {
      top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      bottom: { style: 'double', color: { argb: 'FF111827' } },
      left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
    };

    // Valor Total
    const valorCell = totalRow.getCell(3);
    valorCell.value = { formula: `SUM(C${startRow}:C${endRow})`, result: Number(totalValue.toFixed(2)) };
    valorCell.numFmt = '"R$" #,##0.00';
    valorCell.alignment = { vertical: 'middle', horizontal: 'right' };
    valorCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
    valorCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } }; // Yellow highlight
    valorCell.border = {
      top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      bottom: { style: 'double', color: { argb: 'FF111827' } },
      left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
    };

    // Preço Médio Unitário Ponderado
    const unitPriceCell = totalRow.getCell(4);
    if (totalLiters > 0 && totalValue > 0) {
      unitPriceCell.value = totalValue / totalLiters;
      unitPriceCell.numFmt = '"R$" #,##0.00"/L"';
    } else {
      unitPriceCell.value = '-';
    }
    unitPriceCell.alignment = { vertical: 'middle', horizontal: 'right' };
    unitPriceCell.font = { name: 'Calibri', size: 10, bold: true };
    unitPriceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    unitPriceCell.border = {
      top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      bottom: { style: 'double', color: { argb: 'FF111827' } },
      left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
    };

    // Empty remaining total cells with border
    for (let c = 5; c <= 9; c++) {
      const restCell = totalRow.getCell(c);
      restCell.value = '';
      restCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      restCell.border = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'double', color: { argb: 'FF111827' } },
        right: c === 9 ? { style: 'thin', color: { argb: 'FF9CA3AF' } } : undefined,
      };
    }
  }

  // Generate and download XLSX buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = getTodayDateString();
  const filename = options.customFilename || `makmo_entradas_diesel_${today}.xlsx`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

