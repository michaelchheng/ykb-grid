/**
 * Run with: npx tsx scripts/test-questions.ts
 *
 * Tests:
 *  1. No duplicate IDs within the same question bank
 *  2. No duplicate IDs across ALL banks (comparison, gauntlet, draft)
 *  3. Each difficulty tier has questions
 *  4. No two comparison questions share the exact same playerA+playerB+stat combo
 *  5. No two gauntlet questions share the same answer+season combo
 *  6. Draft: no two challenges share the same players[] set
 */

import { QUESTIONS }          from '../src/data/questions';
import { GAUNTLET_QUESTIONS } from '../src/data/gauntlet';
import { DRAFT_CHALLENGES }   from '../src/data/draft';

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✅  ${label}`);
  passed++;
}

function fail(label: string, detail?: string) {
  console.error(`  ❌  ${label}`);
  if (detail) console.error(`      ${detail}`);
  failed++;
}

function section(title: string) {
  console.log(`\n── ${title} ─────────────────────────────────────────`);
}

// ── 1. IDs unique within each bank ───────────────────────────────────────────
section('ID uniqueness within each bank');

function checkDuplicateIds(items: { id: string }[], name: string) {
  const seen = new Map<string, number>();
  items.forEach(q => seen.set(q.id, (seen.get(q.id) ?? 0) + 1));
  const dupes = [...seen.entries()].filter(([, n]) => n > 1);
  if (dupes.length === 0) {
    ok(`${name}: all ${items.length} IDs are unique`);
  } else {
    dupes.forEach(([id, n]) => fail(`${name}: "${id}" appears ${n} times`));
  }
}

checkDuplicateIds(QUESTIONS,          'comparison questions');
checkDuplicateIds(GAUNTLET_QUESTIONS, 'gauntlet questions');
checkDuplicateIds(DRAFT_CHALLENGES,   'draft challenges');

// ── 2. IDs unique across ALL banks ───────────────────────────────────────────
section('ID uniqueness across all banks');

const allIds = [
  ...QUESTIONS.map(q => ({ id: q.id, bank: 'comparison' })),
  ...GAUNTLET_QUESTIONS.map(q => ({ id: q.id, bank: 'gauntlet' })),
  ...DRAFT_CHALLENGES.map(q => ({ id: q.id, bank: 'draft' })),
];
const crossSeen = new Map<string, string[]>();
allIds.forEach(({ id, bank }) => {
  crossSeen.set(id, [...(crossSeen.get(id) ?? []), bank]);
});
const crossDupes = [...crossSeen.entries()].filter(([, banks]) => banks.length > 1);
if (crossDupes.length === 0) {
  ok(`No ID collisions across all ${allIds.length} questions`);
} else {
  crossDupes.forEach(([id, banks]) =>
    fail(`"${id}" appears in multiple banks: ${banks.join(', ')}`)
  );
}

// ── 3. Each comparison difficulty tier has questions ──────────────────────────
section('Difficulty tier coverage');

const tiers = ['easy', 'medium', 'hard', 'niche'] as const;
tiers.forEach(t => {
  const qs = QUESTIONS.filter(q => q.difficulty === t);
  if (qs.length > 0) ok(`comparison > ${t}: ${qs.length} questions`);
  else                fail(`comparison > ${t}: EMPTY`);
});

const gauntletDiffs = ['Easy', 'Medium', 'Hard', 'Niche'] as const;
gauntletDiffs.forEach(t => {
  const qs = GAUNTLET_QUESTIONS.filter(q => q.difficulty === t);
  if (qs.length > 0) ok(`gauntlet > ${t}: ${qs.length} questions`);
  else                fail(`gauntlet > ${t}: EMPTY`);
});

const draftDiffs = ['Easy', 'Medium', 'Hard', 'Niche'] as const;
draftDiffs.forEach(t => {
  const cs = DRAFT_CHALLENGES.filter(c => c.difficulty === t);
  if (cs.length > 0) ok(`draft > ${t}: ${cs.length} challenges`);
  else                fail(`draft > ${t}: EMPTY`);
});

// ── 4. Comparison: no duplicate playerA+playerB+stat combos ──────────────────
section('Comparison: no duplicate player matchups');

const matchupSeen = new Map<string, string[]>();
QUESTIONS.forEach(q => {
  const key = [
    [q.playerA.id, q.playerB.id].sort().join('|'),
    q.category,
    q.subLabel,
  ].join('::');
  matchupSeen.set(key, [...(matchupSeen.get(key) ?? []), q.id]);
});
const matchupDupes = [...matchupSeen.entries()].filter(([, ids]) => ids.length > 1);
if (matchupDupes.length === 0) {
  ok('No duplicate player+stat+season combos');
} else {
  matchupDupes.forEach(([key, ids]) =>
    fail(`Duplicate matchup: "${key}"`, `IDs: ${ids.join(', ')}`)
  );
}

// ── 5. Gauntlet: no duplicate answer+season combos ───────────────────────────
section('Gauntlet: no duplicate answer+season combos');

const gauntletSeen = new Map<string, string[]>();
GAUNTLET_QUESTIONS.forEach(q => {
  const key = `${q.answer}::${q.season}`;
  gauntletSeen.set(key, [...(gauntletSeen.get(key) ?? []), q.id]);
});
const gauntletDupes = [...gauntletSeen.entries()].filter(([, ids]) => ids.length > 1);
if (gauntletDupes.length === 0) {
  ok('No duplicate answer+season combos');
} else {
  gauntletDupes.forEach(([key, ids]) =>
    fail(`Duplicate gauntlet answer+season: "${key}"`, `IDs: ${ids.join(', ')}`)
  );
}

// ── 6. Draft: no two challenges have the same player set ─────────────────────
section('Draft: no duplicate player sets');

const draftSeen = new Map<string, string[]>();
DRAFT_CHALLENGES.forEach(c => {
  const key = c.players.map(p => p.name).sort().join('|');
  draftSeen.set(key, [...(draftSeen.get(key) ?? []), c.id]);
});
const draftDupes = [...draftSeen.entries()].filter(([, ids]) => ids.length > 1);
if (draftDupes.length === 0) {
  ok('No duplicate player sets');
} else {
  draftDupes.forEach(([key, ids]) =>
    fail(`Duplicate draft player set: "${key}"`, `IDs: ${ids.join(', ')}`)
  );
}

// ── 7. Draft: all niche challenges have ≥ 3 players (for the 3-player mode) ──
section('Draft: Niche challenges have ≥ 3 players');

const nicheDrafts = DRAFT_CHALLENGES.filter(c => c.difficulty === 'Niche');
nicheDrafts.forEach(c => {
  if (c.players.length >= 3) ok(`${c.id}: ${c.players.length} players`);
  else                        fail(`${c.id}: only ${c.players.length} player(s) — need ≥ 3`);
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(54)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log('─'.repeat(54));
if (failed > 0) process.exit(1);
