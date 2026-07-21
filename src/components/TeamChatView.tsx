import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import type { TeamChatMessage, UserRole } from '../types';
import './TeamChatView.css';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  lider: 'Líder',
  empleado: 'Equipo',
};

function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function ChatAvatar({ message }: { message: TeamChatMessage }) {
  if (message.authorAvatarUrl) {
    return (
      <img
        className="team-chat-avatar"
        src={message.authorAvatarUrl}
        alt=""
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="team-chat-avatar team-chat-avatar--fallback"
      style={{ background: message.authorAvatarColor }}
      aria-hidden
    >
      {initials(message.authorName)}
    </span>
  );
}

export function TeamChatView() {
  const { user, chatMessages, sendChatMessage, deleteChatMessage, syncOnline } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  const sortedMessages = useMemo(
    () => [...chatMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [chatMessages],
  );

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [sortedMessages.length]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      toast.error('Escribe un mensaje antes de enviarlo.');
      return;
    }
    sendChatMessage(text);
    setDraft('');
  };

  return (
    <section className="team-chat-view" aria-label="Chat de ayuda del equipo">
      <header className="team-chat-hero">
        <div>
          <span className="team-chat-badge">Chat de ayuda</span>
          <h2>Comunicación del equipo</h2>
          <p>
            Un espacio rápido para pedir apoyo, avisar bloqueos o coordinar entregas entre todos.
          </p>
        </div>
        <div className={`team-chat-status ${syncOnline ? 'is-online' : 'is-local'}`}>
          <span aria-hidden />
          {syncOnline ? 'Sincronizado' : 'Guardando local'}
        </div>
      </header>

      <div className="team-chat-panel">
        <div className="team-chat-list" ref={listRef}>
          {sortedMessages.length === 0 ? (
            <div className="team-chat-empty">
              <strong>Aún no hay mensajes.</strong>
              <p>Escribe el primero para abrir la conversación del equipo.</p>
            </div>
          ) : (
            sortedMessages.map((message) => {
              const isMine = message.authorId === user?.id;
              const canDelete = isMine || user?.role === 'admin';
              return (
                <article
                  key={message.id}
                  className={`team-chat-message ${isMine ? 'team-chat-message--mine' : ''}`}
                >
                  <ChatAvatar message={message} />
                  <div className="team-chat-bubble">
                    <header>
                      <div>
                        <strong>{message.authorName}</strong>
                        <span>{ROLE_LABELS[message.authorRole]}</span>
                      </div>
                      <time dateTime={message.createdAt}>{formatChatTime(message.createdAt)}</time>
                    </header>
                    <p>{message.text}</p>
                    {canDelete && (
                      <button
                        type="button"
                        className="team-chat-delete"
                        onClick={() => deleteChatMessage(message.id)}
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        <form className="team-chat-compose" onSubmit={handleSubmit}>
          <label htmlFor="team-chat-draft">Mensaje para todos</label>
          <div className="team-chat-compose-row">
            <textarea
              id="team-chat-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Escribe un aviso, duda o petición de apoyo..."
              maxLength={1000}
              rows={3}
            />
            <button type="submit" className="btn-primary">
              Enviar
            </button>
          </div>
          <span className="team-chat-count">{draft.length}/1000</span>
        </form>
      </div>
    </section>
  );
}
