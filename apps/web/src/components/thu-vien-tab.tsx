// Tab Thư viện (trang chủ ?tab=thuvien&tv=<nút>): cây bên trái + ô phải. Ô phải theo nút chọn:
//   Thiết kế / nhóm / loại → lưới mẫu (bảng thu_vien, lọc theo nhánh) · nút trang cũ → NHÚNG NGUYÊN trang Library cũ (một nguồn, không chép).
// Trang cũ vẫn mở được ở URL riêng (/library, /knowledge…) — cây chỉ là lối vào chung (anh 21/10/2026: "cho chung vào đây").
import { getCurrentUser } from '@/lib/auth';
import { docThuVien } from '@/lib/thu-vien-doc';
import { DANH_MUC, LA_THIET_KE, NHANH_CU, laDuoi } from '@/lib/thu-vien';
import { ThuVienKhung } from './thu-vien-khung';
import { ThuVienThietKe } from './thu-vien-thiet-ke';
import LibraryRoute from '@/app/library/page';
import KnowledgeRoute from '@/app/knowledge/page';
import CatalogRoute from '@/app/catalog/page';
import OffersRoute from '@/app/offers/page';
import PlatformsRoute from '@/app/platforms/page';
import TechnologiesRoute from '@/app/technologies/page';

export async function ThuVienTab({ tv }: { tv?: string }) {
  const [muc, me] = await Promise.all([docThuVien(), getCurrentUser()]);
  const admin = me?.role === 'admin';
  const chon = tv && (tv === 'thiet-ke' || laDuoi(tv).length || NHANH_CU.some((x) => x.key === tv)) ? tv : 'thiet-ke';
  let o: React.ReactNode;
  switch (chon) {
    case 'cong-cu': o = <LibraryRoute />; break;
    case 'kien-thuc': o = <KnowledgeRoute />; break;
    case 'catalog': o = <CatalogRoute />; break;
    case 'offers': o = <OffersRoute searchParams={Promise.resolve({})} />; break;
    case 'nen-tang': o = <PlatformsRoute />; break;
    case 'cong-nghe': o = <TechnologiesRoute />; break;
    default: {
      const la = chon === 'thiet-ke' ? null : laDuoi(chon);
      const nut = DANH_MUC.find((n) => n.key === chon) ?? LA_THIET_KE.find((l) => l.key === chon);
      o = <ThuVienThietKe muc={la ? muc.filter((m) => m.nhanh.some((n) => la.includes(n))) : muc}
        tieuDe={nut ? `${nut.icon} ${nut.ten}` : '🎨 Thiết kế'} />;
    }
  }
  return <ThuVienKhung muc={muc} chon={chon} admin={admin}>{o}</ThuVienKhung>;
}
