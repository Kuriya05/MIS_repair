import { AddIcon, ChatIcon, EditIcon, GroupIcon, HistoryIcon, PersonIcon, StarIcon, SwapIcon } from '@/csmju';
import { formatTimestamp } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/labels';
import type { RequestActivity } from '@/lib/types';

const ICON: Record<RequestActivity['type'], typeof HistoryIcon> = {
  CREATED: AddIcon,
  STATUS_CHANGED: SwapIcon,
  ASSIGNED: PersonIcon,
  UPDATED: EditIcon,
  COMMENT: ChatIcon,
  RATED: StarIcon,
  FOLLOWED: GroupIcon,
};

function headline(activity: RequestActivity) {
  const who = activity.actor.displayName;
  switch (activity.type) {
    case 'CREATED':
      return `${who} แจ้งซ่อม`;
    case 'STATUS_CHANGED':
      return `${who} เปลี่ยนสถานะเป็น “${activity.toStatus ? STATUS_LABEL[activity.toStatus] : ''}”`;
    case 'ASSIGNED':
      return `${who} มอบหมายงาน`;
    case 'UPDATED':
      return `${who} แก้ไขรายละเอียดงาน`;
    case 'COMMENT':
      return `${who} แสดงความคิดเห็น`;
    case 'RATED':
      return `${who} ให้คะแนนความพึงพอใจ`;
    case 'FOLLOWED':
      return `${who} พบปัญหาเดียวกัน (ฉันก็เจอ)`;
  }
}

/** ประวัติของใบแจ้งซ่อม (เก่า → ใหม่) — จุด timeline ล่าสุดใช้ brand-gradient (ข้อ 2.1) */
export function Timeline({ activities }: { activities: RequestActivity[] }) {
  return (
    <ol className="relative space-y-6">
      <span className="absolute bottom-2 left-3 top-2 w-0.5 bg-surface-container" aria-hidden="true" />
      {activities.map((activity, index) => {
        const Icon = ICON[activity.type];
        const latest = index === activities.length - 1;
        return (
          <li key={activity.id} className="relative flex gap-4">
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-4 border-surface-container-lowest ${
                latest ? 'brand-gradient text-white' : 'bg-surface-container text-primary-container'
              }`}
              aria-hidden="true"
            >
              <Icon className="h-3 w-3" strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-body-md text-on-surface">{headline(activity)}</p>
              <p className="text-caption text-on-surface-variant">
                <time dateTime={activity.createdAt}>{formatTimestamp(activity.createdAt)}</time>
              </p>
              {activity.message ? (
                <p
                  className={`whitespace-pre-line rounded-lg px-4 py-3 text-body-md ${
                    activity.type === 'COMMENT'
                      ? 'bg-surface text-on-surface'
                      : 'bg-surface text-on-surface-variant'
                  }`}
                >
                  {activity.message}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
