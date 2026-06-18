export interface DeadlineInfo {
  label: string;
  tone: 'ok' | 'soon' | 'urgent' | 'overdue' | 'done';
  daysLeft: number;
}

export function getDeadlineInfo(dueDate: string, status: string): DeadlineInfo {
  if (status === 'completado') {
    return { label: 'Entregado', tone: 'done', daysLeft: 0 };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dueStart = new Date(dueDate + 'T00:00:00');
  const diffMs = dueStart.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    const overdue = Math.abs(daysLeft);
    return {
      label: overdue === 1 ? '1 día de retraso' : `${overdue} días de retraso`,
      tone: 'overdue',
      daysLeft,
    };
  }
  if (daysLeft === 0) {
    return { label: 'Vence hoy', tone: 'urgent', daysLeft: 0 };
  }
  if (daysLeft === 1) {
    return { label: 'Vence mañana', tone: 'urgent', daysLeft: 1 };
  }
  if (daysLeft <= 3) {
    return { label: `${daysLeft} días restantes`, tone: 'soon', daysLeft };
  }
  return { label: `${daysLeft} días restantes`, tone: 'ok', daysLeft };
}
