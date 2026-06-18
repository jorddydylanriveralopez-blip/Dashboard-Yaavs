import { useState } from 'react';
import { ONBOARDING_KEY } from '../constants';
import './OnboardingTour.css';

const STEPS_EMPLEADO = [
  {
    title: 'Bienvenido a Yaavs',
    body: 'Empieza en Mi día: ahí ves cuántos proyectos tienes por entregar y si hay retraso.',
  },
  {
    title: 'Proyectos y entrega',
    body: 'En Proyectos está el detalle. Para cerrar un trabajo: abre el proyecto, sube una foto de prueba y pulsa Trabajo concluido. Pasará a Concluidos ✓.',
  },
  {
    title: 'Indicaciones del gerente',
    body: 'Si te llega una indicación nueva, acéptala en Indicaciones. Si viene de un proyecto, lo verás vinculado en Mi día — no hace falta duplicar el trabajo.',
  },
  {
    title: 'Tu agenda',
    body: 'En Agenda anotas pendientes personales, activas recordatorios y registras tu tiempo.',
  },
];

const STEPS_GERENTE = [
  {
    title: 'Centro de mando',
    body: 'Inicio muestra proyectos atrasados, indicaciones sin aceptar y últimas entregas con prueba. Los números del menú lateral también reflejan retrasos del equipo.',
  },
  {
    title: 'Proyectos e indicaciones',
    body: 'Crea y edita en Proyectos. Envía indicaciones desde ahí o desde Indicaciones / Equipo; al vincular un proyecto, el colaborador lo verá una sola vez en Por entregar.',
  },
  {
    title: 'KPIs y reportes',
    body: 'Historial ◷ es el cierre mensual de KPIs. Concluidos ✓ lista proyectos terminados con foto. Reportes exporta resúmenes para reuniones.',
  },
];

interface Props {
  userId: string;
  isManager: boolean;
}

export function OnboardingTour({ userId, isManager }: Props) {
  const key = `${ONBOARDING_KEY}-${userId}`;
  const [visible, setVisible] = useState(() => !localStorage.getItem(key));
  const [step, setStep] = useState(0);

  const steps = isManager ? STEPS_GERENTE : STEPS_EMPLEADO;
  const current = steps[step];

  if (!visible || !current) return null;

  const finish = () => {
    localStorage.setItem(key, '1');
    setVisible(false);
  };

  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-card">
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
