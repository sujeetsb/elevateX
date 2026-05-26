/** Extract JSON object from AI response that may include markdown fences or prose. */
export function parseAiJson<T extends Record<string, unknown>>(raw: string): T | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1].trim()) as T;
      } catch {
        /* fall through */
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Strip JSON wrapper and return plain cover letter body text. */
export function normalizeCoverLetterBody(raw: string): string {
  const parsed = parseAiJson<{ coverLetter?: string; body?: string }>(raw);
  const fromField = parsed?.coverLetter ?? parsed?.body;
  if (typeof fromField === 'string' && fromField.trim()) {
    return fromField.trim();
  }
  // If raw looks like JSON but failed parse, don't show it
  if (raw.trim().startsWith('{') && raw.includes('"coverLetter"')) {
    const match = raw.match(/"coverLetter"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (match?.[1]) {
      return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
    }
  }
  return raw.replace(/^```[\s\S]*?```/gm, '').trim();
}
