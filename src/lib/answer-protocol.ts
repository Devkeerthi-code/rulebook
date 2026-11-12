import { CONFLICT_PREFIX, FOLLOWUPS_PREFIX, NOT_FOUND_TOKEN } from "./prompt";

const TRAILERS = [CONFLICT_PREFIX, FOLLOWUPS_PREFIX];

export interface ProtocolResult {
  /** Answer text the student sees (protocol lines removed). */
  text: string;
  notFound: boolean;
  conflictLine: string | null;
  followups: string[];
}

function couldBecome(partial: string, keyword: string): boolean {
  return keyword.startsWith(partial) || partial.startsWith(keyword);
}

/**
 * Incremental parser for the model's streamed output.
 * Visible text is released as soon as it can't be part of a protocol line
 * (NOT_FOUND at the start, CONFLICT:/FOLLOWUPS: lines at the end), so streaming stays smooth
 * and protocol lines never flash on screen.
 */
export class AnswerStreamParser {
  private buffer = "";
  private released = 0;
  private visible = "";
  private conflictLine: string | null = null;
  private followups: string[] = [];
  private decidedNotFound: boolean | null = null;

  /** Feed raw model text; returns newly visible text (possibly empty). */
  push(chunk: string): string {
    this.buffer += chunk;
    if (this.decidedNotFound === null) {
      const head = this.buffer.trimStart();
      if (head.length < NOT_FOUND_TOKEN.length && NOT_FOUND_TOKEN.startsWith(head)) return "";
      this.decidedNotFound = head.startsWith(NOT_FOUND_TOKEN);
    }
    if (this.decidedNotFound) return "";
    return this.drain(false);
  }

  finish(): ProtocolResult {
    if (this.decidedNotFound === null) this.decidedNotFound = this.buffer.trim().startsWith(NOT_FOUND_TOKEN);
    if (!this.decidedNotFound) this.drain(true);
    return {
      text: this.decidedNotFound ? "" : this.visible.trim(),
      notFound: this.decidedNotFound,
      conflictLine: this.conflictLine,
      followups: this.followups,
    };
  }

  private drain(final: boolean): string {
    let out = "";
    while (true) {
      const newline = this.buffer.indexOf("\n", this.released);
      if (newline === -1) break;
      const line = this.buffer.slice(this.released, newline);
      out += this.consumeLine(line, true);
      this.released = newline + 1;
    }
    const partial = this.buffer.slice(this.released);
    if (final) {
      out += this.consumeLine(partial, false);
      this.released = this.buffer.length;
    } else {
      out += this.releasePartial(partial);
    }
    this.visible += out;
    return out;
  }

  private partialSent = 0;

  /** Release the unfinished last line unless it might still turn into a protocol line. */
  private releasePartial(partial: string): string {
    const probe = partial.trimStart();
    if (TRAILERS.some((k) => couldBecome(probe, k))) return "";
    const fresh = partial.slice(this.partialSent);
    this.partialSent = partial.length;
    return fresh;
  }

  private consumeLine(line: string, withNewline: boolean): string {
    const alreadySent = this.partialSent;
    this.partialSent = 0;
    const trimmed = line.trim();
    if (trimmed.startsWith(CONFLICT_PREFIX)) {
      this.conflictLine = trimmed;
      return "";
    }
    if (trimmed.startsWith(FOLLOWUPS_PREFIX)) {
      this.followups = trimmed
        .slice(FOLLOWUPS_PREFIX.length)
        .split("|")
        .map((q) => q.trim())
        .filter((q) => q.length > 3 && q.length < 160)
        .slice(0, 3);
      return "";
    }
    return line.slice(alreadySent) + (withNewline ? "\n" : "");
  }
}
