import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const revalidate = 60; // cache 60s

export async function GET() {
  try {
    const usersSnap = await adminDb.collection('users').listDocuments();

    const entries = await Promise.all(
      usersSnap.map(async (userRef) => {
        const [tiersSnap, userDoc] = await Promise.all([
          userRef.collection('tiers').get(),
          userRef.get(),
        ]);

        const hasUsername = userDoc.exists && !!userDoc.data()?.username;
        const username: string =
          userDoc.data()?.username ||
          userRef.id.slice(0, 8);

        const tiers: Record<string, { bestStreak: number; totalCorrect: number; totalAnswered: number }> = {};
        tiersSnap.forEach((doc) => {
          const d = doc.data();
          tiers[doc.id] = {
            bestStreak:    d.bestStreak    || 0,
            totalCorrect:  d.totalCorrect  || 0,
            totalAnswered: d.totalAnswered || 0,
          };
        });

        return { uid: userRef.id, username, hasUsername, tiers };
      })
    );

    // Show users with activity OR who explicitly picked a username
    const active = entries.filter(e =>
      Object.values(e.tiers).some(t => t.totalAnswered > 0) || e.hasUsername
    );

    function userDocHasUsername(e: { uid: string; username: string }) {
      // Show users who set a real username even if they haven't played yet
      return e.username.length > 8 || !/^[a-f0-9]+$/.test(e.username);
    }

    return NextResponse.json({ entries: active });
  } catch (err) {
    console.error('leaderboard error', err);
    return NextResponse.json({ entries: [] }, { status: 500 });
  }
}
