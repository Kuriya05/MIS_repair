'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  AddIcon,
  CloseIcon,
  ConfirmDeleteModal,
  DeleteIcon,
  EditIcon,
  iconButtonClass,
  iconDangerButtonClass,
  inputClass,
  Modal,
  primaryButtonClass,
  secondaryButtonClass,
  StatusBadge,
  tableClass,
  tbodyRowClass,
  tdClass,
  theadRowClass,
  thClass,
  tonalButtonClass,
} from '@/csmju';
import { CategoryGlyph } from '@/components/features/rooms/equipment-visuals';
import { EmptyState } from '@/components/shared/EmptyState';
import { describedBy, FormField } from '@/components/shared/FormField';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api, ApiRequestError } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { CATEGORY_ICON_LABEL } from '@/lib/labels';
import type { Category, CategoryIcon } from '@/lib/types';

const ICONS = Object.keys(CATEGORY_ICON_LABEL) as CategoryIcon[];
const MAX_SYMPTOMS = 12;
const SYMPTOM_MIN = 2;
const SYMPTOM_MAX = 100;

/**
 * ประเภทอุปกรณ์ (หมวดหมู่งานซ่อม) — ไอคอน ชื่อ อาการที่พบบ่อย (ปุ่มลัดในฟอร์มแจ้งซ่อม) และจำนวนที่อ้างถึง
 * ตารางตามสเปค DataTable (ข้อ 8.2) บนจอใหญ่ · การ์ดบนมือถือ · ฟอร์มใน Modal · ลบผ่าน ConfirmDeleteModal
 * ประเภทที่มีใบแจ้งซ่อมหรือเครื่องอ้างถึงลบไม่ได้ (backend ตอบ 409) — บอกเหตุผลก่อนกด และแนะนำให้ปิดการใช้งานแทน
 */
export function CatalogManager({ items }: { items: Category[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'th'));

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/categories/${deleting.id}`, { method: 'DELETE' });
      toast.success(`ลบประเภท “${deleting.name}” แล้ว`);
      setDeleting(null);
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof ApiRequestError && failure.status === 409
          ? `${failure.message} — ปิดการใช้งานแทนได้ ข้อมูลเดิมยังอ้างถึงได้ตามปกติ`
          : failure instanceof Error
            ? failure.message
            : 'ลบไม่สำเร็จ',
      );
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: Category) => {
    setToggling(item.id);
    try {
      await api(`/api/v1/categories/${item.id}`, { method: 'PATCH', json: { isActive: !item.isActive } });
      toast.success(item.isActive ? `ปิดการใช้งาน “${item.name}” แล้ว` : `เปิดใช้งาน “${item.name}” แล้ว`);
      router.refresh();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setToggling(null);
    }
  };

  const usage = (item: Category) => {
    const parts = [
      item.requestCount > 0 ? `ใบแจ้งซ่อม ${formatNumber(item.requestCount)} ใบ` : null,
      item.equipmentCount > 0 ? `เครื่อง ${formatNumber(item.equipmentCount)} เครื่อง` : null,
    ].filter(Boolean);
    return parts.length ? `มี${parts.join(' และ')}อ้างถึงประเภทนี้อยู่ จึงลบไม่ได้ ให้ปิดการใช้งานแทน` : null;
  };

  const startDelete = (item: Category) => {
    setError(null);
    setDeleting(item);
  };

  const actions = (item: Category) => (
    <>
      <button
        type="button"
        onClick={() => setEditing(item)}
        aria-label={`แก้ไข ${item.name}`}
        className={iconButtonClass}
      >
        <EditIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => startDelete(item)}
        aria-label={`ลบ ${item.name}`}
        className={iconDangerButtonClass}
      >
        <DeleteIcon className="h-5 w-5" />
      </button>
    </>
  );

  const activeSwitch = (item: Category) => (
    <button
      type="button"
      role="switch"
      aria-checked={item.isActive}
      aria-label={`เปิดใช้งาน ${item.name}`}
      aria-busy={toggling === item.id || undefined}
      disabled={toggling === item.id}
      onClick={() => void toggle(item)}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
          item.isActive ? 'bg-primary-container' : 'bg-outline-variant'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            item.isActive ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </span>
      <StatusBadge tone={item.isActive ? 'success' : 'neutral'}>
        {item.isActive ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
      </StatusBadge>
    </button>
  );

  const counts = (item: Category) => (
    <>
      <span className="text-on-surface">{formatNumber(item.requestCount)}</span>
      <span className="text-on-surface-variant"> / </span>
      <span
        className={
          item.openRequestCount > 0 ? 'font-semibold text-primary-container' : 'text-on-surface-variant'
        }
      >
        {formatNumber(item.openRequestCount)}
      </span>
    </>
  );

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-outline-variant/40 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <p className="text-body-md text-on-surface-variant">
          ทั้งหมด {formatNumber(items.length)} ประเภท · ที่ปิดการใช้งานจะไม่แสดงตอนเพิ่มเครื่องและแจ้งซ่อม
        </p>
        <button type="button" onClick={() => setEditing('new')} className={primaryButtonClass}>
          <AddIcon className="h-4 w-4" />
          เพิ่มประเภทอุปกรณ์
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="ยังไม่มีประเภทอุปกรณ์"
          description="เพิ่มประเภทก่อน เช่น คอมพิวเตอร์ โปรเจกเตอร์ เครื่องปรับอากาศ แล้วจึงเพิ่มเครื่องในห้องได้"
          action={
            <button type="button" onClick={() => setEditing('new')} className={primaryButtonClass}>
              <AddIcon className="h-4 w-4" />
              เพิ่มประเภทอุปกรณ์
            </button>
          }
        />
      ) : (
        <>
          {/* มือถือ: การ์ด */}
          <ul className="divide-y divide-outline-variant/40 md:hidden">
            {sorted.map((item) => (
              <li key={item.id} className={`space-y-3 px-4 py-4 ${item.isActive ? '' : 'bg-surface/60'}`}>
                <div className="flex items-start gap-3">
                  <IconBox icon={item.icon} muted={!item.isActive} />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-md font-semibold text-on-surface">{item.name}</p>
                    <p className="text-caption text-on-surface-variant tabular-nums">
                      ใบแจ้งซ่อม {formatNumber(item.requestCount)} (ค้าง {formatNumber(item.openRequestCount)}
                      ) · เครื่อง {formatNumber(item.equipmentCount)}
                    </p>
                  </div>
                  <div className="-mr-2 -mt-2 flex shrink-0">{actions(item)}</div>
                </div>
                <SymptomChips symptoms={item.symptoms} />
                {activeSwitch(item)}
              </li>
            ))}
          </ul>
          {/* จอใหญ่: ตาราง */}
          <div className="hidden overflow-x-auto md:block">
            <table className={tableClass}>
              <thead>
                <tr className={theadRowClass}>
                  <th scope="col" className={thClass}>
                    ประเภทอุปกรณ์
                  </th>
                  <th scope="col" className={thClass}>
                    อาการที่พบบ่อย
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    ใบแจ้งซ่อม <span className="font-normal">(ทั้งหมด / ค้าง)</span>
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    เครื่อง
                  </th>
                  <th scope="col" className={thClass}>
                    สถานะ
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <tr key={item.id} className={`${tbodyRowClass} ${item.isActive ? '' : 'bg-surface/60'}`}>
                    <td className={tdClass}>
                      <div className="flex items-center gap-3">
                        <IconBox icon={item.icon} muted={!item.isActive} />
                        <div className="min-w-0">
                          <p className="font-medium text-on-surface">{item.name}</p>
                          <p className="text-caption text-on-surface-variant">
                            {CATEGORY_ICON_LABEL[item.icon]} · ลำดับ {item.sortOrder}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`${tdClass} max-w-md`}>
                      <SymptomChips symptoms={item.symptoms} />
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-right tabular-nums`}>{counts(item)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {formatNumber(item.equipmentCount)}
                    </td>
                    <td className={tdClass}>{activeSwitch(item)}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right`}>{actions(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'เพิ่มประเภทอุปกรณ์' : 'แก้ไขประเภทอุปกรณ์'}
        onClose={() => setEditing(null)}
        size="lg"
      >
        {editing !== null ? (
          <CategoryForm
            key={editing === 'new' ? 'new' : editing.id}
            current={editing === 'new' ? null : editing}
            nextSortOrder={items.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 10}
            onCancel={() => setEditing(null)}
            onSaved={(name, created) => {
              toast.success(created ? `เพิ่มประเภท “${name}” แล้ว` : `บันทึก “${name}” แล้ว`);
              setEditing(null);
              router.refresh();
            }}
          />
        ) : null}
      </Modal>
      <ConfirmDeleteModal
        open={deleting !== null}
        title="ลบประเภทอุปกรณ์"
        itemName={deleting?.name ?? ''}
        consequence="ประเภทนี้จะถูกลบถาวร"
        blockedReason={deleting ? usage(deleting) : null}
        confirmLabel="ลบประเภท"
        loading={busy}
        error={error}
        onConfirm={() => void remove()}
        onClose={() => !busy && setDeleting(null)}
      />
    </>
  );
}

function IconBox({ icon, muted = false }: { icon: CategoryIcon; muted?: boolean }) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
        muted ? 'bg-surface-container text-outline' : 'bg-primary-container/10 text-primary-container'
      }`}
      title={CATEGORY_ICON_LABEL[icon]}
    >
      <CategoryGlyph icon={icon} className="h-6 w-6" />
    </span>
  );
}

function SymptomChips({ symptoms }: { symptoms: string[] }) {
  if (symptoms.length === 0)
    return <span className="text-caption text-on-surface-variant">ยังไม่ได้กำหนดอาการ</span>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="อาการที่พบบ่อย">
      {symptoms.map((symptom) => (
        <li
          key={symptom}
          className="rounded-full bg-surface-container px-2.5 py-1 text-label-sm font-normal text-on-surface-variant"
        >
          {symptom}
        </li>
      ))}
    </ul>
  );
}

type Errors = { name?: string; icon?: string; sortOrder?: string; symptoms?: string };

function CategoryForm({
  current,
  nextSortOrder,
  onCancel,
  onSaved,
}: {
  current: Category | null;
  nextSortOrder: number;
  onCancel: () => void;
  onSaved: (name: string, created: boolean) => void;
}) {
  const symptomInputId = useId();
  const [name, setName] = useState(current?.name ?? '');
  const [icon, setIcon] = useState<CategoryIcon>(current?.icon ?? 'other');
  const [sortOrder, setSortOrder] = useState(String(current?.sortOrder ?? nextSortOrder));
  const [symptoms, setSymptoms] = useState<string[]>(current?.symptoms ?? []);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addSymptom = () => {
    const text = draft.trim().replace(/\s+/g, ' ');
    if (!text) return;
    if (text.length < SYMPTOM_MIN || text.length > SYMPTOM_MAX)
      return setDraftError(`อาการต้องยาว ${SYMPTOM_MIN}–${SYMPTOM_MAX} ตัวอักษร`);
    if (symptoms.includes(text)) return setDraftError('มีอาการนี้อยู่แล้ว');
    if (symptoms.length >= MAX_SYMPTOMS) return setDraftError(`ใส่ได้สูงสุด ${MAX_SYMPTOMS} อาการ`);
    setSymptoms((list) => [...list, text]);
    setDraft('');
    setDraftError(null);
    if (errors.symptoms) setErrors((e) => ({ ...e, symptoms: undefined }));
  };

  const onDraftKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSymptom();
    }
  };

  const removeSymptom = (symptom: string) => {
    setSymptoms((list) => list.filter((s) => s !== symptom));
    setDraftError(null);
    document.getElementById(symptomInputId)?.focus();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Errors = {};
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) found.name = 'ชื่อต้องยาว 2–100 ตัวอักษร';
    const order = Number(sortOrder);
    if (!Number.isInteger(order) || order < 0 || order > 9999)
      found.sortOrder = 'ลำดับต้องเป็นจำนวนเต็ม 0–9999';
    if (symptoms.length > MAX_SYMPTOMS) found.symptoms = `ใส่อาการได้สูงสุด ${MAX_SYMPTOMS} อาการ`;
    setErrors(found);
    const first = (['name', 'sortOrder'] as const).find((key) => found[key]);
    if (first) {
      document.getElementById(`cat-${first}`)?.focus();
      return;
    }
    if (Object.keys(found).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await api(current ? `/api/v1/categories/${current.id}` : '/api/v1/categories', {
        method: current ? 'PATCH' : 'POST',
        json: { name: trimmed, icon, sortOrder: order, symptoms },
      });
      onSaved(trimmed, !current);
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.code === 'VALIDATION_ERROR') {
        const fields = failure.fieldErrors();
        const symptomKey = Object.keys(fields).find((key) => key.startsWith('symptoms'));
        setErrors({
          name: fields.name,
          icon: fields.icon,
          sortOrder: fields.sortOrder,
          symptoms: symptomKey ? fields[symptomKey] : undefined,
        });
        if (!Object.keys(fields).length) setFormError(failure.message);
      } else setFormError(failure instanceof Error ? failure.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const symptomHint = `กดเพิ่มหรือ Enter · ${symptoms.length}/${MAX_SYMPTOMS} อาการ · แต่ละอาการ ${SYMPTOM_MIN}–${SYMPTOM_MAX} ตัวอักษร · แสดงเป็นปุ่มลัดในฟอร์มแจ้งซ่อม`;
  const symptomError = draftError ?? errors.symptoms;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError ? (
        <p
          role="alert"
          className="rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container"
        >
          {formError}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <FormField id="cat-name" label="ชื่อประเภทอุปกรณ์" required error={errors.name}>
          <input
            id="cat-name"
            data-autofocus
            aria-required="true"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy('cat-name', { error: errors.name })}
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="เช่น คอมพิวเตอร์ตั้งโต๊ะ"
            className={`${inputClass} ${errors.name ? 'input-error' : ''}`}
          />
        </FormField>
        <FormField id="cat-sortOrder" label="ลำดับ" error={errors.sortOrder} hint="น้อยแสดงก่อน">
          <input
            id="cat-sortOrder"
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            step={1}
            aria-invalid={errors.sortOrder ? true : undefined}
            aria-describedby={describedBy('cat-sortOrder', { hint: true, error: errors.sortOrder })}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className={`${inputClass} tabular-nums ${errors.sortOrder ? 'input-error' : ''}`}
          />
        </FormField>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-label-md text-on-surface">ไอคอน</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {ICONS.map((key) => {
            const selected = key === icon;
            return (
              <label
                key={key}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-label-sm transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-container ${
                  selected
                    ? 'border-primary-container bg-primary-container/10 text-primary-container'
                    : 'border-outline-variant text-on-surface-variant hover:bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="cat-icon"
                  value={key}
                  checked={selected}
                  onChange={() => setIcon(key)}
                  className="sr-only"
                />
                <CategoryGlyph icon={key} className="h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate">{CATEGORY_ICON_LABEL[key]}</span>
                  <span className="block truncate font-normal text-caption" lang="en">
                    {key}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.icon ? <p className="text-label-sm text-error">{errors.icon}</p> : null}
      </fieldset>

      <div className="space-y-2">
        <label htmlFor={symptomInputId} className="block text-label-md text-on-surface">
          อาการที่พบบ่อย
        </label>
        {symptoms.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="อาการที่เพิ่มแล้ว">
            {symptoms.map((symptom) => (
              <li
                key={symptom}
                className="inline-flex items-center gap-1 rounded-full bg-primary-container/10 py-1 pl-3 pr-1 text-label-sm text-primary-container"
              >
                {symptom}
                <button
                  type="button"
                  onClick={() => removeSymptom(symptom)}
                  aria-label={`ลบอาการ ${symptom}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-primary-container/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-container"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-on-surface-variant">
            ยังไม่มีอาการ — เช่น “เปิดไม่ติด” “จอไม่แสดงภาพ”
          </p>
        )}
        <div className="flex gap-2">
          <input
            id={symptomInputId}
            value={draft}
            maxLength={SYMPTOM_MAX}
            disabled={symptoms.length >= MAX_SYMPTOMS}
            onChange={(event) => {
              setDraft(event.target.value);
              if (draftError) setDraftError(null);
            }}
            onKeyDown={onDraftKey}
            aria-invalid={symptomError ? true : undefined}
            aria-describedby={`${symptomInputId}-hint${symptomError ? ` ${symptomInputId}-error` : ''}`}
            placeholder={symptoms.length >= MAX_SYMPTOMS ? 'ครบจำนวนแล้ว' : 'พิมพ์อาการ เช่น เสียงดังผิดปกติ'}
            className={`${inputClass} ${symptomError ? 'input-error' : ''}`}
          />
          <button
            type="button"
            onClick={addSymptom}
            disabled={!draft.trim() || symptoms.length >= MAX_SYMPTOMS}
            className={`${tonalButtonClass} shrink-0`}
          >
            <AddIcon className="h-4 w-4" />
            เพิ่ม
          </button>
        </div>
        <p id={`${symptomInputId}-hint`} className="text-label-sm font-normal text-on-surface-variant">
          {symptomHint}
        </p>
        {symptomError ? (
          <p id={`${symptomInputId}-error`} role="alert" className="text-label-sm text-error">
            {symptomError}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className={secondaryButtonClass} disabled={busy}>
          ยกเลิก
        </button>
        <LoadingButton type="submit" loading={busy} className={primaryButtonClass}>
          บันทึก
        </LoadingButton>
      </div>
    </form>
  );
}
