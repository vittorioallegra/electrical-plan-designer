import { cn } from '@/lib/cn';

/** The app's mark: a teal tile with a bolt. Decorative; used in the UI only. */
export function AppMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md bg-accent text-on-accent',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.58)}
        height={Math.round(size * 0.58)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
      </svg>
    </span>
  );
}
