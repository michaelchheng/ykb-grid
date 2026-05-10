# Agent Instructions — YKB Grid & Michael's Build Style

This file is the source of truth for any AI agent working in this codebase.
Read this before writing a single line of code.

---

## Stack

- **Framework**: Next.js App Router (TypeScript, Tailwind CSS)
- **Server**: Custom `tsx server.ts` — Socket.IO on port 3000, not `next dev` directly
- **Start command**: `npm run dev` (runs `tsx server.ts` which also boots Next.js)
- **AI**: OpenAI `gpt-4o` via `OPENAI_API_KEY` in `.env.local`
- **Real-time**: Socket.IO (`/src/hooks/useSocket.ts`) — `submitScore`, `submitVote`, `getVotes`, `getLeaderboard`
- **Storage**: `localStorage` for all user state (no database yet)

---

## Philosophy: Context Engineering over Prompt Engineering

Michael does **not** want GPT to invent facts. The pattern everywhere is:

1. **Fetch real data first** (NBA API, external source, file, DB)
2. **Construct the context** — pick the right records, filter by difficulty, shape the payload
3. **Send real values to GPT** — GPT writes *flavor text and framing only*, never numbers
4. **Harden the output** — after GPT responds, overwrite any numeric fields with the ground-truth values fetched in step 1

This is called the **harden step** and it is non-negotiable. GPT drift on numbers causes wrong answers. The harden step prevents that entirely.

### Example — `/src/app/api/generate-question/route.ts`

```
1. Pick random stat category + season from STAT_STRATEGIES × SEASONS
2. Fetch leagueLeaders from stats.nba.com via /api/nba proxy
3. pickPair() selects two players based on difficulty:
   - easy:     rank 1-3 vs rank 16-35   (wide gap, obvious)
   - medium:   rank 3-8 vs rank 11-25   (moderate gap)
   - hard:     adjacent ranks 1-10       (near-identical)
   - unhinged: literally consecutive ranks (0.1% gaps)
4. Send REAL player names + REAL stat values to GPT
   → GPT returns only: flavor text, question framing, era label
5. hardened() overwrites valueA/valueB with the API values before returning
```

**Rule**: If you're building any question, quiz, challenge, or comparison feature — always follow this pattern. Never let GPT decide what the numbers are.

---

## RAG Pattern (Retrieval-Augmented Generation)

When the static data pool isn't enough:

1. **Static bank first** — always have a local fallback (`/src/data/questions.ts`)
2. **Background fetch on session start** — call the generation API immediately when a user starts a session, don't block the UI
3. **Buffer pattern** — store incoming AI questions in a separate buffer (`aiBuffer`), merge into the active pool only when the static pool is exhausted
4. **Refetch threshold** — when `aiBuffer.length < 5`, trigger another background fetch automatically
5. **Never block the user** — if the API is slow or fails, the static bank covers it silently

### localStorage Key Schema

```
ykb_username              → string handle
ykb_admin                 → '1' if admin
ykb_lockout_{tier}        → today's date string if locked out (WHM)
ykb_today_{tier}          → '{date}:{streak}' current session streak
ykb_best_{tier}           → best streak ever (number string)
ykb_correct_{tier}        → total correct answers (number string)
ykb_total_{tier}          → total questions answered (number string)
ykb_seen_{username}_{tier} → JSON array of seen question IDs (capped 500)
ykb_sc_lockout_{tier}     → shot chart lockout
ykb_sc_best_{tier}        → shot chart best streak
ykb_correct_sc_{tier}     → shot chart correct count
ykb_total_sc_{tier}       → shot chart total count
```

---

## Deduplication / Anti-Repeat Pattern

Users should never see the same question twice unless they've exhausted everything.

1. Questions get **deterministic IDs** — based on `playerA|playerB|stat` normalized to lowercase with underscores. Never use random UUIDs for content that has an identity.
2. Seen IDs are **persisted to localStorage** per username per tier (`ykb_seen_{username}_{tier}`)
3. On `startTier()` — load the persisted set, filter the static pool to unseen only
4. On `nextQuestion()` — add the current question's ID to the set and persist immediately
5. **Hard cap**: 500 IDs per tier per user. Beyond that, oldest entries drop off (`slice(-500)`)
6. **In-memory reset** is ok when everything is exhausted — but localStorage history is never cleared (so the same questions stay rare even after a reset)

---

## Hydration Rules (Next.js SSR)

Any value that reads from `localStorage` or `window` **must be guarded by a `mounted` state**.

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

// In render:
const locked = mounted && getLockout(tier);  // ✓ safe
const locked = getLockout(tier);             // ✗ hydration mismatch
```

- Server renders `false` / `0` / `null` for all localStorage-dependent values
- After `useEffect` sets `mounted = true`, the real values kick in
- This applies to: lockouts, streaks, best scores, usernames, admin flags

---

## Feature Patterns

### Difficulty System
Tiers: `easy → medium → hard → niche`
- Each tier has: color, bg class, border class, description, lock message
- One wrong answer locks the tier until midnight (`ykb_lockout_{tier}` = today's date)
- Admin bypass: `?admin=YKB_ADMIN_2026` URL param sets `ykb_admin = '1'` in localStorage

### Ball IQ Rank (Progression System)
Six ranks based on accuracy across tiers:
```
Casual           → baseline
Hooper           → 50%+ Medium OR 40%+ Hard
Stat Rat         → 70%+ Medium OR 50%+ Hard
Film Room        → 75%+ Hard AND 80%+ Medium
Niche            → 60%+ Niche AND 75%+ Hard
Elite Ball Knower → 85%+ Niche
```
- `getBallIQ()` returns: current rank, next rank, progress % toward next, and specific unlock conditions with current vs needed values
- The profile drawer shows this with a progress bar and explicit "you need X% on Y" callouts
- Ranks are evaluated purely from localStorage stats — no server needed

### Profile Drawer Pattern
- Available to all users (not just admin)
- Opens from a chip button showing `username · rank` in the rank's color
- Contains: handle (with edit), Ball IQ rank + progress + unlock conditions, per-tier stats with accuracy bars, rank ladder
- Admin drawer is separate — opened by `ADMIN ↗` button — contains reset tools

### Admin Access
```
URL: /?admin=YKB_ADMIN_2026  →  sets localStorage 'ykb_admin' = '1'
Persists across sessions. isAdmin drives UI conditionals.
```

---

## API Proxy Pattern

External APIs (e.g. NBA stats) require server-side requests due to CORS.

`/src/app/api/nba/route.ts` — proxies `stats.nba.com/stats/*`
- Forwards all query params
- Adds required NBA headers (`Referer`, `Origin`, `User-Agent`)
- 5-minute in-memory cache to avoid hammering the API
- Returns JSON directly

When adding new external data sources: **always proxy through a Next.js route**, never call from the client.

---

## Code Style

- **No placeholder data in production paths** — dummy data is fine for leaderboard scaffolding but must be clearly marked and replaceable
- **Silent fallbacks** — if an API call fails, fall back to static data. Never show an error state for trivia questions.
- **`void leaderboard`** pattern — when a hook return value is unused but needed for side effects, suppress the TS warning with `void variable;`
- **Inline IIFE pattern** for complex conditional JSX:
  ```tsx
  {condition && (() => {
    const derived = compute();
    return <div>{derived}</div>;
  })()}
  ```
- **TypeScript strict** — `npx tsc --noEmit` must pass clean before any feature is considered done

---

## Testing Checklist Before Shipping a Feature

1. `npx tsc --noEmit` → zero errors
2. Hard refresh the page → no hydration errors in console
3. Play through a tier → questions don't repeat within a session
4. Restart the server, play the same tier again → same questions don't appear (localStorage history)
5. Different username → fresh question history, no bleed between handles
6. Lock a tier, refresh → still locked, no hydration flash
7. Open profile drawer → rank, progress %, and unlock conditions reflect real stats

---

## What NOT to Do

- ❌ Don't let GPT generate stat values — always harden from real data
- ❌ Don't read localStorage during SSR render — always use `mounted` guard
- ❌ Don't use random UUIDs for question IDs — derive them from content so they're stable
- ❌ Don't block the UI waiting for AI questions — background fetch + buffer pattern only
- ❌ Don't clear localStorage history on in-memory reset — history is permanent, only in-memory state resets
- ❌ Don't call external APIs from client components — always proxy through `/api/*` routes
