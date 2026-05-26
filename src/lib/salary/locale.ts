export type SalaryCurrency = 'USD' | 'INR' | 'EUR' | 'GBP';

export type SalaryLocale = {
  currency: SalaryCurrency;
  symbol: string;
  salaryType: 'Annual' | 'Monthly';
  country: string;
  showMonthlyAndYearly: boolean;
};

const INDIA_MARKERS = ['india', 'in', 'mumbai', 'bangalore', 'bengaluru', 'delhi', 'hyderabad', 'pune', 'chennai'];

function inferCountry(country?: string | null, location?: string | null): string {
  const c = (country ?? location ?? '').trim();
  return c || 'United States';
}

function inferCurrency(country: string, explicit?: string | null): SalaryCurrency {
  const cur = (explicit ?? '').trim().toUpperCase();
  if (cur === 'INR' || cur === 'USD' || cur === 'EUR' || cur === 'GBP') return cur;

  const lower = country.toLowerCase();
  if (INDIA_MARKERS.some(m => lower.includes(m))) return 'INR';
  if (lower.includes('united kingdom') || lower.includes('uk') || lower.includes('london')) return 'GBP';
  if (lower.includes('germany') || lower.includes('france') || lower.includes('europe')) return 'EUR';
  return 'USD';
}

export function resolveSalaryLocale(profile: {
  country?: string | null;
  locationPreference?: string | null;
  salaryCurrency?: string | null;
  salaryFrequency?: string | null;
}): SalaryLocale {
  const country = inferCountry(profile.country, profile.locationPreference);
  const currency = inferCurrency(country, profile.salaryCurrency);
  const freq = (profile.salaryFrequency ?? '').trim();
  const salaryType: SalaryLocale['salaryType'] =
    freq.toLowerCase().includes('month')
      ? 'Monthly'
      : freq.toLowerCase().includes('year') || freq.toLowerCase().includes('annual')
        ? 'Annual'
        : currency === 'INR'
          ? 'Monthly'
          : 'Annual';

  const symbols: Record<SalaryCurrency, string> = { USD: '$', INR: '₹', EUR: '€', GBP: '£' };

  return {
    currency,
    symbol: symbols[currency],
    salaryType,
    country,
    showMonthlyAndYearly: currency === 'INR',
  };
}

export function formatSalaryAmount(amount: number, locale: SalaryLocale): string {
  if (!amount || Number.isNaN(amount)) return '—';
  if (locale.currency === 'INR') {
    if (amount >= 100000) return `${locale.symbol}${(amount / 100000).toFixed(1)}L`;
    return `${locale.symbol}${Math.round(amount / 1000)}K`;
  }
  if (amount >= 1_000_000) return `${locale.symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1000) return `${locale.symbol}${Math.round(amount / 1000)}K`;
  return `${locale.symbol}${Math.round(amount).toLocaleString()}`;
}

export function chartTickFormatter(value: number, locale: SalaryLocale): string {
  return formatSalaryAmount(Number(value), locale);
}

export function formatJobSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  locale: SalaryLocale,
): string {
  const minVal = typeof min === 'number' && Number.isFinite(min) ? min : null;
  const maxVal = typeof max === 'number' && Number.isFinite(max) ? max : null;
  if (minVal == null && maxVal == null) return '';
  if (minVal != null && maxVal != null) {
    return `${formatSalaryAmount(minVal, locale)}–${formatSalaryAmount(maxVal, locale)}`;
  }
  const only = minVal ?? maxVal ?? 0;
  return formatSalaryAmount(only, locale);
}
