import { NextRequest } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questionId, answer, correct, timeToAnswerMs, difficulty, identifiabilityScore } = body;
    if (!questionId || !answer) {
      return Response.json({ ok: false, error: 'missing fields' }, { status: 400 });
    }
    const db = getAdminDb();
    await db.collection('gauntletFeedback').add({
      questionId,
      answer,
      correct: Boolean(correct),
      timeToAnswerMs: timeToAnswerMs ?? null,
      difficulty: difficulty ?? null,
      identifiabilityScore: identifiabilityScore ?? null,
      timestamp: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('gauntlet-feedback error:', err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
