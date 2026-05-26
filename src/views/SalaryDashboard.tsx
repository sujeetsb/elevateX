'use client';

import { useRouter } from 'next/navigation';
import { SalaryIntelligence } from '@/components/SalaryIntelligence';
import { useGame } from '@/components/GameContext';
import { ArrowLeft } from 'lucide-react';

export function SalaryDashboard() {
  const router = useRouter();
  const { user } = useGame();

  return (
    <div className="app-page" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className="section-pad pt-5 pb-2">
        <button
          type="button"
          onClick={() => router.push('/app/dashboard')}
          className="flex items-center gap-2 mb-4 text-sm"
          style={{ color: 'var(--cp-text-muted)', background: 'none', border: 'none' }}
        >
          <ArrowLeft size={16} /> Dashboard
        </button>
      </div>
      <div className="section-pad">
        <SalaryIntelligence
          userCurrentSalary={user.currentSalary}
          salaryCurrency={user.salaryCurrency}
          country={user.country}
          profileVersion={user.profileVersion}
        />
      </div>
    </div>
  );
}
