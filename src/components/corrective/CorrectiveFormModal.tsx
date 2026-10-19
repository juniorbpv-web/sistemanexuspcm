import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Wrench,
  Truck,
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  Plus,
  Building,
  MapPin,
  Calendar,
  Clock,
  Gauge,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  HelpCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import {
  CorrectiveMaintenance,
  Equipment,
  CorrectivePhoto,
  CorrectiveStatus,
  CorrectiveFailureType,
} from '../../types';
import { PhotoLightboxModal } from './PhotoLightboxModal';

interface CorrectiveFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: CorrectiveMaintenance) => void;
  equipments: Equipment[];
  editingRecord?: CorrectiveMaintenance | null;
  existingRecords: CorrectiveMaintenance[];
}

export const CorrectiveFormModal: React.FC<CorrectiveFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  equipments,
  editingRecord,
  existingRecords,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [osNumber, setOsNumber] = useState('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [prefix, setPrefix] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [location, setLocation] = useState('');
  const [operator, setOperator] = useState('');

  const [openDate, setOpenDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [openMeter, setOpenMeter] = useState<string>('');
  const [completionMeter, setCompletionMeter] = useState<string>('');
  const [meterUnit, setMeterUnit] = useState<'HORAS' | 'KM'>('HORAS');

  const [failureType, setFailureType] = useState<CorrectiveFailureType | string>('Sistema hidráulico');
  const [affectedSystem, setAffectedSystem] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [servicePerformed, setServicePerformed] = useState('');
  const [replacedParts, setReplacedParts] = useState('');
  const [mechanic, setMechanic] = useState('');
  const [stoppedDays, setStoppedDays] = useState<number>(1);
  const [stoppedHours, setStoppedHours] = useState<number>(8);
  const [status, setStatus] = useState<CorrectiveStatus>('Aberta');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<CorrectivePhoto[]>([]);

  // Autocomplete plate/prefix selector state
  const [selectedPlate, setSelectedPlate] = useState('');
  const [isPlateDropdownOpen, setIsPlateDropdownOpen] = useState(false);
  const plateDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        plateDropdownRef.current &&
        !plateDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPlateDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Feedback & preview states
  const [errorMessage, setErrorMessage] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Autocomplete suggestions based on typed input
  const plateSuggestions = useMemo(() => {
    const q = selectedPlate.trim().toUpperCase();
    if (!q) {
      return equipments.slice(0, 40);
    }
    return equipments
      .filter((eq) => {
        const prefixVal = (eq.prefix || '').toUpperCase();
        const codeVal = (eq.code || '').toUpperCase();
        const plateVal = (eq.plate || '').toUpperCase();
        const typeVal = (eq.type || '').toUpperCase();
        const modelVal = (eq.model || eq.brandModel || '').toUpperCase();
        const operatorVal = (eq.operator || '').toUpperCase();
        const supplierVal = (eq.supplier || '').toUpperCase();
        return (
          prefixVal.includes(q) ||
          codeVal.includes(q) ||
          plateVal.includes(q) ||
          typeVal.includes(q) ||
          modelVal.includes(q) ||
          operatorVal.includes(q) ||
          supplierVal.includes(q)
        );
      })
      .slice(0, 40);
  }, [equipments, selectedPlate]);

  // Find matched equipment in database
  const matchedEquipment = useMemo(() => {
    if (selectedEquipmentId) {
      const found = equipments.find((e) => e.id === selectedEquipmentId);
      if (found) return found;
    }
    const q = selectedPlate.trim().toUpperCase();
    if (!q) return null;
    return (
      equipments.find(
        (eq) =>
          (eq.prefix && eq.prefix.toUpperCase() === q) ||
          (eq.code && eq.code.toUpperCase() === q) ||
          (eq.plate && eq.plate.toUpperCase() === q)
      ) || null
    );
  }, [equipments, selectedEquipmentId, selectedPlate]);

  // Generate next automatic OS number
  const generateNextOs = () => {
    const year = new Date().getFullYear();
    const count = existingRecords.length + 1;
    return `OS-${year}-${String(count).padStart(3, '0')}`;
  };

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) return;

    if (editingRecord) {
      setOsNumber(editingRecord.osNumber || '');
      setSelectedEquipmentId(editingRecord.equipmentId || '');
      setSelectedPlate(editingRecord.plate || editingRecord.prefix || '');
      setPrefix(editingRecord.prefix || '');
      setEquipmentType(editingRecord.equipmentType || '');
      setBrand(editingRecord.brand || '');
      setModel(editingRecord.model || '');
      setPlate(editingRecord.plate || '');
      setSupplier(editingRecord.supplier || '');
      setLocation(editingRecord.location || '');
      setOperator(editingRecord.operator || '');

      setOpenDate(editingRecord.openDate || '');
      setCompletionDate(editingRecord.completionDate || '');
      setOpenMeter(editingRecord.openMeter !== undefined ? String(editingRecord.openMeter) : '');
      setCompletionMeter(editingRecord.completionMeter !== undefined ? String(editingRecord.completionMeter) : '');
      setMeterUnit(editingRecord.meterUnit || 'HORAS');

      setFailureType(editingRecord.failureType || 'Sistema hidráulico');
      setAffectedSystem(editingRecord.affectedSystem || '');
      setProblemDescription(editingRecord.problemDescription || '');
      setDiagnosis(editingRecord.diagnosis || '');
      setServicePerformed(editingRecord.servicePerformed || '');
      setReplacedParts(editingRecord.replacedParts || '');
      setMechanic(editingRecord.mechanic || '');
      setStoppedDays(editingRecord.stoppedDays ?? 1);
      setStoppedHours(editingRecord.stoppedHours ?? 8);
      setStatus(editingRecord.status || 'Aberta');
      setNotes(editingRecord.notes || '');
      setPhotos(editingRecord.photos ? [...editingRecord.photos] : []);
    } else {
      // New record defaults
      const todayStr = new Date().toISOString().split('T')[0];
      setOsNumber(generateNextOs());
      setSelectedEquipmentId('');
      setSelectedPlate('');
      setIsPlateDropdownOpen(false);
      setPrefix('');
      setEquipmentType('');
      setBrand('');
      setModel('');
      setPlate('');
      setSupplier('');
      setLocation('');
      setOperator('');

      setOpenDate(todayStr);
      setCompletionDate('');
      setOpenMeter('');
      setCompletionMeter('');
      setMeterUnit('HORAS');

      setFailureType('Sistema hidráulico');
      setAffectedSystem('');
      setProblemDescription('');
      setDiagnosis('');
      setServicePerformed('');
      setReplacedParts('');
      setMechanic('');
      setStoppedDays(1);
      setStoppedHours(8);
      setStatus('Aberta');
      setNotes('');
      setPhotos([]);
    }
    setErrorMessage('');
  }, [isOpen, editingRecord]);

  // Auto-fill from selected equipment
  const applyEquipmentData = (equip: Equipment) => {
    setSelectedEquipmentId(equip.id);
    setSelectedPlate(equip.plate || equip.prefix || equip.code || '');
    setPlate(equip.plate || '');
    setPrefix(equip.prefix || equip.code || equip.plate || '');
    setEquipmentType(equip.type || '');
    setBrand(equip.brand || '');
    setModel(equip.model || equip.brandModel || '');
    setSupplier(equip.supplier || '');
    setLocation(equip.location || '');
    setOperator(equip.operator || '');

    // Determine unit and meter
    const isRoadVehicle =
      (equip.type || '').toUpperCase().includes('CAMINHÃO') ||
      (equip.type || '').toUpperCase().includes('VAN') ||
      (equip.type || '').toUpperCase().includes('CAMINHONETE');

    setMeterUnit(isRoadVehicle ? 'KM' : 'HORAS');
    if (equip.currentHourMeter) {
      setOpenMeter(String(equip.currentHourMeter));
    }
    setIsPlateDropdownOpen(false);
  };

  const handleEquipmentSelect = (equipId: string) => {
    if (!equipId) {
      setSelectedEquipmentId('');
      return;
    }
    const equip = equipments.find((e) => e.id === equipId);
    if (equip) {
      applyEquipmentData(equip);
    }
  };

  // Recalculate stopped days when dates change
  useEffect(() => {
    if (openDate && completionDate) {
      const d1 = new Date(openDate);
      const d2 = new Date(completionDate);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        const calculatedDays = diffDays === 0 ? 1 : diffDays;
        setStoppedDays(calculatedDays);
        setStoppedHours(calculatedDays * 8);
      }
    }
  }, [openDate, completionDate]);

  // Process and optimize a single file (Supports JPG, JPEG, PNG, WEBP and PDF; accepts any photo size)
  const processFile = async (file: File): Promise<CorrectivePhoto | null> => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif|jfif|tiff?)$/i.test(file.name);

    if (!isPdf && !isImage) {
      setErrorMessage(`Formato não suportado para "${file.name}". Formatos aceitos: JPG, JPEG, PNG, WEBP, PDF.`);
      return null;
    }

    // Process PDF document
    if (isPdf) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = (event.target?.result as string) || '';
          resolve({
            id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: file.name,
            dataUrl: result,
            size: file.size,
            uploadedAt: new Date().toISOString(),
          });
        };
        reader.onerror = () => {
          setErrorMessage(`Falha ao ler o arquivo PDF "${file.name}".`);
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    }

    // Process image: Accepts ALL photo sizes (5MB, 15MB, 30MB, high-res camera photos)
    // Uses URL.createObjectURL + HTML5 Canvas optimization to ensure photos are crisp and lightweight
    return new Promise((resolve) => {
      let objectUrl = '';
      try {
        objectUrl = URL.createObjectURL(file);
      } catch (err) {
        console.warn('Falha ao criar ObjectURL, usando FileReader:', err);
      }

      const finishWithFileReader = () => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const rawDataUrl = (event.target?.result as string) || '';
          resolve({
            id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: file.name,
            dataUrl: rawDataUrl,
            size: file.size,
            uploadedAt: new Date().toISOString(),
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };

      if (!objectUrl) {
        finishWithFileReader();
        return;
      }

      const img = new Image();

      img.onload = () => {
        try {
          // Target max dimension 1600px for crisp details while keeping size low
          const maxDim = 1600;
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
            let compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);

            // If still unusually large (>450KB), apply a second pass
            if (compressedDataUrl.length > 450000) {
              const secondMaxDim = 1200;
              let sWidth = width;
              let sHeight = height;
              if (sWidth > secondMaxDim || sHeight > secondMaxDim) {
                if (sWidth > sHeight) {
                  sHeight = Math.round((sHeight * secondMaxDim) / sWidth);
                  sWidth = secondMaxDim;
                } else {
                  sWidth = Math.round((sWidth * secondMaxDim) / sHeight);
                  sHeight = secondMaxDim;
                }
              }
              const canvas2 = document.createElement('canvas');
              canvas2.width = sWidth;
              canvas2.height = sHeight;
              const ctx2 = canvas2.getContext('2d');
              if (ctx2) {
                ctx2.drawImage(canvas, 0, 0, sWidth, sHeight);
                compressedDataUrl = canvas2.toDataURL('image/jpeg', 0.70);
              }
            }

            URL.revokeObjectURL(objectUrl);
            resolve({
              id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              name: file.name,
              dataUrl: compressedDataUrl,
              size: Math.round(compressedDataUrl.length * 0.75),
              uploadedAt: new Date().toISOString(),
            });
            return;
          }
        } catch (err) {
          console.warn('Canvas optimization error, falling back:', err);
        }

        URL.revokeObjectURL(objectUrl);
        finishWithFileReader();
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        finishWithFileReader();
      };

      img.src = objectUrl;
    });
  };

  const handleProcessFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    setErrorMessage('');
    try {
      const results = await Promise.all(fileList.map((f) => processFile(f)));
      const valid = results.filter((p): p is CorrectivePhoto => p !== null);
      if (valid.length > 0) {
        setPhotos((prev) => [...prev, ...valid]);
      }
    } catch (err) {
      console.error('Error processing photos:', err);
      setErrorMessage('Erro ao processar as fotos selecionadas.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!osNumber.trim()) {
      setErrorMessage('Informe o número da Ordem de Serviço (O.S.).');
      return;
    }
    if (!prefix.trim()) {
      setErrorMessage('Selecione ou informe o prefixo do equipamento.');
      return;
    }
    if (!openDate) {
      setErrorMessage('Informe a data de abertura da O.S.');
      return;
    }
    if (!problemDescription.trim()) {
      setErrorMessage('Descreva o problema constatado no equipamento.');
      return;
    }

    const now = new Date().toISOString();

    const recordData: CorrectiveMaintenance = {
      id: editingRecord ? editingRecord.id : `cor-${Date.now()}`,
      osNumber: osNumber.trim().toUpperCase(),
      equipmentId: selectedEquipmentId || undefined,
      prefix: prefix.trim().toUpperCase(),
      equipmentType: equipmentType.trim() || 'Equipamento',
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      plate: plate.trim() || undefined,
      supplier: supplier.trim() || 'Não informado',
      location: location.trim() || 'Não informada',
      operator: operator.trim() || undefined,

      openDate,
      completionDate: completionDate || undefined,
      openMeter: openMeter ? parseFloat(openMeter) : undefined,
      completionMeter: completionMeter ? parseFloat(completionMeter) : undefined,
      meterUnit,

      failureType,
      affectedSystem: affectedSystem.trim() || undefined,
      problemDescription: problemDescription.trim(),
      diagnosis: diagnosis.trim() || undefined,
      servicePerformed: servicePerformed.trim() || 'Em atendimento',
      replacedParts: replacedParts.trim() || undefined,
      mechanic: mechanic.trim() || 'Mecânico Não Informado',
      stoppedDays: Number(stoppedDays) || 0,
      stoppedHours: Number(stoppedHours) || (Number(stoppedDays) * 8),

      status,
      notes: notes.trim() || undefined,
      photos,

      createdAt: editingRecord ? editingRecord.createdAt : now,
      updatedAt: now,
    };

    onSave(recordData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        id="corrective-form-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white">
                  {editingRecord ? `Editar Ordem de Serviço: ${editingRecord.osNumber}` : 'Nova Manutenção Corretiva'}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Integração direta com a Base de Dados de Equipamentos e Gestão de Frotas
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* SEÇÃO 1: VINCULAR EQUIPAMENTO DA BASE DE DADOS */}
            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-200/70 dark:border-blue-900/40 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  1. Equipamento da Base de Dados (Preenchimento Automático)
                </span>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  {equipments.length} máquinas cadastradas na base
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* 1. Placa / Prefixo do Equipamento with Autocomplete */}
                <div className="sm:col-span-2 md:col-span-1 relative" ref={plateDropdownRef}>
                  <label
                    htmlFor="input-plate-autocomplete"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5"
                  >
                    1. Placa / Prefixo do Equipamento <span className="text-amber-500">*</span>
                  </label>

                  <div className="relative">
                    <input
                      id="input-plate-autocomplete"
                      type="text"
                      autoComplete="off"
                      placeholder="Digite ou selecione a placa..."
                      value={selectedPlate}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setSelectedPlate(val);
                        setIsPlateDropdownOpen(true);
                        const exact = equipments.find(
                          (eq) =>
                            (eq.prefix && eq.prefix.toUpperCase() === val) ||
                            (eq.plate && eq.plate.toUpperCase() === val) ||
                            (eq.code && eq.code.toUpperCase() === val)
                        );
                        if (exact) {
                          applyEquipmentData(exact);
                        } else {
                          setSelectedEquipmentId('');
                          setPrefix(val);
                        }
                      }}
                      onFocus={() => setIsPlateDropdownOpen(true)}
                      className={`w-full px-2.5 py-1.5 pr-8 text-xs bg-white dark:bg-slate-800 border rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        matchedEquipment
                          ? 'border-blue-500 ring-1 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setIsPlateDropdownOpen((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      aria-label="Abrir lista de placas e equipamentos"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Autocomplete dropdown suggestions */}
                  {isPlateDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 divide-y divide-slate-100 dark:divide-slate-700/60 animate-in fade-in duration-100">
                      {plateSuggestions.length === 0 ? (
                        <div className="p-2.5 text-xs text-slate-500 dark:text-slate-400 text-center">
                          Nenhum equipamento encontrado com este prefixo.
                        </div>
                      ) : (
                        plateSuggestions.map((eq) => (
                          <button
                            key={eq.id}
                            type="button"
                            onClick={() => applyEquipmentData(eq)}
                            className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/70 flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-xs text-slate-900 dark:text-amber-400">
                                  {eq.plate || eq.prefix || eq.code}
                                </span>
                                {eq.prefix && eq.plate && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                                    Pref: {eq.prefix}
                                  </span>
                                )}
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                  {eq.type}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {eq.operator ? `Op: ${eq.operator}` : 'Sem operador'} •{' '}
                                {eq.model || eq.brandModel || 'Sem modelo'}
                                {eq.brand ? ` (${eq.brand})` : ''}
                                {eq.supplier ? ` • Forn: ${eq.supplier}` : ''}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[9px] text-slate-400 block uppercase font-medium">Horímetro</span>
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                                {eq.currentHourMeter !== undefined ? `${Number(eq.currentHourMeter).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} h` : '—'}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Feedback indicator - Informações destacadas em amarelo */}
                  <div className="mt-1">
                    {matchedEquipment ? (
                      <div className="p-2 rounded-lg bg-amber-400/15 dark:bg-amber-500/20 border-2 border-amber-400 dark:border-amber-500/70 text-xs text-amber-950 dark:text-amber-100 flex items-center justify-between flex-wrap gap-1.5 animate-fadeIn shadow-2xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black font-mono text-xs shadow-2xs">
                            Prefixo: {matchedEquipment.prefix || matchedEquipment.code}
                          </span>
                          {matchedEquipment.plate && (
                            <span className="px-1.5 py-0.5 rounded bg-white/90 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-[11px] font-bold border border-amber-300 dark:border-amber-600">
                              Placa: {matchedEquipment.plate}
                            </span>
                          )}
                          <span className="font-bold text-amber-950 dark:text-amber-100">
                            {matchedEquipment.type}
                          </span>
                        </div>
                        <div className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
                          {matchedEquipment.location ? `Obra: ${matchedEquipment.location}` : ''}
                        </div>
                      </div>
                    ) : selectedPlate.trim() ? (
                      <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Equipamento não cadastrado na Base de Dados.</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Puxe da frota cadastrada para preenchimento rápido.
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prefixo *
                  </label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="Ex: MC005, CAF51"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Equipamento
                  </label>
                  <input
                    type="text"
                    value={equipmentType}
                    onChange={(e) => setEquipmentType(e.target.value)}
                    placeholder="Ex: BOBCAT, ESCAVADEIRA"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ex: CATERPILLAR, VOLVO"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Ex: CAT 246D3"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Placa
                  </label>
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="Ex: BRA2E19"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fornecedor / Locadora *
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Ex: MAKMO, CONSTEM"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Obra Atual *
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex: SCP 063, SCP 064"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Operador
                  </label>
                  <input
                    type="text"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    placeholder="Nome do operador"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: DADOS DA ORDEM DE SERVIÇO & PARALISAÇÃO */}
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block border-b border-slate-100 dark:border-slate-800 pb-1.5">
                2. Dados da Ordem de Serviço (O.S.) & Prazos
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Número da O.S. *
                  </label>
                  <input
                    type="text"
                    value={osNumber}
                    onChange={(e) => setOsNumber(e.target.value)}
                    placeholder="Ex: OS-2026-081"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status da OS *
                  </label>
                  <select
                    id="input-corrective-os-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CorrectiveStatus)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Aberta">Aberta</option>
                    <option value="Em Análise">Em Análise</option>
                    <option value="Concluída">Concluída</option>
                    <option value="Em manutenção">Em manutenção</option>
                    <option value="Aguardando peça">Aguardando peça</option>
                    <option value="Aguardando fornecedor">Aguardando fornecedor</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data de Abertura *
                  </label>
                  <input
                    type="date"
                    value={openDate}
                    onChange={(e) => setOpenDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data de Conclusão
                  </label>
                  <input
                    type="date"
                    value={completionDate}
                    onChange={(e) => {
                      setCompletionDate(e.target.value);
                      if (e.target.value && status !== 'Concluída') {
                        setStatus('Concluída');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Unidade do Medidor
                  </label>
                  <select
                    value={meterUnit}
                    onChange={(e) => setMeterUnit(e.target.value as 'HORAS' | 'KM')}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  >
                    <option value="HORAS">Horas (Horímetro)</option>
                    <option value="KM">Quilômetros (KM)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Horímetro/KM na Abertura
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={openMeter}
                    onChange={(e) => setOpenMeter(e.target.value)}
                    placeholder="Ex: 1240"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Horímetro/KM na Conclusão
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={completionMeter}
                    onChange={(e) => setCompletionMeter(e.target.value)}
                    placeholder="Ex: 1240"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tempo Máquina Parada (Dias) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stoppedDays}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setStoppedDays(val);
                      setStoppedHours(val * 8);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-rose-600 dark:text-rose-400 font-mono font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: FALHA, DIAGNÓSTICO, SERVIÇO & MECÂNICO */}
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block border-b border-slate-100 dark:border-slate-800 pb-1.5">
                3. Informações Técnicas da Corretiva
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Falha *
                  </label>
                  <select
                    value={failureType}
                    onChange={(e) => setFailureType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium"
                  >
                    <option value="Sistema hidráulico">Sistema hidráulico</option>
                    <option value="Sistema elétrico">Sistema elétrico</option>
                    <option value="Motor">Motor</option>
                    <option value="Transmissão">Transmissão</option>
                    <option value="Pneus">Pneus</option>
                    <option value="Freios">Freios</option>
                    <option value="Arrefecimento">Arrefecimento</option>
                    <option value="Lubrificação">Lubrificação</option>
                    <option value="Estrutural / Chassi">Estrutural / Chassi</option>
                    <option value="Material Rodante">Material Rodante</option>
                    <option value="Implemento / Caçamba / Lâmina">Implemento / Caçamba / Lâmina</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sistema / Componente Afetado
                  </label>
                  <input
                    type="text"
                    value={affectedSystem}
                    onChange={(e) => setAffectedSystem(e.target.value)}
                    placeholder="Ex: Bomba hidráulica de pistões, Alternador 24V, Mangueira de alta pressão"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Descrição do Problema *
                  </label>
                  <textarea
                    rows={2}
                    value={problemDescription}
                    onChange={(e) => setProblemDescription(e.target.value)}
                    placeholder="Descreva detalhadamente o sintoma apresentado, vazamento, ruído ou pane..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 resize-none"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Diagnóstico Técnico
                  </label>
                  <textarea
                    rows={2}
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="Causa raiz identificada pelo mecânico ou especialista..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 resize-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Serviço Realizado *
                  </label>
                  <textarea
                    rows={2}
                    value={servicePerformed}
                    onChange={(e) => setServicePerformed(e.target.value)}
                    placeholder="Procedimentos executados, regulagens, sangria, testes de bancada..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 resize-none"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Peças Substituídas
                  </label>
                  <input
                    type="text"
                    value={replacedParts}
                    onChange={(e) => setReplacedParts(e.target.value)}
                    placeholder="Ex: 01 Mangueira 1/2, 02 Terminais JIC, 15L Óleo 68"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mecânico / Oficina Responsável *
                  </label>
                  <input
                    type="text"
                    value={mechanic}
                    onChange={(e) => setMechanic(e.target.value)}
                    placeholder="Ex: Carlos Eduardo (Mecânico Chefe)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Observações Gerais
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Informações adicionais, testes de carga, garantias..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 4: EVIDÊNCIAS DA CORRETIVA (UPLOAD DE FOTOS) */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    4. Evidências da Corretiva (Fotos)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Formatos aceitos: JPG, JPEG, PNG, WEBP, PDF. Permite múltiplas fotos simultâneas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Adicionar Fotos</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Photo Thumbnails Preview List / Drop Zone */}
              {photos.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors bg-white dark:bg-slate-800/60 ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500'
                  }`}
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Clique aqui ou arraste para anexar fotos da falha ou serviço realizado
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    As fotos ficarão vinculadas à O.S. e ao histórico da máquina
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {photos.map((p) => {
                      const isPdf = p.dataUrl.startsWith('data:application/pdf') || p.name.toLowerCase().endsWith('.pdf');
                      return (
                        <div
                          key={p.id}
                          className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs aspect-video flex items-center justify-center"
                        >
                          {isPdf ? (
                            <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-rose-50 dark:bg-rose-950/30">
                              <FileText className="w-8 h-8 text-rose-600 mb-1" />
                              <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 line-clamp-1 px-1">
                                {p.name}
                              </span>
                              <span className="text-[8px] text-rose-500 font-bold uppercase mt-0.5">
                                Documento PDF
                              </span>
                            </div>
                          ) : (
                            <img
                              src={p.dataUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          )}

                          {/* Overlay actions */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({ url: p.dataUrl, name: p.name })}
                              className="p-1.5 bg-slate-900/80 text-white rounded-lg hover:bg-slate-800 transition-colors"
                              title={isPdf ? 'Visualizar PDF' : 'Visualizar em tamanho maior'}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(p.id)}
                              className="p-1.5 bg-rose-600/90 text-white rounded-lg hover:bg-rose-700 transition-colors"
                              title="Excluir anexo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1 text-[10px] text-slate-200 truncate">
                            {p.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add more drop target row */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border border-dashed rounded-lg p-2.5 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white/60 dark:bg-slate-800/40 text-slate-500'
                    }`}
                  >
                    <p className="text-[11px] font-medium flex items-center justify-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      Clique aqui ou arraste para anexar fotos da falha ou serviço realizado ({photos.length} anexo{photos.length === 1 ? '' : 's'})
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      As fotos ficarão vinculadas à O.S. e ao histórico da máquina
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{editingRecord ? 'Salvar Alterações' : 'Registrar Corretiva'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Lightbox for preview */}
      {previewPhoto && (
        <PhotoLightboxModal
          isOpen={true}
          onClose={() => setPreviewPhoto(null)}
          photoUrl={previewPhoto.url}
          photoName={previewPhoto.name}
          title={prefix ? `Evidência - ${prefix}` : 'Pré-visualização da Foto'}
        />
      )}
    </>
  );
};
