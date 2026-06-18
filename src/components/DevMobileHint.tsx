import './DevMobileHint.css';

function isMobileUa() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isLocalhost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

/** Solo en desarrollo: avisa si abrieron localhost en el celular. */
export function DevMobileHint() {
  if (!import.meta.env.DEV || !isMobileUa() || !isLocalhost()) return null;

  return (
    <div className="dev-mobile-hint" role="alert">
      <strong>No puedes usar localhost en el celular</strong>
      <p>
        En el teléfono, <code>localhost</code> es el propio teléfono, no tu Mac. En la
        computadora donde corre <code>npm run dev</code>, busca la línea que dice{' '}
        <strong>Network</strong> o <strong>CELULAR</strong> y abre esa dirección, por
        ejemplo:
      </p>
      <p className="dev-mobile-example">http://192.168.1.XX:5173</p>
      <p className="dev-mobile-sub">
        Misma red Wi‑Fi · Mac con el servidor encendido · Si instalaste la app antes,
        bórrala y entra primero por el navegador.
      </p>
    </div>
  );
}
