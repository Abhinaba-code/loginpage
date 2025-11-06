
"use client";

import {
  createContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  Auth,
  signInWithCustomToken,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, Firestore } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { sendOtpFlow, verifyOtpFlow } from "@/ai/flows/send-otp-flow";

// This is now the single source of truth for Firebase configuration.
const firebaseConfig = {
  apiKey: "AIzaSyCp7-xal4Uc77Men4tKoNLYeHUDL-Z1dKc",
  authDomain: "authflow-6006b.firebaseapp.com",
  projectId: "authflow-6006b",
  storageBucket: "authflow-6006b.appspot.com",
  messagingSenderId: "444782156299",
  appId: "1:444782156299:web:b8b2900f39da8199ce450e",
  measurementId: "G-QDB7F6YXJ2"
};

// This function ensures Firebase is initialized only once.
function getFirebaseServices() {
  const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth: Auth = getAuth(app);
  const db: Firestore = getFirestore(app);

  if (typeof window !== 'undefined') {
    isSupported().then(supported => {
      if (supported) {
        getAnalytics(app);
      }
    });
  }
  return { app, auth, db };
}

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  googleSignIn: () => Promise<void>;
  sendOtp: (email: string) => Promise<boolean>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  
  useEffect(() => {
    const { auth } = getFirebaseServices();
    setLoading(true);
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    const handleRedirectResult = async () => {
      try {
        const { auth, db } = getFirebaseServices();
        const result = await getRedirectResult(auth);
        if (result) {
          const googleUser = result.user;
          const userDocRef = doc(db, "users", googleUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              uid: googleUser.uid,
              email: googleUser.email,
              displayName: googleUser.displayName,
              photoURL: googleUser.photoURL,
              createdAt: serverTimestamp(),
            });
          }
          await logAuthEvent('login', 'google', googleUser, db);
          handleAuthSuccess("/dashboard");
        }
      } catch (error: any) {
        // Known issue with some browsers, can be ignored.
        if (error.code === 'auth/unauthorized-domain') {
            handleAuthError({ message: 'This domain is not authorized for authentication. Please contact support.'})
        } else if(error.code !== 'auth/web-storage-unsupported' && error.code !== 'auth/operation-not-supported-in-this-environment' && error.code !== 'auth/cancelled-popup-request') {
            handleAuthError(error);
        }
      } finally {
        if (user === null) {
            setLoading(false);
        }
      }
    };

    handleRedirectResult();

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logAuthEvent = async (action: 'login' | 'logout', method: 'email' | 'google' | 'otp' | 'unknown', loggedInUser: FirebaseUser, db: Firestore) => {
    try {
      await addDoc(collection(db, "auth_logs"), {
        userId: loggedInUser.uid,
        email: loggedInUser.email,
        action,
        method,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error logging auth event:", error);
    }
  };

  const handleAuthSuccess = (path: string) => {
    router.push(path);
  };

  const handleAuthError = (error: any) => {
    console.error("Firebase Auth Error:", error);
    toast({
      variant: "destructive",
      title: "Authentication Error",
      description: error.message || "An unexpected error occurred.",
    });
  };

  const login = async (email: string, pass: string) => {
    const { auth, db } = getFirebaseServices();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      await logAuthEvent('login', 'email', userCredential.user, db);
      handleAuthSuccess("/dashboard");
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, pass: string) => {
    const { auth, db } = getFirebaseServices();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newUser = userCredential.user;
      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        email: newUser.email,
        displayName: newUser.email?.split('@')[0],
        photoURL: null,
        createdAt: serverTimestamp(),
      });
      await logAuthEvent('login', 'email', newUser, db);
      handleAuthSuccess("/dashboard");
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    const { auth } = getFirebaseServices();
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      // Adding a small delay to ensure config is loaded, as a safeguard.
      await new Promise(resolve => setTimeout(resolve, 100));
      await signInWithRedirect(auth, provider);
    } catch (error) {
      handleAuthError(error);
      setLoading(false);
    }
  };

  const sendOtp = async (email: string) => {
    setLoading(true);
    try {
        const result = await sendOtpFlow({ email });
        if (result.success) {
          toast({
            title: "OTP Sent (Dev Mode)",
            description: `Your one-time password is: ${result.otp}`,
            duration: 10000,
          });
        }
        return result.success;
    } catch (error) {
        handleAuthError(error);
        return false;
    } finally {
        setLoading(false);
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    setLoading(true);
    const { auth, db } = getFirebaseServices();
    try {
        const { token, error } = await verifyOtpFlow({ email, otp });
        if (token) {
            const userCredential = await signInWithCustomToken(auth, token);
            const otpUser = userCredential.user;
            const userDocRef = doc(db, "users", otpUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                // If user doesn't exist, create a new profile.
                await setDoc(userDocRef, {
                    uid: otpUser.uid,
                    email: otpUser.email,
                    displayName: otpUser.email?.split('@')[0],
                    photoURL: null,
                    createdAt: serverTimestamp(),
                });
            }
            await logAuthEvent('login', 'otp', otpUser, db);
            handleAuthSuccess('/dashboard');
        } else {
            throw new Error(error || "Invalid OTP or expired token.");
        }
    } catch (error: any) {
        handleAuthError(error);
    } finally {
        setLoading(false);
    }
  };


  const logout = async () => {
    const { auth, db } = getFirebaseServices();
    try {
      if (auth.currentUser) {
        await logAuthEvent('logout', 'unknown', auth.currentUser, db);
      }
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      handleAuthError(error);
    }
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    googleSignIn,
    sendOtp,
    verifyOtp,
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
