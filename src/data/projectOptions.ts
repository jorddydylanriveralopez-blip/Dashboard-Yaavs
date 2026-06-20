import type {
  BusinessUnit,
  Collaborator,
  InternalArea,
  ProjectPriority,
  ProjectStatus,
  ProjectType,
  RequestingDepartment,
} from '../types';

export const BUSINESS_UNITS: { value: BusinessUnit; label: string }[] = [
  { value: 'prepago', label: 'Prepago' },
  { value: 'pospago', label: 'Pospago' },
  { value: 'silemi', label: 'Silemi' },
  { value: 'yaavs_shop', label: 'Yaavs Shop' },
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
  { value: 'diseno_web', label: 'Diseño web' },
  { value: 'diseno_corporativo', label: 'Diseño corporativo' },
  { value: 'diseno_editorial', label: 'Diseño editorial' },
  { value: 'diseno_audiovisual', label: 'Diseño audiovisual' },
  { value: 'community_manager', label: 'Community manager' },
  { value: 'produccion', label: 'Producción' },
  { value: 'mercadotecnia', label: 'Mercadotecnia' },
  { value: 'diseno_grafico', label: 'Diseño gráfico' },
];

export const COLLABORATORS: { value: Collaborator; label: string }[] = [
  { value: 'andrea', label: 'Andrea' },
  { value: 'roberto', label: 'Roberto' },
  { value: 'jorddy', label: 'Jorddy' },
  { value: 'andres', label: 'Andres' },
  { value: 'jesus', label: 'Jesus' },
  { value: 'ana', label: 'Ana García' },
  { value: 'carlos', label: 'Juan Carlos' },
  { value: 'todos', label: 'TODOS' },
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
  value: T,
): string {
  return list.find((x) => x.value === value)?.label ?? value;
}
