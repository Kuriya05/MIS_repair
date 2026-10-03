import { IsString, Length } from 'class-validator';
import { createValidationPipe } from './validation';

class SampleDto {
  @IsString()
  name: string;

  @Length(2, 10, { message: 'รหัสต้องยาว 2–10 ตัวอักษร' })
  code: string;
}

describe('validation pipe — VALIDATION_ERROR ภาษาไทยเสมอ', () => {
  const pipe = createValidationPipe();

  it('keeps Thai messages and translates class-validator defaults', async () => {
    await expect(
      pipe.transform({ name: 5, code: 'x', isAdmin: true }, { type: 'body', metatype: SampleDto }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: expect.arrayContaining([
        'name: ต้องเป็นข้อความ',
        'code: รหัสต้องยาว 2–10 ตัวอักษร',
        'isAdmin: ไม่มีช่องนี้ในแบบฟอร์ม',
      ]),
    });
  });
});
