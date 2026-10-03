import type { ComponentType } from 'react';
import { BlockIcon, BuildIcon, CheckIcon, PauseIcon, ScheduleIcon, type IconProps } from '@/csmju';
import { formatDateTime, formatDuration } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/labels';
import type { RepairRequestDetail, RequestStatus } from '@/lib/types';
import { SlaIndicator } from './badges';

type StepState = 'done' | 'active' | 'paused' | 'waiting' | 'upcoming' | 'stopped';
type Step = { label: string; at: string | null; state: StepState; note?: string | null };

type Source = Pick<
  RepairRequestDetail,
  'status' | 'createdAt' | 'acceptedAt' | 'completedAt' | 'updatedAt' | 'sla' | 'activities'
>;

const CLOSED: RequestStatus[] = ['COMPLETED', 'REJECTED', 'CANCELLED'];

/** เวลาครั้งแรก/ล่าสุดที่ใบเปลี่ยนเป็นสถานะนั้น จากประวัติ (activities เรียงเก่า → ใหม่) */
function firstAt(activities: Source['activities'], status: RequestStatus) {
  return activities.find((a) => a.toStatus === status)?.createdAt ?? null;
}
function last(activities: Source['activities'], status: RequestStatus) {
  return [...activities].reverse().find((a) => a.toStatus === status) ?? null;
}

/** คำนวณสถานะของแต่ละขั้น: แจ้งแล้ว → รับเรื่อง → กำลังซ่อม → เสร็จ */
export function buildSteps(request: Source): { steps: Step[]; terminated: boolean } {
  const { status, activities } = request;
  const startedAt = firstAt(activities, 'IN_PROGRESS');
  const base: Omit<Step, 'state'>[] = [
    { label: 'แจ้งแล้ว', at: request.createdAt },
    { label: 'รับเรื่อง', at: request.acceptedAt },
    { label: 'กำลังซ่อม', at: startedAt },
    { label: 'เสร็จ', at: request.completedAt },
  ];

  if (status === 'REJECTED' || status === 'CANCELLED') {
    // หยุดกลางทาง: ขั้นที่ผ่านมาแล้วเป็น done · ขั้นถัดไปแสดงเป็น "หยุด" พร้อมเหตุผลล่าสุด
    const reached = startedAt ? 2 : request.acceptedAt ? 1 : 0;
    const stop = last(activities, status);
    const steps = base.slice(0, reached + 1).map((step): Step => ({ ...step, state: 'done' }));
    steps.push({
      label: STATUS_LABEL[status],
      at: stop?.createdAt ?? request.completedAt ?? request.updatedAt,
      state: 'stopped',
      note: stop?.message ?? null,
    });
    return { steps, terminated: true };
  }

  const done = { PENDING: 1, ACCEPTED: 2, IN_PROGRESS: 2, ON_HOLD: 2, COMPLETED: 4 }[status];
  const current: StepState | null =
    status === 'IN_PROGRESS'
      ? 'active'
      : status === 'ON_HOLD'
        ? 'paused'
        : status === 'COMPLETED'
          ? null
          : 'waiting';
  const hold = status === 'ON_HOLD' ? last(activities, 'ON_HOLD') : null;
  const steps = base.map((step, index): Step => {
    if (index < done) return { ...step, state: 'done' };
    if (index === done && current) {
      return {
        ...step,
        state: current,
        at: current === 'paused' ? (hold?.createdAt ?? step.at) : step.at,
        note: current === 'paused' ? (hold?.message ?? null) : null,
      };
    }
    return { ...step, state: 'upcoming' };
  });
  return { steps, terminated: false };
}

const VIEW: Record<
  StepState,
  { icon: ComponentType<IconProps>; circle: string; text: string; caption: string }
> = {
  done: {
    icon: CheckIcon,
    circle: 'bg-primary-container text-on-primary',
    text: 'text-on-surface',
    caption: '',
  },
  active: {
    icon: BuildIcon,
    circle: 'bg-primary-fixed text-primary-container ring-4 ring-primary-container/20',
    text: 'text-primary-container',
    caption: 'กำลังดำเนินการ',
  },
  paused: {
    icon: PauseIcon,
    circle: 'bg-amber-100 text-amber-800 ring-4 ring-brand-amber/30',
    text: 'text-amber-800',
    caption: 'พักงาน / รออะไหล่',
  },
  waiting: {
    icon: ScheduleIcon,
    circle:
      'border-2 border-dashed border-primary-container bg-surface-container-lowest text-primary-container',
    text: 'text-on-surface',
    caption: 'รอดำเนินการ',
  },
  upcoming: {
    icon: ScheduleIcon,
    circle: 'border border-outline-variant bg-surface-container-lowest text-outline',
    text: 'text-on-surface-variant',
    caption: '',
  },
  stopped: {
    icon: BlockIcon,
    circle: 'bg-error-container text-on-error-container',
    text: 'text-on-error-container',
    caption: 'สิ้นสุดโดยไม่ได้ซ่อม',
  },
};

/**
 * แถบความคืบหน้าของใบแจ้งซ่อม — ผู้แจ้งเห็นทันทีว่างานอยู่ขั้นไหน และคาดว่าจะเสร็จเมื่อไร
 * แต่ละขั้นมีไอคอน + ข้อความ + เวลา (ไม่พึ่งสีอย่างเดียว) · ขั้นปัจจุบันมี aria-current="step"
 * แนวนอนบนจอกว้าง แนวตั้งบนมือถือ
 */
export function StatusStepper({ request }: { request: Source }) {
  const { steps, terminated } = buildSteps(request);
  const open = !CLOSED.includes(request.status);
  const currentIndex = steps.findIndex((step) => step.state !== 'done');

  return (
    <section
      aria-label="ความคืบหน้าของใบแจ้งซ่อม"
      className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm md:p-6"
    >
      <ol className="flex flex-col gap-4 sm:flex-row sm:gap-0">
        {steps.map((step, index) => {
          const view = VIEW[step.state];
          const Icon = view.icon;
          const isCurrent = index === currentIndex;
          const lineDone = index < steps.length - 1 && steps[index + 1].state !== 'upcoming';
          return (
            <li
              key={step.label}
              aria-current={isCurrent ? 'step' : undefined}
              className="relative flex flex-1 gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center"
            >
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`absolute left-5 top-10 -ml-px h-[calc(100%-1.5rem)] w-0.5 sm:left-[calc(50%+1.5rem)] sm:top-5 sm:ml-0 sm:h-0.5 sm:w-[calc(100%-3rem)] ${
                    lineDone ? 'bg-primary-container' : 'bg-outline-variant'
                  }`}
                />
              ) : null}
              <span
                className={`relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${view.circle}`}
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 space-y-0.5 pb-1">
                <span className={`block text-label-md ${view.text}`}>
                  {step.label}
                  <span className="sr-only">
                    {' — '}
                    {step.state === 'done' ? 'เสร็จแล้ว' : view.caption || 'ยังไม่ถึง'}
                  </span>
                </span>
                {view.caption ? (
                  <span className={`block text-label-sm ${view.text}`} aria-hidden="true">
                    {view.caption}
                  </span>
                ) : null}
                {step.at && step.state !== 'upcoming' && step.state !== 'waiting' ? (
                  <span className="block text-caption text-on-surface-variant">
                    {formatDateTime(step.at)}
                  </span>
                ) : null}
                {step.note ? (
                  <span className="block max-w-xs text-caption text-on-surface-variant sm:mx-auto">
                    “{step.note}”
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-col gap-1 border-t border-outline-variant/40 pt-4 text-body-md sm:flex-row sm:items-center sm:justify-between">
        {open ? (
          <>
            <p className="text-on-surface">
              คาดว่าจะเสร็จภายใน <strong className="tabular-nums">{formatDateTime(request.sla.dueAt)}</strong>
              <span className="text-on-surface-variant">
                {' '}
                (เป้าหมาย {formatDuration(request.sla.targetHours * 60)})
              </span>
            </p>
            <SlaIndicator sla={request.sla} />
          </>
        ) : terminated ? (
          <p className="text-on-surface-variant">
            ใบนี้ปิดแล้วโดยไม่ได้ซ่อม — ถ้ายังพบปัญหาอยู่ แจ้งซ่อมใหม่ได้
          </p>
        ) : (
          <>
            <p className="text-on-surface">
              ซ่อมเสร็จเมื่อ{' '}
              <strong className="tabular-nums">
                {request.completedAt ? formatDateTime(request.completedAt) : '—'}
              </strong>
            </p>
            <SlaIndicator sla={request.sla} />
          </>
        )}
      </div>
    </section>
  );
}
