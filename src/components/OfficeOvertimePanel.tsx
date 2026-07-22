import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useSharedNow } from '../hooks/useSharedNow';
import {
  canUseOfficeOvertime,
  formatOvertimeClock,
  formatOvertimeShort,
  isOvertimeRunning,
  liveOvertimeSeconds,
} from '../utils/officeOvertime';
import './OfficeOvertimePanel.css';

interface Props {
  /** Vista del colaborador (controles) o solo lectura para Orlando. */
  mode: 'self' | 'team';
  compact?: boolean;
}

export function OfficeOvertimePanel({ mode, compact }: Props) {
  const {
    user,
    activeUsers,
    officeOvertime,
    startOfficeOvertime,
    stopOfficeOvertime,
  } = useApp();
  const toast = useToast();
  const now = useSharedNow(true);

  if (mode === 'self') {
    const employeeId = user?.employeeId;
    if (!canUseOfficeOvertime(employeeId)) return null;
    const entry = officeOvertime[employeeId!];
    const running = isOvertimeRunning(entry);
    const seconds = liveOvertimeSeconds(entry, now);

    return (
      <section
        className={`office-ot${compact ? ' office-ot--compact' : ''}${running ? ' office-ot--running' : ''}`}
        aria-label="Tiempo extra en oficina"
      >
        <div className="office-ot-copy">
          <span className="office-ot-label">Tiempo extra hoy</span>
          <strong className="office-ot-clock" aria-live="polite">
            {formatOvertimeClock(seconds)}
          </strong>
          <span className="office-ot-hint">
            {running
              ? 'Cronómetro activo — marca cuánto te quedaste de más'
              : 'Inicia al quedarte después de tu horario'}
          </span>
        </div>
        <div className="office-ot-actions">
          {running ? (
            <button
              type="button"
              className="btn-primary office-ot-btn"
              onClick={() => {
                if (stopOfficeOvertime()) toast.success('Tiempo extra guardado');
              }}
            >
              Detener
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary office-ot-btn"
              onClick={() => {
                if (startOfficeOvertime()) toast.success('Cronómetro iniciado');
                else toast.info('No se pudo iniciar el cronómetro');
              }}
            >
              Iniciar
            </button>
          )}
        </div>
      </section>
    );
  }

  const rows = activeUsers
    .filter((u) => canUseOfficeOvertime(u.employeeId))
    .map((u) => {
      const entry = officeOvertime[u.employeeId!];
      const seconds = liveOvertimeSeconds(entry, now);
      const running = isOvertimeRunning(entry);
      return {
        id: u.employeeId!,
        name: u.name,
        seconds,
        running,
      };
    })
    .filter((r) => r.seconds > 0 || r.running)
    .sort((a, b) => b.seconds - a.seconds);

  if (rows.length === 0) {
    return (
      <section className={`office-ot office-ot--team${compact ? ' office-ot--compact' : ''}`}>
        <div className="office-ot-copy">
          <span className="office-ot-label">Tiempo extra del equipo</span>
          <p className="office-ot-empty">Nadie ha marcado tiempo extra hoy.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`office-ot office-ot--team${compact ? ' office-ot--compact' : ''}`}
      aria-label="Tiempo extra del equipo"
    >
      <div className="office-ot-copy">
        <span className="office-ot-label">Tiempo extra del equipo</span>
        <p className="office-ot-hint">Cuánto se quedaron hoy (excepto Orlando).</p>
      </div>
      <ul className="office-ot-team-list">
        {rows.map((row) => (
          <li key={row.id} className={row.running ? 'office-ot-team-row--live' : undefined}>
            <strong>{row.name}</strong>
            <span className="office-ot-team-time">
              {formatOvertimeClock(row.seconds)}
              {row.running ? ' · en curso' : ` · ${formatOvertimeShort(row.seconds)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
