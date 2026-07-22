import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  EMPTY_BOARD,
  MARKETING_DEPARTMENT,
} from '../data/seed';
import { USERS } from '../data/users';
import { displayNameForEmployee } from '../data/teamDisplayNames';
import {
  canRemoveTeamMember,
  defaultTeamRoster,
  findUserById,
  getActiveUsers,
  getRemovedEmployeeIds,
  isValidUsername,
  loadTeamRoster,
  normalizeUsername,
  pickAvatarColor,
  saveTeamRoster,
  type AddTeamMemberInput,
  type TeamRosterState,
} from '../utils/teamRoster';
import {
  checkApiHealth,
  fetchSyncState,
  isApiEnabled,
  pushSyncState,
} from '../api/client';
import { saveAssignmentAttachments } from '../utils/attachmentStore';
import { syncCalendarForReminders } from '../api/calendar';
import { notifyPush, subscribeToPush } from '../api/pushClient';
import {
  ASSIGNMENTS_STORAGE_KEY,
  BOARD_SCHEMA_VERSION,
  CALENDAR_STORAGE_KEY,
  CALENDAR_EMAIL_BY_USER,
  DELETED_PROJECTS_KEY,
  EMPLOYEE_PHONES_KEY,
  PASSWORD_OVERRIDES_KEY,
  SOCIAL_METRICS_KEY,
  SOCIAL_ACCOUNTS_KEY,
  EXTRA_PROJECTS_KEY,
  OFFICE_OVERTIME_KEY,
  USER_PROFILES_KEY,
  WORKLOAD_LIMITS_KEY,
  DAILY_KPI_SNAPSHOTS_KEY,
  KPI_OBJECTIVES_KEY,
  MONTHLY_ARCHIVES_KEY,
  normalizeCompanyName,
  PERFORMANCE_HISTORY_KEY,
  MANAGER_OBSERVATIONS_KEY,
  TEAM_CHAT_STORAGE_KEY,
  SESSION_EXPIRY_KEY,
  SESSION_HOURS,
  SESSION_KEY,
  STORAGE_KEY,
  VERSION_KEY,
} from '../constants';
import {
  applyMonthClose,
  buildMonthlyRecord,
  formatMonthLabel,
  getMonthKey,
} from '../utils/performanceHistory';
import { canSendKpiObjectives, canManageWorkloadLimits } from '../utils/kpiPermissions';
import { recordDailySnapshots } from '../utils/dailyKpiSnapshots';
import {
  buildMonthSnapshot,
  ensureMonthlyRollover,
  stashRolloverNotice,
  upsertSnapshot,
} from '../utils/monthlyArchive';
import {
  clearedTaskWork,
  filterActiveProjects,
  filterCompletedProjects,
} from '../utils/activeItems';
import {
  loadActivityFeed,
  prependActivity,
} from '../utils/activityFeed';
import {
  findUserByLoginName,
  loadUserProfiles,
  mergeProfilePatch,
  validateUsernameChange,
  withUserProfile,
} from '../utils/userProfiles';
import {
  buildWorkloadCheck,
  normalizeWorkloadLimits,
  EMPTY_WORKLOAD_LIMITS,
} from '../utils/workloadLimits';
import {
  collaboratorForEmployeeId,
  employeeIdForCollaboratorSlug,
  projectVisibleToUser,
} from '../utils/collaboratorMap';
import {
  getProjectCollaborators,
  normalizeProjectCollaborators,
  patchForCollaboratorsChange,
  sanitizeProjectCollaborators,
} from '../utils/projectCollaborators';
import {
  loadAttendanceStore,
  saveAttendanceStore,
  upsertAttendance,
  mergeAttendanceImport,
} from '../utils/attendance';
import { MAX_PROGRESS_FILES } from '../utils/fileAttachments';
import {
  formatOvertimeShort,
  overtimeSecondsAfterSix,
  sixPmMsOnLocalDay,
  todayDateKey,
} from '../utils/officeOvertime';
import {
  loadManagerObservations,
  upsertManagerObservation,
} from '../utils/managerObservations';
import {
  estimatedHoursForProject,
  isEarlyDelivery,
  isHoursExceeded,
} from '../utils/projectHours';
import type {
  ActivityEvent,
  AppSyncState,
  AttendanceStore,
  BoardState,
  CalendarEvent,
  CalendarStore,
  CreativeProject,
  EmployeeTask,
  MonthlyPerformanceRecord,
  MonthlyArchiveStore,
  PerformanceHistoryStore,
  ProjectProgressUpdate,
  AssignmentBrief,
  Collaborator,
  FileAttachment,
  DailyKpiStore,
  ContentSentiment,
  SocialPlatform,
  SocialMetricsStore,
  SocialAccountsStore,
  ExtraProjectEntry,
  OfficeOvertimeEntry,
  OfficeOvertimeStore,
  KpiObjectiveAssignment,
  TaskAssignment,
  TeamChatMessage,
  User,
  UserCalendarState,
  WorkloadActionResult,
  WorkloadCheckResult,
  WorkloadLimitsStore,
  UserProfilesStore,
  ManagerObservationsStore,
  ManagerEmployeeObservation,
} from '../types';

interface AppContextValue {
  user: User | null;
  board: BoardState;
  calendar: UserCalendarState;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  spyMode: boolean;
  enterSpyMode: () => boolean;
  exitSpyMode: () => void;
  enablePushNotifications: () => Promise<{ ok: boolean; reason?: string }>;
  canEditAll: boolean;
  canSendKpiObjectives: boolean;
  canManageWorkloadLimits: boolean;
  workloadLimits: WorkloadLimitsStore;
  getWorkloadCheck: (
    employeeId: string,
    options?: { excludeProjectId?: string; addSlots?: number },
  ) => WorkloadCheckResult;
  setDefaultWorkloadLimit: (max: number) => void;
  setEmployeeWorkloadLimit: (employeeId: string, max: number) => void;
  verifyManagerPassword: (password: string) => boolean;
  canEditTask: (task: EmployeeTask) => boolean;
  updateTask: (id: string, patch: Partial<EmployeeTask>) => void;
  addTask: () => void;
  deleteTask: (id: string) => void;
  clearCompletedWork: (id: string) => void;
  deleteAssignment: (id: string) => void;
  activeUsers: User[];
  addTeamMember: (input: AddTeamMemberInput) => { ok: boolean; error?: string };
  removeTeamMember: (employeeId: string) => { ok: boolean; error?: string };
  setCompanyName: (name: string) => void;
  filter: string;
  setFilter: (f: string) => void;
  addCalendarEvent: (input: Omit<CalendarEvent, 'id' | 'userId' | 'trackedMinutes' | 'done' | 'remindedAt'>) => void;
  updateCalendarEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
  toggleCalendarDone: (id: string) => void;
  startTimer: (eventId: string) => void;
  stopTimer: () => void;
  markEventReminded: (id: string) => void;
  markEventEmailReminded: (id: string) => void;
  assignments: TaskAssignment[];
  myPendingAssignments: TaskAssignment[];
  pendingAssignmentsCount: number;
  createAssignment: (
    input: {
      employeeId: string;
      title: string;
      objective: string;
      dueDate: string;
      priority: 'baja' | 'media' | 'alta';
      notes: string;
      attachmentUrl?: string;
      attachments?: FileAttachment[];
      brief?: AssignmentBrief;
    },
    options?: { overridePassword?: string },
  ) => WorkloadActionResult;
  acceptAssignment: (id: string) => void;
  rejectAssignment: (id: string, reason?: string) => void;
  cancelAssignment: (id: string) => void;
  changePassword: (current: string, next: string) => boolean;
  updateProfile: (input: {
    username?: string;
    avatarUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
  }) => { ok: true } | { ok: false; error: string };
  syncOnline: boolean;
  assignmentSearch: string;
  setAssignmentSearch: (q: string) => void;
  performanceHistory: PerformanceHistoryStore;
  monthlyArchives: MonthlyArchiveStore;
  closeCurrentMonth: () => void;
  closeCurrentMonthWithRecords: (records: MonthlyPerformanceRecord[]) => void;
  marketingTasks: EmployeeTask[];
  projects: CreativeProject[];
  completedProjects: CreativeProject[];
  visibleProjects: CreativeProject[];
  visibleCompletedProjects: CreativeProject[];
  addProject: () => CreativeProject;
  /** Publica un borrador en el tablero (solo entonces aparece en Proyectos). */
  commitProject: (project: CreativeProject) => void;
  updateProject: (
    id: string,
    patch: Partial<CreativeProject>,
    options?: { overridePassword?: string },
  ) => WorkloadActionResult;
  deleteProject: (id: string) => void;
  acceptProject: (id: string) => void;
  declineProject: (id: string, reason?: string) => void;
  employeePhones: Record<string, string>;
  setEmployeePhone: (employeeId: string, phone: string) => void;
  activityFeed: ActivityEvent[];
  kpiObjectives: KpiObjectiveAssignment[];
  myPendingKpiObjectives: KpiObjectiveAssignment[];
  pendingKpiObjectivesCount: number;
  createKpiObjective: (input: {
    employeeId: string;
    objective: string;
    kpiTarget: number;
    dueDate: string;
    notes: string;
  }) => void;
  acceptKpiObjective: (id: string) => void;
  rejectKpiObjective: (id: string, reason?: string) => void;
  cancelKpiObjective: (id: string) => void;
  dailyKpiStore: DailyKpiStore;
  socialMetrics: SocialMetricsStore;
  addSocialEntry: (input: {
    platform: SocialPlatform;
    title: string;
    dateKey: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    sentiment: ContentSentiment;
    notes: string;
  }) => void;
  deleteSocialEntry: (id: string) => void;
  socialAccounts: SocialAccountsStore;
  setSocialAccount: (
    platform: SocialPlatform,
    link: { handle: string; url: string } | null,
  ) => void;
  extraProjects: ExtraProjectEntry[];
  visibleExtraProjects: ExtraProjectEntry[];
  addExtraProject: (input: {
    projectName: string;
    employeeIds: string[];
    minutes?: number;
    doneDate: string;
    notes?: string;
  }) => ExtraProjectEntry | null;
  updateExtraProject: (
    id: string,
    patch: Partial<
      Pick<
        ExtraProjectEntry,
        'projectName' | 'employeeIds' | 'minutes' | 'doneDate' | 'notes'
      >
    >,
  ) => boolean;
  deleteExtraProject: (id: string) => boolean;
  approveExtraProject: (id: string) => boolean;
  rejectExtraProject: (id: string, reason?: string) => boolean;
  pendingExtraProjects: ExtraProjectEntry[];
  setAttendanceStatus: (input: {
    employeeId: string;
    employeeName: string;
    dateKey: string;
    monthKey: string;
    status: import('../types').AttendanceStatus;
    notes?: string;
  }) => void;
  importAttendanceRows: (
    rows: import('../utils/attendance').AttendanceImportRow[],
  ) => number;
  trackProjectMinutes: (
    projectId: string,
    minutes: number,
    options?: { source?: 'timer' | 'manual'; note?: string },
  ) => void;
  addProjectProgress: (
    projectId: string,
    input: {
      text: string;
      images?: { name: string; dataUrl: string }[];
      files?: FileAttachment[];
    },
  ) => boolean;
  deleteProjectProgress: (projectId: string, updateId: string) => void;
  officeOvertime: OfficeOvertimeStore;
  startOfficeOvertime: () => boolean;
  stopOfficeOvertime: () => { ok: boolean; afterSixSeconds: number };
  attendanceStore: AttendanceStore;
  managerObservations: ManagerObservationsStore;
  getManagerObservation: (
    employeeId: string,
    monthKey: string,
  ) => ManagerEmployeeObservation | undefined;
  setManagerObservation: (input: {
    employeeId: string;
    monthKey: string;
    text: string;
  }) => void;
  chatMessages: TeamChatMessage[];
  sendChatMessage: (text: string) => void;
  deleteChatMessage: (id: string) => void;
  allProjects: CreativeProject[];
}

const AppContext = createContext<AppContextValue | null>(null);

const emptyCalendar = (): UserCalendarState => ({
  events: [],
  activeTimer: null,
});

function migrateMarketingBoard(
  saved: BoardState,
  removedEmpIds: Set<string>,
): BoardState {
  const savedMarketing = saved.tasks.filter(
    (t) =>
      t.department === MARKETING_DEPARTMENT && !removedEmpIds.has(t.employeeId),
  );
  const savedByEmp = new Map(savedMarketing.map((t) => [t.employeeId, t]));

  const defaultMerged = EMPTY_BOARD.tasks
    .filter((t) => !removedEmpIds.has(t.employeeId))
    .map((def) => {
      const existing = savedByEmp.get(def.employeeId);
      if (!existing) return def;
      return {
        ...def,
        ...existing,
        id: def.id,
        department: MARKETING_DEPARTMENT,
        roleTitle: def.roleTitle ?? existing.roleTitle,
        employeeName:
          displayNameForEmployee(def.employeeId) ?? existing.employeeName ?? def.employeeName,
      };
    });

  const defaultEmpIds = new Set(defaultMerged.map((t) => t.employeeId));
  const customTasks = savedMarketing
    .filter((t) => !defaultEmpIds.has(t.employeeId))
    .map((t) => {
      const name = displayNameForEmployee(t.employeeId);
      return name ? { ...t, employeeName: name } : t;
    });
  const tasks = [...defaultMerged, ...customTasks];

  const companyName = normalizeCompanyName(saved.companyName);
  const rawProjects = Array.isArray(saved.projects) ? saved.projects : [];
  const projects = filterActiveProjects(rawProjects);

  return { companyName, tasks, projects };
}

function mergeWithSeed(saved: BoardState, removedEmpIds: Set<string>): BoardState {
  const migrated = migrateMarketingBoard(saved, removedEmpIds);
  const savedIds = new Set(migrated.tasks.map((t) => t.id));
  const missing = EMPTY_BOARD.tasks.filter(
    (t) => !savedIds.has(t.id) && !removedEmpIds.has(t.employeeId),
  );
  const tasks =
    missing.length === 0 ? migrated.tasks : [...migrated.tasks, ...missing];
  return { ...migrated, tasks };
}

function loadBoard(roster: TeamRosterState): BoardState {
  const removedEmpIds = getRemovedEmployeeIds(roster);
  try {
    const storedVersion = Number(localStorage.getItem(VERSION_KEY) ?? '1');
    const raw = localStorage.getItem(STORAGE_KEY);

    if (storedVersion < BOARD_SCHEMA_VERSION) {
      localStorage.setItem(VERSION_KEY, String(BOARD_SCHEMA_VERSION));
      if (!raw) return migrateMarketingBoard(EMPTY_BOARD, removedEmpIds);
      if (storedVersion < 4) {
        return migrateMarketingBoard(JSON.parse(raw) as BoardState, removedEmpIds);
      }
      const merged = mergeWithSeed(JSON.parse(raw) as BoardState, removedEmpIds);
      return { ...merged, companyName: normalizeCompanyName(merged.companyName) };
    }

    if (raw) {
      const merged = mergeWithSeed(JSON.parse(raw) as BoardState, removedEmpIds);
      return { ...merged, companyName: normalizeCompanyName(merged.companyName) };
    }
  } catch {
    /* ignore */
  }
  localStorage.setItem(VERSION_KEY, String(BOARD_SCHEMA_VERSION));
  return migrateMarketingBoard(EMPTY_BOARD, removedEmpIds);
}

const DELETED_PROJECT_TTL_MS = 1000 * 60 * 60 * 24 * 120; // 120 días

function pruneDeletedProjectIds(
  map: Record<string, string>,
  now = Date.now(),
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [id, at] of Object.entries(map)) {
    const ts = Date.parse(at);
    if (!Number.isFinite(ts) || now - ts < DELETED_PROJECT_TTL_MS) {
      next[id] = at;
    }
  }
  return next;
}

function mergeDeletedProjectIds(
  ...maps: Array<Record<string, string> | undefined>
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [id, at] of Object.entries(map)) {
      if (!merged[id] || at > merged[id]) merged[id] = at;
    }
  }
  return pruneDeletedProjectIds(merged);
}

function normalizeExtraProjectName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function collaboratorKey(collaborators: string[] | undefined): string {
  return [...(collaborators ?? [])].map(String).sort().join('|');
}

/** Misma entrada Extra no debe generar varios proyectos en el board. */
function boardIdForExtraEntry(entryId: string): string {
  return `extra-project-${entryId}`;
}

/**
 * Quita duplicados blandos: mismo nombre + mismos colaboradores.
 * Conserva el más reciente (updatedAt) y prioriza ids `extra-project-*`.
 */
function softDedupeProjectsByNameAndCollaborators<
  T extends {
    id: string;
    projectName?: string;
    collaborators?: string[];
    collaborator?: string;
    updatedAt?: string;
  },
>(projects: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const project of projects) {
    const name = normalizeExtraProjectName(project.projectName ?? '');
    if (!name) {
      byKey.set(`id:${project.id}`, project);
      continue;
    }
    const collab =
      collaboratorKey(project.collaborators) ||
      collaboratorKey(project.collaborator ? [project.collaborator] : undefined);
    const key = `${name}::${collab}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, project);
      continue;
    }
    const existingExtra = existing.id.startsWith('extra-project-');
    const nextExtra = project.id.startsWith('extra-project-');
    const existingNewer =
      (existing.updatedAt || '') >= (project.updatedAt || '');
    if (existingExtra && !nextExtra) continue;
    if (!existingExtra && nextExtra) {
      byKey.set(key, project);
      continue;
    }
    if (!existingNewer) byKey.set(key, project);
  }
  return [...byKey.values()];
}

function loadDeletedProjectIds(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DELETED_PROJECTS_KEY);
    if (raw) {
      return pruneDeletedProjectIds(JSON.parse(raw) as Record<string, string>);
    }
  } catch {
    /* ignore */
  }
  return {};
}

function loadCalendarStore(): CalendarStore {
  try {
    const raw = localStorage.getItem(CALENDAR_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CalendarStore;
  } catch {
    /* ignore */
  }
  return {};
}

function loadAssignments(): TaskAssignment[] {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw) as TaskAssignment[];
      return list.map((a) => {
        const name = displayNameForEmployee(a.employeeId);
        return name ? { ...a, employeeName: name } : a;
      });
    }
  } catch {
    /* ignore */
  }
  return [];
}

function loadPasswordOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PASSWORD_OVERRIDES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

function loadEmployeePhones(): Record<string, string> {
  try {
    const raw = localStorage.getItem(EMPLOYEE_PHONES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

function loadSocialMetrics(): SocialMetricsStore {
  try {
    const raw = localStorage.getItem(SOCIAL_METRICS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SocialMetricsStore;
      if (Array.isArray(parsed.entries)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { entries: [] };
}

function loadSocialAccounts(): SocialAccountsStore {
  try {
    const raw = localStorage.getItem(SOCIAL_ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw) as SocialAccountsStore;
  } catch {
    /* ignore */
  }
  return {};
}

function loadExtraProjects(): ExtraProjectEntry[] {
  try {
    const raw = localStorage.getItem(EXTRA_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ExtraProjectEntry[];
      if (Array.isArray(parsed)) {
        return parsed
          .filter((e) => e && typeof e.id === 'string' && typeof e.employeeId === 'string')
          .map((e) => ({
            ...e,
            // Extras viejos ya estaban en Activos → se consideran aprobados.
            status: e.status ?? 'approved',
          }))
          .sort((a, b) => (b.doneDate || '').localeCompare(a.doneDate || ''));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

function loadDailyKpiStore(): DailyKpiStore {
  try {
    const raw = localStorage.getItem(DAILY_KPI_SNAPSHOTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyKpiStore;
      if (Array.isArray(parsed.snapshots)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { snapshots: [] };
}

function loadKpiObjectives(): KpiObjectiveAssignment[] {
  try {
    const raw = localStorage.getItem(KPI_OBJECTIVES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as KpiObjectiveAssignment[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function loadOfficeOvertime(): OfficeOvertimeStore {
  try {
    const raw = localStorage.getItem(OFFICE_OVERTIME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OfficeOvertimeStore;
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function loadWorkloadLimits(): WorkloadLimitsStore {
  try {
    const raw =
      localStorage.getItem(WORKLOAD_LIMITS_KEY) ??
      localStorage.getItem('empresa-board-workload-limits-v1');
    if (raw) return normalizeWorkloadLimits(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return { ...EMPTY_WORKLOAD_LIMITS };
}

function loadPerformanceHistory(): PerformanceHistoryStore {
  try {
    const raw = localStorage.getItem(PERFORMANCE_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PerformanceHistoryStore;
      if (Array.isArray(parsed.records)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { records: [] };
}

function loadMonthlyArchives(): MonthlyArchiveStore {
  try {
    const raw = localStorage.getItem(MONTHLY_ARCHIVES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MonthlyArchiveStore;
      if (Array.isArray(parsed.snapshots)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { snapshots: [] };
}

function loadChatMessages(): TeamChatMessage[] {
  try {
    const raw = localStorage.getItem(TEAM_CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TeamChatMessage[];
      if (Array.isArray(parsed)) return parsed.slice(-200);
    }
  } catch {
    /* ignore */
  }
  return [];
}

function filterMarketingTasks(tasks: EmployeeTask[]): EmployeeTask[] {
  return tasks.filter((t) => t.department === MARKETING_DEPARTMENT);
}

function getPasswordForUser(
  userId: string,
  overrides: Record<string, string>,
  roster: TeamRosterState,
): string {
  const base = findUserById(userId, roster);
  if (!base) return '';
  return overrides[userId] ?? base.password;
}

function loadSession(roster: TeamRosterState): User | null {
  try {
    const exp = sessionStorage.getItem(SESSION_EXPIRY_KEY);
    if (exp && Date.now() > Number(exp)) {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_EXPIRY_KEY);
      return null;
    }
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const id = JSON.parse(raw) as string;
    const base = findUserById(id, roster);
    if (!base) return null;
    const profiles = loadUserProfiles(localStorage.getItem(USER_PROFILES_KEY));
    return withUserProfile(base, profiles);
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [teamRoster, setTeamRoster] = useState<TeamRosterState>(loadTeamRoster);
  const [user, setUser] = useState<User | null>(() => loadSession(loadTeamRoster()));
  const [board, setBoard] = useState<BoardState>(() => {
    const loaded = loadBoard(loadTeamRoster());
    const deleted = loadDeletedProjectIds();
    if (!Object.keys(deleted).length) return loaded;
    return {
      ...loaded,
      projects: (loaded.projects ?? []).filter((p) => !deleted[p.id]),
    };
  });
  const [deletedProjectIds, setDeletedProjectIds] =
    useState<Record<string, string>>(loadDeletedProjectIds);
  const deletedProjectIdsRef = useRef(deletedProjectIds);
  deletedProjectIdsRef.current = deletedProjectIds;
  const [calendarStore, setCalendarStore] = useState<CalendarStore>(loadCalendarStore);
  const [assignments, setAssignments] = useState<TaskAssignment[]>(loadAssignments);
  const [passwordOverrides, setPasswordOverrides] = useState(loadPasswordOverrides);
  const [filter, setFilter] = useState('');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [performanceHistory, setPerformanceHistory] =
    useState<PerformanceHistoryStore>(loadPerformanceHistory);
  const [monthlyArchives, setMonthlyArchives] =
    useState<MonthlyArchiveStore>(loadMonthlyArchives);
  const [kpiObjectives, setKpiObjectives] =
    useState<KpiObjectiveAssignment[]>(loadKpiObjectives);
  const [dailyKpiStore, setDailyKpiStore] = useState<DailyKpiStore>(loadDailyKpiStore);
  const [socialMetrics, setSocialMetrics] = useState<SocialMetricsStore>(loadSocialMetrics);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountsStore>(loadSocialAccounts);
  const [extraProjects, setExtraProjects] = useState<ExtraProjectEntry[]>(loadExtraProjects);
  const [officeOvertime, setOfficeOvertime] = useState<OfficeOvertimeStore>(loadOfficeOvertime);
  const [workloadLimits, setWorkloadLimits] = useState<WorkloadLimitsStore>(loadWorkloadLimits);
  const [userProfiles, setUserProfiles] = useState<UserProfilesStore>(() =>
    loadUserProfiles(localStorage.getItem(USER_PROFILES_KEY)),
  );
  const [employeePhones, setEmployeePhones] =
    useState<Record<string, string>>(loadEmployeePhones);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>(loadActivityFeed);
  const [attendanceStore, setAttendanceStore] = useState<AttendanceStore>(loadAttendanceStore);
  const [managerObservations, setManagerObservations] =
    useState<ManagerObservationsStore>(loadManagerObservations);
  const [chatMessages, setChatMessages] = useState<TeamChatMessage[]>(loadChatMessages);
  const [syncOnline, setSyncOnline] = useState(false);
  const lastRemoteAt = useRef('');
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Edición local en curso: no dejar que un pull viejo borre lo que se está escribiendo. */
  const localEditAt = useRef('');
  const pushInFlight = useRef(false);
  /** true mientras se aplica estado remoto — no marcar como edición local. */
  const applyingRemote = useRef(false);
  /** Hubo merge local que debe re-empujarse al servidor. */
  const needsRepushAfterRemote = useRef(false);
  /** Pull remoto pendiente mientras hay un push en vuelo. */
  const pendingRemote = useRef<AppSyncState | null>(null);
  /** Pedir otro push cuando termine el que está en vuelo. */
  const pushQueued = useRef(false);
  /** Snapshot del board para reglas de sync sin closures obsoletas. */
  const boardRef = useRef(board);
  boardRef.current = board;
  // Modo espejo oculto: solo la cuenta de Dylan puede observar la vista de Orlando.
  const [spyMode, setSpyMode] = useState(false);
  const realSessionUserId = useRef<string | null>(
    (() => {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? (JSON.parse(raw) as string) : null;
      } catch {
        return null;
      }
    })(),
  );

  const userKey = user?.id ?? '';

  const logActivity = useCallback(
    (kind: ActivityEvent['kind'], message: string, actorName?: string) => {
      const actor = actorName ?? user?.name ?? 'Sistema';
      setActivityFeed((prev) => prependActivity(prev, kind, message, actor));
    },
    [user?.name],
  );

  const calendar = useMemo(
    () => calendarStore[userKey] ?? emptyCalendar(),
    [calendarStore, userKey],
  );

  const persistCalendar = useCallback(
    (next: UserCalendarState) => {
      if (!userKey) return;
      setCalendarStore((prev) => {
        const updated = { ...prev, [userKey]: next };
        localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [userKey],
  );

  useEffect(() => {
    saveTeamRoster(teamRoster);
  }, [teamRoster]);

  useEffect(() => {
    try {
      const leanBoard: BoardState = {
        ...board,
        projects: (board.projects ?? []).map((p) => {
          if (!p.attachments?.length) return p;
          const { attachments: _a, ...rest } = p;
          return { ...rest, attachmentCount: p.attachments.length };
        }),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leanBoard));
    } catch {
      /* Quota: los archivos siguen en IndexedDB */
    }
  }, [board]);

  useEffect(() => {
    try {
      localStorage.setItem(DELETED_PROJECTS_KEY, JSON.stringify(deletedProjectIds));
    } catch {
      /* ignore */
    }
  }, [deletedProjectIds]);

  const activeUsers = useMemo(
    () => getActiveUsers(teamRoster).map((u) => withUserProfile(u, userProfiles)),
    [teamRoster, userProfiles],
  );

  useEffect(() => {
    localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem(PASSWORD_OVERRIDES_KEY, JSON.stringify(passwordOverrides));
  }, [passwordOverrides]);

  useEffect(() => {
    localStorage.setItem(PERFORMANCE_HISTORY_KEY, JSON.stringify(performanceHistory));
  }, [performanceHistory]);

  useEffect(() => {
    localStorage.setItem(MONTHLY_ARCHIVES_KEY, JSON.stringify(monthlyArchives));
  }, [monthlyArchives]);

  useEffect(() => {
    localStorage.setItem(KPI_OBJECTIVES_KEY, JSON.stringify(kpiObjectives));
  }, [kpiObjectives]);

  useEffect(() => {
    localStorage.setItem(DAILY_KPI_SNAPSHOTS_KEY, JSON.stringify(dailyKpiStore));
  }, [dailyKpiStore]);

  useEffect(() => {
    localStorage.setItem(SOCIAL_METRICS_KEY, JSON.stringify(socialMetrics));
  }, [socialMetrics]);

  useEffect(() => {
    saveAttendanceStore(attendanceStore);
  }, [attendanceStore]);

  useEffect(() => {
    localStorage.setItem(MANAGER_OBSERVATIONS_KEY, JSON.stringify(managerObservations));
  }, [managerObservations]);

  useEffect(() => {
    localStorage.setItem(TEAM_CHAT_STORAGE_KEY, JSON.stringify(chatMessages.slice(-200)));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem(WORKLOAD_LIMITS_KEY, JSON.stringify(workloadLimits));
  }, [workloadLimits]);

  useEffect(() => {
    localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(userProfiles));
  }, [userProfiles]);

  useEffect(() => {
    localStorage.setItem(EMPLOYEE_PHONES_KEY, JSON.stringify(employeePhones));
  }, [employeePhones]);

  useEffect(() => {
    localStorage.setItem(SOCIAL_ACCOUNTS_KEY, JSON.stringify(socialAccounts));
  }, [socialAccounts]);

  useEffect(() => {
    localStorage.setItem(EXTRA_PROJECTS_KEY, JSON.stringify(extraProjects));
  }, [extraProjects]);

  useEffect(() => {
    localStorage.setItem(OFFICE_OVERTIME_KEY, JSON.stringify(officeOvertime));
  }, [officeOvertime]);

  useEffect(() => {
    if (!activeUsers.length) return;
    setBoard((prev) => {
      let changed = false;
      const nextProjects = (prev.projects ?? []).map((p) => {
        let next = p;
        if (!p.collaborators?.length) {
          next = {
            ...p,
            collaborators: p.collaborator === 'todos' ? ['todos'] : [p.collaborator],
          };
          changed = true;
        }
        if (next.assignedEmployeeId || next.collaborator === 'todos' || (next.collaborators?.length ?? 0) > 1) {
          return next;
        }
        const assignee = employeeIdForCollaboratorSlug(next.collaborator, activeUsers);
        if (!assignee) return next;
        changed = true;
        return { ...next, assignedEmployeeId: assignee };
      });
      return changed ? { ...prev, projects: nextProjects } : prev;
    });
  }, [activeUsers]);

  const setEmployeePhone = useCallback((employeeId: string, phone: string) => {
    setEmployeePhones((prev) => {
      const trimmed = phone.trim();
      if (!trimmed) {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      }
      return { ...prev, [employeeId]: trimmed };
    });
  }, []);

  // Vincula/actualiza/borra una cuenta de red social del equipo (solo gerencia).
  const setSocialAccount = useCallback(
    (platform: SocialPlatform, link: { handle: string; url: string } | null) => {
      if (!user || (user.role !== 'admin' && user.role !== 'lider')) return;
      setSocialAccounts((prev) => {
        if (!link) {
          const next = { ...prev };
          delete next[platform];
          return next;
        }
        return {
          ...prev,
          [platform]: {
            handle: link.handle,
            url: link.url,
            updatedByName: user.name,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    },
    [user],
  );

  const getManagerObservationFor = useCallback(
    (employeeId: string, monthKey: string) =>
      managerObservations.items.find(
        (item) => item.employeeId === employeeId && item.monthKey === monthKey,
      ),
    [managerObservations.items],
  );

  const setManagerObservation = useCallback(
    (input: { employeeId: string; monthKey: string; text: string }) => {
      if (!user || !canSendKpiObjectives(user)) return;
      setManagerObservations((prev) =>
        upsertManagerObservation(prev, {
          ...input,
          authorId: user.id,
          authorName: user.name,
        }),
      );
    },
    [user],
  );

  const marketingTasks = useMemo(() => {
    const removed = getRemovedEmployeeIds(teamRoster);
    return filterMarketingTasks(board.tasks).filter(
      (t) => !removed.has(t.employeeId),
    );
  }, [board.tasks, teamRoster]);

  useEffect(() => {
    const removed = getRemovedEmployeeIds(teamRoster);
    setBoard((prev) => {
      const nextTasks = prev.tasks.filter((t) => !removed.has(t.employeeId));
      if (nextTasks.length === prev.tasks.length) return prev;
      return { ...prev, tasks: nextTasks };
    });
  }, [teamRoster]);

  useEffect(() => {
    if (marketingTasks.length === 0) return;
    const currentKey = getMonthKey();
    if (monthlyArchives.lastRolloverMonthKey === currentKey) return;

    const result = ensureMonthlyRollover(
      monthlyArchives,
      performanceHistory,
      board,
      assignments,
      marketingTasks,
    );

    setMonthlyArchives(result.archiveStore);
    setPerformanceHistory(result.performanceHistory);
    if (result.didRollover) {
      setBoard(result.board);
      stashRolloverNotice(result.archivedMonths);
    }
  }, [
    marketingTasks,
    assignments,
    board,
    monthlyArchives,
    performanceHistory,
  ]);

  useEffect(() => {
    if (marketingTasks.length === 0) return;
    setDailyKpiStore((prev) => recordDailySnapshots(prev, marketingTasks));
  }, [marketingTasks]);

  const closeCurrentMonthWithRecords = useCallback(
    (records: MonthlyPerformanceRecord[]) => {
      const monthKey = getMonthKey();
      setPerformanceHistory((prevPerf) => {
        const nextPerf = applyMonthClose(prevPerf, records);
        const snapshot = buildMonthSnapshot(
          monthKey,
          board,
          assignments,
          marketingTasks,
          nextPerf,
          'manager',
        );
        setMonthlyArchives((prevArch) =>
          upsertSnapshot(prevArch, {
            ...snapshot,
            performance: records,
            closedBy: 'manager',
            archivedAt: new Date().toISOString(),
          }),
        );
        return nextPerf;
      });
    },
    [board, assignments, marketingTasks],
  );

  const closeCurrentMonth = useCallback(() => {
    const monthKey = getMonthKey();
    const records = marketingTasks.map((t) =>
      buildMonthlyRecord(t, monthKey, assignments, 'manager'),
    );
    closeCurrentMonthWithRecords(records);
  }, [marketingTasks, assignments, closeCurrentMonthWithRecords]);

  const buildSyncState = useCallback((): AppSyncState => {
    const deleted = deletedProjectIdsRef.current;
    const leanBoard: BoardState = {
      ...board,
      projects: softDedupeProjectsByNameAndCollaborators(
        (board.projects ?? []).filter((p) => !deleted[p.id]),
      ).map((p) => {
          const { attachments, ...base } = { ...p, ...sanitizeProjectCollaborators(p) };
          if (!attachments?.length) return base;
          return { ...base, attachmentCount: attachments.length };
        }),
    };
    const leanAssignments = assignments.map((a) => {
      if (!a.attachments?.length) return a;
      const { attachments: _a, ...rest } = a;
      return rest;
    });
    return {
      board: leanBoard,
      assignments: leanAssignments,
      chatMessages: chatMessages.slice(-200),
      calendars: calendarStore,
      passwordOverrides,
      performanceHistory,
      teamRoster,
      socialAccounts,
      deletedProjectIds: deleted,
      extraProjects,
      officeOvertime,
      updatedAt: new Date().toISOString(),
    };
  }, [
    board,
    assignments,
    chatMessages,
    calendarStore,
    passwordOverrides,
    performanceHistory,
    teamRoster,
    socialAccounts,
    extraProjects,
    officeOvertime,
  ]);

  const schedulePush = useCallback(() => {
    if (!isApiEnabled()) return;
    if (applyingRemote.current) {
      // Tras un merge que conservó datos locales, empujar cuando termine applyRemote.
      needsRepushAfterRemote.current = true;
      return;
    }
    localEditAt.current = new Date().toISOString();
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      void (async () => {
        if (pushInFlight.current) {
          pushQueued.current = true;
          return;
        }
        pushInFlight.current = true;
        try {
          const state = buildSyncState();
          const result = await pushSyncState(state);
          if (result.ok && result.updatedAt) {
            lastRemoteAt.current = result.updatedAt;
            if (localEditAt.current <= state.updatedAt) {
              localEditAt.current = result.updatedAt;
            }
          } else if (!result.ok) {
            window.setTimeout(() => schedulePush(), 4000);
          }
        } finally {
          pushInFlight.current = false;
          const queued = pendingRemote.current;
          pendingRemote.current = null;
          if (queued) applyRemoteRef.current?.(queued);
          if (pushQueued.current) {
            pushQueued.current = false;
            schedulePush();
          }
        }
      })();
    }, 700);
  }, [buildSyncState]);

  // Referencia estable para llamar applyRemote desde schedulePush sin ciclos.
  const applyRemoteRef = useRef<((remote: AppSyncState) => void) | null>(null);

  const applyRemote = useCallback((remote: AppSyncState) => {
    // No pisar ediciones locales en vuelo (escritura o push pendiente).
    if (pushInFlight.current) {
      pendingRemote.current = remote;
      return;
    }

    // Tombstones SIEMPRE se mezclan (aunque salgamos temprano del merge del board).
    // Así un delete local no se pierde y un proyecto borrado no "revive".
    const deleted = mergeDeletedProjectIds(
      deletedProjectIdsRef.current,
      remote.deletedProjectIds,
    );
    deletedProjectIdsRef.current = deleted;
    setDeletedProjectIds(deleted);

    const stripLocalDeleted = () => {
      setBoard((prev) => {
        const nextProjects = (prev.projects ?? []).filter((p) => !deleted[p.id]);
        if (nextProjects.length === (prev.projects ?? []).length) return prev;
        return { ...prev, projects: nextProjects };
      });
    };
    stripLocalDeleted();

    const remoteStillHasDeleted = (remote.board?.projects ?? []).some(
      (p) => Boolean(deleted[p.id]),
    );
    if (remoteStillHasDeleted) {
      needsRepushAfterRemote.current = true;
    }

    const localProjectCount = boardRef.current?.projects?.length ?? 0;
    // Si el remoto trae proyectos vivos y el local no tiene ninguno, siempre aplicar.
    const liveRemoteCount = (remote.board?.projects ?? []).filter(
      (p) => !deleted[p.id],
    ).length;
    const forceTakeRemote = liveRemoteCount > 0 && localProjectCount === 0;

    if (!forceTakeRemote && localEditAt.current && remote.updatedAt < localEditAt.current) {
      if (needsRepushAfterRemote.current) {
        window.setTimeout(() => {
          needsRepushAfterRemote.current = false;
          schedulePush();
        }, 80);
      }
      return;
    }
    if (!forceTakeRemote && remote.updatedAt <= lastRemoteAt.current) {
      if (needsRepushAfterRemote.current) {
        window.setTimeout(() => {
          needsRepushAfterRemote.current = false;
          schedulePush();
        }, 80);
      }
      return;
    }
    lastRemoteAt.current = remote.updatedAt;
    applyingRemote.current = true;
    let preservedLocal = false;

    const remoteRoster = remote.teamRoster ?? defaultTeamRoster();
    const removedEmpIds = getRemovedEmployeeIds(remoteRoster);
    setTeamRoster(remoteRoster);

    setBoard((prev) => {
      const remoteProjects = (remote.board.projects ?? []).filter((p) => !deleted[p.id]);
      const localProjects = (prev.projects ?? []).filter((p) => !deleted[p.id]);
      const byId = new Map<string, (typeof remoteProjects)[number]>();

      for (const rp of remoteProjects) {
        byId.set(rp.id, rp);
      }
      for (const lp of localProjects) {
        if (deleted[lp.id]) continue;
        const rp = byId.get(lp.id);
        if (!rp) {
          // Proyecto solo local: conservar solo si no está marcado como borrado.
          byId.set(lp.id, lp);
          preservedLocal = true;
          continue;
        }
        const localNewer = (lp.updatedAt || '') > (rp.updatedAt || '');
        const localAccepted =
          lp.acceptanceStatus === 'accepted' || lp.acceptanceStatus === 'declined';
        const remoteStillPending =
          !rp.acceptanceStatus || rp.acceptanceStatus === 'pending';
        if (localNewer || (localAccepted && remoteStillPending)) {
          preservedLocal = true;
          byId.set(lp.id, {
            ...rp,
            ...lp,
            attachments: lp.attachments?.length ? lp.attachments : rp.attachments,
            attachmentCount: lp.attachments?.length
              ? lp.attachments.length
              : (rp.attachmentCount ?? rp.attachments?.length),
          });
        } else if (lp.attachments?.length) {
          byId.set(lp.id, {
            ...rp,
            attachments: lp.attachments,
            attachmentCount: lp.attachments.length,
          });
        }
      }

      const projects = softDedupeProjectsByNameAndCollaborators(
        [...byId.values()].filter((p) => !deleted[p.id]),
      ).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

      // Mezclar tareas: no borrar trabajo recién aceptado por un pull viejo.
      const remoteTasks = (remote.board.tasks ?? []).filter(
        (t) => !removedEmpIds.has(t.employeeId),
      );
      const localTasks = prev.tasks ?? [];
      const taskById = new Map(remoteTasks.map((t) => [t.id, t]));
      for (const lt of localTasks) {
        if (removedEmpIds.has(lt.employeeId)) continue;
        const rt = taskById.get(lt.id);
        if (!rt) {
          taskById.set(lt.id, lt);
          preservedLocal = true;
          continue;
        }
        const localAssignedNewer =
          Boolean(lt.assignedAt) && (lt.assignedAt || '') > (rt.assignedAt || '');
        if (localAssignedNewer) {
          preservedLocal = true;
          taskById.set(lt.id, { ...rt, ...lt });
        }
      }

      return { ...remote.board, tasks: [...taskById.values()], projects };
    });
    // Si el remoto aún trae un proyecto que ya borramos, hay que re-empujar tombstones.
    if (remoteStillHasDeleted) {
      preservedLocal = true;
    }
    setAssignments((prev) => {
      const remoteList = remote.assignments ?? [];
      const byId = new Map(remoteList.map((a) => [a.id, a]));
      for (const local of prev) {
        const remoteAsg = byId.get(local.id);
        if (!remoteAsg) {
          if (!removedEmpIds.has(local.employeeId)) {
            byId.set(local.id, local);
            preservedLocal = true;
          }
          continue;
        }
        const localResolved = local.status !== 'pending';
        const remotePending = remoteAsg.status === 'pending';
        if (localResolved && remotePending) {
          byId.set(local.id, local);
          preservedLocal = true;
          continue;
        }
        if (
          localResolved &&
          remoteAsg.status !== 'pending' &&
          (local.respondedAt || '') > (remoteAsg.respondedAt || '')
        ) {
          byId.set(local.id, local);
          preservedLocal = true;
          continue;
        }
        if (local.attachments?.length && !remoteAsg.attachments?.length) {
          byId.set(local.id, { ...remoteAsg, attachments: local.attachments });
        }
      }
      return [...byId.values()].filter((a) => !removedEmpIds.has(a.employeeId));
    });
    setCalendarStore(remote.calendars);
    // No borrar contraseñas locales si el remoto viene vacío (fallo de sync previo).
    setPasswordOverrides((prev) => {
      const remotePo = remote.passwordOverrides ?? {};
      if (Object.keys(remotePo).length === 0) {
        if (Object.keys(prev).length > 0) preservedLocal = true;
        return prev;
      }
      return { ...prev, ...remotePo };
    });
    if (Array.isArray(remote.chatMessages)) {
      setChatMessages((prev) => {
        const byId = new Map<string, TeamChatMessage>();
        for (const message of [...prev, ...remote.chatMessages!]) {
          byId.set(message.id, message);
        }
        return [...byId.values()]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(-200);
      });
    }
    if (remote.performanceHistory?.records) {
      setPerformanceHistory(remote.performanceHistory);
    }
    if (remote.socialAccounts) {
      setSocialAccounts(remote.socialAccounts);
    }
    if (Array.isArray(remote.extraProjects)) {
      setExtraProjects((prev) => {
        const byId = new Map(remote.extraProjects!.map((e) => [e.id, e]));
        const remoteAt = remote.updatedAt || '';
        for (const local of prev) {
          const remoteEntry = byId.get(local.id);
          if (!remoteEntry) {
            // Solo conservar extras locales recién creados (aún no en servidor).
            if ((local.createdAt || local.updatedAt || '') > remoteAt) {
              byId.set(local.id, local);
              preservedLocal = true;
            }
            continue;
          }
          if ((local.updatedAt || '') > (remoteEntry.updatedAt || '')) {
            byId.set(local.id, local);
            preservedLocal = true;
          }
        }
        return [...byId.values()]
          .map((entry) => {
            // Si el proyecto del board ya está tombstoned, no revivir el link.
            if (entry.linkedProjectId && deleted[entry.linkedProjectId]) {
              return {
                ...entry,
                linkedProjectId: undefined,
                status: 'rejected' as const,
                rejectReason:
                  entry.rejectReason || 'Proyecto eliminado del tablero',
              };
            }
            return entry;
          })
          .sort((a, b) => (b.doneDate || '').localeCompare(a.doneDate || ''));
      });
    }

    if (remote.officeOvertime) {
      setOfficeOvertime((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [employeeId, remoteEntry] of Object.entries(remote.officeOvertime!)) {
          const local = next[employeeId];
          if (!local) {
            next[employeeId] = remoteEntry;
            changed = true;
            continue;
          }
          if ((local.updatedAt || '') > (remoteEntry.updatedAt || '')) {
            preservedLocal = true;
            continue;
          }
          if ((remoteEntry.updatedAt || '') > (local.updatedAt || '')) {
            next[employeeId] = remoteEntry;
            changed = true;
          }
        }
        // Conservar entradas locales más nuevas que no están en remoto.
        for (const [employeeId, local] of Object.entries(prev)) {
          if (!remote.officeOvertime![employeeId]) {
            if ((local.updatedAt || '') > (remote.updatedAt || '')) {
              preservedLocal = true;
            }
          }
        }
        return changed ? next : prev;
      });
    }

    if (preservedLocal) needsRepushAfterRemote.current = true;

    window.setTimeout(() => {
      applyingRemote.current = false;
      if (needsRepushAfterRemote.current) {
        needsRepushAfterRemote.current = false;
        schedulePush();
      }
    }, 80);
  }, [schedulePush]);

  useEffect(() => {
    applyRemoteRef.current = applyRemote;
  }, [applyRemote]);

  useEffect(() => {
    if (!isApiEnabled()) return;
    void (async () => {
      const online = await checkApiHealth();
      setSyncOnline((prev) => (prev === online ? prev : online));
      if (!online) return;
      const remote = await fetchSyncState();
      const remoteHasBoard =
        (remote?.board?.tasks?.length ?? 0) > 0 ||
        (remote?.board?.projects?.length ?? 0) > 0;
      const localHasBoard =
        board.tasks.length > 0 || (board.projects?.length ?? 0) > 0;
      if (remoteHasBoard) {
        applyRemote(remote!);
      } else if (localHasBoard) {
        await pushSyncState(buildSyncState());
      }
    })();
  }, []);

  useEffect(() => {
    if (!isApiEnabled() || !user) return;

    let cancelled = false;
    let intervalId: number | null = null;

    const pull = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const online = await checkApiHealth();
      if (cancelled) return;
      setSyncOnline((prev) => (prev === online ? prev : online));
      if (!online) return;
      const remote = await fetchSyncState();
      if (cancelled) return;
      // Un servidor sin datos no debe pisar el estado local.
      const remoteHasBoard =
        (remote?.board?.tasks?.length ?? 0) > 0 ||
        (remote?.board?.projects?.length ?? 0) > 0;
      if (remoteHasBoard) applyRemoteRef.current?.(remote!);
    };

    const start = () => {
      if (intervalId != null) return;
      intervalId = window.setInterval(() => {
        void pull();
      }, 10_000);
    };

    const stop = () => {
      if (intervalId == null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stop();
        return;
      }
      void pull();
      start();
    };

    void pull();
    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

  useEffect(() => {
    schedulePush();
  }, [
    board,
    assignments,
    chatMessages,
    calendarStore,
    passwordOverrides,
    teamRoster,
    socialAccounts,
    deletedProjectIds,
    extraProjects,
    officeOvertime,
    schedulePush,
  ]);

  const canEditAll = user?.role === 'admin' || user?.role === 'lider';
  const userCanSendKpiObjectives = canSendKpiObjectives(user);
  const userCanManageWorkloadLimits = canManageWorkloadLimits(user);

  const getWorkloadCheck = useCallback(
    (
      employeeId: string,
      options?: { excludeProjectId?: string; addSlots?: number },
    ): WorkloadCheckResult => {
      const employee = board.tasks.find((t) => t.employeeId === employeeId);
      return buildWorkloadCheck(
        employeeId,
        employee?.employeeName ?? 'Colaborador',
        board.projects ?? [],
        assignments,
        activeUsers,
        workloadLimits,
        options,
      );
    },
    [board.tasks, board.projects, assignments, activeUsers, workloadLimits],
  );

  const verifyManagerPassword = useCallback(
    (password: string) => {
      if (!user) return false;
      return getPasswordForUser(user.id, passwordOverrides, teamRoster) === password;
    },
    [user, passwordOverrides, teamRoster],
  );

  const setDefaultWorkloadLimit = useCallback((max: number) => {
    const n = Math.max(1, Math.round(max));
    setWorkloadLimits((prev) => ({ ...prev, defaultMax: n }));
  }, []);

  const setEmployeeWorkloadLimit = useCallback((employeeId: string, max: number) => {
    const n = Math.max(1, Math.round(max));
    setWorkloadLimits((prev) => ({
      ...prev,
      byEmployee: { ...prev.byEmployee, [employeeId]: n },
    }));
  }, []);

  const myPendingKpiObjectives = useMemo(() => {
    if (!user?.employeeId) return [];
    return kpiObjectives.filter(
      (k) => k.employeeId === user.employeeId && k.status === 'pending',
    );
  }, [kpiObjectives, user]);

  const pendingKpiObjectivesCount = useMemo(() => {
    if (userCanSendKpiObjectives) {
      return kpiObjectives.filter((k) => k.status === 'pending').length;
    }
    return myPendingKpiObjectives.length;
  }, [kpiObjectives, userCanSendKpiObjectives, myPendingKpiObjectives.length]);

  const myPendingAssignments = useMemo(() => {
    if (!user?.employeeId) return [];
    return assignments.filter(
      (a) => a.employeeId === user.employeeId && a.status === 'pending',
    );
  }, [assignments, user]);

  const pendingAssignmentsCount = useMemo(() => {
    if (canEditAll) {
      return assignments.filter((a) => a.status === 'pending').length;
    }
    return myPendingAssignments.length;
  }, [canEditAll, assignments, myPendingAssignments.length]);

  const canEditTask = useCallback(
    (task: EmployeeTask) => {
      if (!user) return false;
      if (canEditAll) return true;
      return user.employeeId === task.employeeId;
    },
    [user, canEditAll],
  );

  const login = useCallback(
    (username: string, password: string) => {
      const loginName = username.trim();
      const loginPassword = password.trim();
      const rosterUsers = getActiveUsers(teamRoster);
      const found = findUserByLoginName(loginName, rosterUsers, userProfiles);
      if (!found) return false;
      const resolved = withUserProfile(found, userProfiles);
      const expected = getPasswordForUser(found.id, passwordOverrides, teamRoster);
      if (loginPassword !== expected) return false;
      setUser(resolved);
      realSessionUserId.current = found.id;
      setSpyMode(false);
      void subscribeToPush(resolved);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(found.id));
      sessionStorage.setItem(
        SESSION_EXPIRY_KEY,
        String(Date.now() + SESSION_HOURS * 60 * 60 * 1000),
      );
      return true;
    },
    [passwordOverrides, teamRoster, userProfiles],
  );

  const logout = useCallback(() => {
    setUser(null);
    realSessionUserId.current = null;
    setSpyMode(false);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
  }, []);

  // Pide permiso y activa las notificaciones push en este dispositivo.
  const enablePushNotifications = useCallback(async () => {
    if (!user) return { ok: false, reason: 'no-user' as const };
    return subscribeToPush(user, { requestPermission: true });
  }, [user]);

  // Activa la vista de Orlando sin cerrar la sesión real de Dylan.
  const enterSpyMode = useCallback(() => {
    if (realSessionUserId.current !== 'u-jorddy') return false;
    const base = findUserById('u-orlando', teamRoster);
    if (!base) return false;
    setUser(withUserProfile(base, userProfiles));
    setSpyMode(true);
    return true;
  }, [teamRoster, userProfiles]);

  // Regresa a la interfaz real de Dylan.
  const exitSpyMode = useCallback(() => {
    if (realSessionUserId.current !== 'u-jorddy') return;
    const base = findUserById('u-jorddy', teamRoster);
    if (base) setUser(withUserProfile(base, userProfiles));
    setSpyMode(false);
  }, [teamRoster, userProfiles]);

  // Secuencia secreta de teclado: solo funciona en la cuenta de Dylan.
  // Escribir "jorddy" abre la vista de Orlando; escribir "dylan" la cierra.
  useEffect(() => {
    let buffer = '';
    const onKey = (e: KeyboardEvent) => {
      if (realSessionUserId.current !== 'u-jorddy') return;
      if (e.key.length !== 1 || !/[a-záéíóúñ]/i.test(e.key)) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-16);
      if (buffer.endsWith('jorddy')) {
        enterSpyMode();
        buffer = '';
      } else if (buffer.endsWith('dylan')) {
        exitSpyMode();
        buffer = '';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enterSpyMode, exitSpyMode]);

  // Re-suscribe al push en sesiones ya iniciadas (si el permiso ya se concedió).
  useEffect(() => {
    if (user && realSessionUserId.current === user.id) {
      void subscribeToPush(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const changePassword = useCallback(
    (current: string, next: string) => {
      if (!user) return false;
      if (getPasswordForUser(user.id, passwordOverrides, teamRoster) !== current)
        return false;
      setPasswordOverrides((prev) => ({ ...prev, [user.id]: next }));
      return true;
    },
    [user, passwordOverrides, teamRoster],
  );

  const updateProfile = useCallback(
    (input: {
      username?: string;
      avatarUrl?: string | null;
      currentPassword?: string;
      newPassword?: string;
    }): { ok: true } | { ok: false; error: string } => {
      if (!user) return { ok: false, error: 'Sesión no válida.' };

      const rosterUsers = getActiveUsers(teamRoster);
      let nextProfiles = userProfiles;
      let nextRoster = teamRoster;

      if (input.username !== undefined) {
        const normalized = normalizeUsername(input.username);
        const usernameError = validateUsernameChange(
          normalized,
          rosterUsers.map((u) => withUserProfile(u, userProfiles)),
          userProfiles,
          user.id,
        );
        if (usernameError) return { ok: false, error: usernameError };

        const isAdded = teamRoster.added.some((u) => u.id === user.id);
        if (isAdded) {
          nextRoster = {
            ...teamRoster,
            added: teamRoster.added.map((u) =>
              u.id === user.id ? { ...u, username: normalized } : u,
            ),
          };
        } else {
          nextProfiles = mergeProfilePatch(userProfiles, user.id, { username: normalized });
        }
      }

      if (input.avatarUrl !== undefined) {
        if (input.avatarUrl === null || input.avatarUrl === '') {
          const prev = nextProfiles[user.id] ?? {};
          const rest = { ...prev };
          delete rest.avatarUrl;
          if (Object.keys(rest).length === 0) {
            const others = { ...nextProfiles };
            delete others[user.id];
            nextProfiles = others;
          } else {
            nextProfiles = { ...nextProfiles, [user.id]: rest };
          }
        } else {
          nextProfiles = mergeProfilePatch(nextProfiles, user.id, {
            avatarUrl: input.avatarUrl,
          });
        }
      }

      if (input.newPassword) {
        if (!input.currentPassword) {
          return { ok: false, error: 'Escribe tu contraseña actual para cambiarla.' };
        }
        if (input.newPassword.length < 6) {
          return { ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
        }
        if (getPasswordForUser(user.id, passwordOverrides, teamRoster) !== input.currentPassword) {
          return { ok: false, error: 'Contraseña actual incorrecta.' };
        }
        setPasswordOverrides((prev) => ({ ...prev, [user.id]: input.newPassword! }));
      }

      if (nextRoster !== teamRoster) {
        setTeamRoster(nextRoster);
        saveTeamRoster(nextRoster);
      }
      if (nextProfiles !== userProfiles) {
        setUserProfiles(nextProfiles);
      }

      const base = findUserById(user.id, nextRoster);
      if (base) {
        setUser(withUserProfile(base, nextProfiles));
      }

      return { ok: true };
    },
    [user, userProfiles, teamRoster, passwordOverrides],
  );

  const updateTask = useCallback((id: string, patch: Partial<EmployeeTask>) => {
    setBoard((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id !== id) return t;
        if (patch.status === 'completado') {
          return { ...t, ...patch, ...clearedTaskWork(t) };
        }
        return { ...t, ...patch };
      }),
    }));
  }, []);

  const addTask = useCallback(() => {
    const id = `t-${Date.now()}`;
    const newTask: EmployeeTask = {
      id,
      employeeId: `emp-${Date.now()}`,
      employeeName: 'Nuevo colaborador',
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Marketing',
      avatarColor: '#5034ff',
      currentWork: 'Describe la tarea actual…',
      status: 'sin_empezar',
      kpiTarget: 100,
      kpiCurrent: 0,
      objective: 'Objetivo del periodo',
      dueDate: new Date().toISOString().slice(0, 10),
      notes: '',
      priority: 'media',
    };
    setBoard((prev) => ({ ...prev, tasks: [newTask, ...prev.tasks] }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setBoard((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
  }, []);

  const clearCompletedWork = useCallback((id: string) => {
    setBoard((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, ...clearedTaskWork(t) } : t,
      ),
    }));
  }, []);

  const deleteAssignment = useCallback(
    (id: string) => {
      const assignment = assignments.find((a) => a.id === id);
      if (!assignment) return;
      if (!canEditAll && user?.employeeId !== assignment.employeeId) return;
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    },
    [assignments, canEditAll, user?.employeeId],
  );

  const removeTeamMember = useCallback(
    (employeeId: string): { ok: boolean; error?: string } => {
      if (!user || !canEditAll) {
        return { ok: false, error: 'No tienes permiso para dar de baja miembros.' };
      }
      const targetUser = activeUsers.find((u) => u.employeeId === employeeId);
      if (!targetUser) {
        return { ok: false, error: 'No se encontró al colaborador.' };
      }
      if (!canRemoveTeamMember(user, targetUser)) {
        return {
          ok: false,
          error: 'No puedes dar de baja a este perfil (gerente o administrador).',
        };
      }

      setTeamRoster((prev) => {
        const isCustom = prev.added.some((u) => u.id === targetUser.id);
        if (isCustom) {
          return {
            ...prev,
            added: prev.added.filter((u) => u.id !== targetUser.id),
          };
        }
        if (prev.removedUserIds.includes(targetUser.id)) return prev;
        return { ...prev, removedUserIds: [...prev.removedUserIds, targetUser.id] };
      });

      setBoard((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.employeeId !== employeeId),
      }));

      setAssignments((prev) => prev.filter((a) => a.employeeId !== employeeId));

      setPerformanceHistory((prev) => ({
        ...prev,
        records: prev.records.filter((r) => r.employeeId !== employeeId),
      }));

      setEmployeePhones((prev) => {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      });

      setPasswordOverrides((prev) => {
        const next = { ...prev };
        delete next[targetUser.id];
        return next;
      });

      const calendarUserId = targetUser.id;
      setCalendarStore((prev) => {
        if (!prev[calendarUserId]) return prev;
        const next = { ...prev };
        delete next[calendarUserId];
        localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(next));
        return next;
      });

      if (user.id === targetUser.id) {
        setUser(null);
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_EXPIRY_KEY);
      }

      logActivity(
        'team_member_removed',
        `${targetUser.name} fue dado de baja del equipo`,
        user.name,
      );

      return { ok: true };
    },
    [user, canEditAll, activeUsers, logActivity],
  );

  const addTeamMember = useCallback(
    (input: AddTeamMemberInput): { ok: boolean; error?: string } => {
      if (!user || !canEditAll) {
        return { ok: false, error: 'No tienes permiso para agregar miembros.' };
      }
      const username = normalizeUsername(input.username);
      if (!isValidUsername(username)) {
        return { ok: false, error: 'Usuario inválido (3–24 caracteres).' };
      }
      if (input.password.length < 6) {
        return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
      }
      const exists = activeUsers.some((u) => u.username === username);
      if (exists) {
        return { ok: false, error: 'Ese nombre de usuario ya está en uso.' };
      }

      const dormantDefault = USERS.find(
        (u) => u.username === username && teamRoster.removedUserIds.includes(u.id),
      );
      if (dormantDefault?.employeeId) {
        setTeamRoster((prev) => ({
          ...prev,
          removedUserIds: prev.removedUserIds.filter((id) => id !== dormantDefault.id),
        }));

        const defaultTask = EMPTY_BOARD.tasks.find(
          (t) => t.employeeId === dormantDefault.employeeId,
        );
        if (defaultTask) {
          setBoard((prev) => ({
            ...prev,
            tasks: [
              defaultTask,
              ...prev.tasks.filter((t) => t.employeeId !== dormantDefault.employeeId),
            ],
          }));
        }

        if (input.password !== dormantDefault.password) {
          setPasswordOverrides((prev) => ({
            ...prev,
            [dormantDefault.id]: input.password,
          }));
        }

        if (input.phone?.trim()) {
          setEmployeePhones((prev) => ({
            ...prev,
            [dormantDefault.employeeId!]: input.phone!.trim(),
          }));
        }

        logActivity(
          'team_member_added',
          `${input.name.trim()} volvió al equipo de Marketing`,
          user.name,
        );

        return { ok: true };
      }

      const stamp = Date.now();
      const newUser: User = {
        id: `u-custom-${stamp}`,
        username,
        password: input.password,
        name: input.name.trim(),
        role: 'empleado',
        avatarColor: pickAvatarColor(teamRoster.added.length + board.tasks.length),
        employeeId: `emp-custom-${stamp}`,
      };

      const newTask: EmployeeTask = {
        id: `t-custom-${stamp}`,
        employeeId: newUser.employeeId!,
        employeeName: newUser.name,
        department: MARKETING_DEPARTMENT,
        roleTitle: input.roleTitle.trim(),
        avatarColor: newUser.avatarColor,
        currentWork: 'Define la tarea actual del colaborador…',
        status: 'sin_empezar',
        kpiTarget: 100,
        kpiCurrent: 0,
        objective: 'Objetivo del periodo',
        dueDate: new Date().toISOString().slice(0, 10),
        notes: '',
        priority: 'media',
      };

      setTeamRoster((prev) => ({ ...prev, added: [...prev.added, newUser] }));
      setBoard((prev) => ({ ...prev, tasks: [newTask, ...prev.tasks] }));

      if (input.phone?.trim()) {
        setEmployeePhones((prev) => ({
          ...prev,
          [newUser.employeeId!]: input.phone!.trim(),
        }));
      }

      logActivity(
        'team_member_added',
        `${input.name.trim()} se unió al equipo de Marketing`,
        user.name,
      );

      return { ok: true };
    },
    [user, canEditAll, activeUsers, teamRoster.removedUserIds, teamRoster.added.length, board.tasks.length, logActivity],
  );

  const projects = useMemo(
    () => filterActiveProjects(board.projects ?? []),
    [board.projects],
  );

  const allProjects = useMemo(() => board.projects ?? [], [board.projects]);

  const completedProjects = useMemo(
    () => filterCompletedProjects(board.projects ?? []),
    [board.projects],
  );

  const visibleProjects = useMemo(
    () =>
      projects.filter((p) => projectVisibleToUser(p, user, canEditAll, activeUsers)),
    [projects, user, canEditAll, activeUsers],
  );

  const visibleCompletedProjects = useMemo(
    () =>
      completedProjects.filter((p) =>
        projectVisibleToUser(p, user, canEditAll, activeUsers),
      ),
    [completedProjects, user, canEditAll, activeUsers],
  );

  const addProject = useCallback((): CreativeProject => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const dueDefault = (() => {
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() + 2);
      return d.toISOString().slice(0, 10);
    })();
    // Borrador: NO se agrega al tablero hasta commitProject / enviar.
    return {
      id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      requestDate: today,
      projectName: '',
      businessUnit: 'prepago',
      requestedBy: 'Orlando',
      requestingDepartment: 'direccion_comercial',
      projectType: 'campana_creativa',
      priority: 'media',
      commitmentDate: dueDefault,
      finishedDate: dueDefault,
      internalArea: 'diseno_grafico',
      collaborator: 'todos',
      collaborators: ['todos'],
      status: 'nuevo',
      comments: '',
      createdAt: now,
      updatedAt: now,
    };
  }, []);

  const commitProject = useCallback((project: CreativeProject) => {
    const now = new Date().toISOString();
    const next = { ...project, updatedAt: now };
    setBoard((prev) => {
      const list = prev.projects ?? [];
      const idx = list.findIndex((p) => p.id === next.id);
      if (idx >= 0) {
        const projects = [...list];
        projects[idx] = { ...projects[idx], ...next };
        return { ...prev, projects };
      }
      return { ...prev, projects: [next, ...list] };
    });
  }, []);

  const updateProject = useCallback(
    (
      id: string,
      patch: Partial<CreativeProject>,
      options?: { overridePassword?: string },
    ): WorkloadActionResult => {
      const current = board.projects?.find((p) => p.id === id);
      if (!current) return { ok: false, reason: 'forbidden' };

      let nextPatch = patch;
      if (patch.collaborators !== undefined) {
        nextPatch = {
          ...patch,
          ...patchForCollaboratorsChange(patch.collaborators),
        };
      } else if (patch.collaborator !== undefined) {
        nextPatch = {
          ...patch,
          collaborators:
            patch.collaborator === 'todos' ? ['todos'] : [patch.collaborator],
          assignedEmployeeId: employeeIdForCollaboratorSlug(
            patch.collaborator,
            activeUsers,
          ),
        };
      }

      const collaboratorChanged =
        patch.collaborators !== undefined || patch.collaborator !== undefined;
      if (collaboratorChanged && canEditAll) {
        const prevCollabs = getProjectCollaborators(current);
        const nextCollabs: Collaborator[] =
          nextPatch.collaborators !== undefined
            ? normalizeProjectCollaborators(nextPatch.collaborators)
            : nextPatch.collaborator === 'todos'
              ? ['todos']
              : nextPatch.collaborator
                ? [nextPatch.collaborator]
                : prevCollabs;

        if (!nextCollabs.includes('todos')) {
          for (const slug of nextCollabs) {
            if (prevCollabs.includes(slug) || prevCollabs.includes('todos')) continue;
            const nextAssignee = employeeIdForCollaboratorSlug(slug, activeUsers);
            if (!nextAssignee) continue;
            const check = getWorkloadCheck(nextAssignee, {
              excludeProjectId: id,
              addSlots: 1,
            });
            if (!check.allowed) {
              if (
                !options?.overridePassword ||
                !verifyManagerPassword(options.overridePassword)
              ) {
                return options?.overridePassword
                  ? { ok: false, reason: 'invalid_override' }
                  : { ok: false, reason: 'workload_limit', status: check };
              }
              const employee = board.tasks.find((t) => t.employeeId === nextAssignee);
              logActivity(
                'assignment_sent',
                `Asignación extra autorizada: proyecto a ${employee?.employeeName ?? 'colaborador'} (${check.current.total + 1}/${check.max})`,
                user?.name ?? 'Gerente',
              );
            }
          }
        }
      }

      if (nextPatch.status === 'terminado') {
        const today = new Date().toISOString().slice(0, 10);
        const name = current.projectName?.trim() || 'Proyecto';
        const who = nextPatch.completedByName ?? user?.name ?? 'Colaborador';
        setBoard((prev) => ({
          ...prev,
          projects: (prev.projects ?? []).map((p) =>
            p.id !== id
              ? p
              : {
                  ...p,
                  ...nextPatch,
                  status: 'terminado',
                  finishedDate: nextPatch.finishedDate ?? p.finishedDate ?? today,
                  updatedAt: new Date().toISOString(),
                },
          ),
        }));
        logActivity('project_completed', `${who} entregó «${name}»`, who);
        const merged = { ...current, ...nextPatch, status: 'terminado' as const };
        if (isHoursExceeded(merged)) {
          logActivity(
            'project_hours_exceeded',
            `⚠ «${name}» se entregó superando las horas presupuestadas (${Math.round((merged.trackedMinutes ?? 0) / 60)}h / ${estimatedHoursForProject(merged)}h)`,
            who,
          );
        } else if (isEarlyDelivery(merged)) {
          logActivity(
            'project_early_delivery',
            `🎉 ¡Excelente! ${who} entregó «${name}» antes del plazo y dentro del presupuesto de horas`,
            who,
          );
        }
        return { ok: true };
      }

      setBoard((prev) => ({
        ...prev,
        projects: (prev.projects ?? []).map((p) => {
          if (p.id !== id) return p;
          if (
            !canEditAll &&
            p.commitmentDateLocked &&
            nextPatch.commitmentDate !== undefined &&
            nextPatch.commitmentDate !== p.commitmentDate
          ) {
            return p;
          }
          const merged = { ...p, ...nextPatch, updatedAt: new Date().toISOString() };
          if (
            nextPatch.finishedDate !== undefined &&
            nextPatch.finishedDate &&
            nextPatch.commitmentDate === undefined
          ) {
            merged.commitmentDate = nextPatch.finishedDate;
          }
          // Si cambió el colaborador, pedir aceptación de nuevo.
          if (collaboratorChanged) {
            const nextCollabs = getProjectCollaborators(merged);
            if (nextCollabs.includes('todos') || nextCollabs.length !== 1) {
              merged.acceptanceStatus = undefined;
              merged.acceptedAt = undefined;
              merged.acceptedByName = undefined;
              merged.declinedReason = undefined;
            } else {
              merged.acceptanceStatus = 'pending';
              merged.acceptedAt = undefined;
              merged.acceptedByName = undefined;
              merged.declinedReason = undefined;
            }
          }
          return merged;
        }),
      }));
      return { ok: true };
    },
    [
      canEditAll,
      activeUsers,
      board.projects,
      board.tasks,
      user?.name,
      logActivity,
      getWorkloadCheck,
      verifyManagerPassword,
    ],
  );

  const deleteProject = useCallback((id: string) => {
    const now = new Date().toISOString();
    const nextDeleted = mergeDeletedProjectIds(deletedProjectIdsRef.current, {
      [id]: now,
    });
    deletedProjectIdsRef.current = nextDeleted;
    setDeletedProjectIds(nextDeleted);
    setBoard((prev) => ({
      ...prev,
      projects: (prev.projects ?? []).filter((p) => p.id !== id),
    }));
    // Cancelar indicaciones vinculadas al proyecto para que no queden en Equipo.
    setAssignments((prev) =>
      prev.map((a) =>
        a.brief?.projectId === id && a.status === 'pending'
          ? { ...a, status: 'cancelled' as const, respondedAt: now }
          : a,
      ),
    );
    // Si era un Extra aprobado, desvincularlo para que no “reviva” el board.
    setExtraProjects((prev) =>
      prev.map((e) =>
        e.linkedProjectId === id
          ? {
              ...e,
              linkedProjectId: undefined,
              status: 'rejected',
              rejectReason: 'Proyecto eliminado del tablero',
              updatedAt: now,
            }
          : e,
      ),
    );
  }, []);

  const visibleExtraProjects = useMemo(() => {
    if (canEditAll) return extraProjects;
    if (!user) return [];
    const myId = user.employeeId || user.id;
    return extraProjects.filter(
      (e) => e.employeeId === myId || e.employeeIds?.includes(myId),
    );
  }, [canEditAll, extraProjects, user]);

  const pendingExtraProjects = useMemo(
    () =>
      canEditAll
        ? extraProjects
            .filter((e) => (e.status ?? 'approved') === 'pending')
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
        : [],
    [canEditAll, extraProjects],
  );

  const buildExtraActiveProject = useCallback(
    (
      entry: ExtraProjectEntry,
      collaborators: Collaborator[],
      employeeIds: string[],
      employeeNames: string[],
      requestedByName: string,
      projectId: string,
      now: string,
    ): CreativeProject => ({
      id: projectId,
      requestDate: now.slice(0, 10),
      projectName: entry.projectName,
      businessUnit: 'yaavs_general',
      requestedBy: requestedByName,
      requestingDepartment: 'marketing',
      projectType: 'diseno_grafico',
      priority: 'media',
      commitmentDate: entry.doneDate,
      internalArea: 'diseno_grafico',
      collaborator: collaborators[0],
      collaborators,
      assignedEmployeeId: employeeIds.length === 1 ? employeeIds[0] : undefined,
      acceptanceStatus: 'accepted',
      acceptedAt: now,
      acceptedByName: employeeNames.join(', '),
      status: 'en_proceso',
      comments: entry.notes ?? 'Proyecto extra',
      estimatedHours: entry.minutes ? entry.minutes / 60 : undefined,
      createdAt: now,
      updatedAt: now,
    }),
    [],
  );

  const addExtraProject = useCallback(
    (input: {
      projectName: string;
      employeeIds: string[];
      minutes?: number;
      doneDate: string;
      notes?: string;
    }): ExtraProjectEntry | null => {
      if (!user) return null;
      const fallbackId = user.employeeId || user.id;
      const employeeIds = [...new Set(input.employeeIds.filter(Boolean))];
      if (!employeeIds.length) employeeIds.push(fallbackId);
      const employeeNames = employeeIds.map(
        (id) =>
          board.tasks.find((task) => task.employeeId === id)?.employeeName ??
          activeUsers.find((activeUser) => activeUser.employeeId === id)?.name ??
          id,
      );
      const collaborators = employeeIds
        .map(collaboratorForEmployeeId)
        .filter((value): value is Collaborator => Boolean(value));
      if (!collaborators.length) return null;

      const minutes =
        input.minutes !== undefined
          ? Math.max(1, Math.round(input.minutes))
          : undefined;
      const now = new Date().toISOString();
      const projectName = input.projectName.trim();
      if (!projectName) return null;

      const nameKey = normalizeExtraProjectName(projectName);
      const collabKey = collaboratorKey(collaborators);
      // Evitar duplicados: mismo nombre + mismos colaboradores (pendiente o aprobado).
      const existingDup = extraProjects.find((e) => {
        if ((e.status ?? 'approved') === 'rejected') return false;
        if (normalizeExtraProjectName(e.projectName) !== nameKey) return false;
        const eCollab = (e.employeeIds ?? [e.employeeId])
          .map(collaboratorForEmployeeId)
          .filter(Boolean) as Collaborator[];
        return collaboratorKey(eCollab) === collabKey;
      });
      if (existingDup) return existingDup;

      // Orlando/admin puede publicar directo; el resto espera aprobación.
      const autoApprove = canEditAll;
      const entryId = `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const projectId = autoApprove ? boardIdForExtraEntry(entryId) : undefined;
      const entry: ExtraProjectEntry = {
        id: entryId,
        employeeId: employeeIds[0],
        employeeName: employeeNames[0],
        employeeIds,
        employeeNames,
        projectName,
        minutes,
        doneDate: input.doneDate || now.slice(0, 10),
        notes: input.notes?.trim() || undefined,
        status: autoApprove ? 'approved' : 'pending',
        reviewedAt: autoApprove ? now : undefined,
        reviewedById: autoApprove ? user.id : undefined,
        reviewedByName: autoApprove ? user.name : undefined,
        linkedProjectId: projectId,
        createdAt: now,
        updatedAt: now,
      };

      setExtraProjects((prev) => [entry, ...prev]);

      if (autoApprove && projectId) {
        const activeProject = buildExtraActiveProject(
          entry,
          collaborators,
          employeeIds,
          employeeNames,
          user.name,
          projectId,
          now,
        );
        setBoard((prev) => {
          const withoutDupes = softDedupeProjectsByNameAndCollaborators(
            (prev.projects ?? []).filter((p) => p.id !== projectId),
          ).filter((p) => {
            if (normalizeExtraProjectName(p.projectName) !== nameKey) return true;
            return collaboratorKey(p.collaborators) !== collabKey;
          });
          return {
            ...prev,
            projects: [activeProject, ...withoutDupes],
          };
        });
        logActivity(
          'project_progress',
          `${user.name} registró proyecto extra «${entry.projectName}» para ${employeeNames.join(', ')}${
            minutes ? ` (${Math.round((minutes / 60) * 10) / 10} h)` : ''
          }`,
          user.name,
        );
      } else {
        logActivity(
          'project_progress',
          `${user.name} envió proyecto extra «${entry.projectName}» para aprobación`,
          user.name,
        );
        notifyPush({
          audience: 'employees',
          employeeIds: ['emp-orlando', 'emp-juancarlos'],
          excludeUserId: user.id,
          title: 'Proyecto extra por aprobar',
          body: `${user.name}: «${entry.projectName}» · ${employeeNames.join(', ')}`,
          url: '/proyectos',
          tag: `extra-pending-${entry.id}`,
        });
      }
      return entry;
    },
    [
      user,
      canEditAll,
      board.tasks,
      activeUsers,
      extraProjects,
      logActivity,
      buildExtraActiveProject,
    ],
  );

  const updateExtraProject = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<
          ExtraProjectEntry,
          'projectName' | 'employeeIds' | 'minutes' | 'doneDate' | 'notes'
        >
      >,
    ): boolean => {
      if (!user) return false;
      const myId = user.employeeId || user.id;
      const current = extraProjects.find((entry) => entry.id === id);
      if (!current) return false;
      if (
        !canEditAll &&
        current.employeeId !== myId &&
        !current.employeeIds?.includes(myId)
      ) {
        return false;
      }
      // Colaboradores solo editan pendientes o rechazados (reenvío).
      const status = current.status ?? 'approved';
      if (!canEditAll && status === 'approved') return false;

      const employeeIds = patch.employeeIds?.length
        ? [...new Set(patch.employeeIds)]
        : (current.employeeIds ?? [current.employeeId]);
      const employeeNames = employeeIds.map(
        (employeeId) =>
          board.tasks.find((task) => task.employeeId === employeeId)
            ?.employeeName ??
          activeUsers.find((activeUser) => activeUser.employeeId === employeeId)
            ?.name ??
          employeeId,
      );
      const collaborators = employeeIds
        .map(collaboratorForEmployeeId)
        .filter((value): value is Collaborator => Boolean(value));
      if (!collaborators.length) return false;

      const next: ExtraProjectEntry = {
        ...current,
        employeeId: employeeIds[0],
        employeeName: employeeNames[0],
        employeeIds,
        employeeNames,
        projectName: patch.projectName?.trim() || current.projectName,
        minutes:
          patch.minutes === undefined
            ? undefined
            : Math.max(1, Math.round(patch.minutes)),
        doneDate: patch.doneDate || current.doneDate,
        notes:
          patch.notes !== undefined
            ? patch.notes.trim() || undefined
            : current.notes,
        // Si estaba rechazado y el colaborador edita, vuelve a pendiente.
        status:
          !canEditAll && status === 'rejected' ? 'pending' : current.status,
        rejectReason:
          !canEditAll && status === 'rejected' ? undefined : current.rejectReason,
        updatedAt: new Date().toISOString(),
      };

      setExtraProjects((prev) =>
        prev.map((entry) => (entry.id === id ? next : entry)),
      );
      if (next.linkedProjectId && (next.status ?? 'approved') === 'approved') {
        setBoard((prev) => ({
          ...prev,
          projects: (prev.projects ?? []).map((project) =>
            project.id === next.linkedProjectId
              ? {
                  ...project,
                  projectName: next.projectName,
                  commitmentDate: next.doneDate,
                  comments: next.notes ?? 'Proyecto extra',
                  estimatedHours: next.minutes
                    ? next.minutes / 60
                    : undefined,
                  collaborators,
                  collaborator: collaborators[0],
                  assignedEmployeeId:
                    employeeIds.length === 1 ? employeeIds[0] : undefined,
                  updatedAt: new Date().toISOString(),
                }
              : project,
          ),
        }));
      }
      if (!canEditAll && status === 'rejected') {
        notifyPush({
          audience: 'employees',
          employeeIds: ['emp-orlando', 'emp-juancarlos'],
          excludeUserId: user.id,
          title: 'Proyecto extra reenviado',
          body: `${user.name} corrigió «${next.projectName}» y pide de nuevo aprobación`,
          url: '/proyectos',
          tag: `extra-pending-${next.id}`,
        });
      }
      return true;
    },
    [user, canEditAll, board.tasks, activeUsers, extraProjects],
  );

  const deleteExtraProject = useCallback(
    (id: string): boolean => {
      if (!user) return false;
      const myId = user.employeeId || user.id;
      const target = extraProjects.find((e) => e.id === id);
      if (!target) return false;
      if (
        !canEditAll &&
        target.employeeId !== myId &&
        !target.employeeIds?.includes(myId)
      ) {
        return false;
      }
      setExtraProjects((prev) => prev.filter((e) => e.id !== id));
      // Si ya estaba en el tablero, borrarlo (tombstone) para que no reaparezca.
      const linkedId = target.linkedProjectId ?? boardIdForExtraEntry(target.id);
      if (linkedId) {
        const now = new Date().toISOString();
        const nextDeleted = mergeDeletedProjectIds(deletedProjectIdsRef.current, {
          [linkedId]: now,
        });
        deletedProjectIdsRef.current = nextDeleted;
        setDeletedProjectIds(nextDeleted);
        setBoard((prev) => ({
          ...prev,
          projects: (prev.projects ?? []).filter((p) => p.id !== linkedId),
        }));
        setAssignments((prev) =>
          prev.map((a) =>
            a.brief?.projectId === linkedId && a.status === 'pending'
              ? { ...a, status: 'cancelled' as const, respondedAt: now }
              : a,
          ),
        );
      }
      return true;
    },
    [user, canEditAll, extraProjects],
  );

  const approveExtraProject = useCallback(
    (id: string): boolean => {
      if (!user || !canEditAll) return false;
      const current = extraProjects.find((e) => e.id === id);
      if (!current) return false;
      if ((current.status ?? 'approved') === 'approved' && current.linkedProjectId) {
        return true;
      }

      const employeeIds = current.employeeIds?.length
        ? current.employeeIds
        : [current.employeeId];
      const employeeNames = current.employeeNames?.length
        ? current.employeeNames
        : [current.employeeName];
      const collaborators = employeeIds
        .map(collaboratorForEmployeeId)
        .filter((value): value is Collaborator => Boolean(value));
      if (!collaborators.length) return false;

      const now = new Date().toISOString();
      const projectId =
        current.linkedProjectId ?? boardIdForExtraEntry(current.id);
      const next: ExtraProjectEntry = {
        ...current,
        status: 'approved',
        reviewedAt: now,
        reviewedById: user.id,
        reviewedByName: user.name,
        rejectReason: undefined,
        linkedProjectId: projectId,
        updatedAt: now,
      };
      const activeProject = buildExtraActiveProject(
        next,
        collaborators,
        employeeIds,
        employeeNames,
        current.employeeName,
        projectId,
        now,
      );

      setExtraProjects((prev) =>
        prev.map((entry) => (entry.id === id ? next : entry)),
      );
      setBoard((prev) => {
        const nameKey = normalizeExtraProjectName(next.projectName);
        const collabKey = collaboratorKey(collaborators);
        const cleaned = softDedupeProjectsByNameAndCollaborators(
          (prev.projects ?? []).filter((p) => {
            if (p.id === projectId) return true;
            if (deletedProjectIdsRef.current[p.id]) return false;
            if (normalizeExtraProjectName(p.projectName) !== nameKey) return true;
            return collaboratorKey(p.collaborators) !== collabKey;
          }),
        );
        const exists = cleaned.some((p) => p.id === projectId);
        return {
          ...prev,
          projects: exists
            ? cleaned.map((p) =>
                p.id === projectId
                  ? {
                      ...p,
                      projectName: next.projectName,
                      commitmentDate: next.doneDate,
                      comments: next.notes ?? 'Proyecto extra',
                      estimatedHours: next.minutes
                        ? next.minutes / 60
                        : undefined,
                      collaborators,
                      collaborator: collaborators[0],
                      assignedEmployeeId:
                        employeeIds.length === 1 ? employeeIds[0] : undefined,
                      acceptanceStatus: 'accepted',
                      status: 'en_proceso',
                      updatedAt: now,
                    }
                  : p,
              )
            : [activeProject, ...cleaned],
        };
      });
      logActivity(
        'project_progress',
        `${user.name} aprobó proyecto extra «${next.projectName}»`,
        user.name,
      );
      notifyPush({
        audience: 'employees',
        employeeIds,
        excludeUserId: user.id,
        title: 'Proyecto extra aprobado',
        body: `«${next.projectName}» ya está en Activos`,
        url: '/proyectos',
        tag: `extra-approved-${next.id}`,
      });
      return true;
    },
    [
      user,
      canEditAll,
      extraProjects,
      buildExtraActiveProject,
      logActivity,
    ],
  );

  const rejectExtraProject = useCallback(
    (id: string, reason?: string): boolean => {
      if (!user || !canEditAll) return false;
      const current = extraProjects.find((e) => e.id === id);
      if (!current) return false;
      const now = new Date().toISOString();
      const next: ExtraProjectEntry = {
        ...current,
        status: 'rejected',
        reviewedAt: now,
        reviewedById: user.id,
        reviewedByName: user.name,
        rejectReason: reason?.trim() || undefined,
        updatedAt: now,
      };
      setExtraProjects((prev) =>
        prev.map((entry) => (entry.id === id ? next : entry)),
      );
      logActivity(
        'project_progress',
        `${user.name} rechazó proyecto extra «${next.projectName}»`,
        user.name,
      );
      const employeeIds = current.employeeIds?.length
        ? current.employeeIds
        : [current.employeeId];
      notifyPush({
        audience: 'employees',
        employeeIds,
        excludeUserId: user.id,
        title: 'Proyecto extra rechazado',
        body: reason?.trim()
          ? `«${next.projectName}»: ${reason.trim().slice(0, 100)}`
          : `«${next.projectName}» necesita correcciones`,
        url: '/proyectos',
        tag: `extra-rejected-${next.id}`,
      });
      return true;
    },
    [user, canEditAll, extraProjects, logActivity],
  );

  const acceptProject = useCallback(
    (id: string) => {
      if (!user) return;
      const current = board.projects?.find((p) => p.id === id);
      if (!current || current.status === 'terminado') return;
      if (!projectVisibleToUser(current, user, false, activeUsers)) return;
      if (
        current.acceptanceStatus === 'accepted' ||
        current.acceptanceStatus === 'declined'
      ) {
        return;
      }

      const now = new Date().toISOString();
      const name = current.projectName?.trim() || 'Proyecto';
      setBoard((prev) => ({
        ...prev,
        projects: (prev.projects ?? []).map((p) =>
          p.id !== id
            ? p
            : {
                ...p,
                acceptanceStatus: 'accepted',
                acceptedAt: now,
                acceptedByName: user.name,
                declinedReason: undefined,
                status: p.status === 'nuevo' ? 'en_proceso' : p.status,
                updatedAt: now,
              },
        ),
      }));
      logActivity('project_accepted', `${user.name} aceptó el proyecto «${name}»`, user.name);
      notifyPush({
        audience: 'employees',
        employeeIds: ['emp-orlando', 'emp-juancarlos'],
        excludeUserId: user.id,
        title: `${user.name} aceptó el proyecto`,
        body: name,
        url: '/proyectos',
        tag: `proj-ok-${id}`,
      });
    },
    [user, board.projects, activeUsers, logActivity],
  );

  const declineProject = useCallback(
    (id: string, reason?: string) => {
      if (!user) return;
      const current = board.projects?.find((p) => p.id === id);
      if (!current || current.status === 'terminado') return;
      if (!projectVisibleToUser(current, user, false, activeUsers)) return;
      if (
        current.acceptanceStatus === 'accepted' ||
        current.acceptanceStatus === 'declined'
      ) {
        return;
      }

      const now = new Date().toISOString();
      const name = current.projectName?.trim() || 'Proyecto';
      const cleanReason = reason?.trim();
      setBoard((prev) => ({
        ...prev,
        projects: (prev.projects ?? []).map((p) =>
          p.id !== id
            ? p
            : {
                ...p,
                acceptanceStatus: 'declined',
                acceptedAt: now,
                acceptedByName: user.name,
                declinedReason: cleanReason || undefined,
                updatedAt: now,
              },
        ),
      }));
      logActivity(
        'project_declined',
        `${user.name} rechazó «${name}»${cleanReason ? `: ${cleanReason}` : ''}`,
        user.name,
      );
      notifyPush({
        audience: 'employees',
        employeeIds: ['emp-orlando', 'emp-juancarlos'],
        excludeUserId: user.id,
        title: `${user.name} rechazó el proyecto`,
        body: cleanReason ? `${name} — ${cleanReason}` : name,
        url: '/proyectos',
        tag: `proj-no-${id}`,
      });
    },
    [user, board.projects, activeUsers, logActivity],
  );

  const setCompanyName = useCallback((name: string) => {
    setBoard((prev) => ({ ...prev, companyName: name }));
  }, []);

  const addCalendarEvent = useCallback(
    (input: Omit<CalendarEvent, 'id' | 'userId' | 'trackedMinutes' | 'done' | 'remindedAt'>) => {
      if (!userKey) return;
      const ev: CalendarEvent = {
        ...input,
        id: `cal-${Date.now()}`,
        userId: userKey,
        trackedMinutes: 0,
        done: false,
      };
      persistCalendar({
        ...calendar,
        events: [...calendar.events, ev].sort((a, b) =>
          `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
        ),
      });
    },
    [userKey, calendar, persistCalendar],
  );

  const updateCalendarEvent = useCallback(
    (id: string, patch: Partial<CalendarEvent>) => {
      persistCalendar({
        ...calendar,
        events: calendar.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      });
    },
    [calendar, persistCalendar],
  );

  const deleteCalendarEvent = useCallback(
    (id: string) => {
      const activeTimer =
        calendar.activeTimer?.eventId === id ? null : calendar.activeTimer;
      persistCalendar({
        events: calendar.events.filter((e) => e.id !== id),
        activeTimer,
      });
    },
    [calendar, persistCalendar],
  );

  const toggleCalendarDone = useCallback(
    (id: string) => {
      const ev = calendar.events.find((e) => e.id === id);
      if (!ev) return;
      if (!ev.done) {
        const activeTimer =
          calendar.activeTimer?.eventId === id ? null : calendar.activeTimer;
        persistCalendar({
          events: calendar.events.filter((e) => e.id !== id),
          activeTimer,
        });
        return;
      }
      persistCalendar({
        events: calendar.events.map((e) => (e.id === id ? { ...e, done: false } : e)),
        activeTimer: calendar.activeTimer,
      });
    },
    [calendar, persistCalendar],
  );

  const startTimer = useCallback(
    (eventId: string) => {
      persistCalendar({
        ...calendar,
        activeTimer: { eventId, startedAt: new Date().toISOString() },
      });
    },
    [calendar, persistCalendar],
  );

  const stopTimer = useCallback(() => {
    const { activeTimer, events } = calendar;
    if (!activeTimer) return;
    const extra = Math.max(
      0,
      Math.floor((Date.now() - new Date(activeTimer.startedAt).getTime()) / 60000),
    );
    persistCalendar({
      activeTimer: null,
      events: events.map((e) =>
        e.id === activeTimer.eventId
          ? { ...e, trackedMinutes: e.trackedMinutes + extra }
          : e,
      ),
    });
  }, [calendar, persistCalendar]);

  const markEventReminded = useCallback(
    (id: string) => {
      updateCalendarEvent(id, { remindedAt: new Date().toISOString() });
    },
    [updateCalendarEvent],
  );

  const markEventEmailReminded = useCallback(
    (id: string) => {
      updateCalendarEvent(id, { emailRemindedAt: new Date().toISOString() });
    },
    [updateCalendarEvent],
  );

  const calendarSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user?.id || !CALENDAR_EMAIL_BY_USER[user.id]) return;
    const state = calendarStore[user.id];
    if (!state) return;

    if (calendarSyncTimer.current) clearTimeout(calendarSyncTimer.current);
    calendarSyncTimer.current = setTimeout(() => {
      void syncCalendarForReminders({
        userId: user.id,
        userName: user.name,
        email: user.email,
        events: state.events,
      });
    }, 600);

    return () => {
      if (calendarSyncTimer.current) clearTimeout(calendarSyncTimer.current);
    };
  }, [calendarStore, user?.id, user?.name, user?.email]);

  const createAssignment = useCallback(
    (
      input: {
        employeeId: string;
        title: string;
        objective: string;
        dueDate: string;
        priority: 'baja' | 'media' | 'alta';
        notes: string;
        attachmentUrl?: string;
        attachments?: FileAttachment[];
        brief?: AssignmentBrief;
      },
      options?: { overridePassword?: string },
    ): WorkloadActionResult => {
      if (!user || !canEditAll) return { ok: false, reason: 'forbidden' };
      const employee = board.tasks.find((t) => t.employeeId === input.employeeId);
      if (!employee) return { ok: false, reason: 'forbidden' };

      // No duplicar: si ya existe la misma indicación pendiente para este
      // colaborador, no se crea otra (evita dobles envíos o dobles clics).
      const cleanTitle = input.title.trim().toLowerCase();
      const alreadyPending = assignments.some(
        (a) =>
          a.status === 'pending' &&
          a.employeeId === input.employeeId &&
          a.title.trim().toLowerCase() === cleanTitle &&
          a.dueDate === input.dueDate,
      );
      if (alreadyPending) return { ok: true };

      const check = getWorkloadCheck(input.employeeId, { addSlots: 1 });
      if (!check.allowed) {
        if (!options?.overridePassword || !verifyManagerPassword(options.overridePassword)) {
          return options?.overridePassword
            ? { ok: false, reason: 'invalid_override' }
            : { ok: false, reason: 'workload_limit', status: check };
        }
        logActivity(
          'assignment_sent',
          `Indicación extra autorizada para ${employee.employeeName} (${check.current.total + 1}/${check.max})`,
          user.name,
        );
      }

      const assignment: TaskAssignment = {
        id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        employeeId: input.employeeId,
        employeeName: employee.employeeName,
        assignedById: user.id,
        assignedByName: user.name,
        title: input.title.trim(),
        objective: input.objective.trim(),
        dueDate: input.dueDate,
        priority: input.priority,
        notes: input.notes.trim(),
        attachmentUrl: input.attachmentUrl?.trim() || undefined,
        attachments: input.attachments?.length ? input.attachments : undefined,
        brief: input.brief,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      setAssignments((prev) => [assignment, ...prev]);
      if (input.attachments?.length) {
        void saveAssignmentAttachments(assignment.id, input.attachments);
      }
      logActivity(
        'assignment_sent',
        `Indicación «${assignment.title}» enviada a ${employee.employeeName}`,
        user.name,
      );
      notifyPush({
        audience: 'employees',
        employeeIds: [assignment.employeeId],
        title: 'Nueva indicación',
        body: `${assignment.assignedByName}: ${assignment.title}`,
        url: '/indicaciones',
        tag: `asg-${assignment.id}`,
      });
      return { ok: true };
    },
    [user, canEditAll, board.tasks, assignments, logActivity, getWorkloadCheck, verifyManagerPassword],
  );

  const acceptAssignment = useCallback(
    (id: string) => {
      const assignment = assignments.find((a) => a.id === id);
      if (!assignment || assignment.status !== 'pending') return;
      if (user?.employeeId !== assignment.employeeId && !canEditAll) return;

      const now = new Date().toISOString();
      const task = board.tasks.find((t) => t.employeeId === assignment.employeeId);
      if (task) {
        const noteLine = assignment.notes
          ? `${assignment.notes} (Indicación de ${assignment.assignedByName})`
          : `Indicación aceptada — ${assignment.assignedByName}`;
        setBoard((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  currentWork: assignment.title,
                  objective: assignment.objective,
                  dueDate: assignment.dueDate,
                  priority: assignment.priority,
                  notes: noteLine,
                  status: 'en_progreso',
                  attachmentUrl: assignment.attachmentUrl,
                  attachments: assignment.attachments?.length
                    ? assignment.attachments
                    : undefined,
                  assignedByName: assignment.assignedByName,
                  assignedById: assignment.assignedById,
                  assignedAt: now,
                  lastAssignmentId: assignment.id,
                  linkedProjectId: assignment.brief?.projectId,
                }
              : t,
          ),
        }));
      }

      // Marcar como aceptada (no borrar): si se borra, el sync la revive desde el servidor.
      // También se resuelven duplicados exactos pendientes para que la misma
      // indicación no vuelva a aparecer en la bandeja del colaborador.
      const dupKey = `${assignment.employeeId}|${assignment.title.trim().toLowerCase()}|${assignment.dueDate}`;
      setAssignments((prev) =>
        prev.map((a) => {
          const isDuplicate =
            a.status === 'pending' &&
            `${a.employeeId}|${a.title.trim().toLowerCase()}|${a.dueDate}` === dupKey;
          return a.id === id || isDuplicate
            ? { ...a, status: 'accepted' as const, respondedAt: now }
            : a;
        }),
      );
      const who = user?.name ?? assignment.employeeName;
      logActivity('assignment_accepted', `${who} aceptó «${assignment.title}»`, who);
      notifyPush({
        audience: 'employees',
        employeeIds: ['emp-orlando', 'emp-juancarlos'],
        excludeUserId: user?.id,
        title: `${who} aceptó la indicación`,
        body: assignment.title,
        url: '/indicaciones',
        tag: `asg-ok-${assignment.id}`,
      });
    },
    [assignments, board.tasks, user?.employeeId, user?.name, user?.id, canEditAll, logActivity],
  );

  const rejectAssignment = useCallback(
    (id: string, reason?: string) => {
      const assignment = assignments.find((a) => a.id === id);
      if (!assignment || assignment.status !== 'pending') return;
      if (user?.employeeId !== assignment.employeeId && !canEditAll) return;
      const now = new Date().toISOString();
      const who = user?.name ?? assignment.employeeName;
      const cleanReason = reason?.trim();
      const dupKey = `${assignment.employeeId}|${assignment.title.trim().toLowerCase()}|${assignment.dueDate}`;
      setAssignments((prev) =>
        prev.map((a) => {
          const isDuplicate =
            a.status === 'pending' &&
            `${a.employeeId}|${a.title.trim().toLowerCase()}|${a.dueDate}` === dupKey;
          return a.id === id || isDuplicate
            ? {
                ...a,
                status: 'rejected' as const,
                respondedAt: now,
                rejectReason: cleanReason || undefined,
              }
            : a;
        }),
      );
      logActivity(
        'assignment_rejected',
        `${who} rechazó «${assignment.title}»${cleanReason ? `: ${cleanReason}` : ''}`,
        who,
      );
      notifyPush({
        audience: 'employees',
        employeeIds: ['emp-orlando', 'emp-juancarlos'],
        excludeUserId: user?.id,
        title: `${who} rechazó la indicación`,
        body: cleanReason
          ? `${assignment.title} — ${cleanReason}`
          : assignment.title,
        url: '/indicaciones',
        tag: `asg-no-${assignment.id}`,
      });
    },
    [assignments, user?.employeeId, user?.name, user?.id, canEditAll, logActivity],
  );

  const cancelAssignment = useCallback(
    (id: string) => {
      if (!canEditAll) return;
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: 'cancelled' as const, respondedAt: new Date().toISOString() }
            : a,
        ),
      );
    },
    [canEditAll],
  );

  const createKpiObjective = useCallback(
    (input: {
      employeeId: string;
      objective: string;
      kpiTarget: number;
      dueDate: string;
      notes: string;
    }) => {
      if (!user || !userCanSendKpiObjectives) return;
      const employee = board.tasks.find((t) => t.employeeId === input.employeeId);
      if (!employee) return;

      const monthKey = getMonthKey();
      const item: KpiObjectiveAssignment = {
        id: `kpi-${Date.now()}`,
        employeeId: input.employeeId,
        employeeName: employee.employeeName,
        assignedById: user.id,
        assignedByName: user.name,
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        objective: input.objective.trim(),
        kpiTarget: Math.max(1, input.kpiTarget),
        dueDate: input.dueDate,
        notes: input.notes.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      setKpiObjectives((prev) => [
        item,
        ...prev.filter(
          (k) =>
            !(
              k.employeeId === input.employeeId &&
              k.monthKey === monthKey &&
              k.status === 'pending'
            ),
        ),
      ]);
      logActivity(
        'kpi_objective_sent',
        `Objetivo KPI de ${item.monthLabel} enviado a ${employee.employeeName}`,
        user.name,
      );
    },
    [user, userCanSendKpiObjectives, board.tasks, logActivity],
  );

  const acceptKpiObjective = useCallback(
    (id: string) => {
      const item = kpiObjectives.find((k) => k.id === id);
      if (!item || item.status !== 'pending') return;
      if (user?.employeeId !== item.employeeId) return;

      const task = board.tasks.find((t) => t.employeeId === item.employeeId);
      const now = new Date().toISOString();
      if (task) {
        const noteLine = item.notes
          ? `${item.notes} (Objetivo KPI de ${item.assignedByName})`
          : `Objetivo KPI aceptado — ${item.assignedByName}`;
        setBoard((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  objective: item.objective,
                  kpiTarget: item.kpiTarget,
                  kpiCurrent: 0,
                  dueDate: item.dueDate,
                  currentWork: `Objetivo del mes: ${item.objective}`,
                  notes: noteLine,
                  status: 'en_progreso',
                  kpiObjectiveMonthKey: item.monthKey,
                  kpiAssignedByName: item.assignedByName,
                  kpiAssignedAt: now,
                }
              : t,
          ),
        }));
      }

      setKpiObjectives((prev) =>
        prev.map((k) =>
          k.id === id ? { ...k, status: 'accepted', respondedAt: now } : k,
        ),
      );
      logActivity(
        'kpi_objective_accepted',
        `${item.employeeName} aceptó el objetivo KPI de ${item.monthLabel}`,
        user?.name ?? item.employeeName,
      );
    },
    [kpiObjectives, board.tasks, user?.employeeId, user?.name, userCanSendKpiObjectives, logActivity],
  );

  const rejectKpiObjective = useCallback(
    (id: string, reason?: string) => {
      const item = kpiObjectives.find((k) => k.id === id);
      if (!item || item.status !== 'pending') return;
      if (user?.employeeId !== item.employeeId) return;

      setKpiObjectives((prev) =>
        prev.map((k) =>
          k.id === id
            ? {
                ...k,
                status: 'rejected',
                respondedAt: new Date().toISOString(),
                rejectReason: reason?.trim() || undefined,
              }
            : k,
        ),
      );
    },
    [kpiObjectives, user?.employeeId, userCanSendKpiObjectives],
  );

  const cancelKpiObjective = useCallback(
    (id: string) => {
      if (!userCanSendKpiObjectives) return;
      const item = kpiObjectives.find((k) => k.id === id);
      if (!item || item.status !== 'pending') return;
      if (item.assignedById !== user?.id && !canEditAll) return;
      setKpiObjectives((prev) => prev.filter((k) => k.id !== id));
    },
    [kpiObjectives, userCanSendKpiObjectives, user?.id, canEditAll],
  );

  useEffect(() => {
    const current = getMonthKey();
    setKpiObjectives((prev) => {
      let changed = false;
      const next = prev.map((k) => {
        if (k.status === 'pending' && k.monthKey < current) {
          changed = true;
          return {
            ...k,
            status: 'cancelled' as const,
            respondedAt: new Date().toISOString(),
          };
        }
        return k;
      });
      return changed ? next : prev;
    });
  }, []);

  const addSocialEntry = useCallback(
    (input: {
      platform: SocialPlatform;
      title: string;
      dateKey: string;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      sentiment: ContentSentiment;
      notes: string;
    }) => {
      if (!user) return;
      const monthKey = input.dateKey.slice(0, 7);
      const entry = {
        id: `social-${Date.now()}`,
        ...input,
        monthKey,
        createdById: user.id,
        createdByName: user.name,
        createdAt: new Date().toISOString(),
      };
      setSocialMetrics((prev) => ({
        entries: [entry, ...prev.entries],
      }));
      logActivity(
        'project_status',
        `Contenido en ${input.platform}: «${input.title}» registrado`,
        user.name,
      );
    },
    [user, logActivity],
  );

  const deleteSocialEntry = useCallback((id: string) => {
    setSocialMetrics((prev) => ({
      entries: prev.entries.filter((e) => e.id !== id),
    }));
  }, []);

  const setAttendanceStatus = useCallback(
    (input: {
      employeeId: string;
      employeeName: string;
      dateKey: string;
      monthKey: string;
      status: import('../types').AttendanceStatus;
      notes?: string;
    }) => {
      if (!user) return;
      setAttendanceStore((prev) =>
        upsertAttendance(prev, {
          employeeId: input.employeeId,
          employeeName: input.employeeName,
          dateKey: input.dateKey,
          monthKey: input.monthKey,
          status: input.status,
          notes: input.notes ?? '',
          recordedById: user.id,
          recordedByName: user.name,
        }),
      );
    },
    [user],
  );

  const importAttendanceRows = useCallback(
    (rows: import('../utils/attendance').AttendanceImportRow[]) => {
      if (!user || !canEditAll || rows.length === 0) return 0;
      setAttendanceStore((prev) =>
        mergeAttendanceImport(prev, rows, { id: user.id, name: user.name }),
      );
      return rows.length;
    },
    [user, canEditAll],
  );

  const trackProjectMinutes = useCallback(
    (
      projectId: string,
      minutes: number,
      options?: { source?: 'timer' | 'manual'; note?: string },
    ) => {
      if (minutes <= 0) return;
      const current = board.projects?.find((p) => p.id === projectId);
      if (!current) return;
      const nextMinutes = (current.trackedMinutes ?? 0) + minutes;
      const estMin = estimatedHoursForProject(current) * 60;
      const logEntry = {
        id: `plog-${Date.now()}`,
        minutes,
        loggedAt: new Date().toISOString(),
        loggedByName: user?.name ?? user?.username ?? 'Usuario',
        source: options?.source ?? ('manual' as const),
        note: options?.note,
      };
      const timeLogs = [...(current.timeLogs ?? []), logEntry].slice(-40);
      setBoard((prev) => ({
        ...prev,
        projects: (prev.projects ?? []).map((p) =>
          p.id === projectId
            ? { ...p, trackedMinutes: nextMinutes, timeLogs, updatedAt: new Date().toISOString() }
            : p,
        ),
      }));
      if (nextMinutes > estMin && (current.trackedMinutes ?? 0) <= estMin) {
        logActivity(
          'project_hours_exceeded',
          `⚠ Horas excedidas en «${current.projectName}» — ${Math.round(nextMinutes / 60)}h de ${estimatedHoursForProject(current)}h presupuestadas`,
          current.collaborator,
        );
      }
    },
    [board.projects, logActivity, user],
  );

  const addProjectProgress = useCallback(
    (
      projectId: string,
      input: {
        text: string;
        images?: { name: string; dataUrl: string }[];
        files?: FileAttachment[];
      },
    ): boolean => {
      if (!user) return false;
      const current = board.projects?.find((p) => p.id === projectId);
      if (!current) return false;
      const clean = input.text.trim();
      if (!clean && !input.images?.length && !input.files?.length) return false;

      const files = input.files?.length
        ? input.files.slice(0, MAX_PROGRESS_FILES)
        : undefined;
      const images = input.images?.length
        ? input.images.slice(0, MAX_PROGRESS_FILES)
        : undefined;
      const update: ProjectProgressUpdate = {
        id: `pup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        authorId: user.id,
        authorName: user.name,
        text: clean.slice(0, 1200),
        images,
        files,
        createdAt: new Date().toISOString(),
      };
      const progressUpdates = [...(current.progressUpdates ?? []), update].slice(-30);

      setBoard((prev) => ({
        ...prev,
        projects: (prev.projects ?? []).map((p) =>
          p.id === projectId
            ? { ...p, progressUpdates, updatedAt: new Date().toISOString() }
            : p,
        ),
      }));
      const fileCount = files?.length ?? images?.length ?? 0;
      const evidenceLabel =
        fileCount > 0
          ? ` · ${fileCount} evidencia${fileCount === 1 ? '' : 's'}`
          : '';
      logActivity(
        'project_progress',
        `Avance en «${current.projectName || 'proyecto'}»: ${clean.slice(0, 80) || 'evidencia subida'}${evidenceLabel}`,
        user.name,
      );
      // Avisa a Orlando (y Carlos) del avance + evidencias.
      notifyPush({
        audience: 'employees',
        employeeIds: ['emp-orlando', 'emp-juancarlos'],
        excludeUserId: user.id,
        title: `${user.name} subió un avance`,
        body: `${current.projectName || 'Proyecto'}: ${clean.slice(0, 100) || 'evidencia'}${evidenceLabel}`,
        url: '/avances',
        tag: `progress-${projectId}`,
      });
      return true;
    },
    [board.projects, user, logActivity],
  );

  const deleteProjectProgress = useCallback(
    (projectId: string, updateId: string) => {
      if (!user) return;
      setBoard((prev) => ({
        ...prev,
        projects: (prev.projects ?? []).map((p) => {
          if (p.id !== projectId) return p;
          const target = p.progressUpdates?.find((u) => u.id === updateId);
          if (!target) return p;
          const canDelete = canEditAll || target.authorId === user.id;
          if (!canDelete) return p;
          return {
            ...p,
            progressUpdates: (p.progressUpdates ?? []).filter((u) => u.id !== updateId),
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [user, canEditAll],
  );

  const startOfficeOvertime = useCallback((): boolean => {
    if (!user?.employeeId) return false;
    if (user.employeeId === 'emp-orlando') return false;
    const nowMs = Date.now();
    // Solo después de las 6:00 p.m. hora local.
    if (nowMs < sixPmMsOnLocalDay(nowMs)) return false;
    const now = new Date(nowMs).toISOString();
    const today = todayDateKey(nowMs);
    setOfficeOvertime((prev) => {
      const current = prev[user.employeeId!];
      if (current?.runningStartedAt) return prev;
      const bankedSeconds =
        current?.todayDate === today ? current.todaySeconds || 0 : 0;
      const next: OfficeOvertimeEntry = {
        employeeId: user.employeeId!,
        employeeName: user.name,
        runningStartedAt: now,
        runningDate: today,
        todaySeconds: bankedSeconds,
        todayDate: today,
        updatedAt: now,
      };
      return { ...prev, [user.employeeId!]: next };
    });
    logActivity(
      'project_progress',
      `${user.name} marcó que se queda tiempo extra en oficina`,
      user.name,
    );
    return true;
  }, [user, logActivity]);

  const stopOfficeOvertime = useCallback((): {
    ok: boolean;
    afterSixSeconds: number;
  } => {
    if (!user?.employeeId) return { ok: false, afterSixSeconds: 0 };
    if (user.employeeId === 'emp-orlando') {
      return { ok: false, afterSixSeconds: 0 };
    }
    let stopped = false;
    let sessionAfterSix = 0;
    let totalAfterSix = 0;
    setOfficeOvertime((prev) => {
      const current = prev[user.employeeId!];
      if (!current?.runningStartedAt) return prev;
      stopped = true;
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const today = todayDateKey(nowMs);
      const started = Date.parse(current.runningStartedAt);
      sessionAfterSix = Number.isFinite(started)
        ? overtimeSecondsAfterSix(started, nowMs)
        : 0;
      const base =
        current.todayDate === today ? current.todaySeconds || 0 : 0;
      totalAfterSix = base + sessionAfterSix;
      const next: OfficeOvertimeEntry = {
        employeeId: user.employeeId!,
        employeeName: user.name,
        runningStartedAt: null,
        runningDate: null,
        todaySeconds: totalAfterSix,
        todayDate: today,
        updatedAt: now,
      };
      return { ...prev, [user.employeeId!]: next };
    });
    if (!stopped) return { ok: false, afterSixSeconds: 0 };

    const label = formatOvertimeShort(sessionAfterSix);
    logActivity(
      'project_progress',
      sessionAfterSix > 0
        ? `${user.name} terminó tiempo extra: ${label} después de las 6:00 p.m.`
        : `${user.name} terminó el cronómetro sin tiempo extra después de las 6:00 p.m.`,
      user.name,
    );
    notifyPush({
      audience: 'employees',
      employeeIds: ['emp-orlando'],
      excludeUserId: user.id,
      title: 'Tiempo extra en oficina',
      body:
        sessionAfterSix > 0
          ? `${user.name} se quedó ${label} después de las 6:00 p.m.`
          : `${user.name} cerró el cronómetro (aún no había tiempo después de las 6:00 p.m.)`,
      url: '/inicio',
      tag: `office-ot-${user.employeeId}-${todayDateKey()}`,
    });
    return { ok: true, afterSixSeconds: sessionAfterSix };
  }, [user, logActivity]);

  const sendChatMessage = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean || !user) return;
      const message: TeamChatMessage = {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role,
        authorAvatarColor: user.avatarColor,
        authorAvatarUrl: user.avatarUrl,
        text: clean.slice(0, 1000),
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, message].slice(-200));
      notifyPush({
        audience: 'all',
        excludeUserId: user.id,
        title: `Mensaje de ${user.name}`,
        body: message.text,
        url: '/chat',
        tag: 'chat',
      });
    },
    [user],
  );

  const deleteChatMessage = useCallback(
    (id: string) => {
      if (!user) return;
      setChatMessages((prev) =>
        prev.filter((message) => {
          const canDelete = user.role === 'admin' || message.authorId === user.id;
          return message.id !== id || !canDelete;
        }),
      );
    },
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      board,
      calendar,
      login,
      logout,
      spyMode,
      enterSpyMode,
      exitSpyMode,
      enablePushNotifications,
      canEditAll,
      canSendKpiObjectives: userCanSendKpiObjectives,
      canManageWorkloadLimits: userCanManageWorkloadLimits,
      workloadLimits,
      getWorkloadCheck,
      setDefaultWorkloadLimit,
      setEmployeeWorkloadLimit,
      verifyManagerPassword,
      canEditTask,
      updateTask,
      addTask,
      deleteTask,
      clearCompletedWork,
      deleteAssignment,
      activeUsers,
      addTeamMember,
      removeTeamMember,
      setCompanyName,
      filter,
      setFilter,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      toggleCalendarDone,
      startTimer,
      stopTimer,
      markEventReminded,
      markEventEmailReminded,
      assignments,
      myPendingAssignments,
      pendingAssignmentsCount,
      createAssignment,
      acceptAssignment,
      rejectAssignment,
      cancelAssignment,
      changePassword,
      updateProfile,
      syncOnline,
      assignmentSearch,
      setAssignmentSearch,
      performanceHistory,
      monthlyArchives,
      closeCurrentMonth,
      closeCurrentMonthWithRecords,
      marketingTasks,
      projects,
      completedProjects,
      visibleProjects,
      visibleCompletedProjects,
      addProject,
      commitProject,
      updateProject,
      deleteProject,
      acceptProject,
      declineProject,
      employeePhones,
      setEmployeePhone,
      activityFeed,
      kpiObjectives,
      myPendingKpiObjectives,
      pendingKpiObjectivesCount,
      createKpiObjective,
      acceptKpiObjective,
      rejectKpiObjective,
      cancelKpiObjective,
      dailyKpiStore,
      socialMetrics,
      addSocialEntry,
      deleteSocialEntry,
      socialAccounts,
      setSocialAccount,
      extraProjects,
      visibleExtraProjects,
      pendingExtraProjects,
      addExtraProject,
      updateExtraProject,
      deleteExtraProject,
      approveExtraProject,
      rejectExtraProject,
      attendanceStore,
      setAttendanceStatus,
      importAttendanceRows,
      managerObservations,
      getManagerObservation: getManagerObservationFor,
      setManagerObservation,
      chatMessages,
      sendChatMessage,
      deleteChatMessage,
      trackProjectMinutes,
      addProjectProgress,
      deleteProjectProgress,
      officeOvertime,
      startOfficeOvertime,
      stopOfficeOvertime,
      allProjects,
    }),
    [
      user,
      board,
      calendar,
      login,
      logout,
      spyMode,
      enterSpyMode,
      exitSpyMode,
      enablePushNotifications,
      canEditAll,
      userCanSendKpiObjectives,
      userCanManageWorkloadLimits,
      workloadLimits,
      getWorkloadCheck,
      setDefaultWorkloadLimit,
      setEmployeeWorkloadLimit,
      verifyManagerPassword,
      canEditTask,
      updateTask,
      addTask,
      deleteTask,
      clearCompletedWork,
      deleteAssignment,
      activeUsers,
      addTeamMember,
      removeTeamMember,
      setCompanyName,
      filter,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      toggleCalendarDone,
      startTimer,
      stopTimer,
      markEventReminded,
      markEventEmailReminded,
      assignments,
      myPendingAssignments,
      pendingAssignmentsCount,
      createAssignment,
      acceptAssignment,
      rejectAssignment,
      cancelAssignment,
      changePassword,
      updateProfile,
      syncOnline,
      assignmentSearch,
      performanceHistory,
      monthlyArchives,
      closeCurrentMonth,
      closeCurrentMonthWithRecords,
      marketingTasks,
      projects,
      completedProjects,
      visibleProjects,
      visibleCompletedProjects,
      addProject,
      commitProject,
      updateProject,
      deleteProject,
      acceptProject,
      declineProject,
      employeePhones,
      setEmployeePhone,
      activityFeed,
      kpiObjectives,
      myPendingKpiObjectives,
      pendingKpiObjectivesCount,
      createKpiObjective,
      acceptKpiObjective,
      rejectKpiObjective,
      cancelKpiObjective,
      dailyKpiStore,
      socialMetrics,
      addSocialEntry,
      deleteSocialEntry,
      socialAccounts,
      setSocialAccount,
      extraProjects,
      visibleExtraProjects,
      pendingExtraProjects,
      addExtraProject,
      updateExtraProject,
      deleteExtraProject,
      approveExtraProject,
      rejectExtraProject,
      attendanceStore,
      setAttendanceStatus,
      importAttendanceRows,
      managerObservations,
      getManagerObservationFor,
      setManagerObservation,
      chatMessages,
      sendChatMessage,
      deleteChatMessage,
      trackProjectMinutes,
      addProjectProgress,
      deleteProjectProgress,
      officeOvertime,
      startOfficeOvertime,
      stopOfficeOvertime,
      allProjects,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
