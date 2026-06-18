// app/login/page.tsx

'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/` } });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div style={{ maxWidth: 360, margin: '6rem auto', padding: '0 1.5rem' }}>
      <h1 className="num" style={{ fontSize: 24, fontWeight: 500, marginBottom: 20 }}>
        Sign in
      </h1>
      {sent ? (
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Check your email for a sign-in link.</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 14, background: 'var(--paper-raised)' }}
          />
          <button type="submit" style={{ background: 'var(--teal)', color: 'var(--paper)', border: 'none', borderRadius: 'var(--radius)', padding: '10px 16px', fontSize: 14 }}>
            Send sign-in link
          </button>
          {error && <p style={{ color: 'var(--clay)', fontSize: 13 }}>{error}</p>}
        </form>
      )}
    </div>
  );
}
