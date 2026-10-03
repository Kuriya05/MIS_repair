import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cardClass, cardHeaderClass, cardTitleClass, InfoIcon, PageHeader, StatusBadge } from '@/csmju';
import { AvatarEditor } from '@/components/features/AvatarEditor';
import { ApiFailure } from '@/components/shared/ApiFailure';
import { CORE_HUB_URL } from '@/lib/config';
import { formatDateTime } from '@/lib/format';
import { CORE_ROLE_LABEL, SUBSYSTEM_ROLE_LABEL } from '@/lib/labels';
import { getMe } from '@/lib/session';

export const metadata: Metadata = { title: 'โปรไฟล์ของฉัน' };

/**
 * โปรไฟล์ของฉัน — ระบบนี้เก็บแค่รูปโปรไฟล์ · ชื่อ รหัส และบทบาทมาจาก CSMJU Portal (Core Hub)
 * ไม่เก็บข้อมูลติดต่อเพิ่ม (ระบบย่อยเก็บข้อมูลบุคคลเท่าที่จำเป็น)
 */
export default async function ProfilePage() {
  const me = await getMe();
  if (!me.ok) return <ApiFailure result={me} />;
  const user = me.data;

  return (
    <>
      <PageHeader title="โปรไฟล์ของฉัน" description="รูปโปรไฟล์ และข้อมูลบัญชีของคุณจาก CSMJU Portal" />
      <div className="grid gap-8 xl:grid-cols-3">
        <section className={`${cardClass} xl:col-span-2`} aria-labelledby="avatar-title">
          <div className={cardHeaderClass}>
            <h2 id="avatar-title" className={cardTitleClass}>
              รูปโปรไฟล์
            </h2>
          </div>
          <div className="p-6">
            <AvatarEditor me={user} />
          </div>
        </section>
        <section className={cardClass} aria-labelledby="identity-title">
          <div className={cardHeaderClass}>
            <h2 id="identity-title" className={cardTitleClass}>
              บัญชี CSMJU
            </h2>
          </div>
          <div className="space-y-5 p-6">
            <p className="flex gap-2 rounded-lg bg-surface px-4 py-3 text-body-md text-on-surface-variant">
              <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
              <span>
                ชื่อ รหัส และบทบาทมาจาก{' '}
                {CORE_HUB_URL ? (
                  <a href={`${CORE_HUB_URL}/`} className="text-primary-container hover:underline">
                    CSMJU Portal
                  </a>
                ) : (
                  'CSMJU Portal'
                )}{' '}
                แก้ไขในระบบนี้ไม่ได้
              </span>
            </p>
            <dl className="space-y-4">
              <Row label="ชื่อ">
                {user.displayName}
                {!user.nameFromCoreHub ? (
                  <span className="block text-caption text-on-surface-variant">
                    ยังดึงชื่อจาก CSMJU Portal ไม่ได้ จึงแสดงเป็นรหัสแทน
                  </span>
                ) : null}
              </Row>
              <Row label="รหัสบุคคล">
                <span className="tabular-nums">{user.personCode ?? 'ยังไม่ผูกกับทะเบียนบุคคล'}</span>
              </Row>
              <Row label="บทบาทใน CSMJU">
                <StatusBadge tone="neutral">{CORE_ROLE_LABEL[user.coreRole] ?? user.coreRole}</StatusBadge>
              </Row>
              <Row label="บทบาทในระบบแจ้งซ่อม">
                <StatusBadge tone="info">{SUBSYSTEM_ROLE_LABEL[user.subsystemRole]}</StatusBadge>
              </Row>
              <Row label="เข้าสู่ระบบถึง">
                <time dateTime={user.session.expiresAt}>{formatDateTime(user.session.expiresAt)}</time>
              </Row>
            </dl>
          </div>
        </section>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-label-sm text-on-surface-variant">{label}</dt>
      <dd className="break-words text-body-md text-on-surface">{children}</dd>
    </div>
  );
}
