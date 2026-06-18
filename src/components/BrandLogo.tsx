import { useState } from 'react';
import { LOGO_URL } from '../constants';
import './BrandLogo.css';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={`brand-logo-fallback brand-logo-${size} ${className}`} aria-hidden>
        Y
      </span>
    );
  }

  return (
    <img
      src={LOGO_URL}
      alt="Yaavs"
      className={`brand-logo brand-logo-${size} ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
