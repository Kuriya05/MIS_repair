'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DownloadIcon, secondaryButtonClass } from '@/csmju';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api } from '@/lib/api';
import { floorLabel, formatDateTime } from '@/lib/format';
import { PRIORITY_LABEL, SLA_LABEL, STATUS_LABEL } from '@/lib/labels';
import type { RepairRequestSummary } from '@/lib/types';

const BOM = String.fromCharCode(0xfeff);

const FILTER_KEYS = [
  'q',
  'status',
  'state',
  'priority',
  'buildingCode',
  'categoryId',
  'sort',
  'assigneeCoreUserId',
];
const MAX_ROWS = 5000;

const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * ส่งออก CSV จากตัวกรองปัจจุบัน — ดึงผ่าน API รายการตามปกติทีละ 100 (ไม่มี endpoint พิเศษ)
 * ใส่ BOM ให้ Excel อ่านภาษาไทยได้ · วันที่เป็น พ.ศ. เวลาไทยเหมือนบนหน้าจอ
 */
export function CsvExportButton({
  scope,
  filename,
}: {
  scope: 'mine' | 'all' | 'assigned';
  filename: string;
}) {
  const params = useSearchParams();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = new URLSearchParams({ scope, limit: '100' });
      for (const key of FILTER_KEYS) {
        const value = params.get(key);
        if (value) base.set(key, value);
      }
      if (params.get('tab') === 'overdue') base.set('state', 'overdue');
      const rows: RepairRequestSummary[] = [];
      for (let page = 1; rows.length < MAX_ROWS; page++) {
        base.set('page', String(page));
        const { data, meta } = await api<RepairRequestSummary[]>(`/api/v1/repair-requests?${base}`);
        rows.push(...data);
        if (!meta || page >= meta.totalPages) break;
      }
      const header = [
        'เลขที่',
        'วันที่แจ้ง',
        'สิ่งที่ชำรุด',
        'อาคาร',
        'ชั้น',
        'สถานที่',
        'หมวดหมู่',
        'ความเร่งด่วน',
        'สถานะ',
        'ผู้แจ้ง',
        'ช่างผู้รับผิดชอบ',
        'กำหนดเสร็จ',
        'ซ่อมเสร็จเมื่อ',
        'SLA',
        'คะแนน',
      ];
      const lines = rows.map((r) =>
        [
          r.code,
          formatDateTime(r.createdAt),
          r.equipment,
          r.building.name,
          floorLabel(r.floor),
          r.location,
          r.category.name,
          PRIORITY_LABEL[r.priority],
          STATUS_LABEL[r.status],
          r.reporter.displayName,
          r.assignee?.displayName ?? '',
          formatDateTime(r.sla.dueAt),
          r.completedAt ? formatDateTime(r.completedAt) : '',
          SLA_LABEL[r.sla.state],
          r.rating ?? '',
        ]
          .map(cell)
          .join(','),
      );
      const blob = new Blob([`${BOM}${[header.join(','), ...lines].join('\r\n')}`], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`ส่งออก ${rows.length.toLocaleString('th-TH')} รายการแล้ว`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ส่งออกไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <LoadingButton onClick={run} loading={loading} className={secondaryButtonClass}>
        <DownloadIcon className="h-4 w-4" />
        ส่งออก CSV
      </LoadingButton>
      {error ? (
        <p role="alert" className="text-label-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
