// Ý TƯỞNG KÊNH — mọi dạng video / ý tưởng kênh đã đề xuất, xếp theo NƠI ĐẶT (anh 27/11/2026: "bố cục lại để nhìn rõ mọi ideas").
// Khuôn: BẢNG CỘT THEO TRẠNG THÁI (board) — cột = trạng thái đặt, đếm từng cột, màu theo trạng thái; trong cột gom theo kênh.
// Mẫu: https://ui.shadcn.com/examples/tasks (lọc theo trạng thái kèm số) — board là cách xem cột của cùng bộ dữ liệu.
// Nguồn MỘT: apps/xuong-video/scripts/du-lieu/thu-vien/dang-kenh.json › co_hoi[].dat (thư viện studio đọc cùng tệp) qua docYTuongKenh().
import { SiteFavicon } from '@/components/ui';
import { docYTuongKenh } from '@/lib/tai-san/kenh-sp';

type Kieu = 'kenh_co' | 'kenh_moi' | 'khong_dang' | 'gac';
const COT: { kieu: Kieu; ten: string; mau: string; ghi?: string }[] = [
  { kieu: 'kenh_co', ten: 'Thêm vào kênh đang có', mau: 'var(--ok)' },
  { kieu: 'kenh_moi', ten: 'Kênh mới dự kiến', mau: 'var(--accent)', ghi: 'mở tài khoản kênh mới phải hỏi anh' },
  { kieu: 'khong_dang', ten: 'Không đăng kênh', mau: 'var(--warn)', ghi: 'dùng cho quảng cáo / sản phẩm bán' },
  { kieu: 'gac', ten: 'Gác / bỏ', mau: 'var(--fg-4)' },
];

const xem = (n: number | null) => (n == null ? null : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.0', '')} tr` : `${Math.round(n / 1e3)} N`);

export function KenhYTuong() {
  const d = docYTuongKenh();
  if (!d) {
    return (
      <div style={{ border: '1px solid var(--bad)', background: 'color-mix(in srgb, var(--bad) 10%, transparent)', color: 'var(--bad)', padding: 12, borderRadius: 8, fontSize: 13 }}>
        Không đọc được danh sách ý tưởng (apps/xuong-video/scripts/du-lieu/thu-vien/dang-kenh.json) — máy chủ thiếu tệp hoặc tệp hỏng.
      </div>
    );
  }
  const thieu = d.ds.filter((c) => !c.dat);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
        {d.ds.length} ý tưởng{d.luc ? ` · chốt ${d.luc.slice(8, 10)}/${d.luc.slice(5, 7)}` : ''} · 👁 = trung vị lượt xem YouTube của dạng đó
        {thieu.length > 0 && <span style={{ color: 'var(--bad)', marginLeft: 8 }}>⚠ {thieu.length} ý tưởng chưa có nơi đặt: {thieu.map((c) => c.ten).join(', ')}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10, flex: 1, minHeight: 0, overflow: 'auto' }}>
        {COT.map((cot) => {
          const ds = d.ds.filter((c) => c.dat?.kieu === cot.kieu);
          const nhom = new Map<string, typeof ds>();
          for (const c of ds) { const k = c.dat?.kenh ?? ''; nhom.set(k, [...(nhom.get(k) ?? []), c]); }
          return (
            <section key={cot.kieu} style={{ borderTop: `3px solid ${cot.mau}`, background: 'var(--bg-2)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
              <header style={{ position: 'sticky', top: 0, background: 'var(--bg-2)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <b style={{ fontSize: 13 }}>{cot.ten}</b>
                <span style={{ fontSize: 12, color: cot.mau, fontWeight: 600 }}>{ds.length}</span>
                {cot.ghi && <span style={{ fontSize: 11, color: 'var(--fg-4)', marginLeft: 'auto' }}>{cot.ghi}</span>}
              </header>
              {ds.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>chưa có</div>}
              {[...nhom.entries()].map(([kenh, cs]) => {
                const ten = kenh ? d.tenKenh[kenh] ?? kenh : '';
                return (
                  <div key={kenh || '-'} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {ten && (
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 4 }} title={kenh}>
                        {d.tenKenh[kenh] ? <SiteFavicon platformKey="youtube" size={12} /> : <span>＋</span>}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ten}</span>
                        <span style={{ color: 'var(--fg-4)' }}>· {cs.length}</span>
                      </div>
                    )}
                    {cs.map((c) => (
                      <div key={c.hang} style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}
                        title={[c.bang_chung_tien, c.dung_code].filter(Boolean).join('\n')}>
                        <b style={{ fontWeight: 600 }}>{c.ten}</b>
                        {c.dat?.playlist && <span style={{ color: 'var(--fg-3)' }}>▸ {c.dat.playlist}</span>}
                        <span style={{ color: 'var(--fg-4)', fontSize: 11 }}>
                          {[xem(c.trungVi) && `👁 ${xem(c.trungVi)}`, c.kiem_tien && `💰 ${c.kiem_tien}`].filter(Boolean).join(' · ')}
                        </span>
                        {(c.trang_thai || c.dat?.ghi) && (
                          <span style={{ fontSize: 11, color: c.trang_thai ? 'var(--ok)' : 'var(--fg-3)' }}>{c.trang_thai ?? c.dat?.ghi}</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
