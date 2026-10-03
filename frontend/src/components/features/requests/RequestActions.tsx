'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  BlockIcon,
  CheckCircleIcon,
  EditIcon,
  inputClass,
  Modal,
  PauseIcon,
  PersonIcon,
  PlayIcon,
  primaryButtonClass,
  secondaryButtonClass,
  dangerButtonClass,
} from '@/csmju';
import { FormField } from '@/components/shared/FormField';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api, ApiRequestError } from '@/lib/api';
import { PRIORITIES, PRIORITY_LABEL } from '@/lib/labels';
import type { Priority, RepairRequestDetail, StatusTarget } from '@/lib/types';
import { PhotoPicker, type PickedPhoto } from './PhotoPicker';

type Option = { value: string; label: string };
type Dialog = 'assign' | 'hold' | 'complete' | 'reject' | 'cancel' | 'edit' | null;

/**
 * ปุ่มดำเนินการของใบแจ้งซ่อม — แสดงเฉพาะที่ backend บอกว่าผู้ใช้คนนี้ทำได้ตอนนี้ (allowedActions)
 * ปุ่มหลัก (gradient) มีได้ 1 ปุ่ม · 409 CONFLICT แสดงเป็นข้อความในพื้นที่เดียวกันพร้อมทางออก (ข้อ 9.3)
 */
export function RequestActions({
  request,
  technicians,
  categories,
}: {
  request: RepairRequestDetail;
  technicians: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const toast = useToast();
  const allowed = new Set(request.allowedActions);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const call = async (path: string, init: Parameters<typeof api>[1], success: string) => {
    setBusy(true);
    setError(null);
    setDialogError(null);
    try {
      await api(`/api/v1/repair-requests/${request.id}${path}`, init);
      toast.success(success);
      setDialog(null);
      router.refresh();
      return true;
    } catch (failure) {
      const message =
        failure instanceof ApiRequestError
          ? failure.code === 'VALIDATION_ERROR' && failure.details.length
            ? failure.details.map((detail) => detail.replace(/^[^:]+:\s*/, '')).join(' · ')
            : failure.message
          : 'ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง';
      if (dialog) setDialogError(message);
      else setError(message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status: StatusTarget, success: string, note?: string, photos: PickedPhoto[] = []) => {
    if (photos.length === 0)
      return call('/status', { method: 'POST', json: { status, ...(note ? { note } : {}) } }, success);
    const body = new FormData();
    body.set('status', status);
    if (note) body.set('note', note);
    for (const photo of photos) body.append('photos', photo.file, photo.file.name);
    return call('/status', { method: 'POST', body }, success);
  };

  const buttons: ReactNode[] = [];
  let primaryUsed = false;
  const primary = () => {
    const use = !primaryUsed;
    primaryUsed = true;
    return use ? primaryButtonClass : secondaryButtonClass;
  };

  if (allowed.has('accept')) {
    buttons.push(
      <LoadingButton
        key="accept"
        loading={busy && !dialog}
        className={primary()}
        onClick={() => call('/accept', { method: 'POST' }, 'รับงานแล้ว — ผู้แจ้งได้รับการแจ้งเตือน')}
      >
        <PersonIcon className="h-4 w-4" />
        รับงานนี้
      </LoadingButton>,
    );
  }
  if (allowed.has('start')) {
    const resume = request.status === 'ON_HOLD';
    buttons.push(
      <LoadingButton
        key="start"
        loading={busy && !dialog}
        className={primary()}
        onClick={() => changeStatus('IN_PROGRESS', resume ? 'กลับมาดำเนินการต่อแล้ว' : 'เริ่มดำเนินการแล้ว')}
      >
        <PlayIcon className="h-4 w-4" />
        {resume ? 'กลับมาดำเนินการต่อ' : 'เริ่มดำเนินการ'}
      </LoadingButton>,
    );
  }
  if (allowed.has('complete')) {
    buttons.push(
      <button key="complete" type="button" className={primary()} onClick={() => setDialog('complete')}>
        <CheckCircleIcon className="h-4 w-4" />
        ปิดงาน (ซ่อมเสร็จ)
      </button>,
    );
  }
  if (allowed.has('hold')) {
    buttons.push(
      <button key="hold" type="button" className={secondaryButtonClass} onClick={() => setDialog('hold')}>
        <PauseIcon className="h-4 w-4" />
        พักงาน/รออะไหล่
      </button>,
    );
  }
  if (allowed.has('assign')) {
    buttons.push(
      <button key="assign" type="button" className={secondaryButtonClass} onClick={() => setDialog('assign')}>
        <PersonIcon className="h-4 w-4" />
        {request.assignee ? 'โอนงานให้ช่างคนอื่น' : 'มอบหมายช่าง'}
      </button>,
    );
  }
  if (allowed.has('edit')) {
    buttons.push(
      <button key="edit" type="button" className={secondaryButtonClass} onClick={() => setDialog('edit')}>
        <EditIcon className="h-4 w-4" />
        แก้ไขความเร่งด่วน/หมวดหมู่
      </button>,
    );
  }
  if (allowed.has('reject')) {
    buttons.push(
      <button
        key="reject"
        type="button"
        className={`${secondaryButtonClass} text-error`}
        onClick={() => setDialog('reject')}
      >
        <BlockIcon className="h-4 w-4" />
        แจ้งว่าดำเนินการไม่ได้
      </button>,
    );
  }
  if (allowed.has('cancel')) {
    buttons.push(
      <button
        key="cancel"
        type="button"
        className={`${secondaryButtonClass} text-error`}
        onClick={() => setDialog('cancel')}
      >
        <BlockIcon className="h-4 w-4" />
        ยกเลิกใบแจ้งซ่อม
      </button>,
    );
  }

  if (buttons.length === 0) return null;
  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setDialogError(null);
  };

  return (
    <div className="space-y-3 print:hidden">
      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container md:flex-row md:items-center md:justify-between"
        >
          <span>{error}</span>
          <button type="button" onClick={() => router.refresh()} className="text-label-md underline">
            โหลดข้อมูลล่าสุด
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">{buttons}</div>

      <NoteDialog
        open={dialog === 'hold'}
        title="พักงาน / รออะไหล่"
        label="เหตุผลที่พักงาน"
        hint="ผู้แจ้งจะเห็นข้อความนี้ เช่น รอคอมเพรสเซอร์จากผู้จำหน่าย ประมาณ 3 วันทำการ"
        required
        confirmLabel="พักงาน"
        busy={busy}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={(note) => changeStatus('ON_HOLD', 'พักงานแล้ว ผู้แจ้งได้รับการแจ้งเตือน', note)}
      />
      <NoteDialog
        open={dialog === 'reject'}
        title="แจ้งว่าดำเนินการไม่ได้"
        label="เหตุผล"
        hint="เช่น แจ้งซ้ำกับ RP-6909-0012 · อยู่นอกความรับผิดชอบของสาขา · ต้องส่งซ่อมภายนอก"
        required
        confirmLabel="ยืนยันว่าดำเนินการไม่ได้"
        danger
        busy={busy}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={(note) => changeStatus('REJECTED', 'บันทึกแล้ว ผู้แจ้งได้รับการแจ้งเตือนพร้อมเหตุผล', note)}
      />
      <NoteDialog
        open={dialog === 'cancel'}
        title={`ยกเลิกใบแจ้งซ่อม ${request.code}`}
        label="เหตุผลที่ยกเลิก"
        hint="ไม่บังคับ · เช่น แจ้งผิดห้อง หรือกลับมาใช้งานได้แล้ว"
        confirmLabel="ยกเลิกใบแจ้งซ่อม"
        cancelLabel="ไม่ยกเลิก"
        danger
        busy={busy}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={(reason) =>
          call('/cancel', { method: 'POST', json: reason ? { reason } : {} }, 'ยกเลิกใบแจ้งซ่อมแล้ว')
        }
      />
      <CompleteDialog
        open={dialog === 'complete'}
        busy={busy}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={(note, photos) =>
          changeStatus('COMPLETED', 'ปิดงานแล้ว ผู้แจ้งจะได้รับคำขอให้คะแนน', note, photos)
        }
      />
      <AssignDialog
        open={dialog === 'assign'}
        technicians={technicians.filter((option) => option.value !== request.assignee?.coreUserId)}
        busy={busy}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={(assigneeCoreUserId, note) =>
          call(
            '/assign',
            { method: 'POST', json: { assigneeCoreUserId, ...(note ? { note } : {}) } },
            'มอบหมายงานแล้ว ช่างได้รับการแจ้งเตือน',
          )
        }
      />
      <EditDialog
        open={dialog === 'edit'}
        request={request}
        categories={categories}
        busy={busy}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={(priority, categoryId) =>
          call('', { method: 'PATCH', json: { priority, categoryId } }, 'บันทึกการเปลี่ยนแปลงแล้ว')
        }
      />
    </div>
  );
}

function DialogError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container">
      {message}
    </p>
  ) : null;
}

function NoteDialog({
  open,
  title,
  label,
  hint,
  required = false,
  confirmLabel,
  cancelLabel = 'ยกเลิก',
  danger = false,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  hint: string;
  required?: boolean;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (note: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (required && !note.trim()) {
      setMissing(true);
      return;
    }
    if (await onSubmit(note.trim())) setNote('');
  };
  return (
    <Modal open={open} title={title} onClose={onClose} dismissible={!busy}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <DialogError message={error} />
        <FormField
          id="dialog-note"
          label={label}
          required={required}
          hint={hint}
          error={missing ? 'กรุณาระบุเหตุผล' : null}
        >
          <textarea
            id="dialog-note"
            data-autofocus
            rows={4}
            maxLength={2000}
            value={note}
            aria-required={required || undefined}
            aria-invalid={missing || undefined}
            aria-describedby="dialog-note-hint"
            onChange={(event) => {
              setNote(event.target.value);
              if (event.target.value.trim()) setMissing(false);
            }}
            className={`${inputClass} ${missing ? 'input-error' : ''}`}
          />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass} disabled={busy}>
            {cancelLabel}
          </button>
          <LoadingButton
            type="submit"
            loading={busy}
            className={danger ? dangerButtonClass : primaryButtonClass}
          >
            {confirmLabel}
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}

function CompleteDialog({
  open,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (note: string, photos: PickedPhoto[]) => Promise<boolean>;
}) {
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await onSubmit(note.trim(), photos)) {
      setNote('');
      setPhotos([]);
    }
  };
  return (
    <Modal open={open} title="ปิดงาน (ซ่อมเสร็จ)" onClose={onClose} dismissible={!busy} size="lg">
      <form onSubmit={submit} noValidate className="space-y-4">
        <DialogError message={error} />
        <FormField
          id="complete-note"
          label="สรุปสิ่งที่ดำเนินการ"
          hint="ไม่บังคับ · ผู้แจ้งจะเห็นข้อความนี้ เช่น เปลี่ยนคาปาซิเตอร์และล้างแผงคอยล์"
        >
          <textarea
            id="complete-note"
            data-autofocus
            rows={4}
            maxLength={2000}
            value={note}
            aria-describedby="complete-note-hint"
            onChange={(event) => setNote(event.target.value)}
            className={inputClass}
          />
        </FormField>
        <PhotoPicker
          photos={photos}
          onChange={setPhotos}
          label="รูปหลังซ่อม"
          hint="ไม่บังคับ · สูงสุด 5 รูป เป็นหลักฐานการซ่อม"
        />
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass} disabled={busy}>
            ยกเลิก
          </button>
          <LoadingButton type="submit" loading={busy} className={primaryButtonClass}>
            ปิดงาน
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}

function AssignDialog({
  open,
  technicians,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  technicians: Option[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (assigneeCoreUserId: string, note: string) => Promise<boolean>;
}) {
  const [assignee, setAssignee] = useState('');
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!assignee) {
      setMissing(true);
      return;
    }
    if (await onSubmit(assignee, note.trim())) {
      setAssignee('');
      setNote('');
    }
  };
  return (
    <Modal open={open} title="มอบหมายช่าง" onClose={onClose} dismissible={!busy}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <DialogError message={error} />
        {technicians.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">
            ยังไม่มีช่างคนอื่นในระบบ — ผู้ดูแลกด “รับงาน” ที่บอร์ดงานซ่อมเพื่อดูแลงานนี้เองได้
          </p>
        ) : null}
        <FormField id="assign-to" label="ช่างผู้รับผิดชอบ" required error={missing ? 'กรุณาเลือกช่าง' : null}>
          <select
            id="assign-to"
            data-autofocus
            value={assignee}
            aria-required="true"
            aria-invalid={missing || undefined}
            onChange={(event) => {
              setAssignee(event.target.value);
              setMissing(false);
            }}
            className={`${inputClass} ${missing ? 'input-error' : ''}`}
          >
            <option value="">เลือกช่าง</option>
            {technicians.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="assign-note" label="หมายเหตุถึงช่าง" hint="ไม่บังคับ">
          <textarea
            id="assign-note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={inputClass}
          />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass} disabled={busy}>
            ยกเลิก
          </button>
          <LoadingButton
            type="submit"
            loading={busy}
            className={primaryButtonClass}
            disabled={technicians.length === 0}
          >
            มอบหมายงาน
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}

function EditDialog({
  open,
  request,
  categories,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  request: RepairRequestDetail;
  categories: Option[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (priority: Priority, categoryId: string) => Promise<boolean>;
}) {
  const [priority, setPriority] = useState<Priority>(request.priority);
  const [categoryId, setCategoryId] = useState(request.category.id);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(priority, categoryId);
  };
  return (
    <Modal open={open} title="แก้ไขความเร่งด่วน/หมวดหมู่" onClose={onClose} dismissible={!busy}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <DialogError message={error} />
        <FormField
          id="edit-priority"
          label="ความเร่งด่วน"
          hint="เปลี่ยนแล้วระบบคำนวณกำหนดเสร็จใหม่จากเวลาที่แจ้ง"
        >
          <select
            id="edit-priority"
            data-autofocus
            value={priority}
            aria-describedby="edit-priority-hint"
            onChange={(event) => setPriority(event.target.value as Priority)}
            className={inputClass}
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABEL[value]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="edit-category" label="หมวดหมู่งานซ่อม">
          <select
            id="edit-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={inputClass}
          >
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass} disabled={busy}>
            ยกเลิก
          </button>
          <LoadingButton type="submit" loading={busy} className={primaryButtonClass}>
            บันทึกการเปลี่ยนแปลง
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}
