import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
  AddIcon,
  ArrowBackIcon,
  cardClass,
  cardHeaderClass,
  cardTitleClass,
  InfoIcon,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  StatusBadge,
} from '@/csmju';
import { EquipmentGrid } from '@/components/features/rooms/EquipmentGrid';
import { RoomStateBar, StateLegend } from '@/components/features/rooms/equipment-visuals';
import { OpenRequestList } from '@/components/features/rooms/OpenRequestList';
import { RoomChips, RoomPhoto } from '@/components/features/rooms/room-visuals';
import { AddEquipmentButton, RoomAdminTools } from '@/components/features/rooms/RoomAdminTools';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { EmptyState } from '@/components/shared/EmptyState';
import { floorLabel } from '@/lib/format';
import { can, P } from '@/lib/permissions';
import { serverApi } from '@/lib/server-api';
import { getCatalog, getMe } from '@/lib/session';
import type { RoomDetail } from '@/lib/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const getRoom = cache((id: string) => serverApi<RoomDetail>(`/api/v1/rooms/${id}`));

export async function generateMetadata(props: PageProps<'/rooms/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  if (!UUID.test(id)) return { title: 'ไม่พบห้อง' };
  const result = await getRoom(id);
  return { title: result.ok ? `${result.data.code} ${result.data.name}` : 'ห้อง' };
}

/**
 * หน้าห้อง — รูปห้อง + ข้อมูลห้อง แล้วตามด้วยอุปกรณ์ทั้งหมดในห้อง จัดกลุ่มตามประเภท พร้อมสถานะของแต่ละชิ้น
 * แตะเครื่องเพื่อแจ้งซ่อม/ดูความคืบหน้า · ปัญหาของห้องที่ไม่ใช่เครื่องใดเครื่องหนึ่งแจ้งได้จากปุ่มด้านบน
 */
export default async function RoomPage(props: PageProps<'/rooms/[id]'>) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const [me, result] = await Promise.all([getMe(), getRoom(id)]);
  if (!result.ok) return <ApiFailure result={result} />;
  const room = result.data;

  const manage = me.ok && can(me.data, P.ROOM_MANAGE);
  const canReport = me.ok && can(me.data, P.REQUEST_CREATE) && room.isActive;
  const canFollow = me.ok && can(me.data, P.FOLLOW);
  const catalog = manage ? await getCatalog(true) : null;
  const categories = (catalog?.categories ?? []).map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
  const equipment = manage ? room.equipment : room.equipment.filter((item) => item.isActive);
  const place = [room.building.name, floorLabel(room.floor)].filter(Boolean).join(' · ');

  return (
    <>
      <Link href="/buildings" className={`${linkClass} inline-flex items-center gap-1 text-label-md`}>
        <ArrowBackIcon className="h-4 w-4" />
        ห้องทั้งหมด
      </Link>

      <header className={`${cardClass} fade-slide-up`}>
        <div className="relative h-40 w-full overflow-hidden bg-surface-container sm:h-52 lg:h-60">
          <RoomPhoto
            photoUrl={room.photoUrl}
            code={room.code}
            name={room.name}
            roomType={room.roomType}
            large
            eager
          />
        </div>
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between md:p-6">
          <div className="min-w-0 space-y-2">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-label-md text-primary-container tabular-nums">{room.code}</span>
              <span className="text-label-md text-on-surface-variant">{place}</span>
              {room.isActive ? null : <StatusBadge tone="neutral">ปิดใช้งาน</StatusBadge>}
            </p>
            <h1 className="font-display text-headline-md font-bold text-on-surface md:text-headline-lg">
              {room.name}
            </h1>
            <RoomChips floor={room.floor} capacity={room.capacity} roomType={room.roomType} />
            {room.description ? (
              <p className="max-w-3xl whitespace-pre-line text-body-md text-on-surface-variant">
                {room.description}
              </p>
            ) : null}
          </div>
          {canReport ? (
            <div className="flex shrink-0 flex-wrap gap-3 print:hidden">
              <Link href={`/requests/new?room=${room.id}`} className={secondaryButtonClass}>
                <AddIcon className="h-4 w-4" />
                แจ้งปัญหาของห้อง
              </Link>
            </div>
          ) : null}
        </div>
        {manage ? (
          <div className="border-t border-outline-variant/40 px-5 py-4 md:px-6">
            <RoomAdminTools
              room={{
                id: room.id,
                code: room.code,
                name: room.name,
                floor: room.floor,
                description: room.description,
                roomType: room.roomType,
                capacity: room.capacity,
                photoUrl: room.photoUrl,
                buildingCode: room.buildingCode,
                isActive: room.isActive,
                openRequestCount: room.openRequestCount,
                equipmentCount: room.equipment.length,
              }}
              categories={categories}
            />
          </div>
        ) : null}
      </header>

      {!room.isActive ? (
        <p className="flex items-start gap-2 rounded-lg bg-surface-container px-4 py-3 text-body-md text-on-surface-variant">
          <InfoIcon className="mt-0.5 h-5 w-5 shrink-0" />
          ห้องนี้ปิดใช้งานแล้ว แจ้งซ่อมใหม่ผ่านหน้านี้ไม่ได้
        </p>
      ) : null}

      <section className={cardClass} aria-labelledby="equipment-title">
        <div className={cardHeaderClass}>
          <div className="space-y-1">
            <h2 id="equipment-title" className={cardTitleClass}>
              อุปกรณ์ในห้อง
            </h2>
            {canReport && equipment.length > 0 ? (
              <p className="text-body-md text-on-surface-variant">
                แตะอุปกรณ์ที่มีปัญหาเพื่อแจ้งซ่อม — ถ้ามีคนแจ้งแล้ว กด “ฉันก็เจอ” ที่หน้าเครื่องได้เลย
              </p>
            ) : null}
          </div>
          <StateLegend />
        </div>
        <div className="space-y-6 p-6">
          {equipment.length > 0 ? (
            <>
              <div className="max-w-xl">
                <RoomStateBar summary={room.equipmentStates} />
              </div>
              <EquipmentGrid equipment={equipment} />
            </>
          ) : (
            <EmptyState
              compact
              title="ยังไม่มีอุปกรณ์ในห้องนี้"
              description={
                manage
                  ? 'เพิ่มอุปกรณ์ในห้อง (เพิ่มทีละหลายชิ้นได้ เช่น PC 30 เครื่อง) ใส่รูปแต่ละชิ้น แล้วพิมพ์ QR ไปติดที่ตัวเครื่อง'
                  : 'ถ้าพบปัญหาในห้องนี้ กด “แจ้งปัญหาของห้อง” ได้เลย'
              }
              action={
                manage ? (
                  <AddEquipmentButton roomId={room.id} categories={categories} />
                ) : canReport ? (
                  <Link href={`/requests/new?room=${room.id}`} className={primaryButtonClass}>
                    <AddIcon className="h-4 w-4" />
                    แจ้งปัญหาของห้อง
                  </Link>
                ) : null
              }
            />
          )}
        </div>
      </section>

      <section className={cardClass} aria-labelledby="room-requests-title">
        <div className={cardHeaderClass}>
          <h2 id="room-requests-title" className={cardTitleClass}>
            ปัญหาของห้องที่ยังไม่ปิด
          </h2>
        </div>
        <div className="p-6">
          {room.roomRequests.length > 0 ? (
            <OpenRequestList requests={room.roomRequests} canFollow={canFollow} />
          ) : (
            <p className="text-body-md text-on-surface-variant">
              ไม่มีปัญหาของห้อง (เช่น ไฟ ประตู แอร์รวม) ที่รอซ่อมอยู่
            </p>
          )}
        </div>
      </section>
    </>
  );
}
