import { RouteDrawer } from '@/components/drawer';
import TrangPhong from '../../../phong/[id]/page';

export default function DrawerPhong(props: { params: Promise<{ id: string }> }) {
  return <RouteDrawer><TrangPhong {...props} /></RouteDrawer>;
}
