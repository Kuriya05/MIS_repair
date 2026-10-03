'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '@/csmju';
import { describedBy, FormField } from '@/components/shared/FormField';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api, ApiRequestError } from '@/lib/api';
import { floorLabel } from '@/lib/format';
import { useUnsavedForm } from '@/lib/sso';
import { PRIORITIES, PRIORITY_HINT, PRIORITY_LABEL } from '@/lib/labels';
import type { Priority, RepairRequestDetail } from '@/lib/types';
import { PhotoPicker, type PickedPhoto } from './PhotoPicker';
import { SimilarRequests } from './SimilarRequests';
import { TriageHint } from './TriageHint';

type Option = { value: string; label: string };
export type RequestDraft = {
  buildingCode: string;
  floor: string;
  location: string;
  categoryId: string;
  equipment: string;
  assetNumber: string;
  description: string;
  priority: Priority;
};

type Field = keyof RequestDraft | 'photos';
const ORDER: Field[] = [
  'buildingCode',
  'floor',
  'location',
  'categoryId',
  'equipment',
  'assetNumber',
  'description',
  'priority',
  'photos',
];
const FLOORS = [-2, -1, 0, ...Array.from({ length: 15 }, (_, i) => i + 1)];

/** ห้องที่เลือกไว้แล้ว (มาจาก ?room=) — อาคาร/ชั้น/ห้องระบบกรอกให้เอง */
export type FixedRoom = { id: string; code: string; buildingCode: string };

function validate(draft: RequestDraft, room?: FixedRoom): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (!room && !draft.buildingCode) errors.buildingCode = 'กรุณาเลือกอาคาร';
  if (!room && draft.location.trim().length < 2)
    errors.location = 'กรุณาระบุห้องหรือจุดที่ชำรุด อย่างน้อย 2 ตัวอักษร';
  if (!draft.categoryId) errors.categoryId = 'กรุณาเลือกหมวดหมู่งานซ่อม';
  if (draft.equipment.trim().length < 2) errors.equipment = 'กรุณาระบุสิ่งที่ชำรุด อย่างน้อย 2 ตัวอักษร';
  if (draft.description.trim().length < 5) errors.description = 'กรุณาอธิบายอาการอย่างน้อย 5 ตัวอักษร';
  if (draft.description.length > 2000) errors.description = 'รายละเอียดยาวได้ไม่เกิน 2000 ตัวอักษร';
  return errors;
}

/**
 * ฟอร์มแจ้งซ่อม (ข้อ 8.1): label ทุกช่อง · * สำหรับช่องบังคับ · ตรวจตอนออกจากช่องและตอนส่ง
 * error อยู่ใต้ช่อง + เลื่อนไป focus ช่องแรกที่ผิด + ประกาศจำนวน error · ปุ่ม [ยกเลิก] [ส่งใบแจ้งซ่อม] ชิดขวา
 */
export function NewRequestForm({
  buildings,
  categories,
  initial,
  room,
}: {
  buildings: Option[];
  categories: Option[];
  initial: RequestDraft;
  /** แจ้งปัญหาของห้อง (ไม่เจาะจงเครื่อง) — ซ่อนช่องอาคาร/ชั้น/ห้อง แล้วส่ง roomId แทน */
  room?: FixedRoom;
}) {
  const router = useRouter();
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<RequestDraft>(initial);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  // session หมดระหว่างกรอก: AppShell ไม่ redirect ทับ แต่ขึ้นแถบให้ต่ออายุในแท็บใหม่ (auth-contract.md ข้อ 7)
  useUnsavedForm(!submitting && (draft !== initial || photos.length > 0));

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current && !submitting) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [submitting]);

  const set = <K extends keyof RequestDraft>(key: K, value: RequestDraft[K]) => {
    dirty.current = true;
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (touched[key]) setErrors((existing) => ({ ...existing, [key]: validate(next, room)[key] }));
      return next;
    });
  };

  const blur = (key: keyof RequestDraft) => {
    setTouched((current) => ({ ...current, [key]: true }));
    setErrors((existing) => ({ ...existing, [key]: validate(draft, room)[key] }));
  };

  const focusFirst = (found: Partial<Record<Field, string>>) => {
    const first = ORDER.find((field) => found[field]);
    if (!first) return;
    const element = form.current?.querySelector<HTMLElement>(`[name="${first}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.focus({ preventScroll: true });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const found = validate(draft, room);
    setErrors(found);
    setTouched(Object.fromEntries(ORDER.map((field) => [field, true])));
    const count = Object.values(found).filter(Boolean).length;
    if (count > 0) {
      setAnnounce(`ข้อมูลยังไม่ครบ ${count} ช่อง กรุณาตรวจสอบ`);
      focusFirst(found);
      return;
    }

    const body = new FormData();
    if (room) {
      body.set('roomId', room.id);
    } else {
      body.set('buildingCode', draft.buildingCode);
      if (draft.floor !== '') body.set('floor', draft.floor);
      body.set('location', draft.location.trim());
    }
    body.set('categoryId', draft.categoryId);
    body.set('equipment', draft.equipment.trim());
    if (draft.assetNumber.trim()) body.set('assetNumber', draft.assetNumber.trim());
    body.set('description', draft.description.trim());
    body.set('priority', draft.priority);
    for (const photo of photos) body.append('photos', photo.file, photo.file.name);

    setSubmitting(true);
    try {
      const { data } = await api<RepairRequestDetail>('/api/v1/repair-requests', { method: 'POST', body });
      dirty.current = false;
      toast.success(`ส่งใบแจ้งซ่อม ${data.code} แล้ว ระบบแจ้งช่างให้ทราบแล้ว`);
      router.push(`/requests/${data.id}`);
      router.refresh();
    } catch (failure) {
      setSubmitting(false);
      if (failure instanceof ApiRequestError && failure.code === 'VALIDATION_ERROR') {
        const fields = failure.fieldErrors();
        const mapped: Partial<Record<Field, string>> = {};
        for (const [field, message] of Object.entries(fields)) {
          if ((ORDER as string[]).includes(field)) mapped[field as Field] = message;
        }
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped);
          setAnnounce(`ข้อมูลไม่ถูกต้อง ${Object.keys(mapped).length} ช่อง`);
          focusFirst(mapped);
          return;
        }
        setFormError(failure.details[0]?.replace(/^[^:]+:\s*/, '') ?? failure.message);
        return;
      }
      setFormError(failure instanceof Error ? failure.message : 'ส่งใบแจ้งซ่อมไม่สำเร็จ กรุณาลองอีกครั้ง');
    }
  };

  const fieldError = (field: Field) => (touched[field] ? errors[field] : undefined);
  const control = (field: keyof RequestDraft, hint?: string) => ({
    id: `f-${field}`,
    name: field,
    'aria-invalid': fieldError(field) ? true : undefined,
    'aria-describedby': describedBy(`f-${field}`, { hint, error: fieldError(field) }),
    onBlur: () => blur(field),
    className: `${inputClass} ${fieldError(field) ? 'input-error' : ''}`,
  });

  return (
    <form ref={form} onSubmit={submit} noValidate className="space-y-6">
      <p className="text-label-sm font-normal text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>
      <p className="sr-only" aria-live="assertive">
        {announce}
      </p>
      {formError ? (
        <p
          role="alert"
          className="rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container"
        >
          {formError}
        </p>
      ) : null}

      {room ? null : (
        <fieldset className="space-y-4">
          <legend className="mb-2 font-display text-headline-md text-on-surface">เกิดที่ไหน</legend>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <FormField id="f-buildingCode" label="อาคาร" required error={fieldError('buildingCode')}>
              <select
                {...control('buildingCode')}
                aria-required="true"
                value={draft.buildingCode}
                onChange={(event) => set('buildingCode', event.target.value)}
              >
                <option value="">เลือกอาคาร</option>
                {buildings.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="f-floor" label="ชั้น" error={fieldError('floor')}>
              <select
                {...control('floor')}
                value={draft.floor}
                onChange={(event) => set('floor', event.target.value)}
              >
                <option value="">ไม่ระบุ</option>
                {FLOORS.map((floor) => (
                  <option key={floor} value={String(floor)}>
                    {floorLabel(floor)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField
            id="f-location"
            label="ห้อง / จุดที่ชำรุด"
            required
            hint="เช่น ห้องปฏิบัติการคอมพิวเตอร์ 1 (CS-201) หรือ ห้องน้ำชายฝั่งทิศเหนือ"
            error={fieldError('location')}
          >
            <input
              {...control('location', 'hint')}
              aria-required="true"
              maxLength={150}
              value={draft.location}
              onChange={(event) => set('location', event.target.value)}
              autoComplete="off"
            />
          </FormField>
        </fieldset>
      )}

      <SimilarRequests
        buildingCode={room ? room.buildingCode : draft.buildingCode}
        location={room ? room.code : draft.location}
        assetNumber={draft.assetNumber}
        onFollowed={() => {
          dirty.current = false;
          setSubmitting(true);
        }}
      />

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-headline-md text-on-surface">ชำรุดอย่างไร</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="f-categoryId" label="หมวดหมู่งานซ่อม" required error={fieldError('categoryId')}>
            <select
              {...control('categoryId')}
              aria-required="true"
              value={draft.categoryId}
              onChange={(event) => set('categoryId', event.target.value)}
            >
              <option value="">เลือกหมวดหมู่</option>
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            id="f-equipment"
            label="สิ่งที่ชำรุด"
            required
            hint="เช่น เครื่องปรับอากาศ หลอดไฟ โปรเจกเตอร์"
            error={fieldError('equipment')}
          >
            <input
              {...control('equipment', 'hint')}
              aria-required="true"
              maxLength={150}
              value={draft.equipment}
              onChange={(event) => set('equipment', event.target.value)}
              autoComplete="off"
            />
          </FormField>
        </div>
        <FormField
          id="f-assetNumber"
          label="เลขครุภัณฑ์"
          hint="ไม่บังคับ · ดูจากสติกเกอร์ครุภัณฑ์บนตัวเครื่อง"
          error={fieldError('assetNumber')}
        >
          <input
            {...control('assetNumber', 'hint')}
            maxLength={50}
            value={draft.assetNumber}
            onChange={(event) => set('assetNumber', event.target.value)}
            autoComplete="off"
          />
        </FormField>
        <FormField
          id="f-description"
          label="รายละเอียดอาการ"
          required
          hint={`อาการที่พบ เริ่มเป็นเมื่อไร และเวลาที่สะดวกให้ช่างเข้าไป · ${draft.description.length}/2000`}
          error={fieldError('description')}
        >
          <textarea
            {...control('description', 'hint')}
            aria-required="true"
            rows={5}
            maxLength={2000}
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </FormField>
        <TriageHint
          text={`${draft.equipment} ${draft.description}`}
          categories={categories}
          categoryId={draft.categoryId}
          priority={draft.priority}
          onApply={(next) => {
            if (next.categoryId) set('categoryId', next.categoryId);
            if (next.priority) set('priority', next.priority);
          }}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-display text-headline-md text-on-surface">ความเร่งด่วน</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {PRIORITIES.map((priority) => {
            const checked = draft.priority === priority;
            return (
              <label
                key={priority}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  checked
                    ? 'border-primary-container bg-primary-container/10'
                    : 'border-outline-variant hover:bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  value={priority}
                  checked={checked}
                  onChange={() => set('priority', priority)}
                  className="mt-1 h-4 w-4 accent-primary-container"
                />
                <span>
                  <span className="block text-label-md text-on-surface">{PRIORITY_LABEL[priority]}</span>
                  <span className="block text-body-md text-on-surface-variant">
                    {PRIORITY_HINT[priority]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <PhotoPicker
        photos={photos}
        onChange={(next) => ((dirty.current = true), setPhotos(next))}
        error={errors.photos}
      />

      <div className="flex flex-col-reverse gap-3 border-t border-outline-variant/40 pt-6 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className={secondaryButtonClass}
          disabled={submitting}
        >
          ยกเลิก
        </button>
        <LoadingButton type="submit" loading={submitting} className={primaryButtonClass}>
          ส่งใบแจ้งซ่อม
        </LoadingButton>
      </div>
    </form>
  );
}
