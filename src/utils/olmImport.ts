import type { CalendarEventKind } from '../types';
import type JSZipType from 'jszip';

export interface OlmImportEvent {
  title: string;
  date: string;
  time: string;
  endTime: string;
  estimatedMinutes: number;
  notes: string;
  kind: CalendarEventKind;
  externalId: string;
  location?: string;
}

const MEXICO_TZ = 'America/Mexico_City';

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function tagValue(block: string, name: string): string | null {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i');
  const m = block.match(re);
  if (!m) return null;
  return unescapeXml(m[1]).trim();
}

/** OLM suele guardar hora en UTC sin sufijo Z; convertir a hora de México. */
export function olmDateTimeToMexico(iso: string): { date: string; time: string } | null {
  const cleaned = iso.trim();
  if (!cleaned) return null;
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(cleaned);
  const d = new Date(hasTz ? cleaned : `${cleaned}Z`);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`,
  };
}

function minutesBetween(startIso: string, endIso: string): number {
  const hasTz = (s: string) => /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
  const a = new Date(hasTz(startIso) ? startIso : `${startIso}Z`).getTime();
  const b = new Date(hasTz(endIso) ? endIso : `${endIso}Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 60;
  return Math.max(5, Math.round((b - a) / 60_000));
}

/**
 * FreeBusy Outlook: 0 Free, 1 Tentative, 2 Busy, 3 OOF, 4 Working elsewhere.
 * Cualquier cita distinta de Free la marcamos ocupado para el equipo.
 */
function kindFromFreeBusy(status: string | null): CalendarEventKind {
  if (status === '0') return 'event';
  return 'busy';
}

/** Parsea el Calendar.xml de un archivo OLM de Outlook para Mac. */
export function parseOlmCalendarXml(xml: string): OlmImportEvent[] {
  const blocks = xml.match(/<appointment\b[^>]*>[\s\S]*?<\/appointment>/gi) ?? [];
  const events: OlmImportEvent[] = [];

  for (const block of blocks) {
    const summary = tagValue(block, 'OPFCalendarEventCopySummary') || 'Evento Outlook';
    const startRaw = tagValue(block, 'OPFCalendarEventCopyStartTime');
    const endRaw = tagValue(block, 'OPFCalendarEventCopyEndTime');
    if (!startRaw) continue;
    const start = olmDateTimeToMexico(startRaw);
    if (!start) continue;
    const end = endRaw ? olmDateTimeToMexico(endRaw) : null;
    const uuid =
      tagValue(block, 'OPFCalendarEventCopyUUID') ||
      `outlook-${start.date}-${start.time}-${summary.slice(0, 24)}`;
    const location = tagValue(block, 'OPFCalendarEventCopyLocation') || undefined;
    const plain =
      tagValue(block, 'OPFCalendarEventCopyDescriptionPlain') ||
      '';
    const freeBusy = tagValue(block, 'OPFCalendarEventCopyFreeBusyStatus');
    const notesParts = [
      location ? `📍 ${location}` : '',
      plain.slice(0, 800),
      '(Importado desde Outlook)',
    ].filter(Boolean);

    events.push({
      title: summary.slice(0, 200),
      date: start.date,
      time: start.time,
      endTime: end?.time ?? start.time,
      estimatedMinutes: endRaw ? minutesBetween(startRaw, endRaw) : 60,
      notes: notesParts.join('\n'),
      kind: kindFromFreeBusy(freeBusy),
      externalId: uuid,
      location,
    });
  }

  return events.sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  );
}

async function findCalendarXmlInZip(zip: JSZipType): Promise<string | null> {
  const names = Object.keys(zip.files);
  const preferred =
    names.find((n) => /\/Calendario\/Calendar\.xml$/i.test(n)) ||
    names.find((n) => /\/Calendar\/Calendar\.xml$/i.test(n)) ||
    names.find((n) => /(^|\/)Calendar\.xml$/i.test(n));
  if (!preferred) return null;
  const file = zip.file(preferred);
  if (!file) return null;
  return file.async('string');
}

/** Lee un .olm (ZIP) o un Calendar.xml suelto y devuelve eventos. */
export async function parseOlmFile(file: File): Promise<OlmImportEvent[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xml') || file.type.includes('xml')) {
    const text = await file.text();
    return parseOlmCalendarXml(text);
  }

  // Carga diferida: no meter JSZip (~1MB) en el chunk inicial de Agenda.
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await findCalendarXmlInZip(zip);
  if (!xml) {
    throw new Error('No se encontró Calendar.xml dentro del archivo .olm');
  }
  return parseOlmCalendarXml(xml);
}

export function isOutlookCalendarFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith('.olm') || n.endsWith('.xml') || n.endsWith('.ics');
}
