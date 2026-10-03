'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { CheckIcon, inputClass, primaryButtonClass } from '@/csmju';
import { PhotoPicker, type PickedPhoto } from '@/components/features/requests/PhotoPicker';
import { TriageHint } from '@/components/features/requests/TriageHint';
import { describedBy, FormField } from '@/components/shared/FormField';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api, ApiRequestError } from '@/lib/api';
import { PRIORITIES, PRIORITY_HINT, PRIORITY_LABEL } from '@/lib/labels';
import { useUnsavedForm } from '@/lib/sso';
import type { EquipmentDetail, Priority, RepairRequestDetail } from '@/lib/types';

const MAX = 2000;

/** อาการที่เลือก (ปุ่ม) ขึ้นบรรทัดแรก ตามด้วยรายละเอียดที่พิมพ์เพิ่ม */
export function composeDescription(symptoms: string[], extra: string) {
  return [...symptoms, extra.trim()].filter(Boolean).join('\n');
}

/**
 * แจ้งซ่อมด่วนจากหน้าเครื่อง (สแกน QR บนเครื่อง) — ระบบรู้ห้อง/ประเภท/ครุภัณฑ์อยู่แล้ว
 * ผู้แจ้งแค่แตะอาการ (เลือกได้หลายข้อ) + พิมพ์เพิ่มถ้าต้องการ + ความเร่งด่วน + รูป → ส่ง
 */
export function QuickReportForm({ equipment }: { equipment: EquipmentDetail }) {
  const router = useRouter();
  const toast = useToast();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const description = composeDescription(symptoms, extra);
  useUnsavedForm(!submitting && (symptoms.length > 0 || extra !== '' || photos.length > 0));

  const category = equipment.category;
  const categoryOptions = [{ value: category.id, label: category.name }];

  const toggle = (symptom: string) => {
    setError(null);
    setSymptoms((current) =>
      current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom],
    );
  };

  const validate = () => {
    if (description.trim().length < 5) return 'เลือกอาการ หรือพิมพ์รายละเอียดอย่างน้อย 5 ตัวอักษร';
    if (description.length > MAX) return `รายละเอียดรวมยาวได้ไม่เกิน ${MAX} ตัวอักษร`;
    return null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const problem = validate();
    setError(problem);
    if (problem) {
      textarea.current?.focus();
      return;
    }
    const body = new FormData();
    body.set('equipmentId', equipment.id);
    body.set('description', description);
    body.set('priority', priority);
    for (const photo of photos) body.append('photos', photo.file, photo.file.name);

    setSubmitting(true);
    try {
      const { data } = await api<RepairRequestDetail>('/api/v1/repair-requests', { method: 'POST', body });
      toast.success(`ส่งใบแจ้งซ่อม ${data.code} แล้ว ระบบแจ้งช่างให้ทราบแล้ว`);
      router.push(`/requests/${data.id}`);
      router.refresh();
    } catch (failure) {
      setSubmitting(false);
      if (failure instanceof ApiRequestError && failure.code === 'CONFLICT') {
        // มีคนแจ้งเครื่องนี้ไปก่อนหน้าไม่กี่วินาที — โหลดหน้าใหม่ให้เห็นใบนั้นพร้อมปุ่ม "ฉันก็เจอ"
        toast.error(failure.message);
        router.refresh();
        return;
      }
      if (failure instanceof ApiRequestError && failure.code === 'VALIDATION_ERROR') {
        setFormError(failure.details[0]?.replace(/^[^:]+:\s*/, '') ?? failure.message);
        return;
      }
      setFormError(failure instanceof Error ? failure.message : 'ส่งใบแจ้งซ่อมไม่สำเร็จ กรุณาลองอีกครั้ง');
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6" aria-label={`แจ้งซ่อม ${equipment.label}`}>
      {formError ? (
        <p
          role="alert"
          className="rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container"
        >
          {formError}
        </p>
      ) : null}

      {category.symptoms.length > 0 ? (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-label-md text-on-surface">
            อาการที่พบ <span className="font-normal text-on-surface-variant">(เลือกได้หลายข้อ)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {category.symptoms.map((symptom) => {
              const selected = symptoms.includes(symptom);
              return (
                <button
                  key={symptom}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(symptom)}
                  className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-4 py-2 text-body-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container ${
                    selected
                      ? 'border-primary-container bg-primary-container text-on-primary'
                      : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary-container hover:bg-primary-fixed/40'
                  }`}
                >
                  {selected ? <CheckIcon className="h-4 w-4" strokeWidth={2.4} /> : null}
                  {symptom}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <FormField
        id="qr-extra"
        label={category.symptoms.length > 0 ? 'รายละเอียดเพิ่มเติม' : 'อาการที่พบ'}
        required={category.symptoms.length === 0}
        hint={`${
          category.symptoms.length > 0 ? 'ไม่บังคับถ้าเลือกอาการแล้ว · ' : ''
        }เช่น เริ่มเป็นเมื่อไร มีเสียง/กลิ่นผิดปกติไหม · ${description.length}/${MAX}`}
        error={error}
      >
        <textarea
          ref={textarea}
          id="qr-extra"
          name="description"
          rows={3}
          maxLength={MAX}
          value={extra}
          onChange={(event) => {
            setExtra(event.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy('qr-extra', { hint: true, error })}
          className={`${inputClass} ${error ? 'input-error' : ''}`}
        />
      </FormField>

      {symptoms.length > 0 ? (
        <div className="space-y-1 rounded-lg bg-surface-container-low p-4">
          <p className="text-label-sm text-on-surface-variant">ข้อความที่จะส่งถึงช่าง</p>
          <p className="whitespace-pre-line text-body-md text-on-surface">{description}</p>
        </div>
      ) : null}

      <TriageHint
        text={`${equipment.name} ${description}`}
        categories={categoryOptions}
        categoryId={category.id}
        priority={priority}
        onApply={(next) => {
          if (next.priority) setPriority(next.priority);
        }}
      />

      <fieldset className="space-y-3">
        <legend className="mb-1 text-label-md text-on-surface">ความเร่งด่วน</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRIORITIES.map((level) => {
            const checked = priority === level;
            return (
              <label
                key={level}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  checked
                    ? 'border-primary-container bg-primary-container/10'
                    : 'border-outline-variant hover:bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  value={level}
                  checked={checked}
                  onChange={() => setPriority(level)}
                  className="mt-1 h-4 w-4 accent-primary-container"
                />
                <span>
                  <span className="block text-label-md text-on-surface">{PRIORITY_LABEL[level]}</span>
                  <span className="block text-label-sm font-normal text-on-surface-variant">
                    {PRIORITY_HINT[level]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <PhotoPicker photos={photos} onChange={setPhotos} />

      <div className="flex justify-stretch border-t border-outline-variant/40 pt-6 sm:justify-end">
        <LoadingButton
          type="submit"
          loading={submitting}
          className={`${primaryButtonClass} w-full sm:w-auto`}
        >
          ส่งแจ้งซ่อม {equipment.label}
        </LoadingButton>
      </div>
    </form>
  );
}
