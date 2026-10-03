'use client';

import { useRouter } from 'next/navigation';
import { useId, useTransition } from 'react';
import { inputClass } from '@/csmju';

export type RoomOption = { id: string; label: string; group: string };

/**
 * เลือกห้องของสถิติ — เปลี่ยนแล้วโหลดหน้าใหม่ทันที (?roomId=) โดยคงช่วงวันที่ที่เลือกไว้
 * ไม่มี JavaScript ก็ยังใช้ได้ผ่านปุ่ม "ดูสถิติ" ของฟอร์ม GET
 */
export function RoomPicker({
  rooms,
  value,
  range,
}: {
  rooms: RoomOption[];
  value: string;
  range: string | null;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();

  const groups = new Map<string, RoomOption[]>();
  for (const room of rooms) groups.set(room.group, [...(groups.get(room.group) ?? []), room]);

  const go = (roomId: string) => {
    const search = new URLSearchParams();
    if (range) search.set('range', range);
    if (roomId) search.set('roomId', roomId);
    const text = search.toString();
    startTransition(() => router.push(text ? `/dashboard?${text}` : '/dashboard'));
  };

  return (
    <form
      action="/dashboard"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        go(new FormData(event.currentTarget).get('roomId')?.toString() ?? '');
      }}
      className="flex w-full flex-col gap-1 sm:w-72"
    >
      <label htmlFor={id} className="text-label-sm text-on-surface-variant">
        ห้อง
      </label>
      {range ? <input type="hidden" name="range" value={range} /> : null}
      <select
        id={id}
        name="roomId"
        defaultValue={value}
        onChange={(event) => go(event.target.value)}
        aria-busy={pending || undefined}
        className={`${inputClass} min-h-11`}
      >
        <option value="">ทุกห้อง</option>
        {[...groups.entries()].map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((room) => (
              <option key={room.id} value={room.id}>
                {room.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <noscript>
        <button type="submit" className="mt-2 text-label-md text-primary-container underline">
          ดูสถิติ
        </button>
      </noscript>
    </form>
  );
}
