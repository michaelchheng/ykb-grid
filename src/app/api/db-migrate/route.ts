/**
 * Admin-only migration endpoint.
 * Hit GET /api/db-migrate?key=<ADMIN_MIGRATE_KEY> to run the schema.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key || key !== process.env.ADMIN_MIGRATE_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const schemaPath = join(process.cwd(), 'src/lib/schema.sql');
    const sql = readFileSync(schemaPath, 'utf8');

    // Split on ; and run each statement
    const stmts = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    const results: string[] = [];
    for (const stmt of stmts) {
      await db.query(stmt);
      results.push(stmt.slice(0, 60) + '...');
    }

    return NextResponse.json({ ok: true, statementsRun: results.length, results });
  } catch (err) {
    console.error('Migration error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
