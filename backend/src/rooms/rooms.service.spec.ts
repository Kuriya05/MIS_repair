import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import type { BuildingsDirectory } from '../directory/buildings-directory';
import type { PrismaService } from '../prisma/prisma.service';
import { ImageStorage } from '../repair-images/image-storage';
import { assertPhotoFile, inventoryWhere, MAX_PHOTO_BYTES, photoUrlOf, RoomsService } from './rooms.service';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const ROOM_ID = '7b0c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3';
const photo = (buffer: Buffer, originalname = 'room.jpg') => ({ buffer, size: buffer.length, originalname });

describe('assertPhotoFile', () => {
  it('requires a file of at most 5 MB', () => {
    expect(() => assertPhotoFile(undefined)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => assertPhotoFile({ buffer: JPEG, size: MAX_PHOTO_BYTES + 1 })).toThrow(
      expect.objectContaining({ details: ['photo: รูปต้องไม่เกิน 5 MB'] }),
    );
    expect(() => assertPhotoFile(photo(JPEG))).not.toThrow();
  });
});

describe('photoUrlOf', () => {
  it('builds a cache-busting URL, or null without a photo', () => {
    const updatedAt = new Date('2026-10-04T09:00:00.000Z');
    expect(photoUrlOf('rooms', { id: ROOM_ID, photoFilename: null, updatedAt })).toBeNull();
    expect(photoUrlOf('equipment', { id: ROOM_ID, photoFilename: 'x.jpg', updatedAt })).toBe(
      `/api/v1/equipment/${ROOM_ID}/photo?v=${updatedAt.getTime()}`,
    );
  });
});

describe('inventoryWhere', () => {
  it('is empty without filters', () => {
    expect(inventoryWhere({})).toEqual({});
  });

  it('combines room, building, category, active and text filters', () => {
    expect(
      inventoryWhere({
        buildingCode: 'CS',
        roomId: ROOM_ID,
        categoryId: 'c0ffee00-0000-4000-8000-000000000000',
        q: 'pc',
        isActive: false,
      }),
    ).toEqual({
      roomId: ROOM_ID,
      categoryId: 'c0ffee00-0000-4000-8000-000000000000',
      room: { buildingCode: 'CS' },
      isActive: false,
      OR: [
        { label: { contains: 'pc', mode: 'insensitive' } },
        { name: { contains: 'pc', mode: 'insensitive' } },
        { assetNumber: { contains: 'pc', mode: 'insensitive' } },
      ],
    });
  });
});

describe('RoomsService room photos', () => {
  let dir: string;
  let storage: ImageStorage;
  let prisma: {
    room: { findUnique: jest.Mock; updateMany: jest.Mock };
  };
  let service: RoomsService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'room-photos-'));
    storage = new ImageStorage({ get: () => dir } as unknown as ConfigService);
    prisma = { room: { findUnique: jest.fn(), updateMany: jest.fn() } };
    service = new RoomsService(prisma as unknown as PrismaService, {} as BuildingsDirectory, storage);
    jest.spyOn(service, 'get').mockResolvedValue({ id: ROOM_ID } as never);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('rejects files whose magic bytes are not JPG/PNG/WebP, writing nothing', async () => {
    prisma.room.findUnique.mockResolvedValue({ photoFilename: null });
    await expect(
      service.setRoomPhoto(ROOM_ID, photo(Buffer.from('<svg/>'), 'evil.jpg'), 'token'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.room.updateMany).not.toHaveBeenCalled();
    expect(await readdir(dir)).toEqual([]);
  });

  it('replaces the old file on upload', async () => {
    prisma.room.findUnique.mockResolvedValue({ photoFilename: null });
    prisma.room.updateMany.mockResolvedValue({ count: 1 });
    await service.setRoomPhoto(ROOM_ID, photo(JPEG), 'token');
    const [first] = await readdir(dir);
    expect(first).toMatch(/\.jpg$/);

    prisma.room.findUnique.mockResolvedValue({ photoFilename: first });
    await service.setRoomPhoto(ROOM_ID, photo(PNG, 'room.png'), 'token');
    const files = await readdir(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.png$/);
    expect(prisma.room.updateMany).toHaveBeenLastCalledWith({
      where: { id: ROOM_ID, photoFilename: first },
      data: { photoFilename: files[0] },
    });
  });

  it('drops the new file and answers 409 when another upload won the race', async () => {
    prisma.room.findUnique.mockResolvedValue({ photoFilename: null });
    prisma.room.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.setRoomPhoto(ROOM_ID, photo(JPEG), 'token')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(await readdir(dir)).toEqual([]);
  });

  it('404s when the room has no photo', async () => {
    prisma.room.findUnique.mockResolvedValue({ photoFilename: null });
    await expect(service.openRoomPhoto(ROOM_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.removeRoomPhoto(ROOM_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
