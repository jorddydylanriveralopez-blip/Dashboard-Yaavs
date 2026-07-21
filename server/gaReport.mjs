function monthBounds(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const startDate = `${monthKey}-01`;
  const today = new Date().toISOString().slice(0, 10);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  const endDate = monthEnd > today ? today : monthEnd;
  return { startDate, endDate };
}

function mapSourceToPlatform(source) {
  const s = (source ?? '').toLowerCase();
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('instagram') || s === 'l.instagram.com') return 'instagram';
  if (s.includes('facebook') || s.includes('meta') || s === 'm.facebook.com') return 'meta';
  if (s.includes('youtube')) return 'youtube';
  return 'otro';
}

function buildDemoGaReport(monthKey) {
  const socialSources = [
    { source: 'tiktok.com', platform: 'tiktok', sessions: 18420, users: 15200, engagementRate: 62 },
    { source: 'instagram.com', platform: 'instagram', sessions: 12680, users: 10450, engagementRate: 58 },
    { source: 'm.facebook.com', platform: 'meta', sessions: 9420, users: 8100, engagementRate: 49 },
    { source: 'youtube.com', platform: 'youtube', sessions: 3180, users: 2900, engagementRate: 54 },
  ];

  const dailyTrend = [];
  const { endDate } = monthBounds(monthKey);
  const end = new Date(`${endDate}T12:00:00`);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    if (!dateKey.startsWith(monthKey)) continue;
    const sessions = 900 + ((dateKey.charCodeAt(8) + i * 17) % 700);
    dailyTrend.push({
      dateKey,
      label: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
      sessions,
      users: Math.round(sessions * 0.82),
    });
  }

  const users = socialSources.reduce((sum, row) => sum + row.users, 0) + 8200;
  const sessions = socialSources.reduce((sum, row) => sum + row.sessions, 0) + 10400;
  const pageViews = Math.round(sessions * 2.35);
  const engagementRate = Math.round(
    socialSources.reduce((sum, row) => sum + row.engagementRate, 0) / socialSources.length,
  );

  return {
    monthKey,
    mode: 'demo',
    propertyId: null,
    fetchedAt: new Date().toISOString(),
    summary: {
      users,
      sessions,
      pageViews,
      engagementRate,
      avgSessionDurationSec: 142,
    },
    socialSources,
    dailyTrend,
    openUrl: 'https://analytics.google.com/',
  };
}

function parseCredentials() {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function runLiveReport(monthKey, propertyId, credentials) {
  const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
  const client = new BetaAnalyticsDataClient({ credentials });
  const { startDate, endDate } = monthBounds(monthKey);
  const property = `properties/${propertyId}`;

  const [overview] = await client.runReport({
    property,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
    ],
  });

  const [sources] = await client.runReport({
    property,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionSource' }],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'engagementRate' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionDefaultChannelGroup',
        stringFilter: { matchType: 'EXACT', value: 'Organic Social' },
      },
    },
    limit: 12,
  });

  const [daily] = await client.runReport({
    property,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  });

  const overviewRow = overview.rows?.[0]?.metricValues ?? [];
  const summary = {
    users: Number(overviewRow[0]?.value ?? 0),
    sessions: Number(overviewRow[1]?.value ?? 0),
    pageViews: Number(overviewRow[2]?.value ?? 0),
    engagementRate: Math.round(Number(overviewRow[3]?.value ?? 0) * 100),
    avgSessionDurationSec: Math.round(Number(overviewRow[4]?.value ?? 0)),
  };

  const socialSources = (sources.rows ?? [])
    .map((row) => {
      const source = row.dimensionValues?.[0]?.value ?? 'desconocido';
      const sessions = Number(row.metricValues?.[0]?.value ?? 0);
      const users = Number(row.metricValues?.[1]?.value ?? 0);
      const engagementRate = Math.round(Number(row.metricValues?.[2]?.value ?? 0) * 100);
      return {
        source,
        platform: mapSourceToPlatform(source),
        sessions,
        users,
        engagementRate,
      };
    })
    .filter((row) => row.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions);

  const dailyTrend = (daily.rows ?? []).slice(-14).map((row) => {
    const raw = row.dimensionValues?.[0]?.value ?? '';
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    const dateKey = `${y}-${m}-${d}`;
    const date = new Date(`${dateKey}T12:00:00`);
    return {
      dateKey,
      label: date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      users: Number(row.metricValues?.[1]?.value ?? 0),
    };
  });

  return {
    monthKey,
    mode: 'live',
    propertyId,
    fetchedAt: new Date().toISOString(),
    summary,
    socialSources,
    dailyTrend,
    openUrl: `https://analytics.google.com/analytics/web/#/p${propertyId}/reports/intelligenthome`,
  };
}

export async function getGaReport(monthKey) {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const credentials = parseCredentials();
  if (!propertyId || !credentials) {
    return buildDemoGaReport(monthKey);
  }
  try {
    return await runLiveReport(monthKey, propertyId, credentials);
  } catch (error) {
    const fallback = buildDemoGaReport(monthKey);
    return {
      ...fallback,
      mode: 'demo',
      error:
        error instanceof Error
          ? error.message
          : 'No se pudo leer Google Analytics. Mostrando datos demo.',
    };
  }
}
