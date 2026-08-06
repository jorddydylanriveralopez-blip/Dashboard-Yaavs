import { useEffect, useRef } from 'react';
import { exchangeGoogleOAuthCode, isApiEnabled } from '../api/client';

/**
 * Si Hostinger sirve el SPA en /api/google/callback?code=... (o Google redirige
 * a / /agenda con el code), canjeamos el código vía API y mandamos a Agenda.
 */
export function GoogleOAuthReturnHandler() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const path = window.location.pathname;

    const looksLikeGoogleReturn =
      Boolean(code || error) &&
      (path.includes('/api/google/callback') ||
        path === '/' ||
        path === '/agenda' ||
        Boolean(state && (state.startsWith('u-') || state.length > 16)));

    if (!looksLikeGoogleReturn) return;
    ran.current = true;

    void (async () => {
      let ok = !error;
      if (code && isApiEnabled()) {
        const pageRedirect = `${window.location.origin}${window.location.pathname}`;
        const result = await exchangeGoogleOAuthCode({
          code,
          state,
          redirectUri: pageRedirect,
        });
        ok = result.ok;
        if (!result.ok) {
          console.error('Google OAuth exchange:', result.error);
        }
      }

      try {
        localStorage.setItem(
          'yaavs-google-oauth-result',
          JSON.stringify({ type: 'yaavs-google-oauth', ok }),
        );
      } catch {
        /* ignore */
      }

      window.postMessage({ type: 'yaavs-google-oauth', ok }, window.location.origin);

      const target = `/agenda?google=${ok ? 'connected' : 'error'}`;
      window.history.replaceState({}, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    })();
  }, []);

  return null;
}
