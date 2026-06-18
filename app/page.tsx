// app/page.tsx
//
// Main dashboard: redirects to onboarding if goals haven't been set up
// yet, otherwise shows the TodayStrip, connect-account prompts if
// Whoop/Google aren't linked, and the goals/tasks panels with suggestions.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TodayStrip } from '@/components/TodayStrip';
import { GoalsPanel } from '@/components/GoalsPanel';
import { TasksPanel } from '@/components/TasksPanel';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<{ health_score: number | null; recovery_score: number | null; productivity_score: number | null } | null>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [calendarWarning, setCalendarWarning] = useState<string | undefined>();
  const [whoopConnected, setWhoopConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const onboardingRes = await fetch('/api/onboarding');
      if (!onboardingRes.ok) throw new Error('Failed to check setup status.');
      const { onboarded } = await onboardingRes.json();
      if (!onboarded) {
        router.push('/onboarding');
        return;
      }

      const [scoresRes, goalsRes, tasksRes, suggestionsRes] = await Promise.all([
        fetch('/api/scores'),
        fetch('/api/goals'),
        fetch('/api/tasks'),
        fetch('/api/tasks/suggestions'),
      ]);

      const scoresBody = await scoresRes.json();
      const goalsBody = await goalsRes.json();
      const tasksBody = await tasksRes.json();
      const suggestionsBody = await suggestionsRes.json();

      setScores(scoresBody.todayScore ?? { health_score: null, recovery_score: null, productivity_score: null });
      setGoals(goalsBody.goals ?? []);
      setTasks(tasksBody.tasks ?? []);
      setSuggestions(suggestionsBody.suggestions ?? []);
      setCalendarWarning(suggestionsBody.calendarWarning);
      setWhoopConnected(Boolean(scoresBody.whoopConnected));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch('/api/whoop/sync-now', { method: 'POST' });
      await loadAll();
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggleDone(id: string, currentStatus: string) {
    const nextStatus = currentStatus === 'done' ? 'open' : 'done';
    const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
    if (res.ok) {
      const { task } = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
      const scoresRes = await fetch('/api/scores');
      const scoresBody = await scoresRes.json();
      setScores(scoresBody.todayScore);
    }
  }

  async function handleAddTask(title: string) {
    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    if (res.ok) {
      const { task } = await res.json();
      setTasks((prev) => [...prev, task]);
    }
  }

  async function handleAddGoal(title: string) {
    const res = await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    if (res.ok) {
      const { goal } = await res.json();
      setGoals((prev) => [goal, ...prev]);
    }
  }

  async function handleAcceptSuggestion(s: { title: string; goal_id: string | null; effort_level: number }) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: s.title, goal_id: s.goal_id, effort_level: s.effort_level, source: 'suggested' }),
    });
    if (res.ok) {
      const { task } = await res.json();
      setTasks((prev) => [...prev, task]);
    }
  }

  if (loading) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 36 }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink-soft)', margin: 0, letterSpacing: '0.02em' }}>TODAY</h1>
        <button onClick={handleSync} disabled={syncing} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '6px 14px', fontSize: 13, color: 'var(--ink-soft)' }}>
          {syncing ? 'Syncing...' : 'Sync now'}
        </button>
      </header>

      {error && <p style={{ color: 'var(--clay)', marginBottom: 16, fontSize: 14 }}>{error}</p>}

      {!whoopConnected && (
        <div style={{ background: 'var(--ochre-dim)', border: '1px solid var(--ochre)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>Connect Whoop to see health and recovery ratings.</span>
          <a href="/api/whoop/login" style={{ fontSize: 13, fontWeight: 500 }}>Connect →</a>
        </div>
      )}

      <section style={{ marginBottom: 48 }}>
        <TodayStrip health={scores?.health_score ?? null} recovery={scores?.recovery_score ?? null} productivity={scores?.productivity_score ?? null} />
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 14, color: 'var(--ink-soft)', letterSpacing: '0.03em', marginBottom: 12 }}>GOALS</h2>
        <GoalsPanel goals={goals} onAddGoal={handleAddGoal} />
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, color: 'var(--ink-soft)', letterSpacing: '0.03em', margin: 0 }}>TASKS</h2>
          <a href="/api/google/login" style={{ fontSize: 12, color: 'var(--teal)' }}>
            {calendarWarning ? 'Connect calendar' : 'Calendar connected'}
          </a>
        </div>
        <TasksPanel
          tasks={tasks}
          suggestions={suggestions}
          calendarWarning={calendarWarning}
          onToggleDone={handleToggleDone}
          onAddTask={handleAddTask}
          onAcceptSuggestion={handleAcceptSuggestion}
        />
      </section>
    </div>
  );
}
