import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { formatShortDate } from '../utils/formatDate';
import { formatHoursMinutes } from '../utils/projectHours';
import { assignableMarketingTasks } from '../utils/assignmentBrief';
import { EmployeeMultiSelect } from './EmployeeMultiSelect';
import type { ExtraProjectEntry } from '../types';
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

export function ExtraProjectsView({ filter = '' }: { filter?: string }) {
  const {
    user,
    board,
    activeUsers,
    canEditAll,
    visibleExtraProjects,
    addExtraProject,
    updateExtraProject,
    deleteExtraProject,
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
  const [editingId, setEditingId] = useState<string | null>(null);

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
        e.employeeNames?.some((name) => name.toLowerCase().includes(q)) ||
        (e.notes ?? '').toLowerCase().includes(q),
    );
  }, [visibleExtraProjects, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: ExtraProjectEntry[] }>();
    for (const e of filtered) {
      const ids = e.employeeIds?.length ? e.employeeIds : [e.employeeId];
      const names = e.employeeNames?.length ? e.employeeNames : [e.employeeName];
      ids.forEach((employeeId, index) => {
        const name = names[index] ?? e.employeeName;
        const group = map.get(employeeId) ?? { name, items: [] };
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
    setEditingId(null);
  };

  const startEdit = (e: ExtraProjectEntry) => {
    setEditingId(e.id);
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
        toast.success('Proyecto extra actualizado.');
        resetForm();
      } else {
        toast.error('No pudiste editar este registro.');
      }
      return;
    }
    const created = addExtraProject({
      projectName: name.trim(),
      employeeIds,
      minutes: minutes ?? undefined,
      doneDate,
      notes: notes.trim() || undefined,
    });
    if (created) {
      toast.success('Proyecto extra agregado a Activos.');
      resetForm();
    } else {
      toast.error('No se pudo guardar.');
    }
  };

  const handleDelete = async (e: ExtraProjectEntry) => {
    const ok = await confirm({
      title: 'Eliminar proyecto extra',
      message: `¿Borrar «${e.projectName}» de tu bitácora?`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    if (deleteExtraProject(e.id)) {
      toast.success('Eliminado.');
      if (editingId === e.id) resetForm();
    }
  };

  const canEditEntry = (e: ExtraProjectEntry) => {
    const myId = user?.employeeId || user?.id;
    return canEditAll || e.employeeId === myId;
  };

  return (
    <div className="extra-projects">
      <header className="extra-projects-intro">
        <div>
          <h2>Proyectos extra</h2>
          <p>
            Registra trabajos adicionales y elige a todas las personas que participan.
            Al guardarlos aparecerán automáticamente en Proyectos activos.
          </p>
        </div>
        <div className="extra-projects-summary" aria-live="polite">
          <strong>{filtered.length}</strong>
          <span>registro{filtered.length === 1 ? '' : 's'}</span>
          {totalMinutes > 0 && (
            <>
              <strong>{formatHoursMinutes(totalMinutes)}</strong>
              <span>registradas</span>
            </>
          )}
        </div>
      </header>

      <form className="extra-projects-form" onSubmit={handleSubmit}>
        <h3>{editingId ? 'Editar registro' : 'Agregar proyecto extra'}</h3>
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
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cliente, herramientas, detalle…"
              maxLength={240}
            />
          </label>
        </div>
        <div className="extra-projects-form-actions">
          {editingId && (
            <button type="button" className="btn-ghost" onClick={resetForm}>
              Cancelar
            </button>
          )}
          <button type="submit" className="btn-primary">
            {editingId ? 'Guardar cambios' : '+ Agregar a Activos'}
          </button>
        </div>
      </form>

      {grouped.length === 0 ? (
        <p className="extra-projects-empty">
          {q
            ? 'Nada coincide con la búsqueda.'
            : 'Aún no hay proyectos extra. Agrega el primero arriba.'}
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
                  {group.items.map((e) => (
                    <li key={e.id} className="extra-projects-row">
                      <div className="extra-projects-row-main">
                        <strong>{e.projectName}</strong>
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
                        {e.notes && <p className="extra-projects-row-notes">{e.notes}</p>}
                      </div>
                      {canEditEntry(e) && (
                        <div className="extra-projects-row-actions">
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
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
