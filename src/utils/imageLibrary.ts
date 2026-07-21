import type { FileAttachment, LibraryImage } from '../types';
import { resolveLibraryImageUrl } from '../api/mediaLibrary';

export function libraryImageToAttachment(image: LibraryImage): FileAttachment {
  return {
    id: crypto.randomUUID(),
    name: image.name,
    mimeType: image.mimeType,
    size: image.size,
    dataUrl: resolveLibraryImageUrl(image.url),
    createdAt: new Date().toISOString(),
    libraryAssetId: image.id,
  };
}

export function libraryImagesToAttachments(images: LibraryImage[]): FileAttachment[] {
  return images.map(libraryImageToAttachment);
}

export function filterLibraryImages(images: LibraryImage[], query: string): LibraryImage[] {
  const q = query.trim().toLowerCase();
  if (!q) return images;
  return images.filter(
    (img) =>
      img.name.toLowerCase().includes(q) ||
      img.uploadedByName.toLowerCase().includes(q),
  );
}
