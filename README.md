# Daily dashboard

Health, recovery, and productivity ratings in one view, with goals and a
to-do list that gets daily suggestions based on your Google Calendar
availability, your goals, and today's Whoop recovery.

See `docs/SETUP.md` to deploy this — start there.

## Structure
- `supabase/migrations/` — full database schema
- `lib/` — Whoop client, Google Calendar client, sync logic, scoring
  formulas (`scoring.ts`), and task suggestion logic
- `app/` — Next.js pages and API routes
- `components/` — dashboard UI (TodayStrip is the signature visual)
