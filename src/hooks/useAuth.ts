'use client';

import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

export interface YKBUser {
  uid:      string;
  email:    string | null;
  handle:   string;
  photoURL: string | null;
}

export function useAuth() {
  const [user,    setUser]    = useState<YKBUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const ref  = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(ref);
        const handle = snap.exists()
          ? snap.data().handle
          : (localStorage.getItem('ykb_username') || firebaseUser.displayName?.split(' ')[0] || 'Hooper');
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email, handle, photoURL: firebaseUser.photoURL });
        // persist handle locally so offline still works
        localStorage.setItem('ykb_username', handle);
        if (firebaseUser.email) localStorage.setItem('ykb_email', firebaseUser.email);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    const fu     = result.user;
    const ref    = doc(db, 'users', fu.uid);
    const snap   = await getDoc(ref);
    if (!snap.exists()) {
      const handle = localStorage.getItem('ykb_username') || fu.displayName?.split(' ')[0] || 'Hooper';
      await setDoc(ref, {
        handle,
        email:     fu.email,
        photoURL:  fu.photoURL,
        createdAt: serverTimestamp(),
      }, { merge: true });
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setUser(null);
  }

  async function updateHandle(handle: string) {
    if (!auth.currentUser) return;
    const ref = doc(db, 'users', auth.currentUser.uid);
    await setDoc(ref, { handle }, { merge: true });
    localStorage.setItem('ykb_username', handle);
    setUser(prev => prev ? { ...prev, handle } : null);
  }

  return { user, loading, signInWithGoogle, signOut, updateHandle };
}
