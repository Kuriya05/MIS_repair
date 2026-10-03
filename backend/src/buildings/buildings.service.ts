import { Injectable } from '@nestjs/common';
import { BuildingsDirectory } from '../directory/buildings-directory';
import { PrismaService } from '../prisma/prisma.service';
import { OPEN_STATUSES } from '../repair-requests/sla';
import { badRequest, notFound } from '../shared/errors';
import { Paginated } from '../shared/paginated';
import type { BuildingDto, ListBuildingsQueryDto } from './buildings.dto';

const CODE = /^[A-Z0-9-]{1,50}$/;

/**
 * อาคารเป็นข้อมูลอ้างอิงของ Core Hub — ระบบนี้อ่านอย่างเดียว (reference-data.md ข้อ 8)
 * นับห้อง/เครื่อง/ใบแจ้งซ่อมจากฐานของระบบนี้ · ทุกคนดูได้
 */
@Injectable()
export class BuildingsService {
  constructor(
    private readonly directory: BuildingsDirectory,
    private readonly prisma: PrismaService,
  ) {}

  async list(query: ListBuildingsQueryDto, token: string) {
    const q = query.q?.toLowerCase();
    const rows = (await this.directory.list(token))
      .filter(
        (row) =>
          !q ||
          row.code.toLowerCase().includes(q) ||
          row.nameTh.toLowerCase().includes(q) ||
          (row.nameEn ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => a.code.localeCompare(b.code));
    const page = rows.slice((query.page - 1) * query.limit, query.page * query.limit);
    const counts = await this.counts(page.map((row) => row.code));
    return Paginated.of(
      page.map((row) => this.view(row.code, row.nameTh, row.nameEn, row.isActive, counts)),
      rows.length,
      query.page,
      query.limit,
    );
  }

  async get(code: string, token: string) {
    if (!CODE.test(code)) throw badRequest('รหัสอาคารไม่ถูกต้อง');
    const row = await this.directory.get(code, token);
    if (!row) throw notFound('ไม่พบอาคารนี้ในข้อมูลกลางของ Core Hub');
    return this.view(row.code, row.nameTh, row.nameEn, row.isActive, await this.counts([code]));
  }

  private view(
    code: string,
    name: string,
    nameEn: string | null,
    isActive: boolean,
    counts: Awaited<ReturnType<BuildingsService['counts']>>,
  ): BuildingDto {
    return {
      code,
      name,
      nameEn: nameEn ?? null,
      isActive,
      roomCount: counts.rooms.get(code) ?? 0,
      equipmentCount: counts.equipment.get(code) ?? 0,
      requestCount: counts.requests.get(code) ?? 0,
      openRequestCount: counts.open.get(code) ?? 0,
    };
  }

  private async counts(codes: string[]) {
    const [rooms, requests, open, equipment] = await Promise.all([
      this.prisma.room.groupBy({
        by: ['buildingCode'],
        where: { buildingCode: { in: codes }, isActive: true },
        _count: { _all: true },
      }),
      this.prisma.repairRequest.groupBy({
        by: ['buildingCode'],
        where: { buildingCode: { in: codes } },
        _count: { _all: true },
      }),
      this.prisma.repairRequest.groupBy({
        by: ['buildingCode'],
        where: { buildingCode: { in: codes }, status: { in: [...OPEN_STATUSES] } },
        _count: { _all: true },
      }),
      this.prisma.equipment.findMany({
        where: { isActive: true, room: { buildingCode: { in: codes } } },
        select: { room: { select: { buildingCode: true } } },
      }),
    ]);
    const perBuilding = new Map<string, number>();
    for (const item of equipment) {
      perBuilding.set(item.room.buildingCode, (perBuilding.get(item.room.buildingCode) ?? 0) + 1);
    }
    return {
      rooms: new Map(rooms.map((row) => [row.buildingCode, row._count._all])),
      requests: new Map(requests.map((row) => [row.buildingCode, row._count._all])),
      open: new Map(open.map((row) => [row.buildingCode, row._count._all])),
      equipment: perBuilding,
    };
  }
}
