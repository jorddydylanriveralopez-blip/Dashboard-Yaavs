import { useEffect, useMemo, useState, useCallback, lazy, Suspense } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { AssignTaskModal, type AssignFormData } from './AssignTaskModal';
import { WorkloadOverrideModal } from './WorkloadOverrideModal';
import { useWorkloadGuard } from '../hooks/useWorkloadGuard';
import { SendKpiObjectiveModal, type KpiObjectiveFormData } from './SendKpiObjectiveModal';
import { BrandLogo } from './BrandLogo';
import { InstallPwaSidebarButton } from './InstallPwaSidebarButton';
import { TechAmbience } from './TechAmbience';
import { YaavsAssistant } from './YaavsAssistant';
import { OnboardingTour } from './OnboardingTour';
import { ProfileModal } from './ProfileModal';
import { UserAvatar } from './UserAvatar';
import { PerformanceAlertBanner, PerformanceAlertBadge } from './PerformanceAlertBanner';
import { TaskDetailModal } from './TaskDetailModal';
import { goToCompletedProjects } from '../utils/projectsTab';
import { MobileMoreMenu } from './MobileMoreMenu';
import { ProjectDetailModal } from './ProjectDetailModal';
import { NotificationBell } from './NotificationBell';
import {
  EmployeeWorkStatsStrip,
  type EmployeeStatDetail,
  type EmployeeStatKey,
} from './EmployeeWorkStatsStrip';
import { NavIcon, type NavIconId } from './NavIcon';
import { useAssignmentNotifications } from '../hooks/useAssignmentNotifications';
import { useDashboardRoute } from '../hooks/useDashboardRoute';
import { usePerformanceStreakAlert } from '../hooks/usePerformanceStreakAlert';
import { COMPANY_NAME } from '../constants';
import type { DashboardView } from '../utils/dashboardRoutes';
import { countOverdueProjects } from '../utils/projectLink';
import {
  computeEmployeeWorkStats,
  projectsAssignedToEmployee,
} from '../utils/employeeWorkStats';
import {
  buildEmployeeNotifications,
  countUnreadNotifications,
  type NotificationTarget,
} from '../utils/employeeNotifications';
import { buildPersonalObservationForEmployee } from '../utils/personalObservations';
import { getMonthKey } from '../utils/performanceHistory';
import { fuzzyIncludes } from '../utils/fuzzyMatch';
import { navigateToTeamTab, setTeamTab, type TeamTab } from '../utils/teamTab';
import { isActiveProject } from '../utils/activeItems';
import { getDeadlineInfo } from '../utils/deadline';
import { takeRolloverNotice } from '../utils/monthlyArchive';
import type { CreativeProject, EmployeeTask } from '../types';
import './Dashboard.css';

const ManagerHomeView = lazy(() =>
  import('./ManagerHomeView').then((m) => ({ default: m.ManagerHomeView })),
);
const MyDayView = lazy(() =>
  import('./MyDayView').then((m) => ({ default: m.MyDayView })),
);
const MarketingTeamView = lazy(() =>
  import('./MarketingTeamView').then((m) => ({ default: m.MarketingTeamView })),
);
const TeamChatView = lazy(() =>
  import('./TeamChatView').then((m) => ({ default: m.TeamChatView })),
);
const ProjectsHub = lazy(() =>
  import('./ProjectsHub').then((m) => ({ default: m.ProjectsHub })),
);
const AttendanceView = lazy(() =>
  import('./AttendanceView').then((m) => ({ default: m.AttendanceView })),
);
const AvancesView = lazy(() =>
  import('./AvancesView').then((m) => ({ default: m.AvancesView })),
);
const AssignmentsView = lazy(() =>
  import('./AssignmentsView').then((m) => ({ default: m.AssignmentsView })),
);
const MarketingPulseView = lazy(() =>
  import('./MarketingPulseView').then((m) => ({ default: m.MarketingPulseView })),
);
const CommunityView = lazy(() =>
  import('./CommunityView').then((m) => ({ default: m.CommunityView })),
);
const ImageLibraryView = lazy(() =>
  import('./ImageLibraryView').then((m) => ({ default: m.ImageLibraryView })),
);
const CalendarView = lazy(() =>
  import('./CalendarView').then((m) => ({ default: m.CalendarView })),
);

function ViewFallback() {
  return (
    <div className="dashboard-view-fallback" role="status" aria-live="polite">
      Cargando…
    </div>
  );
}

// Redes solo para Orlando, Carlos (Juan Carlos) y Yared.
const COMMUNITY_ALLOWED_EMPLOYEE_IDS = ['emp-orlando', 'emp-juancarlos', 'emp-yared'];
// Asistencia solo para Orlando y Carlos (Juan Carlos).
const ATTENDANCE_ALLOWED_EMPLOYEE_IDS = ['emp-orlando', 'emp-juancarlos'];
// Vista de equipo completa solo para Orlando y Carlos; los demás ven "Mi perfil".
const FULL_TEAM_ALLOWED_EMPLOYEE_IDS = ['emp-orlando', 'emp-juancarlos'];

const NAV: {
  id: DashboardView;
  label: string;
  icon: NavIconId;
  managerOnly?: boolean;
  allowEmployeeIds?: string[];
}[] = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'team', label: 'Equipo', icon: 'team' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'board', label: 'Proyectos', icon: 'board' },
  { id: 'avances', label: 'Avances', icon: 'avances' },
  { id: 'attendance', label: 'Asistencia', icon: 'attendance', allowEmployeeIds: ATTENDANCE_ALLOWED_EMPLOYEE_IDS },
  { id: 'assignments', label: 'Indicaciones', icon: 'assignments' },
  { id: 'pulse', label: 'Panorama', icon: 'pulse', managerOnly: true },
  { id: 'community', label: 'Redes', icon: 'community', allowEmployeeIds: COMMUNITY_ALLOWED_EMPLOYEE_IDS },
  { id: 'library', label: 'Biblioteca', icon: 'library' },
  { id: 'calendar', label: 'Agenda', icon: 'calendar' },
];

const MOBILE_PRIMARY: DashboardView[] = ['home', 'board', 'avances', 'assignments'];

export function Dashboard() {
  const {
    user,
    board,
    logout,
    filter,
    setFilter,
    canEditAll,
    spyMode,
    exitSpyMode,
    canSendKpiObjectives,
    activeUsers,
    marketingTasks,
    addProject,
    projects,
    visibleProjects,
    completedProjects,
    pendingAssignmentsCount,
    myPendingAssignments,
    myPendingKpiObjectives,
    createKpiObjective,
    performanceHistory,
    assignments,
    allProjects,
    activityFeed,
    getManagerObservation,
    dailyKpiStore,
    attendanceStore,
  } = useApp();
  const toast = useToast();
  const { override, cancelOverride, confirmOverride, submitAssignment } = useWorkloadGuard();

  const [selected, setSelected] = useState<EmployeeTask | null>(null);
  const [selectedProject, setSelectedProject] = useState<CreativeProject | null>(null);
  const [projectFocusCompletion, setProjectFocusCompletion] = useState(false);
  const [assignTarget, setAssignTarget] = useState<EmployeeTask | null>(null);
  const [kpiTarget, setKpiTarget] = useState<EmployeeTask | null>(null);
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { view, setView } = useDashboardRoute('home');
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [teamTabHint, setTeamTabHint] = useState<TeamTab | undefined>();
  const [notificationSeenTick, setNotificationSeenTick] = useState(0);

  const isAllowedByEmployee = (ids?: string[]) =>
    !ids ||
    user?.role === 'admin' ||
    (!!user?.employeeId && ids.includes(user.employeeId));
  const canSeeCommunity = isAllowedByEmployee(COMMUNITY_ALLOWED_EMPLOYEE_IDS);
  const canSeeAttendance = isAllowedByEmployee(ATTENDANCE_ALLOWED_EMPLOYEE_IDS);
  const canSeeFullTeam = isAllowedByEmployee(FULL_TEAM_ALLOWED_EMPLOYEE_IDS);

  const goToTeamTab = useCallback(
    (tab: TeamTab) => {
      navigateToTeamTab(tab, setView);
      setTeamTabHint(tab);
    },
    [setView],
  );

  const openTeam = useCallback(() => {
    setTeamTab('cards');
    setTeamTabHint(undefined);
    setView('team');
  }, [setView]);

  useEffect(() => {
    if (view !== 'team') setTeamTabHint(undefined);
  }, [view]);

  useEffect(() => {
    if (view === 'community' && !canSeeCommunity) setView('home');
    if (view === 'attendance' && !canSeeAttendance) setView('home');
  }, [view, canSeeCommunity, canSeeAttendance, setView]);

  useAssignmentNotifications(myPendingAssignments, Boolean(user?.employeeId));
  usePerformanceStreakAlert(
    user?.employeeId,
    performanceHistory,
    Boolean(user?.employeeId),
  );

  useEffect(() => {
    if (!canEditAll && myPendingAssignments.length > 0 && view === 'home') {
      const seen = sessionStorage.getItem('yaavs-pending-redirect');
      if (!seen) {
        sessionStorage.setItem('yaavs-pending-redirect', '1');
        setView('assignments');
      }
    }
  }, [canEditAll, myPendingAssignments.length, view]);

  useEffect(() => {
    if (!canEditAll || !user) return;
    const months = takeRolloverNotice();
    if (!months?.length) return;
    const labels = months.map((m) => m.label).join(', ');
    toast.success(
      months.length === 1
        ? `Mes archivado: ${labels}. KPIs reiniciados para el mes nuevo. Descarga el respaldo en Historial.`
        : `Meses archivados: ${labels}. KPIs reiniciados. Descarga respaldos en Historial.`,
    );
  }, [canEditAll, user, toast]);

  const assignable = useMemo(() => {
    const empleadoIds = new Set(
      activeUsers
        .filter((u) => u.role === 'empleado' && u.employeeId)
        .map((u) => u.employeeId!),
    );
    return marketingTasks.filter((t) => empleadoIds.has(t.employeeId));
  }, [marketingTasks, activeUsers]);

  const kpiAssignable = useMemo(
    () => marketingTasks.filter((t) => t.employeeId !== user?.employeeId),
    [marketingTasks, user?.employeeId],
  );

  const teamTasks = useMemo(() => {
    const q = filter.trim();
    let list = marketingTasks;
    if (!q) return list;
    return list.filter(
      (t) =>
        fuzzyIncludes(t.employeeName, q) ||
        fuzzyIncludes(t.roleTitle ?? '', q) ||
        fuzzyIncludes(t.currentWork, q),
    );
  }, [marketingTasks, filter]);

  const tasks = useMemo(() => {
    const q = filter.trim();
    let list = marketingTasks;
    if (!canEditAll && user?.employeeId) {
      list = list.filter((t) => t.employeeId === user.employeeId);
    }
    if (!q) return list;
    return list.filter(
      (t) =>
        fuzzyIncludes(t.employeeName, q) ||
        fuzzyIncludes(t.roleTitle ?? '', q) ||
        fuzzyIncludes(t.currentWork, q) ||
        fuzzyIncludes(t.objective, q),
    );
  }, [marketingTasks, filter, canEditAll, user?.employeeId]);

  const showPersonalWorkStats = Boolean(user?.employeeId && !canEditAll);

  const personalWorkStats = useMemo(() => {
    if (!user?.employeeId) {
      return {
        active: 0,
        completed: 0,
        urgent: 0,
        notDelivered: 0,
        dueSoon: 0,
        pendingAssignments: 0,
      };
    }
    return computeEmployeeWorkStats({
      employeeId: user.employeeId,
      activeUsers,
      allProjects,
      completedProjects,
      pendingAssignments: myPendingAssignments,
    });
  }, [
    user?.employeeId,
    activeUsers,
    allProjects,
    completedProjects,
    myPendingAssignments,
  ]);

  const handleNotificationNavigate = useCallback(
    (target: NotificationTarget) => {
      switch (target) {
        case 'assignments':
          setView('assignments');
          break;
        case 'team-kpis':
          goToTeamTab('kpis');
          break;
        case 'team':
          openTeam();
          break;
        case 'projects':
          setProjectFocusCompletion(false);
          setView('board');
          break;
        case 'projects-completed':
          goToCompletedProjects();
          setView('board');
          break;
        case 'calendar':
          setView('calendar');
          break;
        case 'attendance':
          setView('attendance');
          break;
        case 'home':
        default:
          setView('home');
          break;
      }
    },
    [setView, goToTeamTab, openTeam],
  );

  const personalImprovementTips = useMemo(() => {
    if (!user?.employeeId) return [];
    const observation = buildPersonalObservationForEmployee(user.employeeId, {
      tasks: marketingTasks,
      dailyKpiStore,
      allProjects,
      attendanceStore,
      activeProjects: visibleProjects.filter(isActiveProject),
    });
    return observation?.tips ?? [];
  }, [
    user?.employeeId,
    marketingTasks,
    dailyKpiStore,
    allProjects,
    attendanceStore,
    visibleProjects,
  ]);

  const managerNoteForUser = useMemo(() => {
    if (!user?.employeeId) return undefined;
    return getManagerObservation(user.employeeId, getMonthKey());
  }, [user?.employeeId, getManagerObservation, notificationSeenTick]);

  const employeeNotifications = useMemo(() => {
    if (!user?.employeeId) return [];
    return buildEmployeeNotifications({
      userName: user.name,
      employeeId: user.employeeId,
      activeUsers,
      allProjects,
      pendingAssignments: myPendingAssignments,
      pendingKpiObjectives: myPendingKpiObjectives,
      activityFeed,
      performanceHistory,
      improvementTips: personalImprovementTips,
      managerNote: managerNoteForUser?.text,
      managerNoteUpdatedAt: managerNoteForUser?.updatedAt,
      limit: 30,
    });
  }, [
    user?.employeeId,
    user?.name,
    activeUsers,
    allProjects,
    myPendingAssignments,
    myPendingKpiObjectives,
    activityFeed,
    performanceHistory,
    personalImprovementTips,
    managerNoteForUser,
    notificationSeenTick,
  ]);

  const unreadNotificationCount = useMemo(
    () => countUnreadNotifications(employeeNotifications),
    [employeeNotifications],
  );

  const personalStatDetails = useMemo<
    Partial<Record<EmployeeStatKey, EmployeeStatDetail[]>>
  >(() => {
    if (!user?.employeeId) return {};

    const mineActive = projectsAssignedToEmployee(
      allProjects,
      user.employeeId,
      activeUsers,
    ).filter(isActiveProject);
    const mineCompleted = projectsAssignedToEmployee(
      completedProjects,
      user.employeeId,
      activeUsers,
    );

    const projectDetail = (project: CreativeProject): EmployeeStatDetail => {
      const deadline = getDeadlineInfo(project.commitmentDate, project.status);
      return {
        id: project.id,
        projectId: project.id,
        title: project.projectName.trim() || 'Proyecto sin nombre',
        meta: `${deadline.label} · Estado: ${project.status.replaceAll('_', ' ')}`,
      };
    };

    return {
      active: mineActive.map(projectDetail),
      completed: mineCompleted.map(projectDetail),
      urgent: mineActive
        .filter((project) => {
          const tone = getDeadlineInfo(project.commitmentDate, project.status).tone;
          return tone === 'overdue' || tone === 'urgent';
        })
        .map(projectDetail),
      notDelivered: mineActive.map(projectDetail),
      dueSoon: mineActive
        .filter(
          (project) =>
            getDeadlineInfo(project.commitmentDate, project.status).tone === 'soon',
        )
        .map(projectDetail),
      pendingAssignments: myPendingAssignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        meta: `Entrega: ${assignment.dueDate} · De: ${assignment.assignedByName}`,
        target: 'assignments',
      })),
      notifications: employeeNotifications
        .filter((notification) => notification.unread)
        .map((notification) => ({
          id: notification.id,
          title: notification.title,
          meta: notification.detail,
          target: notification.target,
        })),
    };
  }, [
    user,
    allProjects,
    completedProjects,
    activeUsers,
    myPendingAssignments,
    employeeNotifications,
  ]);

  const handleStatDetailOpen = useCallback(
    (detail: EmployeeStatDetail) => {
      if (detail.projectId) {
        const project = allProjects.find((item) => item.id === detail.projectId);
        if (project) {
          setProjectFocusCompletion(false);
          setSelectedProject(project);
          return;
        }
      }
      if (detail.target) {
        handleNotificationNavigate(detail.target as NotificationTarget);
      }
    },
    [allProjects, handleNotificationNavigate],
  );

  const stats = useMemo(() => {
    const urgent = marketingTasks.filter((t) => {
      if (t.status === 'completado') return false;
      const diff =
        (new Date(t.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return diff <= 2;
    }).length;
    const blocked = marketingTasks.filter((t) => t.status === 'bloqueado').length;
    const done = marketingTasks.filter((t) => t.status === 'completado').length;
    const projectOverdue = countOverdueProjects(projects.filter(isActiveProject));
    const pendingTeam = assignments.filter((a) => a.status === 'pending').length;
    return { urgent, blocked, done, projectOverdue, pendingTeam };
  }, [marketingTasks, projects, assignments]);

  const displayName = board.companyName || COMPANY_NAME;
  const navItems = NAV.filter((n) => {
    if (n.id === 'pulse') return canEditAll || canSendKpiObjectives;
    if (n.allowEmployeeIds) return isAllowedByEmployee(n.allowEmployeeIds);
    return !n.managerOnly || canEditAll;
  });
  const mobileMoreItems = navItems.filter((n) => !MOBILE_PRIMARY.includes(n.id));
  const isMoreViewActive = mobileMoreItems.some((n) => n.id === view);
  const navLabelFor = (item: { id: DashboardView; label: string }) =>
    item.id === 'team' && !canSeeFullTeam ? 'Mi perfil' : item.label;
  const headlines: Record<DashboardView, { title: string; sub: string }> = {
    home: {
      title: canEditAll ? 'Centro de mando' : 'Mi día',
      sub:
        canEditAll
          ? 'Retrasos, indicaciones y entregas del equipo'
          : 'Tu resumen de hoy',
    },
    team: {
      title: canSeeFullTeam ? 'Equipo de Marketing' : 'Mi perfil',
      sub: canSeeFullTeam ? 'Colaboradores y KPIs del mes' : 'Tu avance y KPIs del mes',
    },
    chat: {
      title: 'Chat de ayuda',
      sub: 'Mensajes compartidos para coordinarse entre todos',
    },
    board: {
      title: 'Proyectos creativos',
      sub: canEditAll ? 'Solicitudes y producción — Marketing Yaavs' : 'Tus proyectos asignados',
    },
    completed: {
      title: 'Trabajos concluidos',
      sub: canEditAll
        ? 'Proyectos terminados con prueba de entrega'
        : 'Proyectos que ya marcaste como concluidos',
    },
    assignments: {
      title: 'Indicaciones',
      sub: canEditAll ? 'Asigna y da seguimiento' : 'Del gerente',
    },
    history: {
      title: 'Resultados del mes',
      sub: canEditAll ? 'Logros y calificaciones del equipo' : 'Tus meses anteriores',
    },
    calendar: { title: 'Mi agenda', sub: 'Pendientes y tiempo' },
    pulse: {
      title: 'Panorama',
      sub: 'Avance del equipo, reportes y exportación',
    },
    community: {
      title: 'Redes y contenido',
      sub: 'TikTok, Meta e Instagram — ¿está gustando?',
    },
    attendance: {
      title: 'Asistencia del área',
      sub: 'Asistencias, faltas y enfermedades del equipo',
    },
    avances: {
      title: 'Avances y evidencias',
      sub: canEditAll
        ? 'Bitácora del equipo con videos, GIFs, PDFs e imágenes'
        : 'Sube qué hiciste y tus evidencias — Orlando recibe aviso',
    },
    library: {
      title: 'Biblioteca de imágenes',
      sub: canEditAll
        ? 'Almacén compartido con link público y API para programación'
        : 'Imágenes del equipo — copia URL o úsalas en proyectos',
    },
  };

  const { title, sub } = headlines[view];

  const openKpiModal = (target: EmployeeTask | null) => {
    setKpiTarget(target);
    setShowKpiModal(true);
  };

  const closeKpiModal = () => {
    setShowKpiModal(false);
    setKpiTarget(null);
  };

  const handleAssignSubmit = (data: AssignFormData) => {
    const count = data.employeeIds?.length ?? (data.employeeId ? 1 : 0);
    submitAssignment(data, () => {
      const names =
        data.employeeIds
          ?.map((id) => assignable.find((t) => t.employeeId === id)?.employeeName)
          .filter(Boolean)
          .join(', ') ??
        assignable.find((t) => t.employeeId === data.employeeId)?.employeeName ??
        'colaborador';
      toast.success(
        count > 1
          ? `Indicación enviada a ${count} colaboradores`
          : `Indicación enviada a ${names}`,
      );
    });
  };

  const handleKpiSubmit = (data: KpiObjectiveFormData) => {
    createKpiObjective(data);
    toast.success(
      `Objetivo KPI enviado a ${kpiAssignable.find((t) => t.employeeId === data.employeeId)?.employeeName ?? 'colaborador'}`,
    );
  };

  if (!user) return null;

  return (
    <div className="dashboard">
      {spyMode && (
        <button
          type="button"
          className="spy-indicator"
          onClick={() => exitSpyMode()}
          title="Vista espejo activa · clic para salir"
          aria-label="Salir de la vista espejo"
        >
          <span className="spy-indicator-dot" aria-hidden />
        </button>
      )}
      {user && (
        <OnboardingTour
          userId={user.id}
          isManager={canEditAll}
          onNavigate={setView}
        />
      )}

      <aside className="sidebar sidebar-desktop">
        <div className="sidebar-brand">
          <BrandLogo size="md" className="sidebar-brand-logo" />
          <span className="visually-hidden">{displayName}</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              data-tour={`nav-${item.id}`}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              onClick={() => {
                if (item.id === 'team') {
                  openTeam();
                } else {
                  setView(item.id);
                }
                if (item.id === 'board') {
                  setProjectFocusCompletion(false);
                }
              }}
            >
              <span className="nav-icon">
                <NavIcon id={item.icon} size={18} />
              </span>
              {navLabelFor(item)}
              {item.id === 'assignments' && pendingAssignmentsCount > 0 && (
                <span className="nav-badge">{pendingAssignmentsCount}</span>
              )}
              {item.id === 'history' && <PerformanceAlertBadge />}
            </button>
          ))}
        </nav>

        {showPersonalWorkStats ? (
          <EmployeeWorkStatsStrip
            variant="sidebar"
            stats={personalWorkStats}
            notificationCount={unreadNotificationCount}
            details={personalStatDetails}
            onOpenDetail={handleStatDetailOpen}
          />
        ) : (
        <div className="sidebar-stats">
          {canEditAll ? (
            <>
              <div className="stat-pill stat-overdue-projects">
                <strong>{stats.projectOverdue}</strong>
                <span>Atrasados</span>
              </div>
              <div className="stat-pill stat-pending-team">
                <strong>{stats.pendingTeam}</strong>
                <span>Indic. pend.</span>
              </div>
              <div className="stat-pill stat-urgent">
                <strong>{stats.urgent}</strong>
                <span>Urgentes</span>
              </div>
            </>
          ) : (
            <>
              <div className="stat-pill stat-urgent">
                <strong>{stats.urgent}</strong>
                <span>Urgentes</span>
              </div>
              <div className="stat-pill stat-blocked">
                <strong>{stats.blocked}</strong>
                <span>Bloqueados</span>
              </div>
              <div className="stat-pill stat-done">
                <strong>{stats.done}</strong>
                <span>Listos</span>
              </div>
            </>
          )}
        </div>
        )}

        <InstallPwaSidebarButton />

        <div className="sidebar-user">
          <button
            type="button"
            className="sidebar-user-btn"
            onClick={() => setShowProfile(true)}
          >
            <UserAvatar user={user} size="md" />
            <div className="sidebar-user-info">
              <strong>{user.name}</strong>
              <span>@{user.username}</span>
            </div>
          </button>
          <button type="button" className="btn-ghost" onClick={logout}>
            Salir
          </button>
        </div>
      </aside>

      <div className="dashboard-body">
        <div className="app-tech-glow" aria-hidden="true" />
        <div className="app-tech-grid" aria-hidden="true" />
        <TechAmbience variant="app" />
        <header className="mobile-topbar">
          <BrandLogo size="md" className="sidebar-brand-logo" />
          <div className="mobile-topbar-title">
            <span className="visually-hidden">{displayName}</span>
            <strong>{user.name}</strong>
            <span>{roleLabel(user.role)}</span>
          </div>
          <div className="mobile-topbar-actions">
            {showPersonalWorkStats && (
              <NotificationBell
                notifications={employeeNotifications}
                onNavigate={handleNotificationNavigate}
                onMarkedSeen={() => setNotificationSeenTick((n) => n + 1)}
              />
            )}
            <button type="button" className="btn-ghost mobile-logout" onClick={logout}>
              Salir
            </button>
          </div>
        </header>

        <main className="main">
          <PerformanceAlertBanner />
          {showPersonalWorkStats && view !== 'home' && (
            <div className="mobile-stats-strip" aria-label="Resumen de tus trabajos">
              <EmployeeWorkStatsStrip
                variant="mobile"
                stats={personalWorkStats}
                notificationCount={unreadNotificationCount}
                details={personalStatDetails}
                onOpenDetail={handleStatDetailOpen}
              />
            </div>
          )}
          {!showPersonalWorkStats && view !== 'home' && (
            <div className="mobile-stats-strip" aria-label="Resumen rápido">
              {canEditAll ? (
                <>
                  <div className="mobile-stat mobile-stat--danger">
                    <strong>{stats.projectOverdue}</strong>
                    <span>Atrasados</span>
                  </div>
                  <div className="mobile-stat mobile-stat--warn">
                    <strong>{stats.pendingTeam}</strong>
                    <span>Indic.</span>
                  </div>
                  <div className="mobile-stat">
                    <strong>{stats.urgent}</strong>
                    <span>Urgentes</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="mobile-stat mobile-stat--warn">
                    <strong>{myPendingAssignments.length}</strong>
                    <span>Indic.</span>
                  </div>
                  <div className="mobile-stat">
                    <strong>{visibleProjects.filter(isActiveProject).length}</strong>
                    <span>Proyectos</span>
                  </div>
                  <div className="mobile-stat mobile-stat--danger">
                    <strong>{stats.urgent}</strong>
                    <span>Urgentes</span>
                  </div>
                </>
              )}
            </div>
          )}
          <header
            className={`main-header dashboard-page-header${view === 'home' ? ' main-header--home' : ''}`}
          >
            <div>
              <h1>{title}</h1>
              <p className="subtitle">{sub}</p>
            </div>
            <div className="main-header-actions">
              {showPersonalWorkStats && (
                <NotificationBell
                  notifications={employeeNotifications}
                  onNavigate={handleNotificationNavigate}
                  onMarkedSeen={() => setNotificationSeenTick((n) => n + 1)}
                />
              )}
              {view === 'team' && (
                <div className="header-actions">
                  <input
                    type="search"
                    className="search-input"
                    placeholder="Buscar por nombre o puesto…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
              )}
              {(view === 'board' || view === 'completed' || view === 'history') && (
                <div className="header-actions">
                  <input
                    type="search"
                    className="search-input"
                    placeholder="Buscar proyecto, colaborador…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  {view === 'board' && canEditAll && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setProjectFocusCompletion(false);
                        setSelectedProject(addProject());
                      }}
                    >
                      + Proyecto
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          <div className="dashboard-page" key={view}>
          <Suspense fallback={<ViewFallback />}>
          {view === 'home' && canEditAll && (
            <ManagerHomeView
              projects={projects}
              completedProjects={completedProjects}
              onGoProjects={() => setView('board')}
              onGoAssignments={() => setView('assignments')}
              onGoCompleted={() => {
                goToCompletedProjects();
                setView('board');
              }}
              onGoTeam={openTeam}
              onOpenProject={(p) => {
                setProjectFocusCompletion(false);
                setSelectedProject(p);
              }}
            />
          )}
          {view === 'home' && !canEditAll && (
            <MyDayView
              onGoAssignments={() => setView('assignments')}
              onGoCalendar={() => setView('calendar')}
              onGoProjects={() => setView('board')}
              onGoCompleted={() => {
                goToCompletedProjects();
                setView('board');
              }}
              onGoKpis={() => goToTeamTab('kpis')}
              onOpenTask={setSelected}
              onOpenProject={(p) => {
                setProjectFocusCompletion(false);
                setSelectedProject(p);
              }}
              onCompleteProject={(p) => {
                setProjectFocusCompletion(true);
                setSelectedProject(p);
              }}
            />
          )}
          {view === 'team' && (
            <MarketingTeamView
              tasks={teamTasks}
              kpiTasks={tasks}
              onSelect={setSelected}
              onAssign={canEditAll ? setAssignTarget : undefined}
              onSendKpi={canSendKpiObjectives ? openKpiModal : undefined}
              onSendKpiObjective={canSendKpiObjectives ? openKpiModal : undefined}
              onOpenProject={(p) => {
                setProjectFocusCompletion(false);
                setSelectedProject(p);
              }}
              showPersonalPulse={!canEditAll && !canSendKpiObjectives}
              employeeId={user?.employeeId}
              personalOnly={!canSeeFullTeam}
              initialTab={teamTabHint}
            />
          )}
          {view === 'chat' && <TeamChatView />}
          {view === 'board' && !canEditAll && myPendingKpiObjectives.length > 0 && (
            <button
              type="button"
              className="pending-assign-alert pending-kpi-alert"
              onClick={() => goToTeamTab('kpis')}
            >
              Tienes un objetivo KPI por aceptar — revisar →
            </button>
          )}
          {view === 'board' && !canEditAll && myPendingAssignments.length > 0 && (
            <button
              type="button"
              className="pending-assign-alert"
              onClick={() => setView('assignments')}
            >
              Tienes {myPendingAssignments.length} indicación nueva — revisar →
            </button>
          )}
          {(view === 'board' || view === 'completed' || view === 'history') && (
            <ProjectsHub
              filter={filter}
              initialTab={
                view === 'completed' ? 'completed' : view === 'history' ? 'history' : undefined
              }
              onSelect={(p) => {
                setProjectFocusCompletion(false);
                setSelectedProject(p);
              }}
            />
          )}
          {view === 'attendance' && canSeeAttendance && <AttendanceView />}
          {view === 'avances' && <AvancesView />}
          {view === 'assignments' && <AssignmentsView />}
          {view === 'calendar' && <CalendarView />}
          {view === 'pulse' && <MarketingPulseView />}
          {view === 'community' && canSeeCommunity && <CommunityView />}
          {view === 'library' && <ImageLibraryView />}
          </Suspense>
          </div>

          {selected && (
            <TaskDetailModal taskId={selected.id} onClose={() => setSelected(null)} />
          )}
          {selectedProject && (
            <ProjectDetailModal
              projectId={selectedProject.id}
              focusCompletion={projectFocusCompletion}
              onClose={() => {
                setSelectedProject(null);
                setProjectFocusCompletion(false);
              }}
            />
          )}
        </main>
      </div>

      <nav className="mobile-tabbar" aria-label="Navegación">
        {navItems
          .filter((item) => MOBILE_PRIMARY.includes(item.id))
          .map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab-item ${view === item.id ? 'active' : ''}`}
              onClick={() => {
                if (item.id === 'team') openTeam();
                else setView(item.id);
              }}
            >
              <span className="tab-icon-wrap">
                <span className="tab-icon">
                  <NavIcon id={item.icon} size={22} />
                </span>
                {item.id === 'assignments' && pendingAssignmentsCount > 0 && (
                  <span className="tab-badge">{pendingAssignmentsCount}</span>
                )}
              </span>
              <span className="tab-label">{navLabelFor(item)}</span>
            </button>
          ))}
        <button
          type="button"
          className={`tab-item ${isMoreViewActive ? 'active' : ''}`}
          onClick={() => setShowMobileMore(true)}
          aria-expanded={showMobileMore}
        >
          <span className="tab-icon-wrap">
            <span className="tab-icon">
              <NavIcon id="more" size={22} />
            </span>
            {!isMoreViewActive && <PerformanceAlertBadge />}
          </span>
          <span className="tab-label">Más</span>
        </button>
      </nav>

      {showMobileMore && (
        <MobileMoreMenu
          items={mobileMoreItems.map((item) => ({
            id: item.id,
            label: navLabelFor(item),
            iconId: item.icon,
            badge: item.id === 'assignments' ? pendingAssignmentsCount : undefined,
          }))}
          activeId={view}
          onSelect={(id) => {
            if (id === 'team') openTeam();
            else setView(id as DashboardView);
          }}
          onClose={() => setShowMobileMore(false)}
        />
      )}

      {assignTarget && (
        <AssignTaskModal
          target={assignTarget}
          assignable={assignable}
          onClose={() => setAssignTarget(null)}
          onSubmit={handleAssignSubmit}
        />
      )}
      {showKpiModal && canSendKpiObjectives && (
        <SendKpiObjectiveModal
          target={kpiTarget}
          assignable={kpiAssignable}
          onClose={closeKpiModal}
          onSubmit={handleKpiSubmit}
        />
      )}
      {override && (
        <WorkloadOverrideModal
          check={override.check}
          onClose={cancelOverride}
          onConfirm={confirmOverride}
        />
      )}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      <YaavsAssistant />
    </div>
  );
}

function roleLabel(role?: string) {
  if (role === 'admin') return 'Administrador';
  if (role === 'lider') return 'Gerente Marketing';
  return 'Marketing';
}
