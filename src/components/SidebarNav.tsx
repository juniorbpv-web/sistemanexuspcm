import React from 'react';
import { ActiveTab, AuthUser, AppUser } from '../types';
import {
  Database,
  ClipboardList,
  Fuel,
  FileText,
  Wrench,
  Coins,
  Hammer,
  Building2,
  RefreshCw,
  Shield,
  Mail,
  Download,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  HardHat,
  Eye,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { MakmoLogo } from './MakmoLogo';

interface SidebarNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  equipmentCount: number;
  logCount: number;
  fuelDispenseCount?: number;
  invoiceFileCount?: number;
  preventiveOverdueCount?: number;
  deductionCount?: number;
  correctiveCount?: number;
  selectedProject?: string;
  canSwitchProject?: boolean;
  onOpenProjectSelector?: () => void;
  appUser?: AppUser | null;
  currentUser?: AuthUser | null;
  onOpenAdminManagement?: () => void;
  onOpenGmailIntegration?: () => void;
  onLogout?: () => void;
  onExportCSV?: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  setActiveTab,
  equipmentCount,
  logCount,
  fuelDispenseCount,
  invoiceFileCount,
  preventiveOverdueCount,
  deductionCount,
  correctiveCount,
  selectedProject,
  canSwitchProject = false,
  onOpenProjectSelector,
  appUser,
  currentUser,
  onOpenAdminManagement,
  onOpenGmailIntegration,
  onLogout,
  onExportCSV,
  isOpenMobile,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
}) => {
  const effectiveRole = appUser?.role || currentUser?.role || 'user';
  const effectiveName = appUser?.name || currentUser?.name || 'Usuário';

  const navItems = [
    {
      id: 'database' as ActiveTab,
      label: 'Base de Dados',
      icon: Database,
      badge: equipmentCount > 0 ? equipmentCount : 131,
      badgeClass: 'bg-amber-500 text-black font-bold font-mono',
      activeColor: 'border-l-4 border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold',
    },
    {
      id: 'daily-log' as ActiveTab,
      label: 'Gestão De Frotas',
      icon: ClipboardList,
      badge: logCount > 0 ? logCount : undefined,
      badgeClass: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono',
      activeColor: 'border-l-4 border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold',
    },
    {
      id: 'fuel-control' as ActiveTab,
      label: 'Gestão De Combustível',
      icon: Fuel,
      badge: fuelDispenseCount !== undefined && fuelDispenseCount > 0 ? fuelDispenseCount : undefined,
      badgeClass: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono',
      activeColor: 'border-l-4 border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold',
    },
    {
      id: 'invoices' as ActiveTab,
      label: 'Arquivos / Notas Fiscais',
      icon: FileText,
      badge: invoiceFileCount !== undefined && invoiceFileCount > 0 ? invoiceFileCount : undefined,
      badgeClass: 'bg-amber-500 text-black font-bold font-mono border border-amber-600',
      activeColor: 'border-l-4 border-amber-500 bg-amber-500/15 text-amber-950 dark:text-amber-300 font-bold',
    },
    {
      id: 'preventive-maintenance' as ActiveTab,
      label: 'Controle de Preventivas',
      icon: Wrench,
      badge: 'PCM',
      overdueAlert: preventiveOverdueCount !== undefined && preventiveOverdueCount > 0 ? preventiveOverdueCount : undefined,
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold border border-blue-500/20 text-[9px] tracking-wider',
      activeColor: 'border-l-4 border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold',
    },
    {
      id: 'measurement-deduction' as ActiveTab,
      label: 'Desconto em Medição',
      icon: Coins,
      badge: 'NOVO',
      badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-500/20 text-[9px] tracking-wider',
      activeColor: 'border-l-4 border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold',
    },
    {
      id: 'corrective-maintenance' as ActiveTab,
      label: 'Corretivas Realizadas',
      icon: Hammer,
      badge: 'NOVO',
      badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold border border-blue-500/20 text-[9px] tracking-wider',
      activeColor: 'border-l-4 border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold',
    },
  ];

  const handleSelectTab = (tabId: ActiveTab) => {
    setActiveTab(tabId);
    onCloseMobile();
  };

  const getRoleBadge = () => {
    switch (effectiveRole) {
      case 'admin':
        return {
          label: 'Admin',
          color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
          icon: <Shield className="w-3 h-3 text-rose-500" />,
        };
      case 'gestor':
        return {
          label: 'Gestor',
          color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
          icon: <ShieldCheck className="w-3 h-3 text-amber-500" />,
        };
      case 'controlador':
        return {
          label: 'Controlador',
          color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
          icon: <HardHat className="w-3 h-3 text-blue-500" />,
        };
      case 'visualizador':
        return {
          label: 'Visualizador',
          color: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30',
          icon: <Eye className="w-3 h-3 text-slate-500" />,
        };
      default:
        return {
          label: effectiveRole,
          color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
          icon: <CheckCircle2 className="w-3 h-3 text-amber-500" />,
        };
    }
  };

  const roleBadge = getRoleBadge();

  const sidebarContent = (
    <div className="flex flex-col h-full select-none">
      {/* Brand & Logo Header */}
      <div className="p-3.5 border-b border-[#eaecef] dark:border-[#1e293b] flex items-center justify-between gap-2 shrink-0 bg-white/60 dark:bg-[#111625]/60 backdrop-blur-xs">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <MakmoLogo
            className={isCollapsed ? "h-6 w-auto shrink-0" : "h-7.5 sm:h-8 w-auto shrink-0"}
            compact={isCollapsed}
            showSubtitle={!isCollapsed}
            showSubBrand={false}
          />
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#6b7280] dark:text-[#9ca3af]">
                Painel Lateral
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button or Desktop collapse toggle */}
        <div className="flex items-center gap-1">
          {/* Mobile close */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar menu lateral"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop collapse */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1 rounded-md text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expandir painel lateral' : 'Recolher painel lateral'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Identificação de Obra Ativa (Todas as Obras) */}
      {!isCollapsed && selectedProject && (
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[#111827] dark:text-[#f3f4f6]">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Obra Ativa
              </span>
              {canSwitchProject && onOpenProjectSelector && (
                <button
                  type="button"
                  onClick={onOpenProjectSelector}
                  className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-500 hover:bg-amber-400 active:scale-95 text-black px-1.5 py-0.5 rounded shadow-2xs transition-all cursor-pointer"
                  title="Trocar obra em operação"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Trocar</span>
                </button>
              )}
            </div>
            <div className="font-black font-industrial uppercase text-xs truncate text-amber-900 dark:text-amber-200">
              {selectedProject === 'all' ? 'TODAS AS OBRAS (GLOBAL)' : selectedProject}
            </div>
          </div>
        </div>
      )}

      {/* Nav Items List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin">
        {!isCollapsed && (
          <div className="px-2 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#9ca3af]">
            Módulos do Sistema
          </div>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`sidebar-tab-${item.id}`}
              type="button"
              onClick={() => handleSelectTab(item.id)}
              title={item.label}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
              } rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                isActive
                  ? item.activeColor
                  : 'text-[#4b5563] dark:text-[#9ca3af] hover:text-[#111827] dark:hover:text-[#f3f4f6] hover:bg-[#f3f4f6] dark:hover:bg-[#1a2234]'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-inherit stroke-[2.25]' : 'opacity-80'
                  }`}
                />
                {!isCollapsed && <span className="truncate text-left">{item.label}</span>}
              </div>

              {/* Badges */}
              {!isCollapsed && (
                <div className="flex items-center gap-1 shrink-0">
                  {item.overdueAlert !== undefined && item.overdueAlert > 0 && (
                    <span
                      className="inline-flex items-center justify-center text-[10px] font-mono px-1.5 py-0.5 rounded leading-none bg-rose-500 text-white font-black animate-pulse"
                      title={`${item.overdueAlert} preventivas vencidas`}
                    >
                      {item.overdueAlert}
                    </span>
                  )}
                  {item.badge !== undefined && (
                    <span
                      className={`inline-flex items-center justify-center text-[10px] px-1.5 py-0.5 rounded leading-none ${item.badgeClass}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Actions & User Profile */}
      <div className="p-3 border-t border-[#eaecef] dark:border-[#1e293b] space-y-2 shrink-0 bg-white/70 dark:bg-[#111625]/70 backdrop-blur-xs">
        {/* Quick Actions (Admin, Gmail, CSV) */}
        {!isCollapsed && (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {effectiveRole === 'admin' && onOpenAdminManagement && (
              <button
                type="button"
                onClick={onOpenAdminManagement}
                className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-bold transition-all cursor-pointer"
                title="Painel Administrativo"
              >
                <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Admin</span>
              </button>
            )}

            {effectiveRole === 'admin' && onOpenGmailIntegration && (
              <button
                type="button"
                onClick={onOpenGmailIntegration}
                className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-800 dark:text-blue-300 text-[11px] font-bold transition-all cursor-pointer"
                title="Relatórios Diários via Gmail"
              >
                <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Gmail</span>
              </button>
            )}
          </div>
        )}

        {/* User Badge & Logout */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#eaecef] dark:border-[#1e293b]">
          {!isCollapsed ? (
            <div className="flex items-center gap-2 truncate flex-1 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black text-xs shrink-0">
                {effectiveName.charAt(0).toUpperCase()}
              </div>
              <div className="truncate flex-1 min-w-0">
                <div className="text-xs font-bold text-[#111827] dark:text-[#f3f4f6] truncate leading-tight">
                  {effectiveName}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleBadge.color}`}
                  >
                    {roleBadge.icon}
                    <span>{roleBadge.label}</span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center py-1">
              <div
                className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black text-xs"
                title={`${effectiveName} (${roleBadge.label})`}
              >
                {effectiveName.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Logout */}
          {onLogout && !isCollapsed && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer shrink-0"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        id="desktop-lateral-sidebar"
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen z-20 border-r border-[#dcdfe4] bg-white backdrop-blur-md transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-64 xl:w-70'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fadeIn"
            onClick={onCloseMobile}
          />

          {/* Slide-over Drawer */}
          <aside
            id="mobile-lateral-sidebar"
            className="relative flex flex-col w-72 max-w-[85vw] h-full z-10 bg-white shadow-2xl border-r border-[#dcdfe4] animate-slideInLeft"
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
