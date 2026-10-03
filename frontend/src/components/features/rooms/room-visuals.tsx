import type { ComponentType, ReactNode } from 'react';
import {
  ApartmentIcon,
  ComputerIcon,
  GroupIcon,
  NetworkIcon,
  PersonIcon,
  ProjectorIcon,
  type IconProps,
} from '@/csmju';
import { floorLabel, formatNumber } from '@/lib/format';
import { ROOM_TYPE_SHORT, ROOM_TYPE_TONE } from '@/lib/labels';
import type { RoomType } from '@/lib/types';

/** ไอคอนแทนประเภทห้อง (ใช้ในพื้นแทนรูปเมื่อห้องยังไม่มีรูป) */
export const ROOM_TYPE_GLYPH: Record<RoomType, ComponentType<IconProps>> = {
  LAB: ComputerIcon,
  NETWORK_LAB: NetworkIcon,
  LECTURE: ProjectorIcon,
  MEETING: GroupIcon,
  OFFICE: PersonIcon,
  OTHER: ApartmentIcon,
};

/** ป้ายประเภทห้อง (สี + ข้อความ) */
export function RoomTypePill({ type, className = '' }: { type: RoomType; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-label-sm ${ROOM_TYPE_TONE[type].pill} ${className}`}
    >
      {ROOM_TYPE_SHORT[type]}
    </span>
  );
}

/** ชิปข้อมูลเล็ก ๆ บนการ์ด เช่น "ชั้น 6" "60 ที่นั่ง" */
export function InfoChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant">
      {children}
    </span>
  );
}

/** ชิปชั้น · ที่นั่ง · ประเภทห้อง */
export function RoomChips({
  floor,
  capacity,
  roomType,
}: {
  floor: number | null;
  capacity: number | null;
  roomType: RoomType;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {floor !== null ? <InfoChip>{floorLabel(floor)}</InfoChip> : null}
      {capacity ? <InfoChip>{formatNumber(capacity)} ที่นั่ง</InfoChip> : null}
      <RoomTypePill type={roomType} />
    </div>
  );
}

/** พื้นแทนรูปห้อง: สีตามประเภทห้อง + ไอคอน + รหัสห้อง */
export function RoomPhotoFallback({
  code,
  roomType,
  large = false,
}: {
  code: string;
  roomType: RoomType;
  large?: boolean;
}) {
  const Glyph = ROOM_TYPE_GLYPH[roomType];
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 ${ROOM_TYPE_TONE[roomType].panel}`}
      aria-hidden="true"
    >
      <Glyph className={large ? 'h-12 w-12' : 'h-8 w-8'} />
      <span
        className={`font-display font-bold tabular-nums ${large ? 'text-headline-lg' : 'text-headline-md'}`}
      >
        {code}
      </span>
    </div>
  );
}

/** รูปห้อง (หรือพื้นแทนรูป) เต็มกรอบของผู้เรียก */
export function RoomPhoto({
  photoUrl,
  code,
  name,
  roomType,
  large = false,
  eager = false,
}: {
  photoUrl: string | null;
  code: string;
  name: string;
  roomType: RoomType;
  large?: boolean;
  eager?: boolean;
}) {
  if (!photoUrl) return <RoomPhotoFallback code={code} roomType={roomType} large={large} />;
  return (
    <img
      src={photoUrl}
      alt={`รูปห้อง ${code} ${name}`}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className="h-full w-full object-cover"
    />
  );
}
