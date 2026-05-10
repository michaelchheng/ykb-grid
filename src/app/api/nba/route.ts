import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint');
  if (!endpoint) return Response.json({ error: 'Missing endpoint' }, { status: 400 });

  // Forward all other params to NBA stats
  const params = new URLSearchParams();
  searchParams.forEach((v, k) => { if (k !== 'endpoint') params.set(k, v); });

  const url = `https://stats.nba.com/stats/${endpoint}?${params.toString()}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.nba.com',
        'Referer': 'https://www.nba.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) return Response.json({ error: `NBA API returned ${res.status}` }, { status: res.status });
    const data = await res.json();
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (e) {
    return Response.json({ error: 'Failed to fetch from NBA stats' }, { status: 500 });
  }
}
