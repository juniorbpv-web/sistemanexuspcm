import React, { useState, useEffect } from 'react';
import {
  Mail,
  X,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Send,
  Loader2,
  LogOut,
  Building2,
  Truck,
  Fuel,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Sparkles,
  Download,
} from 'lucide-react';
import {
  Equipment,
  FuelDispense,
  FuelEntry,
  AppProject,
  UserRole,
  GmailIntegrationConfig,
} from '../types';
import {
  loadGmailConfig,
  saveGmailConfig,
  signInWithGoogleGmail,
  disconnectGmail,
  getGmailAccessToken,
  getConnectedGoogleUser,
  initGmailAuth,
  sendDailyFleetReport,
  compileFleetReportData,
  generateFleetReportExcelBuffer,
  generateFleetReportPdfBuffer,
  DEFAULT_GMAIL_CONFIG,
} from '../services/gmailService';
import { formatLiters, formatDateBR, getTodayDateString } from '../utils/storage';

interface GmailIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: UserRole;
  equipments: Equipment[];
  dispenses: FuelDispense[];
  entries: FuelEntry[];
  projects?: AppProject[];
  onShowToast?: (type: 'success' | 'error' | 'info' | 'warning', message: string, title?: string) => void;
}

export const GmailIntegrationModal: React.FC<GmailIntegrationModalProps> = ({
  isOpen,
  onClose,
  userRole,
  equipments,
  dispenses,
  entries,
  projects,
  onShowToast,
}) => {
  const isAdmin = userRole === 'admin';

  const [config, setConfig] = useState<GmailIntegrationConfig>(DEFAULT_GMAIL_CONFIG);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailInputError, setEmailInputError] = useState<string | null>(null);

  // Auth state
  const [connectedUserEmail, setConnectedUserEmail] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingManual, setIsSendingManual] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Active tab inside modal: 'config' | 'preview'
  const [modalTab, setModalTab] = useState<'config' | 'preview'>('config');

  // Load config and listen to Google Auth on open
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    loadGmailConfig().then((loaded) => {
      if (mounted) {
        setConfig(loaded);
      }
    });

    const token = getGmailAccessToken();
    const user = getConnectedGoogleUser();
    if (token && user) {
      setHasToken(true);
      setConnectedUserEmail(user.email);
    }

    const unsub = initGmailAuth(
      (user, tok) => {
        if (mounted) {
          setHasToken(true);
          setConnectedUserEmail(user.email);
        }
      },
      () => {
        if (mounted) {
          const t = getGmailAccessToken();
          setHasToken(!!t);
          const u = getConnectedGoogleUser();
          setConnectedUserEmail(u?.email || null);
        }
      }
    );

    return () => {
      mounted = false;
      unsub();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Strict RBAC: Only Admin can access
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
            Acesso Restrito ao Administrador
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Apenas usuários com perfil de Administrador podem visualizar, alterar e gerenciar a integração com o Gmail e envio de relatórios matutinos da frota.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  // Pre-compiled Report Preview
  const reportData = compileFleetReportData(equipments, entries, dispenses, projects);

  // Validate and add email
  const handleAddEmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEmailInputError(null);

    const email = newEmailInput.trim().toLowerCase();
    if (!email) return;

    // Email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailInputError('Informe um endereço de e-mail válido.');
      return;
    }

    if (
      email === config.primaryEmail.toLowerCase() ||
      config.additionalEmails.some((e) => e.toLowerCase() === email)
    ) {
      setEmailInputError('Este e-mail já está adicionado na lista.');
      return;
    }

    const updated = {
      ...config,
      additionalEmails: [...config.additionalEmails, email],
    };
    setConfig(updated);
    setNewEmailInput('');
    saveGmailConfig(updated).catch(() => {});
    if (onShowToast) onShowToast('success', `E-mail ${email} adicionado aos destinatários.`);
  };

  const handleRemoveEmail = (index: number) => {
    const updatedEmails = config.additionalEmails.filter((_, idx) => idx !== index);
    const updated = {
      ...config,
      additionalEmails: updatedEmails,
    };
    setConfig(updated);
    saveGmailConfig(updated).catch(() => {});
    if (onShowToast) onShowToast('info', 'E-mail removido da lista de destinatários.');
  };

  const handleConnectGoogle = async () => {
    setIsAuthenticating(true);
    try {
      const res = await signInWithGoogleGmail();
      setHasToken(true);
      setConnectedUserEmail(res.user.email);
      if (onShowToast) {
        onShowToast(
          'success',
          `Conta ${res.user.email} autorizada para envio de e-mails via Gmail.`,
          'Gmail Conectado'
        );
      }
    } catch (err: any) {
      const msg = err?.message || 'Falha ao autenticar com a conta Google.';
      if (onShowToast) onShowToast('error', msg, 'Erro de Autenticação');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDisconnectGoogle = () => {
    disconnectGmail();
    setHasToken(false);
    setConnectedUserEmail(null);
    if (onShowToast) onShowToast('info', 'Conta desconectada do Gmail.', 'Desconectado');
  };

  const handleManualSendNow = async () => {
    if (!hasToken) {
      if (onShowToast) {
        onShowToast(
          'warning',
          'Conecte sua conta do Google/Gmail antes de disparar o relatório.',
          'Conta Não Conectada'
        );
      }
      return;
    }

    setIsSendingManual(true);
    try {
      const result = await sendDailyFleetReport({
        equipments,
        entries,
        dispenses,
        projects,
        config,
      });

      // Reload config with updated lastSentDate
      const freshConfig = await loadGmailConfig();
      setConfig(freshConfig);

      if (onShowToast) {
        onShowToast(
          'success',
          `Relatório enviado com sucesso para ${result.recipients?.join(', ')}!`,
          'Disparo Concluído'
        );
      }
    } catch (err: any) {
      const msg = err?.message || 'Falha ao disparar o relatório via Gmail.';
      if (onShowToast) onShowToast('error', msg, 'Falha no Envio');
    } finally {
      setIsSendingManual(false);
    }
  };

  const handleDownloadExcelPreview = async () => {
    setIsExportingExcel(true);
    try {
      const bytes = await generateFleetReportExcelBuffer(reportData);
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Makmo_Frota_e_Comboios_${getTodayDateString()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (onShowToast) onShowToast('success', 'Planilha Excel baixada para conferência.');
    } catch (err) {
      if (onShowToast) onShowToast('error', 'Falha ao gerar planilha Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadPdfPreview = () => {
    setIsExportingPdf(true);
    try {
      const bytes = generateFleetReportPdfBuffer(reportData);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Makmo_Relatorio_Frota_e_Comboios_${getTodayDateString()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (onShowToast) onShowToast('success', 'Relatório PDF baixado para conferência.');
    } catch (err) {
      if (onShowToast) onShowToast('error', 'Falha ao gerar arquivo PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div
      id="gmail-integration-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl text-slate-950 font-black shadow-md flex items-center justify-center">
              <Mail className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Integração Gmail • Envio Diário às 06:00
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-black uppercase tracking-wider">
                  Admin Exclusivo
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Envio automático da Relação de Equipamentos (Excel e PDF por Obra) e Saldo Atual de Todos os Comboios
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50 dark:bg-slate-950/40">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setModalTab('config')}
              className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                modalTab === 'config'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              ⚙️ Configurações & Destinatários
            </button>
            <button
              type="button"
              onClick={() => setModalTab('preview')}
              className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                modalTab === 'preview'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              👁️ Pré-visualização do Relatório (Dados Atuais)
            </button>
          </div>

          {/* Schedule status badge */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Disparo Agendado: <strong>06:00 da Manhã</strong></span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {modalTab === 'config' && (
            <>
              {/* CARD 1: Conexão com Google Workspace / Gmail API */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4.5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs mt-0.5">
                      {/* Google G Logo */}
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        Autorização do Gmail (Google Workspace)
                        {hasToken ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Conectado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <AlertCircle className="w-3 h-3" /> Desconectado
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {hasToken
                          ? `Conta conectada: ${connectedUserEmail || 'Conta Google autenticada'}. O sistema está apto a enviar os e-mails automaticamente.`
                          : 'Conecte sua conta do Google para permitir que o sistema envie os relatórios diários com permissão oficial.'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {hasToken ? (
                      <button
                        type="button"
                        onClick={handleDisconnectGoogle}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Desconectar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        disabled={isAuthenticating}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isAuthenticating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Conectando...</span>
                          </>
                        ) : (
                          <>
                            <span>Conectar com Google</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* CARD 2: Destinatários de E-mail (Admin pode ver, alterar e adicionar) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-amber-500" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Destinatários do Relatório Matutino
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400">
                    {1 + config.additionalEmails.length} e-mail(s) cadastrado(s)
                  </span>
                </div>

                {/* E-mail Principal Obrigatório */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    E-mail Principal Oficial <span className="text-amber-500 font-bold">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={config.primaryEmail}
                      onChange={(e) => {
                        const val = e.target.value;
                        const upd = { ...config, primaryEmail: val };
                        setConfig(upd);
                        saveGmailConfig(upd).catch(() => {});
                      }}
                      placeholder="roberto.junior@makmo.com.br"
                      className="flex-1 px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-2 rounded-lg shrink-0">
                      Destinatário Principal
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    E-mail padrão da diretoria definido pelo sistema para envio matutino às 06:00.
                  </p>
                </div>

                {/* E-mails Adicionais */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    E-mails Adicionais da Equipe (Adicionar novos destinatários)
                  </label>

                  {/* Input to add email */}
                  <form onSubmit={handleAddEmail} className="flex items-center gap-2 mb-2">
                    <input
                      type="email"
                      value={newEmailInput}
                      onChange={(e) => {
                        setNewEmailInput(e.target.value);
                        if (emailInputError) setEmailInputError(null);
                      }}
                      placeholder="Ex: coordenacao.obras@makmo.com.br"
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar E-mail</span>
                    </button>
                  </form>

                  {emailInputError && (
                    <p className="text-xs text-rose-500 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {emailInputError}
                    </p>
                  )}

                  {/* List of Additional Emails */}
                  {config.additionalEmails.length === 0 ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                      Nenhum e-mail adicional configurado. O relatório será enviado apenas para o e-mail principal.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {config.additionalEmails.map((email, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs"
                        >
                          <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                            {email}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEmail(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                            title="Remover destinatário"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 3: Horário e Status do Envio Automático */}
              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs uppercase tracking-wider">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Programação de Disparo Automático
                  </div>
                  <span className="text-xs font-black text-amber-700 dark:text-amber-300 font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-800">
                    TODOS OS DIAS ÀS 06:00
                  </span>
                </div>

                <p className="text-xs text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
                  O sistema compila pontualmente às <strong>06:00 da manhã</strong> todos os dados atualizados das obras ativas e dispara o e-mail com a tabela de saldos de todos os comboios e os arquivos <strong>Excel (.xlsx)</strong> e <strong>PDF (.pdf)</strong> anexados com o inventário completo separado por cada obra.
                </p>

                {config.lastLog && (
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-900/60 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Último Histórico: </span>
                      {config.lastLog}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadExcelPreview}
                    disabled={isExportingExcel}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isExportingExcel ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>Baixar Excel do Relatório</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPdfPreview}
                    disabled={isExportingPdf}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isExportingPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>Baixar PDF do Relatório</span>
                  </button>
                </div>

                {/* Disparar Agora (Teste de Envio) */}
                <button
                  type="button"
                  onClick={handleManualSendNow}
                  disabled={isSendingManual || !hasToken}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  title={hasToken ? 'Enviar o relatório agora para testar o recebimento' : 'Conecte sua conta Google primeiro'}
                >
                  {isSendingManual ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Enviando Relatório para {config.primaryEmail}...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-black" />
                      <span>Disparar Agora (Teste de Envio)</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {modalTab === 'preview' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Executive Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total de Máquinas</span>
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {reportData.totalEquipments}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Obras com Equipamentos</span>
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {reportData.obraGroups.length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Comboios Cadastrados</span>
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {reportData.convoys.length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Saldo Total de Diesel</span>
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatLiters(reportData.totalConvoysBalance)} L
                  </span>
                </div>
              </div>

              {/* Tabela de Comboios */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <Fuel className="w-4 h-4 text-amber-500" />
                  Saldo Atual de Todos os Comboios de Todas as Obras
                </h4>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-white font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Placa</th>
                        <th className="py-2.5 px-3">Nome do Comboio</th>
                        <th className="py-2.5 px-3 text-center">Obra</th>
                        <th className="py-2.5 px-3">Motorista</th>
                        <th className="py-2.5 px-3 text-right">Capacidade</th>
                        <th className="py-2.5 px-3 text-right">Saldo Atual</th>
                        <th className="py-2.5 px-3 text-center">% Nível</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reportData.convoys.map((c) => (
                        <tr key={c.plate} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                            {c.plate}
                          </td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{c.name}</td>
                          <td className="py-2 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                            {c.obra}
                          </td>
                          <td className="py-2 px-3 text-slate-500">{c.driver || '-'}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            {c.capacity.toLocaleString('pt-BR')} L
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatLiters(c.currentBalance)} L
                          </td>
                          <td className="py-2 px-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                            {c.percentRemaining.toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Relação de Obras */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  Relação de Obras e Total de Máquinas Separadas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {reportData.obraGroups.map((g) => (
                    <div
                      key={g.obraCode}
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                          {g.obraLabel}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                          {g.equipments.length} máquinas
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {g.equipments.slice(0, 4).map((e) => e.prefix || e.code).join(', ')}
                        {g.equipments.length > 4 ? ` e mais ${g.equipments.length - 4}...` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
