import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import { canWriteManagerObservations } from '../utils/kpiPermissions';
import { formatShortDate } from '../utils/formatDate';
import './ManagerObservationBlock.css';

interface Props {
  employeeId: string;
  employeeName: string;
  monthKey: string;
  personal?: boolean;
  compact?: boolean;
}

export function ManagerObservationBlock({
  employeeId,
  employeeName,
  monthKey,
  personal = false,
  compact = false,
}: Props) {
  const { user, getManagerObservation, setManagerObservation } = useApp();
  const canEdit = canWriteManagerObservations(user);
  const saved = getManagerObservation(employeeId, monthKey);
  const [draft, setDraft] = useState(saved?.text ?? '');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(saved?.text ?? '');
  }, [saved?.text, employeeId, monthKey]);

  const handleSave = (e?: FormEvent) => {
    e?.preventDefault();
    setManagerObservation({ employeeId, monthKey, text: draft });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  const title = personal ? 'Observación de tu gerente' : 'Observación del gerente';
  const placeholder = personal
    ? 'Tu gerente aún no ha dejado una nota personalizada este mes.'
    : `Nota para ${employeeName}. Ej.: Falta más seriedad, la calidad del diseño bajó, mejorar puntualidad en entregas…`;

  if (!canEdit && !saved?.text?.trim()) {
    return null;
  }

  return (
    <div
      className={`manager-observation${compact ? ' manager-observation--compact' : ''}${personal ? ' manager-observation--personal' : ''}`}
    >
      <h4>{title}</h4>

      {canEdit ? (
        <form onSubmit={handleSave} className="manager-observation-form">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            rows={compact ? 3 : 4}
            aria-label={`Observación para ${employeeName}`}
          />
          <div className="manager-observation-actions">
            {saved?.updatedAt && (
              <span className="manager-observation-meta">
                Última edición: {formatShortDate(saved.updatedAt.slice(0, 10))}
                {saved.authorName ? ` · ${saved.authorName}` : ''}
              </span>
            )}
            <button type="submit" className="btn-primary btn-sm">
              {savedFlash ? 'Guardado' : 'Guardar observación'}
            </button>
          </div>
        </form>
      ) : (
        <div className="manager-observation-read">
          <p>{saved?.text}</p>
          {saved?.updatedAt && (
            <span className="manager-observation-meta">
              {saved.authorName} · {formatShortDate(saved.updatedAt.slice(0, 10))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
