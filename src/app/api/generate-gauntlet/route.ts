/**
 * Multi-Agent Gauntlet Question Generator
 *
 * Architecture — three agents in sequence, each using GPT-4o tool/function calling:
 *
 *  1. StatsAgent    — given a season + difficulty, fetches real NBA per-game stats
 *                     and scores each player's "identifiability" so the model can
 *                     reason about which players are genuinely hard/easy to identify.
 *
 *  2. SelectionAgent — receives the scored player pool and uses tool calling to pick
 *                     one answer player + three plausible distractors. The model
 *                     reasons explicitly about era, stat similarity, and position.
 *
 *  3. WriterAgent   — receives only the answer player's stats (not the distractors)
 *                     and writes flavor text + position hint via tool calling.
 *
 * Demonstrates: task decomposition, OpenAI function/tool calling, inter-agent
 * context passing, typed interfaces, and observability via _rationale field.
 */

import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// ── In-memory cache (server-instance scoped) ──────────────────────────────────
const gCache     = new Map<string, object[]>();
const gUsedNames = new Map<string, Set<string>>();

// ── Types ─────────────────────────────────────────────────────────────────────
interface RawPlayer {
  rank: number; playerId: string; playerName: string; team: string;
  gp: number; ppg: number; rpg: number; apg: number; spg: number; bpg: number;
}
interface ScoredPlayer extends RawPlayer {
  identifiabilityScore: number;
  era: string;
}
interface AgentSelection {
  answerPlayer: string;
  distractors: string[];
  selectionRationale: string;
}
interface AgentFlavor {
  flavor: string;
  positionHint: string;
}

// ── NBA Stats Fetch ────────────────────────────────────────────────────────────
async function fetchPlayerSeasonStats(season: string, baseUrl: string): Promise<RawPlayer[]> {
  const params = new URLSearchParams({
    endpoint: 'leagueLeaders', LeagueID: '00', PerMode: 'PerGame',
    Scope: 'S', Season: season, SeasonType: 'Regular Season', StatCategory: 'PTS',
  });
  const res = await fetch(`${baseUrl}/api/nba?${params}`, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`NBA API ${res.status}`);
  const json = await res.json();
  const rs = json.resultSet ?? json.resultSets?.[0];
  if (!rs?.headers) throw new Error('Bad NBA response shape');
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

// ── Agent 1: StatsAgent ────────────────────────────────────────────────────────
// Scores each player's STAT DISTINCTIVENESS — how unique their numbers are
// compared to league peers that season. High = very distinctive (outlier stats,
// easy to identify). Low = generic / blends into the field (hard to identify).
// This drives difficulty: Easy gets high-distinctiveness players, Niche gets low.
async function runStatsAgent(
  players: RawPlayer[], season: string, difficulty: string, apiKey: string,
): Promise<ScoredPlayer[]> {
  const tools = [{
    type: 'function' as const,
    function: {
      name: 'score_players',
      description: 'Score each player\'s stat distinctiveness — how unique/identifiable their numbers are compared to peers in that season.',
      parameters: {
        type: 'object',
        properties: {
          scores: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                playerName: { type: 'string' },
                identifiabilityScore: {
                  type: 'number',
                  description: '0-100 based purely on how DISTINCTIVE the stat line is. 90+=extreme outlier (35ppg, triple-double avg, dominant in multiple categories). 60-89=clearly above average, recognizable combo. 30-59=solid starter but nothing that stands out. <30=generic role player stats, could be many people.',
                },
              },
              required: ['playerName', 'identifiabilityScore'],
            },
          },
        },
        required: ['scores'],
      },
    },
  }];

  // Include full stat line so model can assess distinctiveness from numbers alone
  const playerList = players.slice(0, 50).map(p =>
    `${p.playerName}: ${p.ppg}pts/${p.rpg}reb/${p.apg}ast/${p.spg}stl/${p.bpg}blk, ${p.gp}GP, rank #${p.rank}`
  ).join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o', temperature: 0.2, max_tokens: 2500,
      tools, tool_choice: { type: 'function', function: { name: 'score_players' } },
      messages: [{
        role: 'user',
        content: `StatsAgent: Season ${season}.\nScore each player's STAT DISTINCTIVENESS — how unique and identifiable their stat line is compared to peers this season. Base your score ONLY on the numbers (pts/reb/ast/stl/blk), NOT on name recognition. A player averaging 35ppg is an extreme outlier = 95. A player averaging 13/4/2 is generic = 25.\n\n${playerList}\n\nCall score_players.`,
      }],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`StatsAgent ${res.status}`);
  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error('StatsAgent: no tool call');
  const { scores } = JSON.parse(toolCall.function.arguments) as { scores: { playerName: string; identifiabilityScore: number }[] };
  const scoreMap = new Map(scores.map(s => [s.playerName, s.identifiabilityScore]));
  return players.map(p => ({ ...p, era: season.slice(0, 4), identifiabilityScore: scoreMap.get(p.playerName) ?? 50 }));
}

// ── Agent 2: SelectionAgent ────────────────────────────────────────────────────
// Picks answer player + three plausible distractors via tool calling.
// The model must reason about era, stat similarity, and position alignment.
async function runSelectionAgent(
  scoredPool: ScoredPlayer[], difficulty: string, usedNames: Set<string>, apiKey: string,
): Promise<AgentSelection> {
  // Stat-disparity bands: Easy = very distinctive outlier stats, Niche = generic blends-in stats
  const targetRange: Record<string, [number, number]> = {
    Easy:   [72, 100], // extreme outlier stat lines — obvious who it is from numbers alone
    Medium: [45, 71],  // above average but not unmistakable
    Hard:   [20, 44],  // solid starter, generic enough to confuse
    Niche:  [0,  19],  // completely average stats — could be any role player
  };
  const [minScore, maxScore] = targetRange[difficulty] ?? [0, 100];
  let eligible = scoredPool
    .filter(p => !usedNames.has(p.playerName) && p.identifiabilityScore >= minScore && p.identifiabilityScore <= maxScore && p.gp >= 25)
    .sort(() => Math.random() - 0.5).slice(0, 20);
  // Fallback: widen band by ±15 before going fully open
  if (eligible.length < 4) {
    eligible = scoredPool
      .filter(p => !usedNames.has(p.playerName) && p.identifiabilityScore >= Math.max(0, minScore - 15) && p.identifiabilityScore <= Math.min(100, maxScore + 15) && p.gp >= 25)
      .sort(() => Math.random() - 0.5).slice(0, 20);
  }
  if (eligible.length < 4) {
    eligible = scoredPool.filter(p => !usedNames.has(p.playerName) && p.gp >= 25).sort(() => Math.random() - 0.5).slice(0, 20);
  }

  const tools = [{
    type: 'function' as const,
    function: {
      name: 'select_question_players',
      description: 'Pick one answer player and three distractors for a trivia question.',
      parameters: {
        type: 'object',
        properties: {
          answerPlayer: { type: 'string' },
          distractors: {
            type: 'array', minItems: 3, maxItems: 3,
            items: { type: 'string' },
            description: 'Three plausible wrong answers — same era, similar stats or position.',
          },
          selectionRationale: {
            type: 'string',
            description: 'One sentence: why these distractors make the question appropriately hard.',
          },
        },
        required: ['answerPlayer', 'distractors', 'selectionRationale'],
      },
    },
  }];

  const playerSummary = eligible.map(p =>
    `${p.playerName} — ${p.ppg}pts/${p.rpg}reb/${p.apg}ast, ${p.team}, identifiability:${p.identifiabilityScore}`
  ).join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o', temperature: 0.7, max_tokens: 500,
      tools, tool_choice: { type: 'function', function: { name: 'select_question_players' } },
      messages: [{
        role: 'user',
        content: `SelectionAgent: Difficulty=${difficulty} (stat-distinctiveness range ${JSON.stringify(targetRange[difficulty] ?? [0,100])}). Pick an answerPlayer whose stat line is appropriately distinctive for this difficulty — Easy means very unique outlier numbers, Niche means generic stats that could belong to many players. Distractors must have SIMILAR stat profiles to the answer (same position, similar ppg/rpg/apg range) so the question is actually hard.\n\nPool:\n${playerSummary}\n\nCall select_question_players.`,
      }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`SelectionAgent ${res.status}`);
  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error('SelectionAgent: no tool call');
  return JSON.parse(toolCall.function.arguments) as AgentSelection;
}

// ── Agent 3: WriterAgent ───────────────────────────────────────────────────────
// Only sees the answer player's stats — writes flavor without knowing the distractors.
async function runWriterAgent(
  player: RawPlayer, season: string, teamHint: string, apiKey: string,
): Promise<AgentFlavor> {
  const tools = [{
    type: 'function' as const,
    function: {
      name: 'write_question_flavor',
      description: 'Write flavor text and position hint for a basketball trivia question.',
      parameters: {
        type: 'object',
        properties: {
          flavor: {
            type: 'string',
            description: '1-2 punchy sentences about this season. Mention exact stats. Do NOT name the player. Do NOT start with "In a" or "In the".',
          },
          positionHint: {
            type: 'string',
            enum: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
          },
        },
        required: ['flavor', 'positionHint'],
      },
    },
  }];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o', temperature: 0.85, max_tokens: 300,
      tools, tool_choice: { type: 'function', function: { name: 'write_question_flavor' } },
      messages: [{
        role: 'user',
        content: `WriterAgent: ${season} season, ${teamHint}.\nStats: ${player.ppg}pts, ${player.rpg}reb, ${player.apg}ast, ${player.spg}stl, ${player.bpg}blk, ${player.gp}GP.\nWrite flavor text hinting at who this player is WITHOUT naming them. Call write_question_flavor.`,
      }],
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`WriterAgent ${res.status}`);
  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error('WriterAgent: no tool call');
  return JSON.parse(toolCall.function.arguments) as AgentFlavor;
}

// ── Agent 4: QualityCheckAgent ────────────────────────────────────────────────
// Fast gpt-4o-mini validation pass before any question reaches the client.
// Checks: answer is in options, flavor doesn't name the player, distractors are
// plausible (not obviously wrong), no duplicate answers in the batch.
interface QCResult {
  pass: boolean;
  failReason?: string;
}
interface RawQuestion {
  id: string; answer: string; options: string[]; flavor: string;
  ppg: number; rpg: number; apg: number; spg: number; bpg: number;
  season: string; positionHint: string; teamHint: string; difficulty: string;
  _rationale: string; _source: string; conference: string;
}

async function runQualityCheckAgent(
  question: RawQuestion, seenAnswers: Set<string>, apiKey: string,
): Promise<QCResult> {
  // Hard checks (no LLM needed) — fast-fail before wasting a token
  if (!question.options.includes(question.answer)) {
    return { pass: false, failReason: 'answer not in options' };
  }
  if (seenAnswers.has(question.answer)) {
    return { pass: false, failReason: `duplicate answer: ${question.answer}` };
  }
  if (new Set(question.options).size !== question.options.length) {
    return { pass: false, failReason: 'duplicate options' };
  }
  if (question.options.length !== 4) {
    return { pass: false, failReason: `wrong option count: ${question.options.length}` };
  }

  // Soft checks via LLM — checks flavor quality and distractor plausibility
  const tools = [{
    type: 'function' as const,
    function: {
      name: 'quality_check',
      description: 'Validate a trivia question for quality.',
      parameters: {
        type: 'object',
        properties: {
          pass: {
            type: 'boolean',
            description: 'true if the question passes all checks.',
          },
          failReason: {
            type: 'string',
            description: 'If pass=false, brief reason why it failed.',
          },
        },
        required: ['pass'],
      },
    },
  }];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini', temperature: 0, max_tokens: 150,
      tools, tool_choice: { type: 'function', function: { name: 'quality_check' } },
      messages: [{
        role: 'user',
        content: `QualityCheckAgent: Validate this trivia question.\n\nFlavor: "${question.flavor}"\nAnswer: ${question.answer}\nOptions: ${question.options.join(', ')}\nStats: ${question.ppg}pts/${question.rpg}reb/${question.apg}ast\n\nFail if ANY of these are true:\n1. The flavor text names or strongly implies the answer player by name\n2. Any distractor is obviously wrong (e.g., wrong sport, fictional person, same name as answer)\n3. The flavor text is generic filler with no real stat info\n4. Options list fewer than 4 names\n\nCall quality_check.`,
      }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { pass: true }; // don't block on QC API failure
  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return { pass: true };
  return JSON.parse(toolCall.function.arguments) as QCResult;
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
  // All tiers draw from the same broad pool — difficulty comes from stat disparity, not era
  Easy:   ['2023-24','2022-23','2021-22','2020-21','2019-20','2018-19','2017-18','2016-17','2015-16','2014-15','2013-14','2012-13'],
  Medium: ['2023-24','2022-23','2021-22','2020-21','2019-20','2018-19','2017-18','2016-17','2015-16','2014-15','2013-14','2012-13'],
  Hard:   ['2023-24','2022-23','2021-22','2020-21','2019-20','2018-19','2017-18','2016-17','2015-16','2014-15','2013-14','2012-13','2010-11','2008-09','2006-07','2004-05','2002-03'],
  Niche:  ['2023-24','2022-23','2021-22','2020-21','2019-20','2018-19','2017-18','2016-17','2015-16','2014-15','2013-14','2012-13','2010-11','2008-09','2006-07','2004-05','2002-03','2000-01','1998-99','1996-97'],
};

// ── Main Route ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { difficulty = 'Medium', count = 5, seenAnswers = [] } = await req.json().catch(() => ({}));

  const cacheKey = difficulty;
  const cached = gCache.get(cacheKey) ?? [];
  if (cached.length > count + 2) {
    const batch = cached.splice(0, count);
    gCache.set(cacheKey, cached);
    return Response.json({ questions: batch, source: 'cache' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith('your-')) {
    return Response.json({ questions: [], error: 'No OpenAI key' });
  }

  const host = req.headers.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const baseUrl = `${proto}://${host}`;

  const seasons = SEASONS_BY_DIFF[difficulty] ?? SEASONS_BY_DIFF['Medium'];
  const serverUsed = gUsedNames.get(cacheKey) ?? new Set<string>();
  const usedNames = new Set<string>([...serverUsed, ...(seenAnswers as string[])]);
  const pickedSeasons = [...seasons].sort(() => Math.random() - 0.5).slice(0, 3);

  try {
    // Phase 1: Fetch raw stats for all seasons in parallel
    const rawSeasonData = await Promise.all(
      pickedSeasons.map(async season => ({
        season,
        players: (await fetchPlayerSeasonStats(season, baseUrl)).filter(p => p.gp >= 25),
      }))
    );

    // Phase 2: StatsAgent scores all seasons in parallel
    const scoredSeasonData = await Promise.all(
      rawSeasonData.map(({ season, players }) =>
        runStatsAgent(players, season, difficulty, apiKey)
          .then(scored => ({ season, scored }))
          .catch(() => ({ season, scored: players.map(p => ({ ...p, era: season.slice(0, 4), identifiabilityScore: 50 })) }))
      )
    );

    // Phase 3 + 4 + 5: SelectionAgent → WriterAgent → QualityCheckAgent per season
    const batchSeenAnswers = new Set<string>(seenAnswers as string[]);
    const questionResults = await Promise.allSettled(
      scoredSeasonData.map(async ({ season, scored }) => {
        const selection = await runSelectionAgent(scored, difficulty, usedNames, apiKey);
        const answerStats = scored.find(p => p.playerName === selection.answerPlayer) ?? scored[0];
        const teamHint = TEAM_HINTS[answerStats.team] ?? answerStats.team;
        const flavor = await runWriterAgent(answerStats, season, teamHint, apiKey);

        const options = [selection.answerPlayer, ...selection.distractors]
          .sort(() => Math.random() - 0.5) as [string, string, string, string];

        const question: RawQuestion = {
          id: `ag_${answerStats.playerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${season.replace('-', '_')}`,
          ppg: answerStats.ppg, rpg: answerStats.rpg, apg: answerStats.apg,
          spg: answerStats.spg, bpg: answerStats.bpg,
          season, conference: 'NBA',
          positionHint: flavor.positionHint,
          teamHint, flavor: flavor.flavor, difficulty,
          answer: selection.answerPlayer,
          options,
          _source: 'ai-agents',
          _rationale: selection.selectionRationale,
        };

        // Phase 5: QualityCheckAgent — validate before allowing into the batch
        const qc = await runQualityCheckAgent(question, batchSeenAnswers, apiKey);
        if (!qc.pass) {
          console.warn(`QC rejected question (${question.answer}): ${qc.failReason}`);
          throw new Error(`QC failed: ${qc.failReason}`);
        }

        // Mark answer as seen so subsequent questions in this batch can't duplicate it
        batchSeenAnswers.add(question.answer);
        return question;
      })
    );

    const questions = questionResults
      .filter((r) => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<typeof questionResults[0] extends PromiseFulfilledResult<infer T> ? T : never>).value);

    if (questions.length === 0) {
      return Response.json({ questions: [], error: 'All agent pipelines failed' });
    }

    const existing = gCache.get(cacheKey) ?? [];
    gCache.set(cacheKey, [...existing, ...questions]);
    const updatedUsed = gUsedNames.get(cacheKey) ?? new Set<string>();
    questions.forEach(q => updatedUsed.add((q as { answer: string }).answer));
    gUsedNames.set(cacheKey, updatedUsed);

    return Response.json({ questions, source: 'ai-agents' });
  } catch (e) {
    console.error('Multi-agent gauntlet pipeline failed:', e);
    return Response.json({ questions: [], error: String(e) });
  }
}
