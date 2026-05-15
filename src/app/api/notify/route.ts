import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

const FROM   = process.env.NOTIFY_FROM_EMAIL || 'YKB <noreply@youknowball.us>';

const TIER_COLOR: Record<string, string> = {
  easy: '#34d399', medium: '#38bdf8', hard: '#c084fc', niche: '#38bdf8',
};
const TIER_LABEL: Record<string, string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard', niche: 'Niche',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tier, idToken } = body as { tier: string; idToken?: string };

    let email: string | null = body.email ?? null;
    let handle: string = body.handle ?? 'You';

    // If an idToken is supplied, verify it server-side and use Firebase's email
    if (idToken) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        email  = decoded.email ?? email;
        handle = body.handle ?? decoded.name?.split(' ')[0] ?? 'Hooper';
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'No email' }, { status: 400 });
    }

    const label = TIER_LABEL[tier] || tier;
    const color = TIER_COLOR[tier] || '#38bdf8';

    const now      = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const hrsLeft  = Math.ceil((midnight.getTime() - now.getTime()) / 3_600_000);

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: true, skipped: 'no resend key' });
    }
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: `🔒 ${handle} got locked on ${label} — back at midnight`,
      html: `
        <div style="background:#08080d;color:#fff;font-family:monospace;max-width:480px;margin:0 auto;padding:40px 32px;border-radius:16px;">
          <h1 style="font-size:2rem;font-weight:900;margin:0 0 8px;color:#38bdf8;">Do You Know Ball?</h1>
          <p style="color:#ffffff80;font-size:0.85rem;margin:0 0 32px;">Daily NBA knowledge challenge</p>

          <p style="font-size:1.1rem;font-weight:700;margin:0 0 8px;">
            You got locked out of <span style="color:${color}">${label}</span>.
          </p>
          <p style="color:#ffffff60;font-size:0.85rem;margin:0 0 32px;">
            ~${hrsLeft} hour${hrsLeft === 1 ? '' : 's'} until midnight reset. Come back and keep your streak alive.
          </p>

          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://youknoball.com'}"
             style="display:inline-block;background:#38bdf8;color:#000;font-weight:900;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:0.95rem;">
            Come Back Tonight →
          </a>

          <p style="color:#ffffff25;font-size:0.7rem;margin:40px 0 0;">
            You're receiving this because you signed up on Do You Know Ball?.<br/>
            Handle: ${handle}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[notify] resend error:', error);
      return NextResponse.json({ error: 'Send failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notify]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
