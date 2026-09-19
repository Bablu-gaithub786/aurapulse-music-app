import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  collection, 
  serverTimestamp 
} from 'firebase/firestore';
// Import firebase applet config from workspace root
// @ts-ignore
import firebaseConfigFile from '../../firebase-applet-config.json';

const firebaseConfig = firebaseConfigFile || {
  projectId: "gleaming-bot-69v0l",
  appId: "1:945557247028:web:94da1ca671058640cee661",
  apiKey: "AIzaSyBbltJDkGzwEFMVRPm8lcxRsUmwD1myhlQ",
  authDomain: "gleaming-bot-69v0l.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-premiummusicvisu-72f5441e-aa88-4829-9d4e-3fd86269d9d2",
  storageBucket: "gleaming-bot-69v0l.firebasestorage.app",
  messagingSenderId: "945557247028"
};

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
export const googleProvider = new GoogleAuthProvider();

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  isVIP: boolean;
  planType?: string;
  vipPurchasedAt?: string;
  createdAt: string;
  lastLoginAt: string;
  lastLoginCountry?: string;
  lastLoginCity?: string;
  lastLoginIP?: string;
  deviceInfo?: string;
}

// Fetch Geo & IP Info safely
export async function getClientGeoInfo() {
  try {
    const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return {
        ip: data.ip || 'Unknown',
        city: data.city || 'Unknown City',
        region: data.region || '',
        country: data.country_name || 'India',
        countryCode: data.country_code || 'IN'
      };
    }
  } catch (e) {
    console.warn('IP Geo fetch fallback', e);
  }
  return {
    ip: '127.0.0.1',
    city: 'Local',
    region: '',
    country: 'India',
    countryCode: 'IN'
  };
}

// Record login details in Firestore
export async function recordUserLogin(user: FirebaseUser, existingProfile?: Partial<UserProfile>) {
  if (!user || !user.uid) return;

  const geo = await getClientGeoInfo();
  const userAgent = navigator.userAgent;
  const nowISO = new Date().toISOString();

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  const isAlreadyVIP = userSnap.exists() ? userSnap.data()?.isVIP || false : false;

  const profileData: Record<string, any> = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'Music Creator',
    photoURL: user.photoURL || '',
    lastLoginAt: nowISO,
    lastLoginCity: geo.city,
    lastLoginCountry: geo.country,
    lastLoginIP: geo.ip,
    deviceInfo: userAgent.slice(0, 100),
    isVIP: isAlreadyVIP || existingProfile?.isVIP || false
  };

  if (!userSnap.exists()) {
    profileData.createdAt = nowISO;
    profileData.totalExports = 0;
  }

  await setDoc(userRef, profileData, { merge: true });

  // Add an entry in login_logs
  try {
    const logsRef = collection(db, 'login_logs');
    await addDoc(logsRef, {
      uid: user.uid,
      email: user.email || '',
      timestamp: nowISO,
      city: geo.city,
      country: geo.country,
      ip: geo.ip,
      device: userAgent.slice(0, 100),
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Could not write login_log', err);
  }

  return profileData as UserProfile;
}

// Update VIP Status in Firestore
export async function updateUserVIPStatus(uid: string, isVIP: boolean, planType = 'pro_99') {
  if (!uid) return;
  const userRef = doc(db, 'users', uid);
  const nowISO = new Date().toISOString();
  await updateDoc(userRef, {
    isVIP: isVIP,
    planType: planType,
    vipPurchasedAt: nowISO
  });
}
