'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import type { ResumeDocument } from '@/lib/resume/types';

export type ResumeAutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export function validateResumeDocument(doc: ResumeDocument): string[] {
  const issues: string[] = [];
  const name = doc.personal.fullName?.trim();
  if (!name) issues.push('Full name is required');
  const email = doc.personal.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push('Enter a valid email address');
  }
  if (!doc.personal.headline?.trim()) issues.push('Add a headline or target title');
  if (doc.experience.length === 0) issues.push('Add at least one experience entry');
  return issues;
}

export function useResumeDocumentAutosave(
  resumeId: string | null,
  doc: ResumeDocument | null,
  debounceMs = 900,
) {
  const [status, setStatus] = useState<ResumeAutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerializedRef = useRef<string>('');

  useEffect(() => {
    if (!resumeId || !doc) return;

    const serialized = JSON.stringify(doc);
    if (serialized === lastSerializedRef.current) return;

    setStatus('pending');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setValidationIssues(validateResumeDocument(doc));
      void (async () => {
        setStatus('saving');
        try {
          const result = await apiFetch(`/api/v1/resumes/${encodeURIComponent(resumeId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ studioDocument: doc }),
          });
          if (!result.ok) throw result.error;
          lastSerializedRef.current = serialized;
          setLastSavedAt(new Date());
          setStatus('saved');
        } catch {
          setStatus('error');
        }
      })();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resumeId, doc, debounceMs]);

  return { status, lastSavedAt, validationIssues };
}
