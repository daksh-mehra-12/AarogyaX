export interface InlineToken {
  type: "text" | "bold" | "italic" | "code";
  value: string;
}

export interface ParsedBlock {
  type: "heading" | "subheading" | "bullet-list" | "numbered-list" | "paragraph";
  text?: string;
  tokens?: InlineToken[];
  items?: {
    number?: string;
    label?: string;
    tokens: InlineToken[];
  }[];
}

/**
 * Parses inline markdown (**bold**, *italic*, `code`) into structured tokens.
 */
export function parseInlineTokens(input: string): InlineToken[] {
  if (!input) return [];
  const tokens: InlineToken[] = [];
  // Match **bold**, `code`, or *italic*
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        value: input.slice(lastIndex, match.index),
      });
    }
    const raw = match[0];
    if (raw.startsWith("**") && raw.endsWith("**")) {
      tokens.push({
        type: "bold",
        value: raw.slice(2, -2),
      });
    } else if (raw.startsWith("`") && raw.endsWith("`")) {
      tokens.push({
        type: "code",
        value: raw.slice(1, -1),
      });
    } else if (raw.startsWith("*") && raw.endsWith("*")) {
      tokens.push({
        type: "italic",
        value: raw.slice(1, -1),
      });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    tokens.push({
      type: "text",
      value: input.slice(lastIndex),
    });
  }

  return tokens;
}

/**
 * Normalizes unstructured clinical text (such as single-paragraph ML rationales)
 * into structured markdown with a heading, subheading, and bullet points so that
 * AIResponseViewer always renders a consistent, scannable format.
 */
export function normalizeClinicalMarkdown(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";

  const hasHeading = /^#{1,4}\s+/m.test(trimmed);
  const hasBullets = /^(\s*[-*•]|\s*\d+\.)\s+/m.test(trimmed);

  // If the string already uses markdown headings or bullets, preserve its structure
  // while ensuring it starts with a bold heading if none is present.
  if (hasHeading && hasBullets) {
    return trimmed;
  }

  if (hasBullets && !hasHeading) {
    return `### Clinical Assessment Summary\n#### Key Findings & Recommendations\n${trimmed}`;
  }

  // Convert plain multi-sentence clinical rationale into structured markdown
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return `### Clinical AI Assessment\n#### Analytical Summary\n- **Primary Finding:** ${trimmed}`;
  }

  const firstSentence = sentences[0];
  const remaining = sentences.slice(1);

  const bulletLines = remaining.map((sentence) => {
    // Highlight key clinical terms before colons if present
    const colonIdx = sentence.indexOf(":");
    if (colonIdx > 0 && colonIdx < 35 && !sentence.includes("**")) {
      const prefix = sentence.slice(0, colonIdx).trim();
      const rest = sentence.slice(colonIdx + 1).trim();
      return `- **${prefix}:** ${rest}`;
    }
    return `- ${sentence}`;
  });

  return [
    "### Clinical AI Assessment & Rationale",
    `#### Overview`,
    firstSentence,
    `#### Key Clinical Considerations`,
    ...bulletLines,
  ].join("\n");
}

/**
 * Parses a markdown string into structured blocks with headings, subheadings,
 * grouped bullet lists, numbered lists, and paragraphs.
 */
export function parseMarkdownBlocks(raw: string): ParsedBlock[] {
  const normalized = normalizeClinicalMarkdown(raw);
  if (!normalized) return [];

  const lines = normalized.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];

  let currentBullets: { label?: string; tokens: InlineToken[] }[] = [];
  let currentNumbered: { number: string; tokens: InlineToken[] }[] = [];

  const flushLists = () => {
    if (currentBullets.length > 0) {
      blocks.push({
        type: "bullet-list",
        items: [...currentBullets],
      });
      currentBullets = [];
    }
    if (currentNumbered.length > 0) {
      blocks.push({
        type: "numbered-list",
        items: [...currentNumbered],
      });
      currentNumbered = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushLists();
      continue;
    }

    // Subheading: #### or #####
    if (/^#{4,6}\s+/.test(trimmed)) {
      flushLists();
      const text = trimmed.replace(/^#{4,6}\s+/, "").replace(/\*\*/g, "").trim();
      blocks.push({
        type: "subheading",
        text,
        tokens: parseInlineTokens(text),
      });
      continue;
    }

    // Main Heading: #, ##, ###
    if (/^#{1,3}\s+/.test(trimmed)) {
      flushLists();
      const text = trimmed.replace(/^#{1,3}\s+/, "").replace(/\*\*/g, "").trim();
      blocks.push({
        type: "heading",
        text,
        tokens: parseInlineTokens(text),
      });
      continue;
    }

    // Bullet item: -, *, or •
    if (/^[-*•]\s+/.test(trimmed)) {
      if (currentNumbered.length > 0) flushLists();
      const content = trimmed.replace(/^[-*•]\s+/, "").trim();
      currentBullets.push({
        tokens: parseInlineTokens(content),
      });
      continue;
    }

    // Numbered item: 1. 2. etc.
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      if (currentBullets.length > 0) flushLists();
      currentNumbered.push({
        number: numMatch[1],
        tokens: parseInlineTokens(numMatch[2].trim()),
      });
      continue;
    }

    // Standalone bold line treated as a subheading if it ends with a colon
    if (/^\*\*[^*]+\*\*:?$/.test(trimmed)) {
      flushLists();
      const cleanText = trimmed.replace(/^\*\*|\*\*:?$/g, "").trim();
      blocks.push({
        type: "subheading",
        text: cleanText,
        tokens: parseInlineTokens(cleanText),
      });
      continue;
    }

    // Regular paragraph
    flushLists();
    blocks.push({
      type: "paragraph",
      text: trimmed,
      tokens: parseInlineTokens(trimmed),
    });
  }

  flushLists();
  return blocks;
}
