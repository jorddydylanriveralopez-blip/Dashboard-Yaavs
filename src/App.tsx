import { AppProvider, useApp } from './context/AppContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { ToastProvider } from './context/ToastContext';
import { Dashboard } from './components/Dashboard';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { LoginPage } from './components/LoginPage';
import { MediaCdnPage } from './components/MediaCdnPage';
import { MEDIA_CDN_PATH } from './constants';

function isPublicCdnRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return path === MEDIA_CDN_PATH;
}

function AppContent() {
  const { user } = useApp();
  if (isPublicCdnRoute()) {
    return <MediaCdnPage />;
  }
  return (
    <div className={`app-shell${user ? ' app-shell--dashboard' : ' app-shell--login'}`}>
      {user && <InstallPwaBanner />}
      {user ? <Dashboard /> : <LoginPage />}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
