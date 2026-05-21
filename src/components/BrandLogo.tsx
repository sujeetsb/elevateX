import { cn } from '@/components/ui/utils';
import { APP_NAME } from '@/lib/brand';

interface BrandLogoProps {
  size?: number;
  showName?: boolean;
  nameClassName?: string;
  className?: string;
}

/** Minimal ElevateX mark: upward growth curve + AI spark on indigo rounded square. */
export function BrandLogo({ size = 36, showName = true, nameClassName, className }: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5 shrink-0', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden={showName}
        role={showName ? undefined : 'img'}
        aria-label={showName ? undefined : APP_NAME}
      >
        <rect width="36" height="36" rx="10" className="fill-primary" />
        <path
          d="M8 24 L14 18 L20 21 L28 11"
          stroke="white"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
        <circle cx="28" cy="11" r="2.5" fill="#a5b4fc" />
        <path
          d="M26 9 L28 11 L30 9"
          stroke="white"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showName ? (
        <span className={cn('font-semibold tracking-tight text-[var(--cp-text-primary)]', nameClassName)}>
          {APP_NAME}
        </span>
      ) : null}
    </div>
  );
}
