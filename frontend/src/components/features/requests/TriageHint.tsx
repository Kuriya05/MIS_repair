'use client';

import { useState } from 'react';
import { CheckIcon, tonalButtonClass, WarningIcon } from '@/csmju';
import { PRIORITY_LABEL } from '@/lib/labels';
import { suggestTriage, type CategoryOption } from '@/lib/triage';
import type { Priority } from '@/lib/types';

/**
 * คำแนะนำหมวดหมู่/ความเร่งด่วนจากคำที่พิมพ์ (lib/triage.ts — กฎคำสำคัญในเครื่อง ไม่ส่งข้อความออกนอกระบบ)
 * แสดงเฉพาะเมื่อคำแนะนำต่างจากที่เลือกอยู่ · กดรับทีเดียวได้ทั้งสองค่า · ปิดทิ้งได้
 */
export function TriageHint({
  text,
  categories,
  categoryId,
  priority,
  onApply,
}: {
  text: string;
  categories: CategoryOption[];
  categoryId: string;
  priority: Priority;
  onApply: (next: { categoryId?: string; priority?: Priority }) => void;
}) {
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const suggestion = suggestTriage(text, categories);
  const category =
    suggestion.category && suggestion.category.value !== categoryId ? suggestion.category : null;
  const level = suggestion.priority && suggestion.priority !== priority ? suggestion.priority : null;
  const key = `${category?.value ?? ''}|${level ?? ''}`;
  if ((!category && !level) || dismissedFor === key) return null;

  const urgent = level === 'URGENT';
  return (
    <div
      role="status"
      className={`fade-slide-up flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
        urgent ? 'border-error/40 bg-error-container' : 'border-primary-container/20 bg-primary-fixed/40'
      }`}
    >
      <div className="min-w-0 space-y-1 text-body-md text-on-surface">
        <p className="flex items-center gap-2 text-label-md">
          {urgent ? <WarningIcon className="h-5 w-5 text-error" /> : null}
          ระบบแนะนำจากอาการที่พิมพ์
        </p>
        <ul className="space-y-0.5 text-on-surface-variant">
          {category ? <li>หมวดหมู่: {category.label}</li> : null}
          {level ? (
            <li>
              ความเร่งด่วน: <strong className="text-on-surface">{PRIORITY_LABEL[level]}</strong>
              {suggestion.reasons.length ? ` — เพราะ${suggestion.reasons.join(' · ')}` : ''}
            </li>
          ) : null}
        </ul>
        {urgent ? (
          <p className="text-on-error-container">
            ถ้ามีอันตรายต่อคน ให้ออกจากบริเวณนั้นและแจ้งเจ้าหน้าที่อาคารทันที
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => onApply({ categoryId: category?.value, priority: level ?? undefined })}
          className={tonalButtonClass}
        >
          <CheckIcon className="h-4 w-4" />
          ใช้คำแนะนำ
        </button>
        <button
          type="button"
          onClick={() => setDismissedFor(key)}
          className="px-3 text-label-md text-on-surface-variant hover:underline"
        >
          ไม่ใช้
        </button>
      </div>
    </div>
  );
}
