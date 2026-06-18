// app/api/whoop/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const SCOPES = ['read:recovery', 'read:cycles', 'read:sleep', 'read:workout', 'read:profile', 'offline'].join(' ');

export async function GET(request: NextRequest) {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const redirectUri = process.env.WHOOP_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Whoop is not configured.' }, { status: 500 });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = new URL(WHOOP_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set('whoop_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return response;
}
