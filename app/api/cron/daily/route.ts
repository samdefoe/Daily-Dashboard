// app/api/cron/daily/route.ts
//
// Runs once a day: syncs Whoop data and recomputes scores for every
// connected user. Google Calendar isn't synced here — it's fetched live,
// on demand, only when building task suggestions, since there's no
// benefit to a stored history of busy/free blocks.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncWhoopForUser } from '@/lib/syncWhoop';
import { computeDailyScoreForUser } from '@/lib/computeDailyScore';

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return NextResponse.json({ error: 'CRON_SECRET not configured.' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: connectedUsers, error } = await supabaseAdmin.from('whoop_credentials').select('user_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.allSettled(
    (connectedUsers ?? []).map(async (row) => {
      const syncResult = await syncWhoopForUser(row.user_id);
      const score = await computeDailyScoreForUser(row.user_id);
      return { userId: row.user_id, syncResult, score };
    })
  );

  return NextResponse.json({
    processedUsers: results.length,
    failures: results.filter((r) => r.status === 'rejected').length,
    details: results.map((r) => (r.status === 'fulfilled' ? r.value : { error: String(r.reason) })),
  });
}
