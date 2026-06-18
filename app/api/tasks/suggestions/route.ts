// app/api/tasks/suggestions/route.ts
//
// Returns suggested tasks for tomorrow, computed fresh from current
// calendar availability, active goals, and today's recovery score.
// Writes nothing — the dashboard shows these and the user accepts
// (POSTs to /api/tasks) or discards each one.

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getCalendarAvailability } from '@/lib/syncGoogleCalendar';
import { generateTaskSuggestions } from '@/lib/suggestTasks';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const userId = sessionData.user.id;

  const [goalsRes, scoreRes, availability] = await Promise.all([
    supabase.from('goals').select('id, title').eq('status', 'active'),
    supabase.from('daily_scores').select('recovery_score').order('date', { ascending: false }).limit(1).maybeSingle(),
    getCalendarAvailability(userId),
  ]);

  if ('error' in availability) {
    const suggestions = generateTaskSuggestions({
      freeMinutesTomorrow: 240,
      recoveryScore: scoreRes.data?.recovery_score ?? null,
      activeGoals: goalsRes.data ?? [],
    });
    return NextResponse.json({ suggestions, calendarWarning: availability.error });
  }

  const suggestions = generateTaskSuggestions({
    freeMinutesTomorrow: availability.tomorrow.freeMinutes,
    recoveryScore: scoreRes.data?.recovery_score ?? null,
    activeGoals: goalsRes.data ?? [],
  });

  return NextResponse.json({ suggestions, freeMinutesTomorrow: availability.tomorrow.freeMinutes });
}
