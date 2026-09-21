import { initializeApp, getApps, getApp, cert, ServiceAccount, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getDatabase, Database } from 'firebase-admin/database';

let app: App;

function initFirebaseAdmin(): App {
    if (getApps().length > 0) {
        return getApp();
    }

    // 1. Check for full service account JSON string
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountJson) {
        try {
            const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
            return initializeApp({
                credential: cert(serviceAccount),
                databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL
            });
        } catch (e) {
            console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', e);
        }
    }

    // 2. Check for individual environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey) {
        // Handle escaped newlines in Vercel environment variables
        privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (projectId && clientEmail && privateKey) {
        return initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey
            }),
            databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL
        });
    }

    // 3. Fallback for Google Cloud / local default credentials
    return initializeApp({
        projectId: projectId || 'nexplay-e9c60',
        databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL
    });
}

app = initFirebaseAdmin();

export const adminAuth: Auth = getAuth(app);
export const adminDb: Firestore = getFirestore(app);
export const adminRtdb: Database = getDatabase(app);
