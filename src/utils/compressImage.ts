/** Comprime una imagen a JPEG pequeño (data URL) para poder sincronizarla
    dentro del estado de la app sin inflar el guardado. */

const MAX_DIMENSION = 1000;
const JPEG_QUALITY = 0.72;
/** Si aun comprimida queda más grande que esto, se rechaza. */
const MAX_RESULT_BYTES = 350_000;

export async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Solo se permiten imágenes (JPG, PNG, capturas…).');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Imagen inválida.'));
    el.src = dataUrl;
  });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  if (out.length > MAX_RESULT_BYTES) {
    out = canvas.toDataURL('image/jpeg', 0.5);
  }
  if (out.length > MAX_RESULT_BYTES) {
    throw new Error('La imagen es demasiado grande incluso comprimida. Usa una captura más pequeña.');
  }
  return out;
}
