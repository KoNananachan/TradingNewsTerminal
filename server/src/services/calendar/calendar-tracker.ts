import { prisma } from '../../lib/prisma.js';
import { broadcastCalendarRelease } from '../websocket/ws-server.js';
import { fetchEconomicCalendar } from './fmp-calendar.js';

const POLL_INTERVAL = 15 * 60_000; // 15 minutes
let intervalId: ReturnType<typeof setInterval> | null = null;

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function pollCalendar() {
  try {
    const now = new Date();
    const from = toDateString(now);
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
    const to = toDateString(future);

    const events = await fetchEconomicCalendar(from, to);
    if (events.length === 0) return;

    console.log(`[CalendarTracker] Fetched ${events.length} events`);

    for (const event of events) {
      const externalId = `${event.event}-${event.country}-${event.date}`;
      const eventDate = new Date(event.date);

      // Check if this event already exists
      const existing = await prisma.economicEvent.findUnique({
        where: { externalId },
      });

      const hasNewActual = !existing?.released && event.actual != null && event.actual !== '';
      const released = event.actual != null && event.actual !== '';

      await prisma.economicEvent.upsert({
        where: { externalId },
        create: {
          externalId,
          event: event.event,
          country: event.country,
          date: eventDate,
          impact: event.impact || 'low',
          actual: event.actual,
          previous: event.previous,
          estimate: event.estimate,
          released,
        },
        update: {
          actual: event.actual,
          previous: event.previous,
          estimate: event.estimate,
          released,
        },
      });

      // Broadcast when an event gets a new actual value
      if (hasNewActual) {
        broadcastCalendarRelease({
          externalId,
          event: event.event,
          country: event.country,
          date: event.date,
          impact: event.impact,
          actual: event.actual,
          previous: event.previous,
          estimate: event.estimate,
        });
        console.log(`[CalendarTracker] New release: ${event.event} (${event.country}) = ${event.actual}`);
      }
    }
  } catch (err) {
    console.error('[CalendarTracker] Error polling calendar:', err instanceof Error ? err.message : err);
  }
}

export function startCalendarTracker() {
  console.log('[CalendarTracker] Starting calendar tracker (15min interval)');
  pollCalendar(); // immediate first run
  intervalId = setInterval(pollCalendar, POLL_INTERVAL);
}

export function stopCalendarTracker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
