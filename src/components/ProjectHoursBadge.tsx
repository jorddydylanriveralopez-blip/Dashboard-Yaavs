import type { CreativeProject } from '../types';
import {
  estimatedHoursForProject,
  formatHoursMinutes,
  getHoursPaceInfo,
  hoursPaceBarColor,
  hoursProgressPercent,
} from '../utils/projectHours';
import './ProjectHoursBadge.css';

interface Props {
  project: CreativeProject;
  compact?: boolean;
  showLabel?: boolean;
}

export function ProjectHoursBadge({ project, compact, showLabel = true }: Props) {
  const pace = getHoursPaceInfo(project);
  const est = estimatedHoursForProject(project);
  const tracked = project.trackedMinutes ?? 0;
  const pct = hoursProgressPercent(project);
  const barColor = hoursPaceBarColor(pace.level);

  return (
    <div
      className={`project-hours-badge${compact ? ' project-hours-badge--compact' : ''} project-hours-badge--${pace.level}`}
    >
      {showLabel && (
        <div className="project-hours-badge-head">
          <span className={`project-hours-pace project-hours-pace--${pace.level}`}>{pace.label}</span>
          <span className="project-hours-totals">
            {formatHoursMinutes(tracked)} / {est} h
          </span>
        </div>
      )}
      <div className="project-hours-badge-bar" aria-hidden>
        <div
          className="project-hours-badge-fill"
          style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
        />
      </div>
      {!compact && <p className="project-hours-badge-msg">{pace.message}</p>}
    </div>
  );
}
