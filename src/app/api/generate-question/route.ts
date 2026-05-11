import { NextRequest } from 'next/server';

/**
 * Context-engineered question generation:
 * 1. Pick random stat categories + seasons
 * 2. Fetch REAL player data from NBA Stats API (via /api/nba proxy)
 * 3. Pick player pairs based on difficulty (wide gap = easy, near-identical = niche)
 * 4. Send real numbers to GPT — it writes flavor text ONLY, never invents stats
 *
 * Result: infinite, accurate, diverse questions seeded from actual NBA history.
 */

// ── Team colors ────────────────────────────────────────────────────────────────
const TEAM_COLORS: Record<string, string> = {
  ATL: '#E03A3E', BOS: '#007A33', BKN: '#000000', CHA: '#1D1160',
  CHI: '#CE1141', CLE: '#860038', DAL: '#00538C', DEN: '#0E2240',
  DET: '#C8102E', GSW: '#1D428A', HOU: '#CE1141', IND: '#002D62',
  LAC: '#C8102E', LAL: '#552583', MEM: '#5D76A9', MIA: '#98002E',
  MIL: '#00471B', MIN: '#0C2340', NOP: '#0C2340', NYK: '#F58426',
  OKC: '#007AC1', ORL: '#0077C0', PHI: '#006BB6', PHX: '#E56020',
  POR: '#E03A3E', SAC: '#5A2D81', SAS: '#C4CED4', TOR: '#CE1141',
  UTA: '#002B5C', WAS: '#002B5C',
  NJN: '#777D84', NOH: '#0C2340', SEA: '#00653A', VAN: '#005083',
};

function teamColor(abbr: string): string {
  return TEAM_COLORS[abbr] ?? '#4a5568';
}

// ── Seasons pool ───────────────────────────────────────────────────────────────
const SEASONS = [
  '2024-25', '2023-24', '2022-23', '2021-22', '2020-21',
  '2019-20', '2018-19', '2017-18', '2016-17', '2015-16',
  '2014-15', '2013-14', '2012-13', '2011-12', '2010-11',
  '2009-10', '2008-09', '2007-08', '2006-07', '2005-06',
  '2004-05', '2003-04', '2002-03',
];

function randomSeason(): string {
  return SEASONS[Math.floor(Math.random() * SEASONS.length)];
}

// ── Stat strategies ────────────────────────────────────────────────────────────
interface StatStrategy {
  statCategory: string;
  colName: string;
  label: string;
  unit: string;
  category: string;
  minGames?: number;
}

const STAT_STRATEGIES: StatStrategy[] = [
  { statCategory: 'PTS',  colName: 'PTS',  label: 'Season Points',         unit: 'points',           category: 'points',             minGames: 30 },
  { statCategory: 'AST',  colName: 'AST',  label: 'Season Assists',         unit: 'assists',          category: 'assists',            minGames: 30 },
  { statCategory: 'REB',  colName: 'REB',  label: 'Season Rebounds',        unit: 'rebounds',         category: 'offensive_rebounds', minGames: 30 },
  { statCategory: 'STL',  colName: 'STL',  label: 'Season Steals',          unit: 'steals',           category: 'steals',             minGames: 30 },
  { statCategory: 'BLK',  colName: 'BLK',  label: 'Season Blocks',          unit: 'blocks',           category: 'blocks',             minGames: 30 },
  { statCategory: 'FG3M', colName: 'FG3M', label: 'Three-Pointers Made',    unit: 'threes made',      category: 'three_point_pct',    minGames: 30 },
  { statCategory: 'TOV',  colName: 'TOV',  label: 'Season Turnovers',       unit: 'turnovers',        category: 'turnovers',          minGames: 30 },
  { statCategory: 'PF',   colName: 'PF',   label: 'Personal Fouls',         unit: 'personal fouls',   category: 'personal_fouls',     minGames: 30 },
  { statCategory: 'FTA',  colName: 'FTA',  label: 'Free Throws Attempted',  unit: 'FTA',              category: 'missed_free_throws', minGames: 30 },
  { statCategory: 'FTM',  colName: 'FTM',  label: 'Free Throws Made',       unit: 'FTM',              category: 'ft_pct',             minGames: 30 },
  { statCategory: 'OREB', colName: 'OREB', label: 'Offensive Rebounds',     unit: 'offensive boards', category: 'offensive_rebounds', minGames: 30 },
  { statCategory: 'DREB', colName: 'DREB', label: 'Defensive Rebounds',     unit: 'defensive boards', category: 'offensive_rebounds', minGames: 30 },
  { statCategory: 'MIN',  colName: 'MIN',  label: 'Minutes Played',         unit: 'minutes',          category: 'games_played',       minGames: 30 },
  { statCategory: 'FGM',  colName: 'FGM',  label: 'Field Goals Made',       unit: 'FGM',              category: 'points',             minGames: 30 },
  { statCategory: 'FGA',  colName: 'FGA',  label: 'Field Goals Attempted',  unit: 'FGA',              category: 'points',             minGames: 30 },
  { statCategory: 'EFF',  colName: 'EFF',  label: 'Efficiency Rating',      unit: 'efficiency',       category: 'points',             minGames: 30 },
  { statCategory: 'GP',   colName: 'GP',   label: 'Games Played',           unit: 'games',            category: 'games_played',       minGames: 60 },
];

// ── NBA data type ──────────────────────────────────────────────────────────────
interface NBALeaderRow {
  rank: number;
  playerId: string;
  playerName: string;
  team: string;
  gp: number;
  stat: number;
}

// ── Caches ─────────────────────────────────────────────────────────────────────
const nbaCache = new Map<string, { data: NBALeaderRow[]; ts: number }>();
const qCache   = new Map<string, object[]>();
const NBA_TTL  = 2 * 60 * 60 * 1000; // 2 hours

// ── NBA fetch ──────────────────────────────────────────────────────────────────
async function fetchLeaders(
  strategy: StatStrategy,
  season: string,
  baseUrl: string,
): Promise<NBALeaderRow[]> {
  const key = `${strategy.statCategory}_${season}`;
  const hit = nbaCache.get(key);
  if (hit && Date.now() - hit.ts < NBA_TTL) return hit.data;

  const params = new URLSearchParams({
    endpoint: 'leagueLeaders',
    LeagueID: '00',
    PerMode: 'Totals',
    Scope: 'S',
    Season: season,
    SeasonType: 'Regular Season',
    StatCategory: strategy.statCategory,
  });

  const res = await fetch(`${baseUrl}/api/nba?${params}`, {
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`NBA API ${res.status}`);

  const json = await res.json();
  const rs = json.resultSet ?? json.resultSets?.[0];
  if (!rs?.headers) throw new Error('Unexpected NBA response shape');

  const h = rs.headers as string[];
  const rows = rs.rowSet as unknown[][];
  const idx = (n: string) => h.indexOf(n);
  const rankI = idx('RANK'), nameI = idx('PLAYER'), teamI = idx('TEAM');
  const idI   = idx('PLAYER_ID'), gpI = idx('GP'), statI = idx(strategy.colName);

  const minGp = strategy.minGames ?? 20;
  const leaders: NBALeaderRow[] = rows
    .map(row => ({
      rank:       Number(row[rankI]),
      playerId:   String(row[idI]),
      playerName: String(row[nameI]),
      team:       String(row[teamI]),
      gp:         Number(row[gpI]),
      stat:       Number(row[statI] ?? 0),
    }))
    .filter(r => r.stat > 0 && r.gp >= minGp);

  nbaCache.set(key, { data: leaders, ts: Date.now() });
  return leaders;
}

// ── Pair picker ────────────────────────────────────────────────────────────────
function pickPair(
  leaders: NBALeaderRow[],
  difficulty: string,
): [NBALeaderRow, NBALeaderRow] | null {
  if (leaders.length < 15) return null;
  const r = Math.random;
  let idxA: number, idxB: number;

  switch (difficulty) {
    case 'easy':
      idxA = Math.floor(r() * 3);
      idxB = 15 + Math.floor(r() * 20);
      break;
    case 'medium':
      idxA = 2 + Math.floor(r() * 6);
      idxB = 10 + Math.floor(r() * 15);
      break;
    case 'hard':
      idxA = Math.floor(r() * 10);
      idxB = idxA + 1 + Math.floor(r() * 4);
      break;
    case 'niche':
      idxA = 1 + Math.floor(r() * 18);
      idxB = idxA + 1;
      break;
    default:
      idxA = 0; idxB = 5;
  }

  if (idxB >= leaders.length) return null;
  const a = leaders[idxA];
  const b = leaders[idxB];
  if (a.stat === b.stat) return null;
  return r() > 0.5 ? [a, b] : [b, a];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function seasonEra(season: string): 'classic' | 'modern' {
  return parseInt(season.split('-')[0]) < 2010 ? 'classic' : 'modern';
}

function makeId(a: NBALeaderRow, b: NBALeaderRow, stat: string, season: string, salt: number): string {
  const s = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
  return `nba_${s(a.playerName)}_${s(b.playerName)}_${stat.toLowerCase()}_${season.replace('-', '_')}_${salt}`;
}

// ── Prompts ────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You write flavor text for "Who Had More?" — a basketball trivia game where users guess which NBA player had more of a given stat.

Your ONLY job: write a 1-2 sentence "flavor" field for each matchup. Rules:
- Name both players and mention their exact stat values
- Add genuine basketball context (was this a career year? a tight race? historically significant?)
- Write in a knowledgeable fan's voice — opinionated, vivid, not bland
- Never change any stat numbers I provide`;

interface MatchupData {
  strategy: StatStrategy;
  season: string;
  playerA: NBALeaderRow;
  playerB: NBALeaderRow;
}

// ── Main POST handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { difficulty = 'medium', count = 5 } = await req.json().catch(() => ({}));

  // Serve from cache
  const cacheKey = difficulty;
  const cached = qCache.get(cacheKey) ?? [];
  if (cached.length >= count) {
    const batch = cached.splice(0, count);
    qCache.set(cacheKey, cached);
    return Response.json({ questions: batch, source: 'cache' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith('your-')) {
    return Response.json({ questions: [], error: 'No OpenAI key' }, { status: 200 });
  }

  const host = req.headers.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const baseUrl = `${proto}://${host}`;

  // Pick `count` unique random strategies
  const strategies = [...STAT_STRATEGIES]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);

  // Fetch NBA data in parallel — each gets a random season
  const fetchResults = await Promise.allSettled(
    strategies.map(async (strategy) => {
      const season = randomSeason();
      const leaders = await fetchLeaders(strategy, season, baseUrl);
      const pair = pickPair(leaders, difficulty);
      if (!pair) return null;
      return { strategy, season, playerA: pair[0], playerB: pair[1] } as MatchupData;
    })
  );

  const matchups: MatchupData[] = fetchResults
    .filter((r): r is PromiseFulfilledResult<MatchupData | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((v): v is MatchupData => v !== null);

  if (matchups.length === 0) {
    console.error('NBA API returned no usable matchups');
    return Response.json({ questions: [], error: 'No NBA data available' }, { status: 200 });
  }

  // Build real-data context for GPT — numbers come from API, GPT writes flavor only
  const dataContext = matchups
    .map((m, i) =>
      `MATCHUP ${i + 1}: ${m.strategy.label} — ${m.season} regular season\n` +
      `  Player A: ${m.playerA.playerName} (${m.playerA.team}, ${m.playerA.gp} GP) — ${m.playerA.stat} ${m.strategy.unit}\n` +
      `  Player B: ${m.playerB.playerName} (${m.playerB.team}, ${m.playerB.gp} GP) — ${m.playerB.stat} ${m.strategy.unit}`
    )
    .join('\n\n');

  const metaContext = matchups
    .map((m, i) =>
      `Matchup ${i + 1}: category="${m.strategy.category}" label="${m.strategy.label}" unit="${m.strategy.unit}" era="${seasonEra(m.season)}"`
    )
    .join('\n');

  const userPrompt = `Here are ${matchups.length} real NBA stat matchups from the official NBA stats API.
Use EXACTLY the stat values shown — never change them.

${dataContext}

Return a JSON array of ${matchups.length} objects (same order as above). Each object:
{
  "id": "<unique snake_case: player names + stat + season>",
  "era": "<classic|modern>",
  "category": "<from metadata>",
  "label": "<from metadata>",
  "subLabel": "<e.g. '2023-24 regular season'>",
  "flavor": "<YOUR JOB — 1-2 sentences, name both players, cite exact numbers, add context>",
  "playerA": { "id": "<snake_case name>", "name": "<full name>", "label": "<TEAM ABBR + season e.g. LAL 2023-24>", "color": "<hex team color>" },
  "playerB": { "id": "<snake_case name>", "name": "<full name>", "label": "<TEAM ABBR + season>",                 "color": "<hex team color>" },
  "valueA": <exact number from data>,
  "valueB": <exact number from data>,
  "unit": "<from metadata>",
  "difficulty": "${difficulty}"
}

Per-matchup metadata:
${metaContext}

Return ONLY the raw JSON array — no markdown fences, no explanation.`;

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.85,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!aiRes.ok) throw new Error(`OpenAI ${aiRes.status}`);
    const aiData = await aiRes.json();
    const raw = (aiData.choices?.[0]?.message?.content ?? '[]')
      .trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '');

    const parsed: Record<string, unknown>[] = JSON.parse(raw);

    // Enforce real API values — GPT cannot drift numbers
    const now = Date.now();
    const hardened = parsed.map((q, i) => {
      const m = matchups[i];
      if (!m) return q;
      return {
        ...q,
        id: makeId(m.playerA, m.playerB, m.strategy.statCategory, m.season, now + i),
        valueA: m.playerA.stat,  // ← always from NBA API
        valueB: m.playerB.stat,  // ← always from NBA API
        _source: 'nba_api',
      };
    });

    const existing = qCache.get(cacheKey) ?? [];
    qCache.set(cacheKey, [...existing, ...hardened]);

    return Response.json({ questions: hardened, source: 'nba_api+gpt', matchupsUsed: matchups.length });
  } catch (e) {
    console.error('Question generation failed:', e);
    return Response.json({ questions: [], error: String(e) }, { status: 200 });
  }
}

// ── Cache inspector (GET /api/generate-question) ───────────────────────────────
export async function GET() {
  return Response.json({
    questionCache: Object.fromEntries([...qCache.entries()].map(([k, v]) => [k, v.length])),
    nbaCache: Object.fromEntries([...nbaCache.entries()].map(([k, v]) => [
      k,
      { count: v.data.length, ageMin: Math.round((Date.now() - v.ts) / 60000) },
    ])),
  });
}
