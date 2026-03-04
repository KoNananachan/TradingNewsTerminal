import { useState, useEffect } from 'react';
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

export function LiveStreamsPanel() {
  const t = useT();
  const [activeStream, setActiveStream] = useState<LiveStream>(STREAMS[0]);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch live video ID from server
  useEffect(() => {
    let cancelled = false;
    setVideoId(null);
    setLoading(true);

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

  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`
    : null;

  const youtubeLink = `https://www.youtube.com/${activeStream.handle}/live`;

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
        ) : embedUrl ? (
          <iframe
            key={videoId}
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={activeStream.name}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Radio size={24} className="text-accent/40" />
            <span className="text-[11px] font-mono text-neutral/60 uppercase tracking-widest text-center px-4">
              {activeStream.name}
            </span>
            <span className="text-[9px] font-mono text-neutral/30 uppercase tracking-widest">
              No live stream detected
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
        )}
      </div>
    </GlassCard>
  );
}
