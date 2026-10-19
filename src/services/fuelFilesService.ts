import { FuelInvoiceFile } from '../types';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const DB_NAME = 'MakmoFleet_FilesDB';
const DB_VERSION = 1;
const STORE_NAME = 'invoice_files';
const FIRESTORE_COLLECTION = 'fuel_invoice_files';

/**
 * Initializes and opens the IndexedDB database.
 */
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não é suportado neste navegador.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Falha ao abrir IndexedDB.'));
    };
  });
}

/**
 * Loads all invoice files stored in IndexedDB.
 */
export async function loadInvoiceFilesFromIndexedDB(): Promise<FuelInvoiceFile[]> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result as FuelInvoiceFile[]) || [];
        // Sort descending by uploadedAt (most recent first)
        results.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        resolve(results);
      };

      request.onerror = () => {
        reject(request.error || new Error('Erro ao ler arquivos do IndexedDB'));
      };
    });
  } catch (err) {
    console.warn('Erro ao carregar arquivos do IndexedDB:', err);
    return [];
  }
}

/**
 * Saves or updates a fuel invoice file in IndexedDB.
 */
export async function saveInvoiceFileToIndexedDB(file: FuelInvoiceFile): Promise<void> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(file);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Erro ao salvar arquivo no IndexedDB'));
    });
  } catch (err) {
    console.error('Falha ao salvar no IndexedDB:', err);
    throw err;
  }
}

/**
 * Deletes a fuel invoice file from IndexedDB.
 */
export async function deleteInvoiceFileFromIndexedDB(id: string): Promise<void> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Erro ao remover arquivo do IndexedDB'));
    });
  } catch (err) {
    console.error('Falha ao remover do IndexedDB:', err);
    throw err;
  }
}

/**
 * Retrieves a single fuel invoice file from IndexedDB by its id.
 */
export async function getInvoiceFileFromIndexedDB(id: string): Promise<FuelInvoiceFile | null> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve((request.result as FuelInvoiceFile) || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Saves a fuel invoice file to Firestore.
 * If dataUrl is small (< 850KB), stores full file; otherwise stores metadata.
 */
export async function saveInvoiceFileToFirestore(file: FuelInvoiceFile): Promise<void> {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, file.id);
    const dataSize = file.dataUrl ? file.dataUrl.length : 0;
    
    // Remove undefined properties so Firestore never throws unsupported field value
    const cleanObject = (obj: any): any => {
      const res: any = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) res[k] = v;
      }
      return res;
    };

    // Firestore has 1MB document limit.
    // Base64 text up to ~850KB fits securely with metadata.
    if (dataSize <= 850000) {
      await setDoc(docRef, cleanObject(file));
    } else {
      // Store metadata with local-only marker for the heavy payload
      const metaOnly = cleanObject({
        ...file,
        dataUrl: '', // Will be loaded from local IndexedDB
        isHeavyFileStoredLocally: true,
      });
      await setDoc(docRef, metaOnly);
    }
  } catch (err) {
    console.warn('Erro ao sincronizar arquivo com Firestore:', err);
  }
}

/**
 * Deletes a fuel invoice file from Firestore.
 */
export async function deleteInvoiceFileFromFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Erro ao remover arquivo do Firestore:', err);
  }
}

/**
 * Subscribes to real-time updates of files in Firestore.
 */
export function subscribeInvoiceFiles(
  onUpdate: (files: FuelInvoiceFile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const q = query(collection(db, FIRESTORE_COLLECTION), orderBy('uploadedAt', 'desc'));
    return onSnapshot(
      q,
      async (snapshot) => {
        const firestoreFiles: FuelInvoiceFile[] = [];
        snapshot.forEach((d) => {
          firestoreFiles.push(d.data() as FuelInvoiceFile);
        });

        // Merge with local IndexedDB (which contains the full dataUrl for large files)
        const localFiles = await loadInvoiceFilesFromIndexedDB();
        const localMap = new Map(localFiles.map((f) => [f.id, f]));

        const mergedFiles: FuelInvoiceFile[] = firestoreFiles.map((remote) => {
          const local = localMap.get(remote.id);
          if (local && local.dataUrl && (!remote.dataUrl || remote.dataUrl.length === 0)) {
            return { ...remote, dataUrl: local.dataUrl };
          }
          // If remote has dataUrl and local doesn't, also cache in IndexedDB
          if (remote.dataUrl && (!local || !local.dataUrl)) {
            saveInvoiceFileToIndexedDB(remote).catch(() => {});
          }
          return remote;
        });

        // Also add any local-only files not yet in firestore
        const remoteIds = new Set(firestoreFiles.map((f) => f.id));
        for (const local of localFiles) {
          if (!remoteIds.has(local.id)) {
            mergedFiles.push(local);
          }
        }

        mergedFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        onUpdate(mergedFiles);
      },
      (err) => {
        console.warn('Erro ao escutar Firestore fuel_invoice_files:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('Não foi possível registrar subscription de fuel_invoice_files:', err);
    return () => {};
  }
}

/**
 * Validates whether a file has an accepted extension and MIME type.
 * Accepted: PDF, JPG, JPEG.
 */
export function validateInvoiceFile(file: File): { valid: boolean; error?: string; fileType?: 'PDF' | 'JPEG' | 'JPG' } {
  const fileName = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  const isPdf = fileName.endsWith('.pdf') || mime === 'application/pdf';
  const isJpg = fileName.endsWith('.jpg') || mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/pjpeg';
  const isJpeg = fileName.endsWith('.jpeg');

  if (!isPdf && !isJpg && !isJpeg) {
    return {
      valid: false,
      error: 'Formato de arquivo não suportado. Aceito exclusivamente arquivos PDF, JPG ou JPEG.',
    };
  }

  let fileType: 'PDF' | 'JPEG' | 'JPG' = 'PDF';
  if (isPdf) fileType = 'PDF';
  else if (isJpeg) fileType = 'JPEG';
  else fileType = 'JPG';

  return { valid: true, fileType };
}

/**
 * Converts a browser File into a base64 Data URL.
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao converter arquivo em Data URL.'));
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error('Erro ao ler arquivo.'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Formats bytes into human readable format (KB, MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Formats an ISO date or Date into Brazilian formatted date/time (DD/MM/YYYY HH:mm).
 */
export function formatDateTimeBR(dateInput: string | Date): string {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Triggers a browser download for a FuelInvoiceFile.
 */
export function triggerFileDownload(file: FuelInvoiceFile): void {
  if (!file.dataUrl) {
    alert('Não foi possível obter o conteúdo do arquivo para download.');
    return;
  }
  const link = document.createElement('a');
  link.href = file.dataUrl;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
