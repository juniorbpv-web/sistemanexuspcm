import React, { useState, useRef, useEffect } from 'react';
import { Equipment, EquipmentFile, EquipmentFileCategory } from '../types';
import {
  X,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Eye,
  Check,
  AlertCircle,
  Paperclip,
  ExternalLink,
  Calendar,
  FileCheck,
  FolderOpen,
  Info,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import {
  validateEquipmentFile,
  readFileAsDataURL,
  formatFileSize,
  formatDateTimeBR,
  downloadEquipmentFile,
  COMMON_EQUIPMENT_FILE_CATEGORIES,
} from '../services/equipmentFilesService';

interface EquipmentFilesModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveFile: (equipmentId: string, file: EquipmentFile) => Promise<void>;
  onDeleteFile: (equipmentId: string, fileId: string) => Promise<void>;
  initialViewingFileId?: string | null;
}

export const EquipmentFilesModal: React.FC<EquipmentFilesModalProps> = ({
  equipment,
  isOpen,
  onClose,
  onSaveFile,
  onDeleteFile,
  initialViewingFileId,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EquipmentFileCategory>('CRLV');
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [justUploadedFile, setJustUploadedFile] = useState<EquipmentFile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // File Viewer Modal state
  const [viewingFile, setViewingFile] = useState<EquipmentFile | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  // Delete confirmation
  const [fileToDelete, setFileToDelete] = useState<EquipmentFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter category
  const [filterCategory, setFilterCategory] = useState<string>('todos');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ESC key listener to quickly close photo viewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingFile) {
          setViewingFile(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingFile]);

  // Open initial file if requested
  useEffect(() => {
    if (initialViewingFileId && equipment?.files) {
      const target = equipment.files.find((f) => f.id === initialViewingFileId);
      if (target) {
        setImageZoom(1);
        setImageRotation(0);
        setViewingFile(target);
      }
    }
  }, [initialViewingFileId, equipment]);

  if (!isOpen || !equipment) return null;

  const files = equipment.files || [];

  const filteredFiles =
    filterCategory === 'todos'
      ? files
      : files.filter((f) => f.category === filterCategory);

  const handleOpenFile = (file: EquipmentFile) => {
    setImageZoom(1);
    setImageRotation(0);
    setViewingFile(file);
  };

  const handleFileChange = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);
    setJustUploadedFile(null);

    const validation = validateEquipmentFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || 'Arquivo inválido.');
      setSelectedFile(null);
      setPreviewDataUrl(null);
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);
      setSelectedFile(file);
      setPreviewDataUrl(dataUrl);

      // Auto-suggest category if file name hints it
      const lowerName = file.name.toLowerCase();
      if (lowerName.includes('crlv') || lowerName.includes('documento') || lowerName.includes('doc')) {
        setSelectedCategory('CRLV');
      } else if (lowerName.includes('contrato') || lowerName.includes('locacao')) {
        setSelectedCategory('Contrato');
      } else if (lowerName.includes('laudo') || lowerName.includes('art') || lowerName.includes('inspecao')) {
        setSelectedCategory('Laudo');
      } else if (lowerName.includes('manual') || lowerName.includes('ficha')) {
        setSelectedCategory('Manual');
      } else if (lowerName.includes('foto') || lowerName.includes('imagem') || validation.fileType !== 'PDF') {
        setSelectedCategory('Foto');
      } else if (lowerName.includes('manutencao') || lowerName.includes('revisao') || lowerName.includes('garantia')) {
        setSelectedCategory('Manutenção');
      } else if (lowerName.includes('nf') || lowerName.includes('nota') || lowerName.includes('fiscal')) {
        setSelectedCategory('Nota Fiscal');
      }
    } catch (err: any) {
      setUploadError('Erro ao carregar o arquivo: ' + (err.message || 'Tente novamente.'));
      setSelectedFile(null);
      setPreviewDataUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleResetUploadForm = () => {
    setSelectedFile(null);
    setPreviewDataUrl(null);
    setNotes('');
    setSelectedCategory('CRLV');
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !previewDataUrl) {
      setUploadError('Por favor, selecione um arquivo para anexar.');
      return;
    }

    const validation = validateEquipmentFile(selectedFile);
    if (!validation.valid || !validation.fileType) {
      setUploadError(validation.error || 'Formato de arquivo inválido.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const newFile: EquipmentFile = {
        id: 'eqfile_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        equipmentId: equipment.id,
        name: selectedFile.name,
        fileType: validation.fileType,
        mimeType: selectedFile.type || (validation.fileType === 'PDF' ? 'application/pdf' : 'image/jpeg'),
        size: selectedFile.size,
        uploadedAt: new Date().toISOString(),
        category: selectedCategory,
        notes: notes.trim() || undefined,
        dataUrl: previewDataUrl,
      };

      await onSaveFile(equipment.id, newFile);

      setJustUploadedFile(newFile);
      setUploadSuccess(
        validation.fileType !== 'PDF'
          ? `Foto "${selectedFile.name}" adicionada com sucesso!`
          : `Arquivo "${selectedFile.name}" anexado com sucesso!`
      );
      handleResetUploadForm();
    } catch (err: any) {
      setUploadError('Falha ao salvar arquivo: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteFile(equipment.id, fileToDelete.id);
      setFileToDelete(null);
    } catch (err: any) {
      alert('Erro ao excluir arquivo: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryBadgeClass = (category: EquipmentFileCategory) => {
    switch (category) {
      case 'CRLV':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      case 'Contrato':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
      case 'Laudo':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30';
      case 'Manual':
        return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30';
      case 'Foto':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
      case 'Manutenção':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30';
      case 'Nota Fiscal':
        return 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30';
      default:
        return 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30';
    }
  };

  return (
    <>
      {/* Main Files Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
        <div className="bg-white dark:bg-[#181818] border border-[#dcdfe4] dark:border-[#333333] w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#f8fafc] dark:bg-[#141414] border-b border-[#dcdfe4] dark:border-[#2b2b2b]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Paperclip className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-[#111827] dark:text-[#f3f4f6] flex items-center gap-2">
                  <span>Arquivos & Documentos do Equipamento</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono font-bold">
                    {files.length} anexo(s)
                  </span>
                </h2>
                <div className="flex items-center gap-2 text-xs text-[#6b7280] dark:text-[#9ca3af] flex-wrap mt-0.5">
                  <span className="font-semibold text-[#111827] dark:text-white">
                    {equipment.type} {equipment.model || ''}
                  </span>
                  <span>•</span>
                  <span className="font-mono bg-[#f1f5f9] dark:bg-[#262626] px-1.5 py-0.2 rounded border border-[#cbd5e1] dark:border-[#404040] text-[#0f172a] dark:text-[#f8fafc] font-bold">
                    {equipment.plate || equipment.prefix || equipment.code}
                  </span>
                  <span>•</span>
                  <span>Obra: <strong>{equipment.location || 'Não informada'}</strong></span>
                </div>
              </div>
            </div>

            <button
              id="btn-close-equipment-files"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#111827] dark:hover:text-white hover:bg-[#edf2f7] dark:hover:bg-[#262626] transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body with Scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            
            {/* Upload Box Section */}
            <div className="bg-[#f8fafc] dark:bg-[#141414] border border-[#e2e8f0] dark:border-[#2b2b2b] rounded-lg p-3.5 sm:p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#d1d5db] mb-2.5 flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-amber-500" />
                <span>Adicionar Novo Arquivo / Documento</span>
              </h3>

              <form onSubmit={handleUploadSubmit} className="space-y-3">
                {/* Drag and Drop Zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-amber-500 bg-amber-500/10'
                      : selectedFile
                      ? 'border-emerald-500/60 bg-emerald-500/5'
                      : 'border-[#cbd5e1] dark:border-[#333333] hover:border-amber-500/70 bg-white dark:bg-[#1a1a1a]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      {selectedFile.type.includes('pdf') ? (
                        <div className="w-10 h-10 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500 shrink-0">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div className="text-left overflow-hidden">
                        <div className="text-xs font-bold text-[#111827] dark:text-[#f3f4f6] truncate max-w-sm">
                          {selectedFile.name}
                        </div>
                        <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                          {formatFileSize(selectedFile.size)} • Clique para trocar de arquivo
                        </div>
                      </div>
                      <div className="ml-auto">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <Check className="w-3 h-3 stroke-[3]" /> Selecionado
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <UploadCloud className="w-8 h-8 mx-auto text-amber-500/80 stroke-1" />
                      <div className="text-xs font-semibold text-[#111827] dark:text-[#f3f4f6]">
                        Clique aqui para selecionar ou arraste o arquivo
                      </div>
                      <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                        Formatos suportados: <strong>PDF, JPG, JPEG, PNG</strong> (até 25 MB)
                      </div>
                    </div>
                  )}
                </div>

                {/* Form fields: Category & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-1">
                      Categoria do Documento <span className="text-amber-500">*</span>
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value as EquipmentFileCategory)}
                      className="w-full h-8 px-2.5 text-xs bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                    >
                      {COMMON_EQUIPMENT_FILE_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-1">
                      Observação / Detalhes (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: CRLV 2026, Vistoria Obra, Revisão dos 500h..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Error and Success alerts */}
                {uploadError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}
                {uploadSuccess && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-semibold">{uploadSuccess}</span>
                    </div>
                    {justUploadedFile && (
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          id="btn-view-just-uploaded"
                          type="button"
                          onClick={() => handleOpenFile(justUploadedFile)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md shadow-xs transition-all cursor-pointer ${
                            justUploadedFile.fileType !== 'PDF'
                              ? 'bg-amber-500 hover:bg-amber-400 text-black hover:scale-102'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-102'
                          }`}
                        >
                          {justUploadedFile.fileType !== 'PDF' ? (
                            <>
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Ver Foto Agora</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Visualizar Arquivo</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit button */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={handleResetUploadForm}
                      className="h-8 px-3 text-xs font-semibold rounded border border-[#dcdfe4] dark:border-[#333333] text-[#4b5563] dark:text-[#9ca3af] hover:bg-[#edf2f7] dark:hover:bg-[#262626] transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!selectedFile || isUploading}
                    className="inline-flex items-center gap-1.5 h-8 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded transition-colors shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>{isUploading ? 'Salvando...' : 'Salvar Arquivo no Equipamento'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* List of Attached Files */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#d1d5db] flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-amber-500" />
                  <span>Arquivos Cadastrados ({files.length})</span>
                </h3>

                {/* Filter by Category */}
                {files.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[#6b7280] dark:text-[#9ca3af] text-[11px]">Filtrar:</span>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="h-7 px-2 text-xs bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded text-[#4b5563] dark:text-[#9ca3af] focus:outline-none focus:border-amber-500"
                    >
                      <option value="todos">Todos ({files.length})</option>
                      {COMMON_EQUIPMENT_FILE_CATEGORIES.map((cat) => {
                        const count = files.filter((f) => f.category === cat.value).length;
                        if (count === 0) return null;
                        return (
                          <option key={cat.value} value={cat.value}>
                            {cat.label} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {filteredFiles.length === 0 ? (
                <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-[#e2e8f0] dark:border-[#2b2b2b] p-6 text-center space-y-2">
                  <FolderOpen className="w-8 h-8 mx-auto text-[#9ca3af] stroke-1" />
                  <div className="text-xs font-semibold text-[#4b5563] dark:text-[#9ca3af]">
                    {files.length === 0
                      ? 'Nenhum documento ou arquivo anexado a este equipamento ainda.'
                      : 'Nenhum arquivo encontrado nesta categoria.'}
                  </div>
                  <p className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] max-w-sm mx-auto">
                    Utilize a área de upload acima para anexar CRLV, Contrato, Laudos Técnicos, Fotos ou Manuais desta máquina.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      className="bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#2b2b2b] hover:border-amber-500/40 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-2xs"
                    >
                      {/* File details */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          onClick={() => handleOpenFile(file)}
                          className={`w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 cursor-pointer overflow-hidden transition-transform hover:scale-105 ${
                            file.fileType === 'PDF'
                              ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20'
                          }`}
                          title={file.fileType !== 'PDF' ? 'Clique para ver foto ampliada' : 'Clique para visualizar arquivo'}
                        >
                          {file.fileType === 'PDF' ? (
                            <FileText className="w-5 h-5" />
                          ) : file.dataUrl ? (
                            <img
                              src={file.dataUrl}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4
                              onClick={() => handleOpenFile(file)}
                              className="text-xs font-bold text-[#111827] dark:text-[#f3f4f6] truncate cursor-pointer hover:text-amber-500 transition-colors"
                              title={file.name}
                            >
                              {file.name}
                            </h4>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getCategoryBadgeClass(
                                file.category
                              )}`}
                            >
                              {file.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-[#6b7280] dark:text-[#9ca3af] mt-0.5 flex-wrap">
                            <span>{file.fileType}</span>
                            <span>•</span>
                            <span>{formatFileSize(file.size)}</span>
                            <span>•</span>
                            <span>Enviado em {formatDateTimeBR(file.uploadedAt)}</span>
                          </div>

                          {file.notes && (
                            <p className="text-[11px] text-[#4b5563] dark:text-[#d1d5db] mt-1 italic">
                              "{file.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Coluna de Ações: Visualizar / Baixar / Excluir (idêntico a Arquivos / Fiscais) */}
                      <div className="inline-flex items-center justify-center gap-1 shrink-0 self-end sm:self-center">
                        {/* Visualizar */}
                        <button
                          type="button"
                          id={`btn-view-${file.id}`}
                          onClick={() => handleOpenFile(file)}
                          title={file.fileType !== 'PDF' ? 'Visualizar foto ampliada' : 'Visualizar documento'}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 border border-amber-600 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-black" />
                          <span>Visualizar</span>
                        </button>

                        {/* Baixar */}
                        <button
                          type="button"
                          id={`btn-download-${file.id}`}
                          onClick={() => downloadEquipmentFile(file)}
                          title="Baixar arquivo"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 border border-amber-600 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-black" />
                          <span>Baixar</span>
                        </button>

                        {/* Excluir (com confirmação) */}
                        <button
                          type="button"
                          id={`btn-delete-${file.id}`}
                          onClick={() => setFileToDelete(file)}
                          title="Excluir arquivo com confirmação"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-[#f8fafc] dark:bg-[#141414] border-t border-[#dcdfe4] dark:border-[#2b2b2b] flex items-center justify-between">
            <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Arquivos vinculados exclusivamente à máquina <strong>{equipment.code}</strong>.</span>
            </div>
            <button
              onClick={onClose}
              className="h-8 px-4 text-xs font-semibold rounded bg-[#f1f5f9] dark:bg-[#262626] text-[#0f172a] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#333333] border border-[#cbd5e1] dark:border-[#3a3a3a] transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* File Preview Modal */}
      {viewingFile && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingFile(null);
          }}
        >
          <div className="bg-white dark:bg-[#181818] border border-[#333333] w-full max-w-4xl max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f172a] text-white border-b border-[#333333] shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                {viewingFile.fileType === 'PDF' ? (
                  <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span className="text-xs font-bold truncate max-w-xs sm:max-w-md">
                  {viewingFile.name}
                </span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono shrink-0">
                  {viewingFile.category}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {viewingFile.fileType !== 'PDF' && (
                  <div className="hidden sm:flex items-center gap-1 mr-1 border-r border-slate-700 pr-2">
                    <button
                      type="button"
                      onClick={() => setImageZoom((prev) => Math.min(prev + 0.25, 3))}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Aumentar zoom"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageZoom((prev) => Math.max(prev - 0.25, 0.5))}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Diminuir zoom"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageRotation((prev) => (prev + 90) % 360)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Girar imagem 90°"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => downloadEquipmentFile(viewingFile)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold rounded transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingFile(null)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Fechar (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Display */}
            <div className="flex-1 bg-[#0b0f19] dark:bg-[#0a0a0a] overflow-auto flex flex-col items-center justify-center p-3 sm:p-4 min-h-[320px]">
              {viewingFile.fileType === 'PDF' ? (
                <iframe
                  src={viewingFile.dataUrl}
                  title={viewingFile.name}
                  className="w-full h-full min-h-[480px] border-0 rounded-lg bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center w-full max-h-[64vh]">
                  <div className="flex-1 overflow-auto flex items-center justify-center max-w-full">
                    <img
                      src={viewingFile.dataUrl}
                      alt={viewingFile.name}
                      style={{
                        transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                        transition: 'transform 0.15s ease-out',
                      }}
                      className="max-w-full max-h-[54vh] object-contain rounded-lg shadow-2xl border border-white/10"
                    />
                  </div>

                  {/* Opção de Fechar logo abaixo da Foto */}
                  <div className="mt-3.5 flex items-center justify-center gap-2">
                    <button
                      id="btn-close-photo-direct-below"
                      type="button"
                      onClick={() => setViewingFile(null)}
                      className="inline-flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4 stroke-[2.5]" />
                      <span>Fechar Foto</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer / Barra Inferior logo abaixo */}
            <div className="px-4 py-2.5 bg-[#f8fafc] dark:bg-[#141414] border-t border-[#dcdfe4] dark:border-[#2b2b2b] flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-[#6b7280] dark:text-[#9ca3af] truncate pr-2">
                <span className="font-semibold text-[#111827] dark:text-white">{viewingFile.name}</span>
                <span className="mx-1.5">•</span>
                <span>{formatFileSize(viewingFile.size)}</span>
                {viewingFile.notes && (
                  <>
                    <span className="mx-1.5">•</span>
                    <span className="italic">"{viewingFile.notes}"</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadEquipmentFile(viewingFile)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#f1f5f9] dark:bg-[#262626] text-[#0f172a] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#333333] border border-[#cbd5e1] dark:border-[#3a3a3a] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-500" />
                  <span>Baixar {viewingFile.fileType !== 'PDF' ? 'Foto' : 'Arquivo'}</span>
                </button>

                <button
                  id="btn-close-viewing-file-bottom"
                  type="button"
                  onClick={() => setViewingFile(null)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                  <span>Fechar {viewingFile.fileType !== 'PDF' ? 'Foto' : 'Visualização'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] w-full max-w-sm rounded-lg p-5 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-2.5 text-rose-500">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-[#111827] dark:text-[#f3f4f6]">
                Excluir Arquivo Anexado?
              </h4>
            </div>
            <p className="text-xs text-[#4b5563] dark:text-[#9ca3af]">
              Tem certeza que deseja remover o arquivo{' '}
              <strong className="text-[#111827] dark:text-white">"{fileToDelete.name}"</strong> do equipamento{' '}
              <strong>{equipment.code}</strong>? Esta ação não poderá ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="h-8 px-3 text-xs font-semibold rounded border border-[#dcdfe4] dark:border-[#333333] text-[#4b5563] dark:text-[#9ca3af] hover:bg-[#edf2f7] dark:hover:bg-[#262626] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-8 px-3 text-xs font-bold rounded bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
