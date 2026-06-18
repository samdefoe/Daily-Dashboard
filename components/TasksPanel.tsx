// components/TasksPanel.tsx
//
// Shows existing tasks plus, separately, suggested tasks for tomorrow —
// kept visually distinct (dashed border, "suggested" label) so it's
// always clear which tasks were chosen by the user vs proposed by the
// system, and suggestions never join the real list until accepted.

'use client';

import { useState } from 'react';

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
}

interface Suggestion {
  title: string;
  goal_id: string | null;
  effort_level: number;
  reason: string;
}

interface TasksPanelProps {
  tasks: Task[];
  suggestions: Suggestion[];
  calendarWarning?: string;
  onToggleDone: (id: string, currentStatus: string) => void;
  onAddTask: (title: string) => void;
  onAcceptSuggestion: (s: Suggestion) => void;
}

export function TasksPanel({ tasks, suggestions, calendarWarning, onToggleDone, onAddTask, onAcceptSuggestion }: TasksPanelProps) {
  const [title, setTitle] = useState('');
  const [acceptedTitles, setAcceptedTitles] = useState<Set<string>>(new Set());
  const openTasks = tasks.filter((t) => t.status !== 'cancelled');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAddTask(title.trim());
    setTitle('');
  }

  function handleAccept(s: Suggestion) {
    onAcceptSuggestion(s);
    setAcceptedTitles((prev) => new Set(prev).add(s.title));
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {openTasks.length === 0 && <p style={{ color: 'var(--ink-faint)', fontSize: 14 }}>No tasks yet.</p>}
        {openTasks.map((t) => (
          <label
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--paper-raised)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" checked={t.status === 'done'} onChange={() => onToggleDone(t.id, t.status)} style={{ accentColor: 'var(--moss)' }} />
            <span style={{ fontSize: 14, textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.5 : 1 }}>
              {t.title}
            </span>
          </label>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task..."
          style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 14, background: 'var(--paper-raised)' }}
        />
        <button type="submit" style={{ background: 'var(--moss-dim)', border: '1px solid var(--moss)', color: 'var(--moss)', borderRadius: 'var(--radius)', padding: '8px 16px', fontSize: 14 }}>
          Add
        </button>
      </form>

      <h3 style={{ fontSize: 13, color: 'var(--ink-soft)', letterSpacing: '0.03em', marginBottom: 10 }}>SUGGESTED FOR TOMORROW</h3>
      {calendarWarning && (
        <p style={{ fontSize: 12, color: 'var(--ochre)', marginBottom: 8 }}>
          Calendar not connected — suggestions use a generic time estimate instead.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.map((s, i) => {
          const accepted = acceptedTitles.has(s.title);
          return (
            <div key={i} style={{ border: '1px dashed var(--line)', borderRadius: 'var(--radius)', padding: '10px 14px', opacity: accepted ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{s.title}</span>
                <button onClick={() => handleAccept(s)} disabled={accepted} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, padding: 0 }}>
                  {accepted ? 'Added' : 'Accept →'}
                </button>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>{s.reason}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
