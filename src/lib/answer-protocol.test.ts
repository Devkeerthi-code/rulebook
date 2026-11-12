import { describe, expect, it } from "vitest";
import { AnswerStreamParser } from "./answer-protocol";

function feed(parts: string[]) {
  const parser = new AnswerStreamParser();
  const visible = parts.map((p) => parser.push(p)).join("");
  return { visible, result: parser.finish() };
}

describe("AnswerStreamParser", () => {
  it("streams plain answer text through", () => {
    const { visible, result } = feed(["You need ", "75% [S1].", "\nMore text."]);
    expect(result.text).toBe("You need 75% [S1].\nMore text.");
    expect(visible + "").toBe("You need 75% [S1].\nMore text.");
    expect(result.notFound).toBe(false);
  });

  it("detects NOT_FOUND even when it arrives split across chunks, and shows nothing", () => {
    const { visible, result } = feed(["NOT_", "FOU", "ND"]);
    expect(visible).toBe("");
    expect(result).toMatchObject({ notFound: true, text: "" });
  });

  it("does not mistake a normal answer starting with 'No' for NOT_FOUND", () => {
    const { result } = feed(["No", ", room changes are only allowed in the first two weeks [S1]."]);
    expect(result.notFound).toBe(false);
    expect(result.text.startsWith("No, room")).toBe(true);
  });

  it("hides CONFLICT and FOLLOWUPS lines from the visible stream and parses them", () => {
    const { visible, result } = feed([
      "Condonation needs 65% [S2].\nCONF",
      "LICT: S2 over S1 | Circular raised 60% to 65%\nFOLLOW",
      "UPS: What is the fee? | How many times? | Does on-duty count?",
    ]);
    expect(visible).not.toContain("CONFLICT");
    expect(visible).not.toContain("FOLLOWUPS");
    expect(result.text).toBe("Condonation needs 65% [S2].");
    expect(result.conflictLine).toBe("CONFLICT: S2 over S1 | Circular raised 60% to 65%");
    expect(result.followups).toEqual(["What is the fee?", "How many times?", "Does on-duty count?"]);
  });

  it("releases partial lines early when they can't be protocol lines", () => {
    const parser = new AnswerStreamParser();
    expect(parser.push("You need at least")).toBe("You need at least");
    expect(parser.push(" 75%")).toBe(" 75%");
  });
});
