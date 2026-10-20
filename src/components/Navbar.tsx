import React from 'react';
import { ActiveTab, AuthUser, AppUser } from '../types';
import {
  ClipboardList,
  Database,
  Fuel,
  FileText,
  Sun,
  Moon,
  Download,
  Cloud,
  CloudCheck,
  RefreshCw,
  LogOut,
  ShieldCheck,
  HardHat,
  Wrench,
  Coins,
  Hammer,
  Building2,
  Shield,
  Eye,
  Settings,
  Mail,
} from 'lucide-react';
import { MakmoLogo } from './MakmoLogo';
import type { OverduePreventiveItem } from './OverdueNotificationBell';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  equipmentCount: number;
  logCount: number;
  fuelDispenseCount?: number;
  invoiceFileCount?: number;
  preventiveOverdueCount?: number;
  overdueItems?: OverduePreventiveItem[];
  isOverdueBellOpen?: boolean;
  onToggleOverdueBell?: () => void;
  onCloseOverdueBell?: () => void;
  onViewAllOverdue?: () => void;
  onSelectOverdueEquipment?: (equipmentId: string) => void;
  deductionCount?: number;
  correctiveCount?: number;
  cloudStatus?: 'connected' | 'syncing' | 'offline';
  cloudProvider?: 'supabase' | 'firestore' | 'local';
  onOpenCloudModal?: () => void;
  currentUser?: AuthUser | null;
  appUser?: AppUser | null;
  selectedProject?: string;
  onOpenProjectSelector?: () => void;
  canSwitchProject?: boolean;
  onOpenAdminManagement?: () => void;
  onOpenGmailIntegration?: () => void;
  onLogout?: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  theme,
  toggleTheme,
  equipmentCount,
  logCount,
  fuelDispenseCount,
  invoiceFileCount,
  preventiveOverdueCount,
  overdueItems = [],
  isOverdueBellOpen = false,
  onToggleOverdueBell,
  onCloseOverdueBell,
  onViewAllOverdue,
  onSelectOverdueEquipment,
  deductionCount,
  correctiveCount,
  cloudStatus = 'connected',
  cloudProvider = 'local',
  onOpenCloudModal,
  currentUser,
  appUser,
  selectedProject,
  onOpenProjectSelector,
  canSwitchProject = false,
  onOpenAdminManagement,
  onOpenGmailIntegration,
  onLogout,
  onToggleSidebar,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
}) => {
  const effectiveRole = appUser?.role || currentUser?.role || 'user';
  const effectiveName = appUser?.name || currentUser?.name || 'Usuário';

  const getRoleBadgeInfo = () => {
    switch (effectiveRole) {
      case 'admin':
        return {
          label: 'Administrador',
          color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
          icon: <Shield className="w-3.5 h-3.5 text-rose-500" />,
        };
      case 'gestor':
        return {
          label: 'Gestor',
          color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />,
        };
      case 'controlador':
        return {
          label: 'Controlador',
          color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
          icon: <HardHat className="w-3.5 h-3.5 text-blue-500" />,
        };
      case 'visualizador':
        return {
          label: 'Visualizador',
          color: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30',
          icon: <Eye className="w-3.5 h-3.5 text-slate-500" />,
        };
      default:
        return {
          label: effectiveRole,
          color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />,
        };
    }
  };

  const roleInfo = getRoleBadgeInfo();
  return (
    <header className="sticky top-0 z-30 border-b border-[#dcdfe4] bg-white backdrop-blur-md transition-colors">
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8">
        {/* Top Header Row - High Density compact bar */}
        <div className="flex items-center justify-between h-12 sm:h-13 gap-2">
          {/* Logo & Brand & Identificação da Obra */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center py-0.5">
              <MakmoLogo className="h-6.5 sm:h-8 w-auto transition-transform hover:scale-[1.02]" />
            </div>

            <div className="h-5 w-px bg-[#dcdfe4] dark:bg-[#333333] hidden md:block" />

            {/* Identificação Visível da Obra Selecionada */}
            {selectedProject && (
              <div
                id="active-project-badge"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-300 shadow-2xs"
                title={`Obra Ativa no Sistema: ${selectedProject}`}
              >
                <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-black font-industrial uppercase tracking-wide text-xs sm:text-sm truncate max-w-[130px] sm:max-w-[220px]">
                  {selectedProject === 'all'
                    ? 'TODAS AS OBRAS (GLOBAL)'
                    : `${selectedProject} | Gestão de Manutenção`}
                </span>
                {canSwitchProject && onOpenProjectSelector && (
                  <button
                    type="button"
                    onClick={onOpenProjectSelector}
                    className="ml-1 flex items-center gap-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-400 active:scale-95 text-black px-2 py-0.5 rounded shadow-xs transition-all cursor-pointer shrink-0"
                    title="Trocar a obra em operação"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span className="hidden xs:inline">Trocar Obra</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5">
            {/* Admin Management Panel Button (Apenas Administrador) */}
            {effectiveRole === 'admin' && onOpenAdminManagement && (
              <button
                id="btn-admin-management"
                type="button"
                onClick={onOpenAdminManagement}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 transition-all shadow-xs h-7.5 cursor-pointer"
                title="Painel de Administração: Usuários, Obras e Permissões"
              >
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline uppercase text-[11px] tracking-wider">Painel Admin</span>
              </button>
            )}

            {/* User Profile Badge */}
            {(appUser || currentUser) && (
              <div
                id="user-profile-badge"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${roleInfo.color}`}
                title={`Usuário conectado: ${effectiveName} (${roleInfo.label})`}
              >
                {roleInfo.icon}
                <span className="hidden md:inline font-industrial uppercase opacity-80 text-[10px]">
                  {roleInfo.label}:
                </span>
                <span className="truncate max-w-[90px] sm:max-w-[130px] font-semibold">{effectiveName}</span>
              </div>
            )}

            {/* Database Status Indicator / Botão de Sincronização Supabase */}
            <button
              id="cloud-status-badge"
              type="button"
              onClick={onOpenCloudModal}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer hover:shadow-xs active:scale-95 ${
                cloudStatus === 'connected'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                  : cloudStatus === 'syncing'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 animate-pulse'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
              title={
                cloudProvider === 'supabase'
                  ? cloudStatus === 'connected'
                    ? 'Banco de dados Supabase conectado e sincronizado em tempo real entre computadores. Clique para gerenciar.'
                    : 'Sincronizando com Supabase... Clique para detalhes.'
                  : 'Modo local ou desconectado. Clique para conectar ao Supabase e compartilhar dados entre computadores.'
              }
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  cloudStatus === 'connected'
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse'
                    : cloudStatus === 'syncing'
                    ? 'bg-amber-500'
                    : 'bg-neutral-400'
                }`}
              />
              <span className="font-semibold">
                {cloudProvider === 'supabase'
                  ? cloudStatus === 'connected'
                    ? 'Supabase Ativo'
                    : cloudStatus === 'syncing'
                    ? 'Sincronizando...'
                    : 'Supabase Offline'
                  : cloudStatus === 'connected'
                  ? 'Nuvem Ativa'
                  : 'Conectar Supabase'}
              </span>
            </button>

            {/* Botão Integração Gmail (Exclusivo Perfil Admin) */}
            {effectiveRole === 'admin' && onOpenGmailIntegration && (
              <button
                type="button"
                id="btn-gmail-integration"
                onClick={onOpenGmailIntegration}
                title="Configurar Integração Gmail e Envio Automático às 06:00 (Apenas Perfil Admin)"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-300 transition-all h-7.5 shadow-2xs cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Gmail (06:00)</span>
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button
              id="btn-toggle-theme"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={theme === 'dark' ? 'Mudar para modo clássico' : 'Mudar para modo escuro (fundo claro)'}
              className="p-1.5 rounded border border-[#dcdfe4] dark:border-[#cbd5e1] bg-[#f8fafc] dark:bg-white text-[#4b5563] dark:text-slate-800 hover:bg-[#edf2f7] dark:hover:bg-slate-100 transition-colors h-7.5 w-7.5 flex items-center justify-center cursor-pointer shadow-2xs"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-700" />
              )}
            </button>

            {/* Logout Button */}
            {onLogout && (
              <button
                id="btn-logout"
                onClick={onLogout}
                title="Sair do sistema e trocar de perfil"
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors h-7.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Sair</span>
              </button>
            )}
          </div>
        </div>

        {/* Painel Superior de Módulos (Navegação no Topo permanente para Desktop e Mobile) */}
        <nav
          id="top-module-panel"
          aria-label="Painel Superior de Módulos"
          className="flex items-center overflow-x-auto scrollbar-none border-t border-[#eaecef] dark:border-[#262626] -mb-px w-full"
        >
          {/* Aba 1: Base de Dados */}
          <button
            id="tab-btn-database"
            type="button"
            onClick={() => setActiveTab('database')}
            className={`h-10 sm:h-10.5 px-3 sm:px-4 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'database'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold'
                : 'border-transparent text-[#4b5563] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:border-neutral-400 dark:hover:border-neutral-600'
            }`}
          >
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span>Base de Dados</span>
            <span
              className={`inline-flex items-center justify-center text-[10px] font-mono px-1.5 py-0.5 rounded font-bold leading-none shrink-0 ${
                activeTab === 'database'
                  ? 'bg-amber-500 text-black'
                  : 'bg-[#e5e7eb] text-[#374151] dark:bg-[#262626] dark:text-[#d1d5db]'
              }`}
            >
              {equipmentCount}
            </span>
          </button>

          {/* Aba 2: Gestão de Frotas */}
          <button
            id="tab-btn-daily-log"
            type="button"
            onClick={() => setActiveTab('daily-log')}
            title="Gestão de Frotas - Apontamento de Parte Diária"
            className={`h-10 sm:h-10.5 px-3 sm:px-4 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'daily-log'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold'
                : 'border-transparent text-[#4b5563] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:border-neutral-400 dark:hover:border-neutral-600'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 shrink-0" />
            <span>Gestão De Frotas</span>
            {logCount > 0 && (
              <span
                className={`inline-flex items-center justify-center text-[10px] font-mono px-1.5 py-0.5 rounded font-bold leading-none shrink-0 ${
                  activeTab === 'daily-log'
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#e5e7eb] text-[#374151] dark:bg-[#262626] dark:text-[#d1d5db]'
                }`}
              >
                {logCount}
              </span>
            )}
          </button>

          {/* Aba 3: Gestão de Combustível */}
          <button
            id="tab-btn-fuel-control"
            type="button"
            onClick={() => setActiveTab('fuel-control')}
            title="Gestão de Combustível - Controle de Abastecimentos e Entradas"
            className={`h-10 sm:h-10.5 px-3 sm:px-4 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'fuel-control'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold'
                : 'border-transparent text-[#4b5563] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:border-neutral-400 dark:hover:border-neutral-600'
            }`}
          >
            <Fuel className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span>Gestão De Combustível</span>
            {fuelDispenseCount !== undefined && fuelDispenseCount > 0 && (
              <span
                className={`inline-flex items-center justify-center text-[10px] font-mono px-1.5 py-0.5 rounded font-bold leading-none shrink-0 ${
                  activeTab === 'fuel-control'
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#e5e7eb] text-[#374151] dark:bg-[#262626] dark:text-[#d1d5db]'
                }`}
              >
                {fuelDispenseCount}
              </span>
            )}
          </button>

          {/* Aba 4: Arquivos / Notas Fiscais */}
          <button
            id="tab-btn-invoices"
            type="button"
            onClick={() => setActiveTab('invoices')}
            title="Arquivos e Notas Fiscais de Recebimento de Combustível"
            className={`h-10 sm:h-10.5 px-3 sm:px-4 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'invoices'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold'
                : 'border-transparent text-[#4b5563] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:border-neutral-400 dark:hover:border-neutral-600'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span>Arquivos / Notas Fiscais</span>
            {invoiceFileCount !== undefined && invoiceFileCount > 0 && (
              <span
                className="inline-flex items-center justify-center text-[10px] font-mono px-1.5 py-0.5 rounded font-bold leading-none shrink-0 bg-amber-500 text-black border border-amber-600 shadow-2xs"
              >
                {invoiceFileCount}
              </span>
            )}
          </button>

          {/* Aba 5: Controle de Preventivas (PCM) */}
          <button
            id="tab-btn-preventive-maintenance"
            type="button"
            onClick={() => setActiveTab('preventive-maintenance')}
            title="Controle de Manutenção Preventiva de Equipamentos e Veículos (PCM)"
            className={`h-10 sm:h-10.5 px-3 sm:px-4 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'preventive-maintenance'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/10 font-bold'
                : 'border-transparent text-[#4b5563] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:border-neutral-400 dark:hover:border-neutral-600'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            <span>Controle de Preventivas</span>
            {preventiveOverdueCount !== undefined && preventiveOverdueCount > 0 ? (
              <span className="inline-flex items-center justify-center text-[10px] font-mono px-1.5 py-0.5 rounded font-extrabold leading-none shrink-0 bg-rose-500 text-white animate-pulse">
                {preventiveOverdueCount}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded leading-none shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                PCM
              </span>
            )}
          </button>

          {/* Aba 6: Desconto em Medição */}
          <button
            id="tab-btn-measurement-deduction"
            type="button"
            onClick={() => setActiveTab('measurement-deduction')}
            title="Desconto em Medição - Paralisações de Equipamentos e Deduções Contratuais"
            className={`h-10 sm:h-10.5 px-3 sm:px-4 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'measurement-deduction'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold'
                : 'border-transparent text-[#4b5563] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:border-neutral-400 dark:hover:border-neutral-600'
            }`}
          >
            <Coins className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span>Desconto em Medição</span>
            {deductionCount !== undefined && deductionCount > 0 ? (
              <span
                className={`inline-flex items-center justify-center text-[10px] font-mono px-1.5 py-0.5 rounded font-bold leading-none shrink-0 ${
                  activeTab === 'measurement-deduction'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[#e5e7eb] text-[#374151] dark:bg-[#262626] dark:text-[#d1d5db]'
                }`}
              >
                {deductionCount}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded leading-none shrink-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                NOVO
              </span>
            )}
          </button>

          {/* Aba 7: Corretivas Realizadas */}
          <button
            id="tab-btn-corrective-maintenance"
            type="button"
            onClick={() => setActiveTab('corrective-maintenance')}
            title="Corretivas Realizadas - Histórico, Ordens de Serviço e Fotos"
            className={`h-10 sm:h-10.5 px-3 sm:px-4 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'corrective-maintenance'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/10 font-bold'
                : 'border-transparent text-[#4b5563] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:border-neutral-400 dark:hover:border-neutral-600'
            }`}
          >
            <Hammer className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            <span>Corretivas Realizadas</span>
            {correctiveCount !== undefined && correctiveCount > 0 ? (
              <span
                className={`inline-flex items-center justify-center text-[10px] font-mono px-1.5 py-0.5 rounded font-bold leading-none shrink-0 ${
                  activeTab === 'corrective-maintenance'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#e5e7eb] text-[#374151] dark:bg-[#262626] dark:text-[#d1d5db]'
                }`}
              >
                {correctiveCount}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded leading-none shrink-0 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                NOVO
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
