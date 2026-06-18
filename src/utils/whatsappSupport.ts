import { COMPANY_NAME } from '../constants';

/** WhatsApp de soporte (México +52). */
export const SUPPORT_WHATSAPP_E164 = '525629573030';

export function buildForgotPasswordWhatsAppUrl(username?: string): string {
  const user = username?.trim();
  const lines = [
    `Hola, olvidé mi contraseña de ${COMPANY_NAME}.`,
    user ? `Mi usuario es: ${user}` : 'Aún no recuerdo mi usuario.',
    '¿Me pueden ayudar a restablecer el acceso?',
  ];
  const text = lines.join('\n');
  return `https://wa.me/${SUPPORT_WHATSAPP_E164}?text=${encodeURIComponent(text)}`;
}
