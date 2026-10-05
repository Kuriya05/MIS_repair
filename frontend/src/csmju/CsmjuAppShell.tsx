'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { UNAUTHORIZED_EVENT } from '@/lib/api';
import { loginHref } from '@/lib/config';
import { currentPath, hasUnsavedForm, startReSso } from '@/lib/sso';
import { CsmjuLogo } from './CsmjuLogo';
import { Avatar } from './Avatar';
import * as Icons from './icons';
import type { IconProps } from './icons';
import { SIDEBAR_COOKIE } from './shell';
import { iconRoundButtonClass } from './ui';

export type ShellIcon = keyof typeof ICONS;
export type ShellNavItem = {
  label: string;
  labelEn?: string;
  href: string;
  icon: ShellIcon;
  exact?: boolean;
};
/** detail = บรรทัดรองใต้ชื่อ (รหัสบุคคล) · ระบบนี้ไม่เก็บและไม่แสดงอีเมล */
export type ShellUser = {
  displayName: string;
  detail?: string | null;
  roleLabel: string;
  avatarUrl?: string | null;
};

const ICONS = {
  dashboard: Icons.DashboardIcon,
  assignment: Icons.AssignmentIcon,
  add: Icons.AddIcon,
  inbox: Icons.InboxIcon,
  board: Icons.BoardIcon,
  chart: Icons.ChartIcon,
  qr: Icons.QrCodeIcon,
  notifications: Icons.NotificationsIcon,
  person: Icons.PersonIcon,
  group: Icons.GroupIcon,
  apartment: Icons.ApartmentIcon,
  category: Icons.CategoryIcon,
  build: Icons.BuildIcon,
} satisfies Record<string, ComponentType<IconProps>>;

/** ต่ออายุล่วงหน้าตอนเปลี่ยนหน้า ถ้า token จะหมดภายในเวลานี้ (auth-contract.md ข้อ 7) */
const RENEW_BEFORE_MS = 60_000;
const focusRingOnDark =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

/**
 * โครงหน้าจอกลางของทุกระบบย่อย (ui-design-system.md ข้อ 5.1) — stand-in ของ `CsmjuAppShell` ใน template
 * sidebar brand-gradient 256px · top bar 64px · drawer บนมือถือ · skip link · ปุ่มออกจากระบบล่าง sidebar
 * 401: silent re-SSO ผ่าน /auth/login?next=<หน้านี้> (auth-contract.md 1.2 ข้อ 7) พร้อมกันวน 30 วินาที
 *      หน้าที่มีฟอร์มกรอกค้างไม่ถูก redirect ทับ — ขึ้นแถบให้ต่ออายุในแท็บใหม่แทน
 * ออกจากระบบ = POST /auth/logout (ออกทั้ง Core Hub ไม่ใช่แค่ระบบนี้)
 *
 * ตามคำขอของเจ้าของระบบ: บนจอ md+ sidebar ย่อเป็นแถบไอคอน 72px และกางเต็ม 256px เมื่อชี้เมาส์
 * หรือกด Tab เข้ามา (กางทับเนื้อหา ไม่ดันหน้า) · ปุ่ม "ตรึงแถบเมนู" กลับเป็นแบบมาตรฐานที่กางตลอด
 * ปุ่มกลับ CSMJU Portal/ออกจากระบบยังอยู่ตำแหน่งเดิมทั้งสองแบบ · มือถือยังเป็น drawer ตามเดิม
 */
export function CsmjuAppShell({
  subsystemName,
  displayName,
  nav,
  user,
  primaryAction,
  searchSlot,
  notificationsSlot,
  homeHref,
  logoutAction,
  sessionExpiresAt,
  initialPinned = false,
  children,
}: {
  subsystemName: string;
  displayName: string;
  nav: ShellNavItem[];
  user: ShellUser;
  primaryAction?: { label: string; href: string };
  searchSlot?: ReactNode;
  notificationsSlot?: ReactNode;
  /** ปุ่ม "กลับ CSMJU Portal" (CORE_HUB_WEB_URL) · ไม่ส่ง = ไม่แสดง */
  homeHref?: string;
  logoutAction: string;
  /** ISO 8601 จาก GET /api/v1/me — ใช้ต่ออายุล่วงหน้าตอนเปลี่ยนหน้า */
  sessionExpiresAt?: string;
  initialPinned?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pinned, setPinned] = useState(initialPinned);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  /** session หมดระหว่างกรอกฟอร์ม · หรือ re-SSO วนกลับมาแล้วยัง 401 */
  const [sessionNotice, setSessionNotice] = useState<'unsaved' | 'retry' | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const expanded = pinned || hovered || keyboardFocus;

  // หน่วงนิดหน่อยก่อนกาง/หุบ — ลากเมาส์ผ่านเฉย ๆ จะไม่กระพริบ
  const onPointerEnter = (event: React.PointerEvent) => {
    if (event.pointerType === 'touch') return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHovered(true), 90);
  };
  const onPointerLeave = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHovered(false), 150);
  };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const togglePinned = () => {
    const next = !pinned;
    setPinned(next);
    if (!next) setHovered(false);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 'pinned' : 'auto'}; path=/; max-age=31536000; samesite=lax`;
  };

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    const onUnauthorized = () => {
      if (hasUnsavedForm()) {
        setSessionNotice('unsaved');
        return;
      }
      if (!startReSso()) setSessionNotice('retry');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // ต่ออายุล่วงหน้าตอนเปลี่ยนหน้า (ยังไม่มีอะไรกรอกค้างในหน้าใหม่) — ผู้ใช้ไม่เจอ 401 กลางฟอร์ม
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const left = new Date(sessionExpiresAt).getTime() - Date.now();
    if (left < RENEW_BEFORE_MS && !hasUnsavedForm()) startReSso();
  }, [pathname, sessionExpiresAt]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const isActive = (item: ShellNavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  /**
   * rail = แถบบนจอใหญ่ (หุบ/กางได้ + ปุ่มตรึง) · drawer มือถือกางเต็มเสมอ
   * ความลื่น: ทุกปุ่ม/เมนูกว้างเต็ม "ตามความกว้างของแถบ" จึงยืด-หดไปพร้อมกับ animation ของแถบเอง
   * ไอคอนอยู่ตำแหน่งเดิมตลอด · ข้อความค่อย ๆ จางเข้าหลังแถบเริ่มกาง และจางออกเร็วตอนหุบ
   */
  const renderSidebar = (open: boolean, rail: boolean) => {
    const label = `motion-fade whitespace-nowrap transition-[opacity,transform] ease-out ${
      open ? 'translate-x-0 opacity-100 delay-100 duration-200' : '-translate-x-1 opacity-0 duration-100'
    }`;
    const onDarkItem = `flex min-h-11 w-full items-center gap-2 overflow-hidden rounded-lg border border-white/25 bg-white/10 px-4 text-label-md text-white backdrop-blur-sm transition-colors hover:bg-white/20 ${focusRingOnDark}`;
    return (
      <div className="flex h-full w-full flex-col gap-5 overflow-hidden px-3 py-6 text-white">
        <div className="relative h-[152px] shrink-0">
          <span
            aria-hidden="true"
            className={`motion-fade absolute left-0 top-[26px] flex h-12 w-12 items-center justify-center rounded-xl bg-white text-primary-container shadow-sm transition-[opacity,transform] ease-out ${
              open ? 'scale-90 opacity-0 duration-100' : 'scale-100 opacity-100 delay-75 duration-200'
            }`}
          >
            <Icons.BuildIcon className="h-6 w-6" />
          </span>
          <div className={`absolute left-0 top-0 w-[232px] space-y-3 ${label}`}>
            <CsmjuLogo framed priority width={184} className="w-full justify-center" />
            <div>
              <p className="text-label-md text-white">{displayName}</p>
              <p className="text-caption text-primary-fixed">{subsystemName}</p>
            </div>
          </div>
        </div>
        {primaryAction ? (
          <Link
            href={primaryAction.href}
            className={`btn-gradient relative flex h-11 w-full shrink-0 items-center gap-3 overflow-hidden rounded-lg px-4 text-label-md text-on-primary shadow-md ${focusRingOnDark}`}
          >
            <Icons.AddIcon className="h-4 w-4 shrink-0" />
            <span className={label}>{primaryAction.label}</span>
          </Link>
        ) : null}
        <ScrollArea
          label="เมนูของระบบ"
          className="scrollbar-none -mx-3 -my-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-1"
        >
          <ul className="space-y-1">
            {nav.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-lg py-2 transition-colors duration-200 ${focusRingOnDark} ${
                      active
                        ? 'border-l-4 border-accent bg-white/10 pl-2.5 pr-3.5 text-white'
                        : 'px-3.5 text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className={`min-w-0 ${label}`}>
                      <span className="block text-label-md">{item.label}</span>
                      {item.labelEn ? (
                        <span lang="en" className="block text-caption text-white/50">
                          {item.labelEn}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <div className="shrink-0 space-y-3">
          {rail ? (
            <button
              type="button"
              onClick={togglePinned}
              aria-pressed={pinned}
              className={`flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-lg px-3.5 py-2 text-label-md text-white/70 transition-colors hover:bg-white/5 hover:text-white ${focusRingOnDark}`}
            >
              <Icons.PushPinIcon filled={pinned} className="h-5 w-5 shrink-0" />
              <span className={label}>{pinned ? 'เลิกตรึงแถบเมนู' : 'ตรึงแถบเมนูไว้'}</span>
            </button>
          ) : null}
          {homeHref ? (
            <a href={homeHref} className={onDarkItem}>
              <Icons.HomeIcon className="h-4 w-4 shrink-0" />
              <span className={label}>กลับ CSMJU Portal</span>
            </a>
          ) : null}
          <form method="post" action={logoutAction}>
            <button type="submit" className={onDarkItem}>
              <Icons.LogoutIcon className="h-4 w-4 shrink-0" />
              <span className={label}>ออกจากระบบ</span>
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="skip-link rounded-lg bg-surface-container-lowest px-4 py-2 text-label-md text-primary-container shadow-md"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>

      <aside
        aria-label="แถบเมนู"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocus={(event) => setKeyboardFocus((event.target as HTMLElement).matches(':focus-visible'))}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setKeyboardFocus(false);
        }}
        className={`brand-gradient fixed inset-y-0 left-0 z-30 hidden overflow-hidden shadow-xl transition-[width] md:block print:hidden ${
          expanded
            ? 'w-64 duration-300 ease-[cubic-bezier(0.2,0,0,1)]'
            : 'w-[72px] duration-200 ease-[cubic-bezier(0.3,0,0.8,0.15)]'
        }`}
      >
        {renderSidebar(expanded, true)}
      </aside>

      {drawerOpen ? (
        <button
          type="button"
          aria-label="ปิดเมนู"
          tabIndex={-1}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}
      <aside
        id="mobile-drawer"
        aria-label="เมนู"
        inert={!drawerOpen}
        className={`brand-gradient fixed inset-y-0 left-0 z-30 w-64 shadow-xl transition-transform duration-300 ease-out md:hidden print:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {drawerOpen ? (
          // อยู่นอกแผงเมนู (บนพื้นมืด) เพราะกรอบโลโก้สีขาวกินเต็มความกว้างของแผง
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="ปิดเมนู"
            className="absolute -right-14 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
          >
            <Icons.CloseIcon className="h-6 w-6" />
          </button>
        ) : null}
        {renderSidebar(true, false)}
      </aside>

      <div
        className={`flex min-h-dvh flex-col transition-[padding] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
          pinned ? 'md:pl-64' : 'md:pl-[72px]'
        }`}
      >
        <header className="sticky top-0 z-10 flex h-16 items-center gap-2 border-b border-surface-variant bg-surface-container-lowest px-4 shadow-sm md:px-8 print:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="เปิดเมนู"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            className={`${iconRoundButtonClass} md:hidden`}
          >
            <Icons.MenuIcon className="h-6 w-6" />
          </button>
          <Link href="/" className="text-gradient truncate font-display text-label-md md:hidden">
            {displayName}
          </Link>
          <div className="flex flex-1 justify-end md:justify-center">{searchSlot}</div>
          <div className="flex items-center gap-1">
            {notificationsSlot}
            <UserMenu user={user} homeHref={homeHref} logoutAction={logoutAction} />
          </div>
        </header>

        {sessionNotice ? <SessionNotice kind={sessionNotice} onClose={() => setSessionNotice(null)} /> : null}

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-content flex-1 space-y-8 px-4 py-6 focus:outline-none md:px-12 md:py-10"
        >
          {children}
        </main>

        <footer className="border-t border-outline-variant/30 bg-surface-container-low px-4 py-5 md:px-12 print:hidden">
          <div className="mx-auto flex max-w-content flex-col gap-2 text-caption text-on-surface-variant md:flex-row md:items-center md:justify-between">
            <p>
              © {new Date().getFullYear() + 543} สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้
            </p>
            {homeHref ? (
              <a href={homeHref} className="font-semibold text-secondary hover:underline">
                CSMJU Portal
              </a>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}

const FADE_EDGE_CLASS = {
  none: '',
  top: 'fade-edge-top',
  bottom: 'fade-edge-bottom',
  both: 'fade-edge-both',
} as const;

/**
 * รายการเมนูที่เลื่อนได้เมื่อจอเตี้ย (ซ่อนแถบเลื่อนไว้) — ขอบบน/ล่างจางลงเฉพาะด้านที่ยังมีรายการซ่อนอยู่
 * จึงไม่ถูกตัดขอบแข็ง ๆ และผู้ใช้รู้ว่าเลื่อนต่อได้
 */
function ScrollArea({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [fade, setFade] = useState<keyof typeof FADE_EDGE_CLASS>('none');

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const hidden = element.scrollHeight - element.clientHeight;
      const above = element.scrollTop > 1;
      const below = element.scrollTop < hidden - 1;
      setFade(hidden <= 1 ? 'none' : above && below ? 'both' : above ? 'top' : 'bottom');
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <nav ref={ref} aria-label={label} className={`${className} ${FADE_EDGE_CLASS[fade]}`}>
      {children}
    </nav>
  );
}

/**
 * เมนูผู้ใช้บน top bar — แสดงแค่ avatar (ตามคำขอของเจ้าของระบบ) กดแล้วจึงเห็นชื่อ อีเมล บทบาท และเมนู
 * คีย์บอร์ด: Enter/Space เปิด · ลูกศรขึ้น-ลง/Home/End เลือก · Esc ปิดแล้วโฟกัสกลับที่ avatar
 */
function UserMenu({
  user,
  homeHref,
  logoutAction,
}: {
  user: ShellUser;
  /** ปุ่ม "กลับ CSMJU Portal" (CORE_HUB_WEB_URL) · ไม่ส่ง = ไม่แสดง */
  homeHref?: string;
  logoutAction: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (next: number) => {
      event.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (event.key === 'ArrowDown') focus(index + 1);
    else if (event.key === 'ArrowUp') focus(index - 1);
    else if (event.key === 'Home') focus(0);
    else if (event.key === 'End') focus(items.length - 1);
    else if (event.key === 'Tab') setOpen(false);
  };

  const itemClass =
    'flex min-h-11 items-center gap-3 px-4 text-body-md text-on-surface outline-offset-[-2px] transition-colors hover:bg-surface focus-visible:bg-surface';

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`บัญชีผู้ใช้: ${user.displayName}`}
        title={user.displayName}
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-shadow duration-150 hover:ring-4 hover:ring-primary-container/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container ${
          open ? 'ring-4 ring-primary-container/15' : ''
        }`}
      >
        <Avatar name={user.displayName} src={user.avatarUrl} size={36} />
      </button>
      {open ? (
        <div className="fade-slide-up absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-xl">
          <div className="flex items-center gap-3 border-b border-outline-variant/40 px-4 py-4">
            <Avatar name={user.displayName} src={user.avatarUrl} size={48} />
            <div className="min-w-0">
              <p className="truncate text-label-md text-on-surface">{user.displayName}</p>
              {user.detail ? (
                <p className="truncate text-caption text-on-surface-variant">{user.detail}</p>
              ) : null}
              <p className="mt-1.5 inline-flex rounded-full bg-primary-container/10 px-2.5 py-0.5 text-label-sm text-primary-container">
                {user.roleLabel}
              </p>
            </div>
          </div>
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label="บัญชีผู้ใช้"
            onKeyDown={onMenuKeyDown}
            className="py-1"
          >
            <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className={itemClass}>
              <Icons.PersonIcon className="h-5 w-5 text-outline" />
              โปรไฟล์ของฉัน
            </Link>
            {homeHref ? (
              <a role="menuitem" href={homeHref} className={itemClass}>
                <Icons.HomeIcon className="h-5 w-5 text-outline" />
                กลับ CSMJU Portal
              </a>
            ) : null}
            <div role="separator" className="my-1 h-px bg-outline-variant/40" />
            <form method="post" action={logoutAction}>
              <button
                role="menuitem"
                type="submit"
                className="flex min-h-11 w-full items-center gap-3 px-4 text-body-md text-error outline-offset-[-2px] transition-colors hover:bg-error-container/60 focus-visible:bg-error-container/60"
              >
                <Icons.LogoutIcon className="h-5 w-5" />
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * แถบแจ้งเมื่อ session หมด — ไม่ redirect ทับฟอร์มที่กรอกค้าง (auth-contract.md 1.2 ข้อ 7)
 * unsaved: ต่ออายุในแท็บใหม่แล้วกลับมากดส่งในหน้านี้ได้ (คุกกี้ใช้ร่วมกันทุกแท็บ)
 * retry: re-SSO วนกลับมาแล้วยัง 401 ภายใน 30 วินาที — ให้ผู้ใช้กดเอง
 */
function SessionNotice({ kind, onClose }: { kind: 'unsaved' | 'retry'; onClose: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 border-b border-error/30 bg-error-container px-4 py-3 text-body-md text-on-error-container md:px-12 print:hidden"
    >
      <p className="min-w-0 flex-1">
        {kind === 'unsaved'
          ? 'เซสชันหมดอายุ ข้อมูลที่กรอกไว้ยังอยู่ — กด “ต่ออายุในแท็บใหม่” แล้วกลับมากดส่งอีกครั้ง'
          : 'ยังเข้าสู่ระบบไม่สำเร็จ กรุณากดเข้าสู่ระบบอีกครั้ง'}
      </p>
      {kind === 'unsaved' ? (
        <a
          href={loginHref()}
          target="_blank"
          rel="noopener"
          onClick={onClose}
          className="rounded-full bg-error px-4 py-2 text-label-md text-on-primary hover:opacity-90"
        >
          ต่ออายุในแท็บใหม่
        </a>
      ) : (
        <a
          href={loginHref(currentPath())}
          className="rounded-full bg-error px-4 py-2 text-label-md text-on-primary hover:opacity-90"
        >
          เข้าสู่ระบบอีกครั้ง
        </a>
      )}
    </div>
  );
}
