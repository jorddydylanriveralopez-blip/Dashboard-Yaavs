import type {
  AttendanceStatus,
  AttendanceStore,
  CreativeProject,
  DailyKpiStore,
  EmployeeTask,
} from '../types';
import { ATTENDANCE_STATUS_LABELS, summarizeAttendance, workdaysInMonth } from './attendance';
import { collaboratorForEmployeeId } from './collaboratorMap';
import {
  buildCollaboratorSemaphore,
  type CollaboratorSemaphore,
  type SemaphoreLevel,
} from './collaboratorSemaphore';
import { buildMonthPulseSummary, buildTeamPieSlices } from './dailyKpiSnapshots';
import {
  projectFinishedInMonth,
  projectDeliveredOnTime,
} from './panoramaDelivery';
import { positionTitleForEmployee } from './marketingPositions';
import { kpiPercent } from './kpiStats';
import { getDeadlineInfo } from './deadline';
import { formatShortDate } from './formatDate';
import { labelFor, PROJECT_STATUSES } from '../data/projectOptions';
import {
  estimatedHoursForProject,
  isEarlyDelivery,
  isHoursExceeded,
  trackedHoursForProject,
} from './projectHours';

export interface AttendanceIssue {
  dateKey: string;
  dateLabel: string;
  status: AttendanceStatus;
  statusLabel: string;
}

export interface UndeliveredProject {
  id: string;
  name: string;
  commitmentDate: string;
  commitmentLabel: string;
  statusLabel: string;
  deadlineLabel: string;
  overdue: boolean;
}

export interface PanoramaMemberDetail {
  employeeId: string;
  employeeName: string;
  color: string;
  position?: string;
  collaborator: string | null;
  kpiPercent: number;
  sharePercent: number;
  kpiChange: number;
  daysUp: number;
  daysDown: number;
  projectsCompletedMonth: number;
  projectsOnTime: number;
  projectsLate: number;
  projectsActive: number;
  projectsHoursExceeded: number;
  estimatedHours: number;
  trackedHours: number;
  hoursWithinBudget: number;
  attendancePresent: number;
  attendanceAbsent: number;
  attendanceSick: number;
  attendanceLate: number;
  attendanceVacation: number;
  workdays: number;
  attendanceRate: number;
  semaphoreLevel: SemaphoreLevel;
  semaphoreMessage: string;
  attendanceIssues: AttendanceIssue[];
  undeliveredProjects: UndeliveredProject[];
  strengths: string[];
  improvements: string[];
}

function projectsForCollaboratorSlug(
  allProjects: CreativeProject[],
  collaborator: string,
): CreativeProject[] {
  return allProjects.filter((p) => p.collaborator === collaborator);
}

function buildAttendanceIssues(
  store: AttendanceStore,
  employeeId: string,
  monthKey: string,
): AttendanceIssue[] {
  return store.records
    .filter(
      (r) =>
        r.employeeId === employeeId &&
        r.monthKey === monthKey &&
        (r.status === 'absent' || r.status === 'sick' || r.status === 'late'),
    )
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .map((r) => ({
      dateKey: r.dateKey,
      dateLabel: formatShortDate(r.dateKey),
      status: r.status,
      statusLabel: ATTENDANCE_STATUS_LABELS[r.status],
    }));
}

function buildUndeliveredProjects(active: CreativeProject[]): UndeliveredProject[] {
  return active
    .map((p) => {
      const deadline = getDeadlineInfo(p.commitmentDate, p.status);
      return {
        id: p.id,
        name: p.projectName.trim() || 'Sin nombre',
        commitmentDate: p.commitmentDate,
        commitmentLabel: formatShortDate(p.commitmentDate),
        statusLabel: labelFor(PROJECT_STATUSES, p.status),
        deadlineLabel: deadline.label,
        overdue: deadline.tone === 'overdue',
      };
    })
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.commitmentDate.localeCompare(b.commitmentDate);
    });
}

function buildInsights(
  detail: Omit<PanoramaMemberDetail, 'strengths' | 'improvements'>,
  teamAvgKpi: number,
): { strengths: string[]; improvements: string[] } {
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (detail.kpiChange > 0) {
    strengths.push(`Su avance subió ${detail.kpiChange} puntos en el mes.`);
  } else if (detail.kpiChange < -5) {
    improvements.push(`Su avance bajó ${Math.abs(detail.kpiChange)} puntos en el mes.`);
  }

  if (detail.kpiPercent >= teamAvgKpi + 5) {
    strengths.push(`Por encima del promedio del equipo (${detail.kpiPercent} vs ${teamAvgKpi}).`);
  } else if (detail.kpiPercent < teamAvgKpi - 8) {
    improvements.push(`Avance por debajo del promedio (${detail.kpiPercent} vs ${teamAvgKpi}).`);
  }

  if (detail.projectsCompletedMonth > 0) {
    if (detail.projectsLate === 0) {
      strengths.push(
        `${detail.projectsOnTime} entrega(s) del mes cumplieron la fecha de compromiso.`,
      );
    } else {
      improvements.push(
        `${detail.projectsLate} de ${detail.projectsCompletedMonth} entrega(s) fuera de plazo.`,
      );
    }
  }

  if (detail.undeliveredProjects.length > 0) {
    const overdue = detail.undeliveredProjects.filter((p) => p.overdue).length;
    if (overdue > 0) {
      improvements.push(
        `${overdue} proyecto(s) sin entregar y ya con retraso.`,
      );
    } else {
      improvements.push(
        `${detail.undeliveredProjects.length} proyecto(s) activo(s) aún sin cerrar.`,
      );
    }
  } else if (detail.projectsActive === 0 && detail.projectsCompletedMonth > 0) {
    strengths.push('Sin proyectos pendientes de entrega.');
  }

  if (detail.attendanceIssues.length > 0) {
    const absent = detail.attendanceIssues.filter((i) => i.status === 'absent').length;
    const sick = detail.attendanceIssues.filter((i) => i.status === 'sick').length;
    const late = detail.attendanceIssues.filter((i) => i.status === 'late').length;
    const parts: string[] = [];
    if (absent > 0) parts.push(`${absent} falta(s)`);
    if (sick > 0) parts.push(`${sick} por enfermedad`);
    if (late > 0) parts.push(`${late} retardo(s)`);
    improvements.push(`Inasistencias registradas: ${parts.join(', ')}.`);
  }

  if (detail.projectsHoursExceeded > 0) {
    improvements.push(
      `${detail.projectsHoursExceeded} proyecto(s) activo(s) superan el presupuesto de horas.`,
    );
  } else if (detail.trackedHours > 0 && detail.hoursWithinBudget > 0) {
    strengths.push(
      `${detail.hoursWithinBudget} proyecto(s) con horas dentro del presupuesto.`,
    );
  }

  if (detail.attendanceRate >= 92) {
    strengths.push(`Asistencia sólida: ${detail.attendanceRate}% de días laborables.`);
  } else if (detail.attendanceRate < 80) {
    improvements.push(`Asistencia baja: ${detail.attendanceRate}% de días laborables.`);
  }

  if (detail.attendanceAbsent + detail.attendanceSick > 1) {
    improvements.push(
      `${detail.attendanceAbsent} falta(s) y ${detail.attendanceSick} día(s) por enfermedad.`,
    );
  }

  if (detail.attendanceLate > 1) {
    improvements.push(`${detail.attendanceLate} retardos en el mes.`);
  }

  if (detail.daysDown > detail.daysUp + 1) {
    improvements.push('Más días con baja de avance que con mejora.');
  } else if (detail.daysUp > detail.daysDown + 1) {
    strengths.push(`${detail.daysUp} días con mejora en su avance.`);
  }

  if (detail.semaphoreLevel === 'red') {
    improvements.push(detail.semaphoreMessage);
  } else if (detail.semaphoreLevel === 'yellow') {
    improvements.push(detail.semaphoreMessage);
  } else if (detail.semaphoreLevel === 'green' && strengths.length < 4) {
    strengths.push(detail.semaphoreMessage);
  }

  if (strengths.length === 0 && detail.kpiPercent >= 60) {
    strengths.push('Rendimiento estable en el periodo.');
  }

  if (improvements.length === 0 && detail.kpiPercent < 55) {
    improvements.push('Reforzar ritmo de entrega y seguimiento de objetivos.');
  }

  return {
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 5),
  };
}

export function buildPanoramaMemberDetails(input: {
  monthKey: string;
  tasks: EmployeeTask[];
  dailyKpiStore: DailyKpiStore;
  allProjects: CreativeProject[];
  attendanceStore: AttendanceStore;
  semaphores?: CollaboratorSemaphore[];
}): PanoramaMemberDetail[] {
  const { monthKey, tasks, dailyKpiStore, allProjects, attendanceStore } = input;
  const team = tasks.filter((t) => t.employeeId !== 'emp-orlando');
  const summary = buildMonthPulseSummary(dailyKpiStore, team, monthKey);
  const pieSlices = buildTeamPieSlices(team);
  const attendance = summarizeAttendance(attendanceStore, tasks, monthKey);
  const workdays = workdaysInMonth(monthKey).length;
  const semaphores =
    input.semaphores ??
    team
      .map((t) => collaboratorForEmployeeId(t.employeeId))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => buildCollaboratorSemaphore(c, allProjects));

  const semaphoreByCollab = new Map(semaphores.map((s) => [s.collaborator, s]));

  return team.map((task) => {
    const collaborator = collaboratorForEmployeeId(task.employeeId);
    const collabProjects = collaborator
      ? projectsForCollaboratorSlug(allProjects, collaborator)
      : [];
    const completedMonth = collabProjects.filter(
      (p) => p.status === 'terminado' && projectFinishedInMonth(p, monthKey),
    );
    const onTime = completedMonth.filter(
      (p) => projectDeliveredOnTime(p) || isEarlyDelivery(p),
    ).length;
    const late = completedMonth.length - onTime;
    const active = collabProjects.filter((p) => p.status !== 'terminado');
    const hoursExceeded = active.filter((p) => isHoursExceeded(p)).length;
    const withinBudget = collabProjects.filter((p) => !isHoursExceeded(p)).length;

    const estimatedHours = Math.round(
      collabProjects.reduce((sum, p) => sum + estimatedHoursForProject(p), 0) * 10,
    ) / 10;
    const trackedHours = Math.round(
      collabProjects.reduce((sum, p) => sum + trackedHoursForProject(p), 0) * 10,
    ) / 10;

    const att = attendance.find((a) => a.employeeId === task.employeeId);
    const present = att?.present ?? 0;
    const absent = att?.absent ?? 0;
    const sick = att?.sick ?? 0;
    const lateAtt = att?.late ?? 0;
    const vacation = att?.vacation ?? 0;
    const attendanceRate =
      workdays > 0 ? Math.round(((present + lateAtt) / workdays) * 100) : 0;

    const monthMember = summary.members.find((m) => m.employeeId === task.employeeId);
    const slice = pieSlices.find((s) => s.id === task.employeeId);
    const sem = collaborator ? semaphoreByCollab.get(collaborator) : undefined;

    const base: Omit<PanoramaMemberDetail, 'strengths' | 'improvements'> = {
      employeeId: task.employeeId,
      employeeName: task.employeeName,
      color: task.avatarColor,
      position: positionTitleForEmployee(task.employeeId),
      collaborator,
      kpiPercent: kpiPercent(task),
      sharePercent: slice?.sharePercent ?? 0,
      kpiChange: monthMember?.change ?? 0,
      daysUp: monthMember?.daysUp ?? 0,
      daysDown: monthMember?.daysDown ?? 0,
      projectsCompletedMonth: completedMonth.length,
      projectsOnTime: onTime,
      projectsLate: late,
      projectsActive: active.length,
      projectsHoursExceeded: hoursExceeded,
      estimatedHours,
      trackedHours,
      hoursWithinBudget: withinBudget,
      attendancePresent: present,
      attendanceAbsent: absent,
      attendanceSick: sick,
      attendanceLate: lateAtt,
      attendanceVacation: vacation,
      workdays,
      attendanceRate,
      semaphoreLevel: sem?.level ?? 'green',
      semaphoreMessage: sem?.message ?? 'Sin datos de ritmo suficientes.',
      attendanceIssues: buildAttendanceIssues(attendanceStore, task.employeeId, monthKey),
      undeliveredProjects: buildUndeliveredProjects(active),
    };

    const { strengths, improvements } = buildInsights(base, summary.teamAvg);

    return { ...base, strengths, improvements };
  }).sort((a, b) => b.kpiPercent - a.kpiPercent);
}
