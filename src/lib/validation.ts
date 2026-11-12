import { z } from "zod";

export const DOC_TYPES = ["HANDBOOK", "REGULATIONS", "SYLLABUS", "POLICY", "CIRCULAR", "RULES", "OTHER"] as const;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: "That doesn't look like an email address." }));

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name (2+ characters).").max(80),
  email,
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "That's too long (128 characters max).")
    .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Mix letters and at least one number."),
  next: z.string().max(300).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
  next: z.string().max(300).optional(),
});

export const createSpaceSchema = z.object({
  name: z.string().trim().min(3, "College name needs at least 3 characters.").max(120),
  shortName: z
    .string()
    .trim()
    .min(2, "Short name needs 2+ characters.")
    .max(12, "Keep the short name to 12 characters.")
    .regex(/^[\p{L}\p{N} .&-]+$/u, "Letters, numbers, spaces, dots, & and - only."),
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
  .refine((d) => !Number.isNaN(Date.parse(d)), "That date isn't valid.")
  .refine((d) => d >= "1950-01-01" && d <= "2100-12-31", "That date is out of range.");

export const documentMetaSchema = z.object({
  title: z.string().trim().min(3, "Give the document a title (3+ characters).").max(140),
  type: z.enum(DOC_TYPES),
  effectiveDate: isoDate,
});

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGES = 400;

export const askSchema = z.object({
  question: z.string().trim().min(3, "Ask a full question.").max(500, "Keep questions under 500 characters."),
  conversationId: z.string().cuid().optional(),
});

export const feedbackSchema = z.object({
  messageId: z.string().cuid(),
  rating: z.enum(["UP", "DOWN"]),
  reason: z.enum(["WRONG_ANSWER", "OUTDATED_RULE", "WRONG_PAGE", "INCOMPLETE", "SHOULD_BE_IN_DOCS", "OTHER"]).optional(),
  note: z.string().trim().max(500).optional(),
});

export const idSchema = z.string().cuid();

/** Only allow same-site relative redirects after login (no //evil.com, no schemes). */
export function safeNext(next: string | undefined | null, fallback = "/spaces"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** First message per field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
