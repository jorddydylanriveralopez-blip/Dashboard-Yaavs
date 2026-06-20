export type UserRole = 'admin' | 'lider' | 'empleado';

export type TaskStatus =
  | 'sin_empezar'
  | 'en_progreso'
  | 'en_revision'
  | 'completado'
  | 'bloqueado';

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  avatarColor: string;
  /** Foto de perfil (data URL). */
  avatarUrl?: string;
  employeeId?: string;
}

/** Archivo o imagen adjunta (base64 pequeño o blob en IndexedDB si es grande). */
export interface FileAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** data: URL (inline) o blob: URL (sesión, archivos grandes). */
  dataUrl: string;
  createdAt: string;
  /** Si true, el binario está en IndexedDB (store blobs), no en dataUrl. */
  blobStored?: boolean;
}

export interface EmployeeTask {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  roleTitle?: string;
  avatarColor: string;
  currentWork: string;
  status: TaskStatus;
  kpiTarget: number;
  kpiCurrent: number;
  objective: string;
  dueDate: string;
  notes: string;
  priority: 'baja' | 'media' | 'alta';
  attachmentUrl?: string;
  attachments?: FileAttachment[];
  assignedByName?: string;
  assignedById?: string;
  assignedAt?: string;
  lastAssignmentId?: string;
  /** Proyecto creativo vinculado al aceptar una indicación con brief. */
  linkedProjectId?: string;
  /** Mes (YYYY-MM) del objetivo KPI asignado por gerente/coordinador. */
  kpiObjectiveMonthKey?: string;
  kpiAssignedByName?: string;
  kpiAssignedAt?: string;
}

export type BusinessUnit = 'prepago' | 'pospago' | 'silemi' | 'yaavs_shop';

export type RequestingDepartment =
  | 'direccion_comercial'
  | 'direccion'
  | 'finanzas'
  | 'atencion_cliente'
  | 'rh'
  | 'almacen'
  | 'capacitacion'
  | 'ti';

export type ProjectType =
  | 'campana_creativa'
  | 'material_pop'
  | 'diseno_grafico'
  | 'video'
  | 'estrategia'
  | 'activacion_btl'
  | 'diseno_web'
  | 'merch'
  | 'community_manager';

export type ProjectPriority = 'baja' | 'media' | 'alta_urgente';

export type InternalArea =
  | 'diseno_web'
  | 'diseno_corporativo'
  | 'diseno_editorial'
  | 'diseno_audiovisual'
  | 'community_manager'
  | 'produccion'
  | 'mercadotecnia'
  | 'diseno_grafico';

export type Collaborator =
  | 'andrea'
  | 'roberto'
  | 'jorddy'
  | 'andres'
  | 'jesus'
  | 'carlos'
  | 'ana'
  | 'todos';

export type ProjectStatus =
  | 'nuevo'
  | 'esperando_info'
  | 'en_proceso'
  | 'revision_interna'
  | 'revision_externa'
  | 'aprobado'
  | 'en_produccion'
  | 'terminado';

export interface CreativeProject {
  id: string;
  requestDate: string;
  projectName: string;
  businessUnit: BusinessUnit;
  requestedBy: string;
  requestingDepartment: RequestingDepartment;
  projectType: ProjectType;
  priority: ProjectPriority;
  commitmentDate: string;
  /** El colaborador ya fijó la fecha de compromiso (solo puede hacerlo una vez). */
  commitmentDateLocked?: boolean;
  internalArea: InternalArea;
  collaborator: Collaborator;
  /** Empleado al que se asignó el proyecto (para privacidad entre colaboradores). */
  assignedEmployeeId?: string;
  status: ProjectStatus;
  finishedDate?: string;
  comments: string;
  attachments?: FileAttachment[];
  /** Resumen ligero para la UI cuando los archivos viven en IndexedDB. */
  attachmentCount?: number;
  /** El colaborador subió foto de entrega al marcar trabajo concluido. */
  hasCompletionProof?: boolean;
  completedAt?: string;
  completedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardState {
  tasks: EmployeeTask[];
  projects: CreativeProject[];
  companyName: string;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  date: string;
  time: string;
  reminderMinutes: number;
  estimatedMinutes: number;
  trackedMinutes: number;
  done: boolean;
  notes: string;
  remindedAt?: string;
}

export interface ActiveTimer {
  eventId: string;
  startedAt: string;
}

export interface UserCalendarState {
  events: CalendarEvent[];
  activeTimer: ActiveTimer | null;
}

export type CalendarStore = Record<string, UserCalendarState>;

export type AssignmentStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

/** Datos del proyecto creativo vinculados a una indicación. */
export interface AssignmentBrief {
  projectId?: string;
  projectName: string;
  requestDate: string;
  businessUnit: BusinessUnit;
  requestedBy: string;
  requestingDepartment: RequestingDepartment;
  projectType: ProjectType;
  projectPriority: ProjectPriority;
  commitmentDate: string;
  internalArea: InternalArea;
  collaborator: Collaborator;
  projectStatus?: ProjectStatus;
  projectComments?: string;
}

export interface TaskAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  assignedById: string;
  assignedByName: string;
  title: string;
  objective: string;
  dueDate: string;
  priority: 'baja' | 'media' | 'alta';
  notes: string;
  attachmentUrl?: string;
  attachments?: FileAttachment[];
  /** Origen y contexto del proyecto (solicitud, área, unidad, etc.). */
  brief?: AssignmentBrief;
  status: AssignmentStatus;
  createdAt: string;
  respondedAt?: string;
  rejectReason?: string;
}

/** Objetivo KPI mensual enviado por gerente/coordinador; el colaborador debe aceptarlo. */
export interface KpiObjectiveAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  assignedById: string;
  assignedByName: string;
  monthKey: string;
  monthLabel: string;
  objective: string;
  kpiTarget: number;
  dueDate: string;
  notes: string;
  status: AssignmentStatus;
  createdAt: string;
  respondedAt?: string;
  rejectReason?: string;
}

/** Límite de trabajos activos por colaborador (proyectos + indicaciones pendientes). */
export interface WorkloadLimitsStore {
  /** Máximo por defecto si no hay límite individual. */
  defaultMax: number;
  /** Máximo por employeeId. */
  byEmployee: Record<string, number>;
}

export interface WorkloadBreakdown {
  projects: number;
  pendingAssignments: number;
  total: number;
}

export interface WorkloadCheckResult {
  employeeId: string;
  employeeName: string;
  current: WorkloadBreakdown;
  max: number;
  /** Tras sumar addSlots (p. ej. 1 trabajo nuevo). */
  projected: number;
  allowed: boolean;
  saturated: boolean;
}

export type WorkloadActionResult =
  | { ok: true }
  | { ok: false; reason: 'workload_limit'; status: WorkloadCheckResult }
  | { ok: false; reason: 'invalid_override' }
  | { ok: false; reason: 'forbidden' };

/** Calificación del cierre de mes (KPI + cumplimiento). */
export type PerformanceRating = 'positive' | 'regular' | 'negative';

/** Registro guardado al cerrar cada mes por colaborador. */
export interface MonthlyPerformanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  monthKey: string;
  monthLabel: string;
  kpiPercent: number;
  rating: PerformanceRating;
  objective: string;
  currentWork: string;
  status: TaskStatus;
  message: string;
  assignmentsAccepted: number;
  assignmentsRejected: number;
  closedAt: string;
  closedBy: 'auto' | 'manager';
}

export interface PerformanceHistoryStore {
  records: MonthlyPerformanceRecord[];
  lastAutoCloseMonthKey?: string;
}

/** Respaldo completo de un mes cerrado (descargable). */
export interface MonthlyArchiveSnapshot {
  monthKey: string;
  monthLabel: string;
  archivedAt: string;
  closedBy: 'auto' | 'manager';
  performance: MonthlyPerformanceRecord[];
  projectsCompleted: CreativeProject[];
  projectsActive: CreativeProject[];
  assignments: TaskAssignment[];
  teamSnapshot: EmployeeTask[];
  summary: {
    teamSize: number;
    projectsCompleted: number;
    projectsActive: number;
    assignmentsTotal: number;
    assignmentsAccepted: number;
    assignmentsRejected: number;
    kpiAverage: number;
  };
}

export interface MonthlyArchiveStore {
  snapshots: MonthlyArchiveSnapshot[];
  /** Mes en curso tras el último reinicio mensual (YYYY-MM). */
  lastRolloverMonthKey?: string;
}

/** Captura diaria del avance KPI de cada colaborador. */
export interface DailyKpiSnapshot {
  id: string;
  employeeId: string;
  employeeName: string;
  dateKey: string;
  monthKey: string;
  kpiPercent: number;
  kpiCurrent: number;
  kpiTarget: number;
  status: TaskStatus;
  /** Avanzó respecto al día anterior (subió KPI o entregó). */
  progressed: boolean;
  deltaPercent: number;
  recordedAt: string;
}

export interface DailyKpiStore {
  snapshots: DailyKpiSnapshot[];
}

export type SocialPlatform = 'tiktok' | 'meta' | 'instagram' | 'youtube' | 'otro';

export type ContentSentiment = 'gusta' | 'regular' | 'no_gusta';

/** Publicación o pieza registrada por community manager. */
export interface SocialContentEntry {
  id: string;
  platform: SocialPlatform;
  title: string;
  dateKey: string;
  monthKey: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  sentiment: ContentSentiment;
  notes: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

export interface SocialMetricsStore {
  entries: SocialContentEntry[];
}

export type ActivityKind =
  | 'project_completed'
  | 'assignment_sent'
  | 'assignment_accepted'
  | 'kpi_objective_sent'
  | 'kpi_objective_accepted'
  | 'team_member_added'
  | 'team_member_removed'
  | 'project_status';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  message: string;
  actorName: string;
  at: string;
}

export interface TeamRosterState {
  added: User[];
  removedUserIds: string[];
}

/** Personalización de perfil por usuario (login, foto). */
export interface UserProfileCustomization {
  username?: string;
  avatarUrl?: string;
}

export type UserProfilesStore = Record<string, UserProfileCustomization>;

export interface AppSyncState {
  board: BoardState;
  assignments: TaskAssignment[];
  calendars: CalendarStore;
  passwordOverrides: Record<string, string>;
  performanceHistory?: PerformanceHistoryStore;
  teamRoster?: TeamRosterState;
  updatedAt: string;
}
