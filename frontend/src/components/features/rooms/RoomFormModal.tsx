'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { inputClass, Modal, primaryButtonClass, secondaryButtonClass } from '@/csmju';
import { describedBy, FormField } from '@/components/shared/FormField';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api, ApiRequestError } from '@/lib/api';
import { floorLabel } from '@/lib/format';
import { ROOM_TYPE_LABEL, ROOM_TYPE_ORDER } from '@/lib/labels';
import { useUnsavedForm } from '@/lib/sso';
import type { Room, RoomType } from '@/lib/types';
import { applyPhotoChange, KEEP_PHOTO, PhotoField, type PhotoChange } from './PhotoField';
import { RoomPhotoFallback } from './room-visuals';

type Draft = {
  code: string;
  name: string;
  floor: string;
  roomType: RoomType;
  capacity: string;
  description: string;
};
type Field = keyof Draft;
const FIELDS: Field[] = ['code', 'name', 'floor', 'roomType', 'capacity', 'description'];
export const FLOOR_OPTIONS = [-2, -1, 0, ...Array.from({ length: 15 }, (_, i) => i + 1)];

function validate(draft: Draft): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (!/^[A-Z0-9-]{1,30}$/.test(draft.code.trim().toUpperCase()))
    errors.code = 'รหัสห้องใช้ได้เฉพาะ A–Z ตัวเลข และ - ไม่เกิน 30 ตัว เช่น CS-201';
  if (draft.name.trim().length < 2 || draft.name.trim().length > 150)
    errors.name = 'ชื่อห้องต้องยาว 2–150 ตัวอักษร';
  const capacity = draft.capacity.trim();
  if (capacity !== '' && (!/^\d+$/.test(capacity) || Number(capacity) < 1 || Number(capacity) > 1000))
    errors.capacity = 'จำนวนที่นั่งต้องเป็นตัวเลข 1–1000 หรือเว้นว่างไว้';
  if (draft.description.length > 500) errors.description = 'รายละเอียดยาวได้ไม่เกิน 500 ตัวอักษร';
  return errors;
}

/**
 * เพิ่ม/แก้ไขห้อง (ผู้ดูแลระบบ) — รหัสห้อง ชื่อ ชั้น ประเภทห้อง จำนวนที่นั่ง รายละเอียด และรูปห้อง
 * รูปอัปโหลดหลังบันทึกข้อมูลห้องสำเร็จ (ห้องใหม่ต้องได้ id ก่อน) · เพิ่มห้องเสร็จพาไปหน้าห้องเพื่อเพิ่มอุปกรณ์ต่อ
 */
export function RoomFormModal({
  open,
  onClose,
  buildingCode,
  buildings,
  room,
}: {
  open: boolean;
  onClose: () => void;
  buildingCode: string;
  /** ส่งมา = ให้เลือกอาคารได้ตอนเพิ่มห้อง (หน้ารวมทุกห้อง) */
  buildings?: { code: string; name: string }[];
  /** ไม่ส่ง = เพิ่มห้องใหม่ */
  room?: Pick<Room, 'id' | 'code' | 'name' | 'floor' | 'description' | 'roomType' | 'capacity' | 'photoUrl'>;
}) {
  const router = useRouter();
  const toast = useToast();
  const initial: Draft = {
    code: room?.code ?? '',
    name: room?.name ?? '',
    floor: room?.floor === null || room?.floor === undefined ? '' : String(room.floor),
    roomType: room?.roomType ?? 'LAB',
    capacity: room?.capacity ? String(room.capacity) : '',
    description: room?.description ?? '',
  };
  const [draft, setDraft] = useState<Draft>(initial);
  const [building, setBuilding] = useState(buildingCode);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<PhotoChange>(KEEP_PHOTO);
  const dirty = FIELDS.some((field) => draft[field] !== initial[field]) || photo.kind !== 'keep';
  useUnsavedForm(open && dirty && !busy);

  const set = <K extends Field>(field: K, value: Draft[K]) => {
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
    const found = validate(draft);
    setErrors(found);
    const first = FIELDS.find((field) => found[field]);
    if (first) {
      document.getElementById(`room-${first}`)?.focus();
      return;
    }
    const payload = {
      code: draft.code.trim().toUpperCase(),
      name: draft.name.trim(),
      floor: draft.floor === '' ? null : Number(draft.floor),
      roomType: draft.roomType,
      capacity: draft.capacity.trim() === '' ? null : Number(draft.capacity.trim()),
      description: draft.description.trim() || null,
    };
    setBusy(true);
    try {
      if (room) {
        await api<Room>(`/api/v1/rooms/${room.id}`, { method: 'PATCH', json: payload });
        const photoError = await applyPhotoChange(`/api/v1/rooms/${room.id}/photo`, photo);
        if (photoError) toast.error(`บันทึกห้องแล้ว แต่${photoError}`);
        else toast.success(`บันทึกห้อง ${payload.code} แล้ว`);
        setBusy(false);
        setPhoto(KEEP_PHOTO);
        onClose();
        router.refresh();
      } else {
        const { data } = await api<Room>('/api/v1/rooms', {
          method: 'POST',
          json: { buildingCode: building, ...payload },
        });
        const photoError = await applyPhotoChange(`/api/v1/rooms/${data.id}/photo`, photo);
        if (photoError)
          toast.error(`เพิ่มห้อง ${data.code} แล้ว แต่${photoError} — เพิ่มรูปได้อีกครั้งที่หน้าห้อง`);
        else toast.success(`เพิ่มห้อง ${data.code} แล้ว — เพิ่มอุปกรณ์ในห้องได้เลย`);
        router.push(`/rooms/${data.id}`);
      }
    } catch (failure) {
      setBusy(false);
      if (failure instanceof ApiRequestError && failure.code === 'VALIDATION_ERROR') {
        const fields = failure.fieldErrors();
        const mapped = Object.fromEntries(
          Object.entries(fields).filter(([field]) => (FIELDS as string[]).includes(field)),
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
    id: `room-${field}`,
    name: field,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': describedBy(`room-${field}`, { hint, error: errors[field] }),
    className: `${inputClass} ${errors[field] ? 'input-error' : ''}`,
  });

  return (
    <Modal
      open={open}
      onClose={close}
      title={room ? `แก้ไขห้อง ${room.code}` : 'เพิ่มห้อง'}
      size="lg"
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
        {!room && buildings && buildings.length === 1 ? (
          <p className="rounded-lg bg-surface-container px-4 py-3 text-body-md text-on-surface">
            <span className="text-on-surface-variant">อาคาร: </span>
            {buildings[0].name}
          </p>
        ) : null}
        {!room && buildings && buildings.length > 1 ? (
          <FormField id="room-building" label="อาคาร" required>
            <select
              id="room-building"
              className={inputClass}
              aria-required="true"
              value={building}
              onChange={(event) => setBuilding(event.target.value)}
            >
              {buildings.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <FormField id="room-code" label="รหัสห้อง" required hint="เช่น CS-201" error={errors.code}>
            <input
              {...control('code', 'hint')}
              data-autofocus
              aria-required="true"
              maxLength={30}
              autoComplete="off"
              value={draft.code}
              onChange={(event) => set('code', event.target.value.toUpperCase())}
            />
          </FormField>
          <FormField id="room-floor" label="ชั้น" error={errors.floor}>
            <select
              {...control('floor')}
              value={draft.floor}
              onChange={(event) => set('floor', event.target.value)}
            >
              <option value="">ไม่ระบุ</option>
              {FLOOR_OPTIONS.map((floor) => (
                <option key={floor} value={String(floor)}>
                  {floorLabel(floor)}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField
          id="room-name"
          label="ชื่อห้อง"
          required
          hint="เช่น ห้องปฏิบัติการคอมพิวเตอร์ 1"
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
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <FormField id="room-roomType" label="ประเภทห้อง" required error={errors.roomType}>
            <select
              {...control('roomType')}
              aria-required="true"
              value={draft.roomType}
              onChange={(event) => set('roomType', event.target.value as RoomType)}
            >
              {ROOM_TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {ROOM_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="room-capacity" label="จำนวนที่นั่ง" hint="ไม่บังคับ" error={errors.capacity}>
            <input
              {...control('capacity', 'hint')}
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              value={draft.capacity}
              onChange={(event) => set('capacity', event.target.value)}
            />
          </FormField>
        </div>
        <FormField
          id="room-description"
          label="รายละเอียด"
          hint={`ไม่บังคับ · เช่น จุดสังเกต เวลาที่ห้องเปิด · ${draft.description.length}/500`}
          error={errors.description}
        >
          <textarea
            {...control('description', 'hint')}
            rows={3}
            maxLength={500}
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </FormField>
        <PhotoField
          label="รูปห้อง"
          currentUrl={room?.photoUrl ?? null}
          value={photo}
          onChange={setPhoto}
          alt={`รูปห้อง ${draft.code || 'ใหม่'} ${draft.name}`.trim()}
          fallback={<RoomPhotoFallback code={draft.code || 'ห้องใหม่'} roomType={draft.roomType} />}
          disabled={busy}
        />
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} className={secondaryButtonClass} disabled={busy}>
            ยกเลิก
          </button>
          <LoadingButton type="submit" loading={busy} className={primaryButtonClass}>
            {room ? 'บันทึก' : 'เพิ่มห้อง'}
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}
