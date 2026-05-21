'use client';

import type { ResumeDocument, ResumeTemplateId, SectionId } from '../../lib/resume/types';
import { getTemplateMeta } from '../../lib/resume/templates';

export interface ResumePreviewProps {
  doc: ResumeDocument;
  templateId: ResumeTemplateId;
  previewMode?: 'desktop' | 'mobile';
  /** Dot paths e.g. summary, experience.0.bullets.1 */
  highlightPaths?: Set<string>;
  className?: string;
  /** Root element id for PDF capture */
  exportRootId?: string;
}

function SectionHeading({
  title,
  accent,
  templateId,
}: {
  title: string;
  accent: string;
  templateId: ResumeTemplateId;
}) {
  if (templateId === 'minimal') {
    return (
      <h2
        style={{
          fontSize: '0.65rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#64748b',
          margin: '0 0 8px',
          fontWeight: 600,
        }}
      >
        {title}
      </h2>
    );
  }
  if (templateId === 'creative') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 6, height: 22, borderRadius: 4, background: accent }} />
        <h2 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a', fontWeight: 800 }}>{title}</h2>
      </div>
    );
  }
  if (templateId === 'executive') {
    return (
      <h2
        style={{
          margin: '0 0 10px',
          fontSize: '0.85rem',
          color: accent,
          fontWeight: 700,
          borderBottom: `2px solid ${accent}33`,
          paddingBottom: 4,
        }}
      >
        {title}
      </h2>
    );
  }
  return (
    <h2 style={{ margin: '0 0 8px', fontSize: '0.78rem', color: accent, fontWeight: 700, letterSpacing: '0.04em' }}>
      {title.toUpperCase()}
    </h2>
  );
}

function renderSection(
  id: SectionId,
  doc: ResumeDocument,
  meta: ReturnType<typeof getTemplateMeta>,
  highlightPaths: Set<string> | undefined,
) {
  const accent = meta.accent;
  const muted = meta.muted;
  const hl = (path: string) =>
    highlightPaths?.has(path) ? { background: 'rgba(124,58,237,0.12)', outline: '1px solid rgba(124,58,237,0.35)', borderRadius: 6 } : {};

  switch (id) {
    case 'summary':
      return (
        <section key="summary" style={{ marginBottom: meta.density === 'compact' ? 14 : 18 }}>
          <SectionHeading title="Summary" accent={accent} templateId={meta.id} />
          <p style={{ ...hl('summary'), margin: 0, color: '#334155', fontSize: meta.density === 'spacious' ? '0.88rem' : '0.82rem', lineHeight: 1.55 }}>
            {doc.summary}
          </p>
        </section>
      );
    case 'experience':
      return (
        <section key="experience" style={{ marginBottom: meta.density === 'compact' ? 14 : 18 }}>
          <SectionHeading title="Experience" accent={accent} templateId={meta.id} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {doc.experience.map((e, ei) => (
              <div key={e.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{e.role}</div>
                    <div style={{ color: muted, fontSize: '0.78rem' }}>
                      {e.company}
                      {e.location ? ` · ${e.location}` : ''}
                    </div>
                  </div>
                  <div style={{ color: muted, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {e.start} – {e.end}
                  </div>
                </div>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#475569', fontSize: '0.8rem', lineHeight: 1.45 }}>
                  {e.bullets.map((b, bi) => (
                    <li key={bi} style={{ marginBottom: 4, ...hl(`experience.${ei}.bullets.${bi}`) }}>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      );
    case 'skills':
      return (
        <section key="skills" style={{ marginBottom: meta.density === 'compact' ? 14 : 18 }}>
          <SectionHeading title="Skills" accent={accent} templateId={meta.id} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...hl('skills') }}>
            {doc.skills.map(s => (
              <span
                key={s}
                style={{
                  fontSize: '0.72rem',
                  padding: '4px 10px',
                  borderRadius: meta.id === 'developer' ? 4 : 999,
                  background: meta.id === 'minimal' ? '#f1f5f9' : `${accent}14`,
                  color: '#0f172a',
                  border: meta.id === 'minimal' ? '1px solid #e2e8f0' : `1px solid ${accent}22`,
                  fontFamily: meta.id === 'developer' ? meta.fontBody : undefined,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </section>
      );
    case 'projects':
      return (
        <section key="projects" style={{ marginBottom: meta.density === 'compact' ? 14 : 18 }}>
          <SectionHeading title="Projects" accent={accent} templateId={meta.id} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {doc.projects.map(p => (
              <div key={p.id}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem' }}>{p.name}</div>
                <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '0.78rem', lineHeight: 1.45 }}>{p.description}</p>
                {p.tech.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: '0.72rem', color: muted }}>{p.tech.join(' · ')}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      );
    case 'education':
      return (
        <section key="education" style={{ marginBottom: meta.density === 'compact' ? 14 : 18 }}>
          <SectionHeading title="Education" accent={accent} templateId={meta.id} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {doc.education.map(ed => (
              <div key={ed.id}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem' }}>{ed.school}</div>
                <div style={{ color: '#475569', fontSize: '0.78rem' }}>
                  {ed.degree} · {ed.start} – {ed.end}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    case 'certifications':
      return (
        <section key="certifications" style={{ marginBottom: meta.density === 'compact' ? 14 : 18 }}>
          <SectionHeading title="Certifications" accent={accent} templateId={meta.id} />
          <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', fontSize: '0.8rem', lineHeight: 1.45 }}>
            {doc.certifications.map(c => (
              <li key={c.id} style={{ marginBottom: 4 }}>
                {c.name} — {c.issuer} ({c.date})
              </li>
            ))}
          </ul>
        </section>
      );
    case 'achievements':
      return (
        <section key="achievements" style={{ marginBottom: meta.density === 'compact' ? 14 : 18 }}>
          <SectionHeading title="Achievements" accent={accent} templateId={meta.id} />
          <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', fontSize: '0.8rem', lineHeight: 1.45 }}>
            {doc.achievements.map((a, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {a}
              </li>
            ))}
          </ul>
        </section>
      );
    default:
      return null;
  }
}

export function ResumePreview({
  doc,
  templateId,
  previewMode = 'desktop',
  highlightPaths,
  className,
  exportRootId = 'resume-export-root',
}: ResumePreviewProps) {
  const meta = getTemplateMeta(templateId);
  const isMobile = previewMode === 'mobile';
  const pad = meta.density === 'compact' ? 18 : meta.density === 'comfortable' ? 22 : 28;
  const twoCol = meta.layout === 'two-column';

  const header = (
    <header style={{ marginBottom: meta.density === 'spacious' ? 22 : 16, borderBottom: meta.id === 'minimal' ? '1px solid #e2e8f0' : 'none', paddingBottom: meta.id === 'minimal' ? 16 : 0 }}>
      <h1 style={{ fontFamily: meta.fontHeading, margin: 0, fontSize: meta.id === 'executive' ? '1.35rem' : '1.2rem', color: '#0f172a', letterSpacing: meta.id === 'corporate' ? '-0.02em' : undefined }}>
        {doc.personal.fullName}
      </h1>
      {doc.personal.headline && (
        <div style={{ marginTop: 6, color: meta.muted, fontSize: '0.85rem', fontWeight: 600 }}>{doc.personal.headline}</div>
      )}
      <div style={{ marginTop: 10, color: '#64748b', fontSize: '0.75rem', lineHeight: 1.5, fontFamily: meta.fontBody }}>
        {[doc.personal.email, doc.personal.phone, doc.personal.location].filter(Boolean).join(' · ')}
        {(doc.personal.linkedIn || doc.personal.portfolio) && (
          <>
            <br />
            {[doc.personal.linkedIn, doc.personal.portfolio].filter(Boolean).join(' · ')}
          </>
        )}
      </div>
      {meta.id === 'modern-saas' && (
        <div style={{ height: 4, borderRadius: 999, background: `linear-gradient(90deg, ${meta.accent}, #06b6d4)`, marginTop: 14 }} />
      )}
    </header>
  );

  const mainSections = doc.sectionOrder.map(id => renderSection(id, doc, meta, highlightPaths));

  const inner = twoCol ? (
    <div>
      {header}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '220px 1fr', gap: isMobile ? 20 : 28, marginTop: 8 }}>
        <aside style={{ fontFamily: meta.fontBody, borderRight: isMobile ? undefined : '1px solid #e2e8f0', paddingRight: isMobile ? 0 : 16 }}>
          {renderSection('skills', doc, meta, highlightPaths)}
          {meta.id === 'fresher' && <div style={{ marginTop: 16 }}>{renderSection('education', doc, meta, highlightPaths)}</div>}
        </aside>
        <div>
          {doc.sectionOrder
            .filter(s => s !== 'skills' && (meta.id !== 'fresher' || s !== 'education'))
            .map(id => renderSection(id, doc, meta, highlightPaths))}
        </div>
      </div>
    </div>
  ) : (
    <div>
      {header}
      {mainSections}
    </div>
  );

  return (
    <div
      className={className}
      style={{
        width: isMobile ? 320 : '100%',
        maxWidth: isMobile ? 320 : 720,
        margin: '0 auto',
        transform: isMobile ? 'scale(0.92)' : undefined,
        transformOrigin: 'top center',
      }}
    >
      <div
        id={exportRootId}
        data-resume-export="true"
        style={{
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: 12,
          boxShadow: '0 24px 48px rgba(15,23,42,0.12)',
          padding: pad,
          fontFamily: meta.fontBody,
          border: '1px solid #e2e8f0',
          minHeight: 400,
        }}
      >
        {inner}
      </div>
    </div>
  );
}
