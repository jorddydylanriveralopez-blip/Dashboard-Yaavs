/** Días entre solicitud y finalización (o hasta hoy si sigue abierto). */
export function calcProjectDurationDays(
  requestDate: string,
  finishedDate?: string,
  status?: string,
): number | null {
  const start = new Date(requestDate + 'T00:00:00');
  if (Number.isNaN(start.getTime())) return null;

  let end: Date;
  if (finishedDate) {
    end = new Date(finishedDate + 'T00:00:00');
  } else if (status === 'terminado') {
    end = new Date();
  } else {
    return null;
  }

  if (Number.isNaN(end.getTime())) return null;
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function formatDuration(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return 'Mismo día';
  if (days === 1) return '1 día';
  return `${days} días`;
}
