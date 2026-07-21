import { INDIVIDUAL_COLLABORATORS } from '../utils/projectCollaborators';
import { normalizeProjectCollaborators } from '../utils/projectCollaborators';
import type { Collaborator } from '../types';
import './CollaboratorMultiSelect.css';

interface Props {
  values: Collaborator[];
  onChange: (values: Collaborator[]) => void;
  disabled?: boolean;
}

export function CollaboratorMultiSelect({ values, onChange, disabled }: Props) {
  const isTodos = values.includes('todos');

  const toggleTodos = () => {
    if (disabled) return;
    onChange(isTodos ? [] : ['todos']);
  };

  const toggleOne = (slug: Collaborator) => {
    if (disabled) return;
    if (isTodos) {
      onChange([slug]);
      return;
    }
    const next = values.includes(slug)
      ? values.filter((v) => v !== slug)
      : [...values.filter((v) => v !== 'todos'), slug];
    onChange(normalizeProjectCollaborators(next));
  };

  return (
    <div className={`collab-multi${disabled ? ' collab-multi--disabled' : ''}`}>
      <label className="collab-multi-option collab-multi-option--all">
        <input
          type="checkbox"
          checked={isTodos}
          disabled={disabled}
          onChange={toggleTodos}
        />
        <span>Todos</span>
      </label>
      <div className="collab-multi-grid">
        {INDIVIDUAL_COLLABORATORS.map((c) => (
          <label key={c.value} className="collab-multi-option">
            <input
              type="checkbox"
              checked={isTodos || values.includes(c.value)}
              disabled={disabled || isTodos}
              onChange={() => toggleOne(c.value)}
            />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
