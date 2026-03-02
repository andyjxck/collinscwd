import jsPDF from "jspdf";

type LineItem = {
  description: string;
  qty: number;
  unit_price_pence: number;
  line_total_pence: number;
};

type DocData = {
  type: "quote" | "invoice";
  number: string;
  subtotal_pence: number;
  vat_pence: number;
  total_pence: number;
};

type JobData = {
  title: string;
  address_line_1: string;
  town_city: string;
  postcode: string;
  clientName?: string;
};

function fmt(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateBrandedPDF(doc: DocData, items: LineItem[], job: JobData): Promise<void> {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const margin = 16;
  const contentW = W - margin * 2;

  // Colours
  const INK   = [18, 20, 35]   as [number,number,number];
  const MID   = [100, 105, 125] as [number,number,number];
  const DIVID = [225, 227, 235] as [number,number,number];
  const WHITE = [255, 255, 255] as [number,number,number];
  const HEADER_BG  = [15, 17, 30] as [number,number,number];
  const isQuote = doc.type === "quote";
  const ACCENT     = isQuote ? [195, 145, 30]  as [number,number,number] : [30, 165, 110] as [number,number,number];
  const ACCENT_BG  = isQuote ? [255, 249, 225] as [number,number,number] : [220, 249, 238] as [number,number,number];
  const ROW_STRIPE = [247, 248, 252] as [number,number,number];

  // ── Header ────────────────────────────────────────────────────────
  const hdrH = 46;
  pdf.setFillColor(...HEADER_BG);
  pdf.rect(0, 0, W, hdrH, "F");

  // Accent left bar
  pdf.setFillColor(...ACCENT);
  pdf.rect(0, 0, 4, hdrH, "F");

  // Logo (fetch async)
  const logoDataUrl = await loadImageAsDataUrl("/logomaybe.png");
  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, "PNG", 12, 8, 30, 30);
  }

  // Brand text next to logo
  const textX = logoDataUrl ? 46 : 12;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...WHITE);
  pdf.text("Collins CW&D", textX, 22);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(160, 165, 185);
  pdf.text("Conservatories · Windows · Doors", textX, 30);

  // Doc type pill (top-right of header)
  const label = isQuote ? "QUOTE" : "INVOICE";
  const pillW = 38;
  const pillX = W - margin - pillW;
  pdf.setFillColor(...ACCENT);
  pdf.roundedRect(pillX, 14, pillW, 12, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...WHITE);
  pdf.text(label, pillX + pillW / 2, 22, { align: "center" });

  // Doc number below pill
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(160, 165, 185);
  pdf.text(`#${doc.number}`, pillX + pillW / 2, 32, { align: "center" });

  // ── Meta row (below header) ────────────────────────────────────────
  let y = hdrH + 12;

  // Left: issued to
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MID);
  pdf.text("ISSUED TO", margin, y);

  // Right: date / doc no
  const metaRx = W - margin;
  pdf.text("DATE", W - margin - 50, y);

  y += 5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...INK);
  pdf.text(job.clientName ?? job.title, margin, y);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text(
    new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
    metaRx,
    y,
    { align: "right" },
  );

  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...MID);
  pdf.text(job.address_line_1, margin, y);
  y += 5;
  pdf.text(`${job.town_city}  ${job.postcode}`, margin, y);
  y += 5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...MID);
  pdf.text("JOB", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...INK);
  pdf.text(job.title, margin + 10, y);

  y += 10;

  // ── Divider ───────────────────────────────────────────────────────
  pdf.setDrawColor(...DIVID);
  pdf.setLineWidth(0.25);
  pdf.line(margin, y, W - margin, y);
  y += 6;

  // ── Items table ───────────────────────────────────────────────────
  // Column x positions
  const col = {
    desc:  margin + 2,
    qty:   margin + contentW * 0.60,
    unit:  margin + contentW * 0.75,
    total: W - margin - 2,
  };

  // Header row
  pdf.setFillColor(...INK);
  pdf.rect(margin, y, contentW, 8, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...WHITE);
  pdf.text("DESCRIPTION",  col.desc,  y + 5.5);
  pdf.text("QTY",          col.qty,   y + 5.5, { align: "right" });
  pdf.text("UNIT",         col.unit,  y + 5.5, { align: "right" });
  pdf.text("AMOUNT",       col.total, y + 5.5, { align: "right" });
  y += 8;

  // Rows
  items.forEach((item, idx) => {
    const rowH = 8;
    if (idx % 2 === 1) {
      pdf.setFillColor(...ROW_STRIPE);
      pdf.rect(margin, y, contentW, rowH, "F");
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    // Wrap long descriptions
    const descLines = pdf.splitTextToSize(item.description, contentW * 0.55);
    pdf.text(descLines[0] as string, col.desc, y + 5.5);
    pdf.setTextColor(...MID);
    pdf.text(String(item.qty),             col.qty,   y + 5.5, { align: "right" });
    pdf.text(fmt(item.unit_price_pence),   col.unit,  y + 5.5, { align: "right" });
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...INK);
    pdf.text(fmt(item.line_total_pence),   col.total, y + 5.5, { align: "right" });
    y += rowH;
  });

  // Bottom table border
  pdf.setDrawColor(...DIVID);
  pdf.setLineWidth(0.25);
  pdf.line(margin, y, W - margin, y);
  y += 8;

  // ── Totals ────────────────────────────────────────────────────────
  const totLabelX = W - margin - 68;
  const totValX   = W - margin;

  const drawTotalRow = (label: string, value: string, bold = false, highlight = false) => {
    if (highlight) {
      pdf.setFillColor(...ACCENT_BG);
      pdf.roundedRect(totLabelX - 4, y - 1, totValX - totLabelX + 8, 10, 2, 2, "F");
    }
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(bold ? 11 : 9);
    pdf.setTextColor(highlight ? ACCENT[0] : (bold ? INK[0] : MID[0]), highlight ? ACCENT[1] : (bold ? INK[1] : MID[1]), highlight ? ACCENT[2] : (bold ? INK[2] : MID[2]));
    pdf.text(label, totLabelX, y + 6);
    pdf.text(value, totValX,   y + 6, { align: "right" });
    y += bold ? 12 : 8;
  };

  drawTotalRow("Subtotal",  fmt(doc.subtotal_pence));
  drawTotalRow("VAT (20%)", fmt(doc.vat_pence));
  drawTotalRow("Total",     fmt(doc.total_pence), true, true);

  // ── Footer ────────────────────────────────────────────────────────
  const footY = H - 12;
  pdf.setFillColor(...HEADER_BG);
  pdf.rect(0, H - 18, W, 18, "F");
  pdf.setFillColor(...ACCENT);
  pdf.rect(0, H - 18, 4, 18, "F");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(160, 165, 185);
  pdf.text("Collins CW&D  ·  Conservatories, Windows & Doors", margin + 4, footY);
  pdf.text(
    `${isQuote ? "Quote" : "Invoice"} #${doc.number}  ·  ${new Date().toLocaleDateString("en-GB")}`,
    W - margin,
    footY,
    { align: "right" },
  );

  // ── Save ──────────────────────────────────────────────────────────
  pdf.save(`${isQuote ? "Quote" : "Invoice"}-${doc.number}.pdf`);
}
