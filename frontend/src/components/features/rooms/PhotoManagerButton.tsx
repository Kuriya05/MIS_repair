'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { CameraIcon, Modal, primaryButtonClass, secondaryButtonClass } from '@/csmju';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { useUnsavedForm } from '@/lib/sso';
import { applyPhotoChange, KEEP_PHOTO, PhotoField, type PhotoChange } from './PhotoField';

/**
 * ปุ่ม "รูปห้อง" / "รูปเครื่อง" (ผู้ดูแลระบบ) — เปิดหน้าต่างเลือก/เปลี่ยน/ลบรูป แล้วบันทึกทันที
 * endpoint = /api/v1/rooms/:id/photo หรือ /api/v1/equipment/:id/photo
 */
export function PhotoManagerButton({
  endpoint,
  photoUrl,
  title,
  alt,
  fallback,
  buttonLabel,
  aspectClass,
  className = secondaryButtonClass,
}: {
  endpoint: string;
  photoUrl: string | null;
  /** หัวข้อหน้าต่าง เช่น "รูปห้อง CS-201" */
  title: string;
  alt: string;
  fallback: ReactNode;
  buttonLabel: string;
  aspectClass?: string;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [change, setChange] = useState<PhotoChange>(KEEP_PHOTO);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useUnsavedForm(open && change.kind !== 'keep' && !busy);

  const close = () => {
    if (busy) return;
    setChange(KEEP_PHOTO);
    setError(null);
    setOpen(false);
  };

  const save = async () => {
    if (change.kind === 'keep') {
      close();
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await applyPhotoChange(endpoint, change);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    toast.success(change.kind === 'remove' ? 'ลบรูปแล้ว' : 'บันทึกรูปแล้ว');
    setChange(KEEP_PHOTO);
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <CameraIcon className="h-4 w-4" />
        {buttonLabel}
      </button>
      <Modal open={open} onClose={close} title={title} dismissible={!busy}>
        <div className="space-y-4">
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container"
            >
              {error}
            </p>
          ) : null}
          <PhotoField
            label="รูป"
            currentUrl={photoUrl}
            value={change}
            onChange={(next) => {
              setError(null);
              setChange(next);
            }}
            alt={alt}
            fallback={fallback}
            aspectClass={aspectClass}
            hint="JPG, PNG หรือ WebP ไม่เกิน 5 MB · ระบบย่อรูปให้อัตโนมัติก่อนอัปโหลด"
            disabled={busy}
          />
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className={secondaryButtonClass} disabled={busy}>
              ยกเลิก
            </button>
            <LoadingButton
              type="button"
              loading={busy}
              disabled={change.kind === 'keep'}
              onClick={() => void save()}
              className={primaryButtonClass}
            >
              {change.kind === 'remove' ? 'ลบรูป' : 'บันทึกรูป'}
            </LoadingButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
