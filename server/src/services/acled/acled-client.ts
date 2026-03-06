// Conflict data service
// Primary: geopolitics articles from local database (always available)
// Secondary: GDELT GEO 2.0 API (free, no auth — often unreliable/down)

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

// Known active conflict countries/regions (2024-2026)
const CONFLICT_REGIONS = [
  // Eastern Europe
  'ukraine', 'kyiv', 'kharkiv', 'odesa', 'russia', 'moscow', 'crimea',
  // Israel / Palestine
  'israel', 'tel aviv', 'jerusalem', 'gaza', 'palestine', 'west bank',
  // Syria
  'syria', 'damascus', 'aleppo', 'idlib',
  // Yemen
  'yemen', 'sanaa', 'aden', 'houthi',
  // Iraq
  'iraq', 'baghdad', 'mosul', 'kirkuk', 'erbil',
  // Iran
  'iran', 'tehran', 'isfahan',
  // Lebanon
  'lebanon', 'beirut',
  // Gulf & Middle East cities
  'jordan', 'amman',
  'saudi arabia', 'riyadh', 'jeddah',
  'bahrain', 'manama',
  'kuwait',
  'oman', 'muscat',
  'qatar', 'doha',
  'united arab emirates', 'abu dhabi', 'dubai',
  'turkey', 'ankara', 'istanbul', 'kurdistan',
  'egypt', 'cairo',
  // Africa
  'sudan', 'darfur', 'khartoum',
  'libya', 'tripoli', 'benghazi',
  'somalia', 'mogadishu',
  'ethiopia', 'tigray', 'amhara', 'addis ababa',
  'congo', 'drc', 'kinshasa',
  'nigeria', 'borno', 'lagos', 'abuja',
  'mali', 'burkina faso', 'niger',
  'cameroon', 'mozambique', 'cabo delgado', 'chad',
  // South/Central Asia
  'myanmar', 'burma', 'yangon',
  'afghanistan', 'kabul', 'kandahar',
  'pakistan', 'islamabad', 'karachi', 'waziristan', 'balochistan',
  'india', 'new delhi', 'kashmir',
  // Americas
  'haiti', 'port-au-prince',
  'mexico', 'colombia',
  // East Asia tensions
  'taiwan', 'taipei',
  'north korea', 'pyongyang',
];

function isConflictRegion(name: string): boolean {
  const lower = name.toLowerCase();
  return CONFLICT_REGIONS.some(r => lower.includes(r));
}

// Only exclude very specific false positives
const EXCLUDED_PATTERNS = [
  'georgia, united states',
  'georgia, usa',
  'paris, texas',
  'moscow, idaho',
];

function isExcludedCity(name: string): boolean {
  const lower = name.toLowerCase();
  return EXCLUDED_PATTERNS.some(ex => lower.includes(ex));
}

function extractFirstLink(html: string): { url: string; title: string } {
  const match = html.match(/<a\s+href="([^"]+)"[^>]*title="([^"]*)"[^>]*>/);
  if (match) return { url: match[1], title: match[2] };
  const fallback = html.match(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
  if (fallback) return { url: fallback[1], title: fallback[2] };
  return { url: '', title: '' };
}

async function fetchFromGDELT(): Promise<ConflictEvent[] | null> {
  const query = 'war conflict airstrike missile bombing';

  // v2 geo API is dead (404 since late 2025), use v2 doc PointData instead
  const url =
    'https://api.gdeltproject.org/api/v2/doc/doc' +
    '?query=' + encodeURIComponent(query) +
    '&mode=PointData&format=GeoJSON&timespan=24h&maxrecords=250';

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    console.warn(`[Conflicts] GDELT returned ${res.status}`);
    return null;
  }

  const text = await res.text();
  // GDELT sometimes returns HTML error pages instead of JSON
  if (!text.startsWith('{') && !text.startsWith('[')) {
    console.warn('[Conflicts] GDELT returned non-JSON response');
    return null;
  }

  const geojson = JSON.parse(text);
  const features: any[] = geojson.features || [];

  return features
    .filter((f: any) => {
      const coords = f.geometry?.coordinates;
      if (!coords || (coords[0] === 0 && coords[1] === 0)) return false;
      if ((f.properties?.count || 0) < 5) return false;
      const name = f.properties?.name || '';
      return isConflictRegion(name) && !isExcludedCity(name);
    })
    .map((f: any) => {
      const { url: articleUrl, title } = extractFirstLink(f.properties?.html || '');
      return {
        name: f.properties?.name || 'Unknown',
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        count: f.properties?.count || 1,
        url: articleUrl,
        title,
      };
    });
}

async function fetchFromDatabase(): Promise<ConflictEvent[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const articles = await prisma.newsArticle.findMany({
    where: {
      categorySlug: 'geopolitics',
      latitude: { not: null },
      longitude: { not: null },
      locationName: { not: null },
      scrapedAt: { gte: sevenDaysAgo },
    },
    select: {
      title: true,
      url: true,
      latitude: true,
      longitude: true,
      locationName: true,
      sentiment: true,
    },
    orderBy: { scrapedAt: 'desc' },
    take: 500,
  });

  console.log(`[Conflicts] DB query returned ${articles.length} geopolitics articles`);

  // Group by location (round to ~10km grid) to get counts
  const grid = new Map<string, { events: typeof articles; lat: number; lng: number; name: string }>();

  for (const a of articles) {
    if (a.latitude == null || a.longitude == null) continue;
    const name = a.locationName || 'Unknown';
    // Accept ALL geopolitics articles with valid coordinates for the conflict layer
    // The region filter was too aggressive and excluded valid conflict zones
    if (isExcludedCity(name)) continue;

    const key = `${(a.latitude * 10) | 0},${(a.longitude * 10) | 0}`;
    if (!grid.has(key)) {
      grid.set(key, { events: [], lat: a.latitude, lng: a.longitude, name });
    }
    grid.get(key)!.events.push(a);
  }

  const results = [...grid.values()].map(g => ({
    name: g.name,
    lat: g.lat,
    lng: g.lng,
    count: g.events.length,
    url: g.events[0].url,
    title: g.events[0].title,
  }));

  // Sort by count descending so most active conflict zones render on top
  results.sort((a, b) => b.count - a.count);

  return results;
}

export async function fetchConflicts(): Promise<ConflictEvent[]> {
  // Return cached data if still valid
  if (conflictCache && Date.now() < conflictCache.expiresAt) {
    return conflictCache.data;
  }

  console.log('[Conflicts] Fetching conflict data...');

  // Always fetch from database first (reliable, fast)
  const dbData = await fetchFromDatabase();
  console.log(`[Conflicts] DB: ${dbData.length} conflict zones`);

  // Try GDELT as supplementary data (often down, so don't depend on it)
  let gdeltData: ConflictEvent[] = [];
  try {
    const gdelt = await fetchFromGDELT();
    if (gdelt && gdelt.length > 0) {
      gdeltData = gdelt;
      console.log(`[Conflicts] GDELT: ${gdeltData.length} events`);
    }
  } catch (err: any) {
    console.warn(`[Conflicts] GDELT unavailable: ${err?.message || err}`);
  }

  // Merge: DB data + GDELT data (deduplicate by ~10km grid)
  const seen = new Set<string>();
  const merged: ConflictEvent[] = [];

  for (const ev of [...dbData, ...gdeltData]) {
    const key = `${(ev.lat * 10) | 0},${(ev.lng * 10) | 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(ev);
  }

  // Only cache if we have data; don't cache empty results
  if (merged.length > 0) {
    conflictCache = {
      data: merged,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 min cache (was 60 min)
    };
  } else {
    // Short cache for empty results to retry sooner
    conflictCache = {
      data: merged,
      expiresAt: Date.now() + 2 * 60 * 1000, // 2 min
    };
  }

  console.log(`[Conflicts] Total: ${merged.length} conflict zones (cached)`);
  return merged;
}
