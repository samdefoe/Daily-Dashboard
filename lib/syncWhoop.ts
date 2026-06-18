// lib/syncWhoop.ts
//
// Pulls a rolling 7-day window from all four Whoop endpoints and upserts
// into Supabase. Re-fetching overlapping ranges is safe and intentional —
// Whoop scores can be revised shortly after they first appear.

import { supabaseAdmin } from './supabaseAdmin';
import {
  refreshWhoopToken,
  fetchRecoveries,
  fetchSleeps,
  fetchCycles,
  fetchWorkouts,
  WhoopRecoveryRecord,
  WhoopSleepRecord,
  WhoopCycleRecord,
  WhoopWorkoutRecord,
} from './whoopClient';

async function getValidWhoopToken(userId: string): Promise<string> {
  const { data: creds, error } = await supabaseAdmin.from('whoop_credentials').select('*').eq('user_id', userId).single();
  if (error || !creds) throw new Error('No Whoop credentials found. Has the user connected Whoop?');

  if (Date.now() < new Date(creds.token_expires_at).getTime() - 5 * 60 * 1000) {
    return creds.access_token;
  }

  const refreshed = await refreshWhoopToken(creds.refresh_token);
  await supabaseAdmin
    .from('whoop_credentials')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq('user_id', userId);

  return refreshed.access_token;
}

function msToMinutes(ms: number | undefined): number | null {
  return ms === undefined ? null : Math.round(ms / 60000);
}

export async function syncWhoopForUser(userId: string) {
  let recordsSynced = 0;
  try {
    const accessToken = await getValidWhoopToken(userId);
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [recoveries, sleeps, cycles, workouts] = await Promise.all([
      fetchRecoveries({ accessToken, start }),
      fetchSleeps({ accessToken, start }),
      fetchCycles({ accessToken, start }),
      fetchWorkouts({ accessToken, start }),
    ]);

    recordsSynced += await upsertRecoveries(userId, recoveries);
    recordsSynced += await upsertSleeps(userId, sleeps);
    recordsSynced += await upsertCycles(userId, cycles);
    recordsSynced += await upsertWorkouts(userId, workouts);

    await supabaseAdmin.from('sync_log').insert({ user_id: userId, source: 'whoop', status: 'success', records_synced: recordsSynced });
    return { status: 'success' as const, recordsSynced };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await supabaseAdmin.from('sync_log').insert({ user_id: userId, source: 'whoop', status: 'error', records_synced: recordsSynced, error_message: errorMessage });
    return { status: 'error' as const, recordsSynced, errorMessage };
  }
}

async function upsertRecoveries(userId: string, recoveries: WhoopRecoveryRecord[]) {
  const rows = recoveries
    .filter((r) => r.score_state === 'SCORED' && r.score)
    .map((r) => ({
      user_id: userId,
      whoop_cycle_id: r.cycle_id,
      date: r.created_at.slice(0, 10),
      recovery_score: r.score!.recovery_score,
      hrv_ms: r.score!.hrv_rmssd_milli,
      resting_heart_rate: r.score!.resting_heart_rate,
      skin_temp_celsius: r.score!.skin_temp_celsius ?? null,
      spo2_percentage: r.score!.spo2_percentage ?? null,
      raw_payload: r,
    }));
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin.from('recovery_metrics').upsert(rows, { onConflict: 'user_id,whoop_cycle_id' });
  if (error) throw new Error(`recovery_metrics upsert failed: ${error.message}`);
  return rows.length;
}

async function upsertSleeps(userId: string, sleeps: WhoopSleepRecord[]) {
  const rows = sleeps
    .filter((s) => s.score_state === 'SCORED' && s.score)
    .map((s) => {
      const stages = s.score!.stage_summary;
      const totalSleepMs = stages.total_light_sleep_time_milli + stages.total_slow_wave_sleep_time_milli + stages.total_rem_sleep_time_milli;
      return {
        user_id: userId,
        whoop_sleep_uuid: s.id,
        whoop_cycle_id: s.cycle_id,
        is_nap: s.nap,
        date: s.end.slice(0, 10),
        start_time: s.start,
        end_time: s.end,
        sleep_performance_percentage: s.score!.sleep_performance_percentage,
        sleep_consistency_percentage: s.score!.sleep_consistency_percentage,
        sleep_efficiency_percentage: s.score!.sleep_efficiency_percentage,
        respiratory_rate: s.score!.respiratory_rate,
        total_sleep_minutes: msToMinutes(totalSleepMs),
        raw_payload: s,
      };
    });
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin.from('sleep_metrics').upsert(rows, { onConflict: 'user_id,whoop_sleep_uuid' });
  if (error) throw new Error(`sleep_metrics upsert failed: ${error.message}`);
  return rows.length;
}

async function upsertCycles(userId: string, cycles: WhoopCycleRecord[]) {
  const rows = cycles
    .filter((c) => c.score_state === 'SCORED' && c.score)
    .map((c) => ({
      user_id: userId,
      whoop_cycle_id: c.id,
      date: c.start.slice(0, 10),
      day_strain: c.score!.strain,
      average_heart_rate: c.score!.average_heart_rate,
      max_heart_rate: c.score!.max_heart_rate,
      kilojoules: c.score!.kilojoule,
      raw_payload: c,
    }));
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin.from('strain_metrics').upsert(rows, { onConflict: 'user_id,whoop_cycle_id' });
  if (error) throw new Error(`strain_metrics upsert failed: ${error.message}`);
  return rows.length;
}

async function upsertWorkouts(userId: string, workouts: WhoopWorkoutRecord[]) {
  const rows = workouts
    .filter((w) => w.score_state === 'SCORED' && w.score)
    .map((w) => ({
      user_id: userId,
      whoop_workout_uuid: w.id,
      sport_name: w.sport_name,
      start_time: w.start,
      end_time: w.end,
      strain: w.score!.strain,
      average_heart_rate: w.score!.average_heart_rate,
      max_heart_rate: w.score!.max_heart_rate,
      raw_payload: w,
    }));
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin.from('workouts').upsert(rows, { onConflict: 'user_id,whoop_workout_uuid' });
  if (error) throw new Error(`workouts upsert failed: ${error.message}`);
  return rows.length;
}
