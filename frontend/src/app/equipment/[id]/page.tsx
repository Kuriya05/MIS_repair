import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache, type ReactNode } from 'react';
import {
  ArrowBackIcon,
  cardClass,
  cardHeaderClass,
  cardTitleClass,
  CheckCircleIcon,
  GroupIcon,
  HistoryIcon,
  InfoIcon,
  linkClass,
  PageHeader,
  secondaryButtonClass,
  StatusBadge,
} from '@/csmju';
import { RequestStatusBadge } from '@/components/features/requests/badges';
import { StatusStepper } from '@/components/features/requests/StatusStepper';
import {
  CategoryGlyph,
  EquipmentPhotoFallback,
  EquipmentStateBadge,
  STATE_STYLE,
} from '@/components/features/rooms/equipment-visuals';
import { EquipmentAdminTools } from '@/components/features/rooms/EquipmentAdminTools';
import { FollowAndOpenButton } from '@/components/features/rooms/FollowAndOpenButton';
import { PhotoManagerButton } from '@/components/features/rooms/PhotoManagerButton';
import { QuickReportForm } from '@/components/features/rooms/QuickReportForm';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { floorLabel, formatDate, formatRelative } from '@/lib/format';
import { EQUIPMENT_STATE_LABEL } from '@/lib/labels';
import { can, P } from '@/lib/permissions';
import { serverApi } from '@/lib/server-api';
import { getCatalog, getMe } from '@/lib/session';
import type { EquipmentDetail, Me, RepairRequestDetail } from '@/lib/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const getEquipment = cache((id: string) => serverApi<EquipmentDetail>(`/api/v1/equipment/${id}`));

export async function generateMetadata(props: PageProps<'/equipment/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  if (!UUID.test(id)) return { title: 'ไม่พบเครื่อง' };
  const result = await getEquipment(id);
  return {
    title: result.ok ? `${result.data.label} · ${result.data.room.code}` : 'เครื่อง',
  };
}

/**
 * หน้าเครื่อง (ปลายทางของ QR บนตัวเครื่อง) — ข้อมูลเครื่อง + สถานะตอนนี้
 * ยังไม่มีใครแจ้ง → ฟอร์มแจ้งซ่อมด่วน (แตะอาการ) · มีใบเปิดอยู่แล้ว → ดูความคืบหน้า / "ฉันก็เจอ"
 */
export default async function EquipmentPage(props: PageProps<'/equipment/[id]'>) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const [me, result] = await Promise.all([getMe(), getEquipment(id)]);
  if (!result.ok) return <ApiFailure result={result} />;
  const equipment = result.data;
  const viewer = me.ok ? me.data : null;

  const manage = can(viewer, P.ROOM_MANAGE);
  const open = equipment.openRequest;
  // ใบที่เปิดอยู่: อ่านรายละเอียดได้เมื่อเป็นผู้แจ้ง/ผู้ติดตาม/ช่าง/ผู้ดูแล — คนอื่นได้ 403 ก็แสดงแค่สรุป
  const [detail, catalog] = await Promise.all([
    open ? serverApi<RepairRequestDetail>(`/api/v1/repair-requests/${open.id}`) : null,
    manage ? getCatalog(true) : null,
  ]);
  const request = detail?.ok ? detail.data : null;
  const categories = (catalog?.categories ?? []).map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
  const room = equipment.room;
  const place = [room.building.name, floorLabel(room.floor), `${room.code} ${room.name}`]
    .filter(Boolean)
    .join(' · ');
  const canReport = can(viewer, P.REQUEST_CREATE) && equipment.isActive;

  return (
    <>
      <Link
        href={`/rooms/${room.id}`}
        className={`${linkClass} inline-flex items-center gap-1 text-label-md`}
      >
        <ArrowBackIcon className="h-4 w-4" />
        ห้อง {room.code}
      </Link>
      <PageHeader
        eyebrow={
          <>
            <span className="inline-flex items-center gap-1.5 text-label-md text-primary-container">
              <CategoryGlyph icon={equipment.category.icon} className="h-4 w-4" />
              {equipment.category.name}
            </span>
            <EquipmentStateBadge state={equipment.state} />
            {equipment.isActive ? null : <StatusBadge tone="neutral">ปิดใช้งาน</StatusBadge>}
          </>
        }
        title={`${equipment.label} · ${equipment.name}`}
        description={place}
      />

      {manage ? <EquipmentAdminTools equipment={equipment} categories={categories} /> : null}

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="space-y-8 xl:col-span-2">
          {open ? (
            <OpenRequestCard open={open} request={request} viewer={viewer} />
          ) : canReport ? (
            <section className={cardClass} aria-labelledby="report-title">
              <div className={cardHeaderClass}>
                <div className="space-y-1">
                  <h2 id="report-title" className={cardTitleClass}>
                    แจ้งซ่อม {equipment.label}
                  </h2>
                  <p className="text-body-md text-on-surface-variant">
                    ระบบรู้ห้องและรุ่นเครื่องแล้ว บอกแค่อาการที่พบก็พอ
                  </p>
                </div>
              </div>
              <div className="p-6">
                <QuickReportForm equipment={equipment} />
              </div>
            </section>
          ) : (
            <section className={`${cardClass} flex items-start gap-3 p-6`} aria-label="สถานะเครื่อง">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${STATE_STYLE.OK.badge}`}
              >
                <CheckCircleIcon className="h-6 w-6" />
              </span>
              <div className="space-y-1">
                <h2 className="text-label-md text-on-surface">{EQUIPMENT_STATE_LABEL.OK}</h2>
                <p className="text-body-md text-on-surface-variant">
                  {equipment.isActive
                    ? 'ไม่มีใบแจ้งซ่อมที่ค้างอยู่ของเครื่องนี้'
                    : 'เครื่องนี้ปิดใช้งานแล้ว จึงแจ้งซ่อมผ่านหน้านี้ไม่ได้'}
                </p>
              </div>
            </section>
          )}

          <section className={cardClass} aria-labelledby="history-title">
            <div className={cardHeaderClass}>
              <h2 id="history-title" className={cardTitleClass}>
                ประวัติการแจ้งซ่อม
              </h2>
            </div>
            <div className="p-6">
              {equipment.history.length === 0 ? (
                <p className="flex items-center gap-2 text-body-md text-on-surface-variant">
                  <HistoryIcon className="h-5 w-5" />
                  ยังไม่เคยมีการแจ้งซ่อมเครื่องนี้
                </p>
              ) : (
                <ol className="divide-y divide-outline-variant/40">
                  {equipment.history.map((item) => (
                    <li key={item.id} className="space-y-1 py-4 first:pt-0 last:pb-0">
                      <p className="flex flex-wrap items-center gap-2 text-label-md">
                        <Link href={`/requests/${item.id}`} className={`${linkClass} tabular-nums`}>
                          {item.code}
                        </Link>
                        <RequestStatusBadge status={item.status} />
                        <span className="text-caption font-normal text-on-surface-variant">
                          แจ้ง {formatDate(item.createdAt)}
                          {item.completedAt ? ` · ปิด ${formatDate(item.completedAt)}` : ''}
                        </span>
                      </p>
                      <p className="line-clamp-2 whitespace-pre-line text-body-md text-on-surface-variant">
                        {item.description}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-8" aria-label="ข้อมูลเครื่อง">
          <section className={cardClass} aria-labelledby="photo-title">
            <h2 id="photo-title" className="sr-only">
              รูปเครื่อง
            </h2>
            <div className="aspect-[4/3] overflow-hidden bg-surface-container-low">
              {equipment.photoUrl ? (
                <img
                  src={equipment.photoUrl}
                  alt={`รูป ${equipment.label} ${equipment.name}`}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <EquipmentPhotoFallback icon={equipment.category.icon} label={equipment.label} large />
              )}
            </div>
            {manage ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/40 p-4">
                <p className="text-label-sm font-normal text-on-surface-variant">
                  {equipment.photoUrl ? 'รูปช่วยให้ผู้แจ้งเทียบกับเครื่องจริงได้' : 'ยังไม่มีรูปเครื่องนี้'}
                </p>
                <PhotoManagerButton
                  endpoint={`/api/v1/equipment/${equipment.id}/photo`}
                  photoUrl={equipment.photoUrl}
                  title={`รูป ${equipment.label}`}
                  alt={`รูป ${equipment.label} ${equipment.name}`}
                  fallback={<EquipmentPhotoFallback icon={equipment.category.icon} label={equipment.label} />}
                  buttonLabel={equipment.photoUrl ? 'เปลี่ยน/ลบรูป' : 'เพิ่มรูป'}
                  aspectClass="aspect-[4/3]"
                />
              </div>
            ) : null}
          </section>
          <section className={`${cardClass} p-6`} aria-labelledby="info-title">
            <h2 id="info-title" className="text-label-md text-on-surface">
              ข้อมูลเครื่อง
            </h2>
            <dl className="mt-4 space-y-3">
              <Item label="ป้ายเครื่อง">
                <span className="font-display text-headline-md tabular-nums">{equipment.label}</span>
              </Item>
              <Item label="ชื่อ / รุ่น">{equipment.name}</Item>
              <Item label="ประเภท">{equipment.category.name}</Item>
              <Item label="ห้อง">
                <Link href={`/rooms/${room.id}`} className={linkClass}>
                  {room.code} {room.name}
                </Link>
              </Item>
              <Item label="อาคาร / ชั้น">
                {[room.building.name, floorLabel(room.floor)].filter(Boolean).join(' · ')}
              </Item>
              <Item label="ตำแหน่งในห้อง">{equipment.position ?? '—'}</Item>
              <Item label="เลขครุภัณฑ์">
                <span className="tabular-nums">{equipment.assetNumber ?? '—'}</span>
              </Item>
              <Item label="รหัส QR">
                <span className="tabular-nums tracking-wider">{equipment.qrCode}</span>
              </Item>
            </dl>
          </section>
          {equipment.specs ? (
            <section className={`${cardClass} p-6`} aria-labelledby="specs-title">
              <h2 id="specs-title" className="text-label-md text-on-surface">
                รายละเอียดเครื่อง
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-body-md text-on-surface">{equipment.specs}</p>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function OpenRequestCard({
  open,
  request,
  viewer,
}: {
  open: NonNullable<EquipmentDetail['openRequest']>;
  request: RepairRequestDetail | null;
  viewer: Me | null;
}) {
  const mine = Boolean(request && viewer && request.reporter.coreUserId === viewer.id);
  const following = request?.followedByMe ?? false;
  const canFollow = request ? request.canFollow : can(viewer, P.FOLLOW);

  return (
    <section className="space-y-4" aria-labelledby="open-title">
      <div className="space-y-4 rounded-xl border-2 border-amber-500 bg-amber-100/60 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <InfoIcon className="mt-0.5 h-6 w-6 shrink-0 text-amber-800" />
          <div className="min-w-0 space-y-1">
            <h2 id="open-title" className="text-label-md text-on-surface">
              เครื่องนี้มีคนแจ้งซ่อมแล้ว — ไม่ต้องแจ้งซ้ำ
            </h2>
            <p className="flex flex-wrap items-center gap-2 text-body-md text-on-surface">
              <span className="tabular-nums font-semibold">{open.code}</span>
              <RequestStatusBadge status={open.status} />
              <span className="text-on-surface-variant">แจ้ง {formatRelative(open.createdAt)}</span>
            </p>
            {open.affectedCount > 0 ? (
              <p className="flex items-center gap-1 text-label-sm text-on-surface-variant">
                <GroupIcon className="h-4 w-4" />
                เดือดร้อน {open.affectedCount} คน (ผู้แจ้ง + คนที่กด “ฉันก็เจอ”)
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {request ? (
            <Link href={`/requests/${open.id}`} className={secondaryButtonClass}>
              ดูใบแจ้งซ่อม
            </Link>
          ) : null}
          {mine ? (
            <p className="text-body-md text-on-surface-variant">
              คุณเป็นผู้แจ้งใบนี้ — ระบบจะแจ้งเมื่อมีความคืบหน้า
            </p>
          ) : following ? (
            <p className="text-body-md text-on-surface-variant">คุณกด “ฉันก็เจอ” ใบนี้ไว้แล้ว</p>
          ) : canFollow ? (
            <FollowAndOpenButton requestId={open.id} code={open.code} label="ฉันก็เจอ — ติดตามใบนี้" />
          ) : null}
        </div>
      </div>
      {request ? <StatusStepper request={request} /> : null}
    </section>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-label-sm text-on-surface-variant">{label}</dt>
      <dd className="text-body-md text-on-surface">{children}</dd>
    </div>
  );
}
