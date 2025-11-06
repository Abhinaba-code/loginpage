import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAz_1fTqZ2m2dO824t_wn1GUnrA6l9R4A4",
  authDomain: "dev-prototyper-240530.firebaseapp.com",
  projectId: "dev-prototyper-240530",
  storageBucket: "dev-prototyper-240530.appspot.com",
  messagingSenderId: "420339591461",
  appId: "1:420339591461:web:1e3f32454239849206c9a3",
  measurementId: "G-Q81P4B411L"
};

// Initialize Firebase for SSR and client-side
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Firebase Analytics on the client
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  });
}

export { app, auth, db };
