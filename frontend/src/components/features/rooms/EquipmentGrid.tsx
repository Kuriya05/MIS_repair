import Link from 'next/link';
import { GroupIcon } from '@/csmju';
import { EQUIPMENT_STATE_LABEL } from '@/lib/labels';
import type { Equipment } from '@/lib/types';
import { CategoryGlyph, EquipmentPhotoFallback, EquipmentStateBadge, STATE_STYLE } from './equipment-visuals';

/** ข้อมูลที่การ์ดอุปกรณ์ต้องใช้ — ใช้ได้ทั้ง Equipment (หน้าห้อง) และ EquipmentInventoryItem (หน้าประเภทอุปกรณ์) */
export type EquipmentCardItem = Pick<
  Equipment,
  'id' | 'label' | 'name' | 'photoUrl' | 'category' | 'state' | 'openRequest' | 'isActive'
>;

const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label, 'th', { numeric: true, sensitivity: 'base' });

/** จัดกลุ่มเครื่องตามประเภท (คงลำดับที่ backend ส่งมา) แล้วเรียงป้ายแบบตัวเลข PC-2 < PC-10 */
export function groupByCategory<T extends Pick<Equipment, 'label' | 'category'>>(equipment: T[]) {
  const groups = new Map<string, { category: T['category']; items: T[] }>();
  for (const item of equipment) {
    const group = groups.get(item.category.id) ?? { category: item.category, items: [] as T[] };
    group.items.push(item);
    groups.set(item.category.id, group);
  }
  return [...groups.values()].map((group) => ({ ...group, items: [...group.items].sort(byLabel) }));
}

/** คลาส grid ของการ์ดอุปกรณ์ — 2 คอลัมน์บนมือถือ ถึง 6 คอลัมน์บนจอกว้าง (ห้องละ 40 เครื่องยังดูได้ทั้งห้อง) */
export const equipmentGridClass =
  'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

/**
 * อุปกรณ์ในห้อง จัดเป็นหัวข้อตามประเภท — การ์ดละชิ้น กดเพื่อไปหน้าเครื่อง (ดูสถานะ / แจ้งซ่อมเครื่องนั้น)
 * แต่ละการ์ดบอกสถานะด้วย สี + ไอคอน + ข้อความ และ aria-label อ่านครบในประโยคเดียว
 */
export function EquipmentGrid({ equipment }: { equipment: EquipmentCardItem[] }) {
  const groups = groupByCategory(equipment);
  return (
    <div className="space-y-8">
      {groups.map(({ category, items }) => {
        const issues = items.filter((item) => item.state !== 'OK').length;
        return (
          <section key={category.id} aria-labelledby={`cat-${category.id}`} className="space-y-3">
            <h3
              id={`cat-${category.id}`}
              className="flex flex-wrap items-center gap-2 text-label-md text-on-surface"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container text-primary-container">
                <CategoryGlyph icon={category.icon} className="h-5 w-5" />
              </span>
              {category.name}
              <span className="font-normal text-on-surface-variant">
                {items.length} ชิ้น{issues > 0 ? ` · มีปัญหา ${issues}` : ''}
              </span>
            </h3>
            <ul className={equipmentGridClass}>
              {items.map((item) => (
                <li key={item.id}>
                  <EquipmentCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** การ์ดอุปกรณ์: รูป (หรือไอคอนประเภท) · ป้ายตัวใหญ่ · ชื่อ/รุ่น · ป้ายสถานะ */
export function EquipmentCard({ item }: { item: EquipmentCardItem }) {
  const style = STATE_STYLE[item.state];
  const affected = item.openRequest?.affectedCount ?? 0;
  const label = [
    item.label,
    item.name,
    EQUIPMENT_STATE_LABEL[item.state],
    item.openRequest ? `ใบ ${item.openRequest.code}` : null,
    affected > 1 ? `เดือดร้อน ${affected} คน` : null,
    item.isActive ? null : 'ปิดใช้งาน',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/equipment/${item.id}`}
      aria-label={label}
      title={label}
      className={`group relative flex h-full flex-col overflow-hidden rounded-lg bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container ${
        item.state === 'OK' ? 'border border-outline-variant/60' : style.tile
      } ${item.isActive ? '' : 'opacity-50'}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-container-low">
        {item.photoUrl ? (
          <img
            src={item.photoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <EquipmentPhotoFallback icon={item.category.icon} />
        )}
        {affected > 1 ? (
          <span
            className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-on-surface px-1.5 py-0.5 text-label-sm text-surface-container-lowest"
            aria-hidden="true"
          >
            <GroupIcon className="h-3 w-3" />
            {affected}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5" aria-hidden="true">
        <span className="truncate font-display text-body-lg font-bold leading-tight text-on-surface tabular-nums group-hover:text-primary-container">
          {item.label}
        </span>
        <span className="truncate text-label-sm font-normal text-on-surface-variant">{item.name}</span>
        <span className="mt-auto pt-1">
          {item.isActive ? (
            <EquipmentStateBadge state={item.state} className="max-w-full" />
          ) : (
            <span className="inline-flex rounded-full bg-surface-variant px-2.5 py-1 text-label-sm text-on-surface-variant">
              ปิดใช้งาน
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}
