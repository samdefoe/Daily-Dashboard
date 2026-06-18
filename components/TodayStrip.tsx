// components/TodayStrip.tsx
//
// The signature visual: health, recovery, and productivity rendered as
// one connected instrument rather than three isolated gauges. A shared
// horizontal baseline runs underneath all three, with each score as a
// raised marker on it — asserting these are three readings off the same
// person on the same day, not three disconnected widgets.

interface Rating {
  label: string;
  value: number | null;
  colorVar: string;
  dimVar: string;
}

interface TodayStripProps {
  health: number | null;
  recovery: number | null;
  productivity: number | null;
}

function colorFor(value: number | null): { colorVar: string; dimVar: string } {
  if (value === null) return { colorVar: 'var(--ink-faint)', dimVar: 'transparent' };
  if (value >= 67) return { colorVar: 'var(--moss)', dimVar: 'var(--moss-dim)' };
  if (value >= 34) return { colorVar: 'var(--ochre)', dimVar: 'var(--ochre-dim)' };
  return { colorVar: 'var(--clay)', dimVar: 'var(--clay-dim)' };
}

export function TodayStrip({ health, recovery, productivity }: TodayStripProps) {
  const ratings: Rating[] = [
    { label: 'recovery', value: recovery, ...colorFor(recovery) },
    { label: 'health', value: health, ...colorFor(health) },
    { label: 'productivity', value: productivity, ...colorFor(productivity) },
  ];

  return (
    <div style={{ position: 'relative', padding: '8px 0 0' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 86, height: 1, background: 'var(--line)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {ratings.map((r) => (
          <div key={r.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className="num" style={{ fontSize: 56, fontWeight: 500, color: r.value === null ? 'var(--ink-faint)' : 'var(--ink)', lineHeight: 1 }}>
              {r.value !== null ? r.value : '–'}
            </span>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: r.colorVar,
                marginTop: 14,
                marginBottom: 10,
                boxShadow: `0 0 0 6px ${r.dimVar}`,
                position: 'relative',
                zIndex: 1,
              }}
            />
            <span style={{ fontSize: 13, color: 'var(--ink-soft)', letterSpacing: '0.02em' }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
