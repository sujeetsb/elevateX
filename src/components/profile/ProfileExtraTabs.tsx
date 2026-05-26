'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/components/GameContext';
import { downloadCourseCertificatePdf } from '@/lib/pdf/course-certificate-pdf';
import { isProTierClient } from '@/lib/subscription/tier';
import { useJobDocumentHistory } from '@/lib/hooks/use-job-documents';
import { useSession } from 'next-auth/react';

type ProfileTab =
  | 'overview'
  | 'skills'
  | 'courses'
  | 'certificates'
  | 'savedJobs'
  | 'appliedJobs'
  | 'resumes'
  | 'badges';

export const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'skills', label: 'Skills' },
  { id: 'courses', label: 'Courses' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'savedJobs', label: 'Saved Jobs' },
  { id: 'appliedJobs', label: 'Applied Jobs' },
  { id: 'resumes', label: 'Resume History' },
  { id: 'badges', label: 'Badges' },
];

type CertRow = {
  id: string;
  certificateId: string;
  userName: string;
  courseTitle: string;
  completedAt: string;
  xpEarned: number;
};

type JobRow = {
  jobId: string;
  title: string;
  company: string;
  location?: string | null;
  savedAt?: string;
  status?: string;
  appliedAt?: string | null;
  applicationId?: string;
};

export function ProfileCoursesTab() {
  const { courses, isHydrating } = useGame();
  const router = useRouter();
  const completed = courses.filter(c => c.progress >= 100);
  const inProgress = courses.filter(c => c.progress > 0 && c.progress < 100);

  if (isHydrating) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl h-14" style={{ background: 'var(--cp-bg-card)' }} />
        ))}
      </div>
    );
  }

  if (!courses.length) {
    return <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>No enrolled courses yet.</p>;
  }

  return (
    <div className="space-y-4">
      {completed.length > 0 && (
        <div>
          <h4 style={{ color: 'var(--cp-text-primary)', fontWeight: 600, marginBottom: '8px' }}>Completed</h4>
          <div className="space-y-2">
            {completed.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => router.push(`/app/courses/${c.id}`)}
                className="w-full text-left glass-card rounded-xl p-3 flex justify-between items-center"
              >
                <div>
                  <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.88rem' }}>{c.title}</div>
                  <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>100% complete</div>
                </div>
                <span style={{ color: '#10b981', fontSize: '0.75rem' }}>✓ Done</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {inProgress.length > 0 && (
        <div>
          <h4 style={{ color: 'var(--cp-text-muted)', fontWeight: 600, marginBottom: '8px' }}>In progress</h4>
          <div className="space-y-2">
            {inProgress.map(c => (
              <button key={c.id} type="button" onClick={() => router.push(`/app/courses/${c.id}`)} className="w-full text-left glass-card rounded-xl p-3">
                <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.88rem' }}>{c.title}</div>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{c.progress}% complete</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProfileCertificatesTab() {
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/v1/certificates', { credentials: 'include' })
      .then(r => r.json())
      .then(j => setCerts(Array.isArray(j?.data) ? j.data : []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--cp-text-muted)' }}>Loading…</p>;
  if (!certs.length) {
    return <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>Complete a course to earn certificates.</p>;
  }

  return (
    <div className="space-y-2">
      {certs.map(c => (
        <div key={c.id} className="glass-card rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.88rem' }}>{c.courseTitle}</div>
            <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>
              {new Date(c.completedAt).toLocaleDateString()} · {c.certificateId}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadCourseCertificatePdf({
                userName: c.userName,
                courseTitle: c.courseTitle,
                completedAt: new Date(c.completedAt).toLocaleDateString(),
                certificateId: c.certificateId,
                xpEarned: c.xpEarned,
              })
            }
            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}
          >
            Download PDF
          </button>
        </div>
      ))}
    </div>
  );
}

export function ProfileSavedJobsTab() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void fetch('/api/v1/jobs/saved', { credentials: 'include' })
      .then(r => r.json())
      .then(j => setJobs(Array.isArray(j?.data) ? j.data : []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl h-14" style={{ background: 'var(--cp-bg-card)' }} />
        ))}
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>
        No saved jobs. Bookmark roles from{' '}
        <button type="button" onClick={() => router.push('/app/jobs')} style={{ color: '#a78bfa' }}>Job Matches</button>.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map(j => (
        <div key={j.jobId} className="glass-card rounded-xl p-3">
          <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600 }}>{j.title}</div>
          <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>{j.company} · {j.location ?? 'Remote'}</div>
        </div>
      ))}
    </div>
  );
}

const STATUS_OPTIONS = ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'] as const;

export function ProfileAppliedJobsTab() {
  const [apps, setApps] = useState<JobRow[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    void fetch('/api/v1/jobs/applications', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        const rows = Array.isArray(j?.data) ? j.data : [];
        setApps(
          rows.map((a: Record<string, unknown>) => ({
            applicationId: String(a.applicationId),
            jobId: String(a.jobId),
            title: String((a.job as Record<string, unknown>)?.title ?? ''),
            company: String((a.job as Record<string, unknown>)?.company ?? ''),
            status: String(a.status ?? 'APPLIED'),
            appliedAt: a.appliedAt as string | null,
          })),
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'ALL' ? apps : apps.filter(a => a.status === filter);

  const updateStatus = async (applicationId: string, status: string) => {
    await fetch('/api/v1/jobs/applications/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ applicationId, status }),
    });
    load();
  };

  return (
    <div>
      {loading ? (
        <div className="animate-pulse space-y-2 mb-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-xl h-14" style={{ background: 'var(--cp-bg-card)' }} />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 mb-3">
        {['ALL', ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className="rounded-xl px-2 py-1 text-xs"
            style={{
              background: filter === s ? 'rgba(124,58,237,0.25)' : 'var(--cp-bg-elevated)',
              color: filter === s ? '#a78bfa' : 'var(--cp-text-muted)',
            }}
          >
            {s}
          </button>
        ))}
      </div>
      {!loading && !filtered.length ? (
        <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>No applications in this filter.</p>
      ) : !loading ? (
        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.applicationId} className="glass-card rounded-xl p-3">
              <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600 }}>{a.title}</div>
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', marginBottom: '8px' }}>
                {a.company}
                {a.appliedAt ? ` · ${new Date(a.appliedAt).toLocaleDateString()}` : ''}
              </div>
              <select
                value={a.status}
                onChange={e => void updateStatus(a.applicationId!, e.target.value)}
                className="rounded-lg px-2 py-1 text-xs"
                style={{ background: 'var(--cp-bg-elevated)', color: 'var(--cp-text-primary)', border: '1px solid var(--cp-border)' }}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProfileResumesTab() {
  const { data: session } = useSession();
  const { data: history = [], isLoading } = useJobDocumentHistory(session?.user?.id);
  const [dbResumes, setDbResumes] = useState<Array<{ id: string; title: string; atsScore: number | null; updatedAt: string }>>([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void fetch('/api/v1/resumes?meta=1', { credentials: 'include' })
      .then(r => r.json())
      .then(res => setDbResumes(Array.isArray(res?.data) ? res.data : []))
      .finally(() => setResumesLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h4 style={{ color: 'var(--cp-text-primary)', fontWeight: 600, marginBottom: '8px' }}>Uploaded resumes</h4>
        {resumesLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl h-14" style={{ background: 'var(--cp-bg-card)' }} />
            ))}
          </div>
        ) : !dbResumes.length ? (
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>No resumes uploaded.</p>
        ) : (
          dbResumes.map(r => (
            <div key={r.id} className="glass-card rounded-xl p-3 mb-2">
              <div style={{ fontWeight: 600, color: 'var(--cp-text-primary)' }}>{r.title}</div>
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>
                ATS {r.atsScore ?? '—'} · {new Date(r.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
      <div>
        <h4 style={{ color: 'var(--cp-text-primary)', fontWeight: 600, marginBottom: '8px' }}>Job documents</h4>
        {isLoading ? (
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>Loading…</p>
        ) : !history.length ? (
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>
            Generate resumes or cover letters from a{' '}
            <button type="button" onClick={() => router.push('/app/jobs')} style={{ color: '#a78bfa' }}>job listing</button>.
          </p>
        ) : (
          history.map(row => (
            <div key={row.jobId} className="glass-card rounded-xl p-3 mb-2">
              <div style={{ fontWeight: 600, color: 'var(--cp-text-primary)' }}>{row.jobTitle}</div>
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', marginBottom: '8px' }}>
                {row.company}
                {row.application?.appliedAt ? ` · Applied ${new Date(row.application.appliedAt).toLocaleDateString()}` : ''}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {row.optimizedResume && (
                  <span className="rounded-lg px-2 py-1" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                    Resume v{row.optimizedResume.resumeVersion} · ATS {row.optimizedResume.atsScoreBefore ?? '?'} → {row.optimizedResume.atsScoreAfter ?? '?'}
                  </span>
                )}
                {row.coverLetter && (
                  <span className="rounded-lg px-2 py-1" style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa' }}>
                    Cover letter · {new Date(row.coverLetter.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
