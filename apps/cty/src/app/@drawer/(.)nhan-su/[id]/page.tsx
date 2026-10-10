import { RouteDrawer } from '@/components/drawer';
import TrangNhanSu from '../../../nhan-su/[id]/page';

export default function DrawerNhanSu(props: { params: Promise<{ id: string }> }) {
  return <RouteDrawer><TrangNhanSu {...props} /></RouteDrawer>;
}
