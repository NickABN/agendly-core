import sharp from 'sharp';
import { IMAGE_PRESETS, processImage, safeBaseName } from './image-processor';

/** Genera una imagen sintética PNG de prueba (ruido → no comprime trivial). */
async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      noise: { type: 'gaussian', mean: 128, sigma: 30 },
    },
  })
    .png()
    .toBuffer();
}

describe('processImage', () => {
  it('converts to webp and shrinks an oversized logo to the preset bounds', async () => {
    const input = await makePng(2000, 1200);

    const result = await processImage(input, IMAGE_PRESETS.logo);

    expect(result.contentType).toBe('image/webp');
    expect(result.width).toBeLessThanOrEqual(IMAGE_PRESETS.logo.maxWidth);
    expect(result.height).toBeLessThanOrEqual(IMAGE_PRESETS.logo.maxHeight);
    // El resultado debe pesar bastante menos que el original
    expect(result.buffer.length).toBeLessThan(input.length);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
  });

  it('keeps aspect ratio (fit inside, no deformation)', async () => {
    const input = await makePng(1600, 400); // 4:1

    const result = await processImage(input, IMAGE_PRESETS.logo);

    const ratio = result.width / result.height;
    expect(ratio).toBeCloseTo(4, 1);
  });

  it('does not enlarge images smaller than the preset', async () => {
    const input = await makePng(100, 80);

    const result = await processImage(input, IMAGE_PRESETS.banner);

    expect(result.width).toBe(100);
    expect(result.height).toBe(80);
  });

  it('rejects buffers that are not images', async () => {
    const notAnImage = Buffer.from('esto no es una imagen');

    await expect(processImage(notAnImage, IMAGE_PRESETS.logo)).rejects.toThrow();
  });
});

describe('safeBaseName', () => {
  it('slugifies names with accents, spaces and uppercase', () => {
    expect(safeBaseName('Mi Logo Ñandú.PNG')).toBe('mi-logo-nandu');
  });

  it('strips only the final extension', () => {
    expect(safeBaseName('foto.vacaciones.jpeg')).toBe('foto-vacaciones');
  });

  it('falls back when nothing safe remains', () => {
    expect(safeBaseName('™©®.png')).toBe('imagen');
  });

  it('caps length at 60 chars', () => {
    expect(safeBaseName(`${'a'.repeat(100)}.png`).length).toBeLessThanOrEqual(60);
  });
});
