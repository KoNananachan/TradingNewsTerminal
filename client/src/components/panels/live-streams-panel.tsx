import { useState, useEffect, useRef, useCallback } from 'react';
import { GlassCard } from '../common/glass-card';
import { Radio, ExternalLink } from 'lucide-react';
import { useT } from '../../i18n';
import { api } from '../../api/client';

interface LiveStream {
  id: string;
  name: string;
  handle: string;
}

const STREAMS: LiveStream[] = [
  { id: 'yahoo', name: 'Yahoo Finance', handle: '@YahooFinance' },
  { id: 'bloomberg', name: 'Bloomberg TV', handle: '@business' },
  { id: 'cnbc', name: 'CNBC', handle: '@CNBC' },
  { id: 'foxbusiness', name: 'Fox Business', handle: '@FoxBusiness' },
  { id: 'cnn', name: 'CNN', handle: '@CNN' },
  { id: 'sky', name: 'Sky News', handle: '@SkyNews' },
  { id: 'aljazeera', name: 'Al Jazeera', handle: '@AlJazeeraEnglish' },
  { id: 'dw', name: 'DW News', handle: '@DWNews' },
];

// Load YT IFrame API once
let ytApiReady = false;
let ytApiPromise: Promise<void> | null = null;
function loadYTApi(): Promise<void> {
  if (ytApiReady) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    if (typeof window !== 'undefined' && (window as any).YT?.Player) {
      ytApiReady = true;
      resolve();
      return;
    }
    (window as any).onYouTubeIframeAPIReady = () => {
      ytApiReady = true;
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

export function LiveStreamsPanel() {
  const t = useT();
  const [activeStream, setActiveStream] = useState<LiveStream>(STREAMS[0]);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch live video ID from server
  useEffect(() => {
    let cancelled = false;
    setVideoId(null);
    setLoading(true);
    setEmbedError(false);

    api.get<{ videoId: string | null }>(`/streams/live-id?handle=${encodeURIComponent(activeStream.handle)}`)
      .then((res) => {
        if (!cancelled) setVideoId(res.videoId || null);
      })
      .catch(() => {
        if (!cancelled) setVideoId(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeStream.handle]);

  // Create / destroy YT player
  useEffect(() => {
    if (!videoId || embedError) return;

    let player: any = null;
    let destroyed = false;

    loadYTApi().then(() => {
      if (destroyed || !containerRef.current) return;

      // Create a fresh div for the player each time
      const el = document.createElement('div');
      el.id = `yt-player-${Date.now()}`;
      containerRef.current!.innerHTML = '';
      containerRef.current!.appendChild(el);

      player = new (window as any).YT.Player(el.id, {
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onError: (e: any) => {
            // Error codes: 2=invalid param, 5=HTML5 error, 100=not found, 101/150=embed blocked
            // 150 is the alias for 101 (same meaning)
            // YT embed error (e.g. 101/150 = embed blocked by channel)
            if (!destroyed) setEmbedError(true);
          },
          onReady: () => {
            // Player loaded successfully
          },
        },
        width: '100%',
        height: '100%',
      });
      playerRef.current = player;
    });

    return () => {
      destroyed = true;
      try {
        playerRef.current?.destroy();
      } catch { /* ignore */ }
      playerRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [videoId, embedError]);

  const youtubeLink = `https://www.youtube.com/${activeStream.handle}/live`;
  const showFallback = !loading && (!videoId || embedError);

  return (
    <GlassCard
      className="h-full"
      title={
        <span className="flex items-center gap-1.5">
          <Radio size={12} className="text-red-500 animate-pulse" />
          {t('liveStreams')}
        </span>
      }
    >
      {/* Channel selector */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border bg-black/50 shrink-0">
        {STREAMS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveStream(s)}
            className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
              activeStream.id === s.id
                ? 'bg-accent/20 border-accent text-accent'
                : 'border-border text-neutral hover:text-primary hover:border-accent/50'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Video embed or fallback */}
      <div className="flex-1 relative bg-black min-h-0">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent animate-spin" />
            <span className="text-[10px] font-mono text-neutral/40 uppercase tracking-widest">Loading stream...</span>
          </div>
        ) : showFallback ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Radio size={24} className="text-accent/40" />
            <span className="text-[11px] font-mono text-neutral/60 uppercase tracking-widest text-center px-4">
              {activeStream.name}
            </span>
            <span className="text-[9px] font-mono text-neutral/30 uppercase tracking-widest text-center px-4">
              {embedError ? 'Embed restricted by channel' : 'No live stream detected'}
            </span>
            <a
              href={youtubeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono text-accent border border-accent/40 hover:bg-accent/10 transition-colors uppercase tracking-wider"
            >
              <ExternalLink size={11} />
              Watch on YouTube
            </a>
          </div>
        ) : (
          /* YT Player container - positioned absolutely to fill the space */
          <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full [&>div]:w-full [&>div]:h-full [&_iframe]:w-full [&_iframe]:h-full"
          />
        )}
      </div>
    </GlassCard>
  );
}
