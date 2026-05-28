'use client';

import { Suspense } from 'react';
import { Analytics } from '@/views/Analytics';

function AnalyticsFallback() {
  return (
    <div className="app-page section-pad animate-pulse pt-6">
      <div className="rounded-3xl h-24 mb-4" style={{ background: 'var(--cp-bg-card)' }} />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-2xl h-20" style={{ background: 'var(--cp-bg-card)' }} />
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsFallback />}>
      <Analytics />
    </Suspense>
  );
}
