import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
  colorForPlatform,
  labelForPlatform,
  SENTIMENT_OPTIONS,
  SOCIAL_PLATFORMS,
} from '../data/socialPlatforms';
import {
  buildDailyEngagementTrend,
  buildMonthSocialSummary,
  buildPlatformPie,
  buildPlatformStats,
  buildSentimentPie,
  engagementRate,
  entriesForMonth,
} from '../utils/socialMetrics';
import { formatMonthLabel, getMonthKey } from '../utils/performanceHistory';
import { PieChart } from './PieChart';
import type { ContentSentiment, SocialPlatform } from '../types';
import './CommunityView.css';

const SHOWCASE_PLATFORMS: SocialPlatform[] = ['tiktok', 'meta', 'instagram', 'youtube'];

function previewEngagement(views: number, likes: number, comments: number, shares: number): number {
  const interactions = likes + comments + shares;
  if (views <= 0) return interactions > 0 ? 100 : 0;
  return Math.min(100, Math.round((interactions / views) * 1000) / 10);
}

function PlatformGlyph({ platform }: { platform: SocialPlatform }) {
  const glyphs: Record<SocialPlatform, string> = {
    tiktok: '♪',
    meta: 'f',
    instagram: '◎',
    youtube: '▶',
    otro: '◇',
  };
  return <span className={`community-glyph community-glyph--${platform}`}>{glyphs[platform]}</span>;
}

function ChartEmpty({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="community-chart-empty">
      <span className="community-chart-empty-icon" aria-hidden>
        {icon}
      </span>
      <strong>{title}</strong>
      <p>{hint}</p>
    </div>
  );
}

export function CommunityView() {
  const { user, socialMetrics, addSocialEntry, deleteSocialEntry } = useApp();
  const toast = useToast();

  const currentMonth = getMonthKey();
  const [monthKey, setMonthKey] = useState(currentMonth);

  const [platform, setPlatform] = useState<SocialPlatform>('tiktok');
  const [title, setTitle] = useState('');
  const [dateKey, setDateKey] = useState(() => new Date().toISOString().slice(0, 10));
  const [views, setViews] = useState(0);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState(0);
  const [shares, setShares] = useState(0);
  const [sentiment, setSentiment] = useState<ContentSentiment>('regular');
  const [notes, setNotes] = useState('');

  const monthEntries = useMemo(
    () => entriesForMonth(socialMetrics, monthKey),
    [socialMetrics, monthKey],
  );

  const sentimentPie = useMemo(() => buildSentimentPie(monthEntries), [monthEntries]);
  const platformPie = useMemo(() => buildPlatformPie(monthEntries), [monthEntries]);
  const platformStats = useMemo(() => buildPlatformStats(monthEntries), [monthEntries]);
  const dailyTrend = useMemo(() => buildDailyEngagementTrend(monthEntries), [monthEntries]);
  const summary = useMemo(() => buildMonthSocialSummary(monthEntries), [monthEntries]);

  const showcaseStats = useMemo(() => {
    const map = new Map(platformStats.map((s) => [s.platform, s]));
    return SHOWCASE_PLATFORMS.map((p) => {
      const stat = map.get(p);
      return (
        stat ?? {
          platform: p,
          label: labelForPlatform(p),
          color: colorForPlatform(p),
          posts: 0,
          avgEngagement: 0,
          totalViews: 0,
          gustaPercent: 0,
        }
      );
    });
  }, [platformStats]);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>([currentMonth]);
    for (const e of socialMetrics.entries) keys.add(e.monthKey);
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [socialMetrics.entries, currentMonth]);

  const maxTrend = Math.max(8, ...dailyTrend.flatMap((d) => [d.tiktok, d.meta, d.instagram, d.other]));
  const hasTrendData = dailyTrend.some((d) => d.tiktok + d.meta + d.instagram + d.other > 0);
  const liveEngagement = previewEngagement(views, likes, comments, shares);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Escribe un título para la publicación.');
      return;
    }
    addSocialEntry({
      platform,
      title: title.trim(),
      dateKey,
      views,
      likes,
      comments,
      shares,
      sentiment,
      notes: notes.trim(),
    });
    setTitle('');
    setViews(0);
    setLikes(0);
    setComments(0);
    setShares(0);
    setNotes('');
    toast.success('Publicación registrada en Redes');
  };

  return (
    <div className="community-view">
      <header className="community-hero">
        <div className="community-hero-glow" aria-hidden />
        <div className="community-hero-inner">
          <div className="community-hero-copy">
            <span className="community-badge">Community Managers</span>
            <h1 className="community-title">Redes y contenido</h1>
            <p className="community-sub">
              Mide TikTok, Meta e Instagram en un solo lugar. ¿Está gustando? ¿Qué red rinde mejor?
              Registra cada pieza y el tablero se actualiza al instante.
            </p>
            <div className="community-hero-chips">
              {SHOWCASE_PLATFORMS.map((p) => (
                <span key={p} className={`community-chip community-chip--${p}`}>
                  <PlatformGlyph platform={p} />
                  {labelForPlatform(p)}
                </span>
              ))}
            </div>
          </div>
          <label className="community-month-picker">
            <span>Periodo</span>
            <select value={monthKey} onChange={(e) => setMonthKey(e.target.value)}>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                  {m === currentMonth ? ' (actual)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="community-kpis" aria-label="Resumen del mes">
        <article className="community-stat community-stat--posts">
          <span className="community-stat-icon" aria-hidden>
            ◫
          </span>
          <div>
            <strong>{summary.totalPosts}</strong>
            <span>Publicaciones</span>
          </div>
        </article>
        <article className="community-stat community-stat--gusta">
          <span className="community-stat-icon" aria-hidden>
            ♥
          </span>
          <div>
            <strong>{summary.gustaPercent}%</strong>
            <span>Está gustando</span>
            <div className="community-stat-bar">
              <div style={{ width: `${summary.gustaPercent}%` }} />
            </div>
          </div>
        </article>
        <article className="community-stat community-stat--engage">
          <span className="community-stat-icon" aria-hidden>
            ↗
          </span>
          <div>
            <strong>{summary.avgEngagement}%</strong>
            <span>Engagement prom.</span>
          </div>
        </article>
        <article className="community-stat community-stat--top">
          <span className="community-stat-icon" aria-hidden>
            ★
          </span>
          <div>
            <strong>{summary.topPlatform ? labelForPlatform(summary.topPlatform) : '—'}</strong>
            <span>Red más activa</span>
          </div>
        </article>
      </section>

      <div className="community-layout">
        <div className="community-main">
          <div className="community-charts-row">
            <section className="community-panel community-panel--chart">
              <div className="community-panel-head">
                <h2>¿El contenido está gustando?</h2>
                <p>Percepción del equipo CM este mes</p>
              </div>
              {sentimentPie.length === 0 ? (
                <ChartEmpty
                  icon="◐"
                  title="Sin datos de sentimiento"
                  hint="Registra publicaciones y marca cómo está rindiendo cada pieza."
                />
              ) : (
                <div className="community-pie-wrap">
                  <PieChart
                    slices={sentimentPie}
                    title="Sentimiento del contenido"
                    size={196}
                    centerValue={summary.gustaPercent}
                    centerSuffix="%"
                    centerLabel="gusta"
                    legendMode="share"
                  />
                </div>
              )}
            </section>

            <section className="community-panel community-panel--chart">
              <div className="community-panel-head">
                <h2>Publicaciones por red</h2>
                <p>Distribución entre plataformas</p>
              </div>
              {platformPie.length === 0 ? (
                <ChartEmpty
                  icon="◎"
                  title="Aún sin publicaciones"
                  hint="El pastel se llena al registrar contenido en TikTok, Meta o Instagram."
                />
              ) : (
                <div className="community-pie-wrap">
                  <PieChart
                    slices={platformPie}
                    title="Distribución por plataforma"
                    size={196}
                    centerValue={summary.totalPosts}
                    centerSuffix=""
                    centerLabel="posts"
                    legendMode="share"
                  />
                </div>
              )}
            </section>
          </div>

          <section className="community-panel">
            <div className="community-panel-head">
              <h2>Rendimiento por plataforma</h2>
              <p>Comparativa de engagement y alcance</p>
            </div>
            <div className="community-platform-grid">
              {showcaseStats.map((p) => (
                <article
                  key={p.platform}
                  className={`community-platform-card community-platform-card--${p.platform}`}
                  style={{ '--platform-color': p.color } as CSSProperties}
                >
                  <div className="community-platform-card-top">
                    <PlatformGlyph platform={p.platform} />
                    <h3>{p.label}</h3>
                    <span className="community-platform-posts">{p.posts} posts</span>
                  </div>
                  <p className="community-platform-engagement">
                    <strong>{p.avgEngagement}%</strong>
                    <span>engagement</span>
                  </p>
                  <div className="community-platform-metrics">
                    <span>{p.totalViews.toLocaleString('es-MX')} vistas</span>
                    <span>{p.gustaPercent}% gusta</span>
                  </div>
                  <div className="community-platform-bar">
                    <div style={{ width: `${Math.max(p.avgEngagement, p.posts > 0 ? 4 : 0)}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="community-panel community-panel--trend">
            <div className="community-panel-head">
              <h2>Engagement día a día</h2>
              <p>Últimos 14 días — picos = mejor rendimiento</p>
            </div>
            <div className="community-trend-wrap">
              {!hasTrendData && (
                <div className="community-trend-overlay">
                  <span>Registra publicaciones para ver la tendencia</span>
                </div>
              )}
              <div
                className="community-trend-chart"
                role="img"
                aria-label="Tendencia diaria por red"
              >
                {dailyTrend.map((day) => {
                  const total = day.tiktok + day.meta + day.instagram + day.other;
                  return (
                    <div key={day.dateKey} className="community-trend-col">
                      <div className="community-trend-bars">
                        {day.tiktok > 0 && (
                          <div
                            className="community-trend-bar community-trend-bar--tiktok"
                            style={{ height: `${(day.tiktok / maxTrend) * 100}%` }}
                            title={`TikTok ${day.tiktok}%`}
                          />
                        )}
                        {day.meta > 0 && (
                          <div
                            className="community-trend-bar community-trend-bar--meta"
                            style={{ height: `${(day.meta / maxTrend) * 100}%` }}
                            title={`Meta ${day.meta}%`}
                          />
                        )}
                        {day.instagram > 0 && (
                          <div
                            className="community-trend-bar community-trend-bar--ig"
                            style={{ height: `${(day.instagram / maxTrend) * 100}%` }}
                            title={`Instagram ${day.instagram}%`}
                          />
                        )}
                        {total === 0 && <div className="community-trend-bar community-trend-bar--ghost" />}
                      </div>
                      <span className="community-trend-label">{day.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="community-trend-legend">
              <span>
                <i className="dot tiktok" /> TikTok
              </span>
              <span>
                <i className="dot meta" /> Meta
              </span>
              <span>
                <i className="dot ig" /> Instagram
              </span>
            </div>
          </section>

          <section className="community-panel">
            <div className="community-panel-head">
              <h2>Detalle del mes</h2>
              <p>{monthEntries.length} publicaciones en {formatMonthLabel(monthKey)}</p>
            </div>
            {monthEntries.length === 0 ? (
              <ChartEmpty
                icon="▤"
                title="Nada registrado aún"
                hint="Usa el formulario de la derecha para añadir tu primera publicación."
              />
            ) : (
              <ul className="community-entry-list">
                {monthEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className={`community-entry community-entry--${entry.platform}`}
                    style={
                      { '--platform-color': colorForPlatform(entry.platform) } as CSSProperties
                    }
                  >
                    <div className="community-entry-head">
                      <PlatformGlyph platform={entry.platform} />
                      <span
                        className={`community-sentiment community-sentiment--${entry.sentiment}`}
                      >
                        {SENTIMENT_OPTIONS.find((s) => s.value === entry.sentiment)?.label}
                      </span>
                      <span className="community-entry-date">{entry.dateKey}</span>
                    </div>
                    <strong className="community-entry-title">{entry.title}</strong>
                    <p className="community-entry-stats">
                      <span>{entry.views.toLocaleString('es-MX')} vistas</span>
                      <span>{entry.likes} likes</span>
                      <span className="community-entry-engage">{engagementRate(entry)}% eng.</span>
                    </p>
                    {entry.notes && <p className="community-entry-notes">{entry.notes}</p>}
                    <footer className="community-entry-foot">
                      <span>Por {entry.createdByName}</span>
                      {(user?.id === entry.createdById ||
                        user?.role === 'admin' ||
                        user?.role === 'lider') && (
                        <button
                          type="button"
                          className="btn-ghost community-entry-delete"
                          onClick={() => {
                            deleteSocialEntry(entry.id);
                            toast.info('Publicación eliminada');
                          }}
                        >
                          Eliminar
                        </button>
                      )}
                    </footer>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="community-sidebar">
          <section className="community-form-card">
            <div className="community-panel-head">
              <h2>Registrar publicación</h2>
              <p>Nueva pieza de contenido</p>
            </div>

            <div className="community-live-preview">
              <span>Engagement estimado</span>
              <strong>{liveEngagement}%</strong>
            </div>

            <form className="community-form" onSubmit={handleSubmit}>
              <fieldset className="community-fieldset">
                <legend>Red social</legend>
                <div className="community-platform-picks">
                  {SOCIAL_PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      className={`community-platform-pick community-platform-pick--${p.value}${platform === p.value ? ' is-active' : ''}`}
                      onClick={() => setPlatform(p.value)}
                      title={p.label}
                    >
                      <PlatformGlyph platform={p.value} />
                      <span>{p.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label>
                Título / pieza
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Reel producto marzo"
                  required
                />
              </label>

              <label>
                Fecha
                <input
                  type="date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  required
                />
              </label>

              <div className="community-metrics-grid">
                <label>
                  Vistas
                  <input
                    type="number"
                    min={0}
                    value={views || ''}
                    placeholder="0"
                    onChange={(e) => setViews(Number(e.target.value) || 0)}
                  />
                </label>
                <label>
                  Likes
                  <input
                    type="number"
                    min={0}
                    value={likes || ''}
                    placeholder="0"
                    onChange={(e) => setLikes(Number(e.target.value) || 0)}
                  />
                </label>
                <label>
                  Comentarios
                  <input
                    type="number"
                    min={0}
                    value={comments || ''}
                    placeholder="0"
                    onChange={(e) => setComments(Number(e.target.value) || 0)}
                  />
                </label>
                <label>
                  Compartidos
                  <input
                    type="number"
                    min={0}
                    value={shares || ''}
                    placeholder="0"
                    onChange={(e) => setShares(Number(e.target.value) || 0)}
                  />
                </label>
              </div>

              <fieldset className="community-fieldset">
                <legend>¿Cómo está rindiendo?</legend>
                <div className="community-sentiment-picks">
                  {SENTIMENT_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={`community-sentiment-pick community-sentiment-pick--${s.value}${sentiment === s.value ? ' is-active' : ''}`}
                      style={{ '--sentiment-color': s.color } as CSSProperties}
                      onClick={() => setSentiment(s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label>
                Notas
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observaciones, aprendizajes, próximos pasos…"
                />
              </label>

              <button type="submit" className="btn-primary community-submit">
                Guardar publicación
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
