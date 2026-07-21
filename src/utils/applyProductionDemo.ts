import {
  PRODUCTION_DEMO_SEED_KEY,
  PRODUCTION_DEMO_SEED_VERSION,
} from '../constants';
import { clearYaavsStorage } from './clearAppData';
import { clearAllAttachmentData } from './attachmentStore';

/**
 * Arranque en ceros (día uno): la primera vez que un dispositivo carga esta
 * versión, borra todos los datos guardados (proyectos, asistencias, chat,
 * KPIs, indicaciones, agenda) y deja solo el equipo con tablero vacío.
 */
export function applyProductionDemoSeed(): boolean {
  if (!import.meta.env.PROD) return false;
  if (localStorage.getItem(PRODUCTION_DEMO_SEED_KEY) === PRODUCTION_DEMO_SEED_VERSION) {
    return false;
  }

  clearYaavsStorage();
  void clearAllAttachmentData().catch(() => undefined);
  localStorage.setItem(PRODUCTION_DEMO_SEED_KEY, PRODUCTION_DEMO_SEED_VERSION);

  return true;
}
