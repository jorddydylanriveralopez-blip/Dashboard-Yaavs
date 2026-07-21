import type { PanoramaMonthlyTrendRow } from '../utils/panoramaMonthlyTrend';
import { formatTrendDelta } from '../utils/panoramaMonthlyTrend';
import './PanoramaMonthlyTrendTable.css';

interface Props {
  rows: PanoramaMonthlyTrendRow[];
}

export function PanoramaMonthlyTrendTable({ rows }: Props) {
  const withData = rows.filter((r) => r.hasData);
  if (withData.length === 0) return null;

  return (
    <section className="pulse-section panorama-monthly-trend" aria-label="Evolución mensual">
      <h2>Evolución mensual del equipo</h2>
      <p className="pulse-section-sub">
        Comparativo mes a mes: avance promedio, cuánto mejoramos y áreas de oportunidad para
        seguir creciendo.
      </p>

      <div className="panorama-trend-table-wrap">
        <table className="panorama-trend-table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Avance promedio</th>
              <th>Mejora del mes</th>
              <th>Vs mes anterior</th>
              <th>¿Mejoramos?</th>
              <th>Fortalezas</th>
              <th>Áreas de oportunidad</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.monthKey}
                className={[
                  !row.hasData ? 'is-empty' : '',
                  row.isCurrentMonth ? 'is-current' : '',
                  row.improved === true ? 'is-improved' : '',
                  row.improved === false ? 'is-declined' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <th scope="row" className="panorama-trend-month">
                  {row.shortMonthLabel}
                  {row.isCurrentMonth && (
                    <span className="panorama-trend-badge">En curso</span>
                  )}
                </th>
                <td>
                  {row.teamAvg !== null ? (
                    <strong>{row.teamAvg}%</strong>
                  ) : (
                    <span className="panorama-trend-muted">Sin datos</span>
                  )}
                </td>
                <td>
                  {row.monthImprovement !== null ? (
                    <span
                      className={
                        row.monthImprovement > 0
                          ? 'panorama-trend-up'
                          : row.monthImprovement < 0
                            ? 'panorama-trend-down'
                            : ''
                      }
                    >
                      {formatTrendDelta(row.monthImprovement)}
                    </span>
                  ) : (
                    <span className="panorama-trend-muted">—</span>
                  )}
                </td>
                <td>
                  {row.vsPreviousMonth !== null ? (
                    <span
                      className={
                        row.vsPreviousMonth > 0
                          ? 'panorama-trend-up'
                          : row.vsPreviousMonth < 0
                            ? 'panorama-trend-down'
                            : ''
                      }
                    >
                      {formatTrendDelta(row.vsPreviousMonth)}
                    </span>
                  ) : (
                    <span className="panorama-trend-muted">—</span>
                  )}
                </td>
                <td>
                  {row.improved === null ? (
                    <span className="panorama-trend-muted">—</span>
                  ) : row.improved ? (
                    <span className="panorama-trend-pill panorama-trend-pill--yes">Sí</span>
                  ) : row.vsPreviousMonth === 0 ? (
                    <span className="panorama-trend-pill panorama-trend-pill--flat">Igual</span>
                  ) : (
                    <span className="panorama-trend-pill panorama-trend-pill--no">No</span>
                  )}
                </td>
                <td>
                  {row.strengths.length > 0 ? (
                    <ul className="panorama-trend-list panorama-trend-list--good">
                      {row.strengths.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="panorama-trend-muted">
                      {row.hasData ? 'Sin destacados' : '—'}
                    </span>
                  )}
                </td>
                <td>
                  {row.opportunities.length > 0 ? (
                    <ul className="panorama-trend-list panorama-trend-list--warn">
                      {row.opportunities.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="panorama-trend-muted">
                      {row.hasData ? 'Sin alertas' : '—'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
