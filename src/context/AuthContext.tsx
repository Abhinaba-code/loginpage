
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
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { useFirebase } from "@/context/FirebaseProvider";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  googleSignIn: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const { auth, db } = useFirebase();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const logAuthEvent = async (action: 'login' | 'logout', method: 'email' | 'google' | 'unknown', user: FirebaseUser) => {
    try {
      await addDoc(collection(db, "auth_logs"), {
        userId: user.uid,
        email: user.email,
        action,
        method,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error logging auth event:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    const handleRedirectResult = async () => {
      try {
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
          await logAuthEvent('login', 'google', googleUser);
          handleAuthSuccess("/");
        }
      } catch (error: any) {
        if(error.code !== 'auth/web-storage-unsupported' && error.code !== 'auth/operation-not-supported-in-this-environment' && error.code !== 'auth/cancelled-popup-request') {
            handleAuthError(error);
        }
      } finally {
        setLoading(false);
      }
    };

    handleRedirectResult();

    return () => unsubscribe();
  }, [auth, db]);

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
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      await logAuthEvent('login', 'email', userCredential.user);
      handleAuthSuccess("/");
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, pass: string) => {
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
      await logAuthEvent('login', 'email', newUser);
      handleAuthSuccess("/");
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      handleAuthError(error);
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await logAuthEvent('logout', 'unknown', auth.currentUser);
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
  };

  if (!isClient || loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
