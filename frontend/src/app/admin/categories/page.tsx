import type { Metadata } from 'next';
import { cardClass, PageHeader } from '@/csmju';
import { CatalogManager } from '@/components/features/admin/CatalogManager';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { serverApi } from '@/lib/server-api';
import type { Category } from '@/lib/types';

export const metadata: Metadata = { title: 'ประเภทอุปกรณ์' };

/** ประเภทอุปกรณ์ = หมวดหมู่งานซ่อม — ใช้จัดเครื่องในห้อง ปุ่มอาการในฟอร์มแจ้งซ่อม บอร์ดงาน และสถิติ */
export default async function CategoriesPage() {
  const result = await serverApi<Category[]>('/api/v1/categories?limit=100');
  if (!result.ok) return <ApiFailure result={result} />;
  return (
    <>
      <PageHeader
        title="จัดการประเภทอุปกรณ์"
        description="ประเภทของเครื่องในห้อง พร้อมอาการที่พบบ่อยที่ผู้แจ้งกดเลือกได้ทันที ใช้จัดกลุ่มอุปกรณ์ บอร์ดงาน และสถิติ"
      />
      <section className={cardClass} aria-label="รายการประเภทอุปกรณ์">
        <CatalogManager items={result.data} />
      </section>
    </>
  );
}
