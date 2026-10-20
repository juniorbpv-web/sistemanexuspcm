import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Equipment,
  DailyLog,
  FuelDispense,
  FuelEntry,
  PreventivePlan,
  PreventiveRecord,
  CorrectiveMaintenance,
  AppUser,
  AppProject,
} from '../types';
import {
  INITIAL_EQUIPMENTS,
  INITIAL_LOGS,
  INITIAL_FUEL_DISPENSES,
  INITIAL_FUEL_ENTRIES,
  INITIAL_PREVENTIVE_PLANS,
  INITIAL_PREVENTIVE_RECORDS,
  INITIAL_CORRECTIVE_MAINTENANCES,
} from '../data/initialData';
import { INITIAL_USERS, INITIAL_PROJECTS } from '../data/initialAuthData';
import { OFFICIAL_MEASUREMENT_DEDUCTIONS } from '../data/officialDeductionsData';
import {
  loadEquipments,
  loadDailyLogs,
  loadFuelDispenses,
  loadFuelEntries,
  loadPreventivePlans,
  loadPreventiveRecords,
  loadMeasurementDeductions,
  loadCorrectiveMaintenances,
} from '../utils/storage';
import { loadAppUsers, loadAppProjects } from '../utils/authStorage';

const SUPABASE_URL_KEY = 'makmo_supabase_url';
const SUPABASE_ANON_KEY = 'makmo_supabase_key';
const SUPABASE_SEEDED_FLAG = 'makmo_supabase_seeded_v810';

let supabaseInstance: SupabaseClient | null = null;
let currentConfiguredUrl = '';
let currentConfiguredKey = '';
let inMemoryUrl = '';
let inMemoryKey = '';

type ConfigChangeListener = () => void;
const configChangeListeners = new Set<ConfigChangeListener>();

export function onSupabaseConfigChange(listener: ConfigChangeListener): () => void {
  configChangeListeners.add(listener);
  return () => {
    configChangeListeners.delete(listener);
  };
}

function notifyConfigChange() {
  configChangeListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('[SUPABASE] Erro no listener de config:', e);
    }
  });
}

export interface SupabaseConfigInfo {
  url: string;
  key: string;
  isEnv: boolean;
  isConnected: boolean;
}

export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.key);
}

export function getSupabaseConfig(): SupabaseConfigInfo {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || '').trim();

  let localUrl = '';
  let localKey = '';
  try {
    localUrl = (localStorage.getItem(SUPABASE_URL_KEY) || '').trim();
    localKey = (localStorage.getItem(SUPABASE_ANON_KEY) || '').trim();
  } catch {}

  const url = envUrl || localUrl || inMemoryUrl;
  const key = envKey || localKey || inMemoryKey;

  return {
    url,
    key,
    isEnv: Boolean(envUrl && envKey),
    isConnected: Boolean(url && key),
  };
}

/**
 * Automatically fetch configuration from server API (/api/supabase-config)
 * so that any computer connecting to the app on Hostinger gets the shared credentials!
 */
export async function initSupabaseRemoteConfig(): Promise<boolean> {
  const current = getSupabaseConfig();
  if (current.url && current.key) {
    return true;
  }

  try {
    const res = await fetch('/api/supabase-config');
    if (!res.ok) return false;

    const data = await res.json();
    if (data.url && data.key) {
      inMemoryUrl = String(data.url).trim();
      inMemoryKey = String(data.key).trim();
      try {
        localStorage.setItem(SUPABASE_URL_KEY, inMemoryUrl);
        localStorage.setItem(SUPABASE_ANON_KEY, inMemoryKey);
      } catch {}

      // Reset client instance with new credentials
      supabaseInstance = null;
      currentConfiguredUrl = '';
      currentConfiguredKey = '';

      notifyConfigChange();
      return true;
    }
  } catch {
    // Best-effort in dev or static host
  }
  return false;
}

export function saveSupabaseConfig(url: string, key: string): boolean {
  try {
    const cleanUrl = url.trim();
    const cleanKey = key.trim();

    inMemoryUrl = cleanUrl;
    inMemoryKey = cleanKey;

    if (cleanUrl) {
      localStorage.setItem(SUPABASE_URL_KEY, cleanUrl);
    } else {
      localStorage.removeItem(SUPABASE_URL_KEY);
    }
    if (cleanKey) {
      localStorage.setItem(SUPABASE_ANON_KEY, cleanKey);
    } else {
      localStorage.removeItem(SUPABASE_ANON_KEY);
    }

    // Reset client
    supabaseInstance = null;
    currentConfiguredUrl = '';
    currentConfiguredKey = '';

    // Asynchronously sync to Node server on Hostinger so all computers share it
    if (cleanUrl && cleanKey) {
      fetch('/api/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, key: cleanKey }),
      }).catch((err) => {
        console.warn('[SUPABASE] Servidor local não respondeu ao salvar config:', err);
      });
    }

    notifyConfigChange();
    return true;
  } catch (err) {
    console.error('Erro ao salvar configuração do Supabase:', err);
    return false;
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.url || !config.key) {
    return null;
  }

  if (supabaseInstance && currentConfiguredUrl === config.url && currentConfiguredKey === config.key) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    currentConfiguredUrl = config.url;
    currentConfiguredKey = config.key;
    return supabaseInstance;
  } catch (err) {
    console.error('Erro ao inicializar cliente Supabase:', err);
    return null;
  }
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; tableReady: boolean }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase não configurado. Forneça o Project URL e a Anon Key.',
      tableReady: false,
    };
  }

  try {
    // Try querying app_records
    const { data, error } = await client.from('app_records').select('id').limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('relation "app_records" does not exist')) {
        return {
          success: true,
          message: 'Conectado ao Supabase com sucesso! A tabela "app_records" ainda precisa ser criada.',
          tableReady: false,
        };
      }
      return {
        success: false,
        message: `Falha na consulta ao Supabase: ${error.message}`,
        tableReady: false,
      };
    }

    return {
      success: true,
      message: 'Conexão ativa com o Supabase e tabela "app_records" pronta!',
      tableReady: true,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao conectar com o Supabase: ${err?.message || err}`,
      tableReady: false,
    };
  }
}

/**
 * SQL script for creating the unified table in the Supabase SQL editor.
 */
export const SUPABASE_SETUP_SQL = `-- SCRIPT DE CRIAÇÃO PARA SUPABASE (SISTEMA PCM NEXUS)
-- Cole e execute no painel do Supabase: 'SQL Editor' -> 'New Query' -> 'Run'

CREATE TABLE IF NOT EXISTS app_records (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para consultas ultrarrápidas por coleção
CREATE INDEX IF NOT EXISTS idx_app_records_collection ON app_records (collection);

-- Habilitar Row Level Security (RLS)
ALTER TABLE app_records ENABLE ROW LEVEL SECURITY;

-- Política de Leitura Pública/Anônima
DROP POLICY IF EXISTS "Permitir leitura app_records" ON app_records;
CREATE POLICY "Permitir leitura app_records" ON app_records 
  FOR SELECT USING (true);

-- Política de Inserção, Atualização e Exclusão Pública/Anônima
DROP POLICY IF EXISTS "Permitir escrita app_records" ON app_records;
CREATE POLICY "Permitir escrita app_records" ON app_records 
  FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime para atualizações em tempo real entre computadores
ALTER PUBLICATION supabase_realtime ADD TABLE app_records;
`;

// Generic CRUD operations on app_records
export async function upsertRecordToSupabase(collection: string, id: string, data: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('app_records').upsert({
      id,
      collection,
      data,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn(`[SUPABASE] Erro ao salvar registro em "${collection}" (${id}):`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[SUPABASE] Falha na rede ao salvar registro em "${collection}":`, err);
    return false;
  }
}

export async function deleteRecordFromSupabase(collection: string, id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('app_records').delete().eq('id', id).eq('collection', collection);
    if (error) {
      console.warn(`[SUPABASE] Erro ao excluir registro em "${collection}" (${id}):`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[SUPABASE] Falha ao excluir registro em "${collection}":`, err);
    return false;
  }
}

export async function clearCollectionFromSupabase(collection: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('app_records').delete().eq('collection', collection);
    if (error) {
      console.warn(`[SUPABASE] Erro ao limpar coleção "${collection}":`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[SUPABASE] Falha ao limpar coleção "${collection}":`, err);
    return false;
  }
}

export async function fetchCollectionFromSupabase<T>(collection: string): Promise<T[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('app_records')
      .select('id, data')
      .eq('collection', collection);

    if (error || !data) {
      return [];
    }

    return data.map((row: any) => row.data as T);
  } catch (err) {
    console.warn(`[SUPABASE] Falha ao buscar coleção "${collection}":`, err);
    return [];
  }
}

/**
 * Seeds all baseline datasets (810 dispenses, 30 fuel entries, equipments, logs, etc.)
 * directly into Supabase without losing any data.
 * Merges INITIAL datasets + currently stored local data into Supabase safely.
 */
export async function seedSupabaseInitialData(force = false): Promise<{
  success: boolean;
  message: string;
  counts: Record<string, number>;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase não configurado. Forneça o Project URL e a Anon Key.',
      counts: {},
    };
  }

  const counts: Record<string, number> = {};

  try {
    // Helper to merge initial data with existing local storage items safely
    const mergeWithLocal = <T extends { id: string }>(initial: T[], localLoader: () => T[]): T[] => {
      const map = new Map<string, T>();
      initial.forEach((item) => {
        if (item && item.id) map.set(item.id, item);
      });
      try {
        const localItems = localLoader();
        localItems.forEach((item) => {
          if (item && item.id) {
            const existing = map.get(item.id);
            map.set(item.id, existing ? { ...existing, ...item } : item);
          }
        });
      } catch {}
      return Array.from(map.values());
    };

    const collectionsToSeed: { name: string; items: any[] }[] = [
      { name: 'equipments', items: mergeWithLocal(INITIAL_EQUIPMENTS, loadEquipments) },
      { name: 'daily_logs', items: mergeWithLocal(INITIAL_LOGS, loadDailyLogs) },
      { name: 'fuel_dispenses', items: mergeWithLocal(INITIAL_FUEL_DISPENSES, loadFuelDispenses) },
      { name: 'fuel_entries', items: mergeWithLocal(INITIAL_FUEL_ENTRIES, loadFuelEntries) },
      { name: 'preventive_plans', items: mergeWithLocal(INITIAL_PREVENTIVE_PLANS, loadPreventivePlans) },
      { name: 'preventive_records', items: mergeWithLocal(INITIAL_PREVENTIVE_RECORDS, loadPreventiveRecords) },
      { name: 'corrective_maintenances', items: mergeWithLocal(INITIAL_CORRECTIVE_MAINTENANCES, loadCorrectiveMaintenances) },
      { name: 'measurement_deductions', items: mergeWithLocal(OFFICIAL_MEASUREMENT_DEDUCTIONS, loadMeasurementDeductions) },
      { name: 'app_users', items: mergeWithLocal(INITIAL_USERS, loadAppUsers) },
      { name: 'app_projects', items: mergeWithLocal(INITIAL_PROJECTS, loadAppProjects) },
    ];

    for (const group of collectionsToSeed) {
      let existingIds = new Set<string>();
      if (!force) {
        const { data } = await client
          .from('app_records')
          .select('id')
          .eq('collection', group.name);
        if (data) {
          existingIds = new Set(data.map((r: any) => r.id));
        }
      }

      const toInsert = group.items.filter((item) => force || !existingIds.has(item.id));
      if (toInsert.length > 0) {
        // Chunk inserts into batches of 100 for safety
        const chunkSize = 100;
        for (let i = 0; i < toInsert.length; i += chunkSize) {
          const chunk = toInsert.slice(i, i + chunkSize);
          const payload = chunk.map((item) => ({
            id: item.id,
            collection: group.name,
            data: item,
            updated_at: new Date().toISOString(),
          }));
          const { error } = await client.from('app_records').upsert(payload);
          if (error) {
            console.warn(`[SUPABASE SEED] Erro no lote de "${group.name}":`, error.message);
          }
        }
      }
      counts[group.name] = toInsert.length;
    }

    localStorage.setItem(SUPABASE_SEEDED_FLAG, 'true');
    return {
      success: true,
      message: 'Sincronização de todos os dados com o Supabase concluída com sucesso!',
      counts,
    };
  } catch (err: any) {
    console.error('[SUPABASE SEED] Erro geral:', err);
    return {
      success: false,
      message: `Erro na sincronização: ${err?.message || err}`,
      counts,
    };
  }
}

/**
 * Subscribes to real-time changes on a specific collection in Supabase.
 * Features:
 * 1. Immediate fetch from remote table
 * 2. Realtime postgres changes channel listener
 * 3. Polling interval fallback (every 10 seconds)
 * 4. Automatic seeding if remote collection is empty
 */
export function subscribeSupabaseCollection<T extends { id: string }>(
  collectionName: string,
  onUpdate: (items: T[]) => void,
  fallbackBaseline: T[] = [],
  onError?: (err: Error) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) {
    onUpdate(fallbackBaseline);
    return () => {};
  }

  let isMounted = true;
  let hasSeeded = false;

  const refreshData = async () => {
    if (!isMounted) return;
    try {
      const { data, error } = await client
        .from('app_records')
        .select('id, data')
        .eq('collection', collectionName);

      if (error) {
        if (onError) onError(new Error(error.message));
        return;
      }

      if (data && isMounted) {
        const items = data.map((row: any) => row.data as T);
        if (items.length > 0) {
          onUpdate(items);
        } else if (fallbackBaseline.length > 0) {
          // If remote is empty, provide fallback baseline and trigger background seed once
          onUpdate(fallbackBaseline);
          if (!hasSeeded) {
            hasSeeded = true;
            seedSupabaseInitialData(false).catch(() => {});
          }
        } else {
          onUpdate([]);
        }
      }
    } catch (err: any) {
      console.warn(`[SUPABASE] Falha na atualização de ${collectionName}:`, err);
      if (onError && err instanceof Error) onError(err);
    }
  };

  // 1. Initial fetch
  refreshData();

  // 2. Realtime subscription channel
  const channelName = `realtime:${collectionName}:${Math.random().toString(36).substring(7)}`;
  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_records',
        filter: `collection=eq.${collectionName}`,
      },
      () => {
        refreshData();
      }
    )
    .subscribe();

  // 3. Fallback interval polling (every 10 seconds) to ensure multi-computer sync even behind proxies
  const pollInterval = setInterval(refreshData, 10000);

  return () => {
    isMounted = false;
    clearInterval(pollInterval);
    try {
      client.removeChannel(channel);
    } catch {}
  };
}
