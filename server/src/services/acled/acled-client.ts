// Conflict data service
// Primary: GDELT GEO 2.0 API (free, no auth)
// Fallback: geopolitics articles from local database

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
  'ukraine', 'kyiv', 'kharkiv', 'odesa', 'russia',
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
  'india', 'new delhi',
  // Americas
  'haiti', 'port-au-prince',
  'mexico', 'colombia',
];

function isConflictRegion(name: string): boolean {
  const lower = name.toLowerCase();
  return CONFLICT_REGIONS.some(r => lower.includes(r));
}

const EXCLUDED_CITIES = new Set([
  'moscow', 'kremlin', 'saint petersburg',
  'georgia, united states',
]);

function isExcludedCity(name: string): boolean {
  const lower = name.toLowerCase();
  return [...EXCLUDED_CITIES].some(ex => lower.includes(ex));
}

function extractFirstLink(html: string): { url: string; title: string } {
  const match = html.match(/<a\s+href="([^"]+)"[^>]*title="([^"]*)"[^>]*>/);
  if (match) return { url: match[1], title: match[2] };
  const fallback = html.match(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
  if (fallback) return { url: fallback[1], title: fallback[2] };
  return { url: '', title: '' };
}

const MIN_COUNT = 200;

async function fetchFromGDELT(): Promise<ConflictEvent[] | null> {
  const query =
    'theme:ARMEDCONFLICT ' +
    '(airstrike OR shelling OR bombing OR missile OR "drone strike" OR offensive OR battle OR casualties)';

  const url =
    'https://api.gdeltproject.org/api/v2/geo/geo' +
    '?query=' + encodeURIComponent(query) +
    '&mode=pointdata&format=geojson&timespan=3d&maxpoints=500';

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;

  const geojson = await res.json();
  const features: any[] = geojson.features || [];

  return features
    .filter((f: any) => {
      const coords = f.geometry?.coordinates;
      if (!coords || (coords[0] === 0 && coords[1] === 0)) return false;
      if ((f.properties?.count || 0) < MIN_COUNT) return false;
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
      scrapedAt: { gte: sevenDaysAgo },
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

  // Group by location (round to ~10km grid) to get counts
  const grid = new Map<string, { events: typeof articles; lat: number; lng: number; name: string }>();

  for (const a of articles) {
    if (a.latitude == null || a.longitude == null) continue;
    const name = a.locationName || 'Unknown';
    if (!isConflictRegion(name) || isExcludedCity(name)) continue;

    const key = `${(a.latitude * 10) | 0},${(a.longitude * 10) | 0}`;
    if (!grid.has(key)) {
      grid.set(key, { events: [], lat: a.latitude, lng: a.longitude, name });
    }
    grid.get(key)!.events.push(a);
  }

  return [...grid.values()].map(g => ({
    name: g.name,
    lat: g.lat,
    lng: g.lng,
    count: g.events.length,
    url: g.events[0].url,
    title: g.events[0].title,
  }));
}

export async function fetchConflicts(): Promise<ConflictEvent[]> {
  if (conflictCache && Date.now() < conflictCache.expiresAt) {
    return conflictCache.data;
  }

  console.log('[Conflicts] Fetching conflict data...');

  let data: ConflictEvent[];
  try {
    const gdelt = await fetchFromGDELT();
    if (gdelt && gdelt.length > 0) {
      data = gdelt;
      console.log(`[Conflicts] GDELT: ${data.length} events`);
    } else {
      data = await fetchFromDatabase();
      console.log(`[Conflicts] Fallback to DB: ${data.length} events`);
    }
  } catch {
    data = await fetchFromDatabase();
    console.log(`[Conflicts] GDELT failed, DB fallback: ${data.length} events`);
  }

  conflictCache = {
    data,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return data;
}
