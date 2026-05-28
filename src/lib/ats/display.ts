/** Shared ATS score display helpers — null means not yet analyzed. */
export function hasAtsScore(score: number | null | undefined): boolean {
  return score != null && Number.isFinite(score) && score > 0;
}

export function formatAtsScore(score: number | null | undefined): string {
  if (!hasAtsScore(score)) return '—';
  return String(Math.round(score!));
}

export function formatAtsDelta(delta: number | null | undefined): string {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return '—';
  return delta > 0 ? `+${delta} pts` : `${delta} pts`;
}
