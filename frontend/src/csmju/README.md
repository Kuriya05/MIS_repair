# `src/csmju/` — ของกลางชั่วคราว (stand-in)

มาตรฐาน (`standards/docs/ui-design-system.md` ข้อ 17.0) ให้ copy โฟลเดอร์นี้มาจาก
`csmju-core-hub/templates/csmju-subsystem-web/` และ **ห้ามแก้ในระบบย่อย**

ตอนสร้างระบบนี้ repo `csmju-core-hub` ยังเข้าถึงไม่ได้ จึงสร้างชุดที่มีชื่อ export และหน้าตาตามสเปคในเอกสารมาตรฐาน
(ข้อ 3, 5.1, 7.2, 7.2.1, 8.3, 14) แทนไว้ก่อน:

| export                                                                 | อ้างอิงสเปค                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `CsmjuAppShell`                                                        | ข้อ 5.1 — sidebar `brand-gradient` 256px, top bar 64px, drawer มือถือ, skip link, 401 → Core Hub |
| `CsmjuLogo`                                                            | ข้อ 14.1 — **ยังไม่มีไฟล์โลโก้จริง** แสดงเป็นตัวอักษรแทน                                         |
| `PageHeader` · `Modal` · `ConfirmDeleteModal` · `Tabs` · `StatusBadge` | ข้อ 7.2.1 · 8.3                                                                                  |
| ไอคอน (`*Icon`)                                                        | ข้อ 14 — inline SVG, stroke 1.8, `currentColor`                                                  |
| class ใน `ui.ts`                                                       | ข้อ 7.2 / 7.2.1 / 8.2 (+ focus ring และ touch target 44px ที่สเปคระบุว่าต้องเพิ่ม)               |

**เมื่อได้ template จริง:** ลบโฟลเดอร์นี้แล้ว copy `csmju/` ของ template ทับ — หน้าจอ import จาก `@/csmju`
ด้วยชื่อเดียวกันอยู่แล้ว · token สีอยู่ใน `tailwind.config.ts` (เหตุผลที่ยังไม่ใช้ `@theme` ของ Tailwind v4 ดู `REPORT.md`)
