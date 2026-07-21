import { useMemo, useState } from 'react';
import {
  buildEmployeeNotifications,
  countUnreadNotifications,
  markNotificationsSeen,
  type EmployeeNotification,
  type NotificationTarget,
} from '../utils/employeeNotifications';
import { NotificationsList } from './NotificationsList';
import type { ActivityEvent, KpiObjectiveAssignment, TaskAssignment } from '../types';
import './EmployeeNotificationsPanel.css';

interface Props {
  userName: string;
  employeeId: string;
  activeUsers: import('../types').User[];
  allProjects: import('../types').CreativeProject[];
  pendingAssignments: TaskAssignment[];
  pendingKpiObjectives: KpiObjectiveAssignment[];
  activityFeed: ActivityEvent[];
  performanceHistory: import('../types').PerformanceHistoryStore;
  improvementTips?: string[];
  managerNote?: string;
  managerNoteUpdatedAt?: string;
  onNavigate: (target: NotificationTarget) => void;
  compact?: boolean;
}

export function EmployeeNotificationsPanel({
  userName,
  employeeId,
  activeUsers,
  allProjects,
  pendingAssignments,
  pendingKpiObjectives,
  activityFeed,
  performanceHistory,
  improvementTips,
  managerNote,
  managerNoteUpdatedAt,
  onNavigate,
  compact = false,
}: Props) {
  const [seenTick, setSeenTick] = useState(0);

  const notifications = useMemo(
    () =>
      buildEmployeeNotifications({
        userName,
        employeeId,
        activeUsers,
        allProjects,
        pendingAssignments,
        pendingKpiObjectives,
        activityFeed,
        performanceHistory,
        improvementTips,
        managerNote,
        managerNoteUpdatedAt,
        limit: compact ? 5 : 12,
      }),
    [
      userName,
      employeeId,
      activeUsers,
      allProjects,
      pendingAssignments,
      pendingKpiObjectives,
      activityFeed,
      performanceHistory,
      improvementTips,
      managerNote,
      managerNoteUpdatedAt,
      compact,
      seenTick,
    ],
  );

  const unread = countUnreadNotifications(notifications);

  const handleMarkRead = () => {
    markNotificationsSeen();
    setSeenTick((n) => n + 1);
  };

  const handleSelect = (item: EmployeeNotification) => {
    markNotificationsSeen();
    setSeenTick((n) => n + 1);
    onNavigate(item.target);
  };

  return (
    <section className={`employee-notifications ${compact ? 'employee-notifications--compact' : ''}`}>
      <div className="employee-notifications-head">
        <div>
          <h2>Notificaciones</h2>
          <p className="employee-notifications-sub">
            También disponibles en la campanita arriba a la derecha
          </p>
        </div>
        {unread > 0 && (
          <button type="button" className="btn-ghost employee-notifications-mark" onClick={handleMarkRead}>
            Marcar leídas ({unread})
          </button>
        )}
      </div>

      <NotificationsList
        notifications={notifications}
        onSelect={handleSelect}
        compact={compact}
      />
    </section>
  );
}
