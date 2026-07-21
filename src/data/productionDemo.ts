import { MARKETING_DEPARTMENT } from './seed';
import { DEFAULT_PROJECTS } from './projectSeed';
import { buildMonthSnapshot } from '../utils/monthlyArchive';
import { todayKey } from '../utils/dailyKpiSnapshots';
import { buildDemoAttendance } from '../utils/attendance';
import { kpiPercent } from '../utils/kpiStats';
import { plannedProjectDays } from '../utils/projectHours';
import {
  formatMonthLabel,
  getMonthKey,
  getPreviousMonthKey,
} from '../utils/performanceHistory';
import type {
  ActivityEvent,
  ActivityKind,
  AttendanceStore,
  BoardState,
  CalendarStore,
  ContentSentiment,
  CreativeProject,
  DailyKpiSnapshot,
  DailyKpiStore,
  EmployeeTask,
  KpiObjectiveAssignment,
  MonthlyArchiveStore,
  MonthlyPerformanceRecord,
  PerformanceHistoryStore,
  SocialContentEntry,
  SocialMetricsStore,
  SocialPlatform,
  TaskAssignment,
  TaskStatus,
} from '../types';

const now = new Date();
const currentMonth = getMonthKey(now);
const prevMonth = getPreviousMonthKey(now);

function daysAgo(n: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysAhead(n: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isoAtDaysAgo(n: number, hour = 11, minute = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateInMonth(day: number, monthKey = currentMonth): string {
  return `${monthKey}-${String(day).padStart(2, '0')}`;
}

function hashOffset(seed: string, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % max;
  return h;
}

function buildBoard(): BoardState {
  const extraProjects: CreativeProject[] = [
    {
      id: 'proj-6',
      requestDate: daysAgo(18),
      projectName: 'Activación BTL prepago — plaza central',
      businessUnit: 'prepago',
      requestedBy: 'Dirección comercial',
      requestingDepartment: 'direccion_comercial',
      projectType: 'activacion_btl',
      priority: 'alta_urgente',
      commitmentDate: daysAhead(4),
      internalArea: 'diseno_audiovisual',
      collaborator: 'andres',
      status: 'en_proceso',
      comments: 'Montaje, señalética y promotoría. Coordinar con almacén.',
      createdAt: daysAgo(18),
      updatedAt: daysAgo(1),
    },
    {
      id: 'proj-7',
      requestDate: daysAgo(14),
      projectName: 'Calendario de contenido redes — junio',
      businessUnit: 'yaavs_shop',
      requestedBy: 'Orlando',
      requestingDepartment: 'direccion',
      projectType: 'community_manager',
      priority: 'media',
      commitmentDate: daysAhead(12),
      internalArea: 'redes_sociales',
      collaborator: 'yared',
      assignedEmployeeId: 'emp-yared',
      status: 'en_proceso',
      comments: '12 piezas entre TikTok, Reels e historias.',
      createdAt: daysAgo(14),
      updatedAt: daysAgo(2),
    },
    {
      id: 'proj-8',
      requestDate: daysAgo(35),
      projectName: 'Estrategia pospago Q3',
      businessUnit: 'pospago',
      requestedBy: 'Finanzas',
      requestingDepartment: 'finanzas',
      projectType: 'estrategia',
      priority: 'media',
      commitmentDate: daysAgo(8),
      internalArea: 'redes_sociales',
      collaborator: 'carlos',
      status: 'terminado',
      finishedDate: daysAgo(6),
      comments: 'Presentación a dirección aprobada.',
      hasCompletionProof: true,
      completedAt: daysAgo(6),
      completedByName: 'Juan Carlos',
      createdAt: daysAgo(35),
      updatedAt: daysAgo(6),
    },
    {
      id: 'proj-9',
      requestDate: daysAgo(6),
      projectName: 'Banners performance Meta — retargeting',
      businessUnit: 'silemi',
      requestedBy: 'Atención a cliente',
      requestingDepartment: 'atencion_cliente',
      projectType: 'diseno_grafico',
      priority: 'alta_urgente',
      commitmentDate: daysAhead(2),
      internalArea: 'diseno_grafico',
      collaborator: 'roberto',
      status: 'revision_interna',
      comments: 'Variantes 1080×1080 y 1200×628.',
      createdAt: daysAgo(6),
      updatedAt: daysAgo(0),
    },
  ];

  const tasks: EmployeeTask[] = [
    {
      id: 't-orlando',
      employeeId: 'emp-orlando',
      employeeName: 'Orlando',
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Gerente de Marketing',
      avatarColor: '#5034ff',
      currentWork: 'Revisión de entregas y cierre parcial de mes',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 78,
      objective: 'Coordinar al equipo, indicaciones y cumplimiento de KPIs del mes',
      dueDate: daysAhead(8),
      notes: 'Reunión de cierre con dirección el viernes.',
      priority: 'alta',
      kpiObjectiveMonthKey: currentMonth,
      kpiAssignedByName: 'Orlando',
      kpiAssignedAt: isoAtDaysAgo(20, 9),
    },
    {
      id: 't-juancarlos',
      employeeId: 'emp-juancarlos',
      employeeName: 'Juan Carlos',
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Coordinador de Marketing',
      avatarColor: '#fdab3d',
      currentWork: 'Seguimiento OKRs y reporte mensual',
      status: 'en_revision',
      kpiTarget: 100,
      kpiCurrent: 84,
      objective: 'Cerrar reporte de campañas y proyección Q3',
      dueDate: daysAhead(5),
      notes: 'Estrategia pospago entregada. Falta deck ejecutivo.',
      priority: 'alta',
      kpiObjectiveMonthKey: currentMonth,
      kpiAssignedByName: 'Orlando',
      kpiAssignedAt: isoAtDaysAgo(19, 10),
    },
    {
      id: 't-jorddy',
      employeeId: 'emp-jorddy',
      employeeName: 'Jorddy Dylan',
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Diseñador UX/UI',
      avatarColor: '#ff158a',
      currentWork: 'Flujo checkout v2 + ajustes landing Silemi',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 62,
      objective: 'Entregar prototipo interactivo y handoff a desarrollo',
      dueDate: daysAhead(7),
      notes: 'Test de usabilidad programado para el jueves.',
      priority: 'alta',
      kpiObjectiveMonthKey: currentMonth,
      kpiAssignedByName: 'Orlando',
      kpiAssignedAt: isoAtDaysAgo(17, 9, 30),
    },
    {
      id: 't-jesus',
      employeeId: 'emp-jesus',
      employeeName: 'Jesus',
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Diseñador Multimedia',
      avatarColor: '#784bd1',
      currentWork: 'Video tutorial app + cortes para redes',
      status: 'en_revision',
      kpiTarget: 100,
      kpiCurrent: 86,
      objective: 'Finalizar video 90 s y 4 variantes verticales',
      dueDate: daysAhead(4),
      notes: 'Música aprobada. Última revisión de color.',
      priority: 'media',
      kpiObjectiveMonthKey: currentMonth,
      kpiAssignedByName: 'Orlando',
      kpiAssignedAt: isoAtDaysAgo(16, 14),
      linkedProjectId: 'proj-2',
    },
    {
      id: 't-yared',
      employeeId: 'emp-yared',
      employeeName: 'Yared',
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Community Manager',
      avatarColor: '#14b8a6',
      currentWork: 'Calendario redes junio + métricas semanales',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 74,
      objective: 'Publicar 12 piezas y superar 80k impresiones orgánicas',
      dueDate: daysAhead(10),
      notes: 'TikTok con mejor engagement. Meta en revisión.',
      priority: 'media',
      kpiObjectiveMonthKey: currentMonth,
      kpiAssignedByName: 'Orlando',
      kpiAssignedAt: isoAtDaysAgo(18, 11),
      linkedProjectId: 'proj-7',
    },
    {
      id: 't-roberto',
      employeeId: 'emp-roberto',
      employeeName: 'Roberto',
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Diseñador Gráfico',
      avatarColor: '#0086c0',
      currentWork: 'Kit de marca + banners Meta retargeting',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 58,
      objective: 'Completar 8 plantillas y 20 tamaños de banner',
      dueDate: daysAhead(6),
      notes: 'Coordinación con Andrea en paleta corporativa.',
      priority: 'alta',
      kpiObjectiveMonthKey: currentMonth,
      kpiAssignedByName: 'Orlando',
      kpiAssignedAt: isoAtDaysAgo(15, 10),
    },
    {
      id: 't-andrea',
      employeeId: 'emp-andrea',
      employeeName: 'Andrea',
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Diseñador Gráfico',
      avatarColor: '#9cd326',
      currentWork: 'Ilustraciones campaña verano — serie 6 piezas',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 48,
      objective: 'Entregar ilustraciones vectoriales listas para impresión',
      dueDate: daysAhead(9),
      notes: '3 de 6 piezas en revisión interna.',
      priority: 'alta',
      kpiObjectiveMonthKey: currentMonth,
      kpiAssignedByName: 'Orlando',
      kpiAssignedAt: isoAtDaysAgo(14, 11),
    },
    {
      id: 't-andres',
      employeeId: 'emp-andres',
      employeeName: 'Andres',
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Diseñador Gráfico',
      avatarColor: '#cab641',
      currentWork: 'BTL prepago + assets display campaña',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 67,
      objective: 'Producir material BTL y 20 banners display',
      dueDate: daysAhead(3),
      notes: 'Impresión externa confirmada para el lunes.',
      priority: 'alta',
      linkedProjectId: 'proj-6',
    },
  ];

  return {
    companyName: 'Yaavs',
    projects: [...DEFAULT_PROJECTS, ...extraProjects].map((p) => ({
      ...p,
      estimatedHours: plannedProjectDays(p) * 8,
      trackedMinutes: Math.round(plannedProjectDays(p) * 8 * 60 * (p.status === 'terminado' ? 0.85 : 0.55)),
    })),
    tasks,
  };
}

function briefFromProject(p: CreativeProject) {
  return {
    projectId: p.id,
    projectName: p.projectName,
    requestDate: p.requestDate,
    businessUnit: p.businessUnit,
    requestedBy: p.requestedBy,
    requestingDepartment: p.requestingDepartment,
    projectType: p.projectType,
    projectPriority: p.priority,
    commitmentDate: p.commitmentDate,
    internalArea: p.internalArea,
    collaborator: p.collaborator,
    projectStatus: p.status,
    projectComments: p.comments,
  };
}

function buildPendingAssignments(board: BoardState): TaskAssignment[] {
  const prepago = board.projects.find((p) => p.id === 'proj-1')!;
  const merch = board.projects.find((p) => p.id === 'proj-5')!;

  return [
    {
      id: 'asg-demo-pending-1',
      employeeId: 'emp-jorddy',
      employeeName: 'Jorddy Dylan',
      assignedById: 'u-orlando',
      assignedByName: 'Orlando',
      title: 'Ajustar key visual campaña prepago',
      objective:
        'Actualizar el key visual con el copy aprobado por dirección comercial y exportar variantes para stories.',
      dueDate: daysAhead(3),
      priority: 'alta',
      notes: 'Usar paleta azul eléctrico Yaavs. Entregar en Figma y PNG.',
      brief: briefFromProject(prepago),
      status: 'pending',
      createdAt: isoAtDaysAgo(1, 16, 20),
    },
    {
      id: 'asg-demo-pending-2',
      employeeId: 'emp-andrea',
      employeeName: 'Andrea',
      assignedById: 'u-orlando',
      assignedByName: 'Orlando',
      title: 'Ilustración hero merch Q2',
      objective: 'Diseñar ilustración principal para playera y termo del kit de colaboradores.',
      dueDate: daysAhead(5),
      priority: 'media',
      notes: 'RH confirmó tallas. Mantener estilo verano.',
      brief: briefFromProject(merch),
      status: 'pending',
      createdAt: isoAtDaysAgo(2, 10, 15),
    },
    {
      id: 'asg-demo-pending-3',
      employeeId: 'emp-roberto',
      employeeName: 'Roberto',
      assignedById: 'u-orlando',
      assignedByName: 'Orlando',
      title: 'Revisión banners Meta retargeting',
      objective: 'Aplicar correcciones de copy y reexportar en todos los tamaños para pauta.',
      dueDate: daysAhead(2),
      priority: 'alta',
      notes: 'Peso máximo 150 KB por archivo.',
      brief: briefFromProject(board.projects.find((p) => p.id === 'proj-9')!),
      status: 'pending',
      createdAt: isoAtDaysAgo(0, 9, 45),
    },
  ];
}

function buildHistoricalAssignments(): TaskAssignment[] {
  const mk = (partial: TaskAssignment): TaskAssignment => partial;
  return [
    mk({
      id: 'asg-may-1',
      employeeId: 'emp-jorddy',
      employeeName: 'Jorddy Dylan',
      assignedById: 'u-orlando',
      assignedByName: 'Orlando',
      title: 'Wireframes checkout',
      objective: 'Primera versión del flujo de checkout.',
      dueDate: dateInMonth(22, prevMonth),
      priority: 'alta',
      notes: '',
      status: 'accepted',
      createdAt: `${prevMonth}-05T14:00:00.000Z`,
      respondedAt: `${prevMonth}-05T16:30:00.000Z`,
    }),
    mk({
      id: 'asg-may-2',
      employeeId: 'emp-jesus',
      employeeName: 'Jesus',
      assignedById: 'u-orlando',
      assignedByName: 'Orlando',
      title: 'Calendario mayo redes',
      objective: 'Publicar 10 piezas en el mes.',
      dueDate: dateInMonth(28, prevMonth),
      priority: 'media',
      notes: '',
      status: 'accepted',
      createdAt: `${prevMonth}-02T11:00:00.000Z`,
      respondedAt: `${prevMonth}-02T12:00:00.000Z`,
    }),
    mk({
      id: 'asg-may-3',
      employeeId: 'emp-andres',
      employeeName: 'Andres',
      assignedById: 'u-orlando',
      assignedByName: 'Orlando',
      title: 'Banners display abril',
      objective: 'Entregar set completo Google/Meta.',
      dueDate: dateInMonth(18, prevMonth),
      priority: 'alta',
      notes: '',
      status: 'accepted',
      createdAt: `${prevMonth}-08T10:00:00.000Z`,
      respondedAt: `${prevMonth}-08T11:15:00.000Z`,
    }),
    mk({
      id: 'asg-may-4',
      employeeId: 'emp-roberto',
      employeeName: 'Roberto',
      assignedById: 'u-orlando',
      assignedByName: 'Orlando',
      title: 'PoP sucursales borrador',
      objective: 'Primera propuesta visual.',
      dueDate: dateInMonth(25, prevMonth),
      priority: 'media',
      notes: 'Rechazado por cambio de brief.',
      status: 'rejected',
      createdAt: `${prevMonth}-12T09:00:00.000Z`,
      respondedAt: `${prevMonth}-13T15:00:00.000Z`,
      rejectReason: 'Cambió la prioridad de impresión; se reenviará con nuevo brief.',
    }),
  ];
}

function buildMayPerformanceRecords(): MonthlyPerformanceRecord[] {
  const rows: Array<{
    employeeId: string;
    employeeName: string;
    kpiPercent: number;
    rating: MonthlyPerformanceRecord['rating'];
    objective: string;
    currentWork: string;
    status: TaskStatus;
    accepted: number;
    rejected: number;
  }> = [
    {
      employeeId: 'emp-orlando',
      employeeName: 'Orlando',
      kpiPercent: 91,
      rating: 'positive',
      objective: 'Coordinar entregas del área',
      currentWork: 'Cierre de mes mayo',
      status: 'completado',
      accepted: 2,
      rejected: 0,
    },
    {
      employeeId: 'emp-juancarlos',
      employeeName: 'Juan Carlos',
      kpiPercent: 79,
      rating: 'positive',
      objective: 'OKRs y reporte mensual',
      currentWork: 'Reporte mayo',
      status: 'completado',
      accepted: 1,
      rejected: 0,
    },
    {
      employeeId: 'emp-jorddy',
      employeeName: 'Jorddy Dylan',
      kpiPercent: 76,
      rating: 'positive',
      objective: 'Wireframes checkout',
      currentWork: 'UX checkout',
      status: 'completado',
      accepted: 1,
      rejected: 0,
    },
    {
      employeeId: 'emp-jesus',
      employeeName: 'Jesus',
      kpiPercent: 82,
      rating: 'positive',
      objective: 'Piezas video mayo',
      currentWork: 'Video institucional',
      status: 'completado',
      accepted: 1,
      rejected: 0,
    },
    {
      employeeId: 'emp-roberto',
      employeeName: 'Roberto',
      kpiPercent: 54,
      rating: 'regular',
      objective: 'Kit de marca',
      currentWork: 'Plantillas Canva',
      status: 'en_progreso',
      accepted: 0,
      rejected: 1,
    },
    {
      employeeId: 'emp-andrea',
      employeeName: 'Andrea',
      kpiPercent: 61,
      rating: 'regular',
      objective: 'Ilustraciones serie verano',
      currentWork: 'Ilustración 3 de 6',
      status: 'en_progreso',
      accepted: 1,
      rejected: 0,
    },
    {
      employeeId: 'emp-andres',
      employeeName: 'Andres',
      kpiPercent: 85,
      rating: 'positive',
      objective: 'Banners display',
      currentWork: 'Campaña performance',
      status: 'completado',
      accepted: 1,
      rejected: 0,
    },
  ];

  return rows.map((r) => ({
    id: `${r.employeeId}-${prevMonth}`,
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    monthKey: prevMonth,
    monthLabel: formatMonthLabel(prevMonth),
    kpiPercent: r.kpiPercent,
    rating: r.rating,
    objective: r.objective,
    currentWork: r.currentWork,
    status: r.status,
    message:
      r.rating === 'positive'
        ? '¡Excelente mes! Tu esfuerzo impulsa al equipo. Sigue así.'
        : r.rating === 'regular'
          ? 'Avance sólido. Enfócate en lo pendiente para subir tu KPI.'
          : 'Este mes costó más, pero cada día es una nueva oportunidad.',
    assignmentsAccepted: r.accepted,
    assignmentsRejected: r.rejected,
    closedAt: `${prevMonth}-28T18:00:00.000Z`,
    closedBy: 'auto' as const,
  }));
}

function monthKeyMonthsAgo(monthsAgo: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return getMonthKey(d);
}

function buildHistoricalPerformanceRecords(): MonthlyPerformanceRecord[] {
  const template = buildMayPerformanceRecords().filter((r) => r.employeeId !== 'emp-orlando');
  const records: MonthlyPerformanceRecord[] = [];
  const plan: Array<{ monthsAgo: number; delta: number }> = [
    { monthsAgo: 5, delta: -18 },
    { monthsAgo: 4, delta: -12 },
    { monthsAgo: 3, delta: -8 },
    { monthsAgo: 2, delta: -4 },
  ];

  for (const { monthsAgo, delta } of plan) {
    const monthKey = monthKeyMonthsAgo(monthsAgo);
    if (monthKey === prevMonth) continue;
    for (const row of template) {
      const kpiPercent = Math.min(100, Math.max(30, row.kpiPercent + delta));
      const rating =
        kpiPercent >= 75 ? 'positive' : kpiPercent < 50 ? 'negative' : 'regular';
      records.push({
        ...row,
        id: `${row.employeeId}-${monthKey}`,
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        kpiPercent,
        rating,
        closedAt: `${monthKey}-28T18:00:00.000Z`,
      });
    }
  }

  return records;
}

function buildDailyKpiStore(tasks: EmployeeTask[]): DailyKpiStore {
  const today = todayKey(now);
  const snapshots: DailyKpiSnapshot[] = [];

  for (const task of tasks) {
    const endPct = kpiPercent(task);
    const startPct = Math.max(8, endPct - 28 - hashOffset(task.employeeId, 12));
    const [y, m] = currentMonth.split('-').map(Number);
    const lastDay = Number(today.slice(8, 10));

    for (let day = 1; day <= lastDay; day++) {
      const dateKey = dateInMonth(day, currentMonth);
      const progress = day / Math.max(1, lastDay);
      const pct = Math.min(100, Math.round(startPct + (endPct - startPct) * progress));
      const prevDateKey = day === 1 ? '' : dateInMonth(day - 1, currentMonth);
      const prevPct =
        day === 1
          ? Math.max(0, startPct - 3)
          : Math.min(
              100,
              Math.round(startPct + (endPct - startPct) * ((day - 1) / Math.max(1, lastDay))),
            );
      const deltaPercent = pct - prevPct;

      snapshots.push({
        id: `${task.employeeId}-${dateKey}`,
        employeeId: task.employeeId,
        employeeName: task.employeeName,
        dateKey,
        monthKey: currentMonth,
        kpiPercent: pct,
        kpiCurrent: Math.round((pct / 100) * task.kpiTarget),
        kpiTarget: task.kpiTarget,
        status: task.status,
        progressed: deltaPercent > 0 || day % 5 === 0,
        deltaPercent,
        recordedAt: new Date(y, m - 1, day, 20, 0, 0).toISOString(),
      });
      void prevDateKey;
    }
  }

  return { snapshots };
}

function buildSocialMetrics(): SocialMetricsStore {
  const rows: Array<{
    platform: SocialPlatform;
    title: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    sentiment: ContentSentiment;
  }> = [
    { platform: 'tiktok', title: 'Lanzamiento prepago — hook 15 s', views: 42000, likes: 3100, comments: 186, shares: 420, sentiment: 'gusta' },
    { platform: 'instagram', title: 'Carrusel beneficios Yaavs Shop', views: 18500, likes: 920, comments: 64, shares: 110, sentiment: 'gusta' },
    { platform: 'meta', title: 'Pauta retargeting pospago', views: 67000, likes: 540, comments: 28, shares: 95, sentiment: 'regular' },
    { platform: 'tiktok', title: 'Behind the scenes — equipo creativo', views: 28000, likes: 2100, comments: 142, shares: 380, sentiment: 'gusta' },
    { platform: 'instagram', title: 'Reel tutorial app Yaavs', views: 15200, likes: 1100, comments: 88, shares: 210, sentiment: 'gusta' },
    { platform: 'instagram', title: 'Story encuesta — nuevo plan', views: 9800, likes: 430, comments: 210, shares: 40, sentiment: 'regular' },
    { platform: 'meta', title: 'Post orgánico Silemi', views: 12400, likes: 620, comments: 35, shares: 72, sentiment: 'gusta' },
    { platform: 'tiktok', title: 'Tips prepago en 30 s', views: 51000, likes: 4200, comments: 290, shares: 510, sentiment: 'gusta' },
    { platform: 'instagram', title: 'Merch colaboradores teaser', views: 11200, likes: 780, comments: 52, shares: 90, sentiment: 'gusta' },
    { platform: 'meta', title: 'Campaña display Silemi', views: 8900, likes: 310, comments: 18, shares: 44, sentiment: 'regular' },
    { platform: 'tiktok', title: 'UGC cliente satisfecho', views: 36000, likes: 2800, comments: 195, shares: 330, sentiment: 'gusta' },
    { platform: 'instagram', title: 'Infografía KPIs mayo', views: 7600, likes: 410, comments: 22, shares: 58, sentiment: 'gusta' },
  ];

  const entries: SocialContentEntry[] = rows.map((row, i) => {
    const day = Math.min(28, 2 + i * 2);
    const dateKey = dateInMonth(day);
    return {
      id: `social-demo-${i + 1}`,
      platform: row.platform,
      title: row.title,
      dateKey,
      monthKey: currentMonth,
      views: row.views,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      sentiment: row.sentiment,
      notes: 'Registro demo — métricas del mes en curso.',
      createdById: 'u-yared',
      createdByName: 'Yared',
      createdAt: isoAtDaysAgo(28 - day, 15, 30),
    };
  });

  return { entries };
}

function buildKpiObjectives(): KpiObjectiveAssignment[] {
  const accepted: KpiObjectiveAssignment[] = [
    'emp-orlando',
    'emp-juancarlos',
    'emp-yared',
    'emp-jorddy',
    'emp-jesus',
    'emp-roberto',
    'emp-andrea',
  ].map((employeeId, i) => {
    const names: Record<string, string> = {
      'emp-orlando': 'Orlando',
      'emp-juancarlos': 'Juan Carlos',
      'emp-yared': 'Yared',
      'emp-jorddy': 'Jorddy Dylan',
      'emp-jesus': 'Jesus',
      'emp-roberto': 'Roberto',
      'emp-andrea': 'Andrea',
    };
    const objectives: Record<string, string> = {
      'emp-orlando': 'Coordinar al equipo, indicaciones y cumplimiento de KPIs del mes',
      'emp-juancarlos': 'Cerrar reporte de campañas y proyección Q3',
      'emp-yared': 'Publicar 12 piezas y superar 80k impresiones orgánicas',
      'emp-jorddy': 'Entregar prototipo interactivo y handoff a desarrollo',
      'emp-jesus': 'Finalizar video 90 s y 4 variantes verticales',
      'emp-roberto': 'Completar 8 plantillas y 20 tamaños de banner',
      'emp-andrea': 'Entregar ilustraciones vectoriales listas para impresión',
    };
    return {
      id: `kpi-obj-${employeeId}`,
      employeeId,
      employeeName: names[employeeId],
      assignedById: 'u-orlando',
      assignedByName: 'Orlando',
      monthKey: currentMonth,
      monthLabel: formatMonthLabel(currentMonth),
      objective: objectives[employeeId],
      kpiTarget: 100,
      dueDate: daysAhead(12),
      notes: 'Objetivo mensual aprobado.',
      status: 'accepted' as const,
      createdAt: isoAtDaysAgo(20 - i, 9),
      respondedAt: isoAtDaysAgo(19 - i, 11),
    };
  });

  return [
    ...accepted,
    {
      id: 'kpi-obj-andres-pending',
      employeeId: 'emp-andres',
      employeeName: 'Andres',
      assignedById: 'u-orlando',
      assignedByName: 'Orlando',
      monthKey: currentMonth,
      monthLabel: formatMonthLabel(currentMonth),
      objective: 'Producir material BTL y 20 banners display con entrega antes del cierre de mes',
      kpiTarget: 100,
      dueDate: daysAhead(8),
      notes: 'Pendiente de aceptar por Andres.',
      status: 'pending',
      createdAt: isoAtDaysAgo(1, 8, 30),
    },
  ];
}

function buildActivityFeed(): ActivityEvent[] {
  const events: Array<{ kind: ActivityKind; message: string; actor: string; daysAgo: number }> = [
    { kind: 'assignment_sent', message: 'Indicación enviada a Roberto — banners Meta retargeting', actor: 'Orlando', daysAgo: 0 },
    { kind: 'project_status', message: 'Proyecto «Estrategia pospago Q3» marcado como terminado', actor: 'Juan Carlos', daysAgo: 6 },
    { kind: 'assignment_accepted', message: 'Jorddy aceptó indicación — key visual prepago', actor: 'Jorddy Dylan', daysAgo: 3 },
    { kind: 'project_completed', message: 'Landing Silemi entregada y publicada en staging', actor: 'Jorddy Dylan', daysAgo: 3 },
    { kind: 'assignment_sent', message: 'Indicación enviada a Andrea — ilustración merch', actor: 'Orlando', daysAgo: 2 },
    { kind: 'kpi_objective_sent', message: 'Objetivo KPI enviado a Andres (pendiente de aceptar)', actor: 'Orlando', daysAgo: 1 },
    { kind: 'project_status', message: 'Video tutorial app — en revisión interna', actor: 'Jesus', daysAgo: 4 },
    { kind: 'assignment_accepted', message: 'Jesus aceptó indicación del video tutorial', actor: 'Jesus', daysAgo: 8 },
    { kind: 'project_status', message: 'Material PoP sucursales — en producción', actor: 'Orlando', daysAgo: 7 },
    { kind: 'kpi_objective_accepted', message: 'Roberto aceptó objetivo KPI de junio', actor: 'Roberto', daysAgo: 6 },
    { kind: 'assignment_sent', message: 'Indicación enviada a Jorddy — ajustes checkout', actor: 'Orlando', daysAgo: 1 },
    { kind: 'project_completed', message: 'Cierre de mes mayo archivado en historial', actor: 'Sistema Yaavs', daysAgo: 10 },
    { kind: 'kpi_objective_accepted', message: 'Jorddy aceptó objetivo KPI de junio', actor: 'Jorddy Dylan', daysAgo: 7 },
    { kind: 'project_status', message: 'Calendario redes junio — en proceso', actor: 'Yared', daysAgo: 2 },
  ];

  return events.map((e, i) => ({
    id: `act-demo-${i}`,
    kind: e.kind,
    message: e.message,
    actorName: e.actor,
    at: isoAtDaysAgo(e.daysAgo, 10 + (i % 5), i * 3),
  }));
}

function buildCalendars(): CalendarStore {
  return {
    'u-orlando': {
      events: [
        {
          id: 'cal-orl-1',
          userId: 'u-orlando',
          title: 'Revisión semanal de proyectos',
          date: daysAhead(1),
          time: '10:00',
          reminderMinutes: 30,
          estimatedMinutes: 60,
          trackedMinutes: 0,
          done: false,
          notes: 'Con Juan Carlos y leads de diseño.',
        },
        {
          id: 'cal-orl-2',
          userId: 'u-orlando',
          title: 'Cierre parcial de mes — dirección',
          date: daysAhead(4),
          time: '16:00',
          reminderMinutes: 60,
          estimatedMinutes: 90,
          trackedMinutes: 0,
          done: false,
          notes: 'Presentar KPIs y proyectos activos.',
        },
      ],
      activeTimer: null,
    },
    'u-jorddy': {
      events: [
        {
          id: 'cal-jor-1',
          userId: 'u-jorddy',
          title: 'Test de usabilidad checkout',
          date: daysAhead(2),
          time: '11:30',
          reminderMinutes: 15,
          estimatedMinutes: 120,
          trackedMinutes: 45,
          done: false,
          notes: '5 usuarios internos.',
        },
      ],
      activeTimer: null,
    },
    'u-yared': {
      events: [
        {
          id: 'cal-yared-1',
          userId: 'u-yared',
          title: 'Publicación TikTok + Meta',
          date: daysAhead(0),
          time: '18:00',
          reminderMinutes: 30,
          estimatedMinutes: 45,
          trackedMinutes: 0,
          done: false,
          notes: 'Piezas aprobadas por Orlando.',
        },
      ],
      activeTimer: null,
    },
  };
}

export interface ProductionDemoBundle {
  board: BoardState;
  assignments: TaskAssignment[];
  performanceHistory: PerformanceHistoryStore;
  monthlyArchives: MonthlyArchiveStore;
  dailyKpiStore: DailyKpiStore;
  kpiObjectives: KpiObjectiveAssignment[];
  socialMetrics: SocialMetricsStore;
  activityFeed: ActivityEvent[];
  calendars: CalendarStore;
  attendance: AttendanceStore;
}

export function buildProductionDemoBundle(): ProductionDemoBundle {
  const board = buildBoard();
  const assignments = buildPendingAssignments(board);
  const historicalAssignments = buildHistoricalAssignments();
  const mayRecords = buildMayPerformanceRecords();
  const historicalRecords = buildHistoricalPerformanceRecords();

  const performanceHistory: PerformanceHistoryStore = {
    records: [...historicalRecords, ...mayRecords],
    lastAutoCloseMonthKey: currentMonth,
  };

  const mayBoard: BoardState = {
    ...board,
    tasks: board.tasks.map((t) => ({
      ...t,
      kpiObjectiveMonthKey: undefined,
      kpiAssignedByName: undefined,
      kpiAssignedAt: undefined,
    })),
  };

  const prevSnapshot = buildMonthSnapshot(
    prevMonth,
    mayBoard,
    historicalAssignments,
    mayBoard.tasks,
    performanceHistory,
    'auto',
  );

  const monthlyArchives: MonthlyArchiveStore = {
    snapshots: [prevSnapshot],
    lastRolloverMonthKey: currentMonth,
  };

  return {
    board,
    assignments,
    performanceHistory,
    monthlyArchives,
    dailyKpiStore: buildDailyKpiStore(board.tasks),
    kpiObjectives: buildKpiObjectives(),
    socialMetrics: buildSocialMetrics(),
    activityFeed: buildActivityFeed(),
    calendars: buildCalendars(),
    attendance: buildDemoAttendance(board.tasks),
  };
}
