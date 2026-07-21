import type { ReactNode } from 'react';

export type NavIconId =
  | 'home'
  | 'team'
  | 'chat'
  | 'board'
  | 'attendance'
  | 'assignments'
  | 'pulse'
  | 'community'
  | 'calendar'
  | 'library'
  | 'more'
  | 'close';

interface Props {
  id: NavIconId | string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Svg({
  children,
  size,
  className,
  strokeWidth = 1.75,
}: {
  children: ReactNode;
  size: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function NavIcon({ id, size = 20, className, strokeWidth }: Props) {
  switch (id) {
    case 'home':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </Svg>
      );
    case 'team':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="16.5" cy="9.5" r="2.5" />
          <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
          <path d="M14.5 19c0-1.9 1.4-3.5 3.5-3.5" />
        </Svg>
      );
    case 'chat':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15H11l-5 4v-4.5A3.5 3.5 0 0 1 5 11.5v-5Z" />
          <path d="M9 8h6" />
          <path d="M9 11h4" />
        </Svg>
      );
    case 'board':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </Svg>
      );
    case 'attendance':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </Svg>
      );
    case 'assignments':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <path d="M5 6h14v12H5z" />
          <path d="m5 7 7 5 7-5" />
        </Svg>
      );
    case 'pulse':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <path d="M4 18V6" />
          <path d="M10 18V10" />
          <path d="M16 18v-5" />
          <path d="M22 18V8" />
        </Svg>
      );
    case 'community':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <circle cx="12" cy="12" r="8" />
          <path d="M3 12h18" />
          <path d="M12 4a12 12 0 0 1 0 16" />
          <path d="M12 4a12 12 0 0 0 0 16" />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </Svg>
      );
    case 'library':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <path d="M13 16.5h7" />
          <path d="M16.5 13v7" />
        </Svg>
      );
    case 'more':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </Svg>
      );
    case 'close':
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <path d="m7 7 10 10M17 7 7 17" />
        </Svg>
      );
    default:
      return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
          <circle cx="12" cy="12" r="8" />
        </Svg>
      );
  }
}

/** Iconos para chips de resumen móvil */
export function MobileStatIcon({
  kind,
  size = 16,
}: {
  kind: 'overdue' | 'pending' | 'urgent' | 'projects' | 'done' | 'soon' | 'notify';
  size?: number;
}) {
  const className = 'mobile-stat-icon';
  switch (kind) {
    case 'overdue':
      return (
        <Svg size={size} className={className} strokeWidth={2}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v6" />
          <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
        </Svg>
      );
    case 'pending':
      return <NavIcon id="assignments" size={size} className={className} strokeWidth={2} />;
    case 'urgent':
      return (
        <Svg size={size} className={className} strokeWidth={2}>
          <path d="M12 4l8 14H4L12 4z" />
          <path d="M12 10v3" />
          <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
        </Svg>
      );
    case 'projects':
      return <NavIcon id="board" size={size} className={className} strokeWidth={2} />;
    case 'done':
      return (
        <Svg size={size} className={className} strokeWidth={2}>
          <path d="M5 12.5 9.5 17 19 7" />
        </Svg>
      );
    case 'soon':
      return (
        <Svg size={size} className={className} strokeWidth={2}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 1.5" />
        </Svg>
      );
    case 'notify':
      return (
        <Svg size={size} className={className} strokeWidth={2}>
          <path d="M12 5a5 5 0 0 1 5 5v2.5l1.5 2.5H5.5L7 12.5V10a5 5 0 0 1 5-5Z" />
          <path d="M10 18a2 2 0 0 0 4 0" />
        </Svg>
      );
    default:
      return null;
  }
}
