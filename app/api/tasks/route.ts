// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { data, error } = await supabase.from('tasks').select('*, goals(title)').order('due_date', { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { title, due_date, goal_id, effort_level, source } = await request.json();
  if (!title || typeof title !== 'string') return NextResponse.json({ error: 'A task title is required.' }, { status: 400 });

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: sessionData.user.id,
      title,
      due_date: due_date ?? null,
      goal_id: goal_id ?? null,
      effort_level: effort_level ?? null,
      source: source === 'suggested' ? 'suggested' : 'manual',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 201 });
}
