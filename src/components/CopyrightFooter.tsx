import { COPYRIGHT_NOTICE } from '@/lib/brand';

/** Server-rendered global copyright footer — single source for all routes. */
export function CopyrightFooter() {
  return (
    <footer className="cp-global-footer" role="contentinfo">
      <p>{COPYRIGHT_NOTICE}</p>
    </footer>
  );
}
