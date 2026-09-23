import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBn1tl0IBQoWZBmunYtRSb-i74Yhe5OAFg",
  authDomain: "aplicativo-pdv.firebaseapp.com",
  projectId: "aplicativo-pdv",
  storageBucket: "aplicativo-pdv.firebasestorage.app",
  messagingSenderId: "892832112899",
  appId: "1:892832112899:web:ee49b0ea26a76211680936",
  measurementId: "G-9RSWDKL8WP"
};

const testMode = import.meta.env.VITE_AMBIENTE_TESTE === 'true';
if (testMode && (!import.meta.env.DEV || !['localhost', '127.0.0.1'].includes(location.hostname))) throw new Error('Ambiente de teste requer servidor local.');
const app = initializeApp(testMode ? { apiKey: 'demo-flowpdv-key', projectId: 'demo-flowpdv', appId: 'legacy-test' } : firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
if (testMode) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export const CLOUDINARY_CLOUD = "dycwp4ds9";
export const CLOUDINARY_PRESET = "cardapioflowpdv";
