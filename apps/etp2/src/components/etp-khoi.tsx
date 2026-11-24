'use client';
// KHỐI CAMP — đầu nhóm + ngăn kéo sửa (anh 25/11/2026: "Tao duyệt khối kiểu gì? Nếu không duyệt thì sao? Muốn điều chỉnh gì thì làm thế nào?")
//   Đầu nhóm nói THẬT trạng thái: chưa bắt đầu (không tốn tiền) · đã duyệt bởi ai lúc nào · nút ▶ Bắt đầu sản xuất / Huỷ khối / ✎ Sửa.
//   Ngăn kéo: tham số chung + danh sách phim (tiếng · khuôn · số camp · bỏ) + thêm phim theo content_id. Mọi nút chỉ ghi sổ etp.khoi / dong_phim, không gọi AI, không chạm Ethopex.
// tra-repo-ok: giao diện dán keo nội bộ — dùng Drawer / GuardedButton / TextField nhà
// ngan-moi-ok: khối camp (etp.khoi, 0470) — đã tra etp-*-drawer.tsx, chưa có ngăn nào cho khối
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, GuardedButton, TextField } from '@/components/ui';
import type { KhoiEtp } from '@/lib/etp-doc';
import { boPhimKhoi, docKhoiSua, duyetKhoi, huyKhoi, soCampPhimKhoi, suaKhoi, themPhimKhoi, thoiDuyetKhoi, type KhoiSua } from '@/lib/actions/etp-khoi';

const gioVn = (s: string | null) => { if (!s) return ''; const d = new Date(new Date(s).getTime() + 7 * 3600_000), p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`; };
const TIENG: Record<string, string> = { en: 'EN', es: 'ES' };
const nut: React.CSSProperties = { fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid var(--line-2)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' };
type TT = Pick<KhoiEtp, 'trang_thai' | 'duyet_ai' | 'duyet_luc'>;

/** Trạng thái THẬT của khối — nhãn ngắn trên mặt; một nguồn cho đầu nhóm + ngăn kéo */
export const chuTrangThaiKhoi = (k: TT) =>
  k.trang_thai === 'cho' ? 'chưa bắt đầu · không tốn tiền'
    : k.trang_thai === 'duyet' ? `đã duyệt${k.duyet_ai ? ` · ${k.duyet_ai}` : ''}${k.duyet_luc ? ` · ${gioVn(k.duyet_luc)}` : ''}`
      : k.trang_thai === 'chay' ? 'đang sản xuất' : k.trang_thai === 'huy' ? 'đã huỷ' : k.trang_thai;
/** Giải thích dài — vào chữ rê */
export const giaiThichKhoi = (k: TT) =>
  k.trang_thai === 'cho' ? 'Chưa bắt đầu: máy chưa làm gì, chưa tốn đồng nào. Không bấm thì khối nằm yên mãi.\nBấm ▶ Bắt đầu sản xuất → khối thành "đã duyệt", Claude sinh creative AD (~6.400₫ cho 8 phim, báo lại).'
    : k.trang_thai === 'duyet' ? `Đã duyệt${k.duyet_ai ? ` bởi ${k.duyet_ai}` : ''}${k.duyet_luc ? ` lúc ${gioVn(k.duyet_luc)} giờ VN` : ''}.\nĐang chờ sinh creative AD. Camp chỉ lên theo lệnh anh + nhiệm vụ hôm nay.`
      : chuTrangThaiKhoi(k);

export function DauKhoi({ kh, phims, chu }: { kh: KhoiEtp; phims: string[]; chu: string[] }) {
  const r = useRouter(), [dang, chay] = useTransition(), [loi, datLoi] = useState(''), [mo, datMo] = useState(false), [hoiHuy, datHoiHuy] = useState(false);
  const lam = (f: () => Promise<{ ok: true } | { loi: string }>) => chay(async () => { datLoi(''); const k = await f(); if ('loi' in k) datLoi(k.loi); else { datHoiHuy(false); r.refresh(); } });
  const chan = (e: React.SyntheticEvent) => e.stopPropagation();   // bấm nút không gập / mở nhóm
  const mau = kh.trang_thai === 'cho' ? 'var(--warn, #f5a524)' : kh.trang_thai === 'duyet' ? '#34d399' : '#a78bfa';
  return <span data-o="nhom-khoi" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
    <b title={[...chu, '', 'Phim:', ...phims.map((t) => `   – ${t}`)].join('\n')} style={{ cursor: 'help' }}>🧱 Khối #{kh.id} · {kh.ten}</b>
    <span data-o="khoi-trang-thai" title={giaiThichKhoi(kh)} style={{ color: mau, fontWeight: 600, cursor: 'help' }}>{chuTrangThaiKhoi(kh)}</span>
    <span style={{ fontWeight: 400 }}>{kh.so_phim} phim · {kh.so_camp} camp · ★{kh.roas} · ${kh.ns} · {kh.gio} VN · {kh.nuoc ?? '?'} nước</span>
    <span onClick={chan} onMouseDown={chan} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {kh.trang_thai === 'cho' ? <GuardedButton data-o="nut-khoi-bat-dau" reason={dang ? 'đang ghi…' : null} onClick={() => lam(() => duyetKhoi(kh.id))} title={giaiThichKhoi(kh)}
        style={{ ...nut, background: '#16a34a', borderColor: '#16a34a', color: '#fff', fontWeight: 600 }}>▶ Bắt đầu sản xuất</GuardedButton> : null}
      {kh.trang_thai === 'duyet' ? <GuardedButton data-o="nut-khoi-thoi-duyet" reason={dang ? 'đang ghi…' : null} onClick={() => lam(() => thoiDuyetKhoi(kh.id))} title="Trả khối về 'chưa bắt đầu' (chỉ khi chưa phim nào vào máy)" style={nut}>↺ Thôi duyệt</GuardedButton> : null}
      {kh.trang_thai === 'cho' || kh.trang_thai === 'duyet' ? <>
        <GuardedButton data-o="nut-khoi-sua" onClick={() => datMo(true)} title="Sửa tham số chung, thêm / bỏ phim, đổi số camp mỗi phim" style={nut}>✎ Sửa</GuardedButton>
        {hoiHuy ? <>
          <GuardedButton data-o="nut-khoi-huy-chac" reason={dang ? 'đang ghi…' : null} onClick={() => lam(() => huyKhoi(kh.id))} style={{ ...nut, background: 'var(--bad, #ef4444)', borderColor: 'var(--bad, #ef4444)', color: '#fff' }}>Chắc chắn huỷ</GuardedButton>
          <GuardedButton onClick={() => datHoiHuy(false)} style={nut}>Không</GuardedButton></>
          : <GuardedButton data-o="nut-khoi-huy" onClick={() => datHoiHuy(true)} title="Huỷ cả khối: các dòng phim thành 'huỷ' (không xoá, còn trong sổ)" style={{ ...nut, color: 'var(--bad, #ef4444)' }}>Huỷ khối</GuardedButton>}
      </> : null}
    </span>
    {loi ? <span data-o="khoi-loi" style={{ color: 'var(--bad, #ef4444)', fontWeight: 600, fontSize: 11.5, padding: '2px 6px', border: '1px solid var(--bad, #ef4444)', borderRadius: 5 }}>⚠ {loi}</span> : null}
    {mo ? <span onClick={chan} onMouseDown={chan}><SuaKhoi id={kh.id} dong={() => datMo(false)} /></span> : null}
  </span>;
}

function SuaKhoi({ id, dong }: { id: number; dong: () => void }) {
  const r = useRouter(), [k, datK] = useState<KhoiSua | null>(null), [loi, datLoi] = useState(''), [dang, chay] = useTransition();
  const [t, datT] = useState({ roas: '', ns: '', gio: '', mien: '', nuoc: '', cr_camp: '', tran_ngay: '' }), [them, datThem] = useState(''), [soMoi, datSoMoi] = useState<Record<number, string>>({});
  const tai = () => docKhoiSua(id).then((x) => { if ('loi' in x) { datLoi(x.loi); return; } datK(x);
    datT({ roas: String(x.roas), ns: String(x.ns), gio: x.gio, mien: x.mien ?? '', nuoc: x.nuoc == null ? '' : String(x.nuoc), cr_camp: String(x.cr_camp), tran_ngay: x.tran_ngay == null ? '' : String(x.tran_ngay) }); datSoMoi({}); });
  useEffect(() => { void tai(); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const lam = (f: () => Promise<{ ok: true } | { loi: string }>) => chay(async () => { datLoi(''); const x = await f(); if ('loi' in x) datLoi(x.loi); else { await tai(); r.refresh(); } });
  const doi = k ? (['roas', 'ns', 'gio', 'mien', 'nuoc', 'cr_camp', 'tran_ngay'] as const).some((f) => t[f] !== (f === 'mien' ? k.mien ?? '' : f === 'nuoc' || f === 'tran_ngay' ? (k[f] == null ? '' : String(k[f])) : String(k[f]))) : false;
  const luu = () => lam(() => suaKhoi(id, { roas: Number(t.roas), ns: Number(t.ns), gio: t.gio.trim(), mien: t.mien.trim(), nuoc: t.nuoc === '' ? null : Number(t.nuoc), cr_camp: Number(t.cr_camp), tran_ngay: t.tran_ngay === '' ? null : Number(t.tran_ngay) }));
  const o = (f: keyof typeof t, nhan: string, goi?: string) => <TextField label={nhan} hint={goi} value={t[f]} onChange={(e) => datT({ ...t, [f]: e.target.value })} size="sm" />;
  return <Drawer onClose={dong} width={620} dirty={doi} padding={0}>
    <div className="modal-head"><div><div className="id-line">khối #{id}</div><h2 style={{ margin: 0 }}>{k ? k.ten : 'Khối camp'}</h2></div>
      <button className="modal-close" onClick={dong} style={{ marginLeft: 'auto' }}>✕</button></div>
    <div data-o="drawer-khoi" style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 12.5, padding: 16 }}>
      {k ? <div title={giaiThichKhoi(k)} style={{ color: 'var(--muted)', cursor: 'help' }}>{chuTrangThaiKhoi(k)}</div> : null}
      {loi ? <div data-o="khoi-loi" style={{ color: 'var(--bad, #ef4444)', fontWeight: 600, padding: '6px 8px', border: '1px solid var(--bad, #ef4444)', borderRadius: 6 }}>⚠ {loi}</div> : null}
      {!k ? <div>đang đọc…</div> : <>
        <section>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Tham số chung</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {o('roas', '★ ROAS', 'mục tiêu ROAS của camp')}{o('ns', '$/camp/ngày')}{o('gio', 'Giờ lên (VN)', 'HH:MM')}{o('cr_camp', 'Camp mỗi phim', 'số camp mặc định mỗi phim; phim đang theo mặc định sẽ đổi theo')}
            {o('mien', 'Miền')}{o('nuoc', 'Số nước')}{o('tran_ngay', 'Trần $/ngày', 'cả khối; để trống = không trần')}
          </div>
          <div style={{ marginTop: 8 }}>
            <GuardedButton data-o="nut-khoi-luu" reason={dang ? 'đang ghi…' : !doi ? 'chưa đổi gì' : null} onClick={luu} style={{ ...nut, background: '#2563eb', borderColor: '#2563eb', color: '#fff', fontWeight: 600 }}>Lưu tham số</GuardedButton>
          </div>
        </section>
        <section>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Phim ({k.phims.length} phim · {k.phims.reduce((s, p) => s + p.so_camp, 0)} camp)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11 }}>
            <th style={{ padding: 4 }}>Phim</th><th>Tiếng</th><th>Camp khuôn</th><th>Số camp</th><th /></tr></thead>
            <tbody>{k.phims.map((p) => { const so = soMoi[p.dong] ?? String(p.so_camp);
              return <tr key={p.dong} data-o="khoi-phim" style={{ borderTop: '1px solid var(--line-1)' }}>
                <td style={{ padding: 4 }}><b>{p.ten ?? `#${p.content_id}`}</b> <span style={{ color: 'var(--muted)' }}>#{p.content_id}</span></td>
                <td>{TIENG[p.locale ?? ''] ?? p.locale ?? '?'}</td>
                <td>{k.khuon?.[p.locale ?? ''] ? `#${k.khuon[p.locale ?? '']}` : <span style={{ color: 'var(--warn, #f5a524)' }}>chưa có khuôn</span>}</td>
                <td><span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <input value={so} onChange={(e) => datSoMoi({ ...soMoi, [p.dong]: e.target.value })} style={{ width: 44, fontSize: 12, padding: '2px 4px', background: 'var(--bg-2)', color: 'var(--fg-1)', border: '1px solid var(--line-2)', borderRadius: 4 }} />
                  {so !== String(p.so_camp) ? <GuardedButton reason={dang ? 'đang ghi…' : null} onClick={() => lam(() => soCampPhimKhoi(p.dong, Number(so)))} style={nut}>Lưu</GuardedButton> : null}</span></td>
                <td><GuardedButton data-o="nut-khoi-bo-phim" reason={dang ? 'đang ghi…' : p.trang_thai !== 'cho' ? 'phim đã vào máy, không bỏ được' : null} onClick={() => lam(() => boPhimKhoi(p.dong))} title="Bỏ phim khỏi khối (dòng thành 'huỷ', không xoá)" style={{ ...nut, color: 'var(--bad, #ef4444)' }}>Bỏ</GuardedButton></td>
              </tr>; })}</tbody></table>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
            <TextField label="Thêm phim (content_id)" value={them} onChange={(e) => datThem(e.target.value.replace(/\D/g, ''))} size="sm" style={{ width: 140 }} />
            <GuardedButton data-o="nut-khoi-them-phim" reason={dang ? 'đang ghi…' : !them ? 'gõ content_id của phim' : null} onClick={() => lam(async () => { const x = await themPhimKhoi(id, Number(them)); if (!('loi' in x)) datThem(''); return x; })} style={nut}>+ Thêm phim</GuardedButton>
          </div>
        </section>
        <div title="Các nút trong ngăn này chỉ ghi sổ khối: không sinh AI, không tạo / bật camp" style={{ color: 'var(--muted)', fontSize: 11, cursor: 'help' }}>Chỉ ghi sổ · 0₫</div>
      </>}
    </div>
  </Drawer>;
}
