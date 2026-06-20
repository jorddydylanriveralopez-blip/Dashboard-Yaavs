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
