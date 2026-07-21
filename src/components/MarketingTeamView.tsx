import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { AddTeamMemberModal } from './AddTeamMemberModal';
import { KpiMonthView } from './KpiMonthView';
import { TeamBoard } from './TeamBoard';
import { readTeamTab, setTeamTab, type TeamTab } from '../utils/teamTab';
import type { CreativeProject, EmployeeTask } from '../types';
import './MarketingTeamView.css';

interface Props {
  tasks: EmployeeTask[];
  kpiTasks: EmployeeTask[];
  onSelect: (task: EmployeeTask) => void;
  onAssign?: (task: EmployeeTask) => void;
  onSendKpi?: (task: EmployeeTask) => void;
  onSendKpiObjective?: (task: EmployeeTask | null) => void;
  onOpenProject?: (project: CreativeProject) => void;
  showPersonalPulse?: boolean;
  employeeId?: string;
  personalOnly?: boolean;
  initialTab?: TeamTab;
}

export function MarketingTeamView({
  tasks,
  kpiTasks,
  onSelect,
  onAssign,
  onSendKpi,
  onSendKpiObjective,
  onOpenProject,
  showPersonalPulse,
  employeeId,
  personalOnly,
  initialTab,
}: Props) {
  const { canEditAll, canSendKpiObjectives, addTeamMember } = useApp();
  const visibleTasks =
    personalOnly && employeeId ? tasks.filter((t) => t.employeeId === employeeId) : tasks;
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<TeamTab>(readTeamTab);

  useEffect(() => {
    setTeamTab(tab);
  }, [tab]);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  return (
    <div className="marketing-team-view">
      <div className="team-hub-tabs" role="tablist" aria-label="Secciones de equipo">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'cards'}
          className={tab === 'cards' ? 'active' : ''}
          onClick={() => setTab('cards')}
        >
          {personalOnly ? 'Mi perfil' : 'Colaboradores'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'kpis'}
          className={tab === 'kpis' ? 'active' : ''}
          onClick={() => setTab('kpis')}
        >
          KPIs del mes
        </button>
      </div>

      <div className="team-hub-panel" role="tabpanel">
        {tab === 'cards' && (
          <>
            <p className="team-intro">
              {personalOnly
                ? 'Tu perfil y trabajo actual. Al marcar un trabajo como Completado, la tarjeta se reinicia sola.'
                : canEditAll
                  ? 'Personas del área de Marketing. Al marcar un trabajo como Completado, se limpia solo de la tarjeta.'
                  : 'Conoce a quienes trabajan contigo. Al terminar tu trabajo (Completado), la tarjeta se reinicia sola.'}
            </p>

            {canEditAll && (
              <div className="team-toolbar">
                <button type="button" className="btn-primary" onClick={() => setShowAdd(true)}>
                  + Agregar miembro
                </button>
                <span className="team-count">{tasks.length} en el equipo</span>
              </div>
            )}

            <TeamBoard
              tasks={visibleTasks}
              onSelect={onSelect}
              onAssign={onAssign}
              onSendKpi={canSendKpiObjectives ? onSendKpi : undefined}
              onOpenProject={onOpenProject}
            />
          </>
        )}

        {tab === 'kpis' && (
          <KpiMonthView
            tasks={kpiTasks}
            onSendKpi={onSendKpiObjective}
            showPersonalPulse={showPersonalPulse}
            employeeId={employeeId}
          />
        )}
      </div>

      {showAdd && (
        <AddTeamMemberModal
          onClose={() => setShowAdd(false)}
          onSubmit={(input) => {
            const result = addTeamMember(input);
            if (result.ok) {
              toast.success(`${input.name} se agregó al equipo.`);
            }
            return result;
          }}
        />
      )}
    </div>
  );
}
