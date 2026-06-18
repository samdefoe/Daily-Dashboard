// lib/syncGoogleCalendar.ts
//
// Fetches free/busy info for today and tomorrow and returns it directly
// (not stored long-term in a table, since busy blocks are only useful in
// the very near term for building tomorrow's to-do list — storing a
// growing history of calendar busy blocks wouldn't serve any purpose
// this app has).

import { supabaseAdmin } from './supabaseAdmin';
import { refreshGoogleToken, fetchBusyBlocks, calculateFreeMinutes, BusyBlock } from './googleCalendarClient';

async function getValidGoogleToken(userId: string): Promise<string> {
  const { data: creds, error } = await supabaseAdmin.from('google_credentials').select('*').eq('user_id', userId).single();
  if (error || !creds) throw new Error('No Google Calendar credentials found. Has the user connected it?');

  if (Date.now() < new Date(creds.token_expires_at).getTime() - 5 * 60 * 1000) {
    return creds.access_token;
  }

  const refreshed = await refreshGoogleToken(creds.refresh_token);
  await supabaseAdmin
    .from('google_credentials')
    .update({
      access_token: refreshed.access_token,
      // Google often omits refresh_token on refresh calls — only overwrite if a new one was actually returned.
      ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq('user_id', userId);

  return refreshed.access_token;
}

export interface DayAvailability {
  date: string;
  freeMinutes: number;
  busyBlocks: BusyBlock[];
}

/** Returns calendar availability for today and tomorrow, used when building the next day's to-do list. */
export async function getCalendarAvailability(userId: string): Promise<{ today: DayAvailability; tomorrow: DayAvailability } | { error: string }> {
  try {
    const accessToken = await getValidGoogleToken(userId);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterStart = new Date(tomorrowStart);
    dayAfterStart.setDate(dayAfterStart.getDate() + 1);

    const busyBlocks = await fetchBusyBlocks(accessToken, todayStart.toISOString(), dayAfterStart.toISOString());

    const todayBusy = busyBlocks.filter((b) => new Date(b.start) < tomorrowStart);
    const tomorrowBusy = busyBlocks.filter((b) => new Date(b.start) >= tomorrowStart);

    await supabaseAdmin.from('sync_log').insert({ user_id: userId, source: 'google_calendar', status: 'success', records_synced: busyBlocks.length });

    return {
      today: {
        date: todayStart.toISOString().slice(0, 10),
        freeMinutes: calculateFreeMinutes(now, tomorrowStart, todayBusy), // remaining today, from now
        busyBlocks: todayBusy,
      },
      tomorrow: {
        date: tomorrowStart.toISOString().slice(0, 10),
        freeMinutes: calculateFreeMinutes(tomorrowStart, dayAfterStart, tomorrowBusy),
        busyBlocks: tomorrowBusy,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await supabaseAdmin.from('sync_log').insert({ user_id: userId, source: 'google_calendar', status: 'error', error_message: errorMessage });
    return { error: errorMessage };
  }
}
