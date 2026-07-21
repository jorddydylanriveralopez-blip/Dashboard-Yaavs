/**
 * Meta Marketing API — lectura de campañas e insights para el panel Redes.
 * Credenciales solo por env: META_ACCESS_TOKEN, META_AD_ACCOUNT_ID.
 */

function apiVersion() {
  return process.env.META_API_VERSION || 'v21.0';
}

function adAccountId() {
  const raw = process.env.META_AD_ACCOUNT_ID || '';
  return raw.replace(/^act_/i, '').trim();
}

function accessToken() {
  return (process.env.META_ACCESS_TOKEN || '').trim();
}

export function isMetaConfigured() {
  return Boolean(accessToken() && adAccountId());
}

function graphBase() {
  return `https://graph.facebook.com/${apiVersion()}`;
}

async function graphGet(path, params = {}) {
  const url = new URL(`${graphBase()}${path}`);
  url.searchParams.set('access_token', accessToken());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url.toString(), { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `Meta API ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = data?.error?.code;
    throw err;
  }
  return data;
}

function centsToCurrency(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // daily_budget en Marketing API viene en centavos de la moneda de la cuenta
  return n / 100;
}

function pickPrimaryResult(insights) {
  const actions = Array.isArray(insights?.actions) ? insights.actions : [];
  const costs = Array.isArray(insights?.cost_per_action_type)
    ? insights.cost_per_action_type
    : [];
  if (!actions.length) {
    return { resultType: null, results: null, costPerResult: null };
  }
  // Preferir métricas típicas de tráfico / mensajes / compras
  const preferred = [
    'link_click',
    'landing_page_view',
    'omni_landing_page_view',
    'onsite_conversion.messaging_conversation_started_7d',
    'messaging_conversation_started_7d',
    'lead',
    'purchase',
    'omni_purchase',
  ];
  let best = actions[0];
  for (const type of preferred) {
    const match = actions.find((a) => a.action_type === type);
    if (match) {
      best = match;
      break;
    }
  }
  const cost = costs.find((c) => c.action_type === best.action_type);
  return {
    resultType: best.action_type,
    results: Number(best.value) || 0,
    costPerResult: cost ? Number(cost.value) : null,
  };
}

function labelForActionType(type) {
  if (!type) return null;
  const map = {
    link_click: 'Clics al enlace',
    landing_page_view: 'Visitas a la página',
    omni_landing_page_view: 'Visitas a la página',
    'onsite_conversion.messaging_conversation_started_7d': 'Contactos de mensajes',
    messaging_conversation_started_7d: 'Contactos de mensajes',
    lead: 'Leads',
    purchase: 'Compras',
    omni_purchase: 'Compras',
    page_engagement: 'Interacciones',
    post_engagement: 'Interacciones',
    video_view: 'Reproducciones de video',
  };
  return map[type] || type.replace(/_/g, ' ');
}

function defaultDateRange(days = 30) {
  const until = new Date();
  const since = new Date();
  since.setDate(until.getDate() - (days - 1));
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}

/**
 * Lista campañas del Ad Account con insights del rango indicado.
 */
export async function fetchMetaCampaigns({ since, until, days } = {}) {
  if (!isMetaConfigured()) {
    return {
      ok: false,
      configured: false,
      error: 'Meta Ads no está configurado. Faltan META_ACCESS_TOKEN o META_AD_ACCOUNT_ID.',
      campaigns: [],
      summary: null,
    };
  }

  const range =
    since && until
      ? { since, until }
      : defaultDateRange(typeof days === 'number' ? days : 30);
  const act = `act_${adAccountId()}`;

  const campaignsRes = await graphGet(`/${act}/campaigns`, {
    fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,objective',
    limit: 100,
    filtering: JSON.stringify([
      {
        field: 'effective_status',
        operator: 'IN',
        value: ['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'WITH_ISSUES'],
      },
    ]),
  });

  const campaigns = Array.isArray(campaignsRes.data) ? campaignsRes.data : [];

  // Insights a nivel cuenta (rápido) + por campaña en paralelo (limitado)
  const timeRange = JSON.stringify({ since: range.since, until: range.until });
  const insightFields =
    'campaign_id,campaign_name,spend,impressions,reach,actions,cost_per_action_type';

  let accountInsights = null;
  try {
    const acc = await graphGet(`/${act}/insights`, {
      fields: 'spend,impressions,reach',
      time_range: timeRange,
      level: 'account',
    });
    accountInsights = acc.data?.[0] ?? null;
  } catch {
    accountInsights = null;
  }

  const insightByCampaign = new Map();
  try {
    const allInsights = await graphGet(`/${act}/insights`, {
      fields: insightFields,
      time_range: timeRange,
      level: 'campaign',
      limit: 100,
    });
    for (const row of allInsights.data ?? []) {
      if (row.campaign_id) insightByCampaign.set(row.campaign_id, row);
    }
  } catch {
    // Si falla el batch, seguimos solo con datos de campaña
  }

  const normalized = campaigns.map((c) => {
    const insight = insightByCampaign.get(c.id) ?? null;
    const result = pickPrimaryResult(insight);
    const spend = insight?.spend != null ? Number(insight.spend) : 0;
    const impressions = insight?.impressions != null ? Number(insight.impressions) : 0;
    const reach = insight?.reach != null ? Number(insight.reach) : 0;
    const effective = (c.effective_status || c.status || '').toUpperCase();
    const isActive = effective === 'ACTIVE';

    return {
      id: c.id,
      name: c.name || 'Sin nombre',
      status: effective || 'UNKNOWN',
      isActive,
      objective: c.objective || null,
      dailyBudget: centsToCurrency(c.daily_budget),
      lifetimeBudget: centsToCurrency(c.lifetime_budget),
      spend,
      impressions,
      reach,
      results: result.results,
      resultType: result.resultType,
      resultLabel: labelForActionType(result.resultType),
      costPerResult: result.costPerResult,
      adsManagerUrl: `https://www.facebook.com/adsmanager/manage/campaigns?act=${adAccountId()}&selected_campaign_ids=${c.id}`,
    };
  });

  // Orden: activas primero, luego por gasto desc
  normalized.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return (b.spend || 0) - (a.spend || 0);
  });

  const summary = {
    spend: accountInsights?.spend != null
      ? Number(accountInsights.spend)
      : normalized.reduce((s, c) => s + (c.spend || 0), 0),
    impressions: accountInsights?.impressions != null
      ? Number(accountInsights.impressions)
      : normalized.reduce((s, c) => s + (c.impressions || 0), 0),
    reach: accountInsights?.reach != null
      ? Number(accountInsights.reach)
      : normalized.reduce((s, c) => s + (c.reach || 0), 0),
    activeCampaigns: normalized.filter((c) => c.isActive).length,
    totalCampaigns: normalized.length,
  };

  return {
    ok: true,
    configured: true,
    adAccountId: adAccountId(),
    since: range.since,
    until: range.until,
    currency: 'MXN',
    summary,
    campaigns: normalized,
  };
}
