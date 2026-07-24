import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useSharedNow, useSharedNowSlow } from '../hooks/useSharedNow';
import {
  canUseOfficeOvertime,
  formatOvertimeClock,
  formatOvertimeShort,
  isBeforeSixPm,
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
  const anyRunning =
    mode === 'self'
      ? isOvertimeRunning(user?.employeeId ? officeOvertime[user.employeeId] : undefined)
      : Object.values(officeOvertime).some((entry) => isOvertimeRunning(entry));
  const nowFast = useSharedNow(anyRunning);
  const nowSlow = useSharedNowSlow(!anyRunning);
  const now = anyRunning ? nowFast : nowSlow;

  if (mode === 'self') {
    const employeeId = user?.employeeId;
    if (!canUseOfficeOvertime(employeeId)) return null;
    const entry = officeOvertime[employeeId!];
    const running = isOvertimeRunning(entry);
    const seconds = liveOvertimeSeconds(entry, now);
    const beforeSix = isBeforeSixPm(now);

    if (!running) {
      return (
        <section
          className={`office-ot office-ot--invite${compact ? ' office-ot--compact' : ''}${beforeSix ? ' office-ot--locked' : ''}`}
          aria-label="Tiempo extra en oficina"
        >
          <div className="office-ot-copy">
            <span className="office-ot-label">Oficina</span>
            <strong className="office-ot-question">¿Te vas a quedar más tiempo?</strong>
            <span className="office-ot-hint">
              {beforeSix
                ? 'El cronómetro se habilita a las 6:00 p.m. Hasta entonces no puedes iniciarlo.'
                : 'Inicia el cronómetro si te quedas. Al terminar, Orlando recibe el tiempo extra después de las 6:00 p.m.'}
            </span>
          </div>
          <div className="office-ot-actions">
            <button
              type="button"
              className="btn-primary office-ot-btn"
              disabled={beforeSix}
              title={beforeSix ? 'Disponible a partir de las 6:00 p.m.' : undefined}
              onClick={() => {
                if (beforeSix) {
                  toast.info('El cronómetro se habilita a las 6:00 p.m.');
                  return;
                }
                if (startOfficeOvertime()) {
                  toast.success('Cronómetro iniciado. Al terminar se avisa a Orlando.');
                } else {
                  toast.info('Solo puedes iniciar el cronómetro después de las 6:00 p.m.');
                }
              }}
            >
              {beforeSix ? 'Disponible a las 6:00 p.m.' : 'Sí, me quedo'}
            </button>
          </div>
          {seconds > 0 && (
            <p className="office-ot-banked">
              Hoy ya registraste {formatOvertimeShort(seconds)} después de las 6:00 p.m.
            </p>
          )}
        </section>
      );
    }

    return (
      <section
        className={`office-ot office-ot--running${compact ? ' office-ot--compact' : ''}`}
        aria-label="Cronómetro de tiempo extra"
      >
        <div className="office-ot-copy">
          <span className="office-ot-label">Cronómetro activo</span>
          <strong className="office-ot-clock" aria-live="polite">
            {formatOvertimeClock(seconds)}
          </strong>
          <span className="office-ot-hint">
            Tiempo extra después de las 6:00 p.m. Cuando te vayas, pulsa Terminar.
          </span>
        </div>
        <div className="office-ot-actions">
          <button
            type="button"
            className="btn-primary office-ot-btn office-ot-btn--stop"
            onClick={() => {
              const result = stopOfficeOvertime();
              if (!result.ok) {
                toast.info('No había un cronómetro activo');
                return;
              }
              if (result.afterSixSeconds > 0) {
                toast.success(
                  `Listo. Orlando recibió ${formatOvertimeShort(result.afterSixSeconds)} de tiempo extra.`,
                );
              } else {
                toast.info(
                  'Cronómetro cerrado. No hubo tiempo extra después de las 6:00 p.m.',
                );
              }
            }}
          >
            Terminar
          </button>
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
          <p className="office-ot-empty">
            Nadie ha marcado tiempo extra después de las 6:00 p.m. hoy.
          </p>
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
        <p className="office-ot-hint">Después de las 6:00 p.m. (excepto Orlando).</p>
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
