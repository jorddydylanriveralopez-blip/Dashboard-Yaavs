import type { EmployeeTask } from '../types';
import './CollaboratorMultiSelect.css';

interface Props {
  assignable: EmployeeTask[];
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  variant?: 'default' | 'chips';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function EmployeeMultiSelect({
  assignable,
  values,
  onChange,
  disabled,
  variant = 'default',
}: Props) {
  const allIds = assignable.map((t) => t.employeeId);
  const isAll = allIds.length > 0 && allIds.every((id) => values.includes(id));
  const isNone = values.length === 0;

  const toggleAll = () => {
    if (disabled) return;
    onChange(isAll ? [] : allIds);
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
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

  if (variant === 'chips') {
    return (
      <div
        className={`collab-chips${disabled ? ' collab-chips--disabled' : ''}`}
        role="group"
        aria-label="Colaboradores"
      >
        <button
          type="button"
          className={`collab-chip collab-chip--all${isAll ? ' collab-chip--on' : ''}`}
          disabled={disabled}
          onClick={toggleAll}
          aria-pressed={isAll}
        >
          Todos
        </button>
        <button
          type="button"
          className={`collab-chip${isNone ? ' collab-chip--on' : ''}`}
          disabled={disabled}
          onClick={clearAll}
          aria-pressed={isNone}
        >
          Ninguno
        </button>
        {assignable.map((t) => {
          const on = values.includes(t.employeeId);
          return (
            <button
              key={t.employeeId}
              type="button"
              className={`collab-chip${on ? ' collab-chip--on' : ''}`}
              disabled={disabled}
              onClick={() => toggleOne(t.employeeId)}
              aria-pressed={on}
            >
              <span className="collab-chip-avatar" aria-hidden="true">
                {initials(t.employeeName)}
              </span>
              <span className="collab-chip-name">{t.employeeName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`collab-multi${disabled ? ' collab-multi--disabled' : ''}`}>
      <div className="collab-multi-top">
        <label className="collab-multi-option collab-multi-option--all">
          <input
            type="checkbox"
            checked={isAll}
            disabled={disabled}
            onChange={toggleAll}
          />
          <span>Todos</span>
        </label>
        <label className="collab-multi-option collab-multi-option--none">
          <input
            type="checkbox"
            checked={isNone}
            disabled={disabled}
            onChange={clearAll}
          />
          <span>Ninguno</span>
        </label>
      </div>
      <div className="collab-multi-grid">
        {assignable.map((t) => (
          <label key={t.employeeId} className="collab-multi-option">
            <input
              type="checkbox"
              checked={values.includes(t.employeeId)}
              disabled={disabled}
              onChange={() => toggleOne(t.employeeId)}
            />
            <span>{t.employeeName}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
