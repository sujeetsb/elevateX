export function isProTierClient(tier: string | null | undefined): boolean {
  const t = (tier ?? 'FREE').trim().toUpperCase();
  return t === 'PRO' || t === 'ENTERPRISE';
}
