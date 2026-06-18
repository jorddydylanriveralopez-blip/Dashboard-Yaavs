import { COMPANY_NAME, RATING_LABELS } from '../constants';
import type { MonthlyPerformanceRecord } from '../types';

/** Solo dígitos; si empieza con 52 se usa tal cual, si no se asume México (+52). */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

export function buildPerformanceWhatsAppMessage(
  record: MonthlyPerformanceRecord,
  managerName: string,
): string {
  const ratingLabel = RATING_LABELS[record.rating];
  return [
    `Hola ${record.employeeName}, soy ${managerName} de ${COMPANY_NAME}.`,
    '',
    `Resumen de ${record.monthLabel.replace(' (en curso)', '')}:`,
    `• Calificación: ${ratingLabel}`,
    `• KPI: ${record.kpiPercent}%`,
    `• Objetivo: ${record.objective}`,
    '',
    record.message,
    '',
    '¡Gracias por tu trabajo en el equipo!',
  ].join('\n');
}

export function buildPerformanceWhatsAppUrl(
  record: MonthlyPerformanceRecord,
  managerName: string,
  phoneRaw?: string,
): string {
  const text = encodeURIComponent(buildPerformanceWhatsAppMessage(record, managerName));
  const phone = normalizeWhatsAppPhone(phoneRaw ?? '');
  if (phone) return `https://wa.me/${phone}?text=${text}`;
  return `https://wa.me/?text=${text}`;
}

export function openPerformanceWhatsApp(
  record: MonthlyPerformanceRecord,
  managerName: string,
  phoneRaw?: string,
): void {
  window.open(
    buildPerformanceWhatsAppUrl(record, managerName, phoneRaw),
    '_blank',
    'noopener,noreferrer',
  );
}
