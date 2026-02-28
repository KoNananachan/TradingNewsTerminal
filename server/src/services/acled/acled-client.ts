// GDELT-based conflict data service
// Uses GDELT GEO 2.0 API — free, no auth
// Cross-references with known active conflict regions for accuracy

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
// Only locations within these will be shown on the map
const CONFLICT_REGIONS = [
  // Eastern Europe
  'ukraine', 'russia',
  // Middle East (full coverage)
  'israel', 'gaza', 'palestine', 'west bank',
  'syria', 'damascus', 'aleppo', 'idlib',
  'yemen', 'sanaa', 'aden', 'houthi',
  'iraq', 'baghdad', 'mosul', 'kirkuk',
  'iran', 'tehran',
  'lebanon', 'beirut',
  'jordan',
  'saudi arabia',
  'bahrain',
  'kuwait',
  'oman',
  'qatar',
  'united arab emirates',
  'turkey', 'kurdistan',
  // Africa
  'sudan', 'darfur', 'khartoum',
  'libya', 'tripoli', 'benghazi',
  'somalia', 'mogadishu',
  'ethiopia', 'tigray', 'amhara',
  'congo', 'drc',
  'nigeria', 'borno',
  'mali', 'burkina faso', 'niger',
  'cameroon',
  'mozambique', 'cabo delgado',
  'chad',
  // South/Central Asia
  'myanmar', 'burma',
  'afghanistan', 'kabul',
  'pakistan', 'waziristan', 'balochistan',
  // Americas
  'haiti', 'port-au-prince',
  'mexico',
  'colombia',
];

function isConflictRegion(name: string): boolean {
  const lower = name.toLowerCase();
  return CONFLICT_REGIONS.some(r => lower.includes(r));
}

// Media/political hubs within conflict countries that aren't frontlines
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

export async function fetchConflicts(): Promise<ConflictEvent[]> {
  if (conflictCache && Date.now() < conflictCache.expiresAt) {
    return conflictCache.data;
  }

  console.log('[Conflicts] Fetching from GDELT GEO API...');

  const query =
    'theme:ARMEDCONFLICT ' +
    '(airstrike OR shelling OR bombing OR missile OR "drone strike" OR offensive OR battle OR casualties)';

  const url =
    'https://api.gdeltproject.org/api/v2/geo/geo' +
    '?query=' + encodeURIComponent(query) +
    '&mode=pointdata&format=geojson&timespan=3d&maxpoints=500';

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    console.error('[Conflicts] GDELT error:', res.status, text);
    throw new Error(`GDELT API error: ${res.status}`);
  }

  const geojson = await res.json();
  const features: any[] = geojson.features || [];

  const data: ConflictEvent[] = features
    .filter((f: any) => {
      const coords = f.geometry?.coordinates;
      if (!coords || (coords[0] === 0 && coords[1] === 0)) return false;
      const count = f.properties?.count || 0;
      if (count < MIN_COUNT) return false;
      const name = f.properties?.name || '';
      if (!isConflictRegion(name)) return false;
      if (isExcludedCity(name)) return false;
      return true;
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

  console.log(
    `[Conflicts] ${features.length} raw → ${data.length} after whitelist filter`,
  );

  conflictCache = {
    data,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return data;
}
