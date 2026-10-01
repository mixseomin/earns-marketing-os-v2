'use client';
// Drawer sửa / THÊM một NCC (sổ shop_ncc; khoa rỗng = thêm mới): kênh (CJ · Alibaba · 1688 …), tên, website, tài khoản của mình (mã/email — KHÔNG mật khẩu), các link, người/kênh liên hệ, ghi chú.
import { useState, useTransition } from 'react';
import { Drawer, SelectField, TextAreaField, TextField } from '@/components/ui';
import type { NccDong } from '@/lib/shop/ho-so-doc';
import { KENH_NCC } from '@/lib/shop/buoc';
import { shopSuaNcc } from '@/lib/actions/shop';

const KENH = [['email', 'Email'], ['whatsapp', 'WhatsApp'], ['skype', 'Skype'], ['telegram', 'Telegram'], ['wechat', 'WeChat'], ['chat', 'Link chat'], ['phone', 'Điện thoại'], ['khac', 'Khác']] as const;

export function SuaNcc({ n, onClose }: { n: NccDong; onClose: () => void }) {
  const goc = { ten: n.ten, kenh: n.kenh, website: n.website ?? '', taiKhoan: n.taiKhoan ?? '', ghiChu: n.ghiChu ?? '',
    links: n.links.map((l) => ({ ...l })), lienHe: n.lienHe.map((l) => ({ kenh: l.kenh, gia_tri: l.gia_tri, ten: l.ten ?? '' })) };
  const [v, setV] = useState(goc);
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const doi = JSON.stringify(v) !== JSON.stringify(goc);
  return (
    <Drawer onClose={onClose} width={640} dirty={doi}>
      <div style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{n.khoa ? `Nhà cung cấp · ${n.ten}` : 'Thêm nhà cung cấp'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 10 }}>
          <SelectField id="ncc-kenh-goc" label="Kênh" value={v.kenh} disabled={n.coApi} onChange={(e) => setV({ ...v, kenh: e.target.value })}
            hint={KENH_NCC[v.kenh]?.chu}>
            {Object.entries(KENH_NCC).map(([k, x]) => <option key={k} value={k}>{x.ten}</option>)}</SelectField>
          <TextField id="ncc-ten" label={v.kenh === 'cj' ? 'Tên' : 'Tên nhà bán / xưởng'} value={v.ten} onChange={(e) => setV({ ...v, ten: e.target.value })} />
          <TextField id="ncc-web" label="Website" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} placeholder="https://…" />
        </div>
        <TextField id="ncc-tk" label="Tài khoản của mình bên NCC" hint="Mã tài khoản / email đăng nhập. KHÔNG ghi mật khẩu — mật khẩu nằm ở vault." value={v.taiKhoan} onChange={(e) => setV({ ...v, taiKhoan: e.target.value })} />
        <b style={{ fontSize: 13 }}>Người / kênh liên hệ</b>
        {v.lienHe.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
            <SelectField id={`ncc-kenh-${i}`} size="sm" value={l.kenh} onChange={(e) => setV({ ...v, lienHe: v.lienHe.map((x, j) => (j === i ? { ...x, kenh: e.target.value } : x)) })}>
              {KENH.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</SelectField>
            <TextField id={`ncc-gt-${i}`} size="sm" value={l.gia_tri} placeholder="email / số / id / link" onChange={(e) => setV({ ...v, lienHe: v.lienHe.map((x, j) => (j === i ? { ...x, gia_tri: e.target.value } : x)) })} />
            <TextField id={`ncc-nguoi-${i}`} size="sm" value={l.ten} placeholder="tên người (agent)" onChange={(e) => setV({ ...v, lienHe: v.lienHe.map((x, j) => (j === i ? { ...x, ten: e.target.value } : x)) })} />
            <button className="btn ghost" onClick={() => setV({ ...v, lienHe: v.lienHe.filter((_, j) => j !== i) })}>Bỏ</button>
          </div>
        ))}
        <div><button className="btn ghost" onClick={() => setV({ ...v, lienHe: [...v.lienHe, { kenh: 'whatsapp', gia_tri: '', ten: '' }] })}>+ Thêm liên hệ</button></div>
        <b style={{ fontSize: 13 }}>Link</b>
        {v.links.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 6, alignItems: 'end' }}>
            <TextField id={`ncc-ln-${i}`} size="sm" value={l.nhan} placeholder="nhãn" onChange={(e) => setV({ ...v, links: v.links.map((x, j) => (j === i ? { ...x, nhan: e.target.value } : x)) })} />
            <TextField id={`ncc-lu-${i}`} size="sm" value={l.url} placeholder="https://…" onChange={(e) => setV({ ...v, links: v.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
            <button className="btn ghost" onClick={() => setV({ ...v, links: v.links.filter((_, j) => j !== i) })}>Bỏ</button>
          </div>
        ))}
        <div><button className="btn ghost" onClick={() => setV({ ...v, links: [...v.links, { nhan: '', url: '' }] })}>+ Thêm link</button></div>
        <TextAreaField id="ncc-gc" label="Ghi chú" rows={3} value={v.ghiChu} onChange={(e) => setV({ ...v, ghiChu: e.target.value })} />
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" disabled={!doi || dang} onClick={() => batDau(async () => {
            const r = await shopSuaNcc(n.khoa, v).catch((e) => ({ ok: false, loi: (e as Error).message }));
            if (r.ok) onClose(); else setLoi(('loi' in r && r.loi) || 'lỗi');
          })}>{dang ? 'Đang lưu…' : 'Lưu'}</button>
          <button className="btn ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </Drawer>
  );
}
