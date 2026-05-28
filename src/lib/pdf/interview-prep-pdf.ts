import { jsPDF } from 'jspdf';
import type { InterviewPrepPayload, InterviewQuestion } from '@/lib/documents/interview-prep-types';

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  let cursorY = y;
  for (const line of lines) {
    if (cursorY > doc.internal.pageSize.getHeight() - 54) {
      doc.addPage();
      cursorY = 54;
    }
    doc.text(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

function sectionTitle(doc: jsPDF, title: string, y: number, margin: number): number {
  if (y > doc.internal.pageSize.getHeight() - 72) {
    doc.addPage();
    y = 54;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, margin, y);
  return y + 18;
}

function renderQuestions(
  doc: jsPDF,
  questions: InterviewQuestion[],
  y: number,
  margin: number,
  maxWidth: number,
): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  questions.forEach((q, i) => {
    y = wrapText(doc, `${i + 1}. ${q.question}`, margin, y, maxWidth, 14);
    if (q.hint) y = wrapText(doc, `   Hint: ${q.hint}`, margin + 8, y + 2, maxWidth - 8, 12);
    if (q.answerGuide) y = wrapText(doc, `   Guide: ${q.answerGuide}`, margin + 8, y + 2, maxWidth - 8, 12);
    y += 8;
  });
  return y;
}

export function generateInterviewPrepPdf(payload: InterviewPrepPayload): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 54;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Interview Preparation', margin, y);
  y += 20;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${payload.jobTitle} · ${payload.company}`, margin, y);
  y += 28;

  if (payload.preparationTips.length) {
    y = sectionTitle(doc, 'Preparation Tips', y, margin);
    payload.preparationTips.forEach((tip, i) => {
      y = wrapText(doc, `• ${tip}`, margin, y, maxWidth, 14);
    });
    y += 10;
  }

  if (payload.importantSkills.length) {
    y = sectionTitle(doc, 'Important Skills', y, margin);
    y = wrapText(doc, payload.importantSkills.join(' · '), margin, y, maxWidth, 14);
    y += 14;
  }

  if (payload.expectedTopics.length) {
    y = sectionTitle(doc, 'Expected Topics', y, margin);
    y = wrapText(doc, payload.expectedTopics.join(' · '), margin, y, maxWidth, 14);
    y += 14;
  }

  if (payload.behavioralQuestions.length) {
    y = sectionTitle(doc, 'Behavioral Questions', y, margin);
    y = renderQuestions(doc, payload.behavioralQuestions, y, margin, maxWidth);
    y += 8;
  }

  if (payload.technicalQuestions.length) {
    y = sectionTitle(doc, 'Technical Questions', y, margin);
    y = renderQuestions(doc, payload.technicalQuestions, y, margin, maxWidth);
    y += 8;
  }

  if (payload.hrQuestions.length) {
    y = sectionTitle(doc, 'HR Questions', y, margin);
    y = renderQuestions(doc, payload.hrQuestions, y, margin, maxWidth);
    y += 8;
  }

  if (payload.scenarioQuestions.length) {
    y = sectionTitle(doc, 'Scenario-Based Questions', y, margin);
    y = renderQuestions(doc, payload.scenarioQuestions, y, margin, maxWidth);
  }

  return doc;
}

export function interviewPrepPdfDataUrl(payload: InterviewPrepPayload): string {
  return generateInterviewPrepPdf(payload).output('datauristring');
}

export function downloadInterviewPrepPdf(payload: InterviewPrepPayload, filename?: string) {
  const safe = `${payload.company}-${payload.jobTitle}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  generateInterviewPrepPdf(payload).save(filename ?? `interview-prep-${safe}.pdf`);
}
