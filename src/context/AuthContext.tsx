'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import axios from 'axios';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUserProfile = async (firebaseUser: User) => {
    const token = await firebaseUser.getIdToken();
    await axios.post(
      '/api/auth',
      {
        userId: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  };

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      // 服务端渲染或未配置 Firebase（例如 Preview 环境缺少 NEXT_PUBLIC_FIREBASE_*）：视为未登录
      console.warn('Firebase is not configured; login is disabled.');
      void Promise.resolve().then(() => setLoading(false));
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      if (user && user.email) {
        try {
          await syncUserProfile(user);
        } catch (error) {
          console.error('Failed to sync user profile:', error);
        }
      }
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('登录服务未配置（缺少 Firebase 配置）');
    }
    const provider = new GoogleAuthProvider();

    try {
      await signInWithPopup(auth, provider);
      return;
    } catch (error) {
      const authCode =
        typeof error === 'object' && error && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';

      if (
        authCode === 'auth/popup-blocked' ||
        authCode === 'auth/popup-closed-by-user' ||
        authCode === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }

      if (authCode === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        throw new Error(`当前域名未加入 Firebase 授权域名: ${host}`);
      }

      throw error;
    }
  };

  const logout = async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      return;
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
