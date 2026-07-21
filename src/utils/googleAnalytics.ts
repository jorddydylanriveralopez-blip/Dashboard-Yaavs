import { GA_REPORT_CACHE_KEY } from '../constants';
import type { SocialPlatform } from '../types';
import { labelForPlatform } from '../data/socialPlatforms';

export interface GoogleAnalyticsSourceRow {
  source: string;
  platform: SocialPlatform | 'otro';
  sessions: number;
  users: number;
  engagementRate: number;
}

export interface GoogleAnalyticsDailyPoint {
  dateKey: string;
  label: string;
  sessions: number;
  users: number;
}

export interface GoogleAnalyticsReport {
  monthKey: string;
  mode: 'live' | 'demo';
  propertyId: string | null;
  fetchedAt: string;
  error?: string;
  summary: {
    users: number;
    sessions: number;
    pageViews: number;
    engagementRate: number;
    avgSessionDurationSec: number;
  };
  socialSources: GoogleAnalyticsSourceRow[];
  dailyTrend: GoogleAnalyticsDailyPoint[];
  openUrl: string;
}

function apiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return '';
}

export function loadCachedGaReport(monthKey: string): GoogleAnalyticsReport | null {
  try {
    const raw = localStorage.getItem(GA_REPORT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleAnalyticsReport;
    if (parsed.monthKey !== monthKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCachedGaReport(report: GoogleAnalyticsReport): void {
  localStorage.setItem(GA_REPORT_CACHE_KEY, JSON.stringify(report));
}

export async function fetchGoogleAnalyticsReport(
  monthKey: string,
): Promise<GoogleAnalyticsReport> {
  const base = apiBase();
  const url = `${base}/api/analytics/report?month=${encodeURIComponent(monthKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('No se pudo conectar con Google Analytics.');
  }
  const report = (await response.json()) as GoogleAnalyticsReport;
  saveCachedGaReport(report);
  return report;
}

export function gaSessionsByPlatform(report: GoogleAnalyticsReport | null) {
  if (!report) return new Map<SocialPlatform, number>();
  const map = new Map<SocialPlatform, number>();
  for (const row of report.socialSources) {
    const platform = row.platform === 'otro' ? 'meta' : row.platform;
    map.set(platform, (map.get(platform) ?? 0) + row.sessions);
  }
  return map;
}

export function formatGaDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function gaSourceLabel(row: GoogleAnalyticsSourceRow): string {
  if (row.platform === 'otro') return row.source;
  return labelForPlatform(row.platform);
}
