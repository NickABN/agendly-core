import sharp from 'sharp';

export interface ProcessImageOptions {
  maxWidth: number;
  maxHeight: number;
  /** WebP quality 1-100 */
  quality: number;
}

export interface ProcessedImage {
  buffer: Buffer;
  contentType: 'image/webp';
  width: number;
  height: number;
}

/** Presets por tipo de imagen: resolución suficiente para su uso real, peso mínimo. */
export const IMAGE_PRESETS = {
  logo: { maxWidth: 512, maxHeight: 512, quality: 82 },
  banner: { maxWidth: 1600, maxHeight: 900, quality: 80 },
} as const satisfies Record<string, ProcessImageOptions>;

/**
 * Optimiza una imagen antes de subirla al storage:
 * - respeta la orientación EXIF (rotate sin argumentos),
 * - reduce dimensiones sin agrandar ni deformar (fit inside),
 * - convierte a WebP (menos peso que JPEG/PNG sin pérdida visible).
 *
 * Función pura (buffer -> buffer): testeable sin Nest ni red.
 * Lanza si el buffer no es una imagen decodificable.
 */
export async function processImage(
  input: Buffer,
  options: ProcessImageOptions,
): Promise<ProcessedImage> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({
      width: options.maxWidth,
      height: options.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: options.quality })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    contentType: 'image/webp',
    width: info.width,
    height: info.height,
  };
}

/** "Mi Logo Ñandú.PNG" -> "mi-logo-nandu" (base segura para la key del bucket). */
export function safeBaseName(originalName: string): string {
  const withoutExt = originalName.replace(/\.[^.]+$/, '');
  const slug = withoutExt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'imagen';
}
