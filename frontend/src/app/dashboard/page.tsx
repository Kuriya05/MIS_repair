import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ApartmentIcon,
  ArrowBackIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  InboxIcon,
  InventoryIcon,
  linkClass,
  PageHeader,
  ScheduleIcon,
  cardClass,
  cardHeaderClass,
  cardTitleClass,
  tableClass,
  tbodyRowClass,
  tdClass,
  theadRowClass,
  thClass,
  WarningIcon,
  AssignmentIcon,
} from '@/csmju';
import { BarList, RatioBar, TrendChart } from '@/components/features/charts';
import { RequestList } from '@/components/features/requests/RequestList';
import { CategoryGlyph } from '@/components/features/rooms/equipment-visuals';
import { StatCard } from '@/components/features/StatCard';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { EmptyState } from '@/components/shared/EmptyState';
import { ForbiddenState } from '@/components/shared/ForbiddenState';
import { formatDate, formatDateTime, formatHours, formatNumber, formatRelative } from '@/lib/format';
import { can, P } from '@/lib/permissions';
import { serverApi } from '@/lib/server-api';
import { getMe } from '@/lib/session';
import type { RepairRequestSummary, Room, Statistics } from '@/lib/types';
import { AutoRefresh } from './AutoRefresh';
import { RoomPicker } from './RoomPicker';

export const metadata: Metadata = { title: 'สถิติการแจ้งซ่อม' };

const DAY = 86_400_000;
const bangkokToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const shift = (date: string, days: number) =>
  new Date(new Date(`${date}T12:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);

const RANGES = {
  today: { label: 'วันนี้', from: (today: string) => today },
  '7d': { label: '7 วัน', from: (today: string) => shift(today, -6) },
  '30d': { label: '30 วัน', from: (today: string) => shift(today, -29) },
  '90d': { label: '90 วัน', from: (today: string) => shift(today, -89) },
  '12m': { label: '12 เดือน', from: (today: string) => `${shift(today, -334).slice(0, 7)}-01` },
} as const;
type RangeKey = keyof typeof RANGES;
const DEFAULT_RANGE: RangeKey = '7d';

/** ลิงก์ภายในหน้าสถิติ — ละค่าเริ่มต้นออกจาก URL */
function dashboardHref(range: RangeKey, roomId?: string) {
  const search = new URLSearchParams();
  if (range !== DEFAULT_RANGE) search.set('range', range);
  if (roomId) search.set('roomId', roomId);
  const text = search.toString();
  return text ? `/dashboard?${text}` : '/dashboard';
}

const brokenOf = (room: Room) =>
  room.equipmentStates.reported + room.equipmentStates.inProgress + room.equipmentStates.onHold;

/**
 * สถิติการแจ้งซ่อม — เน้น "ห้องไหนแจ้งซ่อมเยอะ" และ "เครื่องไหนเสียบ่อย"
 * ?range= ช่วงวันที่ (ค่าเริ่มต้น 7 วัน) · ?roomId= ดูเฉพาะห้องเดียว (ทุกสถิติกรองตามห้องนั้น)
 */
export default async function DashboardPage(props: PageProps<'/dashboard'>) {
  const params = await props.searchParams;
  const me = await getMe();
  if (me.ok && !can(me.data, P.STATISTICS_READ))
    return <ForbiddenState message="สถิติการแจ้งซ่อมดูได้เฉพาะช่างซ่อมบำรุงและผู้ดูแลระบบ" />;

  const range: RangeKey =
    typeof params.range === 'string' && params.range in RANGES ? (params.range as RangeKey) : DEFAULT_RANGE;
  const requestedRoom = typeof params.roomId === 'string' ? params.roomId : '';
  const today = bangkokToday();
  const from = RANGES[range].from(today);

  // รายชื่อห้องใช้ทั้งตัวเลือกและนับเครื่องที่เสียอยู่ตอนนี้ — ห้องที่ไม่รู้จักถือว่าดูทุกห้อง
  const rooms = await serverApi<Room[]>('/api/v1/rooms');
  const roomList = rooms.ok ? rooms.data : [];
  const room = roomList.find((r) => r.id === requestedRoom) ?? null;

  const [result, latest] = await Promise.all([
    serverApi<Statistics>(`/api/v1/statistics?from=${from}&to=${today}${room ? `&roomId=${room.id}` : ''}`),
    serverApi<RepairRequestSummary[]>(`/api/v1/repair-requests?scope=all&sort=newest&limit=${room ? 50 : 8}`),
  ]);
  if (!result.ok) return <ApiFailure result={result} />;
  const s = result.data;
  const renderedAt = new Date().toISOString();
  const rangeText =
    s.range.from === s.range.to
      ? formatDate(`${s.range.from}T12:00:00+07:00`)
      : `${formatDate(`${s.range.from}T12:00:00+07:00`)} – ${formatDate(`${s.range.to}T12:00:00+07:00`)}`;

  const brokenNow = rooms.ok
    ? (room ? [room] : roomList).reduce((sum, r) => sum + brokenOf(r), 0)
    : s.byRoom.reduce((sum, r) => sum + r.brokenNow, 0);
  const equipmentTotal = rooms.ok
    ? (room ? [room] : roomList).reduce((sum, r) => sum + r.equipmentStates.total, 0)
    : null;
  const brokenRooms = roomList.filter((r) => brokenOf(r) > 0).length;
  const latestItems = latest.ok
    ? (room ? latest.data.filter((r) => r.room?.id === room.id) : latest.data).slice(0, 8)
    : [];
  const roomOptions = [...roomList]
    .sort(
      (a, b) => a.building.name.localeCompare(b.building.name, 'th') || a.code.localeCompare(b.code, 'th'),
    )
    .map((r) => ({ id: r.id, label: `${r.code} · ${r.name}`, group: r.building.name }));

  return (
    <>
      <PageHeader
        title={room ? `สถิติการแจ้งซ่อม ห้อง ${room.code}` : 'สถิติการแจ้งซ่อม'}
        description={
          room
            ? `${room.name} · ${room.building.name} · ช่วง ${rangeText}`
            : `ทุกห้อง · ช่วง ${rangeText} — ตัวเลขที่บอกว่า “ตอนนี้” ไม่ขึ้นกับช่วงวันที่`
        }
        eyebrow={
          room ? (
            <Link
              href={dashboardHref(range)}
              className={`${linkClass} inline-flex items-center gap-1 text-label-md`}
            >
              <ArrowBackIcon className="h-4 w-4" />
              กลับไปดูทุกห้อง
            </Link>
          ) : null
        }
        actions={<AutoRefresh renderedAt={renderedAt} />}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        {rooms.ok ? (
          <RoomPicker
            key={room?.id ?? 'all'}
            rooms={roomOptions}
            value={room?.id ?? ''}
            range={range === DEFAULT_RANGE ? null : range}
          />
        ) : (
          <p className="text-label-sm text-on-surface-variant">โหลดรายชื่อห้องไม่สำเร็จ — แสดงสถิติทุกห้อง</p>
        )}
        <nav
          aria-label="ช่วงเวลา"
          className="flex flex-wrap gap-1 self-start rounded-lg border border-outline-variant p-1 sm:self-auto"
        >
          {(Object.keys(RANGES) as RangeKey[]).map((key) => (
            <Link
              key={key}
              href={dashboardHref(key, room?.id)}
              aria-current={key === range ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-md px-3 text-label-md transition-colors ${
                key === range
                  ? 'bg-primary-container/10 text-primary-container'
                  : 'text-on-surface-variant hover:bg-surface'
              }`}
            >
              {RANGES[key].label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="แจ้งซ่อมทั้งหมด"
          value={s.created}
          unit="ครั้ง"
          icon={AssignmentIcon}
          hint={`ในช่วง ${RANGES[range].label === 'วันนี้' ? 'วันนี้' : `${RANGES[range].label}ที่ผ่านมา`}`}
        />
        <StatCard
          label="ยังไม่เสร็จ (ตอนนี้)"
          value={s.snapshot.open}
          unit="งาน"
          icon={ScheduleIcon}
          href="/board"
          emphasis={s.snapshot.overdue > 0}
          hint={`รอรับเรื่อง ${formatNumber(s.snapshot.pending)} · กำลังซ่อม ${formatNumber(s.snapshot.inProgress)} · รออะไหล่ ${formatNumber(s.snapshot.onHold)}`}
        />
        <StatCard
          label="ซ่อมเสร็จ"
          value={s.resolution.completed}
          unit="งาน"
          icon={CheckCircleIcon}
          hint={
            s.resolution.onTimeRate === null
              ? 'ยังไม่มีงานที่ซ่อมเสร็จในช่วงนี้'
              : `ทันกำหนด ${s.resolution.onTimeRate}%`
          }
        />
        <StatCard
          label="เครื่องที่เสียอยู่ตอนนี้"
          value={brokenNow}
          unit="เครื่อง"
          icon={WarningIcon}
          emphasis={brokenNow > 0}
          href={room ? `/rooms/${room.id}` : undefined}
          hint={
            room
              ? `จากทั้งหมด ${formatNumber(equipmentTotal ?? 0)} เครื่องในห้องนี้`
              : rooms.ok
                ? brokenNow > 0
                  ? `อยู่ใน ${formatNumber(brokenRooms)} ห้อง`
                  : 'ทุกเครื่องใช้งานได้ปกติ'
                : undefined
          }
        />
      </div>

      {room ? null : (
        <section className={cardClass} aria-labelledby="by-room-title">
          <div className={cardHeaderClass}>
            <div className="space-y-1">
              <h2 id="by-room-title" className={cardTitleClass}>
                แจ้งซ่อมแยกตามห้อง
              </h2>
              <p className="text-body-md text-on-surface-variant">
                เรียงจากห้องที่แจ้งซ่อมมากที่สุดในช่วงนี้ — กดชื่อห้องเพื่อดูผังเครื่อง หรือ “ดูสถิติ”
                เพื่อดูเฉพาะห้องนั้น
              </p>
            </div>
          </div>
          {s.byRoom.length === 0 ? (
            <EmptyState
              compact
              icon={ApartmentIcon}
              title="ยังไม่มีการแจ้งซ่อมที่ระบุห้องในช่วงนี้"
              description="ลองเลือกช่วงเวลาที่ยาวขึ้น"
            />
          ) : (
            <ByRoomTable rows={s.byRoom} range={range} />
          )}
        </section>
      )}

      <section className={cardClass} aria-labelledby="top-equipment-title">
        <div className={cardHeaderClass}>
          <h2 id="top-equipment-title" className={cardTitleClass}>
            อุปกรณ์ที่แจ้งซ่อมบ่อย
          </h2>
          <Link href="/equipment" className={linkClass}>
            ดูอุปกรณ์ทั้งหมด
          </Link>
        </div>
        {s.topEquipment.length === 0 ? (
          <EmptyState
            compact
            icon={InventoryIcon}
            title="ยังไม่มีเครื่องที่ถูกแจ้งซ่อมในช่วงนี้"
            description="สถิตินี้นับเฉพาะใบแจ้งซ่อมที่เลือกเครื่องในห้องไว้"
          />
        ) : (
          <ol className="divide-y divide-outline-variant/40">
            {s.topEquipment.map((item, index) => (
              <li key={item.equipment.id}>
                <Link
                  href={`/equipment/${item.equipment.id}`}
                  className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-container md:px-6"
                >
                  <span className="w-6 shrink-0 text-center text-label-md tabular-nums text-on-surface-variant">
                    {index + 1}
                  </span>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-container/10 text-primary-container">
                    <CategoryGlyph icon={item.category.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label-md text-on-surface">
                      {item.equipment.label}
                      <span className="font-normal text-on-surface-variant"> · {item.equipment.name}</span>
                    </span>
                    <span className="block truncate text-caption text-on-surface-variant">
                      ห้อง {item.room.code} · {item.category.name} · แจ้งล่าสุด{' '}
                      <time dateTime={item.lastReportedAt} title={formatDateTime(item.lastReportedAt)}>
                        {formatRelative(item.lastReportedAt)}
                      </time>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-headline-md tabular-nums text-on-surface">
                      {formatNumber(item.total)}
                    </span>
                    <span className="block text-caption text-on-surface-variant">ครั้ง</span>
                  </span>
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-outline transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={cardClass} aria-labelledby="trend-title">
        <div className={cardHeaderClass}>
          <h2 id="trend-title" className={cardTitleClass}>
            แจ้งซ่อมและซ่อมเสร็จ{s.range.granularity === 'month' ? 'รายเดือน' : 'รายวัน'}
          </h2>
        </div>
        <div className="p-6">
          <TrendChart points={s.trend} granularity={s.range.granularity} />
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className={cardClass} aria-labelledby="by-category-title">
          <div className={cardHeaderClass}>
            <h2 id="by-category-title" className={cardTitleClass}>
              แจ้งซ่อมแยกตามประเภทอุปกรณ์
            </h2>
          </div>
          <div className="p-6">
            <BarList items={s.byCategory.map((item) => ({ label: item.name, value: item.count }))} />
          </div>
        </section>
        <section className={cardClass} aria-labelledby="speed-title">
          <div className={cardHeaderClass}>
            <h2 id="speed-title" className={cardTitleClass}>
              ความรวดเร็วและความพึงพอใจ
            </h2>
          </div>
          <dl className="divide-y divide-outline-variant/40">
            <Metric
              label="เวลาเฉลี่ยจนช่างรับเรื่อง"
              value={formatHours(s.resolution.avgFirstResponseHours)}
            />
            <Metric label="เวลาเฉลี่ยจนซ่อมเสร็จ" value={formatHours(s.resolution.avgResolutionHours)} />
            <Metric
              label="ซ่อมเสร็จทันกำหนด"
              value={
                s.resolution.onTimeRate === null
                  ? '—'
                  : `${s.resolution.onTimeRate}% (${formatNumber(s.resolution.onTime)} จาก ${formatNumber(s.resolution.completed)} งาน)`
              }
            />
            <Metric
              label="ความพึงพอใจเฉลี่ย"
              value={
                s.satisfaction.average === null
                  ? 'ยังไม่มีคะแนน'
                  : `${s.satisfaction.average.toFixed(2)} / 5 (${formatNumber(s.satisfaction.count)} คะแนน)`
              }
            />
          </dl>
        </section>
      </div>

      <section className={cardClass} aria-labelledby="latest-title">
        <div className={cardHeaderClass}>
          <h2 id="latest-title" className={cardTitleClass}>
            {room ? `งานล่าสุดของห้อง ${room.code}` : 'งานล่าสุด'}
          </h2>
          <Link href={room ? `/rooms/${room.id}` : '/board'} className={linkClass}>
            {room ? 'ดูห้องนี้' : 'ไปที่บอร์ดงานซ่อม'}
          </Link>
        </div>
        {!latest.ok ? (
          <p role="alert" className="px-6 py-8 text-center text-body-md text-on-surface-variant">
            โหลดรายการงานล่าสุดไม่สำเร็จ — ระบบจะลองใหม่ในการรีเฟรชรอบถัดไป
          </p>
        ) : latestItems.length === 0 ? (
          <EmptyState compact icon={InboxIcon} title="ยังไม่มีใบแจ้งซ่อม" />
        ) : (
          <RequestList items={latestItems} showPeople />
        )}
      </section>
    </>
  );
}

function ByRoomTable({ rows, range }: { rows: Statistics['byRoom']; range: RangeKey }) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <caption className="sr-only">จำนวนการแจ้งซ่อมแยกตามห้องในช่วงที่เลือก</caption>
        <thead>
          <tr className={theadRowClass}>
            <th scope="col" className={thClass}>
              ห้อง
            </th>
            <th scope="col" className={thClass}>
              แจ้งซ่อม
            </th>
            <th scope="col" className={`${thClass} text-right`}>
              ยังไม่เสร็จ
            </th>
            <th scope="col" className={`${thClass} text-right`}>
              ซ่อมเสร็จ
            </th>
            <th scope="col" className={thClass}>
              เครื่องเสียตอนนี้
            </th>
            <th scope="col" className={thClass}>
              <span className="sr-only">ดูสถิติ</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.room.id} className={tbodyRowClass}>
              <th scope="row" className={`${tdClass} text-left font-normal`}>
                <Link href={`/rooms/${row.room.id}`} className={`${linkClass} text-label-md`}>
                  {row.room.code}
                </Link>
                <span className="block max-w-56 truncate text-caption text-on-surface-variant">
                  {row.room.name}
                </span>
              </th>
              <td className={tdClass}>
                <div className="flex min-w-36 items-center gap-3">
                  <span className="w-8 shrink-0 text-right text-label-md tabular-nums text-on-surface">
                    {formatNumber(row.total)}
                  </span>
                  <span
                    className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full bg-chart-1"
                      style={{ width: `${Math.max(4, (row.total / max) * 100)}%` }}
                    />
                  </span>
                </div>
              </td>
              <td className={`${tdClass} text-right tabular-nums`}>{formatNumber(row.open)}</td>
              <td className={`${tdClass} text-right tabular-nums`}>{formatNumber(row.completed)}</td>
              <td className={tdClass}>
                <RatioBar
                  value={row.brokenNow}
                  total={row.equipmentCount}
                  label={`เครื่องที่เสียอยู่จากทั้งหมด ${row.equipmentCount} เครื่อง`}
                />
              </td>
              <td className={`${tdClass} text-right`}>
                <Link
                  href={dashboardHref(range, row.room.id)}
                  className={`${linkClass} whitespace-nowrap text-label-md`}
                  aria-label={`ดูสถิติเฉพาะห้อง ${row.room.code}`}
                >
                  ดูสถิติ
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-baseline sm:justify-between">
      <dt className="text-body-md text-on-surface-variant">{label}</dt>
      <dd className="text-label-md tabular-nums text-on-surface">{value}</dd>
    </div>
  );
}
