/** Navegar a concluidos desde otras vistas (y mientras ProjectsHub ya está montado). */
export const PROJECTS_TAB_EVENT = 'yaavs-projects-tab';

export function goToCompletedProjects(): void {
  sessionStorage.setItem('yaavs-projects-tab', 'completed');
  window.dispatchEvent(new CustomEvent(PROJECTS_TAB_EVENT, { detail: 'completed' }));
}

export type ProjectsTab = 'active' | 'completed' | 'history' | 'extras';
