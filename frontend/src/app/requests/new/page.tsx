import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApartmentIcon, cardClass, InfoIcon, linkClass, LocationIcon, PageHeader } from '@/csmju';
import { NewRequestForm, type RequestDraft } from '@/components/features/requests/NewRequestForm';
import { RequestStatusBadge } from '@/components/features/requests/badges';
import { ForbiddenState } from '@/components/shared/ForbiddenState';
import { floorLabel, formatRelative } from '@/lib/format';
import { can, P } from '@/lib/permissions';
import { serverApi } from '@/lib/server-api';
import { getCatalog, getMe } from '@/lib/session';
import type { RoomDetail } from '@/lib/types';

export const metadata: Metadata = { title: 'แจ้งซ่อม' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const param = (value: string | string[] | undefined) =>
  typeof value === 'string' && UUID.test(value) ? value : undefined;

/**
 * แจ้งซ่อม 2 แบบ
 *   ?room=<id>  ปัญหาของห้องที่ไม่ใช่เครื่องใดเครื่องหนึ่ง (ไฟ ประตู แอร์รวม) — ระบบกรอกอาคาร/ชั้น/ห้องให้
 *   ไม่มี param  กรอกสถานที่เอง (จุดที่ยังไม่มีห้องในระบบ เช่น ห้องน้ำ ทางเดิน)
 * แจ้งเครื่องใดเครื่องหนึ่ง (?equipment=) ไปทำที่หน้าเครื่องซึ่งมีปุ่มอาการให้แตะ
 */
export default async function NewRequestPage(props: PageProps<'/requests/new'>) {
  const params = await props.searchParams;
  const equipmentId = param(params.equipment);
  if (equipmentId) redirect(`/equipment/${equipmentId}`);
  const roomId = param(params.room);

  const [me, catalog, roomResult] = await Promise.all([
    getMe(),
    getCatalog(true),
    roomId ? serverApi<RoomDetail>(`/api/v1/rooms/${roomId}`) : null,
  ]);
  if (me.ok && !can(me.data, P.REQUEST_CREATE)) return <ForbiddenState />;
  const room = roomResult?.ok && roomResult.data.isActive ? roomResult.data : null;

  const initial: RequestDraft = {
    buildingCode: room?.buildingCode ?? '',
    floor: room?.floor === null || room?.floor === undefined ? '' : String(room.floor),
    location: room ? `${room.code} ${room.name}` : '',
    categoryId: '',
    equipment: '',
    assetNumber: '',
    description: '',
    priority: 'MEDIUM',
  };
  const ready = catalog.categoryOptions.length > 0 && (room || catalog.buildingOptions.length > 0);

  return (
    <>
      <PageHeader
        title={room ? `แจ้งปัญหาที่ห้อง ${room.code}` : 'แจ้งซ่อม'}
        description={
          room
            ? 'สำหรับปัญหาของห้องที่ไม่ใช่เครื่องใดเครื่องหนึ่ง เช่น ไฟดับ ประตูล็อกไม่ได้ แอร์ทั้งห้องไม่เย็น'
            : 'บอกตำแหน่งและอาการให้ชัดเจน แนบรูปถ่ายถ้าทำได้ ช่างจะได้เตรียมอุปกรณ์มาถูกตั้งแต่ครั้งแรก'
        }
      />
      {room ? (
        <section
          className="space-y-3 rounded-xl border border-primary-container/20 bg-primary-container/10 p-5"
          aria-label="ห้องที่แจ้ง"
        >
          <p className="flex items-start gap-2 text-body-md text-on-surface">
            <LocationIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
            <span>
              <strong>
                {room.code} {room.name}
              </strong>
              <span className="text-on-surface-variant">
                {' · '}
                {[room.building.name, floorLabel(room.floor)].filter(Boolean).join(' · ')}
              </span>
            </span>
          </p>
          <p className="text-body-md text-on-surface-variant">
            ถ้าเป็นเครื่องใดเครื่องหนึ่ง (เช่น PC-05 เปิดไม่ติด) ให้เลือกเครื่องจาก{' '}
            <Link href={`/rooms/${room.id}`} className={linkClass}>
              ผังเครื่องในห้อง
            </Link>{' '}
            แทน ช่างจะรู้ทันทีว่าเป็นเครื่องไหน
          </p>
          {room.roomRequests.length > 0 ? (
            <div className="space-y-2 rounded-lg bg-surface-container-lowest p-4">
              <p className="flex items-center gap-2 text-label-md text-on-surface">
                <InfoIcon className="h-5 w-5 text-primary-container" />
                ห้องนี้มีปัญหาที่ยังไม่ปิดงาน {room.roomRequests.length} รายการ — ถ้าเป็นเรื่องเดียวกัน
                เปิดใบนั้นแล้วกด “ฉันก็เจอ” แทนการแจ้งซ้ำ
              </p>
              <ul className="space-y-1">
                {room.roomRequests.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center gap-2 text-body-md text-on-surface-variant"
                  >
                    <Link href={`/requests/${request.id}`} className={`${linkClass} tabular-nums`}>
                      {request.code}
                    </Link>
                    <span>{request.equipment}</span>
                    <RequestStatusBadge status={request.status} />
                    <span className="text-caption">{formatRelative(request.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : roomId ? (
        <p className="rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container">
          ไม่พบห้องนี้ หรือห้องถูกปิดใช้งานแล้ว กรุณากรอกสถานที่เอง หรือ{' '}
          <Link href="/buildings" className="underline">
            เลือกห้องจากรายการอาคาร
          </Link>
        </p>
      ) : (
        <p className="flex items-start gap-2 text-body-md text-on-surface-variant">
          <ApartmentIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
          <span>
            เครื่องในห้องเรียน/ห้องแล็บ แจ้งง่ายกว่าที่{' '}
            <Link href="/buildings" className={linkClass}>
              อาคารและห้อง
            </Link>{' '}
            หรือสแกน QR บนตัวเครื่อง — ระบบกรอกสถานที่และรุ่นเครื่องให้เอง
          </span>
        </p>
      )}
      <section className={`${cardClass} p-6 md:p-8`}>
        {!ready ? (
          <p className="text-body-md text-on-surface-variant">
            ยังไม่มีอาคารหรือหมวดหมู่ที่เปิดรับแจ้งซ่อม กรุณาติดต่อผู้ดูแลระบบแจ้งซ่อม{' '}
            <Link href="/" className={linkClass}>
              กลับหน้าแรก
            </Link>
          </p>
        ) : (
          <NewRequestForm
            key={room?.id ?? 'free'}
            buildings={catalog.buildingOptions}
            categories={catalog.categoryOptions}
            initial={initial}
            room={room ? { id: room.id, code: room.code, buildingCode: room.buildingCode } : undefined}
          />
        )}
      </section>
    </>
  );
}
