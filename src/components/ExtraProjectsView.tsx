import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { formatShortDate } from '../utils/formatDate';
import { formatHoursMinutes } from '../utils/projectHours';
import { assignableMarketingTasks } from '../utils/assignmentBrief';
import { EmployeeMultiSelect } from './EmployeeMultiSelect';
import { SpellCheckTextarea } from './SpellCheckField';
import type { ExtraProjectEntry, ExtraProjectStatus, ExtraProjectTemplate } from '../types';
import './ExtraProjectsView.css';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseHoursInput(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 60);
}

function extraStatus(e: ExtraProjectEntry): ExtraProjectStatus {
  return e.status ?? 'approved';
}

const STATUS_LABEL: Record<ExtraProjectStatus, string> = {
  pending: 'Por aprobar',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

export function ExtraProjectsView({ filter = '' }: { filter?: string }) {
  const {
    user,
    board,
    activeUsers,
    canEditAll,
    visibleExtraProjects,
    pendingExtraProjects,
    myDailyExtraTemplates,
    addExtraProject,
    updateExtraProject,
    deleteExtraProject,
    approveExtraProject,
    rejectExtraProject,
    deactivateDailyExtraTemplate,
  } = useApp();
  const { confirm } = useConfirm();
  const toast = useToast();

  const [name, setName] = useState('');
  const [employeeIds, setEmployeeIds] = useState<string[]>(
    user?.employeeId ? [user.employeeId] : [],
  );
  const [hours, setHours] = useState('');
  const [doneDate, setDoneDate] = useState(todayIso);
  const [notes, setNotes] = useState('');
  const [saveAsDaily, setSaveAsDaily] = useState(false);
  const [fromTemplateId, setFromTemplateId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const q = filter.trim().toLowerCase();
  const assignable = useMemo(
    () => assignableMarketingTasks(board.tasks, activeUsers),
    [board.tasks, activeUsers],
  );
  const filtered = useMemo(() => {
    if (!q) return visibleExtraProjects;
    return visibleExtraProjects.filter(
      (e) =>
        e.projectName.toLowerCase().includes(q) ||
        e.employeeName.toLowerCase().includes(q) ||
        e.employeeNames?.some((n) => n.toLowerCase().includes(q)) ||
        (e.notes ?? '').toLowerCase().includes(q),
    );
  }, [visibleExtraProjects, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: ExtraProjectEntry[] }>();
    for (const e of filtered) {
      const ids = e.employeeIds?.length ? e.employeeIds : [e.employeeId];
      const names = e.employeeNames?.length ? e.employeeNames : [e.employeeName];
      ids.forEach((employeeId, index) => {
        const personName = names[index] ?? e.employeeName;
        const group = map.get(employeeId) ?? { name: personName, items: [] };
        group.items.push(e);
        map.set(employeeId, group);
      });
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [filtered]);

  const totalMinutes = useMemo(
    () => filtered.reduce((sum, e) => sum + (e.minutes ?? 0), 0),
    [filtered],
  );

  const resetForm = () => {
    setName('');
    setEmployeeIds(user?.employeeId ? [user.employeeId] : []);
    setHours('');
    setDoneDate(todayIso());
    setNotes('');
    setSaveAsDaily(false);
    setFromTemplateId(null);
    setEditingId(null);
  };

  const fillFromDaily = (t: ExtraProjectTemplate) => {
    setEditingId(null);
    setFromTemplateId(t.id);
    setSaveAsDaily(true);
    setName(t.projectName);
    setEmployeeIds(
      t.employeeIds.length
        ? t.employeeIds
        : user?.employeeId
          ? [user.employeeId]
          : [],
    );
    setHours(
      t.defaultMinutes
        ? String(Math.round((t.defaultMinutes / 60) * 100) / 100)
        : '',
    );
    setDoneDate(todayIso());
    setNotes(t.notes ?? '');
    toast.info('Daily cargado. Revisa horas/fecha y envía el de hoy.');
  };

  const handleUseDailyToday = (t: ExtraProjectTemplate) => {
    const created = addExtraProject({
      projectName: t.projectName,
      employeeIds: t.employeeIds.length
        ? t.employeeIds
        : user?.employeeId
          ? [user.employeeId]
          : [],
      minutes: t.defaultMinutes,
      doneDate: todayIso(),
      notes: t.notes,
      fromTemplateId: t.id,
      saveAsDaily: true,
    });
    if (!created) {
      toast.error('No se pudo registrar el Daily de hoy.');
      return;
    }
    toast.success(
      canEditAll
        ? `Daily «${t.projectName}» registrado hoy.`
        : `Daily «${t.projectName}» enviado a Orlando (hoy).`,
    );
  };

  const handleRemoveDaily = async (t: ExtraProjectTemplate) => {
    const ok = await confirm({
      title: 'Quitar Daily',
      message: `¿Dejar de guardar «${t.projectName}» como trabajo diario? Los extras ya enviados no se borran.`,
      confirmLabel: 'Quitar Daily',
      danger: true,
    });
    if (!ok) return;
    if (deactivateDailyExtraTemplate(t.id)) {
      toast.success('Daily desactivado.');
      if (fromTemplateId === t.id) {
        setFromTemplateId(null);
        setSaveAsDaily(false);
      }
    }
  };

  const startEdit = (e: ExtraProjectEntry) => {
    setEditingId(e.id);
    setFromTemplateId(null);
    setSaveAsDaily(false);
    setName(e.projectName);
    setEmployeeIds(e.employeeIds?.length ? e.employeeIds : [e.employeeId]);
    setHours(
      e.minutes ? String(Math.round((e.minutes / 60) * 100) / 100) : '',
    );
    setDoneDate(e.doneDate);
    setNotes(e.notes ?? '');
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const minutes = parseHoursInput(hours);
    if (!name.trim()) {
      toast.error('Ponle un nombre al proyecto.');
      return;
    }
    if (!employeeIds.length) {
      toast.error('Elige al menos un colaborador.');
      return;
    }
    if (hours.trim() && minutes == null) {
      toast.error('Las horas deben ser un número mayor que cero.');
      return;
    }
    if (editingId) {
      const ok = updateExtraProject(editingId, {
        projectName: name.trim(),
        employeeIds,
        minutes: minutes ?? undefined,
        doneDate,
        notes: notes.trim() || undefined,
      });
      if (ok) {
        const wasRejected =
          extraStatus(
            visibleExtraProjects.find((x) => x.id === editingId) ??
              ({ status: 'pending' } as ExtraProjectEntry),
          ) === 'rejected';
        toast.success(
          wasRejected && !canEditAll
            ? 'Corregido y reenviado a Orlando para aprobación.'
            : 'Proyecto extra actualizado.',
        );
        resetForm();
      } else {
        toast.error('No pudiste editar este registro.');
      }
      return;
    }
    const asDaily = saveAsDaily || Boolean(fromTemplateId);
    const created = addExtraProject({
      projectName: name.trim(),
      employeeIds,
      minutes: minutes ?? undefined,
      doneDate,
      notes: notes.trim() || undefined,
      saveAsDaily: asDaily,
      fromTemplateId: fromTemplateId ?? undefined,
    });
    if (created) {
      toast.success(
        canEditAll
          ? asDaily
            ? 'Extra registrado y guardado como Daily.'
            : 'Proyecto extra aprobado y agregado a Activos.'
          : asDaily
            ? 'Enviado a Orlando. Quedó guardado como Daily para no reescribirlo.'
            : 'Enviado a Orlando para aprobación.',
      );
      resetForm();
    } else {
      toast.error('No se pudo guardar.');
    }
  };

  const handleDelete = async (e: ExtraProjectEntry) => {
    const ok = await confirm({
      title: 'Eliminar proyecto extra',
      message: `¿Borrar «${e.projectName}» de la bitácora?`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    if (deleteExtraProject(e.id)) {
      toast.success('Eliminado.');
      if (editingId === e.id) resetForm();
    }
  };

  const handleApprove = (e: ExtraProjectEntry) => {
    if (approveExtraProject(e.id)) {
      toast.success(`«${e.projectName}» aprobado · ya está en Activos.`);
    } else {
      toast.error('No se pudo aprobar.');
    }
  };

  const confirmReject = () => {
    if (!rejectingId) return;
    const target = pendingExtraProjects.find((e) => e.id === rejectingId);
    if (rejectExtraProject(rejectingId, rejectReason)) {
      toast.info(
        target
          ? `«${target.projectName}» rechazado. El colaborador puede corregirlo.`
          : 'Proyecto extra rechazado.',
      );
    }
    setRejectingId(null);
    setRejectReason('');
  };

  const canEditEntry = (e: ExtraProjectEntry) => {
    const myId = user?.employeeId || user?.id;
    const isOwner =
      e.employeeId === myId || Boolean(myId && e.employeeIds?.includes(myId));
    const status = extraStatus(e);
    if (canEditAll) return true;
    if (!isOwner) return false;
    return status === 'pending' || status === 'rejected';
  };

  return (
    <div className="extra-projects">
      <header className="extra-projects-intro">
        <div>
          <h2>Proyectos extra</h2>
          <p>
            {canEditAll
              ? 'Aprueba o rechaza lo que el equipo envía. Al aprobar, el proyecto pasa a Activos. Los Daily son trabajos repetitivos guardados.'
              : 'Registra trabajos adicionales y envíalos a Orlando. Si es un trabajo de todos los días, márcalo como Daily para no volver a escribirlo.'}
          </p>
        </div>
        <div className="extra-projects-summary" aria-live="polite">
          <strong>{filtered.length}</strong>
          <span>registro{filtered.length === 1 ? '' : 's'}</span>
          {canEditAll && pendingExtraProjects.length > 0 && (
            <>
              <strong>{pendingExtraProjects.length}</strong>
              <span>por aprobar</span>
            </>
          )}
          {totalMinutes > 0 && (
            <>
              <strong>{formatHoursMinutes(totalMinutes)}</strong>
              <span>registradas</span>
            </>
          )}
        </div>
      </header>

      {myDailyExtraTemplates.length > 0 && (
        <section className="extra-daily" aria-label="Trabajos Daily">
          <div className="extra-daily-head">
            <h3>Daily · trabajos repetitivos</h3>
            <p>Un toque registra el de hoy con el nombre, notas y horas guardados.</p>
          </div>
          <ul className="extra-daily-list">
            {myDailyExtraTemplates.map((t) => (
              <li key={t.id} className="extra-daily-card">
                <div className="extra-daily-card-main">
                  <strong>{t.projectName}</strong>
                  <span className="extra-daily-meta">
                    {t.defaultMinutes
                      ? formatHoursMinutes(t.defaultMinutes)
                      : 'Sin horas fijas'}
                    {t.employeeNames.length > 1
                      ? ` · ${t.employeeNames.join(', ')}`
                      : ''}
                    {canEditAll && t.ownerName ? ` · ${t.ownerName}` : ''}
                  </span>
                  {t.notes && <p className="extra-daily-notes">{t.notes}</p>}
                </div>
                <div className="extra-daily-actions">
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={() => handleUseDailyToday(t)}
                  >
                    Registrar hoy
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => fillFromDaily(t)}
                  >
                    Editar y enviar
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm extra-projects-delete"
                    onClick={() => void handleRemoveDaily(t)}
                  >
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEditAll && pendingExtraProjects.length > 0 && (
        <section className="extra-projects-approval" aria-label="Por aprobar">
          <h3>
            Por aprobar
            <span className="extra-projects-badge">{pendingExtraProjects.length}</span>
          </h3>
          <ul className="extra-projects-approval-list">
            {pendingExtraProjects.map((e) => (
              <li key={e.id} className="extra-projects-approval-card">
                <div className="extra-projects-row-main">
                  <strong>{e.projectName}</strong>
                  <span className="extra-projects-row-meta">
                    {e.employeeNames?.join(', ') || e.employeeName}
                    {' · '}
                    Compromiso: {formatShortDate(e.doneDate)}
                    {e.minutes ? ` · ${formatHoursMinutes(e.minutes)}` : ''}
                  </span>
                  {e.notes && <p className="extra-projects-row-notes">{e.notes}</p>}
                </div>
                <div className="extra-projects-row-actions">
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={() => handleApprove(e)}
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      setRejectingId(e.id);
                      setRejectReason('');
                    }}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="extra-projects-form" onSubmit={handleSubmit}>
        <h3>{editingId ? 'Editar registro' : 'Enviar proyecto extra'}</h3>
        <div className="extra-projects-form-grid">
          <label>
            Nombre del proyecto
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Landing Black Friday"
              maxLength={120}
              required
            />
          </label>
          <div className="extra-projects-collaborators">
            <span>Colaboradores</span>
            <small>Elige una o varias personas (por ejemplo, Yared y Andrea).</small>
            <EmployeeMultiSelect
              assignable={assignable}
              values={employeeIds}
              onChange={setEmployeeIds}
            />
          </div>
          <label>
            Horas invertidas (opcional)
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Ej. 3.5"
              inputMode="decimal"
            />
          </label>
          <label>
            Fecha de compromiso
            <input
              type="date"
              value={doneDate}
              onChange={(e) => setDoneDate(e.target.value)}
              required
            />
          </label>
          <label className="extra-projects-notes">
            Notas (opcional)
            <SpellCheckTextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cliente, herramientas, detalle… Escribe todo lo que necesites."
              rows={5}
            />
          </label>
        </div>
        {!editingId && (
          <label className="extra-daily-toggle">
            <input
              type="checkbox"
              checked={saveAsDaily}
              onChange={(e) => setSaveAsDaily(e.target.checked)}
            />
            <span>
              <strong>Es un Daily</strong>
              <small>
                Trabajo repetitivo: se guarda el nombre, notas y horas para no volver a
                escribirlos cada día.
              </small>
            </span>
          </label>
        )}

        <div className="extra-projects-form-actions">
          {editingId && (
            <button type="button" className="btn-ghost" onClick={resetForm}>
              Cancelar
            </button>
          )}
          <button type="submit" className="btn-primary">
            {editingId
              ? canEditAll
                ? 'Guardar cambios'
                : 'Guardar y reenviar'
              : canEditAll
                ? saveAsDaily
                  ? '+ Registrar y guardar Daily'
                  : '+ Agregar a Activos'
                : saveAsDaily
                  ? 'Enviar y guardar como Daily'
                  : 'Enviar a aprobación'}
          </button>
        </div>
      </form>

      {grouped.length === 0 ? (
        <p className="extra-projects-empty">
          {q
            ? 'Nada coincide con la búsqueda.'
            : 'Aún no hay proyectos extra. Envía el primero arriba.'}
        </p>
      ) : (
        <div className="extra-projects-groups">
          {grouped.map(([employeeId, group]) => {
            const groupMinutes = group.items.reduce(
              (sum, item) => sum + (item.minutes ?? 0),
              0,
            );
            return (
              <section key={employeeId} className="extra-projects-group">
                <header className="extra-projects-group-head">
                  <h3>{group.name}</h3>
                  <span>
                    {group.items.length}
                    {groupMinutes > 0
                      ? ` · ${formatHoursMinutes(groupMinutes)}`
                      : ''}
                  </span>
                </header>
                <ul className="extra-projects-list">
                  {group.items.map((e) => {
                    const status = extraStatus(e);
                    return (
                      <li
                        key={`${employeeId}-${e.id}`}
                        className={`extra-projects-row extra-projects-row--${status}`}
                      >
                        <div className="extra-projects-row-main">
                          <div className="extra-projects-row-title">
                            <strong>{e.projectName}</strong>
                            <span
                              className={`extra-status-chip extra-status-chip--${status}`}
                            >
                              {STATUS_LABEL[status]}
                            </span>
                          </div>
                          <span className="extra-projects-row-meta">
                            Compromiso: {formatShortDate(e.doneDate)}
                            {e.minutes
                              ? ` · ${formatHoursMinutes(e.minutes)}`
                              : ''}
                            {(e.employeeNames?.length ?? 0) > 1
                              ? ` · ${e.employeeNames!.join(', ')}`
                              : ''}
                            {canEditAll && e.employeeId !== user?.employeeId
                              ? ` · ${e.employeeName}`
                              : ''}
                          </span>
                          {e.notes && (
                            <p className="extra-projects-row-notes">{e.notes}</p>
                          )}
                          {status === 'rejected' && e.rejectReason && (
                            <p className="extra-projects-reject-reason">
                              Motivo: {e.rejectReason}
                            </p>
                          )}
                        </div>
                        <div className="extra-projects-row-actions">
                          {canEditAll && status === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="btn-primary btn-sm"
                                onClick={() => handleApprove(e)}
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                className="btn-ghost btn-sm"
                                onClick={() => {
                                  setRejectingId(e.id);
                                  setRejectReason('');
                                }}
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          {canEditEntry(e) && (
                            <>
                              <button
                                type="button"
                                className="btn-ghost btn-sm"
                                onClick={() => startEdit(e)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn-ghost btn-sm extra-projects-delete"
                                onClick={() => void handleDelete(e)}
                              >
                                Borrar
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {rejectingId && (
        <div className="extra-reject-overlay" role="presentation">
          <div className="extra-reject-panel" role="dialog" aria-modal="true">
            <h3>¿Por qué rechazas este extra?</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Opcional: indica qué debe corregir el colaborador"
            />
            <div className="extra-reject-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason('');
                }}
              >
                Volver
              </button>
              <button type="button" className="btn-danger" onClick={confirmReject}>
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
