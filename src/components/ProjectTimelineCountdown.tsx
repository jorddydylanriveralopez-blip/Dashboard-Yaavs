import { memo, useMemo } from 'react';
import { formatShortDate } from '../utils/formatDate';
import {
  formatDeadlineClock,
  getProjectTimelineInfo,
  type ProjectTimelineInfo,
} from '../utils/projectTimeline';
import { useSharedNow } from '../hooks/useSharedNow';
import type { CreativeProject } from '../types';
import './ProjectTimelineCountdown.css';

type ProjectPick = Pick<
  CreativeProject,
  'requestDate' | 'finishedDate' | 'commitmentDate' | 'status'
>;

interface Props {
  project: ProjectPick;
  compact?: boolean;
  showDates?: boolean;
  className?: string;
}

export function ProjectTimelineCountdown({
  project,
  compact = false,
  showDates = true,
  className = '',
}: Props) {
  const now = useSharedNow();
  const timeline = useMemo(
    () => getProjectTimelineInfo(project, now),
    [project, now],
  );

  if (timeline.tone === 'none') {
    return (
      <div className={`project-timeline project-timeline--empty ${className}`.trim()}>
        <span>Define la fecha de entrega para activar el cronómetro del proyecto.</span>
      </div>
    );
  }

  const clock = formatDeadlineClock(timeline);

  return (
    <div
      className={`project-timeline project-timeline--${timeline.tone}${compact ? ' project-timeline--compact' : ''} ${className}`.trim()}
      aria-live="polite"
    >
      <div className="project-timeline-head">
        <div>
          <span className="project-timeline-eyebrow">Plazo del proyecto</span>
          <strong className="project-timeline-label">{timeline.label}</strong>
        </div>
        {clock && (
          <div className="project-timeline-clock" aria-label="Tiempo restante">
            {clock}
          </div>
        )}
      </div>

      <div className="project-timeline-track" aria-hidden>
        <div
          className="project-timeline-fill"
          style={{ width: `${timeline.progressPercent}%` }}
        />
      </div>

      {showDates && (
        <div className="project-timeline-dates">
          <span>
            <em>Solicitud</em> {formatShortDate(timeline.requestDate)}
          </span>
          <span>
            <em>Entrega</em> {timeline.dueDate ? formatShortDate(timeline.dueDate) : '—'}
          </span>
          {!compact && timeline.totalDays > 0 && (
            <span className="project-timeline-span">
              Ventana: {timeline.totalDays} día{timeline.totalDays === 1 ? '' : 's'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Chip compacto con cronómetro en vivo (listas, kanban, equipo). */
export const LiveDeadlineChip = memo(function LiveDeadlineChip({
  project,
  className = '',
}: {
  project: ProjectPick;
  className?: string;
}) {
  const now = useSharedNow();
  const timeline = useMemo(() => getProjectTimelineInfo(project, now), [project, now]);
  const clock = formatDeadlineClock(timeline);
  if (!clock) return null;

  return (
    <span
      className={`live-deadline-chip live-deadline-chip--${timeline.tone} ${className}`.trim()}
      title={timeline.label}
      aria-label={`Cronómetro: ${timeline.label}, ${clock}`}
    >
      ⏱ {clock}
    </span>
  );
});

export function useProjectTimeline(project: ProjectPick): ProjectTimelineInfo {
  const now = useSharedNow();
  return useMemo(() => getProjectTimelineInfo(project, now), [project, now]);
}
