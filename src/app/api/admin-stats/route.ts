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

export async function GET(req: NextRequest) {
  // Key must be in header only — never in URL (shows in server logs)
  const key = req.headers.get('x-admin-key');
  if (key !== 'YKB_ADMIN_2026') {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();

  const [logsSnap, feedbackSnap] = await Promise.all([
    db.collection('agentLogs').orderBy('timestamp', 'desc').limit(20).get(),
    db.collection('gauntletFeedback').orderBy('timestamp', 'desc').limit(100).get(),
  ]);

  const logs = logsSnap.docs.map(d => d.data());

  const feedbackDocs = feedbackSnap.docs.map(d => d.data());

  // Aggregate feedback by question
  const byQuestion: Record<string, { answer: string; correct: number; total: number; avgTimeMs: number; difficulty: string; identifiabilityScore: number }> = {};
  for (const f of feedbackDocs) {
    const key = f.questionId as string;
    if (!byQuestion[key]) {
      byQuestion[key] = { answer: f.answer, correct: 0, total: 0, avgTimeMs: 0, difficulty: f.difficulty, identifiabilityScore: f.identifiabilityScore };
    }
    byQuestion[key].total++;
    if (f.correct) byQuestion[key].correct++;
    byQuestion[key].avgTimeMs += (f.timeToAnswerMs ?? 0);
  }
  for (const q of Object.values(byQuestion)) {
    q.avgTimeMs = q.total > 0 ? Math.round(q.avgTimeMs / q.total) : 0;
  }

  // Top-level feedback summary
  const totalAnswers = feedbackDocs.length;
  const totalCorrect = feedbackDocs.filter(f => f.correct).length;
  const overallAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
  const avgTime = totalAnswers > 0 ? Math.round(feedbackDocs.reduce((s, f) => s + (f.timeToAnswerMs ?? 0), 0) / totalAnswers) : 0;

  // Cost summary from logs
  const totalCost = logs.reduce((s, l) => s + (l.totalCostUsd ?? 0), 0);
  const totalQcRejections = logs.reduce((s, l) => s + (l.qcRejections ?? 0), 0);

  return Response.json({
    logs,
    feedbackSummary: { totalAnswers, overallAccuracy, avgTimeMs: avgTime },
    questionStats: Object.entries(byQuestion)
      .map(([id, v]) => ({ id, ...v, accuracy: Math.round((v.correct / v.total) * 100) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20),
    costSummary: { totalCostUsd: parseFloat(totalCost.toFixed(4)), totalQcRejections, pipelineRuns: logs.length },
  });
}
