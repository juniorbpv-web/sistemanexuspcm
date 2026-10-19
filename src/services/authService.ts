import { AuthUser, UserRole } from '../types';

const SESSION_KEY = 'makmo_active_session';
const DEV_CREDS_KEY = 'makmo_dev_credentials';

export const FIXED_USER_CREDENTIALS = {
  name: 'Makmo',
  username: 'makmo',
  password: '1234',
} as const;

export const FIXED_DEV_CREDENTIALS = {
  name: 'Desenvolvedor Makmo',
  username: 'dev',
  password: '132587',
} as const;

export interface DeveloperCredentials {
  username: string;
  passwordHash: string;
  updatedAt: string;
}

const DEFAULT_DEV_CREDS: DeveloperCredentials = {
  username: FIXED_DEV_CREDENTIALS.username,
  passwordHash: FIXED_DEV_CREDENTIALS.password,
  updatedAt: new Date().toISOString(),
};

export function getDeveloperCredentials(): DeveloperCredentials {
  try {
    const raw = localStorage.getItem(DEV_CREDS_KEY);
    if (!raw) return DEFAULT_DEV_CREDS;
    const parsed = JSON.parse(raw);
    return {
      username: parsed.username || DEFAULT_DEV_CREDS.username,
      passwordHash: parsed.passwordHash || DEFAULT_DEV_CREDS.passwordHash,
      updatedAt: parsed.updatedAt || DEFAULT_DEV_CREDS.updatedAt,
    };
  } catch {
    return DEFAULT_DEV_CREDS;
  }
}

export function saveDeveloperCredentials(creds: Partial<DeveloperCredentials>): void {
  const current = getDeveloperCredentials();
  const updated: DeveloperCredentials = {
    ...current,
    ...creds,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(DEV_CREDS_KEY, JSON.stringify(updated));
}

/**
 * Validates Developer credentials.
 * Strictly requires:
 * Usuario: dev
 * Senha: 132587
 */
export function authenticateDeveloper(
  user: string,
  pass: string
): { success: boolean; user?: AuthUser; error?: string } {
  const cleanUser = user.trim().toLowerCase();
  const cleanPass = pass.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: 'Informe o usuário e a senha de desenvolvedor.' };
  }

  const stored = getDeveloperCredentials();

  const isUserValid = cleanUser === FIXED_DEV_CREDENTIALS.username.toLowerCase();
  const isPassValid =
    cleanPass === FIXED_DEV_CREDENTIALS.password ||
    cleanPass === stored.passwordHash;

  if (!isUserValid || !isPassValid) {
    return {
      success: false,
      error: 'Acesso negado: Usuário ou senha de desenvolvedor incorretos.',
    };
  }

  const authUser: AuthUser = {
    username: FIXED_DEV_CREDENTIALS.username,
    name: FIXED_DEV_CREDENTIALS.name,
    role: 'developer',
    loginTime: new Date().toISOString(),
  };

  saveSession(authUser);
  return { success: true, user: authUser };
}

/**
 * Verifies if the provided password matches the developer password.
 * Checks against both the fixed default credentials (132587) and custom stored hash.
 */
export function verifyDeveloperPassword(pass: string): boolean {
  const cleanPass = (pass || '').trim();
  if (!cleanPass) return false;
  const stored = getDeveloperCredentials();
  return (
    cleanPass === FIXED_DEV_CREDENTIALS.password ||
    cleanPass === stored.passwordHash
  );
}

/**
 * Validates User (Operator) credentials.
 * Strictly requires:
 * Nome Sempre Fixo: Makmo
 * Senha Fixa: 1234
 */
export function authenticateUser(
  userName: string,
  pass: string
): { success: boolean; user?: AuthUser; error?: string } {
  const cleanName = (userName || '').trim();
  const cleanPass = (pass || '').trim();

  if (!cleanName || !cleanPass) {
    return { success: false, error: 'Informe o nome de usuário (Makmo) e a senha (1234).' };
  }

  if (
    cleanName.toLowerCase() !== FIXED_USER_CREDENTIALS.name.toLowerCase() ||
    cleanPass !== FIXED_USER_CREDENTIALS.password
  ) {
    return {
      success: false,
      error: 'Acesso negado: Perfil Usuário restrito ao nome fixo "Makmo" e senha fixa "1234".',
    };
  }

  const authUser: AuthUser = {
    username: FIXED_USER_CREDENTIALS.username,
    name: FIXED_USER_CREDENTIALS.name,
    role: 'user',
    loginTime: new Date().toISOString(),
  };

  saveSession(authUser);
  return { success: true, user: authUser };
}

/**
 * Session persistence:
 * Checks sessionStorage first (active tab session), fallback to localStorage.
 * Only validates authorized session users.
 */
export function getSavedSession(): AuthUser | null {
  try {
    const sessionRaw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!sessionRaw) return null;
    const parsed: AuthUser = JSON.parse(sessionRaw);

    if (parsed && parsed.role === 'developer' && parsed.username === 'dev') {
      return parsed;
    }
    if (parsed && parsed.role === 'user' && parsed.username === 'makmo') {
      return parsed;
    }

    clearSession();
    return null;
  } catch {
    return null;
  }
}

export function saveSession(user: AuthUser): void {
  try {
    const json = JSON.stringify(user);
    sessionStorage.setItem(SESSION_KEY, json);
    localStorage.setItem(SESSION_KEY, json);
  } catch (err) {
    console.error('Error saving session:', err);
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch (err) {
    console.error('Error clearing session:', err);
  }
}

