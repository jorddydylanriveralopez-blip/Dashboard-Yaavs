import { useEffect, useState, type FormEvent } from 'react';
import { PRIORITY_LABELS } from '../constants';
import { FileAttachmentsEditor } from './FileAttachments';
import { SpellCheckInput, SpellCheckTextarea } from './SpellCheckField';
import type { AssignmentBrief, EmployeeTask, FileAttachment } from '../types';
import './AssignTaskModal.css';

export interface AssignFormData {
  employeeId: string;
  title: string;
  objective: string;
  dueDate: string;
  priority: 'baja' | 'media' | 'alta';
  notes: string;
  attachmentUrl: string;
  attachments?: FileAttachment[];
  brief?: AssignmentBrief;
}

interface Props {
  target: EmployeeTask | null;
  assignable: EmployeeTask[];
  onClose: () => void;
  onSubmit: (data: AssignFormData) => void;
}

export function AssignTaskModal({ target, assignable, onClose, onSubmit }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState<'baja' | 'media' | 'alta'>('media');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  useEffect(() => {
    if (target) setEmployeeId(target.employeeId);
  }, [target]);

  if (!target && assignable.length === 0) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!employeeId || !title.trim()) return;
    onSubmit({
      employeeId,
      title,
      objective,
      dueDate,
      priority,
      notes,
      attachmentUrl,
      attachments: attachments.length ? attachments : undefined,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel assign-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <header className="modal-header">
          <h2>Asignar indicación</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <form className="assign-modal-form" onSubmit={handleSubmit}>
          {!target && (
            <label>
              Colaborador
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
              >
                <option value="">Selecciona…</option>
                {assignable.map((t) => (
                  <option key={t.employeeId} value={t.employeeId}>
                    {t.employeeName} — {t.roleTitle}
                  </option>
                ))}
              </select>
            </label>
          )}
          {target && (
            <p className="assign-modal-target">
              Para: <strong>{target.employeeName}</strong>
            </p>
          )}
          <label>
            Qué debe hacer
            <SpellCheckTextarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              required
            />
          </label>
          <label>
            Objetivo
            <SpellCheckInput value={objective} onChange={(e) => setObjective(e.target.value)} />
          </label>
          <div className="assign-modal-row">
            <label>
              Fecha límite
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </label>
            <label>
              Prioridad
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as 'baja' | 'media' | 'alta')
                }
              >
                {(Object.keys(PRIORITY_LABELS) as Array<keyof typeof PRIORITY_LABELS>).map(
                  (k) => (
                    <option key={k} value={k}>
                      {PRIORITY_LABELS[k]}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <label>
            Archivos e imágenes
            <FileAttachmentsEditor attachments={attachments} onChange={setAttachments} />
          </label>
          <label>
            Enlace externo (Figma, Drive…)
            <input
              type="url"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label>
            Notas
            <SpellCheckTextarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </label>
          <div className="assign-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Enviar indicación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
