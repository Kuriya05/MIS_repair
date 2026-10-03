import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { Priority, RequestStatus } from '../../generated/prisma/enums';
import type { CategoryIcon } from '../categories/categories.dto';
import { validationError } from '../shared/errors';
import { PrismaService } from '../prisma/prisma.service';
import { BuildingsDirectory } from '../directory/buildings-directory';
import { toPersonView } from '../profiles/profile.view';
import { ProfilesService } from '../profiles/profiles.service';
import { OPEN_STATUSES } from '../repair-requests/sla';
import type {
  RoomStatDto,
  StatisticsDto,
  StatisticsQueryDto,
  TopEquipmentDto,
  TrendPointDto,
} from './statistics.dto';

const BANGKOK_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 3 * 366;
const DAILY_LIMIT_DAYS = 62;
const TOP_EQUIPMENT_LIMIT = 10;

const STATUSES: RequestStatus[] = [
  'PENDING',
  'ACCEPTED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];
const PRIORITIES: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

/** วันที่ตามเวลาไทยของจุดเวลานั้น (YYYY-MM-DD) */
const bangkokDate = (at: Date) => new Date(at.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
const dayStart = (date: string) => new Date(`${date}T00:00:00+07:00`);
const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

/** ทุกช่วง (วัน/เดือน) ระหว่าง from ถึง to เพื่อให้กราฟมีจุดครบแม้วันนั้นไม่มีงาน */
function periodsBetween(from: string, to: string, granularity: 'day' | 'month') {
  const periods: string[] = [];
  if (granularity === 'day') {
    for (let t = dayStart(from).getTime(); t <= dayStart(to).getTime(); t += DAY_MS) {
      periods.push(bangkokDate(new Date(t)));
    }
    return periods;
  }
  let [year, month] = from.split('-').map(Number);
  const [endYear, endMonth] = to.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    periods.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return periods;
}

type Totals = {
  completed: number;
  onTime: number;
  avgResolutionHours: number | null;
  avgRating: number | null;
  ratingCount: number;
};

@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly buildings: BuildingsDirectory,
  ) {}

  /** token ใช้หาชื่ออาคารจาก cache ข้อมูลอ้างอิงของ Core Hub เท่านั้น · ช่างแสดงด้วย person_code (ไม่หาชื่อทีละแถว) */
  async summary(query: StatisticsQueryDto, token: string, now = new Date()): Promise<StatisticsDto> {
    const to = query.to ?? bangkokDate(now);
    const from = query.from ?? bangkokDate(new Date(dayStart(to).getTime() - 29 * DAY_MS));
    const start = dayStart(from);
    const end = new Date(dayStart(to).getTime() + DAY_MS);
    const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
    if (days <= 0) throw validationError(['from: วันที่เริ่มต้องไม่อยู่หลังวันที่สิ้นสุด']);
    if (days > MAX_RANGE_DAYS) throw validationError(['to: ช่วงวันที่ยาวได้ไม่เกิน 3 ปี']);
    const granularity = days > DAILY_LIMIT_DAYS ? 'month' : 'day';

    // roomId กรองทุกสถิติให้เหลือเฉพาะใบของห้องนั้น
    const room = query.roomId ? { roomId: query.roomId } : {};
    const inRoom = query.roomId ? Prisma.sql`AND room_id = ${query.roomId}::uuid` : Prisma.empty;
    const createdInRange = { ...room, createdAt: { gte: start, lt: end } };
    const open = { ...room, status: { in: [...OPEN_STATUSES] } };

    const [
      snapshotRows,
      overdue,
      created,
      byStatus,
      byPriority,
      byCategory,
      byBuilding,
      [totals],
      [response],
      ratingRows,
      hotSpots,
      createdTrend,
      completedTrend,
      technicianRows,
      technicians,
      categories,
      byRoom,
      topEquipment,
    ] = await Promise.all([
      this.prisma.repairRequest.groupBy({ by: ['status'], where: open, _count: { _all: true } }),
      this.prisma.repairRequest.count({ where: { ...open, dueAt: { lt: now } } }),
      this.prisma.repairRequest.count({ where: createdInRange }),
      this.prisma.repairRequest.groupBy({ by: ['status'], where: createdInRange, _count: { _all: true } }),
      this.prisma.repairRequest.groupBy({ by: ['priority'], where: createdInRange, _count: { _all: true } }),
      this.prisma.repairRequest.groupBy({
        by: ['categoryId'],
        where: createdInRange,
        _count: { _all: true },
      }),
      this.prisma.repairRequest.groupBy({
        by: ['buildingCode'],
        where: createdInRange,
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Totals[]>`
        SELECT count(*)::int AS "completed",
               count(*) FILTER (WHERE completed_at <= due_at)::int AS "onTime",
               avg(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600)::float8 AS "avgResolutionHours",
               avg(rating)::float8 AS "avgRating",
               count(rating)::int AS "ratingCount"
          FROM repair_requests
         WHERE status = 'COMPLETED' AND completed_at >= ${start} AND completed_at < ${end} ${inRoom}`,
      this.prisma.$queryRaw<{ avgFirstResponseHours: number | null }[]>`
        SELECT avg(EXTRACT(EPOCH FROM (accepted_at - created_at)) / 3600)::float8 AS "avgFirstResponseHours"
          FROM repair_requests
         WHERE accepted_at >= ${start} AND accepted_at < ${end} ${inRoom}`,
      this.prisma.$queryRaw<{ rating: number; count: number }[]>`
        SELECT rating::int AS "rating", count(*)::int AS "count"
          FROM repair_requests
         WHERE rating IS NOT NULL AND completed_at >= ${start} AND completed_at < ${end} ${inRoom}
         GROUP BY rating`,
      this.prisma.$queryRaw<{ buildingCode: string; location: string; count: number; open: number }[]>`
        SELECT r.building_code AS "buildingCode", r.location AS "location", count(*)::int AS "count",
               count(*) FILTER (WHERE r.status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'))::int AS "open"
          FROM repair_requests r
         WHERE r.created_at >= ${start} AND r.created_at < ${end} ${inRoom}
         GROUP BY r.building_code, r.location
        HAVING count(*) >= 2
         ORDER BY count(*) DESC, r.building_code, r.location
         LIMIT 5`,
      this.trend('created_at', start, end, granularity, inRoom),
      this.trend('completed_at', start, end, granularity, inRoom),
      this.prisma.$queryRaw<
        { coreUserId: string; open: number; completed: number; onTime: number; avgRating: number | null }[]
      >`
        SELECT assignee_core_user_id AS "coreUserId",
               count(*) FILTER (WHERE status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'))::int AS "open",
               count(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= ${start} AND completed_at < ${end})::int AS "completed",
               count(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= ${start} AND completed_at < ${end}
                                  AND completed_at <= due_at)::int AS "onTime",
               avg(rating) FILTER (WHERE completed_at >= ${start} AND completed_at < ${end})::float8 AS "avgRating"
          FROM repair_requests
         WHERE assignee_core_user_id IS NOT NULL ${inRoom}
         GROUP BY assignee_core_user_id`,
      this.profiles.technicians(),
      this.prisma.category.findMany({ select: { id: true, name: true } }),
      this.byRoom(start, end, inRoom),
      this.topEquipment(start, end, inRoom),
    ]);

    const snapshot = new Map(snapshotRows.map((row) => [row.status, row._count._all]));
    const statusCounts = new Map(byStatus.map((row) => [row.status, row._count._all]));
    const priorityCounts = new Map(byPriority.map((row) => [row.priority, row._count._all]));
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    // ชื่ออาคารจาก cache ข้อมูลอ้างอิงทั้งชุดของ Core Hub (ไม่เรียกทีละแถว) · หาไม่ได้แสดง code
    const buildingRefs = await this.buildings.refs(
      [...byBuilding.map((row) => row.buildingCode), ...hotSpots.map((spot) => spot.buildingCode)],
      token,
    );
    const buildingName = (code: string) => buildingRefs.get(code)?.name ?? code;

    const trendMap = new Map<string, TrendPointDto>();
    for (const period of periodsBetween(from, to, granularity))
      trendMap.set(period, { period, created: 0, completed: 0 });
    for (const row of createdTrend) {
      const point = trendMap.get(row.period);
      if (point) point.created = row.count;
    }
    for (const row of completedTrend) {
      const point = trendMap.get(row.period);
      if (point) point.completed = row.count;
    }

    const loads = new Map(technicianRows.map((row) => [row.coreUserId, row]));
    const ratings = new Map(ratingRows.map((row) => [row.rating, row.count]));

    return {
      range: { from, to, granularity },
      snapshot: {
        open: [...snapshot.values()].reduce((sum, value) => sum + value, 0),
        pending: snapshot.get('PENDING') ?? 0,
        inProgress: (snapshot.get('ACCEPTED') ?? 0) + (snapshot.get('IN_PROGRESS') ?? 0),
        onHold: snapshot.get('ON_HOLD') ?? 0,
        overdue,
      },
      created,
      resolution: {
        completed: totals.completed,
        onTime: totals.onTime,
        onTimeRate: totals.completed ? round1((totals.onTime / totals.completed) * 100) : null,
        avgResolutionHours: round1(totals.avgResolutionHours),
        avgFirstResponseHours: round1(response.avgFirstResponseHours),
      },
      satisfaction: {
        average: totals.avgRating === null ? null : Math.round(totals.avgRating * 100) / 100,
        count: totals.ratingCount,
        distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: ratings.get(rating) ?? 0 })),
      },
      byStatus: STATUSES.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
      byPriority: PRIORITIES.map((priority) => ({ priority, count: priorityCounts.get(priority) ?? 0 })),
      byCategory: byCategory
        .map((row) => ({
          id: row.categoryId,
          name: categoryName.get(row.categoryId) ?? '-',
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th')),
      byBuilding: byBuilding
        .map((row) => ({
          code: row.buildingCode,
          name: buildingName(row.buildingCode),
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th')),
      hotSpots: hotSpots.map((spot) => ({ ...spot, buildingName: buildingName(spot.buildingCode) })),
      trend: [...trendMap.values()],
      technicians: technicians
        .map((profile) => {
          const load = loads.get(profile.coreUserId);
          return {
            person: toPersonView(profile),
            open: load?.open ?? 0,
            completed: load?.completed ?? 0,
            onTime: load?.onTime ?? 0,
            avgRating:
              load?.avgRating === null || load?.avgRating === undefined
                ? null
                : Math.round(load.avgRating * 100) / 100,
          };
        })
        .sort(
          (a, b) =>
            b.open - a.open ||
            b.completed - a.completed ||
            a.person.displayName.localeCompare(b.person.displayName),
        ),
      byRoom,
      topEquipment,
    };
  }

  /**
   * ใบที่แจ้งในช่วงนี้แยกตามห้อง (เฉพาะใบที่ผูกห้อง) + จำนวนเครื่องในห้องและเครื่องที่เสียอยู่ตอนนี้
   * brokenNow = เครื่องที่เปิดใช้งานในห้องและมีใบแจ้งซ่อมที่ยังไม่ปิด (ไม่ขึ้นกับช่วงวันที่)
   */
  private async byRoom(start: Date, end: Date, inRoom: Prisma.Sql): Promise<RoomStatDto[]> {
    const rows = await this.prisma.$queryRaw<
      { roomId: string; total: number; open: number; completed: number }[]
    >`
      SELECT room_id AS "roomId", count(*)::int AS "total",
             count(*) FILTER (WHERE status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'))::int AS "open",
             count(*) FILTER (WHERE status = 'COMPLETED')::int AS "completed"
        FROM repair_requests
       WHERE room_id IS NOT NULL AND created_at >= ${start} AND created_at < ${end} ${inRoom}
       GROUP BY room_id`;
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.roomId);
    const [rooms, broken] = await Promise.all([
      this.prisma.room.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          code: true,
          name: true,
          buildingCode: true,
          _count: { select: { equipment: { where: { isActive: true } } } },
        },
      }),
      this.prisma.equipment.groupBy({
        by: ['roomId'],
        where: {
          roomId: { in: ids },
          isActive: true,
          requests: { some: { status: { in: [...OPEN_STATUSES] } } },
        },
        _count: { _all: true },
      }),
    ]);
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const brokenByRoom = new Map(broken.map((row) => [row.roomId, row._count._all]));
    return rows
      .flatMap((row) => {
        const room = roomById.get(row.roomId);
        if (!room) return [];
        return [
          {
            room: { id: room.id, code: room.code, name: room.name, buildingCode: room.buildingCode },
            total: row.total,
            open: row.open,
            completed: row.completed,
            equipmentCount: room._count.equipment,
            brokenNow: brokenByRoom.get(room.id) ?? 0,
          },
        ];
      })
      .sort((a, b) => b.total - a.total || b.open - a.open || a.room.code.localeCompare(b.room.code));
  }

  /** เครื่องที่ถูกแจ้งบ่อยที่สุดในช่วงนี้ 10 อันดับ */
  private async topEquipment(start: Date, end: Date, inRoom: Prisma.Sql): Promise<TopEquipmentDto[]> {
    const rows = await this.prisma.$queryRaw<{ equipmentId: string; total: number; lastReportedAt: Date }[]>`
      SELECT equipment_id AS "equipmentId", count(*)::int AS "total", max(created_at) AS "lastReportedAt"
        FROM repair_requests
       WHERE equipment_id IS NOT NULL AND created_at >= ${start} AND created_at < ${end} ${inRoom}
       GROUP BY equipment_id
       ORDER BY count(*) DESC, max(created_at) DESC, equipment_id
       LIMIT ${TOP_EQUIPMENT_LIMIT}`;
    if (rows.length === 0) return [];
    const items = await this.prisma.equipment.findMany({
      where: { id: { in: rows.map((row) => row.equipmentId) } },
      select: {
        id: true,
        label: true,
        name: true,
        room: { select: { id: true, code: true } },
        category: { select: { id: true, name: true, icon: true } },
      },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));
    return rows.flatMap((row) => {
      const item = itemById.get(row.equipmentId);
      if (!item) return [];
      return [
        {
          equipment: { id: item.id, label: item.label, name: item.name },
          room: item.room,
          category: { ...item.category, icon: item.category.icon as CategoryIcon },
          total: row.total,
          lastReportedAt: new Date(row.lastReportedAt).toISOString(),
        },
      ];
    });
  }

  /** จำนวนต่อวัน/เดือนตามเวลาไทย ของคอลัมน์เวลาที่กำหนด (ชื่อคอลัมน์มาจากโค้ด ไม่ใช่ผู้ใช้) */
  private trend(
    column: 'created_at' | 'completed_at',
    start: Date,
    end: Date,
    granularity: 'day' | 'month',
    inRoom: Prisma.Sql = Prisma.empty,
  ) {
    const format = granularity === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';
    if (column === 'created_at') {
      return this.prisma.$queryRaw<{ period: string; count: number }[]>`
        SELECT to_char(date_trunc(${granularity}, created_at AT TIME ZONE 'Asia/Bangkok'), ${format}) AS "period",
               count(*)::int AS "count"
          FROM repair_requests
         WHERE created_at >= ${start} AND created_at < ${end} ${inRoom}
         GROUP BY 1`;
    }
    return this.prisma.$queryRaw<{ period: string; count: number }[]>`
      SELECT to_char(date_trunc(${granularity}, completed_at AT TIME ZONE 'Asia/Bangkok'), ${format}) AS "period",
             count(*)::int AS "count"
        FROM repair_requests
       WHERE status = 'COMPLETED' AND completed_at >= ${start} AND completed_at < ${end} ${inRoom}
       GROUP BY 1`;
  }
}
