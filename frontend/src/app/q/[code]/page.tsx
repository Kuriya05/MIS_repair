import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AddIcon,
  ApartmentIcon,
  cardClass,
  primaryButtonClass,
  QrCodeIcon,
  secondaryButtonClass,
} from '@/csmju';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { EmptyState } from '@/components/shared/EmptyState';
import { serverApi } from '@/lib/server-api';
import type { QrTarget } from '@/lib/types';

export const metadata: Metadata = { title: 'สแกน QR แจ้งซ่อม' };

const CODE = /^[A-HJ-NP-Z2-9]{8}$/;

function normalize(raw: string) {
  try {
    return decodeURIComponent(raw).replace(/[\s-]/g, '').toUpperCase();
  } catch {
    return '';
  }
}

/** ปลายทางของสติกเกอร์ QR (ห้องหรือเครื่อง) — หาว่าเป็นของอะไรแล้วพาไปหน้านั้นทันที */
export default async function QrLandingPage(props: PageProps<'/q/[code]'>) {
  const code = normalize((await props.params).code);
  if (!CODE.test(code)) return <UnknownQr />;

  const result = await serverApi<QrTarget>(`/api/v1/qr-codes/${code}`);
  if (!result.ok) {
    if (result.status === 404 || result.status === 400) return <UnknownQr />;
    return <ApiFailure result={result} />;
  }
  redirect(result.data.kind === 'equipment' ? `/equipment/${result.data.id}` : `/rooms/${result.data.id}`);
}

function UnknownQr() {
  return (
    <div className={cardClass}>
      <EmptyState
        icon={QrCodeIcon}
        title="ไม่พบสติกเกอร์ QR นี้"
        description="สติกเกอร์อาจถูกยกเลิกไปแล้ว หรือเครื่อง/ห้องถูกลบออกจากระบบ เลือกห้องเองจากรายการอาคาร หรือแจ้งซ่อมโดยกรอกสถานที่เองได้"
        action={
          <>
            <Link href="/buildings" className={secondaryButtonClass}>
              <ApartmentIcon className="h-4 w-4" />
              เลือกจากรายการอาคาร
            </Link>
            <Link href="/requests/new" className={primaryButtonClass}>
              <AddIcon className="h-4 w-4" />
              แจ้งซ่อม
            </Link>
          </>
        }
      />
    </div>
  );
}
