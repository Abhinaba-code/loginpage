
"use client";

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { firebaseConfig } from '@/lib/firebaseConfig';

interface FirebaseContextType {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  const firebaseApp = useMemo(() => {
    return !getApps().length ? initializeApp(firebaseConfig) : getApp();
  }, []);

  const auth = useMemo(() => getAuth(firebaseApp), [firebaseApp]);
  const db = useMemo(() => getFirestore(firebaseApp), [firebaseApp]);

  useMemo(() => {
    if (typeof window !== 'undefined') {
      isSupported().then(supported => {
        if (supported) {
          getAnalytics(firebaseApp);
        }
      });
    }
  }, [firebaseApp]);

  const value = { app: firebaseApp, auth, db };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
