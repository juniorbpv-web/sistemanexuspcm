import React, { useState, useRef, useEffect } from 'react';
import { EquipmentFile, EquipmentFileCategory } from '../types';
import {
  X,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Download,
  Trash2,
  Eye,
  Check,
  AlertCircle,
  Paperclip,
  FolderOpen,
  Building2,
  Calendar,
  Filter,
} from 'lucide-react';
import {
  validateEquipmentFile,
  readFileAsDataURL,
  formatFileSize,
  formatDateTimeBR,
  downloadEquipmentFile,
} from '../services/equipmentFilesService';

interface ObraFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  obraCode: string;
  obraName?: string;
  files: EquipmentFile[];
  onSaveFile: (file: EquipmentFile) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
}

export const ObraFilesModal: React.FC<ObraFilesModalProps> = ({
  isOpen,
  onClose,
  obraCode,
  obraName,
  files,
  onSaveFile,
  onDeleteFile,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EquipmentFileCategory>('Planilha Excel');
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [filterType, setFilterType] = useState<'todos' | 'PDF' | 'EXCEL'>('todos');

  // File Viewer State
  const [viewingFile, setViewingFile] = useState<EquipmentFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingFile) setViewingFile(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingFile]);

  if (!isOpen) return null;

  // Filter files for this specific Obra
  const obraFiles = files.filter((f) => {
    if (obraCode === 'all') return true;
    return (
      (f.obra_id && f.obra_id.toUpperCase().includes(obraCode.toUpperCase())) ||
      (f.location && f.location.toUpperCase().includes(obraCode.toUpperCase()))
    );
  });

  const displayedFiles = obraFiles.filter((f) => {
    if (filterType === 'todos') return true;
    if (filterType === 'PDF') return f.fileType === 'PDF';
    if (filterType === 'EXCEL') {
      return (
        f.fileType === 'EXCEL' ||
        f.name.toLowerCase().endsWith('.xlsx') ||
        f.name.toLowerCase().endsWith('.xls') ||
        f.name.toLowerCase().endsWith('.csv')
      );
    }
    return true;
  });

  const handleFileChange = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

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

      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv') || validation.fileType === 'EXCEL') {
        setSelectedCategory('Planilha Excel');
      } else {
        setSelectedCategory('Relatório PDF');
      }
    } catch (err: any) {
      setUploadError('Erro ao carregar o arquivo: ' + (err.message || 'Tente novamente.'));
      setSelectedFile(null);
      setPreviewDataUrl(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !previewDataUrl) {
      setUploadError('Selecione um arquivo PDF ou Excel para anexar.');
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
        id: 'obrafile_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        equipmentId: 'obra_' + obraCode,
        obra_id: obraCode,
        location: obraCode,
        name: selectedFile.name,
        fileType: validation.fileType,
        mimeType: selectedFile.type || (validation.fileType === 'PDF' ? 'application/pdf' : 'application/vnd.ms-excel'),
        size: selectedFile.size,
        uploadedAt: new Date().toISOString(),
        category: selectedCategory,
        notes: notes.trim() || undefined,
        dataUrl: previewDataUrl,
      };

      await onSaveFile(newFile);

      setUploadSuccess(`Arquivo "${selectedFile.name}" associado à obra com sucesso!`);
      setSelectedFile(null);
      setPreviewDataUrl(null);
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError('Falha ao salvar arquivo: ' + (err.message || 'Erro'));
    } finally {
      setIsUploading(false);
    }
  };

  const isExcelFile = (f: EquipmentFile) =>
    f.fileType === 'EXCEL' ||
    f.name.toLowerCase().endsWith('.xlsx') ||
    f.name.toLowerCase().endsWith('.xls') ||
    f.name.toLowerCase().endsWith('.csv');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-[#181818] border border-[#dcdfe4] dark:border-[#333333] w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#f8fafc] dark:bg-[#141414] border-b border-[#dcdfe4] dark:border-[#2b2b2b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111827] dark:text-[#f3f4f6] flex items-center gap-2">
                <span>Arquivos & Planilhas da Obra (PDF / Excel)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-mono font-bold">
                  {obraFiles.length} arquivo(s)
                </span>
              </h2>
              <div className="flex items-center gap-2 text-xs text-[#6b7280] dark:text-[#9ca3af] mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  Obra Vinculada: <strong>{obraCode === 'all' ? 'Todas as Obras (Visão Global)' : obraName || obraCode}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#111827] dark:hover:text-white hover:bg-[#edf2f7] dark:hover:bg-[#262626] transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Upload Section */}
          <div className="bg-[#f8fafc] dark:bg-[#141414] border border-[#e2e8f0] dark:border-[#2b2b2b] rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#d1d5db] mb-2.5 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-amber-500" />
              <span>Fazer Upload de Novo Arquivo PDF ou Planilha Excel</span>
            </h3>

            <form onSubmit={handleUploadSubmit} className="space-y-3">
              {/* Drag and Drop Zone */}
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
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
                  accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    {selectedFile.name.endsWith('.pdf') ? (
                      <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <FileSpreadsheet className="w-5 h-5" />
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
                    <UploadCloud className="w-8 h-8 mx-auto text-amber-500 stroke-1" />
                    <div className="text-xs font-semibold text-[#111827] dark:text-[#f3f4f6]">
                      Clique para selecionar ou arraste o arquivo PDF ou Excel
                    </div>
                    <div className="text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
                      Formatos aceitos: <strong>PDF, Excel (.xlsx, .xls) e CSV</strong> (até 25 MB)
                    </div>
                  </div>
                )}
              </div>

              {/* Category and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Categoria do Arquivo
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as EquipmentFileCategory)}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded-lg text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                  >
                    <option value="Planilha Excel">Planilha Excel (.xlsx / .csv)</option>
                    <option value="Relatório PDF">Relatório ou Documento PDF</option>
                    <option value="Contrato">Contrato de Obra / Locação</option>
                    <option value="Laudo">Laudo Técnico / ART</option>
                    <option value="CRLV">Documentação Geral</option>
                    <option value="Nota Fiscal">Nota Fiscal</option>
                    <option value="Outro">Outro Arquivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#9ca3af] mb-1">
                    Observações / Descrição
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Frotas Atualizadas da Obra, Contrato de Pavimentação..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded-lg text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Alerts */}
              {uploadError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              {uploadSuccess && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {/* Action */}
              <div className="flex items-center justify-end gap-2 pt-1">
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewDataUrl(null);
                      setNotes('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="h-8 px-3 text-xs font-semibold rounded-lg border border-[#dcdfe4] dark:border-[#333333] text-[#4b5563] dark:text-[#9ca3af] hover:bg-[#edf2f7] dark:hover:bg-[#262626] cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="inline-flex items-center gap-1.5 h-8 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{isUploading ? 'Enviando...' : 'Salvar Arquivo na Obra'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Files */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4b5563] dark:text-[#d1d5db] flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-amber-500" />
                <span>Arquivos Enviados desta Obra ({obraFiles.length})</span>
              </h3>

              {obraFiles.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[#6b7280] dark:text-[#9ca3af] text-[11px]">Tipo:</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="h-7 px-2 text-xs bg-white dark:bg-[#1a1a1a] border border-[#dcdfe4] dark:border-[#333333] rounded-lg text-[#4b5563] dark:text-[#9ca3af] focus:outline-none focus:border-amber-500"
                  >
                    <option value="todos">Todos ({obraFiles.length})</option>
                    <option value="PDF">Apenas PDF</option>
                    <option value="EXCEL">Apenas Excel / Planilhas</option>
                  </select>
                </div>
              )}
            </div>

            {displayedFiles.length === 0 ? (
              <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-[#e2e8f0] dark:border-[#2b2b2b] p-6 text-center space-y-2">
                <FolderOpen className="w-8 h-8 mx-auto text-[#9ca3af] stroke-1" />
                <div className="text-xs font-semibold text-[#4b5563] dark:text-[#9ca3af]">
                  Nenhum arquivo PDF ou Excel anexado a esta obra ainda.
                </div>
                <p className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] max-w-sm mx-auto">
                  Envie relatórios em PDF, contratos ou planilhas Excel (.xlsx) na área de upload acima.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedFiles.map((file) => {
                  const isExcel = isExcelFile(file);
                  return (
                    <div
                      key={file.id}
                      className="bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#2b2b2b] hover:border-amber-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-2xs"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                            isExcel
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                          }`}
                        >
                          {isExcel ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[#111827] dark:text-[#f3f4f6] truncate">
                              {file.name}
                            </span>
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-amber-500 text-black border-amber-600"
                            >
                              {isExcel ? 'Excel' : 'PDF'}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
                              {file.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-[#6b7280] dark:text-[#9ca3af] mt-0.5 flex-wrap">
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

                      <div className="inline-flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => downloadEquipmentFile(file)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 text-black hover:bg-amber-400 border border-amber-600 transition-colors cursor-pointer shadow-2xs"
                          title="Baixar arquivo"
                        >
                          <Download className="w-3.5 h-3.5 text-black" />
                          <span>Baixar</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteFile(file.id);
                          }}
                          className="inline-flex items-center gap-1 p-1 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Excluir arquivo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#f8fafc] dark:bg-[#141414] border-t border-[#dcdfe4] dark:border-[#2b2b2b] flex items-center justify-between text-xs text-[#6b7280] dark:text-[#9ca3af]">
          <span>Arquivos salvos ficam sincronizados em nuvem e disponíveis para a obra.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-bold bg-[#edf2f7] dark:bg-[#262626] text-[#111827] dark:text-[#f3f4f6] hover:bg-[#e2e8f0] cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
