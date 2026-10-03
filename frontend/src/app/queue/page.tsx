import { redirect } from 'next/navigation';

/** คิวงานซ่อมรวมเข้ากับบอร์ดงานซ่อมแล้ว — ลิงก์เก่า (/queue, /queue?tab=…) พาไปบอร์ดงานแทน */
export default function QueuePage(): never {
  redirect('/board');
}
