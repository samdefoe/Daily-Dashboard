// lib/recoveryZone.ts
//
// Whoop's own recovery zone breakpoints (green/yellow/red), reused here
// since they're a meaningful, body-calibrated threshold rather than one
// we'd be inventing arbitrarily.

export type RecoveryZone = 'green' | 'yellow' | 'red' | 'unknown';

export function getRecoveryZone(recoveryScore: number | null): RecoveryZone {
  if (recoveryScore === null) return 'unknown';
  if (recoveryScore >= 67) return 'green';
  if (recoveryScore >= 34) return 'yellow';
  return 'red';
}
