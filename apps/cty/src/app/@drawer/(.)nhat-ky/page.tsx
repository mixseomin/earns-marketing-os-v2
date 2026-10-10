import { RouteDrawer } from '@/components/drawer';
import NhatKy from '../../nhat-ky/page';

export default function DrawerNhatKy(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <RouteDrawer><NhatKy {...props} /></RouteDrawer>;
}
