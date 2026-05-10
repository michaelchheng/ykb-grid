import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// ─── Types ───────────────────────────────────────────────────────────────────
interface VoteData {
  questionId: string;
  votesA: number;
  votesB: number;
  totalVotes: number;
  recentPicks: Array<{ name: string; picked: 'A' | 'B'; correct: boolean; ts: number }>;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  correct: number;
  total: number;
  bestStreak: number;
  avgSpeedMs: number;
  date: string;
  submittedAt: number;
}

// ─── H2H Types ────────────────────────────────────────────────────────────────
interface H2HPlayer {
  socketId: string;
  username: string;
  wins: number;
  answered: boolean;
  choice: 'A' | 'B' | null;
  correct: boolean | null;
}

interface H2HRoom {
  code: string;
  hostSocketId: string;
  players: H2HPlayer[];
  round: number;
  totalRounds: number;
  ended: boolean;
  createdAt: number;
}

const h2hRooms: Record<string, H2HRoom> = {};

function makeRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function cleanStaleRooms() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const code of Object.keys(h2hRooms)) {
    if (h2hRooms[code].createdAt < cutoff) delete h2hRooms[code];
  }
}

// ─── Vote store ───────────────────────────────────────────────────────────────
const votes: Record<string, VoteData> = {};

function getVotes(qid: string): VoteData {
  if (!votes[qid]) votes[qid] = { questionId: qid, votesA: 0, votesB: 0, totalVotes: 0, recentPicks: [] };
  return votes[qid];
}

function seedVotes(qid: string) {
  const v = getVotes(qid);
  if (v.totalVotes === 0) {
    v.votesA = Math.floor(Math.random() * 900) + 150;
    v.votesB = Math.floor(Math.random() * 900) + 150;
    v.totalVotes = v.votesA + v.votesB;
  }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
const LEADERBOARD_FILE = path.join(process.cwd(), 'leaderboard.json');
let leaderboard: LeaderboardEntry[] = [];

function loadLeaderboard() {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      leaderboard = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf-8'));
    }
  } catch { leaderboard = []; }
}

function saveLeaderboard() {
  try { fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2)); }
  catch (e) { console.error('Leaderboard save failed:', e); }
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function getDailyBoard(): LeaderboardEntry[] {
  const today = todayStr();
  // Deduplicate: keep best score per user for today
  const best: Record<string, LeaderboardEntry> = {};
  for (const e of leaderboard) {
    if (e.date !== today) continue;
    if (!best[e.username] || e.score > best[e.username].score) best[e.username] = e;
  }
  return Object.values(best).sort((a, b) => b.score - a.score).slice(0, 100);
}

function getAllTimeBoard(): LeaderboardEntry[] {
  const best: Record<string, LeaderboardEntry> = {};
  for (const e of leaderboard) {
    if (!best[e.username] || e.score > best[e.username].score) best[e.username] = e;
  }
  return Object.values(best).sort((a, b) => b.score - a.score).slice(0, 100);
}

function addEntry(entry: LeaderboardEntry) {
  leaderboard.push(entry);
  if (leaderboard.length > 20000) leaderboard = leaderboard.slice(-20000);
  saveLeaderboard();
}

// ─── Anon names ───────────────────────────────────────────────────────────────
const ANON = [
  'HoopHead99','BrickLayer','StatNerd','CourtVision','GlassEater',
  'PaintProtector','CheeseTouch','RimGrazer','TripleThreat','BackboardBob',
  'FloppyDisk','ChalkboardChris','IsoKing','MidRangeRay','ClutchGene',
  'WojBomber','ShamsAlert','PickAndRoll','DeepThree','AnkleBreakerr',
  'PostFadeaway','SixthManVibes','BenchWarmerBob','LooperLarry','HesGotGame',
  'BoomGoesTheDunker','NailInTheCoffin','GarbageTimeGuru','TrashTimeKing','BrickCity',
];

// ─── Seed leaderboard with fake players so it looks alive ────────────────────
function seedLeaderboardIfEmpty() {
  const today = todayStr();
  const hasToday = leaderboard.some(e => e.date === today);
  if (hasToday) return;
  const fakeUsers = [
    { username: 'HoopHead99', score: 8750, correct: 9, total: 10, bestStreak: 7, avgSpeedMs: 4200 },
    { username: 'StatNerd', score: 7200, correct: 8, total: 10, bestStreak: 5, avgSpeedMs: 3800 },
    { username: 'CourtVision', score: 6500, correct: 8, total: 10, bestStreak: 4, avgSpeedMs: 6100 },
    { username: 'BrickLayer', score: 5800, correct: 7, total: 10, bestStreak: 4, avgSpeedMs: 5500 },
    { username: 'WojBomber', score: 4900, correct: 7, total: 10, bestStreak: 3, avgSpeedMs: 7200 },
    { username: 'ClutchGene', score: 4200, correct: 6, total: 10, bestStreak: 3, avgSpeedMs: 8900 },
    { username: 'PickAndRoll', score: 3600, correct: 6, total: 10, bestStreak: 2, avgSpeedMs: 9400 },
    { username: 'IsoKing', score: 2800, correct: 5, total: 10, bestStreak: 2, avgSpeedMs: 11000 },
    { username: 'MidRangeRay', score: 2100, correct: 5, total: 10, bestStreak: 1, avgSpeedMs: 13000 },
    { username: 'GlassEater', score: 1500, correct: 4, total: 10, bestStreak: 1, avgSpeedMs: 15000 },
  ];
  for (const u of fakeUsers) {
    leaderboard.push({ ...u, date: today, submittedAt: Date.now() - Math.floor(Math.random() * 3600000) });
  }
  saveLeaderboard();
}

// ─── Server ───────────────────────────────────────────────────────────────────
loadLeaderboard();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: '*' },
    path: '/socket.io',
  });

  // Seed fake leaderboard data once server starts
  seedLeaderboardIfEmpty();

  io.on('connection', (socket) => {
    // Announce online count
    io.emit('online_count', io.engine.clientsCount);

    // ── Votes ──────────────────────────────────────────────────────────────
    socket.on('get_votes', (qid: string) => {
      seedVotes(qid);
      socket.emit('vote_update', getVotes(qid));
    });

    socket.on('submit_vote', (data: {
      questionId: string; picked: 'A' | 'B'; correct: boolean; playerName: string;
    }) => {
      seedVotes(data.questionId);
      const v = getVotes(data.questionId);
      if (data.picked === 'A') v.votesA++; else v.votesB++;
      v.totalVotes++;
      const displayName = data.playerName?.trim() || ANON[Math.floor(Math.random() * ANON.length)];
      v.recentPicks.unshift({ name: displayName, picked: data.picked, correct: data.correct, ts: Date.now() });
      if (v.recentPicks.length > 20) v.recentPicks.pop();
      io.emit('vote_update', v);
    });

    // ── Head-to-Head ──────────────────────────────────────────────────────
    socket.on('h2h_create', (username: string) => {
      cleanStaleRooms();
      let code = makeRoomCode();
      while (h2hRooms[code]) code = makeRoomCode();
      h2hRooms[code] = {
        code,
        hostSocketId: socket.id,
        players: [{ socketId: socket.id, username, wins: 0, answered: false, choice: null, correct: null }],
        round: 0,
        totalRounds: 5,
        ended: false,
        createdAt: Date.now(),
      };
      socket.join(`h2h_${code}`);
      socket.emit('h2h_created', { roomCode: code });
    });

    socket.on('h2h_join', ({ code, username }: { code: string; username: string }) => {
      const room = h2hRooms[code];
      if (!room) { socket.emit('h2h_error', 'Room not found. Check the code.'); return; }
      if (room.ended) { socket.emit('h2h_error', 'Game has already ended.'); return; }
      if (room.players.length >= 2) { socket.emit('h2h_error', 'Room is full.'); return; }
      room.players.push({ socketId: socket.id, username, wins: 0, answered: false, choice: null, correct: null });
      socket.join(`h2h_${code}`);
      io.to(`h2h_${code}`).emit('h2h_ready', {
        players: room.players.map(p => ({ username: p.username, wins: p.wins })),
        hostSocketId: room.hostSocketId,
        mySocketId: socket.id,
        round: room.round,
        totalRounds: room.totalRounds,
      });
    });

    socket.on('h2h_send_question', ({ code, question }: { code: string; question: unknown }) => {
      const room = h2hRooms[code];
      if (!room || room.hostSocketId !== socket.id) return;
      room.round++;
      room.players.forEach(p => { p.answered = false; p.choice = null; p.correct = null; });
      io.to(`h2h_${code}`).emit('h2h_question', {
        round: room.round,
        totalRounds: room.totalRounds,
        question,
      });
    });

    socket.on('h2h_answer', ({ code, choice, correct }: { code: string; choice: 'A' | 'B'; correct: boolean }) => {
      const room = h2hRooms[code];
      if (!room || room.ended) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.answered) return;
      player.answered = true;
      player.choice = choice;
      player.correct = correct;
      if (correct) player.wins++;
      const allAnswered = room.players.every(p => p.answered);
      if (allAnswered) {
        const gameOver = room.round >= room.totalRounds;
        let winner: string | null = null;
        if (gameOver) {
          const [p0, p1] = room.players;
          if (p0.wins > (p1?.wins ?? -1)) winner = p0.username;
          else if (p1 && p1.wins > p0.wins) winner = p1.username;
          else winner = 'draw';
          room.ended = true;
        }
        io.to(`h2h_${code}`).emit('h2h_round_result', {
          answers: room.players.map(p => ({ socketId: p.socketId, username: p.username, choice: p.choice, correct: p.correct, wins: p.wins })),
          gameOver,
          winner,
        });
      } else {
        socket.to(`h2h_${code}`).emit('h2h_opponent_answered');
      }
    });

    socket.on('h2h_leave', (code: string) => {
      socket.to(`h2h_${code}`).emit('h2h_opponent_left');
      socket.leave(`h2h_${code}`);
      delete h2hRooms[code];
    });

    // ── Leaderboard ────────────────────────────────────────────────────────
    socket.on('get_leaderboard', () => {
      socket.emit('leaderboard_update', {
        daily: getDailyBoard(),
        allTime: getAllTimeBoard(),
      });
    });

    socket.on('submit_score', (data: {
      username: string; score: number; correct: number;
      total: number; bestStreak: number; avgSpeedMs: number;
    }) => {
      if (!data.username?.trim()) return;
      const entry: LeaderboardEntry = {
        username: data.username.trim().slice(0, 24),
        score: Math.max(0, data.score),
        correct: data.correct,
        total: data.total,
        bestStreak: data.bestStreak,
        avgSpeedMs: data.avgSpeedMs,
        date: todayStr(),
        submittedAt: Date.now(),
      };
      addEntry(entry);
      // Broadcast updated leaderboard to everyone
      io.emit('leaderboard_update', {
        daily: getDailyBoard(),
        allTime: getAllTimeBoard(),
      });
    });

    socket.on('disconnect', () => {
      // Clean up H2H rooms if player leaves mid-game
      for (const code of Object.keys(h2hRooms)) {
        const room = h2hRooms[code];
        const inRoom = room.players.some(p => p.socketId === socket.id);
        if (inRoom) {
          socket.to(`h2h_${code}`).emit('h2h_opponent_left');
          delete h2hRooms[code];
          break;
        }
      }
      io.emit('online_count', io.engine.clientsCount);
    });
  });

  const PORT = parseInt(process.env.PORT || '3000', 10);
  httpServer.listen(PORT, () => {
    console.log(`\n🏀 YKB Grid running at http://localhost:${PORT}\n`);
  });
});
