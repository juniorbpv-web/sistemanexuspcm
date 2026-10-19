import { AppProject, AppUser, CurrentSession } from '../types';
import { INITIAL_PROJECTS, INITIAL_USERS } from '../data/initialAuthData';

const USERS_STORAGE_KEY = 'makmo_app_users_v1';
const PROJECTS_STORAGE_KEY = 'makmo_app_projects_v1';
const SESSION_STORAGE_KEY = 'makmo_app_session_v1';

export const UNIFIED_WORK_CODE = '063/064';
export const CLEAN_WORK_062_PA = '062 - PA';

export const OFFICIAL_UNIFIED_PROJECT: AppProject = {
  id: 'proj-063-064',
  code: '063/064',
  name: 'Obra 063/064 - Apoio e Manutenção',
  status: 'inactive',
  description: 'Obra de Pavimento e Recuperação',
  createdAt: '2026-09-01T08:00:00.000Z',
};

export const OFFICIAL_062_PA_PROJECT: AppProject = {
  id: 'proj-062-pa',
  code: '062 - PA',
  name: 'Obra 062 - PA',
  status: 'active',
  description: 'Nova frente operacional - base limpa para novos registros do zero.',
  createdAt: '2026-09-01T08:00:00.000Z',
};

/**
 * Normalizes project/obra identifiers for robust multi-tenant matching.
 * Maps legacy formats (SCP 063, SCP 064, Obra 063, Obra 064, 063, 064, SCP 064 / SCP 063, 063/064)
 * exclusively to the single unified project code '063/064'.
 * Maps '062 - PA' (and variants '062-PA', '062 PA') strictly to '062 - PA'.
 * Preserves custom project codes (e.g., '065', 'Obra 065').
 */
export function normalizeProjectCode(code: string | undefined | null): string {
  if (!code) return '';
  const trimmed = code.trim().toUpperCase();
  const compact = trimmed.replace(/[\s\-_/]/g, '');

  // Match 063/064 and its legacy variants
  if (
    trimmed === '063/064' ||
    trimmed === '063 / 064' ||
    compact.includes('063064') ||
    compact.includes('064063') ||
    compact === '063' ||
    compact === '064' ||
    compact === 'SCP063' ||
    compact === 'SCP064' ||
    compact === 'OBRA063' ||
    compact === 'OBRA064' ||
    trimmed.includes('063') ||
    trimmed.includes('064')
  ) {
    return UNIFIED_WORK_CODE;
  }

  // Match 062 - PA
  if (
    trimmed === '062 - PA' ||
    trimmed === '062-PA' ||
    trimmed === '062 PA' ||
    compact === '062PA' ||
    compact === 'OBRA062PA' ||
    compact === 'SCP062PA' ||
    compact === 'MKM062' ||
    compact.includes('MKM062') ||
    trimmed.includes('MKM 062') ||
    (trimmed.includes('062') && trimmed.includes('PA'))
  ) {
    return CLEAN_WORK_062_PA;
  }

  // Legacy demo records from initial seed (SCP 062 without PA) belong to legacy 063/064 dataset
  if (compact === 'SCP062' || compact === 'SPC062' || compact === 'OBRA062' || compact === '062') {
    return UNIFIED_WORK_CODE;
  }

  // Strip generic prefixes like 'OBRA ' or 'SCP ' so 'SCP 065', 'OBRA 065' and '065' all map consistently
  const prefixStripped = trimmed.replace(/^(OBRA|SCP)[\s\-_:]+/i, '').trim();
  if (prefixStripped) {
    return prefixStripped;
  }

  return trimmed;
}

/**
 * Checks whether an item's location or obra_id matches the active selected project.
 * Implements strict tenant data isolation (WHERE obra_id = obra_atual).
 */
export function matchesSelectedProject(
  itemLocation: string | undefined | null,
  selectedProject: string | 'all',
  itemObraId?: string | null
): boolean {
  if (!selectedProject || selectedProject === 'all') return true;

  const targetNorm = normalizeProjectCode(selectedProject);

  // If explicit obra_id is present
  if (itemObraId) {
    const itemObraNorm = normalizeProjectCode(itemObraId);
    if (itemObraNorm === targetNorm) return true;
    if (itemObraNorm !== targetNorm && itemObraNorm !== '') return false;
  }

  if (!itemLocation) {
    // Legacy initial seed records without explicit location/obra_id belong to 063/064
    return targetNorm === UNIFIED_WORK_CODE;
  }

  const locNorm = normalizeProjectCode(itemLocation);
  return locNorm === targetNorm;
}

export function loadAppUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    let users = INITIAL_USERS;
    if (raw) {
      try {
        const parsed: AppUser[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          users = parsed;
        }
      } catch {}
    }

    // Unify user allowedProjects to use 063/064
    const migratedUsers = users.map((u) => {
      const allowed = (u.allowedProjects || []).map((p) => {
        if (p === 'all') return 'all';
        return normalizeProjectCode(p);
      });
      // Deduplicate
      const uniqueAllowed = Array.from(new Set(allowed));
      return {
        ...u,
        allowedProjects: uniqueAllowed.length > 0 ? uniqueAllowed : (u.role === 'admin' ? ['all'] : []),
      };
    });

    // Guarantee admin exists and has default password 132587
    const hasAdmin = migratedUsers.some((u) => u.username === 'admin' || u.role === 'admin');
    const ensuredUsers = hasAdmin ? migratedUsers : [INITIAL_USERS[0], ...migratedUsers];
    const finalUsers = ensuredUsers.map((u) => {
      if (u.username === 'admin' || u.role === 'admin') {
        const nextUser = { ...u };
        if (nextUser.password === 'admin') nextUser.password = '132587';
        if (!nextUser.name || nextUser.name === 'Administrador do Sistema') {
          nextUser.name = 'Roberto Junior (Administrador)';
        }
        return nextUser;
      }
      return u;
    });
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(finalUsers));
    return finalUsers;
  } catch (err) {
    console.error('Error reading app users from localStorage', err);
    return INITIAL_USERS;
  }
}

export function saveAppUsers(users: AppUser[]): void {
  try {
    if (!users || users.length === 0) return;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Error saving app users to localStorage', err);
  }
}

export function loadAppProjects(): AppProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    let projects: AppProject[] = INITIAL_PROJECTS;
    if (raw) {
      try {
        const parsed: AppProject[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          projects = parsed;
        }
      } catch {}
    }

    // Deduplicate and consolidate projects list:
    // 1. Single unified 063/064
    // 2. Single 062 - PA
    // 3. Any additional custom projects (e.g. 065) without duplicates
    const finalProjectsMap = new Map<string, AppProject>();

    // Always include the canonical 063/064 and 062 - PA
    finalProjectsMap.set(UNIFIED_WORK_CODE, OFFICIAL_UNIFIED_PROJECT);
    finalProjectsMap.set(CLEAN_WORK_062_PA, OFFICIAL_062_PA_PROJECT);

    projects.forEach((p) => {
      const norm = normalizeProjectCode(p.code);
      if (norm === UNIFIED_WORK_CODE) {
        // Keep the unified definition
        finalProjectsMap.set(UNIFIED_WORK_CODE, OFFICIAL_UNIFIED_PROJECT);
      } else if (norm === CLEAN_WORK_062_PA) {
        // Keep the clean 062 - PA
        finalProjectsMap.set(CLEAN_WORK_062_PA, OFFICIAL_062_PA_PROJECT);
      } else if (norm) {
        // Custom project like 065
        if (!finalProjectsMap.has(norm)) {
          finalProjectsMap.set(norm, {
            ...p,
            code: norm,
          });
        }
      }
    });

    const finalProjects = Array.from(finalProjectsMap.values());
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(finalProjects));
    return finalProjects;
  } catch (err) {
    console.error('Error reading app projects from localStorage', err);
    return INITIAL_PROJECTS;
  }
}

export function saveAppProjects(projects: AppProject[]): void {
  try {
    if (!projects || projects.length === 0) return;
    // Ensure 063/064 remains unified without duplicate codes
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

    const cleaned = Array.from(map.values());
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.error('Error saving app projects to localStorage', err);
  }
}

export function loadCurrentSession(): CurrentSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: CurrentSession = JSON.parse(raw);
    if (!parsed || !parsed.user) return null;

    // Migrate selectedProject to unified format if needed
    const normProj = parsed.selectedProject === 'all' ? 'all' : normalizeProjectCode(parsed.selectedProject);
    const updated: CurrentSession = {
      ...parsed,
      selectedProject: normProj || 'all',
      user: {
        ...parsed.user,
        allowedProjects: (parsed.user.allowedProjects || []).map((p) =>
          p === 'all' ? 'all' : normalizeProjectCode(p)
        ),
      },
    };
    return updated;
  } catch {
    return null;
  }
}

export function saveCurrentSession(session: CurrentSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch (err) {
    console.error('Error updating current session in localStorage', err);
  }
}

/**
 * Checks if a user has permission to access a specific project code.
 */
export function isProjectAllowed(user: AppUser, projectCode: string): boolean {
  if (!user || user.status !== 'active') return false;
  if (user.role === 'admin' || user.allowedProjects.includes('all')) return true;
  const cleanTarget = normalizeProjectCode(projectCode);
  return user.allowedProjects.some((p) => {
    if (p === 'all') return true;
    return normalizeProjectCode(p) === cleanTarget;
  });
}
