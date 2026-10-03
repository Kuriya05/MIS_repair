import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OPEN_STATUSES } from '../repair-requests/sla';
import { conflict, notFound } from '../shared/errors';
import { Paginated } from '../shared/paginated';
import { pageArgs } from '../shared/pagination.dto';
import type {
  CategoryDto,
  CategoryIcon,
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from './categories.dto';

const withCounts = {
  _count: {
    select: {
      requests: true,
      equipment: true,
    },
  },
} as const;
type CategoryRow = Prisma.CategoryGetPayload<{ include: typeof withCounts }>;

function toCategoryDto(row: CategoryRow, open: Map<string, number>): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    symptoms: row.symptoms,
    icon: row.icon as CategoryIcon,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    requestCount: row._count.requests,
    openRequestCount: open.get(row.id) ?? 0,
    equipmentCount: row._count.equipment,
  };
}

/** หมวดหมู่งานซ่อม = ประเภทอุปกรณ์ · นับจากใบแจ้งซ่อมจริงของระบบ */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCategoriesQueryDto) {
    const where: Prisma.CategoryWhereInput = {
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: withCounts,
        orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
      }),
      this.prisma.category.count({ where }),
    ]);
    const open = await this.openCounts(rows.map((row) => row.id));
    return Paginated.of(
      rows.map((row) => toCategoryDto(row, open)),
      total,
      query.page,
      query.limit,
    );
  }

  async get(id: string) {
    const row = await this.prisma.category.findUnique({ where: { id }, include: withCounts });
    if (!row) throw notFound('ไม่พบหมวดหมู่นี้ อาจถูกลบไปแล้ว');
    return toCategoryDto(row, await this.openCounts([id]));
  }

  async create(dto: CreateCategoryDto) {
    await this.assertNameFree(dto.name);
    const row = await this.prisma.category.create({
      data: {
        name: dto.name,
        symptoms: dto.symptoms ?? [],
        icon: dto.icon ?? 'other',
        sortOrder: dto.sortOrder ?? 0,
      },
      include: withCounts,
    });
    return toCategoryDto(row, new Map());
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.get(id);
    if (dto.name !== undefined) await this.assertNameFree(dto.name, id);
    const row = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.symptoms !== undefined && { symptoms: dto.symptoms }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: withCounts,
    });
    return toCategoryDto(row, await this.openCounts([id]));
  }

  /** ลบได้เฉพาะหมวดที่ยังไม่มีใบแจ้งซ่อมและไม่มีเครื่องในห้องใดใช้ — ที่ใช้แล้วให้ปิดการใช้งานแทน */
  async remove(id: string) {
    const category = await this.get(id);
    if (category.requestCount > 0 || category.equipmentCount > 0) {
      throw conflict(
        `หมวดหมู่นี้มีใบแจ้งซ่อม ${category.requestCount} รายการ และเครื่อง ${category.equipmentCount} เครื่อง ` +
          'ให้ปิดการใช้งานแทนการลบ',
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { id, deleted: true as const };
  }

  private async openCounts(ids: string[]) {
    const rows = await this.prisma.repairRequest.groupBy({
      by: ['categoryId'],
      where: { categoryId: { in: ids }, status: { in: [...OPEN_STATUSES] } },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.categoryId, row._count._all]));
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const duplicate = await this.prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId && { id: { not: exceptId } }) },
      select: { id: true },
    });
    if (duplicate) throw conflict(`มีหมวดหมู่ชื่อ "${name}" อยู่แล้ว`);
  }
}
