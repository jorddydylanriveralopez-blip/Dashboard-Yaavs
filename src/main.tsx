import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import {
  clearServiceWorkersAndCaches,
  clearYaavsStorage,
  resetAppAndReload,
} from './utils/clearAppData.ts';
import './index.css';

async function prepareApp(): Promise<void> {
  const params = new URLSearchParams(window.location.search);

  if (params.get('fix') === '1') {
    await resetAppAndReload();
    return;
  }

  // En desarrollo: quitar service workers viejos que dejan la pantalla en blanco
  if (import.meta.env.DEV) {
    await clearServiceWorkersAndCaches();
  }

  if (import.meta.env.PROD) {
    void import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          if (registration) {
            setInterval(() => registration.update(), 60 * 60 * 1000);
          }
        },
      });
    });
  } else if ('serviceWorker' in navigator) {
    void clearServiceWorkersAndCaches();
  }
}

function renderApp(): void {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    document.body.innerHTML =
      '<p style="padding:24px;font-family:system-ui">Error al iniciar Yaavs. Recarga la página.</p>';
    return;
  }

  try {
    createRoot(rootEl).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (err) {
    console.error('[Yaavs] Error al montar React:', err);
    clearYaavsStorage();
    rootEl.innerHTML =
      '<div style="padding:24px;font-family:system-ui;max-width:400px;margin:0 auto">' +
      '<h1 style="font-size:1.25rem">No se pudo iniciar Yaavs</h1>' +
      '<p>Abre esta URL para reparar: <a href="?fix=1">localhost:5173/?fix=1</a></p>' +
      '</div>';
  }
}

void prepareApp().then(renderApp);

// Atajo en consola: window.__yaavsReset()
if (import.meta.env.DEV) {
  (window as Window & { __yaavsReset?: () => Promise<void> }).__yaavsReset =
    resetAppAndReload;
}
