'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronRightIcon, iconRoundButtonClass, SearchIcon } from '@/csmju';
import { StatusBadge } from '@/csmju';
import { api, toQuery } from '@/lib/api';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/labels';
import type { RepairRequestSummary } from '@/lib/types';

type Command = { id: string; label: string; hint?: string; href: string };

/**
 * ค้นหาด่วน (Ctrl+K / ⌘K) — ไปหน้าต่าง ๆ หรือเปิดใบแจ้งซ่อมจากเลขที่/สิ่งที่ชำรุด/สถานที่
 * combobox + listbox ตาม WAI-ARIA · ใช้คีย์บอร์ดได้ครบ (↑ ↓ Enter Esc)
 */
export function CommandPalette({ canSeeAll, isAdmin }: { canSeeAll: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const inputId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RepairRequestSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const pages = useMemo<Command[]>(() => {
    // ผู้ดูแลระบบแจ้งซ่อมเองไม่ได้ · ช่าง/ผู้ดูแลดูความเคลื่อนไหวในแผงข้างบอร์ดงานซ่อมแทนหน้าการแจ้งเตือน
    const list: Command[] = isAdmin
      ? []
      : [
          {
            id: 'new',
            label: 'แจ้งซ่อม',
            hint: 'เลือกห้องแล้วกดที่เครื่องที่เสีย',
            href: '/buildings',
          },
          { id: 'mine', label: 'ใบแจ้งซ่อมของฉัน', href: '/requests' },
        ];
    list.push(
      {
        id: 'buildings',
        label: 'อาคารและห้อง',
        hint: 'ดูสถานะเครื่องในแต่ละห้อง',
        href: '/buildings',
      },
      {
        id: 'equipment',
        label: 'ประเภทอุปกรณ์',
        hint: 'อุปกรณ์ทุกเครื่องแยกตามประเภท',
        href: '/equipment',
      },
    );
    if (!canSeeAll) list.push({ id: 'notifications', label: 'การแจ้งเตือน', href: '/notifications' });
    list.push({ id: 'profile', label: 'โปรไฟล์ของฉัน', href: '/profile' });
    if (canSeeAll) {
      list.push(
        {
          id: 'board',
          label: 'บอร์ดงานซ่อม',
          hint: 'รับเรื่อง เปลี่ยนสถานะงาน และดูความเคลื่อนไหวล่าสุด',
          href: '/board',
        },
        {
          id: 'mine-jobs',
          label: 'งานซ่อมของฉัน',
          hint: 'บอร์ดงานเฉพาะงานที่ฉันรับผิดชอบ',
          href: '/board?mine=1',
        },
        {
          id: 'stats',
          label: 'สถิติการแจ้งซ่อม',
          hint: 'แยกตามห้องและอุปกรณ์ที่แจ้งบ่อย',
          href: '/dashboard',
        },
      );
    }
    if (isAdmin) {
      list.push({
        id: 'categories',
        label: 'จัดการประเภทอุปกรณ์',
        hint: 'เพิ่ม/แก้ไขประเภทและอาการที่พบบ่อย',
        href: '/admin/categories',
      });
    }
    return list;
  }, [canSeeAll, isAdmin]);

  const text = query.trim();
  const commands = text ? pages.filter((page) => page.label.includes(text)) : pages;
  const options = [
    ...results.map((request) => ({ key: `r-${request.id}`, href: `/requests/${request.id}`, request })),
    ...commands.map((command) => ({ key: `p-${command.id}`, href: command.href, command })),
  ];

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setLoading(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    setActive(0);
    if (!open || text.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api<RepairRequestSummary[]>(
          `/api/v1/repair-requests${toQuery({ q: text, scope: canSeeAll ? 'all' : 'mine', limit: 6, sort: 'updated' })}`,
          { signal: controller.signal },
        );
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [text, open, canSeeAll]);

  const go = (href: string) => {
    close();
    router.push(href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && options[active]) {
      event.preventDefault();
      go(options[active].href);
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-11 w-full max-w-md items-center gap-3 rounded-full bg-surface px-4 text-left text-body-md text-outline transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container md:flex"
      >
        <SearchIcon className="h-5 w-5" />
        <span className="flex-1">ค้นหาใบแจ้งซ่อมหรือเมนู…</span>
        <kbd className="rounded border border-outline-variant px-1.5 text-caption text-on-surface-variant">
          Ctrl K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ค้นหา"
        className={`${iconRoundButtonClass} md:hidden`}
      >
        <SearchIcon className="h-6 w-6" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center p-4 pt-[12vh]">
          <button
            type="button"
            tabIndex={-1}
            aria-label="ปิดการค้นหา"
            className="absolute inset-0 cursor-default bg-black/40"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="ค้นหาด่วน"
            className="fade-slide-up relative w-full max-w-xl overflow-hidden rounded-xl bg-surface-container-lowest shadow-xl"
          >
            <label htmlFor={inputId} className="block px-4 pt-3 text-label-sm text-on-surface-variant">
              ค้นหาใบแจ้งซ่อมหรือเมนู
            </label>
            <div className="flex items-center gap-3 border-b border-outline-variant/40 px-4">
              <SearchIcon className="h-5 w-5 shrink-0 text-outline" />
              <input
                ref={input}
                id={inputId}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={options[active] ? `${listId}-${options[active].key}` : undefined}
                aria-autocomplete="list"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="เลขที่ใบแจ้ง เช่น RP-6909-0012 หรือ แอร์ห้อง 201"
                className="h-12 flex-1 rounded bg-transparent text-body-md text-on-surface placeholder:text-outline/70"
                autoComplete="off"
              />
              <kbd className="hidden rounded border border-outline-variant px-1.5 text-caption text-on-surface-variant sm:block">
                Esc
              </kbd>
            </div>
            <ul
              id={listId}
              role="listbox"
              aria-label="ผลการค้นหา"
              className="max-h-[60vh] overflow-y-auto py-2"
            >
              {loading ? (
                <li className="px-4 py-3 text-body-md text-on-surface-variant" aria-live="polite">
                  กำลังค้นหา…
                </li>
              ) : null}
              {!loading && text.length >= 2 && results.length === 0 && commands.length === 0 ? (
                <li className="px-4 py-6 text-center text-body-md text-on-surface-variant" aria-live="polite">
                  ไม่พบใบแจ้งซ่อมหรือเมนูที่ตรงกับ “{text}”
                </li>
              ) : null}
              {options.map((option, index) => (
                <li
                  key={option.key}
                  id={`${listId}-${option.key}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    go(option.href);
                  }}
                  className={`mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${index === active ? 'bg-primary-container/10' : ''}`}
                >
                  {'request' in option && option.request ? (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-label-md text-on-surface">
                          <span className="tabular-nums text-primary-container">{option.request.code}</span> ·{' '}
                          {option.request.equipment}
                        </span>
                        <span className="block truncate text-caption text-on-surface-variant">
                          {option.request.building.name} · {option.request.location}
                        </span>
                      </span>
                      <StatusBadge tone={STATUS_TONE[option.request.status]}>
                        {STATUS_LABEL[option.request.status]}
                      </StatusBadge>
                    </>
                  ) : 'command' in option && option.command ? (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block text-label-md text-on-surface">{option.command.label}</span>
                        {option.command.hint ? (
                          <span className="block text-caption text-on-surface-variant">
                            {option.command.hint}
                          </span>
                        ) : null}
                      </span>
                      <ChevronRightIcon className="h-4 w-4 text-outline" />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
