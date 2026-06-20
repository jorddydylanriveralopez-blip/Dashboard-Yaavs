export type DashboardView =
  | 'home'
  | 'team'
  | 'board'
  | 'completed'
  | 'assignments'
  | 'kpis'
  | 'history'
  | 'calendar'
  | 'reports'
  | 'pulse'
  | 'community';

const PATH_TO_VIEW: Record<string, DashboardView> = {
  '/': 'home',
  '/inicio': 'home',
  '/equipo': 'team',
  '/proyectos': 'board',
  '/concluidos': 'completed',
  '/indicaciones': 'assignments',
  '/kpis': 'kpis',
  '/historial': 'history',
  '/agenda': 'calendar',
  '/reportes': 'reports',
  '/panorama': 'pulse',
  '/redes': 'community',
};

const VIEW_TO_PATH: Record<DashboardView, string> = {
  home: '/inicio',
  team: '/equipo',
  board: '/proyectos',
  completed: '/concluidos',
  assignments: '/indicaciones',
  kpis: '/kpis',
  history: '/historial',
  calendar: '/agenda',
  reports: '/reportes',
  pulse: '/panorama',
  community: '/redes',
};

export function viewFromPath(pathname: string): DashboardView {
  const clean = pathname.replace(/\/$/, '') || '/';
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
