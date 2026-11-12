import { PDFDocument } from "pdf-lib";
import { getDocumentProxy } from "unpdf";
import type { PageText } from "@/lib/chunking";

/** A page with fewer readable characters than this is treated as scanned and sent to OCR. */
export const MIN_TEXT_CHARS = 40;

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  hasEOL: boolean;
}

function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item;
}

/** Rebuild lines from pdf.js text items using their y position; headings depend on real line breaks. */
export function itemsToText(items: unknown[]): string {
  let out = "";
  let lastY: number | null = null;
  let lastXEnd = 0;
  for (const item of items) {
    if (!isTextItem(item)) continue;
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    if (lastY !== null && Math.abs(y - lastY) > 2 && !out.endsWith("\n")) out += "\n";
    else if (out && !out.endsWith("\n") && !out.endsWith(" ") && !item.str.startsWith(" ") && x - lastXEnd > 1) out += " ";
    out += item.str;
    lastY = y;
    lastXEnd = x + (item.width ?? 0);
    if (item.hasEOL && !out.endsWith("\n")) out += "\n";
  }
  return out;
}

export interface ExtractedPdf {
  pageCount: number;
  pages: PageText[];
}

export async function extractPages(bytes: Uint8Array): Promise<ExtractedPdf> {
  // pdf.js takes ownership of the buffer it is given, so hand it a copy.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const pages: PageText[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push({ pageNumber: n, text: itemsToText(content.items) });
      page.cleanup();
    }
    return { pageCount: pdf.numPages, pages };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

export function needsOcr(text: string): boolean {
  return text.replace(/\s+/g, "").length < MIN_TEXT_CHARS;
}

/** Copy one page into its own PDF so only that page is sent to OCR. */
export async function extractSinglePage(bytes: Uint8Array, pageNumber: number): Promise<Uint8Array> {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const single = await PDFDocument.create();
  const [page] = await single.copyPages(source, [pageNumber - 1]);
  single.addPage(page!);
  return single.save();
}

/** Cheap header check before handing bytes to a parser. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}
