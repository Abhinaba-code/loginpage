import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCp7-xal4Uc77Men4tKoNLYeHUDL-Z1dKc",
  authDomain: "authflow-6006b.firebaseapp.com",
  projectId: "authflow-6006b",
  storageBucket: "authflow-6006b.appspot.com",
  messagingSenderId: "444782156299",
  appId: "1:444782156299:web:b8b2900f39da8199ce450e",
  measurementId: "G-QDB7F6YXJ2"
};

// Initialize Firebase for SSR
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Firebase Analytics
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  });
}

export { app, auth, db };
