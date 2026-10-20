import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, testFirestoreConnection as rawTestFirestore } from '../lib/firebase';
import {
  isSupabaseConfigured,
  subscribeSupabaseCollection,
  upsertRecordToSupabase,
  deleteRecordFromSupabase,
  clearCollectionFromSupabase,
  seedSupabaseInitialData,
  testSupabaseConnection as testSupabaseConnectionReal,
} from './supabaseService';
import { OFFICIAL_MEASUREMENT_DEDUCTIONS } from '../data/officialDeductionsData';
import {
  Equipment,
  DailyLog,
  FuelDispense,
  FuelEntry,
  PreventivePlan,
  PreventiveRecord,
  MeasurementDeduction,
  CorrectiveMaintenance,
  AppProject,
  AppUser,
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
import { INITIAL_PROJECTS, INITIAL_USERS } from '../data/initialAuthData';
import {
  loadAppUsers,
  saveAppUsers,
  loadAppProjects,
  saveAppProjects,
  normalizeProjectCode,
  UNIFIED_WORK_CODE,
  CLEAN_WORK_062_PA,
  OFFICIAL_UNIFIED_PROJECT,
  OFFICIAL_062_PA_PROJECT,
} from '../utils/authStorage';
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
  loadMeasurementDeductions,
  saveMeasurementDeductions,
  loadCorrectiveMaintenances,
  saveCorrectiveMaintenances,
  sortDailyLogsAscending,
} from '../utils/storage';
import { loadInvoiceFilesFromIndexedDB } from './fuelFilesService';
import {
  saveMultipleCorrectivePhotosToIndexedDB,
  saveCorrectivePhotoToIndexedDB,
  loadAllCorrectivePhotosFromIndexedDB,
} from './correctiveFilesService';

const EQUIPMENTS_COLLECTION = 'equipments';
const DAILY_LOGS_COLLECTION = 'daily_logs';
const FUEL_DISPENSES_COLLECTION = 'fuel_dispenses';
const FUEL_ENTRIES_COLLECTION = 'fuel_entries';
const PREVENTIVE_PLANS_COLLECTION = 'preventive_plans';
const PREVENTIVE_RECORDS_COLLECTION = 'preventive_records';
const MEASUREMENT_DEDUCTIONS_COLLECTION = 'measurement_deductions';
const CORRECTIVE_MAINTENANCES_COLLECTION = 'corrective_maintenances';
export const APP_USERS_COLLECTION = 'app_users';
export const APP_PROJECTS_COLLECTION = 'app_projects';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Checks if remote collections are empty and seeds initial data if necessary.
 */
export async function seedInitialDataIfEmpty(): Promise<void> {
  if (isSupabaseConfigured()) {
    await seedSupabaseInitialData(false);
    return;
  }

  try {
    const eqSnapshot = await getDocs(collection(db, EQUIPMENTS_COLLECTION));
    if (eqSnapshot.empty) {
      console.log('Seeding initial equipment fleet to Firestore...');
      const batch = writeBatch(db);
      for (const eq of INITIAL_EQUIPMENTS) {
        const ref = doc(db, EQUIPMENTS_COLLECTION, eq.id);
        batch.set(ref, eq);
      }
      await batch.commit();
      console.log('Initial equipment fleet seeded.');
    } else {
      const existingMapById = new Map<string, Equipment>();
      const existingMapByPrefix = new Map<string, { id: string; eq: Equipment }>();
      const existingMapByPlate = new Map<string, { id: string; eq: Equipment }>();

      eqSnapshot.docs.forEach((d) => {
        const item = d.data() as Equipment;
        existingMapById.set(d.id, item);
        if (item.prefix) {
          existingMapByPrefix.set(item.prefix.trim().toUpperCase(), { id: d.id, eq: item });
        }
        if (item.plate) {
          existingMapByPlate.set(item.plate.trim().toUpperCase(), { id: d.id, eq: item });
        }
      });

      const batch = writeBatch(db);
      let needsCommit = false;

      for (const eq of INITIAL_EQUIPMENTS) {
        const normPrefix = (eq.prefix || '').trim().toUpperCase();
        const normPlate = (eq.plate || '').trim().toUpperCase();

        const match =
          (existingMapById.has(eq.id) ? { id: eq.id, eq: existingMapById.get(eq.id)! } : null) ||
          (normPrefix ? existingMapByPrefix.get(normPrefix) : null) ||
          (normPlate ? existingMapByPlate.get(normPlate) : null);

        if (!match) {
          batch.set(doc(db, EQUIPMENTS_COLLECTION, eq.id), eq);
          needsCommit = true;
        } else {
          // Never overwrite existing user data! Only advance meters if initial has higher readings, or fill missing identifiers
          const existingEq = match.eq;
          const targetHour = Math.max(existingEq.currentHourMeter || 0, eq.currentHourMeter || 0);
          const targetKm = Math.max(existingEq.currentKm || 0, eq.currentKm || 0);

          const updatePayload: Record<string, any> = {};
          let needsUpdate = false;

          if (targetHour > (existingEq.currentHourMeter || 0)) {
            updatePayload.currentHourMeter = targetHour;
            needsUpdate = true;
          }
          if (targetKm > (existingEq.currentKm || 0)) {
            updatePayload.currentKm = targetKm;
            needsUpdate = true;
          }
          if (!existingEq.code && eq.code) {
            updatePayload.code = eq.code;
            needsUpdate = true;
          }
          if (!existingEq.prefix && eq.prefix) {
            updatePayload.prefix = eq.prefix;
            needsUpdate = true;
          }

          if (needsUpdate) {
            updatePayload.updatedAt = new Date().toISOString();
            batch.update(doc(db, EQUIPMENTS_COLLECTION, match.id), updatePayload);
            needsCommit = true;
          }
        }
      }
      if (needsCommit) {
        await batch.commit();
        console.log('Synced updated fleet data to Firestore.');
      }
    }

    const logsSnapshot = await getDocs(collection(db, DAILY_LOGS_COLLECTION));
    if (logsSnapshot.empty) {
      console.log('Seeding initial daily logs to Firestore...');
      const batch = writeBatch(db);
      for (const log of sortDailyLogsAscending(INITIAL_LOGS)) {
        const ref = doc(db, DAILY_LOGS_COLLECTION, log.id);
        batch.set(ref, log);
      }
      await batch.commit();
      console.log('Initial daily logs seeded.');
    } else {
      // Check if Firestore is missing official daily logs, sync them safely
      const existingLogsMap = new Map<string, DailyLog>();
      logsSnapshot.forEach((docSnap) => existingLogsMap.set(docSnap.id, docSnap.data() as DailyLog));

      const hasOnlyDummy =
        existingLogsMap.size <= 2 &&
        Array.from(existingLogsMap.keys()).every((k) => k === 'log-1' || k === 'log-2');

      if (hasOnlyDummy) {
        console.log('Replacing legacy dummy daily logs in Firestore with official 82 logs...');
        const batch = writeBatch(db);
        logsSnapshot.forEach((docSnap) => batch.delete(docSnap.ref));
        for (const log of sortDailyLogsAscending(INITIAL_LOGS)) {
          const ref = doc(db, DAILY_LOGS_COLLECTION, log.id);
          batch.set(ref, log);
        }
        await batch.commit();
        console.log('Official daily logs successfully synchronized in Firestore.');
      } else {
        // Backfill any official logs that are not yet in Firestore
        const missingLogs = INITIAL_LOGS.filter((l) => !existingLogsMap.has(l.id));
        if (missingLogs.length > 0) {
          console.log(`Backfilling ${missingLogs.length} official logs to Firestore...`);
          const batch = writeBatch(db);
          for (const log of missingLogs) {
            const ref = doc(db, DAILY_LOGS_COLLECTION, log.id);
            batch.set(ref, log);
          }
          await batch.commit();
          console.log('Missing official daily logs backfilled to Firestore.');
        }
      }
    }

    // Sync and seed official fuel entries if needed
    if (INITIAL_FUEL_ENTRIES.length > 0) {
      const entriesSnapshot = await getDocs(collection(db, FUEL_ENTRIES_COLLECTION));
      if (entriesSnapshot.empty) {
        console.log('Seeding initial fuel entries to Firestore...');
        const batch = writeBatch(db);
        for (const entry of INITIAL_FUEL_ENTRIES) {
          const ref = doc(db, FUEL_ENTRIES_COLLECTION, entry.id);
          batch.set(ref, entry);
        }
        await batch.commit();
        console.log('Initial fuel entries seeded.');
      } else {
        // Clean up legacy placeholder IDs if present to avoid double counting with the 22 official entries
        const legacyPlaceholderIds = ['entry-rtw-001', 'entry-dza-001', 'entry-spf-001'];
        const batch = writeBatch(db);
        let batchHasOps = false;

        for (const docSnap of entriesSnapshot.docs) {
          if (legacyPlaceholderIds.includes(docSnap.id)) {
            batch.delete(docSnap.ref);
            batchHasOps = true;
          }
        }

        const existingEntryIds = new Set(
          entriesSnapshot.docs
            .map((d) => d.id)
            .filter((id) => !legacyPlaceholderIds.includes(id))
        );
        const missingEntries = INITIAL_FUEL_ENTRIES.filter((e) => !existingEntryIds.has(e.id));
        if (missingEntries.length > 0) {
          for (const entry of missingEntries) {
            const ref = doc(db, FUEL_ENTRIES_COLLECTION, entry.id);
            batch.set(ref, entry);
            batchHasOps = true;
          }
        }

        if (batchHasOps) {
          await batch.commit();
          console.log(`Cleaned up legacy entries and synchronized ${missingEntries.length} official fuel entries in Firestore.`);
        }
      }
    }

    if (INITIAL_FUEL_DISPENSES.length > 0) {
      const dispSnapshot = await getDocs(collection(db, FUEL_DISPENSES_COLLECTION));
      if (dispSnapshot.empty) {
        console.log(`Seeding ${INITIAL_FUEL_DISPENSES.length} initial fuel dispenses to Firestore...`);
        let batch = writeBatch(db);
        let count = 0;
        for (const disp of INITIAL_FUEL_DISPENSES) {
          const ref = doc(db, FUEL_DISPENSES_COLLECTION, disp.id);
          batch.set(ref, disp);
          count++;
          if (count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
        console.log('Initial fuel dispenses seeded.');
      } else {
        // Backfill any missing official dispenses
        const existingDispIds = new Set(dispSnapshot.docs.map((d) => d.id));
        const missingDispenses = INITIAL_FUEL_DISPENSES.filter((d) => !existingDispIds.has(d.id));
        if (missingDispenses.length > 0) {
          console.log(`Backfilling ${missingDispenses.length} official fuel dispenses to Firestore...`);
          let batch = writeBatch(db);
          let count = 0;
          for (const disp of missingDispenses) {
            const ref = doc(db, FUEL_DISPENSES_COLLECTION, disp.id);
            batch.set(ref, disp);
            count++;
            if (count >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
          if (count > 0) {
            await batch.commit();
          }
          console.log(`Backfilled ${missingDispenses.length} fuel dispenses to Firestore.`);
        }
      }
    }

    // Seed initial preventive plans if not present or backfill official plans
    if (INITIAL_PREVENTIVE_PLANS.length > 0) {
      const plansSnapshot = await getDocs(collection(db, PREVENTIVE_PLANS_COLLECTION));
      if (plansSnapshot.empty) {
        console.log('Seeding initial preventive plans to Firestore...');
        const batch = writeBatch(db);
        for (const plan of INITIAL_PREVENTIVE_PLANS) {
          const ref = doc(db, PREVENTIVE_PLANS_COLLECTION, plan.id);
          batch.set(ref, plan);
        }
        await batch.commit();
        console.log('Initial preventive plans seeded.');
      } else {
        const existingPlanIds = new Set(plansSnapshot.docs.map((d) => d.id));
        const missingOrUpdatedPlans = INITIAL_PREVENTIVE_PLANS.filter((p) => {
          if (!existingPlanIds.has(p.id)) return true;
          const remotePlan = plansSnapshot.docs.find((d) => d.id === p.id)?.data() as PreventivePlan;
          return (
            remotePlan.lastReviewDate !== p.lastReviewDate ||
            remotePlan.lastReviewHourMeter !== p.lastReviewHourMeter ||
            remotePlan.lastReviewKm !== p.lastReviewKm ||
            remotePlan.intervalValue !== p.intervalValue
          );
        });
        if (missingOrUpdatedPlans.length > 0) {
          const batch = writeBatch(db);
          for (const plan of missingOrUpdatedPlans) {
            batch.set(doc(db, PREVENTIVE_PLANS_COLLECTION, plan.id), plan, { merge: true });
          }
          await batch.commit();
          console.log(`Synced ${missingOrUpdatedPlans.length} official preventive plans in Firestore.`);
        }
      }
    }

    // Seed initial preventive records if not present or backfill official records
    if (INITIAL_PREVENTIVE_RECORDS.length > 0) {
      const recordsSnapshot = await getDocs(collection(db, PREVENTIVE_RECORDS_COLLECTION));
      if (recordsSnapshot.empty) {
        console.log('Seeding initial preventive records to Firestore...');
        const batch = writeBatch(db);
        for (const rec of INITIAL_PREVENTIVE_RECORDS) {
          const ref = doc(db, PREVENTIVE_RECORDS_COLLECTION, rec.id);
          batch.set(ref, rec);
        }
        await batch.commit();
        console.log('Initial preventive records seeded.');
      } else {
        const existingRecIds = new Set(recordsSnapshot.docs.map((d) => d.id));
        const missingRecords = INITIAL_PREVENTIVE_RECORDS.filter((r) => !existingRecIds.has(r.id));
        if (missingRecords.length > 0) {
          const batch = writeBatch(db);
          for (const rec of missingRecords) {
            batch.set(doc(db, PREVENTIVE_RECORDS_COLLECTION, rec.id), rec);
          }
          await batch.commit();
          console.log(`Backfilled ${missingRecords.length} official preventive records to Firestore.`);
        }
      }
    }

    // Seed initial projects/obras if not present
    const projectsSnapshot = await getDocs(collection(db, APP_PROJECTS_COLLECTION));
    if (projectsSnapshot.empty) {
      console.log('Seeding initial app projects (obras) to Firestore...');
      const batch = writeBatch(db);
      for (const proj of INITIAL_PROJECTS) {
        const ref = doc(db, APP_PROJECTS_COLLECTION, proj.id);
        batch.set(ref, proj);
      }
      await batch.commit();
      console.log('Initial app projects seeded.');
    }

    // Seed initial users if not present
    const usersSnapshot = await getDocs(collection(db, APP_USERS_COLLECTION));
    if (usersSnapshot.empty) {
      console.log('Seeding initial app users to Firestore...');
      const batch = writeBatch(db);
      for (const usr of INITIAL_USERS) {
        const ref = doc(db, APP_USERS_COLLECTION, usr.id);
        batch.set(ref, usr);
      }
      await batch.commit();
      console.log('Initial app users seeded.');
    } else {
      // Ensure admin password in Firestore is updated to 132587 if it was using legacy admin
      const adminDoc = usersSnapshot.docs.find((d) => d.id === 'user-admin' || d.data().username === 'admin');
      if (adminDoc && adminDoc.data().password === 'admin') {
        const batch = writeBatch(db);
        batch.update(adminDoc.ref, { password: '132587' });
        await batch.commit();
        console.log('Updated admin password to 132587 in Firestore.');
      }
    }
  } catch (err) {
    console.warn('Could not seed initial data to Firestore (might be offline):', err);
  }
}

/**
 * Completely clears all preventive plans and preventive records from Firestore,
 * ensuring the preventive maintenance (PCM) module starts completely clean at 0.
 * Does NOT touch or alter any other collections (equipments, logs, fuel, etc.).
 */
export async function clearPreventiveDataFromFirestore(): Promise<void> {
  if (isSupabaseConfigured()) {
    await clearCollectionFromSupabase(PREVENTIVE_PLANS_COLLECTION);
    await clearCollectionFromSupabase(PREVENTIVE_RECORDS_COLLECTION);
    return;
  }

  try {
    const plansSnap = await getDocs(collection(db, PREVENTIVE_PLANS_COLLECTION));
    if (!plansSnap.empty) {
      const batch = writeBatch(db);
      plansSnap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      console.log(`Deleted ${plansSnap.size} preventive plans from Firestore.`);
    }

    const recordsSnap = await getDocs(collection(db, PREVENTIVE_RECORDS_COLLECTION));
    if (!recordsSnap.empty) {
      const batch = writeBatch(db);
      recordsSnap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      console.log(`Deleted ${recordsSnap.size} preventive records from Firestore.`);
    }
  } catch (err) {
    console.error('Error clearing preventive data from Firestore:', err);
    throw err;
  }
}

/**
 * Completely clears all fuel entries and fuel dispenses from Firestore,
 * ensuring the fuel control tab is clean and starts fresh at 0.
 */
export async function clearFuelDataFromFirestore(): Promise<void> {
  if (isSupabaseConfigured()) {
    await clearCollectionFromSupabase(FUEL_ENTRIES_COLLECTION);
    await clearCollectionFromSupabase(FUEL_DISPENSES_COLLECTION);
    return;
  }

  try {
    const entriesSnap = await getDocs(collection(db, FUEL_ENTRIES_COLLECTION));
    if (!entriesSnap.empty) {
      const batch = writeBatch(db);
      entriesSnap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      console.log(`Deleted ${entriesSnap.size} fuel entries from Firestore.`);
    }

    const dispensesSnap = await getDocs(collection(db, FUEL_DISPENSES_COLLECTION));
    if (!dispensesSnap.empty) {
      const batch = writeBatch(db);
      dispensesSnap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      console.log(`Deleted ${dispensesSnap.size} fuel dispenses from Firestore.`);
    }
  } catch (err) {
    console.error('Error clearing fuel data from Firestore:', err);
    throw err;
  }
}

/**
 * Completely clears all corrective maintenances from Firestore,
 * ensuring the corrective maintenance module starts completely clean at 0.
 * Does NOT touch or alter any other collections (equipments, logs, fuel, etc.).
 */
export async function clearCorrectiveDataFromFirestore(): Promise<void> {
  if (isSupabaseConfigured()) {
    await clearCollectionFromSupabase(CORRECTIVE_MAINTENANCES_COLLECTION);
    return;
  }

  try {
    const correctivesSnap = await getDocs(collection(db, CORRECTIVE_MAINTENANCES_COLLECTION));
    if (!correctivesSnap.empty) {
      const batch = writeBatch(db);
      correctivesSnap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      console.log(`Deleted ${correctivesSnap.size} corrective maintenances from Firestore.`);
    }
  } catch (err) {
    console.error('Error clearing corrective data from Firestore:', err);
    throw err;
  }
}

/**
 * Subscribes to real-time updates for equipments.
 */
export function subscribeEquipments(
  onUpdate: (equipments: Equipment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (isSupabaseConfigured()) {
    return subscribeSupabaseCollection<Equipment>(
      EQUIPMENTS_COLLECTION,
      (remoteItems) => {
        const mergedMap = new Map<string, Equipment>();
        INITIAL_EQUIPMENTS.forEach((eq) => mergedMap.set(eq.id, eq));
        loadEquipments().forEach((eq) => {
          if (eq && eq.id) mergedMap.set(eq.id, eq);
        });
        remoteItems.forEach((eq) => {
          if (eq && eq.id) mergedMap.set(eq.id, eq);
        });
        const finalItems = Array.from(mergedMap.values()).sort((a, b) =>
          (a.code || '').localeCompare(b.code || '')
        );
        saveEquipments(finalItems);
        onUpdate(finalItems);
      },
      INITIAL_EQUIPMENTS,
      onError
    );
  }

  const q = query(collection(db, EQUIPMENTS_COLLECTION), orderBy('code', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      // If snapshot is empty, do not clear out data!
      if (snapshot.empty) {
        console.warn('Firestore equipments snapshot is empty, keeping local/initial equipment data.');
        const current = loadEquipments();
        onUpdate(current.length > 0 ? current : INITIAL_EQUIPMENTS);
        return;
      }

      const firestoreItems: Equipment[] = [];
      snapshot.forEach((docSnap) => {
        firestoreItems.push(docSnap.data() as Equipment);
      });

      // Merge Firestore items with INITIAL_EQUIPMENTS so baseline equipments are never lost
      const mergedMap = new Map<string, Equipment>();
      INITIAL_EQUIPMENTS.forEach((eq) => mergedMap.set(eq.id, eq));
      // Local equipment fallback
      loadEquipments().forEach((eq) => {
        if (eq && eq.id) mergedMap.set(eq.id, eq);
      });
      // Firestore live truth: user modifications always take precedence
      firestoreItems.forEach((eq) => {
        const official = INITIAL_EQUIPMENTS.find(
          (o) => o.id === eq.id || (o.plate && eq.plate && o.plate.toUpperCase() === eq.plate.toUpperCase())
        );
        if (official) {
          mergedMap.set(official.id, {
            ...official,
            ...eq,
            operator: eq.operator || official.operator,
            currentHourMeter: Math.max(official.currentHourMeter || 0, eq.currentHourMeter || 0),
            lastHourMeterDate: eq.lastHourMeterDate || official.lastHourMeterDate,
            currentKm: Math.max(official.currentKm || 0, eq.currentKm || 0),
            lastKmDate: eq.lastKmDate || official.lastKmDate,
          });
        } else {
          mergedMap.set(eq.id, eq);
        }
      });

      const finalItems = Array.from(mergedMap.values()).sort((a, b) =>
        (a.code || '').localeCompare(b.code || '')
      );

      // Keep localStorage in sync as cache
      saveEquipments(finalItems);
      onUpdate(finalItems);
    },
    (err) => {
      console.error('Error listening to equipments from Firestore:', err);
      if (onError) onError(err);
      // Fallback to local storage on connection error
      onUpdate(loadEquipments());
    }
  );
}

/**
 * Subscribes to real-time updates for daily logs in chronological ascending order by date.
 */
export function subscribeDailyLogs(
  onUpdate: (logs: DailyLog[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (isSupabaseConfigured()) {
    return subscribeSupabaseCollection<DailyLog>(
      DAILY_LOGS_COLLECTION,
      (remoteLogs) => {
        const logsMap = new Map<string, DailyLog>();
        INITIAL_LOGS.forEach((log) => logsMap.set(log.id, log));
        loadDailyLogs().forEach((log) => logsMap.set(log.id, log));
        remoteLogs.forEach((log) => logsMap.set(log.id, log));
        const sortedItems = sortDailyLogsAscending(Array.from(logsMap.values()));
        saveDailyLogs(sortedItems);
        onUpdate(sortedItems);
      },
      INITIAL_LOGS,
      onError
    );
  }

  const q = query(collection(db, DAILY_LOGS_COLLECTION), orderBy('date', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        console.warn('Firestore daily logs snapshot is empty, keeping local/initial daily logs.');
        const current = loadDailyLogs();
        onUpdate(current.length > 0 ? current : INITIAL_LOGS);
        return;
      }

      const firestoreLogs: DailyLog[] = [];
      snapshot.forEach((docSnap) => {
        firestoreLogs.push(docSnap.data() as DailyLog);
      });

      // Merge with initial official logs and local logs to guarantee no logs vanish
      const logsMap = new Map<string, DailyLog>();
      INITIAL_LOGS.forEach((log) => logsMap.set(log.id, log));
      loadDailyLogs().forEach((log) => logsMap.set(log.id, log));
      firestoreLogs.forEach((log) => logsMap.set(log.id, log));

      // Sort ascending by date (oldest to newest)
      const sortedItems = sortDailyLogsAscending(Array.from(logsMap.values()));

      // Keep localStorage in sync as cache
      saveDailyLogs(sortedItems);
      onUpdate(sortedItems);
    },
    (err) => {
      console.error('Error listening to daily logs from Firestore:', err);
      if (onError) onError(err);
      // Fallback to local storage on connection error
      onUpdate(loadDailyLogs());
    }
  );
}

/**
 * Sanitizes equipment data for Firestore, preventing undefined fields
 * and preventing oversized Base64 documents (>800KB).
 */
function sanitizeEquipmentForFirestore(equipment: Equipment): any {
  const clean: any = {};
  for (const [key, value] of Object.entries(equipment)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }

  // If equipment has attached files, store metadata safely without blowing document limit
  if (Array.isArray(clean.files)) {
    clean.files = clean.files.map((f: any) => {
      const fClean: any = {};
      for (const [fk, fv] of Object.entries(f)) {
        if (fv !== undefined) {
          fClean[fk] = fv;
        }
      }
      // If dataUrl exceeds 200KB, remove from main equipment document (stored in equipment_files collection/IndexedDB)
      if (fClean.dataUrl && fClean.dataUrl.length > 200 * 1024) {
        fClean.dataUrl = '';
      }
      return fClean;
    });
  }

  return clean;
}

/**
 * Adds or saves an equipment to Firestore or Supabase.
 */
export async function saveEquipmentToFirestore(equipment: Equipment): Promise<void> {
  const sanitized = sanitizeEquipmentForFirestore(equipment);
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(EQUIPMENTS_COLLECTION, equipment.id, sanitized);
    return;
  }

  try {
    const docRef = doc(db, EQUIPMENTS_COLLECTION, equipment.id);
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Failed to save equipment to Firestore:', err);
    throw err;
  }
}

/**
 * Updates an existing equipment in Firestore or Supabase.
 */
export async function updateEquipmentInFirestore(equipment: Equipment): Promise<void> {
  const sanitized = sanitizeEquipmentForFirestore(equipment);
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(EQUIPMENTS_COLLECTION, equipment.id, sanitized);
    return;
  }

  try {
    const docRef = doc(db, EQUIPMENTS_COLLECTION, equipment.id);
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Failed to update equipment in Firestore:', err);
    throw err;
  }
}

/**
 * Deletes an equipment from Firestore or Supabase.
 */
export async function deleteEquipmentFromFirestore(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await deleteRecordFromSupabase(EQUIPMENTS_COLLECTION, id);
    return;
  }

  try {
    const docRef = doc(db, EQUIPMENTS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete equipment from Firestore:', err);
    throw err;
  }
}

/**
 * Saves a daily log and updates the reference equipment's currentHourMeter in Firestore.
 */
export async function saveDailyLogToFirestore(
  log: DailyLog,
  equipmentToUpdate?: { id: string; finalHourMeter: number }
): Promise<void> {
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(DAILY_LOGS_COLLECTION, log.id, log);
    if (equipmentToUpdate) {
      const allEq = loadEquipments();
      const eq = allEq.find((e) => e.id === equipmentToUpdate.id);
      if (eq) {
        const updatedEq = {
          ...eq,
          currentHourMeter: equipmentToUpdate.finalHourMeter,
          updatedAt: new Date().toISOString(),
        };
        await upsertRecordToSupabase(EQUIPMENTS_COLLECTION, equipmentToUpdate.id, updatedEq);
      }
    }
    return;
  }

  try {
    const batch = writeBatch(db);

    // 1. Add/Set daily log
    const logRef = doc(db, DAILY_LOGS_COLLECTION, log.id);
    batch.set(logRef, log);

    // 2. Update equipment hourmeter
    if (equipmentToUpdate) {
      const eqRef = doc(db, EQUIPMENTS_COLLECTION, equipmentToUpdate.id);
      batch.update(eqRef, {
        currentHourMeter: equipmentToUpdate.finalHourMeter,
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
  } catch (err) {
    console.error('Failed to save daily log to Firestore:', err);
    throw err;
  }
}

/**
 * Deletes a daily log from Firestore or Supabase.
 */
export async function deleteDailyLogFromFirestore(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await deleteRecordFromSupabase(DAILY_LOGS_COLLECTION, id);
    return;
  }

  try {
    const docRef = doc(db, DAILY_LOGS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete daily log from Firestore:', err);
    throw err;
  }
}

/**
 * Safely synchronizes baseline defaults into Firestore or Supabase without deleting any existing data.
 */
export async function restoreFirestoreDefaults(): Promise<void> {
  if (isSupabaseConfigured()) {
    await seedSupabaseInitialData(true);
    return;
  }

  try {
    // Non-destructive safe upsert: NEVER delete existing user data!
    let insertBatch = writeBatch(db);
    let insertCount = 0;

    const commitInsertIfNeeded = async () => {
      insertCount++;
      if (insertCount >= 400) {
        await insertBatch.commit();
        insertBatch = writeBatch(db);
        insertCount = 0;
      }
    };

    for (const eq of INITIAL_EQUIPMENTS) {
      const ref = doc(db, EQUIPMENTS_COLLECTION, eq.id);
      insertBatch.set(ref, eq, { merge: true });
      await commitInsertIfNeeded();
    }

    for (const log of sortDailyLogsAscending(INITIAL_LOGS)) {
      const ref = doc(db, DAILY_LOGS_COLLECTION, log.id);
      insertBatch.set(ref, log, { merge: true });
      await commitInsertIfNeeded();
    }

    for (const entry of INITIAL_FUEL_ENTRIES) {
      const ref = doc(db, FUEL_ENTRIES_COLLECTION, entry.id);
      insertBatch.set(ref, entry, { merge: true });
      await commitInsertIfNeeded();
    }

    for (const disp of INITIAL_FUEL_DISPENSES) {
      const ref = doc(db, FUEL_DISPENSES_COLLECTION, disp.id);
      insertBatch.set(ref, disp, { merge: true });
      await commitInsertIfNeeded();
    }

    for (const plan of INITIAL_PREVENTIVE_PLANS) {
      const ref = doc(db, PREVENTIVE_PLANS_COLLECTION, plan.id);
      insertBatch.set(ref, plan, { merge: true });
      await commitInsertIfNeeded();
    }

    for (const rec of INITIAL_PREVENTIVE_RECORDS) {
      const ref = doc(db, PREVENTIVE_RECORDS_COLLECTION, rec.id);
      insertBatch.set(ref, rec, { merge: true });
      await commitInsertIfNeeded();
    }

    for (const corr of INITIAL_CORRECTIVE_MAINTENANCES) {
      const ref = doc(db, CORRECTIVE_MAINTENANCES_COLLECTION, corr.id);
      insertBatch.set(ref, corr, { merge: true });
      await commitInsertIfNeeded();
    }

    if (insertCount > 0) {
      await insertBatch.commit();
    }

    console.log('Baseline safely synchronized in Firestore without deleting any existing data.');
  } catch (err) {
    console.error('Failed to safely synchronize baseline in Firestore:', err);
    throw err;
  }
}

/**
 * Subscribes to real-time updates for fuel dispenses (saídas de diesel dos comboios).
 */
export function subscribeFuelDispenses(
  onUpdate: (dispenses: FuelDispense[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (isSupabaseConfigured()) {
    return subscribeSupabaseCollection<FuelDispense>(
      FUEL_DISPENSES_COLLECTION,
      (remoteItems) => {
        const dispMap = new Map<string, FuelDispense>();
        INITIAL_FUEL_DISPENSES.forEach((d) => dispMap.set(d.id, d));
        loadFuelDispenses().forEach((d) => dispMap.set(d.id, d));
        remoteItems.forEach((d) => {
          if ((d.convoyPlate as string) === 'SFC2C66') {
            d.convoyPlate = 'SPF2C66';
          }
          dispMap.set(d.id, d);
        });

        const finalItems = Array.from(dispMap.values()).sort(
          (a, b) => a.date.localeCompare(b.date) || a.initialMeter - b.initialMeter
        );

        saveFuelDispenses(finalItems);
        onUpdate(finalItems);
      },
      INITIAL_FUEL_DISPENSES,
      onError
    );
  }

  const q = query(collection(db, FUEL_DISPENSES_COLLECTION), orderBy('date', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        console.warn('Firestore fuel dispenses snapshot is empty, keeping local/initial dispenses.');
        const current = loadFuelDispenses();
        onUpdate(current.length > 0 ? current : INITIAL_FUEL_DISPENSES);
        return;
      }

      const firestoreDispenses: FuelDispense[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as FuelDispense;
        if ((d.convoyPlate as string) === 'SFC2C66') {
          d.convoyPlate = 'SPF2C66';
        }
        firestoreDispenses.push(d);
      });

      // Merge INITIAL_FUEL_DISPENSES (all 523 items) + local items + firestore items
      const dispMap = new Map<string, FuelDispense>();
      INITIAL_FUEL_DISPENSES.forEach((d) => dispMap.set(d.id, d));
      loadFuelDispenses().forEach((d) => dispMap.set(d.id, d));
      firestoreDispenses.forEach((d) => dispMap.set(d.id, d));

      const finalItems = Array.from(dispMap.values()).sort(
        (a, b) => a.date.localeCompare(b.date) || a.initialMeter - b.initialMeter
      );

      saveFuelDispenses(finalItems);
      onUpdate(finalItems);
    },
    (err) => {
      console.error('Error listening to fuel dispenses from Firestore:', err);
      if (onError) onError(err);
      onUpdate(loadFuelDispenses());
    }
  );
}

/**
 * Sanitizes an object for Firestore by removing unsupported undefined values.
 * Handles Firestore 1MB limits safely for heavy base64 attachments.
 */
function prepareFuelEntryForFirestore(entry: FuelEntry, isUpdate = false): Record<string, any> {
  const data: Record<string, any> = { ...entry };

  // Guard against Firestore 1MB document limit:
  // If base64 payload is larger than ~750KB, store metadata only in fuel_entries;
  // the full file payload is stored securely in IndexedDB and fuel_invoice_files.
  if (data.attachmentUrl && data.attachmentUrl.length > 750000) {
    data.attachmentUrl = '';
    data.isHeavyAttachment = true;
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && val !== null) {
      sanitized[key] = val;
    } else if (isUpdate) {
      // If a field is explicitly undefined/null on an update, delete it from Firestore
      sanitized[key] = deleteField();
    }
  }

  return sanitized;
}

/**
 * Subscribes to real-time updates for fuel entries (entradas de diesel no tanque).
 */
export function subscribeFuelEntries(
  onUpdate: (entries: FuelEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (isSupabaseConfigured()) {
    return subscribeSupabaseCollection<FuelEntry>(
      FUEL_ENTRIES_COLLECTION,
      async (remoteItems) => {
        const legacyPlaceholderIds = ['entry-rtw-001', 'entry-dza-001', 'entry-spf-001'];
        const entriesMap = new Map<string, FuelEntry>();
        INITIAL_FUEL_ENTRIES.forEach((e) => entriesMap.set(e.id, e));
        loadFuelEntries().forEach((e) => {
          if (!legacyPlaceholderIds.includes(e.id)) {
            entriesMap.set(e.id, e);
          }
        });
        remoteItems.forEach((e) => {
          if (!legacyPlaceholderIds.includes(e.id)) {
            if (e.destination && e.destination.includes('SFC2C66')) {
              e.destination = e.destination.replace(/SFC2C66/g, 'SPF2C66');
            }
            entriesMap.set(e.id, e);
          }
        });

        const items = Array.from(entriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        try {
          const localFiles = await loadInvoiceFilesFromIndexedDB();
          const fileMap = new Map(localFiles.map((f) => [f.id, f]));

          const hydrated = items.map((entry) => {
            if ((!entry.attachmentUrl || entry.attachmentUrl.length === 0) && entry.attachmentName) {
              const matched = fileMap.get(`file_entry_${entry.id}`);
              if (matched && matched.dataUrl) {
                return { ...entry, attachmentUrl: matched.dataUrl };
              }
            }
            return entry;
          });

          saveFuelEntries(hydrated);
          onUpdate(hydrated);
        } catch {
          saveFuelEntries(items);
          onUpdate(items);
        }
      },
      INITIAL_FUEL_ENTRIES,
      onError
    );
  }

  const q = query(collection(db, FUEL_ENTRIES_COLLECTION), orderBy('date', 'asc'));

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty) {
        console.warn('Firestore fuel entries snapshot is empty, keeping local/initial entries.');
        const current = loadFuelEntries();
        onUpdate(current.length > 0 ? current : INITIAL_FUEL_ENTRIES);
        return;
      }

      const firestoreEntries: FuelEntry[] = [];
      snapshot.forEach((docSnap) => {
        const e = docSnap.data() as FuelEntry;
        if (e.destination && e.destination.includes('SFC2C66')) {
          e.destination = e.destination.replace(/SFC2C66/g, 'SPF2C66');
        }
        firestoreEntries.push(e);
      });

      const legacyPlaceholderIds = ['entry-rtw-001', 'entry-dza-001', 'entry-spf-001'];
      const entriesMap = new Map<string, FuelEntry>();
      INITIAL_FUEL_ENTRIES.forEach((e) => entriesMap.set(e.id, e));
      loadFuelEntries().forEach((e) => {
        if (!legacyPlaceholderIds.includes(e.id)) {
          entriesMap.set(e.id, e);
        }
      });
      firestoreEntries.forEach((e) => {
        if (!legacyPlaceholderIds.includes(e.id)) {
          entriesMap.set(e.id, e);
        }
      });

      const items = Array.from(entriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      // Try to rehydrate missing attachmentUrls from IndexedDB if local copies exist
      try {
        const localFiles = await loadInvoiceFilesFromIndexedDB();
        const fileMap = new Map(localFiles.map((f) => [f.id, f]));

        const hydrated = items.map((entry) => {
          if ((!entry.attachmentUrl || entry.attachmentUrl.length === 0) && entry.attachmentName) {
            const matched = fileMap.get(`file_entry_${entry.id}`);
            if (matched && matched.dataUrl) {
              return { ...entry, attachmentUrl: matched.dataUrl };
            }
          }
          return entry;
        });

        saveFuelEntries(hydrated);
        onUpdate(hydrated);
      } catch {
        saveFuelEntries(items);
        onUpdate(items);
      }
    },
    (err) => {
      console.error('Error listening to fuel entries from Firestore:', err);
      if (onError) onError(err);
      onUpdate(loadFuelEntries());
    }
  );
}

/**
 * Saves a fuel dispense log to Firestore or Supabase.
 */
export async function saveFuelDispenseToFirestore(dispense: FuelDispense): Promise<void> {
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(FUEL_DISPENSES_COLLECTION, dispense.id, dispense);
    return;
  }

  try {
    const docRef = doc(db, FUEL_DISPENSES_COLLECTION, dispense.id);
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(dispense)) {
      if (v !== undefined) sanitized[k] = v;
    }
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Failed to save fuel dispense to Firestore:', err);
    throw err;
  }
}

/**
 * Updates an existing fuel dispense in Firestore or Supabase.
 */
export async function updateFuelDispenseInFirestore(dispense: FuelDispense): Promise<void> {
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(FUEL_DISPENSES_COLLECTION, dispense.id, dispense);
    return;
  }

  try {
    const docRef = doc(db, FUEL_DISPENSES_COLLECTION, dispense.id);
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(dispense)) {
      if (v !== undefined) sanitized[k] = v;
    }
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Failed to update fuel dispense in Firestore:', err);
    throw err;
  }
}

/**
 * Deletes a fuel dispense log from Firestore or Supabase.
 */
export async function deleteFuelDispenseFromFirestore(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await deleteRecordFromSupabase(FUEL_DISPENSES_COLLECTION, id);
    return;
  }

  try {
    const docRef = doc(db, FUEL_DISPENSES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete fuel dispense from Firestore:', err);
    throw err;
  }
}

/**
 * Saves a fuel entry to Firestore or Supabase.
 */
export async function saveFuelEntryToFirestore(entry: FuelEntry): Promise<void> {
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(FUEL_ENTRIES_COLLECTION, entry.id, entry);
    return;
  }

  try {
    const docRef = doc(db, FUEL_ENTRIES_COLLECTION, entry.id);
    const payload = prepareFuelEntryForFirestore(entry, false);
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.error('Failed to save fuel entry to Firestore:', err);
    throw err;
  }
}

/**
 * Updates an existing fuel entry in Firestore or Supabase.
 */
export async function updateFuelEntryInFirestore(entry: FuelEntry): Promise<void> {
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(FUEL_ENTRIES_COLLECTION, entry.id, entry);
    return;
  }

  try {
    const docRef = doc(db, FUEL_ENTRIES_COLLECTION, entry.id);
    const payload = prepareFuelEntryForFirestore(entry, true);
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.error('Failed to update fuel entry in Firestore:', err);
    throw err;
  }
}

/**
 * Deletes a fuel entry from Firestore or Supabase.
 */
export async function deleteFuelEntryFromFirestore(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await deleteRecordFromSupabase(FUEL_ENTRIES_COLLECTION, id);
    return;
  }

  try {
    const docRef = doc(db, FUEL_ENTRIES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete fuel entry from Firestore:', err);
    throw err;
  }
}

// ==========================================
// PREVENTIVE MAINTENANCE FIRESTORE SERVICES
// ==========================================

/**
 * Subscribes to real-time updates for preventive plans.
 */
export function subscribePreventivePlans(
  onUpdate: (plans: PreventivePlan[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (isSupabaseConfigured()) {
    return subscribeSupabaseCollection<PreventivePlan>(
      PREVENTIVE_PLANS_COLLECTION,
      (remoteItems) => {
        const planMap = new Map<string, PreventivePlan>();
        INITIAL_PREVENTIVE_PLANS.forEach((p) => planMap.set(p.id, p));
        loadPreventivePlans().forEach((p) => planMap.set(p.id, p));
        remoteItems.forEach((p) => planMap.set(p.id, p));
        const finalPlans = Array.from(planMap.values());
        savePreventivePlans(finalPlans);
        onUpdate(finalPlans);
      },
      INITIAL_PREVENTIVE_PLANS,
      onError
    );
  }

  const q = query(collection(db, PREVENTIVE_PLANS_COLLECTION));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        console.warn('Firestore preventive plans snapshot is empty, keeping local/initial plans.');
        const current = loadPreventivePlans();
        onUpdate(current.length > 0 ? current : INITIAL_PREVENTIVE_PLANS);
        return;
      }
      const firestorePlans: PreventivePlan[] = [];
      snapshot.forEach((docSnap) => {
        firestorePlans.push(docSnap.data() as PreventivePlan);
      });

      const planMap = new Map<string, PreventivePlan>();
      INITIAL_PREVENTIVE_PLANS.forEach((p) => planMap.set(p.id, p));
      loadPreventivePlans().forEach((p) => planMap.set(p.id, p));
      firestorePlans.forEach((p) => planMap.set(p.id, p)); // Firestore takes precedence

      const finalPlans = Array.from(planMap.values());
      savePreventivePlans(finalPlans);
      onUpdate(finalPlans);
    },
    (err) => {
      console.error('Error listening to preventive plans from Firestore:', err);
      if (onError) onError(err);
      onUpdate(loadPreventivePlans());
    }
  );
}

/**
 * Saves or updates a preventive plan in Firestore or Supabase.
 */
export async function savePreventivePlanToFirestore(plan: PreventivePlan): Promise<void> {
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(PREVENTIVE_PLANS_COLLECTION, plan.id, plan);
    return;
  }

  try {
    const docRef = doc(db, PREVENTIVE_PLANS_COLLECTION, plan.id);
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(plan)) {
      if (v !== undefined) sanitized[k] = v;
    }
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Failed to save preventive plan to Firestore:', err);
    throw err;
  }
}

/**
 * Deletes a preventive plan from Firestore or Supabase.
 */
export async function deletePreventivePlanFromFirestore(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await deleteRecordFromSupabase(PREVENTIVE_PLANS_COLLECTION, id);
    return;
  }

  try {
    const docRef = doc(db, PREVENTIVE_PLANS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete preventive plan from Firestore:', err);
    throw err;
  }
}

/**
 * Subscribes to real-time updates for preventive history records (in descending order by date).
 */
export function subscribePreventiveRecords(
  onUpdate: (records: PreventiveRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (isSupabaseConfigured()) {
    return subscribeSupabaseCollection<PreventiveRecord>(
      PREVENTIVE_RECORDS_COLLECTION,
      (remoteItems) => {
        const recMap = new Map<string, PreventiveRecord>();
        INITIAL_PREVENTIVE_RECORDS.forEach((r) => recMap.set(r.id, r));
        loadPreventiveRecords().forEach((r) => recMap.set(r.id, r));
        remoteItems.forEach((r) => recMap.set(r.id, r));

        const finalRecords = Array.from(recMap.values()).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        savePreventiveRecords(finalRecords);
        onUpdate(finalRecords);
      },
      INITIAL_PREVENTIVE_RECORDS,
      onError
    );
  }

  const q = query(collection(db, PREVENTIVE_RECORDS_COLLECTION), orderBy('date', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        console.warn('Firestore preventive records snapshot is empty, keeping local/initial records.');
        const current = loadPreventiveRecords();
        onUpdate(current.length > 0 ? current : INITIAL_PREVENTIVE_RECORDS);
        return;
      }
      const firestoreRecords: PreventiveRecord[] = [];
      snapshot.forEach((docSnap) => {
        firestoreRecords.push(docSnap.data() as PreventiveRecord);
      });

      const recMap = new Map<string, PreventiveRecord>();
      INITIAL_PREVENTIVE_RECORDS.forEach((r) => recMap.set(r.id, r));
      loadPreventiveRecords().forEach((r) => recMap.set(r.id, r));
      firestoreRecords.forEach((r) => recMap.set(r.id, r)); // Firestore takes precedence

      const finalRecords = Array.from(recMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      savePreventiveRecords(finalRecords);
      onUpdate(finalRecords);
    },
    (err) => {
      console.error('Error listening to preventive records from Firestore:', err);
      if (onError) onError(err);
      onUpdate(loadPreventiveRecords());
    }
  );
}

/**
 * Saves a new preventive record to Firestore or Supabase.
 */
export async function savePreventiveRecordToFirestore(record: PreventiveRecord): Promise<void> {
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(PREVENTIVE_RECORDS_COLLECTION, record.id, record);
    return;
  }

  try {
    const docRef = doc(db, PREVENTIVE_RECORDS_COLLECTION, record.id);
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(record)) {
      if (v !== undefined) {
        if (k === 'attachments' && Array.isArray(v)) {
          // Keep attachment metadata, sanitize oversized dataUrls if needed
          sanitized[k] = v.map((att: any) => ({
            ...att,
            dataUrl: att.dataUrl && att.dataUrl.length > 200000 ? '' : att.dataUrl,
          }));
        } else {
          sanitized[k] = v;
        }
      }
    }
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Failed to save preventive record to Firestore:', err);
    throw err;
  }
}

/**
 * Deletes a preventive record from Firestore or Supabase.
 */
export async function deletePreventiveRecordFromFirestore(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await deleteRecordFromSupabase(PREVENTIVE_RECORDS_COLLECTION, id);
    return;
  }

  try {
    const docRef = doc(db, PREVENTIVE_RECORDS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete preventive record from Firestore:', err);
    throw err;
  }
}

// =======================================================
// DESCONTO EM MEDIÇÃO (DIAS PARADOS) - FIRESTORE INTEGRATION
// =======================================================

/**
 * Subscribes to real-time updates for measurement deductions collection.
 */
export function subscribeMeasurementDeductions(
  callback: (deductions: MeasurementDeduction[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (isSupabaseConfigured()) {
    return subscribeSupabaseCollection<MeasurementDeduction>(
      MEASUREMENT_DEDUCTIONS_COLLECTION,
      (remoteItems) => {
        const deductionMap = new Map<string, MeasurementDeduction>();
        loadMeasurementDeductions().forEach((d) => deductionMap.set(d.id, d));
        remoteItems.forEach((d) => {
          if (d.prefix !== 'MC005' && d.prefix !== 'CAF51' && d.prefix !== 'CBA73' && d.prefix !== 'ESC02') {
            deductionMap.set(d.id, d);
          }
        });
        const deductions = Array.from(deductionMap.values());
        deductions.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        saveMeasurementDeductions(deductions);
        callback(deductions);
      },
      OFFICIAL_MEASUREMENT_DEDUCTIONS,
      onError
    );
  }

  const q = query(collection(db, MEASUREMENT_DEDUCTIONS_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        // Fallback to local storage if Firestore collection has no items yet
        const localData = loadMeasurementDeductions();
        callback(localData);
        return;
      }
      const deductionMap = new Map<string, MeasurementDeduction>();
      // Load official deductions as base
      loadMeasurementDeductions().forEach((d) => deductionMap.set(d.id, d));
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as MeasurementDeduction;
        // Ignore old mock items
        if (data.prefix !== 'MC005' && data.prefix !== 'CAF51' && data.prefix !== 'CBA73' && data.prefix !== 'ESC02') {
          deductionMap.set(docSnap.id, {
            ...data,
            id: docSnap.id,
          });
        }
      });
      const deductions = Array.from(deductionMap.values());
      // Sort newest start date first
      deductions.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      saveMeasurementDeductions(deductions);
      callback(deductions);
    },
    (error) => {
      console.warn('Measurement Deductions Firestore subscription error, using localStorage:', error);
      const localData = loadMeasurementDeductions();
      callback(localData);
      if (onError) onError(error);
    }
  );
}

/**
 * Saves or updates a measurement deduction record in Firestore or Supabase.
 */
export async function saveMeasurementDeductionToFirestore(deduction: MeasurementDeduction): Promise<void> {
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(MEASUREMENT_DEDUCTIONS_COLLECTION, deduction.id, deduction);
    return;
  }

  try {
    const docRef = doc(db, MEASUREMENT_DEDUCTIONS_COLLECTION, deduction.id);
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(deduction)) {
      if (v !== undefined) {
        sanitized[k] = v;
      }
    }
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Failed to save measurement deduction to Firestore:', err);
    throw err;
  }
}

/**
 * Deletes a measurement deduction record from Firestore or Supabase.
 */
export async function deleteMeasurementDeductionFromFirestore(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await deleteRecordFromSupabase(MEASUREMENT_DEDUCTIONS_COLLECTION, id);
    return;
  }

  try {
    const docRef = doc(db, MEASUREMENT_DEDUCTIONS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete measurement deduction from Firestore:', err);
    throw err;
  }
}

// =======================================================
// CORRETIVAS REALIZADAS - FIRESTORE INTEGRATION
// =======================================================

/**
 * Subscribes to real-time updates for corrective maintenances collection.
 */
export function subscribeCorrectiveMaintenances(
  callback: (records: CorrectiveMaintenance[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (isSupabaseConfigured()) {
    return subscribeSupabaseCollection<CorrectiveMaintenance>(
      CORRECTIVE_MAINTENANCES_COLLECTION,
      async (remoteItems) => {
        const recordsMap = new Map<string, CorrectiveMaintenance>();
        INITIAL_CORRECTIVE_MAINTENANCES.forEach((r) => recordsMap.set(r.id, r));
        loadCorrectiveMaintenances().forEach((r) => recordsMap.set(r.id, r));

        let cachedPhotosMap = new Map<string, string>();
        try {
          const idbPhotos = await loadAllCorrectivePhotosFromIndexedDB();
          idbPhotos.forEach((cp) => {
            if (cp.id && cp.dataUrl) {
              cachedPhotosMap.set(cp.id, cp.dataUrl);
            }
          });
        } catch {}

        remoteItems.forEach((remote) => {
          const local = recordsMap.get(remote.id);
          let photos = Array.isArray(remote.photos) ? [...remote.photos] : (local?.photos || []);
          photos = photos.map((p) => {
            if (!p.dataUrl) {
              const fromIdb = cachedPhotosMap.get(p.id);
              if (fromIdb) return { ...p, dataUrl: fromIdb };
              const fromLocal = local?.photos?.find((lp) => lp.id === p.id || lp.name === p.name);
              if (fromLocal?.dataUrl) return { ...p, dataUrl: fromLocal.dataUrl };
            }
            return p;
          });

          photos.forEach((p) => {
            if (p && p.id && p.dataUrl) {
              cachedPhotosMap.set(p.id, p.dataUrl);
              saveCorrectivePhotoToIndexedDB(p).catch(() => {});
            }
          });

          recordsMap.set(remote.id, {
            ...(local || {}),
            ...remote,
            photos,
            id: remote.id,
          });
        });

        const records = Array.from(recordsMap.values()).sort(
          (a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime()
        );
        saveCorrectiveMaintenances(records);
        callback(records);
      },
      INITIAL_CORRECTIVE_MAINTENANCES,
      onError
    );
  }

  const q = query(collection(db, CORRECTIVE_MAINTENANCES_COLLECTION));
  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty) {
        // Fallback to local storage if Firestore collection has no items yet
        const localData = loadCorrectiveMaintenances();
        callback(localData.length > 0 ? localData : INITIAL_CORRECTIVE_MAINTENANCES);
        return;
      }
      const recordsMap = new Map<string, CorrectiveMaintenance>();
      INITIAL_CORRECTIVE_MAINTENANCES.forEach((r) => recordsMap.set(r.id, r));
      loadCorrectiveMaintenances().forEach((r) => recordsMap.set(r.id, r));

      // Load cached photos from IndexedDB for robust rehydration
      let cachedPhotosMap = new Map<string, string>();
      try {
        const idbPhotos = await loadAllCorrectivePhotosFromIndexedDB();
        idbPhotos.forEach((cp) => {
          if (cp.id && cp.dataUrl) {
            cachedPhotosMap.set(cp.id, cp.dataUrl);
          }
        });
      } catch {
        // ignore IDB read error
      }

      snapshot.forEach((docSnap) => {
        const remote = docSnap.data() as CorrectiveMaintenance;
        const local = recordsMap.get(docSnap.id);

        // Merge and rehydrate photos so photos are never lost or blanked
        let photos = Array.isArray(remote.photos) ? [...remote.photos] : (local?.photos || []);
        photos = photos.map((p) => {
          if (!p.dataUrl) {
            const fromIdb = cachedPhotosMap.get(p.id);
            if (fromIdb) return { ...p, dataUrl: fromIdb };
            const fromLocal = local?.photos?.find((lp) => lp.id === p.id || lp.name === p.name);
            if (fromLocal?.dataUrl) return { ...p, dataUrl: fromLocal.dataUrl };
          }
          return p;
        });

        // Ensure photos with dataUrl are persisted in IndexedDB and memory cache
        photos.forEach((p) => {
          if (p && p.id && p.dataUrl) {
            cachedPhotosMap.set(p.id, p.dataUrl);
            saveCorrectivePhotoToIndexedDB(p).catch(() => {});
          }
        });

        recordsMap.set(docSnap.id, {
          ...(local || {}),
          ...remote,
          photos,
          id: docSnap.id,
        });
      });

      // Sort newest open date first
      const records = Array.from(recordsMap.values()).sort(
        (a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime()
      );
      saveCorrectiveMaintenances(records);
      callback(records);
    },
    (error) => {
      console.warn('Corrective Maintenances Firestore subscription error, using localStorage:', error);
      const localData = loadCorrectiveMaintenances();
      callback(localData);
      if (onError) onError(error);
    }
  );
}

/**
 * Saves or updates a corrective maintenance record in Firestore or Supabase.
 */
export async function saveCorrectiveMaintenanceToFirestore(record: CorrectiveMaintenance): Promise<void> {
  // 1. Always persist photos into local IndexedDB
  if (record.photos && record.photos.length > 0) {
    await saveMultipleCorrectivePhotosToIndexedDB(record.photos).catch((err) => {
      console.warn('IndexedDB photo cache warning:', err);
    });
  }

  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(CORRECTIVE_MAINTENANCES_COLLECTION, record.id, record);
    return;
  }

  try {
    const docRef = doc(db, CORRECTIVE_MAINTENANCES_COLLECTION, record.id);
    const sanitized: Record<string, any> = {};

    for (const [k, v] of Object.entries(record)) {
      if (v !== undefined && v !== null) {
        if (k === 'photos' && Array.isArray(v)) {
          // Clean every photo object so that no undefined fields exist (preventing Firestore setDoc crash)
          let accumulatedSize = 0;
          sanitized.photos = v.map((p: any, idx: number) => {
            const cleanPhoto: Record<string, any> = {
              id: String(p.id || `photo-${Date.now()}-${idx}`),
              name: String(p.name || `evidencia_${idx + 1}.jpg`),
              dataUrl: String(p.dataUrl || ''),
              size: typeof p.size === 'number' && !isNaN(p.size) ? p.size : 0,
              uploadedAt: p.uploadedAt ? String(p.uploadedAt) : new Date().toISOString(),
            };
            const photoLen = cleanPhoto.dataUrl.length;
            // Guard against document limit >750KB cumulative for Firestore
            if (photoLen > 800000 || accumulatedSize + photoLen > 750000) {
              cleanPhoto.dataUrl = '';
              cleanPhoto.isHeavyAttachment = true;
            } else {
              accumulatedSize += photoLen;
            }
            return cleanPhoto;
          });
        } else {
          sanitized[k] = v;
        }
      }
    }
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Failed to save corrective maintenance to Firestore:', err);
    throw err;
  }
}

/**
 * Deletes a corrective maintenance record from Firestore or Supabase.
 */
export async function deleteCorrectiveMaintenanceFromFirestore(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await deleteRecordFromSupabase(CORRECTIVE_MAINTENANCES_COLLECTION, id);
    return;
  }

  try {
    const docRef = doc(db, CORRECTIVE_MAINTENANCES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete corrective maintenance from Firestore:', err);
    throw err;
  }
}

/**
 * Subscribes to real-time updates for app users in Supabase or Firestore.
 */
export function subscribeAppUsers(
  callback: (users: AppUser[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (isSupabaseConfigured()) {
    return subscribeSupabaseCollection<AppUser>(
      APP_USERS_COLLECTION,
      (remoteUsers) => {
        const userMap = new Map<string, AppUser>();
        userMap.set(INITIAL_USERS[0].id, INITIAL_USERS[0]);
        loadAppUsers().forEach((u) => userMap.set(u.id, u));
        remoteUsers.forEach((u) => userMap.set(u.id, u));

        const finalUsers = Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        saveAppUsers(finalUsers);
        callback(finalUsers);
      },
      INITIAL_USERS,
      onError
    );
  }

  const q = query(collection(db, APP_USERS_COLLECTION), orderBy('name', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        const localData = loadAppUsers();
        callback(localData.length > 0 ? localData : INITIAL_USERS);
        return;
      }

      const users: AppUser[] = [];
      snapshot.forEach((docSnap) => {
        users.push(docSnap.data() as AppUser);
      });

      const userMap = new Map<string, AppUser>();
      // Guarantee canonical admin exists
      userMap.set(INITIAL_USERS[0].id, INITIAL_USERS[0]);
      // Local fallback
      loadAppUsers().forEach((u) => userMap.set(u.id, u));
      // Cloud Firestore truth takes precedence
      users.forEach((u) => userMap.set(u.id, u));

      const finalUsers = Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      saveAppUsers(finalUsers);
      callback(finalUsers);
    },
    (error) => {
      console.warn('App users Firestore subscription error, using localStorage:', error);
      const localData = loadAppUsers();
      callback(localData);
      if (onError) onError(error);
    }
  );
}

/**
 * Saves or updates an app user in Firestore or Supabase.
 */
export async function saveUserToFirestore(user: AppUser): Promise<void> {
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(APP_USERS_COLLECTION, user.id, user);
    return;
  }

  try {
    const docRef = doc(db, APP_USERS_COLLECTION, user.id);
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(user)) {
      if (v !== undefined) sanitized[k] = v;
    }
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Failed to save user to Firestore:', err);
    throw err;
  }
}

/**
 * Deletes an app user from Firestore or Supabase.
 */
export async function deleteUserFromFirestore(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await deleteRecordFromSupabase(APP_USERS_COLLECTION, id);
    return;
  }

  try {
    const docRef = doc(db, APP_USERS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete user from Firestore:', err);
    throw err;
  }
}

/**
 * Subscribes to real-time updates for app projects (obras) in Supabase or Firestore.
 */
export function subscribeAppProjects(
  callback: (projects: AppProject[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (isSupabaseConfigured()) {
    return subscribeSupabaseCollection<AppProject>(
      APP_PROJECTS_COLLECTION,
      (remoteProjects) => {
        const projMap = new Map<string, AppProject>();
        projMap.set(UNIFIED_WORK_CODE, OFFICIAL_UNIFIED_PROJECT);
        projMap.set(CLEAN_WORK_062_PA, OFFICIAL_062_PA_PROJECT);

        loadAppProjects().forEach((p) => {
          const norm = normalizeProjectCode(p.code);
          if (norm && norm !== UNIFIED_WORK_CODE && norm !== CLEAN_WORK_062_PA) {
            projMap.set(norm, { ...p, code: norm });
          }
        });

        remoteProjects.forEach((p) => {
          const norm = normalizeProjectCode(p.code);
          if (norm && norm !== UNIFIED_WORK_CODE && norm !== CLEAN_WORK_062_PA) {
            projMap.set(norm, { ...p, code: norm });
          }
        });

        const finalProjects = Array.from(projMap.values()).sort((a, b) => a.code.localeCompare(b.code));
        saveAppProjects(finalProjects);
        callback(finalProjects);
      },
      INITIAL_PROJECTS,
      onError
    );
  }

  const q = query(collection(db, APP_PROJECTS_COLLECTION), orderBy('code', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        const localData = loadAppProjects();
        callback(localData.length > 0 ? localData : INITIAL_PROJECTS);
        return;
      }

      const projects: AppProject[] = [];
      snapshot.forEach((docSnap) => {
        projects.push(docSnap.data() as AppProject);
      });

      const projMap = new Map<string, AppProject>();
      projMap.set(UNIFIED_WORK_CODE, OFFICIAL_UNIFIED_PROJECT);
      projMap.set(CLEAN_WORK_062_PA, OFFICIAL_062_PA_PROJECT);

      // Local fallback for offline/cached projects
      loadAppProjects().forEach((p) => {
        const norm = normalizeProjectCode(p.code);
        if (norm && norm !== UNIFIED_WORK_CODE && norm !== CLEAN_WORK_062_PA) {
          projMap.set(norm, { ...p, code: norm });
        }
      });

      // Firestore cloud source of truth takes priority
      projects.forEach((p) => {
        const norm = normalizeProjectCode(p.code);
        if (norm && norm !== UNIFIED_WORK_CODE && norm !== CLEAN_WORK_062_PA) {
          projMap.set(norm, { ...p, code: norm });
        }
      });

      const finalProjects = Array.from(projMap.values()).sort((a, b) => a.code.localeCompare(b.code));
      saveAppProjects(finalProjects);
      callback(finalProjects);
    },
    (error) => {
      console.warn('App projects Firestore subscription error, using localStorage:', error);
      const localData = loadAppProjects();
      callback(localData);
      if (onError) onError(error);
    }
  );
}

/**
 * Saves or updates an app project (obra) in Firestore or Supabase.
 */
export async function saveProjectToFirestore(project: AppProject): Promise<void> {
  if (isSupabaseConfigured()) {
    await upsertRecordToSupabase(APP_PROJECTS_COLLECTION, project.id, project);
    return;
  }

  try {
    const docRef = doc(db, APP_PROJECTS_COLLECTION, project.id);
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(project)) {
      if (v !== undefined) sanitized[k] = v;
    }
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Failed to save project to Firestore:', err);
    throw err;
  }
}

/**
 * Deletes an app project (obra) from Firestore or Supabase.
 */
export async function deleteProjectFromFirestore(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await deleteRecordFromSupabase(APP_PROJECTS_COLLECTION, id);
    return;
  }

  try {
    const docRef = doc(db, APP_PROJECTS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete project from Firestore:', err);
    throw err;
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const res = await testSupabaseConnectionReal();
    return res.success;
  }
  return rawTestFirestore();
}
