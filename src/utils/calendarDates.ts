export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseEventDateTime(date: string, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

export function getMonthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  });
}

export function elapsedMinutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}
