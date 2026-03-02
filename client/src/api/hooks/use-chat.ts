import { useState, useRef, useCallback } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function useChat() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (
      message: string,
      tickers: string[],
      history: { role: string; content: string }[],
      context?: Array<{ type: string; id?: number; symbol?: string; label: string }>,
    ): Promise<string> => {
      // Abort any in-flight request
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setStreamedText('');
      setError(null);

      // Client-side 150s timeout (allows server-side retries)
      const timeout = setTimeout(() => controller.abort(), 150_000);

      let accumulated = '';

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            tickers,
            history,
            context: context?.map(c => ({
              type: c.type,
              articleId: c.id,
              symbol: c.symbol,
            })),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `HTTP ${res.status}`);
        }

        if (!res.body) {
          throw new Error('No response body');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const payload = trimmed.slice(6);
            if (payload === '[DONE]') {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(payload);
              if (parsed.content) {
                accumulated += parsed.content;
                setStreamedText(accumulated);
              }
              if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return accumulated;
        }
        setError(err.message || 'Request failed');
        throw err;
      } finally {
        clearTimeout(timeout);
        setIsStreaming(false);
        abortRef.current = null;
      }

      return accumulated;
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { sendMessage, isStreaming, streamedText, error, clearError, abort };
}
