import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { MAX_PROFILE_AVATAR_BYTES } from '../constants';
import { readProfileImageFile } from '../utils/userProfiles';
import { isValidUsername, normalizeUsername } from '../utils/teamRoster';
import { UserAvatar } from './UserAvatar';
import './ProfileModal.css';

interface Props {
  onClose: () => void;
}

export function ProfileModal({ onClose }: Props) {
  const { user, updateProfile, syncOnline } = useApp();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(user?.username ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const usernameChanged = normalizeUsername(username) !== user.username.toLowerCase();
  const usernameHint = username.trim()
    ? isValidUsername(normalizeUsername(username))
      ? `@${normalizeUsername(username)}`
      : '3–24 caracteres: letras, números, . _ -'
    : '';

  const handlePickPhoto = () => fileRef.current?.click();

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readProfileImageFile(file, MAX_PROFILE_AVATAR_BYTES);
      setAvatarPreview(dataUrl);
      setAvatarDirty(true);
      setRemoveAvatar(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar la imagen.');
    }
  };

  const handleRemovePhoto = () => {
    setAvatarPreview(null);
    setAvatarDirty(true);
    setRemoveAvatar(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const wantsPassword = newPw.length > 0 || confirmPw.length > 0 || currentPw.length > 0;
    if (wantsPassword) {
      if (newPw.length < 6) {
        toast.error('La nueva contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (newPw !== confirmPw) {
        toast.error('Las contraseñas nuevas no coinciden.');
        return;
      }
    }

    setBusy(true);
    const result = updateProfile({
      username: usernameChanged ? username : undefined,
      avatarUrl: avatarDirty ? (removeAvatar ? null : avatarPreview) : undefined,
      currentPassword: wantsPassword ? currentPw : undefined,
      newPassword: wantsPassword ? newPw : undefined,
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success('Perfil actualizado');
    onClose();
  };

  const previewUser = {
    ...user,
    username: normalizeUsername(username) || user.username,
    avatarUrl: removeAvatar ? undefined : avatarPreview ?? user.avatarUrl,
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-panel profile-modal" onClick={(ev) => ev.stopPropagation()}>
        <header className="profile-modal-header">
          <div>
            <h2>Mi perfil</h2>
            <p>Personaliza cómo te ve el equipo</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className="profile-modal-body" onSubmit={handleSubmit}>
          <section className="profile-hero">
            <button
              type="button"
              className="profile-avatar-btn"
              onClick={handlePickPhoto}
              title="Cambiar foto"
            >
              <UserAvatar user={previewUser} size="xl" />
              <span className="profile-avatar-edit">Cambiar foto</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="visually-hidden"
              onChange={handleFile}
            />
            <div className="profile-hero-copy">
              <strong>{user.name}</strong>
              <span>{roleLabel(user.role)}</span>
              {previewUser.avatarUrl && (
                <button type="button" className="btn-ghost profile-remove-photo" onClick={handleRemovePhoto}>
                  Quitar foto
                </button>
              )}
            </div>
          </section>

          <p className={`profile-sync ${syncOnline ? 'online' : 'offline'}`}>
            {syncOnline
              ? '● Sincronizado con el servidor'
              : '○ Modo local — los cambios se guardan en este navegador'}
          </p>

          <section className="profile-section">
            <h3>Usuario de acceso</h3>
            <label>
              Nombre de usuario
              <div className="profile-username-wrap">
                <span className="profile-username-at">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  required
                />
              </div>
              {usernameHint && <span className="profile-field-hint">{usernameHint}</span>}
            </label>
          </section>

          <section className="profile-section">
            <button
              type="button"
              className="profile-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? '▾ Ocultar contraseña' : '▸ Cambiar contraseña'}
            </button>
            {showPassword && (
              <div className="profile-password-fields">
                <label>
                  Contraseña actual
                  <input
                    type="password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                <label>
                  Nueva contraseña
                  <input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                  />
                </label>
                <label>
                  Confirmar nueva
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              </div>
            )}
          </section>

          <footer className="profile-modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </footer>

          <p className="profile-recovery">
            ¿Olvidaste tu contraseña? Contacta al administrador o gerente de Marketing.
          </p>
        </form>
      </div>
    </div>
  );
}

function roleLabel(role?: string) {
  if (role === 'admin') return 'Administrador';
  if (role === 'lider') return 'Gerente Marketing';
  return 'Colaborador';
}
