import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { DEMO_RUNNING_HEADER, type DemoDocument } from "./corpus";

const A4 = { width: 595.28, height: 841.89 };
const MARGIN_X = 64;
const TOP = A4.height - 72;
const BOTTOM = 80;
const INK = rgb(0.106, 0.098, 0.082);
const MUTED = rgb(0.29, 0.27, 0.24);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawFrame(page: PDFPage, doc: DemoDocument, n: number, total: number, regular: PDFFont) {
  page.drawText(DEMO_RUNNING_HEADER, { x: MARGIN_X, y: A4.height - 40, size: 8, font: regular, color: MUTED });
  page.drawLine({ start: { x: MARGIN_X, y: A4.height - 48 }, end: { x: A4.width - MARGIN_X, y: A4.height - 48 }, thickness: 0.6, color: INK });
  const footer = `${doc.title} - page ${n} of ${total} - DEMO DOCUMENT`;
  page.drawText(footer, { x: MARGIN_X, y: 40, size: 8, font: regular, color: MUTED });
}

/** Render a demo document to a real, text-based PDF: one corpus page = one PDF page. */
export async function renderDemoPdf(doc: DemoDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.title} (DEMO)`);
  pdf.setSubject("Fictional demo document for Rulebook. Not the rules of any real college.");
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = A4.width - MARGIN_X * 2;

  doc.pages.forEach((blocks, index) => {
    const page = pdf.addPage([A4.width, A4.height]);
    drawFrame(page, doc, index + 1, doc.pages.length, regular);
    let y = TOP;
    for (const block of blocks) {
      const isHeading = "h" in block;
      const font = isHeading ? bold : regular;
      const size = isHeading ? 12 : 11;
      const leading = isHeading ? 16 : 15.5;
      y -= isHeading ? 10 : 2;
      for (const line of wrap(isHeading ? block.h : block.p, font, size, width)) {
        if (y < BOTTOM) throw new Error(`Demo page ${index + 1} of "${doc.title}" overflows; split it.`);
        page.drawText(line, { x: MARGIN_X, y, size, font, color: INK });
        y -= leading;
      }
      y -= isHeading ? 0 : 6;
    }
  });
  return pdf.save();
}
