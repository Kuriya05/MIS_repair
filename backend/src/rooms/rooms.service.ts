import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import type { RequestStatus } from '../../generated/prisma/enums';
import type { CategoryIcon } from '../categories/categories.dto';
import { BuildingsDirectory, buildingRefOf, type BuildingRef } from '../directory/buildings-directory';
import { PrismaService } from '../prisma/prisma.service';
import { OPEN_STATUSES } from '../repair-requests/sla';
import { ImageStorage, type UploadedImage } from '../repair-images/image-storage';
import { conflict, notFound, validationError } from '../shared/errors';
import type {
  CreateEquipmentDto,
  EquipmentInventoryDto,
  ListEquipmentQueryDto,
  CreateRoomDto,
  EquipmentDetailDto,
  EquipmentDto,
  EquipmentState,
  ListRoomsQueryDto,
  OpenRequestRefDto,
  QrTargetDto,
  RoomDetailDto,
  RoomDto,
  RoomStateSummaryDto,
  UpdateEquipmentDto,
  UpdateRoomDto,
} from './rooms.dto';

/** ตัวอักษรที่อ่านบนสติกเกอร์ไม่สับสน (ไม่มี I O 0 1) — ต้องตรงกับ CHECK *_qr_code_check */
export const QR_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const QR_CODE_LENGTH = 8;

export function randomQrCode() {
  let code = '';
  for (let i = 0; i < QR_CODE_LENGTH; i++) code += QR_CODE_ALPHABET[randomInt(QR_CODE_ALPHABET.length)];
  return code;
}

/** รูปห้อง/รูปเครื่องต่อไฟล์ไม่เกิน 5 MB (ชนิดไฟล์ตรวจจาก magic bytes ใน ImageStorage) */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** ทะเบียนครุภัณฑ์ส่งได้ครั้งละไม่เกินเท่านี้ (ไม่แบ่งหน้า) */
export const INVENTORY_LIMIT = 2000;

/** ตรวจไฟล์ในช่อง photo ก่อนส่งให้ ImageStorage ตรวจชนิดจาก magic bytes */
export function assertPhotoFile(file: UploadedImage | undefined): asserts file is UploadedImage {
  if (!file) throw validationError(['photo: กรุณาเลือกรูป']);
  if (file.size > MAX_PHOTO_BYTES) throw validationError(['photo: รูปต้องไม่เกิน 5 MB']);
}

/** URL รูป (origin เดียวกับหน้าเว็บ) — ?v= เปลี่ยนทุกครั้งที่แก้ไข เบราว์เซอร์จึง cache ได้ยาว · null = ยังไม่มีรูป */
export function photoUrlOf(
  kind: 'rooms' | 'equipment',
  row: { id: string; photoFilename: string | null; updatedAt: Date },
) {
  if (!row.photoFilename) return null;
  return `/api/v1/${kind}/${row.id}/photo?v=${row.updatedAt.getTime()}`;
}

/** เงื่อนไขของทะเบียนครุภัณฑ์ (GET /v1/equipment) */
export function inventoryWhere(query: ListEquipmentQueryDto): Prisma.EquipmentWhereInput {
  return {
    ...(query.roomId && { roomId: query.roomId }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.buildingCode && { room: { buildingCode: query.buildingCode } }),
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.q && {
      OR: [
        { label: { contains: query.q, mode: 'insensitive' as const } },
        { name: { contains: query.q, mode: 'insensitive' as const } },
        { assetNumber: { contains: query.q, mode: 'insensitive' as const } },
      ],
    }),
  };
}

const mimeTypeOf = (filename: string) => {
  const extension = filename.split('.').pop();
  return extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
};

/** ใบที่ยังไม่ปิด → สถานะที่แสดงบนการ์ดเครื่อง */
export function stateOf(status: RequestStatus | undefined): EquipmentState {
  switch (status) {
    case undefined:
      return 'OK';
    case 'PENDING':
      return 'REPORTED';
    case 'ON_HOLD':
      return 'ON_HOLD';
    default:
      return 'IN_PROGRESS';
  }
}

const openRequestSelect = {
  where: { status: { in: [...OPEN_STATUSES] } },
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  select: {
    id: true,
    code: true,
    status: true,
    equipment: true,
    createdAt: true,
    _count: { select: { followers: true } },
  },
} as const satisfies Prisma.Equipment$requestsArgs;

const equipmentInclude = {
  category: { select: { id: true, name: true, icon: true, symptoms: true } },
  requests: { ...openRequestSelect, take: 1 },
} as const satisfies Prisma.EquipmentInclude;

type EquipmentRow = Prisma.EquipmentGetPayload<{ include: typeof equipmentInclude }>;
type OpenRequestRow = EquipmentRow['requests'][number];

const toOpenRequest = (row: OpenRequestRow): OpenRequestRefDto => ({
  id: row.id,
  code: row.code,
  status: row.status,
  equipment: row.equipment,
  createdAt: row.createdAt.toISOString(),
  affectedCount: row._count.followers + 1,
});

function toEquipmentDto(row: EquipmentRow): EquipmentDto {
  const open = row.requests[0];
  return {
    id: row.id,
    roomId: row.roomId,
    label: row.label,
    name: row.name,
    assetNumber: row.assetNumber,
    specs: row.specs,
    position: row.position,
    qrCode: row.qrCode,
    isActive: row.isActive,
    photoUrl: photoUrlOf('equipment', row),
    category: { ...row.category, icon: row.category.icon as CategoryIcon },
    state: stateOf(open?.status),
    openRequest: open ? toOpenRequest(open) : null,
  };
}

function summarize(equipment: EquipmentDto[]): RoomStateSummaryDto {
  const active = equipment.filter((item) => item.isActive);
  const count = (state: EquipmentState) => active.filter((item) => item.state === state).length;
  return {
    total: active.length,
    ok: count('OK'),
    reported: count('REPORTED'),
    inProgress: count('IN_PROGRESS'),
    onHold: count('ON_HOLD'),
  };
}

/** label "PC" + count 3 → PC-01, PC-02, PC-03 (เริ่มต่อจากเลขที่มีอยู่แล้วในห้อง) */
function sequentialLabels(prefix: string, count: number, taken: Set<string>) {
  const labels: string[] = [];
  const width = Math.max(2, String(count + taken.size).length);
  for (let n = 1; labels.length < count; n++) {
    const label = `${prefix}-${String(n).padStart(width, '0')}`;
    if (!taken.has(label)) labels.push(label);
  }
  return labels;
}

/**
 * ห้องและเครื่องในห้อง — ผู้ดูแลระบบแจ้งซ่อมเพิ่มเอง (ห้องอ้างอาคารของ Core Hub ด้วย code)
 * ทุกคนดูได้ พร้อมสถานะของแต่ละเครื่องจากใบแจ้งซ่อมที่ยังไม่ปิด
 */
@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly buildings: BuildingsDirectory,
    private readonly storage: ImageStorage,
  ) {}

  async list(query: ListRoomsQueryDto, token: string): Promise<RoomDto[]> {
    const rows = await this.prisma.room.findMany({
      where: {
        ...(query.buildingCode && { buildingCode: query.buildingCode }),
        ...(query.roomType && { roomType: query.roomType }),
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.q && {
          OR: [
            { code: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        equipment: {
          include: equipmentInclude,
          orderBy: [{ category: { sortOrder: 'asc' } }, { label: 'asc' }],
        },
        _count: { select: { requests: { where: { status: { in: [...OPEN_STATUSES] } } } } },
      },
      orderBy: [{ buildingCode: 'asc' }, { floor: { sort: 'asc', nulls: 'last' } }, { code: 'asc' }],
    });
    const refs = await this.buildings.refs(
      rows.map((row) => row.buildingCode),
      token,
    );
    return rows.map((row) => {
      const equipment = row.equipment.map(toEquipmentDto);
      return this.roomView(row, refs, summarize(equipment), row._count.requests);
    });
  }

  async get(id: string, token: string): Promise<RoomDetailDto> {
    const row = await this.prisma.room.findUnique({
      where: { id },
      include: {
        equipment: {
          include: equipmentInclude,
          orderBy: [{ category: { sortOrder: 'asc' } }, { label: 'asc' }],
        },
        requests: { ...openRequestSelect, where: { ...openRequestSelect.where, equipmentId: null } },
        _count: { select: { requests: { where: { status: { in: [...OPEN_STATUSES] } } } } },
      },
    });
    if (!row) throw notFound('ไม่พบห้องนี้ อาจถูกลบไปแล้ว');
    const refs = await this.buildings.refs([row.buildingCode], token);
    const equipment = row.equipment.map(toEquipmentDto);
    return {
      ...this.roomView(row, refs, summarize(equipment), row._count.requests),
      equipment,
      roomRequests: row.requests.map(toOpenRequest),
    };
  }

  async create(dto: CreateRoomDto, token: string): Promise<RoomDetailDto> {
    await this.assertBuilding(dto.buildingCode, token);
    await this.assertCodeFree(dto.code);
    const row = await this.withQrCode((qrCode) =>
      this.prisma.room.create({
        data: {
          buildingCode: dto.buildingCode,
          code: dto.code,
          name: dto.name,
          floor: dto.floor ?? null,
          description: dto.description ?? null,
          roomType: dto.roomType ?? 'LAB',
          capacity: dto.capacity ?? null,
          qrCode,
        },
      }),
    );
    return this.get(row.id, token);
  }

  async update(id: string, dto: UpdateRoomDto, token: string): Promise<RoomDetailDto> {
    await this.mustRoom(id);
    if (dto.buildingCode) await this.assertBuilding(dto.buildingCode, token);
    if (dto.code) await this.assertCodeFree(dto.code, id);
    await this.prisma.room.update({
      where: { id },
      data: {
        ...(dto.buildingCode !== undefined && { buildingCode: dto.buildingCode }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.floor !== undefined && { floor: dto.floor }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.roomType !== undefined && { roomType: dto.roomType }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return this.get(id, token);
  }

  /** ลบได้เฉพาะห้องที่ไม่มีเครื่องและไม่มีใบแจ้งซ่อม — ที่ใช้แล้วให้ปิดการใช้งานแทน */
  async remove(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { _count: { select: { equipment: true, requests: true } } },
    });
    if (!room) throw notFound('ไม่พบห้องนี้ อาจถูกลบไปแล้ว');
    if (room._count.equipment > 0 || room._count.requests > 0) {
      throw conflict(
        `ห้องนี้มีเครื่อง ${room._count.equipment} เครื่อง และใบแจ้งซ่อม ${room._count.requests} ใบ ให้ปิดการใช้งานแทนการลบ`,
      );
    }
    await this.prisma.room.delete({ where: { id } });
    return { id, deleted: true as const };
  }

  /** เพิ่มเครื่องในห้อง — ใส่ count เพื่อเพิ่มหลายเครื่องพร้อมกัน (ป้าย <label>-01 …) */
  async addEquipment(roomId: string, dto: CreateEquipmentDto, token: string): Promise<RoomDetailDto> {
    await this.mustRoom(roomId);
    await this.assertCategory(dto.categoryId);
    const existing = await this.prisma.equipment.findMany({ where: { roomId }, select: { label: true } });
    const taken = new Set(existing.map((item) => item.label));
    const labels = dto.count ? sequentialLabels(dto.label, dto.count, taken) : [dto.label];
    const duplicate = labels.find((label) => taken.has(label));
    if (duplicate) throw validationError([`label: ในห้องนี้มีเครื่องป้าย ${duplicate} อยู่แล้ว`]);

    for (const label of labels) {
      await this.withQrCode((qrCode) =>
        this.prisma.equipment.create({
          data: {
            roomId,
            categoryId: dto.categoryId,
            label,
            name: dto.name,
            assetNumber: dto.count ? null : (dto.assetNumber ?? null),
            specs: dto.specs ?? null,
            position: dto.count ? null : (dto.position ?? null),
            qrCode,
          },
        }),
      );
    }
    return this.get(roomId, token);
  }

  async getEquipment(id: string, token: string): Promise<EquipmentDetailDto> {
    const row = await this.prisma.equipment.findUnique({
      where: { id },
      include: {
        ...equipmentInclude,
        room: { select: { id: true, code: true, name: true, floor: true, buildingCode: true } },
      },
    });
    if (!row) throw notFound('ไม่พบเครื่องนี้ อาจถูกลบไปแล้ว');
    const [history, refs] = await Promise.all([
      this.prisma.repairRequest.findMany({
        where: { equipmentId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        select: { id: true, code: true, status: true, description: true, createdAt: true, completedAt: true },
      }),
      this.buildings.refs([row.room.buildingCode], token),
    ]);
    return {
      ...toEquipmentDto(row),
      room: {
        id: row.room.id,
        code: row.room.code,
        name: row.room.name,
        floor: row.room.floor,
        building: buildingRefOf(row.room.buildingCode, refs),
      },
      history: history.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        completedAt: item.completedAt?.toISOString() ?? null,
      })),
    };
  }

  async updateEquipment(id: string, dto: UpdateEquipmentDto, token: string): Promise<EquipmentDetailDto> {
    const current = await this.prisma.equipment.findUnique({ where: { id } });
    if (!current) throw notFound('ไม่พบเครื่องนี้ อาจถูกลบไปแล้ว');
    if (dto.categoryId) await this.assertCategory(dto.categoryId);
    if (dto.roomId) await this.mustRoom(dto.roomId);
    const roomId = dto.roomId ?? current.roomId;
    const label = dto.label ?? current.label;
    if (roomId !== current.roomId || label !== current.label) {
      const clash = await this.prisma.equipment.findFirst({ where: { roomId, label, id: { not: id } } });
      if (clash) throw validationError([`label: ในห้องนี้มีเครื่องป้าย ${label} อยู่แล้ว`]);
    }
    await this.prisma.equipment.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.assetNumber !== undefined && { assetNumber: dto.assetNumber }),
        ...(dto.specs !== undefined && { specs: dto.specs }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.roomId !== undefined && { roomId: dto.roomId }),
      },
    });
    return this.getEquipment(id, token);
  }

  /** ลบเครื่องที่ยังไม่เคยแจ้งซ่อม — ที่มีประวัติแล้วให้ปิดการใช้งาน (ประวัติยังอยู่) */
  async removeEquipment(id: string) {
    const row = await this.prisma.equipment.findUnique({
      where: { id },
      include: { _count: { select: { requests: true } } },
    });
    if (!row) throw notFound('ไม่พบเครื่องนี้ อาจถูกลบไปแล้ว');
    if (row._count.requests > 0) {
      throw conflict(`เครื่องนี้มีประวัติแจ้งซ่อม ${row._count.requests} ใบ ให้ปิดการใช้งานแทนการลบ`);
    }
    await this.prisma.equipment.delete({ where: { id } });
    return { id, deleted: true as const };
  }

  /** ทะเบียนครุภัณฑ์ — เครื่องทุกห้อง (กรองได้) เรียงตามห้อง → ประเภท → ป้าย · ไม่เกิน 2000 แถว */
  async inventory(query: ListEquipmentQueryDto): Promise<EquipmentInventoryDto[]> {
    const rows = await this.prisma.equipment.findMany({
      where: inventoryWhere(query),
      include: {
        ...equipmentInclude,
        room: {
          select: { id: true, code: true, name: true, floor: true, buildingCode: true, roomType: true },
        },
      },
      orderBy: [{ room: { code: 'asc' } }, { category: { sortOrder: 'asc' } }, { label: 'asc' }],
      take: INVENTORY_LIMIT,
    });
    return rows.map((row) => ({ ...toEquipmentDto(row), room: row.room }));
  }

  // -------------------------------------------------------------- photos --

  async setRoomPhoto(id: string, file: UploadedImage | undefined, token: string): Promise<RoomDetailDto> {
    assertPhotoFile(file);
    const room = await this.prisma.room.findUnique({ where: { id }, select: { photoFilename: true } });
    if (!room) throw notFound('ไม่พบห้องนี้ อาจถูกลบไปแล้ว');
    await this.swapPhoto(room.photoFilename, file, async (filename) => {
      const { count } = await this.prisma.room.updateMany({
        where: { id, photoFilename: room.photoFilename },
        data: { photoFilename: filename },
      });
      return count;
    });
    return this.get(id, token);
  }

  async removeRoomPhoto(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id }, select: { photoFilename: true } });
    if (!room) throw notFound('ไม่พบห้องนี้ อาจถูกลบไปแล้ว');
    if (!room.photoFilename) throw notFound('ห้องนี้ยังไม่มีรูปให้ลบ');
    const { count } = await this.prisma.room.updateMany({
      where: { id, photoFilename: room.photoFilename },
      data: { photoFilename: null },
    });
    if (count === 0) throw conflict('มีการเปลี่ยนรูปห้องพร้อมกันอีกหน้าหนึ่ง กรุณาลองอีกครั้ง');
    await this.storage.remove([room.photoFilename]);
    return { id, deleted: true as const };
  }

  async openRoomPhoto(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id }, select: { photoFilename: true } });
    if (!room) throw notFound('ไม่พบห้องนี้ อาจถูกลบไปแล้ว');
    return this.openPhoto(room.photoFilename, 'ห้องนี้ยังไม่มีรูป');
  }

  async setEquipmentPhoto(
    id: string,
    file: UploadedImage | undefined,
    token: string,
  ): Promise<EquipmentDetailDto> {
    assertPhotoFile(file);
    const item = await this.prisma.equipment.findUnique({ where: { id }, select: { photoFilename: true } });
    if (!item) throw notFound('ไม่พบเครื่องนี้ อาจถูกลบไปแล้ว');
    await this.swapPhoto(item.photoFilename, file, async (filename) => {
      const { count } = await this.prisma.equipment.updateMany({
        where: { id, photoFilename: item.photoFilename },
        data: { photoFilename: filename },
      });
      return count;
    });
    return this.getEquipment(id, token);
  }

  async removeEquipmentPhoto(id: string) {
    const item = await this.prisma.equipment.findUnique({ where: { id }, select: { photoFilename: true } });
    if (!item) throw notFound('ไม่พบเครื่องนี้ อาจถูกลบไปแล้ว');
    if (!item.photoFilename) throw notFound('เครื่องนี้ยังไม่มีรูปให้ลบ');
    const { count } = await this.prisma.equipment.updateMany({
      where: { id, photoFilename: item.photoFilename },
      data: { photoFilename: null },
    });
    if (count === 0) throw conflict('มีการเปลี่ยนรูปเครื่องพร้อมกันอีกหน้าหนึ่ง กรุณาลองอีกครั้ง');
    await this.storage.remove([item.photoFilename]);
    return { id, deleted: true as const };
  }

  async openEquipmentPhoto(id: string) {
    const item = await this.prisma.equipment.findUnique({ where: { id }, select: { photoFilename: true } });
    if (!item) throw notFound('ไม่พบเครื่องนี้ อาจถูกลบไปแล้ว');
    return this.openPhoto(item.photoFilename, 'เครื่องนี้ยังไม่มีรูป');
  }

  /** สแกน QR — รหัสของห้องหรือของเครื่อง */
  async resolveQr(code: string): Promise<QrTargetDto> {
    const [room, item] = await Promise.all([
      this.prisma.room.findUnique({ where: { qrCode: code }, select: { id: true } }),
      this.prisma.equipment.findUnique({ where: { qrCode: code }, select: { id: true } }),
    ]);
    if (item) return { kind: 'equipment', id: item.id };
    if (room) return { kind: 'room', id: room.id };
    throw notFound('ไม่พบห้องหรือเครื่องของ QR นี้ สติกเกอร์อาจถูกยกเลิกแล้ว');
  }

  // ------------------------------------------------------------- helpers --

  private roomView(
    row: Prisma.RoomGetPayload<object>,
    refs: Map<string, BuildingRef>,
    equipmentStates: RoomStateSummaryDto,
    openRequestCount: number,
  ): RoomDto {
    return {
      id: row.id,
      buildingCode: row.buildingCode,
      building: buildingRefOf(row.buildingCode, refs),
      code: row.code,
      name: row.name,
      floor: row.floor,
      description: row.description,
      roomType: row.roomType,
      capacity: row.capacity,
      photoUrl: photoUrlOf('rooms', row),
      qrCode: row.qrCode,
      isActive: row.isActive,
      equipmentStates,
      openRequestCount,
    };
  }

  /**
   * เขียนรูปใหม่ (ImageStorage ตรวจ magic bytes) → เปลี่ยนชื่อไฟล์ในฐานข้อมูลแบบมีเงื่อนไข → ลบรูปเดิม
   * ถ้ามีการเปลี่ยนรูปพร้อมกันอีกคำขอ (commit คืน 0) ให้ลบไฟล์ใหม่ทิ้งแล้วตอบ 409
   */
  private async swapPhoto(
    previous: string | null,
    file: UploadedImage,
    commit: (filename: string) => Promise<number>,
  ) {
    const [stored] = await this.storage.save([file]);
    let count: number;
    try {
      count = await commit(stored.filename);
    } catch (error) {
      await this.storage.remove([stored.filename]);
      throw error;
    }
    if (count === 0) {
      await this.storage.remove([stored.filename]);
      throw conflict('มีการเปลี่ยนรูปพร้อมกันอีกหน้าหนึ่ง กรุณาลองอีกครั้ง');
    }
    if (previous) await this.storage.remove([previous]);
  }

  private async openPhoto(filename: string | null, missing: string) {
    if (!filename) throw notFound(missing);
    const file = await this.storage.open(filename);
    if (!file) throw notFound('ไฟล์รูปนี้ไม่อยู่ในที่เก็บแล้ว');
    return { ...file, type: mimeTypeOf(filename) };
  }

  private async mustRoom(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id }, select: { id: true } });
    if (!room) throw notFound('ไม่พบห้องนี้ อาจถูกลบไปแล้ว');
  }

  private async assertBuilding(code: string, token: string) {
    const building = await this.buildings.get(code, token);
    if (!building || !building.isActive) {
      throw validationError(['buildingCode: ไม่พบอาคารนี้ในข้อมูลกลางของ Core Hub หรือถูกปิดใช้งานแล้ว']);
    }
  }

  private async assertCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { isActive: true } });
    if (!category || !category.isActive) throw validationError(['categoryId: ไม่พบประเภทอุปกรณ์ที่เลือก']);
  }

  private async assertCodeFree(code: string, exceptId?: string) {
    const clash = await this.prisma.room.findFirst({
      where: { code, ...(exceptId && { id: { not: exceptId } }) },
      select: { id: true },
    });
    if (clash) throw validationError([`code: มีห้องรหัส ${code} อยู่แล้ว`]);
  }

  /** รหัส QR สุ่มชนกัน (โอกาส 1 ใน 32^8) — สุ่มใหม่ */
  private async withQrCode<T>(create: (qrCode: string) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await create(randomQrCode());
      } catch (error) {
        const clash =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          String(error.meta?.target ?? '').includes('qr_code');
        if (!clash || attempt >= 5) throw error;
      }
    }
  }
}
