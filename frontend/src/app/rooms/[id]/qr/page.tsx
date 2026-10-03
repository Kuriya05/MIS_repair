import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowBackIcon, PageHeader, secondaryButtonClass } from '@/csmju';
import { OriginQrCode } from '@/components/features/OriginQrCode';
import { PrintButton } from '@/components/features/PrintButton';
import { groupByCategory } from '@/components/features/rooms/EquipmentGrid';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { floorLabel } from '@/lib/format';
import { serverApi } from '@/lib/server-api';
import type { RoomDetail } from '@/lib/types';

export const metadata: Metadata = { title: 'พิมพ์สติกเกอร์ QR' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** แสดงรหัส 8 ตัวเป็น 2 กลุ่มให้อ่านออกเสียง/พิมพ์เองได้ง่าย เช่น K7QM-4TZP */
const shortCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/**
 * แผ่นสติกเกอร์ QR ของห้อง — 1 ดวงสำหรับห้อง (ติดที่ประตู) + 1 ดวงต่อเครื่องที่เปิดใช้งาน
 * QR พาไปที่ /q/<รหัส> แล้วระบบพาต่อไปหน้าห้อง/หน้าเครื่อง · พิมพ์เฉพาะแผ่นสติกเกอร์ (เมนูไม่ถูกพิมพ์)
 */
export default async function RoomQrSheetPage(props: PageProps<'/rooms/[id]/qr'>) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const result = await serverApi<RoomDetail>(`/api/v1/rooms/${id}`);
  if (!result.ok) return <ApiFailure result={result} />;
  const room = result.data;
  const items = groupByCategory(room.equipment.filter((item) => item.isActive)).flatMap((g) => g.items);
  const place = [room.building.name, floorLabel(room.floor)].filter(Boolean).join(' · ');

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/rooms/${room.id}`} className={secondaryButtonClass}>
          <ArrowBackIcon className="h-4 w-4" />
          กลับไปที่ห้อง {room.code}
        </Link>
        <PrintButton label={`พิมพ์ ${items.length + 1} ดวง`} />
      </div>
      <div className="print:hidden">
        <PageHeader
          title={`สติกเกอร์ QR ห้อง ${room.code}`}
          description="ติดดวงของห้องที่ประตู และติดดวงของแต่ละเครื่องที่ตัวเครื่อง ผู้ใช้สแกนแล้วแจ้งซ่อมได้ทันทีโดยไม่ต้องกรอกสถานที่"
        />
      </div>

      <ul className="print-sheet grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-3">
        <li className="break-inside-avoid">
          <Sticker
            title={room.code}
            subtitle={room.name}
            detail={place}
            code={room.qrCode}
            caption="สแกนเพื่อดูเครื่องในห้อง / แจ้งซ่อม"
            emphasis
          />
        </li>
        {items.map((item) => (
          <li key={item.id} className="break-inside-avoid">
            <Sticker
              title={item.label}
              subtitle={item.name}
              detail={`ห้อง ${room.code}${item.assetNumber ? ` · ${item.assetNumber}` : ''}`}
              code={item.qrCode}
              caption="เครื่องเสีย? สแกนเพื่อแจ้งซ่อม"
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function Sticker({
  title,
  subtitle,
  detail,
  code,
  caption,
  emphasis = false,
}: {
  title: string;
  subtitle: string;
  detail: string;
  code: string;
  caption: string;
  emphasis?: boolean;
}) {
  return (
    <article
      className={`flex h-full flex-col items-center gap-2 rounded-xl bg-surface-container-lowest p-4 text-center text-on-surface ${
        emphasis ? 'border-2 border-primary-container' : 'border border-dashed border-outline'
      }`}
    >
      <p className="text-label-sm text-on-surface-variant">ระบบแจ้งซ่อม CSMJU</p>
      <p className="font-display text-headline-md font-bold leading-tight tabular-nums">{title}</p>
      <OriginQrCode path={`/q/${code}`} size={132} label={`QR แจ้งซ่อม ${title}`} />
      <p className="line-clamp-2 text-label-md">{subtitle}</p>
      <p className="text-caption text-on-surface-variant">{detail}</p>
      <p className="text-caption text-on-surface-variant">{caption}</p>
      <p className="font-display text-label-md tracking-widest tabular-nums">{shortCode(code)}</p>
    </article>
  );
}
