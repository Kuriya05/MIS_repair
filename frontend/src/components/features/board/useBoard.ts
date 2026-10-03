'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useToast } from '@/components/shared/Toast';
import { api } from '@/lib/api';
import { STATUS_LABEL } from '@/lib/labels';
import type { RepairRequestDetail, RepairRequestSummary, RequestStatus } from '@/lib/types';
import { BOARD_STATUSES, searchText, type BuildingOption, type Move } from './board-model';

/**
 * สถานะและการกระทำที่ทั้งสองมุมมองของบอร์ดใช้ร่วมกัน
 * - ตัวกรอง (ค้นหา · อาคาร · เกินกำหนด) กรองในเครื่อง ไม่ยิง API ซ้ำ
 * - ย้ายสถานะแบบ optimistic แล้วคืนค่าเดิมเมื่อ API ไม่สำเร็จ
 * - พักงาน/ปิดงานถามหมายเหตุก่อน (asking → NoteDialog)
 */
export function useBoard(initial: RepairRequestSummary[], buildings: BuildingOption[]) {
  const router = useRouter();
  const toast = useToast();
  const [cards, setCards] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);
  const [asking, setAsking] = useState<Move | null>(null);
  const [query, setQuery] = useState('');
  const [building, setBuilding] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const buildingOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of buildings) map.set(b.code, b.name);
    for (const card of initial)
      if (!map.has(card.building.code)) map.set(card.building.code, card.building.name);
    return [...map.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [buildings, initial]);

  const text = query.trim().toLowerCase();
  const filtering = Boolean(text || building || overdueOnly);
  const visible = cards.filter(
    (card) =>
      (!building || card.building.code === building) &&
      (!overdueOnly || card.sla.state === 'OVERDUE') &&
      (!text || searchText(card).includes(text)),
  );
  const overdueTotal = cards.filter((card) => card.sla.state === 'OVERDUE').length;

  const clearFilters = () => {
    setQuery('');
    setBuilding('');
    setOverdueOnly(false);
  };

  const perform = async (move: Move, note?: string) => {
    const { card, to, action } = move;
    const before = cards;
    setPending(card.id);
    setCards((current) => current.map((c) => (c.id === card.id ? { ...c, status: to } : c)));
    try {
      const path =
        action === 'accept'
          ? `/api/v1/repair-requests/${card.id}/accept`
          : `/api/v1/repair-requests/${card.id}/status`;
      const { data } = await api<RepairRequestDetail>(path, {
        method: 'POST',
        ...(action === 'accept' ? {} : { json: { status: to, ...(note ? { note } : {}) } }),
      });
      setCards((current) => current.map((c) => (c.id === card.id ? { ...c, ...data } : c)));
      toast.success(`${card.code} → ${STATUS_LABEL[to]}`);
      router.refresh();
    } catch (failure) {
      setCards(before);
      toast.error(failure instanceof Error ? failure.message : 'เปลี่ยนสถานะงานไม่สำเร็จ');
    } finally {
      setPending(null);
    }
  };

  /** ขอย้ายการ์ดไปสถานะ to — ตรวจสิทธิ์จาก allowedActions ก่อน · พักงาน/ปิดงานเปิดกล่องหมายเหตุ */
  const request = (card: RepairRequestSummary, to: RequestStatus) => {
    const column = BOARD_STATUSES.find((c) => c.status === to);
    if (!column?.action || !card.allowedActions.includes(column.action) || card.status === to) return;
    const move = { card, to, action: column.action };
    if (column.action === 'hold' || column.action === 'complete') setAsking(move);
    else void perform(move);
  };

  const confirmNote = (note?: string) => {
    if (asking) void perform(asking, note);
    setAsking(null);
  };

  return {
    cards,
    visible,
    pending,
    asking,
    cancelNote: () => setAsking(null),
    confirmNote,
    request,
    filters: {
      query,
      onQuery: setQuery,
      building,
      onBuilding: setBuilding,
      buildings: buildingOptions,
      overdueOnly,
      onOverdueOnly: setOverdueOnly,
      overdueTotal,
      shown: visible.length,
      total: cards.length,
      filtering,
      onClear: clearFilters,
    },
  };
}

export type BoardFilters = ReturnType<typeof useBoard>['filters'];
