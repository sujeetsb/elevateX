export type AtsMessageBand = 'excellent' | 'good' | 'needs_work';

export type AtsMessage = {
  band: AtsMessageBand;
  headline: string;
  body: string;
  tip?: string;
  showOptimizeCta: boolean;
};

/** Dynamic ATS copy based on score — use everywhere instead of hardcoded "improve to 85+". */
export function getAtsMessage(score: number | null | undefined): AtsMessage {
  const s = score != null && Number.isFinite(score) ? Math.round(score) : null;

  if (s == null || s <= 0) {
    return {
      band: 'needs_work',
      headline: 'Resume not analyzed yet',
      body: 'Upload your resume to get an ATS score and personalized improvements.',
      tip: 'Run ATS analysis from the Resume Optimizer.',
      showOptimizeCta: true,
    };
  }

  if (s >= 90) {
    return {
      band: 'excellent',
      headline: 'Excellent!',
      body: `Your ATS score is ${s}. Your resume is highly optimized.`,
      tip: 'Keep tailoring keywords when applying to specific roles.',
      showOptimizeCta: false,
    };
  }

  if (s >= 75) {
    return {
      band: 'good',
      headline: 'Good score',
      body: `Your ATS score is ${s}. Small improvements can increase interview chances.`,
      tip: 'Target missing keywords for your next application.',
      showOptimizeCta: true,
    };
  }

  return {
    band: 'needs_work',
    headline: 'Resume needs optimization',
    body: `Your ATS score is ${s}. We'll help you improve it for more callbacks.`,
    tip: 'Use the AI Resume Optimizer to boost formatting and keywords.',
    showOptimizeCta: true,
  };
}

export function getAtsDashboardInsight(score: number | null | undefined): string {
  const msg = getAtsMessage(score);
  if (msg.band === 'excellent') {
    return `🎉 ${msg.headline} ATS ${score}/100 — you're interview-ready.`;
  }
  if (msg.band === 'good') {
    return `📊 ${msg.body}`;
  }
  return `📊 ${msg.body}`;
}

export function getAtsActiveInsight(score: number | null | undefined): { icon: string; text: string; action: string } | null {
  const msg = getAtsMessage(score);
  if (!msg.showOptimizeCta) return null;
  return {
    icon: '⚡',
    text: msg.band === 'good' ? 'Fine-tune keywords to push your ATS score above 90' : 'Improve your ATS score with AI optimization',
    action: '/app/ats',
  };
}
