import Link from 'next/link';
import { CheckCircleIcon, StatusBadge, WarningIcon } from '@/csmju';
import { formatNumber } from '@/lib/format';
import type { Room } from '@/lib/types';
import { summaryText } from './equipment-visuals';
import { RoomChips, RoomPhoto } from './room-visuals';

/**
 * การ์ดห้องในหน้าอาคาร (แบบหน้า Facilities ของคณะ): รูปห้องด้านบน · ชื่อห้อง · ชิปชั้น/ที่นั่ง/ประเภท
 * + บรรทัดสรุปเครื่อง "เครื่อง 40 · เสีย 2" (มีไอคอนกำกับ ไม่ใช้สีอย่างเดียว)
 */
export function RoomCard({ room }: { room: Room }) {
  const summary = room.equipmentStates;
  const broken = summary.total - summary.ok;
  const label = [
    `${room.code} ${room.name}`,
    room.isActive ? null : 'ปิดใช้งาน',
    summaryText(summary),
    room.openRequestCount > 0 ? `ใบที่ยังไม่ปิด ${room.openRequestCount} ใบ` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/rooms/${room.id}`}
      aria-label={label}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container ${
        room.isActive ? '' : 'opacity-70'
      }`}
    >
      <div className="relative aspect-video overflow-hidden bg-surface-container">
        <RoomPhoto photoUrl={room.photoUrl} code={room.code} name={room.name} roomType={room.roomType} />
        {room.isActive ? null : (
          <span className="absolute left-2 top-2">
            <StatusBadge tone="neutral">ปิดใช้งาน</StatusBadge>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-body-md font-bold text-on-surface group-hover:text-primary-container">
            {room.name}
          </p>
          <p className="text-label-sm font-normal tabular-nums text-on-surface-variant">{room.code}</p>
        </div>
        <RoomChips floor={room.floor} capacity={room.capacity} roomType={room.roomType} />
        <p
          className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-outline-variant/40 pt-3 text-label-sm"
          aria-hidden="true"
        >
          {summary.total === 0 ? (
            <span className="font-normal text-on-surface-variant">ยังไม่มีอุปกรณ์ในห้อง</span>
          ) : (
            <>
              <span className="text-on-surface">อุปกรณ์ {formatNumber(summary.total)} ชิ้น</span>
              {broken > 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-800">
                  <WarningIcon className="h-3.5 w-3.5" />
                  เสีย {formatNumber(broken)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  ใช้งานได้ทั้งหมด
                </span>
              )}
            </>
          )}
          {room.openRequestCount > 0 ? (
            <span className="font-normal text-on-surface-variant">
              · รอซ่อม {formatNumber(room.openRequestCount)} ใบ
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
