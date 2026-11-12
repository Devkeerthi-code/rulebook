/** Turns the model's restricted markdown (paragraphs, "- " bullets, **bold**, [S1]) into a safe tree. No HTML is ever produced. */

export type Inline = { kind: "text"; text: string; bold: boolean } | { kind: "cite"; n: number };
export type Block = { kind: "p"; parts: Inline[] } | { kind: "ul"; items: Inline[][] };

export function parseInline(line: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[S(\d+)\]/g;
  let last = 0;
  for (const m of line.matchAll(pattern)) {
    const index = m.index ?? 0;
    if (index > last) parts.push({ kind: "text", text: line.slice(last, index), bold: false });
    if (m[1] !== undefined) parts.push({ kind: "text", text: m[1], bold: true });
    else parts.push({ kind: "cite", n: Number(m[2]) });
    last = index + m[0].length;
  }
  if (last < line.length) parts.push({ kind: "text", text: line.slice(last), bold: false });
  return parts.map((p) => (p.kind === "text" ? { ...p, text: p.text.replace(/\*\*/g, "") } : p));
}

export function parseAnswer(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      const prev = blocks.at(-1);
      const item = parseInline(bullet[1]!);
      if (prev?.kind === "ul") prev.items.push(item);
      else blocks.push({ kind: "ul", items: [item] });
    } else {
      blocks.push({ kind: "p", parts: parseInline(line) });
    }
  }
  return blocks;
}
