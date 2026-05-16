/**
 * AI Draft Challenge Generator
 *
 * Fetches real NBA stat data, picks 5 players on a given stat category,
 * and returns a ranking challenge (highest → lowest).
 *
 * Difficulty controls:
 *  - Easy:   top 10 players, large spread (obvious)
 *  - Medium: ranks 5–25, moderate spread
 *  - Hard:   ranks 10–40, tight spread
 *  - Niche:  old seasons, obscure stats, very tight spread
 */

import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const COMMON_STATS = [
  { col: 'PTS',  label: 'Points Per Game',       unit: 'PPG' },
  { col: 'AST',  label: 'Assists Per Game',       unit: 'APG' },
  { col: 'REB',  label: 'Rebounds Per Game',      unit: 'RPG' },
  { col: 'STL',  label: 'Steals Per Game',        unit: 'SPG' },
  { col: 'BLK',  label: 'Blocks Per Game',        unit: 'BPG' },
  { col: 'FG3M', label: 'Three-Pointers Made',    unit: '3PM' },
  { col: 'FTM',  label: 'Free Throws Made',       unit: 'FTM' },
  { col: 'OREB', label: 'Offensive Rebounds',     unit: 'OREB' },
  { col: 'DD2',  label: 'Double-Doubles',         unit: 'DD' },
  { col: 'MIN',  label: 'Minutes Per Game',       unit: 'MPG' },
];

const NICHE_STATS = [
  { col: 'PF',   label: 'Personal Fouls',         unit: 'PF' },
  { col: 'TOV',  label: 'Turnovers Per Game',     unit: 'TO' },
  { col: 'BLKA', label: 'Shots Blocked Against',  unit: 'BLKA' },
  { col: 'TD3',  label: 'Triple-Doubles',         unit: 'TD' },
  { col: 'FGA',  label: 'Field Goals Attempted',  unit: 'FGA' },
];

const SEASONS_MODERN = [
  '2024-25','2023-24','2022-23','2021-22','2020-21',
  '2019-20','2018-19','2017-18','2016-17','2015-16',
];
const SEASONS_NICHE = [
  '2011-12','2010-11','2009-10','2008-09','2007-08',
  '2006-07','2005-06','2003-04','2001-02','1999-00','1996-97',
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

interface NBARow { playerName: string; team: string; stat: number; }

async function fetchLeaders(col: string, season: string, baseUrl: string): Promise<NBARow[]> {
  const params = new URLSearchParams({
    endpoint: 'leagueLeaders',
    LeagueID: '00',
    PerMode: 'PerGame',
    Scope: 'S',
    Season: season,
    SeasonType: 'Regular Season',
    StatCategory: col,
  });
  const res = await fetch(`${baseUrl}/api/nba?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`NBA API ${res.status}`);
  const json = await res.json();
  const rs = json.resultSet ?? json.resultSets?.[0];
  if (!rs?.headers) throw new Error('Bad response shape');
  const h = rs.headers as string[];
  const rows = rs.rowSet as unknown[][];
  const nameI = h.indexOf('PLAYER');
  const teamI = h.indexOf('TEAM');
  const statI = h.indexOf(col);
  const gpI   = h.indexOf('GP');
  return rows
    .filter(r => Number(r[gpI]) >= 20)
    .map(r => ({ playerName: String(r[nameI]), team: String(r[teamI]), stat: Number(r[statI]) }))
    .filter(r => r.stat > 0);
}

export async function POST(req: NextRequest) {
  try {
    const { difficulty = 'Medium', count = 3 } = await req.json().catch(() => ({}));
    const host    = req.headers.get('host') ?? 'localhost:3000';
    const proto   = host.startsWith('localhost') ? 'http' : 'https';
    const baseUrl = `${proto}://${host}`;

    const isNiche = difficulty === 'Niche' || difficulty === 'niche';
    const statPool = isNiche ? [...NICHE_STATS, ...COMMON_STATS] : COMMON_STATS;
    const seasonPool = isNiche ? SEASONS_NICHE : SEASONS_MODERN;

    const challenges = [];

    for (let attempt = 0; attempt < count * 3 && challenges.length < count; attempt++) {
      try {
        const stat   = pick(statPool);
        const season = pick(seasonPool);
        const rows   = await fetchLeaders(stat.col, season, baseUrl);
        if (rows.length < 5) continue;

        // Difficulty controls which rank band to pull from
        let startRank: number;
        let spread: number;
        if (difficulty === 'Easy' || difficulty === 'easy') {
          startRank = 0; spread = 10;
        } else if (difficulty === 'Medium' || difficulty === 'medium') {
          startRank = Math.floor(Math.random() * 15) + 3; spread = 20;
        } else if (difficulty === 'Hard' || difficulty === 'hard') {
          startRank = Math.floor(Math.random() * 25) + 5; spread = 30;
        } else {
          startRank = Math.floor(Math.random() * 40) + 10; spread = 50;
        }

        const pool = rows.slice(startRank, startRank + spread);
        if (pool.length < 5) continue;

        // Pick 5 random players from pool, sort by stat desc (answer key)
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
        const sorted   = [...shuffled].sort((a, b) => b.stat - a.stat);

        // For easy/medium: ensure spread is wide enough; for hard/niche: tight
        const spread_val = sorted[0].stat - sorted[4].stat;
        if ((difficulty === 'Easy' || difficulty === 'easy') && spread_val < 3) continue;
        if ((difficulty === 'Hard' || difficulty === 'hard') && spread_val > 8) continue;

        const seasonLabel = season.replace('-', '–');
        challenges.push({
          id: `ai_draft_${stat.col}_${season}_${Date.now()}_${attempt}`,
          statLabel: stat.label,
          statUnit: stat.unit,
          season: `${seasonLabel} Regular Season`,
          instruction: 'Rank from highest to lowest',
          difficulty,
          flavor: `${seasonLabel} — rank these players by ${stat.label.toLowerCase()}.`,
          players: sorted.map(p => ({ name: p.playerName, value: p.stat, hint: p.team })),
        });
      } catch { continue; }
    }

    if (challenges.length === 0) return Response.json({ challenges: [] }, { status: 500 });
    return Response.json({ challenges });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
