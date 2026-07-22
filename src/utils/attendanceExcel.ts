import type { EmployeeTask } from '../types';
import {
  parseAttendanceImport,
  parsePunchClockAttendance,
  type AttendanceImportResult,
} from './attendance';

/** Lee CSV/TSV/TXT o Excel (.xlsx/.xls) del checador o reporte Yaavs. */
export async function parseAttendanceFile(
  file: File,
  tasks: EmployeeTask[],
): Promise<AttendanceImportResult> {
  const name = file.name.toLowerCase();
  const isExcel =
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    file.type.includes('spreadsheet') ||
    file.type === 'application/vnd.ms-excel';

  if (isExcel) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return {
        rows: [],
        unmatchedNames: [],
        skippedEmpty: 0,
        format: 'unknown',
        dateFrom: null,
        dateTo: null,
        errors: ['El Excel no tiene hojas.'],
      };
    }
    const sheet = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as string[][];

    const normalized = matrix.map((row) =>
      (row ?? []).map((cell) => {
        if (cell == null) return '';
        if (typeof cell === 'object' && cell !== null && 'getFullYear' in cell) {
          const d = cell as Date;
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }
        return String(cell).trim();
      }),
    );

    const punch = parsePunchClockAttendance(normalized, tasks);
    if (punch.rows.length > 0 || punch.format === 'punch') return punch;
    // Fallback: tratar la primera fila útil como CSV matriz
    const asText = normalized.map((r) => r.join('\t')).join('\n');
    return parseAttendanceImport(asText, tasks);
  }

  const text = await file.text();
  const punchGuess = parsePunchClockAttendance(
    text.split(/\r?\n/).map((line) => line.split(/\t|,|;/)),
    tasks,
  );
  if (punchGuess.format === 'punch' && punchGuess.rows.length > 0) return punchGuess;
  return parseAttendanceImport(text, tasks);
}
