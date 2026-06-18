import { LOGO_URL } from '../constants';
import { usePwaInstall } from '../hooks/usePwaInstall';
import './InstallPwaBanner.css';

export function InstallPwaBanner() {
  const { showInstallBanner, showIosHint, canInstall, install, dismiss } =
    usePwaInstall();

  if (!showInstallBanner) return null;

  return (
    <div className="pwa-banner" role="region" aria-label="Instalar aplicación">
      <img src={LOGO_URL} alt="" className="pwa-banner-logo" />
      <div className="pwa-banner-text">
        <strong>Instala Yaavs en tu teléfono</strong>
        <span>
          {showIosHint
            ? 'En Safari: Compartir → Añadir a pantalla de inicio'
            : 'Acceso rápido como app en Android, iPhone o computadora'}
        </span>
      </div>
      <div className="pwa-banner-actions">
        {canInstall && (
          <button type="button" className="btn-primary" onClick={() => install()}>
            Instalar
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={dismiss}>
          Ahora no
        </button>
      </div>
    </div>
  );
}
