import type { ComponentType } from 'react';
import {
  AirconIcon,
  AudioIcon,
  BuildIcon,
  CheckCircleIcon,
  ComputerIcon,
  FanIcon,
  FurnitureIcon,
  InventoryIcon,
  LightIcon,
  MonitorIcon,
  NetworkIcon,
  PauseIcon,
  ProjectorIcon,
  WarningIcon,
  type IconProps,
} from '@/csmju';
import { EQUIPMENT_STATE_LABEL, EQUIPMENT_STATES } from '@/lib/labels';
import type { CategoryIcon as CategoryIconName, EquipmentState, Room } from '@/lib/types';

/*
 * ภาษาภาพของสถานะเครื่อง — แยกด้วย "สี + ไอคอน + ข้อความ + เส้นขอบ" เสมอ ไม่พึ่งสีอย่างเดียว (ข้อ 3.1)
 *   ใช้งานได้      = พื้นขาว ขอบบาง ไอคอนติ๊ก
 *   แจ้งแล้ว รอช่าง = พื้นเหลืองอำพัน ขอบหนา ไอคอนเตือน
 *   กำลังซ่อม      = พื้นน้ำเงินอ่อน ขอบหนา ไอคอนประแจ
 *   รออะไหล่       = พื้นอำพันเข้ม ขอบเส้นประ ไอคอนหยุดพัก
 */

export const CATEGORY_GLYPH: Record<CategoryIconName, ComponentType<IconProps>> = {
  computer: ComputerIcon,
  monitor: MonitorIcon,
  projector: ProjectorIcon,
  aircon: AirconIcon,
  fan: FanIcon,
  light: LightIcon,
  network: NetworkIcon,
  audio: AudioIcon,
  furniture: FurnitureIcon,
  other: InventoryIcon,
};

export function CategoryGlyph({
  icon,
  className = 'h-5 w-5',
}: {
  icon: CategoryIconName;
  className?: string;
}) {
  const Glyph = CATEGORY_GLYPH[icon] ?? InventoryIcon;
  return <Glyph className={className} />;
}

type StateStyle = {
  /** กล่องเครื่องในผังห้อง */
  tile: string;
  /** ป้ายสถานะ (badge) */
  badge: string;
  /** สีแท่งในแถบสรุปของห้อง */
  bar: string;
  /** สีไอคอนบนพื้นปกติ */
  text: string;
  icon: ComponentType<IconProps>;
};

export const STATE_STYLE: Record<EquipmentState, StateStyle> = {
  OK: {
    tile: 'border border-outline-variant/60 bg-surface-container-lowest hover:border-success hover:bg-success/5',
    badge: 'bg-success/10 text-emerald-700',
    bar: 'bg-success',
    text: 'text-emerald-700',
    icon: CheckCircleIcon,
  },
  REPORTED: {
    tile: 'border-2 border-amber-500 bg-amber-100 hover:bg-amber-200/70',
    badge: 'bg-amber-100 text-amber-800',
    bar: 'bg-amber-500',
    text: 'text-amber-800',
    icon: WarningIcon,
  },
  IN_PROGRESS: {
    tile: 'border-2 border-primary-container bg-primary-fixed hover:bg-primary-fixed/70',
    badge: 'bg-primary-container/10 text-primary-container',
    bar: 'bg-primary-container',
    text: 'text-primary-container',
    icon: BuildIcon,
  },
  ON_HOLD: {
    tile: 'border-2 border-dashed border-brand-amber bg-brand-amber/20 hover:bg-brand-amber/30',
    badge: 'bg-brand-amber/20 text-amber-900',
    bar: 'bg-brand-amber',
    text: 'text-amber-900',
    icon: PauseIcon,
  },
};

export function EquipmentStateBadge({
  state,
  className = '',
}: {
  state: EquipmentState;
  className?: string;
}) {
  const style = STATE_STYLE[state];
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-label-sm ${style.badge} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
      {EQUIPMENT_STATE_LABEL[state]}
    </span>
  );
}

/** คำอธิบายสัญลักษณ์ของผังห้อง */
export function StateLegend({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-2 ${className}`} aria-label="คำอธิบายสถานะเครื่อง">
      {EQUIPMENT_STATES.map((state) => {
        const style = STATE_STYLE[state];
        const Icon = style.icon;
        return (
          <li key={state} className="flex items-center gap-2 text-label-sm text-on-surface-variant">
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${style.tile} ${style.text}`}
              aria-hidden="true"
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
            {EQUIPMENT_STATE_LABEL[state]}
          </li>
        );
      })}
    </ul>
  );
}

type Summary = Room['equipmentStates'];
const SUMMARY_KEY: Record<EquipmentState, keyof Summary> = {
  OK: 'ok',
  REPORTED: 'reported',
  IN_PROGRESS: 'inProgress',
  ON_HOLD: 'onHold',
};

/** ข้อความสรุปสถานะเครื่องของห้อง เช่น "30 เครื่อง · ใช้งานได้ 27 · แจ้งแล้ว รอช่าง 2 · กำลังซ่อม 1" */
export function summaryText(summary: Summary) {
  if (summary.total === 0) return 'ยังไม่มีเครื่องในห้องนี้';
  const parts = EQUIPMENT_STATES.filter((state) => summary[SUMMARY_KEY[state]] > 0).map(
    (state) => `${EQUIPMENT_STATE_LABEL[state]} ${summary[SUMMARY_KEY[state]]}`,
  );
  return `${summary.total} เครื่อง · ${parts.join(' · ')}`;
}

/**
 * แถบสัดส่วนสถานะเครื่องในห้อง (แท่งเรียงตามสถานะ) + ตัวเลขกำกับ — screen reader อ่านข้อความสรุปแทนแถบ
 */
export function RoomStateBar({ summary, showCounts = true }: { summary: Summary; showCounts?: boolean }) {
  if (summary.total === 0) {
    return <p className="text-label-sm font-normal text-on-surface-variant">ยังไม่มีเครื่องในห้องนี้</p>;
  }
  return (
    <div className="space-y-2">
      <p className="sr-only">{summaryText(summary)}</p>
      <div
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-container"
        aria-hidden="true"
      >
        {EQUIPMENT_STATES.map((state) => {
          const count = summary[SUMMARY_KEY[state]];
          if (count === 0) return null;
          return (
            <span
              key={state}
              className={`h-full ${STATE_STYLE[state].bar}`}
              style={{ width: `${(count / summary.total) * 100}%` }}
            />
          );
        })}
      </div>
      {showCounts ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-hidden="true">
          {EQUIPMENT_STATES.map((state) => {
            const count = summary[SUMMARY_KEY[state]];
            if (count === 0 && state !== 'OK') return null;
            const style = STATE_STYLE[state];
            const Icon = style.icon;
            return (
              <li key={state} className={`flex items-center gap-1 text-label-sm ${style.text}`}>
                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span className="tabular-nums">{count}</span>
                <span className="font-normal text-on-surface-variant">{EQUIPMENT_STATE_LABEL[state]}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** พื้นแทนรูปเครื่องเมื่อยังไม่มีรูป: ไอคอนประเภท (+ ป้ายเครื่องถ้าส่งมา) */
export function EquipmentPhotoFallback({
  icon,
  label,
  large = false,
}: {
  icon: CategoryIconName;
  label?: string;
  large?: boolean;
}) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-surface-container-low text-primary-container"
      aria-hidden="true"
    >
      <CategoryGlyph icon={icon} className={large ? 'h-14 w-14' : 'h-8 w-8'} />
      {label ? (
        <span
          className={`font-display font-bold tabular-nums text-on-surface-variant ${large ? 'text-headline-md' : 'text-label-md'}`}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
