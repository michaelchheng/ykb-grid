'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface VoteData {
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
}

export interface LeaderboardData {
  daily: LeaderboardEntry[];
  allTime: LeaderboardEntry[];
}

export interface SubmitScorePayload {
  username: string;
  score: number;
  correct: number;
  total: number;
  bestStreak: number;
  avgSpeedMs: number;
}

let socket: Socket | null = null;

export function useSocket() {
  const [onlineCount, setOnlineCount] = useState(0);
  const [voteData, setVoteData] = useState<Record<string, VoteData>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardData>({ daily: [], allTime: [] });

  useEffect(() => {
    if (!socket) {
      socket = io({ path: '/socket.io' });
    }

    socket.on('vote_update', (data: VoteData) => {
      setVoteData(prev => ({ ...prev, [data.questionId]: data }));
    });

    socket.on('online_count', (count: number) => setOnlineCount(count));

    socket.on('leaderboard_update', (data: LeaderboardData) => {
      setLeaderboard(data);
    });

    return () => {
      socket?.off('vote_update');
      socket?.off('online_count');
      socket?.off('leaderboard_update');
    };
  }, []);

  const getVotes = (questionId: string) => {
    socket?.emit('get_votes', questionId);
  };

  const submitVote = (questionId: string, picked: 'A' | 'B', correct: boolean, playerName: string) => {
    socket?.emit('submit_vote', { questionId, picked, correct, playerName });
  };

  const getLeaderboard = () => {
    socket?.emit('get_leaderboard');
  };

  const submitScore = (payload: SubmitScorePayload) => {
    socket?.emit('submit_score', payload);
  };

  // ── Head-to-Head ─────────────────────────────────────────────────────────
  const h2hCreate = (username: string) => socket?.emit('h2h_create', username);
  const h2hJoin   = (code: string, username: string) => socket?.emit('h2h_join', { code, username });
  const h2hSendQuestion = (code: string, question: unknown) => socket?.emit('h2h_send_question', { code, question });
  const h2hAnswer = (code: string, choice: 'A' | 'B', correct: boolean) => socket?.emit('h2h_answer', { code, choice, correct });
  const h2hLeave  = (code: string) => socket?.emit('h2h_leave', code);

  const h2hOn = (event: string, cb: (data: unknown) => void) => {
    socket?.on(event, cb);
    return () => { socket?.off(event, cb); };
  };

  return { onlineCount, voteData, leaderboard, getVotes, submitVote, getLeaderboard, submitScore,
    h2hCreate, h2hJoin, h2hSendQuestion, h2hAnswer, h2hLeave, h2hOn };
}
