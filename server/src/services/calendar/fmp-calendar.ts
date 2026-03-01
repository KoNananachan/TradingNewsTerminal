// Economic calendar data service
// Uses Forex Factory's free JSON feed as primary source

export interface FmpEconomicEvent {
  event: string;
  country: string;
  date: string;
  impact: string;
  actual: string | null;
  previous: string | null;
  estimate: string | null;
}

interface FFEvent {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  actual?: string;
  previous?: string;
  forecast?: string;
}

let cache: { data: FmpEconomicEvent[]; expiresAt: number } | null = null;

export async function fetchEconomicCalendar(_from: string, _to: string): Promise<FmpEconomicEvent[]> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  try {
    // Fetch this week + next week
    const urls = [
      'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
      'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
    ];

    const allEvents: FmpEconomicEvent[] = [];

    for (const url of urls) {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;

      const events: FFEvent[] = await res.json();
      if (!Array.isArray(events)) continue;

      for (const e of events) {
        if (!e.title || !e.date) continue;

        // Map FF impact to standard levels
        let impact = 'low';
        if (e.impact === 'High') impact = 'high';
        else if (e.impact === 'Medium') impact = 'medium';

        allEvents.push({
          event: e.title,
          country: mapCountry(e.country || ''),
          date: e.date,
          impact,
          actual: e.actual || null,
          previous: e.previous || null,
          estimate: e.forecast || null,
        });
      }
    }

    console.log(`[Calendar] Fetched ${allEvents.length} events from Forex Factory`);

    cache = { data: allEvents, expiresAt: Date.now() + 30 * 60_000 }; // 30 min cache
    return allEvents;
  } catch (err) {
    console.error('[Calendar] Error fetching calendar:', err instanceof Error ? err.message : err);
    return cache?.data ?? [];
  }
}

// Map currency codes to country names
function mapCountry(code: string): string {
  const map: Record<string, string> = {
    USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', CNY: 'CN',
    AUD: 'AU', CAD: 'CA', CHF: 'CH', NZD: 'NZ', SEK: 'SE',
    NOK: 'NO', MXN: 'MX', BRL: 'BR', KRW: 'KR', INR: 'IN',
    SGD: 'SG', HKD: 'HK', TRY: 'TR', ZAR: 'ZA', PLN: 'PL',
  };
  return map[code] || code;
}
