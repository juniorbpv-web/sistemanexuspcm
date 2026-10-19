import React, { useState, useRef } from 'react';
import { FuelInvoiceFile, UserRole } from '../types';
import {
  validateInvoiceFile,
  readFileAsDataURL,
  formatFileSize,
  formatDateTimeBR,
  triggerFileDownload,
} from '../services/fuelFilesService';
import {
  FileText,
  Plus,
  UploadCloud,
  Eye,
  Download,
  Trash2,
  X,
  Search,
  AlertTriangle,
  FileCheck,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Clock,
  HardDrive,
  Calendar,
  FileImage,
  Sparkles,
} from 'lucide-react';

interface FuelInvoicesTabProps {
  files: FuelInvoiceFile[];
  onAddFile: (file: FuelInvoiceFile) => Promise<void> | void;
  onDeleteFile: (id: string) => Promise<void> | void;
  userRole?: UserRole;
}

export const FuelInvoicesTab: React.FC<FuelInvoicesTabProps> = ({
  files,
  onAddFile,
  onDeleteFile,
  userRole = 'user',
}) => {
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PDF' | 'IMAGE'>('ALL');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal de Adicionar com Detalhes (opcional antes de salvar)
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    name: string;
    fileType: 'PDF' | 'JPEG' | 'JPG';
    size: number;
    notes: string;
    dataUrl: string;
  } | null>(null);

  // Viewer Modal state
  const [viewingFile, setViewingFile] = useState<FuelInvoiceFile | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  // Delete Confirmation Modal
  const [fileToDelete, setFileToDelete] = useState<FuelInvoiceFile | null>(null);

  // File selection / drop handler
  const handleFileProcess = async (selectedFile: File) => {
    setUploadError(null);

    // Validate format: only PDF, JPG, JPEG
    const validation = validateInvoiceFile(selectedFile);
    if (!validation.valid || !validation.fileType) {
      setUploadError(
        validation.error ||
          'Formato de arquivo inválido. O sistema aceita exclusivamente arquivos nos formatos PDF, JPG ou JPEG.'
      );
      return;
    }

    try {
      setIsUploading(true);
      const dataUrl = await readFileAsDataURL(selectedFile);

      setPendingFile({
        file: selectedFile,
        name: selectedFile.name,
        fileType: validation.fileType,
        size: selectedFile.size,
        notes: '',
        dataUrl,
      });
    } catch (err) {
      console.error('Erro ao processar arquivo:', err);
      setUploadError('Ocorreu um erro ao carregar o arquivo. Por favor, tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
    // reset input so the same file can be chosen again if needed
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Confirm save pending file
  const handleConfirmSave = async () => {
    if (!pendingFile) return;

    const now = new Date();
    const newFile: FuelInvoiceFile = {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: pendingFile.name.trim() || pendingFile.file.name,
      fileType: pendingFile.fileType,
      mimeType: pendingFile.file.type || (pendingFile.fileType === 'PDF' ? 'application/pdf' : 'image/jpeg'),
      size: pendingFile.size,
      uploadedAt: now.toISOString(),
      formattedDate: formatDateTimeBR(now),
      dataUrl: pendingFile.dataUrl,
      notes: pendingFile.notes.trim() || undefined,
    };

    try {
      await onAddFile(newFile);
      setPendingFile(null);
      setUploadError(null);
    } catch (err) {
      console.error('Erro ao salvar arquivo:', err);
      setUploadError('Erro ao gravar o arquivo. Tente novamente.');
    }
  };

  // Confirm delete file
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    try {
      await onDeleteFile(fileToDelete.id);
      setFileToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir arquivo:', err);
    }
  };

  // Open viewer modal
  const handleOpenViewer = (file: FuelInvoiceFile) => {
    setImageZoom(1);
    setImageRotation(0);
    setViewingFile(file);
  };

  // Filtered files list
  const filteredFiles = files.filter((f) => {
    // Search query
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !query ||
      f.name.toLowerCase().includes(query) ||
      f.formattedDate.toLowerCase().includes(query) ||
      (f.notes && f.notes.toLowerCase().includes(query)) ||
      f.fileType.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    // Type filter
    if (filterType === 'PDF') return f.fileType === 'PDF';
    if (filterType === 'IMAGE') return f.fileType === 'JPEG' || f.fileType === 'JPG';

    return true;
  });

  // Calculate statistics
  const totalCount = files.length;
  const pdfCount = files.filter((f) => f.fileType === 'PDF').length;
  const imageCount = files.filter((f) => f.fileType === 'JPEG' || f.fileType === 'JPG').length;
  const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

  return (
    <div className="space-y-4 animate-in fade-in duration-200 w-full min-w-0">
      {/* Hidden File Input for .pdf, .jpg, .jpeg */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg,image/jpg"
        onChange={handleInputChange}
        className="hidden"
        id="file-upload-input"
      />

      {/* Header & Main Call-To-Action Card */}
      <div className="bg-white dark:bg-[#181818] rounded-xl p-4 sm:p-5 border border-[#dcdfe4] dark:border-[#2f2f2f] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <FileText className="w-4 h-4" />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-[#111827] dark:text-[#f3f4f6]">
                Arquivos / Notas Fiscais
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500 text-black font-bold border border-amber-600 shadow-2xs">
                Recebimento de Combustível
              </span>
            </div>
            <p className="text-xs text-[#4b5563] dark:text-[#9ca3af]">
              Armazenamento seguro e organização de notas fiscais, faturas e comprovantes de diesel (formatos aceitos: <strong>PDF</strong> e <strong>JPEG/JPG</strong>).
            </p>
          </div>

          {/* Botão Bem Visível: ➕ Adicionar Arquivo */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-add-invoice-file"
              onClick={() => {
                setUploadError(null);
                fileInputRef.current?.click();
              }}
              disabled={isUploading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg hover:scale-[1.01] cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>➕ Adicionar Arquivo</span>
            </button>
          </div>
        </div>

        {/* Mensagem de Erro de Validação de Formato */}
        {uploadError && (
          <div
            id="invoice-upload-error-alert"
            className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start justify-between gap-2 animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{uploadError}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="p-0.5 rounded text-rose-500 hover:text-rose-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Stats Banner - Destaque em Laranja e Letras em Preto */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3.5 border-t border-[#eaecef] dark:border-[#2a2a2a]">
          <div className="p-2.5 rounded-lg bg-amber-500 text-black border border-amber-600 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-black/80">
              <FileCheck className="w-3.5 h-3.5 text-black" />
              <span>Total de Arquivos</span>
            </div>
            <p className="text-base sm:text-lg font-mono font-black text-black mt-0.5">
              {totalCount}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-500 text-black border border-amber-600 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-black/80">
              <FileText className="w-3.5 h-3.5 text-black" />
              <span>Documentos PDF</span>
            </div>
            <p className="text-base sm:text-lg font-mono font-black text-black mt-0.5">
              {pdfCount}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-500 text-black border border-amber-600 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-black/80">
              <FileImage className="w-3.5 h-3.5 text-black" />
              <span>Imagens JPEG / JPG</span>
            </div>
            <p className="text-base sm:text-lg font-mono font-black text-black mt-0.5">
              {imageCount}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-500 text-black border border-amber-600 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-black/80">
              <HardDrive className="w-3.5 h-3.5 text-black" />
              <span>Espaço Ocupado</span>
            </div>
            <p className="text-base sm:text-lg font-mono font-black text-black mt-0.5">
              {formatFileSize(totalBytes)}
            </p>
          </div>
        </div>
      </div>

      {/* Drag & Drop Quick Area (Dropzone) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 sm:p-5 text-center transition-all cursor-pointer ${
          isDragOver
            ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 scale-[1.005]'
            : 'border-[#dcdfe4] dark:border-[#333333] hover:border-amber-500/60 bg-white/50 dark:bg-[#181818]/50 hover:bg-[#fbfbfb] dark:hover:bg-[#1e1e1e]'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="p-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-semibold text-[#111827] dark:text-[#f3f4f6]">
              Arraste e solte sua Nota Fiscal aqui, ou{' '}
              <span className="text-amber-600 dark:text-amber-400 underline underline-offset-2">
                clique para navegar
              </span>
            </p>
            <p className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] mt-0.5">
              Formatos aceitos: <strong>PDF, JPG, JPEG</strong> • Armazenamento persistente e seguro
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-[#181818] rounded-xl p-3 border border-[#dcdfe4] dark:border-[#2f2f2f] flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="text"
            placeholder="Pesquisar por nome ou data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6] focus:border-amber-500 focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Badges - Destaque em Laranja e Letras em Preto */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer border ${
              filterType === 'ALL'
                ? 'bg-amber-500 text-black border-amber-600 shadow-2xs'
                : 'bg-amber-500/20 text-black dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            Todos ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('PDF')}
            className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer border ${
              filterType === 'PDF'
                ? 'bg-amber-500 text-black border-amber-600 shadow-2xs'
                : 'bg-amber-500/20 text-black dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            PDF ({pdfCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('IMAGE')}
            className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer border ${
              filterType === 'IMAGE'
                ? 'bg-amber-500 text-black border-amber-600 shadow-2xs'
                : 'bg-amber-500/20 text-black dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            JPEG / JPG ({imageCount})
          </button>
        </div>
      </div>

      {/* Main Files Table matching the User's exact prompt structure:
          Arquivo | Tipo | Data de Envio | Ações
      */}
      <div className="bg-white dark:bg-[#181818] rounded-xl border border-[#dcdfe4] dark:border-[#2f2f2f] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#f8fafc] dark:bg-[#202020] border-b border-[#eaecef] dark:border-[#2f2f2f] text-[11px] font-bold text-[#4b5563] dark:text-[#9ca3af] uppercase tracking-wider">
              <tr>
                <th className="p-3">Arquivo</th>
                <th className="p-3 w-28 text-center">Tipo</th>
                <th className="p-3 w-40 text-center">Data de Envio</th>
                <th className="p-3 w-44 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaecef] dark:divide-[#262626]">
              {filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[#6b7280] dark:text-[#9ca3af]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold">
                        {files.length === 0
                          ? 'Esta obra ainda não possui dados cadastrados.'
                          : 'Nenhum registro encontrado.'}
                      </p>
                      <p className="text-[11px] text-[#9ca3af]">
                        {files.length === 0
                          ? 'Nenhum registro encontrado. Faça upload de notas fiscais e comprovantes desta obra.'
                          : 'Nenhum arquivo encontrado com o filtro atual.'}
                      </p>
                      {files.length === 0 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-1 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30 text-xs"
                        >
                          ➕ Clique aqui para adicionar sua primeira Nota Fiscal
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => {
                  const isPdf = file.fileType === 'PDF';
                  return (
                    <tr
                      key={file.id}
                      className="hover:bg-[#f8fafc] dark:hover:bg-[#202020]/70 transition-colors"
                    >
                      {/* Coluna 1: Arquivo */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="p-2 rounded-lg shrink-0 bg-amber-500 text-black border border-amber-600 shadow-2xs"
                          >
                            {isPdf ? (
                              <FileText className="w-4 h-4 text-black" />
                            ) : (
                              <FileImage className="w-4 h-4 text-black" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="font-bold text-[#111827] dark:text-[#f3f4f6] truncate hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                              onClick={() => handleOpenViewer(file)}
                              title={`Abrir e visualizar ${file.name}`}
                            >
                              {file.name}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-[#6b7280] dark:text-[#9ca3af] mt-0.5">
                              <span>{formatFileSize(file.size)}</span>
                              {file.notes && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[220px]" title={file.notes}>
                                    {file.notes}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Coluna 2: Tipo */}
                      <td className="p-3 text-center">
                        <span
                          className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide border bg-amber-500 text-black border-amber-600 shadow-2xs"
                        >
                          {file.fileType}
                        </span>
                      </td>

                      {/* Coluna 3: Data de Envio */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#374151] dark:text-[#d1d5db]">
                          <Calendar className="w-3 h-3 text-[#9ca3af]" />
                          <span>{file.formattedDate}</span>
                        </div>
                      </td>

                      {/* Coluna 4: Ações (Visualizar / Baixar / Excluir) */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {/* Visualizar */}
                          <button
                            type="button"
                            id={`btn-view-file-${file.id}`}
                            onClick={() => handleOpenViewer(file)}
                            title="Visualizar arquivo"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 border border-amber-600 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-black" />
                            <span className="hidden sm:inline">Visualizar</span>
                          </button>

                          {/* Baixar */}
                          <button
                            type="button"
                            id={`btn-download-file-${file.id}`}
                            onClick={() => triggerFileDownload(file)}
                            title="Baixar arquivo"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 border border-amber-600 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5 text-black" />
                            <span className="hidden sm:inline">Baixar</span>
                          </button>

                          {/* Excluir (com confirmação) */}
                          <button
                            type="button"
                            id={`btn-delete-file-${file.id}`}
                            onClick={() => setFileToDelete(file)}
                            title="Excluir arquivo com confirmação"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação de Upload / Nome do Arquivo */}
      {pendingFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl max-w-md w-full p-5 border border-amber-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaecef] dark:border-[#2f2f2f]">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-[#111827] dark:text-[#f3f4f6]">
                  Adicionar Nota Fiscal / Comprovante
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="p-1 rounded text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                  Nome do Arquivo *
                </label>
                <input
                  type="text"
                  required
                  value={pendingFile.name}
                  onChange={(e) => setPendingFile({ ...pendingFile, name: e.target.value })}
                  placeholder="Ex: NF_001.pdf"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6] focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 p-2.5 rounded-lg bg-[#f8fafc] dark:bg-[#252525] border border-[#eaecef] dark:border-[#333333] text-xs">
                <div>
                  <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[11px]">Tipo:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {pendingFile.fileType}
                  </span>
                </div>
                <div>
                  <span className="text-[#6b7280] dark:text-[#9ca3af] block text-[11px]">Tamanho:</span>
                  <span className="font-mono font-bold text-[#111827] dark:text-[#f3f4f6]">
                    {formatFileSize(pendingFile.size)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4b5563] dark:text-[#9ca3af] mb-1">
                  Observações / Identificação da Carga (Opcional)
                </label>
                <input
                  type="text"
                  value={pendingFile.notes}
                  onChange={(e) => setPendingFile({ ...pendingFile, notes: e.target.value })}
                  placeholder="Ex: Carga 5.000 L - Tanque Central - Distribuidora X"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] text-[#111827] dark:text-[#f3f4f6] focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#eaecef] dark:border-[#2f2f2f]">
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="px-3.5 py-1.5 rounded-lg border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-save-file"
                onClick={handleConfirmSave}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors shadow-xs"
              >
                Salvar Arquivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização de Arquivo (In-System Viewer) */}
      {viewingFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl max-w-4xl w-full h-[90vh] flex flex-col border border-neutral-300 dark:border-neutral-700 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#f8fafc] dark:bg-[#252525] border-b border-[#eaecef] dark:border-[#2f2f2f] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {viewingFile.fileType === 'PDF' ? (
                  <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                ) : (
                  <FileImage className="w-4 h-4 text-blue-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-[#111827] dark:text-[#f3f4f6] truncate">
                    {viewingFile.name}
                  </h3>
                  <p className="text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                    Enviado em {viewingFile.formattedDate} • {formatFileSize(viewingFile.size)}
                  </p>
                </div>
              </div>

              {/* Viewer Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Image zoom & rotate controls */}
                {viewingFile.fileType !== 'PDF' && (
                  <div className="hidden xs:flex items-center gap-1 mr-2 px-2 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-800">
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.max(0.5, z - 0.25))}
                      title="Diminuir Zoom"
                      className="p-1 rounded text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono w-9 text-center">
                      {Math.round(imageZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.min(3, z + 0.25))}
                      title="Aumentar Zoom"
                      className="p-1 rounded text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageRotation((r) => (r + 90) % 360)}
                      title="Girar Imagem"
                      className="p-1 rounded text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white ml-1 border-l border-neutral-300 dark:border-neutral-700 pl-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Download */}
                <button
                  type="button"
                  onClick={() => triggerFileDownload(viewingFile)}
                  title="Baixar arquivo para o computador"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 text-black transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Baixar</span>
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={() => setViewingFile(null)}
                  className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body / Viewer Content */}
            <div className="flex-1 bg-neutral-900 overflow-auto flex items-center justify-center p-2 relative">
              {viewingFile.fileType === 'PDF' ? (
                viewingFile.dataUrl ? (
                  <iframe
                    src={viewingFile.dataUrl}
                    title={viewingFile.name}
                    className="w-full h-full rounded border-0 bg-white"
                  />
                ) : (
                  <div className="text-center p-6 text-white space-y-3">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                    <p className="text-sm">Pré-visualização não disponível diretamente no navegador.</p>
                    <button
                      type="button"
                      onClick={() => triggerFileDownload(viewingFile)}
                      className="px-4 py-2 rounded bg-amber-500 text-black font-bold text-xs"
                    >
                      Baixar Arquivo PDF
                    </button>
                  </div>
                )
              ) : viewingFile.dataUrl ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                  <img
                    src={viewingFile.dataUrl}
                    alt={viewingFile.name}
                    style={{
                      transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                      transition: 'transform 0.15s ease-out',
                      maxHeight: '100%',
                      maxWidth: '100%',
                      objectFit: 'contain',
                    }}
                    className="rounded shadow-lg"
                  />
                </div>
              ) : (
                <div className="text-center p-6 text-white space-y-3">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="text-sm">Não foi possível carregar a imagem.</p>
                </div>
              )}
            </div>

            {/* Modal Footer com Opção Fechar Abaixo */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#f8fafc] dark:bg-[#252525] border-t border-[#eaecef] dark:border-[#2f2f2f] shrink-0">
              <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] truncate pr-2">
                <span className="font-semibold text-[#111827] dark:text-[#f3f4f6]">{viewingFile.name}</span>
                <span className="hidden sm:inline"> • {viewingFile.fileType} • {formatFileSize(viewingFile.size)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerFileDownload(viewingFile)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[#111827] dark:text-[#f3f4f6] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Arquivo</span>
                </button>
                <button
                  type="button"
                  id="btn-close-invoice-viewer-bottom"
                  onClick={() => setViewingFile(null)}
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

      {/* Modal de Confirmação de Exclusão */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl max-w-sm w-full p-5 border border-rose-500/40 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#111827] dark:text-[#f3f4f6]">
                  Excluir Arquivo?
                </h3>
                <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                  Esta ação não poderá ser desfeita.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
              <p className="font-bold text-[#111827] dark:text-[#f3f4f6] truncate">
                {fileToDelete.name}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-[#6b7280] dark:text-[#9ca3af] mt-1">
                <span>Tipo: {fileToDelete.fileType}</span>
                <span>•</span>
                <span>Data: {fileToDelete.formattedDate}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#eaecef] dark:border-[#2f2f2f]">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-3 py-1.5 rounded-lg border border-[#dcdfe4] dark:border-[#333333] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-delete-file"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-xs"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
