import nspell from 'nspell';
import aff from '../assets/es.aff?raw';
import dic from '../assets/es.dic?raw';
import { SPELL_CUSTOM_WORDS } from './spellCustomWords';

let checker: ReturnType<typeof nspell> | null = null;

function getChecker(): ReturnType<typeof nspell> {
  if (!checker) {
    checker = nspell(aff, dic);
    for (const word of SPELL_CUSTOM_WORDS) {
      checker.add(word);
    }
  }
  return checker;
}

function wordDistance(a: string, b: string): number {
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

function preserveCase(original: string, replacement: string): string {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const WORD_RE = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+/g;

/**
 * Corrige ortografía leve en español (al salir del campo).
 * No modifica nombres propios registrados en `extraWords`.
 */
export function fixSpanishText(text: string, extraWords: string[] = []): string {
  if (!text.trim()) return text;
  const spell = getChecker();
  const ignore = new Set([
    ...SPELL_CUSTOM_WORDS,
    ...extraWords.map((w) => w.toLowerCase()),
  ]);

  return text.replace(WORD_RE, (word) => {
    const lower = word.toLowerCase();
    if (ignore.has(lower)) return word;
    if (spell.correct(word)) return word;

    const suggestions = spell.suggest(word);
    if (!suggestions.length) return word;

    const best = suggestions[0];
    const maxDist = word.length <= 4 ? 1 : word.length <= 8 ? 2 : 3;
    if (wordDistance(lower, best.toLowerCase()) > maxDist) return word;

    return preserveCase(word, best);
  });
}
