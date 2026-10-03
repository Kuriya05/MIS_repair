'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GroupIcon, secondaryButtonClass, tonalButtonClass } from '@/csmju';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api } from '@/lib/api';
import type { FollowState } from '@/lib/types';

/**
 * จำนวนคนที่เจอปัญหาเดียวกัน + ปุ่ม "ฉันก็เจอ" / เลิกติดตาม บนหน้าใบแจ้งซ่อม
 * ปุ่มแสดงเฉพาะคนที่กดได้ (backend ส่ง canFollow / followedByMe มา) — ผู้แจ้งและช่างเห็นแค่จำนวน
 */
export function FollowButton({
  requestId,
  followerCount,
  followedByMe,
  canFollow,
}: {
  requestId: string;
  followerCount: number;
  followedByMe: boolean;
  canFollow: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState({ followerCount, followedByMe });
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const { data } = await api<FollowState>(
        state.followedByMe
          ? `/api/v1/repair-requests/${requestId}/followers/me`
          : `/api/v1/repair-requests/${requestId}/followers`,
        { method: state.followedByMe ? 'DELETE' : 'POST' },
      );
      setState({ followerCount: data.followerCount, followedByMe: data.followedByMe });
      toast.success(
        data.followedByMe ? 'ติดตามแล้ว — คุณจะได้รับแจ้งเมื่อมีความคืบหน้า' : 'เลิกติดตามใบแจ้งซ่อมนี้แล้ว',
      );
      router.refresh();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const affected = state.followerCount + 1;
  const showButton = state.followedByMe || canFollow;
  if (state.followerCount === 0 && !showButton) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {state.followerCount > 0 ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-container/10 px-3 py-1 text-label-md text-primary-container"
          title="ผู้แจ้ง + คนที่กด “ฉันก็เจอ”"
        >
          <GroupIcon className="h-4 w-4" />
          เดือดร้อน {affected} คน
        </span>
      ) : null}
      {showButton ? (
        <LoadingButton
          type="button"
          loading={busy}
          onClick={() => void toggle()}
          className={state.followedByMe ? secondaryButtonClass : tonalButtonClass}
          aria-pressed={state.followedByMe}
        >
          <GroupIcon className="h-4 w-4" />
          {state.followedByMe ? 'เลิกติดตาม' : 'ฉันก็เจอ'}
        </LoadingButton>
      ) : null}
    </div>
  );
}
