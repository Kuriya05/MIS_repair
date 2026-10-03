import { TONE_DOT_CLASS, type StatusTone } from '@/csmju';
import { formatDate, formatMonth, formatNumber } from '@/lib/format';

/**
 * กราฟแบบ SVG ไม่พึ่งไลบรารี — palette ตาม ui-design-system.md ข้อ 3.8 (chart-1, chart-2 …)
 * ทุกกราฟมีตารางข้อมูลซ่อนไว้ให้ screen reader และชุดที่ 2 มีเส้นประกำกับเผื่อพิมพ์ขาวดำ
 */
type Point = { period: string; created: number; completed: number };

export function TrendChart({ points, granularity }: { points: Point[]; granularity: 'day' | 'month' }) {
  const width = 720;
  const height = 240;
  const padding = { top: 16, right: 8, bottom: 32, left: 36 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...points.flatMap((p) => [p.created, p.completed]));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const niceMax = Math.ceil(max / step) * step;
  const slot = plotW / Math.max(points.length, 1);
  const bar = Math.max(2, Math.min(14, slot / 2 - 2));
  const label = (period: string) =>
    granularity === 'month'
      ? formatMonth(period)
      : formatDate(`${period}T12:00:00+07:00`).replace(/ \d{4}$/, '');
  const every = Math.ceil(points.length / 8);
  const y = (value: number) => padding.top + plotH - (value / niceMax) * plotH;

  return (
    <figure className="space-y-3">
      <div className="-mx-2 overflow-x-auto px-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[640px]"
          role="img"
          aria-label="กราฟจำนวนงานที่แจ้งเข้าและซ่อมเสร็จ"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const value = Math.round(niceMax * ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y(value)}
                  y2={y(value)}
                  className="stroke-surface-variant"
                  strokeWidth={1}
                />
                <text
                  x={padding.left - 6}
                  y={y(value) + 4}
                  textAnchor="end"
                  className="fill-on-surface-variant text-[13px] tabular-nums"
                >
                  {value}
                </text>
              </g>
            );
          })}
          {points.map((point, index) => {
            const x = padding.left + index * slot + slot / 2;
            return (
              <g key={point.period}>
                <rect
                  x={x - bar - 1}
                  y={y(point.created)}
                  width={bar}
                  height={Math.max(0, padding.top + plotH - y(point.created))}
                  rx={2}
                  className="fill-chart-1"
                >
                  <title>{`${label(point.period)}: แจ้งเข้า ${point.created}`}</title>
                </rect>
                <rect
                  x={x + 1}
                  y={y(point.completed)}
                  width={bar}
                  height={Math.max(0, padding.top + plotH - y(point.completed))}
                  rx={2}
                  className="fill-chart-2 stroke-on-surface/40"
                  strokeDasharray="2 2"
                  strokeWidth={point.completed > 0 ? 0.8 : 0}
                >
                  <title>{`${label(point.period)}: ซ่อมเสร็จ ${point.completed}`}</title>
                </rect>
                {index % every === 0 ? (
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-on-surface-variant text-[13px]"
                  >
                    {label(point.period)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-4 text-label-sm text-on-surface-variant">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-chart-1" aria-hidden="true" /> แจ้งเข้า
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm border border-dashed border-on-surface/40 bg-chart-2"
            aria-hidden="true"
          />{' '}
          ซ่อมเสร็จ
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>จำนวนงานแจ้งเข้าและซ่อมเสร็จ</caption>
        <thead>
          <tr>
            <th scope="col">ช่วงเวลา</th>
            <th scope="col">แจ้งเข้า</th>
            <th scope="col">ซ่อมเสร็จ</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.period}>
              <th scope="row">{label(point.period)}</th>
              <td>{point.created}</td>
              <td>{point.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** แท่งแนวนอนพร้อมตัวเลขกำกับ (ไม่สื่อความหมายด้วยสีอย่างเดียว) */
export function BarList({
  items,
  emptyText = 'ยังไม่มีข้อมูลในช่วงนี้',
}: {
  items: { label: string; value: number; hint?: string; tone?: StatusTone }[];
  emptyText?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (items.every((item) => item.value === 0)) {
    return <p className="py-6 text-center text-body-md text-on-surface-variant">{emptyText}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-body-md">
            <span className="min-w-0 truncate text-on-surface">{item.label}</span>
            <span className="shrink-0 text-label-md text-on-surface tabular-nums">
              {formatNumber(item.value)}
              {item.hint ? (
                <span className="ml-1 font-normal text-on-surface-variant">{item.hint}</span>
              ) : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-container" aria-hidden="true">
            <div
              className={`h-full rounded-full ${item.tone ? TONE_DOT_CLASS[item.tone] : 'bg-chart-1'}`}
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * แถบสัดส่วนเล็ก ๆ "x จาก y" (เช่น เครื่องเสีย 3 จาก 30) — ตัวเลขอยู่ข้างแถบเสมอ แถบเป็นแค่ภาพประกอบ
 * tone กำหนดสีแถบ · ค่า 0 แสดงแถบว่างพร้อมตัวเลข
 */
export function RatioBar({
  value,
  total,
  label,
  tone = 'error',
}: {
  value: number;
  total: number;
  label: string;
  tone?: StatusTone;
}) {
  const percent = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="flex min-w-32 items-center gap-3">
      <span className="shrink-0 text-label-md tabular-nums text-on-surface">
        {formatNumber(value)}
        <span className="font-normal text-on-surface-variant">/{formatNumber(total)}</span>
        <span className="sr-only"> {label}</span>
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container" aria-hidden="true">
        {value > 0 ? (
          <span
            className={`block h-full rounded-full ${TONE_DOT_CLASS[tone]}`}
            style={{ width: `${Math.max(4, percent)}%` }}
          />
        ) : null}
      </span>
    </div>
  );
}
