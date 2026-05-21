'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Eye, LayoutTemplate } from 'lucide-react';
import type { ResumeDocument, ResumeTemplateId } from '../../lib/resume/types';
import { RESUME_TEMPLATES } from '../../lib/resume/templates';
import { ResumePreview } from './ResumePreview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export interface TemplateGalleryProps {
  selectedId: ResumeTemplateId;
  onSelect: (id: ResumeTemplateId) => void;
  previewDoc: ResumeDocument;
}

export function TemplateGallery({ selectedId, onSelect, previewDoc }: TemplateGalleryProps) {
  const [previewId, setPreviewId] = useState<ResumeTemplateId | null>(null);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <LayoutTemplate size={18} color="#a78bfa" />
        <div>
          <h3 style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem' }}>ATS-friendly templates</h3>
          <p style={{ color: '#64748b', fontSize: '0.78rem' }}>Live preview · one-click switch · print-ready</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {RESUME_TEMPLATES.map((t, i) => {
          const active = selectedId === t.id;
          return (
            <motion.button
              key={t.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelect(t.id)}
              className="text-left rounded-2xl p-4 relative overflow-hidden glass-card"
              style={{
                border: active ? '1px solid rgba(124,58,237,0.55)' : '1px solid rgba(255,255,255,0.08)',
                boxShadow: active ? '0 0 0 1px rgba(124,58,237,0.2)' : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.88rem' }}>{t.name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem' }}>{t.tagline}</div>
                </div>
                {active && (
                  <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.25)' }}>
                    <Check size={16} color="#a78bfa" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span
                  className="text-[0.65rem] font-semibold uppercase px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}
                >
                  {t.category}
                </span>
                <span className="text-[0.65rem] font-medium" style={{ color: '#475569' }}>
                  {t.layout === 'two-column' ? 'Two column' : 'Single column'}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setPreviewId(t.id);
                  }}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[0.75rem] font-semibold"
                  style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)', color: '#22d3ee' }}
                >
                  <Eye size={14} />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onSelect(t.id);
                  }}
                  className="rounded-xl px-3 py-1.5 text-[0.75rem] font-semibold"
                  style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', color: '#c4b5fd' }}
                >
                  Use template
                </button>
              </div>
            </motion.button>
          );
        })}
      </div>

      <Dialog open={!!previewId} onOpenChange={open => !open && setPreviewId(null)}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
          style={{ fontFamily: "'Space Grotesk', sans-serif", background: 'var(--cp-bg-card-solid)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--cp-text-primary)' }}>
              {previewId ? RESUME_TEMPLATES.find(x => x.id === previewId)?.name : 'Template'}
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--cp-text-muted)' }}>
              Desktop preview · responsive layout is simulated in the editor step.
            </DialogDescription>
          </DialogHeader>
          {previewId && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <ResumePreview doc={previewDoc} templateId={previewId} previewMode="desktop" exportRootId={`modal-preview-${previewId}`} />
            </div>
          )}
          {previewId && (
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}
                onClick={() => setPreviewId(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', color: 'white' }}
                onClick={() => {
                  if (previewId) onSelect(previewId);
                  setPreviewId(null);
                }}
              >
                Select template
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
