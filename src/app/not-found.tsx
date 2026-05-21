import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="aurora-bg min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <p style={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.1rem' }}>Page not found</p>
      <p style={{ color: '#94a3b8', maxWidth: '24rem', fontSize: '0.9rem' }}>
        The page you are looking for does not exist or was moved.
      </p>
      <Link href="/" className="btn-primary rounded-xl px-6 py-3 no-underline" style={{ fontWeight: 600, color: 'white' }}>
        Back to home
      </Link>
    </div>
  );
}
