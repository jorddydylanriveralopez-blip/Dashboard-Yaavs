import type { AssignmentStatus, TaskStatus } from './types';

export const COMPANY_NAME = 'Yaavs';
/** Logo negro para fondos blancos (panel, login, PWA). */
export const LOGO_URL =
  'https://assets.zyrosite.com/EnigzBPrgZr5GxnU/recurso-77-pP4VA9UNvFrtfbx3.png';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  sin_empezar: 'Sin empezar',
  en_progreso: 'En progreso',
  en_revision: 'En revisión',
  completado: 'Completado',
  bloqueado: 'Bloqueado',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  sin_empezar: '#c4c4c4',
  en_progreso: '#fdab3d',
  en_revision: '#579bfc',
  completado: '#00c875',
  bloqueado: '#e2445c',
};

/** Súbelo cuando cambies seed/usuarios para forzar migración en clientes antiguos. */
export const BOARD_SCHEMA_VERSION = 12;

/** Nombres viejos del proyecto (TeamBoard / Mi Empresa) → Yaavs */
export const LEGACY_COMPANY_NAMES = [
  'mi empresa',
  'teamboard',
  'team board',
  'empresa-board',
  'empresa board',
] as const;

export function normalizeCompanyName(name: string | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return COMPANY_NAME;
  if (LEGACY_COMPANY_NAMES.includes(trimmed.toLowerCase() as (typeof LEGACY_COMPANY_NAMES)[number])) {
    return COMPANY_NAME;
  }
  return trimmed;
}

export const STORAGE_KEY = 'empresa-board-v1';
/** id → ISO deletedAt; evita que un pull reaparezca proyectos borrados. */
export const DELETED_PROJECTS_KEY = 'empresa-board-deleted-projects-v1';
export const VERSION_KEY = 'empresa-board-schema-version';
export const SESSION_KEY = 'empresa-board-session';
export const CALENDAR_STORAGE_KEY = 'empresa-board-calendar-v1';
/** Correos de recordatorio de agenda por userId. */
export const CALENDAR_EMAIL_BY_USER: Record<string, string> = {
  'u-orlando': 'orlando.villagomez@yaavs.com.mx',
};
export const ASSIGNMENTS_STORAGE_KEY = 'empresa-board-assignments-v1';
export const PASSWORD_OVERRIDES_KEY = 'empresa-board-passwords';
export const SESSION_EXPIRY_KEY = 'empresa-board-session-expiry';
export const ONBOARDING_KEY = 'empresa-board-onboarding-done';
export const LAST_ASSIGNMENT_CHECK_KEY = 'empresa-board-last-asg-check';
export const EMPLOYEE_NOTIFICATIONS_SEEN_KEY = 'empresa-board-notifications-seen';
export const SOCIAL_METRICS_KEY = 'empresa-board-social-metrics-v1';
export const GA_REPORT_CACHE_KEY = 'empresa-board-ga-report-v1';
export const DAILY_KPI_SNAPSHOTS_KEY = 'empresa-board-daily-kpi-v1';
export const KPI_OBJECTIVES_KEY = 'empresa-board-kpi-objectives-v1';
export const WORKLOAD_LIMITS_KEY = 'empresa-board-workload-limits-v2';
export const USER_PROFILES_KEY = 'empresa-board-user-profiles-v1';
export const PERFORMANCE_HISTORY_KEY = 'empresa-board-performance-history-v1';
export const MONTHLY_ARCHIVES_KEY = 'empresa-board-monthly-archives-v1';
export const PERFORMANCE_ALERT_KEY = 'empresa-board-performance-alert';
export const EMPLOYEE_PHONES_KEY = 'empresa-board-employee-phones';
export const TEAM_ROSTER_STORAGE_KEY = 'empresa-board-team-roster-v1';
export const ACTIVITY_FEED_KEY = 'empresa-board-activity-v1';
export const ATTENDANCE_STORAGE_KEY = 'empresa-board-attendance-v1';
export const MANAGER_OBSERVATIONS_KEY = 'empresa-board-manager-observations-v1';
export const TEAM_CHAT_STORAGE_KEY = 'empresa-board-team-chat-v1';
export const IMAGE_LIBRARY_CACHE_KEY = 'empresa-board-image-library-cache-v1';
export const SOCIAL_ACCOUNTS_KEY = 'empresa-board-social-accounts-v1';
export const EXTRA_PROJECTS_KEY = 'empresa-board-extra-projects-v1';
/** Página pública del almacén de imágenes (CDN). */
export const MEDIA_CDN_PATH = '/almacen';

/** Versión del arranque en producción (subirla fuerza reset a día uno en cada dispositivo). */
export const PRODUCTION_DEMO_SEED_KEY = 'yaavs-production-demo-seed';
export const PRODUCTION_DEMO_SEED_VERSION = '6';

/** KPI ≥ este % = calificación positiva (aprobado). */
export const KPI_POSITIVE_THRESHOLD = 75;
/** KPI < este % = calificación negativa. */
export const KPI_NEGATIVE_THRESHOLD = 50;
/** Meses seguidos en negativo antes de alerta al empleado. */
export const NEGATIVE_STREAK_ALERT_MONTHS = 3;

/** Trabajos activos máximos por colaborador (proyectos + indicaciones pendientes). */
export const DEFAULT_WORKLOAD_MAX = 5;

/** Tamaño máximo de foto de perfil (data URL en localStorage). */
export const MAX_PROFILE_AVATAR_BYTES = 2 * 1024 * 1024;

export const SESSION_HOURS = 8;

export const RATING_LABELS = {
  positive: 'Aprobado',
  regular: 'En proceso',
  negative: 'Por mejorar',
} as const;

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  pending: 'Pendiente de aceptar',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

export const PRIORITY_LABELS = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
} as const;

export const REMINDER_OPTIONS = [
  { value: 0, label: 'Sin recordatorio' },
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 día antes' },
] as const;
