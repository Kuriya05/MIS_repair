'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import {
  Avatar,
  CameraIcon,
  ConfirmDeleteModal,
  DeleteIcon,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/csmju';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api, ApiRequestError } from '@/lib/api';
import { prepareAvatar } from '@/lib/image-resize';
import type { Me } from '@/lib/types';

type Busy = 'prepare' | 'upload' | 'delete' | null;

/**
 * เปลี่ยนรูปโปรไฟล์ — เลือกรูป → ครอปเป็นสี่เหลี่ยมและย่อในเครื่อง → ดูตัวอย่าง → บันทึก
 * รูปเก็บในระบบแจ้งซ่อมเอง (Core Hub v1.0 ยังไม่มีรูปผู้ใช้) และแสดงบน top bar กับใบแจ้งซ่อม
 */
export function AvatarEditor({ me }: { me: Me }) {
  const router = useRouter();
  const toast = useToast();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    return () => URL.revokeObjectURL(draft.url);
  }, [draft]);

  const choose = () => input.current?.click();

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG หรือ WebP)');
      return;
    }
    setBusy('prepare');
    try {
      const prepared = await prepareAvatar(file);
      setDraft({ file: prepared, url: URL.createObjectURL(prepared) });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'เปิดรูปนี้ไม่ได้');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!draft) return;
    setBusy('upload');
    setError(null);
    const body = new FormData();
    body.append('avatar', draft.file);
    try {
      await api('/api/v1/profiles/me/avatar', { method: 'POST', body });
      toast.success('เปลี่ยนรูปโปรไฟล์แล้ว');
      setDraft(null);
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof ApiRequestError
          ? (failure.fieldErrors().avatar ?? failure.message)
          : 'อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง',
      );
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('delete');
    setDeleteError(null);
    try {
      await api('/api/v1/profiles/me/avatar', { method: 'DELETE' });
      toast.success('ลบรูปโปรไฟล์แล้ว');
      setConfirming(false);
      router.refresh();
    } catch (failure) {
      setDeleteError(failure instanceof Error ? failure.message : 'ลบรูปไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
      <div className="relative">
        <Avatar
          name={me.displayName}
          src={draft?.url ?? me.avatarUrl}
          size={96}
          className={draft ? 'ring-4 ring-accent/30' : ''}
        />
        {!draft ? (
          <button
            type="button"
            onClick={choose}
            aria-label={me.avatarUrl ? 'เปลี่ยนรูปโปรไฟล์' : 'เพิ่มรูปโปรไฟล์'}
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary-container text-white shadow-md transition-colors hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
          >
            <CameraIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1">
          <p className="text-label-md text-on-surface">รูปโปรไฟล์</p>
          <p className="text-body-md text-on-surface-variant" aria-live="polite">
            {draft
              ? 'ตัวอย่างรูปใหม่ (ครอปเป็นสี่เหลี่ยมให้แล้ว) — กดบันทึกเพื่อใช้รูปนี้'
              : 'ช่างและผู้ดูแลจะเห็นรูปนี้ในใบแจ้งซ่อม · JPG, PNG หรือ WebP'}
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-label-sm text-error">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          {draft ? (
            <>
              <LoadingButton onClick={save} loading={busy === 'upload'} className={primaryButtonClass}>
                บันทึกรูปนี้
              </LoadingButton>
              <button
                type="button"
                onClick={() => setDraft(null)}
                disabled={busy === 'upload'}
                className={secondaryButtonClass}
              >
                ยกเลิก
              </button>
            </>
          ) : (
            <>
              <LoadingButton onClick={choose} loading={busy === 'prepare'} className={secondaryButtonClass}>
                <CameraIcon className="h-4 w-4" />
                {me.avatarUrl ? 'เปลี่ยนรูป' : 'เพิ่มรูปโปรไฟล์'}
              </LoadingButton>
              {me.avatarUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setConfirming(true);
                  }}
                  className={`${secondaryButtonClass} text-error hover:bg-error-container/60`}
                >
                  <DeleteIcon className="h-4 w-4" />
                  ลบรูป
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
      <label htmlFor={inputId} className="sr-only">
        เลือกไฟล์รูปโปรไฟล์
      </label>
      <input
        id={inputId}
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        className="sr-only"
        onChange={onFile}
      />
      <ConfirmDeleteModal
        open={confirming}
        title="ลบรูปโปรไฟล์"
        itemName="รูปโปรไฟล์ของคุณ"
        consequence="ระบบจะกลับไปแสดงอักษรย่อของชื่อแทนรูป"
        confirmLabel="ลบรูป"
        loading={busy === 'delete'}
        error={deleteError}
        onConfirm={() => void remove()}
        onClose={() => busy !== 'delete' && setConfirming(false)}
      />
    </div>
  );
}
