import { useState, type FormEvent } from 'react';
import { COMPANY_NAME } from '../constants';
import { useApp } from '../context/AppContext';
import { buildForgotPasswordWhatsAppUrl } from '../utils/whatsappSupport';
import { BrandLogo } from './BrandLogo';
import { TechAmbience } from './TechAmbience';
import { DevMobileHint } from './DevMobileHint';
import './LoginPage.css';

export function LoginPage() {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!login(username, password)) {
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

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Usuario
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu usuario"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          {error && <p className="login-error">{error}</p>}
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
      </div>
    </div>
  );
}
