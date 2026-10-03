'use client';

import Link from 'next/link';
import { BoardIcon, MenuIcon } from '@/csmju';
import type { RepairRequestSummary } from '@/lib/types';
import { BoardColumnsView } from './BoardColumnsView';
import { BoardFilterBar } from './BoardFilterBar';
import { BoardListView } from './BoardListView';
import { BoardNoteDialog } from './BoardNoteDialog';
import { boardHref, type BoardView, type BuildingOption } from './board-model';
import { useBoard } from './useBoard';

/**
 * บอร์ดงานซ่อม — สลับได้ 2 มุมมอง ใช้ข้อมูล ตัวกรอง และการเปลี่ยนสถานะชุดเดียวกัน (useBoard)
 *   แบบหัวข้อ (ค่าเริ่มต้น) = สรุปจำนวน + หัวข้อละสถานะ อ่านไล่ง่าย มีปุ่มขั้นถัดไปในแถว
 *   แบบคอลัมน์ (?view=columns) = คัมบังลากวาง
 */
export function RepairBoard({
  cards: initial,
  buildings,
  view,
  mine,
}: {
  cards: RepairRequestSummary[];
  buildings: BuildingOption[];
  view: BoardView;
  mine: boolean;
}) {
  const board = useBoard(initial, buildings);

  return (
    <div className="space-y-6">
      <ViewSwitch view={view} mine={mine} />
      <BoardFilterBar {...board.filters} />

      {view === 'columns' ? (
        <BoardColumnsView
          visible={board.visible}
          filtering={board.filters.filtering}
          pending={board.pending}
          onMove={board.request}
        />
      ) : (
        <BoardListView
          visible={board.visible}
          total={board.cards.length}
          filtering={board.filters.filtering}
          pending={board.pending}
          onMove={board.request}
        />
      )}

      <BoardNoteDialog move={board.asking} onClose={board.cancelNote} onConfirm={board.confirmNote} />
    </div>
  );
}

/** ตัวสลับมุมมอง (segmented control แบบลิงก์ — สถานะอยู่ใน URL ย้อนกลับ/แชร์ได้) */
function ViewSwitch({ view, mine }: { view: BoardView; mine: boolean }) {
  const options: { key: BoardView; label: string; icon: typeof MenuIcon }[] = [
    { key: 'list', label: 'แบบหัวข้อ', icon: MenuIcon },
    { key: 'columns', label: 'แบบคอลัมน์', icon: BoardIcon },
  ];
  return (
    <nav aria-label="รูปแบบการแสดงบอร์ด">
      <ul className="inline-flex gap-1 rounded-xl border border-outline-variant/40 bg-surface-container-low p-1">
        {options.map((option) => {
          const selected = option.key === view;
          const Icon = option.icon;
          return (
            <li key={option.key}>
              <Link
                href={boardHref({ mine, view: option.key })}
                scroll={false}
                aria-current={selected ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container ${
                  selected
                    ? 'bg-surface-container-lowest text-primary-container shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
                }`}
              >
                <Icon className="h-5 w-5" />
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
