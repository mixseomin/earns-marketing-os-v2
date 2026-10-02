// /shop — backend vận hành cửa hàng (anh chốt 01/10/2026: mellowstep cần quản lý đơn / cửa hàng / sản phẩm↔NCC / luồng NCC /
// vận đơn ở MOS2). Mặt tiền: WooCommerce (nen_tang woo) hoặc apps/store (nen_tang mos); mọi thứ sau khi khách trả tiền ở đây.
// Trong AppShell (như /products) để có khung + lề chung của `.main` và lối vào ở thanh trái (Operate › Shop).
// Dữ liệu: lib/shop/doc.ts (sổ shop_*), máy chạy: lib/shop/dong-bo.ts (webhook Woo + /api/cron/shop mỗi 10 phút).
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ShopView } from '@/components/shop-view';
import { getCurrentUser } from '@/lib/auth';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { getLastProject } from '@/lib/last-project';
import { docShop } from '@/lib/shop/doc';
import { docBienDongNcc, docHoSo, docNcc } from '@/lib/shop/ho-so-doc';
import { docDoiThu } from '@/lib/shop/doi-thu-doc';
import { docDsCong, docDsPhapNhan } from '@/lib/shop/cong';
import { cheDoCua, locCheDo } from '@/lib/shop/che-do';

export const dynamic = 'force-dynamic';

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/shop');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const [projects, lastProject, fallbackMode, shop, hoSoAll, nccAll, bienDongAll, doiThu, congAll, phapNhanAll] = await Promise.all([
    listProjects(), getLastProject(), getMode('affiliate'), docShop(), docHoSo(), docNcc(), docBienDongNcc(), docDoiThu(), docDsCong(), docDsPhapNhan(),
  ]);
  // ?du_lieu=demo → chỉ cửa hàng / NCC demo; mặc định chỉ dữ liệu thật. Lọc một lần ở đây (lib/shop/che-do.ts), màn không tự lọc lại.
  const cheDo = cheDoCua((await searchParams).du_lieu);
  const { don, bienThe, cuaHang, sanPham, danhGia, danhMuc, hoSo, ncc, bienDong, cong, phapNhan, dsCh } =
    locCheDo({ ...shop, hoSo: hoSoAll, ncc: nccAll, bienDong: bienDongAll, cong: congAll, phapNhan: phapNhanAll }, cheDo);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;
  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <ShopView don={don} bienThe={bienThe} cuaHang={cuaHang} sanPham={sanPham} danhGia={danhGia} hoSo={hoSo} ncc={ncc} danhMuc={danhMuc} bienDong={bienDong} doiThu={doiThu} cong={cong} phapNhan={phapNhan} cheDo={cheDo} dsCh={dsCh} />
    </AppShell>
  );
}
