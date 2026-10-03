'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GroupIcon, tonalButtonClass } from '@/csmju';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api, ApiRequestError } from '@/lib/api';
import type { FollowState } from '@/lib/types';

/**
 * "ฉันก็เจอ" จากหน้าเครื่อง/หน้าห้อง — ติดตามใบเดิมแทนการแจ้งซ้ำ แล้วพาไปดูความคืบหน้าของใบนั้น
 * ถ้า backend ตอบ 409 (เป็นผู้แจ้งเอง/กดไว้แล้ว) ก็พาไปหน้าใบนั้นเหมือนกัน
 */
export function FollowAndOpenButton({
  requestId,
  code,
  className = tonalButtonClass,
  label = 'ฉันก็เจอ',
}: {
  requestId: string;
  code: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const follow = async () => {
    setBusy(true);
    try {
      const { data } = await api<FollowState>(`/api/v1/repair-requests/${requestId}/followers`, {
        method: 'POST',
      });
      toast.success(
        `ติดตาม ${code} แล้ว — มีคนเจอปัญหานี้ ${data.followerCount + 1} คน คุณจะได้รับแจ้งเมื่อมีความคืบหน้า`,
      );
      router.push(`/requests/${requestId}`);
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.code === 'CONFLICT') {
        router.push(`/requests/${requestId}`);
        return;
      }
      toast.error(failure instanceof Error ? failure.message : 'ติดตามไม่สำเร็จ');
      setBusy(false);
    }
  };

  return (
    <LoadingButton type="button" loading={busy} onClick={() => void follow()} className={className}>
      <GroupIcon className="h-4 w-4" />
      {label}
    </LoadingButton>
  );
}
