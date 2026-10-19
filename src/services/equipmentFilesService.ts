import { EquipmentFile, EquipmentFileCategory } from '../types';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const DB_NAME = 'MakmoFleet_EquipmentFilesDB';
const DB_VERSION = 1;
const STORE_NAME = 'equipment_files';
const FIRESTORE_COLLECTION = 'equipment_files';

/**
 * Initializes and opens the IndexedDB database for equipment files.
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
        store.createIndex('equipmentId', 'equipmentId', { unique: false });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Falha ao abrir IndexedDB para arquivos de equipamentos.'));
    };
  });
}

/**
 * Loads all equipment files stored in IndexedDB, optionally filtered by equipmentId.
 */
export async function loadEquipmentFilesFromIndexedDB(equipmentId?: string): Promise<EquipmentFile[]> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let results = (request.result as EquipmentFile[]) || [];
        if (equipmentId) {
          results = results.filter((f) => f.equipmentId === equipmentId);
        }
        // Sort descending by uploadedAt (most recent first)
        results.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        resolve(results);
      };

      request.onerror = () => {
        reject(request.error || new Error('Erro ao ler arquivos de equipamentos do IndexedDB'));
      };
    });
  } catch (err) {
    console.warn('Erro ao carregar arquivos de equipamentos do IndexedDB:', err);
    return [];
  }
}

/**
 * Saves an equipment file in IndexedDB.
 */
export async function saveEquipmentFileToIndexedDB(file: EquipmentFile): Promise<void> {
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
    console.error('Falha ao salvar arquivo no IndexedDB:', err);
    throw err;
  }
}

/**
 * Deletes an equipment file from IndexedDB.
 */
export async function deleteEquipmentFileFromIndexedDB(id: string): Promise<void> {
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
    console.error('Falha ao remover arquivo do IndexedDB:', err);
    throw err;
  }
}

/**
 * Removes all files belonging to a specific equipment.
 */
export async function deleteFilesByEquipmentId(equipmentId: string): Promise<void> {
  try {
    const files = await loadEquipmentFilesFromIndexedDB(equipmentId);
    for (const f of files) {
      await deleteEquipmentFileFromIndexedDB(f.id).catch(() => {});
      await deleteEquipmentFileFromFirestore(f.id).catch(() => {});
    }
  } catch (err) {
    console.warn('Erro ao remover arquivos do equipamento excluído:', err);
  }
}

/**
 * Saves an equipment file to Firestore.
 * If dataUrl is small (< 850KB), stores full file; otherwise stores file metadata.
 */
export async function saveEquipmentFileToFirestore(file: EquipmentFile): Promise<void> {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, file.id);
    const dataSize = file.dataUrl ? file.dataUrl.length : 0;

    const cleanObject = (obj: any): any => {
      const res: any = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) {
          res[k] = v;
        }
      }
      return res;
    };

    if (dataSize > 850 * 1024) {
      // Too large for Firestore document (limit is 1MB), save metadata only
      console.warn(
        `Arquivo ${file.name} (${(dataSize / 1024).toFixed(0)}KB) excede o limite do Firestore. Armazenado localmente em alta resolução.`
      );
      const metadataOnly = cleanObject({
        ...file,
        dataUrl: '',
        storedLocallyOnly: true,
      });
      await setDoc(docRef, metadataOnly);
    } else {
      await setDoc(docRef, cleanObject(file));
    }
  } catch (err) {
    console.warn('Erro ao salvar arquivo de equipamento no Firestore (armazenado em cache local):', err);
  }
}

/**
 * Deletes an equipment file from Firestore.
 */
export async function deleteEquipmentFileFromFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Erro ao deletar arquivo de equipamento no Firestore:', err);
  }
}

/**
 * Subscribes to real-time updates for equipment files from Firestore.
 */
export function subscribeEquipmentFiles(
  onUpdate: (files: EquipmentFile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const q = query(collection(db, FIRESTORE_COLLECTION), orderBy('uploadedAt', 'desc'));
    return onSnapshot(
      q,
      async (snapshot) => {
        const firestoreFiles: EquipmentFile[] = [];
        snapshot.forEach((d) => {
          firestoreFiles.push(d.data() as EquipmentFile);
        });

        // Merge with local IndexedDB (which contains full dataUrl for large files)
        const localFiles = await loadEquipmentFilesFromIndexedDB();
        const localMap = new Map(localFiles.map((f) => [f.id, f]));

        const mergedFiles: EquipmentFile[] = firestoreFiles.map((remote) => {
          const local = localMap.get(remote.id);
          if (local && local.dataUrl && (!remote.dataUrl || remote.dataUrl.length === 0)) {
            return { ...remote, dataUrl: local.dataUrl };
          }
          if (remote.dataUrl && (!local || !local.dataUrl)) {
            saveEquipmentFileToIndexedDB(remote).catch(() => {});
          }
          return remote;
        });

        // Add any local-only files
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
        console.warn('Erro ao escutar Firestore equipment_files:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('Não foi possível registrar subscription de equipment_files:', err);
    return () => {};
  }
}

/**
 * Validates whether an uploaded file is valid (PDF, Excel .xlsx/.xls/.csv, JPG, JPEG, PNG).
 */
export function validateEquipmentFile(file: File): {
  valid: boolean;
  error?: string;
  fileType?: 'PDF' | 'EXCEL' | 'XLSX' | 'XLS' | 'CSV' | 'JPEG' | 'JPG' | 'PNG';
} {
  const fileName = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  const isPdf = fileName.endsWith('.pdf') || mime === 'application/pdf';
  const isExcel =
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    fileName.endsWith('.csv') ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv') ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel';
  const isJpg = fileName.endsWith('.jpg') || mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/pjpeg';
  const isJpeg = fileName.endsWith('.jpeg');
  const isPng = fileName.endsWith('.png') || mime === 'image/png';

  if (!isPdf && !isExcel && !isJpg && !isJpeg && !isPng) {
    return {
      valid: false,
      error: 'Formato não suportado. Aceito exclusivamente arquivos PDF, Excel (.xlsx, .xls, .csv), JPG, JPEG ou PNG.',
    };
  }

  // Max size: 25MB
  if (file.size > 25 * 1024 * 1024) {
    return {
      valid: false,
      error: 'O arquivo excede o limite máximo permitido de 25 MB.',
    };
  }

  let fileType: 'PDF' | 'EXCEL' | 'XLSX' | 'XLS' | 'CSV' | 'JPEG' | 'JPG' | 'PNG' = 'PDF';
  if (isPdf) fileType = 'PDF';
  else if (isExcel) fileType = 'EXCEL';
  else if (isJpeg) fileType = 'JPEG';
  else if (isPng) fileType = 'PNG';
  else fileType = 'JPG';

  return { valid: true, fileType };
}

/**
 * Reads browser File as Base64 Data URL.
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
 * Formats bytes to readable string (e.g., 2.4 MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Formats date/time into Brazilian standard.
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
 * Triggers a browser download for an EquipmentFile.
 */
export function downloadEquipmentFile(file: EquipmentFile): void {
  try {
    const link = document.createElement('a');
    link.href = file.dataUrl;
    link.download = file.name || `documento_${file.id}.${file.fileType.toLowerCase()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Falha ao iniciar download:', err);
  }
}

export const COMMON_EQUIPMENT_FILE_CATEGORIES: { value: EquipmentFileCategory; label: string }[] = [
  { value: 'Planilha Excel', label: 'Planilha Excel (.xlsx / .csv)' },
  { value: 'Relatório PDF', label: 'Relatório ou Documento PDF' },
  { value: 'CRLV', label: 'CRLV / Documento do Veículo' },
  { value: 'Contrato', label: 'Contrato de Locação / Aquisição' },
  { value: 'Laudo', label: 'Laudo Técnico / ART / Inspeção' },
  { value: 'Manual', label: 'Manual do Proprietário / Ficha Técnica' },
  { value: 'Foto', label: 'Foto do Equipamento / Vistoria' },
  { value: 'Manutenção', label: 'Comprovante de Manutenção / Garantia' },
  { value: 'Nota Fiscal', label: 'Nota Fiscal de Compra / Locação' },
  { value: 'Outro', label: 'Outro Documento' },
];
