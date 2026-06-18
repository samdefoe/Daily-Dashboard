// lib/computeDailyScore.ts
//
// Computes and stores today's health/recovery/productivity scores for a
// user. Pulls a 14-day window to establish resting-HR and skin-temp
// baselines (averages over the prior days, excluding today, so today
// isn't compared against itself), then scores today against that.

import { supabaseAdmin } from './supabaseAdmin';
import { calculateRecoveryScore, calculateHealthScore, calculateProductivityScore } from './scoring';

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function computeDailyScoreForUser(userId: string, date: string = new Date().toISOString().slice(0, 10)) {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [recoveryRows, sleepRows, strainRows] = await Promise.all([
    supabaseAdmin
      .from('recovery_metrics')
      .select('date, recovery_score, hrv_ms, resting_heart_rate, skin_temp_celsius, spo2_percentage')
      .eq('user_id', userId)
      .gte('date', fourteenDaysAgo)
      .order('date', { ascending: true }),
    supabaseAdmin
      .from('sleep_metrics')
      .select('date, sleep_performance_percentage, sleep_efficiency_percentage, sleep_consistency_percentage')
      .eq('user_id', userId)
      .eq('is_nap', false)
      .gte('date', fourteenDaysAgo)
      .order('date', { ascending: true }),
    supabaseAdmin
      .from('strain_metrics')
      .select('date, day_strain')
      .eq('user_id', userId)
      .gte('date', fourteenDaysAgo)
      .order('date', { ascending: true }),
  ]);

  const todayRecovery = recoveryRows.data?.find((r) => r.date === date) ?? null;
  const todaySleep = sleepRows.data?.find((s) => s.date === date) ?? null;
  const todayStrain = strainRows.data?.find((s) => s.date === date) ?? null;

  const priorRestingHRs = (recoveryRows.data ?? [])
    .filter((r) => r.date !== date && r.resting_heart_rate !== null)
    .map((r) => r.resting_heart_rate as number);
  const priorSkinTemps = (recoveryRows.data ?? [])
    .filter((r) => r.date !== date && r.skin_temp_celsius !== null)
    .map((r) => r.skin_temp_celsius as number);

  const recoveryScore = calculateRecoveryScore({
    whoopRecoveryPercent: todayRecovery?.recovery_score ?? null,
    hrvMs: todayRecovery?.hrv_ms ?? null,
    sleepPerformancePercent: todaySleep?.sleep_performance_percentage ?? null,
    sleepEfficiencyPercent: todaySleep?.sleep_efficiency_percentage ?? null,
    sleepConsistencyPercent: todaySleep?.sleep_consistency_percentage ?? null,
  });

  const healthScore = calculateHealthScore({
    dayStrain: todayStrain?.day_strain ?? null,
    restingHeartRate: todayRecovery?.resting_heart_rate ?? null,
    spo2Percentage: todayRecovery?.spo2_percentage ?? null,
    skinTempCelsius: todayRecovery?.skin_temp_celsius ?? null,
    restingHeartRateBaseline: average(priorRestingHRs),
    skinTempBaseline: average(priorSkinTemps),
  });

  const { data: tasksDueToday } = await supabaseAdmin
    .from('tasks')
    .select('status')
    .eq('user_id', userId)
    .lte('due_date', date)
    .neq('status', 'cancelled');

  const tasksTotal = tasksDueToday?.length ?? 0;
  const tasksCompleted = tasksDueToday?.filter((t) => t.status === 'done').length ?? 0;
  const productivityScore = calculateProductivityScore({ tasksCompleted, tasksTotal });

  const { error } = await supabaseAdmin
    .from('daily_scores')
    .upsert(
      { user_id: userId, date, health_score: healthScore, recovery_score: recoveryScore, productivity_score: productivityScore },
      { onConflict: 'user_id,date' }
    );

  if (error) throw new Error(`Failed to store daily score: ${error.message}`);

  return { date, healthScore, recoveryScore, productivityScore };
}
