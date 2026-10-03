import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { RequestStatus } from '../../generated/prisma/enums';
import type { RepairActor } from '../actor/repair-actor';
import { Permission } from '../auth/permissions';
import { mapCoreRoleToSubsystemRole } from '../auth/role-mapping';
import { effectiveRole } from '../actor/technician';
import { conflict, forbidden, notFound, validationError } from '../shared/errors';
import { Paginated } from '../shared/paginated';
import { pageArgs } from '../shared/pagination.dto';
import { NotificationsService, type NotificationDraft } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { BuildingsDirectory } from '../directory/buildings-directory';
import { PeopleDirectory } from '../directory/people-directory';
import type { NameBook } from '../profiles/profile.view';
import { ProfilesService } from '../profiles/profiles.service';
import {
  ImageStorage,
  MAX_IMAGES_PER_KIND,
  type StoredImage,
  type UploadedImage,
} from '../repair-images/image-storage';
import type {
  AssignRepairRequestDto,
  CancelRepairRequestDto,
  ChangeStatusDto,
  CreateCommentDto,
  CreateRepairRequestDto,
  FollowStateDto,
  ListRepairRequestsQueryDto,
  SimilarRepairRequestDto,
  SimilarRepairRequestsQueryDto,
  RateRepairRequestDto,
  UpdateRepairRequestDto,
} from './repair-requests.dto';
import {
  detailInclude,
  followedBy,
  personSelect,
  summaryInclude,
  toActivityDto,
  toDetailDto,
  toSummaryDto,
} from './repair-requests.mapper';
import { PRIORITY_LABEL } from './labels';
import { formatRequestCode, requestCodePrefix } from './request-code';
import { CLOSED_STATUSES, dueAtFor, OPEN_STATUSES } from './sla';
import {
  ACTION_FOR_STATUS,
  assertCan,
  canFollow,
  canRead,
  STATUS_LABEL,
  type WorkflowSubject,
} from './workflow';

const ORDER_BY: Record<ListRepairRequestsQueryDto['sort'], Prisma.RepairRequestOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
  due: [{ dueAt: 'asc' }, { id: 'asc' }],
  priority: [{ priority: 'desc' }, { dueAt: 'asc' }, { id: 'asc' }],
  updated: [{ updatedAt: 'desc' }, { id: 'desc' }],
};

/** วันที่ YYYY-MM-DD ตามเวลาไทย → จุดเริ่มวันนั้นเป็น UTC */
const bangkokDayStart = (date: string) => new Date(`${date}T00:00:00+07:00`);
const DAY_MS = 86_400_000;

const workflowSelect = {
  id: true,
  code: true,
  equipment: true,
  location: true,
  status: true,
  priority: true,
  rating: true,
  coreUserId: true,
  assigneeCoreUserId: true,
  createdAt: true,
  categoryId: true,
  buildingCode: true,
  category: { select: { name: true } },
} as const satisfies Prisma.RepairRequestSelect;
type WorkflowRow = Prisma.RepairRequestGetPayload<{ select: typeof workflowSelect }>;

const linkOf = (id: string) => `/requests/${id}`;
/** ข้อความแจ้งเตือนเก็บลงฐาน — ใช้ code ของอาคารและ person_code ไม่ใส่ชื่อ (reference-data.md ข้อ 8) */
const placeOf = (row: Pick<WorkflowRow, 'buildingCode' | 'location'>) =>
  `${row.buildingCode} · ${row.location}`;
const personLabel = (personCode: string | null, fallback: string) => personCode ?? fallback;
/** core role ที่ Core Hub ให้ดูข้อมูลบุคคลคนอื่นได้ (reference-data.md ข้อ 2.2) */
const CAN_READ_PEOPLE = new Set(['staff', 'lecturer', 'admin']);

@Injectable()
export class RepairRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageStorage,
    private readonly notifications: NotificationsService,
    private readonly profiles: ProfilesService,
    private readonly people: PeopleDirectory,
    private readonly buildings: BuildingsDirectory,
  ) {}

  // ------------------------------------------------------------- queries --

  async list(user: RepairActor, token: string, query: ListRepairRequestsQueryDto) {
    const where = this.listWhere(user, query);
    const [rows, total] = await Promise.all([
      this.prisma.repairRequest.findMany({
        where,
        include: { ...summaryInclude, followers: followedBy(user.coreUserId) },
        orderBy: ORDER_BY[query.sort],
        ...pageArgs(query),
      }),
      this.prisma.repairRequest.count({ where }),
    ]);
    const now = new Date();
    // รายการไม่หาชื่อบุคคลทีละแถว (แสดง person_code) · ชื่ออาคารมาจาก cache ทั้งชุด
    const buildings = await this.buildings.refs(
      rows.map((row) => row.buildingCode),
      token,
    );
    return Paginated.of(
      rows.map((row) => toSummaryDto(row, user, buildings, now)),
      total,
      query.page,
      query.limit,
    );
  }

  async get(user: RepairActor, token: string, id: string) {
    const row = await this.prisma.repairRequest.findUnique({ where: { id }, include: detailInclude });
    if (!row) throw notFound('ไม่พบใบแจ้งซ่อมนี้ อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง');
    const following = row.followers.some((f) => f.coreUserId === user.coreUserId);
    // ผู้ที่กด "ฉันก็เจอ" อ่านใบนั้นได้เหมือนผู้แจ้ง (แต่ทำ action ของผู้แจ้งไม่ได้)
    if (!canRead(user, row) && !following) throw forbidden('ใบแจ้งซ่อมนี้ไม่ใช่ของคุณ จึงเปิดดูไม่ได้');
    const people = [
      row.reporter,
      row.assignee,
      ...row.images.map((i) => i.uploader),
      ...row.activities.map((a) => a.actor),
    ];
    const [names, buildings] = await Promise.all([
      this.namesFor(
        user,
        token,
        people.flatMap((p) => (p?.personCode ? [p.personCode] : [])),
      ),
      this.buildings.refs([row.buildingCode], token),
    ]);
    return toDetailDto(row, user, names, buildings);
  }

  /**
   * ชื่อจาก Core Hub ตอนแสดงผลด้วย token ของผู้ดู — ไม่เก็บ ไม่ cache (reference-data.md ข้อ 5, 7.3)
   * staff · lecturer · admin ดูชื่อคนอื่นได้ · role อื่นเห็นแค่ชื่อตัวเอง (/people/me) ที่เหลือเป็น person_code
   */
  private async namesFor(user: RepairActor, token: string, personCodes: string[]): Promise<NameBook> {
    if (CAN_READ_PEOPLE.has(user.coreRole)) return this.people.namesForDisplay(personCodes, token);
    if (!user.personCode || !personCodes.includes(user.personCode)) return new Map();
    const me = await this.people.meForDisplay(token);
    return me ? new Map([[me.personCode, me]]) : new Map();
  }

  private listWhere(user: RepairActor, query: ListRepairRequestsQueryDto): Prisma.RepairRequestWhereInput {
    const conditions: Prisma.RepairRequestWhereInput[] = [];

    switch (query.scope) {
      case 'mine':
        conditions.push({
          OR: [{ coreUserId: user.coreUserId }, { followers: { some: { coreUserId: user.coreUserId } } }],
        });
        break;
      case 'assigned':
        if (!user.permissions.has(Permission.REPAIR_JOB_ACCEPT)) {
          throw forbidden('รายการงานที่รับผิดชอบมีเฉพาะช่างซ่อมบำรุง');
        }
        conditions.push({ assigneeCoreUserId: user.coreUserId });
        break;
      case 'all':
        if (!user.permissions.has(Permission.REPAIR_REQUEST_READ_ANY)) {
          throw forbidden('ดูใบแจ้งซ่อมของทุกคนได้เฉพาะช่างและผู้ดูแลระบบ');
        }
        break;
    }

    if (query.status) conditions.push({ status: query.status });
    if (query.state === 'open') conditions.push({ status: { in: [...OPEN_STATUSES] } });
    if (query.state === 'closed') conditions.push({ status: { in: [...CLOSED_STATUSES] } });
    if (query.state === 'overdue')
      conditions.push({ status: { in: [...OPEN_STATUSES] }, dueAt: { lt: new Date() } });
    if (query.priority) conditions.push({ priority: query.priority });
    if (query.buildingCode) conditions.push({ buildingCode: query.buildingCode });
    if (query.categoryId) conditions.push({ categoryId: query.categoryId });
    if (query.assigneeCoreUserId) conditions.push({ assigneeCoreUserId: query.assigneeCoreUserId });
    if (query.from) conditions.push({ createdAt: { gte: bangkokDayStart(query.from) } });
    if (query.to)
      conditions.push({ createdAt: { lt: new Date(bangkokDayStart(query.to).getTime() + DAY_MS) } });
    if (query.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      conditions.push({
        OR: [
          { code: contains },
          { equipment: contains },
          { location: contains },
          { description: contains },
          { assetNumber: contains },
        ],
      });
    }
    return { AND: conditions };
  }

  /**
   * ใบที่ยังเปิดอยู่ในอาคารเดียวกันที่น่าจะเป็นเรื่องเดียวกัน — ฟอร์มแจ้งซ่อมเรียกระหว่างผู้ใช้กรอก
   * ตรงกันเมื่อเลขครุภัณฑ์เดียวกัน หรือห้อง/จุดมีคำเดียวกัน · ไม่ส่งข้อมูลบุคคล (ผู้ใช้ทุกคนเห็นได้เหมือนสติกเกอร์ QR)
   */
  async similar(user: RepairActor, query: SimilarRepairRequestsQueryDto): Promise<SimilarRepairRequestDto[]> {
    const location = query.location && query.location.length >= 2 ? query.location : undefined;
    const matches: Prisma.RepairRequestWhereInput[] = [];
    if (query.assetNumber) matches.push({ assetNumber: { equals: query.assetNumber, mode: 'insensitive' } });
    if (location) matches.push({ location: { contains: location, mode: 'insensitive' } });
    if (matches.length === 0) return [];
    const rows = await this.prisma.repairRequest.findMany({
      where: { buildingCode: query.buildingCode, status: { in: [...OPEN_STATUSES] }, OR: matches },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
      select: {
        id: true,
        code: true,
        equipment: true,
        location: true,
        floor: true,
        assetNumber: true,
        status: true,
        createdAt: true,
        coreUserId: true,
        category: { select: { id: true, name: true } },
        followers: followedBy(user.coreUserId),
        _count: { select: { followers: true } },
      },
    });
    const sameAsset = (asset: string | null) =>
      Boolean(query.assetNumber && asset && asset.toLowerCase() === query.assetNumber.toLowerCase());
    return rows
      .map((row) => ({
        id: row.id,
        code: row.code,
        equipment: row.equipment,
        location: row.location,
        floor: row.floor,
        assetNumber: row.assetNumber,
        category: row.category,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        followerCount: row._count.followers,
        followedByMe: row.followers.length > 0,
        mine: row.coreUserId === user.coreUserId,
        sameAsset: sameAsset(row.assetNumber),
      }))
      .sort((a, b) => Number(b.sameAsset) - Number(a.sameAsset));
  }

  // ------------------------------------------------------------ commands --

  /** "ฉันก็เจอ" — ติดตามใบเดิมแทนการแจ้งซ้ำ · แจ้งช่างว่ามีผู้ได้รับผลกระทบเพิ่ม */
  async follow(user: RepairActor, id: string): Promise<FollowStateDto> {
    const row = await this.load(id);
    const existing = await this.prisma.requestFollower.findUnique({
      where: { repairRequestId_coreUserId: { repairRequestId: id, coreUserId: user.coreUserId } },
    });
    if (!canFollow(user, row, Boolean(existing))) {
      if (row.coreUserId === user.coreUserId) throw conflict('คุณเป็นผู้แจ้งใบนี้อยู่แล้ว');
      if (existing) throw conflict('คุณกด "ฉันก็เจอ" ใบนี้ไว้แล้ว');
      throw conflict(
        `ใบแจ้งซ่อมอยู่ในสถานะ “${STATUS_LABEL[row.status]}” แล้ว — ถ้ายังพบปัญหาให้แจ้งซ่อมใหม่`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.requestFollower.create({ data: { repairRequestId: id, coreUserId: user.coreUserId } });
      await tx.requestActivity.create({
        data: { type: 'FOLLOWED', repairRequestId: id, actorCoreUserId: user.coreUserId },
      });
      const count = await tx.requestFollower.count({ where: { repairRequestId: id } });
      await this.notify(tx, user, [row.assigneeCoreUserId], {
        title: `มีผู้พบปัญหาเดียวกันเพิ่ม (${count + 1} คน) · ${row.code}`,
        message: `${row.equipment} · ${placeOf(row)}`,
        link: linkOf(id),
      });
    });
    return this.followState(user, id);
  }

  /** เลิกติดตาม — ได้เสมอ (เช่น กดผิดใบ) */
  async unfollow(user: RepairActor, id: string): Promise<FollowStateDto> {
    await this.load(id);
    const { count } = await this.prisma.requestFollower.deleteMany({
      where: { repairRequestId: id, coreUserId: user.coreUserId },
    });
    if (count === 0) throw notFound('คุณไม่ได้ติดตามใบแจ้งซ่อมนี้');
    return this.followState(user, id);
  }

  private async followState(user: RepairActor, id: string): Promise<FollowStateDto> {
    const [followerCount, mine] = await Promise.all([
      this.prisma.requestFollower.count({ where: { repairRequestId: id } }),
      this.prisma.requestFollower.count({ where: { repairRequestId: id, coreUserId: user.coreUserId } }),
    ]);
    return { id, followerCount, followedByMe: mine > 0 };
  }

  /** ผู้แจ้ง + ผู้ที่กด "ฉันก็เจอ" — ได้รับการแจ้งเตือนความคืบหน้าเหมือนกัน */
  private async reporters(tx: Prisma.TransactionClient, row: Pick<WorkflowRow, 'id' | 'coreUserId'>) {
    const followers = await tx.requestFollower.findMany({
      where: { repairRequestId: row.id },
      select: { coreUserId: true },
    });
    return [row.coreUserId, ...followers.map((f) => f.coreUserId)];
  }

  /**
   * สถานที่และสิ่งที่ชำรุดของใบใหม่ — จากเครื่อง (เติมให้ทั้งหมด) จากห้อง หรือที่ผู้แจ้งกรอกเอง
   * เครื่องที่มีใบยังไม่ปิดอยู่แล้วแจ้งซ้ำไม่ได้ (409) ให้กด "ฉันก็เจอ" ที่ใบเดิมแทน
   */
  private async placeFor(dto: CreateRepairRequestDto, token: string) {
    const problems: string[] = [];
    if (dto.equipmentId) {
      const item = await this.prisma.equipment.findUnique({
        where: { id: dto.equipmentId },
        include: {
          room: true,
          category: true,
          requests: { where: { status: { in: [...OPEN_STATUSES] } }, take: 1, select: { code: true } },
        },
      });
      if (!item) throw validationError(['equipmentId: ไม่พบเครื่องที่เลือก อาจถูกลบไปแล้ว']);
      if (!item.isActive || !item.room.isActive) {
        throw validationError(['equipmentId: เครื่องนี้ปิดการใช้งานแล้ว แจ้งผู้ดูแลระบบถ้ายังใช้อยู่']);
      }
      if (item.requests[0]) {
        throw conflict(
          `${item.label} มีใบแจ้งซ่อม ${item.requests[0].code} ที่ยังไม่ปิดอยู่แล้ว — กด “ฉันก็เจอ” ที่ใบนั้นแทนการแจ้งซ้ำ`,
        );
      }
      return {
        buildingCode: item.room.buildingCode,
        location: `${item.room.code} ${item.room.name}`,
        floor: item.room.floor,
        categoryId: item.categoryId,
        equipment: `${item.label} · ${item.name}`,
        assetNumber: item.assetNumber ?? dto.assetNumber ?? null,
        roomId: item.roomId,
        equipmentId: item.id,
      };
    }

    const room = dto.roomId ? await this.prisma.room.findUnique({ where: { id: dto.roomId } }) : null;
    if (dto.roomId && (!room || !room.isActive))
      problems.push('roomId: ไม่พบห้องที่เลือก หรือห้องปิดการใช้งานแล้ว');
    const buildingCode = room?.buildingCode ?? dto.buildingCode!;
    const [building, category] = await Promise.all([
      room ? null : this.buildings.get(buildingCode, token),
      this.prisma.category.findUnique({ where: { id: dto.categoryId! } }),
    ]);
    if (!room && !building) problems.push('buildingCode: ไม่พบอาคารที่เลือกในข้อมูลกลางของ Core Hub');
    else if (!room && building && !building.isActive) problems.push('buildingCode: อาคารนี้ปิดใช้งานแล้ว');
    if (!category) problems.push('categoryId: ไม่พบหมวดหมู่ที่เลือก');
    else if (!category.isActive) problems.push('categoryId: หมวดหมู่นี้ปิดใช้งานแล้ว');
    if (problems.length) throw validationError(problems);
    return {
      buildingCode,
      location: room ? `${room.code} ${room.name}${dto.location ? ` · ${dto.location}` : ''}` : dto.location!,
      floor: room ? room.floor : (dto.floor ?? null),
      categoryId: dto.categoryId!,
      equipment: dto.equipment!,
      assetNumber: dto.assetNumber ?? null,
      roomId: room?.id ?? null,
      equipmentId: null,
    };
  }

  async create(user: RepairActor, token: string, dto: CreateRepairRequestDto, files: UploadedImage[]) {
    const place = await this.placeFor(dto, token);

    const stored = await this.storage.save(files);
    try {
      const now = new Date();
      const priority = dto.priority ?? 'MEDIUM';
      const created = await this.withNextCode(now, (code) =>
        this.prisma.$transaction(async (tx) => {
          const request = await tx.repairRequest.create({
            data: {
              code,
              equipment: place.equipment,
              assetNumber: place.assetNumber,
              description: dto.description,
              floor: place.floor,
              location: place.location,
              priority,
              createdAt: now,
              dueAt: dueAtFor(priority, now),
              coreUserId: user.coreUserId,
              buildingCode: place.buildingCode,
              categoryId: place.categoryId,
              roomId: place.roomId,
              equipmentId: place.equipmentId,
              images: { create: this.imageRows(stored, 'BEFORE', user.coreUserId) },
              activities: {
                create: {
                  type: 'CREATED',
                  toStatus: 'PENDING',
                  actorCoreUserId: user.coreUserId,
                  createdAt: now,
                },
              },
            },
          });
          const technicians = await this.profiles.technicians();
          await this.notifications.notify(
            technicians.map((t) => t.coreUserId),
            {
              title: `งานแจ้งซ่อมใหม่ ${code}`,
              message: `${place.equipment} · ${placeOf(place)} · ความเร่งด่วน: ${PRIORITY_LABEL[priority]}`,
              link: linkOf(request.id),
            },
            { exclude: user.coreUserId, db: tx },
          );
          return request;
        }),
      );
      return this.get(user, token, created.id);
    } catch (error) {
      await this.storage.remove(stored.map((image) => image.filename));
      throw error;
    }
  }

  /** เปลี่ยนความเร่งด่วน (คำนวณกำหนดเสร็จใหม่) หรือหมวดหมู่ — ช่างผู้รับผิดชอบ / ผู้ดูแลระบบ */
  async update(user: RepairActor, token: string, id: string, dto: UpdateRepairRequestDto) {
    const row = await this.load(id);
    assertCan(user, row, 'edit');

    const changes: string[] = [];
    const data: Prisma.RepairRequestUncheckedUpdateManyInput = {};
    if (dto.priority && dto.priority !== row.priority) {
      data.priority = dto.priority;
      data.dueAt = dueAtFor(dto.priority, row.createdAt);
      changes.push(`ความเร่งด่วน: ${PRIORITY_LABEL[row.priority]} → ${PRIORITY_LABEL[dto.priority]}`);
    }
    if (dto.categoryId && dto.categoryId !== row.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw validationError(['categoryId: ไม่พบหมวดหมู่ที่เลือก']);
      data.categoryId = category.id;
      changes.push(`หมวดหมู่: ${row.category.name} → ${category.name}`);
    }
    if (changes.length === 0) return this.get(user, token, id);

    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, row, data);
      await tx.requestActivity.create({
        data: {
          type: 'UPDATED',
          message: changes.join(' · '),
          repairRequestId: id,
          actorCoreUserId: user.coreUserId,
        },
      });
    });
    return this.get(user, token, id);
  }

  async cancel(user: RepairActor, token: string, id: string, dto: CancelRepairRequestDto) {
    const row = await this.load(id);
    assertCan(user, row, 'cancel');

    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, row, { status: 'CANCELLED' });
      await this.statusActivity(tx, row, 'CANCELLED', user, dto.reason);
      await this.notify(tx, user, [row.assigneeCoreUserId], {
        title: `ผู้แจ้งยกเลิกงาน ${row.code}`,
        message: `${row.equipment} · ${placeOf(row)}${dto.reason ? ` — เหตุผล: ${dto.reason}` : ''}`,
        link: linkOf(id),
      });
      // คนที่กด "ฉันก็เจอ" อาจยังเจอปัญหาอยู่ — บอกให้แจ้งใหม่ได้
      const followers = (await this.reporters(tx, row)).slice(1);
      await this.notify(tx, user, followers, {
        title: `ผู้แจ้งยกเลิกใบ ${row.code} ที่คุณติดตาม`,
        message: `${row.equipment} · ${placeOf(row)} — ถ้ายังพบปัญหาอยู่ กรุณาแจ้งซ่อมใหม่`,
        link: '/requests/new',
      });
    });
    return this.get(user, token, id);
  }

  /** ช่างรับงานที่ยังไม่มีใครรับ — ถ้ามีคนรับไปก่อนในจังหวะเดียวกัน คนที่สองได้ 409 */
  async accept(user: RepairActor, token: string, id: string) {
    const row = await this.load(id);
    assertCan(user, row, 'accept');
    const actorName = `ช่าง ${personLabel(user.personCode, '')}`.trim();

    await this.prisma.$transaction(async (tx) => {
      await this.transition(
        tx,
        row,
        { status: 'ACCEPTED', assigneeCoreUserId: user.coreUserId, acceptedAt: new Date() },
        'มีช่างคนอื่นรับงานนี้ไปก่อนแล้ว',
      );
      await this.statusActivity(tx, row, 'ACCEPTED', user);
      await this.notify(tx, user, await this.reporters(tx, row), {
        title: 'ช่างรับเรื่องแล้ว',
        message: `${actorName} รับงาน ${row.code} (${row.equipment}) แล้ว`,
        link: linkOf(id),
      });
    });
    return this.get(user, token, id);
  }

  /** ผู้ดูแลระบบมอบหมาย/โอนงานให้ช่าง */
  async assign(user: RepairActor, token: string, id: string, dto: AssignRepairRequestDto) {
    const row = await this.load(id);
    assertCan(user, row, 'assign');

    const assignee = await this.prisma.profile.findUnique({ where: { coreUserId: dto.assigneeCoreUserId } });
    if (!assignee) throw validationError(['assigneeCoreUserId: ไม่พบผู้ใช้นี้ในระบบแจ้งซ่อม']);
    const role = effectiveRole(
      mapCoreRoleToSubsystemRole(assignee.coreRole),
      assignee.coreRole,
      assignee.isTechnician,
    );
    if (role !== 'TECHNICIAN' && role !== 'ADMIN') {
      throw conflict('ผู้ใช้นี้ไม่ได้เป็นช่างซ่อมบำรุง จึงมอบหมายงานให้ไม่ได้');
    }
    if (row.assigneeCoreUserId === assignee.coreUserId) {
      throw conflict('งานนี้อยู่ในความรับผิดชอบของช่างคนนี้อยู่แล้ว');
    }

    const assigneeName = `ช่าง ${personLabel(assignee.personCode, '')}`.trim();
    const becomesAccepted = row.status === 'PENDING';
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, row, {
        assigneeCoreUserId: assignee.coreUserId,
        ...(becomesAccepted && { status: 'ACCEPTED', acceptedAt: new Date() }),
      });
      await tx.requestActivity.create({
        data: {
          type: 'ASSIGNED',
          fromStatus: becomesAccepted ? 'PENDING' : null,
          toStatus: becomesAccepted ? 'ACCEPTED' : null,
          message: `มอบหมายให้ ${assigneeName}${dto.note ? ` — ${dto.note}` : ''}`,
          repairRequestId: id,
          actorCoreUserId: user.coreUserId,
        },
      });
      await this.notify(tx, user, [assignee.coreUserId], {
        title: `มีงานมอบหมายให้คุณ ${row.code}`,
        message: `${row.equipment} · ${placeOf(row)}${dto.note ? ` — ${dto.note}` : ''}`,
        link: linkOf(id),
      });
      await this.notify(tx, user, [row.assigneeCoreUserId], {
        title: `งาน ${row.code} ถูกโอนให้ช่างคนอื่น`,
        message: `ผู้ดูแลระบบโอนงานนี้ให้ ${assigneeName} แล้ว`,
        link: linkOf(id),
      });
      await this.notify(tx, user, await this.reporters(tx, row), {
        title: 'มอบหมายช่างแล้ว',
        message: `${assigneeName} รับผิดชอบงาน ${row.code} (${row.equipment})`,
        link: linkOf(id),
      });
    });
    return this.get(user, token, id);
  }

  /** เริ่ม/พัก/ปิด/ปฏิเสธงาน พร้อมแนบรูปหลังซ่อมได้ */
  async changeStatus(
    user: RepairActor,
    token: string,
    id: string,
    dto: ChangeStatusDto,
    files: UploadedImage[],
  ) {
    const row = await this.load(id);
    assertCan(user, row, ACTION_FOR_STATUS[dto.status]);

    if (files.length > 0) {
      const existing = await this.prisma.repairImage.count({ where: { repairRequestId: id, kind: 'AFTER' } });
      if (existing + files.length > MAX_IMAGES_PER_KIND) {
        throw validationError([
          `รูปหลังซ่อมรวมกันได้ไม่เกิน ${MAX_IMAGES_PER_KIND} รูป (มีอยู่แล้ว ${existing} รูป)`,
        ]);
      }
    }
    const stored = await this.storage.save(files);
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.transition(tx, row, {
          status: dto.status,
          ...(dto.status === 'COMPLETED' && { completedAt: new Date() }),
        });
        await this.statusActivity(tx, row, dto.status, user, dto.note);
        if (stored.length) {
          await tx.repairImage.createMany({
            data: this.imageRows(stored, 'AFTER', user.coreUserId).map((image) => ({
              ...image,
              repairRequestId: id,
            })),
          });
        }
        await this.notify(tx, user, await this.reporters(tx, row), this.statusNotice(row, dto));
        if (row.assigneeCoreUserId && row.assigneeCoreUserId !== user.coreUserId) {
          await this.notify(tx, user, [row.assigneeCoreUserId], {
            title: `ผู้ดูแลระบบเปลี่ยนสถานะงาน ${row.code}`,
            message: `เป็น “${STATUS_LABEL[dto.status]}”${dto.note ? ` — ${dto.note}` : ''}`,
            link: linkOf(id),
          });
        }
      });
    } catch (error) {
      await this.storage.remove(stored.map((image) => image.filename));
      throw error;
    }
    return this.get(user, token, id);
  }

  async rate(user: RepairActor, token: string, id: string, dto: RateRepairRequestDto) {
    const row = await this.load(id);
    assertCan(user, row, 'rate');

    await this.prisma.$transaction(async (tx) => {
      await this.transition(
        tx,
        row,
        { rating: dto.rating, feedback: dto.feedback ?? null },
        'คุณให้คะแนนงานนี้ไปแล้ว',
      );
      await tx.requestActivity.create({
        data: {
          type: 'RATED',
          message: `ให้คะแนน ${dto.rating}/5${dto.feedback ? ` — ${dto.feedback}` : ''}`,
          repairRequestId: id,
          actorCoreUserId: user.coreUserId,
        },
      });
      await this.notify(tx, user, [row.assigneeCoreUserId], {
        title: `ได้รับคะแนนความพึงพอใจ ${dto.rating}/5`,
        message: `งาน ${row.code} (${row.equipment})${dto.feedback ? ` — “${dto.feedback}”` : ''}`,
        link: linkOf(id),
      });
    });
    return this.get(user, token, id);
  }

  async comment(user: RepairActor, token: string, id: string, dto: CreateCommentDto) {
    const row = await this.load(id);
    if (!canRead(user, row)) throw forbidden('ใบแจ้งซ่อมนี้ไม่ใช่ของคุณ จึงแสดงความคิดเห็นไม่ได้');
    assertCan(user, row, 'comment');
    const actorName = personLabel(user.personCode, 'ผู้ใช้');

    const activity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.requestActivity.create({
        data: {
          type: 'COMMENT',
          message: dto.message,
          repairRequestId: id,
          actorCoreUserId: user.coreUserId,
        },
        include: { actor: { select: personSelect } },
      });
      // ผู้แจ้งคุย → ช่างผู้รับผิดชอบ · ช่าง/ผู้ดูแลคุย → ผู้แจ้ง (และช่างผู้รับผิดชอบถ้าไม่ใช่คนพูด)
      await this.notify(tx, user, [...(await this.reporters(tx, row)), row.assigneeCoreUserId], {
        title: `ความคิดเห็นใหม่ใน ${row.code}`,
        message: `${actorName}: ${dto.message}`,
        link: linkOf(id),
      });
      return created;
    });
    const names = await this.namesFor(user, token, user.personCode ? [user.personCode] : []);
    return toActivityDto(activity, names);
  }

  // ------------------------------------------------------------- helpers --

  private async load(id: string): Promise<WorkflowRow> {
    const row = await this.prisma.repairRequest.findUnique({ where: { id }, select: workflowSelect });
    if (!row) throw notFound('ไม่พบใบแจ้งซ่อมนี้ อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง');
    return row;
  }

  /**
   * เขียนแบบมีเงื่อนไข: อัปเดตเฉพาะเมื่อสถานะ/ผู้รับผิดชอบ/คะแนนยังเหมือนตอนที่ตรวจสิทธิ์
   * ถ้ามีคนเปลี่ยนไปก่อน (เช่น ช่างสองคนกดรับพร้อมกัน) จะได้ 409 แทนการเขียนทับ
   */
  private async transition(
    tx: Prisma.TransactionClient,
    row: WorkflowSubject & { id: string },
    data: Prisma.RepairRequestUncheckedUpdateManyInput,
    raceMessage = 'ใบแจ้งซ่อมนี้เพิ่งถูกเปลี่ยนโดยผู้อื่น กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง',
  ) {
    const { count } = await tx.repairRequest.updateMany({
      where: {
        id: row.id,
        status: row.status,
        assigneeCoreUserId: row.assigneeCoreUserId,
        rating: row.rating,
      },
      data,
    });
    if (count === 0) throw conflict(raceMessage);
  }

  private statusActivity(
    tx: Prisma.TransactionClient,
    row: WorkflowRow,
    toStatus: RequestStatus,
    user: RepairActor,
    note?: string,
  ) {
    return tx.requestActivity.create({
      data: {
        type: 'STATUS_CHANGED',
        fromStatus: row.status,
        toStatus,
        message: note ?? null,
        repairRequestId: row.id,
        actorCoreUserId: user.coreUserId,
      },
    });
  }

  private statusNotice(row: WorkflowRow, dto: ChangeStatusDto): NotificationDraft {
    const note = dto.note ? ` — ${dto.note}` : '';
    const link = linkOf(row.id);
    switch (dto.status) {
      case 'IN_PROGRESS':
        return {
          title: row.status === 'ON_HOLD' ? 'ช่างกลับมาดำเนินการต่อแล้ว' : 'ช่างเริ่มดำเนินการแล้ว',
          message: `งาน ${row.code} (${row.equipment})${note}`,
          link,
        };
      case 'ON_HOLD':
        return {
          title: 'งานซ่อมถูกพักไว้ชั่วคราว',
          message: `งาน ${row.code} (${row.equipment})${note}`,
          link,
        };
      case 'COMPLETED':
        return {
          title: 'ซ่อมเสร็จแล้ว',
          message: `งาน ${row.code} (${row.equipment}) เสร็จเรียบร้อย — ให้คะแนนความพึงพอใจได้ที่หน้าใบแจ้งซ่อม${note}`,
          link,
        };
      case 'REJECTED':
        return {
          title: 'ไม่สามารถดำเนินการตามใบแจ้งซ่อมได้',
          message: `งาน ${row.code} (${row.equipment})${note}`,
          link,
        };
    }
  }

  private notify(
    tx: Prisma.TransactionClient,
    user: RepairActor,
    recipients: (string | null)[],
    draft: NotificationDraft,
  ) {
    return this.notifications.notify(recipients, draft, { exclude: user.coreUserId, db: tx });
  }

  private imageRows(stored: StoredImage[], kind: 'BEFORE' | 'AFTER', uploaderCoreUserId: string) {
    return stored.map((image) => ({ ...image, kind, uploaderCoreUserId }));
  }

  /** ออกเลขที่ใบถัดไปของเดือน · ถ้าชนกับคำขอที่เข้ามาพร้อมกัน (P2002) ให้ลองเลขถัดไป */
  private async withNextCode<T>(now: Date, run: (code: string) => Promise<T>): Promise<T> {
    const prefix = requestCodePrefix(now);
    for (let attempt = 1; ; attempt++) {
      const [{ max }] = await this.prisma.$queryRaw<{ max: number | null }[]>`
        SELECT max(split_part(code, '-', 3)::int) AS max FROM repair_requests WHERE code LIKE ${`${prefix}%`}`;
      try {
        return await run(formatRequestCode(prefix, (max ?? 0) + 1));
      } catch (error) {
        const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!duplicate || attempt >= 5) throw error;
      }
    }
  }
}
