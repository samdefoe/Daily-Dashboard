// app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { computeDailyScoreForUser } from '@/lib/computeDailyScore';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const body = await request.json();
  const allowed = ['title', 'due_date', 'goal_id', 'status', 'effort_level'];
  const updates: Record<string, unknown> = {};
  for (const f of allowed) if (f in body) updates[f] = body[f];

  if (updates.status === 'done') updates.completed_at = new Date().toISOString();
  else if ('status' in updates) updates.completed_at = null;

  const { data, error } = await supabase.from('tasks').update(updates).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Task completion feeds the productivity score, so recompute immediately
  // rather than waiting for the next scheduled run.
  if ('status' in updates) {
    await computeDailyScoreForUser(sessionData.user.id).catch((err) => console.error('Score recompute failed:', err));
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { error } = await supabase.from('tasks').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
