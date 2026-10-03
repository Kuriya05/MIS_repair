'use client';

import { CloseIcon, FilterIcon, inputClass, SearchIcon, secondaryButtonClass } from '@/csmju';
import { formatNumber } from '@/lib/format';
import type { BoardFilters } from './useBoard';

/** แถบตัวกรองของบอร์ด (ใช้ทั้งแบบหัวข้อและแบบคอลัมน์) */
export function BoardFilterBar({
  query,
  onQuery,
  building,
  onBuilding,
  buildings,
  overdueOnly,
  onOverdueOnly,
  overdueTotal,
  shown,
  total,
  filtering,
  onClear,
}: BoardFilters) {
  return (
    <div
      role="search"
      aria-label="กรองงานบนบอร์ด"
      className="flex flex-col gap-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm md:p-5 lg:flex-row lg:items-end"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor="board-q" className="block text-label-sm text-on-surface-variant">
          ค้นหา
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
          <input
            id="board-q"
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="เลขที่ สิ่งที่ชำรุด ห้อง หรือชื่อช่าง"
            autoComplete="off"
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>
      <div className="space-y-1.5 lg:w-64">
        <label htmlFor="board-building" className="block text-label-sm text-on-surface-variant">
          อาคาร
        </label>
        <select
          id="board-building"
          value={building}
          onChange={(event) => onBuilding(event.target.value)}
          className={inputClass}
        >
          <option value="">ทุกอาคาร</option>
          {buildings.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-outline-variant px-3 py-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-container">
        <input
          type="checkbox"
          role="switch"
          checked={overdueOnly}
          onChange={(event) => onOverdueOnly(event.target.checked)}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
            overdueOnly ? 'bg-error' : 'bg-outline-variant'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${
              overdueOnly ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </span>
        <span className="text-label-md text-on-surface">
          เฉพาะเกินกำหนด
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-label-sm tabular-nums ${
              overdueTotal > 0 ? 'bg-error-container text-on-error-container' : 'bg-surface-variant'
            }`}
          >
            {formatNumber(overdueTotal)}
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3 lg:min-h-11">
        <p className="text-caption tabular-nums text-on-surface-variant" aria-live="polite">
          <FilterIcon className="mr-1 inline h-4 w-4 align-text-bottom" />
          {filtering
            ? `แสดง ${formatNumber(shown)} จาก ${formatNumber(total)} งาน`
            : `${formatNumber(total)} งาน`}
        </p>
        {filtering ? (
          <button type="button" onClick={onClear} className={secondaryButtonClass}>
            <CloseIcon className="h-4 w-4" />
            ล้างตัวกรอง
          </button>
        ) : null}
      </div>
    </div>
  );
}
