'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BlockIcon, ConfirmDeleteModal, DeleteIcon, EditIcon, PlayIcon, secondaryButtonClass } from '@/csmju';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api } from '@/lib/api';
import type { EquipmentDetail } from '@/lib/types';
import { EquipmentFormModal, type EquipmentCategoryOption } from './EquipmentFormModal';

/**
 * เครื่องมือผู้ดูแลระบบบนหน้าเครื่อง: แก้ไข · เปิด/ปิดใช้งาน · ลบ
 * เครื่องที่มีประวัติแจ้งซ่อมลบไม่ได้ (backend ตอบ 409) — ให้ปิดใช้งานแทน ประวัติจะยังอยู่ครบ
 */
export function EquipmentAdminTools({
  equipment,
  categories,
}: {
  equipment: EquipmentDetail;
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
      await api(`/api/v1/equipment/${equipment.id}`, {
        method: 'PATCH',
        json: { isActive: !equipment.isActive },
      });
      toast.success(
        equipment.isActive ? `ปิดใช้งาน ${equipment.label} แล้ว` : `เปิดใช้งาน ${equipment.label} แล้ว`,
      );
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
      await api(`/api/v1/equipment/${equipment.id}`, { method: 'DELETE' });
      toast.success(`ลบเครื่อง ${equipment.label} แล้ว`);
      router.push(`/rooms/${equipment.room.id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ลบไม่สำเร็จ');
      setBusy(null);
    }
  };

  const blocked =
    equipment.history.length > 0
      ? `เครื่องนี้มีประวัติแจ้งซ่อม ${equipment.history.length} ใบ จึงลบไม่ได้ ให้ปิดการใช้งานแทน`
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="จัดการเครื่อง (ผู้ดูแลระบบ)">
      <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClass}>
        <EditIcon className="h-4 w-4" />
        แก้ไขเครื่อง
      </button>
      <LoadingButton
        type="button"
        loading={busy === 'toggle'}
        disabled={busy !== null}
        onClick={() => void toggle()}
        className={secondaryButtonClass}
      >
        {equipment.isActive ? <BlockIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
        {equipment.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
      </LoadingButton>
      <button
        type="button"
        onClick={() => (setError(null), setDeleting(true))}
        className={`${secondaryButtonClass} hover:text-error`}
      >
        <DeleteIcon className="h-4 w-4" />
        ลบเครื่อง
      </button>

      <EquipmentFormModal
        open={editing}
        onClose={() => setEditing(false)}
        roomId={equipment.room.id}
        categories={categories}
        equipment={equipment}
      />
      <ConfirmDeleteModal
        open={deleting}
        title="ลบเครื่อง"
        itemName={`${equipment.label} ${equipment.name}`}
        consequence="สติกเกอร์ QR ของเครื่องนี้จะใช้ไม่ได้อีก"
        blockedReason={blocked}
        confirmLabel="ลบเครื่อง"
        loading={busy === 'delete'}
        error={error}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(false)}
      />
    </div>
  );
}
