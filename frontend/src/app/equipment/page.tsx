import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ApartmentIcon,
  CategoryIcon,
  ChevronRightIcon,
  cardClass,
  inputClass,
  linkClass,
  PageHeader,
  primaryButtonClass,
  SearchIcon,
  secondaryButtonClass,
  sectionTitleClass,
} from '@/csmju';
import { CategoryGlyph } from '@/components/features/rooms/equipment-visuals';
import { groupRoomsByType } from '@/components/features/rooms/group-rooms';
import { EquipmentCard, equipmentGridClass } from '@/components/features/rooms/EquipmentGrid';
import { RoomTypePill } from '@/components/features/rooms/room-visuals';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { EmptyState } from '@/components/shared/EmptyState';
import { toQuery } from '@/lib/api';
import { floorLabel, formatNumber } from '@/lib/format';
import { ROOM_TYPE_LABEL } from '@/lib/labels';
import { can, P } from '@/lib/permissions';
import { serverApi } from '@/lib/server-api';
import { getCatalog, getMe } from '@/lib/session';
import type { Category, EquipmentInventoryItem, Room } from '@/lib/types';

export const metadata: Metadata = { title: 'ประเภทอุปกรณ์' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

type Filters = { categoryId: string; q: string };

/** ลิงก์ของหน้านี้พร้อมตัวกรองที่เลือกไว้ (ค่าว่างถูกตัดทิ้ง) */
const hrefWith = (filters: Filters, patch: Partial<Filters>) =>
  `/equipment${toQuery({ ...filters, ...patch })}`;

/**
 * ประเภทอุปกรณ์ — ดูว่าแต่ละห้องมีเครื่องและอุปกรณ์อะไรบ้าง (รูป · ป้าย · สถานะ) ทุกคนเปิดดูได้
 * ห้องมาจาก GET /api/v1/rooms ชุดเดียวกับหน้า "อาคารและห้อง" (จัดหัวข้อตามประเภทห้องเหมือนกัน)
 * ห้องที่ยังไม่มีอุปกรณ์ก็แสดง · ตัวกรองส่งเป็น query string ไปที่ GET /api/v1/equipment (กรองฝั่ง server)
 */
export default async function EquipmentInventoryPage(props: PageProps<'/equipment'>) {
  const params = await props.searchParams;
  const rawCategory = one(params.categoryId).trim();
  const filters: Filters = {
    categoryId: UUID.test(rawCategory) ? rawCategory : '',
    q: one(params.q).trim().slice(0, 100),
  };

  const me = await getMe();
  const manage = me.ok && can(me.data, P.ROOM_MANAGE);
  const base = {
    q: filters.q,
    isActive: manage ? undefined : true,
  };
  // ชิปสรุปประเภทนับจากรายการที่ยังไม่กรองประเภท — กดชิปแล้วยังเห็นจำนวนของประเภทอื่นอยู่
  const [catalog, roomList, all, filtered] = await Promise.all([
    getCatalog(false),
    serverApi<Room[]>(`/api/v1/rooms${manage ? '' : '?isActive=true'}`),
    serverApi<EquipmentInventoryItem[]>(`/api/v1/equipment${toQuery(base)}`),
    filters.categoryId
      ? serverApi<EquipmentInventoryItem[]>(
          `/api/v1/equipment${toQuery({ ...base, categoryId: filters.categoryId })}`,
        )
      : null,
  ]);
  if (!roomList.ok) return <ApiFailure result={roomList} />;
  if (!all.ok) return <ApiFailure result={all} />;
  if (filtered && !filtered.ok) return <ApiFailure result={filtered} />;
  const items = filtered ? filtered.data : all.data;

  const summary = categorySummary(all.data, catalog.categories);
  const itemsByRoom = groupByRoom(items);
  const hasFilter = Boolean(filters.categoryId || filters.q);
  // ไม่กรอง = ทุกห้อง (รวมห้องที่ยังไม่มีอุปกรณ์) · กรองอยู่ = เฉพาะห้องที่มีอุปกรณ์ตรงเงื่อนไข
  const sections = groupRoomsByType(
    hasFilter ? roomList.data.filter((room) => itemsByRoom.has(room.id)) : roomList.data,
  );
  const roomCount = sections.reduce((sum, section) => sum + section.rooms.length, 0);

  return (
    <>
      <PageHeader
        title="ประเภทอุปกรณ์"
        description="ดูว่าแต่ละห้องมีเครื่องและอุปกรณ์อะไรบ้าง"
        actions={
          manage ? (
            <Link href="/admin/categories" className={secondaryButtonClass}>
              <CategoryIcon className="h-4 w-4" />
              จัดการประเภทอุปกรณ์
            </Link>
          ) : null
        }
      />

      {summary.length > 0 ? (
        <nav aria-label="สรุปตามประเภทอุปกรณ์">
          <ul className="flex flex-wrap gap-2">
            <li>
              <CategoryChip
                href={hrefWith(filters, { categoryId: '' })}
                active={!filters.categoryId}
                label="ทั้งหมด"
                count={all.data.length}
              />
            </li>
            {summary.map(({ category, count }) => (
              <li key={category.id}>
                <CategoryChip
                  href={hrefWith(filters, { categoryId: category.id })}
                  active={filters.categoryId === category.id}
                  label={category.name}
                  count={count}
                  icon={<CategoryGlyph icon={category.icon} className="h-4 w-4" />}
                />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <form
        method="get"
        action="/equipment"
        role="search"
        aria-label="กรองอุปกรณ์"
        className={`${cardClass} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_2fr_auto] lg:items-end`}
      >
        <div className="space-y-2">
          <label htmlFor="inv-category" className="block text-label-md text-on-surface">
            ประเภทอุปกรณ์
          </label>
          <select
            id="inv-category"
            name="categoryId"
            defaultValue={filters.categoryId}
            className={inputClass}
          >
            <option value="">ทุกประเภท</option>
            {catalog.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <label htmlFor="inv-q" className="block text-label-md text-on-surface">
            ค้นหา
          </label>
          <input
            id="inv-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            maxLength={100}
            placeholder="ป้าย ชื่อรุ่น เลขครุภัณฑ์ หรือรหัสห้อง"
            className={inputClass}
          />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className={`${primaryButtonClass} flex-1 lg:flex-none`}>
            <SearchIcon className="h-4 w-4" />
            ค้นหา
          </button>
          {hasFilter ? (
            <Link href="/equipment" className={secondaryButtonClass}>
              ล้างตัวกรอง
            </Link>
          ) : null}
        </div>
      </form>

      {roomCount === 0 ? (
        <div className={cardClass}>
          {hasFilter ? (
            <EmptyState
              icon={SearchIcon}
              title="ไม่พบอุปกรณ์ตามเงื่อนไขที่เลือก"
              description="ลองเปลี่ยนประเภทหรือคำค้นหา"
              action={
                <Link href="/equipment" className={secondaryButtonClass}>
                  ล้างตัวกรอง
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={ApartmentIcon}
              title="ยังไม่มีห้อง"
              description={
                manage
                  ? 'เพิ่มห้องที่หน้าอาคารและห้อง แล้วกด “เพิ่มอุปกรณ์” ในห้องนั้นเพื่อใส่เครื่องและรูปของแต่ละชิ้น'
                  : 'ผู้ดูแลระบบยังไม่ได้เพิ่มห้องและอุปกรณ์'
              }
              action={
                manage ? (
                  <Link href="/buildings" className={primaryButtonClass}>
                    ไปที่อาคารและห้อง
                  </Link>
                ) : null
              }
            />
          )}
        </div>
      ) : (
        <div className="space-y-10">
          <p className="text-body-md text-on-surface-variant" aria-live="polite">
            อุปกรณ์ {formatNumber(items.length)} ชิ้น ใน {formatNumber(roomCount)} ห้อง
          </p>
          {sections.map(({ type, rooms }) => (
            <section key={type} aria-labelledby={`inv-type-${type}`} className="space-y-4">
              <h2 id={`inv-type-${type}`} className={sectionTitleClass}>
                {ROOM_TYPE_LABEL[type]}{' '}
                <span className="text-body-md font-normal text-on-surface-variant">
                  {formatNumber(rooms.length)} ห้อง
                </span>
              </h2>
              {rooms.map((room) => (
                <RoomSection
                  key={room.id}
                  room={room}
                  items={itemsByRoom.get(room.id) ?? []}
                  manage={manage}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function CategoryChip({
  href,
  active,
  label,
  count,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container ${
        active
          ? 'border-primary-container bg-primary-container text-on-primary'
          : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary-container hover:bg-primary-fixed/40'
      }`}
    >
      {icon}
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-label-sm tabular-nums ${
          active ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-on-surface-variant'
        }`}
      >
        {formatNumber(count)}
      </span>
    </Link>
  );
}

function RoomSection({
  room,
  items,
  manage,
}: {
  room: Room;
  items: EquipmentInventoryItem[];
  manage: boolean;
}) {
  const counts = countByCategory(items)
    .map(({ name, count }) => `${name} ${formatNumber(count)}`)
    .join(' · ');
  const place = [room.building.name, floorLabel(room.floor)].filter(Boolean).join(' · ');
  const headingId = `inv-room-${room.id}`;
  return (
    <section className={cardClass} aria-labelledby={headingId}>
      <div className="flex flex-col gap-2 border-b border-outline-variant/40 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 id={headingId} className="font-display text-body-lg font-semibold text-on-surface">
            <Link href={`/rooms/${room.id}`} className={`${linkClass} inline-flex items-center gap-1`}>
              {room.name}
              <ChevronRightIcon className="h-4 w-4 shrink-0" />
            </Link>
          </h3>
          <p className="flex flex-wrap items-center gap-2 text-label-sm font-normal text-on-surface-variant">
            <span className="tabular-nums">{room.code}</span>
            <span>{place}</span>
            <RoomTypePill type={room.roomType} />
          </p>
        </div>
        <p className="text-label-sm text-on-surface-variant md:text-right">
          {items.length > 0 ? counts : 'ยังไม่มีอุปกรณ์'}
        </p>
      </div>
      {items.length > 0 ? (
        <ul className={`${equipmentGridClass} p-4`}>
          {items.map((item) => (
            <li key={item.id}>
              <EquipmentCard item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-body-md text-on-surface-variant">
          {manage ? (
            <Link href={`/rooms/${room.id}`} className={linkClass}>
              เข้าห้องนี้แล้วกด “เพิ่มอุปกรณ์”
            </Link>
          ) : (
            'ผู้ดูแลระบบยังไม่ได้เพิ่มอุปกรณ์ของห้องนี้'
          )}
        </p>
      )}
    </section>
  );
}

/** อุปกรณ์ของแต่ละห้อง (คงลำดับประเภท → ป้าย ที่ backend เรียงมา) */
function groupByRoom(items: EquipmentInventoryItem[]) {
  const rooms = new Map<string, EquipmentInventoryItem[]>();
  for (const item of items) rooms.set(item.room.id, [...(rooms.get(item.room.id) ?? []), item]);
  return rooms;
}

/** นับตามประเภทในห้องเดียว เช่น คอมพิวเตอร์ 40 · โปรเจกเตอร์ 1 */
function countByCategory(items: EquipmentInventoryItem[]) {
  const counts = new Map<string, { name: string; count: number }>();
  for (const item of items) {
    const entry = counts.get(item.category.id) ?? { name: item.category.name, count: 0 };
    entry.count += 1;
    counts.set(item.category.id, entry);
  }
  return [...counts.values()];
}

/** ชิปสรุปทั้งหน้า: ประเภทที่มีอุปกรณ์ เรียงตามลำดับของหมวดหมู่ (sortOrder) */
function categorySummary(items: EquipmentInventoryItem[], categories: Category[]) {
  const counts = new Map<string, { category: EquipmentInventoryItem['category']; count: number }>();
  for (const item of items) {
    const entry = counts.get(item.category.id) ?? { category: item.category, count: 0 };
    entry.count += 1;
    counts.set(item.category.id, entry);
  }
  const order = new Map(categories.map((c, index) => [c.id, c.sortOrder * 1000 + index]));
  return [...counts.values()].sort(
    (a, b) =>
      (order.get(a.category.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.category.id) ?? Number.MAX_SAFE_INTEGER),
  );
}
