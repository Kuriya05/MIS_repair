import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { ApiError } from '../shared/errors';
import type { PrismaService } from '../prisma/prisma.service';
import type { PeopleService } from '../core-hub/people.service';
import type { PeopleDirectory } from '../directory/people-directory';
import { ImageStorage } from '../repair-images/image-storage';
import { avatarUrlOf } from './profile.view';
import { MAX_AVATAR_BYTES, ProfilesService } from './profiles.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const file = (buffer: Buffer) => ({ buffer, size: buffer.length, originalname: 'me.png' });
const PROFILE_ID = '5b0c8a4e-6c0f-4d0e-9b1a-2f3e4d5c6b7a';

type Row = { id: string; coreUserId: string; avatarFilename: string | null };

/** Prisma ปลอมเฉพาะส่วนที่ service ใช้ — updateMany มีเงื่อนไขเหมือน UPDATE ... WHERE จริง */
function fakePrisma(row: Row, beforeUpdate?: () => void) {
  return {
    profile: {
      findUnique: async ({ where }: { where: { coreUserId?: string; id?: string } }) =>
        where.coreUserId === row.coreUserId || where.id === row.id ? { ...row } : null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { coreUserId: string; avatarFilename: string | null };
        data: Partial<Row>;
      }) => {
        beforeUpdate?.();
        if (where.coreUserId !== row.coreUserId || where.avatarFilename !== row.avatarFilename)
          return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
  } as unknown as PrismaService;
}

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (error: unknown) =>
      error instanceof ApiError ? `${error.code}: ${error.details?.[0] ?? error.message}` : error,
  );

describe('รูปโปรไฟล์', () => {
  let dir: string;
  let storage: ImageStorage;
  let row: Row;
  let service: ProfilesService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'repair-avatars-'));
    storage = new ImageStorage({ get: () => dir } as unknown as ConfigService);
    row = { id: PROFILE_ID, coreUserId: 'user-002', avatarFilename: null };
    service = new ProfilesService(fakePrisma(row), storage, {} as PeopleService, {} as PeopleDirectory);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('stores the image and exposes a versioned URL', async () => {
    const profile = await service.setAvatar('user-002', file(PNG));
    expect(profile.avatarFilename).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(await readdir(dir)).toEqual([profile.avatarFilename]);
    expect(avatarUrlOf(profile)).toBe(
      `/api/v1/profiles/${PROFILE_ID}/avatar?v=${profile.avatarFilename?.slice(0, 8)}`,
    );
    expect(avatarUrlOf({ id: PROFILE_ID, avatarFilename: null })).toBeNull();
  });

  it('replaces the previous file instead of leaving it behind', async () => {
    const first = await service.setAvatar('user-002', file(PNG));
    const second = await service.setAvatar('user-002', file(JPEG));
    expect(second.avatarFilename).toMatch(/\.jpg$/);
    expect(await readdir(dir)).toEqual([second.avatarFilename]);
    expect(first.avatarFilename).not.toBe(second.avatarFilename);
  });

  it('rejects a missing file, a non-image and anything over 2 MB with Thai messages', async () => {
    expect(await codeOf(service.setAvatar('user-002', undefined))).toBe(
      'VALIDATION_ERROR: avatar: กรุณาเลือกรูปโปรไฟล์',
    );
    expect(await codeOf(service.setAvatar('user-002', file(Buffer.from('<svg/>'))))).toMatch(
      /^VALIDATION_ERROR: .*ไม่ใช่ไฟล์ภาพ/,
    );
    const big = { buffer: PNG, size: MAX_AVATAR_BYTES + 1, originalname: 'big.png' };
    expect(await codeOf(service.setAvatar('user-002', big))).toBe(
      'VALIDATION_ERROR: avatar: รูปโปรไฟล์ต้องไม่เกิน 2 MB',
    );
    expect(await readdir(dir)).toEqual([]);
  });

  it('answers 409 and cleans up when another request changed the avatar first', async () => {
    const racing = new ProfilesService(
      fakePrisma(row, () => {
        row.avatarFilename = '00000000-0000-4000-8000-000000000000.png';
      }),
      storage,
      {} as PeopleService,
      {} as PeopleDirectory,
    );
    expect(await codeOf(racing.setAvatar('user-002', file(PNG)))).toMatch(/^CONFLICT/);
    expect(await readdir(dir)).toEqual([]);
  });

  it('removes the avatar and its file, then 404s when there is nothing to remove', async () => {
    const profile = await service.setAvatar('user-002', file(PNG));
    const result = await service.removeAvatar('user-002');
    expect(result).toEqual({ id: profile.avatarFilename?.split('.')[0], deleted: true });
    expect(row.avatarFilename).toBeNull();
    expect(await readdir(dir)).toEqual([]);
    expect(await codeOf(service.removeAvatar('user-002'))).toMatch(/^NOT_FOUND/);
  });

  it('serves the file with its image type, or 404 when there is none', async () => {
    expect(await codeOf(service.openAvatar(PROFILE_ID))).toMatch(/^NOT_FOUND/);
    await service.setAvatar('user-002', file(PNG));
    const opened = await service.openAvatar(PROFILE_ID);
    expect(opened.type).toBe('image/png');
    expect(opened.size).toBe(PNG.length);
    opened.stream.destroy();
  });
});
