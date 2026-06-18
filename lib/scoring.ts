// lib/scoring.ts
//
// The three daily ratings, as plain readable functions — not machine
// learning, just transparent math, so it's easy to see why a score came
// out the way it did and adjust later. Per the agreed split:
//
//   Recovery score = sleep-driven metrics (how well you rested):
//     Whoop recovery %, HRV, sleep performance/efficiency/consistency.
//
//   Health score = the broader vitals (how your body is doing overall,
//     including load/stress, not just rest): strain, resting heart rate,
//     SpO2, skin temperature.
//
//   Productivity score = task/goal completion rate. Starts at null
//     (not zero) when there's no task history yet, since "no data" and
//     "did badly" are different things and shouldn't look the same.

export interface RecoveryInputs {
  whoopRecoveryPercent: number | null;
  hrvMs: number | null;
  sleepPerformancePercent: number | null;
  sleepEfficiencyPercent: number | null;
  sleepConsistencyPercent: number | null;
}

export interface HealthInputs {
  dayStrain: number | null; // 0-21 Whoop scale
  restingHeartRate: number | null;
  spo2Percentage: number | null;
  skinTempCelsius: number | null;
  // A short rolling baseline lets us judge "is this normal for you,"
  // rather than judging resting HR/skin temp against a generic population
  // number, which wouldn't mean much for an individual.
  restingHeartRateBaseline: number | null;
  skinTempBaseline: number | null;
}

export interface ProductivityInputs {
  tasksCompleted: number;
  tasksTotal: number; // tasks due today or earlier, regardless of status
}

/**
 * Recovery score: 0-100. Weighted toward Whoop's own recovery % (it
 * already synthesizes HRV + resting HR + sleep into one number), with
 * sleep performance as a meaningful secondary signal, since recovery %
 * alone can mask a night of poor sleep that hasn't yet shown up in HRV.
 */
export function calculateRecoveryScore(inputs: RecoveryInputs): number | null {
  const { whoopRecoveryPercent, sleepPerformancePercent, sleepEfficiencyPercent, sleepConsistencyPercent } = inputs;

  if (whoopRecoveryPercent === null && sleepPerformancePercent === null) {
    return null; // no usable data yet
  }

  const weighted: { value: number; weight: number }[] = [];
  if (whoopRecoveryPercent !== null) weighted.push({ value: whoopRecoveryPercent, weight: 0.5 });
  if (sleepPerformancePercent !== null) weighted.push({ value: sleepPerformancePercent, weight: 0.3 });
  if (sleepEfficiencyPercent !== null) weighted.push({ value: sleepEfficiencyPercent, weight: 0.1 });
  if (sleepConsistencyPercent !== null) weighted.push({ value: sleepConsistencyPercent, weight: 0.1 });

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  const weightedSum = weighted.reduce((sum, w) => sum + w.value * w.weight, 0);

  return Math.round(weightedSum / totalWeight);
}

/**
 * Health score: 0-100. Strain alone isn't "good" or "bad" (high strain
 * from a hard workout is a positive sign of activity), so strain
 * contributes to the score as "did you have meaningful activity today,"
 * scaled 0-21 -> 0-100, while resting HR and skin temp are scored
 * relative to YOUR OWN recent baseline (a deviation from your norm
 * matters more than the absolute number) rather than a generic "normal
 * range," which wouldn't account for individual variation.
 */
export function calculateHealthScore(inputs: HealthInputs): number | null {
  const { dayStrain, restingHeartRate, spo2Percentage, skinTempCelsius, restingHeartRateBaseline, skinTempBaseline } =
    inputs;

  if (dayStrain === null && restingHeartRate === null) {
    return null;
  }

  const components: { value: number; weight: number }[] = [];

  if (dayStrain !== null) {
    components.push({ value: (dayStrain / 21) * 100, weight: 0.35 });
  }

  if (restingHeartRate !== null && restingHeartRateBaseline !== null) {
    // Lower resting HR than your own baseline = good; we cap the penalty
    // so one rough night doesn't tank the score disproportionately.
    const deviation = restingHeartRate - restingHeartRateBaseline;
    const penalty = Math.min(Math.max(deviation * 3, -20), 30); // each bpm above baseline costs ~3 points, capped
    components.push({ value: Math.max(0, 100 - penalty), weight: 0.35 });
  } else if (restingHeartRate !== null) {
    // No baseline yet (e.g. first week of use) — neutral placeholder score.
    components.push({ value: 70, weight: 0.35 });
  }

  if (spo2Percentage !== null) {
    // SpO2 below ~95% is a genuine signal worth penalizing more steeply.
    components.push({ value: spo2Percentage >= 95 ? 100 : Math.max(0, (spo2Percentage / 95) * 100 - 20), weight: 0.15 });
  }

  if (skinTempCelsius !== null && skinTempBaseline !== null) {
    const deviation = Math.abs(skinTempCelsius - skinTempBaseline);
    components.push({ value: Math.max(0, 100 - deviation * 25), weight: 0.15 }); // large deviations (possible illness) penalized
  }

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + c.value * c.weight, 0);

  return Math.round(weightedSum / totalWeight);
}

/**
 * Productivity score: 0-100, simple completion rate. Returns null (not
 * 0) when there are no tasks due yet, since an empty to-do list isn't
 * the same as a failed day — there's just nothing to measure.
 */
export function calculateProductivityScore(inputs: ProductivityInputs): number | null {
  if (inputs.tasksTotal === 0) return null;
  return Math.round((inputs.tasksCompleted / inputs.tasksTotal) * 100);
}
