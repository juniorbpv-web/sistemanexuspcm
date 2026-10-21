import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Equipment,
  DailyLog,
  FuelDispense,
  FuelEntry,
  ActiveTab,
  AuthUser,
  FuelInvoiceFile,
  PreventivePlan,
  PreventiveRecord,
  MeasurementDeduction,
  CorrectiveMaintenance,
  AppUser,
  AppProject,
  CurrentSession,
} from './types';
import {
  loadAppUsers,
  saveAppUsers,
  loadAppProjects,
  saveAppProjects,
  loadCurrentSession,
  saveCurrentSession,
  matchesSelectedProject,
  normalizeProjectCode,
} from './utils/authStorage';
import { ProjectSelectorModal } from './components/ProjectSelectorModal';
import { AdminManagementModal } from './components/AdminManagementModal';
import {
  loadEquipments,
  saveEquipments,
  loadDailyLogs,
  saveDailyLogs,
  loadFuelDispenses,
  saveFuelDispenses,
  loadFuelEntries,
  saveFuelEntries,
  loadPreventivePlans,
  savePreventivePlans,
  loadPreventiveRecords,
  savePreventiveRecords,
  clearPreventiveLocalStorage,
  clearFuelLocalStorage,
  clearCorrectiveLocalStorage,
  loadSavedTheme,
  saveTheme,
  exportDailyLogsToCSV,
  exportFuelReportToCSV,
  sortDailyLogsAscending,
  loadMeasurementDeductions,
  saveMeasurementDeductions,
  loadCorrectiveMaintenances,
  saveCorrectiveMaintenances,
  getTodayDateString,
} from './utils/storage';
import { exportFuelReportToExcel } from './utils/excelFuelExport';
import { calculateEquipmentPreventive, createDefaultPlanForEquipment } from './utils/preventiveUtils';
import { getSavedSession, clearSession } from './services/authService';
import { LoginScreen } from './components/LoginScreen';
import {
  INITIAL_EQUIPMENTS,
  INITIAL_LOGS,
  INITIAL_FUEL_DISPENSES,
  INITIAL_FUEL_ENTRIES,
  INITIAL_PREVENTIVE_PLANS,
  INITIAL_PREVENTIVE_RECORDS,
  INITIAL_CORRECTIVE_MAINTENANCES,
} from './data/initialData';
import {
  subscribeEquipments,
  subscribeDailyLogs,
  subscribeFuelDispenses,
  subscribeFuelEntries,
  subscribePreventivePlans,
  subscribePreventiveRecords,
  subscribeMeasurementDeductions,
  subscribeCorrectiveMaintenances,
  saveEquipmentToFirestore,
  updateEquipmentInFirestore,
  deleteEquipmentFromFirestore,
  saveDailyLogToFirestore,
  deleteDailyLogFromFirestore,
  saveFuelDispenseToFirestore,
  updateFuelDispenseInFirestore,
  deleteFuelDispenseFromFirestore,
  saveFuelEntryToFirestore,
  updateFuelEntryInFirestore,
  deleteFuelEntryFromFirestore,
  savePreventivePlanToFirestore,
  deletePreventivePlanFromFirestore,
  savePreventiveRecordToFirestore,
  deletePreventiveRecordFromFirestore,
  saveCorrectiveMaintenanceToFirestore,
  deleteCorrectiveMaintenanceFromFirestore,
  restoreFirestoreDefaults,
  clearFuelDataFromFirestore,
  clearPreventiveDataFromFirestore,
  clearCorrectiveDataFromFirestore,
  seedInitialDataIfEmpty,
  testFirestoreConnection,
  subscribeAppUsers,
  saveUserToFirestore,
  deleteUserFromFirestore,
  subscribeAppProjects,
  saveProjectToFirestore,
  deleteProjectFromFirestore,
} from './services/firebaseService';
import {
  loadInvoiceFilesFromIndexedDB,
  saveInvoiceFileToIndexedDB,
  deleteInvoiceFileFromIndexedDB,
  saveInvoiceFileToFirestore,
  deleteInvoiceFileFromFirestore,
  subscribeInvoiceFiles,
} from './services/fuelFilesService';
import { deleteFilesByEquipmentId } from './services/equipmentFilesService';
import {
  saveMultipleCorrectivePhotosToIndexedDB,
  rehydrateCorrectivePhotosFromIndexedDB,
  seedInitialCorrectivePhotosToIndexedDB,
} from './services/correctiveFilesService';
import { Navbar } from './components/Navbar';
import { EquipmentsTab } from './components/EquipmentsTab';
import { DailyLogTab } from './components/DailyLogTab';
import { FuelControlTab } from './components/FuelControlTab';
import { FuelInvoicesTab } from './components/FuelInvoicesTab';
import { PreventiveMaintenanceTab } from './components/PreventiveMaintenanceTab';
import { MeasurementDeductionTab } from './components/deduction/MeasurementDeductionTab';
import { CorrectiveMaintenanceTab } from './components/corrective/CorrectiveMaintenanceTab';
import { GmailIntegrationModal } from './components/GmailIntegrationModal';
import {
  sendDailyFleetReport,
  loadGmailConfig,
  getGmailAccessToken,
} from './services/gmailService';
import { ToastContainer, ToastMessage } from './components/Toast';
import { MakmoLogo } from './components/MakmoLogo';
import { OverduePreventiveItem } from './components/OverdueNotificationBell';
import { SupabaseConnectionModal } from './components/SupabaseConnectionModal';
import {
  isSupabaseConfigured,
  initSupabaseRemoteConfig,
  onSupabaseConfigChange,
} from './services/supabaseService';

export default function App() {
  // Authentication & Access Control state
  const [appUsers, setAppUsers] = useState<AppUser[]>(loadAppUsers);
  const [appProjects, setAppProjects] = useState<AppProject[]>(loadAppProjects);
  const [session, setSession] = useState<CurrentSession | null>(loadCurrentSession);
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
  const [isAdminManagementOpen, setIsAdminManagementOpen] = useState(false);
  const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);

  const currentUser: AuthUser | null = useMemo(() => {
    if (!session) return null;
    return {
      username: session.user.username,
      name: session.user.name,
      role: session.user.role,
      loginTime: session.loginTime,
    };
  }, [session]);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(loadSavedTheme);

  // Main Active Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('database');

  // Cloud database status
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'syncing' | 'offline'>('syncing');

  // Persistence State
  const [equipments, setEquipments] = useState<Equipment[]>(loadEquipments);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>(loadDailyLogs);
  const [fuelDispenses, setFuelDispenses] = useState<FuelDispense[]>(loadFuelDispenses);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>(loadFuelEntries);
  const [invoiceFiles, setInvoiceFiles] = useState<FuelInvoiceFile[]>([]);
  const [preventivePlans, setPreventivePlans] = useState<PreventivePlan[]>(loadPreventivePlans);
  const [preventiveRecords, setPreventiveRecords] = useState<PreventiveRecord[]>(loadPreventiveRecords);
  const [deductionsCount, setDeductionsCount] = useState<number>(() => loadMeasurementDeductions(loadEquipments()).length);
  const [correctiveMaintenances, setCorrectiveMaintenances] = useState<CorrectiveMaintenance[]>(() =>
    loadCorrectiveMaintenances()
  );

  // Overdue Bell Popover & Navigation state
  const [isOverdueBellOpen, setIsOverdueBellOpen] = useState(false);
  const [preventiveStatusFilter, setPreventiveStatusFilter] = useState<string>('todos');
  const [preventiveTargetEquipmentId, setPreventiveTargetEquipmentId] = useState<string | undefined>(undefined);


  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [cloudSyncKey, setCloudSyncKey] = useState(0);

  // Apply dark mode class to HTML root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  // Cor do Sistema: Fixada na tradicional cor Laranja Makmo
  useEffect(() => {
    document.documentElement.setAttribute('data-theme-color', 'orange');
    try {
      localStorage.removeItem('makmo_system_color_theme');
    } catch {}
  }, []);

  // Database connection and real-time subscription setup (Supabase / Firestore)
  useEffect(() => {
    let unsubEquipments: (() => void) | null = null;
    let unsubLogs: (() => void) | null = null;
    let unsubDispenses: (() => void) | null = null;
    let unsubEntries: (() => void) | null = null;
    let unsubPlans: (() => void) | null = null;
    let unsubRecords: (() => void) | null = null;
    let unsubInvoiceFiles: (() => void) | null = null;
    let unsubDeductions: (() => void) | null = null;
    let unsubCorrectives: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;
    let unsubProjects: (() => void) | null = null;

    // Check remote server config on Hostinger
    initSupabaseRemoteConfig().then((configured) => {
      if (configured) {
        setCloudSyncKey((k) => k + 1);
      }
    });

    const unsubConfig = onSupabaseConfigChange(() => {
      setCloudSyncKey((k) => k + 1);
    });

    async function initDatabase() {
      try {
        setCloudStatus('syncing');
        // Validate connection to server / cloud
        const connected = await testFirestoreConnection();
        if (connected) {
          setCloudStatus('connected');
          // Seed initial data if remote is blank
          await seedInitialDataIfEmpty();
        } else {
          setCloudStatus('offline');
        }
      } catch (err) {
        console.warn('Firebase init check failed, using local mode:', err);
        setCloudStatus('offline');
      }

      // Subscribe to real-time equipments
      unsubEquipments = subscribeEquipments(
        (items) => {
          setEquipments(items);
          setCloudStatus('connected');
          const eq117 = INITIAL_EQUIPMENTS.find((e) => e.id === 'eq-117');
          const eq118 = INITIAL_EQUIPMENTS.find((e) => e.id === 'eq-118');
          if (eq117) saveEquipmentToFirestore(eq117).catch(() => {});
          if (eq118) saveEquipmentToFirestore(eq118).catch(() => {});
        },
        () => setCloudStatus('offline')
      );

      // Subscribe to real-time daily logs
      unsubLogs = subscribeDailyLogs(
        (items) => {
          setDailyLogs(items);
          setCloudStatus('connected');
        },
        () => setCloudStatus('offline')
      );

      // Subscribe to real-time fuel dispenses
      unsubDispenses = subscribeFuelDispenses(
        (items) => {
          setFuelDispenses(items);
          setCloudStatus('connected');
        },
        () => setCloudStatus('offline')
      );

      // Subscribe to real-time fuel entries
      unsubEntries = subscribeFuelEntries(
        (items) => {
          setFuelEntries(items);
          setCloudStatus('connected');
        },
        () => setCloudStatus('offline')
      );

      // Subscribe to real-time preventive maintenance plans
      unsubPlans = subscribePreventivePlans(
        (items) => {
          setPreventivePlans(items);
        },
        (err) => console.warn('Aviso de sincronização de planos preventivos:', err)
      );

      // Subscribe to real-time preventive maintenance records
      unsubRecords = subscribePreventiveRecords(
        (items) => {
          setPreventiveRecords(items);
        },
        (err) => console.warn('Aviso de sincronização de registros preventivos:', err)
      );

      // Load initial invoice files from IndexedDB
      loadInvoiceFilesFromIndexedDB()
        .then((stored) => {
          if (stored && stored.length > 0) {
            setInvoiceFiles(stored);
          }
        })
        .catch((err) => console.warn('Erro ao carregar arquivos locais:', err));

      // Subscribe to real-time fuel invoice files
      unsubInvoiceFiles = subscribeInvoiceFiles(
        (files) => {
          setInvoiceFiles(files);
        },
        (err) => console.warn('Aviso de sincronização de arquivos:', err)
      );

      // Subscribe to real-time measurement deductions
      unsubDeductions = subscribeMeasurementDeductions(
        (items) => {
          setDeductionsCount(items ? items.length : 0);
        },
        (err) => console.warn('Aviso de sincronização de deduções:', err)
      );

      // Seed initial corrective photos & rehydrate corrective maintenance photos from IndexedDB
      seedInitialCorrectivePhotosToIndexedDB(INITIAL_CORRECTIVE_MAINTENANCES).catch(() => {});
      rehydrateCorrectivePhotosFromIndexedDB(loadCorrectiveMaintenances())
        .then((rehydrated) => {
          if (rehydrated && rehydrated.length > 0) {
            setCorrectiveMaintenances(rehydrated);
          }
        })
        .catch((err) => console.warn('Erro ao reidratar fotos de corretivas:', err));

      // Subscribe to real-time corrective maintenances
      unsubCorrectives = subscribeCorrectiveMaintenances(
        async (items) => {
          const list = items || [];
          const rehydrated = await rehydrateCorrectivePhotosFromIndexedDB(list);
          setCorrectiveMaintenances(rehydrated);
          saveCorrectiveMaintenances(rehydrated);
        },
        (err) => console.warn('Aviso de sincronização de corretivas:', err)
      );

      // Subscribe to real-time app users
      unsubUsers = subscribeAppUsers((users) => {
        setAppUsers(users);
        setSession((prev) => {
          if (!prev) return null;
          const matching = users.find((u) => u.id === prev.user.id);
          if (!matching) return prev;
          const updated: CurrentSession = {
            ...prev,
            user: matching,
          };
          saveCurrentSession(updated);
          return updated;
        });
      });

      // Subscribe to real-time app projects (obras)
      unsubProjects = subscribeAppProjects((projects) => {
        setAppProjects(projects);
      });
    }

    initDatabase();

    return () => {
      unsubConfig();
      if (unsubEquipments) unsubEquipments();
      if (unsubLogs) unsubLogs();
      if (unsubDispenses) unsubDispenses();
      if (unsubEntries) unsubEntries();
      if (unsubPlans) unsubPlans();
      if (unsubRecords) unsubRecords();
      if (unsubInvoiceFiles) unsubInvoiceFiles();
      if (unsubDeductions) unsubDeductions();
      if (unsubCorrectives) unsubCorrectives();
      if (unsubUsers) unsubUsers();
      if (unsubProjects) unsubProjects();
    };
  }, [cloudSyncKey]);

  // Toast helpers
  const addToast = (type: 'success' | 'error' | 'info', message: string, title?: string) => {
    const newToast: ToastMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      message,
      title,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // ==========================================
  // DISPARO AUTOMÁTICO DIÁRIO ÀS 06:00 VIA GMAIL
  // ==========================================
  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null;

    const checkAndTriggerDaily0600Report = async () => {
      try {
        const config = await loadGmailConfig();
        if (!config.enabled) return;

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const todayStr = getTodayDateString();

        // Janela de disparo: 06:00 da manhã (06:00 até 06:10)
        const targetHour = config.sendHour ?? 6;
        const targetMinute = config.sendMinute ?? 0;

        const isTimeWindow =
          currentHour === targetHour &&
          currentMinute >= targetMinute &&
          currentMinute <= targetMinute + 10;

        if (isTimeWindow && config.lastSentDate !== todayStr) {
          const token = getGmailAccessToken();
          if (token && equipments.length > 0) {
            console.log('[GMAIL SCHEDULER] Iniciando envio matutino automático às 06:00 da manhã...');
            const result = await sendDailyFleetReport({
              equipments,
              entries: fuelEntries,
              dispenses: fuelDispenses,
              projects: appProjects,
              config,
            });
            addToast(
              'success',
              `Relatório da frota e saldo dos comboios enviado às 06:00 para ${result.recipients?.join(', ')}.`,
              'Envio Matutino das 06:00 Concluído'
            );
          }
        }
      } catch (err: any) {
        console.warn('[GMAIL SCHEDULER WARNING]', err);
      }
    };

    checkAndTriggerDaily0600Report();
    timerId = setInterval(checkAndTriggerDaily0600Report, 45000);

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [equipments, fuelEntries, fuelDispenses, appProjects]);

  // ==========================================
  // AUTENTICAÇÃO, CONTROLE DE ACESSO & OBRAS
  // ==========================================

  const isAdmin = session?.user.role === 'admin';

  // Selected project taking strict authorization into account:
  // Admin gets session?.selectedProject or 'all'. Regular users can NEVER access 'all' or unauthorized projects.
  const selectedProject = useMemo(() => {
    if (!session) return 'all';
    if (isAdmin) return session.selectedProject || 'all';

    const allowed = session.user.allowedProjects || [];
    const isCurrentAllowed = session.selectedProject && session.selectedProject !== 'all' &&
      allowed.some((ap) => normalizeProjectCode(ap) === normalizeProjectCode(session.selectedProject));

    if (isCurrentAllowed) {
      return session.selectedProject;
    }
    // Fallback strictly to first authorized project
    return allowed.length > 0 ? allowed[0] : '';
  }, [session, isAdmin]);

  const handleLoginSuccess = (user: AppUser) => {
    let initialProject = 'all';
    let shouldOpenSelector = false;

    if (user.role === 'admin') {
      initialProject = 'all';
      shouldOpenSelector = true;
    } else if (user.allowedProjects.length >= 1) {
      initialProject = user.allowedProjects[0];
      shouldOpenSelector = user.allowedProjects.length > 1;
    } else {
      initialProject = '';
      shouldOpenSelector = false;
    }

    const newSession: CurrentSession = {
      user,
      selectedProject: initialProject,
      loginTime: new Date().toISOString(),
    };
    setSession(newSession);
    saveCurrentSession(newSession);
    if (shouldOpenSelector) {
      setIsProjectSelectorOpen(true);
    }

    addToast(
      'success',
      `Bem-vindo(a), ${user.name}! Perfil: ${user.role.toUpperCase()}.`,
      'Login Efetuado'
    );
  };

  const handleLogout = () => {
    setSession(null);
    saveCurrentSession(null);
    setIsProjectSelectorOpen(false);
    setIsAdminManagementOpen(false);
    addToast('info', 'Sessão encerrada com sucesso.', 'Logout Realizado');
  };

  const handleSelectProject = (projectCode: string) => {
    if (!session) return;
    const isUserAdmin = session.user.role === 'admin';

    // Regra estrita: Visão Global ('all') é exclusiva para Administrador
    if (projectCode === 'all' && !isUserAdmin) {
      addToast('error', 'Apenas o Administrador possui acesso à Visão Global (Todas as Obras).', 'Acesso Restrito');
      return;
    }

    // Demais usuários só podem selecionar obras expressamente autorizadas
    if (!isUserAdmin) {
      const allowed = session.user.allowedProjects || [];
      const hasPermission = allowed.some(
        (ap) => normalizeProjectCode(ap) === normalizeProjectCode(projectCode)
      );
      if (!hasPermission) {
        addToast('error', 'Você não possui permissão para acessar esta obra.', 'Acesso Negado');
        return;
      }
    }

    const updated: CurrentSession = {
      ...session,
      selectedProject: projectCode,
    };
    setSession(updated);
    saveCurrentSession(updated);
    setIsProjectSelectorOpen(false);
    const displayName = projectCode === 'all' ? 'Todas as Obras (Visão Global)' : projectCode;
    addToast('success', `Obra ativa alterada para: ${displayName}`, 'Troca de Obra');
  };

  // Helper de validação de isolamento multi-tenant
  const isAuthorizedProjectData = useCallback((location?: string, obraId?: string) => {
    if (isAdmin && selectedProject === 'all') return true;
    if (isAdmin) {
      return matchesSelectedProject(location || '', selectedProject, obraId);
    }
    // Demais usuários: visualizam somente as obras autorizadas
    const allowed = session?.user.allowedProjects || [];
    if (selectedProject && selectedProject !== 'all') {
      const isAllowedThis = allowed.some((ap) => normalizeProjectCode(ap) === normalizeProjectCode(selectedProject));
      if (!isAllowedThis) return false;
      return matchesSelectedProject(location || '', selectedProject, obraId);
    }
    return allowed.some((ap) => matchesSelectedProject(location || '', ap, obraId));
  }, [isAdmin, selectedProject, session?.user.allowedProjects]);

  // Filtered dataset according to active obra (Multi-tenant data isolation)
  const filteredEquipments = useMemo(() => {
    return equipments.filter((eq) => isAuthorizedProjectData(eq.location, eq.obra_id));
  }, [equipments, isAuthorizedProjectData]);

  const filteredDailyLogs = useMemo(() => {
    return dailyLogs.filter((log) => isAuthorizedProjectData(log.location, log.obra_id));
  }, [dailyLogs, isAuthorizedProjectData]);

  const filteredFuelDispenses = useMemo(() => {
    return fuelDispenses.filter((d) => isAuthorizedProjectData(d.location, d.obra_id));
  }, [fuelDispenses, isAuthorizedProjectData]);

  const filteredFuelEntries = useMemo(() => {
    return fuelEntries.filter((e) => isAuthorizedProjectData(e.location, e.obra_id));
  }, [fuelEntries, isAuthorizedProjectData]);

  const filteredInvoiceFiles = useMemo(() => {
    return invoiceFiles.filter((f) => isAuthorizedProjectData(f.location, f.obra_id));
  }, [invoiceFiles, isAuthorizedProjectData]);

  const filteredCorrectiveMaintenances = useMemo(() => {
    if (isAdmin && selectedProject === 'all') return correctiveMaintenances;
    const allowedIds = new Set(filteredEquipments.map((e) => e.id));
    return correctiveMaintenances.filter(
      (c) =>
        isAuthorizedProjectData(c.location, c.obra_id) ||
        (c.equipmentId && allowedIds.has(c.equipmentId))
    );
  }, [correctiveMaintenances, filteredEquipments, isAuthorizedProjectData, isAdmin, selectedProject]);

  const filteredPreventivePlans = useMemo(() => {
    if (isAdmin && selectedProject === 'all') return preventivePlans;
    const allowedIds = new Set(filteredEquipments.map((e) => e.id));
    return preventivePlans.filter(
      (p) =>
        (p.equipmentId && allowedIds.has(p.equipmentId)) ||
        isAuthorizedProjectData(p.location, p.obra_id)
    );
  }, [preventivePlans, filteredEquipments, isAuthorizedProjectData, isAdmin, selectedProject]);

  const filteredPreventiveRecords = useMemo(() => {
    if (isAdmin && selectedProject === 'all') return preventiveRecords;
    const allowedIds = new Set(filteredEquipments.map((e) => e.id));
    return preventiveRecords.filter(
      (r) =>
        (r.equipmentId && allowedIds.has(r.equipmentId)) ||
        isAuthorizedProjectData(r.location, r.obra_id)
    );
  }, [preventiveRecords, filteredEquipments, isAuthorizedProjectData, isAdmin, selectedProject]);

  const equipmentsCountByProject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const eq of equipments) {
      const code = normalizeProjectCode(eq.obra_id || eq.location);
      if (code) {
        counts[code] = (counts[code] || 0) + 1;
      }
    }
    return counts;
  }, [equipments]);

  // Admin Management Handlers
  const handleSaveUser = (user: AppUser) => {
    const existingIndex = appUsers.findIndex((u) => u.id === user.id);
    let updatedUsers: AppUser[];
    if (existingIndex >= 0) {
      updatedUsers = appUsers.map((u) => (u.id === user.id ? user : u));
    } else {
      updatedUsers = [...appUsers, user];
    }
    setAppUsers(updatedUsers);
    saveAppUsers(updatedUsers);

    if (session && session.user.id === user.id) {
      const updatedSession: CurrentSession = { ...session, user };
      setSession(updatedSession);
      saveCurrentSession(updatedSession);
    }

    saveUserToFirestore(user).catch((err) =>
      console.warn('Saved user locally, cloud sync error:', err)
    );
    addToast('success', `Usuário "${user.name}" salvo com sucesso!`, 'Usuário Atualizado');
  };

  const handleDeleteUser = (userId: string) => {
    const target = appUsers.find((u) => u.id === userId);
    const updatedUsers = appUsers.filter((u) => u.id !== userId);
    setAppUsers(updatedUsers);
    saveAppUsers(updatedUsers);

    deleteUserFromFirestore(userId).catch((err) =>
      console.warn('Deleted user locally, cloud sync error:', err)
    );
    addToast('info', `Usuário "${target ? target.name : ''}" foi excluído.`, 'Usuário Removido');
  };

  const handleSaveProject = (project: AppProject) => {
    const existingIndex = appProjects.findIndex((p) => p.id === project.id);
    let updatedProjects: AppProject[];
    if (existingIndex >= 0) {
      updatedProjects = appProjects.map((p) => (p.id === project.id ? project : p));
    } else {
      updatedProjects = [...appProjects, project];
    }
    setAppProjects(updatedProjects);
    saveAppProjects(updatedProjects);

    saveProjectToFirestore(project).catch((err) =>
      console.warn('Saved project locally, cloud sync error:', err)
    );
    addToast('success', `Obra "${project.code} - ${project.name}" cadastrada com sucesso!`, 'Obra Salva');
  };

  const handleDeleteProject = (projectId: string) => {
    const target = appProjects.find((p) => p.id === projectId);
    const updatedProjects = appProjects.filter((p) => p.id !== projectId);
    setAppProjects(updatedProjects);
    saveAppProjects(updatedProjects);

    deleteProjectFromFirestore(projectId).catch((err) =>
      console.warn('Deleted project locally, cloud sync error:', err)
    );
    addToast('info', `Obra "${target ? target.code : ''}" foi excluída.`, 'Obra Removida');
  };

  // Equipment handlers
  const handleAddEquipment = (
    newEquipmentData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>
  ): boolean => {
    if (session?.user.role === 'visualizador') {
      addToast('error', 'Perfil Visualizador possui acesso somente leitura.', 'Acesso Negado');
      return false;
    }
    // Auto-fill active obra if specific obra is selected and location is blank
    if (selectedProject !== 'all' && (!newEquipmentData.location || newEquipmentData.location.trim() === '')) {
      newEquipmentData.location = selectedProject;
    }

    // Validation: Plate and Prefix uniqueness
    const cleanCode = newEquipmentData.code.trim().toUpperCase();
    const cleanPlate = (newEquipmentData.plate || '').trim().toUpperCase();
    const cleanPrefix = (newEquipmentData.prefix || '').trim().toUpperCase();

    const isDuplicate = equipments.some((eq) => {
      const eqCode = eq.code.trim().toUpperCase();
      const eqPlate = (eq.plate || '').trim().toUpperCase();
      const eqPrefix = (eq.prefix || '').trim().toUpperCase();

      if (eqCode === cleanCode) return true;
      if (cleanPlate && eqPlate && eqPlate === cleanPlate) return true;
      if (cleanPrefix && eqPrefix && eqPrefix === cleanPrefix) return true;
      return false;
    });

    if (isDuplicate) {
      addToast(
        'error',
        `A Placa/Prefixo "${cleanCode}" já está cadastrada para outro equipamento na Base de Dados. Use um identificador único.`,
        'Equipamento Duplicado'
      );
      return false;
    }

    const activeObra = selectedProject !== 'all' ? selectedProject : (newEquipmentData.location || '063/064');
    const newEquipment: Equipment = {
      ...newEquipmentData,
      id: `eq-${Date.now()}`,
      code: cleanCode,
      location: activeObra,
      obra_id: activeObra,
      projectId: activeObra,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic local update
    const updated = [newEquipment, ...equipments];
    setEquipments(updated);
    saveEquipments(updated);

    // Sync to Firestore
    setCloudStatus('syncing');
    saveEquipmentToFirestore(newEquipment)
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Saved locally, background cloud sync error:', err);
      });

    addToast(
      'success',
      `Equipamento ${newEquipment.code} (${newEquipment.type}) cadastrado no banco de dados!`,
      'Cadastro Realizado'
    );
    return true;
  };

  const handleUpdateEquipment = (updatedEq: Equipment): boolean => {
    const cleanCode = updatedEq.code.trim().toUpperCase();
    const cleanPlate = (updatedEq.plate || '').trim().toUpperCase();
    const cleanPrefix = (updatedEq.prefix || '').trim().toUpperCase();

    // Verify plate and prefix uniqueness against others
    const isDuplicate = equipments.some((eq) => {
      if (eq.id === updatedEq.id) return false;
      const eqCode = eq.code.trim().toUpperCase();
      const eqPlate = (eq.plate || '').trim().toUpperCase();
      const eqPrefix = (eq.prefix || '').trim().toUpperCase();

      if (eqCode === cleanCode) return true;
      if (cleanPlate && eqPlate && eqPlate === cleanPlate) return true;
      if (cleanPrefix && eqPrefix && eqPrefix === cleanPrefix) return true;
      return false;
    });

    if (isDuplicate) {
      addToast(
        'error',
        `A Placa/Prefixo "${cleanCode}" já está sendo usada por outro equipamento.`,
        'Placa Duplicada'
      );
      return false;
    }

    const existing = equipments.find((eq) => eq.id === updatedEq.id);

    const finalEq: Equipment = {
      ...(existing || {}),
      ...updatedEq,
      code: cleanCode,
      updatedAt: new Date().toISOString(),
    };

    const updatedList = equipments.map((eq) =>
      eq.id === updatedEq.id ? finalEq : eq
    );

    setEquipments(updatedList);
    saveEquipments(updatedList);

    // Sync to Firestore
    setCloudStatus('syncing');
    updateEquipmentInFirestore(finalEq)
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Updated locally, background cloud sync error:', err);
      });

    addToast(
      'success',
      `Dados do equipamento ${cleanCode} atualizados no banco de dados!`,
      'Equipamento Atualizado'
    );
    return true;
  };

  const handleDeleteEquipment = (id: string) => {
    if (session?.user.role !== 'admin' && session?.user.role !== 'developer') {
      addToast('error', 'Apenas o perfil Administrador possui permissão para excluir equipamentos.', 'Acesso Negado');
      return;
    }
    const target = equipments.find((eq) => eq.id === id);
    const updated = equipments.filter((eq) => eq.id !== id);
    setEquipments(updated);
    saveEquipments(updated);

    // Sync deletion to Firestore
    setCloudStatus('syncing');
    deleteEquipmentFromFirestore(id)
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Deleted locally, background cloud sync error:', err);
      });

    // Clean up any equipment attachments
    deleteFilesByEquipmentId(id);

    addToast(
      'info',
      `Equipamento ${target ? target.code : ''} foi removido da Base de Dados.`,
      'Equipamento Excluído'
    );
  };

  // Daily Log handlers
  const handleSaveDailyLog = (
    logData: Omit<DailyLog, 'id' | 'createdAt'>
  ): { success: boolean; message: string } => {
    // 1. Validation: Plate or Prefix must exist in equipment base
    const cleanSearchCode = logData.equipmentCode.trim().toUpperCase().replace(/[-\s]/g, '');
    const matched = equipments.find((eq) => {
      if (logData.equipmentId && eq.id === logData.equipmentId) return true;
      const c = eq.code.trim().toUpperCase().replace(/[-\s]/g, '');
      const pr = (eq.prefix || '').trim().toUpperCase().replace(/[-\s]/g, '');
      const pl = (eq.plate || '').trim().toUpperCase().replace(/[-\s]/g, '');
      return c === cleanSearchCode || (pr && pr === cleanSearchCode) || (pl && pl === cleanSearchCode);
    });

    if (!matched) {
      const msg = `O equipamento "${logData.equipmentCode}" não foi encontrado na Base de Dados.`;
      addToast('error', msg, 'Falha no Apontamento');
      return { success: false, message: msg };
    }

    // 2. Validation: Final >= Initial
    if (logData.finalHourMeter < logData.initialHourMeter) {
      const msg = 'O Horímetro Final não pode ser menor do que o Horímetro Inicial.';
      addToast('error', msg, 'Leitura Inválida');
      return { success: false, message: msg };
    }

    // 3. Create daily log and immediately sort list in ascending chronological order
    const activeObra = selectedProject !== 'all' ? selectedProject : (logData.location || matched.location || '063/064');
    const newLog: DailyLog = {
      ...logData,
      location: activeObra,
      obra_id: activeObra,
      projectId: activeObra,
      equipmentId: matched.id,
      equipmentCode: matched.prefix || matched.plate || matched.code,
      id: `log-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    const updatedLogs = sortDailyLogsAscending([...dailyLogs, newLog]);
    setDailyLogs(updatedLogs);
    saveDailyLogs(updatedLogs);

    // 4. Advance equipment current hourmeter to the highest recorded value
    const targetHourMeter = Math.max(matched.currentHourMeter || 0, logData.finalHourMeter);
    const updatedEquipments = equipments.map((eq) => {
      if (eq.id === matched.id) {
        return {
          ...eq,
          currentHourMeter: targetHourMeter,
          lastHourMeterDate: logData.date,
          updatedAt: new Date().toISOString(),
        };
      }
      return eq;
    });

    setEquipments(updatedEquipments);
    saveEquipments(updatedEquipments);

    // 5. Sync to Firestore in single atomic batch
    setCloudStatus('syncing');
    saveDailyLogToFirestore(newLog, {
      id: matched.id,
      finalHourMeter: targetHourMeter,
    })
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Saved locally, background cloud sync error:', err);
      });

    const successMsg = `Apontamento da ${newLog.equipmentCode} registrado com sucesso! (${logData.workedHours.toLocaleString('pt-BR')} horas trabalhadas). O horímetro de referência foi atualizado para ${targetHourMeter.toLocaleString('pt-BR')} h.`;
    addToast('success', successMsg, 'Apontamento Salvo no Banco');

    return { success: true, message: successMsg };
  };

  const handleUpdateDailyLog = (
    updatedLog: DailyLog
  ): { success: boolean; message: string } => {
    // 1. Validation: Plate or Prefix must exist in equipment base
    const cleanSearchCode = updatedLog.equipmentCode.trim().toUpperCase().replace(/[-\s]/g, '');
    const matched = equipments.find((eq) => {
      if (updatedLog.equipmentId && eq.id === updatedLog.equipmentId) return true;
      const c = eq.code.trim().toUpperCase().replace(/[-\s]/g, '');
      const pr = (eq.prefix || '').trim().toUpperCase().replace(/[-\s]/g, '');
      const pl = (eq.plate || '').trim().toUpperCase().replace(/[-\s]/g, '');
      return c === cleanSearchCode || (pr && pr === cleanSearchCode) || (pl && pl === cleanSearchCode);
    });

    if (!matched) {
      const msg = `O equipamento "${updatedLog.equipmentCode}" não foi encontrado na Base de Dados.`;
      addToast('error', msg, 'Falha no Apontamento');
      return { success: false, message: msg };
    }

    // 2. Validation: Final >= Initial
    if (updatedLog.finalHourMeter < updatedLog.initialHourMeter) {
      const msg = 'O Horímetro Final não pode ser menor do que o Horímetro Inicial.';
      addToast('error', msg, 'Leitura Inválida');
      return { success: false, message: msg };
    }

    // 3. Update log in dailyLogs array
    const updatedLogs = sortDailyLogsAscending(
      dailyLogs.map((l) => (l.id === updatedLog.id ? updatedLog : l))
    );
    setDailyLogs(updatedLogs);
    saveDailyLogs(updatedLogs);

    // 4. Update equipment currentHourMeter if applicable
    const allLogsForEquip = updatedLogs.filter(
      (l) =>
        (l.equipmentId && l.equipmentId === matched.id) ||
        l.equipmentCode === matched.code ||
        l.equipmentCode === matched.plate ||
        l.equipmentCode === matched.prefix
    );
    const maxFinal = Math.max(0, ...allLogsForEquip.map((l) => l.finalHourMeter || 0));
    const targetHourMeter = Math.max(matched.currentHourMeter || 0, maxFinal);

    const updatedEquipments = equipments.map((eq) => {
      if (eq.id === matched.id) {
        return {
          ...eq,
          currentHourMeter: targetHourMeter,
          updatedAt: new Date().toISOString(),
        };
      }
      return eq;
    });

    setEquipments(updatedEquipments);
    saveEquipments(updatedEquipments);

    // 5. Sync to Firestore in single atomic batch
    setCloudStatus('syncing');
    saveDailyLogToFirestore(updatedLog, {
      id: matched.id,
      finalHourMeter: targetHourMeter,
    })
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Updated log locally, background cloud sync error:', err);
      });

    const successMsg = `Lançamento de horas da máquina ${updatedLog.equipmentCode} atualizado com sucesso!`;
    addToast('success', successMsg, 'Apontamento Atualizado');

    return { success: true, message: successMsg };
  };

  const handleDeleteDailyLog = (id: string) => {
    if (session?.user.role === 'visualizador') {
      addToast('error', 'Perfil Visualizador possui acesso somente leitura.', 'Acesso Negado');
      return;
    }
    const updated = dailyLogs.filter((l) => l.id !== id);
    setDailyLogs(updated);
    saveDailyLogs(updated);

    // Delete in Firestore
    setCloudStatus('syncing');
    deleteDailyLogFromFirestore(id)
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Deleted locally, background cloud sync error:', err);
      });

    addToast('info', 'O lançamento foi removido do registro de partes diárias.', 'Apontamento Excluído');
  };

  const handleRestoreFuelDefaults = () => {
    // Non-destructive safe merge: keep all existing user fuel entries/dispenses and incorporate baseline
    setFuelDispenses((prev) => {
      const dispMap = new Map<string, FuelDispense>();
      INITIAL_FUEL_DISPENSES.forEach((d) => dispMap.set(d.id, d));
      prev.forEach((d) => dispMap.set(d.id, d)); // Existing user records take precedence!
      const merged = Array.from(dispMap.values());
      saveFuelDispenses(merged);
      return merged;
    });

    setFuelEntries((prev) => {
      const entryMap = new Map<string, FuelEntry>();
      INITIAL_FUEL_ENTRIES.forEach((e) => entryMap.set(e.id, e));
      prev.forEach((e) => entryMap.set(e.id, e)); // Existing user records take precedence!
      const merged = Array.from(entryMap.values());
      saveFuelEntries(merged);
      return merged;
    });

    setCloudStatus('syncing');
    seedInitialDataIfEmpty()
      .then(() => {
        setCloudStatus('connected');
        addToast(
          'success',
          'Cargas e abastecimentos sincronizados com segurança sem exclusão de dados!',
          'Combustível Sincronizado'
        );
      })
      .catch((err) => {
        console.warn('Restored fuel locally, cloud sync error:', err);
        setCloudStatus('offline');
        addToast(
          'info',
          'Base de combustível sincronizada localmente.',
          'Sincronização Local'
        );
      });
  };

  const handleRestoreDefaults = () => {
    // Non-destructive safe merge: NEVER delete or overwrite existing user data!
    setEquipments((prev) => {
      const map = new Map<string, Equipment>();
      INITIAL_EQUIPMENTS.forEach((eq) => map.set(eq.id, eq));
      prev.forEach((eq) => {
        const existing = map.get(eq.id);
        map.set(eq.id, existing ? { ...existing, ...eq } : eq);
      });
      const merged = Array.from(map.values());
      saveEquipments(merged);
      return merged;
    });

    setDailyLogs((prev) => {
      const map = new Map<string, DailyLog>();
      INITIAL_LOGS.forEach((l) => map.set(l.id, l));
      prev.forEach((l) => map.set(l.id, l)); // User logs take precedence
      const merged = sortDailyLogsAscending(Array.from(map.values()));
      saveDailyLogs(merged);
      return merged;
    });

    setFuelDispenses((prev) => {
      const map = new Map<string, FuelDispense>();
      INITIAL_FUEL_DISPENSES.forEach((d) => map.set(d.id, d));
      prev.forEach((d) => map.set(d.id, d));
      const merged = Array.from(map.values());
      saveFuelDispenses(merged);
      return merged;
    });

    setFuelEntries((prev) => {
      const map = new Map<string, FuelEntry>();
      INITIAL_FUEL_ENTRIES.forEach((e) => map.set(e.id, e));
      prev.forEach((e) => map.set(e.id, e));
      const merged = Array.from(map.values());
      saveFuelEntries(merged);
      return merged;
    });

    setPreventivePlans((prev) => {
      const map = new Map<string, PreventivePlan>();
      INITIAL_PREVENTIVE_PLANS.forEach((p) => map.set(p.id, p));
      prev.forEach((p) => map.set(p.id, p));
      const merged = Array.from(map.values());
      savePreventivePlans(merged);
      return merged;
    });

    setPreventiveRecords((prev) => {
      const map = new Map<string, PreventiveRecord>();
      INITIAL_PREVENTIVE_RECORDS.forEach((r) => map.set(r.id, r));
      prev.forEach((r) => map.set(r.id, r));
      const merged = Array.from(map.values());
      savePreventiveRecords(merged);
      return merged;
    });

    setCorrectiveMaintenances((prev) => {
      const map = new Map<string, CorrectiveMaintenance>();
      INITIAL_CORRECTIVE_MAINTENANCES.forEach((c) => map.set(c.id, c));
      prev.forEach((c) => map.set(c.id, c));
      const merged = Array.from(map.values());
      saveCorrectiveMaintenances(merged);
      return merged;
    });

    setCloudStatus('syncing');
    restoreFirestoreDefaults()
      .then(() => {
        setCloudStatus('connected');
        addToast(
          'success',
          'Base consolidada sincronizada com segurança sem perda de nenhum dado já existente!',
          'Sincronização Segura'
        );
      })
      .catch((err) => {
        console.warn('Restored locally, cloud sync error:', err);
        setCloudStatus('offline');
        addToast(
          'info',
          'Dados consolidados localmente com segurança.',
          'Sincronização Local'
        );
      });
  };

  // Fuel Dispense handlers
  const handleSaveFuelDispense = (
    dispenseData: Omit<FuelDispense, 'id' | 'createdAt'>
  ): { success: boolean; message: string } => {
    const activeObra = selectedProject !== 'all' ? selectedProject : (dispenseData.location || '063/064');
    const newDispense: FuelDispense = {
      ...dispenseData,
      location: activeObra,
      obra_id: activeObra,
      projectId: activeObra,
      id: `fuel-disp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    const updated = [newDispense, ...fuelDispenses];
    setFuelDispenses(updated);
    saveFuelDispenses(updated);

    setCloudStatus('syncing');
    saveFuelDispenseToFirestore(newDispense)
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Saved fuel dispense locally, background cloud sync error:', err);
      });

    addToast(
      'success',
      `Abastecimento de ${newDispense.liters} L (${newDispense.equipmentCode}) registrado no ${newDispense.convoyPlate}!`,
      'Abastecimento Salvo'
    );
    return { success: true, message: 'Abastecimento registrado com sucesso!' };
  };

  const handleDeleteFuelDispense = (id: string) => {
    const target = fuelDispenses.find((d) => d.id === id);
    const updated = fuelDispenses.filter((d) => d.id !== id);
    setFuelDispenses(updated);
    saveFuelDispenses(updated);

    setCloudStatus('syncing');
    deleteFuelDispenseFromFirestore(id)
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Deleted fuel dispense locally, cloud sync error:', err);
      });

    addToast(
      'info',
      `Lançamento de ${target ? target.liters : ''} L foi removido.`,
      'Abastecimento Excluído'
    );
  };

  const handleUpdateFuelDispense = (
    updatedDispense: FuelDispense
  ): { success: boolean; message: string } => {
    const updated = fuelDispenses.map((d) => (d.id === updatedDispense.id ? updatedDispense : d));
    setFuelDispenses(updated);
    saveFuelDispenses(updated);

    setCloudStatus('syncing');
    updateFuelDispenseInFirestore(updatedDispense)
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Updated fuel dispense locally, background cloud sync error:', err);
      });

    addToast(
      'success',
      `Abastecimento de ${updatedDispense.liters} L (${updatedDispense.equipmentCode}) atualizado com sucesso!`,
      'Abastecimento Atualizado'
    );
    return { success: true, message: 'Abastecimento atualizado com sucesso!' };
  };

  // Fuel Entry handlers
  const handleSaveFuelEntry = (
    entryData: Omit<FuelEntry, 'id' | 'createdAt'>
  ): { success: boolean; message: string } => {
    const activeObra = selectedProject !== 'all' ? selectedProject : (entryData.location || '063/064');
    const newEntry: FuelEntry = {
      ...entryData,
      location: activeObra,
      obra_id: activeObra,
      projectId: activeObra,
      id: `fuel-entry-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    const updated = [newEntry, ...fuelEntries];
    setFuelEntries(updated);
    saveFuelEntries(updated);

    setCloudStatus('syncing');
    saveFuelEntryToFirestore(newEntry)
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Saved fuel entry locally, cloud sync error:', err);
      });

    // Se houver anexo (PDF ou JPEG/JPG), sincronizar também com o repositório de arquivos/NFs
    if (newEntry.attachmentUrl && newEntry.attachmentName) {
      const invoiceFile: FuelInvoiceFile = {
        id: `file_entry_${newEntry.id}`,
        name: newEntry.attachmentName,
        fileType: newEntry.attachmentType || 'PDF',
        mimeType: newEntry.attachmentType === 'PDF' ? 'application/pdf' : 'image/jpeg',
        size: newEntry.attachmentSize || 0,
        uploadedAt: new Date().toISOString(),
        formattedDate: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        dataUrl: newEntry.attachmentUrl,
        location: activeObra,
        obra_id: activeObra,
        projectId: activeObra,
        notes: `Anexo da Entrada de Diesel (${newEntry.liters} L - NF: ${newEntry.invoiceNumber || 'S/N'})`,
      };
      saveInvoiceFileToIndexedDB(invoiceFile).catch(() => {});
      saveInvoiceFileToFirestore(invoiceFile).catch(() => {});
      setInvoiceFiles((prev) => [invoiceFile, ...prev.filter((f) => f.id !== invoiceFile.id)]);
    }

    addToast(
      'success',
      `Entrada de ${newEntry.liters} L de diesel registrada com sucesso!`,
      'Entrada de Combustível'
    );
    return { success: true, message: 'Entrada registrada com sucesso!' };
  };

  const handleUpdateFuelEntry = (
    updatedEntry: FuelEntry
  ): { success: boolean; message: string } => {
    if (session?.user.role === 'visualizador') {
      addToast('error', 'Perfil Visualizador possui acesso somente leitura.', 'Acesso Negado');
      return { success: false, message: 'Perfil Visualizador possui acesso somente leitura.' };
    }

    const activeObra = selectedProject !== 'all' ? selectedProject : (updatedEntry.location || '063/064');
    const enrichedEntry: FuelEntry = {
      ...updatedEntry,
      location: activeObra,
      obra_id: activeObra,
      projectId: activeObra,
    };
    const updated = fuelEntries.map((e) => (e.id === updatedEntry.id ? enrichedEntry : e));
    setFuelEntries(updated);
    saveFuelEntries(updated);

    setCloudStatus('syncing');
    updateFuelEntryInFirestore(enrichedEntry)
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Updated fuel entry locally, background cloud sync error:', err);
      });

    // Se houver anexo com payload, sincronizar com os arquivos do sistema
    if (enrichedEntry.attachmentUrl && enrichedEntry.attachmentName) {
      const invoiceFile: FuelInvoiceFile = {
        id: `file_entry_${enrichedEntry.id}`,
        name: enrichedEntry.attachmentName,
        fileType: enrichedEntry.attachmentType || 'PDF',
        mimeType: enrichedEntry.attachmentType === 'PDF' ? 'application/pdf' : 'image/jpeg',
        size: enrichedEntry.attachmentSize || 0,
        uploadedAt: new Date().toISOString(),
        formattedDate: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        dataUrl: enrichedEntry.attachmentUrl,
        location: activeObra,
        obra_id: activeObra,
        projectId: activeObra,
        notes: `Anexo da Entrada de Diesel (${enrichedEntry.liters} L - NF: ${enrichedEntry.invoiceNumber || 'S/N'})`,
      };
      saveInvoiceFileToIndexedDB(invoiceFile).catch(() => {});
      saveInvoiceFileToFirestore(invoiceFile).catch(() => {});
      setInvoiceFiles((prev) => [invoiceFile, ...prev.filter((f) => f.id !== invoiceFile.id)]);
    } else if (!updatedEntry.attachmentName && !updatedEntry.attachmentUrl) {
      // Deletar o arquivo SOMENTE se foi explicitamente removido (sem nome e sem URL)
      const fileId = `file_entry_${updatedEntry.id}`;
      deleteInvoiceFileFromFirestore(fileId).catch(() => {});
      deleteInvoiceFileFromIndexedDB(fileId).catch(() => {});
      setInvoiceFiles((prev) => prev.filter((f) => f.id !== fileId));
    }

    addToast(
      'success',
      `Entrada de ${updatedEntry.liters} L atualizada com sucesso!`,
      'Entrada Atualizada'
    );
    return { success: true, message: 'Entrada atualizada com sucesso!' };
  };

  const handleDeleteFuelEntry = (id: string) => {
    const updated = fuelEntries.filter((e) => e.id !== id);
    setFuelEntries(updated);
    saveFuelEntries(updated);

    const fileId = `file_entry_${id}`;
    deleteInvoiceFileFromFirestore(fileId).catch(() => {});
    deleteInvoiceFileFromIndexedDB(fileId).catch(() => {});
    setInvoiceFiles((prev) => prev.filter((f) => f.id !== fileId));

    setCloudStatus('syncing');
    deleteFuelEntryFromFirestore(id)
      .then(() => {
        setCloudStatus('connected');
      })
      .catch((err) => {
        console.warn('Deleted fuel entry locally, cloud sync error:', err);
      });

    addToast('info', 'Entrada de diesel removida.', 'Entrada Excluída');
  };

  const handleExportCSV = () => {
    exportDailyLogsToCSV(dailyLogs);
  };

  const handleExportFuelCSV = async () => {
    try {
      await exportFuelReportToExcel(fuelDispenses, equipments, {
        obraText: '063/064',
        responsibleText: 'Roberto Jr',
      });
      addToast('success', 'Relatório padronizado em Excel exportado com sucesso.', 'Exportação Concluída');
    } catch (err) {
      console.warn('Excel export error, using CSV fallback:', err);
      exportFuelReportToCSV(fuelEntries, fuelDispenses, undefined, equipments);
      addToast('info', 'Relatório padronizado exportado em CSV.', 'Exportação Concluída');
    }
  };

  const handleResetFuelData = async () => {
    if (session?.user.role !== 'admin' && session?.user.role !== 'developer') {
      addToast('error', 'Apenas o perfil Administrador possui permissão para zerar lançamentos de combustível.', 'Acesso Negado');
      return;
    }
    clearFuelLocalStorage();
    setFuelDispenses([]);
    setFuelEntries([]);
    setCloudStatus('syncing');
    try {
      await clearFuelDataFromFirestore();
      setCloudStatus('connected');
      addToast(
        'success',
        'Aba Gestão de Combustível zerada com sucesso! Pronto para novos lançamentos.',
        'Combustível Zerado'
      );
    } catch (err) {
      console.warn('Erro ao zerar no Firestore, zerado localmente:', err);
      setCloudStatus('offline');
      addToast(
        'info',
        'Lançamentos zerados localmente no navegador.',
        'Combustível Zerado'
      );
    }
  };

  // Fuel Invoice Files Handlers
  const handleAddInvoiceFile = async (file: FuelInvoiceFile) => {
    try {
      const activeObra = selectedProject !== 'all' ? selectedProject : (file.obra_id || file.location || '063/064');
      const enrichedFile: FuelInvoiceFile = {
        ...file,
        location: activeObra,
        obra_id: activeObra,
        projectId: activeObra,
      };
      await saveInvoiceFileToIndexedDB(enrichedFile);
      setInvoiceFiles((prev) => [enrichedFile, ...prev.filter((f) => f.id !== enrichedFile.id)]);

      saveInvoiceFileToFirestore(enrichedFile).catch((err) => {
        console.warn('Erro ao sincronizar arquivo com Firestore:', err);
      });

      addToast('success', `Nota Fiscal "${enrichedFile.name}" salva com sucesso!`, 'Arquivo Salvo');
    } catch (err) {
      console.error('Falha ao salvar arquivo no armazenamento:', err);
      addToast('error', 'Falha ao salvar o arquivo.', 'Erro no Armazenamento');
    }
  };

  const handleDeleteInvoiceFile = async (id: string) => {
    try {
      const file = invoiceFiles.find((f) => f.id === id);
      await deleteInvoiceFileFromIndexedDB(id);
      setInvoiceFiles((prev) => prev.filter((f) => f.id !== id));

      deleteInvoiceFileFromFirestore(id).catch((err) => {
        console.warn('Erro ao remover arquivo do Firestore:', err);
      });

      addToast('info', `Arquivo "${file?.name || 'selecionado'}" excluído.`, 'Arquivo Excluído');
    } catch (err) {
      console.error('Falha ao excluir arquivo:', err);
      addToast('error', 'Falha ao remover o arquivo.', 'Erro ao Excluir');
    }
  };

  // Preventive Maintenance Handlers (PCM)
  const handleSavePreventivePlan = async (plan: PreventivePlan) => {
    const activeObra = selectedProject !== 'all' ? selectedProject : (plan.obra_id || plan.location || '063/064');
    const enrichedPlan: PreventivePlan = {
      ...plan,
      location: activeObra,
      obra_id: activeObra,
      projectId: activeObra,
    };
    const updatedPlans = preventivePlans.some((p) => p.equipmentId === enrichedPlan.equipmentId)
      ? preventivePlans.map((p) => (p.equipmentId === enrichedPlan.equipmentId ? enrichedPlan : p))
      : [...preventivePlans, enrichedPlan];

    setPreventivePlans(updatedPlans);
    savePreventivePlans(updatedPlans);

    setCloudStatus('syncing');
    try {
      await savePreventivePlanToFirestore(enrichedPlan);
      setCloudStatus('connected');
      addToast(
        'success',
        `Plano de manutenção preventiva configurado para ${enrichedPlan.equipmentCode}!`,
        'Plano Salvo'
      );
    } catch (err) {
      console.warn('Erro ao salvar plano no Firestore:', err);
      setCloudStatus('offline');
      addToast(
        'info',
        `Plano salvo localmente para ${enrichedPlan.equipmentCode}.`,
        'Plano Salvo'
      );
    }
  };

  const handleSavePreventiveRecord = async (
    record: PreventiveRecord,
    updatedPlan?: PreventivePlan,
    updatedEquipment?: Equipment
  ) => {
    const activeObra = selectedProject !== 'all' ? selectedProject : (record.obra_id || record.location || '063/064');
    const enrichedRecord: PreventiveRecord = {
      ...record,
      location: activeObra,
      obra_id: activeObra,
      projectId: activeObra,
    };
    // 1. Save record
    const updatedRecords = [enrichedRecord, ...preventiveRecords.filter((r) => r.id !== enrichedRecord.id)];
    setPreventiveRecords(updatedRecords);
    savePreventiveRecords(updatedRecords);

    // 2. If updatedPlan is provided, save it
    if (updatedPlan) {
      const enrichedUpdatedPlan: PreventivePlan = {
        ...updatedPlan,
        location: activeObra,
        obra_id: activeObra,
        projectId: activeObra,
      };
      const updatedPlans = preventivePlans.some((p) => p.equipmentId === enrichedUpdatedPlan.equipmentId)
        ? preventivePlans.map((p) => (p.equipmentId === enrichedUpdatedPlan.equipmentId ? enrichedUpdatedPlan : p))
        : [...preventivePlans, enrichedUpdatedPlan];
      setPreventivePlans(updatedPlans);
      savePreventivePlans(updatedPlans);
      savePreventivePlanToFirestore(enrichedUpdatedPlan).catch(console.warn);
    }

    // 3. If updatedEquipment is provided (meter/km advanced), update equipment base
    if (updatedEquipment) {
      handleUpdateEquipment(updatedEquipment);
    }

    // 4. Sync record to Firestore
    setCloudStatus('syncing');
    try {
      await savePreventiveRecordToFirestore(enrichedRecord);
      setCloudStatus('connected');
      addToast(
        'success',
        `Preventiva de ${enrichedRecord.equipmentCode} registrada com sucesso!`,
        'Preventiva Registrada'
      );
    } catch (err) {
      console.warn('Erro ao salvar preventiva no Firestore:', err);
      setCloudStatus('offline');
      addToast(
        'info',
        `Preventiva de ${enrichedRecord.equipmentCode} salva localmente.`,
        'Preventiva Salva'
      );
    }
  };

  const handleDeletePreventiveRecord = async (id: string) => {
    if (session?.user.role === 'visualizador') {
      addToast(
        'error',
        'Perfil Visualizador possui acesso somente leitura.',
        'Acesso Negado'
      );
      return;
    }

    const updated = preventiveRecords.filter((r) => r.id !== id);
    setPreventiveRecords(updated);
    savePreventiveRecords(updated);

    deletePreventiveRecordFromFirestore(id).catch(console.warn);
    addToast('info', 'Registro de preventiva excluído com sucesso.', 'Registro Excluído');
  };

  const handleDeletePreventivePlan = async (planId: string, equipmentId: string) => {
    if (session?.user.role === 'visualizador') {
      addToast('error', 'Perfil Visualizador possui acesso somente leitura.', 'Acesso Negado');
      return;
    }
    const planToDelete = preventivePlans.find((p) => p.id === planId || p.equipmentId === equipmentId);
    const code = planToDelete?.equipmentCode || 'Equipamento';

    const updatedPlans = preventivePlans.filter(
      (p) => p.id !== planId && p.equipmentId !== equipmentId
    );
    setPreventivePlans(updatedPlans);
    savePreventivePlans(updatedPlans);

    setCloudStatus('syncing');
    try {
      if (planToDelete) {
        await deletePreventivePlanFromFirestore(planToDelete.id);
      }
      setCloudStatus('connected');
      addToast(
        'info',
        `Controle de preventiva do equipamento ${code} excluído com sucesso.`,
        'Preventiva Excluída'
      );
    } catch (err) {
      console.warn('Erro ao excluir plano no Firestore:', err);
      setCloudStatus('offline');
      addToast(
        'info',
        `Controle de preventiva do equipamento ${code} excluído localmente.`,
        'Preventiva Excluída'
      );
    }
  };

  const handleClearPreventiveData = async () => {
    try {
      clearPreventiveLocalStorage();
      setPreventivePlans([]);
      setPreventiveRecords([]);
      setCloudStatus('syncing');
      await clearPreventiveDataFromFirestore();
      setCloudStatus('connected');
      addToast(
        'info',
        'Controle de Manutenção Preventiva (PCM) zerado com sucesso. Pronto para iniciar novos registros do zero.',
        'PCM Zerado'
      );
    } catch (err) {
      console.error('Erro ao zerar dados de preventiva no Firestore:', err);
      setCloudStatus('offline');
      addToast(
        'info',
        'Dados locais do PCM zerados. A sincronização com a nuvem será finalizada assim que a conexão retornar.',
        'PCM Zerado'
      );
    }
  };

  // Corrective Maintenance Handlers
  const handleSaveCorrectiveMaintenance = async (record: CorrectiveMaintenance) => {
    const activeObra = selectedProject !== 'all' ? selectedProject : (record.obra_id || record.location || '063/064');
    const enrichedRecord: CorrectiveMaintenance = {
      ...record,
      location: activeObra,
      obra_id: activeObra,
      projectId: activeObra,
    };

    // Always cache photos in IndexedDB to ensure photos are never lost
    if (enrichedRecord.photos && enrichedRecord.photos.length > 0) {
      await saveMultipleCorrectivePhotosToIndexedDB(enrichedRecord.photos).catch((err) => {
        console.warn('Falha ao salvar fotos de corretiva no IndexedDB:', err);
      });
    }

    setCorrectiveMaintenances((prev) => {
      const idx = prev.findIndex((r) => r.id === enrichedRecord.id);
      let updated: CorrectiveMaintenance[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = enrichedRecord;
      } else {
        updated = [enrichedRecord, ...prev];
      }
      saveCorrectiveMaintenances(updated);
      return updated;
    });

    try {
      await saveCorrectiveMaintenanceToFirestore(enrichedRecord);
      addToast(
        'success',
        `Ordem de Serviço ${enrichedRecord.osNumber} salva com sucesso!`,
        'Corretiva Registrada'
      );
    } catch (err) {
      console.warn('Erro ao salvar corretiva no Firestore:', err);
      addToast(
        'info',
        `Ordem de Serviço ${enrichedRecord.osNumber} salva localmente no navegador.`,
        'Salvo Offline'
      );
    }
  };

  const handleDeleteCorrectiveMaintenance = async (id: string) => {
    const toDelete = correctiveMaintenances.find((r) => r.id === id);
    setCorrectiveMaintenances((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      saveCorrectiveMaintenances(updated);
      return updated;
    });

    try {
      await deleteCorrectiveMaintenanceFromFirestore(id);
      addToast(
        'success',
        `Ordem de Serviço ${toDelete?.osNumber || id} excluída com sucesso.`,
        'Corretiva Excluída'
      );
    } catch (err) {
      console.warn('Erro ao excluir corretiva no Firestore:', err);
      addToast('info', 'Registro excluído localmente.', 'Excluído');
    }
  };

  const handleClearCorrectiveData = async () => {
    try {
      clearCorrectiveLocalStorage();
      setCorrectiveMaintenances([]);
      setCloudStatus('syncing');
      await clearCorrectiveDataFromFirestore();
      setCloudStatus('connected');
      addToast(
        'info',
        'Registros de Manutenções Corretivas zerados com sucesso. Pronto para iniciar novos lançamentos do zero.',
        'Corretivas Zeradas'
      );
    } catch (err) {
      console.error('Erro ao zerar dados de corretivas no Firestore:', err);
      setCloudStatus('offline');
      addToast(
        'info',
        'Dados locais de corretivas zerados. A sincronização com a nuvem será finalizada assim que a conexão retornar.',
        'Corretivas Zeradas'
      );
    }
  };

  // Calcular a lista de máquinas com preventivas vencidas para o Popover do Sino
  const overduePreventiveItems: OverduePreventiveItem[] = useMemo(() => {
    const list: OverduePreventiveItem[] = [];
    filteredEquipments.forEach((eq) => {
      const plan =
        filteredPreventivePlans.find((p) => p.equipmentId === eq.id) ||
        createDefaultPlanForEquipment(eq);
      const calc = calculateEquipmentPreventive(eq, plan);
      if (calc.status === 'VENCIDA') {
        list.push({ equipment: eq, calc });
      }
    });
    // Ordenar pelas maiores horas/km excedentes
    return list.sort((a, b) => (b.calc.overdueValue || 0) - (a.calc.overdueValue || 0));
  }, [filteredEquipments, filteredPreventivePlans]);

  const preventiveOverdueCount = overduePreventiveItems.length;

  const filteredDeductionsCount = useMemo(() => {
    const list = loadMeasurementDeductions(equipments);
    if (selectedProject === 'all') return list.length;
    return list.filter((d) => matchesSelectedProject(d.location, selectedProject, d.obra_id)).length;
  }, [equipments, selectedProject, deductionsCount]);

  const handleOpenAllOverdueInPCM = () => {
    setIsOverdueBellOpen(false);
    setPreventiveStatusFilter('VENCIDA');
    setPreventiveTargetEquipmentId(undefined);
    setActiveTab('preventive-maintenance');
    addToast(
      'info',
      `Visualizando ${preventiveOverdueCount} máquina(s) com preventiva vencida na tabela do PCM.`,
      'PCM • Preventivas Vencidas'
    );
  };

  const handleSelectOverdueEquipment = (equipmentId: string) => {
    setIsOverdueBellOpen(false);
    setPreventiveStatusFilter('todos');
    setPreventiveTargetEquipmentId(equipmentId);
    setActiveTab('preventive-maintenance');
    const targetEq = equipments.find((e) => e.id === equipmentId);
    addToast(
      'info',
      `Visualizando ${targetEq?.prefix || targetEq?.plate || 'equipamento'} no Controle de Preventivas.`,
      'PCM • Equipamento Selecionado'
    );
  };

  // If not authenticated, render Login Screen
  if (!session) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <LoginScreen users={appUsers} onLoginSuccess={handleLoginSuccess} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 transition-colors relative">
      {/* Detalhes arquiteturais de fundo corporativo Makmo sobre fundo branco */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Plano de Fundo Malha Logística sobre fundo branco */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-[0.035] mix-blend-multiply transition-opacity duration-700"
          style={{
            backgroundImage: `url('/assets/makmo_fundo_3_malha_logistica.jpg')`,
            backgroundAttachment: 'fixed',
          }}
        />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[1920px] max-w-full h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(17,56,97,0.06),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(17,56,97,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(17,56,97,0.025)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute -bottom-48 right-0 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(17,56,97,0.05),transparent_70%)]" />
      </div>

      {/* Main System Layout: Top Navigation Panel + Full-Width Main Content */}
      <div className="flex-1 flex flex-col min-h-screen relative z-10 w-full">
        {/* Painel Superior do Sistema (Módulos e Navegação Central no Topo) */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'preventive-maintenance') {
              setPreventiveStatusFilter('todos');
              setPreventiveTargetEquipmentId(undefined);
            }
            setActiveTab(tab);
          }}
          theme={theme}
          toggleTheme={toggleTheme}
          equipmentCount={filteredEquipments.length}
          logCount={filteredDailyLogs.length}
          fuelDispenseCount={filteredFuelDispenses.length}
          invoiceFileCount={filteredInvoiceFiles.length}
          preventiveOverdueCount={preventiveOverdueCount}
          overdueItems={overduePreventiveItems}
          isOverdueBellOpen={isOverdueBellOpen}
          onToggleOverdueBell={() => setIsOverdueBellOpen((prev) => !prev)}
          onCloseOverdueBell={() => setIsOverdueBellOpen(false)}
          onViewAllOverdue={handleOpenAllOverdueInPCM}
          onSelectOverdueEquipment={handleSelectOverdueEquipment}
          deductionCount={filteredDeductionsCount}
          correctiveCount={filteredCorrectiveMaintenances.length}
          onExportCSV={handleExportCSV}
          cloudStatus={cloudStatus}
          cloudProvider={isSupabaseConfigured() ? 'supabase' : cloudStatus === 'connected' ? 'firestore' : 'local'}
          onOpenCloudModal={() => setIsSupabaseModalOpen(true)}
          currentUser={currentUser}
          appUser={session?.user}
          selectedProject={selectedProject}
          canSwitchProject={
            session?.user.role === 'admin' ||
            (session?.user.allowedProjects &&
              (session.user.allowedProjects.includes('all') ||
                session.user.allowedProjects.length > 1))
          }
          onOpenProjectSelector={() => setIsProjectSelectorOpen(true)}
          onOpenAdminManagement={() => setIsAdminManagementOpen(true)}
          onOpenGmailIntegration={() => setIsGmailModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Main Content Area ajustada para visualização Desktop 1920x1080 px */}
        <main className="flex-1 w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 py-2.5 sm:py-3.5 relative z-10 min-w-0">
        {activeTab === 'database' && (
          <EquipmentsTab
            equipments={filteredEquipments}
            dailyLogs={filteredDailyLogs}
            preventiveRecords={filteredPreventiveRecords}
            correctiveMaintenances={filteredCorrectiveMaintenances}
            preventivePlans={filteredPreventivePlans}
            onAddEquipment={handleAddEquipment}
            onUpdateEquipment={handleUpdateEquipment}
            onDeleteEquipment={handleDeleteEquipment}
            onRestoreDefaults={handleRestoreDefaults}
            userRole={session?.user.role}
            selectedProject={selectedProject}
            userName={session?.user.name || currentUser?.name}
          />
        )}

        {activeTab === 'daily-log' && (
          <DailyLogTab
            equipments={filteredEquipments}
            dailyLogs={filteredDailyLogs}
            onSaveDailyLog={handleSaveDailyLog}
            onUpdateDailyLog={handleUpdateDailyLog}
            onDeleteDailyLog={handleDeleteDailyLog}
            onNavigateToDatabase={() => setActiveTab('database')}
            userRole={session?.user.role}
          />
        )}

        {activeTab === 'fuel-control' && (
          <FuelControlTab
            equipments={filteredEquipments}
            dispenses={filteredFuelDispenses}
            entries={filteredFuelEntries}
            onSaveDispense={handleSaveFuelDispense}
            onUpdateDispense={handleUpdateFuelDispense}
            onDeleteDispense={handleDeleteFuelDispense}
            onSaveEntry={handleSaveFuelEntry}
            onUpdateEntry={handleUpdateFuelEntry}
            onDeleteEntry={handleDeleteFuelEntry}
            onExportCSV={handleExportFuelCSV}
            onResetFuelData={handleResetFuelData}
            userRole={session?.user.role}
            userName={session?.user.name || currentUser?.name}
            selectedProject={selectedProject}
            projects={appProjects}
            allDispenses={fuelDispenses}
            allEntries={fuelEntries}
          />
        )}

        {activeTab === 'invoices' && (
          <FuelInvoicesTab
            files={filteredInvoiceFiles}
            onAddFile={handleAddInvoiceFile}
            onDeleteFile={handleDeleteInvoiceFile}
            userRole={session?.user.role}
          />
        )}

        {activeTab === 'preventive-maintenance' && (
          <PreventiveMaintenanceTab
            key={`preventive-${preventiveStatusFilter}-${preventiveTargetEquipmentId || 'none'}`}
            equipments={filteredEquipments}
            plans={filteredPreventivePlans}
            records={filteredPreventiveRecords}
            initialStatusFilter={preventiveStatusFilter}
            initialEquipmentId={preventiveTargetEquipmentId}
            onSavePlan={handleSavePreventivePlan}
            onDeletePlan={handleDeletePreventivePlan}
            onSaveRecord={handleSavePreventiveRecord}
            onDeleteRecord={handleDeletePreventiveRecord}
            onUpdateEquipment={handleUpdateEquipment}
            onResetPreventiveData={handleClearPreventiveData}
            userRole={session?.user.role}
          />
        )}

        {activeTab === 'measurement-deduction' && (
          <MeasurementDeductionTab
            equipments={filteredEquipments}
            currentUser={currentUser}
            selectedProject={selectedProject}
          />
        )}

        {activeTab === 'corrective-maintenance' && (
          <CorrectiveMaintenanceTab
            records={filteredCorrectiveMaintenances}
            equipments={filteredEquipments}
            onSaveRecord={handleSaveCorrectiveMaintenance}
            onDeleteRecord={handleDeleteCorrectiveMaintenance}
            onResetRecords={handleClearCorrectiveData}
          />
        )}
      </main>

      {/* High Density Footer info bar ajustada para 1920x1080 px */}
      <footer className="border-t border-[#dcdfe4] dark:border-[#333333] bg-white dark:bg-[#141414] py-1.5 text-center text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 flex flex-col sm:flex-row items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <MakmoLogo className="h-4 w-auto" compact showSubtitle={false} showSubBrand={false} />
            <span className="font-semibold text-[#374151] dark:text-[#d1d5db]">
              Sistema PCM NEXUS
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Parte Diária & Controle de Diesel & PCM Preventivas & Descontos em Medição & Corretivas Realizadas</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>{filteredEquipments.length} máquinas</span>
            <span>•</span>
            <span>{filteredDailyLogs.length} apontamentos</span>
            <span>•</span>
            <span>{filteredFuelDispenses.length} abastecimentos</span>
            <span>•</span>
            <span>{filteredInvoiceFiles.length} arquivos NF</span>
            <span>•</span>
            <span>{filteredPreventiveRecords.length} preventivas</span>
            <span>•</span>
            <span>{filteredDeductionsCount} descontos</span>
            <span>•</span>
            <span>{filteredCorrectiveMaintenances.length} corretivas</span>
          </div>
        </div>
      </footer>
    </div>

      {/* Project Selector Modal */}
      {session && (
        <ProjectSelectorModal
          isOpen={isProjectSelectorOpen}
          user={session.user}
          projects={appProjects}
          currentSelectedProject={selectedProject}
          equipmentsCountByProject={equipmentsCountByProject}
          onSelectProject={handleSelectProject}
          onClose={() => setIsProjectSelectorOpen(false)}
          canCancel={true}
        />
      )}

      {/* Admin Management Modal */}
      {session && session.user.role === 'admin' && (
        <AdminManagementModal
          isOpen={isAdminManagementOpen}
          onClose={() => setIsAdminManagementOpen(false)}
          users={appUsers}
          projects={appProjects}
          currentUser={session.user}
          currentSelectedProject={selectedProject}
          equipmentsCountByProject={equipmentsCountByProject}
          onSelectProject={handleSelectProject}
          onSaveUser={handleSaveUser}
          onDeleteUser={handleDeleteUser}
          onSaveProject={handleSaveProject}
          onDeleteProject={handleDeleteProject}
          onOpenSupabaseConfig={() => setIsSupabaseModalOpen(true)}
        />
      )}

      {/* Supabase Connection & Multi-Computer Cloud Sync Modal */}
      <SupabaseConnectionModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigChanged={() => {
          setCloudSyncKey((k) => k + 1);
        }}
        addToast={addToast}
      />

      {/* Gmail Integration Modal (Apenas Perfil Admin) */}
      {session && session.user.role === 'admin' && (
        <GmailIntegrationModal
          isOpen={isGmailModalOpen}
          onClose={() => setIsGmailModalOpen(false)}
          userRole={session.user.role}
          equipments={equipments}
          dispenses={fuelDispenses}
          entries={fuelEntries}
          projects={appProjects}
          onShowToast={addToast}
        />
      )}

      {/* Floating Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
