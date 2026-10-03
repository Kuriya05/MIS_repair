import { redirect } from 'next/navigation';

/** หน้าผู้ใช้และช่างถูกนำออกแล้ว — ลิงก์เก่าพากลับหน้าภาพรวม */
export default function UsersPage(): never {
  redirect('/');
}
