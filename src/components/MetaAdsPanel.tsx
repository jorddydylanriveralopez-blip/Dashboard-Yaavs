import { useCallback, useEffect, useState } from 'react';
import {
  fetchMetaCampaigns,
  formatMetaMoney,
  formatMetaNumber,
  type MetaCampaignsResponse,
  type MetaRangePreset,
} from '../api/metaAds';

const RANGE_OPTIONS: { value: MetaRangePreset; label: string }[] = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 'month', label: 'Mes actual' },
];

export function MetaAdsPanel() {
  const [range, setRange] = useState<MetaRangePreset>(30);
  const [data, setData] = useState<MetaCampaignsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (preset: MetaRangePreset) => {
    setLoading(true);
    const result = await fetchMetaCampaigns(preset);
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  const currency = data?.currency ?? 'MXN';
  const summary = data?.summary;

  return (
    <section className="community-panel meta-ads-panel" aria-label="Campañas Meta Ads">
      <div className="meta-ads-header">
        <div className="community-panel-head">
          <h2>Campañas Meta Ads</h2>
          <p>
            Métricas en vivo del Administrador de anuncios
            {data?.adAccountId ? ` · cuenta ${data.adAccountId}` : ''}.
          </p>
        </div>
        <div className="meta-ads-controls">
          <label className="meta-ads-range">
            <span className="visually-hidden">Periodo</span>
            <select
              value={String(range)}
              onChange={(e) => {
                const v = e.target.value;
                setRange(v === 'month' ? 'month' : (Number(v) as 7 | 30));
              }}
              disabled={loading}
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={loading}
            onClick={() => void load(range)}
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {loading && !data && (
        <p className="meta-ads-status">Cargando campañas de Meta…</p>
      )}

      {data && !data.configured && (
        <div className="meta-ads-setup">
          <strong>Falta conectar Meta Ads</strong>
          <p>
            En Vercel agrega <code>META_AD_ACCOUNT_ID</code> (ej. 767897578413309) y{' '}
            <code>META_ACCESS_TOKEN</code> (System User con permiso <code>ads_read</code>).
            Luego vuelve a desplegar. Hasta entonces el resto de Redes sigue funcionando.
          </p>
        </div>
      )}

      {data?.configured && data.error && (
        <p className="meta-ads-error" role="alert">
          {data.error}
        </p>
      )}

      {data?.configured && data.ok && summary && (
        <>
          <div className="meta-ads-summary" aria-label="Resumen Meta Ads">
            <article>
              <span>Gastado</span>
              <strong>{formatMetaMoney(summary.spend, currency)}</strong>
            </article>
            <article>
              <span>Impresiones</span>
              <strong>{formatMetaNumber(summary.impressions)}</strong>
            </article>
            <article>
              <span>Alcance</span>
              <strong>{formatMetaNumber(summary.reach)}</strong>
            </article>
            <article>
              <span>Activas</span>
              <strong>
                {summary.activeCampaigns}/{summary.totalCampaigns}
              </strong>
            </article>
          </div>

          {data.since && data.until && (
            <p className="meta-ads-period">
              Periodo: {data.since} → {data.until}
            </p>
          )}

          {data.campaigns.length === 0 ? (
            <p className="meta-ads-status">No hay campañas en este periodo.</p>
          ) : (
            <div className="meta-ads-table-wrap">
              <table className="meta-ads-table">
                <thead>
                  <tr>
                    <th>Campaña</th>
                    <th>Estado</th>
                    <th>Resultados</th>
                    <th>Costo / result.</th>
                    <th>Presupuesto</th>
                    <th>Gastado</th>
                    <th>Impresiones</th>
                    <th>Alcance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((c) => (
                    <tr key={c.id} className={c.isActive ? 'meta-ads-row--active' : undefined}>
                      <td>
                        <strong className="meta-ads-name">{c.name}</strong>
                      </td>
                      <td>
                        <span
                          className={`meta-ads-pill ${c.isActive ? 'meta-ads-pill--on' : 'meta-ads-pill--off'}`}
                        >
                          {c.isActive ? 'Activa' : statusLabel(c.status)}
                        </span>
                      </td>
                      <td>
                        {c.results != null ? (
                          <>
                            <strong>{formatMetaNumber(c.results)}</strong>
                            {c.resultLabel && (
                              <span className="meta-ads-muted"> {c.resultLabel}</span>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{formatMetaMoney(c.costPerResult, currency)}</td>
                      <td>
                        {c.dailyBudget != null
                          ? `${formatMetaMoney(c.dailyBudget, currency)}/día`
                          : c.lifetimeBudget != null
                            ? formatMetaMoney(c.lifetimeBudget, currency)
                            : '—'}
                      </td>
                      <td>{formatMetaMoney(c.spend, currency)}</td>
                      <td>{formatMetaNumber(c.impressions)}</td>
                      <td>{formatMetaNumber(c.reach)}</td>
                      <td>
                        <a
                          className="meta-ads-link"
                          href={c.adsManagerUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PAUSED: 'Pausada',
    CAMPAIGN_PAUSED: 'Pausada',
    WITH_ISSUES: 'Con problemas',
    ARCHIVED: 'Archivada',
    DELETED: 'Eliminada',
  };
  return map[status] || status || 'Pausada';
}
