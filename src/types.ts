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
  /** Correo para recordatorios de agenda. */
  email?: string;
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
  /** Referencia a imagen en la biblioteca compartida. */
  libraryAssetId?: string;
}

/** Imagen almacenada en la biblioteca compartida del equipo. */
export interface LibraryImage {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  width?: number | null;
  height?: number | null;
}

/** Respuesta enriquecida del CDN para programación. */
export interface LibraryImageApiItem {
  id: string;
  name: string;
  url: string;
  downloadUrl: string | null;
  apiUrl: string | null;
  mimeType: string;
  format: string;
  extension: string;
  size: number;
  sizeLabel: string;
  width: number | null;
  height: number | null;
  dimensions: string | null;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName: string;
}

export interface MediaCatalogResponse {
  name: string;
  version: string;
  publicPage: string | null;
  listUrl: string | null;
  count: number;
  updatedAt: string;
  items: LibraryImageApiItem[];
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

export type BusinessUnit =
  | 'yaavs_general'
  | 'prepago'
  | 'prepago_centro'
  | 'prepago_foraneo'
  | 'pospago'
  | 'silemi'
  | 'yaavs_shop'
  | 'arregla_mx'
  | 'academia_yaavs';

export type RequestingDepartment =
  | 'direccion_comercial'
  | 'direccion'
  | 'finanzas'
  | 'atencion_cliente'
  | 'rh'
  | 'almacen'
  | 'capacitacion'
  | 'ti'
  | 'marketing'
  | 'ventas';

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
  | 'diseno_grafico'
  | 'diseno_web'
  | 'diseno_audiovisual'
  | 'redes_sociales';

export type Collaborator =
  | 'andrea'
  | 'roberto'
  | 'jorddy'
  | 'andres'
  | 'jesus'
  | 'carlos'
  | 'yared'
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
  /** Varios colaboradores asignados; incluye "todos" para todo el equipo. */
  collaborators?: Collaborator[];
  /** Empleado al que se asignó el proyecto (para privacidad entre colaboradores). */
  assignedEmployeeId?: string;
  /**
   * Aceptación del colaborador asignado.
   * pending = esperando respuesta; accepted/declined = ya respondió.
   */
  acceptanceStatus?: 'pending' | 'accepted' | 'declined';
  acceptedAt?: string;
  acceptedByName?: string;
  declinedReason?: string;
  status: ProjectStatus;
  finishedDate?: string;
  comments: string;
  attachments?: FileAttachment[];
  /** Resumen ligero para la UI cuando los archivos viven en IndexedDB. */
  attachmentCount?: number;
  /** El colaborador subió evidencia de entrega al marcar trabajo concluido. */
  hasCompletionProof?: boolean;
  completedAt?: string;
  completedByName?: string;
  /** Horas presupuestadas para el proyecto (p. ej. 24 h). */
  estimatedHours?: number;
  /** Minutos registrados trabajando en el proyecto. */
  trackedMinutes?: number;
  /** Historial de registros de tiempo (cronómetro o manual). */
  timeLogs?: ProjectTimeLog[];
  /** Bitácora de avances del colaborador (texto + evidencia). */
  progressUpdates?: ProjectProgressUpdate[];
  createdAt: string;
  updatedAt: string;
}

/** Avance registrado por el colaborador: qué hizo y su evidencia. */
export interface ProjectProgressUpdate {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  /**
   * Apartado opcional (solo colaboradores): links de páginas, referencias, etc.
   */
  linksNote?: string;
  /** Compatibilidad con evidencias antiguas guardadas como imágenes. */
  images?: { name: string; dataUrl: string }[];
  /** Evidencias actuales: imágenes, videos, PDF, documentos u otros archivos. */
  files?: FileAttachment[];
  createdAt: string;
}

export interface ProjectTimeLog {
  id: string;
  minutes: number;
  loggedAt: string;
  loggedByName: string;
  source: 'timer' | 'manual';
  note?: string;
}

export interface BoardState {
  tasks: EmployeeTask[];
  projects: CreativeProject[];
  companyName: string;
}

export type CalendarEventKind = 'event' | 'busy';

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
  /** Correo de recordatorio ya enviado. */
  emailRemindedAt?: string;
  /** `busy` = día/horario ocupado (sin cronómetro típico). */
  kind?: CalendarEventKind;
  /** Visible en la agenda del equipo. */
  shared?: boolean;
  /** Nombre del dueño para la vista de equipo. */
  ownerName?: string;
  /** Origen del evento (Outlook / ICS / local). */
  source?: 'local' | 'outlook' | 'ics';
  /** ID externo para reimportar sin duplicar (UUID Outlook, UID ICS…). */
  externalId?: string;
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
  collaborators?: Collaborator[];
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

/** Límite de proyectos activos por colaborador. */
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
  | 'project_hours_exceeded'
  | 'project_early_delivery'
  | 'assignment_sent'
  | 'assignment_accepted'
  | 'assignment_rejected'
  | 'kpi_objective_sent'
  | 'kpi_objective_accepted'
  | 'team_member_added'
  | 'team_member_removed'
  | 'project_status'
  | 'project_progress'
  | 'project_accepted'
  | 'project_declined';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  message: string;
  actorName: string;
  at: string;
}

export interface TeamChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatarColor: string;
  authorAvatarUrl?: string;
  text: string;
  createdAt: string;
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

export type AttendanceStatus = 'present' | 'absent' | 'sick' | 'late' | 'vacation';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  dateKey: string;
  monthKey: string;
  status: AttendanceStatus;
  notes: string;
  recordedById: string;
  recordedByName: string;
  updatedAt: string;
}

export interface AttendanceStore {
  records: AttendanceRecord[];
}

/** Nota personal del gerente para un colaborador en un mes. */
export interface ManagerEmployeeObservation {
  id: string;
  employeeId: string;
  monthKey: string;
  text: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
}

export interface ManagerObservationsStore {
  items: ManagerEmployeeObservation[];
}

export interface SocialAccountLink {
  handle: string;
  url: string;
  updatedByName?: string;
  updatedAt?: string;
}

export type SocialAccountsStore = Partial<Record<SocialPlatform, SocialAccountLink>>;

/** Trabajo extra que el colaborador registra aparte de los proyectos oficiales. */
export interface ExtraProjectEntry {
  id: string;
  /** Colaborador principal (compatibilidad con registros antiguos). */
  employeeId: string;
  employeeName: string;
  /** Todos los colaboradores que participaron. */
  employeeIds?: string[];
  employeeNames?: string[];
  projectName: string;
  /** Minutos invertidos; es opcional. */
  minutes?: number;
  /** Fecha de compromiso (YYYY-MM-DD). */
  doneDate: string;
  notes?: string;
  /**
   * Estado de aprobación por Orlando.
   * Registros antiguos sin status se tratan como approved.
   */
  status?: ExtraProjectStatus;
  reviewedAt?: string;
  reviewedById?: string;
  reviewedByName?: string;
  rejectReason?: string;
  /** Proyecto activo creado al aprobar este extra. */
  linkedProjectId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExtraProjectStatus = 'pending' | 'approved' | 'rejected';

/** Cronómetro de tiempo extra en oficina (por colaborador, día actual). */
export interface OfficeOvertimeEntry {
  employeeId: string;
  employeeName: string;
  /** ISO si el cronómetro está corriendo. */
  runningStartedAt: string | null;
  /** YYYY-MM-DD del arranque actual. */
  runningDate: string | null;
  /** Segundos ya acumulados hoy (tras pausas). */
  todaySeconds: number;
  /** Día al que aplica todaySeconds. */
  todayDate: string;
  updatedAt: string;
}

export type OfficeOvertimeStore = Record<string, OfficeOvertimeEntry>;

export interface AppSyncState {
  board: BoardState;
  assignments: TaskAssignment[];
  chatMessages?: TeamChatMessage[];
  calendars: CalendarStore;
  passwordOverrides: Record<string, string>;
  performanceHistory?: PerformanceHistoryStore;
  teamRoster?: TeamRosterState;
  socialAccounts?: SocialAccountsStore;
  /** Proyectos eliminados: id → ISO deletedAt (tombstones anti-resurrección en sync). */
  deletedProjectIds?: Record<string, string>;
  /** Bitácora de proyectos extra por colaborador. */
  extraProjects?: ExtraProjectEntry[];
  /** Tiempo extra en oficina por empleado. */
  officeOvertime?: OfficeOvertimeStore;
  /** Asistencias del área (sincronizadas celular ↔ web). */
  attendanceStore?: AttendanceStore;
  updatedAt: string;
}
