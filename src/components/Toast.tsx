import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all transform translate-y-0 ${
        isSuccess
          ? 'bg-emerald-900/95 text-emerald-50 border-emerald-500/50 shadow-emerald-950/40'
          : isError
          ? 'bg-rose-900/95 text-rose-50 border-rose-500/50 shadow-rose-950/40'
          : 'bg-slate-900/95 text-slate-50 border-slate-700 shadow-black/40'
      }`}
    >
      <div className="shrink-0 mt-0.5">
        {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
        {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
        {!isSuccess && !isError && <Info className="w-5 h-5 text-amber-400" />}
      </div>

      <div className="flex-1 text-sm">
        {toast.title && <div className="font-semibold">{toast.title}</div>}
        <div className="opacity-95 font-medium leading-relaxed">{toast.message}</div>
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-1 text-white/70 hover:text-white rounded hover:bg-white/10 transition-colors"
        aria-label="Fechar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
