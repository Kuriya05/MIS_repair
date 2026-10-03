'use client';

import { useState, type FormEvent } from 'react';
import { inputClass, Modal, primaryButtonClass, secondaryButtonClass } from '@/csmju';
import { FormField } from '@/components/shared/FormField';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { roomLineOf, titleOf, type Move } from './board-model';

/** พักงานต้องมีเหตุผล (backend บังคับ) · ปิดงานใส่หมายเหตุได้ — แนบรูปหลังซ่อมทำที่หน้าใบแจ้งซ่อม */
export function BoardNoteDialog({
  move,
  onClose,
  onConfirm,
}: {
  move: Move | null;
  onClose: () => void;
  onConfirm: (note?: string) => void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hold = move?.action === 'hold';

  const close = () => {
    setNote('');
    setError(null);
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (hold && note.trim().length === 0) {
      setError('กรุณาระบุเหตุผล เช่น รออะไหล่');
      return;
    }
    onConfirm(note.trim() || undefined);
    setNote('');
    setError(null);
  };

  return (
    <Modal
      open={move !== null}
      title={hold ? `รออะไหล่/พักงาน ${move?.card.code ?? ''}` : `ปิดงาน ${move?.card.code ?? ''}`}
      onClose={close}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-body-md text-on-surface-variant">
          <span className="font-semibold text-on-surface">{move ? titleOf(move.card) : ''}</span>
          {move ? ` · ${roomLineOf(move.card)}` : ''}
          {!hold ? ' — แนบรูปหลังซ่อมได้ที่หน้าใบแจ้งซ่อม' : ''}
        </p>
        <FormField
          id="board-note"
          label={hold ? 'เหตุผลที่พักงาน' : 'หมายเหตุถึงผู้แจ้ง'}
          required={hold}
          error={error ?? undefined}
        >
          <textarea
            id="board-note"
            data-autofocus
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'board-note-error' : undefined}
            className={`${inputClass} ${error ? 'input-error' : ''}`}
            placeholder={hold ? 'เช่น รออะไหล่คอมเพรสเซอร์ 3 วัน' : 'เช่น เปลี่ยนหลอดไฟใหม่ 2 หลอด'}
          />
        </FormField>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={close} className={secondaryButtonClass}>
            ยกเลิก
          </button>
          <LoadingButton type="submit" className={primaryButtonClass}>
            {hold ? 'พักงาน' : 'ปิดงาน'}
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}
