import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Server,
  Zap,
  X,
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  seedSupabaseInitialData,
  SUPABASE_SETUP_SQL,
} from '../services/supabaseService';

interface SupabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
  addToast: (type: 'success' | 'error' | 'info' | 'warning', message: string, title?: string) => void;
}

export const SupabaseConnectionModal: React.FC<SupabaseConnectionModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
  addToast,
}) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [isEnv, setIsEnv] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; tableReady: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url);
      setKey(config.key);
      setIsEnv(config.isEnv);
      setTestResult(null);

      if (config.url && config.key) {
        testSupabaseConnection().then(setTestResult);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!url.trim() || !key.trim()) {
      addToast('warning', 'Informe o Project URL e a Anon Key do Supabase.', 'Campos Obrigatórios');
      return;
    }
    setTesting(true);
    setTestResult(null);
    saveSupabaseConfig(url, key);
    const res = await testSupabaseConnection();
    setTestResult(res);
    setTesting(false);
    if (res.success) {
      addToast('success', res.message, 'Conexão Supabase');
    } else {
      addToast('error', res.message, 'Falha de Conexão');
    }
  };

  const handleSave = async () => {
    if (!url.trim() || !key.trim()) {
      addToast('warning', 'Informe a URL e a Chave do Supabase.', 'Campos Vazios');
      return;
    }
    const saved = saveSupabaseConfig(url, key);
    if (saved) {
      addToast('success', 'Configurações do Supabase salvas com sucesso!', 'Supabase Conectado');
      if (onConfigChanged) onConfigChanged();
      handleTest();
    }
  };

  const handleSyncBaseline = async () => {
    setSyncing(true);
    try {
      const res = await seedSupabaseInitialData(false);
      if (res.success) {
        addToast('success', res.message, 'Sincronização Supabase');
        if (onConfigChanged) onConfigChanged();
      } else {
        addToast('error', res.message, 'Erro de Sincronização');
      }
    } catch (err: any) {
      addToast('error', `Falha ao sincronizar: ${err?.message || err}`, 'Erro');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopiedSql(true);
    addToast('info', 'Script SQL copiado para a área de transferência!', 'SQL Copiado');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#133863] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/20 text-[#20bdae] border border-teal-500/30">
              <Database className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                Compartilhamento em Nuvem (Supabase / Hostinger)
              </h2>
              <p className="text-xs text-slate-200">
                Permite sincronizar equipamentos, cadastros e apontamentos em tempo real entre computadores.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-sm">
          {/* Status Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs">
                <span className="font-bold">{testResult.success ? 'Conexão Estabelecida: ' : 'Não Conectado: '}</span>
                <span>{testResult.message}</span>
                {testResult.success && !testResult.tableReady && (
                  <p className="mt-1.5 font-semibold text-amber-800 dark:text-amber-300">
                    ⚠️ Execute o script SQL abaixo no painel do Supabase para criar a tabela de dados.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Project URL do Supabase (ex: https://xxxx.supabase.co)
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzproject.supabase.co"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#20bdae]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Anon / Public API Key do Supabase
              </label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#20bdae]"
              />
            </div>

            {isEnv && (
              <p className="text-[11px] text-teal-600 dark:text-teal-400 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Credenciais configuradas via variáveis de ambiente no servidor (.env).
              </p>
            )}
          </div>

          {/* Actions buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-zinc-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-[#20bdae] hover:bg-[#1ca699] text-white shadow-xs transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Salvar & Ativar Supabase</span>
            </button>

            {testResult?.success && testResult?.tableReady && (
              <button
                type="button"
                onClick={handleSyncBaseline}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
                title="Envia frotas, histórico de saídas e entradas para o Supabase sem sobrescrever registros novos"
              >
                <Server className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Sincronizando...' : 'Sincronizar Dados Base Agora'}</span>
              </button>
            )}
          </div>

          {/* Collapsible SQL Script Section */}
          <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                1. Passo: Criação da Tabela no Supabase (1 Clique)
              </span>
              <button
                type="button"
                onClick={() => setShowSql(!showSql)}
                className="text-xs font-semibold text-[#20bdae] hover:underline cursor-pointer"
              >
                {showSql ? 'Ocultar Script SQL' : 'Exibir Script SQL'}
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
              Para permitir que o app guarde os dados em tempo real, abra seu{' '}
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 hover:underline inline-flex items-center gap-0.5 font-semibold"
              >
                painel Supabase <ExternalLink className="w-3 h-3" />
              </a>
              , vá em <strong>SQL Editor</strong>, cole o código abaixo e clique em <strong>Run</strong>.
            </p>

            {showSql && (
              <div className="relative rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-900 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold transition-colors cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
                </button>
                <pre className="pr-20 whitespace-pre-wrap">{SUPABASE_SETUP_SQL}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Preserva 100% dos dados salvos no computador</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-800 dark:text-white font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
