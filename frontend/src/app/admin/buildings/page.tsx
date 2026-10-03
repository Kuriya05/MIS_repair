import { redirect } from 'next/navigation';

/** อาคารย้ายไปที่ /buildings (ทุกคนดูได้ · ผู้ดูแลระบบเพิ่มห้อง/เครื่องที่นั่น) — ลิงก์เดิมยังใช้ได้ */
export default function AdminBuildingsPage() {
  redirect('/buildings');
}
