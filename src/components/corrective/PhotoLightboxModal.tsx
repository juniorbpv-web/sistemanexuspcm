import React, { useEffect, useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, Image as ImageIcon, FileText, ExternalLink } from 'lucide-react';
import { getCorrectivePhotoFromIndexedDB } from '../../services/correctiveFilesService';

interface PhotoLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string;
  photoName?: string;
  title?: string;
  subtitle?: string;
  photoId?: string;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  isOpen,
  onClose,
  photoUrl,
  photoName,
  title,
  subtitle,
  photoId,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [resolvedUrl, setResolvedUrl] = useState<string>(photoUrl);

  useEffect(() => {
    setResolvedUrl(photoUrl);
    if (!photoUrl && photoId) {
      getCorrectivePhotoFromIndexedDB(photoId)
        .then((cached) => {
          if (cached?.dataUrl) {
            setResolvedUrl(cached.dataUrl);
          }
        })
        .catch(() => {});
    }
  }, [photoUrl, photoId]);

  const isPdf =
    (resolvedUrl && resolvedUrl.startsWith('data:application/pdf')) ||
    (photoName ? photoName.toLowerCase().endsWith('.pdf') : false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setZoomLevel(1);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !resolvedUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = resolvedUrl;
    a.download = photoName || (isPdf ? 'evidencia_corretiva.pdf' : 'evidencia_corretiva.jpg');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenInNewTab = () => {
    if (isPdf) {
      const win = window.open();
      if (win) {
        win.document.write(
          `<iframe src="${resolvedUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
        );
      }
    }
  };

  return (
    <div
      id="photo-lightbox-backdrop"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div
        className="w-full max-w-5xl flex items-center justify-between pb-3 text-white border-b border-slate-700/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isPdf ? 'bg-rose-950/80 text-rose-400' : 'bg-slate-800 text-emerald-400'}`}>
            {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-base text-slate-100">{title || photoName || (isPdf ? 'Documento PDF' : 'Evidência Fotográfica')}</h3>
            {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : (isPdf && <p className="text-xs text-rose-300 font-mono">Documento Técnico PDF</p>)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isPdf && (
            <>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                title="Reduzir Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-400 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded-lg transition-colors ml-1"
            title={isPdf ? 'Baixar Arquivo PDF' : 'Baixar Foto'}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-400 rounded-lg transition-colors ml-2"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div
        className="flex-1 w-full max-w-5xl flex items-center justify-center overflow-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {isPdf ? (
          <div className="w-full h-[80vh] flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-700">
            <iframe
              src={resolvedUrl}
              title={photoName || 'Documento PDF'}
              className="w-full h-full border-0"
            />
          </div>
        ) : (
          <img
            src={resolvedUrl}
            alt={photoName || 'Foto da manutenção'}
            className="max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel})` }}
          />
        )}
      </div>
    </div>
  );
};
