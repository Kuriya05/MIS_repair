import type { Metadata } from 'next';
import { ApartmentIcon, cardClass, PageHeader, sectionTitleClass } from '@/csmju';
import { groupRoomsByType } from '@/components/features/rooms/group-rooms';
import { AddRoomButton } from '@/components/features/rooms/RoomAdminTools';
import { RoomCard } from '@/components/features/rooms/RoomCard';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatNumber } from '@/lib/format';
import { ROOM_TYPE_LABEL } from '@/lib/labels';
import { can, P } from '@/lib/permissions';
import { serverApi } from '@/lib/server-api';
import { getMe } from '@/lib/session';
import type { Building, Room } from '@/lib/types';

export const metadata: Metadata = { title: 'อาคารและห้อง' };

/**
 * ห้องทั้งหมดของสาขา จัดเป็นหัวข้อตามประเภทห้องแบบหน้า Facilities ของสาขา
 * เลือกห้อง → ดูอุปกรณ์ในห้องและแจ้งซ่อม · ผู้ดูแลเพิ่มห้องได้ แล้วเพิ่มอุปกรณ์ในหน้าห้อง
 */
export default async function RoomsPage() {
  const me = await getMe();
  const manage = me.ok && can(me.data, P.ROOM_MANAGE);
  const [rooms, buildings] = await Promise.all([
    serverApi<Room[]>(`/api/v1/rooms${manage ? '' : '?isActive=true'}`),
    manage ? serverApi<Building[]>('/api/v1/buildings?limit=100') : Promise.resolve(null),
  ]);
  if (!rooms.ok) return <ApiFailure result={rooms} />;
  const sections = groupRoomsByType(rooms.data);
  const buildingOptions =
    buildings && buildings.ok
      ? buildings.data.filter((b) => b.isActive).map((b) => ({ code: b.code, name: b.name }))
      : [];
  // ค่าเริ่มต้นของฟอร์มเพิ่มห้อง = อาคารที่ห้องส่วนใหญ่อยู่ (ปกติคืออาคารของสาขา)
  const defaultBuilding =
    mostCommon(rooms.data.map((room) => room.buildingCode)) ?? buildingOptions[0]?.code ?? '';
  const addRoom =
    manage && defaultBuilding ? (
      <AddRoomButton buildingCode={defaultBuilding} buildings={buildingOptions} />
    ) : null;

  return (
    <>
      <PageHeader
        title="อาคารและห้อง"
        description="เลือกห้องเพื่อดูอุปกรณ์ในห้องและแจ้งซ่อม — อุปกรณ์ที่มีคนแจ้งไว้แล้วจะขึ้นสถานะให้เห็น"
        actions={addRoom}
      />
      {sections.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={ApartmentIcon}
            title="ยังไม่มีห้อง"
            description={
              manage
                ? 'เพิ่มห้องแล้วเพิ่มอุปกรณ์ในห้อง ผู้ใช้จะเลือกอุปกรณ์ที่เสียแล้วแจ้งซ่อมได้ทันที'
                : 'ผู้ดูแลระบบยังไม่ได้เพิ่มห้อง'
            }
            action={addRoom}
          />
        </div>
      ) : (
        <div className="space-y-10">
          {sections.map(({ type, rooms: list }, index) => (
            <section
              key={type}
              aria-labelledby={`type-${type}`}
              className={`space-y-4 ${index > 0 ? 'border-t border-outline-variant/40 pt-8' : ''}`}
            >
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

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
