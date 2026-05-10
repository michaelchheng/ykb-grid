/**
 * Firestore ↔ localStorage sync for per-tier game state.
 * localStorage is the source of truth for reads (instant, offline-safe).
 * Firestore is written to asynchronously for persistence across devices.
 *
 * Firestore path: users/{uid}/tiers/{tier}
 *   { lockout, todayStreak, bestStreak, totalCorrect, totalAnswered, updatedAt }
 */

import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type Tier4 = 'easy' | 'medium' | 'hard' | 'unhinged';

export interface TierData {
  lockout:       string | null;  // today's date string or null
  todayStreak:   number;
  bestStreak:    number;
  totalCorrect:  number;
  totalAnswered: number;
}

// ── Local helpers ────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function localGet(tier: Tier4): TierData {
  if (typeof window === 'undefined') return { lockout: null, todayStreak: 0, bestStreak: 0, totalCorrect: 0, totalAnswered: 0 };
  // Handle old format 'YYYY-MM-DD:streak' and new plain number format
  const rawToday = localStorage.getItem(`ykb_today_${tier}`) || '0';
  let todayStreak = 0;
  if (rawToday.includes(':')) {
    const [datePart, numPart] = rawToday.split(':');
    todayStreak = datePart === todayStr() ? (parseInt(numPart, 10) || 0) : 0;
  } else {
    todayStreak = parseInt(rawToday, 10) || 0;
  }
  return {
    lockout:       localStorage.getItem(`ykb_lockout_${tier}`) || null,
    todayStreak,
    bestStreak:    parseInt(localStorage.getItem(`ykb_best_${tier}`)    || '0', 10),
    totalCorrect:  parseInt(localStorage.getItem(`ykb_correct_${tier}`) || '0', 10),
    totalAnswered: parseInt(localStorage.getItem(`ykb_total_${tier}`)   || '0', 10),
  };
}

function localSet(tier: Tier4, data: Partial<TierData>) {
  if (data.lockout       !== undefined) localStorage.setItem(`ykb_lockout_${tier}`,  data.lockout ?? '');
  if (data.todayStreak   !== undefined) localStorage.setItem(`ykb_today_${tier}`,    String(data.todayStreak));
  if (data.bestStreak    !== undefined) localStorage.setItem(`ykb_best_${tier}`,     String(data.bestStreak));
  if (data.totalCorrect  !== undefined) localStorage.setItem(`ykb_correct_${tier}`,  String(data.totalCorrect));
  if (data.totalAnswered !== undefined) localStorage.setItem(`ykb_total_${tier}`,    String(data.totalAnswered));
}

// ── Firestore sync (fire-and-forget) ─────────────────────────────────────────
async function pushToFirestore(uid: string, tier: Tier4, data: Partial<TierData>) {
  try {
    const ref = doc(db, 'users', uid, 'tiers', tier);
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn('[tierSync] firestore write failed (offline?):', e);
  }
}

export async function pullFromFirestore(uid: string, tier: Tier4) {
  try {
    const ref  = doc(db, 'users', uid, 'tiers', tier);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const d = snap.data() as TierData;
    // Only pull if remote is newer / higher streaks — don't overwrite local advances
    const local = localGet(tier);
    localSet(tier, {
      lockout:       d.lockout || local.lockout,
      todayStreak:   Math.max(d.todayStreak   ?? 0, local.todayStreak),
      bestStreak:    Math.max(d.bestStreak    ?? 0, local.bestStreak),
      totalCorrect:  Math.max(d.totalCorrect  ?? 0, local.totalCorrect),
      totalAnswered: Math.max(d.totalAnswered ?? 0, local.totalAnswered),
    });
  } catch (e) {
    console.warn('[tierSync] firestore read failed:', e);
  }
}

// ── Public write helpers ─────────────────────────────────────────────────────
export function syncLockout(tier: Tier4, uid?: string | null) {
  const today = todayStr();
  localSet(tier, { lockout: today });
  if (uid) pushToFirestore(uid, tier, { lockout: today });
}

export function syncTodayStreak(streak: number, tier: Tier4, uid?: string | null) {
  localSet(tier, { todayStreak: streak });
  if (uid) pushToFirestore(uid, tier, { todayStreak: streak });
}

export function syncBest(streak: number, tier: Tier4, uid?: string | null) {
  const current = localGet(tier).bestStreak;
  if (streak > current) {
    localSet(tier, { bestStreak: streak });
    if (uid) pushToFirestore(uid, tier, { bestStreak: streak });
  }
}

export function syncStat(correct: boolean, tier: Tier4, uid?: string | null) {
  const d = localGet(tier);
  const updated = {
    totalCorrect:  d.totalCorrect  + (correct ? 1 : 0),
    totalAnswered: d.totalAnswered + 1,
  };
  localSet(tier, updated);
  if (uid) pushToFirestore(uid, tier, updated);
}

export function clearLockout(tier: Tier4, uid?: string | null) {
  localStorage.removeItem(`ykb_lockout_${tier}`);
  if (uid) pushToFirestore(uid, tier, { lockout: null });
}
