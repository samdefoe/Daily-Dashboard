// lib/googleCalendarClient.ts
//
// Minimal client for Google's OAuth + Calendar freeBusy endpoint, scoped
// to read-only access since we only ever check free/busy, never create
// or modify events. Verified against developers.google.com/workspace/calendar
// as of mid-2026:
//   - freeBusy is POST https://www.googleapis.com/calendar/v3/freeBusy
//   - body: { timeMin, timeMax, items: [{ id: "primary" }] }
//   - response: { calendars: { primary: { busy: [{ start, end }] } } }
//   - IMPORTANT: a missing/wrong scope can return a 403 OR silently come
//     back with an empty busy array rather than an obvious error. We
//     check response.ok explicitly rather than trusting an empty result.

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string; // only present on the FIRST exchange, not on refresh
  expires_in: number;
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_CALENDAR_SCOPE);
  url.searchParams.set('access_type', 'offline'); // required to get a refresh_token
  url.searchParams.set('prompt', 'consent'); // forces refresh_token on every connect, not just the very first
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function refreshGoogleToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export interface BusyBlock {
  start: string; // ISO 8601
  end: string;
}

/** Returns busy blocks for the primary calendar between timeMin and timeMax. */
export async function fetchBusyBlocks(accessToken: string, timeMin: string, timeMax: string): Promise<BusyBlock[]> {
  const res = await fetch(FREEBUSY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: 'primary' }] }),
  });

  if (!res.ok) {
    // Explicitly surfaced rather than silently treated as "no busy time" —
    // a scope/auth problem here would otherwise look identical to a free day.
    throw new Error(`Google freeBusy request failed (${res.status}): ${await res.text()}`);
  }

  const body = await res.json();
  return body.calendars?.primary?.busy ?? [];
}

/** Given busy blocks across a window, returns total free minutes (window minus busy, naively summed). */
export function calculateFreeMinutes(windowStart: Date, windowEnd: Date, busyBlocks: BusyBlock[]): number {
  const totalWindowMinutes = (windowEnd.getTime() - windowStart.getTime()) / 60000;
  const busyMinutes = busyBlocks.reduce((sum, block) => {
    const start = new Date(block.start).getTime();
    const end = new Date(block.end).getTime();
    return sum + Math.max(0, (end - start) / 60000);
  }, 0);
  return Math.max(0, totalWindowMinutes - busyMinutes);
}
