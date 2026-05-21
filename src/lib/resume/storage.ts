import type { OptimizationHistoryEntry, ResumeLibraryState, ResumeTemplateId, SavedResumeMeta } from './types';
import { STORAGE_KEYS } from '@/lib/brand';

const KEY = STORAGE_KEYS.resumeLibrary;
const KEY_LEGACY = STORAGE_KEYS.resumeLibraryLegacy;

function read(): ResumeLibraryState {
  if (typeof window === 'undefined') {
    return { saved: [], history: [], templateUsage: {} as Record<ResumeTemplateId, number> };
  }
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(KEY_LEGACY);
    if (!raw) throw new Error('empty');
    return JSON.parse(raw) as ResumeLibraryState;
  } catch {
    return { saved: [], history: [], templateUsage: {} as Record<ResumeTemplateId, number> };
  }
}

function write(data: ResumeLibraryState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function loadResumeLibrary(): ResumeLibraryState {
  const data = read();
  if (!data.templateUsage) data.templateUsage = {} as Record<ResumeTemplateId, number>;
  return data;
}

export function saveResumeToLibrary(entry: SavedResumeMeta) {
  const data = read();
  const idx = data.saved.findIndex(s => s.id === entry.id);
  if (idx >= 0) data.saved[idx] = entry;
  else data.saved = [entry, ...data.saved].slice(0, 20);
  data.templateUsage[entry.templateId] = (data.templateUsage[entry.templateId] || 0) + 1;
  write(data);
}

export function appendOptimizationHistory(entry: OptimizationHistoryEntry) {
  const data = read();
  data.history = [entry, ...data.history].slice(0, 30);
  write(data);
}

export function listRecentResumes(limit = 5): SavedResumeMeta[] {
  return read()
    .saved.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export function listOptimizationHistory(limit = 8): OptimizationHistoryEntry[] {
  return read().history.slice(0, limit);
}

export function getTemplateUsageStats(): Record<string, number> {
  return { ...read().templateUsage };
}
