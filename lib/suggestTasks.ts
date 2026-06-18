// lib/suggestTasks.ts
//
// Builds suggestions for tomorrow's to-do list from three inputs: how
// much free time tomorrow actually has (calendar), what you're working
// toward (goals), and how recovered you are (Whoop) — a low-recovery day
// gets lighter suggestions. This produces SUGGESTIONS, not auto-created
// tasks — the user reviews and accepts/edits/discards them.

import { getRecoveryZone } from './recoveryZone';

export interface SuggestionInputs {
  freeMinutesTomorrow: number;
  recoveryScore: number | null;
  activeGoals: { id: string; title: string }[];
}

export interface TaskSuggestion {
  title: string;
  goal_id: string | null;
  effort_level: number;
  reason: string;
}

export function generateTaskSuggestions(inputs: SuggestionInputs): TaskSuggestion[] {
  const { freeMinutesTomorrow, recoveryScore, activeGoals } = inputs;
  const zone = getRecoveryZone(recoveryScore);
  const suggestions: TaskSuggestion[] = [];

  const capacityMultiplier = zone === 'green' ? 1 : zone === 'yellow' ? 0.7 : zone === 'red' ? 0.4 : 0.7;
  const usableMinutes = freeMinutesTomorrow * capacityMultiplier;
  const suggestedTaskCount = Math.max(1, Math.min(6, Math.round(usableMinutes / 90)));
  const maxEffortLevel = zone === 'green' ? 5 : zone === 'yellow' ? 3 : 2;

  if (activeGoals.length === 0) {
    suggestions.push({
      title: 'Set a goal to get tailored task suggestions',
      goal_id: null,
      effort_level: 1,
      reason: 'No active goals yet — suggestions will connect to your goals once you add one.',
    });
    return suggestions;
  }

  for (let i = 0; i < suggestedTaskCount; i++) {
    const goal = activeGoals[i % activeGoals.length];
    suggestions.push({
      title: `Work toward: ${goal.title}`,
      goal_id: goal.id,
      effort_level: Math.min(maxEffortLevel, 3),
      reason: buildReason(zone, freeMinutesTomorrow),
    });
  }

  return suggestions;
}

function buildReason(zone: ReturnType<typeof getRecoveryZone>, freeMinutes: number): string {
  const hours = Math.round((freeMinutes / 60) * 10) / 10;
  if (zone === 'red') return `Recovery looks low — keeping tomorrow's suggested load light despite ~${hours}h free.`;
  if (zone === 'green') return `Recovery looks strong and you have ~${hours}h free — a good day to push on goals.`;
  return `~${hours}h free tomorrow — moderate suggested load based on today's recovery.`;
}
