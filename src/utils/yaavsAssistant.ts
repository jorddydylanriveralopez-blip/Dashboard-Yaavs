import { labelFor, COLLABORATORS, PROJECT_STATUSES } from '../data/projectOptions';
import { getDeadlineInfo } from './deadline';
import { isActiveProject } from './activeItems';
import type { CreativeProject, TaskAssignment, User, UserCalendarState } from '../types';

export interface AssistantSnapshot {
  userName: string;
  role: string;
  isManager: boolean;
  activeProjectCount: number;
  overdueCount: number;
  pendingAssignments: number;
  completedCount: number;
  todayEventsPending: number;
  projects: {
    name: string;
    status: string;
    collaborator: string;
    deadlineLabel: string;
    isOverdue: boolean;
  }[];
  assignmentTitles: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function buildAssistantSnapshot(
  user: User,
  canEditAll: boolean,
  projects: CreativeProject[],
  completedProjects: CreativeProject[],
  myPendingAssignments: TaskAssignment[],
  assignments: TaskAssignment[],
  calendar: UserCalendarState,
): AssistantSnapshot {
  const todayKey = new Date().toISOString().slice(0, 10);
  const active = projects.filter(isActiveProject);
  const pendingAssignments = canEditAll
    ? assignments.filter((a) => a.status === 'pending')
    : myPendingAssignments;

  const projectRows = active.map((p) => {
    const d = getDeadlineInfo(p.commitmentDate, 'en_progreso');
    return {
      name: p.projectName.trim() || 'Sin nombre',
      status: labelFor(PROJECT_STATUSES, p.status),
      collaborator: labelFor(COLLABORATORS, p.collaborator),
      deadlineLabel: d.label,
      isOverdue: d.tone === 'overdue',
    };
  });

  return {
    userName: user.name,
    role: user.role,
    isManager: canEditAll,
    activeProjectCount: active.length,
    overdueCount: projectRows.filter((p) => p.isOverdue).length,
    pendingAssignments: pendingAssignments.length,
    completedCount: completedProjects.length,
    todayEventsPending: calendar.events.filter((e) => e.date === todayKey && !e.done).length,
    projects: projectRows.sort((a, b) => (b.isOverdue ? 1 : 0) - (a.isOverdue ? 1 : 0)),
    assignmentTitles: pendingAssignments.map((a) => a.title),
  };
}

function snapshotSummary(s: AssistantSnapshot): string {
  const lines = [
    `Usuario: ${s.userName} (${s.isManager ? 'gerente' : 'colaborador'})`,
    `Proyectos activos: ${s.activeProjectCount}, con retraso: ${s.overdueCount}`,
    `Indicaciones pendientes: ${s.pendingAssignments}`,
    `Concluidos: ${s.completedCount}`,
    `Agenda hoy sin hacer: ${s.todayEventsPending}`,
  ];
  if (s.projects.length > 0) {
    lines.push('Proyectos:');
    for (const p of s.projects.slice(0, 12)) {
      lines.push(`- ${p.name} (${p.status}, ${p.collaborator}, ${p.deadlineLabel})`);
    }
  }
  if (s.assignmentTitles.length > 0) {
    lines.push(`Indicaciones: ${s.assignmentTitles.join('; ')}`);
  }
  return lines.join('\n');
}

export function isAiAssistantEnabled(): boolean {
  const key = import.meta.env.VITE_AI_API_KEY?.trim();
  return Boolean(key);
}

export async function askAssistantAi(
  message: string,
  snapshot: AssistantSnapshot,
  history: ChatMessage[],
): Promise<string> {
  const apiKey = import.meta.env.VITE_AI_API_KEY?.trim();
  if (!apiKey) throw new Error('IA no configurada');

  const baseUrl =
    import.meta.env.VITE_AI_API_URL?.trim() || 'https://api.openai.com/v1/chat/completions';
  const model = import.meta.env.VITE_AI_MODEL?.trim() || 'gpt-4o-mini';

  const system = `Eres Yaavs Bot, asistente del panel de marketing creativo Yaavs. Responde en español (México), breve y práctico. Ayudas con prioridades, plazos, indicaciones y cierre de proyectos (foto de prueba → Concluidos).

Reglas del producto:
- "Por entregar" = proyectos activos sin foto de entrega.
- Cerrar proyecto: abrir proyecto → subir foto → confirmar; luego va a Concluidos ✓.
- Rojo en fechas = retraso, no significa terminado.
- Indicaciones: el colaborador debe aceptarlas en el menú Indicaciones.

Contexto actual del usuario:
${snapshotSummary(snapshot)}`;

  const messages = [
    { role: 'system' as const, content: system },
    ...history.slice(-8).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ];

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 600,
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(err.slice(0, 200) || `Error ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Respuesta vacía de la IA');
  return text;
}

export function getLocalAssistantReply(message: string, s: AssistantSnapshot): string {
  const q = message.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  if (/hola|buenas|hey|ayuda|que puedes|qué puedes/.test(q)) {
    return (
      `¡Hola, ${s.userName}! 🤖 Soy **Yaavs Bot**.\n\n` +
      `Ahora mismo tienes **${s.activeProjectCount}** proyecto(s) activo(s)` +
      (s.overdueCount > 0 ? `, **${s.overdueCount}** con retraso` : '') +
      (s.pendingAssignments > 0
        ? ` y **${s.pendingAssignments}** indicación(es) por revisar`
        : '') +
      `.\n\nPregúntame por pendientes, retrasos, cómo entregar con foto o qué hacer primero.`
    );
  }

  if (/retraso|atrasad|urgente|venc/.test(q)) {
    const late = s.projects.filter((p) => p.isOverdue);
    if (late.length === 0) {
      return 'No tienes proyectos activos con retraso en este momento. ¡Bien ahí!';
    }
    const list = late
      .map((p) => `• **${p.name}** — ${p.deadlineLabel} (${p.status})`)
      .join('\n');
    return `Proyectos con retraso (${late.length}):\n\n${list}\n\nPrioriza el que más impacto tenga y avisa al gerente si necesitas mover la fecha de compromiso.`;
  }

  if (/indicacion|asignacion|aceptar/.test(q)) {
    if (s.pendingAssignments === 0) {
      return s.isManager
        ? 'No hay indicaciones pendientes de aceptar en el equipo.'
        : 'No tienes indicaciones nuevas. Revisa **Indicaciones** cuando el gerente te asigne algo.';
    }
    const list = s.assignmentTitles.map((t) => `• ${t}`).join('\n');
    return (
      `Tienes **${s.pendingAssignments}** indicación(es) pendiente(s):\n\n${list}\n\n` +
      (s.isManager
        ? 'Ve a **Indicaciones** para ver el detalle o cancelar.'
        : 'Entra a **Indicaciones**, léelas y pulsa **Aceptar** para que queden en tu tablero.')
    );
  }

  if (/conclu|entreg|foto|termin|cerrar/.test(q)) {
    return (
      'Para sacar un proyecto de **Inicio** y mandarlo a **Concluidos ✓**:\n\n' +
      '1. Abre el proyecto (o **Entregar con foto →** en Mi día)\n' +
      '2. Sube la **foto de prueba** de la entrega\n' +
      '3. Confirma **Trabajo concluido**\n\n' +
      'Hasta ese paso el proyecto sigue en "Por entregar"; el verde es el botón de acción, no que ya esté hecho.'
    );
  }

  if (/pendiente|que tengo|mi dia|inicio|hoy/.test(q)) {
    if (s.projects.length === 0) {
      return 'No tienes proyectos por entregar. Revisa **Concluidos ✓** por trabajos ya cerrados.';
    }
    const list = s.projects
      .slice(0, 8)
      .map((p) => `• **${p.name}** — ${p.deadlineLabel}${p.isOverdue ? ' ⚠️' : ''}`)
      .join('\n');
    return `Tu lista por entregar (${s.projects.length}):\n\n${list}${
      s.todayEventsPending > 0
        ? `\n\nAdemás tienes **${s.todayEventsPending}** pendiente(s) en la **Agenda** de hoy.`
        : ''
    }`;
  }

  if (/prioridad|orden|primero/.test(q)) {
    const late = s.projects.filter((p) => p.isOverdue);
    if (late.length > 0) {
      return `Empieza por **${late[0].name}** (${late[0].deadlineLabel}). Luego los que vencen pronto. Si algo no te corresponde (colaborador TODOS), coordina con el equipo antes de cerrar.`;
    }
    return 'No hay retrasos críticos. Orden sugerido: indicaciones sin aceptar → lo que vence hoy → el resto por fecha de compromiso.';
  }

  return (
    `Puedo ayudarte con tu panel. Resumen: **${s.activeProjectCount}** activos, **${s.overdueCount}** con retraso.\n\n` +
    'Prueba preguntar: "¿Qué tengo pendiente?", "Proyectos atrasados", "¿Cómo entregar un proyecto?" o "Indicaciones".' +
    (isAiAssistantEnabled()
      ? '\n\n(Modo IA activo: respuestas más naturales.)'
      : '\n\n(Modo guía local; el gerente puede activar IA con API en .env)')
  );
}

/** Convierte **texto** simple a texto plano para UI (sin markdown parser). */
export function formatAssistantText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
}
