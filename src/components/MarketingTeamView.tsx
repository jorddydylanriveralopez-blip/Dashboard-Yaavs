import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AddTeamMemberModal } from './AddTeamMemberModal';
import { TeamBoard } from './TeamBoard';
import type { EmployeeTask } from '../types';
import './MarketingTeamView.css';

interface Props {
  tasks: EmployeeTask[];
  onSelect: (task: EmployeeTask) => void;
  onAssign?: (task: EmployeeTask) => void;
}

export function MarketingTeamView({ tasks, onSelect, onAssign }: Props) {
  const { canEditAll, addTeamMember } = useApp();
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

      <TeamBoard tasks={tasks} onSelect={onSelect} onAssign={onAssign} />

      {showAdd && (
        <AddTeamMemberModal
          onClose={() => setShowAdd(false)}
          onSubmit={(input) => addTeamMember(input)}
        />
      )}
    </div>
  );
}
