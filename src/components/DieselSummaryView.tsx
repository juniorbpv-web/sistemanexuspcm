import React, { useState, useMemo, useEffect } from 'react';
import { FuelEntry, FuelDispense, ConvoyPlate, Equipment, AppProject } from '../types';
import {
  formatDateBR,
  formatHours,
  formatLiters,
  formatCurrency,
  parseCurrencyInput,
  getTodayDateString,
  exportFuelReportToCSV,
} from '../utils/storage';
import { exportFuelReportToExcel, exportFuelEntriesToExcel } from '../utils/excelFuelExport';
import {
  Fuel,
  TrendingDown,
  TrendingUp,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  Download,
  Filter,
  Search,
  DollarSign,
  Truck,
  Building2,
  BarChart3,
  CheckCircle2,
  Activity,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  Clock,
  LineChart as LineChartIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
  RotateCcw,
  Edit2,
  X,
  Paperclip,
  FileText,
  FileImage,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  ShieldAlert,
  UploadCloud,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { verifyDeveloperPassword } from '../services/authService';
import {
  validateInvoiceFile,
  readFileAsDataURL,
  formatFileSize,
  triggerFileDownload,
  getInvoiceFileFromIndexedDB,
} from '../services/fuelFilesService';
import { CONVOY_LIST } from '../data/initialData';
import { exportFuelEntriesToPDF, exportConsolidatedDispensesToPDF } from '../utils/pdfFuelExport';
import { UserRole } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
  LabelList,
} from 'recharts';
import { normalizeProjectCode, matchesSelectedProject, loadAppProjects } from '../utils/authStorage';

export type StockCardTheme = 'orange' | 'amber' | 'navy' | 'neutral' | 'blue' | 'emerald';

interface DieselSummaryViewProps {
  entries: FuelEntry[];
  dispenses: FuelDispense[];
  allDispenses?: FuelDispense[];
  allEntries?: FuelEntry[];
  projects?: AppProject[];
  selectedProject?: string;
  equipments?: Equipment[];
  onSaveEntry: (entry: Omit<FuelEntry, 'id' | 'createdAt'>) => { success: boolean; message: string };
  onUpdateEntry?: (entry: FuelEntry) => { success: boolean; message: string };
  onDeleteEntry: (id: string) => void;
  onUpdateDispense?: (dispense: FuelDispense) => { success: boolean; message: string };
  onDeleteDispense: (id: string) => void;
  onExportCSV: () => void;
  onResetFuelData?: () => void;
  onRestoreFuelDefaults?: () => void;
  userRole?: UserRole;
  userName?: string;
}

export const DieselSummaryView: React.FC<DieselSummaryViewProps> = ({
  entries,
  dispenses,
  allDispenses,
  allEntries,
  projects,
  selectedProject = 'all',
  equipments = [],
  onSaveEntry,
  onUpdateEntry,
  onDeleteEntry,
  onUpdateDispense,
  onDeleteDispense,
  onExportCSV,
  onResetFuelData,
  onRestoreFuelDefaults,
  userRole = 'developer',
  userName,
}) => {
  const isDeveloper = userRole === 'developer';
  // Ações: opção Editar apenas para o Administrador Roberto Junior
  const isRobertoJuniorAdmin =
    userRole === 'admin' ||
    userRole === 'developer' ||
    (userName ? /roberto/i.test(userName) || /admin/i.test(userName) : false);
  // Date filter for position / balance
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetDevPassword, setResetDevPassword] = useState('');
  const [showResetDevPassword, setShowResetDevPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  const handleConfirmReset = () => {
    if (!resetDevPassword.trim()) {
      setResetPasswordError('Por favor, informe a senha de desenvolvedor.');
      return;
    }

    const isValid = verifyDeveloperPassword(resetDevPassword);
    if (!isValid) {
      setResetPasswordError('Senha de desenvolvedor incorreta. Acesso negado para zerar os lançamentos.');
      return;
    }

    if (onResetFuelData) {
      onResetFuelData();
    }
    setIsResetConfirmOpen(false);
    setResetDevPassword('');
    setShowResetDevPassword(false);
    setResetPasswordError(null);
  };

  // New Entry Form State
  const [entryDate, setEntryDate] = useState(getTodayDateString());
  const [entryLiters, setEntryLiters] = useState<string>('');
  const [entryTotalValue, setEntryTotalValue] = useState<string>('');
  const [entrySupplier, setEntrySupplier] = useState('');
  const [entryInvoice, setEntryInvoice] = useState('');
  const [entryDestination, setEntryDestination] = useState('Tanque Central');
  const [entryResponsible, setEntryResponsible] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [entryError, setEntryError] = useState<string | null>(null);

  // Confirmation modals
  const [entryToDelete, setEntryToDelete] = useState<FuelEntry | null>(null);
  const [dispenseToDelete, setDispenseToDelete] = useState<FuelDispense | null>(null);

  // Attachment states
  const [entryAttachment, setEntryAttachment] = useState<{
    url: string;
    name: string;
    type: 'PDF' | 'JPEG' | 'JPG';
    size: number;
  } | null>(null);
  const [editEntryAttachment, setEditEntryAttachment] = useState<{
    url: string;
    name: string;
    type: 'PDF' | 'JPEG' | 'JPG';
    size: number;
  } | null>(null);

  // Modal de Salvar Valor Total e Anexo de Arquivo da Entrada
  const [attachingEntry, setAttachingEntry] = useState<FuelEntry | null>(null);
  const [selectedAttachFile, setSelectedAttachFile] = useState<File | null>(null);
  const [attachTotalValue, setAttachTotalValue] = useState('');
  const [attachInvoiceNumber, setAttachInvoiceNumber] = useState('');
  const [attachRemoveCurrentFile, setAttachRemoveCurrentFile] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [isSavingAttachment, setIsSavingAttachment] = useState(false);

  // Attachment viewer modal
  const [viewingAttachment, setViewingAttachment] = useState<{
    url: string;
    name: string;
    type: 'PDF' | 'JPEG' | 'JPG';
    size?: number;
    date?: string;
    entryId?: string;
  } | null>(null);
  const [viewerZoom, setViewerZoom] = useState(100);
  const [viewerRotation, setViewerRotation] = useState(0);

  // Estados da Aba de Filtro para o Histórico Consolidado de Saídas
  const [dispenseFilterConvoy, setDispenseFilterConvoy] = useState<string>('ALL');
  const [dispenseFilterStartDate, setDispenseFilterStartDate] = useState<string>('');
  const [dispenseFilterEndDate, setDispenseFilterEndDate] = useState<string>('');
  const [dispenseFilterSearch, setDispenseFilterSearch] = useState<string>('');
  const [dispenseFilterObra, setDispenseFilterObra] = useState<string>('ALL');
  const [dispenseFilterType, setDispenseFilterType] = useState<string>('ALL');

  // Paginação da tabela de Histórico Consolidado de Saídas (Sequência de 50 em 50)
  const [dispenseCurrentPage, setDispenseCurrentPage] = useState<number>(1);
  const [dispensePageSize, setDispensePageSize] = useState<number>(50); // Padrão 50 registros por página

  // Resetar para a primeira página sempre que os filtros ou o tamanho da página forem alterados
  useEffect(() => {
    setDispenseCurrentPage(1);
  }, [
    dispenseFilterConvoy,
    dispenseFilterStartDate,
    dispenseFilterEndDate,
    dispenseFilterSearch,
    dispenseFilterObra,
    dispenseFilterType,
    dispensePageSize,
  ]);

  // Cor fixa no Card de Estoque: Tradicional Laranja Makmo de máxima visualização
  const stockCardTheme: StockCardTheme = 'orange';

  const handleOpenAttachAndValueModal = (ent: FuelEntry) => {
    setAttachingEntry(ent);
    setSelectedAttachFile(null);
    setAttachError(null);
    setAttachRemoveCurrentFile(false);
    setAttachTotalValue(
      ent.totalValue !== undefined && ent.totalValue !== null
        ? String(ent.totalValue).replace('.', ',')
        : ''
    );
    setAttachInvoiceNumber(ent.invoiceNumber || '');

    // Se a entrada tem um anexo mas a dataUrl não estava em memória, recupera do IndexedDB
    if (!ent.attachmentUrl && ent.attachmentName) {
      getInvoiceFileFromIndexedDB(`file_entry_${ent.id}`).then((cached) => {
        if (cached?.dataUrl) {
          setAttachingEntry((prev) => (prev && prev.id === ent.id ? { ...prev, attachmentUrl: cached.dataUrl } : prev));
        }
      });
    }
  };

  const handleSelectFileForAttach = (file: File) => {
    setAttachError(null);
    const validation = validateInvoiceFile(file);
    if (!validation.valid) {
      setAttachError(validation.error || 'Formato de arquivo não suportado. Aceito exclusivamente arquivos PDF, JPG ou JPEG.');
      setSelectedAttachFile(null);
      return;
    }
    setSelectedAttachFile(file);
    setAttachRemoveCurrentFile(false);
  };

  const handleConfirmAttachFile = async () => {
    if (!attachingEntry) return;
    setIsSavingAttachment(true);
    setAttachError(null);
    try {
      let dataUrl = attachingEntry.attachmentUrl;
      let fileName = attachingEntry.attachmentName;
      let fileType = attachingEntry.attachmentType;
      let fileSize = attachingEntry.attachmentSize;

      // Se o usuário marcou para remover o anexo atual
      if (attachRemoveCurrentFile && !selectedAttachFile) {
        dataUrl = undefined;
        fileName = undefined;
        fileType = undefined;
        fileSize = undefined;
      }

      // Se não marcou remoção e o anexo existe mas não estava em memória, tenta recuperar do IndexedDB
      if (!dataUrl && fileName && !attachRemoveCurrentFile) {
        try {
          const cached = await getInvoiceFileFromIndexedDB(`file_entry_${attachingEntry.id}`);
          if (cached?.dataUrl) {
            dataUrl = cached.dataUrl;
          }
        } catch {}
      }

      // Se selecionou um novo arquivo
      if (selectedAttachFile) {
        const validation = validateInvoiceFile(selectedAttachFile);
        if (!validation.valid) {
          setAttachError(validation.error || 'Formato de arquivo não suportado. Aceito exclusivamente arquivos PDF, JPG ou JPEG.');
          setIsSavingAttachment(false);
          return;
        }
        dataUrl = await readFileAsDataURL(selectedAttachFile);
        fileName = selectedAttachFile.name;
        fileType = validation.fileType;
        fileSize = selectedAttachFile.size;
      }

      const parsedTotal = parseCurrencyInput(attachTotalValue);
      const computedUnitPrice =
        parsedTotal && attachingEntry.liters > 0
          ? Number((parsedTotal / attachingEntry.liters).toFixed(4))
          : undefined;

      const cleanInvoice = attachInvoiceNumber.trim();

      const updatedEntry: FuelEntry = {
        ...attachingEntry,
        totalValue: parsedTotal,
        unitPrice: computedUnitPrice,
        invoiceNumber: cleanInvoice ? cleanInvoice : (attachingEntry.invoiceNumber || 'S/N'),
        attachmentUrl: dataUrl,
        attachmentName: fileName,
        attachmentType: fileType,
        attachmentSize: fileSize,
      };

      if (onUpdateEntry) {
        const res = onUpdateEntry(updatedEntry);
        if (res && res.success === false) {
          setAttachError(res.message);
          setIsSavingAttachment(false);
          return;
        }
      }

      setAttachingEntry(null);
      setSelectedAttachFile(null);
      setAttachRemoveCurrentFile(false);
    } catch (err: any) {
      setAttachError(err?.message || 'Erro ao processar e salvar. Tente novamente.');
    } finally {
      setIsSavingAttachment(false);
    }
  };

  const handleRemoveAttachmentFromEntry = (entry: FuelEntry) => {
    setAttachRemoveCurrentFile(true);
    setSelectedAttachFile(null);
  };

  // Edit modals state (Developer only)
  const [entryToEdit, setEntryToEdit] = useState<FuelEntry | null>(null);
  const [editEntryDate, setEditEntryDate] = useState('');
  const [editEntryLiters, setEditEntryLiters] = useState('');
  const [editEntryTotalValue, setEditEntryTotalValue] = useState('');
  const [editEntrySupplier, setEditEntrySupplier] = useState('');
  const [editEntryInvoice, setEditEntryInvoice] = useState('');
  const [editEntryDestination, setEditEntryDestination] = useState('Tanque Central');
  const [editEntryResponsible, setEditEntryResponsible] = useState('');
  const [editEntryNotes, setEditEntryNotes] = useState('');
  const [editEntryError, setEditEntryError] = useState<string | null>(null);

  const handleStartEditEntry = (ent: FuelEntry) => {
    if (!isRobertoJuniorAdmin) return;
    setEntryToEdit(ent);
    setEditEntryDate(ent.date);
    setEditEntryLiters(String(ent.liters));
    setEditEntryTotalValue(ent.totalValue !== undefined && ent.totalValue !== null ? String(ent.totalValue).replace('.', ',') : '');
    setEditEntrySupplier(ent.supplier || '');
    setEditEntryInvoice(ent.invoiceNumber || '');
    setEditEntryDestination(ent.destination || 'Tanque Central');
    setEditEntryResponsible(ent.responsible || '');
    setEditEntryNotes(ent.notes || '');
    setEditEntryError(null);
    if (ent.attachmentUrl) {
      setEditEntryAttachment({
        url: ent.attachmentUrl,
        name: ent.attachmentName || 'Anexo',
        type: ent.attachmentType || 'PDF',
        size: ent.attachmentSize || 0,
      });
    } else {
      setEditEntryAttachment(null);
    }
  };

  const handleSaveEditEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryToEdit || !isRobertoJuniorAdmin) return;
    setEditEntryError(null);

    const l = parseFloat(editEntryLiters.replace(',', '.'));
    if (!l || isNaN(l) || l <= 0) {
      setEditEntryError('Informe uma litragem válida maior que zero.');
      return;
    }

    const parsedEditTotal = parseCurrencyInput(editEntryTotalValue);
    const editUnitP = parsedEditTotal && l > 0 ? Number((parsedEditTotal / l).toFixed(4)) : undefined;

    if (onUpdateEntry) {
      const res = onUpdateEntry({
        ...entryToEdit,
        date: editEntryDate,
        liters: l,
        totalValue: parsedEditTotal,
        unitPrice: editUnitP,
        supplier: editEntrySupplier || 'Distribuidora Regional',
        invoiceNumber: editEntryInvoice || 'S/N',
        destination: editEntryDestination,
        responsible: editEntryResponsible || 'Operador Responsável',
        notes: editEntryNotes,
        attachmentUrl: editEntryAttachment?.url,
        attachmentName: editEntryAttachment?.name,
        attachmentType: editEntryAttachment?.type,
        attachmentSize: editEntryAttachment?.size,
      });

      if (res && res.success === false) {
        setEditEntryError(res.message);
        return;
      }
    }

    setEntryToEdit(null);
  };

  const [dispenseToEdit, setDispenseToEdit] = useState<FuelDispense | null>(null);
  const [editDispenseEquipmentCode, setEditDispenseEquipmentCode] = useState('');
  const [editDispenseConvoyPlate, setEditDispenseConvoyPlate] = useState<ConvoyPlate>('RTW1C01');
  const [editDispenseDate, setEditDispenseDate] = useState('');
  const [editDispenseInitialMeter, setEditDispenseInitialMeter] = useState('');
  const [editDispenseFinalMeter, setEditDispenseFinalMeter] = useState('');
  const [editDispenseEquipmentMeter, setEditDispenseEquipmentMeter] = useState('');
  const [editDispenseMeterUnit, setEditDispenseMeterUnit] = useState<'HORAS' | 'KM'>('HORAS');
  const [editDispenseOperator, setEditDispenseOperator] = useState('');
  const [editDispenseNotes, setEditDispenseNotes] = useState('');
  const [editDispenseError, setEditDispenseError] = useState<string | null>(null);

  const handleStartEditDispense = (disp: FuelDispense) => {
    setDispenseToEdit(disp);
    setEditDispenseEquipmentCode(disp.equipmentCode);
    setEditDispenseConvoyPlate(disp.convoyPlate);
    setEditDispenseDate(disp.date);
    setEditDispenseInitialMeter(String(disp.initialMeter));
    setEditDispenseFinalMeter(String(disp.finalMeter));
    setEditDispenseEquipmentMeter(disp.equipmentMeter !== undefined ? String(disp.equipmentMeter) : '');
    setEditDispenseMeterUnit(disp.equipmentMeterUnit || 'HORAS');
    setEditDispenseOperator(disp.operator || '');
    setEditDispenseNotes(disp.notes || '');
    setEditDispenseError(null);
  };

  const handleSaveEditDispense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispenseToEdit) return;
    setEditDispenseError(null);

    const initVal = parseFloat(editDispenseInitialMeter.replace(',', '.'));
    const finVal = parseFloat(editDispenseFinalMeter.replace(',', '.'));

    if (isNaN(initVal) || initVal < 0) {
      setEditDispenseError('Informe uma leitura inicial válida para a bomba.');
      return;
    }
    if (isNaN(finVal) || finVal < 0) {
      setEditDispenseError('Informe uma leitura final (encerrante) válida.');
      return;
    }
    if (finVal < initVal) {
      setEditDispenseError(`A leitura final (${finVal}) não pode ser menor que a inicial (${initVal}).`);
      return;
    }

    const calculatedLiters = Number((finVal - initVal).toFixed(2));
    const eqMeterVal = editDispenseEquipmentMeter.trim() !== '' ? parseFloat(editDispenseEquipmentMeter.replace(',', '.')) : undefined;

    const cleanCode = editDispenseEquipmentCode.trim().toUpperCase().replace(/[-\s]/g, '');
    const matchedEq = equipments.find((eq) => {
      const pClean = (eq.plate || '').toUpperCase().replace(/[-\s]/g, '');
      const prClean = (eq.prefix || '').toUpperCase().replace(/[-\s]/g, '');
      const cClean = (eq.code || '').toUpperCase().replace(/[-\s]/g, '');
      return pClean === cleanCode || prClean === cleanCode || cClean === cleanCode;
    });

    const machinePlate = matchedEq?.plate || matchedEq?.code || matchedEq?.prefix || editDispenseEquipmentCode.trim().toUpperCase();

    if (onUpdateDispense) {
      const res = onUpdateDispense({
        ...dispenseToEdit,
        convoyPlate: editDispenseConvoyPlate,
        equipmentCode: machinePlate,
        equipmentType: matchedEq?.type || dispenseToEdit.equipmentType,
        equipmentId: matchedEq?.id || dispenseToEdit.equipmentId,
        supplier: matchedEq?.supplier || dispenseToEdit.supplier || 'Frota Própria',
        location: matchedEq?.location || dispenseToEdit.location || 'Não informada',
        date: editDispenseDate,
        initialMeter: initVal,
        finalMeter: finVal,
        liters: calculatedLiters,
        equipmentMeter: eqMeterVal !== undefined && !isNaN(eqMeterVal) ? eqMeterVal : undefined,
        equipmentMeterUnit: editDispenseMeterUnit,
        operator: editDispenseOperator.trim() || matchedEq?.operator || 'Não informado',
        notes: editDispenseNotes.trim(),
      });

      if (res && res.success === false) {
        setEditDispenseError(res.message);
        return;
      }
    }

    setDispenseToEdit(null);
  };

  // Filtered entries and dispenses by date if selected
  const filteredEntries = useMemo(() => {
    if (!selectedDate) return entries;
    return entries.filter((e) => e.date <= selectedDate);
  }, [entries, selectedDate]);

  const filteredDispenses = useMemo(() => {
    if (!selectedDate) return dispenses;
    return dispenses.filter((d) => d.date <= selectedDate);
  }, [dispenses, selectedDate]);

  // Aggregate Calculations
  const metrics = useMemo(() => {
    const totalEntries = filteredEntries.reduce((acc, curr) => acc + (curr.liters || 0), 0);
    const totalDispenses = filteredDispenses.reduce((acc, curr) => acc + (curr.liters || 0), 0);
    const totalMoved = totalEntries + totalDispenses;
    const balance = totalEntries - totalDispenses;

    // By Convoy breakdowns
    const rtwDispenses = filteredDispenses.filter((d) => d.convoyPlate === 'RTW1C01');
    const dzaDispenses = filteredDispenses.filter((d) => d.convoyPlate === 'DZA7G30');
    const spfDispenses = filteredDispenses.filter((d) => d.convoyPlate === 'SPF2C66' || (d.convoyPlate as string) === 'SFC2C66');

    const rtwLiters = rtwDispenses.reduce((acc, curr) => acc + (curr.liters || 0), 0);
    const dzaLiters = dzaDispenses.reduce((acc, curr) => acc + (curr.liters || 0), 0);
    const spfLiters = spfDispenses.reduce((acc, curr) => acc + (curr.liters || 0), 0);

    const rtwEntries = filteredEntries
      .filter((e) => e.destination && e.destination.includes('RTW1C01'))
      .reduce((acc, curr) => acc + (curr.liters || 0), 0);
    const dzaEntries = filteredEntries
      .filter((e) => e.destination && e.destination.includes('DZA7G30'))
      .reduce((acc, curr) => acc + (curr.liters || 0), 0);
    const spfEntries = filteredEntries
      .filter((e) => e.destination && (e.destination.includes('SPF2C66') || e.destination.includes('SFC2C66')))
      .reduce((acc, curr) => acc + (curr.liters || 0), 0);

    const rtwBalance = Number((rtwEntries - rtwLiters).toFixed(1));
    const dzaBalance = Number((dzaEntries - dzaLiters).toFixed(1));
    const spfBalance = Number((spfEntries - spfLiters).toFixed(1));

    return {
      totalEntries: Number(totalEntries.toFixed(1)),
      totalDispenses: Number(totalDispenses.toFixed(1)),
      totalMoved: Number(totalMoved.toFixed(1)),
      balance: Number(balance.toFixed(1)),
      rtwLiters: Number(rtwLiters.toFixed(1)),
      dzaLiters: Number(dzaLiters.toFixed(1)),
      spfLiters: Number(spfLiters.toFixed(1)),
      rtwEntries: Number(rtwEntries.toFixed(1)),
      dzaEntries: Number(dzaEntries.toFixed(1)),
      spfEntries: Number(spfEntries.toFixed(1)),
      rtwBalance,
      dzaBalance,
      spfBalance,
      rtwCount: rtwDispenses.length,
      dzaCount: dzaDispenses.length,
      spfCount: spfDispenses.length,
    };
  }, [filteredEntries, filteredDispenses]);

  // Lista de Comboios disponíveis para a aba de filtro
  const availableConvoys = useMemo(() => {
    const list: string[] = CONVOY_LIST.map((c) => c.plate);
    dispenses.forEach((d) => {
      if (d.convoyPlate && !list.includes(d.convoyPlate)) {
        list.push(d.convoyPlate);
      }
    });
    return list;
  }, [dispenses]);

  // Lista de Obras disponíveis para filtro
  const availableObras = useMemo(() => {
    const set = new Set<string>();
    filteredDispenses.forEach((d) => {
      const equip = equipments.find(
        (eq) =>
          (eq.plate && eq.plate.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase()) ||
          eq.code.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase() ||
          (eq.prefix && eq.prefix.trim().toUpperCase() === d.equipmentCode.trim().toUpperCase())
      );
      const loc = d.location || equip?.location;
      if (loc && loc.trim()) set.add(loc.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filteredDispenses, equipments]);

  // Lista de Tipos de Máquina para filtro
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    filteredDispenses.forEach((d) => {
      if (d.equipmentType && d.equipmentType.trim()) {
        set.add(d.equipmentType.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filteredDispenses]);

  // Contadores por Comboio para as abas
  const convoyCounts = useMemo(() => {
    const counts: Record<string, { count: number; liters: number }> = {
      ALL: {
        count: filteredDispenses.length,
        liters: filteredDispenses.reduce((acc, curr) => acc + (Number(curr.liters) || 0), 0),
      },
    };
    availableConvoys.forEach((convoy) => {
      const list = filteredDispenses.filter((d) => d.convoyPlate === convoy);
      counts[convoy] = {
        count: list.length,
        liters: list.reduce((acc, curr) => acc + (Number(curr.liters) || 0), 0),
      };
    });
    return counts;
  }, [filteredDispenses, availableConvoys]);

  // Registros do Histórico Consolidado após aplicar a aba de comboio e os filtros adicionais
  const tableFilteredDispenses = useMemo(() => {
    return filteredDispenses.filter((disp) => {
      // 1. Aba de Comboio
      if (dispenseFilterConvoy !== 'ALL' && disp.convoyPlate !== dispenseFilterConvoy) {
        return false;
      }
      // 2. Data Inicial
      if (dispenseFilterStartDate && disp.date < dispenseFilterStartDate) {
        return false;
      }
      // 3. Data Final
      if (dispenseFilterEndDate && disp.date > dispenseFilterEndDate) {
        return false;
      }
      // 4. Obra
      if (dispenseFilterObra !== 'ALL') {
        const equip = equipments.find(
          (eq) =>
            (eq.plate && eq.plate.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase()) ||
            eq.code.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase() ||
            (eq.prefix && eq.prefix.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase())
        );
        const equipObra = disp.location || equip?.location || '';
        if (equipObra !== dispenseFilterObra) {
          return false;
        }
      }
      // 5. Tipo de Máquina
      if (dispenseFilterType !== 'ALL') {
        if (disp.equipmentType !== dispenseFilterType) {
          return false;
        }
      }
      // 6. Campo de Busca rápida
      if (dispenseFilterSearch.trim()) {
        const q = dispenseFilterSearch.trim().toUpperCase();
        const equip = equipments.find(
          (eq) =>
            (eq.plate && eq.plate.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase()) ||
            eq.code.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase() ||
            (eq.prefix && eq.prefix.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase())
        );
        const equipObra = disp.location || equip?.location || '';
        const matchPlate = disp.equipmentCode.toUpperCase().includes(q);
        const matchPrefix = equip?.prefix ? equip.prefix.toUpperCase().includes(q) : false;
        const matchType = disp.equipmentType ? disp.equipmentType.toUpperCase().includes(q) : false;
        const matchOp = disp.operator ? disp.operator.toUpperCase().includes(q) : false;
        const matchNotes = disp.notes ? disp.notes.toUpperCase().includes(q) : false;
        const matchSupplier = disp.supplier ? disp.supplier.toUpperCase().includes(q) : false;
        const matchObra = equipObra.toUpperCase().includes(q);

        if (!matchPlate && !matchPrefix && !matchType && !matchOp && !matchNotes && !matchSupplier && !matchObra) {
          return false;
        }
      }

      return true;
    });
  }, [
    filteredDispenses,
    dispenseFilterConvoy,
    dispenseFilterStartDate,
    dispenseFilterEndDate,
    dispenseFilterObra,
    dispenseFilterType,
    dispenseFilterSearch,
    equipments,
  ]);

  // Subtotal de litros da tabela filtrada
  const tableFilteredDispensesLiters = useMemo(() => {
    return tableFilteredDispenses.reduce((acc, curr) => acc + (Number(curr.liters) || 0), 0);
  }, [tableFilteredDispenses]);

  // Paginação de 50 em 50 para os abastecimentos consolidados
  const dispenseTotalPages = useMemo(() => {
    if (dispensePageSize <= 0) return 1;
    return Math.max(1, Math.ceil(tableFilteredDispenses.length / dispensePageSize));
  }, [tableFilteredDispenses.length, dispensePageSize]);

  // Garantir página atual válida dentro dos limites
  const safeCurrentPage = Math.min(Math.max(1, dispenseCurrentPage), dispenseTotalPages);

  // Registros fatiados para a página atual (50 por página por padrão)
  const paginatedDispenses = useMemo(() => {
    if (dispensePageSize <= 0) return tableFilteredDispenses;
    const startIndex = (safeCurrentPage - 1) * dispensePageSize;
    return tableFilteredDispenses.slice(startIndex, startIndex + dispensePageSize);
  }, [tableFilteredDispenses, safeCurrentPage, dispensePageSize]);

  // Subtotal de litros apenas dos registros exibidos na página atual
  const paginatedDispensesLiters = useMemo(() => {
    return paginatedDispenses.reduce((acc, curr) => acc + (Number(curr.liters) || 0), 0);
  }, [paginatedDispenses]);

  // Índices para o indicador "Mostrando X a Y de Z abastecimentos"
  const startRecordIndex =
    tableFilteredDispenses.length === 0
      ? 0
      : (safeCurrentPage - 1) * (dispensePageSize || tableFilteredDispenses.length) + 1;
  const endRecordIndex =
    dispensePageSize <= 0
      ? tableFilteredDispenses.length
      : Math.min(safeCurrentPage * dispensePageSize, tableFilteredDispenses.length);

  // Gerador de sequência numérica de páginas com reticências para navegação fluida
  const getPageNumbersSequence = (current: number, total: number) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [];
    pages.push(1);
    if (current > 3) {
      pages.push('ellipsis');
    }
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < total - 2) {
      pages.push('ellipsis');
    }
    pages.push(total);
    return pages;
  };

  // Indicador se há filtros adicionais além de 'ALL'
  const hasActiveDispenseFilters =
    dispenseFilterConvoy !== 'ALL' ||
    Boolean(dispenseFilterStartDate) ||
    Boolean(dispenseFilterEndDate) ||
    dispenseFilterObra !== 'ALL' ||
    dispenseFilterType !== 'ALL' ||
    Boolean(dispenseFilterSearch.trim());

  const handleResetDispenseFilters = () => {
    setDispenseFilterConvoy('ALL');
    setDispenseFilterStartDate('');
    setDispenseFilterEndDate('');
    setDispenseFilterObra('ALL');
    setDispenseFilterType('ALL');
    setDispenseFilterSearch('');
    setDispenseCurrentPage(1);
  };

  // Bar Chart Data (Comparison by Convoy)
  const chartData = useMemo(() => {
    return [
      {
        name: 'RTW1C01',
        label: 'Comboio RTW1C01',
        litros: metrics.rtwLiters,
        abastecimentos: metrics.rtwCount,
      },
      {
        name: 'DZA7G30',
        label: 'Comboio DZA7G30',
        litros: metrics.dzaLiters,
        abastecimentos: metrics.dzaCount,
      },
      {
        name: 'SPF2C66',
        label: 'Comboio SPF2C66',
        litros: metrics.spfLiters,
        abastecimentos: metrics.spfCount,
      },
    ];
  }, [metrics]);

  // Month-by-month Line Dashboard state
  const [monthlyChartMode, setMonthlyChartMode] = useState<'general' | 'convoys'>('general');
  const [showEntradasLine, setShowEntradasLine] = useState(true);
  const [showSaidasLine, setShowSaidasLine] = useState(true);
  const [showSaldoLine, setShowSaldoLine] = useState(true);
  const [isMonthlyTableOpen, setIsMonthlyTableOpen] = useState(false);

  // Month-by-month historical data aggregation
  const monthlyData = useMemo(() => {
    const monthMap = new Map<
      string,
      {
        entradas: number;
        saidas: number;
        rtwLiters: number;
        dzaLiters: number;
        spfLiters: number;
        numEntradas: number;
        numSaidas: number;
      }
    >();

    // For historical month-by-month view, we aggregate all recorded entries and dispenses
    // (if selectedDate is specified, respect cutoff date)
    const validEntries = selectedDate ? entries.filter((e) => e.date <= selectedDate) : entries;
    const validDispenses = selectedDate ? dispenses.filter((d) => d.date <= selectedDate) : dispenses;

    validEntries.forEach((e) => {
      if (!e.date) return;
      const monthKey = e.date.substring(0, 7); // YYYY-MM
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          entradas: 0,
          saidas: 0,
          rtwLiters: 0,
          dzaLiters: 0,
          spfLiters: 0,
          numEntradas: 0,
          numSaidas: 0,
        });
      }
      const item = monthMap.get(monthKey)!;
      item.entradas += e.liters || 0;
      item.numEntradas += 1;
    });

    validDispenses.forEach((d) => {
      if (!d.date) return;
      const monthKey = d.date.substring(0, 7);
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          entradas: 0,
          saidas: 0,
          rtwLiters: 0,
          dzaLiters: 0,
          spfLiters: 0,
          numEntradas: 0,
          numSaidas: 0,
        });
      }
      const item = monthMap.get(monthKey)!;
      item.saidas += d.liters || 0;
      item.numSaidas += 1;
      if (d.convoyPlate === 'RTW1C01') item.rtwLiters += d.liters || 0;
      else if (d.convoyPlate === 'DZA7G30') item.dzaLiters += d.liters || 0;
      else if (d.convoyPlate === 'SPF2C66' || (d.convoyPlate as string) === 'SFC2C66') item.spfLiters += d.liters || 0;
    });

    const monthNames = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
    ];
    const monthFullNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];

    const sortedKeys = Array.from(monthMap.keys()).sort();

    return sortedKeys.map((key) => {
      const [yStr, mStr] = key.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const mIdx = m - 1;
      const item = monthMap.get(key)!;
      const entradas = Number(item.entradas.toFixed(1));
      const saidas = Number(item.saidas.toFixed(1));
      const saldo = Number((entradas - saidas).toFixed(1));

      return {
        key,
        label: `${monthNames[mIdx] || mStr}/${yStr.slice(2)}`,
        fullName: `${monthFullNames[mIdx] || mStr} de ${yStr}`,
        year: y,
        month: m,
        entradas,
        saidas,
        saldo,
        rtwLiters: Number(item.rtwLiters.toFixed(1)),
        dzaLiters: Number(item.dzaLiters.toFixed(1)),
        spfLiters: Number(item.spfLiters.toFixed(1)),
        numEntradas: item.numEntradas,
        numSaidas: item.numSaidas,
      };
    });
  }, [entries, dispenses, selectedDate]);

  // Monthly summary stats for KPIs
  const monthlyStats = useMemo(() => {
    if (monthlyData.length === 0) {
      return {
        totalMonths: 0,
        avgEntradas: 0,
        avgSaidas: 0,
        avgSaldo: 0,
        peakSaidas: null as null | (typeof monthlyData)[0],
        peakEntradas: null as null | (typeof monthlyData)[0],
      };
    }

    const count = monthlyData.length;
    const totalEntradas = monthlyData.reduce((acc, curr) => acc + curr.entradas, 0);
    const totalSaidas = monthlyData.reduce((acc, curr) => acc + curr.saidas, 0);
    const totalSaldo = totalEntradas - totalSaidas;

    const peakSaidas = [...monthlyData].sort((a, b) => b.saidas - a.saidas)[0] || null;
    const peakEntradas = [...monthlyData].sort((a, b) => b.entradas - a.entradas)[0] || null;

    return {
      totalMonths: count,
      avgEntradas: Number((totalEntradas / count).toFixed(1)),
      avgSaidas: Number((totalSaidas / count).toFixed(1)),
      avgSaldo: Number((totalSaldo / count).toFixed(1)),
      peakSaidas,
      peakEntradas,
    };
  }, [monthlyData]);

  // ==========================================
  // GRÁFICO DE BARRAS: CONSUMO MENSAL POR OBRA (COM ISOLAMENTO POR OBRA)
  // ==========================================

  // Identifica se o usuário está no acesso/visão de uma obra específica (ex: '063/064' ou '062 - PA')
  const isSpecificObraActive = Boolean(selectedProject && selectedProject !== 'all');
  const activeNormalizedProject = isSpecificObraActive ? normalizeProjectCode(selectedProject) : 'all';

  // Quando estiver no acesso de uma obra específica, isolar ESTRITAMENTE os abastecimentos daquela obra
  const effectiveDispenses = useMemo(() => {
    if (isSpecificObraActive) {
      return dispenses.filter((d) => matchesSelectedProject(d.location, selectedProject, d.obra_id));
    }
    return allDispenses && allDispenses.length > 0 ? allDispenses : dispenses;
  }, [isSpecificObraActive, selectedProject, dispenses, allDispenses]);

  // Obra selecionada para o gráfico de barras recharts
  // Se estiver acessando uma obra específica, fica estritamente travada nessa obra
  const [selectedObraForChart, setSelectedObraForChart] = useState<string>(() => {
    if (isSpecificObraActive) {
      return activeNormalizedProject;
    }
    return 'all';
  });

  // Ano selecionado para o filtro do gráfico de barras (ALL ou YYYY)
  const [obraChartYear, setObraChartYear] = useState<string>('ALL');

  // Modo de exibição comparativo (somente habilitado na visão global 'all')
  const [obraChartCompareMode, setObraChartCompareMode] = useState<boolean>(false);

  // Visibilidade da tabela mensal detalhada por obra
  const [isObraMonthlyTableOpen, setIsObraMonthlyTableOpen] = useState<boolean>(false);

  // Sincronizar obra do gráfico e resetar comparações caso a obra ativa do app mude
  useEffect(() => {
    if (isSpecificObraActive) {
      setSelectedObraForChart(activeNormalizedProject);
      setObraChartCompareMode(false);
    } else {
      setSelectedObraForChart('all');
    }
  }, [isSpecificObraActive, activeNormalizedProject]);

  // Lista de obras disponíveis (isolada se estiver em obra específica)
  const availableObrasList = useMemo(() => {
    const map = new Map<string, { code: string; name: string; totalLiters: number; count: number }>();

    // 1. Obras cadastradas no sistema
    const baseProjects = (projects && projects.length > 0) ? projects : loadAppProjects();
    baseProjects.forEach((p) => {
      const norm = normalizeProjectCode(p.code);
      if (norm) {
        map.set(norm, {
          code: norm,
          name: p.name || `Obra ${norm}`,
          totalLiters: 0,
          count: 0,
        });
      }
    });

    // 2. Garantir as obras padrão da Makmo
    if (!map.has('063/064')) {
      map.set('063/064', {
        code: '063/064',
        name: 'Obra 063/064 - Apoio e Manutenção',
        totalLiters: 0,
        count: 0,
      });
    }
    if (!map.has('062 - PA')) {
      map.set('062 - PA', {
        code: '062 - PA',
        name: 'Obra 062 - PA',
        totalLiters: 0,
        count: 0,
      });
    }

    // 3. Agregar totais de consumo reais
    effectiveDispenses.forEach((d) => {
      const norm = normalizeProjectCode(d.obra_id || d.location) || '063/064';
      if (!map.has(norm)) {
        map.set(norm, {
          code: norm,
          name: `Obra ${norm}`,
          totalLiters: 0,
          count: 0,
        });
      }
      const entry = map.get(norm)!;
      entry.totalLiters += Number(d.liters) || 0;
      entry.count += 1;
    });

    // Se estiver em obra específica (ex: Obra 063/064 ou Obra 062 - PA), expor exclusivamente ela
    if (isSpecificObraActive) {
      const activeItem = map.get(activeNormalizedProject);
      if (activeItem) {
        return [activeItem];
      }
      return [
        {
          code: activeNormalizedProject,
          name: activeNormalizedProject === '062 - PA' ? 'Obra 062 - PA' : `Obra ${activeNormalizedProject}`,
          totalLiters: 0,
          count: 0,
        },
      ];
    }

    return Array.from(map.values()).sort((a, b) => b.totalLiters - a.totalLiters);
  }, [effectiveDispenses, projects, isSpecificObraActive, activeNormalizedProject]);

  // Anos disponíveis nos abastecimentos desta obra
  const availableChartYears = useMemo(() => {
    const years = new Set<string>();
    effectiveDispenses.forEach((d) => {
      if (d.date && d.date.length >= 4) {
        years.add(d.date.substring(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [effectiveDispenses]);

  // Dados mensais para o Gráfico de Barras Recharts
  const monthlyObraChartData = useMemo(() => {
    const monthNames = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
    ];
    const monthFullNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];

    // Obra alvo para o filtro
    const targetObra = isSpecificObraActive ? activeNormalizedProject : selectedObraForChart;

    // Filtrar saídas por obra e por ano
    const filteredDispenses = effectiveDispenses.filter((d) => {
      if (!d.date) return false;
      if (obraChartYear !== 'ALL' && !d.date.startsWith(obraChartYear)) return false;
      if (targetObra !== 'all') {
        return matchesSelectedProject(d.location, targetObra, d.obra_id);
      }
      return true;
    });

    const monthMap = new Map<
      string,
      {
        litros: number;
        abastecimentos: number;
        obraBreakdown: Record<string, number>;
      }
    >();

    filteredDispenses.forEach((d) => {
      const monthKey = d.date.substring(0, 7); // YYYY-MM
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          litros: 0,
          abastecimentos: 0,
          obraBreakdown: {},
        });
      }
      const item = monthMap.get(monthKey)!;
      const l = Number(d.liters) || 0;
      item.litros += l;
      item.abastecimentos += 1;

      const obraCode = normalizeProjectCode(d.obra_id || d.location) || '063/064';
      item.obraBreakdown[obraCode] = (item.obraBreakdown[obraCode] || 0) + l;
    });

    // Se estiver em obra específica e não houver abastecimentos (ex: Obra 062 - PA nova),
    // NÃO injetar meses fictícios de outras obras; retornar vazio para acionar o empty state exclusivo da obra
    if (monthMap.size === 0) {
      return [];
    }

    const sortedMonthKeys = Array.from(monthMap.keys()).sort();

    return sortedMonthKeys.map((key) => {
      const [yStr, mStr] = key.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const mIdx = m - 1;
      const item = monthMap.get(key)!;
      const litros = Number(item.litros.toFixed(1));
      const abastecimentos = item.abastecimentos;
      const mediaPorAbastecimento = abastecimentos > 0 ? Number((litros / abastecimentos).toFixed(1)) : 0;

      // Monta as chaves específicas por obra para o modo comparativo
      const breakdownFormatted: Record<string, number> = {};
      Object.entries(item.obraBreakdown).forEach(([oCode, oLitros]) => {
        const safeKey = `obra_${oCode.replace(/[^a-zA-Z0-9]/g, '_')}`;
        breakdownFormatted[safeKey] = Number(oLitros.toFixed(1));
      });

      return {
        key,
        label: `${monthNames[mIdx] || mStr}/${yStr.slice(2)}`,
        fullName: `${monthFullNames[mIdx] || mStr} de ${yStr}`,
        year: y,
        month: m,
        litros,
        abastecimentos,
        mediaPorAbastecimento,
        obraBreakdown: item.obraBreakdown,
        ...breakdownFormatted,
      };
    });
  }, [effectiveDispenses, isSpecificObraActive, activeNormalizedProject, selectedObraForChart, obraChartYear]);

  // Estatísticas e KPIs para a Obra Selecionada
  const obraMonthlyStats = useMemo(() => {
    if (monthlyObraChartData.length === 0) {
      return {
        totalLitros: 0,
        totalAbastecimentos: 0,
        mediaMensal: 0,
        mediaPorAbastecimento: 0,
        picoMes: null as null | (typeof monthlyObraChartData)[0],
        activeMonthsCount: 0,
      };
    }

    const totalLitros = monthlyObraChartData.reduce((acc, curr) => acc + curr.litros, 0);
    const totalAbastecimentos = monthlyObraChartData.reduce((acc, curr) => acc + curr.abastecimentos, 0);
    const activeMonths = monthlyObraChartData.filter((m) => m.litros > 0);
    const monthsCount = activeMonths.length > 0 ? activeMonths.length : monthlyObraChartData.length;
    const mediaMensal = monthsCount > 0 ? Number((totalLitros / monthsCount).toFixed(1)) : 0;
    const mediaPorAbastecimento = totalAbastecimentos > 0 ? Number((totalLitros / totalAbastecimentos).toFixed(1)) : 0;
    const picoMes = [...monthlyObraChartData].sort((a, b) => b.litros - a.litros)[0] || null;

    return {
      totalLitros: Number(totalLitros.toFixed(1)),
      totalAbastecimentos,
      mediaMensal,
      mediaPorAbastecimento,
      picoMes,
      activeMonthsCount: monthsCount,
    };
  }, [monthlyObraChartData]);

  // Obra ativa exibida
  const currentObraDisplay = useMemo(() => {
    const targetCode = isSpecificObraActive ? activeNormalizedProject : selectedObraForChart;
    if (targetCode === 'all') {
      return {
        code: 'all',
        name: 'Todas as Obras (Visão Consolidada)',
        badge: 'Consolidado Geral',
        isIsolated: false,
      };
    }
    const found = availableObrasList.find((o) => o.code === targetCode);
    const fallbackName = targetCode === '062 - PA' ? 'Obra 062 - PA' : targetCode === '063/064' ? 'Obra 063/064 - Apoio e Manutenção' : `Obra ${targetCode}`;
    return {
      code: targetCode,
      name: found ? found.name : fallbackName,
      badge: `Obra ${targetCode}`,
      isIsolated: isSpecificObraActive,
    };
  }, [isSpecificObraActive, activeNormalizedProject, selectedObraForChart, availableObrasList]);

  // Handle New Entry Submission
  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setEntryError(null);

    const litersVal = parseFloat(entryLiters.replace(',', '.'));
    if (isNaN(litersVal) || litersVal <= 0) {
      setEntryError('Informe uma quantidade válida de litros recebidos.');
      return;
    }

    const parsedTotalVal = parseCurrencyInput(entryTotalValue);
    const unitP = parsedTotalVal && litersVal > 0 ? Number((parsedTotalVal / litersVal).toFixed(4)) : undefined;

    const res = onSaveEntry({
      date: entryDate || getTodayDateString(),
      liters: Number(litersVal.toFixed(1)),
      totalValue: parsedTotalVal,
      unitPrice: unitP,
      supplier: entrySupplier.trim() || 'Distribuidora de Combustível',
      invoiceNumber: entryInvoice.trim(),
      destination: entryDestination.trim() || 'Tanque Central',
      responsible: entryResponsible.trim() || 'Almoxarifado',
      notes: entryNotes.trim(),
      attachmentUrl: entryAttachment?.url,
      attachmentName: entryAttachment?.name,
      attachmentType: entryAttachment?.type,
      attachmentSize: entryAttachment?.size,
    });

    if (res.success) {
      setEntryLiters('');
      setEntryTotalValue('');
      setEntrySupplier('');
      setEntryInvoice('');
      setEntryNotes('');
      setEntryAttachment(null);
      setEntryError(null);
      setIsNewEntryOpen(false);
    } else {
      setEntryError(res.message);
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Top Controls Bar with Date Selection */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3 sm:p-4 border border-[#dcdfe4] dark:border-[#333333] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-amber-500/10 text-amber-500">
              <Activity className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6]">
              Resumo Geral de Entrada e Saída de Diesel
            </h2>
          </div>
          <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-0.5">
            Balanço consolidado de combustível com controle de tanques e comboios RTW1C01, DZA7G30 e SPF2C66.
          </p>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#f8fafc] dark:bg-[#141414] px-2.5 py-1 rounded border border-[#dcdfe4] dark:border-[#333333]">
            <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-[11px] font-semibold text-[#6b7280] dark:text-[#9ca3af]">
              Posição até:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs bg-transparent text-[#111827] dark:text-[#f3f4f6] focus:outline-none font-mono"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-bold ml-1"
                title="Limpar filtro de data e ver acumulado total"
              >
                (Ver Todos)
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsNewEntryOpen(!isNewEntryOpen)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Registrar Entrada</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                await exportFuelReportToExcel(filteredDispenses, equipments, {
                  obraText: '063/064',
                  responsibleText: 'Roberto Jr',
                  customFilename: `makmo_relatorio_abastecimentos_${selectedDate ? `ate_${selectedDate}_` : ''}${getTodayDateString()}.xlsx`,
                });
              } catch (e) {
                console.warn('Excel export error, using CSV fallback:', e);
                exportFuelReportToCSV(
                  [],
                  filteredDispenses,
                  undefined,
                  equipments,
                  `makmo_relatorio_abastecimentos_${selectedDate ? `ate_${selectedDate}_` : ''}${getTodayDateString()}.csv`
                );
              }
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-black dark:bg-[#262626] text-amber-400 hover:bg-neutral-800 dark:hover:bg-[#333333] font-semibold text-xs border border-[#333333] transition-colors"
            title="Exportar relatório padronizado em Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>

          {isDeveloper && onResetFuelData && (entries.length > 0 || dispenses.length > 0) && (
            <button
              id="btn-zerar-dados-combustivel"
              type="button"
              onClick={() => {
                setResetDevPassword('');
                setShowResetDevPassword(false);
                setResetPasswordError(null);
                setIsResetConfirmOpen(true);
              }}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 font-semibold text-xs border border-rose-500/30 transition-colors cursor-pointer"
              title="Zerar todos os lançamentos de combustível mediante senha de desenvolvedor"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Zerar Dados</span>
            </button>
          )}
        </div>
      </div>

      {/* Welcome Banner when Fuel Data is Clean / Zeroed */}
      {entries.length === 0 && dispenses.length === 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                Aba Gestão de Combustível Zerada e Pronta para Lançamentos
              </h3>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                Os registros antigos foram limpos. A partir de agora, inicie os lançamentos registrando as cargas recebidas no botão <strong>Registrar Entrada</strong> ou cadastrando abastecimentos nas abas dos comboios (RTW1C01, DZA7G30 e SPF2C66).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNewEntryOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar 1ª Carga</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Entrada de Diesel */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3.5 border border-emerald-500/30 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Entrada de Diesel
            </span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-mono-numbers text-2xl font-bold text-emerald-950 dark:text-emerald-300">
              {formatLiters(metrics.totalEntries)}
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Litros</span>
          </div>
          <p className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] mt-1">
            Recebido em tanques e comboios ({filteredEntries.length} cargas)
          </p>
        </div>

        {/* 2. Saída de Diesel (Abas 1, 2 e 3) */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3.5 border border-rose-500/30 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Saída de Diesel (Comboios)
            </span>
            <div className="w-6 h-6 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-mono-numbers text-2xl font-bold text-rose-950 dark:text-rose-300">
              {formatLiters(metrics.totalDispenses)}
            </span>
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400">Litros</span>
          </div>
          <p className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] mt-1">
            Soma dos comboios RTW1C01 + DZA7G30 + SPF2C66
          </p>
        </div>

        {/* 3. Total de Litros Movimentados */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3.5 border border-[#dcdfe4] dark:border-[#333333] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af]">
              Total Movimentado
            </span>
            <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-mono-numbers text-2xl font-bold text-[#111827] dark:text-[#f3f4f6]">
              {formatLiters(metrics.totalMoved)}
            </span>
            <span className="text-xs font-bold text-[#6b7280] dark:text-[#9ca3af]">Litros</span>
          </div>
          <p className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] mt-1">
            Volume total transitado (Entradas + Saídas)
          </p>
        </div>

        {/* 4. Saldo Restante / Estoque */}
        {(() => {
          const themeStyles = {
            neutral: {
              card: 'bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333]',
              label: 'text-[#4b5563] dark:text-[#9ca3af]',
              iconBg: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
              value: metrics.balance >= 2000 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400',
              unit: 'text-[#6b7280] dark:text-[#9ca3af]',
              badge: 'bg-amber-500 text-black',
              subtext: 'text-[#6b7280] dark:text-[#9ca3af]',
            },
            orange: {
              card: 'bg-gradient-to-br from-orange-500/25 via-amber-400/20 to-orange-600/25 dark:from-orange-500/30 dark:via-orange-600/20 dark:to-orange-950/45 border-2 border-orange-500 dark:border-orange-500/80 shadow-sm text-slate-950 dark:text-orange-100',
              label: 'text-orange-950 dark:text-orange-300 font-extrabold',
              iconBg: 'bg-orange-500/35 text-orange-800 dark:text-orange-300 border border-orange-500',
              value: 'text-orange-950 dark:text-orange-100 font-black',
              unit: 'text-orange-800 dark:text-orange-300 font-bold',
              badge: 'bg-orange-500 text-white font-black shadow-xs',
              subtext: 'text-orange-900/90 dark:text-orange-200/90 font-medium',
            },
            navy: {
              card: 'bg-[#113861] dark:bg-[#0a233d] border border-[#1b4d82] shadow-md text-white',
              label: 'text-blue-100',
              iconBg: 'bg-white/15 text-[#20b4a7]',
              value: 'text-white',
              unit: 'text-[#20b4a7] font-bold',
              badge: 'bg-[#20b4a7] text-black font-bold',
              subtext: 'text-blue-200/90',
            },
            amber: {
              card: 'bg-gradient-to-br from-amber-400/25 via-amber-300/15 to-amber-500/20 dark:from-amber-500/25 dark:via-amber-500/15 dark:to-amber-950/40 border-2 border-amber-400 dark:border-amber-500/70 shadow-sm text-slate-950 dark:text-amber-100',
              label: 'text-amber-950 dark:text-amber-300 font-extrabold',
              iconBg: 'bg-amber-400/40 text-amber-800 dark:text-amber-300 border border-amber-400',
              value: 'text-amber-950 dark:text-amber-100 font-black',
              unit: 'text-amber-800 dark:text-amber-300 font-bold',
              badge: 'bg-amber-400 text-slate-950 font-black shadow-xs',
              subtext: 'text-amber-900/90 dark:text-amber-200/90 font-medium',
            },
            blue: {
              card: 'bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/35',
              label: 'text-blue-800 dark:text-blue-300',
              iconBg: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
              value: 'text-blue-950 dark:text-blue-200',
              unit: 'text-blue-700 dark:text-blue-400',
              badge: 'bg-blue-600 text-white font-bold',
              subtext: 'text-[#6b7280] dark:text-[#9ca3af]',
            },
            emerald: {
              card: 'bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/35',
              label: 'text-emerald-800 dark:text-emerald-300',
              iconBg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
              value: 'text-emerald-950 dark:text-emerald-200',
              unit: 'text-emerald-700 dark:text-emerald-400',
              badge: 'bg-emerald-600 text-white font-bold',
              subtext: 'text-[#6b7280] dark:text-[#9ca3af]',
            },
          }[stockCardTheme];

          return (
            <div className={`rounded-lg p-3.5 shadow-xs relative transition-all ${themeStyles.card}`}>
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${themeStyles.label}`}>
                  Estoque • Saldo Restante
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Badge de Data ou Atual */}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${themeStyles.badge}`}>
                    {selectedDate ? formatDateBR(selectedDate) : 'Atual'}
                  </span>

                  {/* Ícone */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${themeStyles.iconBg}`}>
                    <Gauge className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className={`font-mono-numbers text-2xl font-bold ${themeStyles.value}`}>
                  {formatLiters(metrics.balance)}
                </span>
                <span className={`text-xs font-bold ${themeStyles.unit}`}>
                  Litros
                </span>
              </div>

              <p className={`text-[10px] mt-1 ${themeStyles.subtext}`}>
                Entradas acumuladas − Saídas acumuladas
              </p>
            </div>
          );
        })()}
      </div>

      {/* New Diesel Entry Form (Expandable) */}
      {isNewEntryOpen && (
        <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-4 border border-amber-500/40 shadow-md space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#eaecef] dark:border-[#262626]">
            <h3 className="text-sm sm:text-base font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6] flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-500" />
              Lançamento de Entrada de Diesel (Recebimento de Carga)
            </h3>
            <button
              type="button"
              onClick={() => setIsNewEntryOpen(false)}
              className="text-xs text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]"
            >
              ✕ Fechar
            </button>
          </div>

          {entryError && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{entryError}</span>
            </div>
          )}

          <form onSubmit={handleCreateEntry} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3">
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5">
                  Data do Recebimento <span className="text-amber-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-xs text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5">
                  Volume (Litros) <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    placeholder="Ex: 5000"
                    value={entryLiters}
                    onChange={(e) => setEntryLiters(e.target.value)}
                    className="w-full h-8 pl-2.5 pr-7 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-xs font-mono-numbers font-bold text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-2 top-2 text-[10px] font-bold text-[#9ca3af] font-mono">
                    L
                  </span>
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5">
                  Valor Total da Entrada
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-[11px] font-bold text-[#9ca3af] font-mono">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00 (opcional)"
                    value={entryTotalValue}
                    onChange={(e) => setEntryTotalValue(e.target.value)}
                    className="w-full h-8 pl-8 pr-2 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-xs font-mono-numbers font-bold text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                  />
                </div>
                {(() => {
                  const pVal = parseCurrencyInput(entryTotalValue);
                  const lVal = parseFloat(entryLiters.replace(',', '.'));
                  if (pVal && lVal && lVal > 0) {
                    const unitP = pVal / lVal;
                    return (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium block truncate mt-0.5" title={`Preço unitário: R$ ${unitP.toFixed(4)} por litro`}>
                        ≈ R$ {unitP.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/L
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="lg:col-span-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5">
                  Fornecedor / Distribuidora
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ipiranga, Vibra, Raízen..."
                  value={entrySupplier}
                  onChange={(e) => setEntrySupplier(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-xs text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5">
                  Nota Fiscal
                </label>
                <input
                  type="text"
                  placeholder="Ex: NF-12345"
                  value={entryInvoice}
                  onChange={(e) => setEntryInvoice(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-xs text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3">
              <div className="lg:col-span-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5">
                  Destino do Combustível
                </label>
                <select
                  value={entryDestination}
                  onChange={(e) => setEntryDestination(e.target.value)}
                  className="w-full h-8 px-2 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-xs text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                >
                  <option value="Tanque Central">Tanque Central (Depósito Geral)</option>
                  <option value="Comboio RTW1C01">Comboio RTW1C01</option>
                  <option value="Comboio DZA7G30">Comboio DZA7G30</option>
                  <option value="Comboio SPF2C66">Comboio SPF2C66</option>
                </select>
              </div>

              <div className="lg:col-span-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5">
                  Responsável pelo Recebimento
                </label>
                <input
                  type="text"
                  placeholder="Nome do conferente / almoxarife..."
                  value={entryResponsible}
                  onChange={(e) => setEntryResponsible(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-xs text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="lg:col-span-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5">
                  Observações
                </label>
                <input
                  type="text"
                  placeholder="Ex: Diesel S10, lacre conferido..."
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-xs text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Anexar Arquivo ou PDF ou JPEG */}
              <div className="lg:col-span-12 pt-1 border-t border-dashed border-[#eaecef] dark:border-[#262626]">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-1.5">
                  Anexar Arquivo / Nota Fiscal (PDF ou JPEG)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors">
                    <Paperclip className="w-3.5 h-3.5 text-amber-500" />
                    <span>{entryAttachment ? 'Trocar Arquivo' : 'Selecionar Arquivo (PDF ou JPEG)'}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const validation = validateInvoiceFile(file);
                        if (!validation.valid) {
                          setEntryError(validation.error || 'Formato de arquivo não suportado. Aceito exclusivamente arquivos PDF, JPG ou JPEG.');
                          return;
                        }
                        try {
                          const url = await readFileAsDataURL(file);
                          setEntryAttachment({
                            url,
                            name: file.name,
                            type: validation.fileType,
                            size: file.size,
                          });
                          setEntryError(null);
                        } catch (err: any) {
                          setEntryError('Erro ao ler o arquivo selecionado.');
                        }
                      }}
                    />
                  </label>

                  {entryAttachment && (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] text-xs">
                      {entryAttachment.type === 'PDF' ? (
                        <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      ) : (
                        <FileImage className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      )}
                      <span className="font-mono text-[#111827] dark:text-[#f3f4f6] font-medium max-w-xs truncate">
                        {entryAttachment.name}
                      </span>
                      <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                        ({formatFileSize(entryAttachment.size)})
                      </span>
                      <button
                        type="button"
                        onClick={() => setEntryAttachment(null)}
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold ml-1 cursor-pointer"
                        title="Remover anexo"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <span className="text-[11px] text-[#9ca3af]">
                    Formatos aceitos: PDF, JPG ou JPEG (opcional)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-[#eaecef] dark:border-[#262626]">
              <button
                type="button"
                onClick={() => setIsNewEntryOpen(false)}
                className="h-8 px-3 rounded border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="h-8 px-4 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Salvar Entrada no Tanque</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Breakdown per Comboio & Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: Comboios Cards Breakdown */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1a1a1a] rounded-lg p-3.5 border border-[#dcdfe4] dark:border-[#333333] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#eaecef] dark:border-[#262626]">
            <h3 className="text-sm font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6] flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-500" />
              Consumo por Comboio
            </h3>
            <span className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
              3 comboios ativos
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Comboio RTW1C01 */}
            <div className="p-2.5 rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-[#f8fafc] dark:bg-[#141414] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#111827] dark:text-[#f3f4f6]">
                      RTW1C01
                    </span>
                    <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">Comboio 1</span>
                  </div>
                  <span className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                    {metrics.rtwCount} saídas ({formatLiters(metrics.rtwLiters)} L)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] block leading-none">
                    Saldo Atual
                  </span>
                  <span className={`font-mono text-sm font-black ${metrics.rtwBalance >= 2000 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatLiters(metrics.rtwBalance)} L
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#6b7280] dark:text-[#9ca3af] pt-1 border-t border-[#eaecef] dark:border-[#262626]">
                <span>Cargas: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatLiters(metrics.rtwEntries)} L</strong></span>
                <span>{metrics.totalDispenses > 0 ? `${((metrics.rtwLiters / metrics.totalDispenses) * 100).toFixed(0)}% das saídas` : '0%'}</span>
              </div>
            </div>

            {/* Comboio DZA7G30 */}
            <div className="p-2.5 rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-[#f8fafc] dark:bg-[#141414] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#111827] dark:text-[#f3f4f6]">
                      DZA7G30
                    </span>
                    <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">Comboio 2</span>
                  </div>
                  <span className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                    {metrics.dzaCount} saídas ({formatLiters(metrics.dzaLiters)} L)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] block leading-none">
                    Saldo Atual
                  </span>
                  <span className={`font-mono text-sm font-black ${metrics.dzaBalance >= 2000 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatLiters(metrics.dzaBalance)} L
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#6b7280] dark:text-[#9ca3af] pt-1 border-t border-[#eaecef] dark:border-[#262626]">
                <span>Cargas: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatLiters(metrics.dzaEntries)} L</strong></span>
                <span>{metrics.totalDispenses > 0 ? `${((metrics.dzaLiters / metrics.totalDispenses) * 100).toFixed(0)}% das saídas` : '0%'}</span>
              </div>
            </div>

            {/* Comboio SPF2C66 */}
            <div className="p-2.5 rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-[#f8fafc] dark:bg-[#141414] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#111827] dark:text-[#f3f4f6]">
                      SPF2C66
                    </span>
                    <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">Comboio 3</span>
                  </div>
                  <span className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                    {metrics.spfCount} saídas ({formatLiters(metrics.spfLiters)} L)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#9ca3af] block leading-none">
                    Saldo Atual
                  </span>
                  <span className={`font-mono text-sm font-black ${metrics.spfBalance >= 2000 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatLiters(metrics.spfBalance)} L
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#6b7280] dark:text-[#9ca3af] pt-1 border-t border-[#eaecef] dark:border-[#262626]">
                <span>Cargas: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatLiters(metrics.spfEntries)} L</strong></span>
                <span>{metrics.totalDispenses > 0 ? `${((metrics.spfLiters / metrics.totalDispenses) * 100).toFixed(0)}% das saídas` : '0%'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Comparative Chart */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1a1a1a] rounded-lg p-3.5 border border-[#dcdfe4] dark:border-[#333333] shadow-xs space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-[#eaecef] dark:border-[#262626]">
            <h3 className="text-sm font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6]">
              Comparativo de Saídas por Comboio (Litros)
            </h3>
            <span className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
              Total Saídas: {formatLiters(metrics.totalDispenses)} L
            </span>
          </div>

          <div className="h-44 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-15" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888888' }} />
                <YAxis unit="L" tick={{ fontSize: 11, fill: '#888888' }} />
                <Tooltip
                  formatter={(val: number) => [`${formatLiters(val)} Litros`, 'Volume Abastecido']}
                  contentStyle={{
                    backgroundColor: '#1f1f1f',
                    borderColor: '#333333',
                    fontSize: '11px',
                    borderRadius: '6px',
                    color: '#f3f4f6',
                  }}
                />
                <Bar dataKey="litros" fill="#20b4a7" radius={[4, 4, 0, 0]} name="Litros Abastecidos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* GRÁFICO DE BARRAS RECHARTS: CONSUMO MENSAL DE DIESEL POR OBRA SELECIONADA  */}
      {/* ========================================================================= */}
      <div
        id="monthly-diesel-consumption-by-obra-dashboard"
        className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3.5 sm:p-5 border border-[#dcdfe4] dark:border-[#333333] shadow-xs space-y-4"
      >
        {/* Header do Gráfico de Barras com Seletor e Filtros */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#eaecef] dark:border-[#262626]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <BarChart3 className="w-5 h-5 text-amber-500" />
              </span>
              <h3 className="text-base font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6]">
                Consumo Mensal de Diesel {isSpecificObraActive ? `• ${currentObraDisplay.name}` : 'por Obra'}
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black shadow-2xs uppercase tracking-wider font-mono">
                Gráfico de Barras
              </span>
              {isSpecificObraActive ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-mono">
                  <Building2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Visão Exclusiva: {currentObraDisplay.badge}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  {currentObraDisplay.name}
                </span>
              )}
            </div>
            <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
              {isSpecificObraActive
                ? `Exibição restrita e isolada para os abastecimentos da ${currentObraDisplay.name}. Dados e histórico mensal 100% separados desta obra.`
                : 'Volume mensal apurado de óleo diesel consumido na frota e equipamentos da obra selecionada, com visualização gráfica em barras recharts e comparativo analítico.'}
            </p>
          </div>

          {/* Toolbar de Controles Interativos (Seletor de Obra, Filtro de Ano e Visualização) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor Dropdown de Obra (visível apenas na visão global com múltiplas obras) */}
            {!isSpecificObraActive ? (
              <div className="flex items-center gap-1.5 bg-[#f8fafc] dark:bg-[#141414] px-2.5 py-1.5 rounded-md border border-[#dcdfe4] dark:border-[#333333]">
                <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <label htmlFor="select-obra-bar-chart" className="text-[11px] font-bold text-[#4b5563] dark:text-[#9ca3af] shrink-0">
                  Obra:
                </label>
                <select
                  id="select-obra-bar-chart"
                  value={selectedObraForChart}
                  onChange={(e) => setSelectedObraForChart(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#111827] dark:text-[#f3f4f6] focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all" className="bg-white dark:bg-zinc-900 text-[#111827] dark:text-white">
                    Todas as Obras (Visão Consolidada)
                  </option>
                  {availableObrasList.map((obra) => (
                    <option
                      key={obra.code}
                      value={obra.code}
                      className="bg-white dark:bg-zinc-900 text-[#111827] dark:text-white"
                    >
                      {obra.name} ({formatLiters(obra.totalLiters)} L)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-md text-amber-900 dark:text-amber-200 text-xs font-bold shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Ambiente da Obra: {currentObraDisplay.name}</span>
              </div>
            )}

            {/* Filtro de Ano */}
            {availableChartYears.length > 1 && (
              <div className="flex items-center p-0.5 rounded-md bg-[#f1f3f5] dark:bg-[#262626] border border-[#dcdfe4] dark:border-[#383838]">
                <button
                  type="button"
                  onClick={() => setObraChartYear('ALL')}
                  className={`px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                    obraChartYear === 'ALL'
                      ? 'bg-amber-500 text-black shadow-2xs font-bold'
                      : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]'
                  }`}
                >
                  Todos
                </button>
                {availableChartYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setObraChartYear(yr)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                      obraChartYear === yr
                        ? 'bg-amber-500 text-black shadow-2xs font-bold'
                        : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            )}

            {/* Alternador de Modo de Barras (quando 'all' está selecionado na visão global) */}
            {!isSpecificObraActive && selectedObraForChart === 'all' && (
              <button
                type="button"
                onClick={() => setObraChartCompareMode(!obraChartCompareMode)}
                className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all cursor-pointer border ${
                  obraChartCompareMode
                    ? 'bg-amber-500 text-black border-amber-600 shadow-2xs font-bold'
                    : 'bg-[#f8fafc] dark:bg-[#141414] hover:bg-neutral-200 dark:hover:bg-neutral-800 text-[#374151] dark:text-[#d1d5db] border-[#dcdfe4] dark:border-[#383838]'
                }`}
                title="Alternar entre Barras Totais e Comparativo por Obra"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{obraChartCompareMode ? 'Barras Comparativas' : 'Comparar Obras'}</span>
              </button>
            )}

            {/* Botão Recolher/Expandir Tabela Mensal */}
            <button
              type="button"
              onClick={() => setIsObraMonthlyTableOpen(!isObraMonthlyTableOpen)}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-[#f8fafc] dark:bg-[#141414] hover:bg-neutral-200 dark:hover:bg-neutral-800 text-[#374151] dark:text-[#d1d5db] border border-[#dcdfe4] dark:border-[#383838] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{isObraMonthlyTableOpen ? 'Recolher Tabela' : 'Ver Tabela Mês a Mês'}</span>
              {isObraMonthlyTableOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Atalhos Rápidos por Botões (Pills) das Obras Disponíveis */}
        {!isSpecificObraActive ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-bold text-[#6b7280] dark:text-[#9ca3af] mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-amber-500" />
              Filtrar Obra:
            </span>
            <button
              type="button"
              onClick={() => setSelectedObraForChart('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                selectedObraForChart === 'all'
                  ? 'bg-amber-500 text-black border-amber-600 shadow-2xs ring-1 ring-amber-500'
                  : 'bg-[#f8fafc] dark:bg-[#1f1f1f] text-[#4b5563] dark:text-[#9ca3af] border-[#dcdfe4] dark:border-[#333333] hover:border-amber-500/50 hover:text-black dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3 h-3" />
              <span>Todas as Obras</span>
            </button>
            {availableObrasList.map((obra) => {
              const isSelected = selectedObraForChart === obra.code;
              return (
                <button
                  key={obra.code}
                  type="button"
                  onClick={() => setSelectedObraForChart(obra.code)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500 text-black border-amber-600 shadow-2xs ring-1 ring-amber-500'
                      : 'bg-[#f8fafc] dark:bg-[#1f1f1f] text-[#4b5563] dark:text-[#9ca3af] border-[#dcdfe4] dark:border-[#333333] hover:border-amber-500/50 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Building2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>{obra.code}</span>
                  <span
                    className={`text-[10px] font-mono px-1 py-0.2 rounded font-bold ${
                      isSelected
                        ? 'bg-black/20 text-black'
                        : 'bg-neutral-200 dark:bg-neutral-700 text-[#374151] dark:text-[#d1d5db]'
                    }`}
                  >
                    {formatLiters(obra.totalLiters)} L
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500 text-black font-extrabold text-xs shadow-2xs">
              <Building2 className="w-3.5 h-3.5" />
              <span>{currentObraDisplay.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20 text-black">
                {formatLiters(obraMonthlyStats.totalLitros)} L consumidos
              </span>
            </span>
            <span className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
              Visualização restrita aos abastecimentos desta obra ({currentObraDisplay.name}).
            </span>
          </div>
        )}

        {/* Painel de Indicadores Chave (KPIs) da Obra Selecionada */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Card 1: Consumo Total no Período */}
          <div className="p-3 rounded-lg border border-[#eaecef] dark:border-[#262626] bg-[#f8fafc] dark:bg-[#141414]">
            <div className="flex items-center justify-between text-[#6b7280] dark:text-[#9ca3af] mb-1">
              <span className="text-[11px] font-medium flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5 text-amber-500" />
                Consumo Total ({currentObraDisplay.badge})
              </span>
            </div>
            <div className="font-mono text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
              {formatLiters(obraMonthlyStats.totalLitros)} L
            </div>
            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block mt-0.5 truncate">
              {obraMonthlyStats.activeMonthsCount} {obraMonthlyStats.activeMonthsCount === 1 ? 'mês com saídas' : 'meses com saídas apuradas'}
            </span>
          </div>

          {/* Card 2: Média Mensal de Consumo */}
          <div className="p-3 rounded-lg border border-[#eaecef] dark:border-[#262626] bg-[#f8fafc] dark:bg-[#141414]">
            <div className="flex items-center justify-between text-[#6b7280] dark:text-[#9ca3af] mb-1">
              <span className="text-[11px] font-medium flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-blue-500" />
                Média Mensal da Obra
              </span>
            </div>
            <div className="font-mono text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
              {formatLiters(obraMonthlyStats.mediaMensal)} L
            </div>
            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block mt-0.5">
              Consumo médio mensal apurado
            </span>
          </div>

          {/* Card 3: Mês de Pico de Consumo */}
          <div className="p-3 rounded-lg border border-[#eaecef] dark:border-[#262626] bg-[#f8fafc] dark:bg-[#141414]">
            <div className="flex items-center justify-between text-[#6b7280] dark:text-[#9ca3af] mb-1">
              <span className="text-[11px] font-medium flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                Mês de Maior Consumo
              </span>
            </div>
            <div className="font-mono text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 truncate">
              {obraMonthlyStats.picoMes && obraMonthlyStats.picoMes.litros > 0
                ? obraMonthlyStats.picoMes.label
                : '-'}
            </div>
            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block mt-0.5 truncate">
              {obraMonthlyStats.picoMes && obraMonthlyStats.picoMes.litros > 0
                ? `${formatLiters(obraMonthlyStats.picoMes.litros)} L consumidos`
                : 'Sem registros de saída'}
            </span>
          </div>

          {/* Card 4: Quantidade de Abastecimentos */}
          <div className="p-3 rounded-lg border border-[#eaecef] dark:border-[#262626] bg-[#f8fafc] dark:bg-[#141414]">
            <div className="flex items-center justify-between text-[#6b7280] dark:text-[#9ca3af] mb-1">
              <span className="text-[11px] font-medium flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-emerald-500" />
                Abastecimentos Realizados
              </span>
            </div>
            <div className="font-mono text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {obraMonthlyStats.totalAbastecimentos}
            </div>
            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block mt-0.5 truncate">
              Média: {formatLiters(obraMonthlyStats.mediaPorAbastecimento)} L / abastecimento
            </span>
          </div>
        </div>

        {/* Gráfico de Barras com Recharts */}
        <div className="w-full pt-2">
          {monthlyObraChartData.length === 0 || obraMonthlyStats.totalLitros === 0 ? (
            <div className="p-8 border-2 border-dashed border-[#dcdfe4] dark:border-[#333333] rounded-xl text-center space-y-2 bg-[#f8fafc]/50 dark:bg-[#141414]/50">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
                <Building2 className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-xs font-bold text-[#111827] dark:text-[#f3f4f6]">
                Nenhum abastecimento registrado até o momento na {currentObraDisplay.name}.
              </p>
              <p className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] max-w-md mx-auto">
                {isSpecificObraActive
                  ? `Os dados da ${currentObraDisplay.name} estão 100% isolados de outras obras. Conforme forem lançados novos abastecimentos nos comboios operantes nesta obra, o consumo mensal de diesel será calculado e exibido automaticamente.`
                  : 'Selecione "Todas as Obras" ou escolha outra obra nos filtros acima para visualizar o histórico de consumo mensal.'}
              </p>
            </div>
          ) : (
            <div className="h-72 sm:h-84 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyObraChartData}
                  margin={{ top: 25, right: 20, left: -5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-15" />
                  <XAxis
                    dataKey="label"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11, fill: '#888888' }}
                  />
                  <YAxis
                    unit="L"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11, fill: '#888888' }}
                    tickFormatter={(val: number) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const monthItem = monthlyObraChartData.find((m) => m.label === label);
                      const totalLiters = payload.reduce(
                        (sum, p) => sum + (typeof p.value === 'number' ? p.value : 0),
                        0
                      );

                      return (
                        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 shadow-2xl text-xs text-white min-w-[220px] space-y-2">
                          <div className="pb-1.5 border-b border-[#27272a]">
                            <div className="font-bold text-amber-400 font-industrial tracking-wide">
                              {monthItem ? monthItem.fullName : label}
                            </div>
                            <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-amber-500" />
                              {currentObraDisplay.name}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-300 font-medium">Consumo Total:</span>
                              <span className="font-mono font-bold text-amber-400">
                                {formatLiters(totalLiters)} Litros
                              </span>
                            </div>

                            {monthItem && (
                              <>
                                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                  <span>Abastecimentos:</span>
                                  <span className="font-mono text-zinc-200">
                                    {monthItem.abastecimentos} registros
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                  <span>Média por abastecimento:</span>
                                  <span className="font-mono text-zinc-200">
                                    {formatLiters(monthItem.mediaPorAbastecimento)} L
                                  </span>
                                </div>
                              </>
                            )}

                            {monthItem &&
                              monthItem.obraBreakdown &&
                              Object.keys(monthItem.obraBreakdown).length > 1 && (
                                <div className="pt-1.5 mt-1 border-t border-[#27272a] space-y-1">
                                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                                    Detalhamento por Obra:
                                  </span>
                                  {Object.entries(monthItem.obraBreakdown).map(([oCode, oL]) => (
                                    <div
                                      key={oCode}
                                      className="flex items-center justify-between text-[11px]"
                                    >
                                      <span className="text-zinc-300 font-medium">Obra {oCode}:</span>
                                      <span className="font-mono font-semibold text-amber-300">
                                        {formatLiters(Number(oL))} L
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(val: string) => {
                      return (
                        <span className="text-xs text-[#374151] dark:text-[#d1d5db] font-semibold">
                          {val}
                        </span>
                      );
                    }}
                  />

                  {/* Renderização de Barras: Modo Comparativo vs Modo Consolidado */}
                  {selectedObraForChart === 'all' && obraChartCompareMode ? (
                    <>
                      <Bar
                        dataKey="obra_063_064"
                        name="Obra 063/064"
                        fill="#f97316"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="obra_062___PA"
                        name="Obra 062 - PA"
                        fill="#20b4a7"
                        radius={[4, 4, 0, 0]}
                      />
                      {availableObrasList
                        .filter((o) => o.code !== '063/064' && o.code !== '062 - PA')
                        .map((o, idx) => {
                          const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];
                          const safeKey = `obra_${o.code.replace(/[^a-zA-Z0-9]/g, '_')}`;
                          return (
                            <Bar
                              key={o.code}
                              dataKey={safeKey}
                              name={o.name}
                              fill={colors[idx % colors.length]}
                              radius={[4, 4, 0, 0]}
                            />
                          );
                        })}
                    </>
                  ) : (
                    <Bar
                      dataKey="litros"
                      name={`Consumo de Diesel • ${currentObraDisplay.badge}`}
                      fill="#f97316"
                      radius={[6, 6, 0, 0]}
                    >
                      <LabelList
                        dataKey="litros"
                        position="top"
                        formatter={(val: any) =>
                          Number(val) > 0 ? `${formatLiters(Number(val))} L` : ''
                        }
                        style={{ fill: '#d97706', fontSize: 10, fontWeight: 'bold' }}
                      />
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tabela Mês a Mês Detalhada com Estatísticas da Obra */}
        {isObraMonthlyTableOpen && (
          <div className="pt-3 border-t border-[#eaecef] dark:border-[#262626] animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                Demonstrativo Mensal de Consumo ({currentObraDisplay.name})
              </h4>
              <span className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                {monthlyObraChartData.length} {monthlyObraChartData.length === 1 ? 'mês apurado' : 'meses apurados'}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#eaecef] dark:border-[#262626]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f8fafc] dark:bg-[#18181b] border-b border-[#eaecef] dark:border-[#262626] text-[11px] font-bold text-[#4b5563] dark:text-[#9ca3af] uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5">Mês / Ano</th>
                    <th className="p-2.5">Obra / Localidade</th>
                    <th className="p-2.5 text-right">Diesel Consumido</th>
                    <th className="p-2.5 text-center">Participação %</th>
                    <th className="p-2.5 text-center">Abastecimentos</th>
                    <th className="p-2.5 text-right">Média L / Abast.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaecef] dark:divide-[#262626] font-mono">
                  {monthlyObraChartData.map((row) => {
                    const percentOfTotal =
                      obraMonthlyStats.totalLitros > 0
                        ? ((row.litros / obraMonthlyStats.totalLitros) * 100).toFixed(1)
                        : '0.0';

                    return (
                      <tr
                        key={row.key}
                        className="hover:bg-[#f8fafc] dark:hover:bg-[#1f1f1f] transition-colors"
                      >
                        <td className="p-2.5 font-bold text-[#111827] dark:text-[#f3f4f6]">
                          {row.fullName}
                        </td>
                        <td className="p-2.5 font-sans text-[#374151] dark:text-[#d1d5db]">
                          {currentObraDisplay.name}
                        </td>
                        <td className="p-2.5 text-right font-black text-amber-600 dark:text-amber-400">
                          {formatLiters(row.litros)} L
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-bold text-[#374151] dark:text-[#d1d5db]">
                              {percentOfTotal}%
                            </span>
                            <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, Number(percentOfTotal)))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-2.5 text-center text-[#374151] dark:text-[#d1d5db]">
                          {row.abastecimentos}
                        </td>
                        <td className="p-2.5 text-right text-[#374151] dark:text-[#d1d5db]">
                          {formatLiters(row.mediaPorAbastecimento)} L
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Dashboard de Linha Mês a Mês */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3.5 sm:p-5 border border-[#dcdfe4] dark:border-[#333333] shadow-xs space-y-4">
        {/* Dashboard Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#eaecef] dark:border-[#262626]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                <LineChartIcon className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6]">
                Dashboard de Linha Mês a Mês
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                Evolução Histórica
              </span>
            </div>
            <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
              Acompanhamento mensal da movimentação de combustível: cargas recebidas (entradas), consumo da frota (saídas) e saldo operacional líquido.
            </p>
          </div>

          {/* Interactive Controls Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex items-center p-0.5 rounded-md bg-[#f1f3f5] dark:bg-[#262626] border border-[#dcdfe4] dark:border-[#383838]">
              <button
                type="button"
                onClick={() => setMonthlyChartMode('general')}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                  monthlyChartMode === 'general'
                    ? 'bg-white dark:bg-[#18181b] text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]'
                }`}
              >
                Geral (Entradas x Saídas)
              </button>
              <button
                type="button"
                onClick={() => setMonthlyChartMode('convoys')}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                  monthlyChartMode === 'convoys'
                    ? 'bg-white dark:bg-[#18181b] text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]'
                }`}
              >
                Por Comboio
              </button>
            </div>

            {/* General Mode Line Toggles */}
            {monthlyChartMode === 'general' && (
              <div className="hidden sm:flex items-center gap-1 bg-[#f8fafc] dark:bg-[#141414] p-1 rounded-md border border-[#dcdfe4] dark:border-[#333333]">
                <button
                  type="button"
                  onClick={() => setShowEntradasLine(!showEntradasLine)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded flex items-center gap-1.5 transition-all ${
                    showEntradasLine
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'text-[#9ca3af] opacity-50'
                  }`}
                  title="Alternar linha de Entradas"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Entradas
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaidasLine(!showSaidasLine)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded flex items-center gap-1.5 transition-all ${
                    showSaidasLine
                      ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30'
                      : 'text-[#9ca3af] opacity-50'
                  }`}
                  title="Alternar linha de Saídas"
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
                  Saídas
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaldoLine(!showSaldoLine)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded flex items-center gap-1.5 transition-all ${
                    showSaldoLine
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                      : 'text-[#9ca3af] opacity-50'
                  }`}
                  title="Alternar linha de Saldo Líquido"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Saldo
                </button>
              </div>
            )}

            {/* Toggle Table Button */}
            <button
              type="button"
              onClick={() => setIsMonthlyTableOpen(!isMonthlyTableOpen)}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-[#f8fafc] dark:bg-[#141414] hover:bg-neutral-200 dark:hover:bg-neutral-800 text-[#374151] dark:text-[#d1d5db] border border-[#dcdfe4] dark:border-[#383838] flex items-center gap-1 transition-colors"
            >
              <span>{isMonthlyTableOpen ? 'Recolher Tabela' : 'Ver Tabela Mês a Mês'}</span>
              {isMonthlyTableOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Quick KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Card 1: Média Mensal de Entradas */}
          <div className="p-3 rounded-lg border border-[#eaecef] dark:border-[#262626] bg-[#f8fafc] dark:bg-[#141414]">
            <div className="flex items-center justify-between text-[#6b7280] dark:text-[#9ca3af] mb-1">
              <span className="text-[11px] font-medium flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
                Média Entradas / Mês
              </span>
            </div>
            <div className="font-mono text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatLiters(monthlyStats.avgEntradas)} L
            </div>
            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block mt-0.5">
              Cargas em tanques centrais
            </span>
          </div>

          {/* Card 2: Média Mensal de Saídas */}
          <div className="p-3 rounded-lg border border-[#eaecef] dark:border-[#262626] bg-[#f8fafc] dark:bg-[#141414]">
            <div className="flex items-center justify-between text-[#6b7280] dark:text-[#9ca3af] mb-1">
              <span className="text-[11px] font-medium flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-yellow-500" />
                Média Saídas / Mês
              </span>
            </div>
            <div className="font-mono text-base sm:text-lg font-bold text-yellow-600 dark:text-yellow-400">
              {formatLiters(monthlyStats.avgSaidas)} L
            </div>
            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block mt-0.5">
              Consumo frotas e comboios
            </span>
          </div>

          {/* Card 3: Saldo Operacional Médio */}
          <div className="p-3 rounded-lg border border-[#eaecef] dark:border-[#262626] bg-[#f8fafc] dark:bg-[#141414]">
            <div className="flex items-center justify-between text-[#6b7280] dark:text-[#9ca3af] mb-1">
              <span className="text-[11px] font-medium flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-blue-500" />
                Saldo Médio Mensal
              </span>
            </div>
            <div
              className={`font-mono text-base sm:text-lg font-bold ${
                monthlyStats.avgSaldo >= 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {monthlyStats.avgSaldo >= 0 ? '+' : ''}
              {formatLiters(monthlyStats.avgSaldo)} L
            </div>
            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block mt-0.5">
              {monthlyStats.avgSaldo >= 0 ? 'Superávit médio de combustível' : 'Déficit médio'}
            </span>
          </div>

          {/* Card 4: Pico de Consumo */}
          <div className="p-3 rounded-lg border border-[#eaecef] dark:border-[#262626] bg-[#f8fafc] dark:bg-[#141414]">
            <div className="flex items-center justify-between text-[#6b7280] dark:text-[#9ca3af] mb-1">
              <span className="text-[11px] font-medium flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-yellow-500" />
                Mês de Maior Consumo
              </span>
            </div>
            <div className="font-mono text-base sm:text-lg font-bold text-yellow-600 dark:text-yellow-400 truncate">
              {monthlyStats.peakSaidas ? monthlyStats.peakSaidas.label : '-'}
            </div>
            <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block mt-0.5 truncate">
              {monthlyStats.peakSaidas ? `${formatLiters(monthlyStats.peakSaidas.saidas)} L consumidos` : 'Sem registros'}
            </span>
          </div>
        </div>

        {/* The Month-by-Month Line Chart */}
        <div className="w-full pt-2">
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyData}
                margin={{ top: 15, right: 15, left: -5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-15" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#888888' }}
                  stroke="#9ca3af"
                />
                <YAxis
                  unit="L"
                  tick={{ fontSize: 11, fill: '#888888' }}
                  stroke="#9ca3af"
                  tickFormatter={(val: number) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`)}
                />
                <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" opacity={0.5} />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const num = typeof value === 'number' ? value : Number(value);
                    const labelMap: Record<string, string> = {
                      entradas: 'Entradas (Cargas)',
                      saidas: 'Saídas (Consumo)',
                      saldo: 'Saldo Operacional',
                      rtwLiters: 'Comboio RTW1C01',
                      dzaLiters: 'Comboio DZA7G30',
                      spfLiters: 'Comboio SPF2C66',
                    };
                    return [`${formatLiters(num)} Litros`, labelMap[name] || name];
                  }}
                  labelFormatter={(label: any) => {
                    const pt = monthlyData.find((m) => m.label === label);
                    return pt ? pt.fullName : label;
                  }}
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#f4f4f5',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value: string) => {
                    const legendMap: Record<string, string> = {
                      entradas: 'Entradas (Recebimento)',
                      saidas: 'Saídas (Consumo)',
                      saldo: 'Saldo Líquido (Balanço)',
                      rtwLiters: 'Comboio RTW1C01',
                      dzaLiters: 'Comboio DZA7G30',
                      spfLiters: 'Comboio SPF2C66',
                    };
                    return <span className="text-xs text-[#374151] dark:text-[#d1d5db] font-medium">{legendMap[value] || value}</span>;
                  }}
                />

                {monthlyChartMode === 'general' ? (
                  <>
                    {showEntradasLine && (
                      <Line
                        type="monotone"
                        dataKey="entradas"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: '#10b981' }}
                        activeDot={{ r: 7 }}
                        name="entradas"
                      />
                    )}
                    {showSaidasLine && (
                      <Line
                        type="monotone"
                        dataKey="saidas"
                        stroke="#eab308"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: '#eab308' }}
                        activeDot={{ r: 7 }}
                        name="saidas"
                      />
                    )}
                    {showSaldoLine && (
                      <Line
                        type="monotone"
                        dataKey="saldo"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 3, strokeWidth: 1, fill: '#3b82f6' }}
                        activeDot={{ r: 6 }}
                        name="saldo"
                      />
                    )}
                  </>
                ) : (
                  <>
                    <Line
                      type="monotone"
                      dataKey="rtwLiters"
                      stroke="#eab308"
                      strokeWidth={2.5}
                      dot={{ r: 4, strokeWidth: 1, fill: '#eab308' }}
                      activeDot={{ r: 6 }}
                      name="rtwLiters"
                    />
                    <Line
                      type="monotone"
                      dataKey="dzaLiters"
                      stroke="#ec4899"
                      strokeWidth={2.5}
                      dot={{ r: 4, strokeWidth: 1, fill: '#ec4899' }}
                      activeDot={{ r: 6 }}
                      name="dzaLiters"
                    />
                    <Line
                      type="monotone"
                      dataKey="spfLiters"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={{ r: 4, strokeWidth: 1, fill: '#8b5cf6' }}
                      activeDot={{ r: 6 }}
                      name="spfLiters"
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Collapsible Month-by-Month Detailed Table */}
        {isMonthlyTableOpen && (
          <div className="pt-2 border-t border-[#eaecef] dark:border-[#262626] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827] dark:text-[#f3f4f6] flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                Demonstrativo Consolidado Mês a Mês ({monthlyData.length} meses apurados)
              </span>
              <span className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                Valores acumulados em Litros (L)
              </span>
            </div>

            <div className="overflow-x-auto border border-[#eaecef] dark:border-[#262626] rounded-md">
              <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] dark:bg-[#141414] text-[#4b5563] dark:text-[#9ca3af] uppercase text-[10px] font-bold tracking-wider border-b border-[#eaecef] dark:border-[#262626]">
                    <th className="p-2.5">Mês de Referência</th>
                    <th className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">Entradas (L)</th>
                    <th className="p-2.5 text-right font-mono text-yellow-600 dark:text-yellow-400">Saídas (L)</th>
                    <th className="p-2.5 text-right font-mono">Saldo Líquido (L)</th>
                    <th className="p-2.5 text-right font-mono">RTW1C01</th>
                    <th className="p-2.5 text-right font-mono">DZA7G30</th>
                    <th className="p-2.5 text-right font-mono">SPF2C66</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaecef] dark:divide-[#262626]">
                  {monthlyData.map((row) => (
                    <tr
                      key={row.key}
                      className="hover:bg-amber-500/5 transition-colors text-[#111827] dark:text-[#f3f4f6]"
                    >
                      <td className="p-2.5 font-semibold whitespace-nowrap">
                        <span className="font-mono text-amber-600 dark:text-amber-400 mr-2">{row.label}</span>
                        <span className="text-[#6b7280] dark:text-[#9ca3af] text-[11px]">({row.fullName})</span>
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatLiters(row.entradas)} L
                        <span className="block text-[10px] text-[#6b7280] dark:text-[#9ca3af] font-normal">
                          {row.numEntradas} {row.numEntradas === 1 ? 'carga' : 'cargas'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-yellow-600 dark:text-yellow-400">
                        {formatLiters(row.saidas)} L
                        <span className="block text-[10px] text-[#6b7280] dark:text-[#9ca3af] font-normal">
                          {row.numSaidas} {row.numSaidas === 1 ? 'abastec.' : 'abastecs.'}
                        </span>
                      </td>
                      <td
                        className={`p-2.5 text-right font-mono font-bold whitespace-nowrap ${
                          row.saldo >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {row.saldo >= 0 ? '+' : ''}
                        {formatLiters(row.saldo)} L
                      </td>
                      <td className="p-2.5 text-right font-mono text-[#4b5563] dark:text-[#d1d5db]">
                        {formatLiters(row.rtwLiters)} L
                      </td>
                      <td className="p-2.5 text-right font-mono text-[#4b5563] dark:text-[#d1d5db]">
                        {formatLiters(row.dzaLiters)} L
                      </td>
                      <td className="p-2.5 text-right font-mono text-[#4b5563] dark:text-[#d1d5db]">
                        {formatLiters(row.spfLiters)} L
                      </td>
                      <td className="p-2.5 text-center">
                        {row.saldo >= 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Superávit
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            Déficit
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3 sm:p-4 border border-[#dcdfe4] dark:border-[#333333] shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#eaecef] dark:border-[#262626]">
          <div>
            <h3 className="text-sm sm:text-base font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6] flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-emerald-500" />
              Entradas de Diesel (Recebimento de Cargas)
            </h3>
            <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
              Histórico de cargas de combustível recebidas ({filteredEntries.length} entradas)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              id="btn-export-excel-fuel-entries"
              onClick={() =>
                exportFuelEntriesToExcel(
                  filteredEntries,
                  { filterInfo: selectedDate ? `Posição até: ${formatDateBR(selectedDate)}` : undefined }
                )
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-600 shadow-xs transition-colors cursor-pointer"
              title="Exportar Entradas de Diesel (Recebimento de Cargas) em planilha Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-200" />
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              id="btn-export-pdf-fuel-entries"
              onClick={() =>
                exportFuelEntriesToPDF(
                  filteredEntries,
                  selectedDate ? `Posição até: ${formatDateBR(selectedDate)}` : undefined
                )
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#113861] hover:bg-[#0d2f54] text-white border border-[#1b4d82] shadow-xs transition-colors cursor-pointer"
              title="Exportar Entradas de Diesel em documento PDF com as colunas na sequência exata da tabela"
            >
              <FileText className="w-3.5 h-3.5 text-[#20b4a7]" />
              <span>Exportar PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewEntryOpen(true)}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Carga</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-[#eaecef] dark:border-[#262626] rounded-md">
          <table className="w-full min-w-[850px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] dark:bg-[#141414] text-[#4b5563] dark:text-[#9ca3af] uppercase text-[10px] font-bold tracking-wider border-b border-[#eaecef] dark:border-[#262626]">
                <th className="p-2.5">Data</th>
                <th className="p-2.5 text-right font-mono">Litros Recebidos</th>
                <th className="p-2.5 text-right font-mono">Valor Total (R$)</th>
                <th className="p-2.5">Fornecedor</th>
                <th className="p-2.5">Nota Fiscal</th>
                <th className="p-2.5">Destino</th>
                <th className="p-2.5">Responsável</th>
                <th className="p-2.5">Observações</th>
                <th className="p-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaecef] dark:divide-[#262626]">
              {filteredEntries.length > 0 ? (
                filteredEntries.map((ent) => (
                  <tr
                    key={ent.id}
                    className="hover:bg-emerald-500/5 transition-colors text-[#111827] dark:text-[#f3f4f6]"
                  >
                    <td className="p-2.5 font-mono whitespace-nowrap">{formatDateBR(ent.date)}</td>
                    <td className="p-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right bg-emerald-500/10 whitespace-nowrap">
                      +{formatLiters(ent.liters)} L
                    </td>
                    <td className="p-2.5 font-mono text-right whitespace-nowrap">
                      {ent.totalValue !== undefined && ent.totalValue !== null ? (
                        <button
                          type="button"
                          onClick={() => handleOpenAttachAndValueModal(ent)}
                          title="Clique para editar o Valor Total ou Anexo desta carga"
                          className="text-right hover:opacity-80 transition-opacity cursor-pointer group block w-full"
                        >
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 group-hover:underline">
                            {formatCurrency(ent.totalValue)}
                          </span>
                          {ent.liters > 0 && (
                            <span className="block text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                              R$ {(ent.totalValue / ent.liters).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/L
                            </span>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenAttachAndValueModal(ent)}
                          title="Clique para salvar o Valor Total desta carga de diesel"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-amber-500" />
                          <span>Informar Valor</span>
                        </button>
                      )}
                    </td>
                    <td className="p-2.5 font-medium">{ent.supplier || '-'}</td>
                    <td className="p-2.5 font-mono text-[#6b7280] dark:text-[#9ca3af]">
                      {ent.invoiceNumber || '-'}
                    </td>
                    <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af]">{ent.destination || 'Tanque Central'}</td>
                    <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af]">{ent.responsible || '-'}</td>
                    <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af] max-w-xs truncate">
                      {ent.notes || '-'}
                    </td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        {/* Botão de Anexo / Arquivo (PDF ou JPEG) em Ações */}
                        {(ent.attachmentUrl || ent.attachmentName) ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              id={`btn-view-entry-attachment-${ent.id}`}
                              onClick={async () => {
                                let finalUrl = ent.attachmentUrl;
                                if (!finalUrl) {
                                  const cached = await getInvoiceFileFromIndexedDB(`file_entry_${ent.id}`);
                                  if (cached?.dataUrl) finalUrl = cached.dataUrl;
                                }
                                if (!finalUrl) return;
                                setViewingAttachment({
                                  url: finalUrl,
                                  name: ent.attachmentName || `NF_${ent.invoiceNumber || ent.id}`,
                                  type: ent.attachmentType || 'PDF',
                                  size: ent.attachmentSize,
                                  date: ent.date,
                                  entryId: ent.id,
                                });
                                setViewerZoom(100);
                                setViewerRotation(0);
                              }}
                              title={`Visualizar ${ent.attachmentName || 'arquivo anexado'}`}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                                ent.attachmentType === 'PDF'
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30'
                                  : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30'
                              }`}
                            >
                              {ent.attachmentType === 'PDF' ? (
                                <FileText className="w-3 h-3 text-rose-500 shrink-0" />
                              ) : (
                                <FileImage className="w-3 h-3 text-blue-500 shrink-0" />
                              )}
                              <span>{ent.attachmentType === 'PDF' ? 'Ver PDF' : 'Ver Foto'}</span>
                            </button>

                            <button
                              type="button"
                              id={`btn-download-entry-attachment-${ent.id}`}
                              onClick={async () => {
                                let finalUrl = ent.attachmentUrl;
                                if (!finalUrl) {
                                  const cached = await getInvoiceFileFromIndexedDB(`file_entry_${ent.id}`);
                                  if (cached?.dataUrl) finalUrl = cached.dataUrl;
                                }
                                if (!finalUrl) return;
                                triggerFileDownload({
                                  id: ent.id,
                                  name: ent.attachmentName || `Anexo_${ent.invoiceNumber || ent.id}.${ent.attachmentType === 'PDF' ? 'pdf' : 'jpg'}`,
                                  fileType: ent.attachmentType || 'PDF',
                                  mimeType: ent.attachmentType === 'PDF' ? 'application/pdf' : 'image/jpeg',
                                  size: ent.attachmentSize || 0,
                                  uploadedAt: ent.createdAt,
                                  formattedDate: formatDateBR(ent.date),
                                  dataUrl: finalUrl,
                                });
                              }}
                              title="Baixar arquivo anexado"
                              className="p-1 rounded text-[#6b7280] hover:text-blue-500 hover:bg-blue-500/10 transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              id={`btn-manage-entry-attachment-${ent.id}`}
                              onClick={() => handleOpenAttachAndValueModal(ent)}
                              title="Alterar ou gerenciar Valor Total e Anexo"
                              className="p-1 rounded text-[#6b7280] hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            id={`btn-attach-file-entry-${ent.id}`}
                            onClick={() => handleOpenAttachAndValueModal(ent)}
                            title="Salvar Valor Total ou Anexar Arquivo (PDF/JPEG)"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
                          >
                            <Paperclip className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>Anexo / Valor</span>
                          </button>
                        )}

                        {/* Ações de Edição (Apenas para o Administrador Roberto Junior) e Exclusão */}
                        <div className="inline-flex items-center gap-1 pl-1 ml-1 border-l border-[#eaecef] dark:border-[#2f2f2f]">
                          {isRobertoJuniorAdmin && (
                            <button
                              type="button"
                              id={`btn-edit-fuel-entry-${ent.id}`}
                              onClick={() => handleStartEditEntry(ent)}
                              title="Editar esta entrada (Administrador Roberto Junior)"
                              className="p-1 rounded text-[#6b7280] hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            id={`btn-delete-fuel-entry-${ent.id}`}
                            onClick={() => setEntryToDelete(ent)}
                            title="Excluir esta entrada de diesel"
                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-xs text-[#9ca3af]">
                    <div className="font-semibold text-sm text-[#4b5563] dark:text-[#9ca3af] mb-1">
                      {entries.length === 0
                        ? 'Esta obra ainda não possui dados cadastrados.'
                        : 'Nenhum registro encontrado para o período selecionado.'}
                    </div>
                    <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                      {entries.length === 0
                        ? 'Nenhum registro encontrado. Registre as primeiras entradas de combustível desta obra.'
                        : 'Nenhum registro encontrado.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION: HISTÓRICO GERAL DE SAÍDAS (ABASTECIMENTOS DE TODOS OS COMBOIOS) COM A OBRA */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3 sm:p-4 border border-[#dcdfe4] dark:border-[#333333] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <TrendingDown className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs sm:text-sm font-bold font-industrial tracking-wide uppercase text-[#111827] dark:text-[#f3f4f6]">
              Histórico Consolidado de Saídas (Abastecimentos de Todos os Comboios)
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
              {tableFilteredDispenses.length}{' '}
              {tableFilteredDispenses.length === 1 ? 'abastecimento' : 'abastecimentos'}
            </span>
            {tableFilteredDispenses.length > 0 && dispensePageSize > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#f1f3f5] dark:bg-[#262626] text-[#4b5563] dark:text-[#9ca3af] font-mono border border-[#dcdfe4] dark:border-[#383838]">
                Página {safeCurrentPage} de {dispenseTotalPages} ({startRecordIndex}–{endRecordIndex})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              <span className="text-[11px] font-sans font-semibold text-[#4b5563] dark:text-[#9ca3af]">
                Subtotal:
              </span>
              <span>{formatLiters(tableFilteredDispensesLiters)} L</span>
            </div>

            <button
              type="button"
              id="btn-export-pdf-consolidated-dispenses"
              onClick={() => {
                const periodText =
                  dispenseFilterStartDate && dispenseFilterEndDate
                    ? `${formatDateBR(dispenseFilterStartDate)} até ${formatDateBR(dispenseFilterEndDate)}`
                    : dispenseFilterStartDate
                    ? `A partir de ${formatDateBR(dispenseFilterStartDate)}`
                    : dispenseFilterEndDate
                    ? `Até ${formatDateBR(dispenseFilterEndDate)}`
                    : selectedDate
                    ? `Posição até ${formatDateBR(selectedDate)}`
                    : undefined;

                exportConsolidatedDispensesToPDF(
                  tableFilteredDispenses,
                  equipments,
                  periodText,
                  dispenseFilterConvoy !== 'ALL' ? dispenseFilterConvoy : undefined
                );
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#113861] hover:bg-[#0d2f54] text-white border border-[#1b4d82] shadow-xs transition-colors cursor-pointer"
              title="Exportar Histórico Consolidado de Saídas em PDF formatado"
            >
              <FileText className="w-3.5 h-3.5 text-[#20b4a7]" />
              <span>Exportar PDF</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  await exportFuelReportToExcel(tableFilteredDispenses, equipments, {
                    obraText: '063/064',
                    responsibleText: 'Roberto Jr',
                    customFilename: `makmo_relatorio_abastecimentos_${dispenseFilterConvoy !== 'ALL' ? `${dispenseFilterConvoy}_` : ''}${selectedDate ? `ate_${selectedDate}_` : ''}${getTodayDateString()}.xlsx`,
                  });
                } catch (e) {
                  console.warn('Excel export error, using CSV fallback:', e);
                  exportFuelReportToCSV(
                    [],
                    tableFilteredDispenses,
                    undefined,
                    equipments,
                    `makmo_relatorio_abastecimentos_${dispenseFilterConvoy !== 'ALL' ? `${dispenseFilterConvoy}_` : ''}${selectedDate ? `ate_${selectedDate}_` : ''}${getTodayDateString()}.csv`
                  );
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border border-[#dcdfe4] dark:border-[#333333] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#374151] dark:text-[#d1d5db] transition-colors cursor-pointer"
              title="Exportar relatório padronizado em Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* ABA DE FILTRO POR COMBOIO */}
        <div className="border-b border-[#eaecef] dark:border-[#262626] -mb-1">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              id="tab-convoy-all"
              onClick={() => setDispenseFilterConvoy('ALL')}
              className={`px-3 py-1.5 rounded-t-md text-xs font-semibold whitespace-nowrap transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                dispenseFilterConvoy === 'ALL'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold'
                  : 'border-transparent text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Todos os Comboios</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  dispenseFilterConvoy === 'ALL'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-[#6b7280] dark:text-[#9ca3af]'
                }`}
              >
                {convoyCounts.ALL?.count || 0} ({formatLiters(convoyCounts.ALL?.liters || 0)} L)
              </span>
            </button>

            {availableConvoys.map((convoy) => {
              const isActive = dispenseFilterConvoy === convoy;
              const info = convoyCounts[convoy] || { count: 0, liters: 0 };
              return (
                <button
                  key={convoy}
                  type="button"
                  id={`tab-convoy-${convoy}`}
                  onClick={() => setDispenseFilterConvoy(convoy)}
                  className={`px-3 py-1.5 rounded-t-md text-xs font-semibold whitespace-nowrap transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold'
                      : 'border-transparent text-[#6b7280] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="font-mono">{convoy}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-[#6b7280] dark:text-[#9ca3af]'
                    }`}
                  >
                    {info.count} ({formatLiters(info.liters)} L)
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* BARRA DE FILTROS ADICIONAIS: BUSCA, OBRA, TIPO E PERÍODO */}
        <div className="bg-[#f8fafc] dark:bg-[#141414] p-2.5 rounded-md border border-[#eaecef] dark:border-[#262626]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
            {/* Campo de Busca Rápida */}
            <div className="lg:col-span-4 relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#9ca3af]" />
              <input
                type="text"
                id="filter-dispenses-search"
                value={dispenseFilterSearch}
                onChange={(e) => setDispenseFilterSearch(e.target.value)}
                placeholder="Buscar por placa, prefixo, tipo, operador..."
                className="w-full h-8 pl-8 pr-7 text-xs bg-white dark:bg-[#1c1c1c] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] placeholder-[#9ca3af] focus:outline-none focus:border-amber-500"
              />
              {dispenseFilterSearch && (
                <button
                  type="button"
                  onClick={() => setDispenseFilterSearch('')}
                  className="absolute right-2 top-2 text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro por Obra */}
            <div className="lg:col-span-3">
              <select
                id="filter-dispenses-obra"
                value={dispenseFilterObra}
                onChange={(e) => setDispenseFilterObra(e.target.value)}
                className="w-full h-8 px-2 text-xs bg-white dark:bg-[#1c1c1c] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="ALL">Todas as Obras ({availableObras.length})</option>
                {availableObras.map((obra) => (
                  <option key={obra} value={obra}>
                    {obra}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Tipo de Máquina */}
            <div className="lg:col-span-2">
              <select
                id="filter-dispenses-type"
                value={dispenseFilterType}
                onChange={(e) => setDispenseFilterType(e.target.value)}
                className="w-full h-8 px-2 text-xs bg-white dark:bg-[#1c1c1c] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="ALL">Todos os Tipos ({availableTypes.length})</option>
                {availableTypes.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Intervalo de Datas */}
            <div className="lg:col-span-3 flex items-center gap-1">
              <div className="relative flex-1">
                <input
                  type="date"
                  title="Data Inicial"
                  value={dispenseFilterStartDate}
                  onChange={(e) => setDispenseFilterStartDate(e.target.value)}
                  className="w-full h-8 px-2 text-[11px] bg-white dark:bg-[#1c1c1c] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                />
              </div>
              <span className="text-[11px] text-[#9ca3af] px-0.5">até</span>
              <div className="relative flex-1">
                <input
                  type="date"
                  title="Data Final"
                  value={dispenseFilterEndDate}
                  onChange={(e) => setDispenseFilterEndDate(e.target.value)}
                  className="w-full h-8 px-2 text-[11px] bg-white dark:bg-[#1c1c1c] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                />
              </div>

              {hasActiveDispenseFilters && (
                <button
                  type="button"
                  id="btn-reset-dispense-filters"
                  onClick={handleResetDispenseFilters}
                  title="Limpar todos os filtros"
                  className="h-8 px-2 rounded text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-[#eaecef] dark:border-[#262626] rounded-md">
          <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] dark:bg-[#141414] text-[#4b5563] dark:text-[#9ca3af] uppercase text-[10px] font-bold tracking-wider border-b border-[#eaecef] dark:border-[#262626]">
                <th className="p-2.5">Data</th>
                <th className="p-2.5">Comboio</th>
                <th className="p-2.5">Placa da Máquina</th>
                <th className="p-2.5">Tipo</th>
                <th className="p-2.5">Fornecedor</th>
                <th className="p-2.5">Obra</th>
                <th className="p-2.5 text-right font-mono">Horímetro / KM</th>
                <th className="p-2.5 text-right font-mono">Iniciante</th>
                <th className="p-2.5 text-right font-mono">Encerrante</th>
                <th className="p-2.5 text-right font-mono">Litros (L)</th>
                <th className="p-2.5">Operador / Resp.</th>
                <th className="p-2.5">Observações</th>
                <th className="p-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaecef] dark:divide-[#262626]">
              {tableFilteredDispenses.length > 0 ? (
                paginatedDispenses.map((disp) => {
                  const equip = equipments.find(
                    (eq) =>
                      (eq.plate && eq.plate.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase()) ||
                      eq.code.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase() ||
                      (eq.prefix && eq.prefix.trim().toUpperCase() === disp.equipmentCode.trim().toUpperCase())
                  );
                  const equipObra = disp.location || equip?.location || 'Não informada';
                  const equipSupplier = disp.supplier || equip?.supplier || '-';
                  const displayPlate = equip?.plate || disp.equipmentCode;

                  return (
                    <tr
                      key={disp.id}
                      className="hover:bg-amber-500/5 transition-colors text-[#111827] dark:text-[#f3f4f6]"
                    >
                      <td className="p-2.5 font-mono whitespace-nowrap">{formatDateBR(disp.date)}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-neutral-100 dark:bg-neutral-800 border border-[#dcdfe4] dark:border-[#383838] text-amber-600 dark:text-amber-400">
                          {disp.convoyPlate}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono whitespace-nowrap">
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {displayPlate}
                        </span>
                        {equip?.prefix && equip.prefix !== displayPlate && (
                          <span className="ml-1 text-[10px] text-[#6b7280] dark:text-[#9ca3af] font-normal">
                            ({equip.prefix})
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af]">{disp.equipmentType || '-'}</td>
                      <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af] whitespace-nowrap">{equipSupplier}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#f1f3f5] dark:bg-[#262626] text-[#374151] dark:text-[#d1d5db] border border-[#dcdfe4] dark:border-[#383838]">
                          <Building2 className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>{equipObra}</span>
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono whitespace-nowrap">
                        {disp.equipmentMeter !== undefined && !isNaN(disp.equipmentMeter) ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-[#f1f3f5] dark:bg-[#262626] text-[#111827] dark:text-[#f3f4f6] border border-[#dcdfe4] dark:border-[#383838]">
                            {disp.equipmentMeterUnit === 'KM' ? (
                              <Gauge className="w-3 h-3 text-amber-500 shrink-0" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                            )}
                            <span>
                              {formatHours(disp.equipmentMeter)}{' '}
                              {disp.equipmentMeterUnit === 'KM' ? 'km' : 'h'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[#9ca3af]">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono">{formatHours(disp.initialMeter)}</td>
                      <td className="p-2.5 text-right font-mono">{formatHours(disp.finalMeter)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10">
                        {formatLiters(disp.liters)} L
                      </td>
                      <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af]">{disp.operator || '-'}</td>
                      <td className="p-2.5 text-[#6b7280] dark:text-[#9ca3af] max-w-xs truncate">
                        {disp.notes || '-'}
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            id={`btn-edit-summary-dispense-${disp.id}`}
                            onClick={() => handleStartEditDispense(disp)}
                            title="Editar este abastecimento"
                            className="p-1 rounded text-[#6b7280] hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            id={`btn-delete-summary-dispense-${disp.id}`}
                            onClick={() => setDispenseToDelete(disp)}
                            title="Excluir este abastecimento"
                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-xs text-[#9ca3af]">
                    <div className="font-semibold text-sm text-[#4b5563] dark:text-[#9ca3af] mb-1">
                      {dispenses.length === 0
                        ? 'Esta obra ainda não possui dados cadastrados.'
                        : 'Nenhum registro encontrado para os filtros selecionados.'}
                    </div>
                    <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                      {dispenses.length === 0
                        ? 'Nenhum registro encontrado. Registre os primeiros abastecimentos de máquinas desta obra.'
                        : 'Nenhum registro encontrado.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
            {tableFilteredDispenses.length > 0 && (
              <tfoot>
                {/* Subtotal da Página Atual */}
                <tr className="bg-amber-500/10 dark:bg-amber-500/15 font-bold border-t-2 border-amber-500/30 text-[#111827] dark:text-[#f3f4f6]">
                  <td
                    colSpan={9}
                    className="p-2.5 text-right uppercase text-[11px] font-industrial tracking-wider text-[#374151] dark:text-[#d1d5db]"
                  >
                    Subtotal da Página ({paginatedDispenses.length}{' '}
                    {paginatedDispenses.length === 1 ? 'abastecimento' : 'abastecimentos'}
                    {dispenseTotalPages > 1 ? ` — Pág. ${safeCurrentPage}/${dispenseTotalPages}` : ''}):
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/20 text-xs sm:text-sm whitespace-nowrap">
                    {formatLiters(paginatedDispensesLiters)} L
                  </td>
                  <td colSpan={3} className="p-2.5"></td>
                </tr>

                {/* Total Consolidado Geral Filtrado (quando há mais de uma página) */}
                {dispenseTotalPages > 1 && (
                  <tr className="bg-[#f8fafc] dark:bg-[#151515] font-bold border-t border-[#dcdfe4] dark:border-[#333333] text-[#111827] dark:text-[#f3f4f6]">
                    <td
                      colSpan={9}
                      className="p-2.5 text-right uppercase text-[11px] font-industrial tracking-wider text-[#6b7280] dark:text-[#9ca3af]"
                    >
                      Total Consolidado de Todas as Páginas ({tableFilteredDispenses.length}{' '}
                      {tableFilteredDispenses.length === 1 ? 'abastecimento' : 'abastecimentos'}):
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs sm:text-sm whitespace-nowrap">
                      {formatLiters(tableFilteredDispensesLiters)} L
                    </td>
                    <td colSpan={3} className="p-2.5"></td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>

        {/* BARRA DE PAGINAÇÃO (SEQUÊNCIA DE 50 EM 50) */}
        {tableFilteredDispenses.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 pb-1 px-1 border-t border-[#eaecef] dark:border-[#262626] text-xs">
            {/* Informações da página e contadores de registros */}
            <div className="flex items-center gap-2 flex-wrap text-[#4b5563] dark:text-[#9ca3af]">
              <span>
                Exibindo{' '}
                <strong className="text-[#111827] dark:text-[#f3f4f6] font-mono">
                  {startRecordIndex}
                </strong>{' '}
                a{' '}
                <strong className="text-[#111827] dark:text-[#f3f4f6] font-mono">
                  {endRecordIndex}
                </strong>{' '}
                de{' '}
                <strong className="text-amber-600 dark:text-amber-400 font-mono">
                  {tableFilteredDispenses.length}
                </strong>{' '}
                abastecimentos
              </span>
              <span className="text-[#9ca3af] hidden sm:inline">•</span>
              <span className="text-[11px] hidden sm:inline">
                Página <strong className="text-[#111827] dark:text-[#f3f4f6]">{safeCurrentPage}</strong> de{' '}
                <strong className="text-[#111827] dark:text-[#f3f4f6]">{dispenseTotalPages}</strong>
              </span>
            </div>

            {/* Controles da Sequência Páginada */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Botão Primeira Página */}
              <button
                type="button"
                id="btn-dispense-page-first"
                disabled={safeCurrentPage === 1}
                onClick={() => setDispenseCurrentPage(1)}
                title="Ir para a primeira página"
                className="p-1.5 rounded-md border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#1f1f1f] text-[#374151] dark:text-[#d1d5db] hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Botão Anterior */}
              <button
                type="button"
                id="btn-dispense-page-prev"
                disabled={safeCurrentPage === 1}
                onClick={() => setDispenseCurrentPage((prev) => Math.max(1, prev - 1))}
                title="Página anterior"
                className="px-2.5 py-1.5 rounded-md border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#1f1f1f] text-[#374151] dark:text-[#d1d5db] hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              {/* Sequência Numérica de Páginas (1, 2, 3...) */}
              <div className="flex items-center gap-1">
                {getPageNumbersSequence(safeCurrentPage, dispenseTotalPages).map((item, idx) => {
                  if (item === 'ellipsis') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1 text-[#9ca3af] font-mono select-none">
                        …
                      </span>
                    );
                  }
                  const pageNum = item as number;
                  const isActive = pageNum === safeCurrentPage;
                  return (
                    <button
                      key={`page-${pageNum}`}
                      type="button"
                      id={`btn-dispense-page-${pageNum}`}
                      onClick={() => setDispenseCurrentPage(pageNum)}
                      className={`min-w-8 h-8 px-2 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 shadow-xs border border-amber-600'
                          : 'bg-white dark:bg-[#1f1f1f] border border-[#dcdfe4] dark:border-[#333333] text-[#374151] dark:text-[#d1d5db] hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              {/* Botão Próxima */}
              <button
                type="button"
                id="btn-dispense-page-next"
                disabled={safeCurrentPage === dispenseTotalPages}
                onClick={() => setDispenseCurrentPage((prev) => Math.min(dispenseTotalPages, prev + 1))}
                title="Próxima página"
                className="px-2.5 py-1.5 rounded-md border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#1f1f1f] text-[#374151] dark:text-[#d1d5db] hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Botão Última Página */}
              <button
                type="button"
                id="btn-dispense-page-last"
                disabled={safeCurrentPage === dispenseTotalPages}
                onClick={() => setDispenseCurrentPage(dispenseTotalPages)}
                title="Ir para a última página"
                className="p-1.5 rounded-md border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#1f1f1f] text-[#374151] dark:text-[#d1d5db] hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>

              {/* Seletor de Sequência (50 por página padrão) */}
              <div className="flex items-center gap-1.5 ml-1 sm:ml-2 pl-1 sm:pl-2 border-l border-[#dcdfe4] dark:border-[#333333]">
                <span className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] hidden lg:inline">Exibir:</span>
                <select
                  id="select-dispense-page-size"
                  value={dispensePageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setDispensePageSize(newSize);
                    setDispenseCurrentPage(1);
                  }}
                  className="h-8 px-2 rounded-md text-xs bg-white dark:bg-[#1f1f1f] border border-[#dcdfe4] dark:border-[#333333] text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500 font-medium cursor-pointer"
                  title="Quantidade de abastecimentos por página"
                >
                  <option value={25}>25 por pág.</option>
                  <option value={50}>50 por pág. (Padrão)</option>
                  <option value={100}>100 por pág.</option>
                  <option value={200}>200 por pág.</option>
                  <option value={0}>Todos ({tableFilteredDispenses.length})</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal for Entry */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1f1f1f] rounded-lg max-w-md w-full p-4 sm:p-5 border border-[#dcdfe4] dark:border-[#333333] shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirmar Exclusão de Entrada</span>
            </div>
            <p className="text-xs text-[#4b5563] dark:text-[#d1d5db]">
              Deseja realmente remover a entrada de{' '}
              <strong>{formatLiters(entryToDelete.liters)} Litros</strong> de{' '}
              <strong>{formatDateBR(entryToDelete.date)}</strong>? Esta ação afetará o saldo
              calculado do tanque.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#eaecef] dark:border-[#2f2f2f]">
              <button
                type="button"
                onClick={() => setEntryToDelete(null)}
                className="px-3 py-1.5 rounded border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteEntry(entryToDelete.id);
                  setEntryToDelete(null);
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Excluir Entrada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Dispense */}
      {dispenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1f1f1f] rounded-lg max-w-md w-full p-4 sm:p-5 border border-[#dcdfe4] dark:border-[#333333] shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirmar Exclusão de Abastecimento</span>
            </div>
            <p className="text-xs text-[#4b5563] dark:text-[#d1d5db]">
              Deseja realmente excluir o abastecimento de{' '}
              <strong>{formatLiters(dispenseToDelete.liters)} Litros</strong> do comboio{' '}
              <strong>{dispenseToDelete.convoyPlate}</strong> para o equipamento{' '}
              <strong>{dispenseToDelete.equipmentCode}</strong> ({dispenseToDelete.location || 'Obra'}) em{' '}
              <strong>{formatDateBR(dispenseToDelete.date)}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#eaecef] dark:border-[#2f2f2f]">
              <button
                type="button"
                onClick={() => setDispenseToDelete(null)}
                className="px-3 py-1.5 rounded border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDispense(dispenseToDelete.id);
                  setDispenseToDelete(null);
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Excluir Abastecimento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Zerar Lançamentos de Combustível com Senha de Desenvolvedor */}
      {isDeveloper && isResetConfirmOpen && onResetFuelData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1f1f1f] rounded-xl max-w-md w-full p-5 border border-rose-500/40 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#111827] dark:text-[#f3f4f6]">
                    Zerar Gestão de Combustível
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    Ação Crítica
                  </span>
                </div>
                <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] leading-relaxed">
                  Esta ação irá apagar todos os registros de <strong>cargas de diesel</strong> e <strong>abastecimentos</strong> para que você possa iniciar os lançamentos do zero.
                </p>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold flex items-center gap-1.5 mb-1 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>O que será zerado no sistema:</span>
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] ml-1">
                <li><strong>{entries.length}</strong> registro(s) de entrada / cargas de diesel</li>
                <li><strong>{dispenses.length}</strong> registro(s) de abastecimento de equipamentos</li>
                <li>Os saldos dos comboios <strong>RTW1C01</strong>, <strong>DZA7G30</strong> e <strong>SPF2C66</strong> voltarão para <strong>0,0 L</strong></li>
              </ul>
            </div>

            {/* Campo Obrigatório: Senha de Desenvolvedor */}
            <div className="bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#2f2f2f] rounded-lg p-3.5 space-y-2">
              <label
                htmlFor="reset-dev-password-input"
                className="block text-xs font-bold text-[#111827] dark:text-[#f3f4f6]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    Senha de Desenvolvedor
                  </span>
                  <span className="text-[10px] font-semibold text-rose-500 dark:text-rose-400">
                    Obrigatório
                  </span>
                </div>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#9ca3af]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="reset-dev-password-input"
                  type={showResetDevPassword ? 'text' : 'password'}
                  value={resetDevPassword}
                  onChange={(e) => {
                    setResetDevPassword(e.target.value);
                    if (resetPasswordError) setResetPasswordError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmReset();
                    }
                  }}
                  placeholder="Digite a senha de desenvolvedor..."
                  autoFocus
                  className="w-full h-9 pl-9 pr-10 text-xs rounded border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#1f1f1f] text-[#111827] dark:text-[#f3f4f6] focus:outline-hidden focus:ring-2 focus:ring-rose-500 placeholder:text-[#9ca3af]"
                />
                <button
                  type="button"
                  onClick={() => setShowResetDevPassword(!showResetDevPassword)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] cursor-pointer"
                  title={showResetDevPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showResetDevPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {resetPasswordError && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{resetPasswordError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#eaecef] dark:border-[#2f2f2f]">
              <button
                type="button"
                onClick={() => {
                  setIsResetConfirmOpen(false);
                  setResetDevPassword('');
                  setShowResetDevPassword(false);
                  setResetPasswordError(null);
                }}
                className="px-3 py-1.5 rounded border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#374151] dark:text-[#d1d5db] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-zerar-dados"
                type="button"
                onClick={handleConfirmReset}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirmar e Zerar Tudo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Entrada / Carga (Apenas Administrador Roberto Junior) */}
      {isRobertoJuniorAdmin && entryToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1f1f1f] rounded-xl max-w-lg w-full p-5 border border-emerald-500/40 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaecef] dark:border-[#2f2f2f]">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-[#111827] dark:text-[#f3f4f6]">
                  Editar Entrada de Diesel (Administrador Roberto Junior)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEntryToEdit(null)}
                className="p-1 rounded text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editEntryError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editEntryError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditEntry} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Data da Entrada *
                  </label>
                  <input
                    type="date"
                    required
                    value={editEntryDate}
                    onChange={(e) => setEditEntryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Volume Recebido (Litros) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editEntryLiters}
                    onChange={(e) => setEditEntryLiters(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Valor Total (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[11px] font-bold text-[#9ca3af] font-mono">
                      R$
                    </span>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={editEntryTotalValue}
                      onChange={(e) => setEditEntryTotalValue(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs font-mono font-bold rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Fornecedor / Distribuidora
                  </label>
                  <input
                    type="text"
                    value={editEntrySupplier}
                    onChange={(e) => setEditEntrySupplier(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Nota Fiscal (NF)
                  </label>
                  <input
                    type="text"
                    value={editEntryInvoice}
                    onChange={(e) => setEditEntryInvoice(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Destino da Carga
                  </label>
                  <select
                    value={editEntryDestination}
                    onChange={(e) => setEditEntryDestination(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  >
                    <option value="Tanque Central">Tanque Central</option>
                    <option value="Comboio RTW1C01">Comboio RTW1C01</option>
                    <option value="Comboio DZA7G30">Comboio DZA7G30</option>
                    <option value="Comboio SPF2C66">Comboio SPF2C66</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Responsável
                  </label>
                  <input
                    type="text"
                    value={editEntryResponsible}
                    onChange={(e) => setEditEntryResponsible(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  value={editEntryNotes}
                  onChange={(e) => setEditEntryNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                />
              </div>

              {/* Anexo de Arquivo no Modal de Edição */}
              <div className="pt-2 border-t border-[#eaecef] dark:border-[#2f2f2f] space-y-1.5">
                <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af]">
                  Arquivo Anexado (PDF ou JPEG)
                </label>
                {editEntryAttachment ? (
                  <div className="flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      {editEntryAttachment.type === 'PDF' ? (
                        <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                      ) : (
                        <FileImage className="w-4 h-4 text-blue-500 shrink-0" />
                      )}
                      <span className="font-mono font-bold text-[#111827] dark:text-[#f3f4f6] truncate">
                        {editEntryAttachment.name}
                      </span>
                      <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                        ({formatFileSize(editEntryAttachment.size)})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="cursor-pointer text-xs text-amber-600 hover:text-amber-700 font-semibold underline px-1">
                        Substituir
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const validation = validateInvoiceFile(file);
                            if (!validation.valid) {
                              setEditEntryError(validation.error || 'Formato de arquivo inválido.');
                              return;
                            }
                            try {
                              const url = await readFileAsDataURL(file);
                              setEditEntryAttachment({
                                url,
                                name: file.name,
                                type: validation.fileType,
                                size: file.size,
                              });
                              setEditEntryError(null);
                            } catch (err) {
                              setEditEntryError('Erro ao ler o arquivo selecionado.');
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditEntryAttachment(null)}
                        className="text-xs text-rose-500 hover:text-rose-700 font-semibold underline px-1 cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors">
                    <Paperclip className="w-3.5 h-3.5 text-amber-500" />
                    <span>Selecionar Arquivo (PDF ou JPEG)</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const validation = validateInvoiceFile(file);
                        if (!validation.valid) {
                          setEditEntryError(validation.error || 'Formato de arquivo inválido.');
                          return;
                        }
                        try {
                          const url = await readFileAsDataURL(file);
                          setEditEntryAttachment({
                            url,
                            name: file.name,
                            type: validation.fileType,
                            size: file.size,
                          });
                          setEditEntryError(null);
                        } catch (err) {
                          setEditEntryError('Erro ao ler o arquivo selecionado.');
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#eaecef] dark:border-[#2f2f2f]">
                <button
                  type="button"
                  onClick={() => setEntryToEdit(null)}
                  className="px-3 py-1.5 rounded border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Abastecimento */}
      {dispenseToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1f1f1f] rounded-xl max-w-xl w-full p-5 border border-amber-500/40 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaecef] dark:border-[#2f2f2f]">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-[#111827] dark:text-[#f3f4f6]">
                  Editar Abastecimento de Equipamento
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDispenseToEdit(null)}
                className="p-1 rounded text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editDispenseError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editDispenseError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditDispense} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Comboio *
                  </label>
                  <select
                    value={editDispenseConvoyPlate}
                    onChange={(e) => setEditDispenseConvoyPlate(e.target.value as ConvoyPlate)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  >
                    <option value="RTW1C01">RTW1C01</option>
                    <option value="DZA7G30">DZA7G30</option>
                    <option value="SPF2C66">SPF2C66</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Placa / Máquina *
                  </label>
                  <input
                    type="text"
                    required
                    value={editDispenseEquipmentCode}
                    onChange={(e) => setEditDispenseEquipmentCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDispenseDate}
                    onChange={(e) => setEditDispenseDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Leitura Inicial (Bomba) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editDispenseInitialMeter}
                    onChange={(e) => setEditDispenseInitialMeter(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Leitura Final (Encerrante) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editDispenseFinalMeter}
                    onChange={(e) => setEditDispenseFinalMeter(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Litros Calculados
                  </label>
                  <div className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    {(() => {
                      const init = parseFloat(editDispenseInitialMeter.replace(',', '.'));
                      const fin = parseFloat(editDispenseFinalMeter.replace(',', '.'));
                      if (!isNaN(init) && !isNaN(fin) && fin >= init) {
                        return `${formatLiters(fin - init)} L`;
                      }
                      return '0,00 L';
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Horímetro / KM do Equipamento
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={editDispenseEquipmentMeter}
                      onChange={(e) => setEditDispenseEquipmentMeter(e.target.value)}
                      placeholder="Valor atual..."
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                    />
                    <select
                      value={editDispenseMeterUnit}
                      onChange={(e) => setEditDispenseMeterUnit(e.target.value as 'HORAS' | 'KM')}
                      className="w-24 px-2 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                    >
                      <option value="HORAS">Horas</option>
                      <option value="KM">KM</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Operador / Responsável
                  </label>
                  <input
                    type="text"
                    value={editDispenseOperator}
                    onChange={(e) => setEditDispenseOperator(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  value={editDispenseNotes}
                  onChange={(e) => setEditDispenseNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#eaecef] dark:border-[#2f2f2f]">
                <button
                  type="button"
                  onClick={() => setDispenseToEdit(null)}
                  className="px-3 py-1.5 rounded border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors shadow-xs"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Salvar Valor Total e Anexo de Arquivo da Entrada */}
      {attachingEntry && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl max-w-lg w-full p-5 border border-amber-500/40 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaecef] dark:border-[#262626]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#111827] dark:text-[#f3f4f6]">
                    Salvar Valor Total & Anexo da Entrada
                  </h3>
                  <p className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                    Atualize o valor total da nota fiscal e anexe o arquivo comprobatório (PDF ou JPEG).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAttachingEntry(null);
                  setSelectedAttachFile(null);
                  setAttachError(null);
                  setAttachRemoveCurrentFile(false);
                }}
                className="p-1 rounded text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Detalhes da Entrada */}
            <div className="p-3 rounded-lg bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#333333] text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[10px] uppercase font-bold">Data da Carga:</span>
                <span className="font-mono text-[#111827] dark:text-[#f3f4f6] font-semibold">{formatDateBR(attachingEntry.date)}</span>
              </div>
              <div>
                <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[10px] uppercase font-bold">Volume Recebido:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  +{formatLiters(attachingEntry.liters)} L
                </span>
              </div>
              <div>
                <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[10px] uppercase font-bold">Fornecedor:</span>
                <span className="text-[#111827] dark:text-[#f3f4f6] truncate block">{attachingEntry.supplier || '-'}</span>
              </div>
              <div>
                <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[10px] uppercase font-bold">Destino:</span>
                <span className="text-[#111827] dark:text-[#f3f4f6] truncate block">{attachingEntry.destination || 'Tanque Central'}</span>
              </div>
            </div>

            {/* Campo de Valor Total e Preço Unitário */}
            <div className="space-y-1.5 p-3 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20">
              <label className="block text-xs font-bold text-[#111827] dark:text-[#f3f4f6]">
                Valor Total da Carga (R$)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-[11px] font-bold text-[#9ca3af] font-mono">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={attachTotalValue}
                  onChange={(e) => setAttachTotalValue(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 bg-white dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-xs font-mono font-bold text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Cálculo do Preço Unitário por Litro em Tempo Real */}
              {(() => {
                const pVal = parseCurrencyInput(attachTotalValue);
                if (pVal && attachingEntry.liters > 0) {
                  const uPrice = pVal / attachingEntry.liters;
                  return (
                    <div className="flex items-center justify-between px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                      <span className="font-sans font-semibold">Preço Calculado por Litro:</span>
                      <span className="font-bold">
                        R$ {uPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / Litro
                      </span>
                    </div>
                  );
                }
                return (
                  <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] block">
                    Informe o valor total da nota fiscal para registrar o custo total e o preço por litro.
                  </span>
                );
              })()}
            </div>

            {/* Campo de Nota Fiscal */}
            <div>
              <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                Número da Nota Fiscal (NF)
              </label>
              <input
                type="text"
                placeholder="Ex: NF 10425"
                value={attachInvoiceNumber}
                onChange={(e) => setAttachInvoiceNumber(e.target.value)}
                className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-xs font-mono text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Anexo Atual se já houver */}
            {attachingEntry.attachmentUrl && !attachRemoveCurrentFile && (
              <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  {attachingEntry.attachmentType === 'PDF' ? (
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : (
                    <FileImage className="w-4 h-4 text-blue-500 shrink-0" />
                  )}
                  <div className="truncate">
                    <span className="font-bold text-[#111827] dark:text-[#f3f4f6] block truncate">
                      {attachingEntry.attachmentName || 'Anexo Atual'}
                    </span>
                    <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                      Arquivo atualmente vinculado {attachingEntry.attachmentSize ? `(${formatFileSize(attachingEntry.attachmentSize)})` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewingAttachment({
                        url: attachingEntry.attachmentUrl!,
                        name: attachingEntry.attachmentName || `NF_${attachingEntry.invoiceNumber || attachingEntry.id}`,
                        type: attachingEntry.attachmentType || 'PDF',
                        size: attachingEntry.attachmentSize,
                        date: attachingEntry.date,
                        entryId: attachingEntry.id,
                      });
                      setViewerZoom(100);
                      setViewerRotation(0);
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                  >
                    Ver
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachmentFromEntry(attachingEntry)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold underline cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              </div>
            )}

            {attachRemoveCurrentFile && (
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between">
                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                  O anexo atual será removido ao salvar.
                </span>
                <button
                  type="button"
                  onClick={() => setAttachRemoveCurrentFile(false)}
                  className="text-xs text-blue-600 hover:underline font-bold cursor-pointer"
                >
                  Desfazer
                </button>
              </div>
            )}

            {attachError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{attachError}</span>
              </div>
            )}

            {/* Seleção de Novo Arquivo */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af]">
                {attachingEntry.attachmentUrl && !attachRemoveCurrentFile
                  ? 'Substituir arquivo (PDF ou JPEG/JPG):'
                  : 'Anexar comprovante / Nota Fiscal (PDF ou JPEG/JPG):'}
              </label>

              <label className="border-2 border-dashed border-[#dcdfe4] dark:border-[#333333] hover:border-amber-500/60 dark:hover:border-amber-500/60 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[#f8fafc]/50 dark:bg-[#141414]/50">
                <UploadCloud className="w-6 h-6 text-amber-500 mb-1.5" />
                <span className="text-xs font-bold text-[#111827] dark:text-[#f3f4f6]">
                  {selectedAttachFile ? selectedAttachFile.name : 'Clique para selecionar ou arraste o arquivo'}
                </span>
                <span className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] mt-0.5">
                  Formatos aceitos: PDF, JPEG ou JPG (máx. 15MB)
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSelectFileForAttach(f);
                  }}
                />
              </label>

              {selectedAttachFile && (
                <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    {selectedAttachFile.name.toLowerCase().endsWith('.pdf') ? (
                      <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                    ) : (
                      <FileImage className="w-4 h-4 text-blue-500 shrink-0" />
                    )}
                    <span className="font-mono font-bold text-[#111827] dark:text-[#f3f4f6] truncate">
                      {selectedAttachFile.name}
                    </span>
                    <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                      ({formatFileSize(selectedAttachFile.size)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAttachFile(null)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#eaecef] dark:border-[#262626]">
              <button
                type="button"
                onClick={() => {
                  setAttachingEntry(null);
                  setSelectedAttachFile(null);
                  setAttachError(null);
                  setAttachRemoveCurrentFile(false);
                }}
                className="px-3 py-1.5 rounded border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingAttachment}
                onClick={handleConfirmAttachFile}
                className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSavingAttachment ? (
                  <span>Salvando Dados...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Salvar Valor e Anexo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização de Arquivo / Nota Fiscal */}
      {viewingAttachment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl max-w-4xl w-full h-[85vh] flex flex-col border border-amber-500/40 shadow-2xl overflow-hidden">
            {/* Cabeçalho do Visualizador */}
            <div className="flex items-center justify-between p-3 sm:px-4 sm:py-3 border-b border-[#eaecef] dark:border-[#262626] bg-[#f8fafc] dark:bg-[#141414] shrink-0">
              <div className="flex items-center gap-2 truncate pr-2">
                {viewingAttachment.type === 'PDF' ? (
                  <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                ) : (
                  <FileImage className="w-4 h-4 text-blue-500 shrink-0" />
                )}
                <div className="truncate">
                  <h3 className="text-xs sm:text-sm font-bold text-[#111827] dark:text-[#f3f4f6] truncate font-mono">
                    {viewingAttachment.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                    <span className="font-semibold uppercase tracking-wider">{viewingAttachment.type}</span>
                    {viewingAttachment.size ? <span>• {formatFileSize(viewingAttachment.size)}</span> : null}
                    {viewingAttachment.date ? <span>• {formatDateBR(viewingAttachment.date)}</span> : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {viewingAttachment.type !== 'PDF' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setViewerZoom((z) => Math.max(50, z - 25))}
                      className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-[#4b5563] dark:text-[#9ca3af] cursor-pointer"
                      title="Diminuir Zoom"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-mono text-[#6b7280] dark:text-[#9ca3af] px-1">
                      {viewerZoom}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewerZoom((z) => Math.min(250, z + 25))}
                      className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-[#4b5563] dark:text-[#9ca3af] cursor-pointer"
                      title="Aumentar Zoom"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewerRotation((r) => (r + 90) % 360)}
                      className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-[#4b5563] dark:text-[#9ca3af] cursor-pointer"
                      title="Girar 90°"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() =>
                    triggerFileDownload({
                      id: viewingAttachment.entryId || 'file',
                      name: viewingAttachment.name,
                      fileType: viewingAttachment.type,
                      mimeType: viewingAttachment.type === 'PDF' ? 'application/pdf' : 'image/jpeg',
                      size: viewingAttachment.size || 0,
                      uploadedAt: new Date().toISOString(),
                      formattedDate: '',
                      dataUrl: viewingAttachment.url,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Baixar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingAttachment(null)}
                  className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-[#6b7280] dark:text-[#9ca3af] cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conteúdo do Visualizador */}
            <div className="flex-1 bg-[#111111] overflow-auto flex items-center justify-center p-2 relative">
              {viewingAttachment.type === 'PDF' ? (
                <iframe
                  src={viewingAttachment.url}
                  className="w-full h-full border-0 rounded bg-white"
                  title={viewingAttachment.name}
                />
              ) : (
                <div className="overflow-auto max-w-full max-h-full flex items-center justify-center p-4">
                  <img
                    src={viewingAttachment.url}
                    alt={viewingAttachment.name}
                    style={{
                      transform: `scale(${viewerZoom / 100}) rotate(${viewerRotation}deg)`,
                      transition: 'transform 0.15s ease',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                    className="rounded shadow-lg"
                  />
                </div>
              )}
            </div>

            {/* Rodapé do Visualizador com Opção Fechar Abaixo */}
            <div className="flex items-center justify-between p-2.5 sm:px-4 border-t border-[#eaecef] dark:border-[#262626] bg-[#f8fafc] dark:bg-[#141414] shrink-0">
              <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] truncate pr-2">
                <span className="font-semibold text-[#111827] dark:text-[#f3f4f6]">{viewingAttachment.name}</span>
                {viewingAttachment.size ? <span> • {formatFileSize(viewingAttachment.size)}</span> : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    triggerFileDownload({
                      id: viewingAttachment.entryId || 'file',
                      name: viewingAttachment.name,
                      fileType: viewingAttachment.type,
                      mimeType: viewingAttachment.type === 'PDF' ? 'application/pdf' : 'image/jpeg',
                      size: viewingAttachment.size || 0,
                      uploadedAt: new Date().toISOString(),
                      formattedDate: '',
                      dataUrl: viewingAttachment.url,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#111827] dark:text-[#f3f4f6] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </button>
                <button
                  type="button"
                  id="btn-close-attachment-viewer-bottom"
                  onClick={() => setViewingAttachment(null)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded bg-amber-500 hover:bg-amber-400 text-black shadow-xs transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Fechar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
