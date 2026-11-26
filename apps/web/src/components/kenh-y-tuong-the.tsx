'use client';
// Thẻ ý tưởng kênh + NGĂN CHI TIẾT (anh 27/11/2026: "ko xem đc chi tiết idea trên đó à?").
// ngan-moi-ok: ý tưởng kênh (dang-kenh.json › co_hoi) — đã tra apps/web (grep co_hoi / kiem_tien), chưa có ngăn.
// Khuôn: board → bấm thẻ mở ngăn kéo phải (Drawer nhà, xếp chồng tự động) — cùng khuôn card-modal của board.
// Ngăn hiện MỌI trường của co_hoi: nơi đặt, kiếm tiền, bằng chứng, dựng bằng code, trạng thái,
// khuôn kịch bản (nếu đã mổ), và số đo nhu cầu của dạng (cụm tìm YouTube + 5 video top, link thật).
import { useState, type ReactNode } from 'react';
import { Drawer } from '@/components/ui';
import { wrapExternalUrl } from '@/lib/external-url';
import type { CoHoi } from '../../../xuong-video/src/lib/xuong-video/prompt-opus';
import type { DangDo } from '@/lib/tai-san/kenh-sp';

export type YTuong = CoHoi & { trungVi: number | null; dangDo: DangDo | null };

const KIEU: Record<string, { ten: string; mau: string }> = {
  kenh_co: { ten: 'Thêm vào kênh đang có', mau: 'var(--ok)' },
  kenh_moi: { ten: 'Kênh mới dự kiến', mau: 'var(--accent)' },
  khong_dang: { ten: 'Không đăng kênh', mau: 'var(--warn)' },
  gac: { ten: 'Gác / bỏ', mau: 'var(--fg-4)' },
};
const xem = (n: number | null | undefined) => (n == null ? null : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.0', '')} tr` : `${Math.round(n / 1e3)} N`);
const phut = (g: number | null) => (g == null ? '' : `${Math.floor(g / 60)}:${String(g % 60).padStart(2, '0')}`);

function Muc({ ten, children }: { ten: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{ten}</div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{children}</div>
    </section>
  );
}
const Ds = ({ ds }: { ds: string[] }) => <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>{ds.map((x, i) => <li key={i}>{x}</li>)}</ul>;

export function TheYTuong({ c, tenKenh }: { c: YTuong; tenKenh: string | null }) {
  const [mo, setMo] = useState(false);
  const k = c.dat ? KIEU[c.dat.kieu] : null;
  return (
    <>
      <button type="button" onClick={() => setMo(true)}
        style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 8px', fontSize: 12, lineHeight: 1.35, minWidth: 0 }}
        title="Bấm để xem chi tiết">
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ten}</div>
        <div style={{ fontSize: 11, color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {xem(c.trungVi) && <span style={{ color: 'var(--fg-3)' }}>👁 {xem(c.trungVi)} </span>}
          {c.dat?.playlist && <span style={{ color: 'var(--fg-3)' }}>▸ {c.dat.playlist} </span>}
          {c.trang_thai ? <span style={{ color: 'var(--ok)' }}>· {c.trang_thai}</span> : c.dat?.ghi && <span>· {c.dat.ghi}</span>}
        </div>
      </button>
      {mo && (
        <Drawer onClose={() => setMo(false)} width={640}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {k && <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: k.mau, border: `1px solid ${k.mau}`, borderRadius: 999, padding: '1px 8px' }}>{k.ten}</span>}
              <h2 style={{ margin: 0, fontSize: 18 }}>#{c.hang} · {c.ten}</h2>
              {c.trang_thai && <div style={{ fontSize: 13, color: 'var(--ok)' }}>Trạng thái: {c.trang_thai}</div>}
            </header>

            <Muc ten="Đặt ở đâu">
              {c.dat ? (
                <div>
                  {tenKenh ?? c.dat.kenh ?? 'chưa chọn kênh'}
                  {c.dat.playlist && <> · playlist <b>{c.dat.playlist}</b></>}
                  {c.dat.ghi && <div style={{ color: 'var(--fg-3)' }}>{c.dat.ghi}</div>}
                  {c.dat.kieu === 'kenh_moi' && <div style={{ color: 'var(--fg-4)', fontSize: 12 }}>Mở tài khoản kênh mới phải hỏi anh.</div>}
                </div>
              ) : <span style={{ color: 'var(--bad)' }}>⚠ Chưa có nơi đặt (dat) trong dang-kenh.json</span>}
            </Muc>
            <Muc ten="Kiếm tiền">{c.kiem_tien}</Muc>
            <Muc ten="Bằng chứng có tiền">{c.bang_chung_tien}</Muc>
            <Muc ten="Dựng bằng code">{c.dung_code}</Muc>

            {c.khuon ? (
              <>
                <Muc ten="Khuôn kịch bản — nguồn mổ"><span style={{ color: 'var(--fg-3)' }}>{c.khuon.nguon}</span></Muc>
                <Muc ten="Kênh mẫu"><Ds ds={c.khuon.kenh_mau} /></Muc>
                {c.khuon.dang.map((d) => <Muc key={d.ten} ten={d.ten}><Ds ds={d.nhip} /></Muc>)}
                <Muc ten="Công thức tiêu đề"><Ds ds={c.khuon.cong_thuc_tieu_de} /></Muc>
                <Muc ten="Luật"><Ds ds={c.khuon.luat} /></Muc>
              </>
            ) : <Muc ten="Khuôn kịch bản"><span style={{ color: 'var(--fg-4)' }}>Chưa mổ đối thủ cho ý tưởng này (bước B1).</span></Muc>}

            {c.dangDo ? (
              <Muc ten={`Nhu cầu đo trên YouTube — ${c.dangDo.ten}`}>
                <div style={{ color: 'var(--fg-3)', marginBottom: 6 }}>{c.dangDo.moTa}</div>
                {c.dangDo.cum.map((cum) => (
                  <div key={cum.q} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12 }}>Tìm “{cum.q}” · trung vị <b>{xem(cum.trungVi) ?? '—'}</b> lượt xem</div>
                    <ul style={{ margin: '2px 0 0', paddingLeft: 18, fontSize: 12 }}>
                      {cum.top.map((v) => (
                        <li key={v.url}>
                          <a href={wrapExternalUrl(v.url)} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{v.ten}</a>
                          <span style={{ color: 'var(--fg-4)' }}> · {v.kenh} · {xem(v.xem)} · {phut(v.giay)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Muc>
            ) : <Muc ten="Nhu cầu đo trên YouTube"><span style={{ color: 'var(--fg-4)' }}>Chưa đo dạng này.</span></Muc>}
          </div>
        </Drawer>
      )}
    </>
  );
}
