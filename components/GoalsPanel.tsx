// components/GoalsPanel.tsx

'use client';

import { useState } from 'react';

interface Goal {
  id: string;
  title: string;
  status: string;
}

interface GoalsPanelProps {
  goals: Goal[];
  onAddGoal: (title: string) => void;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--paper-raised)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius)',
  padding: '12px 14px',
};

export function GoalsPanel({ goals, onAddGoal }: GoalsPanelProps) {
  const [title, setTitle] = useState('');
  const active = goals.filter((g) => g.status === 'active');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAddGoal(title.trim());
    setTitle('');
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {active.length === 0 && <p style={{ color: 'var(--ink-faint)', fontSize: 14 }}>No goals yet.</p>}
        {active.map((g) => (
          <div key={g.id} style={cardStyle}>
            <span style={{ fontSize: 14 }}>{g.title}</span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a goal..."
          style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 14, background: 'var(--paper-raised)' }}
        />
        <button type="submit" style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)', color: 'var(--teal)', borderRadius: 'var(--radius)', padding: '8px 16px', fontSize: 14 }}>
          Add
        </button>
      </form>
    </div>
  );
}
