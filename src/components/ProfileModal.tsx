import { useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import './ProfileModal.css';

interface Props {
  onClose: () => void;
}

export function ProfileModal({ onClose }: Props) {
  const { user, changePassword, syncOnline } = useApp();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  if (!user) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (next !== confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (changePassword(current, next)) {
      toast.success('Contraseña actualizada');
      onClose();
    } else {
      toast.error('Contraseña actual incorrecta');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-panel profile-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Mi cuenta</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="profile-body">
          <p>
            <strong>{user.name}</strong>
            <br />
            <span className="profile-user">{user.username}</span>
          </p>
          <p className={`sync-status ${syncOnline ? 'online' : 'offline'}`}>
            {syncOnline
              ? '● Conectado al servidor — el equipo ve los mismos datos'
              : '○ Modo local — inicia el servidor para sincronizar en equipo'}
          </p>
          <form onSubmit={handleSubmit}>
            <h3>Cambiar contraseña</h3>
            <label>
              Contraseña actual
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </label>
            <label>
              Nueva contraseña
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={6}
              />
            </label>
            <label>
              Confirmar nueva
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn-primary">
              Guardar
            </button>
          </form>
          <p className="profile-recovery">
            ¿Olvidaste tu contraseña? Contacta al administrador o gerente de Marketing.
          </p>
        </div>
      </div>
    </div>
  );
}
