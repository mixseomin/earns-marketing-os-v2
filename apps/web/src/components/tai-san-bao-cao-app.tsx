'use client';
// Khối "Báo cáo App Store" trong drawer sản phẩm (tab Tài sản) — từng lượt tải (nước · nguồn · máy · bản) + gộp theo nước/nguồn.
// Anh cần biết lượt tải là người thật hay chính máy nhà (12/10/2026): app nhắm toàn cầu, máy nhà ở VN → dòng VN gắn nhãn, tổng có
// "ngoài VN". Số: scripts/app-store-so.mjs (box3, mỗi ngày) → product_stats → lib/tai-san/bao-cao-app.ts.
import { useEffect, useState } from 'react';
import { docBaoCaoApp } from '@/lib/actions/bao-cao-app';
import type { BaoCaoApp, DongGop, LuotTai } from '@/lib/tai-san/bao-cao-app';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const nhan: React.CSSProperties = { fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 6px' };
const o: React.CSSProperties = { padding: '5px 10px 5px 0', borderTop: '1px solid var(--line)', whiteSpace: 'nowrap' };
const so: React.CSSProperties = { ...o, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

const NGUON: Record<string, string> = { 'App Store search': 'Tìm trên App Store', 'App Store browse': 'Duyệt App Store', 'Web referrer': 'Từ trang web',
  'App referrer': 'Từ app khác', 'Institutional purchase': 'Mua tổ chức', Unavailable: 'Không rõ', '?': 'Không rõ' };
const LOAI: Record<LuotTai['loai'], string> = { moi: 'Tải lần đầu', lai: 'Tải lại', capNhat: 'Cập nhật' };
let tenNuoc: Intl.DisplayNames | null = null;
const nuoc = (c: string | null) => {
  if (!c || c === '?') return 'Không rõ';
  try { tenNuoc ??= new Intl.DisplayNames(['vi'], { type: 'region' }); return `${tenNuoc.of(c) ?? c} (${c})`; } catch { return c; }
};
const ngay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function BaoCaoAppStore({ idSo }: { idSo: string }) {
  const [bc, datBc] = useState<BaoCaoApp | { loi: string } | null>(null);
  useEffect(() => { let song = true; docBaoCaoApp(idSo).then((r) => song && datBc(r)).catch((e: Error) => song && datBc({ loi: e.message })); return () => { song = false; }; }, [idSo]);
  if (!bc) return <div style={{ fontSize: 12.5, ...phu }}>Đang tải báo cáo App Store…</div>;
  if ('loi' in bc) return <div style={{ fontSize: 12.5, color: 'var(--warn)' }}>Báo cáo App Store: {bc.loi}</div>;
  if (!bc.tu) return <div style={{ fontSize: 12.5, ...phu }}>Apple chưa có báo cáo cho app này (app chưa lên store, hoặc Apple đang dựng báo cáo lần đầu, 1–2 ngày).</div>;
  const t = bc.tong;
  return (
    <div style={{ display: 'grid', gap: 14, fontSize: 12.5 }}>
      <div>
        <div style={nhan}>Báo cáo App Store · {ngay(bc.tu)} → {ngay(bc.den!)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
          {([['Hiển thị', t.hienThi], ['Xem trang', t.xemTrang], ['Tải lần đầu', t.taiMoi], ['Tải lại', t.taiLai], ['Cập nhật', t.capNhat]] as const).map(([k, v]) =>
            <div key={k} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px' }}>
              <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</div><div style={phu}>{k}</div></div>)}
        </div>
        <div style={{ marginTop: 6 }}>Tải lần đầu từ ngoài Việt Nam: <b style={{ color: bc.taiMoiNgoaiVN ? 'var(--ok)' : 'var(--fg-2)' }}>{bc.taiMoiNgoaiVN}</b>
          <span style={phu}> · lượt từ VN thường là máy nhà mình (app nhắm thị trường toàn cầu)</span></div>
        {bc.ngayThieuChiTiet > 0 && <div style={{ ...phu, marginTop: 4 }}>{bc.ngayThieuChiTiet} ngày chỉ có tổng, chưa có chi tiết theo nước/nguồn.</div>}
      </div>

      <div>
        <div style={nhan}>Từng lượt tải ({bc.tai.length})</div>
        {bc.tai.length ? <table style={{ borderCollapse: 'collapse', width: '100%' }}><thead><tr style={phu}>
          <th style={{ ...o, textAlign: 'left', fontWeight: 500 }}>Ngày</th><th style={{ ...o, textAlign: 'left', fontWeight: 500 }}>Loại</th>
          <th style={{ ...o, textAlign: 'left', fontWeight: 500 }}>Nước</th><th style={{ ...o, textAlign: 'left', fontWeight: 500 }}>Nguồn</th>
          <th style={{ ...o, textAlign: 'left', fontWeight: 500 }}>Máy</th><th style={{ ...o, textAlign: 'left', fontWeight: 500 }}>Bản</th><th style={{ ...so, fontWeight: 500 }}>Số</th></tr></thead>
          <tbody>{bc.tai.map((x, i) => <tr key={i} style={{ opacity: x.nuoc === 'VN' ? 0.7 : 1 }}>
            <td style={o}>{ngay(x.ngay)}</td><td style={o}>{LOAI[x.loai]}</td>
            <td style={o}>{nuoc(x.nuoc)}{x.nuoc === 'VN' && <span style={{ ...phu, marginLeft: 6 }}>· có thể là máy nhà</span>}</td>
            <td style={o}>{NGUON[x.nguon ?? '?'] ?? x.nguon}</td><td style={o}>{[x.may, x.os].filter(Boolean).join(' · ') || '—'}</td>
            <td style={o}>{x.ban ?? '—'}</td><td style={so}>{x.n}</td></tr>)}</tbody></table>
          : <div style={phu}>Chưa có lượt tải nào.</div>}
      </div>

      <BangGop tieuDe="Theo nước" ds={bc.theoNuoc} ten={nuoc} />
      <BangGop tieuDe="Theo nguồn" ds={bc.theoNguon} ten={(k) => NGUON[k] ?? k} />
    </div>
  );
}

function BangGop({ tieuDe, ds, ten }: { tieuDe: string; ds: DongGop[]; ten: (k: string) => string }) {
  if (!ds.length) return null;
  return (
    <div>
      <div style={nhan}>{tieuDe}</div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}><thead><tr style={phu}>
        <th style={{ ...o, textAlign: 'left', fontWeight: 500 }}></th><th style={{ ...so, fontWeight: 500 }}>Hiển thị</th>
        <th style={{ ...so, fontWeight: 500 }}>Xem trang</th><th style={{ ...so, fontWeight: 500 }}>Tải</th></tr></thead>
        <tbody>{ds.slice(0, 12).map((x) => <tr key={x.khoa}><td style={o}>{ten(x.khoa)}</td>
          <td style={so}>{x.hienThi}</td><td style={so}>{x.xemTrang}</td><td style={so}>{x.tai}</td></tr>)}</tbody></table>
      {ds.length > 12 && <div style={{ ...phu, marginTop: 4 }}>+{ds.length - 12} dòng nữa</div>}
    </div>
  );
}
