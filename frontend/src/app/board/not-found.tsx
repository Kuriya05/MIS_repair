import { RouteNotFound } from '@/components/shared/RouteStates';

export default function NotFound() {
  return <RouteNotFound backHref="/board" backLabel="กลับไปที่บอร์ดงาน" />;
}
