import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, secondaryButtonClass, tonalButtonClass } from '@/csmju';
import { BoardActivity } from '@/components/features/board/BoardActivity';
import { RepairBoard } from '@/components/features/board/RepairBoard';
import { boardHref } from '@/components/features/board/board-model';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { ForbiddenState } from '@/components/shared/ForbiddenState';
import { can, P } from '@/lib/permissions';
import { forwardQuery, serverApi } from '@/lib/server-api';
import { getMe } from '@/lib/session';
import type { Building, Notification, RepairRequestSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'บอร์ดงานซ่อม' };

/**
 * บอร์ดงานสำหรับช่าง/ผู้ดูแล — งานที่ยังไม่ปิดทั้งหมด (เรียงตามกำหนดเสร็จ) + งานที่ปิดล่าสุด
 * ?view=columns = แบบคอลัมน์ลากวาง · ไม่ระบุ = แบบหัวข้อ (ค่าเริ่มต้น อ่านไล่ง่าย)
 * ?mine=1 = เฉพาะงานที่ฉันรับผิดชอบ (ยังเห็น "รอรับเรื่อง" เพื่อหยิบงานใหม่)
 * เป็นหน้างานหลักหน้าเดียวของช่าง/ผู้ดูแล (แทนคิวงานเดิม) — ความเคลื่อนไหวล่าสุดอยู่ในแผงที่เปิดจากปุ่มบนหัวหน้า
 */
export default async function BoardPage(props: PageProps<'/board'>) {
  const params = await props.searchParams;
  const me = await getMe();
  if (me.ok && !can(me.data, P.JOB_ACCEPT))
    return <ForbiddenState message="บอร์ดงานซ่อมมีเฉพาะช่างซ่อมบำรุงและผู้ดูแลระบบ" />;
  const mine = params.mine === '1';
  const view = params.view === 'columns' ? 'columns' : 'list';

  const [pending, open, done, buildings, activity, unread] = await Promise.all([
    serverApi<RepairRequestSummary[]>(
      `/api/v1/repair-requests${forwardQuery({}, [], { scope: 'all', status: 'PENDING', sort: 'due', limit: '100' })}`,
    ),
    serverApi<RepairRequestSummary[]>(
      `/api/v1/repair-requests${forwardQuery({}, [], { scope: mine ? 'assigned' : 'all', state: 'open', sort: 'due', limit: '100' })}`,
    ),
    serverApi<RepairRequestSummary[]>(
      `/api/v1/repair-requests${forwardQuery({}, [], { scope: mine ? 'assigned' : 'all', status: 'COMPLETED', sort: 'updated', limit: '20' })}`,
    ),
    // ตัวเลือกอาคารของตัวกรอง — โหลดไม่ได้ก็ยังใช้อาคารจากการ์ดบนบอร์ดแทน
    serverApi<Building[]>('/api/v1/buildings?limit=100'),
    // ความเคลื่อนไหวล่าสุด — โหลดไม่ได้ก็ยังใช้บอร์ดได้ แผงจะแจ้งให้รีเฟรช
    serverApi<Notification[]>('/api/v1/notifications?limit=15'),
    serverApi<Notification[]>('/api/v1/notifications?isRead=false&limit=1'),
  ]);
  for (const result of [pending, open, done]) if (!result.ok) return <ApiFailure result={result} />;

  const byId = new Map<string, RepairRequestSummary>();
  for (const result of [pending, open, done])
    if (result.ok) for (const row of result.data) byId.set(row.id, row);
  const cards = [...byId.values()];

  return (
    <>
      <PageHeader
        title="บอร์ดงานซ่อม"
        description="งานแจ้งซ่อมที่ยังไม่เสร็จ แยกตามสถานะ เรียงตามกำหนดเสร็จ — กดปุ่มในแต่ละงานเพื่อรับเรื่อง เริ่มซ่อม รออะไหล่ หรือปิดงาน"
        actions={
          <>
            <BoardActivity
              items={activity.ok ? activity.data : []}
              unread={unread.ok ? (unread.meta?.total ?? 0) : 0}
              failed={!activity.ok}
            />
            <div className="flex gap-2" role="group" aria-label="แสดงงาน">
              <Link
                href={boardHref({ mine: false, view })}
                aria-current={!mine ? 'page' : undefined}
                className={!mine ? tonalButtonClass : secondaryButtonClass}
              >
                ทั้งหมด
              </Link>
              <Link
                href={boardHref({ mine: true, view })}
                aria-current={mine ? 'page' : undefined}
                className={mine ? tonalButtonClass : secondaryButtonClass}
              >
                งานของฉัน
              </Link>
            </div>
          </>
        }
      />
      <RepairBoard
        key={mine ? 'mine' : 'all'}
        cards={cards}
        view={view}
        mine={mine}
        buildings={buildings.ok ? buildings.data.map((b) => ({ code: b.code, name: b.name })) : []}
      />
    </>
  );
}
