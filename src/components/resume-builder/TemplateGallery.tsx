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
  const templateOptions = RESUME_TEMPLATES
    .filter(t => t.id === 'minimal' || t.id === 'modern-saas' || t.id === 'corporate')
    .map(t => ({
      ...t,
      name: t.id === 'modern-saas' ? 'Modern' : t.id === 'corporate' ? 'Professional' : t.name,
    }));

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <LayoutTemplate size={18} style={{ color: 'var(--cp-accent-light, #a78bfa)' }} />
        <div>
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>ATS-friendly templates</h3>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>Live preview · one-click switch · print-ready</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {templateOptions.map((t, i) => {
          const active = selectedId === t.id;
          return (
            <motion.button
              key={t.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelect(t.id)}
              className="text-left rounded-2xl p-4 sm:p-5 relative overflow-hidden glass-card w-full min-h-[140px]"
              style={{
                border: active ? '1px solid var(--cp-border-accent)' : '1px solid var(--cp-border-subtle)',
                boxShadow: active ? 'var(--cp-shadow-focus)' : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '0.88rem' }}>{t.name}</div>
                  <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{t.tagline}</div>
                </div>
                {active && (
                  <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--cp-accent-bg)' }}>
                    <Check size={16} style={{ color: 'var(--cp-accent-light, #a78bfa)' }} />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span
                  className="text-[0.65rem] font-semibold uppercase px-2 py-0.5 rounded-md"
                  style={{ background: 'var(--cp-surface-1)', color: 'var(--cp-text-muted)' }}
                >
                  {t.category}
                </span>
                <span className="text-[0.65rem] font-medium" style={{ color: 'var(--cp-text-faint)' }}>
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
                  style={{ background: 'var(--cp-info-muted)', border: '1px solid rgba(56,189,248,0.25)', color: 'var(--cp-info, #22d3ee)' }}
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
                  style={{ background: 'var(--cp-accent-bg)', border: '1px solid var(--cp-border-accent)', color: 'var(--cp-accent-light, #c4b5fd)' }}
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
          className="max-h-[90vh] overflow-y-auto"
          style={{ fontFamily: "'Space Grotesk', sans-serif", background: 'var(--cp-bg-card-solid)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--cp-text-primary)' }}>
              {previewId ? templateOptions.find(x => x.id === previewId)?.name : 'Template'}
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--cp-text-muted)' }}>
              Desktop preview · responsive layout is simulated in the editor step.
            </DialogDescription>
          </DialogHeader>
          {previewId && (
            <div className="rounded-2xl p-4 cp-panel-nested">
              <ResumePreview doc={previewDoc} templateId={previewId} previewMode="desktop" exportRootId={`modal-preview-${previewId}`} />
            </div>
          )}
          {previewId && (
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold cp-panel-nested"
                style={{ color: 'var(--cp-text-primary)' }}
                onClick={() => setPreviewId(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold btn-primary"
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
