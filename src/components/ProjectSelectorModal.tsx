import React, { useMemo } from 'react';
import { AppProject, AppUser } from '../types';
import { Building2, Check, ArrowRight, Globe, HardHat, X } from 'lucide-react';
import { normalizeProjectCode } from '../utils/authStorage';

interface ProjectSelectorModalProps {
  isOpen: boolean;
  user: AppUser;
  projects: AppProject[];
  currentSelectedProject: string;
  equipmentsCountByProject?: Record<string, number>;
  onSelectProject: (projectCode: string) => void;
  onClose?: () => void;
  canCancel?: boolean;
}

export const ProjectSelectorModal: React.FC<ProjectSelectorModalProps> = ({
  isOpen,
  user,
  projects,
  currentSelectedProject,
  equipmentsCountByProject = {},
  onSelectProject,
  onClose,
  canCancel = false,
}) => {
  if (!isOpen) return null;

  const isAdmin = user.role === 'admin';

  // Filter and deduplicate projects authorized for this user
  const availableProjects = useMemo(() => {
    const map = new Map<string, AppProject>();
    projects.forEach((p) => {
      const norm = normalizeProjectCode(p.code);
      if (
        isAdmin ||
        user.allowedProjects.some(
          (ap) => ap === 'all' || normalizeProjectCode(ap) === norm
        )
      ) {
        if (!map.has(norm)) {
          map.set(norm, p);
        }
      }
    });
    return Array.from(map.values());
  }, [projects, isAdmin, user.allowedProjects]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#113861] via-[#16477b] to-[#113861] p-5 text-white relative flex items-center justify-between border-b border-[#1b4d82]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <HardHat className="w-6 h-6 text-[#20b4a7]" />
            </div>
            <div>
              <h2 className="text-lg font-black font-industrial tracking-wider uppercase text-white">
                Selecione a Obra de Operação
              </h2>
              <p className="text-xs font-semibold text-[#20b4a7]">
                Olá, {user.name} ({user.role})
              </p>
            </div>
          </div>
          {canCancel && onClose && (
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Cancelar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Você possui acesso às seguintes frentes de trabalho. Escolha qual obra deseja gerenciar neste momento:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {/* Global option for Admin */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => onSelectProject('all')}
                className={`p-4 rounded-xl border text-left transition-all sm:col-span-2 flex items-center justify-between group cursor-pointer ${
                  currentSelectedProject === 'all'
                    ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 ring-2 ring-amber-500/20 shadow-md'
                    : 'border-slate-200 dark:border-zinc-800 hover:border-amber-500/50 bg-slate-50 dark:bg-zinc-950/60 hover:bg-white dark:hover:bg-zinc-950'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      currentSelectedProject === 'all'
                        ? 'bg-amber-500 text-black font-bold'
                        : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 group-hover:bg-amber-500 group-hover:text-black transition-colors'
                    }`}
                  >
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                        Todas as Obras (Visão Global)
                      </span>
                      <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                        Admin Total
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 block mt-0.5">
                      Visualização consolidada da frota completa de todas as frentes
                    </span>
                  </div>
                </div>
                {currentSelectedProject === 'all' ? (
                  <Check className="w-5 h-5 text-amber-500 shrink-0" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-zinc-600 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                )}
              </button>
            )}

            {/* Individual Authorized Projects */}
            {availableProjects.map((p) => {
              const normCode = normalizeProjectCode(p.code);
              const isSelected = normalizeProjectCode(currentSelectedProject) === normCode;
              const eqCount = equipmentsCountByProject[normCode] || 0;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectProject(p.code)}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between group cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 ring-2 ring-amber-500/20 shadow-md'
                      : 'border-slate-200 dark:border-zinc-800 hover:border-amber-500/50 bg-slate-50 dark:bg-zinc-950/60 hover:bg-white dark:hover:bg-zinc-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-amber-500 text-black font-bold'
                            : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 group-hover:bg-amber-500 group-hover:text-black transition-colors'
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-black text-sm font-industrial tracking-wide text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors block">
                          {p.code}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                          {p.status === 'active' ? '● Obra Ativa' : '○ Inativa'}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-amber-500 shrink-0 mt-1" />}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-zinc-300 font-medium line-clamp-2 mt-1">
                    {p.name}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                    <span>Equipamentos vinculados:</span>
                    <span className="font-bold font-mono text-slate-800 dark:text-zinc-200 bg-slate-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      {eqCount} un
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-slate-100 dark:bg-zinc-950 px-6 py-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500">
          <span>Ao trocar de obra, todo o painel e relatórios serão filtrados automaticamente.</span>
          {canCancel && onClose && (
            <button
              onClick={onClose}
              className="text-xs font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white px-2 py-1"
            >
              Manter atual
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
