import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { ApiError } from '../shared/errors';
import { ImageStorage, MAX_IMAGE_BYTES, sniffImage } from './image-storage';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
const file = (buffer: Buffer, originalname = 'photo.jpg') => ({ buffer, size: buffer.length, originalname });

describe('image sniffing (magic bytes, not the file name)', () => {
  it('recognises JPEG, PNG and WebP', () => {
    expect(sniffImage(JPEG)?.mimeType).toBe('image/jpeg');
    expect(sniffImage(PNG)?.mimeType).toBe('image/png');
    expect(sniffImage(WEBP)?.mimeType).toBe('image/webp');
  });

  it('rejects anything else, including SVG and HTML renamed to .jpg', () => {
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImage(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });
});

describe('ImageStorage', () => {
  let dir: string;
  let storage: ImageStorage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'repair-images-'));
    storage = new ImageStorage({ get: () => dir } as unknown as ConfigService);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('stores files under random names with the sniffed extension', async () => {
    const stored = await storage.save([file(JPEG), file(PNG, 'scan.jpg')]);
    expect(stored.map((s) => s.mimeType)).toEqual(['image/jpeg', 'image/png']);
    for (const image of stored) expect(image.filename).toMatch(/^[0-9a-f-]{36}\.(jpg|png)$/);
    expect((await readdir(dir)).sort()).toEqual(stored.map((s) => s.filename).sort());
  });

  it('validates every file before writing any (400 VALIDATION_ERROR)', async () => {
    await expect(
      storage.save([file(JPEG), file(Buffer.from('not an image'), 'evil.jpg')]),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(await readdir(dir)).toEqual([]);
  });

  it('refuses oversize, empty and too many files', async () => {
    const big = { buffer: JPEG, size: MAX_IMAGE_BYTES + 1, originalname: 'big.jpg' };
    await expect(storage.save([big])).rejects.toBeInstanceOf(ApiError);
    await expect(storage.save([file(Buffer.alloc(0))])).rejects.toBeInstanceOf(ApiError);
    await expect(storage.save(Array.from({ length: 6 }, () => file(JPEG)))).rejects.toBeInstanceOf(ApiError);
  });

  it('opens stored files and ignores path traversal in names', async () => {
    const [stored] = await storage.save([file(JPEG)]);
    const opened = await storage.open(stored.filename);
    expect(opened?.size).toBe(JPEG.length);
    opened?.stream.destroy();
    expect(await storage.open(`../../${stored.filename}`)).not.toBeNull();
    expect(await storage.open('../package.json')).toBeNull();
  });
});
