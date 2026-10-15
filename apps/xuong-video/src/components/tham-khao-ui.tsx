'use client';
// 📚 THAM KHẢO của shot (tham-khao.ts): từng câu chữ màn / lời → nguồn đã học (lời khách thật, QC đang thắng, thông tin trang bán) + kỹ thuật skill viet-qc-truc-dien.
// Phim QC: câu nào chưa có nguồn hiện đỏ (cổng chanThamKhao chặn sinh tới khi có). Anh 15/10/2026: "phần này luôn phải show ra ở đây".
import type { Canh } from '@/lib/xuong-video/kieu';
import { cauCuaShot, nguonCuaCau } from '@/lib/xuong-video/tham-khao';
import { timO } from '@/lib/xuong-video/template';

const mono = { fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--fg-3)' } as const;

export function ThamKhaoShot({ c, laQc }: { c: Pick<Canh, 'chu_man' | 'thoai' | 'tham_khao'>; laQc: boolean }) {
  const ds = cauCuaShot(c);
  if (!ds.length && !laQc) return null;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ ...mono, letterSpacing: 0.5, marginTop: 6 }}>THAM KHẢO CÂU CHỮ</div>
      {!ds.length && <div style={mono}>shot không có chữ / lời</div>}
      {ds.map((cau) => {
        const ng = nguonCuaCau(c.tham_khao, cau);
        const o = timO(cau).length > 0;
        return (
          <div key={cau} style={{ display: 'grid', gap: 3, fontSize: 11.5 }}>
            <div><b>“{cau}”</b></div>
            {!ng.length && <div style={{ ...mono, color: o ? undefined : laQc ? 'var(--red)' : undefined }}>{o ? 'nguồn lấy từ ô lúc điền template' : laQc ? '✗ chưa có nguồn — cấm dùng, cổng chặn sinh' : 'chưa có nguồn'}</div>}
            {ng.map((n, i) => (
              <div key={i} style={{ paddingLeft: 8, borderLeft: `2px solid ${n.loai === 'qc_thang' ? 'var(--accent, #60a5fa)' : n.loai === 'trang_ban' ? '#fbbf24' : '#4ade80'}`, display: 'grid', gap: 1 }}>
                <span style={mono}>{n.loai === 'qc_thang' ? '🏆 QC thắng' : n.loai === 'trang_ban' ? '🏷 trang bán' : '💬 lời khách'} · {n.nguon}{n.ghi ? ` · ${n.ghi}` : ''}{n.ky_thuat ? ` · ${n.ky_thuat}` : ''}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{n.link ? <a href={`https://href.li/?${n.link}`} target="_blank" rel="noreferrer" className="xv-lienket">“{n.trich}”</a> : `“${n.trich}”`}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
