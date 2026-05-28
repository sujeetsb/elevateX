'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Lock, Sparkles } from 'lucide-react';
import { resolveSalaryLocale, formatSalaryAmount, type SalaryLocale } from '@/lib/salary/locale';
import { useSalaryInsights } from '@/lib/hooks/use-salary-insights';
import { SalaryCharts } from './SalaryCharts';

export type SalaryInsightsData = {
  currentEstimate?: string;
  currentEstimateMonthly?: string;
  roleAverage?: string;
  futureRoleSalary?: string;
  fiveYearProjection?: string;
  industryBenchmark?: string;
  locationComparison?: string;
  growthTrend?: { year: number; salary: number }[];
  roleComparison?: { role: string; salary: number }[];
  premium?: boolean;
  recommendations?: string[];
  currency?: string;
  preferredCurrency?: string;
  salaryType?: string;
  country?: string;
  showMonthlyAndYearly?: boolean;
  cached?: boolean;
};

type SalaryIntelligenceProps = {
  compact?: boolean;
  userCurrentSalary?: string;
  salaryCurrency?: string;
  country?: string;
  profileVersion?: number;
  isPro?: boolean;
  className?: string;
};

function buildLocale(data: SalaryInsightsData | null, salaryCurrency?: string, country?: string): SalaryLocale {
  return resolveSalaryLocale({
    salaryCurrency: data?.preferredCurrency ?? data?.currency ?? salaryCurrency,
    country: data?.country ?? country,
    salaryFrequency: data?.salaryType,
  });
}

export function SalaryIntelligence({
  compact = false,
  userCurrentSalary,
  salaryCurrency = 'USD',
  country,
  profileVersion = 0,
  isPro = false,
  className = '',
}: SalaryIntelligenceProps) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useSalaryInsights(profileVersion);

  const locale = useMemo(
    () => buildLocale(data ?? null, salaryCurrency, country),
    [data, salaryCurrency, country],
  );

  const userFormatted = useMemo(() => {
    if (!userCurrentSalary) return null;
    const n = Number(String(userCurrentSalary).replace(/[^0-9.]/g, ''));
    if (!n) return null;
    return formatSalaryAmount(n, locale);
  }, [userCurrentSalary, locale]);

  const currentDisplay = userFormatted ?? data?.currentEstimate ?? '—';

  const recommendations = data?.recommendations ?? [
    'Align your resume keywords with your target role title.',
    'Complete skill-gap courses to justify a higher band.',
    'Research location-adjusted benchmarks before negotiations.',
  ];

  const formatChartValue = (v: number) => formatSalaryAmount(v, locale);

  if (isLoading) {
    return (
      <div className={`glass-card rounded-3xl p-5 animate-pulse ${className}`}>
        <div className="h-5 w-40 rounded mb-4" style={{ background: 'var(--cp-bg-elevated)' }} />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 rounded-xl" style={{ background: 'var(--cp-bg-elevated)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`glass-card rounded-3xl p-5 ${className}`}>
        <p className="text-sm text-rose-400 mb-2">Could not load salary insights.</p>
        <button type="button" onClick={() => void refetch()} className="text-xs font-semibold" style={{ color: '#a78bfa', background: 'none', border: 'none' }}>
          Retry
        </button>
      </div>
    );
  }

  const metrics = [
    { label: 'Current role', value: currentDisplay },
    ...(data?.currentEstimateMonthly && locale.showMonthlyAndYearly
      ? [{ label: 'Monthly estimate', value: data.currentEstimateMonthly }]
      : []),
    { label: 'Market average', value: data?.roleAverage },
    { label: 'Future role', value: data?.futureRoleSalary },
    { label: '5-year projection', value: data?.fiveYearProjection },
    { label: 'Industry benchmark', value: data?.industryBenchmark },
    { label: 'Location comparison', value: data?.locationComparison },
  ];

  return (
    <div className={`glass-card rounded-3xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} color="#10b981" />
          <h2 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: compact ? '1rem' : '1.1rem' }}>
            Salary Intelligence
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--cp-bg-elevated)', color: 'var(--cp-text-muted)' }}>
            {locale.currency} · {locale.country}
          </span>
        </div>
      </div>

      <div className={`grid gap-3 mb-4 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
        {metrics.map(row => (
          <div key={row.label} className="rounded-xl p-3" style={{ background: 'var(--cp-bg-elevated)' }}>
            <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', marginBottom: '2px' }}>{row.label}</div>
            <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.88rem' }}>
              {String(row.value ?? '—')}
            </div>
          </div>
        ))}
      </div>

      {data && (
        <SalaryCharts data={data} locale={locale} compact={compact} formatChartValue={formatChartValue} />
      )}

      {!isPro && !data?.premium && (
        <div className="rounded-2xl p-3 mb-4 flex items-center gap-2" style={{ background: 'rgba(124,58,237,0.1)', border: '1px dashed rgba(124,58,237,0.35)' }}>
          <Lock size={16} color="#a78bfa" />
          <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>
            Upgrade to PRO for growth charts and role comparison.
          </span>
        </div>
      )}

      <div className="rounded-2xl p-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} color="#10b981" />
          <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.78rem' }}>Recommendations</span>
        </div>
        <ul className="space-y-1 pl-4 list-disc">
          {recommendations.slice(0, compact ? 2 : 3).map(r => (
            <li key={r} style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
