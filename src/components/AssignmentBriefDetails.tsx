import { Fragment } from 'react';
import {
  BUSINESS_UNITS,
  labelFor,
  labelForInternalArea,
  labelForRequestedBy,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  REQUESTING_DEPARTMENTS,
} from '../data/projectOptions';
import { labelForProjectCollaborators } from '../utils/projectCollaborators';
import { formatShortDate } from '../utils/formatDate';
import type { AssignmentBrief } from '../types';
import './AssignmentBriefDetails.css';

interface Props {
  brief: AssignmentBrief;
  compact?: boolean;
}

export function AssignmentBriefDetails({ brief, compact }: Props) {
  const items: { label: string; value: string }[] = [
    { label: 'Nombre del proyecto', value: brief.projectName.trim() || '—' },
    { label: 'Fecha de solicitud', value: formatShortDate(brief.requestDate) },
    { label: 'Unidad de negocio', value: labelFor(BUSINESS_UNITS, brief.businessUnit) },
    { label: 'Solicitado por', value: labelForRequestedBy(brief.requestedBy) },
    {
      label: 'Área solicitante',
      value: labelFor(REQUESTING_DEPARTMENTS, brief.requestingDepartment),
    },
    { label: 'Tipo de proyecto', value: labelFor(PROJECT_TYPES, brief.projectType) },
    {
      label: 'Prioridad del proyecto',
      value: labelFor(PROJECT_PRIORITIES, brief.projectPriority),
    },
    { label: 'Área interna', value: labelForInternalArea(brief.internalArea) },
    {
      label: 'Colaborador(es)',
      value: labelForProjectCollaborators(brief),
    },
  ];

  if (brief.projectStatus) {
    items.push({
      label: 'Estado del proyecto',
      value: labelFor(PROJECT_STATUSES, brief.projectStatus),
    });
  }

  return (
    <div className={`assign-brief ${compact ? 'assign-brief-compact' : ''}`}>
      <p className="assign-brief-title">Datos de la solicitud / proyecto</p>
      <dl className="assign-brief-grid">
        {items.map(({ label, value }) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>
      {brief.projectComments?.trim() && (
        <p className="assign-brief-comments">
          <strong>Comentarios del proyecto:</strong> {brief.projectComments.trim()}
        </p>
      )}
    </div>
  );
}
