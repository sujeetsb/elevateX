/**
 * Curated multi-domain learning catalog.
 * Used as fallback when AI is unavailable and as hybrid supplement to AI recommendations.
 * Covers both technical and non-technical career paths.
 */

export interface CatalogItem {
  provider: string;
  title: string;
  url: string;
  domain: string;
  kind: 'platform' | 'course' | 'certification' | 'article' | 'community';
  free: boolean;
}

export const LEARNING_CATALOG: CatalogItem[] = [
  // --- Technical / Engineering ---
  { provider: 'MDN Web Docs',     title: 'JavaScript & Web Fundamentals', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', domain: 'engineering', kind: 'platform', free: true },
  { provider: 'web.dev',          title: 'Learn HTML, CSS & Responsive Design', url: 'https://web.dev/learn', domain: 'engineering', kind: 'platform', free: true },
  { provider: 'roadmap.sh',       title: 'Developer Career Roadmaps', url: 'https://roadmap.sh', domain: 'engineering', kind: 'platform', free: true },
  { provider: 'freeCodeCamp',     title: 'Full-Stack Web Development Curriculum', url: 'https://www.freecodecamp.org/learn', domain: 'engineering', kind: 'platform', free: true },
  { provider: 'The Odin Project', title: 'Full Stack Open Source Curriculum', url: 'https://www.theodinproject.com', domain: 'engineering', kind: 'platform', free: true },
  { provider: 'CS50',             title: 'Harvard CS50x Introduction to CS', url: 'https://cs50.harvard.edu/x', domain: 'engineering', kind: 'course', free: true },
  { provider: 'Google',           title: 'Google Developer Certifications', url: 'https://developers.google.com/certification', domain: 'engineering', kind: 'certification', free: false },

  // --- Data Science / AI / ML ---
  { provider: 'Kaggle',           title: 'Data Science & ML Courses', url: 'https://www.kaggle.com/learn', domain: 'data', kind: 'platform', free: true },
  { provider: 'fast.ai',          title: 'Practical Deep Learning for Coders', url: 'https://www.fast.ai', domain: 'data', kind: 'course', free: true },
  { provider: 'Coursera',         title: 'IBM Data Science Professional Certificate', url: 'https://www.coursera.org/professional-certificates/ibm-data-science', domain: 'data', kind: 'certification', free: false },

  // --- Business / Management ---
  { provider: 'Coursera',         title: 'Business Foundations (Wharton)', url: 'https://www.coursera.org/specializations/wharton-business-foundations', domain: 'business', kind: 'course', free: false },
  { provider: 'edX',              title: 'MicroMasters in Business Administration', url: 'https://www.edx.org/micromasters/business-administration', domain: 'business', kind: 'certification', free: false },
  { provider: 'Harvard OPM',      title: 'Harvard Online Management Programs', url: 'https://online.hbs.edu/courses/', domain: 'business', kind: 'platform', free: false },

  // --- Marketing / Sales ---
  { provider: 'HubSpot Academy',  title: 'Inbound Marketing Certification', url: 'https://academy.hubspot.com/courses/inbound-marketing', domain: 'marketing', kind: 'certification', free: true },
  { provider: 'Google Skillshop', title: 'Google Ads & Analytics Certifications', url: 'https://skillshop.withgoogle.com', domain: 'marketing', kind: 'certification', free: true },
  { provider: 'Meta Blueprint',   title: 'Meta Social Media Marketing', url: 'https://www.facebook.com/business/learn', domain: 'marketing', kind: 'certification', free: true },
  { provider: 'Salesforce',       title: 'Salesforce Trailhead (CRM & Sales)', url: 'https://trailhead.salesforce.com', domain: 'sales', kind: 'platform', free: true },
  { provider: 'Coursera',         title: 'Digital Marketing Specialization', url: 'https://www.coursera.org/specializations/digital-marketing', domain: 'marketing', kind: 'course', free: false },

  // --- HR / People Operations ---
  { provider: 'SHRM',             title: 'SHRM-CP & SHRM-SCP Certification', url: 'https://www.shrm.org/credentials', domain: 'hr', kind: 'certification', free: false },
  { provider: 'HRCI',             title: 'PHR & SPHR HR Certification', url: 'https://www.hrci.org/certifications', domain: 'hr', kind: 'certification', free: false },
  { provider: 'LinkedIn Learning', title: 'HR Foundations & Talent Management', url: 'https://www.linkedin.com/learning/topics/human-resources', domain: 'hr', kind: 'platform', free: false },
  { provider: 'Coursera',         title: 'Human Resource Management (Michigan)', url: 'https://www.coursera.org/specializations/human-resource-management', domain: 'hr', kind: 'course', free: false },

  // --- Finance / Accounting ---
  { provider: 'CFA Institute',    title: 'CFA Program', url: 'https://www.cfainstitute.org/en/programs/cfa', domain: 'finance', kind: 'certification', free: false },
  { provider: 'AICPA',            title: 'CPA Examination & Resources', url: 'https://www.aicpa-cima.com/certifications/cpa', domain: 'finance', kind: 'certification', free: false },
  { provider: 'Khan Academy',     title: 'Finance & Capital Markets', url: 'https://www.khanacademy.org/economics-finance-domain', domain: 'finance', kind: 'platform', free: true },
  { provider: 'Coursera',         title: 'Financial Markets (Yale)', url: 'https://www.coursera.org/learn/financial-markets-global', domain: 'finance', kind: 'course', free: false },

  // --- Healthcare ---
  { provider: 'Coursera',         title: 'Healthcare & Medicine (Johns Hopkins)', url: 'https://www.coursera.org/browse/health', domain: 'healthcare', kind: 'platform', free: false },
  { provider: 'MedBridge',        title: 'Healthcare Professional CEUs', url: 'https://www.medbridge.com', domain: 'healthcare', kind: 'platform', free: false },
  { provider: 'CDC',              title: 'Public Health Training', url: 'https://www.cdc.gov/training', domain: 'healthcare', kind: 'platform', free: true },

  // --- Legal ---
  { provider: 'LexisNexis',       title: 'Legal Research & Skills Training', url: 'https://www.lexisnexis.com/en-us/products/lexis-plus.page', domain: 'legal', kind: 'platform', free: false },
  { provider: 'edX',              title: 'Law & Legal Systems', url: 'https://www.edx.org/learn/law', domain: 'legal', kind: 'platform', free: false },
  { provider: 'Coursera',         title: 'Paralegal Studies', url: 'https://www.coursera.org/browse/law', domain: 'legal', kind: 'platform', free: false },

  // --- Project Management ---
  { provider: 'PMI',              title: 'PMP Certification', url: 'https://www.pmi.org/certifications/project-management-pmp', domain: 'management', kind: 'certification', free: false },
  { provider: 'Scrum.org',        title: 'Professional Scrum Certifications', url: 'https://www.scrum.org/professional-scrum-certifications', domain: 'management', kind: 'certification', free: false },
  { provider: 'Google',           title: 'Google Project Management Certificate', url: 'https://www.coursera.org/professional-certificates/google-project-management', domain: 'management', kind: 'certification', free: false },

  // --- Universal / Career Development ---
  { provider: 'LinkedIn Learning', title: 'LinkedIn Learning (All Domains)', url: 'https://www.linkedin.com/learning', domain: 'general', kind: 'platform', free: false },
  { provider: 'Coursera',          title: 'Coursera Professional Certificates', url: 'https://www.coursera.org/professional-certificates', domain: 'general', kind: 'platform', free: false },
  { provider: 'edX',               title: 'edX Professional Programs', url: 'https://www.edx.org/professional-programs', domain: 'general', kind: 'platform', free: false },
  { provider: 'Udemy',             title: 'Udemy Business Skills Courses', url: 'https://www.udemy.com/courses/business/', domain: 'general', kind: 'platform', free: false },
  { provider: 'Toastmasters',      title: 'Public Speaking & Leadership', url: 'https://www.toastmasters.org', domain: 'general', kind: 'community', free: false },
] as const;

/** Filter catalog by domain(s). Falls back to 'general' items if no domain match. */
export function getCatalogByDomain(domains: string[]): CatalogItem[] {
  const normalized = domains.map(d => d.toLowerCase());
  const matches = LEARNING_CATALOG.filter(item =>
    normalized.some(d => item.domain === d || item.domain === 'general'),
  );
  return matches.length >= 4 ? matches : [...LEARNING_CATALOG.filter(i => i.domain === 'general')];
}
