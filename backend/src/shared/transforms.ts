type TransformArgs = { value: unknown };

/** ตัดช่องว่างหัวท้ายก่อน validate */
export const trim = ({ value }: TransformArgs) => (typeof value === 'string' ? value.trim() : value);

/** ตัดช่องว่าง แล้วแปลงค่าว่างเป็น undefined (ช่องที่ไม่กรอกในฟอร์ม) */
export const trimToUndefined = ({ value }: TransformArgs) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/** multipart/form-data ส่งทุกอย่างเป็น string — แปลงตัวเลขเฉพาะที่เป็นรูปแบบจำนวนเต็ม */
export const toInt = ({ value }: TransformArgs) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return value === '' ? undefined : value;
  return /^-?\d+$/.test(value.trim()) ? Number(value.trim()) : value;
};

/** query string "true"/"false" → boolean */
export const toBoolean = ({ value }: TransformArgs) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};
