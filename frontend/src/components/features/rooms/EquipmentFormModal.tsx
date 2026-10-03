'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { InfoIcon, inputClass, Modal, primaryButtonClass, secondaryButtonClass } from '@/csmju';
import { describedBy, FormField } from '@/components/shared/FormField';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api, ApiRequestError } from '@/lib/api';
import { useUnsavedForm } from '@/lib/sso';
import type { CategoryIcon, Equipment, EquipmentDetail, RoomDetail } from '@/lib/types';
import { EquipmentPhotoFallback } from './equipment-visuals';
import { applyPhotoChange, KEEP_PHOTO, PhotoField, type PhotoChange } from './PhotoField';

export type EquipmentCategoryOption = { id: string; name: string; icon?: CategoryIcon };

type Draft = {
  categoryId: string;
  label: string;
  name: string;
  specs: string;
  assetNumber: string;
  position: string;
  count: string;
};
type Field = keyof Draft;
const FIELDS: Field[] = ['categoryId', 'label', 'count', 'name', 'specs', 'assetNumber', 'position'];

const pad = (value: number, width: number) => String(value).padStart(width, '0');

/** ตัวอย่างป้ายเมื่อเพิ่มหลายเครื่อง (backend ต่อเลขจริงโดยข้ามเลขที่มีอยู่แล้วในห้อง) */
export function bulkLabels(prefix: string, count: number) {
  const width = Math.max(2, String(count).length);
  const base = prefix.trim().toUpperCase();
  return { first: `${base}-${pad(1, width)}`, last: `${base}-${pad(count, width)}` };
}

function validate(draft: Draft, bulk: boolean): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  const count = Number(draft.count);
  if (!draft.categoryId) errors.categoryId = 'กรุณาเลือกประเภทอุปกรณ์';
  const label = draft.label.trim();
  if (label.length < 1 || label.length > (bulk ? 26 : 30))
    errors.label = bulk
      ? 'กรุณาระบุคำนำหน้าป้าย 1–26 ตัวอักษร เช่น PC'
      : 'กรุณาระบุป้ายเครื่อง 1–30 ตัวอักษร';
  if (!Number.isInteger(count) || count < 1 || count > 100) errors.count = 'จำนวนต้องเป็น 1–100 ชิ้น';
  if (draft.name.trim().length < 2 || draft.name.trim().length > 150)
    errors.name = 'ชื่อ/รุ่นต้องยาว 2–150 ตัวอักษร';
  if (draft.specs.length > 1000) errors.specs = 'รายละเอียดเครื่องยาวได้ไม่เกิน 1000 ตัวอักษร';
  if (draft.assetNumber.length > 50) errors.assetNumber = 'เลขครุภัณฑ์ยาวได้ไม่เกิน 50 ตัวอักษร';
  if (draft.position.length > 50) errors.position = 'ตำแหน่งยาวได้ไม่เกิน 50 ตัวอักษร';
  return errors;
}

/**
 * เพิ่มอุปกรณ์ในห้อง (ทีละชิ้นหรือหลายชิ้นพร้อมกัน เช่น PC 30 เครื่อง) / แก้ไขอุปกรณ์ — ผู้ดูแลระบบ
 * เพิ่มหลายชิ้น: ป้ายเป็นคำนำหน้า ระบบต่อเลขให้ · เลขครุภัณฑ์/ตำแหน่ง/รูปต่างกันรายชิ้น จึงเพิ่มทีหลังที่หน้าเครื่อง
 * เพิ่มทีละชิ้นหรือแก้ไข: ใส่รูปได้เลย (อัปโหลดหลังบันทึกข้อมูลสำเร็จ)
 */
export function EquipmentFormModal({
  open,
  onClose,
  roomId,
  categories,
  equipment,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  categories: EquipmentCategoryOption[];
  /** ไม่ส่ง = เพิ่มเครื่องใหม่ */
  equipment?: Pick<
    Equipment,
    'id' | 'label' | 'name' | 'specs' | 'assetNumber' | 'position' | 'category' | 'photoUrl'
  >;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(equipment);
  const initial: Draft = {
    categoryId: equipment?.category.id ?? '',
    label: equipment?.label ?? '',
    name: equipment?.name ?? '',
    specs: equipment?.specs ?? '',
    assetNumber: equipment?.assetNumber ?? '',
    position: equipment?.position ?? '',
    count: '1',
  };
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<PhotoChange>(KEEP_PHOTO);
  const count = Number(draft.count);
  const bulk = !editing && Number.isInteger(count) && count > 1;
  const dirty = FIELDS.some((field) => draft[field] !== initial[field]) || photo.kind !== 'keep';
  useUnsavedForm(open && dirty && !busy);

  // ประเภทที่ปิดใช้งานแล้วแต่เครื่องนี้ยังใช้อยู่ ต้องยังเลือกค้างไว้ได้
  const options =
    equipment && !categories.some((c) => c.id === equipment.category.id)
      ? [
          { id: equipment.category.id, name: equipment.category.name, icon: equipment.category.icon },
          ...categories,
        ]
      : categories;

  const set = (field: Field, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const close = () => {
    if (busy) return;
    setDraft(initial);
    setPhoto(KEEP_PHOTO);
    setErrors({});
    setFormError(null);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const found = validate(draft, bulk);
    setErrors(found);
    const first = FIELDS.find((field) => found[field]);
    if (first) {
      document.getElementById(`eq-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (equipment) {
        await api<EquipmentDetail>(`/api/v1/equipment/${equipment.id}`, {
          method: 'PATCH',
          json: {
            categoryId: draft.categoryId,
            label: draft.label.trim().toUpperCase(),
            name: draft.name.trim(),
            specs: draft.specs.trim() || null,
            assetNumber: draft.assetNumber.trim() || null,
            position: draft.position.trim() || null,
          },
        });
        const photoError = await applyPhotoChange(`/api/v1/equipment/${equipment.id}/photo`, photo);
        if (photoError) toast.error(`บันทึกข้อมูลแล้ว แต่${photoError}`);
        else toast.success(`บันทึก ${draft.label.trim().toUpperCase()} แล้ว`);
        setBusy(false);
        setPhoto(KEEP_PHOTO);
        onClose();
        router.refresh();
        return;
      }
      const label = draft.label.trim().toUpperCase();
      const { data: room } = await api<RoomDetail>(`/api/v1/rooms/${roomId}/equipment`, {
        method: 'POST',
        json: {
          categoryId: draft.categoryId,
          label: draft.label.trim().toUpperCase(),
          name: draft.name.trim(),
          specs: draft.specs.trim() || undefined,
          ...(bulk
            ? { count }
            : {
                assetNumber: draft.assetNumber.trim() || undefined,
                position: draft.position.trim() || undefined,
              }),
        },
      });
      // เพิ่มทีละชิ้น: หา id ของชิ้นที่เพิ่งเพิ่มจากป้าย แล้วอัปโหลดรูปต่อ
      const created = bulk ? undefined : room.equipment.find((item) => item.label === label);
      const photoError =
        created && photo.kind === 'new'
          ? await applyPhotoChange(`/api/v1/equipment/${created.id}/photo`, photo)
          : null;
      if (photoError) toast.error(`เพิ่ม ${label} แล้ว แต่${photoError} — เพิ่มรูปได้อีกครั้งที่หน้าเครื่อง`);
      else toast.success(bulk ? `เพิ่มอุปกรณ์ ${count} ชิ้นแล้ว (${label}-…)` : `เพิ่มอุปกรณ์ ${label} แล้ว`);
      setBusy(false);
      setPhoto(KEEP_PHOTO);
      setDraft({ ...initial, categoryId: draft.categoryId });
      onClose();
      router.refresh();
    } catch (failure) {
      setBusy(false);
      if (failure instanceof ApiRequestError && failure.code === 'VALIDATION_ERROR') {
        const mapped = Object.fromEntries(
          Object.entries(failure.fieldErrors()).filter(([field]) => (FIELDS as string[]).includes(field)),
        ) as Partial<Record<Field, string>>;
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped);
          return;
        }
      }
      setFormError(failure instanceof Error ? failure.message : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');
    }
  };

  const control = (field: Field, hint?: string) => ({
    id: `eq-${field}`,
    name: field,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': describedBy(`eq-${field}`, { hint, error: errors[field] }),
    className: `${inputClass} ${errors[field] ? 'input-error' : ''}`,
  });
  const preview = bulk && draft.label.trim() ? bulkLabels(draft.label, count) : null;
  const selectedIcon: CategoryIcon = options.find((c) => c.id === draft.categoryId)?.icon ?? 'other';

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={equipment ? `แก้ไขอุปกรณ์ ${equipment.label}` : 'เพิ่มอุปกรณ์ในห้อง'}
      dismissible={!busy}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <p
            role="alert"
            className="rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container"
          >
            {formError}
          </p>
        ) : null}
        <FormField id="eq-categoryId" label="ประเภทอุปกรณ์" required error={errors.categoryId}>
          <select
            {...control('categoryId')}
            data-autofocus
            aria-required="true"
            value={draft.categoryId}
            onChange={(event) => set('categoryId', event.target.value)}
          >
            <option value="">เลือกประเภท</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </FormField>
        <div className={`grid gap-4 ${editing ? '' : 'sm:grid-cols-[2fr_1fr]'}`}>
          <FormField
            id="eq-label"
            label={bulk ? 'คำนำหน้าป้าย' : 'ป้ายเครื่อง'}
            required
            hint={
              bulk ? 'ระบบต่อเลขให้ เช่น PC → PC-01, PC-02, …' : 'ไม่ซ้ำในห้องเดียวกัน เช่น PC-01 หรือ AIR-1'
            }
            error={errors.label}
          >
            <input
              {...control('label', 'hint')}
              aria-required="true"
              maxLength={30}
              autoComplete="off"
              value={draft.label}
              onChange={(event) => set('label', event.target.value.toUpperCase())}
            />
          </FormField>
          {editing ? null : (
            <FormField id="eq-count" label="จำนวน" hint="สูงสุด 100 ชิ้นต่อครั้ง" error={errors.count}>
              <input
                {...control('count', 'hint')}
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={draft.count}
                onChange={(event) => set('count', event.target.value)}
              />
            </FormField>
          )}
        </div>
        {preview ? (
          <p
            className="flex items-start gap-2 rounded-lg bg-primary-fixed/40 px-4 py-3 text-body-md text-on-surface"
            aria-live="polite"
          >
            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
            จะเพิ่ม {count} ชิ้น ป้ายเช่น {preview.first} ถึง {preview.last} (ถ้าห้องมีเลขนั้นแล้ว
            ระบบต่อเลขถัดไปให้) — เลขครุภัณฑ์ ตำแหน่ง และรูปของแต่ละชิ้นเพิ่มได้ภายหลังที่หน้าเครื่อง
          </p>
        ) : null}
        <FormField
          id="eq-name"
          label="ชื่อ / รุ่น"
          required
          hint="เช่น Dell OptiPlex 7090"
          error={errors.name}
        >
          <input
            {...control('name', 'hint')}
            aria-required="true"
            maxLength={150}
            autoComplete="off"
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </FormField>
        <FormField
          id="eq-specs"
          label="รายละเอียดเครื่อง"
          hint={`ไม่บังคับ · ช่างใช้เตรียมอะไหล่ เช่น CPU / RAM / SSD · ${draft.specs.length}/1000`}
          error={errors.specs}
        >
          <textarea
            {...control('specs', 'hint')}
            rows={4}
            maxLength={1000}
            value={draft.specs}
            onChange={(event) => set('specs', event.target.value)}
          />
        </FormField>
        {bulk ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="eq-assetNumber" label="เลขครุภัณฑ์" hint="ไม่บังคับ" error={errors.assetNumber}>
              <input
                {...control('assetNumber', 'hint')}
                maxLength={50}
                autoComplete="off"
                value={draft.assetNumber}
                onChange={(event) => set('assetNumber', event.target.value)}
              />
            </FormField>
            <FormField
              id="eq-position"
              label="ตำแหน่งในห้อง"
              hint="ไม่บังคับ · เช่น แถว 2 ที่ 3"
              error={errors.position}
            >
              <input
                {...control('position', 'hint')}
                maxLength={50}
                autoComplete="off"
                value={draft.position}
                onChange={(event) => set('position', event.target.value)}
              />
            </FormField>
          </div>
        )}
        {bulk ? null : (
          <PhotoField
            label={editing ? 'รูปอุปกรณ์' : 'รูปอุปกรณ์ (ไม่บังคับ)'}
            currentUrl={equipment?.photoUrl ?? null}
            value={photo}
            onChange={setPhoto}
            alt={`รูป ${draft.label || 'อุปกรณ์'} ${draft.name}`.trim()}
            fallback={<EquipmentPhotoFallback icon={selectedIcon} label={draft.label || undefined} />}
            aspectClass="aspect-[4/3] max-w-sm"
            disabled={busy}
          />
        )}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} className={secondaryButtonClass} disabled={busy}>
            ยกเลิก
          </button>
          <LoadingButton type="submit" loading={busy} className={primaryButtonClass}>
            {equipment ? 'บันทึก' : bulk ? `เพิ่ม ${count} ชิ้น` : 'เพิ่มอุปกรณ์'}
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}
