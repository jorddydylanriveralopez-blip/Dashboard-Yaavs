import { ATTENDANCE_STORAGE_KEY } from '../constants';
import { getMonthKey } from './performanceHistory';
import { fuzzyIncludes, normalizeForSearch } from './fuzzyMatch';
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceStore,
  EmployeeTask,
} from '../types';

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Asistió',
  absent: 'Falta',
  sick: 'Enfermedad',
  late: 'Retardo',
  vacation: 'Vacaciones',
};

export const ATTENDANCE_STATUS_SYMBOL: Record<AttendanceStatus, string> = {
  present: '✓',
  absent: '✗',
  sick: '🏥',
  late: '⏰',
  vacation: '🌴',
};

/** Colores por tipo de asistencia (verde, rojo, amarillo, morado, azul). */
export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: '#22c55e',
  absent: '#ef4444',
  late: '#eab308',
  sick: '#a855f7',
  vacation: '#3b82f6',
};

const CYCLE: AttendanceStatus[] = ['present', 'absent', 'sick', 'late', 'vacation'];

export function loadAttendanceStore(): AttendanceStore {
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AttendanceStore;
      if (Array.isArray(parsed.records)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { records: [] };
}

export function saveAttendanceStore(store: AttendanceStore): void {
  localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(store));
}

export function recordId(employeeId: string, dateKey: string): string {
  return `${employeeId}-${dateKey}`;
}

export function nextAttendanceStatus(current: AttendanceStatus | undefined): AttendanceStatus {
  if (!current) return 'present';
  const idx = CYCLE.indexOf(current);
  return CYCLE[(idx + 1) % CYCLE.length];
}

export function upsertAttendance(
  store: AttendanceStore,
  input: Omit<AttendanceRecord, 'id' | 'updatedAt'> & { id?: string },
): AttendanceStore {
  const id = input.id ?? recordId(input.employeeId, input.dateKey);
  const next: AttendanceRecord = {
    ...input,
    id,
    updatedAt: new Date().toISOString(),
  };
  const rest = store.records.filter((r) => r.id !== id);
  return { records: [...rest, next] };
}

export function getAttendanceForDay(
  store: AttendanceStore,
  employeeId: string,
  dateKey: string,
): AttendanceRecord | undefined {
  return store.records.find((r) => r.employeeId === employeeId && r.dateKey === dateKey);
}

export interface AttendanceSummary {
  employeeId: string;
  employeeName: string;
  present: number;
  absent: number;
  sick: number;
  late: number;
  vacation: number;
  totalMarked: number;
}

export function summarizeAttendance(
  store: AttendanceStore,
  tasks: EmployeeTask[],
  monthKey: string,
): AttendanceSummary[] {
  const monthRecords = store.records.filter((r) => r.monthKey === monthKey);
  return tasks
    .filter((t) => t.employeeId !== 'emp-orlando')
    .map((t) => {
      const mine = monthRecords.filter((r) => r.employeeId === t.employeeId);
      const count = (status: AttendanceStatus) =>
        mine.filter((r) => r.status === status).length;
      return {
        employeeId: t.employeeId,
        employeeName: t.employeeName,
        present: count('present'),
        absent: count('absent'),
        sick: count('sick'),
        late: count('late'),
        vacation: count('vacation'),
        totalMarked: mine.length,
      };
    });
}

export function daysInMonth(monthKey: string, untilToday = true): string[] {
  const [y, m] = monthKey.split('-').map(Number);
  const total = new Date(y, m, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const keys: string[] = [];
  for (let d = 1; d <= total; d++) {
    const dateKey = `${monthKey}-${String(d).padStart(2, '0')}`;
    if (untilToday && dateKey > today) break;
    keys.push(dateKey);
  }
  return keys;
}

export type AttendanceDayTone = AttendanceStatus | 'unset';

export function attendanceDayTone(status: AttendanceStatus | undefined): AttendanceDayTone {
  return status ?? 'unset';
}

export function dominantAttendanceStatus(
  counts: Record<AttendanceStatus, number> & { unset: number },
): AttendanceDayTone {
  const entries: [AttendanceDayTone, number][] = [
    ['present', counts.present],
    ['absent', counts.absent],
    ['sick', counts.sick],
    ['late', counts.late],
    ['vacation', counts.vacation],
    ['unset', counts.unset],
  ];
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

export function filterDaysByRange(
  days: string[],
  fromDateKey: string,
  toDateKey: string,
): string[] {
  const from = fromDateKey <= toDateKey ? fromDateKey : toDateKey;
  const to = fromDateKey <= toDateKey ? toDateKey : fromDateKey;
  return days.filter((d) => d >= from && d <= to);
}

export function attendancePerformancePercent(summary: AttendanceSummary): number {
  const total =
    summary.present +
    summary.absent +
    summary.sick +
    summary.late +
    summary.vacation;
  if (total === 0) return 0;
  return Math.round((summary.present / total) * 100);
}

export interface AttendancePieSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  sharePercent: number;
}

export function buildAttendancePieSlices(summary: AttendanceSummary): AttendancePieSlice[] {
  const entries: { status: AttendanceStatus; count: number }[] = [
    { status: 'present', count: summary.present },
    { status: 'absent', count: summary.absent },
    { status: 'sick', count: summary.sick },
    { status: 'late', count: summary.late },
    { status: 'vacation', count: summary.vacation },
  ];
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  if (total === 0) return [];

  return entries
    .filter((e) => e.count > 0)
    .map((e) => ({
      id: e.status,
      label: ATTENDANCE_STATUS_LABELS[e.status],
      value: e.count,
      color: ATTENDANCE_STATUS_COLORS[e.status],
      sharePercent: Math.round((e.count / total) * 100),
    }));
}

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultSelectedDay(monthKey: string): string {
  const days = daysInMonth(monthKey);
  const today = todayDateKey();
  if (days.includes(today)) return today;
  return days[days.length - 1] ?? `${monthKey}-01`;
}

export function workdaysInMonth(monthKey: string, untilToday = true): string[] {
  const [y, m] = monthKey.split('-').map(Number);
  return daysInMonth(monthKey, untilToday).filter((dateKey) => {
    const d = Number(dateKey.slice(8, 10));
    const dow = new Date(y, m - 1, d).getDay();
    return dow !== 0 && dow !== 6;
  });
}

export function exportAttendanceCsv(
  store: AttendanceStore,
  tasks: EmployeeTask[],
  monthKey: string,
): void {
  const days = workdaysInMonth(monthKey);
  const team = tasks.filter((t) => t.employeeId !== 'emp-orlando');
  const rows: string[][] = [
    ['Colaborador', ...days, 'Asistió', 'Faltas', 'Enfermedad', 'Retardos', 'Vacaciones'],
  ];

  const summary = summarizeAttendance(store, tasks, monthKey);
  for (const t of team) {
    const sum = summary.find((s) => s.employeeId === t.employeeId)!;
    const dayCells = days.map((d) => {
      const rec = getAttendanceForDay(store, t.employeeId, d);
      return rec ? ATTENDANCE_STATUS_LABELS[rec.status] : '';
    });
    rows.push([
      t.employeeName,
      ...dayCells,
      String(sum.present),
      String(sum.absent),
      String(sum.sick),
      String(sum.late),
      String(sum.vacation),
    ]);
  }

  downloadCsv(rows, `yaavs-asistencia-${monthKey}.csv`);
}

function downloadCsv(rows: string[][], filename: string): void {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildDemoAttendance(
  tasks: EmployeeTask[],
  monthKey = getMonthKey(),
): AttendanceStore {
  const days = workdaysInMonth(monthKey);
  const records: AttendanceRecord[] = [];
  const team = tasks.filter((t) => t.employeeId !== 'emp-orlando');

  for (const t of team) {
    days.forEach((dateKey, i) => {
      let status: AttendanceStatus = 'present';
      const seed = (t.employeeId.charCodeAt(4) + i) % 10;
      if (seed === 0) status = 'absent';
      else if (seed === 1) status = 'sick';
      else if (seed === 2) status = 'late';
      records.push({
        id: recordId(t.employeeId, dateKey),
        employeeId: t.employeeId,
        employeeName: t.employeeName,
        dateKey,
        monthKey,
        status,
        notes: '',
        recordedById: 'u-orlando',
        recordedByName: 'Orlando',
        updatedAt: `${dateKey}T18:00:00.000Z`,
      });
    });
  }

  return { records };
}

/* ─── Importación flexible (semana o mes, matriz o lista) ─── */

export interface AttendanceImportRow {
  employeeId: string;
  employeeName: string;
  dateKey: string;
  monthKey: string;
  status: AttendanceStatus;
}

export interface AttendanceImportResult {
  rows: AttendanceImportRow[];
  unmatchedNames: string[];
  skippedEmpty: number;
  format: 'wide' | 'long' | 'punch' | 'unknown';
  dateFrom: string | null;
  dateTo: string | null;
  errors: string[];
}

const STATUS_ALIASES: Record<string, AttendanceStatus> = {
  asistio: 'present',
  asistió: 'present',
  presente: 'present',
  present: 'present',
  asistencia: 'present',
  ok: 'present',
  si: 'present',
  sí: 'present',
  yes: 'present',
  p: 'present',
  a: 'present',
  '1': 'present',
  '✓': 'present',
  check: 'present',
  falta: 'absent',
  faltas: 'absent',
  ausente: 'absent',
  absent: 'absent',
  ausencia: 'absent',
  f: 'absent',
  '0': 'absent',
  no: 'absent',
  '✗': 'absent',
  x: 'absent',
  enfermedad: 'sick',
  enfermo: 'sick',
  enferma: 'sick',
  sick: 'sick',
  baja: 'sick',
  e: 'sick',
  retardo: 'late',
  retardos: 'late',
  tarde: 'late',
  late: 'late',
  delay: 'late',
  r: 'late',
  t: 'late',
  vacaciones: 'vacation',
  vacacion: 'vacation',
  vacation: 'vacation',
  vac: 'vacation',
  v: 'vacation',
};

const NAME_HEADERS = new Set([
  'colaborador',
  'colaboradores',
  'empleado',
  'empleados',
  'nombre',
  'nombres',
  'name',
  'persona',
  'trabajador',
  'miembro',
]);

const DATE_HEADERS = new Set([
  'fecha',
  'fechas',
  'date',
  'dia',
  'día',
  'day',
]);

const STATUS_HEADERS = new Set([
  'estado',
  'estatus',
  'status',
  'asistencia',
  'tipo',
  'resultado',
]);

const TOTAL_HEADERS = new Set([
  'asistio',
  'asistió',
  'faltas',
  'falta',
  'enfermedad',
  'retardos',
  'retardo',
  'vacaciones',
  'total',
  'totales',
]);

function normalizeHeader(value: string): string {
  return normalizeForSearch(value).replace(/[^a-z0-9áéíóúüñ]+/gi, '');
}

function parseCsvMatrix(text: string): string[][] {
  const cleaned = text.replace(/^\ufeff/, '').trim();
  if (!cleaned) return [];

  const firstLine = cleaned.split(/\r?\n/, 1)[0] ?? '';
  const comma = (firstLine.match(/,/g) ?? []).length;
  const semi = (firstLine.match(/;/g) ?? []).length;
  const tab = (firstLine.match(/\t/g) ?? []).length;
  const delimiter = tab >= comma && tab >= semi ? '\t' : semi > comma ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell.trim());
    cell = '';
  };
  const pushRow = () => {
    if (row.some((c) => c.length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      pushCell();
      continue;
    }
    if (ch === '\n') {
      pushCell();
      pushRow();
      continue;
    }
    if (ch === '\r') continue;
    cell += ch;
  }
  pushCell();
  pushRow();
  return rows;
}

export function parseAttendanceStatus(raw: string): AttendanceStatus | null {
  const value = raw.trim();
  if (!value || value === '-' || value === '—' || value === '.') return null;
  const key = normalizeForSearch(value);
  if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
  const compact = key.replace(/[^a-z0-9]/g, '');
  if (STATUS_ALIASES[compact]) return STATUS_ALIASES[compact];
  for (const [alias, status] of Object.entries(STATUS_ALIASES)) {
    if (alias.length >= 3 && (key.includes(alias) || compact.includes(alias))) {
      return status;
    }
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateKey(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Interpreta fechas comunes en MX (DD/MM/YYYY) y headers de día. */
export function parseAttendanceDateKey(
  raw: string,
  fallbackMonthKey?: string,
): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return toDateKey(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    // Prefer DD/MM for Mexico; if day>12 swap is already correct as d/m
    return toDateKey(y, m, d);
  }

  const monthNames: Record<string, number> = {
    ene: 1,
    enero: 1,
    feb: 2,
    febrero: 2,
    mar: 3,
    marzo: 3,
    abr: 4,
    abril: 4,
    may: 5,
    mayo: 5,
    jun: 6,
    junio: 6,
    jul: 7,
    julio: 7,
    ago: 8,
    agosto: 8,
    sep: 9,
    sept: 9,
    septiembre: 9,
    oct: 10,
    octubre: 10,
    nov: 11,
    noviembre: 11,
    dic: 12,
    diciembre: 12,
  };
  const named = normalizeForSearch(value).match(
    /^(\d{1,2})\s*(?:de\s+)?([a-z]+)(?:\s+(\d{2,4}))?$/,
  );
  if (named) {
    const month = monthNames[named[2]];
    if (month) {
      let y = named[3] ? Number(named[3]) : Number((fallbackMonthKey ?? getMonthKey()).slice(0, 4));
      if (y < 100) y += 2000;
      return toDateKey(y, month, Number(named[1]));
    }
  }

  // Header solo con día ("3", "03") → usa mes de contexto
  if (/^\d{1,2}$/.test(value) && fallbackMonthKey) {
    const [y, m] = fallbackMonthKey.split('-').map(Number);
    return toDateKey(y, m, Number(value));
  }

  // "Lun 3", "Mar 12"
  const dowDay = normalizeForSearch(value).match(
    /^(lun|mar|mie|mié|jue|vie|sab|sáb|dom)\s*(\d{1,2})$/,
  );
  if (dowDay && fallbackMonthKey) {
    const [y, m] = fallbackMonthKey.split('-').map(Number);
    return toDateKey(y, m, Number(dowDay[2]));
  }

  return null;
}

/** Nombres del checador → colaborador del tablero. */
const CHECADOR_NAME_HINTS: { pattern: RegExp; employeeId: string }[] = [
  { pattern: /\bandrea\b/, employeeId: 'emp-andrea' },
  { pattern: /\broberto\b/, employeeId: 'emp-roberto' },
  { pattern: /\bjesus\b|\bjesús\b/, employeeId: 'emp-jesus' },
  { pattern: /\bandres\b|\bandrés\b/, employeeId: 'emp-andres' },
  { pattern: /\bjuan\s*carlos\b|\btrejo\b/, employeeId: 'emp-juancarlos' },
  { pattern: /\byared\b/, employeeId: 'emp-yared' },
  { pattern: /\bjorddy\b|\bdylan\b|\brivera\b/, employeeId: 'emp-jorddy' },
];

function matchEmployee(
  name: string,
  tasks: EmployeeTask[],
): EmployeeTask | undefined {
  const team = tasks.filter((t) => t.employeeId !== 'emp-orlando');
  const q = normalizeForSearch(name).replace(/\./g, ' ');
  if (!q) return undefined;

  for (const hint of CHECADOR_NAME_HINTS) {
    if (hint.pattern.test(q)) {
      const hit = team.find((t) => t.employeeId === hint.employeeId);
      if (hit) return hit;
    }
  }

  const exact = team.find((t) => normalizeForSearch(t.employeeName) === q);
  if (exact) return exact;

  const includes = team.filter(
    (t) =>
      fuzzyIncludes(t.employeeName, name) || fuzzyIncludes(name, t.employeeName),
  );
  if (includes.length === 1) return includes[0];

  const first = q.split(/\s+/)[0];
  if (first && first.length >= 3) {
    const byFirst = team.filter((t) =>
      normalizeForSearch(t.employeeName).split(/\s+/).includes(first),
    );
    if (byFirst.length === 1) return byFirst[0];
  }
  return undefined;
}

function detectFallbackMonth(matrix: string[][]): string {
  for (const row of matrix.slice(0, 3)) {
    for (const cell of row.slice(0, 12)) {
      const key = parseAttendanceDateKey(cell);
      if (key) return key.slice(0, 7);
    }
  }
  return getMonthKey();
}


const LATE_AFTER_MINUTES = 9 * 60 + 15; // 09:15

/** IDs del checador → empleado Yaavs (Asistencias.xlsx). */
const CHECADOR_USER_IDS: Record<string, string> = {
  '10482': 'emp-andrea',
  '10492': 'emp-roberto',
  '10610': 'emp-andres',
  '10609': 'emp-jesus',
  '10421': 'emp-juancarlos',
  // '10671': emp-orlando — se omite del tablero de equipo
};

type PunchDateOrder = 'dmy' | 'mdy';

/** El checador suele traer MM/DD/YYYY (ej. 04/13/2026 = 13 abr). */
function detectPunchDateOrder(matrix: string[][], timeCol: number, headerIdx: number): PunchDateOrder {
  let sawDayFirstGt12 = false;
  let sawMonthSecondGt12 = false;
  for (const line of matrix.slice(headerIdx + 1, headerIdx + 400)) {
    const raw = (line[timeCol] ?? '').trim();
    const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && b <= 12) sawDayFirstGt12 = true;
    if (b > 12 && a <= 12) sawMonthSecondGt12 = true;
  }
  if (sawMonthSecondGt12 && !sawDayFirstGt12) return 'mdy';
  if (sawDayFirstGt12 && !sawMonthSecondGt12) return 'dmy';
  // Por defecto el concentrado MKT de Hostinger/checador viene en MM/DD.
  return 'mdy';
}

function parsePunchDateTime(
  raw: string,
  order: PunchDateOrder = 'mdy',
): { dateKey: string; minutes: number } | null {
  const value = raw.trim();
  if (!value) return null;
  const m = value.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+|T)(\d{1,2}):(\d{2})(?::(\d{2}))?/,
  );
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const a = Number(m[1]);
    const b = Number(m[2]);
    const month = order === 'mdy' ? a : b;
    const day = order === 'mdy' ? b : a;
    // Si el orden elegido es inválido, prueba el otro.
    let dateKey = toDateKey(y, month, day);
    if (!dateKey) {
      dateKey = toDateKey(y, day, month);
    }
    if (!dateKey) return null;
    const minutes = Number(m[4]) * 60 + Number(m[5]);
    return { dateKey, minutes };
  }
  const dateKey = parseAttendanceDateKey(value.slice(0, 10));
  if (!dateKey) return null;
  const hm = value.match(/(\d{1,2}):(\d{2})/);
  const minutes = hm ? Number(hm[1]) * 60 + Number(hm[2]) : 9 * 60;
  return { dateKey, minutes };
}

/**
 * Concentrado del checador: ID | Nombre | Tiempo | … | ENTRADA/SALIDA.
 * Una o más marcas del día → Asistió; entrada después de 09:15 → Retardo.
 */
export function parsePunchClockAttendance(
  matrix: string[][],
  tasks: EmployeeTask[],
): AttendanceImportResult {
  const errors: string[] = [];
  if (!matrix.length) {
    return {
      rows: [],
      unmatchedNames: [],
      skippedEmpty: 0,
      format: 'unknown',
      dateFrom: null,
      dateTo: null,
      errors: ['Archivo vacío.'],
    };
  }

  let headerIdx = -1;
  let nameCol = -1;
  let timeCol = -1;
  let stateCol = -1;

  for (let r = 0; r < Math.min(matrix.length, 30); r++) {
    const norm = matrix[r].map((c) => normalizeHeader(c ?? ''));
    const n = norm.findIndex((h) => h === 'nombre' || h === 'nombres');
    const t = norm.findIndex(
      (h) => h.includes('tiempo') || h === 'fecha' || h === 'fechahora',
    );
    const s = norm.findIndex(
      (h) =>
        h.includes('estadodetrabajo') ||
        h === 'estado' ||
        h === 'tipo' ||
        h.includes('entrada'),
    );
    if (n >= 0 && t >= 0) {
      headerIdx = r;
      nameCol = n;
      timeCol = t;
      stateCol = s >= 0 ? s : -1;
      break;
    }
  }

  if (headerIdx < 0) {
    return {
      rows: [],
      unmatchedNames: [],
      skippedEmpty: 0,
      format: 'unknown',
      dateFrom: null,
      dateTo: null,
      errors: [
        'No se detectó el concentrado del checador (columnas Nombre + Tiempo + Estado de Trabajo).',
      ],
    };
  }

  const dateOrder = detectPunchDateOrder(matrix, timeCol, headerIdx);
  const idCol = matrix[headerIdx].findIndex((h) => {
    const n = normalizeHeader(h ?? '');
    return n === 'iddeusuario' || n === 'id' || n === 'usuario' || n.includes('idusuario');
  });

  type Agg = { employeeId: string; employeeName: string; entradas: number[]; salidas: number[] };
  const byDay = new Map<string, Agg>();
  const unmatched = new Set<string>();

  for (const line of matrix.slice(headerIdx + 1)) {
    const name = (line[nameCol] ?? '').trim();
    const timeRaw = (line[timeCol] ?? '').trim();
    if (!name || !timeRaw) continue;
    const stateRaw = stateCol >= 0 ? (line[stateCol] ?? '').trim().toUpperCase() : 'ENTRADA';
    const checadorId = idCol >= 0 ? (line[idCol] ?? '').trim() : '';
    let emp =
      (checadorId && CHECADOR_USER_IDS[checadorId]
        ? tasks.find((t) => t.employeeId === CHECADOR_USER_IDS[checadorId])
        : undefined) || matchEmployee(name, tasks);
    if (!emp) {
      if (CHECADOR_USER_IDS[checadorId] === undefined && name) unmatched.add(name);
      continue;
    }
    const parsed = parsePunchDateTime(timeRaw, dateOrder);
    if (!parsed) {
      errors.push(`Fecha/hora no reconocida: "${timeRaw}"`);
      continue;
    }
    const key = `${emp.employeeId}::${parsed.dateKey}`;
    let agg = byDay.get(key);
    if (!agg) {
      agg = {
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        entradas: [],
        salidas: [],
      };
      byDay.set(key, agg);
    }
    if (stateRaw.includes('SALIDA')) agg.salidas.push(parsed.minutes);
    else agg.entradas.push(parsed.minutes);
  }

  const rows: AttendanceImportRow[] = [];
  for (const [key, agg] of byDay) {
    const dateKey = key.split('::')[1];
    if (!agg.entradas.length && !agg.salidas.length) continue;
    let status: AttendanceStatus = 'present';
    if (agg.entradas.length) {
      const first = Math.min(...agg.entradas);
      if (first > LATE_AFTER_MINUTES) status = 'late';
    }
    rows.push({
      employeeId: agg.employeeId,
      employeeName: agg.employeeName,
      dateKey,
      monthKey: dateKey.slice(0, 7),
      status,
    });
  }

  const dates = rows.map((r) => r.dateKey).sort();
  return {
    rows,
    unmatchedNames: [...unmatched],
    skippedEmpty: 0,
    format: 'punch',
    dateFrom: dates[0] ?? null,
    dateTo: dates[dates.length - 1] ?? null,
    errors: [...new Set(errors)].slice(0, 8),
  };
}

/**
 * Importa CSV/TSV flexible:
 * - Matriz (como el reporte): Colaborador | fechas… | totales opcionales
 * - Lista: Colaborador | Fecha | Estado
 * Sirve para semana o mes completo; solo actualiza celdas con valor.
 */
export function parseAttendanceImport(
  text: string,
  tasks: EmployeeTask[],
): AttendanceImportResult {
  const matrix = parseCsvMatrix(text);
  const errors: string[] = [];
  if (matrix.length < 2) {
    return {
      rows: [],
      unmatchedNames: [],
      skippedEmpty: 0,
      format: 'unknown',
      dateFrom: null,
      dateTo: null,
      errors: ['El archivo está vacío o no se pudo leer. Usa CSV (Excel → Guardar como CSV).'],
    };
  }

  const header = matrix[0].map((h) => h.trim());
  const headerNorm = header.map(normalizeHeader);
  const fallbackMonth = detectFallbackMonth(matrix);

  const nameIdx = headerNorm.findIndex((h) => NAME_HEADERS.has(h));
  const dateIdx = headerNorm.findIndex((h) => DATE_HEADERS.has(h));
  const statusIdx = headerNorm.findIndex((h) => STATUS_HEADERS.has(h));

  const rows: AttendanceImportRow[] = [];
  const unmatched = new Set<string>();
  let skippedEmpty = 0;

  const pushRow = (
    emp: EmployeeTask,
    dateKey: string,
    status: AttendanceStatus,
  ) => {
    rows.push({
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      dateKey,
      monthKey: dateKey.slice(0, 7),
      status,
    });
  };

  // Formato largo: nombre + fecha + estado
  if (nameIdx >= 0 && dateIdx >= 0 && statusIdx >= 0 && nameIdx !== dateIdx) {
    for (const line of matrix.slice(1)) {
      const name = (line[nameIdx] ?? '').trim();
      const dateRaw = (line[dateIdx] ?? '').trim();
      const statusRaw = (line[statusIdx] ?? '').trim();
      if (!name && !dateRaw && !statusRaw) continue;
      const emp = matchEmployee(name, tasks);
      if (!emp) {
        if (name) unmatched.add(name);
        continue;
      }
      const dateKey = parseAttendanceDateKey(dateRaw, fallbackMonth);
      if (!dateKey) {
        errors.push(`Fecha no reconocida: "${dateRaw}"`);
        continue;
      }
      const status = parseAttendanceStatus(statusRaw);
      if (!status) {
        if (!statusRaw) {
          skippedEmpty += 1;
          continue;
        }
        errors.push(`Estado no reconocido para ${emp.employeeName}: "${statusRaw}"`);
        continue;
      }
      pushRow(emp, dateKey, status);
    }

    const dates = rows.map((r) => r.dateKey).sort();
    return {
      rows,
      unmatchedNames: [...unmatched],
      skippedEmpty,
      format: 'long',
      dateFrom: dates[0] ?? null,
      dateTo: dates[dates.length - 1] ?? null,
      errors: [...new Set(errors)].slice(0, 8),
    };
  }

  // Formato ancho (matriz): primera col = nombre, resto = fechas
  const col0 = nameIdx >= 0 ? nameIdx : 0;
  const dateCols: { index: number; dateKey: string }[] = [];
  for (let i = 0; i < header.length; i++) {
    if (i === col0) continue;
    const hn = headerNorm[i];
    if (TOTAL_HEADERS.has(hn) || STATUS_HEADERS.has(hn) || DATE_HEADERS.has(hn)) continue;
    const dateKey = parseAttendanceDateKey(header[i], fallbackMonth);
    if (dateKey) dateCols.push({ index: i, dateKey });
  }

  if (dateCols.length === 0) {
    return {
      rows: [],
      unmatchedNames: [],
      skippedEmpty: 0,
      format: 'unknown',
      dateFrom: null,
      dateTo: null,
      errors: [
        'No se detectaron columnas de fecha. Usa el reporte de Yaavs o un CSV con Colaborador + fechas (semana o mes).',
      ],
    };
  }

  for (const line of matrix.slice(1)) {
    const name = (line[col0] ?? '').trim();
    if (!name) continue;
    const emp = matchEmployee(name, tasks);
    if (!emp) {
      unmatched.add(name);
      continue;
    }
    for (const col of dateCols) {
      const raw = (line[col.index] ?? '').trim();
      if (!raw) {
        skippedEmpty += 1;
        continue;
      }
      const status = parseAttendanceStatus(raw);
      if (!status) {
        errors.push(`Estado no reconocido (${emp.employeeName} / ${col.dateKey}): "${raw}"`);
        continue;
      }
      pushRow(emp, col.dateKey, status);
    }
  }

  const dates = rows.map((r) => r.dateKey).sort();
  return {
    rows,
    unmatchedNames: [...unmatched],
    skippedEmpty,
    format: 'wide',
    dateFrom: dates[0] ?? null,
    dateTo: dates[dates.length - 1] ?? null,
    errors: [...new Set(errors)].slice(0, 8),
  };
}

export function mergeAttendanceImport(
  store: AttendanceStore,
  rows: AttendanceImportRow[],
  recordedBy: { id: string; name: string },
): AttendanceStore {
  let next = store;
  for (const row of rows) {
    next = upsertAttendance(next, {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      dateKey: row.dateKey,
      monthKey: row.monthKey,
      status: row.status,
      notes: '',
      recordedById: recordedBy.id,
      recordedByName: recordedBy.name,
    });
  }
  return next;
}
