'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useState, useTransition } from 'react';
import { inputClass, SearchIcon, secondaryButtonClass } from '@/csmju';
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from '@/lib/labels';

export type FilterOption = { value: string; label: string };

/**
 * แถบค้นหา/ตัวกรองของรายการใบแจ้งซ่อม — เก็บค่าใน URL (แชร์ลิงก์/ย้อนกลับได้) และให้ backend กรอง/เรียงเสมอ
 * มือถือซ้อนแนวตั้ง · จอกว้างเป็นแถวเดียว (ข้อ 6.2)
 */
export function RequestFilters({
  buildings,
  categories,
  showSort = true,
  showState = true,
  preserve = [],
}: {
  buildings: FilterOption[];
  categories: FilterOption[];
  showSort?: boolean;
  showState?: boolean;
  /** คีย์ใน URL ที่ไม่ใช่ตัวกรอง (เช่น tab) — คงไว้ตอนล้างตัวกรอง */
  preserve?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');
  const ids = {
    q: useId(),
    status: useId(),
    priority: useId(),
    building: useId(),
    category: useId(),
    sort: useId(),
  };

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('page');
    const text = next.toString();
    startTransition(() => router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    const current = params.get('q') ?? '';
    if (q.trim() === current) return;
    const timer = window.setTimeout(() => update({ q: q.trim() }), 350);
    return () => window.clearTimeout(timer);
    // ค้นหาเมื่อพิมพ์หยุดเท่านั้น — ไม่ผูกกับ params/update เพื่อไม่ให้ยิงซ้ำเมื่อ URL เปลี่ยนจากตัวกรองอื่น
  }, [q]);

  const statusValue = params.get('status')
    ? `status:${params.get('status')}`
    : params.get('state')
      ? `state:${params.get('state')}`
      : '';
  const hasFilters = ['q', 'status', 'state', 'priority', 'buildingCode', 'categoryId'].some((key) =>
    params.get(key),
  );

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end" aria-busy={pending}>
      <div className="min-w-0 flex-1 space-y-1 md:min-w-64">
        <label htmlFor={ids.q} className="block text-label-sm text-on-surface-variant">
          ค้นหา
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
          <input
            id={ids.q}
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="เลขที่ สิ่งที่ชำรุด สถานที่ หรือเลขครุภัณฑ์"
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>
      {showState ? (
        <Select
          id={ids.status}
          label="สถานะ"
          value={statusValue}
          onChange={(value) => {
            const [kind, raw] = value.split(':');
            update({ status: kind === 'status' ? raw : '', state: kind === 'state' ? raw : '' });
          }}
          options={[
            { value: '', label: 'ทุกสถานะ' },
            { value: 'state:open', label: 'ยังไม่ปิดงาน' },
            { value: 'state:overdue', label: 'เกินกำหนด' },
            { value: 'state:closed', label: 'ปิดงานแล้ว' },
            ...STATUSES.map((status) => ({ value: `status:${status}`, label: STATUS_LABEL[status] })),
          ]}
        />
      ) : null}
      <Select
        id={ids.priority}
        label="ความเร่งด่วน"
        value={params.get('priority') ?? ''}
        onChange={(value) => update({ priority: value })}
        options={[
          { value: '', label: 'ทุกระดับ' },
          ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] })),
        ]}
      />
      <Select
        id={ids.building}
        label="อาคาร"
        value={params.get('buildingCode') ?? ''}
        onChange={(value) => update({ buildingCode: value })}
        options={[{ value: '', label: 'ทุกอาคาร' }, ...buildings]}
      />
      <Select
        id={ids.category}
        label="หมวดหมู่"
        value={params.get('categoryId') ?? ''}
        onChange={(value) => update({ categoryId: value })}
        options={[{ value: '', label: 'ทุกหมวดหมู่' }, ...categories]}
      />
      {showSort ? (
        <Select
          id={ids.sort}
          label="เรียงตาม"
          value={params.get('sort') ?? ''}
          onChange={(value) => update({ sort: value })}
          options={[
            { value: '', label: 'แจ้งล่าสุดก่อน' },
            { value: 'due', label: 'ใกล้ครบกำหนดก่อน' },
            { value: 'priority', label: 'ด่วนที่สุดก่อน' },
            { value: 'updated', label: 'อัปเดตล่าสุด' },
            { value: 'oldest', label: 'แจ้งเก่าสุดก่อน' },
          ]}
        />
      ) : null}
      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            setQ('');
            const kept = new URLSearchParams();
            for (const key of preserve) {
              const value = params.get(key);
              if (value) kept.set(key, value);
            }
            const text = kept.toString();
            startTransition(() => router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false }));
          }}
          className={secondaryButtonClass}
        >
          ล้างตัวกรอง
        </button>
      ) : null}
    </div>
  );
}

function Select({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1 md:w-48">
      <label htmlFor={id} className="block text-label-sm text-on-surface-variant">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
