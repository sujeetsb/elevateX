'use client';

import { useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { GripVertical, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { ResumeDocument, SectionId, ExperienceEntry } from '../../lib/resume/types';

const ALL_SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'experience', label: 'Experience' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'education', label: 'Education' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'achievements', label: 'Achievements' },
];

function nid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

const fieldClass =
  'w-full rounded-xl px-3 py-2 outline-none text-[0.82rem]';

const fieldStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f8fafc',
};

export interface ResumeEditorProps {
  doc: ResumeDocument;
  onChange: (next: ResumeDocument) => void;
}

export function ResumeEditor({ doc, onChange }: ResumeEditorProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    personal: true,
    summary: true,
    experience: true,
    skills: true,
    sections: true,
  });
  const [skillInput, setSkillInput] = useState('');
  const [dragSectionIdx, setDragSectionIdx] = useState<number | null>(null);

  const patch = (partial: Partial<ResumeDocument>) => onChange({ ...doc, ...partial });

  const toggleOpen = (key: string) => setOpen(o => ({ ...o, [key]: !o[key] }));

  const reorderSections = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const order = [...doc.sectionOrder];
    const [row] = order.splice(from, 1);
    order.splice(to, 0, row);
    patch({ sectionOrder: order });
  };

  const addSection = (id: SectionId) => {
    if (doc.sectionOrder.includes(id)) return;
    patch({ sectionOrder: [...doc.sectionOrder, id] });
  };

  const removeSection = (id: SectionId) => {
    patch({ sectionOrder: doc.sectionOrder.filter(s => s !== id) });
  };

  const updateExperience = (id: string, e: Partial<ExperienceEntry>) => {
    patch({
      experience: doc.experience.map(x => (x.id === id ? { ...x, ...e } : x)),
    });
  };

  const addExperience = () => {
    patch({
      experience: [
        ...doc.experience,
        {
          id: nid(),
          company: 'Company',
          role: 'Title',
          location: '',
          start: '20XX',
          end: 'Present',
          bullets: ['Impact bullet with metric.'],
        },
      ],
    });
  };

  const removeExperience = (id: string) => {
    patch({ experience: doc.experience.filter(x => x.id !== id) });
  };

  const SectionCard = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl overflow-hidden glass-card mb-3" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      <button
        type="button"
        onClick={() => toggleOpen(id)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.85rem' }}>{title}</span>
        {open[id] ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
      </button>
      {open[id] && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <SectionCard id="personal" title="Personal info">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(
            [
              ['fullName', 'Full name'],
              ['email', 'Email'],
              ['phone', 'Phone'],
              ['location', 'Location'],
              ['headline', 'Headline / title'],
              ['linkedIn', 'LinkedIn'],
              ['portfolio', 'Portfolio / GitHub'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{label}</span>
              <input
                className={fieldClass}
                style={fieldStyle}
                value={String(doc.personal[key] ?? '')}
                onChange={ev =>
                  patch({
                    personal: { ...doc.personal, [key]: ev.target.value },
                  })
                }
              />
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard id="sections" title="Sections · drag to reorder">
        <p style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: 8 }}>Shown sections and order update the live preview instantly.</p>
        <div className="space-y-2">
          {doc.sectionOrder.map((sid, idx) => {
            const label = ALL_SECTIONS.find(s => s.id === sid)?.label ?? sid;
            return (
              <div
                key={`${sid}-${idx}`}
                draggable
                onDragStart={() => setDragSectionIdx(idx)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => {
                  if (dragSectionIdx === null) return;
                  reorderSections(dragSectionIdx, idx);
                  setDragSectionIdx(null);
                }}
                className="flex items-center gap-2 rounded-xl px-2 py-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <GripVertical size={16} color="#475569" className="shrink-0 cursor-grab" />
                <span className="flex-1 text-[0.82rem]" style={{ color: '#e2e8f0' }}>
                  {label}
                </span>
                <button
                  type="button"
                  onClick={() => removeSection(sid)}
                  className="p-1.5 rounded-lg"
                  style={{ color: '#f87171' }}
                  aria-label={`Remove ${label}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {ALL_SECTIONS.filter(s => !doc.sectionOrder.includes(s.id)).map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => addSection(s.id)}
              className="text-[0.75rem] font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1"
              style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', color: '#c4b5fd' }}
            >
              <Plus size={14} />
              Add {s.label}
            </button>
          ))}
        </div>
      </SectionCard>

      {doc.sectionOrder.includes('summary') && (
        <SectionCard id="summary" title="Summary">
          <textarea
            className={`${fieldClass} min-h-[100px] resize-y`}
            style={fieldStyle}
            value={doc.summary}
            onChange={e => patch({ summary: e.target.value })}
          />
        </SectionCard>
      )}

      {doc.sectionOrder.includes('experience') && (
        <SectionCard id="experience" title="Experience">
          <div className="space-y-4">
            {doc.experience.map(exp => (
              <div key={exp.id} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block sm:col-span-2">
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Role</span>
                    <input className={fieldClass} style={fieldStyle} value={exp.role} onChange={e => updateExperience(exp.id, { role: e.target.value })} />
                  </label>
                  <label className="block">
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Company</span>
                    <input className={fieldClass} style={fieldStyle} value={exp.company} onChange={e => updateExperience(exp.id, { company: e.target.value })} />
                  </label>
                  <label className="block">
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Location</span>
                    <input className={fieldClass} style={fieldStyle} value={exp.location ?? ''} onChange={e => updateExperience(exp.id, { location: e.target.value })} />
                  </label>
                  <label className="block">
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Start</span>
                    <input className={fieldClass} style={fieldStyle} value={exp.start} onChange={e => updateExperience(exp.id, { start: e.target.value })} />
                  </label>
                  <label className="block">
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>End</span>
                    <input className={fieldClass} style={fieldStyle} value={exp.end} onChange={e => updateExperience(exp.id, { end: e.target.value })} />
                  </label>
                </div>
                <label className="block">
                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Bullets (one per line)</span>
                  <textarea
                    className={`${fieldClass} min-h-[88px]`}
                    style={fieldStyle}
                    value={exp.bullets.join('\n')}
                    onChange={e =>
                      updateExperience(exp.id, {
                        bullets: e.target.value.split('\n').map(b => b.trim()).filter(Boolean),
                      })
                    }
                  />
                </label>
                <button type="button" onClick={() => removeExperience(exp.id)} className="text-[0.75rem] font-semibold flex items-center gap-1" style={{ color: '#f87171' }}>
                  <Trash2 size={14} />
                  Remove role
                </button>
              </div>
            ))}
            <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={addExperience} className="w-full py-2 rounded-xl text-[0.8rem] font-bold" style={{ background: 'rgba(124,58,237,0.2)', border: '1px dashed rgba(124,58,237,0.5)', color: '#ddd6fe' }}>
              + Add experience
            </motion.button>
          </div>
        </SectionCard>
      )}

      {doc.sectionOrder.includes('skills') && (
        <SectionCard id="skills" title="Skills">
          <div className="flex flex-wrap gap-2 mb-2">
            {doc.skills.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => patch({ skills: doc.skills.filter(x => x !== s) })}
                className="rounded-full px-3 py-1 text-[0.75rem] font-medium"
                style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', color: '#e9d5ff' }}
              >
                {s} ×
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={fieldClass}
              style={fieldStyle}
              placeholder="Add skill · Enter"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && skillInput.trim()) {
                  e.preventDefault();
                  patch({ skills: Array.from(new Set([...doc.skills, skillInput.trim()])) });
                  setSkillInput('');
                }
              }}
            />
          </div>
        </SectionCard>
      )}

      {doc.sectionOrder.includes('projects') && (
        <SectionCard id="projects" title="Projects">
          <div className="space-y-3">
            {doc.projects.map(p => (
              <div key={p.id} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <input className={fieldClass} style={fieldStyle} value={p.name} onChange={e => patch({ projects: doc.projects.map(x => (x.id === p.id ? { ...x, name: e.target.value } : x)) })} />
                <textarea className={`${fieldClass} min-h-[64px]`} style={fieldStyle} value={p.description} onChange={e => patch({ projects: doc.projects.map(x => (x.id === p.id ? { ...x, description: e.target.value } : x)) })} />
                <input
                  className={fieldClass}
                  style={fieldStyle}
                  placeholder="Tech stack · comma separated"
                  value={p.tech.join(', ')}
                  onChange={e =>
                    patch({
                      projects: doc.projects.map(x =>
                        x.id === p.id ? { ...x, tech: e.target.value.split(',').map(t => t.trim()).filter(Boolean) } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => patch({ projects: doc.projects.filter(x => x.id !== p.id) })}
                  className="text-[0.75rem]"
                  style={{ color: '#f87171' }}
                >
                  Remove project
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patch({
                  projects: [
                    ...doc.projects,
                    { id: nid(), name: 'New project', description: 'What you shipped and why it mattered.', tech: [] },
                  ],
                })
              }
              className="text-[0.8rem] font-bold w-full py-2 rounded-xl"
              style={{ background: 'rgba(6,182,212,0.12)', border: '1px dashed rgba(6,182,212,0.35)', color: '#67e8f9' }}
            >
              + Add project
            </button>
          </div>
        </SectionCard>
      )}

      {doc.sectionOrder.includes('education') && (
        <SectionCard id="education" title="Education">
          {doc.education.map(ed => (
            <div key={ed.id} className="rounded-xl p-3 space-y-2 mb-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <input className={fieldClass} style={fieldStyle} value={ed.school} onChange={e => patch({ education: doc.education.map(x => (x.id === ed.id ? { ...x, school: e.target.value } : x)) })} />
              <input className={fieldClass} style={fieldStyle} value={ed.degree} onChange={e => patch({ education: doc.education.map(x => (x.id === ed.id ? { ...x, degree: e.target.value } : x)) })} />
              <div className="grid grid-cols-2 gap-2">
                <input className={fieldClass} style={fieldStyle} value={ed.start} onChange={e => patch({ education: doc.education.map(x => (x.id === ed.id ? { ...x, start: e.target.value } : x)) })} />
                <input className={fieldClass} style={fieldStyle} value={ed.end} onChange={e => patch({ education: doc.education.map(x => (x.id === ed.id ? { ...x, end: e.target.value } : x)) })} />
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {doc.sectionOrder.includes('certifications') && (
        <SectionCard id="certifications" title="Certifications">
          {doc.certifications.map(c => (
            <div key={c.id} className="rounded-xl p-3 space-y-2 mb-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <input className={fieldClass} style={fieldStyle} value={c.name} onChange={e => patch({ certifications: doc.certifications.map(x => (x.id === c.id ? { ...x, name: e.target.value } : x)) })} />
              <input className={fieldClass} style={fieldStyle} value={c.issuer} onChange={e => patch({ certifications: doc.certifications.map(x => (x.id === c.id ? { ...x, issuer: e.target.value } : x)) })} />
              <input className={fieldClass} style={fieldStyle} value={c.date} onChange={e => patch({ certifications: doc.certifications.map(x => (x.id === c.id ? { ...x, date: e.target.value } : x)) })} />
            </div>
          ))}
        </SectionCard>
      )}

      {doc.sectionOrder.includes('achievements') && (
        <SectionCard id="achievements" title="Achievements">
          <textarea
            className={`${fieldClass} min-h-[100px]`}
            style={fieldStyle}
            value={doc.achievements.join('\n')}
            onChange={e => patch({ achievements: e.target.value.split('\n').map(l => l.trim()).filter(Boolean) })}
          />
        </SectionCard>
      )}
    </div>
  );
}
