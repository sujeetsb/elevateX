'use client';

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import type { ResumeDocument } from './types';

export async function exportResumeToDocx(doc: ResumeDocument, fileName: string) {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: doc.personal.fullName,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
    }),
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `${doc.personal.email} · ${doc.personal.phone} · ${doc.personal.location}`, size: 22 }),
      ],
    }),
  );
  if (doc.personal.linkedIn) {
    children.push(new Paragraph({ children: [new TextRun({ text: doc.personal.linkedIn, size: 20 })] }));
  }

  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  children.push(new Paragraph({ text: 'Professional Summary', heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ text: doc.summary, spacing: { after: 200 } }));

  children.push(new Paragraph({ text: 'Experience', heading: HeadingLevel.HEADING_2 }));
  for (const e of doc.experience) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${e.role} — ${e.company}`, bold: true, size: 24 }),
          new TextRun({ text: `  (${e.start} – ${e.end})`, italics: true, size: 22 }),
        ],
        spacing: { before: 120 },
      }),
    );
    for (const b of e.bullets) {
      children.push(new Paragraph({ text: `• ${b}`, spacing: { after: 80 } }));
    }
  }

  children.push(new Paragraph({ text: 'Skills', heading: HeadingLevel.HEADING_2, spacing: { before: 160 } }));
  children.push(new Paragraph({ text: doc.skills.join(' · '), spacing: { after: 160 } }));

  children.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2, spacing: { before: 160 } }));
  for (const ed of doc.education) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${ed.school} — ${ed.degree}`, bold: true }),
          new TextRun({ text: `  (${ed.start} – ${ed.end})`, italics: true }),
        ],
      }),
    );
  }

  if (doc.projects.length) {
    children.push(new Paragraph({ text: 'Projects', heading: HeadingLevel.HEADING_2, spacing: { before: 160 } }));
    for (const p of doc.projects) {
      children.push(new Paragraph({ children: [new TextRun({ text: p.name, bold: true })] }));
      children.push(new Paragraph({ text: p.description, spacing: { after: 120 } }));
    }
  }

  if (doc.certifications.length) {
    children.push(new Paragraph({ text: 'Certifications', heading: HeadingLevel.HEADING_2, spacing: { before: 160 } }));
    for (const c of doc.certifications) {
      children.push(new Paragraph({ text: `${c.name} — ${c.issuer} (${c.date})` }));
    }
  }

  if (doc.achievements.length) {
    children.push(new Paragraph({ text: 'Achievements', heading: HeadingLevel.HEADING_2, spacing: { before: 160 } }));
    for (const a of doc.achievements) {
      children.push(new Paragraph({ text: `• ${a}`, spacing: { after: 80 } }));
    }
  }

  const document = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  saveAs(blob, `${fileName.replace(/\.docx$/i, '')}.docx`);
}
