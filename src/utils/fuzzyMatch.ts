/** Normaliza para comparar sin acentos ni mayúsculas. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/** ¿El texto contiene la consulta aunque haya typos leves? */
export function fuzzyIncludes(haystack: string, query: string): boolean {
  const h = normalizeForSearch(haystack);
  const q = normalizeForSearch(query);
  if (!q) return true;
  if (h.includes(q)) return true;

  const words = h.split(/\s+/).filter(Boolean);
  const qWords = q.split(/\s+/).filter(Boolean);
  if (qWords.length === 0) return true;

  return qWords.every((qw) =>
    words.some((w) => {
      if (w.includes(qw) || qw.includes(w)) return true;
      const maxDist =
        qw.length <= 4 ? 1 : qw.length <= 7 ? 2 : 3;
      return levenshtein(w, qw) <= maxDist;
    }),
  );
}
