import type { CSSProperties } from 'react';

type Variant = 'login' | 'app';

const LOGIN_SHAPES = [
  { kind: 'hex', top: '8%', left: '6%', size: 48, delay: 0, duration: 14, opacity: 0.55 },
  { kind: 'ring', top: '18%', right: '10%', size: 72, delay: 1.2, duration: 18, opacity: 0.45 },
  { kind: 'dot', top: '42%', left: '4%', size: 10, delay: 0.6, duration: 11, opacity: 0.75 },
  { kind: 'hex', top: '55%', right: '6%', size: 36, delay: 2, duration: 16, opacity: 0.5 },
  { kind: 'ring', top: '78%', right: '14%', size: 56, delay: 1.5, duration: 20, opacity: 0.4 },
  { kind: 'dot', top: '28%', right: '22%', size: 8, delay: 2.4, duration: 10, opacity: 0.7 },
  { kind: 'hex', top: '88%', left: '38%', size: 40, delay: 1, duration: 15, opacity: 0.45 },
  { kind: 'dot', top: '62%', right: '28%', size: 12, delay: 0.3, duration: 9, opacity: 0.65 },
] as const;

const APP_SHAPES = [
  { kind: 'hex', top: '6%', right: '8%', size: 40, delay: 0, duration: 16, opacity: 0.22 },
  { kind: 'ring', top: '22%', left: '5%', size: 64, delay: 1, duration: 20, opacity: 0.18 },
  { kind: 'dot', top: '48%', right: '4%', size: 8, delay: 0.5, duration: 12, opacity: 0.28 },
  { kind: 'hex', top: '70%', left: '10%', size: 32, delay: 1.8, duration: 18, opacity: 0.2 },
  { kind: 'ring', top: '85%', right: '18%', size: 48, delay: 0.8, duration: 22, opacity: 0.16 },
  { kind: 'dot', top: '15%', left: '42%', size: 6, delay: 2, duration: 10, opacity: 0.25 },
] as const;

interface Props {
  variant?: Variant;
  className?: string;
}

export function TechAmbience({ variant = 'app', className = '' }: Props) {
  const shapes = variant === 'login' ? LOGIN_SHAPES : APP_SHAPES;

  return (
    <div className={`tech-float-layer ${className}`.trim()} aria-hidden="true">
      {shapes.map((shape, i) => (
        <span
          key={i}
          className={`tech-float tech-float--${shape.kind}`}
          style={
            {
              '--float-size': `${shape.size}px`,
              '--float-delay': `${shape.delay}s`,
              '--float-duration': `${shape.duration}s`,
              '--float-opacity': shape.opacity,
              top: 'top' in shape ? shape.top : undefined,
              left: 'left' in shape ? shape.left : undefined,
              right: 'right' in shape ? shape.right : undefined,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
