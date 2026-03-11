import { useT, type TranslationKey } from '../../i18n';

interface SentimentBadgeProps {
  sentiment: string | null;
  className?: string;
}

const SENTIMENT_CONFIG: Record<string, { key: TranslationKey; color: string }> = {
  BULLISH: { key: 'bullish', color: '#00c853' },
  BEARISH: { key: 'bearish', color: '#ff1744' },
  NEUTRAL: { key: 'neutral', color: '#2196f3' },
};

export function SentimentBadge({ sentiment, className = '' }: SentimentBadgeProps) {
  const t = useT();
  if (!sentiment) return null;
  const config = SENTIMENT_CONFIG[sentiment];

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide ${className}`}
      style={{ backgroundColor: `${config ? config.color : '#666'}22`, color: config ? config.color : '#666' }}
    >
      {config ? t(config.key) : sentiment}
    </span>
  );
}
