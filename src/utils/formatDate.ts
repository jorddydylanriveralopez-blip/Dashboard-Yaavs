export function formatShortDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!d) return iso;
  return `${d}/${m}/${y?.slice(2) ?? y}`;
}

/** Ej. 15 de octubre de 2026 */
export function formatLongDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
