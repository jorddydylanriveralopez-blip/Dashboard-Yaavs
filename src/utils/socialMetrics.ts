import type {
  ContentSentiment,
  SocialContentEntry,
  SocialMetricsStore,
  SocialPlatform,
} from '../types';
import type { PieSlice } from './dailyKpiSnapshots';
import { getMonthKey } from './performanceHistory';
import { colorForPlatform, colorForSentiment } from '../data/socialPlatforms';

export function engagementRate(entry: SocialContentEntry): number {
  const interactions = entry.likes + entry.comments + entry.shares;
  if (entry.views <= 0) return interactions > 0 ? 100 : 0;
  return Math.min(100, Math.round((interactions / entry.views) * 1000) / 10);
}

export function entriesForMonth(
  store: SocialMetricsStore,
  monthKey = getMonthKey(),
): SocialContentEntry[] {
  return store.entries
    .filter((e) => e.monthKey === monthKey)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export function buildSentimentPie(entries: SocialContentEntry[]): PieSlice[] {
  const counts: Record<ContentSentiment, number> = {
    gusta: 0,
    regular: 0,
    no_gusta: 0,
  };
  for (const e of entries) counts[e.sentiment] += 1;
  const total = entries.length || 1;
  return (['gusta', 'regular', 'no_gusta'] as ContentSentiment[])
    .filter((s) => counts[s] > 0)
    .map((s) => ({
      id: s,
      label: s === 'gusta' ? 'Está gustando' : s === 'no_gusta' ? 'No gusta' : 'Regular',
      value: counts[s],
      color: colorForSentiment(s),
      kpiPercent: Math.round((counts[s] / total) * 100),
      sharePercent: Math.round((counts[s] / total) * 100),
    }));
}

export function buildPlatformPie(entries: SocialContentEntry[]): PieSlice[] {
  const byPlatform = new Map<SocialPlatform, number>();
  for (const e of entries) {
    byPlatform.set(e.platform, (byPlatform.get(e.platform) ?? 0) + 1);
  }
  const total = entries.length || 1;
  return [...byPlatform.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([platform, count]) => ({
      id: platform,
      label: platform === 'meta' ? 'Meta' : platform.charAt(0).toUpperCase() + platform.slice(1),
      value: count,
      color: colorForPlatform(platform),
      kpiPercent: Math.round((count / total) * 100),
      sharePercent: Math.round((count / total) * 100),
    }));
}

export interface PlatformStats {
  platform: SocialPlatform;
  label: string;
  color: string;
  posts: number;
  avgEngagement: number;
  totalViews: number;
  gustaPercent: number;
}

export function buildPlatformStats(entries: SocialContentEntry[]): PlatformStats[] {
  const groups = new Map<SocialPlatform, SocialContentEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.platform) ?? [];
    list.push(e);
    groups.set(e.platform, list);
  }

  return [...groups.entries()].map(([platform, list]) => {
    const avgEngagement =
      list.length === 0
        ? 0
        : Math.round(list.reduce((s, e) => s + engagementRate(e), 0) / list.length);
    const gusta = list.filter((e) => e.sentiment === 'gusta').length;
    return {
      platform,
      label:
        platform === 'tiktok'
          ? 'TikTok'
          : platform === 'meta'
            ? 'Meta'
            : platform === 'instagram'
              ? 'Instagram'
              : platform === 'youtube'
                ? 'YouTube'
                : 'Otra',
      color: colorForPlatform(platform),
      posts: list.length,
      avgEngagement,
      totalViews: list.reduce((s, e) => s + e.views, 0),
      gustaPercent: list.length ? Math.round((gusta / list.length) * 100) : 0,
    };
  });
}

export interface DailyEngagementPoint {
  dateKey: string;
  label: string;
  tiktok: number;
  meta: number;
  instagram: number;
  other: number;
}

export function buildDailyEngagementTrend(
  entries: SocialContentEntry[],
  days = 14,
): DailyEngagementPoint[] {
  const today = new Date();
  const points: DailyEngagementPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const dayEntries = entries.filter((e) => e.dateKey === dateKey);
    const avg = (platform: SocialPlatform) => {
      const list = dayEntries.filter((e) => e.platform === platform);
      if (!list.length) return 0;
      return Math.round(list.reduce((s, e) => s + engagementRate(e), 0) / list.length);
    };
    const otherList = dayEntries.filter(
      (e) => !['tiktok', 'meta', 'instagram'].includes(e.platform),
    );
    const otherAvg = otherList.length
      ? Math.round(otherList.reduce((s, e) => s + engagementRate(e), 0) / otherList.length)
      : 0;

    points.push({
      dateKey,
      label: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
      tiktok: avg('tiktok'),
      meta: avg('meta'),
      instagram: avg('instagram'),
      other: otherAvg,
    });
  }

  return points;
}

export interface MonthSocialSummary {
  monthLabel: string;
  totalPosts: number;
  gustaPercent: number;
  avgEngagement: number;
  topPlatform: SocialPlatform | null;
}

export function buildMonthSocialSummary(entries: SocialContentEntry[]): MonthSocialSummary {
  const monthLabel = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const gusta = entries.filter((e) => e.sentiment === 'gusta').length;
  const avgEngagement =
    entries.length === 0
      ? 0
      : Math.round(entries.reduce((s, e) => s + engagementRate(e), 0) / entries.length);
  const platformStats = buildPlatformStats(entries);
  const topPlatform = platformStats.sort((a, b) => b.posts - a.posts)[0]?.platform ?? null;

  return {
    monthLabel,
    totalPosts: entries.length,
    gustaPercent: entries.length ? Math.round((gusta / entries.length) * 100) : 0,
    avgEngagement,
    topPlatform,
  };
}
