import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// ── Cache ──────────────────────────────────────────────────────────────────────
const gCache     = new Map<string, object[]>();
const gUsedNames = new Map<string, Set<string>>(); // track answer names already seen

// ── NBA per-game stats fetch ───────────────────────────────────────────────────
async function fetchPlayerSeasonStats(
  season: string,
  baseUrl: string,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    endpoint: 'leagueLeaders',
    LeagueID: '00',
    PerMode: 'PerGame',
    Scope: 'S',
    Season: season,
    SeasonType: 'Regular Season',
    StatCategory: 'PTS',
  });

  const res = await fetch(`${baseUrl}/api/nba?${params}`, {
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`NBA API ${res.status}`);

  const json = await res.json();
  const rs = json.resultSet ?? json.resultSets?.[0];
  if (!rs?.headers) throw new Error('Bad shape');

  const h = rs.headers as string[];
  const rows = rs.rowSet as unknown[][];
  const idx = (n: string) => h.indexOf(n);

  return rows.map(row => ({
    rank:       Number(row[idx('RANK')]),
    playerId:   String(row[idx('PLAYER_ID')]),
    playerName: String(row[idx('PLAYER')]),
    team:       String(row[idx('TEAM')]),
    gp:         Number(row[idx('GP')]),
    ppg:        Number(row[idx('PTS')]),
    rpg:        Number(row[idx('REB')] ?? 0),
    apg:        Number(row[idx('AST')] ?? 0),
    spg:        Number(row[idx('STL')] ?? 0),
    bpg:        Number(row[idx('BLK')] ?? 0),
  }));
}

const TEAM_HINTS: Record<string, string> = {
  ATL: 'Atlanta', BOS: 'Boston', BKN: 'Brooklyn', CHA: 'Charlotte',
  CHI: 'Chicago', CLE: 'Cleveland', DAL: 'Dallas', DEN: 'Denver',
  DET: 'Detroit', GSW: 'Golden State', HOU: 'Houston', IND: 'Indiana',
  LAC: 'LA Clippers', LAL: 'Los Angeles', MEM: 'Memphis', MIA: 'Miami',
  MIL: 'Milwaukee', MIN: 'Minnesota', NOP: 'New Orleans', NYK: 'New York',
  OKC: 'Oklahoma City', ORL: 'Orlando', PHI: 'Philadelphia', PHX: 'Phoenix',
  POR: 'Portland', SAC: 'Sacramento', SAS: 'San Antonio', TOR: 'Toronto',
  UTA: 'Utah', WAS: 'Washington', NJN: 'New Jersey', NOH: 'New Orleans',
  SEA: 'Seattle', VAN: 'Vancouver',
};

const SEASONS_BY_DIFF: Record<string, string[]> = {
  Easy:   ['2023-24','2022-23','2021-22','2020-21','2019-20','2018-19','2017-18','2016-17','2015-16'],
  Medium: ['2018-19','2017-18','2016-17','2015-16','2014-15','2013-14','2012-13','2011-12'],
  Hard:   ['2013-14','2012-13','2011-12','2010-11','2009-10','2008-09','2007-08','2006-07','2005-06'],
  Niche:  ['2005-06','2004-05','2003-04','2002-03','2001-02','2000-01','1999-00','1998-99','1997-98','1996-97'],
};

const RANK_RANGE: Record<string, [number, number]> = {
  Easy:   [0, 10],    // top 10 — recognizable stars
  Medium: [5, 30],    // stars but not obvious
  Hard:   [10, 60],   // solid starters, some obscure
  Niche:  [20, 100],  // deep cuts
};

export async function POST(req: NextRequest) {
  const { difficulty = 'Medium', count = 5 } = await req.json().catch(() => ({}));

  // Cache check
  const cacheKey = difficulty;
  const cached = gCache.get(cacheKey) ?? [];
  if (cached.length > count + 2) {
    const batch = cached.splice(0, count);
    gCache.set(cacheKey, cached);
    return Response.json({ questions: batch, source: 'cache' });
  }

  const usedNames = gUsedNames.get(cacheKey) ?? new Set<string>();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith('your-')) {
    return Response.json({ questions: [], error: 'No OpenAI key' }, { status: 200 });
  }

  const host = req.headers.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const baseUrl = `${proto}://${host}`;

  const seasons = SEASONS_BY_DIFF[difficulty] ?? SEASONS_BY_DIFF['Medium'];
  const [rankMin, rankMax] = RANK_RANGE[difficulty];

  // Pick `count+2` unique seasons, fetch stats for each
  const generateCount = count + 2;
  const pickedSeasons = [...seasons].sort(() => Math.random() - 0.5).slice(0, Math.min(generateCount, seasons.length));

  // Fetch all seasons in parallel first
  const seasonDataResults = await Promise.allSettled(
    pickedSeasons.map(async (season) => {
      const players = await fetchPlayerSeasonStats(season, baseUrl);
      const pool = players.slice(rankMin, Math.min(rankMax, players.length)).filter(p => (p.gp as number) >= 30);
      return { season, pool };
    })
  );
  const seasonData = seasonDataResults
    .filter((r): r is PromiseFulfilledResult<{season: string; pool: Record<string,unknown>[]}> => r.status === 'fulfilled' && r.value.pool.length >= 4)
    .map(r => r.value);

  // Build all wrong-option names from ALL seasons (cross-season pool)
  const allPlayerNames = Array.from(new Set(seasonData.flatMap(s => s.pool.map(p => p.playerName as string))));

  const fetchResults = await Promise.allSettled(
    seasonData.map(async ({ season, pool }) => {
      // Pick answer player — skip names already used
      const freshPool = pool.filter(p => !usedNames.has(p.playerName as string));
      const answerPool = freshPool.length >= 2 ? freshPool : pool;
      const answerIdx = Math.floor(Math.random() * answerPool.length);
      const answer = answerPool[answerIdx];

      // Pick 3 wrong options from cross-season pool, excluding the answer
      const wrongPool = allPlayerNames.filter(n => n !== (answer.playerName as string));
      const wrongs = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3).map(name => ({ playerName: name }));
      if (wrongs.length < 3) return null;

      return {
        season,
        answer,
        wrongs,
        teamHint: TEAM_HINTS[answer.team as string] ?? String(answer.team),
      };
    })
  );

  const matchups = fetchResults
    .filter((r): r is PromiseFulfilledResult<{season: string; answer: Record<string,unknown>; wrongs: {playerName: string}[]; teamHint: string}> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  if (matchups.length === 0) {
    return Response.json({ questions: [], error: 'No data' }, { status: 200 });
  }

  // Build GPT prompt — ask it to write flavor + positionHint for each
  const dataContext = matchups.map((m, i) => {
    const a = m.answer;
    return `PLAYER ${i + 1}: ${a.playerName} (${a.team}) — ${m.season}\n` +
      `  Stats: ${a.ppg} PPG, ${a.rpg} RPG, ${a.apg} APG, ${a.spg} SPG, ${a.bpg} BPG\n` +
      `  Games: ${a.gp} GP\n` +
      `  Wrong options: ${m.wrongs.map(w => w.playerName).join(', ')}`;
  }).join('\n\n');

  const userPrompt = `Here are ${matchups.length} real NBA player-seasons. For each, write a short "flavor" and a "positionHint".

${dataContext}

Return a JSON array of ${matchups.length} objects in the SAME ORDER:
{
  "flavor": "<1-2 punchy sentences about why this season was notable or hard to identify. Name the exact stats. Be specific — era, team context, role. Don't start with 'In a'>",
  "positionHint": "<position string like 'Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'>"
}

Return ONLY the raw JSON array, no markdown fences.`;

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: 'You write flavor text for a basketball trivia game. Be vivid, specific, and direct. Never start sentences with "In a".' },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!aiRes.ok) throw new Error(`OpenAI ${aiRes.status}`);
    const aiData = await aiRes.json();
    const raw = (aiData.choices?.[0]?.message?.content ?? '[]')
      .trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '');
    const flavors: { flavor: string; positionHint: string }[] = JSON.parse(raw);

    const now = Date.now();
    const questions = matchups.map((m, i) => {
      const a = m.answer;
      const f = flavors[i] ?? { flavor: '', positionHint: 'Forward' };
      const allOptions = [a.playerName as string, ...m.wrongs.map(w => w.playerName)] as [string, string, string, string];
      const shuffled = allOptions.sort(() => Math.random() - 0.5) as [string, string, string, string];

      return {
        id: `ag_${String(a.playerName).toLowerCase().replace(/\s+/g,'_')}_${m.season.replace('-','_')}_${now + i}`,
        ppg: a.ppg,
        rpg: a.rpg,
        apg: a.apg,
        spg: a.spg,
        bpg: a.bpg,
        season: m.season,
        conference: 'NBA',
        positionHint: f.positionHint,
        teamHint: m.teamHint,
        flavor: f.flavor,
        difficulty,
        answer: a.playerName,
        options: shuffled,
        _source: 'ai',
      };
    });

    const existing = gCache.get(cacheKey) ?? [];
    gCache.set(cacheKey, [...existing, ...questions]);

    // Track used answer names to prevent repeats
    const updatedUsed = gUsedNames.get(cacheKey) ?? new Set<string>();
    questions.forEach(q => updatedUsed.add((q as {answer: string}).answer));
    gUsedNames.set(cacheKey, updatedUsed);

    return Response.json({ questions, source: 'ai' });
  } catch (e) {
    console.error('Gauntlet generation failed:', e);
    return Response.json({ questions: [], error: String(e) }, { status: 200 });
  }
}
