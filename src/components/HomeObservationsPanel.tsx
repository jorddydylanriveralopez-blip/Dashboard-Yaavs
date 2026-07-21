import type { PanoramaMemberDetail } from '../utils/panoramaDetail';
import type { PersonalObservation } from '../utils/personalObservations';
import { MemberDetailSections } from './PanoramaTeamBreakdown';
import { ManagerObservationBlock } from './ManagerObservationBlock';
import { getMonthKey } from '../utils/performanceHistory';
import './HomeObservationsPanel.css';
import './PanoramaTeamBreakdown.css';
import './ManagerObservationBlock.css';

interface PersonalProps {
  mode: 'personal';
  observation: PersonalObservation;
  compact?: boolean;
}

interface TeamProps {
  mode: 'team';
  members: PanoramaMemberDetail[];
}

type Props = PersonalProps | TeamProps;

export function HomeObservationsPanel(props: Props) {
  if (props.mode === 'personal') {
    return <PersonalObservations observation={props.observation} compact={props.compact} />;
  }
  return <TeamObservations members={props.members} />;
}

function PersonalObservations({
  observation: o,
  compact = false,
}: {
  observation: PersonalObservation;
  compact?: boolean;
}) {
  const monthKey = getMonthKey();

  return (
    <section
      className={`home-observations home-observations--personal${compact ? ' home-observations--compact' : ''}`}
      aria-label="Tus observaciones"
    >
      <header className="home-observations-head">
        <div>
          <h2>{compact ? 'Tu mes' : 'Tus observaciones del mes'}</h2>
          {!compact && (
            <p>Resumen claro de cómo vas, qué haces bien y en qué puedes mejorar.</p>
          )}
        </div>
        <div className="home-observations-score">
          <strong>{o.kpiPercent}</strong>
          <span>de 100 · avance</span>
        </div>
      </header>

      <div className="home-observations-metrics">
        <Metric
          label="Entregas"
          value={`${o.projectsOnTime}/${o.projectsCompletedMonth} a tiempo`}
          note={
            o.undeliveredProjects.length > 0
              ? `${o.undeliveredProjects.length} sin entregar`
              : o.projectsLate > 0
                ? `${o.projectsLate} fuera de plazo`
                : o.projectsCompletedMonth > 0
                  ? 'Bien en fechas'
                  : 'Sin cierres aún'
          }
        />
        <Metric
          label="Horas"
          value={`${o.trackedHours}h / ${o.estimatedHours}h`}
          note={
            o.projectsHoursExceeded > 0
              ? `${o.projectsHoursExceeded} proyecto(s) exceden`
              : 'Dentro de presupuesto'
          }
        />
        <Metric
          label="Asistencia"
          value={`${o.attendanceRate}%`}
          note={
            o.attendanceIssues.length > 0
              ? `${o.attendanceIssues.length} incidencia(s) este mes`
              : `✓ ${o.attendancePresent} días presente`
          }
        />
        <Metric
          label="Ritmo"
          value={`${o.daysUp}↑ ${o.daysDown}↓`}
          note={o.semaphoreMessage}
        />
      </div>

      {!compact && <MemberDetailSections m={o} personal />}

      <ManagerObservationBlock
        employeeId={o.employeeId}
        employeeName={o.employeeName}
        monthKey={monthKey}
        personal
        compact={compact}
      />

      {!compact && o.strengths.length > 0 && (
        <div className="home-observations-block home-observations-block--good">
          <h3>Tus fortalezas</h3>
          <ul>
            {o.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {!compact && o.improvements.length > 0 && (
        <div className="home-observations-block home-observations-block--warn">
          <h3>En qué has estado mal o puedes mejorar</h3>
          <ul>
            {o.improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {o.tips.length > 0 && (
        <div className="home-observations-block home-observations-block--tips">
          <h3>{compact ? 'Mejorar' : 'Cómo mejorar'}</h3>
          <ul>
            {(compact ? o.tips.slice(0, 2) : o.tips).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TeamObservations({ members }: { members: PanoramaMemberDetail[] }) {
  if (members.length === 0) return null;
  const monthKey = getMonthKey();

  return (
    <section className="home-observations home-observations--team" aria-label="Observaciones del equipo">
      <header className="home-observations-head">
        <div>
          <h2>Observaciones del equipo</h2>
          <p>Fortalezas, áreas de mejora y notas personalizadas de cada colaborador este mes.</p>
        </div>
      </header>

      <div className="home-observations-team-list">
        {members.map((m) => (
          <article
            key={m.employeeId}
            className={`home-observations-team-card home-observations-team-card--${m.semaphoreLevel}`}
          >
            <header>
              <span className="home-observations-dot" style={{ background: m.color }} />
              <div>
                <strong>{m.employeeName}</strong>
                {m.position && <span>{m.position}</span>}
              </div>
              <em>{m.kpiPercent} de 100</em>
            </header>

            <div className="home-observations-team-stats">
              <span>{m.projectsOnTime}/{m.projectsCompletedMonth} a tiempo</span>
              <span>{m.trackedHours}h / {m.estimatedHours}h</span>
              <span>Asistencia {m.attendanceRate}%</span>
            </div>

            {m.strengths.length > 0 && (
              <div className="home-observations-mini home-observations-mini--good">
                <strong>Fortalezas</strong>
                <ul>
                  {m.strengths.slice(0, 2).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {m.improvements.length > 0 && (
              <div className="home-observations-mini home-observations-mini--warn">
                <strong>A mejorar</strong>
                <ul>
                  {m.improvements.slice(0, 2).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            <ManagerObservationBlock
              employeeId={m.employeeId}
              employeeName={m.employeeName}
              monthKey={monthKey}
              compact
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="home-observations-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{note}</em>
    </div>
  );
}
