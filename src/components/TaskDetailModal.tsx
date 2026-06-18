import { useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useConfirm } from '../context/ConfirmContext';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { getDeadlineInfo } from '../utils/deadline';
import { FileAttachmentsEditor, FileAttachmentsList } from './FileAttachments';
import { SpellCheckInput, SpellCheckTextarea } from './SpellCheckField';
import type { EmployeeTask, TaskStatus } from '../types';
import './TaskDetailModal.css';

interface Props {
  taskId: string;
  onClose: () => void;
}

export function TaskDetailModal({ taskId, onClose }: Props) {
  const { board, canEditTask, updateTask, deleteTask, canEditAll } = useApp();
  const { confirm } = useConfirm();

  const task = useMemo(
    () => board.tasks.find((t) => t.id === taskId),
    [board.tasks, taskId],
  );

  useEffect(() => {
    if (!task) onClose();
  }, [task, onClose]);

  if (!task) return null;

  const editable = canEditTask(task);
  const deadline = getDeadlineInfo(task.dueDate, task.status);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <div className="modal-person">
            <div className="avatar" style={{ background: task.avatarColor }}>
              {task.employeeName.charAt(0)}
            </div>
            <div>
              <h2 id="modal-title">{task.employeeName}</h2>
              <span>{task.department}</span>
              {task.assignedByName && (
                <span className="modal-assigned-by">
                  Indicación de {task.assignedByName}
                  {task.assignedAt
                    ? ` · ${new Date(task.assignedAt).toLocaleDateString('es-MX')}`
                    : ''}
                </span>
              )}
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="modal-body">
          <section>
            <label>Trabajo actual</label>
            {editable ? (
              <SpellCheckTextarea
                value={task.currentWork}
                rows={3}
                extraWords={[task.employeeName]}
                onChange={(e) => updateTask(task.id, { currentWork: e.target.value })}
              />
            ) : (
              <p>{task.currentWork}</p>
            )}
          </section>

          <div className="modal-grid">
            <section>
              <label>Estado</label>
              {editable ? (
                <select
                  value={task.status}
                  onChange={(e) =>
                    updateTask(task.id, { status: e.target.value as TaskStatus })
                  }
                >
                  {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className="status-pill"
                  style={{ background: STATUS_COLORS[task.status] }}
                >
                  {STATUS_LABELS[task.status]}
                </span>
              )}
            </section>

            <section>
              <label>Prioridad</label>
              {editable ? (
                <select
                  value={task.priority}
                  onChange={(e) =>
                    updateTask(task.id, {
                      priority: e.target.value as EmployeeTask['priority'],
                    })
                  }
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              ) : (
                <p className="capitalize">{task.priority}</p>
              )}
            </section>

            <section>
              <label>KPI actual / meta</label>
              {editable ? (
                <div className="kpi-row">
                  <input
                    type="number"
                    min={0}
                    value={task.kpiCurrent}
                    onChange={(e) =>
                      updateTask(task.id, { kpiCurrent: Number(e.target.value) || 0 })
                    }
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min={1}
                    value={task.kpiTarget}
                    onChange={(e) =>
                      updateTask(task.id, { kpiTarget: Number(e.target.value) || 100 })
                    }
                  />
                  <span>%</span>
                </div>
              ) : (
                <p>
                  {task.kpiCurrent}% / {task.kpiTarget}%
                </p>
              )}
            </section>

            <section>
              <label>Fecha de entrega</label>
              {editable ? (
                <input
                  type="date"
                  value={task.dueDate}
                  onChange={(e) => updateTask(task.id, { dueDate: e.target.value })}
                />
              ) : (
                <p>{task.dueDate}</p>
              )}
              <span className={`deadline-badge tone-${deadline.tone}`}>
                {deadline.label}
              </span>
            </section>
          </div>

          <section>
            <label>Objetivo del periodo</label>
            {editable ? (
              <SpellCheckInput
                value={task.objective}
                onChange={(e) => updateTask(task.id, { objective: e.target.value })}
              />
            ) : (
              <p>{task.objective}</p>
            )}
          </section>

          <section>
            <label>Notas</label>
            {editable ? (
              <SpellCheckTextarea
                value={task.notes}
                rows={5}
                placeholder="Comentarios, bloqueos, próximos pasos…"
                extraWords={[task.employeeName]}
                onChange={(e) => updateTask(task.id, { notes: e.target.value })}
              />
            ) : (
              <p className="notes-full">{task.notes || 'Sin notas'}</p>
            )}
          </section>

          {(editable || (task.attachments?.length ?? 0) > 0) && (
            <section>
              <label>Archivos e imágenes</label>
              {editable ? (
                <FileAttachmentsEditor
                  attachments={task.attachments ?? []}
                  onChange={(attachments) => updateTask(task.id, { attachments })}
                />
              ) : (
                <FileAttachmentsList attachments={task.attachments ?? []} />
              )}
            </section>
          )}

          {(editable || task.attachmentUrl) && (
            <section>
              <label>Enlace externo</label>
              {editable ? (
                <input
                  type="url"
                  value={task.attachmentUrl ?? ''}
                  placeholder="https://…"
                  onChange={(e) =>
                    updateTask(task.id, {
                      attachmentUrl: e.target.value.trim() || undefined,
                    })
                  }
                />
              ) : task.attachmentUrl ? (
                <a
                  href={task.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-attachment-link"
                >
                  Abrir enlace externo
                </a>
              ) : null}
            </section>
          )}
        </div>

        <footer className="modal-footer">
          {canEditAll && (
            <button
              type="button"
              className="btn-danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Eliminar fila',
                  message: `¿Eliminar la fila de ${task.employeeName}?`,
                  confirmLabel: 'Eliminar',
                  danger: true,
                });
                if (ok) {
                  deleteTask(task.id);
                  onClose();
                }
              }}
            >
              Eliminar fila
            </button>
          )}
          <button type="button" className="btn-primary" onClick={onClose}>
            Listo
          </button>
        </footer>
      </div>
    </div>
  );
}
