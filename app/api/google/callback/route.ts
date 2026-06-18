// app/api/google/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode } from '@/lib/googleCalendarClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) return NextResponse.redirect(new URL(`/?google_error=${errorParam}`, request.url));

  const expectedState = request.cookies.get('google_oauth_state')?.value;
  if (!state || state !== expectedState) return NextResponse.redirect(new URL('/?google_error=state_mismatch', request.url));
  if (!code) return NextResponse.redirect(new URL('/?google_error=missing_code', request.url));

  const supabase = createServerSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return NextResponse.redirect(new URL('/login', request.url));

  try {
    const tokens = await exchangeGoogleCode(code, process.env.GOOGLE_REDIRECT_URI!);

    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token. Try disconnecting access in your Google Account security settings and reconnecting.');
    }

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error: upsertError } = await supabaseAdmin.from('google_credentials').upsert(
      { user_id: sessionData.user.id, access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_expires_at: tokenExpiresAt },
      { onConflict: 'user_id' }
    );
    if (upsertError) throw new Error(upsertError.message);

    const response = NextResponse.redirect(new URL('/?google_connected=true', request.url));
    response.cookies.delete('google_oauth_state');
    return response;
  } catch (err) {
    console.error('Google OAuth callback failed:', err);
    return NextResponse.redirect(new URL(`/?google_error=${encodeURIComponent(err instanceof Error ? err.message : 'unknown')}`, request.url));
  }
}
