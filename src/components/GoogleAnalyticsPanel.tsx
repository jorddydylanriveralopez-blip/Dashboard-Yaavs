import { useEffect, useMemo, useState } from 'react';
import { colorForPlatform } from '../data/socialPlatforms';
import {
  fetchGoogleAnalyticsReport,
  formatGaDuration,
  gaSourceLabel,
  loadCachedGaReport,
  type GoogleAnalyticsReport,
} from '../utils/googleAnalytics';
import './GoogleAnalyticsPanel.css';

interface Props {
  monthKey: string;
}

export function GoogleAnalyticsPanel({ monthKey }: Props) {
  const [report, setReport] = useState<GoogleAnalyticsReport | null>(() =>
    loadCachedGaReport(monthKey),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReport(loadCachedGaReport(monthKey));
    setError(null);
  }, [monthKey]);

  const maxSessions = useMemo(
    () => Math.max(8, ...(report?.dailyTrend.map((d) => d.sessions) ?? [0])),
    [report],
  );

  const sync = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchGoogleAnalyticsReport(monthKey);
      setReport(next);
      if (next.error) setError(next.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar Google Analytics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="community-panel community-panel--ga">
      <div className="community-panel-head ga-panel-head">
        <div>
          <h2>Google Analytics</h2>
          <p>
            Tráfico real de tus redes y visitas al sitio. Conecta GA4 para ver sesiones, usuarios y
            engagement.
          </p>
        </div>
        <div className="ga-panel-actions">
          <button type="button" className="btn-primary btn-sm" onClick={sync} disabled={loading}>
            {loading ? 'Sincronizando…' : 'Sincronizar GA'}
          </button>
          {report?.openUrl && (
            <a
              className="btn-ghost btn-sm"
              href={report.openUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir Analytics →
            </a>
          )}
        </div>
      </div>

      <div className={`ga-status ga-status--${report?.mode ?? 'idle'}`}>
        {report?.mode === 'live' ? (
          <span>Conectado a GA4 {report.propertyId ? `· propiedad ${report.propertyId}` : ''}</span>
        ) : report ? (
          <span>
            Modo demo — configura <code>GA4_PROPERTY_ID</code> y{' '}
            <code>GA4_SERVICE_ACCOUNT_JSON</code> en el servidor para datos reales.
          </span>
        ) : (
          <span>Pulsa sincronizar para cargar métricas de Google Analytics.</span>
        )}
        {report?.fetchedAt && (
          <time dateTime={report.fetchedAt}>
            Última sync:{' '}
            {new Date(report.fetchedAt).toLocaleString('es-MX', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        )}
      </div>

      {error && <p className="ga-error">{error}</p>}

      {!report ? (
        <div className="ga-empty">
          <strong>Sin datos de Analytics todavía</strong>
          <p>Usa el botón de arriba para traer visitas, usuarios y tráfico social del mes.</p>
        </div>
      ) : (
        <>
          <div className="ga-kpis">
            <article>
              <strong>{report.summary.users.toLocaleString('es-MX')}</strong>
              <span>Usuarios</span>
            </article>
            <article>
              <strong>{report.summary.sessions.toLocaleString('es-MX')}</strong>
              <span>Sesiones</span>
            </article>
            <article>
              <strong>{report.summary.pageViews.toLocaleString('es-MX')}</strong>
              <span>Páginas vistas</span>
            </article>
            <article>
              <strong>{report.summary.engagementRate}%</strong>
              <span>Engagement</span>
            </article>
            <article>
              <strong>{formatGaDuration(report.summary.avgSessionDurationSec)}</strong>
              <span>Tiempo prom.</span>
            </article>
          </div>

          <div className="ga-grid">
            <div className="ga-block">
              <h3>Tráfico desde redes</h3>
              {report.socialSources.length === 0 ? (
                <p className="ga-muted">Sin tráfico social registrado en este periodo.</p>
              ) : (
                <ul className="ga-source-list">
                  {report.socialSources.map((row) => (
                    <li key={row.source}>
                      <div className="ga-source-top">
                        <span
                          className="ga-source-dot"
                          style={{
                            background:
                              row.platform === 'otro'
                                ? '#94a3b8'
                                : colorForPlatform(row.platform),
                          }}
                        />
                        <strong>{gaSourceLabel(row)}</strong>
                        <em>{row.sessions.toLocaleString('es-MX')} sesiones</em>
                      </div>
                      <div className="ga-source-meta">
                        <span>{row.users.toLocaleString('es-MX')} usuarios</span>
                        <span>{row.engagementRate}% engagement</span>
                      </div>
                      <div className="ga-source-bar">
                        <div
                          style={{
                            width: `${Math.max(
                              8,
                              Math.round(
                                (row.sessions /
                                  Math.max(
                                    ...report.socialSources.map((s) => s.sessions),
                                    1,
                                  )) *
                                  100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="ga-block">
              <h3>Sesiones por día</h3>
              <div className="ga-trend" role="img" aria-label="Tendencia de sesiones GA">
                {report.dailyTrend.map((day, i) => (
                  <div key={day.dateKey} className="ga-trend-col">
                    <div
                      className="ga-trend-bar chart-bar-rise"
                      style={{
                        height: `${(day.sessions / maxSessions) * 100}%`,
                        ['--bar-i' as string]: i,
                      }}
                      title={`${day.sessions} sesiones`}
                    />
                    <span>{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
