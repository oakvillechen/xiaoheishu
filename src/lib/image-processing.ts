import sharp from 'sharp';

const MAX_WIDTH = 1080;
const MAX_HEIGHT = 1920;

export async function resizeForMobileHighQuality(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 80,
      mozjpeg: true,
    })
    .toBuffer();
}
