import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  isSupabaseConfigured,
  upsertRecordToSupabase,
  fetchCollectionFromSupabase,
} from './supabaseService';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Equipment,
  FuelDispense,
  FuelEntry,
  AppProject,
  AppConvoy,
  GmailIntegrationConfig,
  GmailSendResult,
} from '../types';
import {
  formatDateBR,
  getTodayDateString,
  formatLiters,
  getConvoyFuelSummary,
  loadCustomConvoys,
  getConvoysForProject,
} from '../utils/storage';
import {
  loadAppProjects,
  normalizeProjectCode,
  UNIFIED_WORK_CODE,
  CLEAN_WORK_062_PA,
} from '../utils/authStorage';

// =========================================================================
// OAUTH & GMAIL AUTH STATE MANAGEMENT (Least Privilege: gmail.send)
// =========================================================================

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope(GMAIL_SEND_SCOPE);

// Flag indicating sign-in in progress
let isSigningIn = false;
// In-memory token cache (MANDATORY: Never store access token in localStorage)
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;

/**
 * Initializes Google Auth state listener.
 * Clears in-memory token when user signs out.
 */
export function initGmailAuth(
  onSuccess?: (user: User, token: string) => void,
  onFail?: () => void
): () => void {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedGoogleUser = user;
      if (cachedAccessToken) {
        if (onSuccess) onSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onFail) onFail();
      }
    } else {
      cachedAccessToken = null;
      cachedGoogleUser = null;
      if (onFail) onFail();
    }
  });
}

/**
 * Sign in with Google requesting the Gmail send scope.
 * Must be triggered by a direct user click.
 */
export async function signInWithGoogleGmail(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Falha ao obter o Token de Acesso do Google para a integração com o Gmail.');
    }

    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;

    // Update sender email in config if possible
    if (result.user.email) {
      const cfg = getStoredGmailConfig();
      saveGmailConfig({
        ...cfg,
        senderEmail: result.user.email,
      }).catch(() => {});
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('[GMAIL AUTH ERROR]', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Returns currently cached Google access token.
 */
export function getGmailAccessToken(): string | null {
  return cachedAccessToken;
}

/**
 * Returns currently connected Google User
 */
export function getConnectedGoogleUser(): User | null {
  return cachedGoogleUser;
}

/**
 * Disconnects the in-memory Gmail token
 */
export function disconnectGmail(): void {
  cachedAccessToken = null;
  cachedGoogleUser = null;
}

// =========================================================================
// CONFIGURATION PERSISTENCE (Admin Only)
// =========================================================================

export const GMAIL_CONFIG_KEY = 'makmo_gmail_integration_config';
export const GMAIL_SETTINGS_DOC_PATH = 'settings/gmail_integration';

export const DEFAULT_GMAIL_CONFIG: GmailIntegrationConfig = {
  enabled: true,
  sendHour: 6,
  sendMinute: 0,
  primaryEmail: 'roberto.junior@makmo.com.br',
  additionalEmails: [],
  lastStatus: 'idle',
};

/**
 * Reads local fallback config synchronously
 */
export function getStoredGmailConfig(): GmailIntegrationConfig {
  try {
    const raw = localStorage.getItem(GMAIL_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_GMAIL_CONFIG,
        ...parsed,
        primaryEmail: parsed.primaryEmail || 'roberto.junior@makmo.com.br',
        additionalEmails: Array.isArray(parsed.additionalEmails) ? parsed.additionalEmails : [],
      };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_GMAIL_CONFIG };
}

/**
 * Loads configuration from Firestore with local storage fallback
 */
export async function loadGmailConfig(): Promise<GmailIntegrationConfig> {
  const local = getStoredGmailConfig();
  try {
    const ref = doc(db, 'settings', 'gmail_integration');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const remote = snap.data() as Partial<GmailIntegrationConfig>;
      const merged: GmailIntegrationConfig = {
        ...DEFAULT_GMAIL_CONFIG,
        ...local,
        ...remote,
        primaryEmail: remote.primaryEmail || local.primaryEmail || 'roberto.junior@makmo.com.br',
        additionalEmails: Array.isArray(remote.additionalEmails)
          ? remote.additionalEmails
          : local.additionalEmails || [],
      };
      localStorage.setItem(GMAIL_CONFIG_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('[GMAIL CONFIG] Firestore read warning, using local configuration:', err);
  }
  return local;
}

/**
 * Saves configuration to both Firestore and localStorage
 */
export async function saveGmailConfig(config: GmailIntegrationConfig): Promise<void> {
  // Always update localStorage
  localStorage.setItem(GMAIL_CONFIG_KEY, JSON.stringify(config));

  // Try updating Firestore
  try {
    const ref = doc(db, 'settings', 'gmail_integration');
    await setDoc(ref, config, { merge: true });
  } catch (err) {
    console.warn('[GMAIL CONFIG] Firestore save warning, saved locally:', err);
  }
}

// =========================================================================
// DATA PREPARATION: PER-OBRA EQUIPMENTS & CONVOYS BALANCES
// =========================================================================

export interface ObraEquipmentGroup {
  obraCode: string;
  obraLabel: string;
  equipments: Equipment[];
}

export interface ConvoyBalanceItem {
  plate: string;
  name: string;
  prefix?: string;
  driver?: string;
  capacity: number;
  obra: string;
  entriesLiters: number;
  dispensedLiters: number;
  currentBalance: number;
  percentRemaining: number;
}

export interface FleetReportData {
  generatedAt: string;
  totalEquipments: number;
  obraGroups: ObraEquipmentGroup[];
  convoys: ConvoyBalanceItem[];
  totalFuelEntries: number;
  totalFuelDispensed: number;
  totalConvoysBalance: number;
}

/**
 * Gathers and compiles all equipment grouped by project and all comboio balances across all obras.
 */
export function compileFleetReportData(
  equipments: Equipment[],
  entries: FuelEntry[],
  dispenses: FuelDispense[],
  projectsList?: AppProject[]
): FleetReportData {
  const allProjects = projectsList && projectsList.length > 0 ? projectsList : loadAppProjects();

  // 1. Group Equipments by Obra
  const obraMap = new Map<string, Equipment[]>();

  // Ensure default registered projects exist in the map
  allProjects.forEach((proj) => {
    const norm = normalizeProjectCode(proj.code);
    if (!obraMap.has(norm)) {
      obraMap.set(norm, []);
    }
  });

  // Always ensure official core projects exist
  if (!obraMap.has(UNIFIED_WORK_CODE)) obraMap.set(UNIFIED_WORK_CODE, []);
  if (!obraMap.has(CLEAN_WORK_062_PA)) obraMap.set(CLEAN_WORK_062_PA, []);

  // Distribute equipments into their respective obra groups
  equipments.forEach((eq) => {
    const code = normalizeProjectCode(eq.obra_id || eq.location) || UNIFIED_WORK_CODE;
    if (!obraMap.has(code)) {
      obraMap.set(code, []);
    }
    obraMap.get(code)!.push(eq);
  });

  // Convert to sorted ObraEquipmentGroup array
  const obraGroups: ObraEquipmentGroup[] = Array.from(obraMap.entries())
    .map(([code, items]) => {
      let label = code;
      const matchedProj = allProjects.find((p) => normalizeProjectCode(p.code) === code);
      if (matchedProj) {
        label = matchedProj.name ? `${matchedProj.code} - ${matchedProj.name}` : matchedProj.code;
      } else if (code === UNIFIED_WORK_CODE) {
        label = 'Obra 063/064 (Consolidado)';
      } else if (code === CLEAN_WORK_062_PA) {
        label = 'Obra 062 - PA';
      }
      return {
        obraCode: code,
        obraLabel: label,
        equipments: items.sort((a, b) => (a.prefix || a.code || '').localeCompare(b.prefix || b.code || '')),
      };
    })
    // Show active groups or groups with equipment first
    .sort((a, b) => b.equipments.length - a.equipments.length || a.obraLabel.localeCompare(b.obraLabel));

  // 2. Compile All Convoys Across All Obras
  // Gather base convoys (RTW1C01, DZA7G30, SPF2C66) and any custom convoys created
  const baseConvoys: AppConvoy[] = [
    {
      id: 'convoy-rtw1c01',
      plate: 'RTW1C01',
      name: 'Comboio RTW1C01',
      capacity: 5000,
      location: UNIFIED_WORK_CODE,
      createdAt: '2026-01-01',
    },
    {
      id: 'convoy-dza7g30',
      plate: 'DZA7G30',
      name: 'Comboio DZA7G30',
      capacity: 5000,
      location: UNIFIED_WORK_CODE,
      createdAt: '2026-01-01',
    },
    {
      id: 'convoy-spf2c66',
      plate: 'SPF2C66',
      name: 'Comboio SPF2C66',
      capacity: 5000,
      location: UNIFIED_WORK_CODE,
      createdAt: '2026-01-01',
    },
  ];

  const customConvoys = loadCustomConvoys();
  const allConvoysMap = new Map<string, AppConvoy>();
  baseConvoys.forEach((c) => allConvoysMap.set(c.plate.toUpperCase(), c));
  customConvoys.forEach((c) => allConvoysMap.set(c.plate.toUpperCase(), c));

  // Also include any convoys referenced in dispenses that might not be in custom list
  dispenses.forEach((d) => {
    if (d.convoyPlate && !allConvoysMap.has(d.convoyPlate.toUpperCase())) {
      allConvoysMap.set(d.convoyPlate.toUpperCase(), {
        id: `convoy-${d.convoyPlate.toLowerCase()}`,
        plate: d.convoyPlate,
        name: `Comboio ${d.convoyPlate}`,
        capacity: 5000,
        location: d.location || UNIFIED_WORK_CODE,
        createdAt: '2026-01-01',
      });
    }
  });

  const convoyBalanceItems: ConvoyBalanceItem[] = Array.from(allConvoysMap.values()).map((convoy) => {
    const summary = getConvoyFuelSummary(convoy.plate, entries, dispenses);
    const capacity = convoy.capacity || 5000;
    const balance = summary.balance;
    const pct = capacity > 0 ? Math.min(100, Math.max(0, (balance / capacity) * 100)) : 0;

    return {
      plate: convoy.plate.toUpperCase(),
      name: convoy.name || `Comboio ${convoy.plate}`,
      prefix: convoy.prefix,
      driver: convoy.driver || 'Não inf.',
      capacity,
      obra: convoy.location || UNIFIED_WORK_CODE,
      entriesLiters: summary.entriesLiters,
      dispensedLiters: summary.dispensedLiters,
      currentBalance: Number(balance.toFixed(1)),
      percentRemaining: Number(pct.toFixed(1)),
    };
  });

  // Calculate Global Balances
  const totalFuelEntries = convoyBalanceItems.reduce((acc, c) => acc + c.entriesLiters, 0);
  const totalFuelDispensed = convoyBalanceItems.reduce((acc, c) => acc + c.dispensedLiters, 0);
  const totalConvoysBalance = Number((totalFuelEntries - totalFuelDispensed).toFixed(1));

  return {
    generatedAt: new Date().toISOString(),
    totalEquipments: equipments.length,
    obraGroups,
    convoys: convoyBalanceItems,
    totalFuelEntries,
    totalFuelDispensed,
    totalConvoysBalance,
  };
}

// =========================================================================
// EXCEL ATTACHMENT GENERATOR (Multi-Sheet: Resumo & Convoys + Per-Obra Sheets)
// =========================================================================

export async function generateFleetReportExcelBuffer(data: FleetReportData): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Makmo Infraestrutura';
  workbook.lastModifiedBy = 'Sistema Makmo de Gestão de Frotas';
  workbook.created = new Date();
  workbook.modified = new Date();

  const emissionDateBR = formatDateBR(getTodayDateString());

  // ---------------------------------------------------------
  // SHEET 1: Resumo Geral & Saldo de Todos os Comboios
  // ---------------------------------------------------------
  const summarySheet = workbook.addWorksheet('Resumo & Saldo Comboios', {
    views: [{ showGridLines: true }],
  });

  // Banner Header
  summarySheet.mergeCells('A1:H1');
  const bannerCell = summarySheet.getCell('A1');
  bannerCell.value = 'MAKMO INFRAESTRUTURA • RELATÓRIO EXECUTIVO MATUTINO (06:00)';
  bannerCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
  bannerCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(1).height = 36;

  // Subtitle
  summarySheet.mergeCells('A2:H2');
  const subCell = summarySheet.getCell('A2');
  subCell.value = `Posição Consolidada em ${emissionDateBR} • Total de ${data.totalEquipments} Equipamentos em ${data.obraGroups.length} Obras`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(2).height = 20;

  // Section Header: Saldo dos Comboios
  summarySheet.mergeCells('A4:H4');
  const comboioTitleCell = summarySheet.getCell('A4');
  comboioTitleCell.value = '1. SALDO ATUAL DE TODOS OS COMBOIOS DE TODAS AS OBRAS';
  comboioTitleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  comboioTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF113861' } }; // Makmo Navy #113861
  comboioTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  summarySheet.getRow(4).height = 24;

  const convoyHeaders = [
    'Placa / Prefixo',
    'Nome do Comboio',
    'Obra Vinculada',
    'Motorista / Operador',
    'Capacidade (L)',
    'Entradas Acumuladas (L)',
    'Abastecimentos (L)',
    'Saldo Atual Disponível (L)',
  ];

  const convoyHeaderRow = summarySheet.getRow(5);
  convoyHeaderRow.values = convoyHeaders;
  convoyHeaderRow.height = 22;
  convoyHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF113861' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF20B4A7' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  let currentRowIdx = 6;
  data.convoys.forEach((convoy) => {
    const row = summarySheet.getRow(currentRowIdx);
    row.values = [
      convoy.prefix ? `${convoy.plate} (${convoy.prefix})` : convoy.plate,
      convoy.name,
      convoy.obra,
      convoy.driver || 'Não informado',
      convoy.capacity,
      convoy.entriesLiters,
      convoy.dispensedLiters,
      convoy.currentBalance,
    ];

    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(5).numFmt = '#,##0 "L"';
    row.getCell(6).numFmt = '#,##0.0 "L"';
    row.getCell(7).numFmt = '#,##0.0 "L"';
    row.getCell(8).numFmt = '#,##0.0 "L"';

    // Highlight balance cell
    const balanceCell = row.getCell(8);
    balanceCell.font = { bold: true };
    if (convoy.currentBalance >= 2000) {
      balanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Light emerald
      balanceCell.font = { bold: true, color: { argb: 'FF166534' } };
    } else if (convoy.currentBalance > 0) {
      balanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Light amber
      balanceCell.font = { bold: true, color: { argb: 'FF92400E' } };
    } else {
      balanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Light rose
      balanceCell.font = { bold: true, color: { argb: 'FF991B1B' } };
    }

    row.height = 20;
    currentRowIdx++;
  });

  // Section Header: Resumo por Obra
  currentRowIdx += 2;
  summarySheet.mergeCells(`A${currentRowIdx}:E${currentRowIdx}`);
  const obraSummaryCell = summarySheet.getCell(`A${currentRowIdx}`);
  obraSummaryCell.value = '2. DISTRIBUIÇÃO DA FROTA POR CADA OBRA';
  obraSummaryCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  obraSummaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }; // Blue
  obraSummaryCell.alignment = { vertical: 'middle', horizontal: 'left' };
  summarySheet.getRow(currentRowIdx).height = 24;

  currentRowIdx++;
  const obraHeaderRow = summarySheet.getRow(currentRowIdx);
  obraHeaderRow.values = ['Código da Obra', 'Identificação / Nome', 'Qtd de Equipamentos', '% da Frota Total', 'Aba Dedicada'];
  obraHeaderRow.height = 22;
  obraHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  currentRowIdx++;
  data.obraGroups.forEach((group) => {
    const row = summarySheet.getRow(currentRowIdx);
    const pct = data.totalEquipments > 0 ? (group.equipments.length / data.totalEquipments) * 100 : 0;
    row.values = [
      group.obraCode,
      group.obraLabel,
      group.equipments.length,
      `${pct.toFixed(1)}%`,
      `Ver aba "Obra_${sanitizeSheetName(group.obraCode)}"`,
    ];
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).font = { bold: true };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.height = 20;
    currentRowIdx++;
  });

  summarySheet.columns = [
    { width: 20 },
    { width: 30 },
    { width: 25 },
    { width: 25 },
    { width: 16 },
    { width: 24 },
    { width: 24 },
    { width: 28 },
  ];

  // ---------------------------------------------------------
  // SHEETS 2..N: Individual Sheets per Obra
  // ---------------------------------------------------------
  data.obraGroups.forEach((group) => {
    const sheetName = sanitizeSheetName(`Obra_${group.obraCode}`).substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    // Obra Sheet Title
    sheet.mergeCells('A1:K1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `MAKMO INFRAESTRUTURA • EQUIPAMENTOS: ${group.obraLabel.toUpperCase()}`;
    titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    sheet.mergeCells('A2:K2');
    const sub = sheet.getCell('A2');
    sub.value = `Posição em ${emissionDateBR} • Total nesta obra: ${group.equipments.length} máquina(s)`;
    sub.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
    sub.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 18;

    // Header Row (Sequence 1 to 9 + Horímetro + Status)
    const headers = [
      'Equipamento',
      'Placa',
      'Prefixo',
      'Modelo',
      'Marca',
      'Fornecedor',
      'Obra',
      'Chassi',
      'Data Mobilização',
      'Data Desmobilização',
      'Horímetro / KM',
      'Operador Responsável',
    ];

    const hRow = sheet.getRow(4);
    hRow.values = headers;
    hRow.height = 22;
    hRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FFF59E0B' } },
      };
    });

    group.equipments.forEach((eq, idx) => {
      const row = sheet.getRow(idx + 5);
      const mobDate = eq.mobilizationDate ? formatDateBR(eq.mobilizationDate) : '-';
      const demobDate = eq.demobilizationDate ? formatDateBR(eq.demobilizationDate) : '-';
      const meterStr = eq.currentHourMeter ? `${eq.currentHourMeter} h` : eq.currentKm ? `${eq.currentKm} km` : '-';

      row.values = [
        eq.type || '-',
        eq.plate || '-',
        eq.prefix || eq.code || '-',
        eq.model || eq.brandModel || '-',
        eq.brand || '-',
        eq.supplier || 'Frota Própria',
        eq.location || group.obraLabel,
        eq.chassis || '-',
        mobDate,
        demobDate,
        meterStr,
        eq.operator || 'Não informado',
      ];

      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(3).font = { bold: true };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(9).alignment = { horizontal: 'center' };
      row.getCell(10).alignment = { horizontal: 'right' };
      row.height = 19;
    });

    sheet.columns = [
      { width: 24 }, // Equipamento
      { width: 14 }, // Placa
      { width: 14 }, // Prefixo
      { width: 20 }, // Modelo
      { width: 18 }, // Marca
      { width: 24 }, // Fornecedor
      { width: 20 }, // Obra
      { width: 22 }, // Chassi
      { width: 20 }, // Data Desmobilização
      { width: 18 }, // Horímetro
      { width: 24 }, // Operador
    ];
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, '_').replace(/\s+/g, '_');
}

// =========================================================================
// PDF ATTACHMENT GENERATOR (Professional Multi-Page Landscape PDF)
// =========================================================================

export function generateFleetReportPdfBuffer(data: FleetReportData): Uint8Array {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const emissionDateBR = formatDateBR(getTodayDateString());

  // ---------------------------------------------------------
  // PAGE 1: Executive Summary & Full Comboio Balances
  // ---------------------------------------------------------
  // Top Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 22, 'F');

  // Makmo Brand Text
  doc.setTextColor(245, 158, 11); // Amber
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('MAKMO INFRAESTRUTURA', 14, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('• RELATÓRIO MATUTINO DIÁRIO DA FROTA E DIESEL (06:00)', 78, 11);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Data de Emissão: ${emissionDateBR} • 06:00 AM`, pageWidth - 14, 11, { align: 'right' });

  // 4 Executive KPI Cards
  const cardY = 28;
  const cardW = 63;
  const cardH = 18;

  // KPI 1: Total Equipamentos
  drawKpiCard(doc, 14, cardY, cardW, cardH, 'TOTAL DE MÁQUINAS', `${data.totalEquipments}`, 'Cadastradas na Base', [59, 130, 246]);
  // KPI 2: Total Obras
  drawKpiCard(doc, 82, cardY, cardW, cardH, 'OBRAS ATIVAS', `${data.obraGroups.length}`, 'Frentes de Serviço', [139, 92, 246]);
  // KPI 3: Total Comboios
  drawKpiCard(doc, 150, cardY, cardW, cardH, 'COMBOIOS EM OPERAÇÃO', `${data.convoys.length}`, 'Veículos de Abastecimento', [245, 158, 11]);
  // KPI 4: Saldo Total Diesel
  drawKpiCard(doc, 218, cardY, cardW, cardH, 'SALDO TOTAL DE DIESEL', `${formatLiters(data.totalConvoysBalance)} L`, 'Disponível nos Tanques', [16, 185, 129]);

  // Section Title: Comboios
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. SALDO ATUAL DE TODOS OS COMBOIOS DE TODAS AS OBRAS', 14, 53);

  // Table of Convoys
  const convoyTableData = data.convoys.map((c) => [
    c.plate,
    c.name,
    c.obra,
    c.driver || 'Não inf.',
    `${c.capacity.toLocaleString('pt-BR')} L`,
    `${formatLiters(c.entriesLiters)} L`,
    `${formatLiters(c.dispensedLiters)} L`,
    `${formatLiters(c.currentBalance)} L`,
    `${c.percentRemaining.toFixed(0)}%`,
  ]);

  autoTable(doc, {
    startY: 56,
    head: [[
      'Placa',
      'Nome do Comboio',
      'Obra',
      'Motorista',
      'Capacidade',
      'Entradas (L)',
      'Abastecimentos (L)',
      'Saldo Disponível',
      '% Nível',
    ]],
    body: convoyTableData,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      2: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'center' },
    },
    didParseCell: (data) => {
      // Colorize the balance column
      if (data.section === 'body' && data.column.index === 7) {
        data.cell.styles.textColor = [16, 185, 129]; // Emerald
      }
    },
  });

  // Section 2: Summary of Equipments by Obra on Page 1 if space permits
  const currentY = (doc as any).lastAutoTable?.finalY || 110;
  if (currentY < 140) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('2. RESUMO DA DISTRIBUIÇÃO DE EQUIPAMENTOS POR OBRA', 14, currentY + 8);

    const obraSummaryRows = data.obraGroups.map((g) => {
      const pct = data.totalEquipments > 0 ? (g.equipments.length / data.totalEquipments) * 100 : 0;
      return [g.obraCode, g.obraLabel, `${g.equipments.length} máquinas`, `${pct.toFixed(1)}%`, 'Consulte as páginas a seguir'];
    });

    autoTable(doc, {
      startY: currentY + 11,
      head: [['Código da Obra', 'Identificação / Nome da Obra', 'Qtd de Equipamentos', '% do Total', 'Detalhamento']],
      body: obraSummaryRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 1.8,
      },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        2: { halign: 'center', fontStyle: 'bold' },
        3: { halign: 'center' },
      },
    });
  }

  // ---------------------------------------------------------
  // PAGES 2..N: Complete Inventory of Equipments Separated by Each Obra
  // ---------------------------------------------------------
  data.obraGroups.forEach((group) => {
    doc.addPage('a4', 'landscape');

    // Page Top Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 18, 'F');

    doc.setTextColor(245, 158, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('MAKMO INFRAESTRUTURA', 14, 9);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`• RELAÇÃO DE EQUIPAMENTOS: ${group.obraLabel.toUpperCase()}`, 70, 9);

    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Total: ${group.equipments.length} máquinas nesta obra`, pageWidth - 14, 9, { align: 'right' });

    // Equipments Table
    const eqRows = group.equipments.map((eq) => [
      eq.type || '-',
      eq.plate || '-',
      eq.prefix || eq.code || '-',
      eq.model || eq.brandModel || '-',
      eq.brand || '-',
      eq.supplier || 'Frota Própria',
      eq.chassis || '-',
      eq.mobilizationDate ? formatDateBR(eq.mobilizationDate) : '-',
      eq.demobilizationDate ? formatDateBR(eq.demobilizationDate) : '-',
      eq.currentHourMeter ? `${eq.currentHourMeter} h` : eq.currentKm ? `${eq.currentKm} km` : '-',
      eq.operator || 'Não informado',
    ]);

    autoTable(doc, {
      startY: 23,
      head: [[
        'Equipamento',
        'Placa',
        'Prefixo',
        'Modelo',
        'Marca',
        'Fornecedor',
        'Chassi',
        'Mobilização',
        'Desmobilização',
        'Horímetro / KM',
        'Operador',
      ]],
      body: eqRows.length > 0 ? eqRows : [['Nenhum equipamento cadastrado nesta obra', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 1.6,
      },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center', fontStyle: 'bold' },
        7: { halign: 'center' },
        8: { halign: 'right' },
      },
    });

    // Page Footer
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Makmo Infraestrutura • Gestão de Frotas & Obras • ${group.obraLabel} • Posição Oficial 06:00`,
      14,
      pageHeight - 6
    );
  });

  return new Uint8Array(doc.output('arraybuffer'));
}

function drawKpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  value: string,
  subtitle: string,
  accentRgb: [number, number, number]
) {
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(x, y, w, h, 2, 2, 'S');

  // Accent bar
  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.rect(x, y, 2.5, h, 'F');

  // Title
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x + 5, y + 4.5);

  // Value
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(value, x + 5, y + 10.5);

  // Subtitle
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, x + 5, y + 15);
}

// =========================================================================
// HTML EMAIL BODY GENERATOR (Corporate Makmo Template)
// =========================================================================

export function generateFleetReportHtmlBody(data: FleetReportData): string {
  const emissionDateBR = formatDateBR(getTodayDateString());

  const convoysRowsHtml = data.convoys
    .map((c) => {
      const balanceColor = c.currentBalance >= 2000 ? '#166534' : c.currentBalance > 0 ? '#b45309' : '#991b1b';
      const balanceBg = c.currentBalance >= 2000 ? '#dcfce7' : c.currentBalance > 0 ? '#fef3c7' : '#fee2e2';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
          <td style="padding: 9px 12px; font-weight: bold; font-family: monospace; color: #0f172a;">${c.plate}${c.prefix ? ` (${c.prefix})` : ''}</td>
          <td style="padding: 9px 12px; color: #334155;">${c.name}</td>
          <td style="padding: 9px 12px; text-align: center; color: #475569;">${c.obra}</td>
          <td style="padding: 9px 12px; color: #64748b;">${c.driver || 'Não informado'}</td>
          <td style="padding: 9px 12px; text-align: right; color: #334155;">${c.capacity.toLocaleString('pt-BR')} L</td>
          <td style="padding: 9px 12px; text-align: right; font-weight: bold; color: ${balanceColor}; background-color: ${balanceBg}; border-radius: 4px;">
            ${formatLiters(c.currentBalance)} L
          </td>
          <td style="padding: 9px 12px; text-align: center; font-weight: bold; color: #475569;">${c.percentRemaining.toFixed(0)}%</td>
        </tr>
      `;
    })
    .join('');

  const obraSummaryRowsHtml = data.obraGroups
    .map((g) => {
      const pct = data.totalEquipments > 0 ? (g.equipments.length / data.totalEquipments) * 100 : 0;
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
          <td style="padding: 8px 12px; font-weight: bold; font-family: monospace; color: #1e293b;">${g.obraCode}</td>
          <td style="padding: 8px 12px; color: #334155;">${g.obraLabel}</td>
          <td style="padding: 8px 12px; text-align: center; font-weight: bold; color: #0f172a;">${g.equipments.length} máquinas</td>
          <td style="padding: 8px 12px; text-align: center; color: #64748b;">${pct.toFixed(1)}%</td>
          <td style="padding: 8px 12px; color: #059669; font-size: 11px;">✓ Separado nas planilhas anexas (Excel e PDF)</td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Makmo • Relatório Matutino da Frota (06:00)</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 24px 0;">
    <tr>
      <td align="center">
        <table width="680" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #113861; padding: 24px 28px; border-bottom: 4px solid #20b4a7;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="color: #20b4a7; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">MAKMO INFRAESTRUTURA</div>
                    <div style="color: #ffffff; font-size: 14px; font-weight: 600; margin-top: 4px;">Relatório Matutino Oficial da Frota & Saldo de Diesel</div>
                    <div style="color: #cbd5e1; font-size: 11px; margin-top: 4px;">Posição consolidada diariamente às 06:00 da Manhã • Emissão: ${emissionDateBR}</div>
                  </td>
                  <td align="right" valign="middle">
                    <span style="background-color: #20b4a7; color: #113861; font-size: 10px; font-weight: 800; padding: 5px 10px; border-radius: 20px; text-transform: uppercase;">06:00 AM</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Intro Message -->
          <tr>
            <td style="padding: 24px 28px 12px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Prezado(a) gestor(a), segue a posição matutina diária da frota e estoque de diesel da <strong>Makmo Infraestrutura</strong> para todas as obras ativas.
              </p>

              <!-- KPI Metric Cards Grid -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="24%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #3b82f6; border-radius: 8px; padding: 12px;">
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Total Máquinas</div>
                    <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">${data.totalEquipments}</div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Todas as obras</div>
                  </td>
                  <td width="1%"></td>
                  <td width="24%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #8b5cf6; border-radius: 8px; padding: 12px;">
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Obras Ativas</div>
                    <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">${data.obraGroups.length}</div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Frentes de serviço</div>
                  </td>
                  <td width="1%"></td>
                  <td width="24%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #20b4a7; border-radius: 8px; padding: 12px;">
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Comboios</div>
                    <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">${data.convoys.length}</div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Tanques móveis</div>
                  </td>
                  <td width="1%"></td>
                  <td width="24%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #10b981; border-radius: 8px; padding: 12px;">
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Saldo Total Diesel</div>
                    <div style="font-size: 17px; font-weight: 800; color: #15803d; margin-top: 4px;">${formatLiters(data.totalConvoysBalance)} L</div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Disponível agora</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Table 1: Saldo de Todos os Comboios -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <div style="font-size: 13px; font-weight: 800; color: #113861; text-transform: uppercase; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #20b4a7;">
                ⛽ Saldo Atual de Todos os Comboios (Todas as Obras)
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #113861; color: #ffffff; font-size: 11px; text-transform: uppercase;">
                    <th style="padding: 8px 12px; text-align: left;">Placa</th>
                    <th style="padding: 8px 12px; text-align: left;">Nome</th>
                    <th style="padding: 8px 12px; text-align: center;">Obra</th>
                    <th style="padding: 8px 12px; text-align: left;">Motorista</th>
                    <th style="padding: 8px 12px; text-align: right;">Capacidade</th>
                    <th style="padding: 8px 12px; text-align: right;">Saldo Atual</th>
                    <th style="padding: 8px 12px; text-align: center;">Nível</th>
                  </tr>
                </thead>
                <tbody>
                  ${convoysRowsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Table 2: Equipamentos por Obra -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <div style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #3b82f6;">
                🚜 Relação de Equipamentos Separados por Cada Obra
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #1e293b; color: #ffffff; font-size: 11px; text-transform: uppercase;">
                    <th style="padding: 8px 12px; text-align: left;">Código</th>
                    <th style="padding: 8px 12px; text-align: left;">Obra / Localização</th>
                    <th style="padding: 8px 12px; text-align: center;">Qtd Máquinas</th>
                    <th style="padding: 8px 12px; text-align: center;">% Total</th>
                    <th style="padding: 8px 12px; text-align: left;">Inventário Completo</th>
                  </tr>
                </thead>
                <tbody>
                  ${obraSummaryRowsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Attachments Banner -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px;">
                <tr>
                  <td>
                    <div style="font-size: 13px; font-weight: bold; color: #1e40af;">📎 Arquivos Anexos Inclusos neste E-mail:</div>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 12px; color: #1e3a8a; line-height: 1.5;">
                      <li><strong>Planilha Microsoft Excel (.xlsx)</strong>: Contém abas separadas para cada obra com todas as colunas de equipamentos (Placa, Prefixo, Modelo, Marca, Fornecedor, Chassi, Desmobilização, Horímetro, Operador), além da aba de Saldo de Comboios.</li>
                      <li><strong>Documento PDF (.pdf)</strong>: Relatório executivo diagramado em alta resolução, com páginas e seções separadas para cada obra e tabela de estoque de diesel.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 28px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
              <div>Este e-mail é gerado automaticamente todos os dias às 06:00 pelo <strong>Sistema Makmo de Gestão de Frotas & Obras</strong>.</div>
              <div style="margin-top: 4px;">Configurado e administrado com acesso restrito via perfil Administrador • Integração oficial via Google Workspace / Gmail API.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// =========================================================================
// RFC 2822 MIME ENCODER & GMAIL SENDER
// =========================================================================

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function toBase64UrlFromUtf8String(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Builds the RFC 2822 MIME multipart message with HTML body and base64 Excel/PDF attachments.
 */
export function buildMimeMessage(
  fromEmail: string,
  toRecipients: string[],
  subject: string,
  htmlContent: string,
  excelAttachment: { filename: string; bytes: Uint8Array },
  pdfAttachment: { filename: string; bytes: Uint8Array }
): string {
  const boundary = `====_MakmoFleet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}====`;

  const excelBase64 = toBase64(excelAttachment.bytes);
  const pdfBase64 = toBase64(pdfAttachment.bytes);

  const recipientsHeader = toRecipients.join(', ');

  const mimeLines = [
    `From: ${fromEmail}`,
    `To: ${recipientsHeader}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    htmlContent,
    ``,
    `--${boundary}`,
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="${excelAttachment.filename}"`,
    `Content-Disposition: attachment; filename="${excelAttachment.filename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    excelBase64,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfAttachment.filename}"`,
    `Content-Disposition: attachment; filename="${pdfAttachment.filename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    pdfBase64,
    ``,
    `--${boundary}--`,
  ];

  return mimeLines.join('\r\n');
}

/**
 * Sends the automated Fleet and Diesel report via Gmail API.
 */
export async function sendDailyFleetReport(options: {
  equipments: Equipment[];
  entries: FuelEntry[];
  dispenses: FuelDispense[];
  projects?: AppProject[];
  config?: GmailIntegrationConfig;
  forcedToken?: string;
}): Promise<GmailSendResult> {
  const config = options.config || getStoredGmailConfig();
  const token = options.forcedToken || cachedAccessToken;

  if (!token) {
    throw new Error(
      'Não há conta Google/Gmail autenticada com permissão para envio de e-mails. Conecte sua conta do Gmail no painel de administração.'
    );
  }

  // Build recipients list: Primary + Additional
  const recipientsSet = new Set<string>();
  if (config.primaryEmail && config.primaryEmail.trim()) {
    recipientsSet.add(config.primaryEmail.trim().toLowerCase());
  } else {
    recipientsSet.add('roberto.junior@makmo.com.br');
  }

  (config.additionalEmails || []).forEach((em) => {
    if (em && em.trim()) {
      recipientsSet.add(em.trim().toLowerCase());
    }
  });

  const recipients = Array.from(recipientsSet);
  if (recipients.length === 0) {
    throw new Error('Nenhum destinatário de e-mail foi configurado.');
  }

  // Compile Report Data
  const reportData = compileFleetReportData(
    options.equipments,
    options.entries,
    options.dispenses,
    options.projects
  );

  const todayStr = getTodayDateString();
  const todayBR = formatDateBR(todayStr);

  // Generate Files
  const excelBytes = await generateFleetReportExcelBuffer(reportData);
  const pdfBytes = generateFleetReportPdfBuffer(reportData);

  const excelFilename = `Makmo_Frota_e_Comboios_${todayStr}.xlsx`;
  const pdfFilename = `Makmo_Relatorio_Frota_e_Comboios_${todayStr}.pdf`;

  const htmlBody = generateFleetReportHtmlBody(reportData);
  const senderEmail = config.senderEmail || cachedGoogleUser?.email || 'me';

  const subject = `Makmo • Relatório Matutino da Frota e Saldo de Comboios - ${todayBR}`;

  const rawMime = buildMimeMessage(
    senderEmail,
    recipients,
    subject,
    htmlBody,
    { filename: excelFilename, bytes: excelBytes },
    { filename: pdfFilename, bytes: pdfBytes }
  );

  const rawBase64Url = toBase64UrlFromUtf8String(rawMime);

  // Send via Gmail REST API
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: rawBase64Url,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg =
      errorData?.error?.message ||
      `Erro ${response.status} ao enviar e-mail via Gmail API. Verifique a autorização da conta.`;

    // Update status to error
    await saveGmailConfig({
      ...config,
      lastStatus: 'error',
      lastLog: `Falha no envio em ${new Date().toLocaleString('pt-BR')}: ${errorMsg}`,
    });

    throw new Error(errorMsg);
  }

  const resultData = await response.json();
  const nowIso = new Date().toISOString();

  // Update success status and record lastSentDate
  await saveGmailConfig({
    ...config,
    lastSentDate: todayStr,
    lastSentAt: nowIso,
    lastStatus: 'success',
    lastLog: `Relatório matutino enviado com sucesso em ${new Date().toLocaleString('pt-BR')} para ${recipients.join(', ')} (ID: ${resultData.id})`,
  });

  return {
    success: true,
    message: `Relatório da frota e saldo de comboios enviado com sucesso para ${recipients.join(', ')}!`,
    messageId: resultData.id,
    recipients,
    sentAt: nowIso,
    details: {
      totalEquipments: reportData.totalEquipments,
      totalConvoys: reportData.convoys.length,
      obrasCount: reportData.obraGroups.length,
    },
  };
}
