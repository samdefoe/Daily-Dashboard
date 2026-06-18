// app/api/goals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goals: data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { title, description, target_date } = await request.json();
  if (!title || typeof title !== 'string') return NextResponse.json({ error: 'A goal title is required.' }, { status: 400 });

  const { data, error } = await supabase
    .from('goals')
    .insert({ user_id: sessionData.user.id, title, description: description ?? null, target_date: target_date ?? null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal: data }, { status: 201 });
}
