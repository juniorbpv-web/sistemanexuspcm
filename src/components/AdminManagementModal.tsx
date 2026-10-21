import React, { useState, useMemo } from 'react';
import { AppProject, AppUser, UserRole } from '../types';
import {
  normalizeProjectCode,
  UNIFIED_WORK_CODE,
  CLEAN_WORK_062_PA,
  OFFICIAL_UNIFIED_PROJECT,
  OFFICIAL_062_PA_PROJECT,
} from '../utils/authStorage';
import {
  Users,
  Building2,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Shield,
  Key,
  Power,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
  Play,
  HardHat,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Truck,
  Info,
  Database,
} from 'lucide-react';

interface AdminManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AppUser[];
  projects: AppProject[];
  currentUser: AppUser;
  currentSelectedProject?: string;
  equipmentsCountByProject?: Record<string, number>;
  onSelectProject?: (projectCode: string) => void;
  onSaveUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => void;
  onSaveProject: (project: AppProject) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenSupabaseConfig?: () => void;
}

export const AdminManagementModal: React.FC<AdminManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  projects,
  currentUser,
  currentSelectedProject,
  equipmentsCountByProject = {},
  onSelectProject,
  onSaveUser,
  onDeleteUser,
  onSaveProject,
  onDeleteProject,
  onOpenSupabaseConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'projects'>('users');
  const [searchTerm, setSearchTerm] = useState('');

  // User form modal state
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'controlador' as UserRole,
    status: 'active' as 'active' | 'inactive',
    allowedProjects: [] as string[],
  });

  // Project form modal state
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<AppProject | null>(null);
  const [projectFormData, setProjectFormData] = useState({
    code: '',
    name: '',
    status: 'active' as 'active' | 'inactive',
    description: '',
    activateNow: false,
  });

  // Deduplicated projects list for UI and checks
  const deduplicatedProjects = useMemo(() => {
    const map = new Map<string, AppProject>();
    map.set(UNIFIED_WORK_CODE, OFFICIAL_UNIFIED_PROJECT);
    map.set(CLEAN_WORK_062_PA, OFFICIAL_062_PA_PROJECT);

    projects.forEach((p) => {
      const norm = normalizeProjectCode(p.code);
      if (norm === UNIFIED_WORK_CODE) {
        map.set(UNIFIED_WORK_CODE, OFFICIAL_UNIFIED_PROJECT);
      } else if (norm === CLEAN_WORK_062_PA) {
        map.set(CLEAN_WORK_062_PA, OFFICIAL_062_PA_PROJECT);
      } else if (norm) {
        map.set(norm, { ...p, code: norm });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [projects]);

  if (!isOpen) return null;

  // Handlers for Users
  const handleOpenNewUser = () => {
    setEditingUser(null);
    setShowUserPassword(false);
    setUserFormData({
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'controlador',
      status: 'active',
      allowedProjects: [UNIFIED_WORK_CODE],
    });
    setIsUserFormOpen(true);
  };

  const handleOpenEditUser = (user: AppUser, focusPermissionsOnly = false) => {
    setEditingUser(user);
    setShowUserPassword(false);
    const normalizedAllowed = user.allowedProjects.map((p) =>
      p === 'all' ? 'all' : normalizeProjectCode(p)
    );
    setUserFormData({
      name: user.name,
      email: user.email,
      username: user.username,
      password: user.password,
      role: user.role,
      status: user.status,
      allowedProjects: normalizedAllowed,
    });
    setIsUserFormOpen(true);
  };

  const handleToggleProjectPermission = (projCode: string) => {
    if (projCode === 'all') {
      if (userFormData.allowedProjects.includes('all')) {
        setUserFormData((prev) => ({ ...prev, allowedProjects: [] }));
      } else {
        setUserFormData((prev) => ({ ...prev, allowedProjects: ['all'] }));
      }
      return;
    }

    const normTarget = normalizeProjectCode(projCode);
    const current = userFormData.allowedProjects
      .filter((p) => p !== 'all')
      .map((p) => normalizeProjectCode(p));

    if (current.includes(normTarget)) {
      setUserFormData((prev) => ({
        ...prev,
        allowedProjects: current.filter((p) => p !== normTarget),
      }));
    } else {
      setUserFormData((prev) => ({
        ...prev,
        allowedProjects: [...current, normTarget],
      }));
    }
  };

  const handleSelectAllProjects = () => {
    const allCodes = deduplicatedProjects.map((p) => normalizeProjectCode(p.code));
    setUserFormData((prev) => ({
      ...prev,
      allowedProjects: allCodes,
    }));
  };

  const handleClearAllProjects = () => {
    setUserFormData((prev) => ({
      ...prev,
      allowedProjects: [],
    }));
  };

  const handleSaveUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name.trim() || !userFormData.username.trim() || !userFormData.password.trim()) {
      alert('Preencha os campos obrigatórios: Nome, Login e Senha.');
      return;
    }

    // Role permissions validation
    let finalAllowedProjects = userFormData.allowedProjects;
    if (userFormData.role === 'admin') {
      finalAllowedProjects = ['all'];
    } else if (userFormData.allowedProjects.includes('all')) {
      finalAllowedProjects = ['all'];
    } else {
      // Must have at least 1 obra selected
      if (userFormData.allowedProjects.length === 0) {
        alert(
          'Para usuários que não são Administradores, selecione pelo menos uma obra autorizada ou marque "Acesso a Todas as Obras".'
        );
        return;
      }
      finalAllowedProjects = Array.from(new Set(userFormData.allowedProjects.map(normalizeProjectCode)));
    }

    const newUser: AppUser = {
      id: editingUser ? editingUser.id : `user-${Date.now()}`,
      name: userFormData.name.trim(),
      email: userFormData.email.trim(),
      username: userFormData.username.trim().toLowerCase(),
      password: userFormData.password.trim(),
      role: userFormData.role,
      status: userFormData.status,
      allowedProjects: finalAllowedProjects,
      createdAt: editingUser ? editingUser.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveUser(newUser);
    setIsUserFormOpen(false);
  };

  const handleToggleUserStatus = (user: AppUser) => {
    if (user.id === currentUser.id) {
      alert('Você não pode inativar seu próprio usuário atual.');
      return;
    }
    const updated: AppUser = {
      ...user,
      status: user.status === 'active' ? 'inactive' : 'active',
      updatedAt: new Date().toISOString(),
    };
    onSaveUser(updated);
  };

  // Handlers for Projects
  const handleOpenNewProject = () => {
    setEditingProject(null);
    setProjectFormData({
      code: '',
      name: '',
      status: 'active',
      description: '',
      activateNow: false,
    });
    setIsProjectFormOpen(true);
  };

  const handleOpenEditProject = (proj: AppProject) => {
    setEditingProject(proj);
    setProjectFormData({
      code: proj.code,
      name: proj.name,
      status: proj.status,
      description: proj.description || '',
      activateNow: false,
    });
    setIsProjectFormOpen(true);
  };

  const handleSaveProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawCode = projectFormData.code.trim().toUpperCase();
    const cleanName = projectFormData.name.trim();

    if (!rawCode || !cleanName) {
      alert('Informe o Código (ex: 065) e o Nome Oficial da Obra.');
      return;
    }

    const cleanNorm = normalizeProjectCode(rawCode);

    // Verify duplicate code check
    const isDuplicate = deduplicatedProjects.some(
      (p) => p.id !== editingProject?.id && normalizeProjectCode(p.code) === cleanNorm
    );

    if (isDuplicate) {
      alert(
        `Já existe uma obra cadastrada com o código "${cleanNorm}". O sistema requer um código exclusivo para cada obra.`
      );
      return;
    }

    const newProj: AppProject = {
      id: editingProject ? editingProject.id : `proj-${Date.now()}`,
      code: cleanNorm,
      name: cleanName,
      status: projectFormData.status,
      description: projectFormData.description.trim(),
      createdAt: editingProject ? editingProject.createdAt : new Date().toISOString(),
    };

    onSaveProject(newProj);

    // If user requested to activate this newly created obra right away
    if (projectFormData.activateNow && onSelectProject) {
      onSelectProject(cleanNorm);
    }

    setIsProjectFormOpen(false);
  };

  // Filtered lists
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.allowedProjects.some((p) => p.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredProjects = deduplicatedProjects.filter(
    (p) =>
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
            <Shield className="w-2.5 h-2.5" />
            Administrador
          </span>
        );
      case 'gestor':
        return (
          <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
            <ShieldCheck className="w-2.5 h-2.5" />
            Gestor
          </span>
        );
      case 'controlador':
        return (
          <span className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
            <HardHat className="w-2.5 h-2.5" />
            Controlador
          </span>
        );
      case 'visualizador':
        return (
          <span className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
            <Eye className="w-2.5 h-2.5" />
            Visualizador
          </span>
        );
      default:
        return (
          <span className="bg-slate-200 dark:bg-zinc-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase w-fit">
            {role}
          </span>
        );
    }
  };

  const getRoleCapabilityDescription = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Acesso total e irrestrito: Painel Admin, abertura de obras, gestão de senhas e permissões em todas as frentes.';
      case 'gestor':
        return 'Pode cadastrar e editar equipamentos, gerenciar preventivas (PCM), corretivas e paralisações nas obras autorizadas.';
      case 'controlador':
        return 'Lançamentos operacionais de rotina: Parte Diária de horímetros, apontamentos de abastecimento e entradas de diesel.';
      case 'visualizador':
        return 'Acesso para auditoria e fiscalização: Somente leitura e exportação de relatórios. Bloqueado para edições ou exclusões.';
      default:
        return 'Acesso padrão.';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#113861] via-[#16477b] to-[#113861] p-5 text-white flex items-center justify-between border-b border-[#1b4d82]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black font-industrial tracking-wider uppercase flex items-center gap-2">
                Painel Administrativo &bull; Controle de Acesso e Obras
              </h2>
              <p className="text-xs text-zinc-400">
                Gestão centralizada de usuários, concessão de permissões por obra e abertura de novas frentes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher, Search & Action Button */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-slate-200/80 dark:bg-zinc-900 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Usuários & Permissões ({users.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'projects'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Obras & Frentes ({deduplicatedProjects.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={activeTab === 'users' ? 'Buscar usuário ou obra...' : 'Buscar código ou nome da obra...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSupabaseConfig && (
              <button
                type="button"
                onClick={onOpenSupabaseConfig}
                className="bg-teal-600 hover:bg-teal-500 active:scale-95 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border border-teal-500/40"
                title="Configurar Conexão e Sincronização em Nuvem (Supabase / Hostinger)"
              >
                <Database className="w-3.5 h-3.5 text-teal-200" />
                <span>Banco Supabase</span>
              </button>
            )}

            <button
              type="button"
              onClick={activeTab === 'users' ? handleOpenNewUser : handleOpenNewProject}
              className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{activeTab === 'users' ? 'Novo Usuário' : 'Abrir Nova Obra'}</span>
            </button>
          </div>
        </div>

        {/* Tab Content: Users */}
        {activeTab === 'users' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 bg-amber-500/5 border border-amber-500/20 px-3 py-2 rounded-xl">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Defina permissões por usuário vinculando as obras autorizadas. Usuários sem permissão não acessam dados de outras obras.
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-3">Nome / Usuário</th>
                    <th className="p-3">E-mail</th>
                    <th className="p-3">Perfil de Acesso</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Obras Autorizadas</th>
                    <th className="p-3 text-right">Ações & Permissões</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === currentUser.id;
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-zinc-850/50 transition-colors"
                      >
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {u.name}
                            {isSelf && (
                              <span className="text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.2 rounded">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                            @{u.username}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-zinc-300 font-mono text-[11px]">
                          {u.email || '-'}
                        </td>
                        <td className="p-3">{getRoleBadge(u.role)}</td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u)}
                            disabled={isSelf}
                            title={isSelf ? 'Você não pode inativar a si mesmo' : 'Clique para alterar status'}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                              u.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{u.status === 'active' ? 'Ativo' : 'Inativo'}</span>
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.role === 'admin' || u.allowedProjects.includes('all') ? (
                              <span className="bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-700">
                                Todas as Obras (Global)
                              </span>
                            ) : u.allowedProjects.length === 0 ? (
                              <span className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded">
                                Nenhuma Obra
                              </span>
                            ) : (
                              u.allowedProjects.map((p) => {
                                const norm = normalizeProjectCode(p);
                                return (
                                  <span
                                    key={p}
                                    className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                                  >
                                    {norm}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u, true)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer"
                              title="Dar permissões / Modificar obras"
                            >
                              <Key className="w-3 h-3 text-amber-500" />
                              <span>Permissões</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Editar Dados e Senha"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {!isSelf && u.username !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteUser(u.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Excluir Usuário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Projects (Obras) */}
        {activeTab === 'projects' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 bg-amber-500/5 border border-amber-500/20 px-3 py-2 rounded-xl">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Cada obra cadastrada funciona de maneira totalmente isolada. Os novos lançamentos ficam exclusivamente vinculados à sua obra.
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Nome Oficial da Obra</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Máquinas</th>
                    <th className="p-3">Descrição / Detalhes</th>
                    <th className="p-3 text-right">Operação & Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {filteredProjects.map((p) => {
                    const normCode = normalizeProjectCode(p.code);
                    const isActiveOperating =
                      currentSelectedProject && normalizeProjectCode(currentSelectedProject) === normCode;
                    const machineCount = equipmentsCountByProject[normCode] || 0;

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isActiveOperating
                            ? 'bg-amber-500/10 dark:bg-amber-500/15 font-semibold'
                            : 'hover:bg-slate-50/80 dark:hover:bg-zinc-850/50'
                        }`}
                      >
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                          <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">
                            {p.code}
                          </span>
                        </td>
                        <td className="p-3 text-slate-800 dark:text-zinc-200">
                          <div className="flex items-center gap-2">
                            <span>{p.name}</span>
                            {isActiveOperating && (
                              <span className="bg-emerald-500 text-black text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase">
                                Em Operação
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              p.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30'
                            }`}
                          >
                            {p.status === 'active' ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-[11px] text-slate-600 dark:text-zinc-300 font-bold">
                            {machineCount} {machineCount === 1 ? 'máquina' : 'máquinas'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 dark:text-zinc-400 text-[11px] max-w-xs truncate">
                          {p.description || '-'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onSelectProject && (
                              <button
                                type="button"
                                onClick={() => onSelectProject(p.code)}
                                disabled={isActiveOperating}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  isActiveOperating
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 cursor-default'
                                    : 'bg-amber-500 hover:bg-amber-400 text-black'
                                }`}
                                title={isActiveOperating ? 'Obra atualmente em operação' : 'Trocar para esta obra'}
                              >
                                {isActiveOperating ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-500" />
                                    <span>Obra Atual</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-2.5 h-2.5 fill-black" />
                                    <span>Operar Aqui</span>
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenEditProject(p)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Editar Obra"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (normCode === UNIFIED_WORK_CODE) {
                                  alert(
                                    'A Obra 063/064 contém a base histórica consolidada de dados e não pode ser excluída.'
                                  );
                                  return;
                                }
                                onDeleteProject(p.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Excluir Obra"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-100 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500">
          <span>
            {activeTab === 'users'
              ? 'As permissões configuradas refletem imediatamente em tempo real para os usuários.'
              : 'Novas obras abertas ficam disponíveis imediatamente para seleção de frotas e usuários.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-white px-4 py-1.5 rounded-xl font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* User Edit / Create Sub-Modal */}
      {isUserFormOpen && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-xl rounded-2xl p-6 shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-zinc-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingUser ? 'Editar Usuário & Permissões' : 'Criar Novo Usuário'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Configure os dados cadastrais, perfil de acesso e obras autorizadas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUserFormOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    placeholder="Ex: Carlos Eduardo da Silva"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Login / Usuário *
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.username}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, username: e.target.value.toLowerCase() })
                    }
                    placeholder="Ex: carlos.silva"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                    <span>Senha de Acesso *</span>
                    {(userFormData.role === 'admin' || userFormData.username === 'admin') && (
                      <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Confidencial / Oculta
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={
                        showUserPassword && userFormData.role !== 'admin' && userFormData.username !== 'admin'
                          ? 'text'
                          : 'password'
                      }
                      required
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                      placeholder="Digite a senha..."
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 pr-10 text-slate-900 dark:text-white outline-hidden focus:border-amber-500 font-mono tracking-widest"
                      autoComplete="new-password"
                    />
                    {userFormData.role !== 'admin' && userFormData.username !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => setShowUserPassword(!showUserPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                        title={showUserPassword ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    placeholder="exemplo@makmo.com.br"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Perfil de Acesso *
                  </label>
                  <select
                    value={userFormData.role}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, role: e.target.value as UserRole })
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-hidden focus:border-amber-500 font-semibold"
                  >
                    <option value="admin">Administrador (Acesso Irrestrito)</option>
                    <option value="gestor">Gestor (Edição & Controle)</option>
                    <option value="controlador">Controlador (Lançamento Operacional)</option>
                    <option value="visualizador">Visualizador (Somente Consulta)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Status do Usuário
                  </label>
                  <select
                    value={userFormData.status}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        status: e.target.value as 'active' | 'inactive',
                      })
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-hidden focus:border-amber-500"
                  >
                    <option value="active">Ativo (Pode Acessar)</option>
                    <option value="inactive">Inativo (Bloqueado)</option>
                  </select>
                </div>
              </div>

              {/* Informative Role Capability Card */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-slate-700 dark:text-zinc-300">
                <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Capacidades do Perfil: {userFormData.role.toUpperCase()}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {getRoleCapabilityDescription(userFormData.role)}
                </p>
              </div>

              {/* Obras autorizadas */}
              <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700 dark:text-zinc-300">
                    Permissão de Acesso por Obra *
                  </label>
                  {userFormData.role !== 'admin' && !userFormData.allowedProjects.includes('all') && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllProjects}
                        className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Marcar Todas
                      </button>
                      <span className="text-slate-300 dark:text-zinc-700">•</span>
                      <button
                        type="button"
                        onClick={handleClearAllProjects}
                        className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                      >
                        Desmarcar Todas
                      </button>
                    </div>
                  )}
                </div>

                {userFormData.role === 'admin' ? (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      O perfil <strong>Administrador</strong> possui permissão global irrestrita a todas as obras atuais e futuras.
                    </span>
                  </p>
                ) : (
                  <div className="space-y-2.5 bg-slate-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <label className="flex items-center gap-2.5 cursor-pointer font-bold text-slate-800 dark:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={userFormData.allowedProjects.includes('all')}
                        onChange={() => handleToggleProjectPermission('all')}
                        className="w-4 h-4 rounded-sm text-amber-500 focus:ring-amber-500"
                      />
                      <span>Acesso Global a Todas as Obras</span>
                    </label>

                    {!userFormData.allowedProjects.includes('all') && (
                      <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 mb-2">
                          Selecione especificamente as frentes de trabalho que este usuário pode visualizar e operar:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                          {deduplicatedProjects.map((proj) => {
                            const normCode = normalizeProjectCode(proj.code);
                            const isChecked = userFormData.allowedProjects.some(
                              (p) => normalizeProjectCode(p) === normCode
                            );
                            return (
                              <label
                                key={proj.id}
                                className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-amber-500/15 border-amber-500/40 text-slate-900 dark:text-white font-bold'
                                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-amber-500/30'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleProjectPermission(proj.code)}
                                  className="w-4 h-4 rounded-sm text-amber-500 focus:ring-amber-500"
                                />
                                <div className="truncate flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-xs">{proj.code}</span>
                                    <span
                                      className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                                        proj.status === 'active'
                                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                          : 'bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                                      }`}
                                    >
                                      {proj.status === 'active' ? 'Ativa' : 'Inativa'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate block">
                                    {proj.name}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsUserFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2 rounded-xl shadow-xs cursor-pointer"
                >
                  {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Edit / Create Sub-Modal */}
      {isProjectFormOpen && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-zinc-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingProject ? 'Editar Obra' : 'Abrir Nova Obra'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Cadastre uma nova frente operacional independente
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProjectFormOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProjectSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Código da Obra / Local *
                </label>
                <input
                  type="text"
                  required
                  value={projectFormData.code}
                  onChange={(e) =>
                    setProjectFormData({ ...projectFormData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="Ex: 065, 066, SCP 065 ou Lote 2"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-hidden focus:border-amber-500 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
                  Identificador de referência para maquinários, relatórios e controle de acesso.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Nome Oficial da Obra *
                </label>
                <input
                  type="text"
                  required
                  value={projectFormData.name}
                  onChange={(e) =>
                    setProjectFormData({ ...projectFormData, name: e.target.value })
                  }
                  placeholder="Ex: Obra 065 - Trecho Norte / Lote 2"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Status da Obra
                </label>
                <select
                  value={projectFormData.status}
                  onChange={(e) =>
                    setProjectFormData({
                      ...projectFormData,
                      status: e.target.value as 'active' | 'inactive',
                    })
                  }
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-hidden focus:border-amber-500 font-semibold"
                >
                  <option value="active">Ativa (Frente de Serviço em Operação)</option>
                  <option value="inactive">Inativa / Concluída</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Descrição / Localização
                </label>
                <textarea
                  rows={2}
                  value={projectFormData.description}
                  onChange={(e) =>
                    setProjectFormData({ ...projectFormData, description: e.target.value })
                  }
                  placeholder="Detalhes operacionais, trecho da rodovia ou localização..."
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-hidden focus:border-amber-500"
                />
              </div>

              {!editingProject && onSelectProject && (
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-800 dark:text-zinc-200 font-bold">
                    <input
                      type="checkbox"
                      checked={projectFormData.activateNow}
                      onChange={(e) =>
                        setProjectFormData({ ...projectFormData, activateNow: e.target.checked })
                      }
                      className="w-4 h-4 rounded-sm text-amber-500 focus:ring-amber-500"
                    />
                    <span>Definir esta nova obra como a obra ativa no sistema agora</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsProjectFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2 rounded-xl shadow-xs cursor-pointer"
                >
                  {editingProject ? 'Salvar Alterações' : 'Cadastrar Obra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
