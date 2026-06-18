import { useEffect, useRef } from 'react';
import { COMPANY_NAME, PERFORMANCE_ALERT_KEY } from '../constants';
import {
  consecutiveNegativeMonths,
  getStreakAlertMessage,
  shouldAlertNegativeStreak,
} from '../utils/performanceHistory';
import type { PerformanceHistoryStore } from '../types';

export function usePerformanceStreakAlert(
  employeeId: string | undefined,
  history: PerformanceHistoryStore,
  enabled: boolean,
) {
  const alerted = useRef(false);

  useEffect(() => {
    if (!enabled || !employeeId || alerted.current) return;
    if (!shouldAlertNegativeStreak(history, employeeId)) return;

    const alertKey = `${PERFORMANCE_ALERT_KEY}-${employeeId}-${consecutiveNegativeMonths(history, employeeId)}`;
    if (localStorage.getItem(alertKey)) return;

    const body = getStreakAlertMessage();

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(`${COMPANY_NAME} — Apoyo del equipo`, {
        body,
        tag: `yaavs-streak-${employeeId}`,
      });
    }

    localStorage.setItem(alertKey, new Date().toISOString());
    alerted.current = true;
  }, [employeeId, history, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [enabled]);
}
