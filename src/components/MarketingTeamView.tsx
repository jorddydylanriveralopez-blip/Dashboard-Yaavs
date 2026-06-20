import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { AddTeamMemberModal } from './AddTeamMemberModal';
import { TeamBoard } from './TeamBoard';
import type { EmployeeTask } from '../types';
import './MarketingTeamView.css';

interface Props {
  tasks: EmployeeTask[];
  onSelect: (task: EmployeeTask) => void;
  onAssign?: (task: EmployeeTask) => void;
  onSendKpi?: (task: EmployeeTask) => void;
}

export function MarketingTeamView({ tasks, onSelect, onAssign, onSendKpi }: Props) {
  const { canEditAll, canSendKpiObjectives, addTeamMember } = useApp();
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="marketing-team-view">
      <p className="team-intro">
        {canEditAll
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
        tasks={tasks}
        onSelect={onSelect}
        onAssign={onAssign}
        onSendKpi={canSendKpiObjectives ? onSendKpi : undefined}
      />

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
