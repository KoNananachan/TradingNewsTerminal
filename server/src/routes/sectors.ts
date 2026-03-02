import { Router } from 'express';
import { getHistory, getQuotes } from '../services/stocks/yahoo-finance.js';

const router = Router();

// In-memory cache (5 min TTL)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60_000;
function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return Promise.resolve(entry.data);
  return fn().then(data => { cache.set(key, { data, ts: Date.now() }); return data; });
}

const SECTOR_ETFS = ['XLK', 'XLV', 'XLF', 'XLE', 'XLI', 'XLC', 'XLY', 'XLP', 'XLRE', 'XLB', 'XLU'];

const SECTOR_NAMES: Record<string, string> = {
  XLK: 'Technology',
  XLV: 'Healthcare',
  XLF: 'Financials',
  XLE: 'Energy',
  XLI: 'Industrials',
  XLC: 'Communication',
  XLY: 'Consumer Disc.',
  XLP: 'Consumer Staples',
  XLRE: 'Real Estate',
  XLB: 'Materials',
  XLU: 'Utilities',
};

const PERIOD_RANGE_MAP: Record<string, string> = {
  '1D': '1d',
  '1W': '5d',
  '1M': '1mo',
  '3M': '3mo',
};

function calculateReturn(history: Array<{ close: number | null }>): number | null {
  const validPrices = history.filter(h => h.close != null).map(h => h.close!);
  if (validPrices.length < 2) return null;
  const first = validPrices[0];
  const last = validPrices[validPrices.length - 1];
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

// GET /api/sectors/performance
router.get('/performance', async (req, res) => {
  try {
    const period = (req.query.period as string) || '1M';
    const range = PERIOD_RANGE_MAP[period] || '1mo';

    const [quotes, ...histories] = await cached(`perf:${range}`, () => Promise.all([
      getQuotes(SECTOR_ETFS),
      ...SECTOR_ETFS.map(symbol => getHistory(symbol, { range })),
    ]));

    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

    const sectors = SECTOR_ETFS.map((symbol, i) => {
      const quote = quoteMap.get(symbol);
      const periodReturn = calculateReturn(histories[i]);

      return {
        symbol,
        name: SECTOR_NAMES[symbol] || symbol,
        return: periodReturn != null ? Math.round(periodReturn * 100) / 100 : null,
        currentPrice: quote?.price ?? null,
      };
    });

    res.json({ sectors });
  } catch (err) {
    console.error('[Sectors] Error fetching performance:', err);
    res.status(500).json({ error: 'Failed to fetch sector performance' });
  }
});

// GET /api/sectors/rotation
router.get('/rotation', async (req, res) => {
  try {
    // Fetch 1M and 3M histories for all ETFs (cached)
    const [histories1M, histories3M] = await cached('rotation', () => Promise.all([
      Promise.all(SECTOR_ETFS.map(symbol => getHistory(symbol, { range: '1mo' }))),
      Promise.all(SECTOR_ETFS.map(symbol => getHistory(symbol, { range: '3mo' }))),
    ]));

    const sectors = SECTOR_ETFS.map((symbol, i) => {
      const momentum = calculateReturn(histories1M[i]); // 1M return
      const return3M = calculateReturn(histories3M[i]);  // 3M return

      // Acceleration = delta between 1M momentum and 3M annualized monthly rate
      const monthlyRate3M = return3M != null ? return3M / 3 : null;
      const acceleration = (momentum != null && monthlyRate3M != null)
        ? Math.round((momentum - monthlyRate3M) * 100) / 100
        : null;

      // Determine quadrant
      let quadrant: 'leading' | 'weakening' | 'lagging' | 'improving' = 'lagging';
      if (momentum != null && acceleration != null) {
        if (momentum > 0 && acceleration > 0) quadrant = 'leading';
        else if (momentum > 0 && acceleration <= 0) quadrant = 'weakening';
        else if (momentum <= 0 && acceleration > 0) quadrant = 'improving';
        else quadrant = 'lagging';
      }

      return {
        symbol,
        name: SECTOR_NAMES[symbol] || symbol,
        momentum: momentum != null ? Math.round(momentum * 100) / 100 : null,
        acceleration,
        quadrant,
      };
    });

    res.json({ sectors });
  } catch (err) {
    console.error('[Sectors] Error fetching rotation:', err);
    res.status(500).json({ error: 'Failed to fetch sector rotation' });
  }
});

export default router;
