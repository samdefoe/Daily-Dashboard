// app/api/onboarding/route.ts
//
// GET tells the dashboard whether first-run onboarding has happened yet.
// POST marks it complete after the user submits their initial goals (the
// goals themselves save via the normal /api/goals POST — this just flips
// the "have we asked" flag).

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { data, error } = await supabase.from('user_preferences').select('onboarded').eq('user_id', sessionData.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ onboarded: data?.onboarded ?? false });
}

export async function POST() {
  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { error } = await supabase.from('user_preferences').upsert({ user_id: sessionData.user.id, onboarded: true }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
