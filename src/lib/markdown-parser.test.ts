import test from "node:test";
import assert from "node:assert/strict";
import {
  parseInlineTokens,
  normalizeClinicalMarkdown,
  parseMarkdownBlocks,
} from "./markdown-parser";

test("parseInlineTokens parses bold, italic, and plain text segments", () => {
  const tokens = parseInlineTokens(
    "Administer **Meropenem 1g IV** every 8 hours (*extended infusion*)."
  );
  assert.equal(tokens.length, 5);
  assert.deepEqual(tokens[0], { type: "text", value: "Administer " });
  assert.deepEqual(tokens[1], { type: "bold", value: "Meropenem 1g IV" });
  assert.deepEqual(tokens[2], { type: "text", value: " every 8 hours (" });
  assert.deepEqual(tokens[3], { type: "italic", value: "extended infusion" });
  assert.deepEqual(tokens[4], { type: "text", value: ")." });
});

test("parseMarkdownBlocks parses structured markdown with headings, subheadings, and distinct bullet lists", () => {
  const md = [
    "### Sepsis Management Protocol",
    "#### 1. Immediate Actions",
    "- **Blood Cultures:** Obtain 2 sets prior to antimicrobials.",
    "- **Broad-Spectrum IV:** Administer within 1 hour.",
    "#### 2. Escalation Steps",
    "1. Monitor lactate clearance every 2 hours.",
    "2. Titrate norepinephrine to MAP >= 65 mmHg.",
  ].join("\n");

  const blocks = parseMarkdownBlocks(md);
  assert.equal(blocks[0].type, "heading");
  assert.equal(blocks[0].text, "Sepsis Management Protocol");

  assert.equal(blocks[1].type, "subheading");
  assert.equal(blocks[1].text, "1. Immediate Actions");

  assert.equal(blocks[2].type, "bullet-list");
  assert.equal(blocks[2].items?.length, 2);
  assert.equal(blocks[2].items?.[0].tokens[0].type, "bold");
  assert.equal(blocks[2].items?.[0].tokens[0].value, "Blood Cultures:");

  assert.equal(blocks[3].type, "subheading");
  assert.equal(blocks[3].text, "2. Escalation Steps");

  assert.equal(blocks[4].type, "numbered-list");
  assert.equal(blocks[4].items?.length, 2);
  assert.equal(blocks[4].items?.[0].number, "1");
});

test("normalizeClinicalMarkdown converts plain clinical rationale into structured headings, subheadings, and bullets", () => {
  const plainRationale =
    "High probability of ESBL-producing E. coli based on ICU admission and prior fluoroquinolone exposure. Empiric therapy: Initiate Meropenem or Amikacin immediately. Stewardship note: De-escalate upon 48-hour culture sensitivity results.";

  const blocks = parseMarkdownBlocks(plainRationale);
  const types = blocks.map((b) => b.type);

  assert.ok(types.includes("heading"), "Should include a bold main heading");
  assert.ok(types.includes("subheading"), "Should include clear subheadings");
  assert.ok(types.includes("bullet-list"), "Should include distinct bullet points");
});
