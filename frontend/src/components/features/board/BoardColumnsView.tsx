'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ChevronDownIcon, LocationIcon, secondaryButtonClass, SwapIcon } from '@/csmju';
import { PriorityTag } from '@/components/features/requests/badges';
import { formatNumber } from '@/lib/format';
import type { RepairRequestSummary, RequestStatus } from '@/lib/types';
import { AssigneeMark, FollowerChip, SlaChip } from './BoardChips';
import {
  BOARD_STATUSES,
  byLatestDone,
  DONE_PREVIEW,
  metaOf,
  roomLineOf,
  symptomOf,
  targetsOf,
  titleOf,
} from './board-model';

/**
 * บอร์ดแบบคอลัมน์ (ลากวาง) — ลากการ์ดข้ามคอลัมน์เพื่อเปลี่ยนสถานะ
 * คอลัมน์ที่วางได้สว่างขึ้นตามสิทธิ์ของผู้ใช้กับการ์ดใบนั้น (allowedActions จาก backend)
 * ใช้คีย์บอร์ด/มือถือได้ผ่านปุ่มเมนู "ย้าย" บนการ์ด
 */
export function BoardColumnsView({
  visible,
  filtering,
  pending,
  onMove,
}: {
  visible: RepairRequestSummary[];
  filtering: boolean;
  pending: string | null;
  onMove: (card: RepairRequestSummary, to: RequestStatus) => void;
}) {
  const [dragging, setDragging] = useState<RepairRequestSummary | null>(null);
  const [over, setOver] = useState<RequestStatus | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);

  const allowedTargets = new Set(dragging ? targetsOf(dragging).map((c) => c.status) : []);

  const onDrop = (event: DragEvent, to: RequestStatus) => {
    event.preventDefault();
    setOver(null);
    if (dragging) onMove(dragging, to);
    setDragging(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-caption text-on-surface-variant">
        ลากการ์ดไปคอลัมน์อื่นเพื่อเปลี่ยนสถานะ หรือกดปุ่ม{' '}
        <SwapIcon className="inline h-4 w-4 align-text-bottom" /> “ย้าย” บนการ์ด
        (ใช้ได้ทั้งคีย์บอร์ดและมือถือ)
      </p>

      <div className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 pb-4 md:mx-0 md:snap-none md:px-0">
        <div className="grid auto-cols-[minmax(18rem,1fr)] grid-flow-col gap-4">
          {BOARD_STATUSES.map((column) => {
            const Icon = column.icon;
            const done = column.status === 'COMPLETED';
            const all = visible.filter((card) => card.status === column.status);
            const ordered = done ? [...all].sort(byLatestDone) : all;
            const items = done && !showAllDone ? ordered.slice(0, DONE_PREVIEW) : ordered;
            const droppable = allowedTargets.has(column.status);
            const headingId = `board-col-${column.status}`;
            return (
              <section
                key={column.status}
                aria-labelledby={headingId}
                onDragOver={(event) => {
                  if (!droppable) return;
                  event.preventDefault();
                  setOver(column.status);
                }}
                onDragLeave={() => setOver((current) => (current === column.status ? null : current))}
                onDrop={(event) => onDrop(event, column.status)}
                className={`flex h-[calc(100dvh-18rem)] min-h-[26rem] snap-start flex-col overflow-hidden rounded-xl border-2 transition-colors duration-150 ${
                  over === column.status
                    ? 'border-primary-container bg-primary-fixed/50'
                    : droppable
                      ? 'border-dashed border-primary-container/60 bg-primary-fixed/20'
                      : dragging
                        ? 'border-transparent bg-surface-container-low opacity-60'
                        : 'border-transparent bg-surface-container-low'
                }`}
              >
                <header className="relative shrink-0 border-b border-outline-variant/40 bg-surface-container-lowest px-4 pb-3 pt-4">
                  <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${column.accent}`} />
                  <h2 id={headingId} className="flex items-center gap-2 font-display text-body-lg font-bold">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${column.soft} ${column.ink}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-on-surface">{column.label}</span>
                    <span className="ml-auto inline-flex min-w-7 items-center justify-center rounded-full bg-surface-container px-2 py-0.5 font-body text-label-sm tabular-nums text-on-surface-variant">
                      {formatNumber(all.length)}
                      <span className="sr-only"> งาน</span>
                    </span>
                  </h2>
                  <p
                    className={`mt-1 text-caption ${droppable ? 'font-semibold text-primary-container' : 'text-on-surface-variant'}`}
                    aria-live="polite"
                  >
                    {droppable ? column.drop : column.hint}
                  </p>
                </header>
                <ul className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
                  {items.map((card) => (
                    <BoardCard
                      key={card.id}
                      card={card}
                      busy={pending === card.id}
                      onDragStart={() => setDragging(card)}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onMove={(to) => onMove(card, to)}
                    />
                  ))}
                  {all.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-outline-variant/70 px-4 py-8 text-center text-caption text-on-surface-variant">
                      {filtering ? 'ไม่มีงานที่ตรงกับตัวกรอง' : column.empty}
                    </li>
                  ) : null}
                  {done && ordered.length > DONE_PREVIEW ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => setShowAllDone((value) => !value)}
                        aria-expanded={showAllDone}
                        className={`${secondaryButtonClass} w-full`}
                      >
                        {showAllDone ? 'แสดงเฉพาะล่าสุด' : `ดูทั้งหมด (${formatNumber(ordered.length)})`}
                      </button>
                    </li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BoardCard({
  card,
  busy,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  card: RepairRequestSummary;
  busy: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (to: RequestStatus) => void;
}) {
  const targets = targetsOf(card);
  const draggable = targets.length > 0 && !busy;
  return (
    <li
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', card.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      aria-busy={busy}
      className={`relative space-y-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-sm transition-[transform,box-shadow,opacity] ${
        card.sla.state === 'OVERDUE' ? 'border-l-4 border-l-error' : ''
      } ${draggable ? 'cursor-grab hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing' : ''} ${
        busy ? 'animate-pulse opacity-70' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/requests/${card.id}`}
          className="rounded text-label-sm tabular-nums text-primary-container hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
        >
          {card.code}
        </Link>
        <PriorityTag priority={card.priority} />
      </div>
      <p className="line-clamp-2 text-body-md font-semibold leading-snug text-on-surface">{titleOf(card)}</p>
      <p className="flex items-center gap-1 text-caption text-on-surface-variant">
        <LocationIcon className="h-4 w-4 shrink-0 text-outline" />
        <span className="truncate">{roomLineOf(card)}</span>
      </p>
      <p className="line-clamp-1 text-caption text-outline">{symptomOf(card)}</p>
      {card.sla.state !== 'CLOSED' || card.followerCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <SlaChip sla={card.sla} />
          <FollowerChip count={card.followerCount} />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 border-t border-outline-variant/40 pt-2.5">
        <AssigneeMark assignee={card.assignee} showName />
        {targets.length > 0 ? (
          <MoveMenu code={card.code} targets={targets.map((t) => t.status)} disabled={busy} onMove={onMove} />
        ) : null}
      </div>
    </li>
  );
}

/** เมนูย้ายสถานะแบบกะทัดรัด — ทางเลือกของการลากวางสำหรับคีย์บอร์ด/มือถือ (WAI-ARIA menu button) */
function MoveMenu({
  code,
  targets,
  disabled,
  onMove,
}: {
  code: string;
  targets: RequestStatus[];
  disabled: boolean;
  onMove: (to: RequestStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  };

  const onMenuKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`ย้าย ${code} ไปสถานะอื่น`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-outline-variant/60 px-2.5 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container disabled:opacity-40"
      >
        <SwapIcon className="h-4 w-4" />
        ย้าย
        <ChevronDownIcon className="h-4 w-4" />
      </button>
      {open ? (
        <ul
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={`ย้าย ${code} ไป`}
          onKeyDown={onMenuKey}
          className="fade-slide-up absolute bottom-full right-0 z-20 mb-1 w-56 overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-lowest py-1 shadow-xl"
        >
          {targets.map((status) => {
            const meta = metaOf(status);
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <li key={status} role="none">
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    close();
                    onMove(status);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-body-md text-on-surface hover:bg-primary-container/10 focus:bg-primary-container/10 focus:outline-none"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${meta.soft} ${meta.ink}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {meta.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
