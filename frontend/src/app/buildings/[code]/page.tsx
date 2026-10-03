import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArrowBackIcon, cardClass, linkClass, PageHeader, sectionTitleClass, StatusBadge } from '@/csmju';
import { RoomCard } from '@/components/features/rooms/RoomCard';
import { AddRoomButton } from '@/components/features/rooms/RoomAdminTools';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatNumber } from '@/lib/format';
import { ROOM_TYPE_LABEL } from '@/lib/labels';
import { groupRoomsByType } from '@/components/features/rooms/group-rooms';
import { can, P } from '@/lib/permissions';
import { serverApi } from '@/lib/server-api';
import { getMe } from '@/lib/session';
import type { Building, Room } from '@/lib/types';

const CODE = /^[A-Z0-9-]{1,50}$/;
const getBuildings = cache(() => serverApi<Building[]>('/api/v1/buildings?limit=100'));
function normalize(raw: string) {
  try {
    return decodeURIComponent(raw).trim().toUpperCase();
  } catch {
    return '';
  }
}

export async function generateMetadata(props: PageProps<'/buildings/[code]'>): Promise<Metadata> {
  const code = normalize((await props.params).code);
  const result = await getBuildings();
  const building = result.ok ? result.data.find((b) => b.code === code) : undefined;
  return { title: building ? building.name : 'อาคาร' };
}

/**
 * ห้องในอาคาร จัดเป็นหัวข้อตามประเภทห้อง (แล็บคอมพิวเตอร์ · ห้องบรรยาย · …) เป็นการ์ดรูปห้อง
 * แต่ละการ์ดบอกชั้น ที่นั่ง ประเภท และจำนวนเครื่อง/เครื่องที่เสีย
 */
export default async function BuildingPage(props: PageProps<'/buildings/[code]'>) {
  const code = normalize((await props.params).code);
  if (!CODE.test(code)) notFound();
  const [me, buildings] = await Promise.all([getMe(), getBuildings()]);
  if (!buildings.ok) return <ApiFailure result={buildings} />;
  const building = buildings.data.find((b) => b.code === code);
  if (!building) notFound();

  const manage = me.ok && can(me.data, P.ROOM_MANAGE);
  const rooms = await serverApi<Room[]>(
    `/api/v1/rooms?buildingCode=${encodeURIComponent(code)}${manage ? '' : '&isActive=true'}`,
  );
  if (!rooms.ok) return <ApiFailure result={rooms} />;
  const sections = groupRoomsByType(rooms.data);

  return (
    <>
      <Link href="/buildings" className={`${linkClass} inline-flex items-center gap-1 text-label-md`}>
        <ArrowBackIcon className="h-4 w-4" />
        อาคารทั้งหมด
      </Link>
      <PageHeader
        eyebrow={
          <>
            <span className="text-label-md text-primary-container tabular-nums">{building.code}</span>
            {building.isActive ? null : <StatusBadge tone="neutral">ปิดใช้งาน</StatusBadge>}
          </>
        }
        title={building.name}
        description={`${formatNumber(rooms.data.length)} ห้อง · ${formatNumber(building.equipmentCount)} เครื่อง · ใบที่ยังไม่ปิด ${formatNumber(building.openRequestCount)} ใบ`}
        actions={manage ? <AddRoomButton buildingCode={building.code} /> : null}
      />

      {rooms.data.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            title="ยังไม่มีห้องในอาคารนี้"
            description={
              manage
                ? 'เพิ่มห้องแล้วใส่เครื่องในห้อง ผู้ใช้จะเลือกเครื่องที่เสียหรือสแกน QR แจ้งซ่อมได้ทันที'
                : 'ผู้ดูแลระบบยังไม่ได้เพิ่มห้องของอาคารนี้ แจ้งซ่อมแบบกรอกสถานที่เองได้ที่ปุ่มแจ้งซ่อม'
            }
            action={
              manage ? (
                <AddRoomButton buildingCode={building.code} />
              ) : (
                <Link href="/requests/new" className={linkClass}>
                  แจ้งซ่อมแบบกรอกสถานที่เอง
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map(({ type, rooms: list }) => (
            <section key={type} aria-labelledby={`type-${type}`} className="space-y-4">
              <h2 id={`type-${type}`} className={sectionTitleClass}>
                {ROOM_TYPE_LABEL[type]}{' '}
                <span className="text-body-md font-normal text-on-surface-variant">
                  {formatNumber(list.length)} ห้อง
                </span>
              </h2>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((room) => (
                  <li key={room.id}>
                    <RoomCard room={room} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
