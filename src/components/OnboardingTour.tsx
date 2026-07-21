import { useEffect, useLayoutEffect, useState } from 'react';
import { ONBOARDING_KEY } from '../constants';
import type { DashboardView } from '../utils/dashboardRoutes';
import './OnboardingTour.css';

interface Step {
  title: string;
  body: string;
  target?: string;
  view?: DashboardView;
}

const STEPS_EMPLEADO: Step[] = [
  {
    title: 'Bienvenido a Yaavs',
    body: 'Empieza en Inicio: ahí ves tu siguiente paso y cuántos proyectos tienes por entregar.',
    target: '[data-tour="nav-home"]',
    view: 'home',
  },
  {
    title: 'Tus proyectos',
    body: 'En Proyectos está el detalle. Puedes ver la lista de proyectos o el estatus (urgentes y terminados).',
    target: '[data-tour="nav-board"]',
    view: 'board',
  },
  {
    title: 'Indicaciones del gerente',
    body: 'Si te llega una indicación nueva, acéptala aquí. El badge naranja te avisa.',
    target: '[data-tour="nav-assignments"]',
    view: 'assignments',
  },
  {
    title: 'Tu agenda',
    body: 'En Agenda (menú Más en celular) anotas pendientes y activas recordatorios.',
    target: '[data-tour="nav-calendar"]',
    view: 'calendar',
  },
];

const STEPS_GERENTE: Step[] = [
  {
    title: 'Centro de mando',
    body: 'Inicio muestra prioridades, carga del equipo y actividad reciente del área.',
    target: '[data-tour="nav-home"]',
    view: 'home',
  },
  {
    title: 'Proyectos e indicaciones',
    body: 'Crea proyectos aquí. Asigna colaborador para que solo esa persona lo vea.',
    target: '[data-tour="nav-board"]',
    view: 'board',
  },
  {
    title: 'Equipo',
    body: 'Gestiona personas, KPIs del mes, indicaciones y da de baja miembros si hace falta.',
    target: '[data-tour="nav-team"]',
    view: 'team',
  },
  {
    title: 'Panorama',
    body: 'Aquí ves avance del equipo, tendencias, indicaciones y descargas el reporte completo.',
    target: '[data-tour="nav-pulse"]',
    view: 'pulse',
  },
];

interface Spotlight {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  userId: string;
  isManager: boolean;
  onNavigate: (view: DashboardView) => void;
}

export function OnboardingTour({ userId, isManager, onNavigate }: Props) {
  const key = `${ONBOARDING_KEY}-${userId}`;
  const [visible, setVisible] = useState(() => !localStorage.getItem(key));
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState<Spotlight | null>(null);

  const steps = isManager ? STEPS_GERENTE : STEPS_EMPLEADO;
  const current = steps[step];

  useEffect(() => {
    if (!visible || !current?.view) return;
    onNavigate(current.view);
  }, [visible, step, current?.view, onNavigate]);

  useLayoutEffect(() => {
    if (!visible || !current?.target) {
      setSpot(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(current.target!);
      if (!el) {
        setSpot(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setSpot({
        top: r.top - 6,
        left: r.left - 6,
        width: r.width + 12,
        height: r.height + 12,
      });
    };
    const t = window.setTimeout(update, 120);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [visible, step, current?.target]);

  if (!visible || !current) return null;

  const finish = () => {
    localStorage.setItem(key, '1');
    setVisible(false);
  };

  return (
    <div className="onboarding-backdrop onboarding-backdrop--spotlight">
      {spot && (
        <div
          className="onboarding-spotlight"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      )}
      <div className="onboarding-card onboarding-card--floating">
        <span className="onboarding-step">
          {step + 1} / {steps.length}
        </span>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <div className="onboarding-actions">
          <button type="button" className="btn-ghost" onClick={finish}>
            Saltar
          </button>
          {step < steps.length - 1 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setStep((s) => s + 1)}
            >
              Siguiente
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={finish}>
              Empezar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
