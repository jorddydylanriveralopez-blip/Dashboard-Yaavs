import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
} from 'react';
import {
  ATTACHMENT_ACCEPT,
  formatAttachmentSize,
  isAllowedFile,
  isImageAttachment,
  isPdfAttachment,
  isVideoAttachment,
  INLINE_ATTACHMENT_MAX_BYTES,
  LIST_LAYOUT_MIN_COUNT,
  MAX_ATTACHMENT_BYTES,
  readFileAsAttachment,
  totalAttachmentsBytes,
} from '../utils/fileAttachments';
import type { FileAttachment } from '../types';
import { deleteAttachmentBlobs } from '../utils/attachmentStore';
import './FileAttachments.css';

interface EditorProps {
  attachments: FileAttachment[];
  onChange: (attachments: FileAttachment[]) => void;
  disabled?: boolean;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

type UploadState = {
  fileName: string;
  progress: number;
  index: number;
  total: number;
};

export function FileAttachmentsEditor({
  attachments,
  onChange,
  disabled,
  onError,
  onSuccess,
}: EditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef(attachments);
  listRef.current = attachments;

  const [busy, setBusy] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (!files.length || disabled) return;

      const allowed = files.filter(isAllowedFile);
      const rejected = files.length - allowed.length;
      if (rejected > 0) {
        onError?.('Solo se permiten imágenes, PDF y videos.');
      }
      if (!allowed.length) return;

      setBusy(true);
      let list = [...listRef.current];
      const addedNames: string[] = [];

      try {
        for (let i = 0; i < allowed.length; i++) {
          const file = allowed[i]!;
          setUploadState({
            fileName: file.name,
            progress: 0,
            index: i + 1,
            total: allowed.length,
          });

          try {
            const att = await readFileAsAttachment(file, (percent) => {
              setUploadState({
                fileName: file.name,
                progress: percent,
                index: i + 1,
                total: allowed.length,
              });
            });
            list = [...list, att];
            listRef.current = list;
            onChange(list);
            addedNames.push(file.name);
          } catch (err) {
            onError?.(
              err instanceof Error ? err.message : `No se pudo adjuntar «${file.name}».`,
            );
          }
        }

        if (addedNames.length === 1) {
          onSuccess?.(`«${addedNames[0]}» adjuntado correctamente`);
        } else if (addedNames.length > 1) {
          onSuccess?.(`${addedNames.length} archivos adjuntos`);
        }
      } finally {
        setUploadState(null);
        setBusy(false);
        setDragOver(false);
      }
    },
    [disabled, onChange, onError, onSuccess],
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    if (files?.length) {
      void processFiles(files).finally(() => {
        input.value = '';
      });
    }
  };

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !busy) setDragOver(true);
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setDragOver(false);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled || busy) return;
    const files = e.dataTransfer.files;
    if (files?.length) void processFiles(files);
  };

  const onZoneClick = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled || busy) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'button, a, label, video, iframe, img, .file-preview-panel, .file-lightbox, .file-upload-btn, input[type="file"]',
      )
    ) {
      return;
    }
    inputRef.current?.click();
  };

  const remove = (id: string) => {
    const removed = listRef.current.find((a) => a.id === id);
    if (removed?.dataUrl.startsWith('blob:')) {
      URL.revokeObjectURL(removed.dataUrl);
    }
    void deleteAttachmentBlobs([id]);
    const next = listRef.current.filter((a) => a.id !== id);
    listRef.current = next;
    onChange(next);
  };

  const count = attachments.length;
  const totalSize = totalAttachmentsBytes(attachments);

  return (
    <div
      className={`file-attachments-editor file-drop-zone ${dragOver ? 'file-drop-zone--active' : ''} ${busy ? 'file-attachments-editor--busy' : ''}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onZoneClick}
      role="region"
      aria-label="Zona para adjuntar archivos"
    >
      <AttachmentStatus count={count} totalSize={totalSize} busy={busy} />

      {busy && uploadState && (
        <div className="file-upload-loader" role="status" aria-live="polite">
          <div className="file-upload-spinner" aria-hidden />
          <div className="file-upload-loader-text">
            <strong>
              Subiendo archivo {uploadState.index} de {uploadState.total}
            </strong>
            <span className="file-upload-loader-name">{uploadState.fileName}</span>
            <div className="file-upload-progress-track">
              <div
                className="file-upload-progress-bar"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
            <span className="file-upload-progress-pct">{uploadState.progress}%</span>
          </div>
        </div>
      )}

      <p className="file-drop-hint">
        {dragOver
          ? 'Suelta los archivos aquí'
          : 'Arrastra imágenes, PDF o videos aquí, o usa el botón'}
      </p>

      {count > 0 && (
        <FileAttachmentsPreview
          attachments={attachments}
          onRemove={disabled || busy ? undefined : remove}
        />
      )}

      <label
        className={`file-upload-btn${disabled || busy ? ' file-upload-btn--disabled' : ''}${busy ? ' file-upload-btn--busy' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="file"
          className="file-attachments-input"
          accept={ATTACHMENT_ACCEPT}
          multiple
          disabled={disabled || busy}
          onChange={handleInputChange}
          tabIndex={-1}
          title=""
        />
        <span className="file-upload-btn__shine" aria-hidden />
        <span className="file-upload-btn__content">
          <span className="file-upload-btn__icon" aria-hidden>
            {busy ? (
              <span className="file-upload-btn__spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 16V4m0 0L8 8m4-4 4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </span>
          <span className="file-upload-btn__labels">
            <strong className="file-upload-btn__title">
              {busy ? 'Subiendo archivos…' : 'Subir archivos'}
            </strong>
            {!busy && (
              <span className="file-upload-btn__subtitle">Toca para elegir desde tu equipo</span>
            )}
          </span>
        </span>
      </label>
      <p className="file-attachments-hint">
        Imágenes, PDF y videos · hasta {formatAttachmentSize(MAX_ATTACHMENT_BYTES)} por archivo ·
        videos grandes (más de {formatAttachmentSize(INLINE_ATTACHMENT_MAX_BYTES)}) se guardan en el
        navegador · lista con 6+ archivos
      </p>
    </div>
  );
}

function AttachmentStatus({
  count,
  totalSize,
  busy,
}: {
  count: number;
  totalSize: number;
  busy?: boolean;
}) {
  if (busy && count === 0) {
    return (
      <p className="file-attachments-status file-attachments-status--loading" role="status">
        <span className="file-upload-spinner file-upload-spinner--inline" aria-hidden />
        Leyendo archivo…
      </p>
    );
  }

  if (count === 0) {
    return (
      <p className="file-attachments-status file-attachments-status--empty" role="status">
        <span className="file-attachments-status-dot" aria-hidden />
        Sin archivos — arrastra aquí o pulsa «Subir archivos»
      </p>
    );
  }

  return (
    <p className="file-attachments-status file-attachments-status--ok" role="status">
      <span className="file-attachments-status-icon" aria-hidden>
        ✓
      </span>
      <strong>
        {count} archivo{count !== 1 ? 's' : ''} guardado{count !== 1 ? 's' : ''}
      </strong>
      <span className="file-attachments-status-meta">
        ({formatAttachmentSize(totalSize)}
        {count >= LIST_LAYOUT_MIN_COUNT ? ' · vista en lista' : ''})
      </span>
    </p>
  );
}

interface ListProps {
  attachments: FileAttachment[];
  compact?: boolean;
  onRemove?: (id: string) => void;
}

export function FileAttachmentsList({ attachments, compact, onRemove }: ListProps) {
  if (attachments.length === 0) return null;
  return (
    <FileAttachmentsPreview attachments={attachments} onRemove={onRemove} compact={compact} />
  );
}

interface PreviewProps {
  attachments: FileAttachment[];
  compact?: boolean;
  onRemove?: (id: string) => void;
}

function FileAttachmentsPreview({ attachments, compact, onRemove }: PreviewProps) {
  const [lightbox, setLightbox] = useState<FileAttachment | null>(null);
  const useListLayout = attachments.length >= LIST_LAYOUT_MIN_COUNT;

  if (useListLayout) {
    return (
      <div
        className={`file-preview-panel file-preview-panel--list ${compact ? 'file-preview-panel-compact' : ''}`}
      >
        <p className="file-preview-panel-title">
          Vista previa — lista ({attachments.length} archivos)
        </p>
        <ul className="file-preview-scroll-list">
          {attachments.map((a) => (
            <PreviewListRow
              key={a.id}
              attachment={a}
              onRemove={onRemove}
              onExpandImage={setLightbox}
            />
          ))}
        </ul>
        {lightbox && isImageAttachment(lightbox.mimeType) && (
          <Lightbox attachment={lightbox} onClose={() => setLightbox(null)} />
        )}
      </div>
    );
  }

  const images = attachments.filter((a) => isImageAttachment(a.mimeType));
  const videos = attachments.filter((a) => isVideoAttachment(a.mimeType));
  const pdfs = attachments.filter((a) => isPdfAttachment(a.mimeType));
  const others = attachments.filter(
    (a) =>
      !isImageAttachment(a.mimeType) &&
      !isVideoAttachment(a.mimeType) &&
      !isPdfAttachment(a.mimeType),
  );

  return (
    <div className={`file-preview-panel ${compact ? 'file-preview-panel-compact' : ''}`}>
      <p className="file-preview-panel-title">Vista previa</p>

      {images.length > 0 && (
        <div className="file-preview-images">
          {images.map((a) => (
            <figure key={a.id} className="file-preview-image-card">
              <button
                type="button"
                className="file-preview-image-btn"
                onClick={() => setLightbox(a)}
                title="Ampliar imagen"
              >
                <img src={a.dataUrl} alt={a.name} />
              </button>
              <figcaption>
                <span className="file-attachment-name">{a.name}</span>
                <span className="file-attachment-size">{formatAttachmentSize(a.size)}</span>
                <a href={a.dataUrl} download={a.name} className="file-preview-download">
                  Descargar
                </a>
              </figcaption>
              {onRemove && (
                <button
                  type="button"
                  className="file-attachment-remove"
                  aria-label={`Quitar ${a.name}`}
                  onClick={() => onRemove(a.id)}
                >
                  ×
                </button>
              )}
            </figure>
          ))}
        </div>
      )}

      {videos.map((a) => (
        <div key={a.id} className="file-preview-video-card">
          <div className="file-preview-video-head">
            <strong>{a.name}</strong>
            <span>{formatAttachmentSize(a.size)}</span>
            <a href={a.dataUrl} download={a.name} className="file-preview-download">
              Descargar video
            </a>
            {onRemove && (
              <button
                type="button"
                className="file-attachment-remove-inline"
                aria-label={`Quitar ${a.name}`}
                onClick={() => onRemove(a.id)}
              >
                ×
              </button>
            )}
          </div>
          <video src={a.dataUrl} controls className="file-preview-video-frame" preload="metadata" />
        </div>
      ))}

      {pdfs.map((a) => (
        <div key={a.id} className="file-preview-pdf-card">
          <div className="file-preview-pdf-head">
            <strong>{a.name}</strong>
            <span>{formatAttachmentSize(a.size)}</span>
            <a href={a.dataUrl} download={a.name} className="file-preview-download">
              Descargar PDF
            </a>
            {onRemove && (
              <button
                type="button"
                className="file-attachment-remove-inline"
                aria-label={`Quitar ${a.name}`}
                onClick={() => onRemove(a.id)}
              >
                ×
              </button>
            )}
          </div>
          <iframe src={a.dataUrl} title={a.name} className="file-preview-pdf-frame" />
        </div>
      ))}

      {others.length > 0 && (
        <ul className="file-attachments-files">
          {others.map((a) => (
            <li key={a.id}>
              <a href={a.dataUrl} download={a.name} className="file-attachment-file-link">
                <span className="file-attachment-file-icon" aria-hidden>
                  📎
                </span>
                <span>
                  <strong>{a.name}</strong>
                  <span className="file-attachment-size">{formatAttachmentSize(a.size)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {lightbox && <Lightbox attachment={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function PreviewListRow({
  attachment: a,
  onRemove,
  onExpandImage,
}: {
  attachment: FileAttachment;
  onRemove?: (id: string) => void;
  onExpandImage: (a: FileAttachment) => void;
}) {
  const isImage = isImageAttachment(a.mimeType);
  const isVideo = isVideoAttachment(a.mimeType);
  const isPdf = isPdfAttachment(a.mimeType);

  return (
    <li className="file-preview-list-row">
      <div className="file-preview-list-thumb">
        {isImage && (
          <button
            type="button"
            className="file-preview-list-thumb-btn"
            onClick={() => onExpandImage(a)}
            title="Ampliar"
          >
            <img src={a.dataUrl} alt="" />
          </button>
        )}
        {isVideo && (
          <span className="file-preview-list-icon" aria-hidden>
            ▶
          </span>
        )}
        {isPdf && (
          <span className="file-preview-list-icon file-preview-list-icon--pdf" aria-hidden>
            PDF
          </span>
        )}
      </div>
      <div className="file-preview-list-body">
        <strong className="file-preview-list-name">{a.name}</strong>
        <span className="file-attachment-size">{formatAttachmentSize(a.size)}</span>
        {isVideo && (
          <video src={a.dataUrl} controls className="file-preview-list-video" preload="metadata" />
        )}
        {isPdf && <iframe src={a.dataUrl} title={a.name} className="file-preview-list-pdf" />}
        <a href={a.dataUrl} download={a.name} className="file-preview-download">
          Descargar
        </a>
      </div>
      {onRemove && (
        <button
          type="button"
          className="file-attachment-remove-inline"
          aria-label={`Quitar ${a.name}`}
          onClick={() => onRemove(a.id)}
        >
          ×
        </button>
      )}
    </li>
  );
}

function Lightbox({
  attachment,
  onClose,
}: {
  attachment: FileAttachment;
  onClose: () => void;
}) {
  return (
    <div className="file-lightbox" role="dialog" aria-label="Vista ampliada" onClick={onClose}>
      <button type="button" className="file-lightbox-close" onClick={onClose} aria-label="Cerrar">
        ×
      </button>
      {isVideoAttachment(attachment.mimeType) ? (
        <video
          src={attachment.dataUrl}
          controls
          autoPlay
          className="file-lightbox-video"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <p className="file-lightbox-caption">{attachment.name}</p>
    </div>
  );
}
