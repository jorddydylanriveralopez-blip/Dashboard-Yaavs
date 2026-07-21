import { LOGO_URL } from '../constants';
import { usePwaInstall } from '../hooks/usePwaInstall';
import './InstallPwaBanner.css';

interface Props {
  variant?: 'banner' | 'card';
}

export function InstallPwaBanner({ variant = 'banner' }: Props) {
  const { showInstallBanner, canInstall, install, dismiss, installHint } = usePwaInstall();

  if (!showInstallBanner) return null;

  if (variant === 'card') {
    return (
      <div className="pwa-card" role="region" aria-label="Descargar aplicación">
        <img src={LOGO_URL} alt="" className="pwa-card-logo" />
        <div className="pwa-card-text">
          <strong>Descarga Yaavs como app</strong>
          <span>Úsala desde tu pantalla de inicio, sin abrir el navegador cada vez.</span>
          <small>{installHint}</small>
        </div>
        <div className="pwa-card-actions">
          {canInstall && (
            <button type="button" className="btn-primary" onClick={() => void install()}>
              Descargar app
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={dismiss}>
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pwa-banner" role="region" aria-label="Descargar aplicación">
      <img src={LOGO_URL} alt="" className="pwa-banner-logo" />
      <div className="pwa-banner-text">
        <strong>Descarga Yaavs como app</strong>
        <span>{installHint}</span>
      </div>
      <div className="pwa-banner-actions">
        {canInstall && (
          <button type="button" className="btn-primary" onClick={() => void install()}>
            Descargar app
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={dismiss}>
          Ahora no
        </button>
      </div>
    </div>
  );
}
