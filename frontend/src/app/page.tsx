import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ApartmentIcon,
  AssignmentIcon,
  BoardIcon,
  BuildIcon,
  cardClass,
  cardHeaderClass,
  CategoryIcon,
  ChartIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  InboxIcon,
  linkClass,
  PageHeader,
  PauseIcon,
  primaryButtonClass,
  QrCodeIcon,
  sectionTitleClass,
  StatusBadge,
  WarningIcon,
  type IconProps,
} from '@/csmju';
import { RequestList } from '@/components/features/requests/RequestList';
import { RoomStateBar } from '@/components/features/rooms/equipment-visuals';
import { groupRoomsByType } from '@/components/features/rooms/group-rooms';
import { RoomCard } from '@/components/features/rooms/RoomCard';
import { StatCard } from '@/components/features/StatCard';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatNumber } from '@/lib/format';
import { CORE_ROLE_LABEL, ROOM_TYPE_LABEL, SUBSYSTEM_ROLE_LABEL } from '@/lib/labels';
import { can, P } from '@/lib/permissions';
import { serverApi, type ServerResult } from '@/lib/server-api';
import { getMe } from '@/lib/session';
import type { RepairRequestSummary, Room, Statistics } from '@/lib/types';

export const metadata: Metadata = { title: 'ภาพรวม' };

const DAY = 86_400_000;
/** วันที่ (YYYY-MM-DD เวลาไทย) ย้อนหลัง n วันจากวันนี้ */
const bangkokDate = (daysAgo = 0) =>
  new Date(Date.now() + 7 * 3_600_000 - daysAgo * DAY).toISOString().slice(0, 10);

const list = (query: string) => serverApi<RepairRequestSummary[]>(`/api/v1/repair-requests?${query}`);
const total = (result: ServerResult<RepairRequestSummary[]> | null) =>
  result?.ok ? (result.meta?.total ?? 0) : null;
const skip = Promise.resolve(null);

const brokenOf = (room: Room) =>
  room.equipmentStates.reported + room.equipmentStates.inProgress + room.equipmentStates.onHold;

/** ห้องที่ควรรู้ตอนนี้ = มีเครื่องเสีย หรือมีใบแจ้งซ่อมที่ยังไม่เสร็จ */
const needsAttention = (room: Room) => brokenOf(room) > 0 || room.openRequestCount > 0;

const ROOM_PREVIEW = 6;

/**
 * หน้าภาพรวมหน้าเดียวสำหรับทุกคน — เนื้อหาปรับตามสิทธิ์
 *   แจ้งซ่อมได้ (repair-request:create) — ทางเข้าแจ้งซ่อม + ใบแจ้งซ่อมของฉัน
 *   ทุกคน — สถานะห้องที่มีเครื่องเสีย
 *   ช่าง/ผู้ดูแล (repair-job:accept) — ตัวเลขงาน ณ ตอนนี้ + งานที่ต้องรีบทำ + ทางลัด
 */
export default async function HomePage() {
  const me = await getMe();
  if (!me.ok) return <ApiFailure result={me} />;
  const user = me.data;
  const canCreate = can(user, P.REQUEST_CREATE);
  const isStaff = can(user, P.JOB_ACCEPT);
  const canStats = can(user, P.STATISTICS_READ);
  const weekAgo = bangkokDate(6);

  const [
    rooms,
    mine,
    myOpen,
    stats,
    pending,
    accepted,
    inProgress,
    onHold,
    overdue,
    doneWeek,
    overdueList,
    urgentList,
  ] = await Promise.all([
    serverApi<Room[]>('/api/v1/rooms'),
    canCreate ? list('scope=mine&sort=updated&limit=5') : skip,
    canCreate ? list('scope=mine&state=open&limit=1') : skip,
    isStaff && canStats
      ? serverApi<Statistics>(`/api/v1/statistics?from=${weekAgo}&to=${bangkokDate()}`)
      : skip,
    // ไม่มีสิทธิ์ดูสถิติ — นับจากรายการงานแทน
    isStaff && !canStats ? list('scope=all&status=PENDING&limit=1') : skip,
    isStaff && !canStats ? list('scope=all&status=ACCEPTED&limit=1') : skip,
    isStaff && !canStats ? list('scope=all&status=IN_PROGRESS&limit=1') : skip,
    isStaff && !canStats ? list('scope=all&status=ON_HOLD&limit=1') : skip,
    isStaff && !canStats ? list('scope=all&state=overdue&limit=1') : skip,
    isStaff && !canStats ? list(`scope=all&status=COMPLETED&from=${weekAgo}&limit=1`) : skip,
    isStaff ? list('scope=all&state=overdue&sort=due&limit=5') : skip,
    isStaff ? list('scope=all&state=open&priority=URGENT&sort=due&limit=5') : skip,
  ]);

  const roomList = rooms.ok ? rooms.data : [];
  const attention = roomList
    .filter((room) => room.isActive && needsAttention(room))
    .sort((a, b) => brokenOf(b) - brokenOf(a) || b.openRequestCount - a.openRequestCount);
  const brokenTotal = attention.reduce((sum, room) => sum + brokenOf(room), 0);
  const brokenRooms = attention.filter((room) => brokenOf(room) > 0).length;

  const snapshot = stats?.ok ? stats.data.snapshot : null;
  const counts = isStaff
    ? {
        pending: snapshot?.pending ?? total(pending),
        inProgress:
          snapshot?.inProgress ??
          (accepted?.ok && inProgress?.ok ? (total(accepted) ?? 0) + (total(inProgress) ?? 0) : null),
        onHold: snapshot?.onHold ?? total(onHold),
        overdue: snapshot?.overdue ?? total(overdue),
        doneWeek: stats?.ok ? stats.data.resolution.completed : total(doneWeek),
      }
    : null;

  // งานที่ต้องรีบทำ = เกินกำหนด + ด่วนมากที่ยังไม่เสร็จ (ไม่ซ้ำกัน เรียงตามกำหนดเสร็จ)
  const urgentMap = new Map<string, RepairRequestSummary>();
  for (const result of [overdueList, urgentList])
    if (result?.ok) for (const row of result.data) urgentMap.set(row.id, row);
  const urgent = [...urgentMap.values()]
    .sort((a, b) => new Date(a.sla.dueAt).getTime() - new Date(b.sla.dueAt).getTime())
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title={`สวัสดี ${user.displayName}`}
        description={summaryLine({
          counts,
          brokenTotal,
          brokenRooms,
          roomsLoaded: rooms.ok,
          myOpen: total(myOpen),
        })}
        eyebrow={
          <StatusBadge tone="info">
            {CORE_ROLE_LABEL[user.coreRole] ?? user.coreRole}
            {user.subsystemRole !== 'USER' ? ` · ${SUBSYSTEM_ROLE_LABEL[user.subsystemRole]}` : ''}
          </StatusBadge>
        }
      />

      {canCreate && !isStaff ? (
        <RoomPicker rooms={roomList.filter((room) => room.isActive)} loaded={rooms.ok} />
      ) : canCreate ? (
        <ReportEntryCard />
      ) : null}

      {counts ? (
        <section aria-labelledby="today-title" className="space-y-4">
          <h2 id="today-title" className="sr-only">
            งานซ่อม ณ ตอนนี้
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              label="รอรับเรื่อง"
              value={counts.pending}
              icon={InboxIcon}
              href="/board"
              emphasis={(counts.pending ?? 0) > 0}
              hint="ยังไม่มีช่างรับงาน"
            />
            <StatCard label="กำลังซ่อม" value={counts.inProgress} icon={BuildIcon} href="/board" />
            <StatCard label="รออะไหล่" value={counts.onHold} icon={PauseIcon} href="/board" />
            <StatCard
              label="เกินกำหนด"
              value={counts.overdue}
              icon={WarningIcon}
              href="/board"
              emphasis={(counts.overdue ?? 0) > 0}
              hint={(counts.overdue ?? 0) > 0 ? 'ควรจัดการก่อนงานอื่น' : 'ทุกงานยังทันเวลา'}
            />
            <StatCard
              label="ซ่อมเสร็จใน 7 วัน"
              value={counts.doneWeek}
              icon={CheckCircleIcon}
              href={canStats ? '/dashboard' : undefined}
            />
          </div>
        </section>
      ) : null}

      <div className="grid items-start gap-8 xl:grid-cols-2">
        {isStaff ? (
          <section className={cardClass} aria-labelledby="urgent-title">
            <div className={cardHeaderClass}>
              <h2 id="urgent-title" className="font-display text-headline-md text-on-surface">
                งานที่ต้องรีบทำ
              </h2>
              <Link href="/board" className={linkClass}>
                ไปที่บอร์ดงานซ่อม
              </Link>
            </div>
            {!overdueList?.ok ? (
              <p role="alert" className="px-6 py-8 text-center text-body-md text-on-surface-variant">
                โหลดรายการงานไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง
              </p>
            ) : urgent.length === 0 ? (
              <EmptyState
                compact
                icon={CheckCircleIcon}
                title="ไม่มีงานเร่งด่วนหรือเกินกำหนด"
                description="งานที่เกินกำหนดหรือแจ้งว่าด่วนมากจะขึ้นที่นี่ก่อน"
              />
            ) : (
              <RequestList items={urgent} showPeople />
            )}
          </section>
        ) : null}

        {canCreate ? (
          <section className={cardClass} aria-labelledby="mine-title">
            <div className={cardHeaderClass}>
              <h2 id="mine-title" className="font-display text-headline-md text-on-surface">
                ใบแจ้งซ่อมของฉัน
              </h2>
              <Link href="/requests" className={linkClass}>
                ดูทั้งหมด
              </Link>
            </div>
            {!mine?.ok ? (
              <p role="alert" className="px-6 py-8 text-center text-body-md text-on-surface-variant">
                โหลดใบแจ้งซ่อมไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง
              </p>
            ) : mine.data.length === 0 ? (
              <EmptyState
                compact
                icon={AssignmentIcon}
                title="คุณยังไม่เคยแจ้งซ่อม"
                description="เจอเครื่องเสียในห้องไหน เลือกห้องแล้วกดที่เครื่องนั้นได้เลย แนบรูปไว้ช่างจะเตรียมของได้ถูก"
                action={
                  <Link href="/buildings" className={primaryButtonClass}>
                    <ApartmentIcon className="h-4 w-4" />
                    แจ้งซ่อม
                  </Link>
                }
              />
            ) : (
              <RequestList items={mine.data} />
            )}
          </section>
        ) : null}

        {/* ผู้แจ้งซ่อมเห็นสถานะบนการ์ดห้องด้านบนแล้ว */}
        {isStaff || !canCreate ? (
          <RoomStatus rooms={attention} loaded={rooms.ok} totalRooms={roomList.length} />
        ) : null}
      </div>

      <nav aria-label="ทางลัด" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isStaff ? (
          <Shortcut href="/board" icon={BoardIcon} label="บอร์ดงานซ่อม" hint="รับเรื่องและอัปเดตสถานะงาน" />
        ) : null}
        {canStats ? (
          <Shortcut
            href="/dashboard"
            icon={ChartIcon}
            label="สถิติการแจ้งซ่อม"
            hint="ห้องและเครื่องที่แจ้งบ่อย"
          />
        ) : null}
        <Shortcut
          href="/buildings"
          icon={ApartmentIcon}
          label="อาคารและห้อง"
          hint="ดูผังเครื่องในแต่ละห้อง"
        />
        <Shortcut
          href="/equipment"
          icon={CategoryIcon}
          label="ประเภทอุปกรณ์"
          hint="อุปกรณ์ทุกเครื่องแยกตามประเภท"
        />
        {canCreate && !isStaff ? (
          <Shortcut
            href="/requests"
            icon={AssignmentIcon}
            label="ใบแจ้งซ่อมของฉัน"
            hint="ติดตามงานที่แจ้งไว้"
          />
        ) : null}
      </nav>

      {canCreate ? <QrTip /> : null}
    </>
  );
}

/** ผู้แจ้งซ่อม: ห้องทั้งหมดขึ้นให้เลือกทันที (การ์ดแบบหน้าอาคารและห้อง) → กดห้อง → กดเครื่องที่เสีย */
function RoomPicker({ rooms, loaded }: { rooms: Room[]; loaded: boolean }) {
  const sections = groupRoomsByType(rooms);
  return (
    <section aria-labelledby="pick-room-title" className="space-y-6">
      <div className="space-y-1">
        <h2 id="pick-room-title" className="font-display text-headline-md text-on-surface">
          เลือกห้องที่จะแจ้งซ่อม
        </h2>
        <p className="text-body-md text-on-surface-variant">
          กดที่ห้อง แล้วเลือกเครื่องที่เสีย — เครื่องที่มีคนแจ้งไว้แล้วจะขึ้นสถานะให้เห็น
        </p>
      </div>
      {!loaded ? (
        <p role="alert" className={`${cardClass} px-6 py-8 text-center text-body-md text-on-surface-variant`}>
          โหลดรายการห้องไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง
        </p>
      ) : sections.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            compact
            icon={ApartmentIcon}
            title="ยังไม่มีห้อง"
            description="ผู้ดูแลระบบยังไม่ได้เพิ่มห้อง"
          />
        </div>
      ) : (
        sections.map(({ type, rooms: list }) => (
          <div key={type} className="space-y-3">
            <h3 className={sectionTitleClass}>
              {ROOM_TYPE_LABEL[type]}{' '}
              <span className="text-body-md font-normal text-on-surface-variant">
                {formatNumber(list.length)} ห้อง
              </span>
            </h3>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((room) => (
                <li key={room.id}>
                  <RoomCard room={room} />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

/** ประโยคสรุปสั้น ๆ ใต้คำทักทาย — เลือกเฉพาะเรื่องที่ผู้ใช้คนนั้นควรรู้ */
function summaryLine({
  counts,
  brokenTotal,
  brokenRooms,
  roomsLoaded,
  myOpen,
}: {
  counts: { pending: number | null; inProgress: number | null; overdue: number | null } | null;
  brokenTotal: number;
  brokenRooms: number;
  roomsLoaded: boolean;
  myOpen: number | null;
}) {
  const parts: string[] = [];
  if (counts) {
    if (counts.pending !== null)
      parts.push(
        counts.pending > 0
          ? `ตอนนี้มีงานรอรับเรื่อง ${formatNumber(counts.pending)} งาน`
          : 'ไม่มีงานรอรับเรื่อง',
      );
    if (counts.inProgress) parts.push(`กำลังซ่อม ${formatNumber(counts.inProgress)} งาน`);
    if (counts.overdue) parts.push(`เกินกำหนด ${formatNumber(counts.overdue)} งาน`);
  }
  if (roomsLoaded)
    parts.push(
      brokenTotal > 0
        ? `เครื่องเสียอยู่ ${formatNumber(brokenTotal)} เครื่องใน ${formatNumber(brokenRooms)} ห้อง`
        : 'ทุกห้องใช้งานได้ปกติ',
    );
  if (myOpen) parts.push(`ใบแจ้งซ่อมของคุณที่ยังไม่เสร็จ ${formatNumber(myOpen)} ใบ`);
  return parts.length > 0 ? parts.join(' · ') : 'ดูสถานะห้องและงานแจ้งซ่อมทั้งหมดได้จากหน้านี้';
}

/** ทางเข้าแจ้งซ่อม — เลือกอาคาร → ห้อง → กดที่เครื่องที่เสีย */
function ReportEntryCard() {
  return (
    <Link
      href="/buildings"
      className="brand-gradient group flex flex-col gap-5 rounded-xl p-6 text-white shadow-md transition-shadow hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container md:flex-row md:items-center md:p-8"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15">
        <ApartmentIcon className="h-8 w-8" />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block font-display text-headline-md">
          แจ้งซ่อม — เลือกห้องแล้วกดที่เครื่องที่เสีย
        </span>
        <span className="block text-body-md text-white/85">
          เห็นทันทีว่าเครื่องนั้นมีคนแจ้งไว้แล้วหรือยัง ถ้ามีแล้วกด “ฉันก็เจอ” เพื่อติดตามงานเดียวกันได้เลย
        </span>
      </span>
      <span className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg bg-white/15 px-4 text-label-md backdrop-blur-sm transition-colors group-hover:bg-white/25 md:self-center">
        เริ่มแจ้งซ่อม
        <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/** ห้องที่มีเครื่องเสียหรือมีงานค้าง — แถบสีบอกสัดส่วนสถานะเครื่องในห้อง */
function RoomStatus({ rooms, loaded, totalRooms }: { rooms: Room[]; loaded: boolean; totalRooms: number }) {
  const shown = rooms.slice(0, ROOM_PREVIEW);
  return (
    <section className={cardClass} aria-labelledby="room-status-title">
      <div className={cardHeaderClass}>
        <div className="space-y-1">
          <h2 id="room-status-title" className="font-display text-headline-md text-on-surface">
            สถานะห้อง
          </h2>
          {loaded && totalRooms > 0 ? (
            <p className="text-body-md text-on-surface-variant">
              {rooms.length > 0
                ? `มีเครื่องเสียหรืองานค้าง ${formatNumber(rooms.length)} จาก ${formatNumber(totalRooms)} ห้อง`
                : `ทั้งหมด ${formatNumber(totalRooms)} ห้อง`}
            </p>
          ) : null}
        </div>
        <Link href="/buildings" className={linkClass}>
          ดูทุกห้อง
        </Link>
      </div>
      {!loaded ? (
        <p role="alert" className="px-6 py-8 text-center text-body-md text-on-surface-variant">
          โหลดสถานะห้องไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง
        </p>
      ) : rooms.length === 0 ? (
        <EmptyState
          compact
          icon={CheckCircleIcon}
          title="ทุกห้องใช้งานได้ปกติ"
          description="ตอนนี้ไม่มีเครื่องเสียหรืองานแจ้งซ่อมค้างอยู่ในห้องใดเลย"
        />
      ) : (
        <>
          <ul className="divide-y divide-outline-variant/40">
            {shown.map((room) => {
              const broken = brokenOf(room);
              return (
                <li key={room.id}>
                  <Link
                    href={`/rooms/${room.id}`}
                    className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-container md:px-6"
                  >
                    <span className="min-w-0 flex-1 space-y-2">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="min-w-0 truncate text-label-md text-on-surface">
                          {room.code}
                          <span className="font-normal text-on-surface-variant"> · {room.name}</span>
                        </span>
                        <span className="shrink-0 text-label-sm text-on-surface-variant">
                          {broken > 0
                            ? `เสีย ${formatNumber(broken)} จาก ${formatNumber(room.equipmentStates.total)} เครื่อง`
                            : `งานค้าง ${formatNumber(room.openRequestCount)} งาน`}
                        </span>
                      </span>
                      <RoomStateBar summary={room.equipmentStates} showCounts={false} />
                      <span className="block text-caption text-on-surface-variant">{room.building.name}</span>
                    </span>
                    <ChevronRightIcon className="h-5 w-5 shrink-0 text-outline transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
          {rooms.length > ROOM_PREVIEW ? (
            <p className="border-t border-outline-variant/40 px-6 py-4 text-body-md text-on-surface-variant">
              และอีก {formatNumber(rooms.length - ROOM_PREVIEW)} ห้อง —{' '}
              <Link href="/buildings" className={linkClass}>
                ดูทั้งหมด
              </Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function Shortcut({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ComponentType<IconProps>;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-container/10 text-primary-container">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-label-md text-on-surface">{label}</span>
        <span className="block truncate text-caption text-on-surface-variant">{hint}</span>
      </span>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-outline transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function QrTip() {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-surface-variant bg-surface-container-lowest p-6 md:flex-row md:items-center">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary-container">
        <QrCodeIcon className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <h2 className="text-label-md text-on-surface">แจ้งซ่อมเร็วขึ้นด้วย QR</h2>
        <p className="text-body-md text-on-surface-variant">
          ห้องและเครื่องที่มีสติกเกอร์ QR สแกนด้วยกล้องมือถือได้เลย ระบบจะพาไปที่ห้องหรือเครื่องนั้นทันที
        </p>
      </div>
    </section>
  );
}
