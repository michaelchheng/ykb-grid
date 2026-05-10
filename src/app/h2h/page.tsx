'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { getQuestionsByDifficulty, type Question } from '@/data/questions';
import { useSocket } from '@/hooks/useSocket';

type Phase = 'lobby' | 'waiting' | 'ready' | 'question' | 'round_result' | 'gameover';

interface H2HPlayer { username: string; wins: number; }
interface H2HQuestion {
  id: string; label: string; subLabel: string; flavor: string;
  playerA: { name: string; context: string; teamColor: string };
  playerB: { name: string; context: string; teamColor: string };
  valueA: number; valueB: number; unit: string;
}
interface RoundResult {
  answers: { socketId: string; username: string; choice: 'A' | 'B' | null; correct: boolean | null; wins: number }[];
  gameOver: boolean;
  winner: string | null;
}

function formatValue(value: number, unit: string): string {
  if (unit.includes('x1000')) return (value / 10).toFixed(1) + '%';
  if (value >= 1000) return value.toLocaleString();
  return String(value);
}

function pickRandomQuestion(used: Set<string>): H2HQuestion | null {
  const all: Question[] = [
    ...getQuestionsByDifficulty('easy'),
    ...getQuestionsByDifficulty('medium'),
    ...getQuestionsByDifficulty('hard'),
  ];
  const avail = all.filter(q => !used.has(q.id));
  const pool = avail.length > 0 ? avail : all;
  const q = pool[Math.floor(Math.random() * pool.length)];
  if (!q) return null;
  return {
    id: q.id, label: q.label, subLabel: q.subLabel, flavor: q.flavor,
    playerA: { name: q.playerA.name, context: q.playerA.context, teamColor: q.playerA.teamColor },
    playerB: { name: q.playerB.name, context: q.playerB.context, teamColor: q.playerB.teamColor },
    valueA: q.valueA, valueB: q.valueB, unit: q.unit,
  };
}

export default function HeadToHead() {
  const [phase, setPhase]             = useState<Phase>('lobby');
  const [mode, setMode]               = useState<'create' | 'join'>('create');
  const [roomCode, setRoomCode]       = useState('');
  const [joinCode, setJoinCode]       = useState('');
  const [username, setUsername]       = useState('');
  const [players, setPlayers]         = useState<H2HPlayer[]>([]);
  const [mySocketId, setMySocketId]   = useState('');
  const [hostSocketId, setHostSocketId] = useState('');
  const [round, setRound]             = useState(0);
  const [totalRounds]                 = useState(5);
  const [question, setQuestion]       = useState<H2HQuestion | null>(null);
  const [answered, setAnswered]       = useState<'A' | 'B' | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [error, setError]             = useState('');
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [timer, setTimer]             = useState(15);
  const usedQuestions                 = useRef(new Set<string>());
  const timerRef                      = useRef<ReturnType<typeof setInterval> | null>(null);

  const { h2hCreate, h2hJoin, h2hSendQuestion, h2hAnswer, h2hLeave, h2hOn } = useSocket();

  const isHost = mySocketId === hostSocketId;

  useEffect(() => {
    const name = localStorage.getItem('ykb_username') || 'Anonymous';
    setUsername(name);
  }, []);

  // Register Socket.IO H2H listeners
  useEffect(() => {
    const offs = [
      h2hOn('h2h_created', (data) => {
        const d = data as { roomCode: string };
        setRoomCode(d.roomCode);
        setPhase('waiting');
      }),
      h2hOn('h2h_error', (data) => {
        setError(String(data));
      }),
      h2hOn('h2h_ready', (data) => {
        const d = data as { players: H2HPlayer[]; hostSocketId: string; mySocketId: string; round: number; totalRounds: number };
        setPlayers(d.players);
        setHostSocketId(d.hostSocketId);
        setMySocketId(d.mySocketId);
        setPhase('ready');
      }),
      h2hOn('h2h_question', (data) => {
        const d = data as { round: number; totalRounds: number; question: H2HQuestion };
        setQuestion(d.question);
        setRound(d.round);
        setAnswered(null);
        setOpponentAnswered(false);
        setRoundResult(null);
        setTimer(15);
        setPhase('question');
        // Start countdown
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimer(t => {
            if (t <= 1) {
              clearInterval(timerRef.current!);
              return 0;
            }
            return t - 1;
          });
        }, 1000);
      }),
      h2hOn('h2h_opponent_answered', () => setOpponentAnswered(true)),
      h2hOn('h2h_round_result', (data) => {
        clearInterval(timerRef.current!);
        const d = data as RoundResult;
        setRoundResult(d);
        // Update player wins
        setPlayers(prev => prev.map(p => {
          const found = d.answers.find(a => a.username === p.username);
          return found ? { ...p, wins: found.wins } : p;
        }));
        setPhase('round_result');
        if (d.gameOver) {
          setTimeout(() => setPhase('gameover'), 2000);
        }
      }),
      h2hOn('h2h_opponent_left', () => {
        clearInterval(timerRef.current!);
        setOpponentLeft(true);
        setPhase('gameover');
      }),
    ];
    return () => offs.forEach(off => off());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer auto-submit
  useEffect(() => {
    if (timer === 0 && phase === 'question' && !answered && question && roomCode) {
      // Auto-pick A on timeout — just submit as wrong
      const correct = false;
      h2hAnswer(roomCode, 'A', correct);
      setAnswered('A');
    }
  }, [timer, phase, answered, question, roomCode, h2hAnswer]);

  function createRoom() {
    setError('');
    h2hCreate(username);
  }

  function joinRoom() {
    setError('');
    if (!joinCode.trim()) { setError('Enter a room code'); return; }
    h2hJoin(joinCode.trim().toUpperCase(), username);
  }

  const sendNextQuestion = useCallback(() => {
    const q = pickRandomQuestion(usedQuestions.current);
    if (!q) return;
    usedQuestions.current.add(q.id);
    h2hSendQuestion(roomCode, q);
  }, [roomCode, h2hSendQuestion]);

  function pick(choice: 'A' | 'B') {
    if (answered || !question || !roomCode) return;
    clearInterval(timerRef.current!);
    setAnswered(choice);
    const correct = choice === 'A' ? question.valueA >= question.valueB : question.valueB > question.valueA;
    h2hAnswer(roomCode, choice, correct);
  }

  function leaveRoom() {
    if (roomCode) h2hLeave(roomCode);
    setPhase('lobby');
    setRoomCode('');
    setPlayers([]);
    setRoundResult(null);
    setQuestion(null);
    setAnswered(null);
    setError('');
    setOpponentLeft(false);
  }

  const me = players.find(p => p.username === username);
  const opponent = players.find(p => p.username !== username);

  // ── LOBBY ─────────────────────────────────────────────────────────────────
  if (phase === 'lobby') return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col items-center justify-center px-5">
      <div className="max-w-sm w-full">
        <Link href="/" className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest mb-8 inline-block">← Hub</Link>
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] mb-2">Live Duel</p>
        <h1 className="text-4xl font-black mb-2">Head-to-Head</h1>
        <p className="text-white/40 text-sm mb-8">Same question, same time. First to go 3 of 5 wins.</p>

        <div className="flex gap-2 mb-6">
          {(['create', 'join'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              className="flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all"
              style={{
                background: mode === m ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${mode === m ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: mode === m ? '#facc15' : 'rgba(255,255,255,0.4)',
              }}>
              {m === 'create' ? 'Create Room' : 'Join Room'}
            </button>
          ))}
        </div>

        {mode === 'create' ? (
          <button onClick={createRoom}
            className="w-full py-4 rounded-xl bg-yellow-400 text-black font-black text-sm hover:bg-yellow-300 transition-colors active:scale-[0.98]">
            Create Room
          </button>
        ) : (
          <div className="space-y-3">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              placeholder="ROOM CODE"
              maxLength={4}
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-center text-2xl font-black font-mono tracking-[0.5em] placeholder:text-white/20 placeholder:tracking-widest outline-none focus:border-yellow-400/50"
            />
            <button onClick={joinRoom}
              className="w-full py-4 rounded-xl bg-yellow-400 text-black font-black text-sm hover:bg-yellow-300 transition-colors active:scale-[0.98]">
              Join
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-xs font-mono text-center mt-4">{error}</p>}
      </div>
    </div>
  );

  // ── WAITING ───────────────────────────────────────────────────────────────
  if (phase === 'waiting') return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col items-center justify-center px-5">
      <div className="max-w-sm w-full text-center">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] mb-8">Waiting for opponent</p>
        <div className="text-[5rem] font-black leading-none tracking-[0.15em] text-yellow-400 mb-6">{roomCode}</div>
        <p className="text-white/50 text-sm mb-10">Share this code with your opponent</p>
        <button onClick={() => { navigator.clipboard?.writeText(roomCode); }}
          className="px-6 py-2.5 rounded-lg border border-white/15 text-xs font-mono text-white/50 hover:text-white hover:border-white/30 transition-colors mb-8">
          Copy Code
        </button>
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-white/30 text-xs font-mono">Waiting...</span>
        </div>
        <button onClick={leaveRoom} className="text-xs font-mono text-white/25 hover:text-white/50 transition-colors">Cancel</button>
      </div>
    </div>
  );

  // ── READY ─────────────────────────────────────────────────────────────────
  if (phase === 'ready') return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col items-center justify-center px-5">
      <div className="max-w-sm w-full text-center">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] mb-8">Best of {totalRounds}</p>
        <div className="flex items-center justify-center gap-6 mb-10">
          {players.map((p, i) => (
            <div key={i} className="text-center">
              <div className="w-14 h-14 rounded-full border-2 border-yellow-400/30 bg-yellow-400/10 flex items-center justify-center mx-auto mb-2">
                <span className="text-xl font-black">{p.username[0]?.toUpperCase()}</span>
              </div>
              <p className="font-black text-sm">{p.username}</p>
              {p.username === username && <p className="text-[10px] text-yellow-400 font-mono">YOU</p>}
            </div>
          ))}
          {players.length === 2 && (
            <div className="absolute text-white/20 font-black text-lg">VS</div>
          )}
        </div>
        {isHost ? (
          <button onClick={sendNextQuestion}
            className="px-10 py-4 rounded-xl bg-yellow-400 text-black font-black text-sm hover:bg-yellow-300 transition-colors active:scale-[0.98]">
            Start Game →
          </button>
        ) : (
          <p className="text-white/40 text-sm font-mono">Waiting for host to start...</p>
        )}
      </div>
    </div>
  );

  // ── QUESTION ──────────────────────────────────────────────────────────────
  if (phase === 'question' && question) return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <div className="text-center">
            <p className="text-xs font-mono text-white/30">{me?.username ?? username}</p>
            <p className="text-2xl font-black" style={{ color: '#34d399' }}>{me?.wins ?? 0}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest">Round {round}/{totalRounds}</p>
            <p className="text-lg font-black" style={{ color: timer <= 5 ? '#f87171' : '#facc15' }}>{timer}s</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-mono text-white/30">{opponent?.username ?? '?'}</p>
            <p className="text-2xl font-black" style={{ color: '#f87171' }}>{opponent?.wins ?? 0}</p>
          </div>
        </div>
        {/* Score bar */}
        <div className="flex gap-1 mt-3 max-w-sm mx-auto">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full"
              style={{ background: i < round - 1 ? '#facc15' : i === round - 1 ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.08)' }} />
          ))}
        </div>
      </div>

      {/* Opponent status */}
      {opponentAnswered && !answered && (
        <div className="text-center pt-3">
          <p className="text-[10px] font-mono text-yellow-400/60 uppercase tracking-widest">
            ⚡ {opponent?.username} answered — hurry up
          </p>
        </div>
      )}

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-6">
        <div className="max-w-sm w-full">
          <div className="text-center mb-6">
            <p className="text-xs font-mono text-white/35 uppercase tracking-wider mb-1">{question.subLabel}</p>
            <p className="text-2xl font-black">{question.label}</p>
          </div>

          <div className="space-y-3">
            {(['A', 'B'] as const).map(side => {
              const player = side === 'A' ? question.playerA : question.playerB;
              const value  = side === 'A' ? question.valueA  : question.valueB;
              const isCorrectSide = side === 'A' ? question.valueA >= question.valueB : question.valueB > question.valueA;
              const isPicked = answered === side;

              let borderColor = 'rgba(255,255,255,0.1)';
              let bg = 'rgba(255,255,255,0.03)';
              if (answered) {
                if (isCorrectSide) { borderColor = '#34d399'; bg = 'rgba(52,211,153,0.08)'; }
                else if (isPicked) { borderColor = '#f87171'; bg = 'rgba(248,113,113,0.08)'; }
              }

              return (
                <button key={side}
                  onClick={() => pick(side)}
                  disabled={!!answered}
                  className="w-full rounded-2xl border p-5 text-left transition-all active:scale-[0.99] disabled:cursor-default"
                  style={{ borderColor, background: bg }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-base">{player.name}</p>
                      <p className="text-white/40 text-xs mt-0.5">{player.context}</p>
                    </div>
                    {answered ? (
                      <p className="text-2xl font-black tabular-nums" style={{ color: isCorrectSide ? '#34d399' : '#f87171' }}>
                        {formatValue(value, question.unit)}
                      </p>
                    ) : (
                      <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
                        <span className="text-xs font-black text-white/40">{side}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // ── ROUND RESULT ──────────────────────────────────────────────────────────
  if (phase === 'round_result' && roundResult) {
    const myResult   = roundResult.answers.find(a => a.username === username);
    const oppResult  = roundResult.answers.find(a => a.username !== username);
    const myCorrect  = myResult?.correct ?? false;
    const oppCorrect = oppResult?.correct ?? false;
    return (
      <div className="min-h-screen bg-[#08080d] text-white flex flex-col items-center justify-center px-5">
        <div className="max-w-sm w-full text-center">
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] mb-6">Round {round} Result</p>
          <div className="flex gap-4 mb-8">
            <div className="flex-1 rounded-xl border p-4"
              style={{ borderColor: myCorrect ? '#34d399' : '#f87171', background: myCorrect ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)' }}>
              <p className="text-xs font-mono text-white/40 mb-1">You</p>
              <p className="text-2xl font-black" style={{ color: myCorrect ? '#34d399' : '#f87171' }}>
                {myCorrect ? '✓' : '✗'}
              </p>
              <p className="text-xs text-white/50 mt-1 font-mono">{myResult?.wins ?? 0} wins</p>
            </div>
            <div className="flex-1 rounded-xl border p-4"
              style={{ borderColor: oppCorrect ? '#34d399' : '#f87171', background: oppCorrect ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)' }}>
              <p className="text-xs font-mono text-white/40 mb-1">{opponent?.username ?? 'Opponent'}</p>
              <p className="text-2xl font-black" style={{ color: oppCorrect ? '#34d399' : '#f87171' }}>
                {oppCorrect ? '✓' : '✗'}
              </p>
              <p className="text-xs text-white/50 mt-1 font-mono">{oppResult?.wins ?? 0} wins</p>
            </div>
          </div>
          {!roundResult.gameOver && isHost && (
            <button onClick={sendNextQuestion}
              className="px-10 py-3 rounded-xl bg-yellow-400 text-black font-black text-sm hover:bg-yellow-300 transition-colors">
              Next Round →
            </button>
          )}
          {!roundResult.gameOver && !isHost && (
            <p className="text-white/40 text-sm font-mono">Waiting for next round...</p>
          )}
        </div>
      </div>
    );
  }

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  if (phase === 'gameover') {
    const [p0, p1] = players;
    const myWins   = players.find(p => p.username === username)?.wins ?? 0;
    const oppWins  = players.find(p => p.username !== username)?.wins ?? 0;
    const iWon     = myWins > oppWins;
    const isDraw   = myWins === oppWins;
    return (
      <div className="min-h-screen bg-[#08080d] text-white flex flex-col items-center justify-center px-5">
        <div className="max-w-sm w-full text-center">
          {opponentLeft ? (
            <>
              <p className="text-5xl mb-4">👋</p>
              <p className="text-2xl font-black mb-2">Opponent Left</p>
              <p className="text-white/40 text-sm mb-8">They couldn&apos;t handle it.</p>
            </>
          ) : (
            <>
              <p className="text-5xl mb-4">{isDraw ? '🤝' : iWon ? '🏆' : '💀'}</p>
              <p className="text-3xl font-black mb-2" style={{ color: iWon ? '#34d399' : isDraw ? '#facc15' : '#f87171' }}>
                {isDraw ? 'Draw' : iWon ? 'You Won' : 'You Lost'}
              </p>
              <div className="flex items-center justify-center gap-8 my-8">
                <div className="text-center">
                  <p className="text-5xl font-black" style={{ color: '#34d399' }}>{p0?.wins ?? 0}</p>
                  <p className="text-xs text-white/40 font-mono mt-1">{p0?.username}</p>
                </div>
                <p className="text-white/20 font-black">–</p>
                <div className="text-center">
                  <p className="text-5xl font-black" style={{ color: '#f87171' }}>{p1?.wins ?? 0}</p>
                  <p className="text-xs text-white/40 font-mono mt-1">{p1?.username}</p>
                </div>
              </div>
            </>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={leaveRoom}
              className="px-6 py-3 rounded-xl bg-yellow-400 text-black font-black text-sm hover:bg-yellow-300 transition-colors">
              Rematch
            </button>
            <Link href="/"
              className="px-6 py-3 rounded-xl border border-white/15 text-white/50 text-sm font-mono hover:text-white hover:border-white/30 transition-colors">
              Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
