import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowBackIcon, CsmjuLogo, secondaryButtonClass } from '@/csmju';
import { OriginQrCode } from '@/components/features/OriginQrCode';
import { PrintButton } from '@/components/features/PrintButton';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { floorLabel, formatDateTime } from '@/lib/format';
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/labels';
import { serverApi } from '@/lib/server-api';
import type { RepairRequestDetail } from '@/lib/types';

export const metadata: Metadata = { title: 'พิมพ์ใบงานซ่อม' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** ใบงานซ่อม A4 สำหรับช่างถือไปหน้างาน / แนบเอกสารตรวจรับ — ส่วนหัวและเมนูของ AppShell ไม่ถูกพิมพ์ */
export default async function PrintWorkOrderPage(props: PageProps<'/requests/[id]/print'>) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const result = await serverApi<RepairRequestDetail>(`/api/v1/repair-requests/${id}`);
  if (!result.ok) return <ApiFailure result={result} />;
  const r = result.data;
  const lastNote = [...r.activities].reverse().find((a) => a.type === 'STATUS_CHANGED' && a.message)?.message;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/requests/${r.id}`} className={secondaryButtonClass}>
          <ArrowBackIcon className="h-4 w-4" />
          กลับไปที่ใบแจ้งซ่อม
        </Link>
        <PrintButton label="พิมพ์ใบงาน" />
      </div>

      <article className="print-sheet mx-auto max-w-3xl space-y-6 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-on-surface shadow-sm">
        <header className="flex items-start justify-between gap-6 border-b border-outline-variant pb-6">
          <div className="space-y-3">
            <CsmjuLogo />
            <div>
              <h1 className="font-display text-headline-md">ใบงานซ่อม</h1>
              <p className="text-body-md text-on-surface-variant">
                ระบบแจ้งซ่อม สาขาวิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยแม่โจ้
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <p className="font-display text-headline-md tabular-nums">{r.code}</p>
            <OriginQrCode path={`/requests/${r.id}`} size={96} label={`QR ลิงก์ไปยังใบแจ้งซ่อม ${r.code}`} />
            <p className="text-caption text-on-surface-variant">สแกนเพื่ออัปเดตสถานะ</p>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-body-md">
          <Row label="วันที่แจ้ง">{formatDateTime(r.createdAt)}</Row>
          <Row label="กำหนดเสร็จ">{formatDateTime(r.sla.dueAt)}</Row>
          <Row label="ความเร่งด่วน">{PRIORITY_LABEL[r.priority]}</Row>
          <Row label="สถานะ ณ เวลาพิมพ์">{STATUS_LABEL[r.status]}</Row>
          <Row label="อาคาร">
            {r.building.name}
            {r.floor !== null ? ` · ${floorLabel(r.floor)}` : ''}
          </Row>
          <Row label="ห้อง / จุด">{r.room ? `${r.room.code} ${r.room.name}` : r.location}</Row>
          <Row label="สิ่งที่ชำรุด">{r.item ? `${r.item.label} · ${r.item.name}` : r.equipment}</Row>
          <Row label="หมวดหมู่ / เลขครุภัณฑ์">
            {r.category.name}
            {r.assetNumber ? ` · ${r.assetNumber}` : ''}
          </Row>
          <div className="col-span-2 space-y-1">
            <dt className="text-label-sm text-on-surface-variant">อาการที่แจ้ง</dt>
            <dd className="whitespace-pre-line">{r.description}</dd>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-6 border-t border-outline-variant pt-6 text-body-md">
          <div className="space-y-1">
            <h2 className="text-label-md">ผู้แจ้ง</h2>
            <p>{r.reporter.displayName}</p>
            {r.reporter.personCode && r.reporter.nameFromCoreHub ? (
              <p className="text-on-surface-variant">รหัส {r.reporter.personCode}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <h2 className="text-label-md">ช่างผู้รับผิดชอบ</h2>
            <p>{r.assignee?.displayName ?? '................................................'}</p>
            {r.acceptedAt ? (
              <p className="text-on-surface-variant">รับเรื่อง {formatDateTime(r.acceptedAt)}</p>
            ) : null}
          </div>
        </div>

        <section className="space-y-3 border-t border-outline-variant pt-6" aria-labelledby="work-notes">
          <h2 id="work-notes" className="text-label-md">
            บันทึกการซ่อม
          </h2>
          {lastNote ? <p className="text-body-md text-on-surface-variant">ล่าสุด: {lastNote}</p> : null}
          {['สาเหตุที่พบ', 'สิ่งที่ดำเนินการ', 'วัสดุ/อะไหล่ที่ใช้'].map((label) => (
            <div key={label} className="space-y-2">
              <p className="text-label-sm text-on-surface-variant">{label}</p>
              <div className="h-8 border-b border-dotted border-outline" />
              <div className="h-8 border-b border-dotted border-outline" />
            </div>
          ))}
        </section>

        <section className="grid grid-cols-3 gap-6 pt-8 text-center text-body-md" aria-label="ลายมือชื่อ">
          {['ผู้แจ้ง', 'ช่างผู้ซ่อม', 'ผู้ตรวจรับงาน'].map((role) => (
            <div key={role} className="space-y-2">
              <div className="h-12 border-b border-outline" />
              <p>({role})</p>
              <p className="text-caption text-on-surface-variant">วันที่ ....../....../......</p>
            </div>
          ))}
        </section>

        <footer className="border-t border-outline-variant pt-4 text-caption text-on-surface-variant">
          พิมพ์เมื่อ {formatDateTime(new Date())} จากระบบแจ้งซ่อม CSMJU
        </footer>
      </article>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-label-sm text-on-surface-variant">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
