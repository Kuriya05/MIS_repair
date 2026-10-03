import { Avatar, CheckCircleIcon, GroupIcon, ScheduleIcon, WarningIcon } from '@/csmju';
import { formatDuration, formatNumber } from '@/lib/format';
import { SLA_LABEL } from '@/lib/labels';
import type { RepairRequestSummary } from '@/lib/types';

const chipBase = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-label-sm';

/** กำหนดเสร็จแบบสั้น — เกินกำหนด (แดง) · ใกล้ครบกำหนด (ส้ม) · เหลือ x (เทา) · มีไอคอน + ข้อความเสมอ */
export function SlaChip({ sla }: { sla: RepairRequestSummary['sla'] }) {
  const left = sla.minutesLeft ?? 0;
  const view = {
    OVERDUE: {
      icon: WarningIcon,
      className: 'bg-error-container text-on-error-container',
      text: `เกินกำหนด ${formatDuration(left)}`,
    },
    AT_RISK: {
      icon: ScheduleIcon,
      className: 'bg-amber-100 text-amber-800',
      text: `${SLA_LABEL.AT_RISK} · เหลือ ${formatDuration(left)}`,
    },
    ON_TRACK: {
      icon: ScheduleIcon,
      className: 'bg-surface-container text-on-surface-variant',
      text: `เหลือ ${formatDuration(left)}`,
    },
    MET: { icon: CheckCircleIcon, className: 'bg-success/10 text-emerald-700', text: SLA_LABEL.MET },
    MISSED: { icon: WarningIcon, className: 'bg-amber-100 text-amber-800', text: SLA_LABEL.MISSED },
    CLOSED: null,
  }[sla.state];
  if (!view) return null;
  const Icon = view.icon;
  return (
    <span className={`${chipBase} ${view.className}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="sr-only">กำหนดเสร็จ </span>
      {view.text}
    </span>
  );
}

/** จำนวนคนที่เดือดร้อน = ผู้แจ้ง + คนที่กด "ฉันก็เจอ" */
export function FollowerChip({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className={`${chipBase} bg-primary-container/10 text-primary-container`}
      title="ผู้แจ้ง + คนที่กด “ฉันก็เจอ”"
    >
      <GroupIcon className="h-4 w-4 shrink-0" />
      เดือดร้อน {formatNumber(count + 1)} คน
    </span>
  );
}

/** ช่างผู้รับผิดชอบ — avatar อักษรย่อ (ชื่อเต็มอยู่ใน title และ screen reader) */
export function AssigneeMark({
  assignee,
  showName = false,
}: {
  assignee: RepairRequestSummary['assignee'];
  showName?: boolean;
}) {
  if (!assignee)
    return <span className="whitespace-nowrap text-caption text-on-surface-variant">ยังไม่มีช่าง</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2" title={`ช่าง ${assignee.displayName}`}>
      <Avatar name={assignee.displayName} src={assignee.avatarUrl} size={28} />
      <span className={showName ? 'truncate text-caption text-on-surface-variant' : 'sr-only'}>
        <span className="sr-only">ช่างผู้รับผิดชอบ </span>
        {assignee.displayName}
      </span>
    </span>
  );
}
