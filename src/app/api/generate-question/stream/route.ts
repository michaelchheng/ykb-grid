import { NextRequest } from 'next/server';

// Server-Sent Events endpoint that runs the full question generation pipeline
// and emits status steps as they complete.
// Client subscribes with EventSource, gets real-time loading states.

export const dynamic = 'force-dynamic';

const STEPS = [
  { id: 'nba',    msg: 'Pulling NBA stats...'          },
  { id: 'pair',   msg: 'Finding matchups...'           },
  { id: 'gpt',    msg: 'Writing flavor text...'        },
  { id: 'eval',   msg: 'Grading question quality...'   },
  { id: 'repair', msg: 'Fixing weak questions...'      },
  { id: 'done',   msg: 'Done'                          },
];

function emit(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const difficulty = searchParams.get('difficulty') ?? 'medium';
  const count = parseInt(searchParams.get('count') ?? '8', 10);

  const host = req.headers.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const baseUrl = `${proto}://${host}`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        emit(controller, 'step', { id: 'nba', msg: STEPS[0].msg });

        // Delegate to the main generate-question POST, but emit steps as we go
        // We stream status here; actual generation happens in the POST handler
        await new Promise(r => setTimeout(r, 300)); // NBA fetch in progress

        emit(controller, 'step', { id: 'pair', msg: STEPS[1].msg });
        await new Promise(r => setTimeout(r, 200));

        emit(controller, 'step', { id: 'gpt', msg: STEPS[2].msg });

        // Fire the actual generation
        const res = await fetch(`${baseUrl}/api/generate-question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ difficulty, count }),
          signal: AbortSignal.timeout(45000),
        });

        emit(controller, 'step', { id: 'eval', msg: STEPS[3].msg });
        await new Promise(r => setTimeout(r, 150));

        if (!res.ok) {
          emit(controller, 'error', { message: 'Generation failed' });
          controller.close();
          return;
        }

        const data = await res.json();
        const hadRepairs = (data.questions ?? []).some((q: Record<string, unknown>) => q._eval_repaired);

        if (hadRepairs) {
          emit(controller, 'step', { id: 'repair', msg: STEPS[4].msg });
          await new Promise(r => setTimeout(r, 100));
        }

        emit(controller, 'step',  { id: 'done', msg: STEPS[5].msg });
        emit(controller, 'result', { questions: data.questions ?? [], source: data.source });
        controller.close();
      } catch (e) {
        emit(controller, 'error', { message: String(e) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
