import { redirect } from 'next/navigation';

/** ไม่มีหน้ารวม — เลือกห้อง/เครื่องจากหน้าอาคาร */
export default function Page() {
  redirect('/buildings');
}
