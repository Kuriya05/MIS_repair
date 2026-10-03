import Image from 'next/image';
import Link from 'next/link';
import { ChevronRightIcon, GroupIcon, ImageIcon, TONE_DOT_CLASS } from '@/csmju';
import { formatRelative, placeText } from '@/lib/format';
import { STATUS_TONE } from '@/lib/labels';
import type { RepairRequestSummary } from '@/lib/types';
import { PriorityTag, RequestStatusBadge, SlaIndicator } from './badges';

/**
 * รายการใบแจ้งซ่อมแบบการ์ดแถว (อ่านง่ายทั้งมือถือและจอใหญ่ — ข้อ 6.2 แนะนำการ์ดแทนตารางบนมือถือ)
 * showPeople = แสดงผู้แจ้ง/ช่าง (มุมมองของช่างและผู้ดูแล)
 * แถบสีซ้ายของแต่ละแถว = สีของสถานะงาน ไล่สายตาลงมาแล้วเห็นทันทีว่างานไหนรอรับ/กำลังทำ/เสร็จแล้ว
 */
export function RequestList({
  items,
  showPeople = false,
}: {
  items: RepairRequestSummary[];
  showPeople?: boolean;
}) {
  return (
    <ul className="divide-y divide-outline-variant/40">
      {items.map((request) => (
        <li key={request.id}>
          <Link
            href={`/requests/${request.id}`}
            className="group relative flex items-start gap-4 px-4 py-4 transition-colors hover:bg-surface/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-container md:px-6"
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${TONE_DOT_CLASS[STATUS_TONE[request.status]]}`}
            />
            <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container text-outline">
              {request.coverImageUrl ? (
                <Image
                  src={request.coverImageUrl}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6" />
              )}
            </span>
            <span className="min-w-0 flex-1 space-y-1.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-label-md text-primary-container tabular-nums">{request.code}</span>
                <span className="text-caption text-on-surface-variant">
                  {formatRelative(request.createdAt)}
                </span>
                {request.followerCount > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-primary-container/10 px-2 py-0.5 text-label-sm text-primary-container"
                    title="ผู้แจ้ง + คนที่กด “ฉันก็เจอ”"
                  >
                    <GroupIcon className="h-3.5 w-3.5" />
                    {request.followerCount + 1} คน
                  </span>
                ) : null}
                {request.followedByMe ? (
                  <span className="text-caption text-secondary">· คุณกด “ฉันก็เจอ”</span>
                ) : null}
              </span>
              <span className="block truncate text-body-md font-semibold text-on-surface">
                {request.equipment}
              </span>
              <span className="block truncate text-body-md text-on-surface-variant">
                {placeText(request.building.name, request.floor, request.location)}
              </span>
              {showPeople ? (
                <span className="block truncate text-caption text-secondary">
                  แจ้งโดย {request.reporter.displayName}
                  {request.assignee ? ` · ช่าง ${request.assignee.displayName}` : ' · ยังไม่มีช่างรับงาน'}
                </span>
              ) : request.assignee ? (
                <span className="block truncate text-caption text-secondary">
                  ช่างผู้รับผิดชอบ {request.assignee.displayName}
                </span>
              ) : null}
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
                <span className="flex flex-wrap gap-2">
                  <RequestStatusBadge status={request.status} />
                  <PriorityTag priority={request.priority} />
                </span>
                <SlaIndicator sla={request.sla} />
              </span>
            </span>
            <ChevronRightIcon className="mt-1 hidden h-5 w-5 shrink-0 text-outline transition-transform group-hover:translate-x-0.5 md:block" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
