// app/api/whoop/sync-now/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { syncWhoopForUser } from '@/lib/syncWhoop';
import { computeDailyScoreForUser } from '@/lib/computeDailyScore';

export async function POST() {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const result = await syncWhoopForUser(sessionData.user.id);
  if (result.status === 'success') {
    await computeDailyScoreForUser(sessionData.user.id).catch((err) => console.error('Score recompute after sync failed:', err));
  }
  return NextResponse.json(result, { status: result.status === 'error' ? 500 : 200 });
}
