# Daily dashboard — setup guide

A dashboard showing daily health, recovery, and productivity ratings, plus
goals and a to-do list that gets suggestions based on your calendar, your
goals, and your recovery. Three external accounts are required and none of
them can be created on your behalf — each needs your own login.

## 1. Supabase (the database)
1. Create a project at https://supabase.com.
2. In the SQL Editor, run `supabase/migrations/001_schema.sql`. This creates
   all tables (Whoop data, Google credentials, goals, tasks, daily scores).
3. Authentication > Providers: Email should already be enabled (used for the
   magic-link sign-in).
4. Project Settings > API: copy the Project URL, `anon` key, and
   `service_role` key — you'll need all three below.

## 2. Whoop developer app
1. Sign in at https://developer-dashboard.whoop.com and create a new app.
2. Note the Client ID and Client Secret.
3. Set Redirect URL to `https://YOUR-DOMAIN.vercel.app/api/whoop/callback`
   (a placeholder like `http://localhost:3000/api/whoop/callback` works
   until you have a real deployed domain — update it after deploying).
4. Request scopes: `read:recovery`, `read:cycles`, `read:sleep`,
   `read:workout`, `read:profile`, `offline`.

## 3. Google Cloud OAuth app (for Calendar access)
1. Go to https://console.cloud.google.com and create a new project (or use
   an existing one).
2. APIs & Services > Library: search for "Google Calendar API" and enable it.
3. APIs & Services > Credentials > Create Credentials > OAuth client ID.
   - Application type: Web application.
   - Authorized redirect URI: `https://YOUR-DOMAIN.vercel.app/api/google/callback`
     (same placeholder-then-update approach as Whoop above).
4. You'll be prompted to configure the OAuth consent screen first if you
   haven't already — choose "External" unless you have a Google Workspace
   account, fill in the required app name/support email, and add your own
   email under "test users" (this lets you use the app yourself while it's
   in testing mode, without needing Google's full app review).
5. Note the Client ID and Client Secret from the credential you created.

This app only ever requests read-only calendar access (`calendar.readonly`)
and only checks free/busy — it cannot see event titles, create events, or
modify your calendar in any way.

## 4. Deploy to Vercel
1. Push this folder to a GitHub repo, or run `npx vercel` from inside it.
2. Set environment variables in Vercel (see `.env.example` for the full
   list): the five Supabase values, `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET`
   / `WHOOP_REDIRECT_URI`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` /
   `GOOGLE_REDIRECT_URI`, and `CRON_SECRET` (generate with
   `openssl rand -hex 32`).
3. Deploy. Once you know your real `.vercel.app` domain, go back to both the
   Whoop developer dashboard and the Google Cloud credential and update the
   redirect URIs if you used placeholders.
4. Visit the site, sign in via the emailed magic link.
5. You'll land on a "what are your goals" screen first — this only happens
   once. After that, connect Whoop and Google Calendar from the banners on
   the dashboard.

## What happens automatically vs. on demand
A daily cron job (configured in `vercel.json`, runs at 5am UTC) syncs Whoop
data and recomputes your three scores for every connected user. Google
Calendar is NOT synced on a schedule — it's checked live, on the spot,
whenever the dashboard loads or you ask for task suggestions, since
busy/free data is only useful in the moment.

## How the three scores are calculated
All three formulas live in `lib/scoring.ts`, written as plain readable
functions specifically so you can see why a score came out the way it did
and adjust the logic later without needing to understand the rest of the
codebase.

Recovery score comes from sleep-driven Whoop metrics: recovery %, sleep
performance, sleep efficiency, and sleep consistency, weighted toward
Whoop's own recovery % since it already synthesizes HRV and resting heart
rate.

Health score comes from the broader vitals: strain (scaled 0-21 to 0-100),
resting heart rate and skin temperature compared against your own rolling
baseline rather than a generic population number, and SpO2.

Productivity score is your task completion rate for tasks due today or
earlier. It shows as empty (not zero) until you've used the to-do list for
a few days, since no data isn't the same as a bad day.

## Accuracy notes
Whoop API endpoint paths and response shapes were verified against
developer.whoop.com's live documentation, and the Google Calendar freeBusy
endpoint was verified against developers.google.com, both as of mid-2026 —
not just general training knowledge, since both APIs have changed
structurally before. If something stops working, those two pages are the
first place to check.
