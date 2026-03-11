// Conflict data service
// Uses AI-flagged isConflict articles from the database

import { prisma } from '../../lib/prisma.js';

export interface ConflictEvent {
  name: string;
  lat: number;
  lng: number;
  count: number;
  url: string;
  title: string;
}

interface ConflictCache {
  data: ConflictEvent[];
  expiresAt: number;
}

let conflictCache: ConflictCache | null = null;

export async function fetchConflicts(): Promise<ConflictEvent[]> {
  // Return cached data if still valid
  if (conflictCache && Date.now() < conflictCache.expiresAt) {
    return conflictCache.data;
  }

  console.log('[Conflicts] Fetching conflict data...');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const articles = await prisma.newsArticle.findMany({
    where: {
      isConflict: true,
      latitude: { not: null },
      longitude: { not: null },
      locationName: { not: null },
      scrapedAt: { gte: oneDayAgo },
    },
    select: {
      title: true,
      url: true,
      latitude: true,
      longitude: true,
      locationName: true,
    },
    orderBy: { scrapedAt: 'desc' },
    take: 500,
  });

  console.log(`[Conflicts] DB query returned ${articles.length} conflict articles`);

  // Group by location (~10km grid) to get counts
  const grid = new Map<string, { events: typeof articles; lat: number; lng: number; name: string }>();

  for (const a of articles) {
    if (a.latitude == null || a.longitude == null) continue;
    const name = a.locationName || 'Unknown';
    const key = `${(a.latitude * 10) | 0},${(a.longitude * 10) | 0}`;
    if (!grid.has(key)) {
      grid.set(key, { events: [], lat: a.latitude, lng: a.longitude, name });
    }
    grid.get(key)!.events.push(a);
  }

  const results: ConflictEvent[] = [...grid.values()]
    .map(g => ({
      name: g.name,
      lat: g.lat,
      lng: g.lng,
      count: g.events.length,
      url: g.events[0].url,
      title: g.events[0].title,
    }))
    .sort((a, b) => b.count - a.count);

  // Cache for 10 min if we have data, 2 min if empty
  conflictCache = {
    data: results,
    expiresAt: Date.now() + (results.length > 0 ? 10 * 60 * 1000 : 2 * 60 * 1000),
  };

  console.log(`[Conflicts] Total: ${results.length} conflict zones (cached)`);
  return results;
}
