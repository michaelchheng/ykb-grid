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
const SEASONS_COMMON = [
  '2024-25', '2023-24', '2022-23', '2021-22', '2020-21',
  '2019-20', '2018-19', '2017-18', '2016-17', '2015-16',
  '2014-15', '2013-14', '2012-13',
];

// Niche uses older/random seasons to pull obscure players
const SEASONS_NICHE = [
  '2011-12', '2010-11', '2009-10', '2008-09', '2007-08',
  '2006-07', '2005-06', '2004-05', '2003-04', '2002-03',
  '2001-02', '2000-01', '1999-00', '1998-99', '1997-98',
  '1996-97', '1995-96', '1994-95',
];

function randomSeason(difficulty: string): string {
  if (difficulty === 'niche') {
    // 60% chance of an old/obscure season, 40% chance modern but deep bench
    return Math.random() < 0.6
      ? SEASONS_NICHE[Math.floor(Math.random() * SEASONS_NICHE.length)]
      : SEASONS_COMMON[Math.floor(Math.random() * SEASONS_COMMON.length)];
  }
  return SEASONS_COMMON[Math.floor(Math.random() * SEASONS_COMMON.length)];
}

// ── Stat strategies ────────────────────────────────────────────────────────────
interface StatStrategy {
  statCategory: string;
  colName: string;
  label: string;
  unit: string;
  category: string;
  minGames?: number;
  nicheOnly?: boolean; // only used for niche tier
}

// Common stats — used for easy/medium/hard
const COMMON_STRATEGIES: StatStrategy[] = [
  { statCategory: 'PTS',  colName: 'PTS',  label: 'Season Points',         unit: 'points',           category: 'points',             minGames: 40 },
  { statCategory: 'AST',  colName: 'AST',  label: 'Season Assists',         unit: 'assists',          category: 'assists',            minGames: 40 },
  { statCategory: 'REB',  colName: 'REB',  label: 'Season Rebounds',        unit: 'rebounds',         category: 'offensive_rebounds', minGames: 40 },
  { statCategory: 'STL',  colName: 'STL',  label: 'Season Steals',          unit: 'steals',           category: 'steals',             minGames: 40 },
  { statCategory: 'BLK',  colName: 'BLK',  label: 'Season Blocks',          unit: 'blocks',           category: 'blocks',             minGames: 40 },
  { statCategory: 'FG3M', colName: 'FG3M', label: 'Three-Pointers Made',    unit: 'threes',           category: 'three_point_pct',    minGames: 40 },
  { statCategory: 'TOV',  colName: 'TOV',  label: 'Season Turnovers',       unit: 'turnovers',        category: 'turnovers',          minGames: 40 },
  { statCategory: 'FTM',  colName: 'FTM',  label: 'Free Throws Made',       unit: 'FTM',              category: 'ft_pct',             minGames: 40 },
  { statCategory: 'OREB', colName: 'OREB', label: 'Offensive Rebounds',     unit: 'offensive boards', category: 'offensive_rebounds', minGames: 40 },
  { statCategory: 'DREB', colName: 'DREB', label: 'Defensive Rebounds',     unit: 'defensive boards', category: 'offensive_rebounds', minGames: 40 },
  { statCategory: 'FGA',  colName: 'FGA',  label: 'Field Goals Attempted',  unit: 'FGA',              category: 'points',             minGames: 40 },
  { statCategory: 'MIN',  colName: 'MIN',  label: 'Minutes Played',         unit: 'minutes',          category: 'games_played',       minGames: 40 },
  { statCategory: 'EFF',  colName: 'EFF',  label: 'Efficiency Rating',      unit: 'efficiency',       category: 'points',             minGames: 40 },
  { statCategory: 'GP',   colName: 'GP',   label: 'Games Played',           unit: 'games',            category: 'games_played',       minGames: 60 },
];

// Easy-only stats — only well-known stats where top players are recognizable stars
const EASY_STRATEGIES: StatStrategy[] = [
  { statCategory: 'PTS',  colName: 'PTS',  label: 'Points Per Game',        unit: 'points',           category: 'points',             minGames: 50 },
  { statCategory: 'AST',  colName: 'AST',  label: 'Assists',                unit: 'assists',          category: 'assists',            minGames: 50 },
  { statCategory: 'REB',  colName: 'REB',  label: 'Rebounds',               unit: 'rebounds',         category: 'offensive_rebounds', minGames: 50 },
  { statCategory: 'FG3M', colName: 'FG3M', label: 'Three-Pointers Made',    unit: 'threes',           category: 'three_point_pct',    minGames: 50 },
];

// Niche-only obscure stats — used only for niche tier to ensure weird/hard questions
const NICHE_STRATEGIES: StatStrategy[] = [
  { statCategory: 'PF',    colName: 'PF',    label: 'Personal Fouls',             unit: 'fouls',            category: 'personal_fouls',     minGames: 30, nicheOnly: true },
  { statCategory: 'FTA',   colName: 'FTA',   label: 'Free Throws Attempted',      unit: 'FTA',              category: 'missed_free_throws', minGames: 30, nicheOnly: true },
  { statCategory: 'FGM',   colName: 'FGM',   label: 'Field Goals Made',           unit: 'FGM',              category: 'points',             minGames: 30, nicheOnly: true },
  { statCategory: 'TOV',   colName: 'TOV',   label: 'Turnovers',                  unit: 'turnovers',        category: 'turnovers',          minGames: 30, nicheOnly: true },
  { statCategory: 'BLKA',  colName: 'BLKA',  label: 'Shots Blocked (Against)',    unit: 'shots blocked',    category: 'blocks',             minGames: 30, nicheOnly: true },
  { statCategory: 'DD2',   colName: 'DD2',   label: 'Double-Doubles',             unit: 'double-doubles',   category: 'triple_doubles',     minGames: 20, nicheOnly: true },
  { statCategory: 'TD3',   colName: 'TD3',   label: 'Triple-Doubles',             unit: 'triple-doubles',   category: 'triple_doubles',     minGames: 20, nicheOnly: true },
  { statCategory: 'PTS',   colName: 'PTS',   label: 'Season Points',              unit: 'points',           category: 'points',             minGames: 20, nicheOnly: true },
  { statCategory: 'AST',   colName: 'AST',   label: 'Season Assists',             unit: 'assists',          category: 'assists',            minGames: 20, nicheOnly: true },
  { statCategory: 'REB',   colName: 'REB',   label: 'Season Rebounds',            unit: 'rebounds',         category: 'offensive_rebounds', minGames: 20, nicheOnly: true },
  { statCategory: 'STL',   colName: 'STL',   label: 'Season Steals',              unit: 'steals',           category: 'steals',             minGames: 20, nicheOnly: true },
  { statCategory: 'BLK',   colName: 'BLK',   label: 'Season Blocks',              unit: 'blocks',           category: 'blocks',             minGames: 20, nicheOnly: true },
  { statCategory: 'FG3M',  colName: 'FG3M',  label: 'Three-Pointers Made',        unit: 'threes',           category: 'three_point_pct',    minGames: 20, nicheOnly: true },
  { statCategory: 'OREB',  colName: 'OREB',  label: 'Offensive Boards',           unit: 'offensive boards', category: 'offensive_rebounds', minGames: 20, nicheOnly: true },
  { statCategory: 'MIN',   colName: 'MIN',   label: 'Minutes Played',             unit: 'minutes',          category: 'games_played',       minGames: 20, nicheOnly: true },
];

const STAT_STRATEGIES = [...COMMON_STRATEGIES, ...NICHE_STRATEGIES];

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

// ── Semantic similarity (for niche tier) ──────────────────────────────────────
// Build a stat vector per player from the leaderboard and find the pair
// whose vectors are most similar — these are the genuinely confusable players.
function cosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

function pickSemanticNichePair(leaders: NBALeaderRow[]): [NBALeaderRow, NBALeaderRow] | null {
  // Niche zone: ranks 15-80 to avoid obvious stars but use real obscure players
  const pool = leaders.slice(15, Math.min(80, leaders.length));
  if (pool.length < 4) return null;

  // Shuffle and find a pair with close stat values (ratio 0.70–0.97) — genuinely hard
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < Math.min(i + 20, shuffled.length); j++) {
      const a = shuffled[i], b = shuffled[j];
      if (a.stat === b.stat) continue;
      const ratio = Math.min(a.stat, b.stat) / Math.max(a.stat, b.stat);
      if (ratio >= 0.70 && ratio <= 0.97) {
        return Math.random() > 0.5 ? [a, b] : [b, a];
      }
    }
  }
  // Fallback: any two non-identical players from the obscure zone
  const a = shuffled[0], b = shuffled[1];
  return a && b && a.stat !== b.stat ? [a, b] : null;
}

// ── Pair picker ────────────────────────────────────────────────────────────────
function pickPair(
  leaders: NBALeaderRow[],
  difficulty: string,
): [NBALeaderRow, NBALeaderRow] | null {
  if (leaders.length < 10) return null;
  const r = Math.random;

  if (difficulty === 'niche') return pickSemanticNichePair(leaders);

  const n = leaders.length;
  if (n < 10) return null;

  let idxA: number, idxB: number;
  switch (difficulty) {
    case 'easy':
      // Star vs. clear bench — top 5% vs bottom 50%
      idxA = Math.floor(r() * Math.max(1, Math.floor(n * 0.05)));
      idxB = Math.floor(n * 0.50) + Math.floor(r() * Math.floor(n * 0.45));
      break;
    case 'medium':
      // Recognizable player vs. mid-tier — top 25% vs 40–75%
      idxA = Math.floor(r() * Math.floor(n * 0.25));
      idxB = Math.floor(n * 0.40) + Math.floor(r() * Math.floor(n * 0.35));
      break;
    case 'hard':
      // Two players close in rank — within 3 spots of each other in top 60%
      idxA = Math.floor(r() * Math.floor(n * 0.60));
      idxB = Math.min(n - 1, idxA + 1 + Math.floor(r() * 3));
      break;
    default:
      idxA = 0; idxB = Math.min(5, n - 1);
  }

  if (idxA === idxB || idxB >= n) return null;
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

Your ONLY job: write EXACTLY 1 sentence for each matchup. Hard rules:
- Max 20 words. No exceptions.
- Name both players and cite both exact stat values
- No filler — cut anything that doesn't add information (no "testament to", "key factor", "incredible ability", "continues to")
- Snarky fan voice — punchy, direct, like a group chat message
- Never start with "In a", "In the", "In what", "Did you know"
- NEVER say "showcasing", "highlighting", "testament", "undisputed"
- For niche: celebrate the obscurity — "two guys nobody remembers", "fringe roster spot energy"
- Vary your sentence openers across all matchups in the batch`;

interface MatchupData {
  strategy: StatStrategy;
  season: string;
  playerA: NBALeaderRow;
  playerB: NBALeaderRow;
}

// ── Template fallback (no GPT needed) ─────────────────────────────────────────
// Used when OpenAI is rate-limited. Real stats, template flavor text.
const FLAVOR_TEMPLATES = [
  (a: string, av: number, b: string, bv: number, unit: string, season: string) =>
    `${a} put up ${av} ${unit} vs ${b}'s ${bv} in the ${season} season. One of these is clearly higher — but do you know which?`,
  (a: string, av: number, b: string, bv: number, unit: string, season: string) =>
    `${season}: ${a} (${av} ${unit}) vs ${b} (${bv} ${unit}). The gap might surprise you.`,
  (a: string, av: number, b: string, bv: number, unit: string, season: string) =>
    `Both ${a} and ${b} were active in ${season}. One finished with ${av} ${unit}, the other with ${bv}. Which one's on top?`,
  (a: string, av: number, b: string, bv: number, unit: string, season: string) =>
    `${a} vs ${b} — ${season} regular season ${unit}. The difference is ${Math.abs(av - bv).toFixed(1)}. Who had more?`,
];

function buildTemplatedQuestions(matchups: MatchupData[], difficulty: string): Record<string, unknown>[] {
  const now = Date.now();
  return matchups.map((m, i) => {
    const tmpl = FLAVOR_TEMPLATES[i % FLAVOR_TEMPLATES.length];
    const flavor = tmpl(
      m.playerA.playerName, m.playerA.stat,
      m.playerB.playerName, m.playerB.stat,
      m.strategy.unit, m.season,
    );
    return {
      id: makeId(m.playerA, m.playerB, m.strategy.statCategory, m.season, now + i),
      era: seasonEra(m.season),
      category: m.strategy.category,
      label: m.strategy.label,
      subLabel: `${m.season} regular season`,
      flavor,
      playerA: {
        id: m.playerA.playerName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        name: m.playerA.playerName,
        label: `${m.playerA.team} ${m.season}`,
        color: teamColor(m.playerA.team),
      },
      playerB: {
        id: m.playerB.playerName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        name: m.playerB.playerName,
        label: `${m.playerB.team} ${m.season}`,
        color: teamColor(m.playerB.team),
      },
      valueA: m.playerA.stat,
      valueB: m.playerB.stat,
      unit: m.strategy.unit,
      difficulty,
      _source: 'nba_api+template',
    };
  });
}

// ── Main POST handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { difficulty = 'medium', count = 5, seenMatchups = [] } = await req.json().catch(() => ({}));
  const seenSet = new Set<string>(seenMatchups as string[]);

  // Serve from cache only when there's a surplus — exact-count hits get fresh questions
  // This prevents two back-to-back requests from serving the same batch
  const cacheKey = difficulty;
  const cached = (qCache.get(cacheKey) ?? []).filter((q) => {
    const qr = q as Record<string, unknown>;
    const aId = String((qr.playerA as Record<string,unknown>)?.id ?? '');
    const bId = String((qr.playerB as Record<string,unknown>)?.id ?? '');
    const key1 = `${aId}|${bId}`, key2 = `${bId}|${aId}`;
    return !seenSet.has(key1) && !seenSet.has(key2);
  });
  qCache.set(cacheKey, cached);
  if (cached.length > count + 2) {
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

  // Generate extra to overfill cache — but cap at count+2 to avoid NBA API timeouts
  const generateCount = count + 2;
  const strategyPool = difficulty === 'niche'
    ? [...NICHE_STRATEGIES, ...NICHE_STRATEGIES].sort(() => Math.random() - 0.5)
    : difficulty === 'easy'
      ? [...EASY_STRATEGIES, ...EASY_STRATEGIES].sort(() => Math.random() - 0.5)
      : [...COMMON_STRATEGIES, ...COMMON_STRATEGIES].sort(() => Math.random() - 0.5);
  const strategies = strategyPool.slice(0, generateCount);

  // Fetch NBA data in parallel — each gets a random season
  // We fetch generateCount matchups to overfill the cache
  const fetchResults = await Promise.allSettled(
    strategies.map(async (strategy) => {
      const season = randomSeason(difficulty);
      const leaders = await fetchLeaders(strategy, season, baseUrl);
      const pair = pickPair(leaders, difficulty);
      if (!pair) return null;
      return { strategy, season, playerA: pair[0], playerB: pair[1] } as MatchupData;
    })
  );

  const matchups: MatchupData[] = fetchResults
    .filter((r): r is PromiseFulfilledResult<MatchupData | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((v): v is MatchupData => v !== null)
    .filter(m => {
      const key1 = `${m.playerA.playerId}|${m.playerB.playerId}`;
      const key2 = `${m.playerB.playerId}|${m.playerA.playerId}`;
      return !seenSet.has(key1) && !seenSet.has(key2);
    });

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
Use EXACTLY the stat values shown — never change them. Write each flavor sentence with a DIFFERENT opening — vary leads across all ${matchups.length} matchups.

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
    const groqKey  = process.env.mc_groq_api_key;
    const openaiKey = apiKey;

    // Try Groq first (faster + higher rate limits), fall back to OpenAI
    let llmRes: Response | null = null;
    let llmSource = 'groq';

    if (groqKey) {
      try {
        llmRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.85,
            max_tokens: 4000,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user',   content: userPrompt },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!llmRes.ok) { llmRes = null; }
      } catch { llmRes = null; }
    }

    // OpenAI fallback
    if (!llmRes && openaiKey && !openaiKey.startsWith('your-')) {
      llmSource = 'openai';
      const oRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.85,
          max_tokens: 4000,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (oRes.ok) llmRes = oRes;
    }

    // Template fallback — no LLM at all
    if (!llmRes) {
      const templated = buildTemplatedQuestions(matchups, difficulty);
      const existing = qCache.get(cacheKey) ?? [];
      qCache.set(cacheKey, [...existing, ...templated]);
      return Response.json({ questions: templated, source: 'nba_api+template', matchupsUsed: matchups.length });
    }
    const aiData = await llmRes.json();
    const raw = (aiData.choices?.[0]?.message?.content ?? '[]')
      .trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '');

    const parsed: Record<string, unknown>[] = JSON.parse(raw);

    // ── Enforce real API values ────────────────────────────────────────────────
    const now = Date.now();
    const hardened = parsed.map((q, i) => {
      const m = matchups[i];
      if (!m) return q;
      return {
        ...q,
        id: makeId(m.playerA, m.playerB, m.strategy.statCategory, m.season, now + i),
        valueA: m.playerA.stat,
        valueB: m.playerB.stat,
        _source: 'nba_api',
      };
    });

    // ── Store immediately so client gets questions fast ────────────────────────
    const existing = qCache.get(cacheKey) ?? [];
    qCache.set(cacheKey, [...existing, ...hardened]);

    // ── Eval + repair runs in background — doesn't block the response ─────────
    evalAndRepair(hardened, matchups, apiKey).then(evaluated => {
      // Replace the hardened entries in cache with repaired versions
      const current = qCache.get(cacheKey) ?? [];
      const hardenedIds = new Set(hardened.map(q => String(q.id)));
      const without = current.filter(q => !hardenedIds.has(String((q as Record<string,unknown>).id)));
      qCache.set(cacheKey, [...without, ...evaluated]);
    }).catch(() => {});

    return Response.json({ questions: hardened, source: `nba_api+${llmSource}`, matchupsUsed: matchups.length });
  } catch (e) {
    console.error('Question generation failed:', e);
    return Response.json({ questions: [], error: String(e) }, { status: 200 });
  }
}

// ── Eval + Repair ──────────────────────────────────────────────────────────────
// Scores every flavor line 1-5. Any scoring < 3 gets a regeneration pass.
// Uses gpt-4o-mini so the cost is negligible (~$0.00015 per eval batch).
async function evalAndRepair(
  questions: Record<string, unknown>[],
  matchups: MatchupData[],
  apiKey: string,
): Promise<Record<string, unknown>[]> {
  const EVAL_SYSTEM = `You are a quality evaluator for NBA trivia flavor text.
Score each flavor string 1-5 where:
5 = specific, vivid, names both players, cites exact numbers, genuine basketball insight
3 = acceptable but generic or missing context
1 = vague, repetitive, missing player names or numbers, sounds AI-generated
Return ONLY a JSON array of integers matching the input array length.`;

  const flavors = questions.map(q => String(q.flavor ?? ''));
  const evalPrompt = `Score these ${flavors.length} flavor strings:\n${flavors.map((f, i) => `${i + 1}. ${f}`).join('\n')}`;

  try {
    const evalRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 200,
        messages: [
          { role: 'system', content: EVAL_SYSTEM },
          { role: 'user',   content: evalPrompt },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!evalRes.ok) return questions; // eval failed — ship originals

    const evalData = await evalRes.json();
    const scores: number[] = JSON.parse(
      (evalData.choices?.[0]?.message?.content ?? '[]')
        .trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '')
    );

    // Find which need regeneration
    const weakIdx = scores.map((s, i) => s < 3 ? i : -1).filter(i => i >= 0);
    if (weakIdx.length === 0) return questions;

    // Regenerate only the weak ones
    const repairContext = weakIdx
      .map(i => {
        const m = matchups[i];
        return m
          ? `MATCHUP ${i + 1}: ${m.strategy.label} — ${m.season}\n` +
            `  A: ${m.playerA.playerName} (${m.playerA.team}) — ${m.playerA.stat} ${m.strategy.unit}\n` +
            `  B: ${m.playerB.playerName} (${m.playerB.team}) — ${m.playerB.stat} ${m.strategy.unit}\n` +
            `  Previous (score ${scores[i]}/5): "${questions[i].flavor}" — rewrite this, be more specific`
          : '';
      })
      .join('\n\n');

    const repairRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.9,
        max_tokens: 800,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Rewrite only these ${weakIdx.length} flavor strings. Return a JSON array of strings (just the flavor text, same order).\n\n${repairContext}` },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!repairRes.ok) return questions;
    const repairData = await repairRes.json();
    const repaired: string[] = JSON.parse(
      (repairData.choices?.[0]?.message?.content ?? '[]')
        .trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '')
    );

    // Splice repaired flavors back in
    const result = [...questions];
    weakIdx.forEach((origIdx, repairPos) => {
      if (repaired[repairPos]) {
        result[origIdx] = { ...result[origIdx], flavor: repaired[repairPos], _eval_repaired: true };
      }
    });
    return result;
  } catch {
    return questions; // any eval failure — ship originals
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
