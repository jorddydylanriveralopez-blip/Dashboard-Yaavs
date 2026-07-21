import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { COMPANY_NAME, MEDIA_CDN_PATH } from '../constants';
import { apiBase, fetchMediaCatalog } from '../api/mediaLibrary';
import type { LibraryImageApiItem, MediaCatalogResponse } from '../types';
import './MediaCdnPage.css';

function copyText(text: string, onDone: () => void) {
  void navigator.clipboard.writeText(text).then(onDone).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    onDone();
  });
}

function ApiLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="media-cdn-api-link">
      <div>
        <span className="media-cdn-api-link-label">{label}</span>
        <code>{url}</code>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => copyText(url, () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        })}
      >
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

function ImageCard({ item }: { item: LibraryImageApiItem }) {
  const [copied, setCopied] = useState<'url' | 'html' | null>(null);

  const htmlSnippet = `<img src="${item.url}" alt="${item.name.replace(/"/g, '&quot;')}" width="${item.width ?? ''}" height="${item.height ?? ''}" />`;

  return (
    <article className="media-cdn-card">
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="media-cdn-card-thumb">
        <img src={item.url} alt={item.name} loading="lazy" />
      </a>
      <div className="media-cdn-card-body">
        <strong title={item.name}>{item.name}</strong>
        <div className="media-cdn-card-tags">
          <span>{item.format}</span>
          <span>{item.sizeLabel}</span>
          {item.dimensions && <span>{item.dimensions}px</span>}
        </div>
        <div className="media-cdn-card-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => copyText(item.url, () => {
              setCopied('url');
              window.setTimeout(() => setCopied(null), 1600);
            })}
          >
            {copied === 'url' ? 'Copiado' : 'Copiar URL'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => copyText(htmlSnippet, () => {
              setCopied('html');
              window.setTimeout(() => setCopied(null), 1600);
            })}
          >
            {copied === 'html' ? 'Copiado' : 'HTML'}
          </button>
          {item.downloadUrl && (
            <a className="btn btn-primary btn-sm" href={item.downloadUrl} download>
              Descargar
            </a>
          )}
        </div>
        <code className="media-cdn-card-url">{item.url}</code>
      </div>
    </article>
  );
}

export function MediaCdnPage() {
  const [catalog, setCatalog] = useState<MediaCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCatalog(await fetchMediaCatalog());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const base = apiBase();
  const publicPage = catalog?.publicPage ?? `${base}${MEDIA_CDN_PATH}`;
  const listUrl = catalog?.listUrl ?? `${base}/api/media/list`;

  const filtered = useMemo(() => {
    const items = catalog?.items ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.format.toLowerCase().includes(q) ||
        item.extension.toLowerCase().includes(q),
    );
  }, [catalog?.items, query]);

  return (
    <div className="media-cdn-page">
      <header className="media-cdn-header">
        <div className="media-cdn-brand">
          <BrandLogo />
          <div>
            <h1>Almacén de imágenes {COMPANY_NAME}</h1>
            <p>CDN público para usar en sitios, apps y programación</p>
          </div>
        </div>
        <a className="btn btn-ghost" href="/inicio">
          Ir al tablero
        </a>
      </header>

      <section className="media-cdn-api-panel">
        <h2>Enlaces para programación</h2>
        <p>Usa estos links en tu código, landing pages, correos o cualquier proyecto.</p>
        <ApiLink label="Página pública" url={publicPage} />
        <ApiLink label="API JSON (catálogo completo)" url={listUrl} />
        <ApiLink label="Detalle de una imagen" url={`${base}/api/media/item?id=ID_DE_IMAGEN`} />
        <ApiLink label="Descargar imagen" url={`${base}/api/media/download?id=ID_DE_IMAGEN`} />

        <details className="media-cdn-example">
          <summary>Ejemplo en JavaScript</summary>
          <pre>{`const res = await fetch('${listUrl}');
const data = await res.json();
// data.items → [{ url, format, sizeLabel, width, height, downloadUrl, ... }]
data.items.forEach((img) => {
  console.log(img.name, img.url, img.format, img.sizeLabel);
});`}</pre>
        </details>

        <details className="media-cdn-example">
          <summary>Ejemplo en HTML</summary>
          <pre>{`<img src="URL_DE_LA_IMAGEN" alt="Descripción" loading="lazy" />`}</pre>
        </details>
      </section>

      <section className="media-cdn-gallery">
        <div className="media-cdn-gallery-toolbar">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o formato…"
            aria-label="Buscar imágenes"
          />
          <span>{filtered.length} imagen{filtered.length === 1 ? '' : 'es'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
            Actualizar
          </button>
        </div>

        {loading ? (
          <p className="media-cdn-empty">Cargando almacén…</p>
        ) : filtered.length === 0 ? (
          <p className="media-cdn-empty">No hay imágenes publicadas todavía.</p>
        ) : (
          <div className="media-cdn-grid">
            {filtered.map((item) => (
              <ImageCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
