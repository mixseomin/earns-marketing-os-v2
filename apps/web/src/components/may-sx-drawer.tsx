'use client';
// NGĂN MÁY SX (anh 12/11/2026: "mọi thứ ở tab Máy SX phải khi bấm vào phải dùng drawer") — loại 'may-sx' của EntityDrawerHost (?ed=may-sx~<mã>), F5 mở lại đúng ngăn.
// Mã: l-<id> lượt dựng · s-<id> bài social chờ dựng · k-… / p-… việc Kênh nội dung / Puzzle (khoá dòng gom). Việc Ethopex mở ngăn 'etp-sx' sẵn có, không qua đây.
// Đọc /api/may-sx/chi-tiet. Trang gốc (studio, tab Kênh, tab Tài sản) chỉ là đường dẫn PHỤ trong ngăn, không phải đích của cú bấm.
import { useEffect, useState, type ReactNode } from 'react';
import { Drawer } from '@/components/ui';
import { TEN_NGUON, type ViecSx } from '@/lib/may-sx/gom-kieu';

type Luot = { id: number; luc: string; xong_luc: string | null; kieu_ten: string | null; ngay_dang: string | null; trang_thai: 'dang' | 'xong' | 'hong'; vnd: number; ghi: string | null; loi: string | null; tep: string | null };
type Bai = { id: number; slug: string; may_id: number; may: string; may_ten: string; dang: Record<string, unknown> | null; video_url: string | null; anh: string[] | null;
  cham: { ket?: string; diem?: number; chan_cung?: string[]; canh_bao?: string[]; luc?: string } | null; da_dang: Record<string, unknown> | null; luc: string | null };
type Du = { loai: 'bai'; bai: Bai | null; kieu_ten: string | null; luot: Luot[]; luot_mo?: number; slug: string; may: string } | { loai: 'viec'; viec: ViecSx };

const gioVn = (iso?: string | null) => (iso ? new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ').replace(/^(\d\d)-(\d\d)/, '$2/$1') : '—');
const TT = { xong: ['✓ xong', 'var(--ok, #16a34a)'], hong: ['✗ hỏng', 'var(--bad, #dc2626)'], dang: ['⏳ đang dựng', 'var(--warn, #d97706)'] } as const;
const KET: Record<string, [string, string]> = { DUYET: ['✓ DUYỆT', 'var(--ok, #16a34a)'], SUA_LAI: ['✎ SỬA LẠI', 'var(--bad, #dc2626)'], KHONG_DUYET: ['✗ KHÔNG DUYỆT', 'var(--bad, #dc2626)'] };
const s = (v: unknown) => (v == null || v === '' ? null : String(v));

function Muc({ ten, children }: { ten: string; children: ReactNode }) {
  return <section style={{ display: 'grid', gap: 6 }}><h4 style={{ margin: 0, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--fg-3)' }}>{ten}</h4>{children}</section>;
}
function Dong({ k, v }: { k: string; v: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr)', gap: 8, fontSize: 13 }}><span style={{ color: 'var(--fg-3)' }}>{k}</span><span style={{ overflowWrap: 'anywhere' }}>{v}</span></div>;
}

export function MaySxDrawer({ ma, onClose }: { ma: string; onClose: () => void }) {
  const [du, setDu] = useState<Du | null>(null), [loi, setLoi] = useState<string | null>(null);
  useEffect(() => {
    let dung = false; setDu(null); setLoi(null);
    fetch(`/api/may-sx/chi-tiet?ma=${encodeURIComponent(ma)}`, { cache: 'no-store' }).then((r) => r.json())
      .then((j) => { if (dung) return; if (j.error) setLoi(j.error); else setDu(j); }).catch((e) => { if (!dung) setLoi((e as Error).message); });
    return () => { dung = true; };
  }, [ma]);

  const bai = du?.loai === 'bai' ? du.bai : null, dang = bai?.dang ?? {};
  const ten = du?.loai === 'viec' ? du.viec.ten : s(dang.y) ?? s(dang.title) ?? (du?.loai === 'bai' ? du.slug : ma);
  const dau = du?.loai === 'viec' ? `${TEN_NGUON[du.viec.nguon]}${du.viec.cua ? ` · ${du.viec.cua}` : ''}` : du?.loai === 'bai' ? `${bai?.may_ten ?? du.may} · ${du.kieu_ten ?? 'chưa rõ dạng'}` : 'Máy SX';
  const goc = du?.loai === 'viec' ? ('url' in du.viec.mo ? du.viec.mo.url : null) : bai ? `https://studio.on.tc/?kho=tu_dong&may=${bai.may_id}&video=${bai.id}` : null;

  return <Drawer onClose={onClose} width={720} zIndex={300} padding={0}>
    <div className="modal-head"><div style={{ minWidth: 0 }}><div className="id-line">{dau}</div><h2 style={{ margin: 0, overflowWrap: 'anywhere' }}>{ten}</h2></div>
      {goc ? <a href={goc} target={goc.startsWith('http') ? '_blank' : undefined} rel="noreferrer" style={{ marginLeft: 'auto', marginRight: 12, fontSize: 12, color: '#60a5fa', whiteSpace: 'nowrap' }}>{goc.startsWith('http') ? 'mở trên studio ↗' : 'mở trang gốc →'}</a> : null}
      <button className="modal-close" onClick={onClose}>✕</button></div>
    <div style={{ padding: 16, display: 'grid', gap: 18 }}>
      {loi ? <div role="alert" style={{ border: '1px solid var(--bad, #dc2626)', color: 'var(--bad, #dc2626)', borderRadius: 8, padding: 10, fontSize: 13 }}>Không đọc được chi tiết: {loi}</div> : null}
      {!du && !loi ? <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Đang tải…</div> : null}

      {du?.loai === 'viec' ? <Muc ten="Việc">
        <Dong k="Nguồn" v={TEN_NGUON[du.viec.nguon]} /><Dong k="Thuộc" v={du.viec.cua ?? '—'} />
        <Dong k="Bước" v={`${du.viec.buoc}${du.viec.so != null && du.viec.tong ? ` · ${du.viec.so}/${du.viec.tong}` : ''}`} />
        <Dong k="Cập nhật" v={gioVn(du.viec.luc)} />
        {du.viec.loi ? <Dong k="Lỗi" v={<span style={{ color: 'var(--bad, #dc2626)' }}>{du.viec.loi}</span>} /> : null}
        {du.viec.ghi ? <Dong k="Ghi chú" v={du.viec.ghi} /> : null}
      </Muc> : null}

      {du?.loai === 'bai' && !bai ? <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>Bài <b>{du.slug}</b> không còn trong sổ bài (đã cất hoặc đổi slug).</div> : null}
      {bai ? <>
        <Muc ten="Tệp">
          {bai.video_url ? <video src={bai.video_url} controls playsInline style={{ width: 'min(100%, 300px)', borderRadius: 8, background: '#000' }} />
            : (bai.anh ?? []).length ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(bai.anh ?? []).map((u) => <img key={u} src={u} alt="" style={{ width: 160, borderRadius: 8 }} />)}</div>
            : <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>Chưa có tệp — lượt kế của Máy SX dựng (06:00 / 18:00).</span>}
        </Muc>
        <Muc ten="Bài">
          <Dong k="Ngày đăng" v={s(dang.dang_tu) ? gioVn(String(dang.dang_tu)) : 'chưa xếp'} />
          <Dong k="Hướng" v={s(dang.y) ?? '—'} />
          {s(dang.title) ? <Dong k="Tiêu đề" v={String(dang.title)} /> : null}
          {s(dang.description) ? <Dong k="Chữ đăng" v={<span style={{ whiteSpace: 'pre-wrap' }}>{String(dang.description)}</span>} /> : null}
          {s(dang.binh_luan) ? <Dong k="Bình luận đầu" v={String(dang.binh_luan)} /> : null}
          <Dong k="Slug" v={bai.slug} />
        </Muc>
        <Muc ten="Phòng Nội dung chấm">
          {bai.cham?.ket ? <>
            <Dong k="Kết quả" v={<b style={{ color: (KET[bai.cham.ket] ?? [bai.cham.ket, 'inherit'])[1] }}>{(KET[bai.cham.ket] ?? [bai.cham.ket])[0]}{bai.cham.diem != null ? ` · ${bai.cham.diem} điểm` : ''}</b>} />
            <Dong k="Lúc" v={gioVn(bai.cham.luc)} />
            {(bai.cham.chan_cung ?? []).length ? <Dong k="Chặn" v={<ul style={{ margin: 0, paddingLeft: 16 }}>{bai.cham.chan_cung!.map((c) => <li key={c}>{c}</li>)}</ul>} /> : null}
            {(bai.cham.canh_bao ?? []).length ? <Dong k="Cảnh báo" v={<ul style={{ margin: 0, paddingLeft: 16 }}>{bai.cham.canh_bao!.map((c) => <li key={c}>{c}</li>)}</ul>} /> : null}
          </> : <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>Chưa chấm.</span>}
          <Dong k="Đã đăng" v={Object.keys(bai.da_dang ?? {}).length ? Object.keys(bai.da_dang ?? {}).join(', ') : 'chưa'} />
        </Muc>
      </> : null}

      {du?.loai === 'bai' ? <Muc ten={`Lượt dựng (${du.luot.length})`}>
        {!du.luot.length ? <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>Chưa dựng lượt nào.</span>
          : <div style={{ display: 'grid', gap: 6 }}>{du.luot.map((l) => <div key={l.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13,
              background: l.id === du.luot_mo ? 'var(--accent-soft, rgba(37,99,235,.08))' : undefined }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <b style={{ color: TT[l.trang_thai][1] }}>{TT[l.trang_thai][0]}</b><span style={{ fontVariantNumeric: 'tabular-nums' }}>{gioVn(l.luc)}{l.xong_luc ? ` → ${gioVn(l.xong_luc).slice(6)}` : ''}</span>
                <span style={{ color: 'var(--fg-2)' }}>{l.kieu_ten ?? '—'}</span><span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{(l.vnd ?? 0).toLocaleString('vi-VN')}₫</span></div>
              {l.loi ? <div style={{ color: 'var(--bad, #dc2626)', marginTop: 4, overflowWrap: 'anywhere' }}>{l.loi}</div> : l.ghi ? <div style={{ color: 'var(--fg-2)', marginTop: 4 }}>{l.ghi}</div> : null}
            </div>)}</div>}
      </Muc> : null}
    </div>
  </Drawer>;
}
