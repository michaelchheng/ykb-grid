import { NextRequest } from 'next/server';

const cache = new Map<string, object[]>();

const SYSTEM_PROMPT = `You are an NBA shot chart expert creating puzzles for "Shot Chart ID" — a game where players identify an NBA player from their shot chart pattern.

Return ONLY valid JSON — no markdown, no explanation.

The court coordinate system:
- x: -250 (far left) to 250 (far right), 0 = center
- y: 0 (baseline/rim) to 300 (half court)
- Corner 3s: x ≈ ±232, y ≈ 5-30
- Wing 3s: x ≈ ±185-200, y ≈ 235-260
- Top of arc 3s: x ≈ -80 to 80, y ≈ 270-290
- Paint: |x| < 80, y < 100
- Mid-range: |x| 60-180, y 100-230
- Right elbow: x ≈ 100-130, y ≈ 170-200
- Left elbow: x ≈ -100 to -130, y ≈ 170-200
- made shots: { "x": n, "y": n, "made": true }
- missed shots: { "x": n, "y": n, "made": false }

Generate 2 puzzles as an array. Each puzzle:
{
  "id": "player_lastname_year",
  "season": "YYYY-YY",
  "teamHint": "region or conference hint (NOT the team name)",
  "ppgRange": "XX–XX ppg",
  "positionHint": "position",
  "difficulty": "Easy" or "Medium" or "Hard" or "Niche",
  "flavor": "2 sentences describing the shot pattern. Be specific and analytical.",
  "answer": "Full Player Name",
  "options": ["answer", "wrong1", "wrong2", "wrong3"],
  "communityPct": number 10-90,
  "shots": [array of 30-50 shot objects reflecting the player's ACTUAL shot tendencies]
}

RULES:
- Use REAL players with DISTINCTIVE shot charts
- Easy: all-time stars with unique patterns (Korver, Curry, Shaq)
- Medium: well-known players with recognizable tendencies
- Hard: role players or stars with non-obvious charts
- Niche: deep cuts, backup players, unusual chart patterns
- Shots must reflect REAL shot tendencies (e.g. Korver = corner 3s only)
- Options must include exactly 4 choices with answer first
- communityPct should reflect actual difficulty (Easy: 70-90, Niche: 10-30)`;

export async function POST(req: NextRequest) {
  const { difficulty = 'Medium' } = await req.json().catch(() => ({}));

  const cacheKey = difficulty;
  const cached = cache.get(cacheKey) || [];

  if (cached.length >= 4) {
    const batch = cached.splice(0, 2);
    cache.set(cacheKey, cached);
    return Response.json({ puzzles: batch });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('your-openai-key')) {
    return Response.json({ puzzles: [], error: 'No API key configured' }, { status: 200 });
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.85,
        max_tokens: 3000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Generate 2 "${difficulty}" difficulty shot chart puzzles. Pick players with VERY distinctive shot charts. Return only the JSON array.` }
        ]
      })
    });

    if (!res.ok) throw new Error(`OpenAI returned ${res.status}`);

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '[]';
    const parsed = JSON.parse(text.trim().replace(/^```json?\s*/,'').replace(/```$/,''));
    const puzzles = Array.isArray(parsed) ? parsed : [parsed];

    const tagged = puzzles.map((p: Record<string, unknown>) => ({ ...p, id: `ai_${p.id}`, _generated: true }));

    const existing = cache.get(cacheKey) || [];
    cache.set(cacheKey, [...existing, ...tagged]);

    return Response.json({ puzzles: tagged });
  } catch (e) {
    console.error('AI puzzle generation failed:', e);
    return Response.json({ puzzles: [], error: String(e) }, { status: 200 });
  }
}

export async function GET() {
  return Response.json({ cached: Object.fromEntries([...cache.entries()].map(([k, v]) => [k, v.length])) });
}
