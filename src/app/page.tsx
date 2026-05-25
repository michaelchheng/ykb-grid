'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { type Question } from '@/data/questions';
import { type GauntletQuestion } from '@/data/gauntlet';
import { type DraftChallenge, type DraftPlayer } from '@/data/draft';
import UsernameModal from '@/components/UsernameModal';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import {
  syncLockout, syncTodayStreak, syncBest, syncStat, clearLockout as fsClearLockout,
  localGet, pullFromFirestore,
} from '@/lib/tierSync';

// ── Ball IQ ranks by best streak ──────────────────────────────────────────────
const BALL_IQ_RANKS = [
  { label: 'Casual',              color: '#6b7280', minStreak: 0  },
  { label: 'Hooper',              color: '#38bdf8', minStreak: 4  },
  { label: 'Film Room',           color: '#c084fc', minStreak: 10 },
  { label: 'Elite Ball Knowledge',color: '#f97316', minStreak: 18 },
  { label: 'Niche',               color: '#facc15', minStreak: 28 },
] as const;

function getBallIQ(best: number) {
  let idx = 0;
  for (let i = 0; i < BALL_IQ_RANKS.length; i++) {
    if (best >= BALL_IQ_RANKS[i].minStreak) idx = i;
  }
  const rank = BALL_IQ_RANKS[idx];
  const next = idx < BALL_IQ_RANKS.length - 1 ? BALL_IQ_RANKS[idx + 1] : null;
  const progress = next
    ? Math.min(100, ((best - rank.minStreak) / (next.minStreak - rank.minStreak)) * 100)
    : 100;
  return { rank, next, progress };
}

// ── localStorage helpers ───────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
type Tier4 = 'easy' | 'medium' | 'hard' | 'niche';
function isLockedOut(tier: Tier4 = 'easy'): boolean {
  if (typeof window === 'undefined') return false;
  return localGet(tier).lockout === todayStr();
}
function setLockout(tier: Tier4, uid?: string | null) { syncLockout(tier, uid); }
function getBest(tier: Tier4 = 'easy'): number { return localGet(tier).bestStreak; }
function saveBest(s: number, tier: Tier4, uid?: string | null) { syncBest(s, tier, uid); }
function getTodayStreak(tier: Tier4 = 'easy'): number { return localGet(tier).todayStreak; }
function saveTodayStreak(s: number, tier: Tier4, uid?: string | null) { syncTodayStreak(s, tier, uid); }
function addStat(correct: boolean, tier: Tier4, uid?: string | null) { syncStat(correct, tier, uid); }

// ── Question types ─────────────────────────────────────────────────────────────
type ComparisonQ = { type: 'comparison'; id: string; data: Question };
type GauntletQ   = { type: 'gauntlet';  id: string; data: GauntletQuestion; options: string[] };
type DraftQ      = { type: 'draft';     id: string; data: DraftChallenge; shuffled: DraftPlayer[] };
type AnyQ = ComparisonQ | GauntletQ | DraftQ;

function formatValue(value: number, unit: string): string {
  if (unit.includes('x1000')) return (value / 10).toFixed(1) + '%';
  if (value >= 1000) return value.toLocaleString();
  return String(value);
}

// ── Pool builder ───────────────────────────────────────────────────────────────
// ── Question type rules by tier ─────────────────────────────────────────────
// easy:         comparison only (wide stat gaps, recognizable stars)
// medium/hard:  comparison + gauntlet (50/50)
// niche:        comparison + gauntlet + draft (40/40/20)
function pickQuestion(_streak: number, used: Set<string>, aiExtra: Question[], tier: 'easy'|'medium'|'hard'|'niche' = 'easy', aiGauntlet: GauntletQuestion[] = [], aiDraft: DraftChallenge[] = []): AnyQ | null {
  // Gate question types by tier
  let qType: 'comparison' | 'gauntlet' | 'draft';
  if (tier === 'easy') {
    qType = 'comparison';
  } else if (tier === 'medium' || tier === 'hard') {
    qType = Math.random() < 0.5 ? 'comparison' : 'gauntlet';
  } else {
    // niche: 40% comparison, 40% gauntlet, 20% draft
    const r = Math.random();
    qType = r < 0.20 ? 'draft' : r < 0.60 ? 'gauntlet' : 'comparison';
  }

  if (qType === 'comparison') {
    const pool = aiExtra.filter(q => !used.has(q.id));
    if (pool.length === 0) return null; // AI buffer empty — caller should trigger fetch and wait
    const q = pool[Math.floor(Math.random() * pool.length)];
    return { type: 'comparison', id: q.id, data: q };
  }

  if (qType === 'gauntlet') {
    const src = aiGauntlet.filter(q => !used.has(q.id));
    if (src.length === 0) return null;
    const q = src[Math.floor(Math.random() * src.length)];
    return { type: 'gauntlet', id: q.id, data: q, options: [...q.options].sort(() => Math.random() - 0.5) };
  }

  // draft — niche only
  const draftSrc = aiDraft.filter(c => !used.has(c.id));
  if (draftSrc.length === 0) return null;
  const c = draftSrc[Math.floor(Math.random() * draftSrc.length)];
  const top3Players = c.players.slice(0, 3);
  return { type: 'draft', id: c.id, data: { ...c, players: top3Players }, shuffled: [...top3Players].sort(() => Math.random() - 0.5) };
}

type GameState = 'hub' | 'playing' | 'correct' | 'wrong' | 'locked';

export default function Home() {
  const [gameState, setGameState]             = useState<GameState>('hub');
  const [streak, setStreak]                   = useState(0);
  const [currentQ, setCurrentQ]               = useState<AnyQ | null>(null);
  const [usedIds, setUsedIds]                 = useState<Set<string>>(new Set());
  const [username, setUsername]               = useState<string | null>(null);
  const [userEmail, setUserEmail]             = useState<string | null>(null);
  const [showModal, setShowModal]             = useState(false);
  const [mounted, setMounted]                 = useState(false);
  const [isAdmin, setIsAdmin]                 = useState(() => typeof window !== 'undefined' && localStorage.getItem('ykb_admin') === '1');
  const [showAdminDrawer, setShowAdminDrawer] = useState(false);
  const [showProfile, setShowProfile]         = useState(false);
  const [adPopup, setAdPopup]               = useState<'unlock'|'streak'|null>(null);
  const [shields, setShields]                 = useState<number>(() => typeof window !== 'undefined' ? Number(localStorage.getItem('ykb_shields') || '0') : 0);
  const [shieldFlash, setShieldFlash]         = useState(false);
  const [, forceUpdate]                       = useState(0);
  const [aiBuffer, setAiBuffer]               = useState<Question[]>([]);
  const [aiGauntletBuffer, setAiGauntletBuffer] = useState<GauntletQuestion[]>([]);
  const [aiDraftBuffer, setAiDraftBuffer]         = useState<DraftChallenge[]>([]);
  const fetchingAiTiers                       = useRef<Set<string>>(new Set());
  const aiBuffersByTier                       = useRef<Map<string, Question[]>>(new Map());
  const [fetchingAi, setFetchingAi]           = useState(false); // kept for loading screen
  const [loadingStep, setLoadingStep]         = useState<string | null>(null);
  const [waitingForAi, setWaitingForAi]       = useState(false);

  const [answered, setAnswered]               = useState<'A' | 'B' | null>(null);
  const [gauntletPick, setGauntletPick]       = useState<string | null>(null);
  const gauntletQuestionStartMs               = useRef<number>(Date.now());
  const [draftRanking, setDraftRanking]       = useState<DraftPlayer[]>([]);
  const [draftRemaining, setDraftRemaining]   = useState<DraftPlayer[]>([]);
  const [draftSubmitted, setDraftSubmitted]   = useState(false);
  const [draftScore, setDraftScore]           = useState(0);
  const [selectedTier, setSelectedTier]       = useState<'easy'|'medium'|'hard'|'niche'>('easy');

  // Reload used IDs from localStorage when tier changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`ykb_used_${selectedTier}`);
      setUsedIds(saved ? new Set(JSON.parse(saved) as string[]) : new Set());
    } catch { setUsedIds(new Set()); }
    // Swap in the cached buffer for this tier (may be empty if not yet fetched)
    setAiBuffer(aiBuffersByTier.current.get(selectedTier) ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTier]);

  const { submitVote, voteData, getVotes, submitScore } = useSocket();
  const { user: fbUser, loading: authLoading, signInWithGoogle, signOut, updateHandle } = useAuth();
  const uid = fbUser?.uid ?? null;

  // Pull Firestore data for all tiers when user logs in
  useEffect(() => {
    if (!fbUser) return;
    (['easy','medium','hard','niche'] as const).forEach(t => pullFromFirestore(fbUser.uid, t));
    if (fbUser.handle) setUsername(fbUser.handle);
    if (fbUser.email) setUserEmail(fbUser.email);
  }, [fbUser?.uid]);

  // Push AdSense ad whenever the popup opens
  useEffect(() => {
    if (!adPopup) return;
    try {
      const w = window as typeof window & { adsbygoogle: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch { /* ad not loaded yet */ }
  }, [adPopup]);

  useEffect(() => {
    const saved = localStorage.getItem('ykb_username');
    if (saved) setUsername(saved);
    // Only show modal if not authenticated via Firebase
    if (!saved && !auth.currentUser) setShowModal(true);
    const savedEmail = localStorage.getItem('ykb_email');
    if (savedEmail) setUserEmail(savedEmail);
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'YKB_ADMIN_2026') {
      localStorage.setItem('ykb_admin', '1');
      setIsAdmin(true);
    }
    setMounted(true);
  }, []);

  const fetchAiQuestions = useCallback(async (difficulty: string) => {
    if (fetchingAiTiers.current.has(difficulty)) return;
    fetchingAiTiers.current.add(difficulty);
    // Only show loading UI if this is the active tier
    if (difficulty === selectedTier) { setFetchingAi(true); setLoadingStep('Connecting...'); }
    try {
      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`/api/generate-question/stream?difficulty=${difficulty}&count=8&seenMatchups=${encodeURIComponent(JSON.stringify([...seenCompMatchups.current]))}`);

        es.addEventListener('step', (e) => {
          const d = JSON.parse(e.data) as { id: string; msg: string };
          if (difficulty === selectedTier) setLoadingStep(d.msg);
        });

        es.addEventListener('result', (e) => {
          es.close();
          const data = JSON.parse(e.data) as { questions: Record<string, unknown>[] };
          const qs: Question[] = (data.questions ?? []).map((q) => ({
            id: String(q.id ?? (() => {
              const a = String((q.playerA as Record<string, unknown>)?.name ?? '');
              const b = String((q.playerB as Record<string, unknown>)?.name ?? '');
              return `${a}|${b}|${Date.now()}|${Math.random()}`.toLowerCase().replace(/\s+/g, '_');
            })()),

            era: (q.era as 'classic' | 'modern') ?? 'modern',
            category: (q.category as Question['category']) ?? 'points',
            label: String(q.label ?? ''),
            subLabel: String(q.subLabel ?? ''),
            flavor: String(q.flavor ?? ''),
            playerA: { id: String((q.playerA as Record<string, unknown>)?.id ?? ''), name: String((q.playerA as Record<string, unknown>)?.name ?? ''), context: String((q.playerA as Record<string, unknown>)?.label ?? ''), teamColor: String((q.playerA as Record<string, unknown>)?.color ?? '#888') },
            playerB: { id: String((q.playerB as Record<string, unknown>)?.id ?? ''), name: String((q.playerB as Record<string, unknown>)?.name ?? ''), context: String((q.playerB as Record<string, unknown>)?.label ?? ''), teamColor: String((q.playerB as Record<string, unknown>)?.color ?? '#888') },
            valueA: Number(q.valueA ?? 0),
            valueB: Number(q.valueB ?? 0),
            unit: String(q.unit ?? ''),
            difficulty: (q.difficulty as Question['difficulty']) ?? 'medium',
          })).filter((q: Question) => {
            if (q.valueA === q.valueB || !q.playerA.name || !q.playerB.name) return false;
            const key1 = `${q.playerA.id}|${q.playerB.id}`;
            const key2 = `${q.playerB.id}|${q.playerA.id}`;
            if (seenCompMatchups.current.has(key1) || seenCompMatchups.current.has(key2)) return false;
            return true;
          });
          if (qs.length > 0) {
            // Store in per-tier cache
            const prev = aiBuffersByTier.current.get(difficulty) ?? [];
            aiBuffersByTier.current.set(difficulty, [...prev, ...qs]);
            // Only update reactive state if this is still the active tier
            if (difficulty === selectedTier) setAiBuffer(b => [...b, ...qs]);
          }
          resolve();
        });

        es.addEventListener('error', () => { es.close(); reject(new Error('SSE error')); });
        setTimeout(() => { es.close(); resolve(); }, 50000);
      });
    } catch { /* silent */ } finally {
      fetchingAiTiers.current.delete(difficulty);
      if (difficulty === selectedTier) { setFetchingAi(false); setLoadingStep(null); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTier]);

  const seenGauntletAnswers = useRef<Set<string>>(new Set());
  const seenCompMatchups    = useRef<Set<string>>(new Set());
  const gauntletPrewarmed   = useRef(false);

  const fetchAiGauntlet = useCallback(async (difficulty: string) => {
    try {
      const diff = difficulty === 'easy' ? 'Easy' : difficulty === 'medium' ? 'Medium' : difficulty === 'hard' ? 'Hard' : 'Niche';
      const res = await fetch('/api/generate-gauntlet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: diff, count: 12, seenAnswers: [...seenGauntletAnswers.current] }),
      });
      const data = await res.json();
      const qs = (data.questions ?? []) as GauntletQuestion[];
      if (qs.length > 0) {
        qs.forEach(q => seenGauntletAnswers.current.add(q.answer));
        setAiGauntletBuffer(prev => [...prev, ...qs]);
      }
    } catch { /* silent */ }
  }, []);

  const draftPrewarmed = useRef(false);

  const fetchAiDraft = useCallback(async (difficulty: string) => {
    try {
      const diff = difficulty === 'easy' ? 'Easy' : difficulty === 'medium' ? 'Medium' : difficulty === 'hard' ? 'Hard' : 'Niche';
      const res = await fetch('/api/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: diff }),
      });
      const data = await res.json();
      const challenge = data.challenge as DraftChallenge | undefined;
      if (challenge) setAiDraftBuffer(prev => [...prev, challenge]);
    } catch { /* silent */ }
  }, []);

  // Pre-warm ALL tiers in parallel on mount so switching is instant
  useEffect(() => {
    if (gauntletPrewarmed.current) return;
    gauntletPrewarmed.current = true;
    draftPrewarmed.current = true;
    (['easy','medium','hard','niche'] as const).forEach(t => fetchAiQuestions(t));
    fetchAiGauntlet(selectedTier);
    fetchAiDraft(selectedTier);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ref in sync (no-op now, handled above)
  useEffect(() => {
    draftPrewarmed.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When waitingForAi is true and buffers refill, auto-pick the next question
  useEffect(() => {
    if (!waitingForAi) return;
    const q = pickQuestion(streak, usedIds, aiBuffer, selectedTier, aiGauntletBuffer, aiDraftBuffer);
    if (!q) return;
    setWaitingForAi(false);
    setCurrentQ(q);
    resetAnswerState(q);
    gauntletQuestionStartMs.current = Date.now();
    setGameState('playing');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForAi, aiBuffer, aiGauntletBuffer, aiDraftBuffer]);

  const compId = currentQ?.type === 'comparison' ? currentQ.data.id : null;
  useEffect(() => {
    if (compId) getVotes(compId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compId]);

  function resetAnswerState(q: AnyQ | null) {
    setAnswered(null);
    setGauntletPick(null);
    setDraftSubmitted(false);
    setDraftScore(0);
    if (q?.type === 'draft') {
      setDraftRanking([]);
      setDraftRemaining(q.shuffled);
    } else {
      setDraftRanking([]);
      setDraftRemaining([]);
    }
  }

  function startGame() {
    if (!isAdmin && isLockedOut(selectedTier)) { setGameState('locked'); return; }
    const s = 0;
    setStreak(s);
    const q = pickQuestion(s, usedIds, aiBuffer, selectedTier, aiGauntletBuffer, aiDraftBuffer);
    if (!q) {
      setWaitingForAi(true);
      setGameState('playing');
      fetchAiQuestions(selectedTier);
      fetchAiGauntlet(selectedTier);
      fetchAiDraft(selectedTier);
      return;
    }
    setCurrentQ(q);
    resetAnswerState(q);
    setGameState('playing');
    fetchAiQuestions(selectedTier);
    if (aiGauntletBuffer.length < 6) fetchAiGauntlet(selectedTier);
  }

  function handleResult(correct: boolean) {
    addStat(correct, selectedTier, uid);
    // Track feedback for all question types
    if (currentQ && currentQ.type !== 'gauntlet') {
      fetch('/api/gauntlet-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          answer: null,
          correct,
          timeToAnswerMs: Date.now() - gauntletQuestionStartMs.current,
          difficulty: selectedTier,
          identifiabilityScore: null,
        }),
      }).catch(() => {});
    }
    if (correct) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      saveTodayStreak(newStreak, selectedTier, uid);
      saveBest(newStreak, selectedTier, uid);
      // Award a shield every 10 correct, max 2 stacked
      if (newStreak % 10 === 0) {
        setShields(prev => {
          const next = Math.min(prev + 1, 2);
          localStorage.setItem('ykb_shields', String(next));
          return next;
        });
      }
      setGameState('correct');
    } else if (shields > 0) {
      // Shield absorbs the loss
      const newShields = shields - 1;
      setShields(newShields);
      localStorage.setItem('ykb_shields', String(newShields));
      setShieldFlash(true);
      setTimeout(() => setShieldFlash(false), 2000);
      setGameState('correct'); // treat as survived — move on
    } else {
      saveBest(streak, selectedTier, uid);
      setLockout(selectedTier, uid);
      setGameState('wrong');
      // Email notification
      // Fire lockout notification email
      (async () => {
        try {
          const body: Record<string, string> = { tier: selectedTier };
          if (auth.currentUser) {
            body.idToken = await auth.currentUser.getIdToken();
            body.handle  = fbUser?.handle ?? localStorage.getItem('ykb_username') ?? 'Hooper';
          } else {
            const em = localStorage.getItem('ykb_email');
            if (!em) return;
            body.email  = em;
            body.handle = localStorage.getItem('ykb_username') ?? 'Hooper';
          }
          fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } catch {}
      })();
      if (username) submitScore({ username, score: streak, correct: streak, total: streak + 1, bestStreak: streak, avgSpeedMs: 0 });
    }
  }

  function pickComparison(choice: 'A' | 'B') {
    if (answered || !currentQ || currentQ.type !== 'comparison') return;
    setAnswered(choice);
    const q = currentQ.data;
    const correct = choice === 'A' ? q.valueA >= q.valueB : q.valueB > q.valueA;
    submitVote(q.id, choice, correct, username || 'Anon');
    handleResult(correct);
  }

  function pickGauntlet(option: string) {
    if (gauntletPick || !currentQ || currentQ.type !== 'gauntlet') return;
    setGauntletPick(option);
    const correct = option === currentQ.data.answer;
    handleResult(correct);
    // Fire-and-forget feedback
    fetch('/api/gauntlet-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: currentQ.id,
        answer: option,
        correct,
        timeToAnswerMs: Date.now() - gauntletQuestionStartMs.current,
        difficulty: selectedTier,
        identifiabilityScore: (currentQ.data as { identifiabilityScore?: number }).identifiabilityScore ?? null,
      }),
    }).catch(() => {});
  }

  function draftPick(player: DraftPlayer) {
    if (draftSubmitted || !currentQ || currentQ.type !== 'draft') return;
    const newRanking   = [...draftRanking, player];
    const newRemaining = draftRemaining.filter(p => p.name !== player.name);
    setDraftRanking(newRanking);
    setDraftRemaining(newRemaining);
    if (newRemaining.length === 0) {
      const correct = newRanking.reduce((acc, p, i) => acc + (p.name === currentQ.data.players[i]?.name ? 1 : 0), 0);
      setDraftScore(correct);
      setDraftSubmitted(true);
      handleResult(correct === currentQ.data.players.length);
    }
  }

  function draftUnpick(player: DraftPlayer) {
    if (draftSubmitted) return;
    setDraftRanking(prev => prev.filter(p => p.name !== player.name));
    setDraftRemaining(prev => [...prev, player]);
  }

  function nextQuestion() {
    const newUsed = new Set(usedIds);
    if (currentQ?.id) newUsed.add(currentQ.id);
    setUsedIds(newUsed);
    try { localStorage.setItem(`ykb_used_${selectedTier}`, JSON.stringify([...newUsed])); } catch { }
    // Drain used questions from ALL AI buffers; track served comparison matchups for dedup
    if (currentQ?.type === 'comparison' && currentQ.id) {
      const aId = currentQ.data.playerA.id;
      const bId = currentQ.data.playerB.id;
      if (aId && bId) {
        seenCompMatchups.current.add(`${aId}|${bId}`);
        seenCompMatchups.current.add(`${bId}|${aId}`);
      }
      setAiBuffer(prev => prev.filter(q => q.id !== currentQ.id));
    }
    if (currentQ?.type === 'gauntlet' && currentQ.id) {
      setAiGauntletBuffer(prev => prev.filter(q => q.id !== currentQ.id));
    }
    if (currentQ?.type === 'draft' && currentQ.id) {
      setAiDraftBuffer(prev => prev.filter(c => c.id !== currentQ.id));
    }
    const q = pickQuestion(streak, newUsed, aiBuffer, selectedTier, aiGauntletBuffer, aiDraftBuffer);
    if (!q) {
      setWaitingForAi(true);
      setGameState('playing');
      fetchAiQuestions(selectedTier);
      fetchAiGauntlet(selectedTier);
      fetchAiDraft(selectedTier);
      return;
    }
    setCurrentQ(q);
    resetAnswerState(q);
    gauntletQuestionStartMs.current = Date.now();
    setGameState('playing');
    // Always kick off background refill — fetchingAi guard prevents double-fetching
    if (aiBuffer.length < 6) fetchAiQuestions(selectedTier);
    if (aiGauntletBuffer.length < 8) fetchAiGauntlet(selectedTier);
    if (aiDraftBuffer.length < 3) fetchAiDraft(selectedTier);
  }


  if (showModal) return (
    <UsernameModal onSubmit={(name) => {
      localStorage.setItem('ykb_username', name);
      setUsername(name);
      if (fbUser) updateHandle(name);
      setShowModal(false);
    }} />
  );

  const best    = mounted ? getBest(selectedTier) : 0;
  const todayS  = mounted ? getTodayStreak(selectedTier) : 0;
  const { rank, next: nextRank, progress } = getBallIQ(best);
  const locked  = mounted && isLockedOut(selectedTier);

  function watchAd(target: 'unlock' | 'streak') {
    // adBreak shim exists but Google hasn't approved ads yet — show popup
    setAdPopup(target);
  }

  // ── HUB ───────────────────────────────────────────────────────────────────
  if (gameState === 'hub') return (
    <div className="bg-[#08080d] text-white min-h-screen">
      <section className="min-h-screen flex flex-col items-center justify-center px-5 pt-20 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(250,204,21,0.06) 0%, transparent 70%)' }} />

        <div className="max-w-sm w-full text-center relative z-10">
          {/* Title container */}
          <div className="relative mb-6">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-8 pt-8 pb-6 text-center"
              style={{ boxShadow: '0 0 60px rgba(250,204,21,0.06) inset' }}>
              <h1 className="text-[clamp(2.8rem,12vw,5rem)] font-black tracking-tighter leading-[0.9] text-white mb-3">
                Do You<br /><span style={{ color: '#38bdf8' }}>Know Ball?</span>
              </h1>
              <p className="text-white/40 text-sm font-medium mt-4">NBA stats trivia — daily knowledge challenge</p>
            </div>
          </div>

          {/* Handle + rank pill */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <button onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2 transition-all">
              <span className="text-white/50 text-xs font-sans">{username}</span>
              <span className="text-[10px] font-sans uppercase tracking-widest" style={{ color: mounted ? rank.color : '#6b7280' }}>
                {mounted ? rank.label : 'Casual'}
              </span>
            </button>
            {isAdmin && (
              <button onClick={() => setShowAdminDrawer(true)}
                className="text-[9px] font-sans text-sky-300/60 border border-sky-400/30 rounded px-1.5 py-0.5 hover:bg-sky-400/10 transition-colors">
                ADMIN
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-6 py-5 mb-8 text-left">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">/ juː · noʊ · bɔːl /</p>
            <p className="text-white/60 text-sm leading-relaxed">
              The action of knowing ball. What our generation calls it when someone possesses elite basketball knowledge — not just who won, but why it mattered. The stats, the context, the arguments only real ones can make. One wrong answer locks you out until tomorrow. Prove you know ball.
            </p>
          </div>

          {mounted && (best > 0 || todayS > 0) && (
            <div className="flex items-center justify-center gap-10 mb-8">
              {todayS > 0 && (
                <div className="text-center">
                  <p className="text-6xl font-black tabular-nums leading-none" style={{ color: '#38bdf8' }}>{todayS} 🔥</p>
                  <p className="text-xs text-white/45 mt-2 font-medium">today&apos;s streak</p>
                </div>
              )}
              {best > 0 && (
                <div className="text-center">
                  <p className="text-4xl font-black tabular-nums leading-none text-white/50">{best}</p>
                  <p className="text-xs text-white/30 mt-2 font-medium">best ever</p>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-white/35 font-semibold mb-3">Difficulty</p>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {([
              { id: 'easy',     label: 'Easy',   color: '#34d399' },
              { id: 'medium',   label: 'Medium', color: '#38bdf8' },
              { id: 'hard',     label: 'Hard',   color: '#c084fc' },
              { id: 'niche', label: 'Niche',  color: '#38bdf8' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setSelectedTier(t.id)}
                className="rounded-xl border p-3 text-center transition-all"
                style={{
                  borderColor: selectedTier === t.id ? t.color : 'rgba(255,255,255,0.08)',
                  background: selectedTier === t.id ? `${t.color}18` : 'rgba(255,255,255,0.02)',
                }}>
                <p className="text-[11px] font-sans font-bold" style={{ color: selectedTier === t.id ? t.color : 'rgba(255,255,255,0.35)' }}>{t.label}</p>
              </button>
            ))}
          </div>

          {locked ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-6 mb-8">
              <p className="text-2xl font-black mb-1">🔒</p>
              <p className="text-white/60 text-sm mb-1">Locked until midnight</p>
              <p className="text-white/40 text-sm">You got one wrong. Come back tomorrow.</p>
            </div>
          ) : (
            <>
              <button onClick={startGame}
                className="w-full py-5 rounded-2xl bg-sky-400 text-black font-black text-xl hover:bg-sky-300 transition-all active:scale-[0.98] shadow-lg shadow-sky-400/20"
                style={{ marginBottom: fetchingAi && loadingStep ? '12px' : '32px' }}>
                Start
              </button>
              {fetchingAi && loadingStep && (
                <div className="flex items-center justify-center gap-2 mb-8 text-xs text-white/40 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
                  {loadingStep}
                </div>
              )}
            </>
          )}



          {/* Per-tier status + leaderboard */}
          {mounted && (
            <div className="mt-8 rounded-2xl border border-white/6 bg-white/[0.02] p-5 text-left w-full">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-white/40 font-semibold">Your Tiers</p>
                <a href="/leaderboard" className="text-xs text-white/40 hover:text-white/70 transition-colors font-medium">Leaderboard →</a>
              </div>
              <div className="space-y-2">
                {([
                  { id: 'easy'     as const, label: 'Easy',   color: '#34d399' },
                  { id: 'medium'   as const, label: 'Medium', color: '#38bdf8' },
                  { id: 'hard'     as const, label: 'Hard',   color: '#c084fc' },
                  { id: 'niche' as const, label: 'Niche',  color: '#38bdf8' },
                ]).map(t => {
                  const tLocked  = isLockedOut(t.id);
                  const tStreak  = getTodayStreak(t.id);
                  const tBest    = getBest(t.id);
                  return (
                    <div key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-white/5 bg-white/[0.02]">
                      <span className="text-[11px] font-black font-sans w-16 shrink-0" style={{ color: t.color }}>{t.label}</span>
                      <div className="flex-1 flex items-center gap-2">
                        {tLocked ? (
                          <span className="text-xs text-white/35">🔒 locked</span>
                        ) : tStreak > 0 ? (
                          <span className="text-xs font-semibold" style={{ color: t.color }}>{tStreak} 🔥</span>
                        ) : (
                          <span className="text-xs text-white/25">not played</span>
                        )}
                      </div>
                      {tBest > 0 && (
                        <span className="text-xs text-white/30 tabular-nums">best {tBest}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </section>

      {showProfile && mounted && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowProfile(false)} />
          <div className="fixed top-0 right-0 h-full w-80 z-50 bg-[#0f0f18] border-l border-white/10 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div>
                <p className="text-sm font-semibold text-white/60">Profile</p>
                <p className="text-base font-black mt-0.5">{username}</p>
              </div>
              <button onClick={() => setShowProfile(false)} className="text-white/30 hover:text-white/70 text-lg">&#x2715;</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
              {/* Google account */}
              <div>
                {fbUser ? (
                  <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <div className="flex items-center gap-3">
                      {fbUser.photoURL && <img src={fbUser.photoURL} className="w-7 h-7 rounded-full" alt="" />}
                      <div>
                        <p className="text-xs font-semibold text-white/80">{fbUser.email}</p>
                        <p className="text-xs font-medium text-white/40">Signed in with Google</p>
                      </div>
                    </div>
                    <button onClick={() => { signOut(); setShowProfile(false); }}
                      className="text-[10px] font-sans text-white/30 hover:text-red-400 transition-colors">Sign out</button>
                  </div>
                ) : (
                  <button onClick={() => signInWithGoogle()}
                    className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.04] hover:bg-white/[0.08] px-4 py-3 transition-all">
                    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    <span className="text-xs font-semibold text-white/70">Sign in with Google</span>
                  </button>
                )}
              </div>
              {/* Handle */}
              <div>
                <p className="text-xs font-semibold text-white/50 mb-2">Handle</p>
                <div className="flex gap-2">
                  <span className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-sans text-white/70">{username}</span>
                  <button onClick={() => { setShowProfile(false); setShowModal(true); }}
                    className="px-3 py-2 rounded-lg border border-white/15 text-xs text-white/50 hover:text-white hover:border-white/35 transition-colors">Edit</button>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-sans text-white/35 uppercase tracking-widest mb-3">Ball IQ Rank</p>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-lg font-black" style={{ color: rank.color }}>{rank.label}</p>
                      {nextRank ? (
                        <p className="text-[11px] font-sans mt-0.5" style={{ color: nextRank.color }}>to {nextRank.label}</p>
                      ) : (
                        <p className="text-xs font-medium text-white/35 mt-0.5">Max rank reached</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black tabular-nums" style={{ color: rank.color }}>{Math.round(progress)}%</p>
                      <p className="text-xs text-white/30 font-medium">{nextRank ? 'to next' : 'complete'}</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${progress}%`, backgroundColor: nextRank ? nextRank.color : rank.color }} />
                  </div>
                  {nextRank && (
                    <p className="text-xs text-white/35 font-medium">
                      Reach a streak of {nextRank.minStreak} to unlock {nextRank.label}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-white/50 mb-2">Stats</p>
                <div className="space-y-2">
                  {[
                    { label: 'Best Streak',    value: String(best),                                              color: '#38bdf8' },
                    { label: "Today's Streak", value: String(todayS),                                           color: '#34d399' },
                    { label: 'Total Answered', value: localStorage.getItem(`ykb_total_${selectedTier}`)   || '0', color: '#818cf8' },
                    { label: 'Total Correct',  value: localStorage.getItem(`ykb_correct_${selectedTier}`) || '0', color: '#38bdf8' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2.5">
                      <span className="text-xs text-white/50 font-medium">{s.label}</span>
                      <span className="text-sm font-black" style={{ color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-sans text-white/35 uppercase tracking-widest mb-2">Rank Ladder</p>
                <div className="space-y-1">
                  {[...BALL_IQ_RANKS].reverse().map(r => {
                    const isMe = r.label === rank.label;
                    return (
                      <div key={r.label} className={['flex items-center justify-between rounded-lg px-3 py-2 transition-colors', isMe ? 'bg-white/[0.06] border border-white/10' : 'opacity-35'].join(' ')}>
                        <span className="text-xs font-bold" style={{ color: r.color }}>{r.label}</span>
                        <span className="text-[10px] font-sans text-white/30">{r.minStreak > 0 ? `${r.minStreak}+ streak` : 'starter'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isAdmin && showAdminDrawer && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdminDrawer(false)} />
          <div className="fixed top-0 right-0 h-full w-72 z-50 bg-[#0f0f18] border-l border-white/10 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <p className="text-[10px] font-sans text-sky-300/60 uppercase tracking-widest">Admin</p>
              <button onClick={() => setShowAdminDrawer(false)} className="text-white/30 hover:text-white/70 text-lg">&#x2715;</button>
            </div>
            <div className="flex-1 px-5 py-6 space-y-3">
              <button onClick={() => { (['easy','medium','hard','niche'] as const).forEach(t => localStorage.removeItem(`ykb_lockout_${t}`)); setShowAdminDrawer(false); forceUpdate(n => n + 1); }}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] px-3 py-3 text-xs text-white/60 font-sans transition-colors">
                Reset Lockout
              </button>
              <button onClick={() => { (['easy','medium','hard','niche'] as const).forEach(t => localStorage.removeItem(`ykb_today_${t}`)); setShowAdminDrawer(false); forceUpdate(n => n + 1); }}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] px-3 py-3 text-xs text-white/60 font-sans transition-colors">
                Reset Today Streak
              </button>
              <button onClick={() => {
                (['easy','medium','hard','niche'] as const).forEach(t => ['lockout','today','best','correct','total','lifeline'].forEach(k => localStorage.removeItem(`ykb_${k}_${t}`)));
                setShowAdminDrawer(false); forceUpdate(n => n + 1);
              }}
                className="w-full rounded-lg border border-red-500/30 bg-red-500/[0.06] hover:bg-red-500/[0.12] px-3 py-3 text-xs text-red-400 font-bold transition-colors">
                Reset All Stats
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );

  // ── LOCKED ────────────────────────────────────────────────────────────────
  if (gameState === 'locked') return (
    <div className="min-h-screen bg-[#08080d] text-white flex items-center justify-center px-5">
      <div className="max-w-sm w-full text-center">
        <p className="text-xs text-white/40 font-medium mb-5">Locked Until Midnight</p>
        <p className="text-8xl font-black tabular-nums mb-2" style={{ color: '#38bdf8' }}>{getTodayStreak(selectedTier)}</p>
        <p className="text-white/40 text-sm mb-8">your streak today</p>

        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 mb-3">
          <p className="text-white/40 text-sm font-medium">Come back tomorrow to keep playing.</p>
        </div>

        <button onClick={() => { setGameState('hub'); forceUpdate(n => n + 1); }}
          className="px-6 py-3 rounded-xl border border-white/15 text-white/50 text-sm font-medium hover:text-white hover:border-white/25 transition-colors">
          Back
        </button>
      </div>
    </div>
  );

  // ── WRONG ─────────────────────────────────────────────────────────────────
  if (gameState === 'wrong') return (
    <div className="min-h-screen bg-[#08080d] text-white flex items-center justify-center px-5">
      <div className="max-w-sm w-full text-center">
        <p className="text-2xl font-black text-red-500 mb-5">You do not know ball.</p>
        <p className="text-8xl font-black tabular-nums leading-none mb-1" style={{ color: '#38bdf8' }}>{streak}</p>
        <p className="text-white/50 text-base font-semibold mb-1">streak ended</p>
        {getBest() > streak && <p className="text-white/30 text-sm mb-2">best ever: <span className="font-bold text-white/50">{getBest()}</span></p>}

        {currentQ && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left mb-6">
            {currentQ.type === 'comparison' && (() => {
              const q = currentQ.data;
              const winner = q.valueA >= q.valueB ? q.playerA : q.playerB;
              const loser  = q.valueA >= q.valueB ? q.playerB : q.playerA;
              const winV   = q.valueA >= q.valueB ? q.valueA  : q.valueB;
              const loseV  = q.valueA >= q.valueB ? q.valueB  : q.valueA;
              return (
                <>
                  <p className="text-xs text-white/40 font-medium mb-3">{q.label}</p>
                  <div className="flex gap-4 mb-3">
                    <div><p className="text-xs text-white/40">{winner.name}</p><p className="text-2xl font-black text-sky-300">{formatValue(winV, q.unit)}</p></div>
                    <div><p className="text-xs text-white/40">{loser.name}</p><p className="text-2xl font-black text-red-400">{formatValue(loseV, q.unit)}</p></div>
                  </div>
                  {q.flavor && <p className="text-white/35 text-xs italic">&ldquo;{q.flavor}&rdquo;</p>}
                </>
              );
            })()}
            {currentQ.type === 'gauntlet' && (
              <>
                <p className="text-[10px] font-sans text-white/30 mb-2">{currentQ.data.season} · {currentQ.data.teamHint}</p>
                <p className="text-sm font-bold text-white mb-2">Answer: <span style={{ color: '#34d399' }}>{currentQ.data.answer}</span></p>
                <p className="text-white/35 text-xs italic">&ldquo;{currentQ.data.flavor}&rdquo;</p>
              </>
            )}
            {currentQ.type === 'draft' && (
              <>
                <p className="text-xs text-white/40 font-medium mb-3">{currentQ.data.statLabel} · {currentQ.data.season}</p>
                <div className="space-y-1.5">
                  {currentQ.data.players.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between">
                      <span className="text-xs text-white/60">{i + 1}. {p.name}</span>
                      <span className="text-xs font-sans font-black" style={{ color: '#34d399' }}>{p.value} {currentQ.data.statUnit}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/40 font-medium mt-2">{draftScore}/{currentQ.data.players.length} positions correct</p>
              </>
            )}
          </div>
        )}
        <button onClick={() => watchAd('streak')}
          className="w-full py-4 rounded-2xl bg-sky-400 text-black font-black text-base hover:bg-sky-300 transition-all active:scale-[0.98] mb-3 shadow-lg shadow-sky-400/20">
          📺 Watch an ad — save your streak
        </button>
        <p className="text-white/25 text-xs mb-6">One lifeline per day. Resets at midnight.</p>

        <div className="flex gap-3 justify-center">
          <button onClick={() => { setGameState('hub'); forceUpdate(n => n + 1); }}
            className="px-6 py-3 rounded-xl border border-white/12 text-white/40 text-sm font-medium hover:text-white/70 hover:border-white/25 transition-colors">
            Hub
          </button>
          <a href="/leaderboard"
            className="px-6 py-3 rounded-xl bg-sky-400 text-black font-black text-sm hover:bg-sky-300 transition-colors">
            Leaderboard
          </a>
        </div>
      </div>

      {adPopup && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-[#0f0f18] p-6 text-center">
            <p className="text-white font-black text-lg mb-1">
              {adPopup === 'streak' ? 'Save your streak' : 'Unlock this tier'}
            </p>
            <p className="text-white/40 text-xs mb-4">
              {adPopup === 'streak' ? 'Watch an ad to keep going.' : 'Watch an ad to play.'}
            </p>
            {/* AdSense display unit — slot 4172175723 */}
            <ins
              className="adsbygoogle"
              style={{ display: 'block', minHeight: 100 }}
              data-ad-client="ca-pub-7874759706660952"
              data-ad-slot="4172175723"
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
            <button onClick={() => setAdPopup(null)}
              className="mt-4 w-full py-3 rounded-xl bg-sky-400 text-black font-black text-sm hover:bg-sky-300 transition-all">
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── PLAYING / CORRECT ─────────────────────────────────────────────────────
  if (!currentQ || waitingForAi) return (
    <div className="min-h-screen bg-[#08080d] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-10 animate-pulse"
          style={{ background: 'radial-gradient(circle, #38bdf8, transparent)', filter: 'blur(40px)', animationDuration: '2s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-8 animate-pulse"
          style={{ background: 'radial-gradient(circle, #c084fc, transparent)', filter: 'blur(50px)', animationDuration: '3s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-5 animate-pulse"
          style={{ background: 'radial-gradient(circle, #facc15, transparent)', filter: 'blur(60px)', animationDuration: '4s', animationDelay: '0.5s' }} />
      </div>

      {/* Spinner */}
      <div className="relative mb-8">
        <div className="w-16 h-16 rounded-full border-2 border-white/5" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-sky-400 border-r-sky-400/40 animate-spin" style={{ animationDuration: '1s' }} />
        <div className="absolute inset-2 w-12 h-12 rounded-full border border-transparent border-t-purple-400/60 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl">🏀</span>
        </div>
      </div>

      {/* Steps */}
      <div className="relative z-10 text-center space-y-2">
        <p className="font-bold text-xl tracking-tight">
          {loadingStep === 'Pulling NBA stats...'   && <span className="text-sky-400">Pulling NBA stats</span>}
          {loadingStep === 'Finding matchups...'    && <span className="text-purple-400">Finding matchups</span>}
          {loadingStep === 'Writing flavor text...' && <span className="text-yellow-400">Crafting the question</span>}
          {loadingStep === 'Grading question quality...' && <span className="text-emerald-400">Grading quality</span>}
          {loadingStep === 'Fixing weak questions...' && <span className="text-orange-400">Fixing weak ones</span>}
          {(!loadingStep || loadingStep === 'Connecting...' || loadingStep === 'Done') && <span className="text-white/80">Generating question</span>}
        </p>
        <p className="text-white/60 text-sm font-sans">
          {loadingStep === 'Pulling NBA stats...'   && 'fetching real stat data from the NBA'}
          {loadingStep === 'Finding matchups...'    && 'picking the best player matchup'}
          {loadingStep === 'Writing flavor text...' && 'writing the question with AI'}
          {loadingStep === 'Grading question quality...' && 'QC agent scoring the question'}
          {loadingStep === 'Fixing weak questions...' && 'rewriting any low-quality questions'}
          {(!loadingStep || loadingStep === 'Connecting...' || loadingStep === 'Done') && 'connecting to generation pipeline'}
        </p>
      </div>

      {/* Step dots */}
      <div className="flex gap-2 mt-6">
        {['Pulling NBA stats...','Finding matchups...','Writing flavor text...','Grading question quality...','Done'].map((step, i) => {
          const stepIdx = ['Pulling NBA stats...','Finding matchups...','Writing flavor text...','Grading question quality...','Done'].indexOf(loadingStep ?? '');
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div key={i} className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{ background: active ? '#38bdf8' : done ? '#38bdf8' : 'rgba(255,255,255,0.15)', opacity: done ? 0.5 : 1, transform: active ? 'scale(1.5)' : 'scale(1)' }} />
          );
        })}
      </div>
    </div>
  );

  const isRevealed = gameState === 'correct';
  const modeLabel = 'Gauntlet';
  const shieldProgress = streak % 10; // progress toward next shield

  return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col">
      {/* Top nav bar */}
      <div className="border-b border-white/6 px-5 py-3 flex items-center justify-between">
        <button onClick={() => { setGameState('hub'); forceUpdate(n => n + 1); }}
          className="text-white/30 hover:text-white/60 text-xs font-sans transition-colors">← Hub</button>
        <p className="text-xs text-white/40 font-semibold">{modeLabel}</p>
        {isAdmin && !isRevealed ? (
          <button onClick={() => handleResult(true)}
            className="text-[9px] font-sans text-sky-300/60 border border-sky-400/30 rounded px-1.5 py-0.5 hover:bg-sky-400/10 transition-colors">
            SKIP
          </button>
        ) : <div className="w-10" />}
      </div>

      {/* Streak + Shield bar */}
      <div className="border-b border-white/4 py-4 flex flex-col items-center gap-3">
        {/* Streak number — big and centered */}
        <div className="flex items-center gap-3">
          <span className="text-6xl font-black tabular-nums leading-none" style={{
            color: streak === 0 ? 'rgba(255,255,255,0.15)' : streak >= 20 ? '#facc15' : streak >= 10 ? '#f97316' : '#38bdf8'
          }}>{streak}</span>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Streak</span>
            <span className="text-sm text-white/50">
              {streak === 0 ? 'get one right' : streak === 1 ? '1 in a row 🔥' : `${streak} in a row 🔥`}
            </span>
          </div>
        </div>

        {/* Shield progress bar — centered, fixed width */}
        <div className="w-56">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Shields</span>
            <div className="flex gap-1.5">
              {[0, 1].map(i => (
                <span key={i} className={`text-base transition-all ${i < shields && shieldFlash && i === shields - 1 ? 'animate-pulse' : ''}`}
                  style={{ filter: i < shields ? 'none' : 'grayscale(1)', opacity: i < shields ? 1 : 0.2 }}>🛡️</span>
              ))}
            </div>
          </div>
          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: shields >= 2 ? '100%' : `${(shieldProgress / 10) * 100}%`,
                background: shields >= 2 ? '#38bdf8' : shieldProgress >= 7 ? '#38bdf8' : shieldProgress >= 4 ? '#c084fc' : 'rgba(255,255,255,0.3)'
              }} />
          </div>
          <p className="text-[10px] text-white/25 mt-1 text-center">
            {shields >= 2 ? 'shields full' : `${shieldProgress} / 10 correct → next shield`}
          </p>
        </div>
      </div>

      {shieldFlash && (
        <div className="text-center py-2 bg-sky-400/10 border-b border-sky-400/20 text-sky-300 text-sm font-black animate-pulse">
          🛡️ Shield saved your streak!
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-6">
        <div className="max-w-sm w-full">

          {currentQ.type === 'comparison' && (() => {
            const q  = currentQ.data;
            const vd = voteData[q.id];
            const tv = vd?.totalVotes || 0;
            return (
              <>
                <div className="text-center mb-6">
                  <p className="text-xs font-sans text-white/35 uppercase tracking-wider mb-1">{q.subLabel}</p>
                  <p className="text-2xl font-black">{q.label}</p>
                </div>
                <div className="space-y-3">
                  {(['A', 'B'] as const).map(side => {
                    const player   = side === 'A' ? q.playerA : q.playerB;
                    const value    = side === 'A' ? q.valueA  : q.valueB;
                    const isWinner = side === 'A' ? q.valueA >= q.valueB : q.valueB > q.valueA;
                    const isPicked = answered === side;
                    const cpct     = tv > 0 ? Math.round(((side === 'A' ? (vd?.votesA ?? 0) : (vd?.votesB ?? 0)) / tv) * 100) : 50;
                    let borderColor = 'rgba(255,255,255,0.1)';
                    let bg = 'rgba(255,255,255,0.03)';
                    if (isRevealed) {
                      if (isWinner)      { borderColor = '#34d399'; bg = 'rgba(52,211,153,0.08)'; }
                      else if (isPicked) { borderColor = '#f87171'; bg = 'rgba(248,113,113,0.08)'; }
                    }
                    return (
                      <button key={side}
                        onClick={() => pickComparison(side)}
                        disabled={!!answered}
                        className="w-full rounded-2xl border p-5 text-left transition-all active:scale-[0.99] disabled:cursor-default"
                        style={{ borderColor, background: bg }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-black text-base">{player.name}</p>
                            <p className="text-white/40 text-xs mt-0.5">{player.context}</p>
                          </div>
                          {isRevealed ? (
                            <p className="text-2xl font-black tabular-nums" style={{ color: isWinner ? '#34d399' : '#f87171' }}>
                              {formatValue(value, q.unit)}
                            </p>
                          ) : (
                            <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
                              <span className="text-xs font-black text-white/40">{side}</span>
                            </div>
                          )}
                        </div>
                        {isRevealed && (
                          <div className="mt-3 pt-3 border-t border-white/8">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${cpct}%`, background: isWinner ? '#34d399' : '#f87171' }} />
                              </div>
                              <span className="text-[10px] font-sans text-white/35 tabular-nums w-8 text-right">{cpct}%</span>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {isRevealed && q.flavor && (
                  <p className="text-white/30 text-xs italic mt-4 text-center leading-relaxed">&ldquo;{q.flavor}&rdquo;</p>
                )}
              </>
            );
          })()}

          {currentQ.type === 'gauntlet' && (() => {
            const q = currentQ.data;
            return (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 mb-5">
                  <p className="text-[10px] font-sans text-white/25 mb-4 text-center">{q.season} &middot; {q.teamHint} &middot; {q.positionHint}</p>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center"><p className="text-2xl font-black">{q.ppg.toFixed(1)}</p><p className="text-[10px] text-white/35 font-sans">PPG</p></div>
                    {q.rpg !== undefined && <div className="text-center"><p className="text-2xl font-black">{q.rpg.toFixed(1)}</p><p className="text-[10px] text-white/35 font-sans">RPG</p></div>}
                    {q.apg !== undefined && <div className="text-center"><p className="text-2xl font-black">{q.apg.toFixed(1)}</p><p className="text-[10px] text-white/35 font-sans">APG</p></div>}
                  </div>
                  {(q.spg !== undefined || q.bpg !== undefined || q.fg_pct !== undefined || q.fg3_pct !== undefined) && (
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/8">
                      {q.spg   !== undefined && <div className="text-center"><p className="text-lg font-black">{q.spg.toFixed(1)}</p><p className="text-[10px] text-white/30 font-sans">SPG</p></div>}
                      {q.bpg   !== undefined && <div className="text-center"><p className="text-lg font-black">{q.bpg.toFixed(1)}</p><p className="text-[10px] text-white/30 font-sans">BPG</p></div>}
                      {q.fg_pct  !== undefined && <div className="text-center"><p className="text-lg font-black">{q.fg_pct.toFixed(1)}%</p><p className="text-[10px] text-white/30 font-sans">FG%</p></div>}
                      {q.fg3_pct !== undefined && <div className="text-center"><p className="text-lg font-black">{q.fg3_pct.toFixed(1)}%</p><p className="text-[10px] text-white/30 font-sans">3P%</p></div>}
                    </div>
                  )}
                  {gauntletPick && (
                    <p className="text-white/30 text-xs italic mt-4 pt-3 border-t border-white/8 leading-relaxed">&ldquo;{q.flavor}&rdquo;</p>
                  )}
                </div>
                <p className="text-[10px] font-sans text-white/30 uppercase tracking-widest mb-3 text-center">Who is this?</p>
                <div className="grid grid-cols-2 gap-3">
                  {currentQ.options.map(opt => {
                    const isCorrect = opt === q.answer;
                    const isPicked  = opt === gauntletPick;
                    let borderColor = 'rgba(255,255,255,0.1)';
                    let bg = 'rgba(255,255,255,0.03)';
                    let textColor = 'rgba(255,255,255,0.85)';
                    if (gauntletPick) {
                      if (isCorrect)     { borderColor = '#34d399'; bg = 'rgba(52,211,153,0.1)'; textColor = '#34d399'; }
                      else if (isPicked) { borderColor = '#f87171'; bg = 'rgba(248,113,113,0.08)'; textColor = '#f87171'; }
                      else { textColor = 'rgba(255,255,255,0.2)'; }
                    }
                    return (
                      <button key={opt}
                        onClick={() => pickGauntlet(opt)}
                        disabled={!!gauntletPick}
                        className="rounded-xl border py-4 px-3 text-center font-bold text-sm transition-all active:scale-[0.98] disabled:cursor-default"
                        style={{ borderColor, background: bg, color: textColor }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {currentQ.type === 'draft' && (() => {
            const c = currentQ.data;
            return (
              <>
                <div className="mb-4">
                  <p className="text-[10px] font-sans text-sky-300/60 uppercase tracking-widest mb-1">All {c.players.length} correct to continue</p>
                  <p className="font-black text-xl">{c.statLabel}</p>
                  <p className="text-white/35 text-xs font-sans mt-0.5">{c.season} &middot; Highest &rarr; Lowest</p>
                </div>
                <div className="space-y-2 mb-4">
                  {Array.from({ length: c.players.length }).map((_, i) => {
                    const p       = draftRanking[i];
                    const answerP = draftSubmitted ? c.players[i] : null;
                    const correct = draftSubmitted && p?.name === c.players[i]?.name;
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-xl border p-3 transition-all"
                        style={{
                          borderColor: draftSubmitted
                            ? (correct ? 'rgba(52,211,153,0.4)' : p ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.08)')
                            : 'rgba(255,255,255,0.08)',
                          background: draftSubmitted
                            ? (correct ? 'rgba(52,211,153,0.06)' : p ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.02)')
                            : 'rgba(255,255,255,0.02)',
                        }}>
                        <span className="text-[10px] font-sans text-white/30 w-4">{i + 1}</span>
                        <div className="flex-1">
                          {p ? (
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-sm">{p.name}</p>
                              {draftSubmitted && (
                                <div className="text-right">
                                  <p className="font-black text-sm tabular-nums" style={{ color: correct ? '#34d399' : '#f87171' }}>
                                    {c.players[i]?.value} {c.statUnit}
                                  </p>
                                  {!correct && answerP && <p className="text-[10px] text-white/35 font-sans">{answerP.name}</p>}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-white/20 text-xs italic">tap to place here</p>
                          )}
                        </div>
                        {p && !draftSubmitted && (
                          <button onClick={() => draftUnpick(p)} className="text-white/20 hover:text-white/50 text-xs">&#x2715;</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!draftSubmitted && draftRemaining.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {draftRemaining.map(p => (
                      <button key={p.name} onClick={() => draftPick(p)}
                        className="rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] px-3 py-2 text-sm font-bold transition-all active:scale-[0.98]">
                        {p.name}
                        {p.hint && <span className="text-white/30 text-[10px] font-sans ml-1.5">{p.hint}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {draftSubmitted && (
                  <p className="text-center text-sm font-black mt-3" style={{ color: draftScore === c.players.length ? '#34d399' : '#f87171' }}>
                    {draftScore === c.players.length ? 'Perfect' : `${draftScore}/${c.players.length} correct`}
                  </p>
                )}
              </>
            );
          })()}

          {isRevealed && (
            <div className="mt-6 text-center">
              <button onClick={nextQuestion}
                className="px-10 py-3.5 rounded-xl bg-sky-400 text-black font-black text-sm hover:bg-sky-300 transition-colors active:scale-[0.98]">
                Next
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
