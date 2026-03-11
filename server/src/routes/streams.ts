import { Router } from 'express';

const router = Router();

// In-memory cache: handle → { videoId, ts } (bounded to prevent memory leaks)
const cache = new Map<string, { videoId: string | null; ts: number }>();
const CACHE_TTL = 5 * 60_000; // 5 min
const CACHE_MAX_SIZE = 200;

// GET /api/streams/live-id?handle=@ChannelHandle
// Scrapes YouTube channel page to find current live stream video ID
router.get('/live-id', async (req, res) => {
  try {
    const handle = (req.query.handle as string || '').trim();
    if (!handle || !/^@[a-zA-Z0-9_-]{1,50}$/.test(handle)) {
      return res.status(400).json({ error: 'Valid YouTube @handle required' });
    }

    // Check cache
    const cached = cache.get(handle);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json({ videoId: cached.videoId });
    }

    // Fetch channel live page
    const url = `https://www.youtube.com/${handle}/live`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });

    if (!resp.ok) {
      cache.set(handle, { videoId: null, ts: Date.now() });
      return res.json({ videoId: null });
    }

    const html = await resp.text();

    const isLive = html.includes('"isLive":true') || html.includes('"isLiveContent":true');

    let videoId: string | null = null;
    if (isLive) {
      // Priority 1: videoDetails object contains the actual playing video's ID
      const detailsMatch = html.match(/"videoDetails":\{"videoId":"([a-zA-Z0-9_-]{11})"/);
      // Priority 2: currentVideoEndpoint URL
      const endpointMatch = html.match(/"currentVideoEndpoint"[^}]*"url":"\/watch\?v=([a-zA-Z0-9_-]{11})/);
      // Priority 3: canonical link (sometimes set to "undefined" by YouTube)
      const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/);
      videoId = detailsMatch?.[1] || endpointMatch?.[1] || canonicalMatch?.[1] || null;
    }

    // Evict oldest entries if cache is full
    if (cache.size >= CACHE_MAX_SIZE) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
      for (let i = 0; i < Math.ceil(CACHE_MAX_SIZE / 4); i++) {
        cache.delete(oldest[i][0]);
      }
    }
    cache.set(handle, { videoId, ts: Date.now() });
    res.json({ videoId });
  } catch (err: any) {
    console.error('[Streams] Error fetching live ID:', err?.message || err);
    res.json({ videoId: null });
  }
});

export default router;
