import type { EmployeeTask } from '../types';
import {
  parseAttendanceImport,
  parsePunchClockAttendance,
  type AttendanceImportResult,
} from './attendance';

function cellToString(cell: unknown): string {
  if (cell == null) return '';
  if (typeof cell === 'object' && cell !== null && 'getFullYear' in cell) {
    const d = cell as Date;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  return String(cell).trim();
}

function matrixFromSheet(XLSX: typeof import('xlsx'), sheet: import('xlsx').WorkSheet): string[][] {
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];
  return matrix.map((row) => (Array.isArray(row) ? row : []).map(cellToString));
}

function looksLikeChecador(matrix: string[][]): boolean {
  return matrix.some((row) => {
    const joined = row.map((c) => c.toLowerCase()).join('|');
    return (
      joined.includes('estado de trabajo') ||
      joined.includes('id de usuario') ||
      (joined.includes('tiempo') && joined.includes('nombre') && joined.includes('entrada'))
    );
  });
}

/** Lee CSV/TSV/TXT o Excel (.xlsx/.xls) del checador tal cual (Asistencias.xlsx). */
export async function parseAttendanceFile(
  file: File,
  tasks: EmployeeTask[],
): Promise<AttendanceImportResult> {
  const name = file.name.toLowerCase();
  const isExcel =
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    file.type.includes('spreadsheet') ||
    file.type === 'application/vnd.ms-excel' ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (isExcel) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    if (!wb.SheetNames.length) {
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

    let best: AttendanceImportResult | null = null;
    for (const sheetName of wb.SheetNames) {
      const matrix = matrixFromSheet(XLSX, wb.Sheets[sheetName]!);
      if (!matrix.length) continue;
      const punch = parsePunchClockAttendance(matrix, tasks);
      if (punch.format === 'punch' && punch.rows.length > 0) {
        best = punch;
        break;
      }
      if (punch.format === 'punch' && (!best || punch.unmatchedNames.length)) {
        best = punch;
      }
      if (!best && looksLikeChecador(matrix)) {
        best = punch;
      }
    }

    if (best && (best.rows.length > 0 || best.format === 'punch')) {
      return best;
    }

    // Fallback CSV-like on first sheet
    const first = matrixFromSheet(XLSX, wb.Sheets[wb.SheetNames[0]!]!);
    const asText = first.map((r) => r.join('\t')).join('\n');
    return parseAttendanceImport(asText, tasks);
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).map((line) => line.split(/\t|,|;/));
  const punchGuess = parsePunchClockAttendance(lines, tasks);
  if (punchGuess.format === 'punch') return punchGuess;
  return parseAttendanceImport(text, tasks);
}
