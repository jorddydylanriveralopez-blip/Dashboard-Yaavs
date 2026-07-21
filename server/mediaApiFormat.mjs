export function extensionForMime(mimeType, name = '') {
  const lower = (name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg';
  if (lower.endsWith('.webp')) return 'webp';
  if (lower.endsWith('.gif')) return 'gif';
  if (lower.endsWith('.svg')) return 'svg';
  if (lower.endsWith('.avif')) return 'avif';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/svg+xml') return 'svg';
  if (mimeType === 'image/avif') return 'avif';
  return 'bin';
}

export function formatLabelForMime(mimeType, name = '') {
  const ext = extensionForMime(mimeType, name);
  const map = {
    png: 'PNG',
    jpg: 'JPEG',
    jpeg: 'JPEG',
    webp: 'WebP',
    gif: 'GIF',
    svg: 'SVG',
    avif: 'AVIF',
  };
  return map[ext] ?? ext.toUpperCase();
}

export function formatBytesLabel(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function probeImageDimensions(buffer, mimeType) {
  if (!buffer?.length) return { width: null, height: null };

  if (mimeType === 'image/png' && buffer.length >= 24) {
    const sig = buffer.readUInt32BE(0);
    if (sig === 0x89504e47) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }
  }

  if (mimeType === 'image/gif' && buffer.length >= 10) {
    const sig = buffer.toString('ascii', 0, 6);
    if (sig === 'GIF87a' || sig === 'GIF89a') {
      return {
        width: buffer.readUInt16LE(6),
        height: buffer.readUInt16LE(8),
      };
    }
  }

  if (mimeType === 'image/webp' && buffer.length >= 30) {
    const riff = buffer.toString('ascii', 0, 4);
    const webp = buffer.toString('ascii', 8, 12);
    if (riff === 'RIFF' && webp === 'WEBP') {
      const chunk = buffer.toString('ascii', 12, 16);
      if (chunk === 'VP8X' && buffer.length >= 30) {
        const width = 1 + buffer.readUIntLE(24, 3);
        const height = 1 + buffer.readUIntLE(27, 3);
        return { width, height };
      }
    }
  }

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      const len = buffer.readUInt16BE(offset + 2);
      if (len < 2) break;
      offset += 2 + len;
    }
  }

  return { width: null, height: null };
}

export function resolveLibraryImageUrl(url, origin = '') {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (origin || '').replace(/\/$/, '');
  if (!base) return url;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function enrichLibraryItem(item, origin = '') {
  const base = (origin || '').replace(/\/$/, '');
  const extension = extensionForMime(item.mimeType, item.name);
  const format = formatLabelForMime(item.mimeType, item.name);
  const sizeLabel = formatBytesLabel(item.size);
  const width = item.width ?? null;
  const height = item.height ?? null;
  const dimensions =
    width && height ? `${width}×${height}` : null;

  return {
    id: item.id,
    name: item.name,
    url: resolveLibraryImageUrl(item.url, base),
    downloadUrl: base ? `${base}/api/media/download?id=${encodeURIComponent(item.id)}` : null,
    apiUrl: base ? `${base}/api/media/item?id=${encodeURIComponent(item.id)}` : null,
    mimeType: item.mimeType,
    format,
    extension,
    size: item.size,
    sizeLabel,
    width,
    height,
    dimensions,
    uploadedAt: item.uploadedAt,
    uploadedBy: item.uploadedBy,
    uploadedByName: item.uploadedByName,
  };
}

export function buildMediaCatalog(items, origin = '') {
  const base = (origin || '').replace(/\/$/, '');
  const enriched = items.map((item) => enrichLibraryItem(item, base));
  return {
    name: 'Yaavs Image CDN',
    version: '1',
    publicPage: base ? `${base}/almacen` : null,
    listUrl: base ? `${base}/api/media/list` : null,
    count: enriched.length,
    updatedAt: new Date().toISOString(),
    items: enriched,
  };
}
