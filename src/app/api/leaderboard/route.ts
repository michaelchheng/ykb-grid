import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export const revalidate = 60; // cache 60s

export async function GET() {
  try {
    // Fetch all users' tier sub-collections in parallel
    const usersSnap = await adminDb.collection('users').listDocuments();

    const entries = await Promise.all(
      usersSnap.map(async (userRef) => {
        const [tiersSnap, userRecord] = await Promise.all([
          userRef.collection('tiers').get(),
          adminAuth.getUser(userRef.id).catch(() => null),
        ]);

        const username: string =
          (userRecord?.displayName) ||
          (userRecord?.email?.split('@')[0]) ||
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

        return { uid: userRef.id, username, tiers };
      })
    );

    // Filter out users with zero activity
    const active = entries.filter(e =>
      Object.values(e.tiers).some(t => t.totalAnswered > 0)
    );

    return NextResponse.json({ entries: active });
  } catch (err) {
    console.error('leaderboard error', err);
    return NextResponse.json({ entries: [] }, { status: 500 });
  }
}
