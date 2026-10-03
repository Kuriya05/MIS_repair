'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AddIcon,
  BlockIcon,
  ConfirmDeleteModal,
  DeleteIcon,
  EditIcon,
  PlayIcon,
  primaryButtonClass,
  QrCodeIcon,
  secondaryButtonClass,
} from '@/csmju';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api } from '@/lib/api';
import type { RoomDetail } from '@/lib/types';
import { EquipmentFormModal, type EquipmentCategoryOption } from './EquipmentFormModal';
import { PhotoManagerButton } from './PhotoManagerButton';
import { RoomFormModal } from './RoomFormModal';
import { RoomPhotoFallback } from './room-visuals';

/** ปุ่ม "เพิ่มห้อง" บนหน้าอาคาร (ผู้ดูแลระบบ) */
export function AddRoomButton({
  buildingCode,
  buildings,
}: {
  buildingCode: string;
  buildings?: { code: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        <AddIcon className="h-4 w-4" />
        เพิ่มห้อง
      </button>
      <RoomFormModal
        open={open}
        onClose={() => setOpen(false)}
        buildingCode={buildingCode}
        buildings={buildings}
      />
    </>
  );
}

/** ปุ่ม "เพิ่มอุปกรณ์" (ทีละชิ้นหรือหลายชิ้น) ใช้ได้ทั้งในแถบเครื่องมือและใน empty state ของผังห้อง */
export function AddEquipmentButton({
  roomId,
  categories,
  className = primaryButtonClass,
}: {
  roomId: string;
  categories: EquipmentCategoryOption[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <AddIcon className="h-4 w-4" />
        เพิ่มอุปกรณ์
      </button>
      <EquipmentFormModal
        open={open}
        onClose={() => setOpen(false)}
        roomId={roomId}
        categories={categories}
      />
    </>
  );
}

/**
 * เครื่องมือผู้ดูแลระบบบนหน้าห้อง: เพิ่มอุปกรณ์ · แก้ไขห้อง · รูปห้อง · พิมพ์ QR · เปิด/ปิดใช้งาน · ลบ
 * ห้องที่มีเครื่องหรือใบแจ้งซ่อมลบไม่ได้ (backend ตอบ 409) — บอกเหตุผลก่อนกด และแนะนำให้ปิดใช้งานแทน
 */
export function RoomAdminTools({
  room,
  categories,
}: {
  room: Pick<
    RoomDetail,
    | 'id'
    | 'code'
    | 'name'
    | 'floor'
    | 'description'
    | 'roomType'
    | 'capacity'
    | 'photoUrl'
    | 'buildingCode'
    | 'isActive'
    | 'openRequestCount'
  > & { equipmentCount: number };
  categories: EquipmentCategoryOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState<'toggle' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy('toggle');
    try {
      await api(`/api/v1/rooms/${room.id}`, { method: 'PATCH', json: { isActive: !room.isActive } });
      toast.success(room.isActive ? `ปิดใช้งานห้อง ${room.code} แล้ว` : `เปิดใช้งานห้อง ${room.code} แล้ว`);
      router.refresh();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('delete');
    setError(null);
    try {
      await api(`/api/v1/rooms/${room.id}`, { method: 'DELETE' });
      toast.success(`ลบห้อง ${room.code} แล้ว`);
      router.push(`/buildings/${room.buildingCode}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ลบไม่สำเร็จ');
      setBusy(null);
    }
  };

  const blocked =
    room.equipmentCount > 0 || room.openRequestCount > 0
      ? `ห้องนี้มีเครื่อง ${room.equipmentCount} เครื่อง${
          room.openRequestCount > 0 ? ` และใบแจ้งซ่อมที่ยังไม่ปิด ${room.openRequestCount} ใบ` : ''
        } จึงลบไม่ได้ ให้ปิดการใช้งานแทน`
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="จัดการห้อง (ผู้ดูแลระบบ)">
      <AddEquipmentButton roomId={room.id} categories={categories} />
      <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClass}>
        <EditIcon className="h-4 w-4" />
        แก้ไขห้อง
      </button>
      <PhotoManagerButton
        endpoint={`/api/v1/rooms/${room.id}/photo`}
        photoUrl={room.photoUrl}
        title={`รูปห้อง ${room.code}`}
        alt={`รูปห้อง ${room.code} ${room.name}`}
        fallback={<RoomPhotoFallback code={room.code} roomType={room.roomType} />}
        buttonLabel="รูปห้อง"
      />
      <Link href={`/rooms/${room.id}/qr`} className={secondaryButtonClass}>
        <QrCodeIcon className="h-4 w-4" />
        พิมพ์ QR
      </Link>
      <LoadingButton
        type="button"
        loading={busy === 'toggle'}
        disabled={busy !== null}
        onClick={() => void toggle()}
        className={secondaryButtonClass}
      >
        {room.isActive ? <BlockIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
        {room.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
      </LoadingButton>
      <button
        type="button"
        onClick={() => (setError(null), setDeleting(true))}
        className={`${secondaryButtonClass} hover:text-error`}
      >
        <DeleteIcon className="h-4 w-4" />
        ลบห้อง
      </button>

      <RoomFormModal
        open={editing}
        onClose={() => setEditing(false)}
        buildingCode={room.buildingCode}
        room={room}
      />
      <ConfirmDeleteModal
        open={deleting}
        title="ลบห้อง"
        itemName={`${room.code} ${room.name}`}
        consequence="สติกเกอร์ QR ของห้องนี้จะใช้ไม่ได้อีก"
        blockedReason={blocked}
        confirmLabel="ลบห้อง"
        loading={busy === 'delete'}
        error={error}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(false)}
      />
    </div>
  );
}
