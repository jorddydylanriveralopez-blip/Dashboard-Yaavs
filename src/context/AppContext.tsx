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
import {
  ASSIGNMENTS_STORAGE_KEY,
  BOARD_SCHEMA_VERSION,
  CALENDAR_STORAGE_KEY,
  EMPLOYEE_PHONES_KEY,
  PASSWORD_OVERRIDES_KEY,
  SOCIAL_METRICS_KEY,
  USER_PROFILES_KEY,
  WORKLOAD_LIMITS_KEY,
  DAILY_KPI_SNAPSHOTS_KEY,
  KPI_OBJECTIVES_KEY,
  MONTHLY_ARCHIVES_KEY,
  normalizeCompanyName,
  PERFORMANCE_HISTORY_KEY,
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
  employeeIdForCollaboratorSlug,
  projectVisibleToUser,
  resolveProjectAssignee,
} from '../utils/collaboratorMap';
import type {
  ActivityEvent,
  AppSyncState,
  BoardState,
  CalendarEvent,
  CalendarStore,
  CreativeProject,
  EmployeeTask,
  MonthlyPerformanceRecord,
  MonthlyArchiveStore,
  PerformanceHistoryStore,
  AssignmentBrief,
  FileAttachment,
  DailyKpiStore,
  ContentSentiment,
  SocialPlatform,
  SocialMetricsStore,
  KpiObjectiveAssignment,
  TaskAssignment,
  User,
  UserCalendarState,
  WorkloadActionResult,
  WorkloadCheckResult,
  WorkloadLimitsStore,
  UserProfilesStore,
} from '../types';

interface AppContextValue {
  user: User | null;
  board: BoardState;
  calendar: UserCalendarState;
  login: (username: string, password: string) => boolean;
  logout: () => void;
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
  updateProject: (
    id: string,
    patch: Partial<CreativeProject>,
    options?: { overridePassword?: string },
  ) => WorkloadActionResult;
  deleteProject: (id: string) => void;
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
      };
    });

  const defaultEmpIds = new Set(defaultMerged.map((t) => t.employeeId));
  const customTasks = savedMarketing.filter((t) => !defaultEmpIds.has(t.employeeId));
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
    if (raw) return JSON.parse(raw) as TaskAssignment[];
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

function loadWorkloadLimits(): WorkloadLimitsStore {
  try {
    const raw = localStorage.getItem(WORKLOAD_LIMITS_KEY);
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
  const [board, setBoard] = useState<BoardState>(() => loadBoard(loadTeamRoster()));
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
  const [workloadLimits, setWorkloadLimits] = useState<WorkloadLimitsStore>(loadWorkloadLimits);
  const [userProfiles, setUserProfiles] = useState<UserProfilesStore>(() =>
    loadUserProfiles(localStorage.getItem(USER_PROFILES_KEY)),
  );
  const [employeePhones, setEmployeePhones] =
    useState<Record<string, string>>(loadEmployeePhones);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>(loadActivityFeed);
  const [syncOnline, setSyncOnline] = useState(false);
  const lastRemoteAt = useRef('');
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    localStorage.setItem(WORKLOAD_LIMITS_KEY, JSON.stringify(workloadLimits));
  }, [workloadLimits]);

  useEffect(() => {
    localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(userProfiles));
  }, [userProfiles]);

  useEffect(() => {
    localStorage.setItem(EMPLOYEE_PHONES_KEY, JSON.stringify(employeePhones));
  }, [employeePhones]);

  useEffect(() => {
    if (!activeUsers.length) return;
    setBoard((prev) => {
      let changed = false;
      const nextProjects = (prev.projects ?? []).map((p) => {
        if (p.assignedEmployeeId || p.collaborator === 'todos') return p;
        const assignee = employeeIdForCollaboratorSlug(p.collaborator, activeUsers);
        if (!assignee) return p;
        changed = true;
        return { ...p, assignedEmployeeId: assignee };
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
    const leanBoard: BoardState = {
      ...board,
      projects: (board.projects ?? []).map((p) => {
        if (!p.attachments?.length) return p;
        const { attachments: _a, ...rest } = p;
        return { ...rest, attachmentCount: p.attachments.length };
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
      calendars: calendarStore,
      passwordOverrides,
      performanceHistory,
      teamRoster,
      updatedAt: new Date().toISOString(),
    };
  }, [board, assignments, calendarStore, passwordOverrides, performanceHistory, teamRoster]);

  const schedulePush = useCallback(() => {
    if (!isApiEnabled()) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      void pushSyncState(buildSyncState());
    }, 400);
  }, [buildSyncState]);

  const applyRemote = useCallback((remote: AppSyncState) => {
    if (remote.updatedAt <= lastRemoteAt.current) return;
    lastRemoteAt.current = remote.updatedAt;

    const remoteRoster = remote.teamRoster ?? defaultTeamRoster();
    const removedEmpIds = getRemovedEmployeeIds(remoteRoster);
    setTeamRoster(remoteRoster);

    setBoard((prev) => {
      const remoteProjects = remote.board.projects ?? [];
      const localById = new Map((prev.projects ?? []).map((p) => [p.id, p]));
      const projects = remoteProjects.map((rp) => {
        const local = localById.get(rp.id);
        if (local?.attachments?.length) {
          return { ...rp, attachments: local.attachments, attachmentCount: local.attachments.length };
        }
        return rp;
      });
      for (const lp of prev.projects ?? []) {
        if (!projects.some((p) => p.id === lp.id) && lp.attachments?.length) {
          projects.push(lp);
        }
      }
      const tasks = (remote.board.tasks ?? []).filter(
        (t) => !removedEmpIds.has(t.employeeId),
      );
      return { ...remote.board, tasks, projects };
    });
    setAssignments((prev) => {
      const remoteList = remote.assignments ?? [];
      const filtered = remoteList.filter((a) => !removedEmpIds.has(a.employeeId));
      return filtered.map((ra) => {
        const local = prev.find((a) => a.id === ra.id);
        if (local?.attachments?.length && !ra.attachments?.length) {
          return { ...ra, attachments: local.attachments };
        }
        return ra;
      });
    });
    setCalendarStore(remote.calendars);
    setPasswordOverrides(remote.passwordOverrides ?? {});
    if (remote.performanceHistory?.records) {
      setPerformanceHistory(remote.performanceHistory);
    }
  }, []);

  useEffect(() => {
    if (!isApiEnabled()) return;
    void (async () => {
      const online = await checkApiHealth();
      setSyncOnline(online);
      if (!online) return;
      const remote = await fetchSyncState();
      if (remote?.board?.tasks?.length) {
        applyRemote(remote);
      } else if (board.tasks.length > 0) {
        await pushSyncState(buildSyncState());
      }
    })();
  }, []);

  useEffect(() => {
    if (!isApiEnabled() || !user) return;
    const pull = async () => {
      const online = await checkApiHealth();
      setSyncOnline(online);
      if (!online) return;
      const remote = await fetchSyncState();
      if (remote) applyRemote(remote);
    };
    pull();
    const id = window.setInterval(pull, 4000);
    return () => window.clearInterval(id);
  }, [user, applyRemote]);

  useEffect(() => {
    schedulePush();
  }, [board, assignments, calendarStore, passwordOverrides, teamRoster, schedulePush]);

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
  }, [kpiObjectives, user?.employeeId]);

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
  }, [assignments, user?.employeeId]);

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
      const rosterUsers = getActiveUsers(teamRoster);
      const found = findUserByLoginName(username, rosterUsers, userProfiles);
      if (!found) return false;
      const resolved = withUserProfile(found, userProfiles);
      const expected = getPasswordForUser(found.id, passwordOverrides, teamRoster);
      if (password !== expected) return false;
      setUser(resolved);
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
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
  }, []);

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
          const { avatarUrl: _removed, ...rest } = prev;
          if (Object.keys(rest).length === 0) {
            const { [user.id]: _drop, ...others } = nextProfiles;
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
    const newProject: CreativeProject = {
      id: `proj-${Date.now()}`,
      requestDate: today,
      projectName: '',
      businessUnit: 'prepago',
      requestedBy: '',
      requestingDepartment: 'direccion_comercial',
      projectType: 'campana_creativa',
      priority: 'media',
      commitmentDate: today,
      internalArea: 'diseno_grafico',
      collaborator: 'todos',
      status: 'nuevo',
      comments: '',
      createdAt: now,
      updatedAt: now,
    };
    setBoard((prev) => ({
      ...prev,
      projects: [newProject, ...(prev.projects ?? [])],
    }));
    return newProject;
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
      if (patch.collaborator !== undefined) {
        nextPatch = {
          ...patch,
          assignedEmployeeId: employeeIdForCollaboratorSlug(
            patch.collaborator,
            activeUsers,
          ),
        };

        if (patch.collaborator !== 'todos' && canEditAll) {
          const prevAssignee = resolveProjectAssignee(current, activeUsers);
          const nextAssignee = nextPatch.assignedEmployeeId;
          if (nextAssignee && nextAssignee !== prevAssignee) {
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
          return { ...p, ...nextPatch, updatedAt: new Date().toISOString() };
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
    setBoard((prev) => ({
      ...prev,
      projects: (prev.projects ?? []).filter((p) => p.id !== id),
    }));
  }, []);

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
        id: `asg-${Date.now()}`,
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
      return { ok: true };
    },
    [user, canEditAll, board.tasks, logActivity, getWorkloadCheck, verifyManagerPassword],
  );

  const acceptAssignment = useCallback(
    (id: string) => {
      const assignment = assignments.find((a) => a.id === id);
      if (!assignment || assignment.status !== 'pending') return;
      if (user?.employeeId !== assignment.employeeId && !canEditAll) return;

      const task = board.tasks.find((t) => t.employeeId === assignment.employeeId);
      if (task) {
        const noteLine = assignment.notes
          ? `${assignment.notes} (Indicación de ${assignment.assignedByName})`
          : `Indicación aceptada — ${assignment.assignedByName}`;
        const now = new Date().toISOString();
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

      setAssignments((prev) => prev.filter((a) => a.id !== id));
      logActivity(
        'assignment_accepted',
        `${user?.name ?? assignment.employeeName} aceptó «${assignment.title}»`,
        user?.name ?? assignment.employeeName,
      );
    },
    [assignments, board.tasks, user?.employeeId, user?.name, canEditAll, logActivity],
  );

  const rejectAssignment = useCallback(
    (id: string, reason?: string) => {
      const assignment = assignments.find((a) => a.id === id);
      if (!assignment || assignment.status !== 'pending') return;
      if (user?.employeeId !== assignment.employeeId && !canEditAll) return;
      void reason;
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    },
    [assignments, user?.employeeId, canEditAll],
  );

  const cancelAssignment = useCallback(
    (id: string) => {
      if (!canEditAll) return;
      setAssignments((prev) => prev.filter((a) => a.id !== id));
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

  const value = useMemo(
    () => ({
      user,
      board,
      calendar,
      login,
      logout,
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
      updateProject,
      deleteProject,
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
    }),
    [
      user,
      board,
      calendar,
      login,
      logout,
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
      updateProject,
      deleteProject,
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
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
