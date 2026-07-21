import type { DashboardView } from './dashboardRoutes';

export type TeamTab = 'cards' | 'kpis';

const TEAM_TAB_KEY = 'yaavs-team-tab';

export function setTeamTab(tab: TeamTab): void {
  try {
    sessionStorage.setItem(TEAM_TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}

export function readTeamTab(): TeamTab {
  try {
    return sessionStorage.getItem(TEAM_TAB_KEY) === 'kpis' ? 'kpis' : 'cards';
  } catch {
    return 'cards';
  }
}

export function navigateToTeamTab(
  tab: TeamTab,
  setView: (view: DashboardView) => void,
): void {
  setTeamTab(tab);
  setView('team');
}
