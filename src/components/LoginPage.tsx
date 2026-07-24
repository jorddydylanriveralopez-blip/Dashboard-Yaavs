import { useMemo, useState, type FormEvent } from 'react';
import { COMPANY_NAME } from '../constants';
import { FRESH_START_KEY } from '../utils/clearAppData';
import { useApp } from '../context/AppContext';
import { resolveLoginUser } from '../utils/loginPreview';
import { buildForgotPasswordWhatsAppUrl } from '../utils/whatsappSupport';
import { BrandLogo } from './BrandLogo';
import { InstallPwaBanner } from './InstallPwaBanner';
import { TechAmbience } from './TechAmbience';
import { DevMobileHint } from './DevMobileHint';
import { UserAvatar } from './UserAvatar';
import './LoginPage.css';

export function LoginPage() {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSession, setKeepSession] = useState(true);
  const [error, setError] = useState('');
  const [freshStart] = useState(() => sessionStorage.getItem(FRESH_START_KEY) === '1');

  const previewUser = useMemo(() => resolveLoginUser(username), [username]);
  const showProfilePhoto = Boolean(previewUser?.avatarUrl);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    sessionStorage.removeItem(FRESH_START_KEY);
    if (!login(username, password, { keepSession })) {
      setError('Usuario o contraseña incorrectos');
    }
  };

  const handleForgotPassword = () => {
    const url = buildForgotPasswordWhatsAppUrl(username);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="login-page">
      <div className="login-page-bg" aria-hidden="true" />
      <div className="login-page-overlay" aria-hidden="true" />
      <TechAmbience variant="login" className="login-float-layer" />
      <div className="login-card">
        <div className="login-brand">
          <BrandLogo size="xl" className="login-brand-logo" />
          <p className="login-brand-tagline">Panel de trabajo del equipo</p>
        </div>

        <DevMobileHint />

        {freshStart && (
          <p className="login-fresh-notice" role="status">
            Tablero reiniciado: sin proyectos de demo. Entra con tu usuario para empezar desde cero.
          </p>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {showProfilePhoto && previewUser && (
            <div className="login-user-preview" aria-live="polite">
              <UserAvatar user={previewUser} size="xl" className="login-user-preview-avatar" />
              <p className="login-user-preview-name">{previewUser.name}</p>
            </div>
          )}

          <label>
            Usuario
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder="Tu usuario"
              required
            />
          </label>
          <label>
            Contraseña
            <span className="login-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="login-password-visibility"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M3 3l18 18M10.58 10.58A2 2 0 0012 15a2 2 0 001.41-3.41M9.88 5.09A10.94 10.94 0 0112 5c5.5 0 9.5 4.5 9.5 7s-1.56 3.16-4.09 5.09M6.11 6.11C3.6 7.79 2 10.5 2 12s4 7 10 7a10.8 10.8 0 004.12-.79"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
                  </svg>
                )}
              </button>
            </span>
          </label>
          {error && <p className="login-error">{error}</p>}
          <label className="login-keep-session">
            <input
              type="checkbox"
              checked={keepSession}
              onChange={(e) => setKeepSession(e.target.checked)}
            />
            <span>
              <strong>¿Deseas mantener tu sesión activa?</strong>
              <small>
                Si lo marcas, no tendrás que volver a entrar al cerrar el navegador (hasta 30 días
                o hasta que cierres sesión).
              </small>
            </span>
          </label>
          <button type="submit" className="btn-primary">
            Entrar a {COMPANY_NAME}
          </button>
        </form>

        <button
          type="button"
          className="login-forgot"
          onClick={handleForgotPassword}
        >
          ¿Olvidaste tu contraseña? Escríbenos por WhatsApp
        </button>

        <InstallPwaBanner variant="card" />
      </div>
    </div>
  );
}
