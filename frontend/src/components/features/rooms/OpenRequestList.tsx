import Link from 'next/link';
import { GroupIcon, secondaryButtonClass } from '@/csmju';
import { RequestStatusBadge } from '@/components/features/requests/badges';
import { formatRelative } from '@/lib/format';
import type { RoomDetail } from '@/lib/types';
import { FollowAndOpenButton } from './FollowAndOpenButton';

type OpenRequest = RoomDetail['roomRequests'][number];

/** ใบที่ยังไม่ปิดของห้อง (ไม่ผูกเครื่อง) — ให้กด "ฉันก็เจอ" แทนการแจ้งเรื่องเดิมซ้ำ */
export function OpenRequestList({ requests, canFollow }: { requests: OpenRequest[]; canFollow: boolean }) {
  return (
    <ul className="divide-y divide-outline-variant/40">
      {requests.map((request) => (
        <li
          key={request.id}
          className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-label-md text-on-surface">
              <span className="tabular-nums text-primary-container">{request.code}</span>
              <span>{request.equipment}</span>
              <RequestStatusBadge status={request.status} />
            </p>
            <p className="flex flex-wrap items-center gap-x-3 text-caption text-on-surface-variant">
              <span>แจ้ง {formatRelative(request.createdAt)}</span>
              {request.affectedCount > 1 ? (
                <span className="inline-flex items-center gap-1">
                  <GroupIcon className="h-3.5 w-3.5" />
                  เดือดร้อน {request.affectedCount} คน
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={`/requests/${request.id}`} className={secondaryButtonClass}>
              ดูใบแจ้งซ่อม
            </Link>
            {canFollow ? <FollowAndOpenButton requestId={request.id} code={request.code} /> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
