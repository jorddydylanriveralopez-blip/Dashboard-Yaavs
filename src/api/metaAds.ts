export interface MetaCampaignRow {
  id: string;
  name: string;
  status: string;
  isActive: boolean;
  objective: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  spend: number;
  impressions: number;
  reach: number;
  results: number | null;
  resultType: string | null;
  resultLabel: string | null;
  costPerResult: number | null;
  adsManagerUrl: string;
}

export interface MetaCampaignsResponse {
  ok: boolean;
  configured: boolean;
  error?: string;
  adAccountId?: string;
  since?: string;
  until?: string;
  currency?: string;
  summary?: {
    spend: number;
    impressions: number;
    reach: number;
    activeCampaigns: number;
    totalCampaigns: number;
  } | null;
  campaigns: MetaCampaignRow[];
}

function apiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD && typeof window !== 'undefined') return window.location.origin;
  return '';
}

export type MetaRangePreset = 7 | 30 | 'month';

function rangeForPreset(preset: MetaRangePreset): { since: string; until: string; days?: number } {
  const until = new Date();
  const since = new Date();
  if (preset === 'month') {
    since.setDate(1);
  } else {
    since.setDate(until.getDate() - (preset - 1));
  }
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until), days: preset === 'month' ? undefined : preset };
}

/** Trae campañas e insights de Meta Ads desde el servidor. */
export async function fetchMetaCampaigns(
  preset: MetaRangePreset = 30,
): Promise<MetaCampaignsResponse> {
  const range = rangeForPreset(preset);
  try {
    const res = await fetch(`${apiBase()}/api/analytics/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'meta-campaigns',
        since: range.since,
        until: range.until,
        days: range.days,
      }),
      cache: 'no-store',
    });
    const data = (await res.json()) as MetaCampaignsResponse;
    if (!res.ok && !data.error) {
      return {
        ok: false,
        configured: data.configured ?? false,
        error: `Error ${res.status}`,
        campaigns: [],
        summary: null,
      };
    }
    return data;
  } catch {
    return {
      ok: false,
      configured: false,
      error: 'No se pudo contactar al servidor de Meta Ads.',
      campaigns: [],
      summary: null,
    };
  }
}

export function formatMetaMoney(value: number | null | undefined, currency = 'MXN'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function formatMetaNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('es-MX').format(Math.round(value));
}
