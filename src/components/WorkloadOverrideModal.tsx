import { useState, type FormEvent } from 'react';
import type { WorkloadCheckResult } from '../types';
import './WorkloadOverrideModal.css';

interface Props {
  check: WorkloadCheckResult;
  onClose: () => void;
  onConfirm: (password: string) => void;
}

export function WorkloadOverrideModal({ check, onClose, onConfirm }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Escribe tu contraseña para autorizar el trabajo extra.');
      return;
    }
    setError('');
    onConfirm(password);
  };

  return (
    <div className="modal-backdrop workload-override-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel workload-override-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="workload-override-title"
      >
        <header className="workload-override-head">
          <span className="workload-override-icon" aria-hidden>
            ⚠
          </span>
          <div>
            <h2 id="workload-override-title">Límite de trabajos alcanzado</h2>
            <p>
              <strong>{check.employeeName}</strong> ya tiene{' '}
              <strong>{check.current.total}</strong> de <strong>{check.max}</strong> trabajos
              activos. Solo se cuentan sus proyectos activos actuales.
            </p>
          </div>
        </header>

        <p className="workload-override-hint">
          Para enviar uno más, confirma con <strong>tu contraseña de gerente</strong>. Úsalo solo
          cuando sea realmente necesario.
        </p>

        <form onSubmit={handleSubmit} className="workload-override-form">
          <label>
            Tu contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Contraseña de Orlando / Carlos…"
              autoFocus
              autoComplete="current-password"
            />
          </label>
          {error && <p className="workload-override-error">{error}</p>}
          <div className="workload-override-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Autorizar y enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
