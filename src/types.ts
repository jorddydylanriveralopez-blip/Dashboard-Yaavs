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

export interface AppSyncState {
  board: BoardState;
  assignments: TaskAssignment[];
  calendars: CalendarStore;
  passwordOverrides: Record<string, string>;
  performanceHistory?: PerformanceHistoryStore;
  updatedAt: string;
}
