interface SentimentBadgeProps {
  sentiment: string | null;
  className?: string;
}

const SENTIMENT_CONFIG: Record<string, { label: string; color: string }> = {
  BULLISH: { label: 'BULLISH', color: '#00c853' },
  BEARISH: { label: 'BEARISH', color: '#ff1744' },
  NEUTRAL: { label: 'NEUTRAL', color: '#2196f3' },
};

export function SentimentBadge({ sentiment, className = '' }: SentimentBadgeProps) {
  if (!sentiment) return null;
  const config = SENTIMENT_CONFIG[sentiment] ?? { label: sentiment, color: '#666' };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide ${className}`}
      style={{ backgroundColor: `${config.color}22`, color: config.color }}
    >
      {config.label}
    </span>
  );
}
