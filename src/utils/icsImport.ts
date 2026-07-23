/**
 * Parser básico de archivos .ics (VEVENT) para importar agenda desde
 * Gmail/Outlook sin OAuth. Soporta SUMMARY, DTSTART, DESCRIPTION.
 */

export interface IcsImportEvent {
  title: string;
  date: string;
  time: string;
  notes: string;
}

function unfoldIcs(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Parsea DTSTART tipo 20250723T150000Z / 20250723T090000 / 20250723 / VALUE=DATE:20250723 */
function parseDtStart(raw: string): { date: string; time: string } | null {
  const cleaned = raw.replace(/^[^:]*:/, '').trim();
  const m = cleaned.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (m[4] != null && m[5] != null) {
    return { date, time: `${m[4]}:${m[5]}` };
  }
  return { date, time: '09:00' };
}

function fieldValue(line: string, name: string): string | null {
  const upper = line.toUpperCase();
  if (!upper.startsWith(`${name}`) && !upper.startsWith(`${name};`)) return null;
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  return line.slice(idx + 1);
}

/** Extrae eventos VEVENT de un texto .ics. */
export function parseIcsEvents(icsText: string): IcsImportEvent[] {
  const text = unfoldIcs(icsText);
  const lines = text.split('\n');
  const events: IcsImportEvent[] = [];
  let inEvent = false;
  let summary = '';
  let description = '';
  let dtstart: { date: string; time: string } | null = null;

  const flush = () => {
    if (dtstart && summary.trim()) {
      events.push({
        title: unescapeIcsText(summary.trim()),
        date: dtstart.date,
        time: dtstart.time,
        notes: unescapeIcsText(description.trim()),
      });
    }
    summary = '';
    description = '';
    dtstart = null;
  };

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      inEvent = true;
      summary = '';
      description = '';
      dtstart = null;
      continue;
    }
    if (upper === 'END:VEVENT') {
      if (inEvent) flush();
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const sum = fieldValue(line, 'SUMMARY');
    if (sum != null) {
      summary = sum;
      continue;
    }
    const desc = fieldValue(line, 'DESCRIPTION');
    if (desc != null) {
      description = desc;
      continue;
    }
    if (upper.startsWith('DTSTART')) {
      const parsed = parseDtStart(line);
      if (parsed) dtstart = parsed;
    }
  }

  return events;
}

export async function parseIcsFile(file: File): Promise<IcsImportEvent[]> {
  const text = await file.text();
  return parseIcsEvents(text);
}
