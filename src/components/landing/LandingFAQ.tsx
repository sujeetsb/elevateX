'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    q: 'What is ATS score?',
    a: 'ATS (Applicant Tracking System) score measures how well your resume matches job descriptions and passes automated screening. ElevateX analyzes keywords, formatting, and structure to suggest improvements.',
  },
  {
    q: 'How AI roadmap works?',
    a: 'We parse your resume and goals, compare them to market data for your target role, and generate a step-by-step learning path with skills, courses, and milestones — updated as you progress.',
  },
  {
    q: 'Can I apply jobs?',
    a: 'Yes. PRO users can browse AI-matched jobs, generate tailored cover letters, and track applications from the dashboard. Free users get resume analysis and career paths.',
  },
  {
    q: 'Is PRO required?',
    a: 'No. The free plan includes resume analysis, career paths, and limited chatbot access. PRO unlocks job applications, cover letters, advanced AI features, and unlimited chatbot usage.',
  },
];

export function LandingFAQ() {
  return (
    <section id="faq" className="section-pad bg-[var(--cp-surface-0)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--cp-text-primary)] mb-3">
            Frequently asked questions
          </h2>
          <p className="text-[var(--cp-text-muted)]">
            Everything you need to know before getting started.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.q} value={`item-${i}`} className="border-[var(--cp-border-subtle)]">
              <AccordionTrigger className="text-left text-[var(--cp-text-primary)] hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-[var(--cp-text-muted)] leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
