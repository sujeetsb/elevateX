'use client';

import dynamic from 'next/dynamic';
import type { SalaryLocale } from '@/lib/salary/locale';
import type { SalaryInsightsData } from './SalaryIntelligence';

const SalaryChartsInner = dynamic(
  () => import('./SalaryChartsInner').then(m => m.SalaryChartsInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-[160px] rounded-xl animate-pulse" style={{ background: 'var(--cp-bg-elevated)' }} />
    ),
  },
);

type Props = {
  data: SalaryInsightsData;
  locale: SalaryLocale;
  compact?: boolean;
  formatChartValue: (v: number) => string;
};

export function SalaryCharts(props: Props) {
  return <SalaryChartsInner {...props} />;
}
