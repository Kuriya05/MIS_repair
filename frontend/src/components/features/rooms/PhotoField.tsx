'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { CameraIcon, DeleteIcon, ErrorIcon, fieldErrorClass, hintClass, secondaryButtonClass } from '@/csmju';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { api, ApiRequestError } from '@/lib/api';
import { prepareImage } from '@/lib/image-resize';

/** สิ่งที่จะทำกับรูปเมื่อกดบันทึก: คงเดิม · ใช้รูปใหม่ · ลบรูป */
export type PhotoChange = { kind: 'keep' } | { kind: 'new'; file: File; url: string } | { kind: 'remove' };
export const KEEP_PHOTO: PhotoChange = { kind: 'keep' };

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

/** ย่อรูปในเครื่อง (ด้านยาวไม่เกิน 1600px) แล้วตรวจชนิด/ขนาดตามที่ backend รับ — ผิดเงื่อนไขโยน Error ภาษาไทย */
export async function preparePhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG หรือ WebP)');
  const prepared = await prepareImage(file);
  if (!ACCEPT.includes(prepared.type)) throw new Error('เปิดรูปนี้ไม่ได้ กรุณาเลือกไฟล์ JPG, PNG หรือ WebP');
  if (prepared.size > MAX_BYTES) throw new Error('รูปใหญ่เกิน 5 MB กรุณาเลือกรูปที่เล็กลง');
  return prepared;
}

function photoError(failure: unknown, fallback: string) {
  if (failure instanceof ApiRequestError) return failure.fieldErrors().photo ?? failure.message;
  return failure instanceof Error ? failure.message : fallback;
}

/**
 * ส่งรูปที่เปลี่ยนไปยัง endpoint รูป (POST/DELETE /api/v1/rooms/:id/photo หรือ /api/v1/equipment/:id/photo)
 * คืนข้อความผิดพลาดภาษาไทย หรือ null เมื่อสำเร็จ/ไม่มีอะไรเปลี่ยน
 */
export async function applyPhotoChange(endpoint: string, change: PhotoChange): Promise<string | null> {
  try {
    if (change.kind === 'new') {
      const body = new FormData();
      body.append('photo', change.file, change.file.name);
      await api(endpoint, { method: 'POST', body });
    } else if (change.kind === 'remove') {
      await api(endpoint, { method: 'DELETE' });
    }
    return null;
  } catch (failure) {
    return photoError(
      failure,
      change.kind === 'remove' ? 'ลบรูปไม่สำเร็จ' : 'อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง',
    );
  }
}

/**
 * ช่องรูปในฟอร์ม (controlled) — ดูตัวอย่าง · เลือก/เปลี่ยนรูป · ลบรูป
 * ยังไม่อัปโหลดจนกว่าฟอร์มจะบันทึก (ใช้ได้ทั้งตอนเพิ่มใหม่ที่ยังไม่มี id และตอนแก้ไข)
 */
export function PhotoField({
  label,
  currentUrl,
  value,
  onChange,
  alt,
  fallback,
  hint = 'ไม่บังคับ · JPG, PNG หรือ WebP ไม่เกิน 5 MB (ระบบย่อรูปให้อัตโนมัติ)',
  aspectClass = 'aspect-video',
  disabled = false,
}: {
  label: string;
  currentUrl: string | null;
  value: PhotoChange;
  onChange: (next: PhotoChange) => void;
  alt: string;
  /** แสดงแทนรูปเมื่อยังไม่มีรูป */
  fallback: ReactNode;
  hint?: string;
  aspectClass?: string;
  disabled?: boolean;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (value.kind !== 'new') return;
    const url = value.url;
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const shown = value.kind === 'new' ? value.url : value.kind === 'remove' ? null : currentUrl;

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      const prepared = await preparePhoto(file);
      onChange({ kind: 'new', file: prepared, url: URL.createObjectURL(prepared) });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'เปิดรูปนี้ไม่ได้');
    } finally {
      setPreparing(false);
    }
  };

  const status =
    value.kind === 'new'
      ? 'รูปใหม่ — จะอัปโหลดเมื่อกดบันทึก'
      : value.kind === 'remove'
        ? 'จะลบรูปเมื่อกดบันทึก'
        : null;

  return (
    <div className="space-y-2">
      <p className="text-label-md text-on-surface" id={`${inputId}-label`}>
        {label}
      </p>
      <div
        className={`relative overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-container ${aspectClass}`}
      >
        {shown ? <img src={shown} alt={alt} className="h-full w-full object-cover" /> : fallback}
      </div>
      {status ? (
        <p className="text-label-sm text-primary-container" aria-live="polite">
          {status}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <LoadingButton
          type="button"
          loading={preparing}
          disabled={disabled}
          onClick={() => input.current?.click()}
          className={secondaryButtonClass}
        >
          <CameraIcon className="h-4 w-4" />
          {shown ? 'เปลี่ยนรูป' : 'เลือกรูป'}
        </LoadingButton>
        {value.kind === 'new' ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(KEEP_PHOTO)}
            className={secondaryButtonClass}
          >
            ไม่ใช้รูปนี้
          </button>
        ) : null}
        {value.kind === 'keep' && currentUrl ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ kind: 'remove' })}
            className={`${secondaryButtonClass} text-error hover:bg-error-container/60`}
          >
            <DeleteIcon className="h-4 w-4" />
            ลบรูป
          </button>
        ) : null}
        {value.kind === 'remove' ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(KEEP_PHOTO)}
            className={secondaryButtonClass}
          >
            เก็บรูปเดิมไว้
          </button>
        ) : null}
      </div>
      <p className={hintClass}>{hint}</p>
      {error ? (
        <p role="alert" className={fieldErrorClass}>
          <ErrorIcon className="mt-px h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
      <label htmlFor={inputId} className="sr-only">
        เลือกไฟล์{label}
      </label>
      <input
        id={inputId}
        ref={input}
        type="file"
        accept={ACCEPT.join(',')}
        tabIndex={-1}
        className="sr-only"
        onChange={onFile}
      />
    </div>
  );
}
