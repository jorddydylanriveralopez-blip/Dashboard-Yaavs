import { useCallback, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  askAssistantAi,
  buildAssistantSnapshot,
  formatAssistantText,
  getLocalAssistantReply,
  isAiAssistantEnabled,
  type ChatMessage,
} from '../utils/yaavsAssistant';
import './YaavsAssistant.css';

const QUICK_PROMPTS = [
  '¿Qué tengo pendiente?',
  'Proyectos atrasados',
  '¿Cómo entregar un proyecto?',
  'Indicaciones',
];

function newId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function YaavsAssistant() {
  const {
    user,
    canEditAll,
    projects,
    completedProjects,
    myPendingAssignments,
    assignments,
    calendar,
  } = useApp();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '¡Hola! Soy Yaavs Bot 🤖 Pregúntame qué hacer hoy, cómo cerrar un proyecto o qué está atrasado.',
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const aiOn = isAiAssistantEnabled();

  const snapshot = useMemo(() => {
    if (!user) return null;
    return buildAssistantSnapshot(
      user,
      canEditAll,
      projects,
      completedProjects,
      myPendingAssignments,
      assignments,
      calendar,
    );
  }, [
    user,
    canEditAll,
    projects,
    completedProjects,
    myPendingAssignments,
    assignments,
    calendar,
  ]);

  const scrollEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  const reply = useCallback(
    async (text: string) => {
      if (!snapshot || !text.trim()) return;
      const userMsg: ChatMessage = { id: newId(), role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setBusy(true);
      scrollEnd();

      try {
        let answer: string;
        if (aiOn) {
          try {
            answer = await askAssistantAi(text, snapshot, [...messages, userMsg]);
          } catch {
            answer = getLocalAssistantReply(text, snapshot);
            answer +=
              '\n\n_(No pude conectar con la IA; te respondí con el modo guía local.)_';
          }
        } else {
          answer = getLocalAssistantReply(text, snapshot);
        }
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: 'assistant', content: answer },
        ]);
      } finally {
        setBusy(false);
        scrollEnd();
      }
    },
    [snapshot, messages, aiOn, scrollEnd],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    setInput('');
    void reply(t);
  };

  if (!user || !snapshot) return null;

  return (
    <div className={`yaavs-assistant ${open ? 'yaavs-assistant--open' : ''}`}>
      {open && (
        <section className="yaavs-assistant-panel" aria-label="Asistente Yaavs">
          <header className="yaavs-assistant-head">
            <div className="yaavs-assistant-avatar" aria-hidden>
              <span className="yaavs-assistant-face">🤖</span>
              <span className="yaavs-assistant-pulse" />
            </div>
            <div>
              <h2>Yaavs Bot</h2>
              <p>
                {aiOn ? 'Asistente con IA' : 'Guía inteligente'}
                {snapshot.overdueCount > 0 && (
                  <span className="yaavs-assistant-alert">
                    {' '}
                    · {snapshot.overdueCount} con retraso
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              className="btn-icon yaavs-assistant-close"
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
            >
              ×
            </button>
          </header>

          <div className="yaavs-assistant-quick" role="group" aria-label="Preguntas rápidas">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                className="yaavs-assistant-chip"
                disabled={busy}
                onClick={() => void reply(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="yaavs-assistant-messages" ref={listRef}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`yaavs-assistant-bubble yaavs-assistant-bubble--${m.role}`}
              >
                {formatAssistantText(m.content).split('\n').map((line, i) => (
                  <p key={i}>{line || '\u00a0'}</p>
                ))}
              </div>
            ))}
            {busy && (
              <div className="yaavs-assistant-bubble yaavs-assistant-bubble--assistant yaavs-assistant-typing">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <form className="yaavs-assistant-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta sobre tus tareas…"
              disabled={busy}
              autoComplete="off"
            />
            <button type="submit" className="btn-primary" disabled={busy || !input.trim()}>
              Enviar
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="yaavs-assistant-fab"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente Yaavs Bot'}
      >
        <span className="yaavs-assistant-fab-icon" aria-hidden>
          {open ? '✕' : '🤖'}
        </span>
        {!open && snapshot.overdueCount > 0 && (
          <span className="yaavs-assistant-fab-badge">{snapshot.overdueCount}</span>
        )}
      </button>
    </div>
  );
}
