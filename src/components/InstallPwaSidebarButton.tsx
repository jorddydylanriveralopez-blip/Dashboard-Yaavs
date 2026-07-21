import { usePwaInstall } from '../hooks/usePwaInstall';
import './InstallPwaSidebarButton.css';

export function InstallPwaSidebarButton() {
  const { installed, canInstall, install, installHint, dismiss } = usePwaInstall();

  if (installed) return null;

  return (
    <div className="sidebar-pwa-install">
      <p className="sidebar-pwa-install-title">App en tu teléfono</p>
      <p className="sidebar-pwa-install-hint">{installHint}</p>
      <div className="sidebar-pwa-install-actions">
        {canInstall && (
          <button type="button" className="btn-primary btn-sm" onClick={() => void install()}>
            Descargar app
          </button>
        )}
        <button type="button" className="btn-ghost btn-sm" onClick={dismiss}>
          Ocultar
        </button>
      </div>
    </div>
  );
}
