import type {
  AttendanceStore,
  CreativeProject,
  DailyKpiStore,
  EmployeeTask,
  ManagerObservationsStore,
} from '../types';
import { labelFor, PROJECT_STATUSES } from '../data/projectOptions';
import { buildPanoramaMemberDetails } from './panoramaDetail';
import { buildMonthPulseSummary } from './dailyKpiSnapshots';
import { buildPanoramaDeliverySummary } from './panoramaDelivery';
import { projectsForCollaboratorSlug } from './collaboratorProjectBuckets';
import { formatMonthLabel } from './performanceHistory';
import { getManagerObservation } from './managerObservations';
import { formatShortDate } from './formatDate';
import {
  buildCollaboratorSemaphore,
  TRACKED_COLLABORATORS,
  type CollaboratorSemaphore,
  type SemaphoreLevel,
} from './collaboratorSemaphore';
import {
  estimatedHoursForProject,
  formatHoursMinutes,
  trackedHoursForProject,
} from './projectHours';

const SEMAPHORE_LABELS: Record<SemaphoreLevel, string> = {
  green: 'Verde',
  yellow: 'Amarillo',
  red: 'Rojo',
};

function esc(text: string | number | null | undefined): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtGenerated(): string {
  return new Date().toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function deltaHtml(value: number | null, suffix = ' pts'): string {
  if (value === null) return '<span class="muted">—</span>';
  const cls = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const sign = value > 0 ? '+' : '';
  return `<span class="${cls}">${sign}${value}${suffix}</span>`;
}

function listHtml(items: string[], empty = '—'): string {
  if (items.length === 0) return `<span class="muted">${esc(empty)}</span>`;
  return `<ul class="cell-list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

function downloadHtml(filename: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildPanoramaExportHtml(input: {
  monthKey: string;
  tasks: EmployeeTask[];
  dailyKpiStore: DailyKpiStore;
  allProjects: CreativeProject[];
  attendanceStore: AttendanceStore;
  managerObservations: ManagerObservationsStore;
  semaphores: CollaboratorSemaphore[];
  pendingAssignments?: number;
}): string {
  const {
    monthKey,
    tasks,
    dailyKpiStore,
    allProjects,
    attendanceStore,
    managerObservations,
    semaphores,
  } = input;

  const team = tasks.filter((t) => t.employeeId !== 'emp-orlando');
  const summary = buildMonthPulseSummary(dailyKpiStore, team, monthKey);
  const delivery = buildPanoramaDeliverySummary(allProjects, monthKey);
  const members = buildPanoramaMemberDetails({
    monthKey,
    tasks: team,
    dailyKpiStore,
    allProjects,
    attendanceStore,
    semaphores,
  });

  const activeProjects = allProjects.filter((p) => p.status !== 'terminado');
  const completedProjects = allProjects.filter((p) => p.status === 'terminado');

  const kpiRows = summary.members
    .map(
      (m) => `
      <tr>
        <td><span class="dot" style="background:${esc(m.color)}"></span>${esc(m.employeeName)}</td>
        <td class="num">${m.startKpi}%</td>
        <td class="num"><strong>${m.endKpi}%</strong></td>
        <td class="num">${deltaHtml(m.change, '%')}</td>
        <td class="num up">${m.daysUp}</td>
        <td class="num">${m.daysDown}</td>
      </tr>`,
    )
    .join('');

  const memberCards = members
    .map((m) => {
      const managerNote = getManagerObservation(managerObservations, m.employeeId, monthKey);
      const absences =
        m.attendanceIssues.length > 0
          ? m.attendanceIssues
              .map((i) => `${i.dateLabel} — ${i.statusLabel}`)
              .join(' · ')
          : 'Sin incidencias';

      const undelivered =
        m.undeliveredProjects.length > 0
          ? m.undeliveredProjects
              .map(
                (p) =>
                  `${p.name} (${p.statusLabel}${p.overdue ? ', en retraso' : ''})`,
              )
              .join(' · ')
          : 'Sin proyectos pendientes';

      return `
      <article class="member-card member-card--${esc(m.semaphoreLevel)}">
        <header class="member-head">
          <div>
            <h3><span class="dot" style="background:${esc(m.color)}"></span>${esc(m.employeeName)}</h3>
            <p>${esc(m.position ?? '')}</p>
          </div>
          <div class="member-score">
            <strong>${m.kpiPercent}</strong>
            <span>de 100</span>
          </div>
        </header>
        <div class="member-metrics">
          <div><span>Entregas</span><strong>${m.projectsOnTime}/${m.projectsCompletedMonth} a tiempo</strong></div>
          <div><span>Horas</span><strong>${m.trackedHours}h / ${m.estimatedHours}h</strong></div>
          <div><span>Asistencia</span><strong>${m.attendanceRate}%</strong></div>
          <div><span>Ritmo</span><strong>${m.daysUp}↑ · ${m.daysDown}↓</strong></div>
        </div>
        <div class="member-detail-grid">
          <div><h4>Inasistencias</h4><p>${esc(absences)}</p></div>
          <div><h4>Sin entregar</h4><p>${esc(undelivered)}</p></div>
        </div>
        ${managerNote?.text ? `<div class="manager-note"><h4>Observación del gerente</h4><p>${esc(managerNote.text)}</p><small>${esc(managerNote.authorName)} · ${esc(formatShortDate(managerNote.updatedAt.slice(0, 10)))}</small></div>` : ''}
        <div class="member-insights">
          <div class="good"><h4>Fortalezas</h4>${listHtml(m.strengths, 'Sin destacados')}</div>
          <div class="warn"><h4>Áreas a mejorar</h4>${listHtml(m.improvements, 'Sin alertas')}</div>
        </div>
      </article>`;
    })
    .join('');

  const semaphoreRows = semaphores
    .map(
      (s) => `
      <tr>
        <td>${esc(s.label)}</td>
        <td><span class="pill pill--${esc(s.level)}">${esc(SEMAPHORE_LABELS[s.level])}</span></td>
        <td class="num">${s.avgActualDays !== null ? s.avgActualDays : '—'}</td>
        <td class="num">${s.avgPlannedDays !== null ? s.avgPlannedDays : '—'}</td>
        <td class="num">${s.completedCount}</td>
        <td class="num">${s.activeCount}</td>
        <td class="num">${s.hoursExceededCount}</td>
        <td>${esc(s.message)}</td>
      </tr>`,
    )
    .join('');

  const activeProjectRows = activeProjects
    .map(
      (p) => `
      <tr>
        <td>${esc(p.projectName.trim() || 'Sin nombre')}</td>
        <td>${esc(p.collaborator)}</td>
        <td class="num">${estimatedHoursForProject(p)} h</td>
        <td class="num">${trackedHoursForProject(p)} h</td>
        <td>${esc(labelFor(PROJECT_STATUSES, p.status))}</td>
        <td>${esc(formatShortDate(p.commitmentDate))}</td>
      </tr>`,
    )
    .join('');

  const completedProjectRows = completedProjects
    .map(
      (p) => `
      <tr>
        <td>${esc(p.projectName.trim() || 'Sin nombre')}</td>
        <td>${esc(p.collaborator)}</td>
        <td class="num">${estimatedHoursForProject(p)} h</td>
        <td class="num">${trackedHoursForProject(p)} h</td>
        <td>${esc(formatShortDate(p.finishedDate ?? p.completedAt?.slice(0, 10) ?? ''))}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yaavs — Panorama ${esc(formatMonthLabel(monthKey))}</title>
  <style>
    :root {
      --ink: #1f2a44;
      --muted: #6b7a99;
      --line: #e6eaf2;
      --bg: #f4f6fb;
      --card: #ffffff;
      --brand: #3b5ccc;
      --good: #0d9f6e;
      --warn: #b45309;
      --bad: #d64545;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.45;
    }
    .sheet {
      max-width: 1100px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(31, 42, 68, 0.08);
    }
    .hero {
      padding: 28px 32px;
      background: linear-gradient(135deg, #2f4eb8, #4f6fe8);
      color: #fff;
    }
    .hero h1 { margin: 0 0 6px; font-size: 1.65rem; }
    .hero p { margin: 0; opacity: 0.92; }
    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
      margin-top: 18px;
      font-size: 0.92rem;
    }
    .content { padding: 28px 32px 36px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .stat {
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #fafbfe;
    }
    .stat strong {
      display: block;
      font-size: 1.55rem;
      line-height: 1.1;
      color: var(--brand);
    }
    .stat span { font-size: 0.82rem; color: var(--muted); }
    section { margin-top: 28px; }
    section h2 {
      margin: 0 0 8px;
      font-size: 1.1rem;
    }
    section .sub {
      margin: 0 0 14px;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--line);
      border-radius: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
      text-align: left;
    }
    th {
      background: #f7f9fc;
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }
    tr:last-child td, tr:last-child th { border-bottom: none; }
    .num { text-align: right; white-space: nowrap; }
    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }
    .up { color: var(--good); font-weight: 700; }
    .down { color: var(--bad); font-weight: 700; }
    .flat { color: var(--muted); }
    .muted { color: var(--muted); }
    .pill {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 700;
    }
    .pill--yes, .pill--green { background: #e4f8ef; color: var(--good); }
    .pill--no, .pill--red { background: #fdecec; color: var(--bad); }
    .pill--flat, .pill--muted { background: #f0f2f7; color: var(--muted); }
    .pill--yellow { background: #fff4df; color: #9a6700; }
    .tag {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 7px;
      border-radius: 999px;
      background: #e8f1ff;
      color: #3b5ccc;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .current-row { background: #f8fbff; }
    .cell-list {
      margin: 0;
      padding-left: 18px;
    }
    .cell-list li + li { margin-top: 4px; }
    .member-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .member-card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      background: #fff;
    }
    .member-card--green { border-left: 4px solid var(--good); }
    .member-card--yellow { border-left: 4px solid #d4a017; }
    .member-card--red { border-left: 4px solid var(--bad); }
    .member-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }
    .member-head h3 {
      margin: 0;
      font-size: 1rem;
    }
    .member-head p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .member-score {
      text-align: right;
    }
    .member-score strong {
      display: block;
      font-size: 1.4rem;
      color: var(--brand);
      line-height: 1;
    }
    .member-score span {
      font-size: 0.75rem;
      color: var(--muted);
    }
    .member-metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin: 14px 0;
    }
    .member-metrics div {
      padding: 10px;
      border-radius: 8px;
      background: #f7f9fc;
      font-size: 0.82rem;
    }
    .member-metrics span {
      display: block;
      color: var(--muted);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .member-detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    .member-detail-grid h4,
    .manager-note h4,
    .member-insights h4 {
      margin: 0 0 6px;
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }
    .member-detail-grid p,
    .manager-note p {
      margin: 0;
      font-size: 0.88rem;
    }
    .manager-note {
      margin: 12px 0;
      padding: 12px;
      border-radius: 8px;
      background: #f3f6ff;
      border: 1px solid #d8e2ff;
    }
    .manager-note small {
      display: block;
      margin-top: 6px;
      color: var(--muted);
      font-size: 0.75rem;
    }
    .member-insights {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .member-insights .good {
      padding: 12px;
      border-radius: 8px;
      background: #edf9f3;
    }
    .member-insights .warn {
      padding: 12px;
      border-radius: 8px;
      background: #fff6ea;
    }
    .footer {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.8rem;
    }
    @media print {
      body { padding: 0; background: #fff; }
      .sheet { box-shadow: none; border: none; }
    }
    @media (max-width: 800px) {
      .stats, .member-metrics, .member-detail-grid, .member-insights {
        grid-template-columns: 1fr 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="hero">
      <h1>Panorama Marketing — Yaavs</h1>
      <p>Reporte del equipo creativo basado en proyectos entregados, KPI, asistencia y áreas de mejora.</p>
      <div class="hero-meta">
        <div><strong>Mes:</strong> ${esc(formatMonthLabel(monthKey))}</div>
        <div><strong>Generado:</strong> ${esc(fmtGenerated())}</div>
        <div><strong>Colaboradores:</strong> ${team.length}</div>
      </div>
    </header>

    <div class="content">
      <div class="stats">
        <div class="stat"><strong>${delivery.avgDeliveryPercent}%</strong><span>Avance promedio</span></div>
        <div class="stat"><strong>${delivery.daysWithDeliveries}</strong><span>Días registrados</span></div>
        <div class="stat"><strong>${delivery.overdueProjects}</strong><span>Proyectos atrasados</span></div>
        <div class="stat"><strong>${delivery.activeProjects}</strong><span>Proyectos activos</span></div>
        <div class="stat"><strong>${summary.teamAvg}%</strong><span>Avance KPI promedio</span></div>
        <div class="stat"><strong>${input.pendingAssignments ?? 0}</strong><span>Pendientes</span></div>
      </div>

      <section>
        <h2>Avance del mes por persona</h2>
        <p class="sub">KPI al inicio y cierre del periodo, con días de avance y estancamiento.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th class="num">Inicio</th>
                <th class="num">Cierre</th>
                <th class="num">Cambio</th>
                <th class="num">Días ↑</th>
                <th class="num">Días ↓</th>
              </tr>
            </thead>
            <tbody>${kpiRows}</tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Detalle por colaborador</h2>
        <p class="sub">Entregas, horas, inasistencias, proyectos pendientes y observaciones del gerente.</p>
        <div class="member-grid">${memberCards}</div>
      </section>

      <section>
        <h2>Semáforos de ritmo</h2>
        <p class="sub">Verde = a tiempo · Amarillo = al límite · Rojo = retrasos o horas excedidas.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Semáforo</th>
                <th class="num">Días reales</th>
                <th class="num">Días plazo</th>
                <th class="num">Terminados</th>
                <th class="num">Activos</th>
                <th class="num">Horas exced.</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>${semaphoreRows}</tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Proyectos activos — horas</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Colaborador</th>
                <th class="num">Presupuesto</th>
                <th class="num">Trabajadas</th>
                <th>Estado</th>
                <th>Compromiso</th>
              </tr>
            </thead>
            <tbody>
              ${activeProjectRows || '<tr><td colspan="6" class="muted">Sin proyectos activos.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Proyectos concluidos — horas</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Colaborador</th>
                <th class="num">Presupuesto</th>
                <th class="num">Trabajadas</th>
                <th>Entrega</th>
              </tr>
            </thead>
            <tbody>
              ${completedProjectRows || '<tr><td colspan="5" class="muted">Sin proyectos concluidos.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <p class="footer">
        Documento generado desde Yaavs Panorama. Puedes abrirlo en el navegador, imprimirlo o guardarlo como PDF.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function exportPanorama(input: {
  monthKey: string;
  tasks: EmployeeTask[];
  dailyKpiStore: DailyKpiStore;
  allProjects: CreativeProject[];
  attendanceStore: AttendanceStore;
  managerObservations: ManagerObservationsStore;
  semaphores?: CollaboratorSemaphore[];
  pendingAssignments?: number;
}): void {
  const semaphores =
    input.semaphores ?? buildPanoramaSemaphores(input.allProjects);
  const html = buildPanoramaExportHtml({ ...input, semaphores });
  downloadHtml(`yaavs-panorama-${input.monthKey}.html`, html);
}

/** @deprecated Usa exportPanorama */
export function exportPanoramaCsv(input: {
  monthKey: string;
  tasks: EmployeeTask[];
  dailyKpiStore: DailyKpiStore;
  allProjects: CreativeProject[];
  semaphores: CollaboratorSemaphore[];
}): void {
  exportPanorama({
    ...input,
    attendanceStore: { records: [] },
    managerObservations: { items: [] },
    semaphores: input.semaphores,
  });
}

export function buildPanoramaSemaphores(allProjects: CreativeProject[]): CollaboratorSemaphore[] {
  return TRACKED_COLLABORATORS.map((c) => buildCollaboratorSemaphore(c, allProjects));
}

export function projectsForCollaborator(
  allProjects: CreativeProject[],
  collaborator: string,
): CreativeProject[] {
  return projectsForCollaboratorSlug(allProjects, collaborator as import('../types').Collaborator);
}

export function formatProjectHoursRow(p: CreativeProject): string {
  return `${formatHoursMinutes(p.trackedMinutes ?? 0)} / ${estimatedHoursForProject(p)} h`;
}
