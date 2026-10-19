import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Equipment,
  EquipmentFile,
  DailyLog,
  PreventiveRecord,
  CorrectiveMaintenance,
  PreventivePlan,
  UserRole,
} from '../types';
import { COMMON_EQUIPMENT_TYPES } from '../data/initialData';
import { formatHours } from '../utils/storage';
import { EquipmentFilesModal } from './EquipmentFilesModal';
import { ObraFilesModal } from './ObraFilesModal';
import { PhotoLightboxModal } from './corrective/PhotoLightboxModal';
import {
  exportEquipmentsToExcel,
  exportEquipmentsToPDF,
  parseEquipmentsFromExcel,
  formatDisplayDate,
} from '../utils/equipmentExportImport';
import { exportConsolidatedReportPDF } from '../utils/consolidatedReportPdf';
import {
  saveEquipmentFileToIndexedDB,
  saveEquipmentFileToFirestore,
  deleteEquipmentFileFromIndexedDB,
  deleteEquipmentFileFromFirestore,
  loadEquipmentFilesFromIndexedDB,
  downloadEquipmentFile,
  subscribeEquipmentFiles,
  formatFileSize,
} from '../services/equipmentFilesService';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  Truck,
  Gauge,
  User,
  MapPin,
  Filter,
  AlertTriangle,
  RotateCcw,
  Building2,
  Lock,
  Paperclip,
  Eye,
  Download,
  FileSpreadsheet,
  FileText,
  UploadCloud,
  FolderOpen,
  Sparkles,
  Camera,
  Image as ImageIcon,
  Printer,
} from 'lucide-react';

// Helper to optimize and load equipment photo or PDF document locally
async function compressEquipmentPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // If it's a PDF document
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione uma imagem (JPEG, PNG, WEBP) ou arquivo PDF válido.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1280;
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimized = canvas.toDataURL('image/jpeg', 0.82);
            resolve(optimized);
            return;
          }
        } catch (err) {
          console.warn('Canvas optimization error, using original:', err);
        }
        resolve(dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// Helper to get photo from photoUrl or from files
export function getEquipmentPhoto(eq: Equipment): string | undefined {
  if (eq.photoUrl && eq.photoUrl.trim()) return eq.photoUrl;
  if (eq.files && eq.files.length > 0) {
    const photoFile = eq.files.find(
      (f) => f.category === 'Foto' || f.fileType === 'JPEG' || f.fileType === 'JPG' || f.fileType === 'PNG'
    );
    if (photoFile && photoFile.dataUrl) return photoFile.dataUrl;
    if (eq.files[0]?.dataUrl) return eq.files[0].dataUrl;
  }
  return undefined;
}

// Helper to get attachment information (Photo JPEG or Document PDF)
export function getEquipmentAttachmentInfo(eq: Equipment) {
  const photo = eq.photoUrl || getEquipmentPhoto(eq);
  const files = eq.files || [];

  if (photo) {
    const isPdf = photo.startsWith('data:application/pdf') || photo.includes('application/pdf');
    const extraCount = files.length > 0 && files[0].dataUrl !== photo ? files.length : 0;
    return {
      hasAttachment: true,
      isPdf,
      typeLabel: isPdf ? 'PDF' : 'JPEG',
      count: 1 + extraCount,
      url: photo,
    };
  }
  if (files.length > 0) {
    const f = files[0];
    const isPdf = f.fileType === 'PDF' || f.name.toLowerCase().endsWith('.pdf') || (f.dataUrl?.startsWith('data:application/pdf') ?? false);
    return {
      hasAttachment: true,
      isPdf,
      typeLabel: isPdf ? 'PDF' : 'JPEG',
      count: files.length,
      url: f.dataUrl,
    };
  }
  return {
    hasAttachment: false,
    isPdf: false,
    typeLabel: '',
    count: 0,
    url: undefined,
  };
}

interface EquipmentsTabProps {
  equipments: Equipment[];
  dailyLogs?: DailyLog[];
  preventiveRecords?: PreventiveRecord[];
  correctiveMaintenances?: CorrectiveMaintenance[];
  preventivePlans?: PreventivePlan[];
  onAddEquipment: (equipment: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => boolean;
  onUpdateEquipment: (equipment: Equipment) => boolean;
  onDeleteEquipment: (id: string) => void;
  onRestoreDefaults?: () => void;
  userRole?: UserRole;
  selectedProject?: string;
  userName?: string;
}

export const EquipmentsTab: React.FC<EquipmentsTabProps> = ({
  equipments,
  dailyLogs = [],
  preventiveRecords = [],
  correctiveMaintenances = [],
  preventivePlans = [],
  onAddEquipment,
  onUpdateEquipment,
  onDeleteEquipment,
  onRestoreDefaults,
  userRole = 'admin',
  selectedProject = 'all',
  userName,
}) => {
  const isDeveloper = userRole === 'admin' || userRole === 'developer' || userRole === 'gestor';
  const isAdmin = userRole === 'admin' || userRole === 'developer';
  const isReadOnly = userRole === 'visualizador';

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('todos');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields in sequence: Equipamento, Placa, Prefixo, Modelo, Marca, Fornecedor, Obra, Chassi, Data de Desmobilização
  const [type, setType] = useState('');
  const [customType, setCustomType] = useState('');
  const [plate, setPlate] = useState('');
  const [prefix, setPrefix] = useState('');
  const [model, setModel] = useState('');
  const [brand, setBrand] = useState('');
  const [supplier, setSupplier] = useState('');
  const [location, setLocation] = useState('');
  const [chassis, setChassis] = useState('');
  const [mobilizationDate, setMobilizationDate] = useState('');
  const [demobilizationDate, setDemobilizationDate] = useState('');
  const [currentHourMeter, setCurrentHourMeter] = useState('');
  const [operator, setOperator] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<{
    isOpen: boolean;
    url: string;
    name?: string;
    title?: string;
    subtitle?: string;
  } | null>(null);
  const [viewChooserEquipment, setViewChooserEquipment] = useState<Equipment | null>(null);
  const [deleteAttachmentModal, setDeleteAttachmentModal] = useState<{
    equipment: Equipment;
  } | null>(null);
  const [uploadTargetEquipment, setUploadTargetEquipment] = useState<Equipment | null>(null);
  const equipmentPhotoInputRef = useRef<HTMLInputElement>(null);
  const directUploadInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressingPhoto(true);
      const compressed = await compressEquipmentPhoto(file);
      setPhotoUrl(compressed);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao carregar a foto do equipamento.');
    } finally {
      setIsCompressingPhoto(false);
      if (equipmentPhotoInputRef.current) {
        equipmentPhotoInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
    if (equipmentPhotoInputRef.current) {
      equipmentPhotoInputRef.current.value = '';
    }
  };

  // Obra Files Modal state (PDF e Excel por Obra - dinâmico para todas as obras)
  const [isObraFilesModalOpen, setIsObraFilesModalOpen] = useState(false);
  const [obraFiles, setObraFiles] = useState<EquipmentFile[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Load and subscribe obra files
  useEffect(() => {
    const unsub = subscribeEquipmentFiles((files) => {
      setObraFiles(files);
    });

    loadEquipmentFilesFromIndexedDB().then((local) => {
      if (local && local.length > 0) {
        setObraFiles((prev) => (prev.length === 0 ? local : prev));
      }
    });

    return () => unsub();
  }, []);

  const handleSaveObraFile = async (file: EquipmentFile) => {
    await saveEquipmentFileToIndexedDB(file);
    await saveEquipmentFileToFirestore(file);
    setObraFiles((prev) => [file, ...prev.filter((f) => f.id !== file.id)]);
  };

  const handleDeleteObraFile = async (fileId: string) => {
    await deleteEquipmentFileFromIndexedDB(fileId);
    await deleteEquipmentFileFromFirestore(fileId);
    setObraFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const currentObraFilesCount = useMemo(() => {
    if (!selectedProject || selectedProject === 'all') return obraFiles.length;
    const cleanProj = selectedProject.toUpperCase().trim();
    return obraFiles.filter((f) => {
      const loc = (f.location || f.obra_id || '').toUpperCase();
      return loc.includes(cleanProj) || cleanProj.includes(loc);
    }).length;
  }, [obraFiles, selectedProject]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      await exportEquipmentsToExcel(
        filteredEquipments,
        selectedProject === 'all' ? 'Todas as Obras (Visão Global)' : selectedProject
      );
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = (action: 'download' | 'print' = 'download') => {
    try {
      exportEquipmentsToPDF(
        filteredEquipments,
        selectedProject === 'all' ? 'Todas as Obras (Visão Global)' : selectedProject,
        {
          userName: userName || (userRole === 'admin' ? 'Administrador' : 'Gestor Makmo'),
          action,
        }
      );
    } catch (err) {
      console.error('Erro ao exportar PDF para impressão A4:', err);
    }
  };

  const [isExportingConsolidated, setIsExportingConsolidated] = useState(false);

  const handleExportConsolidatedPDF = () => {
    try {
      setIsExportingConsolidated(true);
      const obraTitle =
        selectedProject === 'all'
          ? 'Todas as Obras (Visão Global)'
          : `Obra ${selectedProject}`;

      exportConsolidatedReportPDF({
        obraLabel: obraTitle,
        userName: userName || (userRole === 'admin' ? 'Administrador do Sistema' : 'Operador Makmo'),
        equipments: filteredEquipments,
        dailyLogs,
        preventiveRecords,
        correctiveMaintenances,
        preventivePlans,
      });
    } catch (err) {
      console.error('Erro ao gerar relatório consolidado PDF:', err);
      alert('Ocorreu um erro ao gerar o relatório consolidado em PDF.');
    } finally {
      setIsExportingConsolidated(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsImporting(true);
      const parsed = await parseEquipmentsFromExcel(file, selectedProject === 'all' ? '' : selectedProject);
      let count = 0;
      for (const item of parsed) {
        onAddEquipment(item);
        count++;
      }
      alert(`Importação concluída com sucesso! ${count} equipamento(s) importado(s).`);
    } catch (err: any) {
      alert(`Erro na importação: ${err?.message || 'Arquivo inválido'}`);
    } finally {
      setIsImporting(false);
      if (importFileInputRef.current) importFileInputRef.current.value = '';
    }
  };

  // Form Validation Error
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation Modal state
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);

  // Equipment Files Modal state
  const [selectedEquipmentForFiles, setSelectedEquipmentForFiles] = useState<Equipment | null>(null);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [initialViewingFileId, setInitialViewingFileId] = useState<string | null>(null);

  // Open files modal for an equipment and load full Data URLs from IndexedDB
  const handleOpenFilesModal = async (eq: Equipment, fileIdToView?: string) => {
    setInitialViewingFileId(fileIdToView || null);
    setSelectedEquipmentForFiles(eq);
    setIsFilesModalOpen(true);

    try {
      const localFiles = await loadEquipmentFilesFromIndexedDB(eq.id);
      if (localFiles && localFiles.length > 0) {
        const localMap = new Map(localFiles.map((f) => [f.id, f]));
        const mergedFiles = (eq.files || []).map((f) => {
          const found = localMap.get(f.id);
          return found && found.dataUrl ? found : f;
        });

        // Add any local files not present in equipment.files
        const existingIds = new Set((eq.files || []).map((f) => f.id));
        for (const lf of localFiles) {
          if (!existingIds.has(lf.id)) {
            mergedFiles.push(lf);
          }
        }

        setSelectedEquipmentForFiles({
          ...eq,
          files: mergedFiles,
        });
      }
    } catch (err) {
      console.warn('Erro ao carregar arquivos do IndexedDB para modal:', err);
    }
  };

  // Quick download helper for equipment file
  const handleQuickDownloadFile = async (eq: Equipment) => {
    if (!eq.files || eq.files.length === 0) return;
    try {
      let targetFile = eq.files[0];
      if (!targetFile.dataUrl) {
        const localFiles = await loadEquipmentFilesFromIndexedDB(eq.id);
        const found = localFiles.find((f) => f.id === targetFile.id);
        if (found && found.dataUrl) {
          targetFile = found;
        }
      }
      if (targetFile.dataUrl) {
        downloadEquipmentFile(targetFile);
      } else {
        handleOpenFilesModal(eq);
      }
    } catch {
      handleOpenFilesModal(eq);
    }
  };

  // Action: Visualizar Foto ou Arquivo (PDF ou JPEG)
  const handleViewAction = (eq: Equipment) => {
    const photo = eq.photoUrl || getEquipmentPhoto(eq);
    const files = eq.files || [];

    // If equipment has both a photo and separate files, open chooser
    if (photo && files.length > 0 && !(files.length === 1 && files[0].dataUrl === photo)) {
      setViewChooserEquipment(eq);
      return;
    }

    if (photo) {
      const isPdf = photo.startsWith('data:application/pdf');
      setPreviewPhotoModal({
        isOpen: true,
        url: photo,
        name: `${eq.plate || eq.prefix || 'equipamento'}_foto.${isPdf ? 'pdf' : 'jpg'}`,
        title: isPdf ? `Documento PDF - ${eq.plate || eq.prefix || eq.type}` : `Foto do Equipamento - ${eq.plate || eq.prefix || eq.type}`,
        subtitle: `${eq.type} • ${eq.brand || ''} ${eq.model || ''} • Obra: ${eq.location || 'Não informada'}`,
      });
      return;
    }

    if (files.length === 1) {
      const f = files[0];
      const isPdf = f.fileType === 'PDF' || f.name.toLowerCase().endsWith('.pdf') || f.dataUrl.startsWith('data:application/pdf');
      setPreviewPhotoModal({
        isOpen: true,
        url: f.dataUrl,
        name: f.name,
        title: `${f.category || (isPdf ? 'Documento PDF' : 'Foto')} - ${eq.plate || eq.prefix || eq.type}`,
        subtitle: `${f.name} • ${formatFileSize(f.size)} • ${eq.location || 'Não informada'}`,
      });
      return;
    }

    if (files.length > 1) {
      setViewChooserEquipment(eq);
      return;
    }

    // No files or photo - open attachment modal
    handleOpenFilesModal(eq);
  };

  // Action: Baixar Foto ou Arquivo (PDF ou JPEG)
  const handleQuickDownload = async (eq: Equipment) => {
    const photo = eq.photoUrl || getEquipmentPhoto(eq);
    const files = eq.files || [];

    if (photo && files.length > 0 && !(files.length === 1 && files[0].dataUrl === photo)) {
      setViewChooserEquipment(eq);
      return;
    }

    if (photo) {
      const isPdf = photo.startsWith('data:application/pdf');
      const ext = isPdf ? 'pdf' : 'jpg';
      const a = document.createElement('a');
      a.href = photo;
      a.download = `${eq.plate || eq.prefix || 'equipamento'}_foto.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (files.length > 0) {
      await handleQuickDownloadFile(eq);
      return;
    }

    handleOpenFilesModal(eq);
  };

  // Direct file upload for row
  const handleDirectUploadClick = (eq: Equipment) => {
    setUploadTargetEquipment(eq);
    directUploadInputRef.current?.click();
  };

  const handleDirectFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetEquipment) return;
    try {
      setIsCompressingPhoto(true);
      const dataUrl = await compressEquipmentPhoto(file);
      const updatedEq: Equipment = {
        ...uploadTargetEquipment,
        photoUrl: dataUrl,
        updatedAt: new Date().toISOString(),
      };
      onUpdateEquipment(updatedEq);
    } catch (err: any) {
      alert(err.message || 'Erro ao carregar a foto ou arquivo PDF.');
    } finally {
      setIsCompressingPhoto(false);
      if (directUploadInputRef.current) directUploadInputRef.current.value = '';
      setUploadTargetEquipment(null);
    }
  };

  // Action: Excluir Foto/Arquivo ou Equipamento
  const handleDeleteAction = (eq: Equipment) => {
    const hasPhoto = Boolean(eq.photoUrl && eq.photoUrl.trim());
    const hasFiles = Boolean(eq.files && eq.files.length > 0);
    if (hasPhoto || hasFiles) {
      setDeleteAttachmentModal({ equipment: eq });
    } else {
      setEquipmentToDelete(eq);
    }
  };

  const handleConfirmDeleteAttachmentOnly = async () => {
    if (!deleteAttachmentModal) return;
    const eq = deleteAttachmentModal.equipment;

    if (eq.files && eq.files.length > 0) {
      for (const f of eq.files) {
        await deleteEquipmentFileFromIndexedDB(f.id);
        await deleteEquipmentFileFromFirestore(f.id);
      }
    }

    const updatedEq: Equipment = {
      ...eq,
      photoUrl: '',
      files: [],
      updatedAt: new Date().toISOString(),
    };
    onUpdateEquipment(updatedEq);
    setDeleteAttachmentModal(null);
    if (viewChooserEquipment?.id === eq.id) {
      setViewChooserEquipment(null);
    }
  };

  const handleConfirmDeleteFullEquipment = () => {
    if (!deleteAttachmentModal) return;
    const eq = deleteAttachmentModal.equipment;
    setDeleteAttachmentModal(null);
    setEquipmentToDelete(eq);
  };

  // Save new file to equipment
  const handleSaveEquipmentFile = async (equipmentId: string, file: EquipmentFile) => {
    await saveEquipmentFileToIndexedDB(file);
    await saveEquipmentFileToFirestore(file);

    const target = equipments.find((eq) => eq.id === equipmentId);
    if (target) {
      const currentFiles = target.files || [];
      const updatedFiles = [file, ...currentFiles.filter((f) => f.id !== file.id)];
      const updatedEq: Equipment = {
        ...target,
        files: updatedFiles,
        updatedAt: new Date().toISOString(),
      };
      onUpdateEquipment(updatedEq);
      setSelectedEquipmentForFiles(updatedEq);
    }
  };

  // Delete file from equipment
  const handleDeleteEquipmentFile = async (equipmentId: string, fileId: string) => {
    await deleteEquipmentFileFromIndexedDB(fileId);
    await deleteEquipmentFileFromFirestore(fileId);

    const target = equipments.find((eq) => eq.id === equipmentId);
    if (target) {
      const updatedFiles = (target.files || []).filter((f) => f.id !== fileId);
      const updatedEq: Equipment = {
        ...target,
        files: updatedFiles,
        updatedAt: new Date().toISOString(),
      };
      onUpdateEquipment(updatedEq);
      setSelectedEquipmentForFiles(updatedEq);
    }
  };

  // Reset form
  const resetForm = () => {
    setType('');
    setCustomType('');
    setPlate('');
    setPrefix('');
    setModel('');
    setBrand('');
    setSupplier('');
    setLocation('');
    setChassis('');
    setMobilizationDate('');
    setDemobilizationDate('');
    setCurrentHourMeter('');
    setOperator('');
    setPhotoUrl('');
    setIsCompressingPhoto(false);
    setEditingId(null);
    setFormError(null);
    setIsFormOpen(false);
  };

  // Open edit mode
  const handleStartEdit = (eq: Equipment) => {
    setEditingId(eq.id);

    if (COMMON_EQUIPMENT_TYPES.includes(eq.type)) {
      setType(eq.type);
      setCustomType('');
    } else {
      setType('Outro');
      setCustomType(eq.type);
    }

    setPlate(eq.plate || '');
    setPrefix(eq.prefix || eq.code || '');
    setModel(eq.model || '');
    setBrand(eq.brand || '');
    setSupplier(eq.supplier || '');
    setLocation(eq.location || '');
    setChassis(eq.chassis || '');
    setMobilizationDate(eq.mobilizationDate || '');
    setDemobilizationDate(eq.demobilizationDate || '');
    setCurrentHourMeter(String(eq.currentHourMeter));
    setOperator(eq.operator || '');
    setPhotoUrl(eq.photoUrl || getEquipmentPhoto(eq) || '');
    setFormError(null);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const finalType = type === 'Outro' ? customType.trim() || 'Outro' : type.trim();
    if (!finalType) {
      setFormError('Selecione ou informe o Equipamento.');
      return;
    }

    const cleanPlate = plate.trim().toUpperCase();
    const cleanPrefix = prefix.trim().toUpperCase();

    if (!cleanPlate && !cleanPrefix) {
      setFormError('Informe a Placa ou o Prefixo do equipamento.');
      return;
    }

    const cleanModel = model.trim();
    const cleanBrand = brand.trim();
    const cleanSupplier = supplier.trim() || 'Frota Própria';
    const cleanLocation = location.trim();
    const cleanChassis = chassis.trim().toUpperCase();
    const cleanMobilizationDate = mobilizationDate.trim();
    const cleanDemobilizationDate = demobilizationDate.trim();
    const cleanCode = cleanPrefix || cleanPlate;
    const combinedBrandModel = [cleanBrand, cleanModel].filter(Boolean).join(' ') || undefined;

    // Support both Brazilian comma decimal (1.500,5) and point decimal (1500.5)
    const normalizedHourMeter = currentHourMeter.includes(',')
      ? currentHourMeter.replace(/\./g, '').replace(',', '.')
      : currentHourMeter;
    const hourMeterNum = parseFloat(normalizedHourMeter);
    if (isNaN(hourMeterNum) || hourMeterNum < 0) {
      setFormError('Informe um Horímetro Inicial válido (maior ou igual a zero).');
      return;
    }

    if (editingId) {
      // Editing existing
      const existing = equipments.find((eq) => eq.id === editingId);
      if (!existing) return;

      const success = onUpdateEquipment({
        ...existing,
        type: finalType,
        plate: cleanPlate,
        prefix: cleanPrefix,
        model: cleanModel,
        brand: cleanBrand,
        supplier: cleanSupplier,
        location: cleanLocation,
        chassis: cleanChassis || undefined,
        mobilizationDate: cleanMobilizationDate || undefined,
        demobilizationDate: cleanDemobilizationDate || undefined,
        photoUrl: photoUrl.trim() || undefined,
        code: cleanCode,
        brandModel: combinedBrandModel,
        operator: operator.trim(),
        currentHourMeter: hourMeterNum,
        updatedAt: new Date().toISOString(),
      });

      if (success) {
        resetForm();
      }
    } else {
      // Adding new
      const success = onAddEquipment({
        type: finalType,
        plate: cleanPlate,
        prefix: cleanPrefix,
        model: cleanModel,
        brand: cleanBrand,
        supplier: cleanSupplier,
        location: cleanLocation,
        chassis: cleanChassis || undefined,
        mobilizationDate: cleanMobilizationDate || undefined,
        demobilizationDate: cleanDemobilizationDate || undefined,
        photoUrl: photoUrl.trim() || undefined,
        code: cleanCode,
        brandModel: combinedBrandModel,
        operator: operator.trim(),
        currentHourMeter: hourMeterNum,
      });

      if (success) {
        resetForm();
      }
    }
  };

  // Filtered equipments list
  const filteredEquipments = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return equipments.filter((eq) => {
      const matchSearch =
        !term ||
        eq.type.toLowerCase().includes(term) ||
        (eq.plate || '').toLowerCase().includes(term) ||
        (eq.prefix || '').toLowerCase().includes(term) ||
        eq.code.toLowerCase().includes(term) ||
        (eq.model || '').toLowerCase().includes(term) ||
        (eq.brand || '').toLowerCase().includes(term) ||
        (eq.supplier || '').toLowerCase().includes(term) ||
        eq.location.toLowerCase().includes(term) ||
        (eq.operator || '').toLowerCase().includes(term) ||
        (eq.brandModel || '').toLowerCase().includes(term) ||
        (eq.chassis || '').toLowerCase().includes(term) ||
        (eq.mobilizationDate || '').toLowerCase().includes(term) ||
        (eq.demobilizationDate || '').toLowerCase().includes(term);

      const matchType = selectedType === 'todos' || eq.type === selectedType;

      return matchSearch && matchType;
    });
  }, [equipments, searchTerm, selectedType]);

  // Unique types from database for filter dropdown
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    equipments.forEach((e) => {
      if (e.type) set.add(e.type);
    });
    return Array.from(set).sort();
  }, [equipments]);

  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">
      {/* Header action bar */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-3 sm:p-3.5 border border-[#dcdfe4] dark:border-[#333333] shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-industrial tracking-wide text-[#111827] dark:text-[#f3f4f6] flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-500" />
              Base de Dados de Equipamentos
            </h2>
            <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-0.5">
              Cadastre e gerencie a frota. A Placa/Prefixo cadastrada aqui será auto-preenchida no
              apontamento diário.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Arquivos da Obra (PDF e Excel - Dinâmico para qualquer obra) */}
            <button
              id="btn-open-obra-files"
              type="button"
              onClick={() => setIsObraFilesModalOpen(true)}
              title="Gerenciar, anexar e visualizar documentos PDF e planilhas Excel desta obra"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded border border-amber-600 transition-colors shadow-2xs cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-black shrink-0" />
              <span>Arquivos da Obra (PDF/Excel)</span>
              {currentObraFilesCount > 0 && (
                <span className="text-[10px] font-mono font-bold bg-black text-amber-400 px-1.5 py-0.2 rounded-full ml-0.5">
                  {currentObraFilesCount}
                </span>
              )}
            </button>

            {/* Exportar Excel */}
            <button
              id="btn-export-equipments-excel"
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || filteredEquipments.length === 0}
              title="Exportar equipamentos da tabela em formato Excel (.xlsx)"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-xs rounded border border-emerald-500/30 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            {/* Exportar PDF A4 (Download) */}
            <button
              id="btn-export-equipments-pdf"
              type="button"
              onClick={() => handleExportPDF('download')}
              disabled={filteredEquipments.length === 0}
              title="Baixar Base de Dados de Equipamentos em PDF formatado para folha A4"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 font-bold text-xs rounded border border-rose-500/30 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>PDF A4</span>
            </button>

            {/* Imprimir Página A4 Direto */}
            <button
              id="btn-print-equipments-a4"
              type="button"
              onClick={() => handleExportPDF('print')}
              disabled={filteredEquipments.length === 0}
              title="Imprimir Base de Dados de Equipamentos ajustada em Página A4 Paisagem"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 font-bold text-xs rounded border border-blue-500/30 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="hidden sm:inline">Imprimir A4</span>
            </button>

            {/* Relatório Consolidado Corporativo (Equipamentos + Manutenções PCM em PDF) */}
            <button
              id="btn-export-consolidated-pdf"
              type="button"
              onClick={handleExportConsolidatedPDF}
              disabled={isExportingConsolidated || filteredEquipments.length === 0}
              title="Exportar todas as informações cadastradas de equipamentos e logs de manutenção (Preventivas PCM e Corretivas) em um único arquivo PDF consolidado com layout corporativo"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 bg-[#113861] hover:bg-[#16477b] active:scale-95 text-white font-bold text-xs rounded border border-[#1b4d82] transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-[#20b4a7] shrink-0" />
              <span>Relatório Consolidado PDF</span>
              <span className="hidden xl:inline text-[9px] font-mono uppercase bg-[#20b4a7]/20 text-[#20b4a7] border border-[#20b4a7]/30 px-1 py-0.2 rounded font-bold">
                Frota + PCM
              </span>
            </button>

            {/* Importar Excel */}
            <button
              id="btn-import-equipments-excel"
              type="button"
              onClick={() => importFileInputRef.current?.click()}
              disabled={isImporting}
              title="Importar equipamentos a partir de planilha Excel (.xlsx, .xls, .csv)"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-bold text-xs rounded border border-neutral-300 dark:border-neutral-700 transition-colors shadow-2xs cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="hidden sm:inline">Importar</span>
            </button>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportExcel}
              className="hidden"
            />

            {!isFormOpen && (
              <button
                id="btn-open-add-equipment"
                type="button"
                onClick={() => {
                  resetForm();
                  setIsFormOpen(true);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-8 px-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Adicionar Equipamento</span>
              </button>
            )}
          </div>
        </div>

        {/* Registration / Edit Form */}
        {isFormOpen && (
          <form
            onSubmit={handleSubmit}
            className="mt-3 pt-3 border-t border-[#eaecef] dark:border-[#262626] space-y-3 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-[#eaecef] dark:border-[#262626]">
              <h3 className="font-bold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                {editingId ? 'Editar Equipamento' : 'Cadastrar Novo Equipamento na Frota'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="p-1 rounded text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]"
                title="Fechar formulário"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="p-2.5 text-xs rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {/* 1. Equipamento */}
              <div>
                <label
                  htmlFor="eq-type-select"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  1. Equipamento <span className="text-amber-500">*</span>
                </label>
                <select
                  id="eq-type-select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                  className="w-full h-8 px-2 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500 text-xs"
                >
                  <option value="">Selecione o equipamento...</option>
                  {COMMON_EQUIPMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {type === 'Outro' && (
                  <input
                    type="text"
                    placeholder="Especifique o equipamento..."
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    className="mt-1.5 w-full h-8 px-2 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-xs"
                  />
                )}
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Tipo de máquina ou veículo.
                </span>
              </div>

              {/* 2. Placa */}
              <div>
                <label
                  htmlFor="eq-plate-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  2. Placa
                </label>
                <input
                  id="eq-plate-input"
                  type="text"
                  placeholder="Ex: BRA2E19, ABC-1234"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers font-bold text-xs focus:outline-none focus:border-amber-500 uppercase"
                />
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Placa de trânsito (ou vazio se sem placa).
                </span>
              </div>

              {/* 3. Prefixo */}
              <div>
                <label
                  htmlFor="eq-prefix-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  3. Prefixo
                </label>
                <input
                  id="eq-prefix-input"
                  type="text"
                  placeholder="Ex: RET-01, ESC-05, CAM-12"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers font-bold text-xs focus:outline-none focus:border-amber-500 uppercase"
                />
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Código interno de identificação da frota.
                </span>
              </div>

              {/* 4. Modelo */}
              <div>
                <label
                  htmlFor="eq-model-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  4. Modelo
                </label>
                <input
                  id="eq-model-input"
                  type="text"
                  placeholder="Ex: 416F2, Actros 4844, PC200"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Modelo específico do equipamento.
                </span>
              </div>

              {/* 5. Marca */}
              <div>
                <label
                  htmlFor="eq-brand-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  5. Marca
                </label>
                <input
                  id="eq-brand-input"
                  type="text"
                  placeholder="Ex: Caterpillar, Mercedes-Benz, Komatsu, Volvo"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Fabricante / montadora.
                </span>
              </div>

              {/* 6. Fornecedor */}
              <div>
                <label
                  htmlFor="eq-supplier-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  6. Fornecedor
                </label>
                <input
                  id="eq-supplier-input"
                  type="text"
                  placeholder="Ex: Frota Própria, Sotreq, Armac, Vamos..."
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Empresa locadora ou indicação de frota própria.
                </span>
              </div>

              {/* 7. Obra */}
              <div>
                <label
                  htmlFor="eq-location-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  7. Obra
                </label>
                <input
                  id="eq-location-input"
                  type="text"
                  placeholder="Ex: Obra Rodovia Norte, Canal de Drenagem..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Frente de trabalho onde a máquina opera.
                </span>
              </div>

              {/* 8. Chassi */}
              <div>
                <label
                  htmlFor="eq-chassis-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  8. Chassi
                </label>
                <input
                  id="eq-chassis-input"
                  type="text"
                  placeholder="Ex: 9BWZZZ377VT004251"
                  value={chassis}
                  onChange={(e) => setChassis(e.target.value.toUpperCase())}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] font-mono text-xs focus:outline-none focus:border-amber-500 uppercase"
                />
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Número do chassi do equipamento.
                </span>
              </div>

              {/* Data de Mobilização */}
              <div>
                <label
                  htmlFor="eq-mobilization-date-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  Data de Mobilização
                </label>
                <input
                  id="eq-mobilization-date-input"
                  type="date"
                  value={mobilizationDate}
                  onChange={(e) => setMobilizationDate(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Data de início/chegada na obra (DD/MM/AAAA).
                </span>
              </div>

              {/* 9. Data de Desmobilização */}
              <div>
                <label
                  htmlFor="eq-demobilization-date-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  9. Data de Desmobilização
                </label>
                <input
                  id="eq-demobilization-date-input"
                  type="date"
                  value={demobilizationDate}
                  onChange={(e) => setDemobilizationDate(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Data de encerramento das operações (DD/MM/AAAA).
                </span>
              </div>

              {/* Horímetro Atual */}
              <div>
                <label
                  htmlFor="eq-hourmeter-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  Horímetro Atual <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="eq-hourmeter-input"
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    placeholder="Ex: 2450.5"
                    value={currentHourMeter}
                    onChange={(e) => setCurrentHourMeter(e.target.value)}
                    className="w-full h-8 pl-2.5 pr-9 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] font-mono-numbers font-bold text-xs focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-2.5 top-1.5 text-[11px] font-bold text-[#9ca3af] font-mono">
                    hrs
                  </span>
                </div>
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Última leitura registrada do horímetro.
                </span>
              </div>

              {/* Operador / Motorista */}
              <div>
                <label
                  htmlFor="eq-operator-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-0.5"
                >
                  Operador / Motorista
                </label>
                <input
                  id="eq-operator-input"
                  type="text"
                  placeholder="Ex: Carlos Eduardo Santos"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#f8fafc] dark:bg-[#121212] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                  Operador responsável pelo equipamento.
                </span>
              </div>
            </div>

            {/* Foto do Equipamento ou Arquivo Técnico (PDF ou JPEG) */}
            <div className="p-3 rounded-lg border border-dashed border-[#dcdfe4] dark:border-[#383838] bg-[#f8fafc]/60 dark:bg-[#141414]/60">
              <input
                ref={equipmentPhotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handlePhotoFileChange}
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {photoUrl ? (
                    photoUrl.startsWith('data:application/pdf') ? (
                      <div className="relative group shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg border-2 border-rose-500 bg-rose-500/10 flex flex-col items-center justify-center text-rose-500 shadow-sm">
                        <FileText className="w-7 h-7" />
                        <span className="text-[10px] font-bold font-mono mt-0.5">PDF</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewPhotoModal({
                              isOpen: true,
                              url: photoUrl,
                              name: `${plate || prefix || 'equipamento'}_documento.pdf`,
                              title: `Documento PDF - ${plate || prefix || type || 'Equipamento'}`,
                              subtitle: `${type} • ${brand} ${model} • Obra: ${location || 'Não informada'}`,
                            })
                          }
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg text-white transition-opacity cursor-pointer"
                          title="Visualizar Documento PDF"
                        >
                          <Eye className="w-5 h-5 drop-shadow" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative group shrink-0">
                        <img
                          src={photoUrl}
                          alt="Foto do equipamento"
                          className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border-2 border-amber-500 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewPhotoModal({
                              isOpen: true,
                              url: photoUrl,
                              name: `${plate || prefix || 'equipamento'}_foto.jpg`,
                              title: `Foto do Equipamento - ${plate || prefix || type || 'Equipamento'}`,
                              subtitle: `${type} • ${brand} ${model} • Obra: ${location || 'Não informada'}`,
                            })
                          }
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg text-white transition-opacity cursor-pointer"
                          title="Visualizar Foto Ampliada"
                        >
                          <Eye className="w-5 h-5 drop-shadow" />
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-dashed border-[#cbd5e1] dark:border-[#404040] flex flex-col items-center justify-center bg-white dark:bg-[#1a1a1a] text-[#9ca3af] shrink-0">
                      <Camera className="w-6 h-6 stroke-[1.5]" />
                      <span className="text-[9px] mt-1 font-medium">Sem arquivo</span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#111827] dark:text-[#f3f4f6]">
                        Foto do Equipamento ou Arquivo Técnico (PDF ou JPEG)
                      </span>
                      {photoUrl && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          photoUrl.startsWith('data:application/pdf')
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        }`}>
                          {photoUrl.startsWith('data:application/pdf') ? 'Arquivo PDF Anexado' : 'Foto JPEG Anexada'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] mt-0.5 max-w-md">
                      Adicione a foto do equipamento ou documento técnico em formato PDF ou JPEG. O arquivo é salvo com segurança e sincronizado.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {photoUrl && (
                    <button
                      type="button"
                      id="btn-preview-form-equipment-photo"
                      onClick={() => {
                        const isPdf = photoUrl.startsWith('data:application/pdf');
                        setPreviewPhotoModal({
                          isOpen: true,
                          url: photoUrl,
                          name: isPdf ? `${plate || prefix || 'equipamento'}_documento.pdf` : `${plate || prefix || 'equipamento'}_foto.jpg`,
                          title: isPdf ? `Documento PDF - ${plate || prefix || type || 'Equipamento'}` : `Foto do Equipamento - ${plate || prefix || type || 'Equipamento'}`,
                          subtitle: `${type} • ${brand} ${model} • Obra: ${location || 'Não informada'}`,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 transition-colors cursor-pointer"
                      title="Visualizar Foto ou Arquivo PDF"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visualizar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    id="btn-upload-equipment-photo"
                    disabled={isCompressingPhoto}
                    onClick={() => equipmentPhotoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded bg-[#f1f3f5] hover:bg-[#e5e7eb] dark:bg-[#262626] dark:hover:bg-[#333333] text-[#111827] dark:text-[#f3f4f6] border border-[#dcdfe4] dark:border-[#404040] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isCompressingPhoto ? 'Processando...' : photoUrl ? 'Trocar Foto/PDF' : 'Carregar Foto ou PDF'}</span>
                  </button>

                  {photoUrl && (
                    <button
                      type="button"
                      id="btn-remove-equipment-photo"
                      onClick={handleRemovePhoto}
                      className="inline-flex items-center gap-1 h-8 px-2 text-xs font-semibold rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-colors cursor-pointer"
                      title="Remover foto/arquivo do equipamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Remover</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Gerenciamento de Arquivos quando em modo de edição */}
            {editingId && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Paperclip className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="font-bold text-[#111827] dark:text-white">Arquivos & Documentos deste Equipamento:</span>{' '}
                    <span className="text-[#4b5563] dark:text-[#d1d5db]">
                      {equipments.find((e) => e.id === editingId)?.files?.length || 0} anexo(s) cadastrado(s) (CRLV, Contratos, Laudos, Fotos).
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const target = equipments.find((e) => e.id === editingId);
                    if (target) handleOpenFilesModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-bold rounded bg-amber-500 text-black hover:bg-amber-400 transition-colors shrink-0 shadow-2xs"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Gerenciar / Adicionar Arquivos</span>
                </button>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                id="btn-cancel-equipment"
                onClick={resetForm}
                className="h-8 px-3 text-xs font-semibold rounded border border-[#dcdfe4] dark:border-[#333333] text-[#4b5563] dark:text-[#9ca3af] hover:bg-[#edf2f7] dark:hover:bg-[#262626] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                id="btn-submit-equipment"
                className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black rounded transition-colors shadow-xs"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{editingId ? 'Salvar Alterações' : 'Adicionar Equipamento'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Search and Filters Bar - High Density compact */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#9ca3af]" />
          <input
            id="input-search-equipments"
            type="text"
            placeholder="Buscar por equipamento, placa, prefixo, modelo, marca, fornecedor ou obra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-8 pl-8 pr-7 text-xs bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] placeholder-[#9ca3af] focus:outline-none focus:border-amber-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2 text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter by Type */}
        {availableTypes.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />
            <select
              id="select-filter-type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-8 px-2 text-xs bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#4b5563] dark:text-[#9ca3af] focus:outline-none focus:border-amber-500"
            >
              <option value="todos">Todos os equipamentos ({equipments.length})</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Equipment List / Table */}
      {filteredEquipments.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-6 border border-[#dcdfe4] dark:border-[#333333] text-center space-y-2">
          <Truck className="w-8 h-8 mx-auto text-[#9ca3af] stroke-1" />
          <div className="text-sm font-semibold text-[#4b5563] dark:text-[#9ca3af]">
            {searchTerm || selectedType !== 'todos'
              ? 'Nenhum registro encontrado com estes filtros.'
              : 'Esta obra ainda não possui dados cadastrados.'}
          </div>
          <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] max-w-sm mx-auto">
            {searchTerm || selectedType !== 'todos'
              ? 'Nenhum registro encontrado. Tente ajustar os termos de pesquisa ou remover os filtros.'
              : 'Nenhum registro encontrado. Cadastre os primeiros equipamentos desta obra para começar o acompanhamento.'}
          </p>
          <div className="pt-1 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 h-7.5 px-3 text-xs font-bold rounded bg-amber-500 text-black hover:bg-amber-400"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Equipamento</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-[#dcdfe4] dark:border-[#333333] shadow-xs overflow-hidden transition-colors">
          {/* Desktop Table - Sequence: Equipamento, Placa, Prefixo, Modelo, Marca, Fornecedor, Obra */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] dark:bg-[#141414] border-b border-[#dcdfe4] dark:border-[#333333] text-[#4b5563] dark:text-[#9ca3af] text-[11px] font-bold uppercase tracking-wider font-mono">
                  <th className="py-2 px-3 text-center">Foto</th>
                  <th className="py-2 px-3">Equipamento</th>
                  <th className="py-2 px-3">Placa</th>
                  <th className="py-2 px-3">Prefixo</th>
                  <th className="py-2 px-3">Modelo</th>
                  <th className="py-2 px-3">Marca</th>
                  <th className="py-2 px-3">Fornecedor</th>
                  <th className="py-2 px-3">Obra</th>
                  <th className="py-2 px-3">Chassi</th>
                  <th className="py-2 px-3">Data de Mobilização</th>
                  <th className="py-2 px-3">Data de Desmobilização</th>
                  <th className="py-2 px-3 text-right">Horímetro Atual</th>
                  <th className="py-2 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaecef] dark:divide-[#262626] text-xs">
                {filteredEquipments.map((eq, index) => (
                  <tr
                    key={`${eq.id}-${eq.code || index}`}
                    className="hover:bg-[#f1f3f5] dark:hover:bg-[#222222]/80 transition-colors"
                  >
                    {/* Foto do Equipamento e Botão de Visualizar */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {(() => {
                        const eqPhoto = getEquipmentPhoto(eq);
                        if (eqPhoto) {
                          return (
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhotoModal({
                                    isOpen: true,
                                    url: eqPhoto,
                                    title: `Foto do Equipamento - ${eq.plate || eq.prefix || eq.type}`,
                                    subtitle: `${eq.type} • ${eq.brand || ''} ${eq.model || ''} • Obra: ${eq.location || 'Não informada'}`,
                                  })
                                }
                                className="group relative w-8 h-8 rounded-md overflow-hidden border border-amber-500/40 hover:border-amber-500 shadow-2xs hover:shadow-xs transition-all cursor-pointer shrink-0"
                                title={`Visualizar foto de ${eq.type} (${eq.plate || eq.prefix})`}
                              >
                                <img
                                  src={eqPhoto}
                                  alt={eq.type}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Eye className="w-3.5 h-3.5 text-white drop-shadow" />
                                </div>
                              </button>
                              <button
                                type="button"
                                id={`btn-view-equipment-photo-${eq.id}`}
                                onClick={() =>
                                  setPreviewPhotoModal({
                                    isOpen: true,
                                    url: eqPhoto,
                                    title: `Foto do Equipamento - ${eq.plate || eq.prefix || eq.type}`,
                                    subtitle: `${eq.type} • ${eq.brand || ''} ${eq.model || ''} • Obra: ${eq.location || 'Não informada'}`,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
                                title="Visualizar Foto Ampliada"
                              >
                                <Eye className="w-3 h-3" />
                                <span className="hidden xl:inline">Visualizar</span>
                              </button>
                            </div>
                          );
                        }
                        return (
                          <span className="text-[#9ca3af] italic text-[11px] inline-flex items-center gap-1 opacity-50" title="Sem foto cadastrada">
                            <Camera className="w-3.5 h-3.5" />
                          </span>
                        );
                      })()}
                    </td>

                    {/* 1. Equipamento */}
                    <td className="py-2 px-3">
                      <div className="font-bold text-xs text-[#111827] dark:text-[#f3f4f6]">
                        {eq.type}
                      </div>
                      {eq.operator && (
                        <div className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 shrink-0" />
                          <span>{eq.operator}</span>
                        </div>
                      )}
                    </td>

                    {/* 2. Placa */}
                    <td className="py-2 px-3">
                      {eq.plate ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#f1f5f9] dark:bg-[#262626] text-[#0f172a] dark:text-[#f8fafc] font-mono-numbers font-bold text-xs border border-[#cbd5e1] dark:border-[#404040]">
                          {eq.plate}
                        </span>
                      ) : (
                        <span className="text-[#9ca3af] italic text-xs">-</span>
                      )}
                    </td>

                    {/* 3. Prefixo */}
                    <td className="py-2 px-3">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black text-amber-400 font-mono-numbers font-bold text-xs border border-amber-500/40">
                        <span>{eq.prefix || eq.code}</span>
                      </div>
                    </td>

                    {/* 4. Modelo */}
                    <td className="py-2 px-3 font-medium text-xs text-[#111827] dark:text-[#f3f4f6]">
                      {eq.model || (eq.brandModel ? eq.brandModel : '-')}
                    </td>

                    {/* 5. Marca */}
                    <td className="py-2 px-3 text-xs text-[#4b5563] dark:text-[#d1d5db]">
                      {eq.brand || '-'}
                    </td>

                    {/* 6. Fornecedor */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5 text-[#4b5563] dark:text-[#d1d5db]">
                        <Building2 className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                        <span className="font-medium text-xs">
                          {eq.supplier || <span className="text-[#9ca3af] italic">Frota Própria</span>}
                        </span>
                      </div>
                    </td>

                    {/* 7. Obra */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1 text-[#4b5563] dark:text-[#d1d5db]">
                        <MapPin className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />
                        <span>{eq.location || <em className="text-[#9ca3af]">Não informada</em>}</span>
                      </div>
                    </td>

                    {/* 8. Chassi */}
                    <td className="py-2 px-3">
                      <span className="font-mono text-xs text-[#111827] dark:text-[#f3f4f6]">
                        {eq.chassis || <span className="text-[#9ca3af] italic">-</span>}
                      </span>
                    </td>

                    {/* Data de Mobilização */}
                    <td className="py-2 px-3">
                      <span className="font-mono-numbers text-xs text-[#111827] dark:text-[#f3f4f6]">
                        {eq.mobilizationDate ? formatDisplayDate(eq.mobilizationDate) : <span className="text-[#9ca3af] italic">-</span>}
                      </span>
                    </td>

                    {/* 9. Data de Desmobilização */}
                    <td className="py-2 px-3">
                      <span className="font-mono-numbers text-xs text-[#111827] dark:text-[#f3f4f6]">
                        {eq.demobilizationDate ? formatDisplayDate(eq.demobilizationDate) : <span className="text-[#9ca3af] italic">-</span>}
                      </span>
                    </td>

                    {/* Horímetro Atual */}
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex items-center gap-1 font-mono-numbers font-bold text-[#111827] dark:text-amber-400 text-xs">
                        <Gauge className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{formatHours(eq.currentHourMeter)}</span>
                        <span className="text-[10px] text-[#9ca3af] font-normal">h</span>
                      </div>
                    </td>

                    {/* Ações: Visualizar a foto ou em Arquivo PDF ou JPEG | Baixar | Excluir | Editar */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {(() => {
                        const att = getEquipmentAttachmentInfo(eq);
                        return (
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {/* 1. Visualizar a foto ou em Arquivo PDF ou JPEG */}
                            {att.hasAttachment ? (
                              <button
                                type="button"
                                id={`btn-action-view-${eq.id}`}
                                onClick={() => handleViewAction(eq)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 border border-amber-600 transition-colors cursor-pointer shadow-2xs"
                                title={`Visualizar a foto ou arquivo (${att.typeLabel})`}
                              >
                                <Eye className="w-3.5 h-3.5 text-black" />
                                <span>Visualizar</span>
                                <span
                                  className="text-[9px] px-1 py-0.5 rounded font-mono font-bold leading-none bg-black text-amber-400"
                                >
                                  {att.typeLabel}
                                </span>
                                {att.count > 1 && (
                                  <span className="text-[9px] font-mono font-bold bg-black text-white px-1 rounded-full ml-0.5">
                                    {att.count}
                                  </span>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                id={`btn-action-attach-${eq.id}`}
                                onClick={() => handleDirectUploadClick(eq)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-500 dark:text-slate-400 bg-[#f1f3f5] dark:bg-[#262626] hover:bg-[#e5e7eb] dark:hover:bg-[#333333] border border-[#dcdfe4] dark:border-[#404040] transition-colors cursor-pointer"
                                title="Anexar Foto JPEG ou Arquivo PDF a este equipamento"
                              >
                                <Camera className="w-3.5 h-3.5 text-amber-500" />
                                <span>Foto/PDF</span>
                              </button>
                            )}

                            {/* 2. Baixar */}
                            <button
                              type="button"
                              id={`btn-action-download-${eq.id}`}
                              onClick={() => handleQuickDownload(eq)}
                              disabled={!att.hasAttachment}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                att.hasAttachment
                                  ? 'text-blue-700 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 cursor-pointer shadow-2xs'
                                  : 'text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-[#222] border border-transparent cursor-not-allowed opacity-50'
                              }`}
                              title={
                                att.hasAttachment
                                  ? `Baixar foto ou arquivo (${att.typeLabel})`
                                  : 'Sem arquivo para baixar'
                              }
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Baixar</span>
                            </button>

                            {/* 3. Excluir */}
                            <button
                              type="button"
                              id={`btn-action-delete-${eq.id}`}
                              onClick={() => handleDeleteAction(eq)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors cursor-pointer shadow-2xs"
                              title={
                                att.hasAttachment
                                  ? 'Excluir foto/arquivo ou excluir equipamento'
                                  : 'Excluir equipamento'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Excluir</span>
                            </button>

                            {/* Editar */}
                            <button
                              type="button"
                              id={`btn-action-edit-${eq.id}`}
                              onClick={() => handleStartEdit(eq)}
                              title="Editar este equipamento"
                              className="p-1 rounded text-[#9ca3af] hover:text-amber-500 hover:bg-[#262626] transition-colors ml-0.5"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (optimized for field smartphone use) */}
          <div className="md:hidden divide-y divide-[#eaecef] dark:divide-[#262626]">
            {filteredEquipments.map((eq, index) => (
              <div key={`${eq.id}-${eq.code || index}`} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    {(() => {
                      const eqPhoto = getEquipmentPhoto(eq);
                      if (eqPhoto) {
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhotoModal({
                                isOpen: true,
                                url: eqPhoto,
                                title: `Foto do Equipamento - ${eq.plate || eq.prefix || eq.type}`,
                                subtitle: `${eq.type} • ${eq.brand || ''} ${eq.model || ''} • Obra: ${eq.location || 'Não informada'}`,
                              })
                            }
                            className="relative group w-11 h-11 rounded-lg overflow-hidden border border-amber-500/50 shrink-0 cursor-pointer shadow-2xs"
                            title="Visualizar Foto Ampliada"
                          >
                            <img src={eqPhoto} alt={eq.type} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </button>
                        );
                      }
                      return null;
                    })()}
                    <div>
                      {/* 1. Equipamento */}
                      <h3 className="font-bold text-sm text-[#111827] dark:text-[#f3f4f6]">
                        {eq.type}
                      </h3>
                      {/* 2. Placa & 3. Prefixo */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-black text-amber-400 font-mono-numbers font-bold text-xs border border-amber-500/40">
                          Pref: {eq.prefix || eq.code}
                        </span>
                        {eq.plate && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#f1f5f9] dark:bg-[#262626] text-[#0f172a] dark:text-[#f8fafc] font-mono-numbers font-bold text-xs border border-[#cbd5e1] dark:border-[#404040]">
                            Placa: {eq.plate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase font-mono font-bold text-[#9ca3af]">
                      Horímetro
                    </div>
                    <div className="font-mono-numbers font-bold text-amber-600 dark:text-amber-400 text-sm">
                      {formatHours(eq.currentHourMeter)}{' '}
                      <span className="text-[10px] font-normal text-[#9ca3af]">h</span>
                    </div>
                  </div>
                </div>

                {/* 4. Modelo & 5. Marca */}
                <div className="text-xs text-[#4b5563] dark:text-[#d1d5db] flex items-center gap-2 flex-wrap bg-[#f8fafc] dark:bg-[#141414] p-1.5 rounded">
                  <span><strong>Modelo:</strong> {eq.model || (eq.brandModel ? eq.brandModel : '-')}</span>
                  {eq.brand && <span>• <strong>Marca:</strong> {eq.brand}</span>}
                </div>

                {/* 6. Fornecedor & 7. Obra */}
                <div className="grid grid-cols-2 gap-1.5 text-xs text-[#4b5563] dark:text-[#d1d5db]">
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">{eq.supplier || 'Frota Própria'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />
                    <span className="truncate">{eq.location || 'Sem obra'}</span>
                  </div>
                </div>

                {/* 8. Chassi, Mobilização & Desmobilização */}
                <div className="grid grid-cols-3 gap-1.5 text-xs text-[#4b5563] dark:text-[#d1d5db] bg-[#f8fafc] dark:bg-[#141414] p-1.5 rounded">
                  <div>
                    <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Chassi</span>
                    <span className="font-mono text-xs text-[#111827] dark:text-[#f3f4f6] truncate block">
                      {eq.chassis || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Mobilização</span>
                    <span className="font-mono-numbers text-xs text-[#111827] dark:text-[#f3f4f6] block">
                      {eq.mobilizationDate ? formatDisplayDate(eq.mobilizationDate) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#9ca3af] block text-[10px] uppercase font-bold">Desmobilização</span>
                    <span className="font-mono-numbers text-xs text-[#111827] dark:text-[#f3f4f6] block">
                      {eq.demobilizationDate ? formatDisplayDate(eq.demobilizationDate) : '-'}
                    </span>
                  </div>
                </div>

                {/* Operador se houver */}
                {eq.operator && (
                  <div className="flex items-center gap-1 text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">Op: {eq.operator}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-[#eaecef] dark:border-[#262626] flex-wrap">
                  {(() => {
                    const att = getEquipmentAttachmentInfo(eq);
                    return (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 1. Visualizar a foto ou em Arquivo PDF ou JPEG */}
                        {att.hasAttachment ? (
                          <button
                            type="button"
                            id={`btn-mobile-view-${eq.id}`}
                            onClick={() => handleViewAction(eq)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 border border-amber-600 rounded shadow-2xs"
                            title="Visualizar foto ou arquivo"
                          >
                            <Eye className="w-3.5 h-3.5 text-black" />
                            <span>Visualizar</span>
                            <span
                              className="text-[9px] px-1 py-0.5 rounded font-mono font-bold leading-none bg-black text-amber-400"
                            >
                              {att.typeLabel}
                            </span>
                            {att.count > 1 && (
                              <span className="text-[9px] font-mono font-bold bg-black text-white px-1 rounded-full ml-0.5">
                                {att.count}
                              </span>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            id={`btn-mobile-attach-${eq.id}`}
                            onClick={() => handleDirectUploadClick(eq)}
                            className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium text-slate-500 bg-[#f1f3f5] dark:bg-[#262626] border border-[#dcdfe4] dark:border-[#404040] rounded"
                            title="Carregar foto ou arquivo PDF"
                          >
                            <Camera className="w-3.5 h-3.5 text-amber-500" />
                            <span>Foto/PDF</span>
                          </button>
                        )}

                        {/* 2. Baixar */}
                        <button
                          type="button"
                          id={`btn-mobile-download-${eq.id}`}
                          onClick={() => handleQuickDownload(eq)}
                          disabled={!att.hasAttachment}
                          className={`inline-flex items-center gap-1 h-7 px-2.5 text-xs font-semibold rounded transition-colors ${
                            att.hasAttachment
                              ? 'text-blue-700 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30'
                              : 'text-slate-400 bg-slate-100 dark:bg-[#222] border border-transparent cursor-not-allowed opacity-50'
                          }`}
                          title="Baixar arquivo"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-500" />
                          <span>Baixar</span>
                        </button>

                        {/* 3. Excluir */}
                        <button
                          type="button"
                          id={`btn-mobile-delete-${eq.id}`}
                          onClick={() => handleDeleteAction(eq)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded"
                          title="Excluir foto/arquivo ou equipamento"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      id={`btn-mobile-edit-${eq.id}`}
                      onClick={() => handleStartEdit(eq)}
                      className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-semibold rounded bg-[#f1f3f5] dark:bg-[#262626] text-[#4b5563] dark:text-[#d1d5db]"
                      title="Editar equipamento"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                      <span>Editar</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeveloper && equipmentToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded-lg p-4 max-w-md w-full shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="p-1.5 rounded bg-rose-100 dark:bg-rose-950/60">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#111827] dark:text-[#f3f4f6]">
                  Excluir Equipamento?
                </h3>
                <p className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="p-2.5 bg-[#f8fafc] dark:bg-[#141414] border border-[#dcdfe4] dark:border-[#262626] rounded text-xs space-y-1 text-[#4b5563] dark:text-[#d1d5db]">
              <div>
                <strong className="font-semibold">Placa/Prefixo:</strong> {equipmentToDelete.code}
              </div>
              <div>
                <strong className="font-semibold">Equipamento:</strong> {equipmentToDelete.type} -{' '}
                {equipmentToDelete.brandModel}
              </div>
              <div>
                <strong className="font-semibold">Horímetro atual:</strong>{' '}
                {formatHours(equipmentToDelete.currentHourMeter)} h
              </div>
            </div>

            <p className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
              Os apontamentos históricos já lançados com este equipamento continuarão preservados
              no log.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setEquipmentToDelete(null)}
                className="h-7.5 px-3 text-xs font-semibold rounded border border-[#dcdfe4] dark:border-[#333333] text-[#4b5563] dark:text-[#9ca3af] hover:bg-[#edf2f7] dark:hover:bg-[#262626]"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-delete-equipment"
                onClick={() => {
                  onDeleteEquipment(equipmentToDelete.id);
                  setEquipmentToDelete(null);
                }}
                className="h-7.5 px-3 text-xs font-bold rounded bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Equipment Files Modal */}
      <EquipmentFilesModal
        equipment={selectedEquipmentForFiles}
        isOpen={isFilesModalOpen}
        initialViewingFileId={initialViewingFileId}
        onClose={() => {
          setIsFilesModalOpen(false);
          setSelectedEquipmentForFiles(null);
          setInitialViewingFileId(null);
        }}
        onSaveFile={handleSaveEquipmentFile}
        onDeleteFile={handleDeleteEquipmentFile}
      />

      {/* Obra Files Modal (PDF e Excel por Obra - dinâmico para qualquer obra) */}
      <ObraFilesModal
        isOpen={isObraFilesModalOpen}
        onClose={() => setIsObraFilesModalOpen(false)}
        obraCode={selectedProject || 'all'}
        obraName={selectedProject === 'all' ? 'Todas as Obras (Visão Global)' : `Obra ${selectedProject}`}
        files={obraFiles}
        onSaveFile={handleSaveObraFile}
        onDeleteFile={handleDeleteObraFile}
      />

      {/* Lightbox / Modal de Visualização da Foto do Equipamento */}
      {previewPhotoModal && previewPhotoModal.isOpen && (
        <PhotoLightboxModal
          isOpen={previewPhotoModal.isOpen}
          onClose={() => setPreviewPhotoModal(null)}
          photoUrl={previewPhotoModal.url}
          photoName={previewPhotoModal.name || 'foto_equipamento.jpg'}
          title={previewPhotoModal.title || 'Foto do Equipamento'}
          subtitle={previewPhotoModal.subtitle}
        />
      )}

      {/* Hidden file input for direct row photo / PDF upload */}
      <input
        ref={directUploadInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleDirectFileSelected}
      />

      {/* Modal: Escolher arquivo quando houver múltiplos (Foto JPEG ou Documento PDF) */}
      {viewChooserEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaecef] dark:border-[#2d2d2d]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#111827] dark:text-[#f3f4f6]">
                    Arquivos do Equipamento: {viewChooserEquipment.plate || viewChooserEquipment.prefix || viewChooserEquipment.type}
                  </h3>
                  <p className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                    Escolha o arquivo para Visualizar, Baixar ou Excluir (PDF ou JPEG)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewChooserEquipment(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {/* Foto / Documento Principal */}
              {viewChooserEquipment.photoUrl && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-[#e5e7eb] dark:border-[#333333] bg-[#f9fafb] dark:bg-[#222222]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {viewChooserEquipment.photoUrl.startsWith('data:application/pdf') ? (
                      <FileText className="w-5 h-5 text-rose-500 shrink-0" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#111827] dark:text-white truncate">
                        {viewChooserEquipment.photoUrl.startsWith('data:application/pdf') ? 'Documento Técnico (PDF)' : 'Foto do Equipamento (JPEG)'}
                      </div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                        {viewChooserEquipment.type} • {viewChooserEquipment.brand} {viewChooserEquipment.model}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const isPdf = viewChooserEquipment.photoUrl!.startsWith('data:application/pdf');
                        setPreviewPhotoModal({
                          isOpen: true,
                          url: viewChooserEquipment.photoUrl!,
                          name: `${viewChooserEquipment.plate || viewChooserEquipment.prefix || 'equipamento'}_foto.${isPdf ? 'pdf' : 'jpg'}`,
                          title: isPdf ? `Documento PDF - ${viewChooserEquipment.plate || viewChooserEquipment.prefix || viewChooserEquipment.type}` : `Foto - ${viewChooserEquipment.plate || viewChooserEquipment.prefix || viewChooserEquipment.type}`,
                          subtitle: `${viewChooserEquipment.type} • Obra: ${viewChooserEquipment.location || 'Não informada'}`,
                        });
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
                      title="Visualizar"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visualizar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const isPdf = viewChooserEquipment.photoUrl!.startsWith('data:application/pdf');
                        const a = document.createElement('a');
                        a.href = viewChooserEquipment.photoUrl!;
                        a.download = `${viewChooserEquipment.plate || viewChooserEquipment.prefix || 'equipamento'}_foto.${isPdf ? 'pdf' : 'jpg'}`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30"
                      title="Baixar"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated: Equipment = {
                          ...viewChooserEquipment,
                          photoUrl: '',
                          updatedAt: new Date().toISOString(),
                        };
                        onUpdateEquipment(updated);
                        setViewChooserEquipment(updated);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Arquivos Anexos (PDF ou JPEG) */}
              {(viewChooserEquipment.files || []).map((file) => {
                const isPdf = file.fileType === 'PDF' || file.name.toLowerCase().endsWith('.pdf') || (file.dataUrl?.startsWith('data:application/pdf') ?? false);
                return (
                  <div key={file.id} className="flex items-center justify-between p-3 rounded-lg border border-[#e5e7eb] dark:border-[#333333] bg-[#f9fafb] dark:bg-[#222222]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isPdf ? (
                        <FileText className="w-5 h-5 text-rose-500 shrink-0" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#111827] dark:text-white truncate">
                          {file.name}
                        </div>
                        <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                          {file.category || (isPdf ? 'PDF' : 'JPEG')} • {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewPhotoModal({
                            isOpen: true,
                            url: file.dataUrl,
                            name: file.name,
                            title: `${file.name} - ${viewChooserEquipment.plate || viewChooserEquipment.prefix}`,
                            subtitle: `${file.category} • ${formatFileSize(file.size)}`,
                          });
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 border border-amber-600 transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="w-3.5 h-3.5 text-black" />
                        <span>Visualizar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadEquipmentFile(file)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 border border-amber-600 transition-colors"
                        title="Baixar"
                      >
                        <Download className="w-3.5 h-3.5 text-black" />
                        <span>Baixar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEquipmentFile(viewChooserEquipment.id, file.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#eaecef] dark:border-[#2d2d2d]">
              <button
                type="button"
                onClick={() => {
                  const target = viewChooserEquipment;
                  setViewChooserEquipment(null);
                  handleOpenFilesModal(target);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Gerenciar Todos os Anexos</span>
              </button>
              <button
                type="button"
                onClick={() => setViewChooserEquipment(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded border border-[#dcdfe4] dark:border-[#333333] text-[#4b5563] dark:text-[#9ca3af] hover:bg-[#edf2f7] dark:hover:bg-[#262626]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Exclusão (Foto/Arquivo vs Equipamento) */}
      {deleteAttachmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111827] dark:text-[#f3f4f6]">
                  Opções de Exclusão: {deleteAttachmentModal.equipment.plate || deleteAttachmentModal.equipment.prefix || deleteAttachmentModal.equipment.type}
                </h3>
                <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-1">
                  Selecione se deseja remover apenas o anexo (Foto JPEG ou Documento PDF) ou excluir o cadastro completo do equipamento da base de dados.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {/* Opção 1: Excluir Foto ou Arquivo PDF / JPEG */}
              <button
                type="button"
                id="btn-confirm-delete-attachment-only"
                onClick={handleConfirmDeleteAttachmentOnly}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Camera className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-[#111827] dark:text-white">
                      Excluir Foto / Arquivo (PDF ou JPEG)
                    </div>
                    <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                      Remove a foto/documento anexado. O equipamento permanece ativo.
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 group-hover:underline shrink-0 ml-2">
                  Excluir Arquivo
                </span>
              </button>

              {/* Opção 2: Excluir Equipamento Completo (se desenvolvedor/gestor) */}
              {isDeveloper && (
                <button
                  type="button"
                  id="btn-confirm-delete-full-equip"
                  onClick={handleConfirmDeleteFullEquipment}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/15 text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        Excluir Equipamento Completo
                      </div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                        Remove o registro de todo o equipamento da base de dados.
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 group-hover:underline shrink-0 ml-2">
                    Excluir Tudo
                  </span>
                </button>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#eaecef] dark:border-[#2d2d2d]">
              <button
                type="button"
                onClick={() => setDeleteAttachmentModal(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded border border-[#dcdfe4] dark:border-[#333333] text-[#4b5563] dark:text-[#9ca3af] hover:bg-[#edf2f7] dark:hover:bg-[#262626] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
