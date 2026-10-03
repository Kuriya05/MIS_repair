import { CollectionResult } from '../common/api-response';
import { buildPaginationMeta } from '../common/dto/pagination.dto';

/** รายการแบบแบ่งหน้า → CollectionResult ของชั้นกลาง (ResponseInterceptor แปลงเป็น { data, meta }) */
export const Paginated = {
  of<T>(items: T[], total: number, page: number, limit: number) {
    return new CollectionResult(items, buildPaginationMeta(total, page, limit));
  },
};
