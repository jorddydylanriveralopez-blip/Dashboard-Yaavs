import type { ContentSentiment, SocialPlatform } from '../types';

export const SOCIAL_PLATFORMS: { value: SocialPlatform; label: string; color: string }[] = [
  { value: 'tiktok', label: 'TikTok', color: '#010101' },
  { value: 'meta', label: 'Meta (Facebook)', color: '#1877f2' },
  { value: 'instagram', label: 'Instagram', color: '#e1306c' },
  { value: 'youtube', label: 'YouTube', color: '#ff0000' },
  { value: 'otro', label: 'Otra red', color: '#78716c' },
];

export const SENTIMENT_OPTIONS: {
  value: ContentSentiment;
  label: string;
  color: string;
}[] = [
  { value: 'gusta', label: 'Está gustando', color: '#00c875' },
  { value: 'regular', label: 'Regular', color: '#fdab3d' },
  { value: 'no_gusta', label: 'No está gustando', color: '#e2445c' },
];

export function labelForPlatform(platform: SocialPlatform): string {
  return SOCIAL_PLATFORMS.find((p) => p.value === platform)?.label ?? platform;
}

export function colorForPlatform(platform: SocialPlatform): string {
  return SOCIAL_PLATFORMS.find((p) => p.value === platform)?.color ?? '#78716c';
}

export function labelForSentiment(sentiment: ContentSentiment): string {
  return SENTIMENT_OPTIONS.find((s) => s.value === sentiment)?.label ?? sentiment;
}

export function colorForSentiment(sentiment: ContentSentiment): string {
  return SENTIMENT_OPTIONS.find((s) => s.value === sentiment)?.color ?? '#78716c';
}

/** Redes que se pueden vincular (con cuenta pública) en el dashboard. */
export const LINKABLE_PLATFORMS: {
  value: SocialPlatform;
  label: string;
  color: string;
  baseUrl: string;
  placeholder: string;
}[] = [
  {
    value: 'instagram',
    label: 'Instagram',
    color: '#e1306c',
    baseUrl: 'https://instagram.com/',
    placeholder: '@cuenta o link',
  },
  {
    value: 'tiktok',
    label: 'TikTok',
    color: '#010101',
    baseUrl: 'https://tiktok.com/@',
    placeholder: '@cuenta o link',
  },
  {
    value: 'meta',
    label: 'Facebook',
    color: '#1877f2',
    baseUrl: 'https://facebook.com/',
    placeholder: 'Nombre de página o link',
  },
];

/** Convierte lo que escriba el usuario (handle o URL) en un enlace y un handle limpios. */
export function normalizeSocialInput(
  platform: SocialPlatform,
  raw: string,
): { handle: string; url: string } | null {
  const value = raw.trim();
  if (!value) return null;

  const meta = LINKABLE_PLATFORMS.find((p) => p.value === platform);
  const base = meta?.baseUrl ?? 'https://';

  if (/^https?:\/\//i.test(value)) {
    let handle = value;
    try {
      const u = new URL(value);
      const seg = u.pathname.split('/').filter(Boolean)[0] ?? u.hostname;
      handle = seg.startsWith('@') ? seg : `@${seg}`;
    } catch {
      /* usa el valor tal cual */
    }
    return { handle, url: value };
  }

  const clean = value.replace(/^@/, '');
  return { handle: `@${clean}`, url: `${base}${clean}` };
}
