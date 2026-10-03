'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GroupIcon, InfoIcon, primaryButtonClass, secondaryButtonClass } from '@/csmju';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api, toQuery } from '@/lib/api';
import { floorLabel, formatRelative } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/labels';
import type { FollowState, SimilarRequest } from '@/lib/types';

const DEBOUNCE_MS = 500;

/**
 * "มีคนแจ้งเรื่องนี้แล้วหรือยัง" — ระหว่างกรอกฟอร์ม ค้นใบที่ยังเปิดอยู่ในอาคารเดียวกัน
 * (ห้อง/จุดมีคำเดียวกัน หรือเลขครุภัณฑ์ตรงกัน) แล้วให้กด "ฉันก็เจอ" ติดตามใบเดิมแทนการแจ้งซ้ำ
 * ช่างเห็นจำนวนคนที่เจอปัญหาเดียวกัน · ผู้กดได้รับการแจ้งเตือนความคืบหน้าเหมือนผู้แจ้ง
 */
export function SimilarRequests({
  buildingCode,
  location,
  assetNumber,
  onFollowed,
}: {
  buildingCode: string;
  location: string;
  assetNumber: string;
  /** กดติดตามสำเร็จ — ฟอร์มปิดการเตือนว่ามีข้อมูลค้างก่อนพาไปหน้าใบเดิม */
  onFollowed: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [matches, setMatches] = useState<SimilarRequest[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const query =
    buildingCode && (location.trim().length >= 2 || assetNumber.trim())
      ? toQuery({ buildingCode, location: location.trim(), assetNumber: assetNumber.trim() })
      : '';

  useEffect(() => {
    if (!query) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api<SimilarRequest[]>(`/api/v1/repair-requests/similar${query}`);
        if (!cancelled) {
          setMatches(data);
          setDismissed(false);
        }
      } catch {
        // ค้นไม่ได้ก็แจ้งซ่อมต่อได้ตามปกติ — ไม่รบกวนผู้ใช้
        if (!cancelled) setMatches([]);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  if (matches.length === 0 || dismissed) return null;

  const follow = async (match: SimilarRequest) => {
    setPending(match.id);
    try {
      const { data } = await api<FollowState>(`/api/v1/repair-requests/${match.id}/followers`, {
        method: 'POST',
      });
      toast.success(
        `ติดตาม ${match.code} แล้ว — มีคนเจอปัญหานี้ ${data.followerCount + 1} คน คุณจะได้รับแจ้งเมื่อมีความคืบหน้า`,
      );
      onFollowed();
      router.push(`/requests/${match.id}`);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'ติดตามไม่สำเร็จ');
      setPending(null);
    }
  };

  return (
    <section
      aria-live="polite"
      aria-label="ใบแจ้งซ่อมที่อาจเป็นเรื่องเดียวกัน"
      className="fade-slide-up space-y-3 rounded-xl border border-primary-container/30 bg-primary-fixed/40 p-4 md:p-5"
    >
      <p className="flex items-start gap-2 text-label-md text-on-surface">
        <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
        มีคนแจ้งเรื่องที่นี่ไว้แล้ว {matches.length} ใบ และยังไม่ปิดงาน — ถ้าเป็นเรื่องเดียวกัน กด “ฉันก็เจอ”
        แทนการแจ้งซ้ำ ช่างจะเห็นว่ามีคนเดือดร้อนหลายคน
      </p>
      <ul className="space-y-2">
        {matches.map((match) => (
          <li
            key={match.id}
            className="flex flex-col gap-3 rounded-lg bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="text-label-md text-on-surface">
                <Link href={`/requests/${match.id}`} className="hover:underline" target="_blank">
                  {match.code}
                </Link>{' '}
                · {match.equipment}
                {match.sameAsset ? (
                  <span className="ml-2 rounded-full bg-primary-container/10 px-2 py-0.5 text-label-sm text-primary-container">
                    ครุภัณฑ์ชิ้นเดียวกัน
                  </span>
                ) : null}
              </p>
              <p className="text-body-md text-on-surface-variant">
                {match.floor !== null ? `${floorLabel(match.floor)} · ` : ''}
                {match.location} · {match.category.name} · {STATUS_LABEL[match.status]} · แจ้ง{' '}
                {formatRelative(match.createdAt)}
              </p>
              {match.followerCount > 0 ? (
                <p className="flex items-center gap-1 text-caption text-on-surface-variant">
                  <GroupIcon className="h-4 w-4" />
                  มีคนเจอเหมือนกันแล้ว {match.followerCount} คน
                </p>
              ) : null}
            </div>
            {match.mine ? (
              <Link href={`/requests/${match.id}`} className={secondaryButtonClass}>
                ใบนี้คุณแจ้งไว้แล้ว — ดูความคืบหน้า
              </Link>
            ) : match.followedByMe ? (
              <Link href={`/requests/${match.id}`} className={secondaryButtonClass}>
                คุณติดตามใบนี้อยู่แล้ว
              </Link>
            ) : (
              <LoadingButton
                type="button"
                loading={pending === match.id}
                disabled={pending !== null}
                onClick={() => void follow(match)}
                className={`${primaryButtonClass} shrink-0`}
              >
                <GroupIcon className="h-4 w-4" />
                ฉันก็เจอ — ติดตามใบนี้
              </LoadingButton>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-label-md text-primary-container hover:underline"
      >
        ไม่ใช่เรื่องเดียวกัน แจ้งซ่อมใหม่ต่อ
      </button>
    </section>
  );
}
