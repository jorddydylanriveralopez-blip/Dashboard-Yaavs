import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream
  );
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getPwaInstallHint(): string {
  if (isIos()) {
    return 'Safari → Compartir → Añadir a pantalla de inicio';
  }
  if (isAndroid()) {
    return 'Chrome → menú ⋮ → Instalar aplicación o Añadir a inicio';
  }
  return 'Chrome o Edge → icono ⊕ en la barra de direcciones, o menú → Instalar Yaavs';
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('yaavs-pwa-dismiss') === '1',
  );

  useEffect(() => {
    const onInstallable = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onInstallable);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      setDeferred(null);
      return true;
    }
    return false;
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem('yaavs-pwa-dismiss', '1');
  }, []);

  const showIosHint = isIos() && !installed;
  const showInstallBanner = !installed && !dismissed;
  const installHint = getPwaInstallHint();

  return {
    canInstall: deferred !== null,
    showInstallBanner,
    showIosHint,
    installed,
    install,
    dismiss,
    installHint,
    isIos: isIos(),
    isAndroid: isAndroid(),
  };
}
