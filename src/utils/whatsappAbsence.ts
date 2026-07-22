import { COMPANY_NAME } from '../constants';
import { normalizeWhatsAppPhone } from './whatsappPerformance';

/** Gerentes que reciben aviso de "no pude asistir". */
export const ABSENCE_NOTIFY_EMPLOYEE_IDS = ['emp-orlando', 'emp-juancarlos'] as const;

/**
 * Teléfonos por defecto (México) si no están en employeePhones.
 * Se pueden sobreescribir con VITE_ORLANDO_WHATSAPP / VITE_JC_WHATSAPP.
 */
export const ABSENCE_WHATSAPP_DEFAULTS: Record<string, string> = {
  'emp-orlando':
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ORLANDO_WHATSAPP) ||
    '',
  'emp-juancarlos':
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_JC_WHATSAPP) ||
    '',
};

export function canReportAbsence(employeeId: string | undefined | null): boolean {
  if (!employeeId) return false;
  return !(ABSENCE_NOTIFY_EMPLOYEE_IDS as readonly string[]).includes(employeeId);
}

export function buildAbsenceWhatsAppMessage(
  employeeName: string,
  reason?: string,
): string {
  const clean = reason?.trim();
  return [
    `Hola, soy ${employeeName} del equipo ${COMPANY_NAME}.`,
    '',
    'No pude asistir hoy a la oficina.',
    clean ? `Motivo: ${clean}` : 'Motivo: una situación personal / imprevisto.',
    '',
    'Aviso enviado desde el panel Yaavs.',
  ].join('\n');
}

export function resolveAbsenceWhatsAppPhone(
  employeeId: string,
  employeePhones: Record<string, string>,
): string {
  return normalizeWhatsAppPhone(
    employeePhones[employeeId] || ABSENCE_WHATSAPP_DEFAULTS[employeeId] || '',
  );
}

export function buildAbsenceWhatsAppUrl(
  phoneE164Digits: string,
  employeeName: string,
  reason?: string,
): string {
  const text = encodeURIComponent(buildAbsenceWhatsAppMessage(employeeName, reason));
  if (phoneE164Digits) return `https://wa.me/${phoneE164Digits}?text=${text}`;
  return `https://wa.me/?text=${text}`;
}

/** Abre WhatsApp a Orlando y luego a Carlos (el navegador puede pedir permiso de popups). */
export function openAbsenceWhatsAppToManagers(
  employeeName: string,
  employeePhones: Record<string, string>,
  reason?: string,
): { opened: number; missingPhones: string[] } {
  const missing: string[] = [];
  let opened = 0;
  const urls: string[] = [];

  for (const id of ABSENCE_NOTIFY_EMPLOYEE_IDS) {
    const phone = resolveAbsenceWhatsAppPhone(id, employeePhones);
    if (!phone) missing.push(id);
    urls.push(buildAbsenceWhatsAppUrl(phone, employeeName, reason));
  }

  if (urls[0]) {
    window.open(urls[0], '_blank', 'noopener,noreferrer');
    opened += 1;
  }
  if (urls[1]) {
    window.setTimeout(() => {
      window.open(urls[1], '_blank', 'noopener,noreferrer');
    }, 900);
    opened += 1;
  }

  return { opened, missingPhones: missing };
}
