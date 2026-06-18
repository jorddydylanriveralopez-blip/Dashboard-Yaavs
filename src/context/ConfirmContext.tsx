import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import './ConfirmContext.css';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpen(options);
    });
  }, []);

  const close = (result: boolean) => {
    setOpen(null);
    resolver.current?.(result);
    resolver.current = null;
  };

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {open && (
        <div className="confirm-backdrop" role="presentation">
          <div className="confirm-panel" role="alertdialog" aria-modal="true">
            <h2>{open.title}</h2>
            <p>{open.message}</p>
            <div className="confirm-actions">
              <button type="button" className="btn-ghost" onClick={() => close(false)}>
                {open.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                className={open.danger ? 'btn-danger' : 'btn-primary'}
                onClick={() => close(true)}
              >
                {open.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm requiere ConfirmProvider');
  return ctx;
}
