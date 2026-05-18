// Sprint 10 (ADR-030): the upstream Goose mascot is replaced with the LQ
// mark (text-as-logo) for Oscar GC. The component name is kept so upstream
// merges of GooseLogo edits surface as conflicts on this single file rather
// than spreading across every call site.

import { cn } from '../utils';

interface GooseLogoProps {
  className?: string;
  size?: 'default' | 'small';
  // Kept for prop-compatibility with upstream call sites; LQ mark has no
  // hover state, so this is ignored.
  hover?: boolean;
}

export default function GooseLogo({ className = '', size = 'default' }: GooseLogoProps) {
  const dims = size === 'small' ? 32 : 64;
  return (
    <div
      className={cn(className, 'relative overflow-hidden')}
      style={{ width: dims, height: dims }}
      aria-label="Oscar GC"
    >
      <svg
        viewBox="0 0 120 120"
        width={dims}
        height={dims}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="120" height="120" rx="14" ry="14" fill="#FAF6F0" />
        <text
          x="60"
          y="80"
          textAnchor="middle"
          fontFamily="Cormorant Garamond, Georgia, serif"
          fontWeight="700"
          fontSize="82"
          letterSpacing="-4"
          fill="#1C1917"
        >
          L
          <tspan fill="#9A3412" fontStyle="italic">
            Q
          </tspan>
        </text>
        <line x1="36" y1="96" x2="84" y2="96" stroke="#9A3412" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
