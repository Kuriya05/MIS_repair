import { RouteNotFound } from '@/components/shared/RouteStates';

export default function NotFound() {
  return <RouteNotFound backHref="/buildings" backLabel="กลับไปที่รายการอาคาร" />;
}
