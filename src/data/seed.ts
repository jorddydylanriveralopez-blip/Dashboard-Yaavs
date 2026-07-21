import type { BoardState, EmployeeTask } from '../types';
import { DEFAULT_PROJECTS } from './projectSeed';
import { TEAM_MEMBER_NAMES } from './teamDisplayNames';

const N = TEAM_MEMBER_NAMES;

export const MARKETING_DEPARTMENT = 'Marketing';

const today = new Date();
const addDays = (d: number) => {
  const x = new Date(today);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

function emptyTeamTask(
  id: string,
  employeeId: string,
  employeeName: string,
  roleTitle: string,
  avatarColor: string,
): EmployeeTask {
  return {
    id,
    employeeId,
    employeeName,
    department: MARKETING_DEPARTMENT,
    roleTitle,
    avatarColor,
    currentWork: 'Sin tarea asignada — define el trabajo actual',
    status: 'sin_empezar',
    kpiTarget: 100,
    kpiCurrent: 0,
    objective: 'Objetivo del periodo',
    dueDate: addDays(30),
    notes: '',
    priority: 'media',
  };
}

/** Tablero vacío al instalar o tras reset (?fix=1). */
export const EMPTY_BOARD: BoardState = {
  companyName: 'Yaavs',
  projects: [],
  tasks: [
    emptyTeamTask('t-orlando', 'emp-orlando', N['emp-orlando']!, 'Gerente de Marketing', '#5034ff'),
    emptyTeamTask('t-juancarlos', 'emp-juancarlos', N['emp-juancarlos']!, 'Coordinador de Marketing', '#fdab3d'),
    emptyTeamTask('t-yared', 'emp-yared', N['emp-yared']!, 'Community Manager', '#14b8a6'),
    emptyTeamTask('t-jorddy', 'emp-jorddy', N['emp-jorddy']!, 'Diseñador UX/UI', '#ff158a'),
    emptyTeamTask('t-jesus', 'emp-jesus', N['emp-jesus']!, 'Diseñador Multimedia', '#784bd1'),
    emptyTeamTask('t-roberto', 'emp-roberto', N['emp-roberto']!, 'Diseñador Gráfico', '#0086c0'),
    emptyTeamTask('t-andrea', 'emp-andrea', N['emp-andrea']!, 'Diseñador Gráfico', '#9cd326'),
    emptyTeamTask('t-andres', 'emp-andres', N['emp-andres']!, 'Diseñador Gráfico', '#cab641'),
  ],
};

export const MARKETING_EMPLOYEE_IDS = [
  'emp-orlando',
  'emp-juancarlos',
  'emp-yared',
  'emp-jorddy',
  'emp-jesus',
  'emp-roberto',
  'emp-andrea',
  'emp-andres',
] as const;

export const DEFAULT_BOARD: BoardState = {
  companyName: 'Yaavs',
  projects: DEFAULT_PROJECTS,
  tasks: [
    {
      id: 't-orlando',
      employeeId: 'emp-orlando',
      employeeName: N['emp-orlando']!,
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Gerente de Marketing',
      avatarColor: '#5034ff',
      currentWork: 'Dirección del área y priorización de proyectos creativos',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 72,
      objective: 'Coordinar al equipo, indicaciones y entregas del área',
      dueDate: addDays(5),
      notes: 'Administrador del área de Marketing Yaavs.',
      priority: 'alta',
    },
    {
      id: 't-juancarlos',
      employeeId: 'emp-juancarlos',
      employeeName: N['emp-juancarlos']!,
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Coordinador de Marketing',
      avatarColor: '#fdab3d',
      currentWork: 'Plan estratégico Q2 y calendario de campañas',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 60,
      objective: 'Definir OKRs de marketing y coordinar al equipo',
      dueDate: addDays(5),
      notes: 'Revisión de presupuesto con dirección el miércoles.',
      priority: 'alta',
    },
    {
      id: 't-yared',
      employeeId: 'emp-yared',
      employeeName: N['emp-yared']!,
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Community Manager',
      avatarColor: '#14b8a6',
      currentWork: 'Calendario de contenido redes y métricas semanales',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 74,
      objective: 'Publicar 12 piezas y superar 80k impresiones orgánicas',
      dueDate: addDays(10),
      notes: 'TikTok con mejor engagement. Meta en revisión.',
      priority: 'media',
    },
    {
      id: 't-jorddy',
      employeeId: 'emp-jorddy',
      employeeName: N['emp-jorddy']!,
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Diseñador UX/UI',
      avatarColor: '#ff158a',
      currentWork: 'Rediseño flujo de checkout — prototipo Figma',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 55,
      objective: 'Entregar wireframes y prototipo interactivo v2',
      dueDate: addDays(10),
      notes: 'Pendiente test de usabilidad con 5 usuarios.',
      priority: 'alta',
    },
    {
      id: 't-jesus',
      employeeId: 'emp-jesus',
      employeeName: N['emp-jesus']!,
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Diseñador Multimedia',
      avatarColor: '#784bd1',
      currentWork: 'Video institucional y piezas para redes',
      status: 'en_revision',
      kpiTarget: 100,
      kpiCurrent: 80,
      objective: 'Finalizar pieza de 90 s y variantes para redes',
      dueDate: addDays(6),
      notes: 'Música licenciada. Falta aprobación de guion final.',
      priority: 'media',
    },
    {
      id: 't-roberto',
      employeeId: 'emp-roberto',
      employeeName: N['emp-roberto']!,
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Diseñador Gráfico',
      avatarColor: '#0086c0',
      currentWork: 'Kit de marca — plantillas presentación y social',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 40,
      objective: 'Completar 8 plantillas editables en Canva/Figma',
      dueDate: addDays(12),
      notes: 'Coordinar paleta con Andrea para consistencia visual.',
      priority: 'media',
    },
    {
      id: 't-andrea',
      employeeId: 'emp-andrea',
      employeeName: N['emp-andrea']!,
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Diseñador Gráfico',
      avatarColor: '#9cd326',
      currentWork: 'Ilustraciones campaña verano — serie 6 piezas',
      status: 'sin_empezar',
      kpiTarget: 100,
      kpiCurrent: 10,
      objective: 'Entregar ilustraciones vectoriales listas para impresión',
      dueDate: addDays(8),
      notes: 'Brief recibido. Definir estilo con Orlando.',
      priority: 'alta',
    },
    {
      id: 't-andres',
      employeeId: 'emp-andres',
      employeeName: N['emp-andres']!,
      department: MARKETING_DEPARTMENT,
      roleTitle: 'Diseñador Gráfico',
      avatarColor: '#cab641',
      currentWork: 'Banners web y assets display — campaña performance',
      status: 'en_progreso',
      kpiTarget: 100,
      kpiCurrent: 65,
      objective: 'Producir 20 tamaños de banner para Google/Meta',
      dueDate: addDays(4),
      notes: 'Exportar en @2x. Validar peso máximo 150 KB.',
      priority: 'alta',
    },
  ],
};
