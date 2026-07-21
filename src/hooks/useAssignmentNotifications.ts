import { useEffect, useRef } from 'react';
import { COMPANY_NAME, LAST_ASSIGNMENT_CHECK_KEY } from '../constants';
import { assignmentBriefNotificationLine } from '../utils/assignmentBrief';
import { showLocalNotification } from '../api/pushClient';
import type { TaskAssignment } from '../types';

export function useAssignmentNotifications(
  pending: TaskAssignment[],
  enabled: boolean,
) {
  const prevCount = useRef(0);

  useEffect(() => {
    if (!enabled || pending.length === 0) {
      prevCount.current = pending.length;
      return;
    }

    const lastCheck = localStorage.getItem(LAST_ASSIGNMENT_CHECK_KEY);
    const isNew = pending.length > prevCount.current && prevCount.current > 0;

    if (
      isNew ||
      (!lastCheck && pending.length > 0 && prevCount.current === 0)
    ) {
      const first = pending[0];
      const context = first.brief
        ? ` · ${assignmentBriefNotificationLine(first.brief)}`
        : '';
      void showLocalNotification(`${COMPANY_NAME} — Nueva indicación`, {
        body: `${first.assignedByName}: ${first.title}${context}`,
        tag: first.id,
      });
    }

    prevCount.current = pending.length;
    localStorage.setItem(LAST_ASSIGNMENT_CHECK_KEY, new Date().toISOString());
  }, [pending, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [enabled]);
}
