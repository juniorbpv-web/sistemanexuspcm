import { CorrectivePhoto } from '../types';

const DB_NAME = 'MakmoFleet_CorrectiveFilesDB';
const DB_VERSION = 1;
const STORE_NAME = 'corrective_photos';

/**
 * Initializes and opens the IndexedDB database for corrective maintenance photos and documents.
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
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Falha ao abrir IndexedDB para fotos de corretivas.'));
    };
  });
}

/**
 * Saves a single corrective photo/document in IndexedDB.
 */
export async function saveCorrectivePhotoToIndexedDB(photo: CorrectivePhoto): Promise<void> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({
        id: photo.id,
        name: photo.name,
        dataUrl: photo.dataUrl,
        size: photo.size || 0,
        uploadedAt: photo.uploadedAt || new Date().toISOString(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Erro ao salvar foto no IndexedDB'));
    });
  } catch (err) {
    console.warn('Falha ao salvar foto de corretiva no IndexedDB:', err);
  }
}

/**
 * Saves multiple corrective photos/documents in IndexedDB.
 */
export async function saveMultipleCorrectivePhotosToIndexedDB(photos: CorrectivePhoto[]): Promise<void> {
  if (!photos || photos.length === 0) return;
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      photos.forEach((photo) => {
        if (photo && photo.id && photo.dataUrl) {
          store.put({
            id: photo.id,
            name: photo.name,
            dataUrl: photo.dataUrl,
            size: photo.size || 0,
            uploadedAt: photo.uploadedAt || new Date().toISOString(),
          });
        }
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Erro ao salvar lote de fotos no IndexedDB'));
    });
  } catch (err) {
    console.warn('Falha ao salvar lote de fotos no IndexedDB:', err);
  }
}

/**
 * Retrieves a single corrective photo from IndexedDB by its id.
 */
export async function getCorrectivePhotoFromIndexedDB(id: string): Promise<CorrectivePhoto | null> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error || new Error('Erro ao buscar foto no IndexedDB'));
    });
  } catch (err) {
    console.warn('Falha ao ler foto de corretiva do IndexedDB:', err);
    return null;
  }
}

/**
 * Loads all corrective photos stored in IndexedDB.
 */
export async function loadAllCorrectivePhotosFromIndexedDB(): Promise<CorrectivePhoto[]> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(request.error || new Error('Erro ao carregar fotos do IndexedDB'));
    });
  } catch (err) {
    console.warn('Falha ao carregar fotos do IndexedDB:', err);
    return [];
  }
}

/**
 * Deletes a corrective photo from IndexedDB.
 */
export async function deleteCorrectivePhotoFromIndexedDB(id: string): Promise<void> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Erro ao remover foto do IndexedDB'));
    });
  } catch (err) {
    console.warn('Falha ao remover foto do IndexedDB:', err);
  }
}

/**
 * Rehydrates missing photo dataUrls across an array of corrective maintenances from IndexedDB.
 */
export async function rehydrateCorrectivePhotosFromIndexedDB(
  records: any[]
): Promise<any[]> {
  if (!records || !Array.isArray(records) || records.length === 0) return records || [];
  try {
    const idbPhotos = await loadAllCorrectivePhotosFromIndexedDB();
    if (!idbPhotos || idbPhotos.length === 0) return records;

    const cacheMap = new Map<string, string>();
    idbPhotos.forEach((p) => {
      if (p.id && p.dataUrl) {
        cacheMap.set(p.id, p.dataUrl);
      }
    });

    let hasChanges = false;
    const rehydrated = records.map((rec) => {
      if (!rec.photos || !Array.isArray(rec.photos) || rec.photos.length === 0) return rec;

      let changedInRec = false;
      const updatedPhotos = rec.photos.map((photo: CorrectivePhoto) => {
        if (!photo.dataUrl && cacheMap.has(photo.id)) {
          changedInRec = true;
          return {
            ...photo,
            dataUrl: cacheMap.get(photo.id)!,
          };
        }
        return photo;
      });

      if (changedInRec) {
        hasChanges = true;
        return {
          ...rec,
          photos: updatedPhotos,
        };
      }
      return rec;
    });

    return hasChanges ? rehydrated : records;
  } catch (err) {
    console.warn('Erro ao reidratar fotos do IndexedDB:', err);
    return records;
  }
}

/**
 * Seeds initial corrective maintenance photos into IndexedDB to ensure demo photos are never lost.
 */
export async function seedInitialCorrectivePhotosToIndexedDB(
  initialRecords: any[]
): Promise<void> {
  if (!initialRecords || !Array.isArray(initialRecords) || initialRecords.length === 0) return;
  try {
    const photosToSeed: CorrectivePhoto[] = [];
    initialRecords.forEach((r) => {
      if (r && Array.isArray(r.photos) && r.photos.length > 0) {
        r.photos.forEach((p: CorrectivePhoto) => {
          if (p && p.id && p.dataUrl) {
            photosToSeed.push(p);
          }
        });
      }
    });
    if (photosToSeed.length > 0) {
      await saveMultipleCorrectivePhotosToIndexedDB(photosToSeed);
    }
  } catch (err) {
    console.warn('Erro ao semear fotos iniciais no IndexedDB:', err);
  }
}

