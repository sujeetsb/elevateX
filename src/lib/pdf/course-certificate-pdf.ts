import { jsPDF } from 'jspdf';

export type CourseCertificatePdfInput = {
  userName: string;
  courseTitle: string;
  completedAt: string;
  certificateId: string;
  xpEarned?: number;
};

export function generateCourseCertificatePdf(input: CourseCertificatePdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;

  doc.setDrawColor(124, 58, 237);
  doc.setLineWidth(2);
  doc.rect(margin, margin, w - margin * 2, h - margin * 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(124, 58, 237);
  doc.text('Certificate of Completion', w / 2, margin + 56, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text('ElevateX AI Career Copilot', w / 2, margin + 78, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('This certifies that', w / 2, margin + 120, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42);
  doc.text(input.userName, w / 2, margin + 158, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.text('has successfully completed', w / 2, margin + 192, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(input.courseTitle, w / 2, margin + 224, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(`Completed: ${input.completedAt}`, w / 2, margin + 258, { align: 'center' });
  if (input.xpEarned) {
    doc.text(`XP earned: ${input.xpEarned}`, w / 2, margin + 276, { align: 'center' });
  }
  doc.text(`Certificate ID: ${input.certificateId}`, w / 2, h - margin - 24, { align: 'center' });

  return doc;
}

export function downloadCourseCertificatePdf(input: CourseCertificatePdfInput, filename?: string) {
  const doc = generateCourseCertificatePdf(input);
  doc.save(filename ?? `certificate-${input.certificateId}.pdf`);
}

export function courseCertificatePdfDataUrl(input: CourseCertificatePdfInput): string {
  return generateCourseCertificatePdf(input).output('dataurlstring');
}
