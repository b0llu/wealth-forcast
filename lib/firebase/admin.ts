import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getServerEnv } from "../env";

function ensureAdminApp() {
  if (!getApps().length) {
    const env = getServerEnv();
    initializeApp({
      credential: cert({
        projectId:   env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey:  env.FIREBASE_PRIVATE_KEY,
      }),
    });
  }
}

export function getFirebaseAdminDb() {
  ensureAdminApp();
  return getFirestore();
}

export function getFirebaseAdminAuth() {
  ensureAdminApp();
  return getAuth();
}

/** Extracts + verifies a Firebase ID token from an Authorization header.
 *  Returns the uid of the authenticated user, or throws on failure. */
export async function verifyIdToken(authHeader: string | null | undefined): Promise<string> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: missing token");
  }
  const token   = authHeader.slice(7).trim();
  const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
  return decoded.uid;
}
