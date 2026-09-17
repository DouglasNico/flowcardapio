import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBn1tl0IBQoWZBmunYtRSb-i74Yhe5OAFg",
  authDomain: "aplicativo-pdv.firebaseapp.com",
  projectId: "aplicativo-pdv",
  storageBucket: "aplicativo-pdv.firebasestorage.app",
  messagingSenderId: "892832112899",
  appId: "1:892832112899:web:ee49b0ea26a76211680936",
  measurementId: "G-9RSWDKL8WP"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const CLOUDINARY_CLOUD = "dycwp4ds9";
export const CLOUDINARY_PRESET = "cardapioflowpdv";
