// app/api/whoop/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/whoopClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) return NextResponse.redirect(new URL(`/?whoop_error=${errorParam}`, request.url));

  const expectedState = request.cookies.get('whoop_oauth_state')?.value;
  if (!state || state !== expectedState) return NextResponse.redirect(new URL('/?whoop_error=state_mismatch', request.url));
  if (!code) return NextResponse.redirect(new URL('/?whoop_error=missing_code', request.url));

  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.redirect(new URL('/login', request.url));

  try {
    const tokens = await exchangeCodeForTokens(code, process.env.WHOOP_REDIRECT_URI!);
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error: upsertError } = await supabaseAdmin.from('whoop_credentials').upsert(
      { user_id: sessionData.user.id, access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_expires_at: tokenExpiresAt },
      { onConflict: 'user_id' }
    );
    if (upsertError) throw new Error(upsertError.message);

    const response = NextResponse.redirect(new URL('/?whoop_connected=true', request.url));
    response.cookies.delete('whoop_oauth_state');
    return response;
  } catch (err) {
    console.error('Whoop OAuth callback failed:', err);
    return NextResponse.redirect(new URL('/?whoop_error=token_exchange_failed', request.url));
  }
}
