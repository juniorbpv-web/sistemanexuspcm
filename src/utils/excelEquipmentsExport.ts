import ExcelJS from 'exceljs';
import { Equipment } from '../types';
import { formatDateBR, getTodayDateString } from './storage';

/**
 * Exports equipments to a styled Microsoft Excel (.xlsx) file
 * following the mandatory column sequence:
 * 1. Equipamento
 * 2. Placa
 * 3. Prefixo
 * 4. Modelo
 * 5. Marca
 * 6. Fornecedor
 * 7. Obra
 * 8. Chassi
 * 9. Data de Desmobilização
 */
export async function exportEquipmentsToExcel(
  equipments: Equipment[],
  obraName: string = 'Todas as Obras'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Makmo Infraestrutura';
  workbook.lastModifiedBy = 'Makmo Infraestrutura';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('Base de Equipamentos', {
    views: [{ showGridLines: true }],
  });

  // Title Row
  sheet.mergeCells('A1:K1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `MAKMO INFRAESTRUTURA • BASE DE DADOS DE EQUIPAMENTOS (${obraName.toUpperCase()})`;
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF113861' }, // Makmo Navy Blue
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 32;

  // Subtitle info
  sheet.mergeCells('A2:L2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Relatório emitido em ${formatDateBR(getTodayDateString())} • Total: ${equipments.length} equipamento(s)`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 18;

  // Header row - Exactly sequence 1 to 9 + Horímetro
  const headerRow = sheet.getRow(4);
  headerRow.values = [
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
    'Horímetro Atual (h)',
    'Operador / Motorista',
  ];
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF113861' }, // Makmo Navy
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF20B4A7' } }, // Makmo Teal
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Populate data
  equipments.forEach((eq, index) => {
    const rowNumber = index + 5;
    const row = sheet.getRow(rowNumber);

    const mobDateBR = eq.mobilizationDate ? formatDateBR(eq.mobilizationDate) : '-';
    const demobDateBR = eq.demobilizationDate ? formatDateBR(eq.demobilizationDate) : '-';

    row.values = [
      eq.type || '-',
      eq.plate || '-',
      eq.prefix || eq.code || '-',
      eq.model || (eq.brandModel ? eq.brandModel : '-'),
      eq.brand || '-',
      eq.supplier || 'Frota Própria',
      eq.location || '-',
      eq.chassis || '-',
      mobDateBR,
      demobDateBR,
      eq.currentHourMeter ?? 0,
      eq.operator || '-',
    ];

    row.height = 20;

    const isEven = index % 2 === 0;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 || colNumber === 6 || colNumber === 7 ? 'left' : 'center',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (!isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      // Format Horímetro as number
      if (colNumber === 10 && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.0';
      }
    });
  });

  // Column widths
  sheet.columns = [
    { width: 26 }, // Equipamento
    { width: 14 }, // Placa
    { width: 15 }, // Prefixo
    { width: 18 }, // Modelo
    { width: 18 }, // Marca
    { width: 22 }, // Fornecedor
    { width: 22 }, // Obra
    { width: 24 }, // Chassi
    { width: 22 }, // Data de Desmobilização
    { width: 20 }, // Horímetro
    { width: 24 }, // Operador
  ];

  // Write and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeObra = obraName.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.href = url;
  link.download = `makmo_equipamentos_${safeObra}_${getTodayDateString()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parses an uploaded Excel (.xlsx, .xls) or CSV file and extracts equipment rows.
 */
export async function parseEquipmentsFromExcelOrCSV(
  file: File,
  fallbackObra: string = '063/064'
): Promise<Array<Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>>> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();

  if (file.name.toLowerCase().endsWith('.csv')) {
    try {
      await (workbook.csv as any).read(arrayBuffer);
    } catch {
      await workbook.xlsx.load(arrayBuffer);
    }
  } else {
    await workbook.xlsx.load(arrayBuffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Nenhuma planilha encontrada no arquivo.');
  }

  const results: Array<Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>> = [];

  // Determine header row (look for "equipamento" or "placa" or "prefixo")
  let headerRowIndex = 1;
  for (let r = 1; r <= Math.min(worksheet.rowCount, 10); r++) {
    const row = worksheet.getRow(r);
    const rowValues = (row.values as any[] || []).map((v) => String(v || '').toLowerCase().trim());
    if (
      rowValues.some((v) => v.includes('equipamento') || v.includes('tipo')) &&
      rowValues.some((v) => v.includes('placa') || v.includes('prefixo'))
    ) {
      headerRowIndex = r;
      break;
    }
  }

  const headerRow = worksheet.getRow(headerRowIndex);
  const colMap: Record<string, number> = {};

  (headerRow.values as any[] || []).forEach((val, colIndex) => {
    if (!val) return;
    const str = String(val).toLowerCase().trim();
    if (str.includes('equipamento') || str.includes('tipo')) colMap['type'] = colIndex;
    else if (str.includes('placa')) colMap['plate'] = colIndex;
    else if (str.includes('prefixo') || str.includes('código') || str.includes('codigo')) colMap['prefix'] = colIndex;
    else if (str.includes('modelo')) colMap['model'] = colIndex;
    else if (str.includes('marca') || str.includes('fabricante')) colMap['brand'] = colIndex;
    else if (str.includes('fornecedor') || str.includes('locadora')) colMap['supplier'] = colIndex;
    else if (str.includes('obra') || str.includes('local')) colMap['location'] = colIndex;
    else if (str.includes('chassi') || str.includes('chassis')) colMap['chassis'] = colIndex;
    else if (str.includes('mobiliz') && !str.includes('desmobiliz')) colMap['mobilizationDate'] = colIndex;
    else if (str.includes('desmobiliz') || str.includes('desmobilização')) colMap['demobilizationDate'] = colIndex;
    else if (str.includes('horímetro') || str.includes('horimetro') || str.includes('horas')) colMap['currentHourMeter'] = colIndex;
    else if (str.includes('operador') || str.includes('motorista')) colMap['operator'] = colIndex;
  });

  // Read data rows
  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || !row.hasValues) continue;

    const getVal = (key: string): string => {
      const idx = colMap[key];
      if (!idx) return '';
      const c = row.getCell(idx).value;
      if (c === null || c === undefined) return '';
      if (typeof c === 'object' && 'text' in (c as any)) return String((c as any).text).trim();
      return String(c).trim();
    };

    const type = getVal('type') || row.getCell(1).text?.trim();
    const plate = getVal('plate') || row.getCell(2).text?.trim();
    const prefix = getVal('prefix') || row.getCell(3).text?.trim();
    const model = getVal('model') || row.getCell(4).text?.trim();
    const brand = getVal('brand') || row.getCell(5).text?.trim();
    const supplier = getVal('supplier') || row.getCell(6).text?.trim() || 'Frota Própria';
    const location = getVal('location') || row.getCell(7).text?.trim() || fallbackObra;
    const chassis = getVal('chassis') || row.getCell(8).text?.trim();
    const rawMob = getVal('mobilizationDate');
    const rawDemob = getVal('demobilizationDate');
    const rawMeter = getVal('currentHourMeter');
    const operator = getVal('operator');

    if (!type && !plate && !prefix) continue;

    // Helper to format dates
    const parseDateStr = (rawVal: string | undefined): string | undefined => {
      if (!rawVal || rawVal === '-') return undefined;
      if (rawVal.includes('/')) {
        const parts = rawVal.split('/');
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      } else if (rawVal.includes('-')) {
        return rawVal;
      }
      return undefined;
    };

    const mobFormatted = parseDateStr(rawMob);
    const demobFormatted = parseDateStr(rawDemob);

    const cleanPlate = plate.toUpperCase().trim();
    const cleanPrefix = prefix.toUpperCase().trim();
    const cleanCode = cleanPrefix || cleanPlate || `EQ-${r}`;

    const numMeter = parseFloat(rawMeter.replace(',', '.')) || 0;

    results.push({
      type: type || 'Equipamento',
      plate: cleanPlate || undefined,
      prefix: cleanPrefix || undefined,
      code: cleanCode,
      model: model || undefined,
      brand: brand || undefined,
      supplier: supplier || 'Frota Própria',
      location: location || fallbackObra,
      chassis: chassis && chassis !== '-' ? chassis.trim().toUpperCase() : undefined,
      mobilizationDate: mobFormatted || undefined,
      demobilizationDate: demobFormatted || undefined,
      currentHourMeter: numMeter >= 0 ? numMeter : 0,
      operator: operator && operator !== '-' ? operator.trim() : undefined,
      obra_id: location || fallbackObra,
      projectId: location || fallbackObra,
    });
  }

  return results;
}
