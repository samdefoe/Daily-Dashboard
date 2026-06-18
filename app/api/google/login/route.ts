// app/api/google/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildGoogleAuthUrl } from '@/lib/googleCalendarClient';

export async function GET(request: NextRequest) {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!process.env.GOOGLE_CLIENT_ID || !redirectUri) {
    return NextResponse.json({ error: 'Google Calendar is not configured.' }, { status: 500 });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const response = NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state));
  response.cookies.set('google_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return response;
}
