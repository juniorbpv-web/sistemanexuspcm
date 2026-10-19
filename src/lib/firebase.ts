import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

// Support VITE_ environment variables for production deployments (e.g. Hostinger),
// while maintaining full fallback compatibility with firebase-applet-config.json.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || defaultFirebaseConfig.measurementId,
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_DATABASE_ID ||
    (defaultFirebaseConfig as Record<string, any>).firestoreDatabaseId,
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth: Auth = getAuth(app);

// Initialize Firestore with custom databaseId if configured
const customDatabaseId = firebaseConfig.firestoreDatabaseId;
export const db: Firestore = customDatabaseId
  ? getFirestore(app, customDatabaseId)
  : getFirestore(app);

// Connection state tracker
let isConnected = false;

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    // Validate connection by reading a test doc directly from server
    await getDocFromServer(doc(db, 'test', 'connection'));
    isConnected = true;
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is currently offline. Offline persistence is active.');
      isConnected = false;
      return false;
    }
    // If permission or not found, it still reached the server
    isConnected = true;
    return true;
  }
}

export function getIsConnected(): boolean {
  return isConnected;
}

export default db;
