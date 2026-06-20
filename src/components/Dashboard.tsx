import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { AssignTaskModal, type AssignFormData } from './AssignTaskModal';
import { WorkloadOverrideModal } from './WorkloadOverrideModal';
import { useWorkloadGuard } from '../hooks/useWorkloadGuard';
import { SendKpiObjectiveModal, type KpiObjectiveFormData } from './SendKpiObjectiveModal';
import { AssignmentsView } from './AssignmentsView';
import { BrandLogo } from './BrandLogo';
import { CalendarView } from './CalendarView';
import { KpiMonthView } from './KpiMonthView';
import { ManagerHomeView } from './ManagerHomeView';
import { TechAmbience } from './TechAmbience';
import { YaavsAssistant } from './YaavsAssistant';
import { MyDayView } from './MyDayView';
import { OnboardingTour } from './OnboardingTour';
import { ProfileModal } from './ProfileModal';
import { UserAvatar } from './UserAvatar';
import { ReportsView } from './ReportsView';
import { CommunityView } from './CommunityView';
import { MarketingPulseView } from './MarketingPulseView';
import { MonthlyHistoryView } from './MonthlyHistoryView';
import { PerformanceAlertBanner, PerformanceAlertBadge } from './PerformanceAlertBanner';
import { TaskDetailModal } from './TaskDetailModal';
import { ProjectsBoard } from './ProjectsBoard';
import { CompletedProjectsView } from './CompletedProjectsView';
import { MarketingTeamView } from './MarketingTeamView';
import { ProjectDetailModal } from './ProjectDetailModal';
import { MobileMoreMenu } from './MobileMoreMenu';
import { useAssignmentNotifications } from '../hooks/useAssignmentNotifications';
import { useDashboardRoute } from '../hooks/useDashboardRoute';
import { usePerformanceStreakAlert } from '../hooks/usePerformanceStreakAlert';
import { COMPANY_NAME } from '../constants';
import type { DashboardView } from '../utils/dashboardRoutes';
import { countOverdueProjects } from '../utils/projectLink';
import { fuzzyIncludes } from '../utils/fuzzyMatch';
import { isActiveProject } from '../utils/activeItems';
import { takeRolloverNotice } from '../utils/monthlyArchive';
import type { CreativeProject, EmployeeTask } from '../types';
import './Dashboard.css';

const NAV: { id: DashboardView; label: string; icon: string; managerOnly?: boolean }[] = [
  { id: 'home', label: 'Inicio', icon: '⌂' },
  { id: 'team', label: 'Equipo', icon: '◉' },
  { id: 'board', label: 'Proyectos', icon: '◆' },
  { id: 'completed', label: 'Concluidos', icon: '✓' },
  { id: 'assignments', label: 'Indic.', icon: '✉' },
  { id: 'kpis', label: 'KPIs', icon: '◎' },
  { id: 'history', label: 'Historial', icon: '◷' },
  { id: 'pulse', label: 'Panorama', icon: '◐', managerOnly: true },
  { id: 'community', label: 'Redes', icon: '◇' },
  { id: 'calendar', label: 'Agenda', icon: '▣' },
  { id: 'reports', label: 'Reportes', icon: '▤', managerOnly: true },
];

const MOBILE_PRIMARY: DashboardView[] = ['home', 'board', 'assignments', 'team'];

export function Dashboard() {
  const {
    user,
    board,
    logout,
    filter,
    setFilter,
    canEditAll,
    canSendKpiObjectives,
    activeUsers,
    marketingTasks,
    addProject,
    projects,
    visibleProjects,
    visibleCompletedProjects,
    completedProjects,
    pendingAssignmentsCount,
    myPendingAssignments,
    myPendingKpiObjectives,
    createKpiObjective,
    performanceHistory,
    assignments,
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

  useAssignmentNotifications(myPendingAssignments, !canEditAll && Boolean(user));
  usePerformanceStreakAlert(
    user?.employeeId,
    performanceHistory,
    !canEditAll && Boolean(user),
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
    return !n.managerOnly || canEditAll;
  });
  const mobileMoreItems = navItems.filter((n) => !MOBILE_PRIMARY.includes(n.id));
  const isMoreViewActive = mobileMoreItems.some((n) => n.id === view);

  const headlines: Record<DashboardView, { title: string; sub: string }> = {
    home: {
      title: canEditAll ? 'Centro de mando' : 'Mi día',
      sub: canEditAll
        ? 'Retrasos, indicaciones y entregas del equipo'
        : 'Tu resumen de hoy',
    },
    team: {
      title: 'Equipo de Marketing',
      sub: canEditAll ? 'Colaboradores del área' : 'Quiénes trabajan contigo',
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
    kpis: { title: 'KPIs del mes', sub: canEditAll ? 'Equipo' : 'Tu avance' },
    history: {
      title: 'Historial mensual',
      sub: canEditAll ? 'Logros y calificaciones del equipo' : 'Tus meses anteriores',
    },
    calendar: { title: 'Mi agenda', sub: 'Pendientes y tiempo' },
    reports: { title: 'Reportes', sub: 'Resumen y exportación' },
    pulse: {
      title: 'Panorama Marketing',
      sub: 'Pastel del equipo, ritmo diario y cierre de mes',
    },
    community: {
      title: 'Redes y contenido',
      sub: 'TikTok, Meta e Instagram — ¿está gustando?',
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
    submitAssignment(data, () => {
      toast.success(
        `Indicación enviada a ${assignable.find((t) => t.employeeId === data.employeeId)?.employeeName ?? 'colaborador'}`,
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
                setView(item.id);
                if (item.id === 'board') {
                  setProjectFocusCompletion(false);
                }
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.id === 'assignments' && pendingAssignmentsCount > 0 && (
                <span className="nav-badge">{pendingAssignmentsCount}</span>
              )}
              {item.id === 'history' && <PerformanceAlertBadge />}
            </button>
          ))}
        </nav>

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
          <button type="button" className="btn-ghost mobile-logout" onClick={logout}>
            Salir
          </button>
        </header>

        <main className="main">
          <PerformanceAlertBanner />
          {view !== 'home' && (
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
          <header className="main-header">
            <div>
              <h1>{title}</h1>
              <p className="subtitle">{sub}</p>
            </div>
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
            {(view === 'board' || view === 'completed') && (
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
          </header>

          {view === 'home' && canEditAll && (
            <ManagerHomeView
              projects={projects}
              completedProjects={completedProjects}
              onGoProjects={() => setView('board')}
              onGoAssignments={() => setView('assignments')}
              onGoCompleted={() => setView('completed')}
              onGoTeam={() => setView('team')}
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
              onGoCompleted={() => setView('completed')}
              onGoKpis={() => setView('kpis')}
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
              onSelect={setSelected}
              onAssign={canEditAll ? setAssignTarget : undefined}
              onSendKpi={canSendKpiObjectives ? openKpiModal : undefined}
            />
          )}
          {view === 'board' && !canEditAll && myPendingKpiObjectives.length > 0 && (
            <button
              type="button"
              className="pending-assign-alert pending-kpi-alert"
              onClick={() => setView('kpis')}
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
          {view === 'board' && (
            <ProjectsBoard
              projects={visibleProjects}
              filter={filter}
              onSelect={(p) => {
                setProjectFocusCompletion(false);
                setSelectedProject(p);
              }}
              onGoCompleted={() => setView('completed')}
            />
          )}
          {view === 'completed' && (
            <CompletedProjectsView
              projects={visibleCompletedProjects}
              filter={filter}
              onSelect={setSelectedProject}
            />
          )}
          {view === 'assignments' && <AssignmentsView />}
          {view === 'kpis' && (
            <KpiMonthView
              tasks={tasks}
              onSendKpi={canSendKpiObjectives ? openKpiModal : undefined}
              showPersonalPulse={!canEditAll && !canSendKpiObjectives}
              employeeId={user?.employeeId}
            />
          )}
          {view === 'history' && <MonthlyHistoryView />}
          {view === 'calendar' && <CalendarView />}
          {view === 'reports' && <ReportsView />}
          {view === 'pulse' && <MarketingPulseView />}
          {view === 'community' && <CommunityView />}

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
              onClick={() => setView(item.id)}
            >
              <span className="tab-icon-wrap">
                <span className="tab-icon">{item.icon}</span>
                {item.id === 'assignments' && pendingAssignmentsCount > 0 && (
                  <span className="tab-badge">{pendingAssignmentsCount}</span>
                )}
              </span>
              <span className="tab-label">{item.label}</span>
            </button>
          ))}
        <button
          type="button"
          className={`tab-item ${isMoreViewActive ? 'active' : ''}`}
          onClick={() => setShowMobileMore(true)}
          aria-expanded={showMobileMore}
        >
          <span className="tab-icon-wrap">
            <span className="tab-icon">⋯</span>
            {!isMoreViewActive && <PerformanceAlertBadge />}
          </span>
          <span className="tab-label">Más</span>
        </button>
      </nav>

      {showMobileMore && (
        <MobileMoreMenu
          items={mobileMoreItems.map((item) => ({
            id: item.id,
            label: item.label,
            icon: item.icon,
            badge: item.id === 'assignments' ? pendingAssignmentsCount : undefined,
          }))}
          activeId={view}
          onSelect={(id) => setView(id as DashboardView)}
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
