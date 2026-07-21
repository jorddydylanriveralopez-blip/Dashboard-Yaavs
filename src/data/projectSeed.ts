import type { CreativeProject } from '../types';

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const daysAhead = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const DEFAULT_PROJECTS: CreativeProject[] = [
  {
    id: 'proj-1',
    requestDate: daysAgo(12),
    projectName: 'Campaña lanzamiento prepago verano',
    businessUnit: 'prepago',
    requestedBy: 'María López',
    requestingDepartment: 'direccion_comercial',
    projectType: 'campana_creativa',
    priority: 'alta_urgente',
    commitmentDate: daysAhead(5),
    internalArea: 'diseno_grafico',
    collaborator: 'roberto',
    status: 'en_proceso',
    comments: 'Incluir variantes para stories y banner web.',
    createdAt: daysAgo(12),
    updatedAt: today,
  },
  {
    id: 'proj-2',
    requestDate: daysAgo(8),
    projectName: 'Video tutorial app Yaavs',
    businessUnit: 'yaavs_shop',
    requestedBy: 'Equipo TI',
    requestingDepartment: 'ti',
    projectType: 'video',
    priority: 'media',
    commitmentDate: daysAhead(10),
    internalArea: 'diseno_audiovisual',
    collaborator: 'jesus',
    status: 'revision_interna',
    comments: 'Guion aprobado. Falta música.',
    createdAt: daysAgo(8),
    updatedAt: today,
  },
  {
    id: 'proj-3',
    requestDate: daysAgo(20),
    projectName: 'Material PoP sucursales pospago',
    businessUnit: 'pospago',
    requestedBy: 'Dirección',
    requestingDepartment: 'direccion',
    projectType: 'material_pop',
    priority: 'alta_urgente',
    commitmentDate: daysAgo(2),
      internalArea: 'diseno_audiovisual',
    collaborator: 'todos',
    status: 'en_produccion',
    comments: 'Impresión en proveedor externo.',
    createdAt: daysAgo(20),
    updatedAt: today,
  },
  {
    id: 'proj-4',
    requestDate: daysAgo(30),
    projectName: 'Rediseño landing Silemi',
    businessUnit: 'silemi',
    requestedBy: 'Carlos Ruiz',
    requestingDepartment: 'direccion_comercial',
    projectType: 'diseno_web',
    priority: 'media',
    commitmentDate: daysAgo(5),
    internalArea: 'diseno_web',
    collaborator: 'jorddy',
    status: 'terminado',
    finishedDate: daysAgo(3),
    comments: 'Entregado y publicado en staging.',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(3),
  },
  {
    id: 'proj-5',
    requestDate: daysAgo(3),
    projectName: 'Merch colaboradores Q2',
    businessUnit: 'yaavs_shop',
    requestedBy: 'RH',
    requestingDepartment: 'rh',
    projectType: 'merch',
    priority: 'baja',
    commitmentDate: daysAhead(25),
      internalArea: 'diseno_grafico',
    collaborator: 'andrea',
    status: 'esperando_info',
    comments: 'Pendiente lista de tallas y cantidades.',
    createdAt: daysAgo(3),
    updatedAt: today,
  },
];
