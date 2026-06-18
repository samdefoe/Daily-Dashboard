// lib/whoopClient.ts
//
// Verified against https://developer.whoop.com/api as of mid-2026.
// score_state must be "SCORED" before reading .score. Sleep/workouts key
// on their own UUID (not cycle_id / not the deprecated v1 numeric id).

const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer';
const WHOOP_OAUTH_BASE = 'https://api.prod.whoop.com/oauth/oauth2';

export interface WhoopTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<WhoopTokenResponse> {
  const res = await fetch(`${WHOOP_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`Whoop token exchange failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function refreshWhoopToken(refreshToken: string): Promise<WhoopTokenResponse> {
  const res = await fetch(`${WHOOP_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`Whoop token refresh failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function whoopGetAllPages<T>(path: string, accessToken: string, params: Record<string, string> = {}): Promise<T[]> {
  let records: T[] = [];
  let nextToken: string | undefined;
  do {
    const url = new URL(`${WHOOP_API_BASE}${path}`);
    Object.entries(nextToken ? { ...params, nextToken } : params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Whoop API GET ${path} failed (${res.status}): ${await res.text()}`);
    const page: { records: T[]; next_token?: string } = await res.json();
    records = records.concat(page.records ?? []);
    nextToken = page.next_token;
  } while (nextToken);
  return records;
}

export interface FetchOptions {
  accessToken: string;
  start?: string;
}

export function fetchRecoveries({ accessToken, start }: FetchOptions) {
  return whoopGetAllPages<WhoopRecoveryRecord>('/v2/recovery', accessToken, start ? { start } : {});
}
export function fetchSleeps({ accessToken, start }: FetchOptions) {
  return whoopGetAllPages<WhoopSleepRecord>('/v2/activity/sleep', accessToken, start ? { start } : {});
}
export function fetchCycles({ accessToken, start }: FetchOptions) {
  return whoopGetAllPages<WhoopCycleRecord>('/v2/cycle', accessToken, start ? { start } : {});
}
export function fetchWorkouts({ accessToken, start }: FetchOptions) {
  return whoopGetAllPages<WhoopWorkoutRecord>('/v2/activity/workout', accessToken, start ? { start } : {});
}

type ScoreState = 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';

export interface WhoopRecoveryRecord {
  cycle_id: number;
  created_at: string;
  score_state: ScoreState;
  score?: { recovery_score: number; resting_heart_rate: number; hrv_rmssd_milli: number; spo2_percentage?: number; skin_temp_celsius?: number };
}
export interface WhoopCycleRecord {
  id: number;
  start: string;
  score_state: ScoreState;
  score?: { strain: number; kilojoule: number; average_heart_rate: number; max_heart_rate: number };
}
export interface WhoopSleepRecord {
  id: string;
  cycle_id: number;
  start: string;
  end: string;
  nap: boolean;
  score_state: ScoreState;
  score?: {
    respiratory_rate: number;
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_efficiency_percentage: number;
    stage_summary: { total_light_sleep_time_milli: number; total_slow_wave_sleep_time_milli: number; total_rem_sleep_time_milli: number };
  };
}
export interface WhoopWorkoutRecord {
  id: string;
  start: string;
  end: string;
  sport_name: string;
  score_state: ScoreState;
  score?: { strain: number; average_heart_rate: number; max_heart_rate: number };
}
