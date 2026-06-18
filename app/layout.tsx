// app/layout.tsx
import './globals.css';

export const metadata = {
  title: 'Daily readiness',
  description: 'Health, recovery, and productivity ratings with goal-aware task suggestions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
