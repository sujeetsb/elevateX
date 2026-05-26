import { jsPDF } from 'jspdf';

export type CoverLetterPdfInput = {
  name: string;
  email: string;
  phone?: string;
  linkedIn?: string;
  date: string;
  company: string;
  jobTitle: string;
  body: string;
};

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  let cursorY = y;
  for (const line of lines) {
    doc.text(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

export function generateCoverLetterPdf(input: CoverLetterPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 54;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(input.name || 'Applicant', margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const contact = [input.email, input.phone, input.linkedIn].filter(Boolean).join(' · ');
  if (contact) {
    doc.text(contact, margin, y);
    y += 16;
  }

  doc.text(input.date, margin, y);
  y += 24;

  doc.setFont('helvetica', 'bold');
  doc.text(`${input.company}`, margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text(`Re: ${input.jobTitle}`, margin, y);
  y += 28;

  doc.setFontSize(11);
  y = wrapText(doc, input.body, margin, y, maxWidth, 16);

  return doc;
}

export function coverLetterPdfBlob(input: CoverLetterPdfInput): Blob {
  return generateCoverLetterPdf(input).output('blob');
}

export function coverLetterPdfDataUrl(input: CoverLetterPdfInput): string {
  return generateCoverLetterPdf(input).output('datauristring');
}

export function downloadCoverLetterPdf(input: CoverLetterPdfInput, filename?: string) {
  const safeName = (input.company || 'cover-letter').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  generateCoverLetterPdf(input).save(filename ?? `cover-letter-${safeName}.pdf`);
}
