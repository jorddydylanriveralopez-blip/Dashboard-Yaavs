import { useMemo } from 'react';
import { formatActivityTime } from '../utils/activityFeed';
import type { ActivityEvent, ActivityKind } from '../types';
import './ActivityFeedPanel.css';

const KIND_ICON: Record<ActivityKind, string> = {
  project_completed: '✓',
  project_hours_exceeded: '⚠',
  project_early_delivery: '🎉',
  assignment_sent: '✉',
  assignment_accepted: '↩',
  assignment_rejected: '✕',
  kpi_objective_sent: '◎',
  kpi_objective_accepted: '✓',
  team_member_added: '+',
  team_member_removed: '−',
  project_status: '◆',
  project_progress: '📝',
  project_accepted: '✓',
  project_declined: '✕',
};

interface Props {
  events: ActivityEvent[];
  limit?: number;
  title?: string;
  emptyMessage?: string;
}

export function ActivityFeedPanel({
  events,
  limit = 8,
  title = 'Actividad reciente',
  emptyMessage = 'Aún no hay movimientos registrados.',
}: Props) {
  const items = useMemo(() => events.slice(0, limit), [events, limit]);

  return (
    <section className="activity-feed">
      <h2 className="activity-feed-title">{title}</h2>
      {items.length === 0 ? (
        <p className="activity-feed-empty">{emptyMessage}</p>
      ) : (
        <ul className="activity-feed-list">
          {items.map((ev) => (
            <li key={ev.id} className={`activity-feed-item activity-feed-item--${ev.kind}`}>
              <span className="activity-feed-icon" aria-hidden>
                {KIND_ICON[ev.kind]}
              </span>
              <div className="activity-feed-body">
                <p>{ev.message}</p>
                <span>{formatActivityTime(ev.at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
