import type { EmployeeTask } from '../types';
import './CollaboratorMultiSelect.css';

interface Props {
  assignable: EmployeeTask[];
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

export function EmployeeMultiSelect({ assignable, values, onChange, disabled }: Props) {
  const allIds = assignable.map((t) => t.employeeId);
  const isAll = allIds.length > 0 && allIds.every((id) => values.includes(id));

  const toggleAll = () => {
    if (disabled) return;
    onChange(isAll ? [] : allIds);
  };

  const toggleOne = (employeeId: string) => {
    if (disabled) return;
    if (isAll) {
      onChange([employeeId]);
      return;
    }
    const next = values.includes(employeeId)
      ? values.filter((id) => id !== employeeId)
      : [...values, employeeId];
    onChange(next);
  };

  return (
    <div className={`collab-multi${disabled ? ' collab-multi--disabled' : ''}`}>
      <label className="collab-multi-option collab-multi-option--all">
        <input
          type="checkbox"
          checked={isAll}
          disabled={disabled}
          onChange={toggleAll}
        />
        <span>Todos</span>
      </label>
      <div className="collab-multi-grid">
        {assignable.map((t) => (
          <label key={t.employeeId} className="collab-multi-option">
            <input
              type="checkbox"
              checked={isAll || values.includes(t.employeeId)}
              disabled={disabled || isAll}
              onChange={() => toggleOne(t.employeeId)}
            />
            <span>{t.employeeName}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
