// app/api/goals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const body = await request.json();
  const allowed = ['title', 'description', 'target_date', 'status'];
  const updates: Record<string, unknown> = {};
  for (const f of allowed) if (f in body) updates[f] = body[f];

  const { data, error } = await supabase.from('goals').update(updates).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { error } = await supabase.from('goals').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
