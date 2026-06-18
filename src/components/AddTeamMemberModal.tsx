import { useState, type FormEvent } from 'react';
import { SpellCheckInput } from './SpellCheckField';
import type { AddTeamMemberInput } from '../utils/teamRoster';
import { isValidUsername, normalizeUsername } from '../utils/teamRoster';
import './AddTeamMemberModal.css';

interface Props {
  onClose: () => void;
  onSubmit: (input: AddTeamMemberInput) => { ok: boolean; error?: string };
}

export function AddTeamMemberModal({ onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const user = normalizeUsername(username);
    if (!name.trim()) {
      setError('Escribe el nombre completo.');
      return;
    }
    if (!roleTitle.trim()) {
      setError('Indica el puesto o área.');
      return;
    }
    if (!isValidUsername(user)) {
      setError('Usuario: 3–24 caracteres (letras, números, . _ -).');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    const result = onSubmit({
      name: name.trim(),
      roleTitle: roleTitle.trim(),
      username: user,
      password,
      phone: phone.trim() || undefined,
    });
    if (!result.ok) {
      setError(result.error ?? 'No se pudo agregar al miembro.');
      return;
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel add-member-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="add-member-title"
      >
        <header className="modal-header">
          <h2 id="add-member-title">Nuevo miembro de Marketing</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <form className="add-member-form" onSubmit={handleSubmit}>
          <label>
            Nombre completo
            <SpellCheckInput
              value={name}
              autoFix={false}
              extraWords={[name]}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. María López"
              required
            />
          </label>
          <label>
            Puesto / área
            <SpellCheckInput
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Ej. Diseñador gráfico"
              required
            />
          </label>
          <label>
            Usuario (para entrar al panel)
            <input
              type="text"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej. maria.lopez"
              required
            />
          </label>
          <label>
            Contraseña inicial
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </label>
          <label>
            WhatsApp (opcional)
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="52…"
            />
          </label>
          {error && <p className="add-member-error">{error}</p>}
          <p className="add-member-note">
            El colaborador podrá iniciar sesión con este usuario y contraseña. Podrá cambiar su
            contraseña desde su perfil.
          </p>
          <div className="add-member-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Agregar al equipo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
