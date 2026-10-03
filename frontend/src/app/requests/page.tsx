import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AddIcon,
  AssignmentIcon,
  cardClass,
  PageHeader,
  primaryButtonClass,
  SearchIcon,
  secondaryButtonClass,
} from '@/csmju';
import { CsvExportButton } from '@/components/features/requests/CsvExportButton';
import { RequestFilters } from '@/components/features/requests/RequestFilters';
import { RequestList } from '@/components/features/requests/RequestList';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { forwardQuery, serverApi } from '@/lib/server-api';
import { getCatalog } from '@/lib/session';
import type { RepairRequestSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'ใบแจ้งซ่อมของฉัน' };

const FILTERS = ['q', 'status', 'state', 'priority', 'buildingCode', 'categoryId', 'sort', 'page'] as const;

export default async function MyRequestsPage(props: PageProps<'/requests'>) {
  const params = await props.searchParams;
  const [result, catalog] = await Promise.all([
    serverApi<RepairRequestSummary[]>(
      `/api/v1/repair-requests${forwardQuery(params, FILTERS, { scope: 'mine' })}`,
    ),
    getCatalog(false),
  ]);
  if (!result.ok) return <ApiFailure result={result} />;
  const filtered = FILTERS.some((key) => key !== 'page' && key !== 'sort' && params[key]);

  return (
    <>
      <PageHeader
        title="ใบแจ้งซ่อมของฉัน"
        description="ติดตามสถานะงานซ่อมที่คุณแจ้งไว้ แสดงความคิดเห็นถึงช่าง และให้คะแนนเมื่อซ่อมเสร็จ"
        actions={
          <Link href="/requests/new" className={primaryButtonClass}>
            <AddIcon className="h-4 w-4" />
            แจ้งซ่อม
          </Link>
        }
      />
      <section className={cardClass} aria-label="รายการใบแจ้งซ่อม">
        <div className="flex flex-col gap-4 border-b border-outline-variant/40 px-4 py-5 md:px-6">
          <RequestFilters buildings={catalog.buildingOptions} categories={catalog.categoryOptions} />
          {result.data.length > 0 ? (
            <div className="flex justify-end">
              <CsvExportButton scope="mine" filename="ใบแจ้งซ่อมของฉัน" />
            </div>
          ) : null}
        </div>
        {result.data.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchIcon}
              title="ไม่พบใบแจ้งซ่อมที่ตรงกับตัวกรอง"
              description="ลองเปลี่ยนคำค้นหรือล้างตัวกรองเพื่อดูรายการทั้งหมด"
              action={
                <Link href="/requests" className={secondaryButtonClass}>
                  ล้างตัวกรอง
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={AssignmentIcon}
              title="ยังไม่มีใบแจ้งซ่อม"
              description="เมื่อพบอุปกรณ์หรือห้องที่ชำรุด แจ้งซ่อมได้ทันที ระบบจะแจ้งเตือนเมื่อช่างรับเรื่องและซ่อมเสร็จ"
              action={
                <Link href="/requests/new" className={primaryButtonClass}>
                  <AddIcon className="h-4 w-4" />
                  แจ้งซ่อม
                </Link>
              }
            />
          )
        ) : (
          <>
            <RequestList items={result.data} />
            {result.meta ? <Pagination meta={result.meta} pathname="/requests" params={params} /> : null}
          </>
        )}
      </section>
    </>
  );
}
