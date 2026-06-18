// app/onboarding/page.tsx
//
// First-run experience: asks "what are your goals right now," saves
// each one, then marks onboarding complete and sends the user to the
// dashboard. Meant to feel like a single honest question, not a
// multi-step signup wizard.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [goalInputs, setGoalInputs] = useState(['', '', '']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateGoal(index: number, value: string) {
    setGoalInputs((prev) => prev.map((g, i) => (i === index ? value : g)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const goals = goalInputs.map((g) => g.trim()).filter(Boolean);
    if (goals.length === 0) {
      setError('Add at least one goal to get started.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      for (const title of goals) {
        const res = await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
        if (!res.ok) throw new Error('Failed to save a goal.');
      }
      const onboardRes = await fetch('/api/onboarding', { method: 'POST' });
      if (!onboardRes.ok) throw new Error('Failed to complete setup.');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: '5rem auto', padding: '0 1.5rem' }}>
      <h1 className="num" style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>
        What are your goals right now?
      </h1>
      <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
        Add a few — these connect to the daily task suggestions you'll see going forward. You can add more or edit these anytime.
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {goalInputs.map((value, i) => (
            <input
              key={i}
              value={value}
              onChange={(e) => updateGoal(i, e.target.value)}
              placeholder={i === 0 ? 'e.g. Run a half marathon' : 'Another goal (optional)'}
              style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 14, background: 'var(--paper-raised)' }}
            />
          ))}
        </div>
        {error && <p style={{ color: 'var(--clay)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button
          type="submit"
          disabled={saving}
          style={{ background: 'var(--teal)', color: 'var(--paper)', border: 'none', borderRadius: 'var(--radius)', padding: '12px 20px', fontSize: 14, width: '100%' }}
        >
          {saving ? 'Saving...' : 'Save and continue'}
        </button>
      </form>
    </div>
  );
}
