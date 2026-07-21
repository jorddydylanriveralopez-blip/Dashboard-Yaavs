import type {
  BusinessUnit,
  Collaborator,
  InternalArea,
  ProjectPriority,
  ProjectStatus,
  ProjectType,
  RequestingDepartment,
} from '../types';
import { COLLABORATOR_DISPLAY_NAMES } from './teamDisplayNames';

export const BUSINESS_UNITS: { value: BusinessUnit; label: string }[] = [
  { value: 'yaavs_general', label: 'Yaavs general' },
  { value: 'prepago', label: 'Prepago' },
  { value: 'prepago_centro', label: 'Prepago centro' },
  { value: 'prepago_foraneo', label: 'Prepago foráneo' },
  { value: 'pospago', label: 'Pospago' },
  { value: 'silemi', label: 'Silemi' },
  { value: 'yaavs_shop', label: 'Yaavs Shop' },
  { value: 'arregla_mx', label: 'Arregla MX' },
  { value: 'academia_yaavs', label: 'Academia Yaavs' },
];

export const REQUESTING_DEPARTMENTS: { value: RequestingDepartment; label: string }[] = [
  { value: 'direccion_comercial', label: 'Dirección comercial' },
  { value: 'direccion', label: 'Dirección' },
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'atencion_cliente', label: 'Atención a cliente' },
  { value: 'rh', label: 'RH' },
  { value: 'almacen', label: 'Almacén' },
  { value: 'capacitacion', label: 'Capacitación' },
  { value: 'ti', label: 'TI' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'ventas', label: 'Ventas' },
];

export const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'campana_creativa', label: 'Campaña creativa' },
  { value: 'material_pop', label: 'Material PoP' },
  { value: 'diseno_grafico', label: 'Diseño gráfico' },
  { value: 'video', label: 'Video' },
  { value: 'estrategia', label: 'Estrategia' },
  { value: 'activacion_btl', label: 'Activación BTL' },
  { value: 'diseno_web', label: 'Diseño web' },
  { value: 'merch', label: 'Merch' },
  { value: 'community_manager', label: 'Community manager' },
];

export const PROJECT_PRIORITIES: { value: ProjectPriority; label: string }[] = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta_urgente', label: 'Alta / urgente' },
];

export const INTERNAL_AREAS: { value: InternalArea; label: string }[] = [
  { value: 'diseno_grafico', label: 'Diseño gráfico' },
  { value: 'diseno_web', label: 'Diseño web' },
  { value: 'diseno_audiovisual', label: 'Diseño audiovisual' },
  { value: 'redes_sociales', label: 'Redes sociales' },
];

const LEGACY_INTERNAL_AREA_MAP: Record<string, InternalArea> = {
  diseno_corporativo: 'diseno_grafico',
  diseno_editorial: 'diseno_grafico',
  community_manager: 'redes_sociales',
  produccion: 'diseno_audiovisual',
  mercadotecnia: 'redes_sociales',
};

export function normalizeInternalArea(value: string): InternalArea {
  if (INTERNAL_AREAS.some((a) => a.value === value)) return value as InternalArea;
  return LEGACY_INTERNAL_AREA_MAP[value] ?? 'diseno_grafico';
}

export function labelForInternalArea(value: string): string {
  const normalized = normalizeInternalArea(value);
  return labelFor(INTERNAL_AREAS, normalized);
}

export const REQUESTED_BY_OPTIONS = [
  { value: 'Carlos', label: 'Carlos Trejo' },
  { value: 'Orlando', label: 'Orlando Villagómez' },
  { value: 'Ambos', label: 'Ambos' },
] as const;

export type RequestedByOption = (typeof REQUESTED_BY_OPTIONS)[number]['value'];

export function normalizeRequestedBy(value: string): RequestedByOption | '' {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (
    lower === 'ambos' ||
    (lower.includes('orlando') && lower.includes('carlos'))
  ) {
    return 'Ambos';
  }
  if (lower === 'orlando' || lower.startsWith('orlando')) return 'Orlando';
  if (lower === 'carlos' || lower.includes('carlos')) return 'Carlos';
  return '';
}

export function labelForRequestedBy(value: string): string {
  const normalized = normalizeRequestedBy(value);
  if (normalized) {
    const match = REQUESTED_BY_OPTIONS.find((o) => o.value === normalized);
    if (match) return match.label;
  }
  return value.trim() || '—';
}

export const COLLABORATORS: { value: Collaborator; label: string }[] = [
  { value: 'andrea', label: COLLABORATOR_DISPLAY_NAMES.andrea },
  { value: 'roberto', label: COLLABORATOR_DISPLAY_NAMES.roberto },
  { value: 'jorddy', label: COLLABORATOR_DISPLAY_NAMES.jorddy },
  { value: 'andres', label: COLLABORATOR_DISPLAY_NAMES.andres },
  { value: 'jesus', label: COLLABORATOR_DISPLAY_NAMES.jesus },
  { value: 'carlos', label: COLLABORATOR_DISPLAY_NAMES.carlos },
  { value: 'yared', label: COLLABORATOR_DISPLAY_NAMES.yared },
  { value: 'todos', label: COLLABORATOR_DISPLAY_NAMES.todos },
];

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'esperando_info', label: 'Esperando info' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'revision_interna', label: 'Revisión interna' },
  { value: 'revision_externa', label: 'Revisión externa' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'en_produccion', label: 'En producción' },
  { value: 'terminado', label: 'Terminado' },
];

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  nuevo: '#94a3b8',
  esperando_info: '#f59e0b',
  en_proceso: '#0055ff',
  revision_interna: '#7c3aed',
  revision_externa: '#a855f7',
  aprobado: '#06b6d4',
  en_produccion: '#0ea5e9',
  terminado: '#10b981',
};

export const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  baja: '#94a3b8',
  media: '#f59e0b',
  alta_urgente: '#ef4444',
};

export function labelFor<T extends string>(
  list: { value: T; label: string }[],
  value: T | null | undefined,
): string {
  if (value == null || value === '') return '—';
  return list.find((x) => x.value === value)?.label ?? String(value);
}
