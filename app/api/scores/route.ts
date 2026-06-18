// app/api/scores/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { computeDailyScoreForUser } from '@/lib/computeDailyScore';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const userId = sessionData.user.id;

  // Check Whoop connection explicitly, rather than inferring it from
  // whether computeDailyScoreForUser happens to throw — that function's
  // errors are logged, not surfaced, so the dashboard needs a direct signal.
  const { data: whoopCreds } = await supabase.from('whoop_credentials').select('user_id').eq('user_id', userId).maybeSingle();
  const whoopConnected = !!whoopCreds;

  const today = new Date().toISOString().slice(0, 10);
  if (whoopConnected) {
    await computeDailyScoreForUser(userId, today).catch((err) => console.error('Score compute failed:', err));
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from('daily_scores').select('*').gte('date', thirtyDaysAgo).order('date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todayScore = data?.find((s) => s.date === today) ?? null;
  return NextResponse.json({ todayScore, history: data, whoopConnected });
}
