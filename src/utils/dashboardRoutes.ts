import { setTeamTab } from './teamTab';

export type DashboardView =
  | 'home'
  | 'team'
  | 'chat'
  | 'board'
  | 'completed'
  | 'assignments'
  | 'history'
  | 'calendar'
  | 'pulse'
  | 'community'
  | 'attendance'
  | 'library';

const PATH_TO_VIEW: Record<string, DashboardView> = {
  '/': 'home',
  '/inicio': 'home',
  '/equipo': 'team',
  '/chat': 'chat',
  '/proyectos': 'board',
  '/concluidos': 'completed',
  '/indicaciones': 'assignments',
  '/historial': 'history',
  '/agenda': 'calendar',
  '/reportes': 'pulse',
  '/panorama': 'pulse',
  '/redes': 'community',
  '/asistencia': 'attendance',
  '/biblioteca': 'library',
};

const VIEW_TO_PATH: Record<DashboardView, string> = {
  home: '/inicio',
  team: '/equipo',
  chat: '/chat',
  board: '/proyectos',
  completed: '/concluidos',
  assignments: '/indicaciones',
  history: '/historial',
  calendar: '/agenda',
  pulse: '/panorama',
  community: '/redes',
  attendance: '/asistencia',
  library: '/biblioteca',
};

export function viewFromPath(pathname: string): DashboardView {
  const clean = pathname.replace(/\/$/, '') || '/';
  if (clean === '/kpis') {
    setTeamTab('kpis');
    return 'team';
  }
  return PATH_TO_VIEW[clean] ?? 'home';
}

export function pathForView(view: DashboardView): string {
  return VIEW_TO_PATH[view];
}

export function readDashboardView(): DashboardView {
  if (typeof window === 'undefined') return 'home';
  return viewFromPath(window.location.pathname);
}

export function navigateToView(view: DashboardView, replace = false): void {
  const path = pathForView(view);
  if (window.location.pathname === path) return;
  if (replace) {
    window.history.replaceState({ view }, '', path);
  } else {
    window.history.pushState({ view }, '', path);
  }
}
