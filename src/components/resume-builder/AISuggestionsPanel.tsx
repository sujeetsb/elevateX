'use client';

import { motion } from 'motion/react';
import { Sparkles, Check, X, Wand2 } from 'lucide-react';
import type { AISuggestion, ResumeDocument } from '../../lib/resume/types';
import { applySuggestionToDocument } from '../../lib/resume/mockAi';

export interface AISuggestionsPanelProps {
  suggestions: AISuggestion[];
  onChangeSuggestions: (next: AISuggestion[]) => void;
  document: ResumeDocument;
  onChangeDocument: (next: ResumeDocument) => void;
}

export function AISuggestionsPanel({
  suggestions,
  onChangeSuggestions,
  document,
  onChangeDocument,
}: AISuggestionsPanelProps) {
  const pending = suggestions.filter(s => s.status === 'pending');

  const setStatus = (id: string, status: AISuggestion['status']) => {
    onChangeSuggestions(suggestions.map(s => (s.id === id ? { ...s, status } : s)));
  };

  const accept = (s: AISuggestion) => {
    if (s.replacement) {
      onChangeDocument(applySuggestionToDocument(document, s));
    }
    setStatus(s.id, 'accepted');
  };

  const reject = (id: string) => setStatus(id, 'rejected');

  const applyAll = () => {
    let doc = document;
    const next = suggestions.map(s => {
      if (s.status !== 'pending' || !s.replacement) return s;
      doc = applySuggestionToDocument(doc, s);
      return { ...s, status: 'accepted' as const };
    });
    onChangeDocument(doc);
    onChangeSuggestions(next);
  };

  return (
    <div
      className="rounded-2xl p-4 h-full flex flex-col glass-card"
      style={{ border: '1px solid var(--cp-border-accent)', minHeight: 280 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: 'var(--cp-accent-light, #a78bfa)' }} />
          <span style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '0.88rem' }}>AI Suggestions</span>
        </div>
        <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{pending.length} pending</span>
      </div>

      {pending.length > 0 && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={applyAll}
          className="mb-3 w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold btn-primary"
        >
          <Wand2 size={16} />
          Apply all with replacements
        </motion.button>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: 'min(60vh, 520px)' }}>
        {suggestions.length === 0 && (
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem' }}>Run optimization to generate tailored suggestions.</p>
        )}
        {suggestions.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="rounded-xl p-3 cp-panel-nested"
            style={{ opacity: s.status === 'rejected' ? 0.45 : 1 }}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.8rem' }}>{s.title}</div>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', marginTop: 2 }}>{s.detail}</div>
              </div>
              <span className="shrink-0 text-[0.6rem] uppercase font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--cp-accent-bg)', color: 'var(--cp-accent-light, #c4b5fd)' }}>
                {s.sectionId}
              </span>
            </div>
            {s.replacement && s.status === 'pending' && (
              <div className="mt-2 rounded-lg px-2 py-1.5 text-[0.75rem]" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--cp-success, #6ee7b7)' }}>
                {s.replacement}
              </div>
            )}
            {s.status === 'pending' && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  disabled={!s.replacement}
                  onClick={() => accept(s)}
                  className="flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 text-[0.75rem] font-semibold disabled:opacity-40"
                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: 'var(--cp-success, #34d399)' }}
                >
                  <Check size={14} />
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => reject(s.id)}
                  className="flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 text-[0.75rem] font-semibold"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: 'var(--cp-danger, #fca5a5)' }}
                >
                  <X size={14} />
                  Reject
                </button>
              </div>
            )}
            {s.status !== 'pending' && (
              <div className="mt-2 text-[0.7rem] font-semibold" style={{ color: s.status === 'accepted' ? 'var(--cp-success, #34d399)' : 'var(--cp-text-muted)' }}>
                {s.status === 'accepted' ? 'Applied' : 'Dismissed'}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
