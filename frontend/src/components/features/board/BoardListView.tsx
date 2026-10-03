'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDownIcon, LocationIcon, secondaryButtonClass, tonalButtonClass, WarningIcon } from '@/csmju';
import { EmptyState } from '@/components/shared/EmptyState';
import { PriorityTag } from '@/components/features/requests/badges';
import { formatNumber } from '@/lib/format';
import type { RepairRequestSummary, RequestStatus } from '@/lib/types';
import { AssigneeMark, FollowerChip, SlaChip } from './BoardChips';
import {
  BOARD_STATUSES,
  byLatestDone,
  DONE_PREVIEW,
  nextStepsOf,
  roomLineOf,
  symptomOf,
  titleOf,
} from './board-model';

const sectionId = (status: RequestStatus) => `board-sec-${status}`;

/**
 * บอร์ดแบบหัวข้อ — แถบสรุปจำนวนตามสถานะ (กดเพื่อข้ามไปหัวข้อนั้น) + หัวข้อละสถานะ
 * แต่ละงานเป็นแถวเดียวอ่านง่าย: ซ้าย = เครื่อง/ห้อง/อาการ · ขวา = ความเร่งด่วน กำหนดเสร็จ ช่าง และปุ่มขั้นถัดไป
 */
export function BoardListView({
  visible,
  total,
  filtering,
  pending,
  onMove,
}: {
  visible: RepairRequestSummary[];
  total: number;
  filtering: boolean;
  pending: string | null;
  onMove: (card: RepairRequestSummary, to: RequestStatus) => void;
}) {
  const [showAllDone, setShowAllDone] = useState(false);

  const groups = BOARD_STATUSES.map((meta) => {
    const all = visible.filter((card) => card.status === meta.status);
    return {
      meta,
      all: meta.status === 'COMPLETED' ? [...all].sort(byLatestDone) : all,
      overdue: all.filter((card) => card.sla.state === 'OVERDUE').length,
    };
  });

  return (
    <div className="space-y-10">
      <nav aria-label="สรุปจำนวนงานตามสถานะ">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {groups.map(({ meta, all, overdue }) => {
            const Icon = meta.icon;
            return (
              <li key={meta.status} className={meta.status === 'COMPLETED' ? 'col-span-2 sm:col-span-1' : ''}>
                <a
                  href={`#${sectionId(meta.status)}`}
                  className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm transition-[box-shadow,border-color] hover:border-outline-variant hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
                >
                  <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${meta.accent}`} />
                  <span className="flex items-center gap-2 text-label-md text-on-surface-variant">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.soft} ${meta.ink}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    {meta.label}
                    {meta.status === 'COMPLETED' ? (
                      <span className="font-normal text-on-surface-variant">(ล่าสุด)</span>
                    ) : null}
                  </span>
                  <span className="font-display text-headline-lg tabular-nums text-on-surface">
                    {formatNumber(all.length)}
                    <span className="sr-only"> งาน</span>
                  </span>
                  {overdue > 0 ? (
                    <span className="inline-flex items-center gap-1 text-label-sm text-error">
                      <WarningIcon className="h-4 w-4 shrink-0" />
                      เกินกำหนด {formatNumber(overdue)}
                    </span>
                  ) : (
                    <span className="text-caption text-on-surface-variant">{meta.hint}</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest">
          <EmptyState
            title="ยังไม่มีงานแจ้งซ่อม"
            description="เมื่อมีผู้แจ้งซ่อม งานใหม่จะขึ้นในหัวข้อ “รอรับเรื่อง” ให้กดรับเรื่องได้ทันที"
          />
        </div>
      ) : (
        groups.map(({ meta, all }) => {
          const Icon = meta.icon;
          const done = meta.status === 'COMPLETED';
          const items = done && !showAllDone ? all.slice(0, DONE_PREVIEW) : all;
          const headingId = `${sectionId(meta.status)}-title`;
          return (
            <section
              key={meta.status}
              id={sectionId(meta.status)}
              aria-labelledby={headingId}
              className="scroll-mt-24 space-y-4"
            >
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={`h-9 w-1 shrink-0 rounded-full ${meta.accent}`} />
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.soft} ${meta.ink}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h2
                  id={headingId}
                  className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-headline-md text-on-surface"
                >
                  {meta.label}
                  <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-body text-label-md tabular-nums text-on-surface-variant">
                    {formatNumber(all.length)}
                    <span className="sr-only"> งาน</span>
                  </span>
                  {done ? (
                    <span className="font-body text-caption text-on-surface-variant">งานที่ปิดล่าสุด</span>
                  ) : null}
                </h2>
              </div>

              {all.length === 0 ? (
                <p className="pl-4 text-body-md text-on-surface-variant">
                  {filtering ? 'ไม่มีงานที่ตรงกับตัวกรอง' : 'ไม่มีงาน'}
                </p>
              ) : (
                <ul className="grid gap-3 xl:grid-cols-2">
                  {items.map((card) => (
                    <JobRow
                      key={card.id}
                      card={card}
                      busy={pending === card.id}
                      onMove={(to) => onMove(card, to)}
                    />
                  ))}
                </ul>
              )}

              {done && all.length > DONE_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setShowAllDone((value) => !value)}
                  aria-expanded={showAllDone}
                  className={secondaryButtonClass}
                >
                  <ChevronDownIcon
                    className={`h-4 w-4 transition-transform ${showAllDone ? 'rotate-180' : ''}`}
                  />
                  {showAllDone ? 'แสดงเฉพาะล่าสุด' : `ดูทั้งหมด (${formatNumber(all.length)})`}
                </button>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}

/** แถวงาน 1 ใบ — ทั้งแถวกดไปหน้าใบแจ้งซ่อม (ลิงก์ที่ชื่อขยายเต็มแถว) ปุ่มขั้นถัดไปอยู่เหนือลิงก์ */
function JobRow({
  card,
  busy,
  onMove,
}: {
  card: RepairRequestSummary;
  busy: boolean;
  onMove: (to: RequestStatus) => void;
}) {
  const steps = nextStepsOf(card);
  const overdue = card.sla.state === 'OVERDUE';
  return (
    <li>
      <article
        aria-busy={busy}
        className={`relative flex h-full flex-col gap-4 rounded-xl border bg-surface-container-lowest p-4 shadow-sm transition-[box-shadow,border-color,opacity] hover:shadow-md md:flex-row md:items-center md:gap-6 md:p-5 xl:flex-col xl:items-stretch xl:gap-4 ${
          overdue
            ? 'border-error/40 border-l-4 border-l-error'
            : 'border-outline-variant/40 hover:border-outline-variant'
        } ${busy ? 'animate-pulse opacity-70' : ''}`}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-label-sm tabular-nums text-on-surface-variant">
            {card.code}
            <span aria-hidden="true"> · </span>
            <span className="font-normal">{card.category.name}</span>
          </p>
          <h3 className="text-body-lg font-semibold leading-snug text-on-surface">
            <Link
              href={`/requests/${card.id}`}
              className="rounded after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:text-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
            >
              {titleOf(card)}
            </Link>
          </h3>
          <p className="flex items-center gap-1.5 text-body-md text-on-surface-variant">
            <LocationIcon className="h-4 w-4 shrink-0 text-outline" />
            <span className="truncate">{roomLineOf(card)}</span>
          </p>
          <p className="line-clamp-1 text-body-md text-outline">{symptomOf(card)}</p>
        </div>

        <div className="flex flex-col gap-3 md:max-w-sm md:items-end xl:max-w-none xl:items-stretch">
          <div className="flex flex-wrap items-center gap-2 md:justify-end xl:justify-start">
            <PriorityTag priority={card.priority} />
            <SlaChip sla={card.sla} />
            <FollowerChip count={card.followerCount} />
            <AssigneeMark assignee={card.assignee} />
          </div>
          {steps.length > 0 ? (
            <div
              role="group"
              aria-label={`ขั้นถัดไปของ ${card.code}`}
              className="flex flex-wrap gap-2 md:justify-end xl:justify-start"
            >
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <button
                    key={step.action}
                    type="button"
                    disabled={busy}
                    onClick={() => onMove(step.to)}
                    className={`${index === 0 ? tonalButtonClass : secondaryButtonClass} z-10`}
                  >
                    <StepIcon className="h-4 w-4" />
                    {step.label}
                    <span className="sr-only"> {card.code}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </article>
    </li>
  );
}
