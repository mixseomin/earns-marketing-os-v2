'use client';
// Khung tab Thư viện: CÂY bên trái (Thiết kế → nhóm → loại, rồi các trang thư viện cũ) · nội dung nút đang chọn bên phải.
// Chọn nút = đổi ?tv= bằng điều hướng thật (ô phải là component máy chủ: trang cũ nhúng nguyên). Sổ cây: lib/thu-vien.ts.
import { useRouter } from 'next/navigation';
import { Cay, NutCay } from '@/components/ui';
import { DANH_MUC, NHANH_CU, laDuoi, type MucThuVien } from '@/lib/thu-vien';

const so = (n: number) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{n}</span>;

export function ThuVienKhung({ muc, chon, admin, children }: { muc: Pick<MucThuVien, 'nhanh'>[]; chon: string; admin: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const di = (key: string) => router.push(`/?tab=thuvien&tv=${key}`, { scroll: false });
  const dem = (key: string) => { const la = laDuoi(key); return muc.filter((m) => m.nhanh.some((n) => la.includes(n))).length; };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
      <nav aria-label="Cây thư viện" style={{ flex: '1 1 240px', maxWidth: 300, position: 'sticky', top: 8, maxHeight: '85vh', overflowY: 'auto' }}>
        <Cay label="Thư viện">
          <NutCay dau="🎨" ten={<b>Thiết kế</b>} phai={so(muc.length)} chon={chon === 'thiet-ke'} onChon={() => di('thiet-ke')}>
            {DANH_MUC.map((n) => (
              <NutCay key={n.key} dau={n.icon} ten={n.ten} phai={so(dem(n.key))} chon={chon === n.key} onChon={() => di(n.key)} mo_nhat={!dem(n.key)}>
                {n.con?.map((l) => <NutCay key={l.key} dau={l.icon} ten={l.ten} phai={so(dem(l.key))} chon={chon === l.key} onChon={() => di(l.key)} mo_nhat={!dem(l.key)} />)}
              </NutCay>
            ))}
          </NutCay>
          {NHANH_CU.filter((x) => admin || !x.admin).map((x) => (
            <NutCay key={x.key} dau={x.icon} ten={x.ten} phu={x.mo_ta} chon={chon === x.key} onChon={() => di(x.key)} />
          ))}
        </Cay>
      </nav>
      <section style={{ flex: '999 1 560px', minWidth: 0 }}>{children}</section>
    </div>
  );
}
