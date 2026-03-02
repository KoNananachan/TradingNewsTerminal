import { useState } from 'react';
import { GlassCard } from '../common/glass-card';
import { Radio } from 'lucide-react';
import { useT } from '../../i18n';

interface LiveStream {
  id: string;
  name: string;
  channel: string;
  /** YouTube channel ID for live embed */
  channelId: string;
}

const STREAMS: LiveStream[] = [
  { id: 'yahoo', name: 'Yahoo Finance', channel: 'Yahoo Finance', channelId: 'UCEAZeUIeJs0IjQiqTCdVSIg' },
  { id: 'bloomberg', name: 'Bloomberg TV', channel: 'Bloomberg', channelId: 'UCIALMKvObZNtJ6AmdCLP7Lg' },
  { id: 'cnbc', name: 'CNBC', channel: 'CNBC', channelId: 'UCvJJ_dzjViJCoLf5uKUTwoA' },
  { id: 'foxbusiness', name: 'Fox Business', channel: 'Fox Business', channelId: 'UCCMCBEMLAgmcjMGKnZRMoJg' },
  { id: 'cnn', name: 'CNN', channel: 'CNN', channelId: 'UCupvZG-5ko_eiXAupbDfxWw' },
  { id: 'sky', name: 'Sky News', channel: 'Sky News', channelId: 'UCoMdktPbSTixAyNGwb-UYkQ' },
  { id: 'aljazeera', name: 'Al Jazeera', channel: 'Al Jazeera English', channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
  { id: 'dw', name: 'DW News', channel: 'DW News', channelId: 'UCknLrEdhRCp1aegoMqRaCZg' },
];

export function LiveStreamsPanel() {
  const t = useT();
  const [activeStream, setActiveStream] = useState<LiveStream>(STREAMS[0]);

  // YouTube live embed URL using channel ID
  const embedUrl = `https://www.youtube.com/embed/live_stream?channel=${activeStream.channelId}&autoplay=1&mute=1`;

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

      {/* Video embed */}
      <div className="flex-1 relative bg-black min-h-0">
        <iframe
          key={activeStream.channelId}
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={activeStream.name}
        />
      </div>
    </GlassCard>
  );
}
