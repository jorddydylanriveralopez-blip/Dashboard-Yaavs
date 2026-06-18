import { useApp } from '../context/AppContext';
import {
  consecutiveNegativeMonths,
  getStreakAlertMessage,
  shouldAlertNegativeStreak,
} from '../utils/performanceHistory';
import './PerformanceAlertBanner.css';

export function PerformanceAlertBanner() {
  const { user, performanceHistory, canEditAll } = useApp();

  if (canEditAll || !user?.employeeId) return null;
  if (!shouldAlertNegativeStreak(performanceHistory, user.employeeId)) return null;

  const months = consecutiveNegativeMonths(performanceHistory, user.employeeId);

  return (
    <div className="performance-alert-banner" role="alert">
      <strong>Te acompañamos</strong>
      <p>
        Llevas {months} meses con KPI por debajo de la meta. {getStreakAlertMessage()}
      </p>
      <span className="performance-alert-hint">
        Habla con tu gerente desde Indicaciones o por el canal habitual del equipo.
      </span>
    </div>
  );
}

export function PerformanceAlertBadge() {
  const { user, performanceHistory, canEditAll } = useApp();
  if (canEditAll || !user?.employeeId) return null;
  if (!shouldAlertNegativeStreak(performanceHistory, user.employeeId)) return null;
  return (
    <span className="nav-badge performance-streak-badge" title="Revisar historial">
      !
    </span>
  );
}
