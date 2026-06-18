import { Component, type ErrorInfo, type ReactNode } from 'react';
import { resetAppAndReload } from '../utils/clearAppData';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Yaavs]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="error-boundary">
        <h1>Algo falló al cargar Yaavs</h1>
        <p>
          Suele pasar por caché vieja del navegador o datos guardados corruptos. Pulsa el
          botón para limpiar y volver a empezar.
        </p>
        <pre>{this.state.error.message}</pre>
        <button type="button" className="btn-primary" onClick={() => void resetAppAndReload()}>
          Limpiar datos y recargar
        </button>
      </div>
    );
  }
}

