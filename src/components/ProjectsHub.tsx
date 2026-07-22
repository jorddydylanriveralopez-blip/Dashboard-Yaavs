import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ProjectsBoard } from './ProjectsBoard';
import { CompletedProjectsView } from './CompletedProjectsView';
import { MonthlyHistoryView } from './MonthlyHistoryView';
import { ExtraProjectsView } from './ExtraProjectsView';
import { PROJECTS_TAB_EVENT, type ProjectsTab } from '../utils/projectsTab';
import './ProjectsHub.css';

interface Props {
  filter: string;
  onSelect: (project: import('../types').CreativeProject) => void;
  initialTab?: ProjectsTab;
}

export function ProjectsHub({ filter, onSelect, initialTab }: Props) {
  const { canEditAll, visibleProjects, visibleCompletedProjects, pendingExtraProjects } =
    useApp();
  const [tab, setTab] = useState<ProjectsTab>(
    () => initialTab ?? (sessionStorage.getItem('yaavs-projects-tab') as ProjectsTab) ?? 'active',
  );

  useEffect(() => {
    sessionStorage.setItem('yaavs-projects-tab', tab);
  }, [tab]);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<ProjectsTab>).detail;
      if (next === 'active' || next === 'completed' || next === 'history' || next === 'extras') {
        setTab(next);
      }
    };
    window.addEventListener(PROJECTS_TAB_EVENT, onTab);
    return () => window.removeEventListener(PROJECTS_TAB_EVENT, onTab);
  }, []);

  return (
    <div className="projects-hub">
      <div className="projects-hub-tabs" role="tablist" aria-label="Secciones de proyectos">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          className={tab === 'active' ? 'active' : ''}
          onClick={() => setTab('active')}
        >
          Activos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'completed'}
          className={tab === 'completed' ? 'active' : ''}
          onClick={() => setTab('completed')}
        >
          Concluidos ✓
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'extras'}
          className={tab === 'extras' ? 'active' : ''}
          onClick={() => setTab('extras')}
        >
          Extras
          {canEditAll && pendingExtraProjects.length > 0 && (
            <span className="projects-hub-tab-badge">{pendingExtraProjects.length}</span>
          )}
        </button>
        {canEditAll && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'history'}
            className={tab === 'history' ? 'active' : ''}
            onClick={() => setTab('history')}
          >
            Resultados del mes
          </button>
        )}
      </div>

      <div className="projects-hub-panel" role="tabpanel">
        {tab === 'active' && (
          <ProjectsBoard
            projects={visibleProjects}
            filter={filter}
            onSelect={onSelect}
            onGoCompleted={() => setTab('completed')}
          />
        )}
        {tab === 'completed' && (
          <CompletedProjectsView
            projects={visibleCompletedProjects}
            filter={filter}
            onSelect={onSelect}
          />
        )}
        {tab === 'extras' && <ExtraProjectsView filter={filter} />}
        {tab === 'history' && canEditAll && <MonthlyHistoryView />}
      </div>
    </div>
  );
}
