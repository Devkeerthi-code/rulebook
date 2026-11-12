import { describe, expect, it } from "vitest";
import { inPassage } from "./highlight";
import { normalizeForMatch } from "./text";

const passage = normalizeForMatch(
  "A student must have a minimum of 75% attendance in each course to be eligible to write the end-semester examination of that course.",
);

describe("inPassage (PDF highlight matching)", () => {
  it("matches wrapped lines of the cited passage, ignoring case and punctuation", () => {
    expect(inPassage("A student must have a minimum of 75% attendance in each course to be", passage)).toBe(true);
    expect(inPassage("eligible to write the end-semester examination of that course.", passage)).toBe(true);
  });

  it("does not match lines from other clauses on the same page", () => {
    expect(inPassage("Attendance is counted from the first instructional day of the semester", passage)).toBe(false);
  });

  it("ignores short fragments that would light up everywhere", () => {
    expect(inPassage("the", passage)).toBe(false);
    expect(inPassage("course", passage)).toBe(false);
  });
});
