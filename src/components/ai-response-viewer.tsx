import * as React from "react";
import { cn } from "@/lib/utils";
import { parseMarkdownBlocks, InlineToken } from "@/lib/markdown-parser";

export interface AIResponseViewerProps {
  /** Raw markdown or clinical rationale string to render */
  content?: string | null;
  /** Alias for content to support existing callers */
  text?: string | null;
  /** Optional visual surface variant */
  variant?: "default" | "compact" | "dark";
  /** Optional additional class names */
  className?: string;
}

function renderInlineTokens(tokens: InlineToken[] = [], isDark: boolean) {
  return tokens.map((token, idx) => {
    if (token.type === "bold") {
      return (
        <strong
          key={idx}
          className={cn(
            "font-bold",
            isDark ? "text-white" : "text-foreground"
          )}
        >
          {token.value}
        </strong>
      );
    }
    if (token.type === "italic") {
      return (
        <em
          key={idx}
          className={cn(
            "italic font-medium",
            isDark ? "text-slate-300" : "text-muted-foreground"
          )}
        >
          {token.value}
        </em>
      );
    }
    if (token.type === "code") {
      return (
        <code
          key={idx}
          className={cn(
            "font-mono text-[11px] px-1.5 py-0.5 rounded border",
            isDark
              ? "bg-slate-800/80 border-slate-700 text-teal-300"
              : "bg-muted/60 border-border text-primary"
          )}
        >
          {token.value}
        </code>
      );
    }
    return <React.Fragment key={idx}>{token.value}</React.Fragment>;
  });
}

/**
 * Reusable AIResponseViewer component that enforces a consistent clinical output format:
 * - Proper bold headings (<h3>)
 * - Clear subheadings (<h4>)
 * - Distinct bullet points (<ul> / <li>) and numbered protocol steps (<ol> / <li>)
 */
export function AIResponseViewer({
  content,
  text,
  variant = "default",
  className,
}: AIResponseViewerProps) {
  const rawMarkdown = (content ?? text ?? "").trim();
  const blocks = React.useMemo(
    () => parseMarkdownBlocks(rawMarkdown),
    [rawMarkdown]
  );

  if (!blocks.length) {
    return null;
  }

  const isDark = variant === "dark";
  const isCompact = variant === "compact";

  return (
    <div
      data-testid="ai-response-viewer"
      className={cn(
        "space-y-3 font-sans leading-relaxed",
        isCompact ? "text-xs" : "text-xs sm:text-[13px]",
        isDark ? "text-slate-200" : "text-foreground/90",
        className
      )}
    >
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3
              key={index}
              className={cn(
                "font-bold tracking-tight pb-1.5 border-b",
                isCompact ? "text-xs sm:text-sm" : "text-sm sm:text-base",
                index > 0 ? "pt-2" : "",
                isDark
                  ? "text-white border-slate-800"
                  : "text-foreground border-border"
              )}
            >
              <strong className="font-bold">{block.text}</strong>
            </h3>
          );
        }

        if (block.type === "subheading") {
          return (
            <h4
              key={index}
              className={cn(
                "font-semibold tracking-tight pt-1.5",
                isCompact ? "text-xs" : "text-xs sm:text-[13px]",
                isDark ? "text-teal-300" : "text-primary"
              )}
            >
              {block.text}
            </h4>
          );
        }

        if (block.type === "bullet-list" && block.items) {
          return (
            <ul
              key={index}
              className="space-y-1.5 pl-4 list-disc marker:text-primary"
            >
              {block.items.map((item, itemIdx) => (
                <li
                  key={itemIdx}
                  className={cn(
                    "pl-1 leading-relaxed",
                    isDark ? "text-slate-300 marker:text-teal-400" : "text-foreground/90 marker:text-primary"
                  )}
                >
                  {renderInlineTokens(item.tokens, isDark)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "numbered-list" && block.items) {
          return (
            <ol key={index} className="space-y-1.5 pl-1 list-none">
              {block.items.map((item, itemIdx) => (
                <li
                  key={itemIdx}
                  className="flex items-start gap-2.5 leading-relaxed"
                >
                  <span
                    className={cn(
                      "font-mono tabular-nums font-bold text-[11px] shrink-0 mt-0.5",
                      isDark ? "text-teal-300" : "text-primary"
                    )}
                  >
                    {item.number}.
                  </span>
                  <span className="flex-1">
                    {renderInlineTokens(item.tokens, isDark)}
                  </span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p
            key={index}
            className={cn(
              "leading-relaxed",
              isDark ? "text-slate-300" : "text-foreground/90"
            )}
          >
            {renderInlineTokens(block.tokens, isDark)}
          </p>
        );
      })}
    </div>
  );
}

export default AIResponseViewer;
