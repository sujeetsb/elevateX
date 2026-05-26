import { jsPDF } from 'jspdf';
import type { ResumeDocument } from '@/lib/resume/types';
import type { JobDocumentTemplate } from '@/lib/documents/types';

function wrap(doc: jsPDF, text: string, x: number, y: number, maxW: number, lh: number): number {
  const lines = doc.splitTextToSize(text, maxW) as string[];
  let cy = y;
  for (const line of lines) {
    doc.text(line, x, cy);
    cy += lh;
  }
  return cy;
}

function renderProfessional(doc: jsPDF, resume: ResumeDocument, margin: number, maxW: number) {
  let y = margin;
  const p = resume.personal;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(p.fullName || 'Applicant', margin, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const contact = [p.email, p.phone, p.location, p.linkedIn].filter(Boolean).join(' · ');
  if (contact) {
    doc.text(contact, margin, y);
    y += 14;
  }
  if (p.headline) {
    doc.setFont('helvetica', 'italic');
    doc.text(p.headline, margin, y);
    y += 16;
  }

  const section = (title: string) => {
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), margin, y);
    y += 4;
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + maxW, y);
    y += 14;
  };

  if (resume.summary?.trim()) {
    section('Summary');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y = wrap(doc, resume.summary, margin, y, maxW, 14);
  }

  if (resume.experience.length) {
    section('Experience');
    for (const exp of resume.experience) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${exp.role} — ${exp.company}`, margin, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`${exp.start} – ${exp.end}${exp.location ? ` · ${exp.location}` : ''}`, margin, y);
      y += 12;
      for (const b of exp.bullets.slice(0, 6)) {
        y = wrap(doc, `• ${b}`, margin + 8, y, maxW - 8, 13);
      }
      y += 6;
    }
  }

  if (resume.skills.length) {
    section('Skills');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y = wrap(doc, resume.skills.join(' · '), margin, y, maxW, 14);
  }

  if (resume.education.length) {
    section('Education');
    for (const ed of resume.education) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(ed.school, margin, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      y = wrap(doc, `${ed.degree} · ${ed.start} – ${ed.end}`, margin, y, maxW, 13);
      y += 4;
    }
  }
}

function renderModern(doc: jsPDF, resume: ResumeDocument, margin: number, maxW: number) {
  let y = margin;
  const p = resume.personal;
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(p.fullName || 'Applicant', margin, 36);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text([p.email, p.phone].filter(Boolean).join(' · '), margin, 54);
  doc.setTextColor(30, 41, 59);
  y = 88;
  if (resume.summary) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Profile', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y = wrap(doc, resume.summary, margin, y, maxW, 14);
  }
  if (resume.skills.length) {
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Core Skills', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    y = wrap(doc, resume.skills.join(', '), margin, y, maxW, 14);
  }
  for (const exp of resume.experience.slice(0, 4)) {
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text(exp.role, margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${exp.company} · ${exp.start} – ${exp.end}`, margin, y);
    y += 12;
    doc.setFontSize(10);
    for (const b of exp.bullets.slice(0, 4)) {
      y = wrap(doc, `• ${b}`, margin, y, maxW, 13);
    }
  }
}

function renderMinimal(doc: jsPDF, resume: ResumeDocument, margin: number, maxW: number) {
  let y = margin;
  const p = resume.personal;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(p.fullName || 'Applicant', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text([p.email, p.location].filter(Boolean).join(' · '), margin, y);
  y += 20;
  if (resume.summary) {
    y = wrap(doc, resume.summary, margin, y, maxW, 13);
    y += 12;
  }
  for (const exp of resume.experience) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${exp.role}, ${exp.company}`, margin, y);
    y += 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const b of exp.bullets.slice(0, 5)) {
      y = wrap(doc, `– ${b}`, margin, y, maxW, 12);
    }
    y += 8;
  }
}

export function generateResumePdf(resume: ResumeDocument, template: JobDocumentTemplate = 'professional'): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 54;
  const maxW = doc.internal.pageSize.getWidth() - margin * 2;

  if (template === 'modern') renderModern(doc, resume, margin, maxW);
  else if (template === 'minimal') renderMinimal(doc, resume, margin, maxW);
  else renderProfessional(doc, resume, margin, maxW);

  return doc;
}

export function resumePdfDataUrl(resume: ResumeDocument, template?: JobDocumentTemplate): string {
  return generateResumePdf(resume, template).output('datauristring');
}

export function downloadResumePdf(resume: ResumeDocument, template?: JobDocumentTemplate, filename?: string) {
  const name = (resume.personal.fullName || 'resume').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  generateResumePdf(resume, template).save(filename ?? `resume-${name}.pdf`);
}
