import { AppProvider, useApp } from './context/AppContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { ToastProvider } from './context/ToastContext';
import { Dashboard } from './components/Dashboard';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { LoginPage } from './components/LoginPage';

function AppContent() {
  const { user } = useApp();
  return (
    <div className="app-shell">
      <InstallPwaBanner />
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
