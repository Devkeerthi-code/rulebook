import { describe, expect, it } from "vitest";
import type { AnswerSource } from "./answer-types";
import { parseAnswer } from "./answer-format";
import { citedNumbers, finalizeAnswer, nameSources, normalizeCitations, parseConflict, resolveCitation, sanitizeAnswer } from "./citations";

function source(n: number, over: Partial<AnswerSource> = {}): AnswerSource {
  return {
    n,
    chunkId: `chunk${n}`,
    documentId: `doc${n}`,
    title: `Doc ${n}`,
    type: "HANDBOOK",
    page: n * 10,
    effectiveDate: "2025-07-01",
    heading: "",
    text: `text ${n}`,
    ...over,
  };
}

const sources = [
  source(1, { documentId: "handbook", title: "Student Handbook", page: 5, effectiveDate: "2025-07-01" }),
  source(2, { documentId: "circular", title: "Circular 07/2025", page: 1, effectiveDate: "2025-09-12", type: "CIRCULAR" }),
  source(3, { documentId: "handbook", title: "Student Handbook", page: 6, effectiveDate: "2025-07-01" }),
];

describe("citation mapping", () => {
  it("maps each [S#] to its document and page", () => {
    const text = "You need 75% [S1]. Condonation needs 65% [S2].";
    const mapped = citedNumbers(text).map((n) => resolveCitation(n, sources));
    expect(mapped.map((s) => `${s?.title} p.${s?.page}`)).toEqual(["Student Handbook p.5", "Circular 07/2025 p.1"]);
  });

  it("understands grouped citations and keeps first-seen order without duplicates", () => {
    expect(citedNumbers("A [S2, S1]. B [S1][S3]. C [s2]")).toEqual([2, 1, 3]);
  });

  it("drops citations to sources the model was never given", () => {
    expect(normalizeCitations("A [S1, S9]. B [S7].", sources)).toBe("A [S1]. B .");
  });

  it("returns null for an unknown citation", () => {
    expect(resolveCitation(42, sources)).toBeNull();
  });

  it("treats an answer that cites nothing valid as uncited", () => {
    expect(finalizeAnswer("Attendance must be 75%.", sources)).toMatchObject({ uncited: true, cited: [] });
    expect(finalizeAnswer("Attendance must be 75% [S8].", sources)).toMatchObject({ uncited: true });
    expect(finalizeAnswer("Attendance must be 75% [S1].", sources)).toMatchObject({ uncited: false, cited: [1] });
  });
});

describe("parseConflict", () => {
  it("parses a conflict line", () => {
    expect(parseConflict("CONFLICT: S2 over S3 | Circular raised 60% to 65%", sources)).toEqual({
      newer: 2,
      older: 3,
      note: "Circular raised 60% to 65%",
    });
  });

  it("uses effective dates, not the model's order, to decide which rule is newer", () => {
    expect(parseConflict("CONFLICT: S3 over S2 | x", sources)).toMatchObject({ newer: 2, older: 3 });
  });

  it("ignores conflicts within one document or with unknown sources", () => {
    expect(parseConflict("CONFLICT: S1 over S3 | same doc", sources)).toBeNull();
    expect(parseConflict("CONFLICT: S1 over S9 | unknown", sources)).toBeNull();
    expect(parseConflict(null, sources)).toBeNull();
  });
});

describe("sanitizeAnswer", () => {
  it("removes links, images and HTML that could exfiltrate data or render markup", () => {
    const dirty = 'See [the portal](https://evil.example/?q=secret) ![x](https://evil.example/p.png) <img src=x onerror=alert(1)> https://evil.example';
    const clean = sanitizeAnswer(dirty);
    expect(clean).not.toMatch(/https?:|<img|!\[/);
    expect(clean).toContain("the portal");
  });
});

describe("parseAnswer", () => {
  it("builds paragraphs, bullets, bold and citation nodes without HTML", () => {
    const blocks = parseAnswer("You need **75%** [S1].\n- Condonation from **65%** [S2]\n- Fee Rs. 500 [S2]");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      kind: "p",
      parts: [
        { kind: "text", text: "You need ", bold: false },
        { kind: "text", text: "75%", bold: true },
        { kind: "text", text: " ", bold: false },
        { kind: "cite", n: 1 },
        { kind: "text", text: ".", bold: false },
      ],
    });
    const list = blocks[1];
    expect(list?.kind).toBe("ul");
    expect(list?.kind === "ul" ? list.items : []).toHaveLength(2);
  });
});

describe("nameSources", () => {
  it("replaces S-numbers in a conflict note with document names and pages", () => {
    expect(nameSources("S2 raised the 60% rule in S1 to 65%.", sources)).toBe(
      "Circular 07/2025 (p. 1) raised the 60% rule in Student Handbook (p. 5) to 65%.",
    );
  });
});
