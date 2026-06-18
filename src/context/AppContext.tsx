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
import { DEFAULT_PROJECTS } from '../data/projectSeed';
import {
  DEFAULT_BOARD,
  MARKETING_DEPARTMENT,
} from '../data/seed';
import {
  canRemoveTeamMember,
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
  normalizeCompanyName,
  PASSWORD_OVERRIDES_KEY,
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
  ensurePreviousMonthClosed,
  getMonthKey,
} from '../utils/performanceHistory';
import {
  clearedTaskWork,
  filterActiveProjects,
  filterCompletedProjects,
} from '../utils/activeItems';
import type {
  AppSyncState,
  BoardState,
  CalendarEvent,
  CalendarStore,
  CreativeProject,
  EmployeeTask,
  MonthlyPerformanceRecord,
  PerformanceHistoryStore,
  AssignmentBrief,
  FileAttachment,
  TaskAssignment,
  User,
  UserCalendarState,
} from '../types';

interface AppContextValue {
  user: User | null;
  board: BoardState;
  calendar: UserCalendarState;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  canEditAll: boolean;
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
  createAssignment: (input: {
    employeeId: string;
    title: string;
    objective: string;
    dueDate: string;
    priority: 'baja' | 'media' | 'alta';
    notes: string;
    attachmentUrl?: string;
    attachments?: FileAttachment[];
    brief?: AssignmentBrief;
  }) => void;
  acceptAssignment: (id: string) => void;
  rejectAssignment: (id: string, reason?: string) => void;
  cancelAssignment: (id: string) => void;
  changePassword: (current: string, next: string) => boolean;
  syncOnline: boolean;
  assignmentSearch: string;
  setAssignmentSearch: (q: string) => void;
  performanceHistory: PerformanceHistoryStore;
  closeCurrentMonth: () => void;
  closeCurrentMonthWithRecords: (records: MonthlyPerformanceRecord[]) => void;
  marketingTasks: EmployeeTask[];
  projects: CreativeProject[];
  completedProjects: CreativeProject[];
  addProject: () => CreativeProject;
  updateProject: (id: string, patch: Partial<CreativeProject>) => void;
  deleteProject: (id: string) => void;
  employeePhones: Record<string, string>;
  setEmployeePhone: (employeeId: string, phone: string) => void;
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

  const defaultMerged = DEFAULT_BOARD.tasks
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
  const rawProjects =
    Array.isArray(saved.projects) && saved.projects.length > 0
      ? saved.projects
      : DEFAULT_PROJECTS;
  const projects = filterActiveProjects(rawProjects);

  return { companyName, tasks, projects };
}

function mergeWithSeed(saved: BoardState, removedEmpIds: Set<string>): BoardState {
  const migrated = migrateMarketingBoard(saved, removedEmpIds);
  const savedIds = new Set(migrated.tasks.map((t) => t.id));
  const missing = DEFAULT_BOARD.tasks.filter(
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
      if (!raw) return migrateMarketingBoard(DEFAULT_BOARD, removedEmpIds);
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
  return migrateMarketingBoard(DEFAULT_BOARD, removedEmpIds);
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
    return getActiveUsers(roster).find((u) => u.id === id) ?? null;
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
  const [employeePhones, setEmployeePhones] =
    useState<Record<string, string>>(loadEmployeePhones);
  const [syncOnline, setSyncOnline] = useState(false);
  const lastRemoteAt = useRef('');
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userKey = user?.id ?? '';

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

  const activeUsers = useMemo(() => getActiveUsers(teamRoster), [teamRoster]);

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
    localStorage.setItem(EMPLOYEE_PHONES_KEY, JSON.stringify(employeePhones));
  }, [employeePhones]);

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

  const marketingTasks = useMemo(
    () => filterMarketingTasks(board.tasks),
    [board.tasks],
  );

  useEffect(() => {
    if (marketingTasks.length === 0) return;
    setPerformanceHistory((prev) =>
      ensurePreviousMonthClosed(prev, marketingTasks, assignments),
    );
  }, [marketingTasks, assignments]);

  const closeCurrentMonthWithRecords = useCallback(
    (records: MonthlyPerformanceRecord[]) => {
      setPerformanceHistory((prev) => applyMonthClose(prev, records));
    },
    [],
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
      updatedAt: new Date().toISOString(),
    };
  }, [board, assignments, calendarStore, passwordOverrides, performanceHistory]);

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
      return { ...remote.board, projects };
    });
    setAssignments((prev) => {
      const remoteList = remote.assignments ?? [];
      return remoteList.map((ra) => {
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
  }, [board, assignments, calendarStore, passwordOverrides, schedulePush]);

  const canEditAll = user?.role === 'admin' || user?.role === 'lider';

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
      const found = activeUsers.find(
        (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
      );
      if (!found) return false;
      const expected = getPasswordForUser(found.id, passwordOverrides, teamRoster);
      if (password !== expected) return false;
      setUser(found);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(found.id));
      sessionStorage.setItem(
        SESSION_EXPIRY_KEY,
        String(Date.now() + SESSION_HOURS * 60 * 60 * 1000),
      );
      return true;
    },
    [passwordOverrides, activeUsers, teamRoster],
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

      return { ok: true };
    },
    [user, canEditAll, activeUsers],
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

      return { ok: true };
    },
    [user, canEditAll, activeUsers, teamRoster.added.length, board.tasks.length],
  );

  const projects = useMemo(
    () => filterActiveProjects(board.projects ?? []),
    [board.projects],
  );

  const completedProjects = useMemo(
    () => filterCompletedProjects(board.projects ?? []),
    [board.projects],
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
    (id: string, patch: Partial<CreativeProject>) => {
      if (patch.status === 'terminado') {
        const today = new Date().toISOString().slice(0, 10);
        setBoard((prev) => ({
          ...prev,
          projects: (prev.projects ?? []).map((p) =>
            p.id !== id
              ? p
              : {
                  ...p,
                  ...patch,
                  status: 'terminado',
                  finishedDate: patch.finishedDate ?? p.finishedDate ?? today,
                  updatedAt: new Date().toISOString(),
                },
          ),
        }));
        return;
      }
      setBoard((prev) => ({
        ...prev,
        projects: (prev.projects ?? []).map((p) => {
          if (p.id !== id) return p;
          if (
            !canEditAll &&
            p.commitmentDateLocked &&
            patch.commitmentDate !== undefined &&
            patch.commitmentDate !== p.commitmentDate
          ) {
            return p;
          }
          return { ...p, ...patch, updatedAt: new Date().toISOString() };
        }),
      }));
    },
    [canEditAll],
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
    (input: {
      employeeId: string;
      title: string;
      objective: string;
      dueDate: string;
      priority: 'baja' | 'media' | 'alta';
      notes: string;
      attachmentUrl?: string;
      attachments?: FileAttachment[];
      brief?: AssignmentBrief;
    }) => {
      if (!user || !canEditAll) return;
      const employee = board.tasks.find((t) => t.employeeId === input.employeeId);
      if (!employee) return;

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
    },
    [user, canEditAll, board.tasks],
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
    },
    [assignments, board.tasks, user?.employeeId, canEditAll],
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

  const value = useMemo(
    () => ({
      user,
      board,
      calendar,
      login,
      logout,
      canEditAll,
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
      syncOnline,
      assignmentSearch,
      setAssignmentSearch,
      performanceHistory,
      closeCurrentMonth,
      closeCurrentMonthWithRecords,
      marketingTasks,
      projects,
      completedProjects,
      addProject,
      updateProject,
      deleteProject,
      employeePhones,
      setEmployeePhone,
    }),
    [
      user,
      board,
      calendar,
      login,
      logout,
      canEditAll,
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
      syncOnline,
      assignmentSearch,
      performanceHistory,
      closeCurrentMonth,
      closeCurrentMonthWithRecords,
      marketingTasks,
      projects,
      completedProjects,
      addProject,
      updateProject,
      deleteProject,
      employeePhones,
      setEmployeePhone,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
