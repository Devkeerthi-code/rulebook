import { describe, expect, it } from "vitest";
import { chunkPages, embeddingInput, isHeading, stripRunningLines, type PageText } from "./chunking";

const sentence = (n: number) => `Rule sentence number ${n} says something specific about attendance and exams.`;

describe("isHeading", () => {
  it.each([
    ["Section 4: Attendance", true],
    ["4.1 Minimum attendance", true],
    ["STUDENT HANDBOOK 2025-26", true],
    ["Subject: Revised norms for condonation of attendance shortage", true],
    ["Chapter IV", true],
    ["A student must have a minimum of 75% attendance in each course.", false],
    ["14.1 A student may apply for revaluation of an end-semester theory examination answer script within seven", false],
    ["CGPA.", false],
  ])("%s -> %s", (line, expected) => {
    expect(isHeading(line)).toBe(expected);
  });
});

describe("chunkPages", () => {
  it("keeps every chunk on the page its text came from", () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: "Section 1: Registration\nStudents register in the first week." },
      { pageNumber: 2, text: "Students who miss it pay a late fee of Rs. 1,000." },
      { pageNumber: 5, text: "Section 4: Attendance\n4.1 Minimum attendance\nA student needs 75% in each course." },
    ];
    const chunks = chunkPages(pages);
    expect(chunks.map((c) => c.pageNumber)).toEqual([1, 2, 5]);
    expect(chunks.find((c) => c.text.includes("75%"))?.pageNumber).toBe(5);
    expect(chunks.find((c) => c.text.includes("late fee"))?.pageNumber).toBe(2);
  });

  it("carries the last heading across a page break", () => {
    const chunks = chunkPages([
      { pageNumber: 3, text: "4.6 Condonation of shortage\nShortage may be condoned above 60%." },
      { pageNumber: 4, text: "Condonation is allowed at most twice." },
    ]);
    expect(chunks[1]).toMatchObject({ pageNumber: 4, heading: "4.6 Condonation of shortage" });
  });

  it("splits along headings so two rules don't share a chunk", () => {
    const chunks = chunkPages([{ pageNumber: 1, text: "6.1 Applying\nApply within seven days.\n6.2 Fees\nThe fee is Rs. 1,000." }]);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ heading: "6.1 Applying", text: "Apply within seven days." });
    expect(chunks[1]).toMatchObject({ heading: "6.2 Fees", text: "The fee is Rs. 1,000." });
  });

  it("respects maxChars and overlaps consecutive chunks by whole trailing sentences", () => {
    const text = Array.from({ length: 30 }, (_, i) => sentence(i)).join(" ");
    const chunks = chunkPages([{ pageNumber: 7, text }], { maxChars: 400, overlapChars: 120 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(400);
    expect(chunks[0]!.overlapChars).toBe(0);
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1]!;
      const curr = chunks[i]!;
      const overlap = curr.text.slice(0, curr.overlapChars);
      expect(curr.overlapChars).toBeGreaterThan(0);
      expect(curr.overlapChars).toBeLessThanOrEqual(120);
      expect(prev.text.endsWith(overlap)).toBe(true);
      // The overlap is whole sentences, never a cut word.
      expect(overlap).toMatch(/^Rule sentence number \d+/);
      expect(overlap.endsWith(".")).toBe(true);
    }
    // Nothing is lost: every sentence appears in some chunk.
    for (let i = 0; i < 30; i++) expect(chunks.some((c) => c.text.includes(sentence(i)))).toBe(true);
  });

  it("does not overlap across headings or pages", () => {
    const chunks = chunkPages(
      [
        { pageNumber: 1, text: `Section 1: A\n${sentence(1)} ${sentence(2)}` },
        { pageNumber: 2, text: `Section 2: B\n${sentence(3)}` },
      ],
      { maxChars: 400, overlapChars: 200 },
    );
    expect(chunks.every((c) => c.overlapChars === 0)).toBe(true);
  });

  it("hard-splits a single sentence longer than maxChars on word boundaries", () => {
    const long = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkPages([{ pageNumber: 1, text: long }], { maxChars: 200, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= 200 && !c.text.startsWith(" "))).toBe(true);
  });

  it("numbers chunks with unique increasing ordinals", () => {
    const chunks = chunkPages([
      { pageNumber: 1, text: "1.1 A\nOne." },
      { pageNumber: 2, text: "1.2 B\nTwo." },
    ]);
    expect(chunks.map((c) => c.ordinal)).toEqual([0, 1]);
  });

  it("skips pages with no text", () => {
    expect(chunkPages([{ pageNumber: 1, text: "   \n " }])).toEqual([]);
  });
});

describe("stripRunningLines", () => {
  it("removes headers repeated on most pages and page-number footers", () => {
    const topics = ["fees", "exams", "hostel", "mess"];
    const pages = [1, 2, 3, 4].map((n) => ({
      pageNumber: n,
      text: `Northfield Institute - Handbook\nThe rule about ${topics[n - 1]} lives here.\nHandbook - page ${n} of 4`,
    }));
    const stripped = stripRunningLines(pages);
    for (const p of stripped) {
      expect(p.text).not.toContain("Northfield Institute");
      expect(p.text).not.toMatch(/page \d of 4/);
      expect(p.text).toBe(`The rule about ${topics[p.pageNumber - 1]} lives here.`);
    }
  });
});

describe("embeddingInput", () => {
  it("prefixes the document title and section", () => {
    expect(embeddingInput("Handbook", { heading: "4.1 Attendance", text: "75%." })).toBe("Handbook — 4.1 Attendance\n75%.");
  });
});
