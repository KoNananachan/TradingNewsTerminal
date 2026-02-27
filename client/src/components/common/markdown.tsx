import { useMemo } from 'react';

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer for AI chat responses.
 * Handles: headers, bold, italic, inline code, code blocks,
 * bullet/numbered lists, and line breaks.
 * No external dependencies.
 */
export function Markdown({ content, className = '' }: MarkdownProps) {
  const elements = useMemo(() => parseMarkdown(content), [content]);
  return <div className={className}>{elements}</div>;
}

function parseMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split into code blocks and non-code segments
  const segments = text.split(/(```[\s\S]*?```)/g);
  let key = 0;

  for (const segment of segments) {
    if (segment.startsWith('```')) {
      // Code block
      const match = segment.match(/^```(\w*)\n?([\s\S]*?)```$/);
      const code = match ? match[2].replace(/\n$/, '') : segment.slice(3, -3);
      nodes.push(
        <pre
          key={key++}
          className="bg-[#111] border border-border px-2 py-1.5 my-1 overflow-x-auto text-[10px] text-accent leading-snug"
        >
          <code>{code}</code>
        </pre>,
      );
    } else {
      // Parse line-by-line
      const lines = segment.split('\n');
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];

        // Empty line → spacing
        if (line.trim() === '') {
          nodes.push(<div key={key++} className="h-1.5" />);
          i++;
          continue;
        }

        // Headers
        const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const sizes = ['text-[13px]', 'text-[12px]', 'text-[11px]'];
          nodes.push(
            <div
              key={key++}
              className={`${sizes[level - 1] || sizes[2]} font-bold text-accent uppercase tracking-wide mt-1 mb-0.5`}
            >
              {renderInline(headerMatch[2])}
            </div>,
          );
          i++;
          continue;
        }

        // Bullet list (- or *)
        if (/^\s*[-*]\s/.test(line)) {
          const items: React.ReactNode[] = [];
          while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
            const itemText = lines[i].replace(/^\s*[-*]\s+/, '');
            items.push(
              <li key={items.length} className="flex gap-1.5 items-start">
                <span className="text-accent shrink-0 mt-[1px]">›</span>
                <span>{renderInline(itemText)}</span>
              </li>,
            );
            i++;
          }
          nodes.push(
            <ul key={key++} className="flex flex-col gap-0.5 my-0.5 ml-1">
              {items}
            </ul>,
          );
          continue;
        }

        // Numbered list
        if (/^\s*\d+[.)]\s/.test(line)) {
          const items: React.ReactNode[] = [];
          while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
            const itemMatch = lines[i].match(/^\s*(\d+)[.)]\s+(.*)/);
            if (itemMatch) {
              items.push(
                <li key={items.length} className="flex gap-1.5 items-start">
                  <span className="text-neutral/50 shrink-0 w-3 text-right">{itemMatch[1]}.</span>
                  <span>{renderInline(itemMatch[2])}</span>
                </li>,
              );
            }
            i++;
          }
          nodes.push(
            <ol key={key++} className="flex flex-col gap-0.5 my-0.5 ml-1">
              {items}
            </ol>,
          );
          continue;
        }

        // Regular paragraph
        nodes.push(
          <p key={key++} className="my-0.5">
            {renderInline(line)}
          </p>,
        );
        i++;
      }
    }
  }

  return nodes;
}

/** Render inline markdown: bold, italic, inline code, strikethrough */
function renderInline(text: string): React.ReactNode {
  // Split by inline patterns, preserving delimiters
  const parts: React.ReactNode[] = [];
  // Order matters: code first (to avoid conflict), then bold, italic
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partKey = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`')) {
      // Inline code
      parts.push(
        <code
          key={partKey++}
          className="bg-[#111] border border-border/50 px-1 py-px text-accent text-[10px]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      parts.push(
        <strong key={partKey++} className="text-white font-bold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('*')) {
      parts.push(
        <em key={partKey++} className="text-neutral italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith('~~')) {
      parts.push(
        <span key={partKey++} className="line-through text-neutral/50">
          {token.slice(2, -2)}
        </span>,
      );
    }

    lastIndex = match.index + token.length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
