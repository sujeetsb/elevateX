'use client';

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { chartTickFormatter, type SalaryLocale } from '@/lib/salary/locale';
import type { SalaryInsightsData } from './SalaryIntelligence';

type Props = {
  data: SalaryInsightsData;
  locale: SalaryLocale;
  compact?: boolean;
  formatChartValue: (v: number) => string;
};

export function SalaryChartsInner({ data, locale, compact, formatChartValue }: Props) {
  if (!data.premium) return null;

  return (
    <>
      {data.growthTrend && data.growthTrend.length > 0 && (
        <div className="mb-4">
          <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', marginBottom: '8px' }}>Growth trend</div>
          <ResponsiveContainer width="100%" height={compact ? 160 : 200}>
            <LineChart data={data.growthTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="year" stroke="#64748b" tickFormatter={v => `Yr ${v}`} fontSize={11} />
              <YAxis stroke="#64748b" tickFormatter={v => chartTickFormatter(Number(v), locale)} fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)' }}
                formatter={(v: number) => [formatChartValue(v), 'Salary']}
              />
              <Line type="monotone" dataKey="salary" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#a78bfa', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.roleComparison && data.roleComparison.length > 0 && !compact && (
        <div className="mb-4">
          <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', marginBottom: '8px' }}>Role comparison</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.roleComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="role" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" tickFormatter={v => chartTickFormatter(Number(v), locale)} fontSize={10} />
              <Tooltip
                contentStyle={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)' }}
                formatter={(v: number) => [formatChartValue(v), 'Salary']}
              />
              <Bar dataKey="salary" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}
