'use client';
// /shop › Thanh toán (anh yêu cầu 02/10/2026): cổng thanh toán của từng shop + SỨC KHOẺ cổng. Một cổng = một tài khoản Stripe (acct_…), nhiều shop/site
// có thể dùng chung — Stripe chấm điểm cả tài khoản nên sức khoẻ tính trên cả tài khoản. Số thô: lib/shop/cong.ts (CHỈ ĐỌC Stripe, cron ~6 giờ/lần);
// đỏ/vàng: lib/shop/cong-luat.ts danhGiaCong theo ngưỡng sửa được ở đây. Cảnh báo đứng đầu thẻ (liếc là thấy), chi tiết trong cây.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Cay, Drawer, LaBang, LinkChip, NutCay, Panel, PickField, Pill, StatsStrip, TextAreaField, TextField, oLa, type CotLa } from '@/components/ui';
import { gio, tien } from '@/lib/shop/buoc';
import { KIEU_CONG, NGUONG_MAC_DINH, NHAN_NGUONG, TRANG_THAI_TAY, VAI_CONG, danhGiaMotCong, tyLeCong, type CongDong, type NguongCong } from '@/lib/shop/cong-luat';
import type { CuaHangDong } from '@/lib/shop/doc';
import { shopDocCong, shopKiemCong, shopSuaCong } from '@/lib/actions/shop';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const MUC: Record<'tot' | 'vang' | 'do', [string, string]> = { tot: ['Khoẻ', 'var(--ok)'], vang: ['Cần để ý', 'var(--warn)'], do: ['Nguy hiểm', 'var(--bad)'] };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const ptChu = (x: number | null) => (x == null ? '—' : `${x}%`);
const COT_LS: CotLa[] = [{ h: 'Ngày', rong: 110 }, { h: 'GD thành công 90 ngày', phai: true }, { h: 'Dispute 90 ngày', phai: true }, { h: 'Hoàn 90 ngày', phai: true }, { h: 'Thất bại 30 ngày', phai: true }, { h: 'Số dư khả dụng', phai: true }];

/** Số cổng đang đỏ/vàng — badge của tab. */
export const soCongCanXem = (ds: CongDong[]) => ds.filter((g) => danhGiaMotCong(g).muc !== 'tot').length;
const tenKieu = (g: CongDong) => KIEU_CONG[g.loai]?.ten ?? g.loai;

export function BangCong({ ds, cuaHang, ch }: { ds: CongDong[]; cuaHang: CuaHangDong[]; ch: string }) {
  const router = useRouter();
  const [dang, batDau] = useTransition();
  const [bao, setBao] = useState<string | null>(null);
  const [sua, setSua] = useState<CongDong | null>(null);
  const shops = cuaHang.filter((c) => ch === 'all' || c.khoa === ch);
  // lọc theo shop: cổng thu của shop đó + cổng nhận mà các cổng thu ấy rút về
  const thuCh = ds.filter((g) => ch === 'all' || g.shops.includes(ch));
  const hien = ch === 'all' ? ds : [...thuCh, ...ds.filter((g) => !thuCh.includes(g) && thuCh.some((x) => x.veCongId === g.id))];
  const tenCong = (id: number | null) => { const x = ds.find((g) => g.id === id); return x ? `${tenKieu(x)} · ${x.ten ?? x.ma}` : null; };
  const chuaCo = shops.filter((c) => !ds.some((g) => g.shops.includes(c.khoa)));
  const tenShop = (k: string) => cuaHang.find((c) => c.khoa === k)?.ten ?? k;
  const docLai = () => batDau(async () => { setBao(null); const r = await shopDocCong().catch((e) => ({ ok: false, kq: [{ loi: (e as Error).message }] }));
    setBao(r.ok ? 'Đã đọc lại từ Stripe' : `Lỗi: ${r.kq.map((x) => ('loi' in x ? x.loi : '')).filter(Boolean).join(' · ')}`); router.refresh(); });

  return (<>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, ...phu }}>Chỉ ĐỌC từ cổng (tài khoản, số dư, giao dịch, dispute, hoàn, cảnh báo gian lận, rút tiền, webhook) — không ghi gì sang Stripe. Máy đọc lại ~6 giờ một lần.</span>
      <span style={{ flex: 1 }} />
      {bao && <span style={{ fontSize: 12.5, color: bao.startsWith('Lỗi') ? 'var(--bad)' : 'var(--fg-2)' }}>{bao}</span>}
      <button className="btn" disabled={dang} onClick={docLai}>{dang ? 'Đang đọc Stripe…' : 'Đọc lại ngay'}</button>
      <button className="btn" onClick={() => setSua({ id: 0, loai: 'payoneer', vai: 'nhan', ma: '', ten: '', ghiChu: null, taiKhoan: null, link: null, veCongId: null, trangThaiTay: null, kiemLuc: null,
        nguong: {}, sucKhoe: null, docLuc: null, loi: null, shops: [], lichSu: [] })}>+ Thêm cổng</button>
    </div>
    {/* dòng tiền: cổng thu → tiền về cổng nhận; shop nào dùng cổng thu nào */}
    {hien.length > 0 && <div style={{ marginBottom: 12 }}><Panel pad={0} title="Dòng tiền" subtitle="thu tiền khách → tiền về đâu">
      <Cay label="Dòng tiền">
        {(['thu', 'nhan'] as const).map((vai) => (
          <NutCay key={vai} ten={<b>{VAI_CONG[vai]}</b>} phu={vai === 'thu' ? 'cổng khách trả tiền trên mặt tiền' : 'tài khoản nhận tiền rút từ cổng thu (rồi về ngân hàng)'}>
            {hien.filter((g) => g.vai === vai).map((g) => { const d = danhGiaMotCong(g);
              return <NutCay key={g.id} ten={<><b style={{ fontWeight: 500 }}>{tenKieu(g)} · {g.ten ?? g.ma}</b><Pill color={MUC[d.muc][1]} label={MUC[d.muc][0]} uppercase={false} mono={false} /></>}
                phu={vai === 'thu' ? <>dùng cho {g.shops.map(tenShop).join(', ') || '— chưa gán shop'} · tiền về: {tenCong(g.veCongId) ?? <span style={{ color: 'var(--warn)' }}>chưa ghi</span>}</>
                  : <>nhận từ: {ds.filter((x) => x.veCongId === g.id).map((x) => `${tenKieu(x)} · ${x.ten ?? x.ma}`).join(', ') || '— chưa cổng thu nào trỏ về đây'}</>} />; })}
            {!hien.some((g) => g.vai === vai) && <NutCay ten={<span style={phu}>chưa có — bấm "+ Thêm cổng"</span>} />}
          </NutCay>
        ))}
      </Cay>
    </Panel></div>}
    {!hien.length && <Panel pad={12}><span style={phu}>Chưa có cổng nào{ch !== 'all' ? ' cho cửa hàng này' : ''} — Stripe: máy tự nhận khi shop có khoá (SHOP_&lt;KHOÁ&gt;_STRIPE_SK); PayPal/Payoneer/PingPong: bấm "+ Thêm cổng".</span></Panel>}
    <div style={{ display: 'grid', gap: 12 }}>
      {hien.map((g) => {
        const s = g.sucKhoe, dg = danhGiaMotCong(g), ty = s ? tyLeCong(s) : null;
        const muc = dg.muc, api = !!KIEU_CONG[g.loai]?.api;
        const ngoai = s?.webhook.filter((w) => !w.cua_minh) ?? [];
        return (
          <Panel key={g.id} pad={12}
            title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{tenKieu(g)} · {g.ten ?? s?.tai_khoan.ten ?? g.ma}
              <Pill color={MUC[muc][1]} label={MUC[muc][0]} uppercase={false} mono={false} /></span>}
            subtitle={api ? `${VAI_CONG[g.vai]} · ${g.ma}${s?.tai_khoan.nuoc ? ` · ${s.tai_khoan.nuoc}` : ''}${s?.tai_khoan.tien_te ? ` · ${s.tai_khoan.tien_te.toUpperCase()}` : ''} · đọc ${g.docLuc ? gio(g.docLuc) : 'chưa'} · dùng cho ${g.shops.map(tenShop).join(', ') || '—'}${ngoai.length ? ` + ${ngoai.length} site khác` : ''}${g.veCongId ? ` · tiền về ${tenCong(g.veCongId)}` : ''}`
              : `${VAI_CONG[g.vai]} · ghi tay (chưa nối API)${g.taiKhoan ? ` · ${g.taiKhoan}` : ''} · kiểm ${g.kiemLuc ? gio(g.kiemLuc) : 'chưa'}${g.vai === 'thu' ? ` · dùng cho ${g.shops.map(tenShop).join(', ') || '—'}` : ''}${g.veCongId ? ` · tiền về ${tenCong(g.veCongId)}` : ''}`}
            actions={<span style={{ display: 'flex', gap: 6 }}>
              {(g.link ?? KIEU_CONG[g.loai]?.link) && <LinkChip href={(g.link ?? KIEU_CONG[g.loai]?.link)!} tone="neutral" size="xs">Trang {tenKieu(g)} ↗</LinkChip>}
              <button className="btn ghost" onClick={() => setSua(g)}>Sửa</button></span>}>
            {/* cảnh báo đứng đầu — liếc là thấy, không nằm trong cây */}
            {(dg.van_de.length
              ? <div style={{ display: 'grid', gap: 4, marginBottom: 10 }}>{dg.van_de.map((v, i) => <div key={i} style={{ fontSize: 13, color: v.muc === 'do' ? 'var(--bad)' : 'var(--warn)' }}>{v.muc === 'do' ? '●' : '○'} {v.chu}</div>)}</div>
              : <div style={{ fontSize: 13, color: 'var(--ok)', marginBottom: 10 }}>{api ? 'Không có vấn đề — tài khoản nhận và rút tiền bình thường, các tỷ lệ dưới ngưỡng.' : `Bình thường theo lần kiểm tay ${g.kiemLuc ? gio(g.kiemLuc) : ''}.`}</div>)}
            {!api && <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6, fontSize: 13 }}>
              <span style={phu}>Vừa mở trang {tenKieu(g)} kiểm xong — ghi lại:</span>
              {Object.entries(TRANG_THAI_TAY).map(([k, [nhan]]) => <button key={k} className="btn ghost" disabled={dang} onClick={() => batDau(async () => { await shopKiemCong(g.id, k); router.refresh(); })}>Đã kiểm · {nhan}</button>)}
            </div>}
            {g.ghiChu && <div style={{ fontSize: 12.5, ...phu, marginBottom: 10 }}>{g.ghiChu}</div>}
            {s && ty && <StatsStrip minColWidth={140} cards={[
              { key: 'nhan', label: 'Nhận tiền', value: s.tai_khoan.nhan_tien ? 'bật' : 'TẮT', color: s.tai_khoan.nhan_tien ? undefined : 'var(--bad)', sub: s.tai_khoan.rut_tien ? 'rút tiền: bật' : 'rút tiền: TẮT' },
              { key: 'dp', label: 'Dispute 90 ngày', value: ptChu(ty.dispute), color: ty.dispute != null && ty.dispute >= (g.nguong.dispute_vang ?? NGUONG_MAC_DINH.dispute_vang) ? 'var(--warn)' : undefined,
                sub: `${s.ky90.dispute}/${s.ky90.thanh_cong} giao dịch${s.ky90.dispute_mo ? ` · ${s.ky90.dispute_mo} chờ bằng chứng` : ''}` },
              { key: 'hoan', label: 'Hoàn 90 ngày', value: ptChu(ty.hoan), sub: `${s.ky90.hoan} lần · ${tien(s.ky90.tien_hoan)}` },
              { key: 'tb', label: 'Thất bại 30 ngày', value: ptChu(ty.that_bai), sub: `${s.ky30.that_bai} hỏng / ${s.ky30.thanh_cong} thành công${s.ky90.chan_rui_ro ? ` · Radar chặn ${s.ky90.chan_rui_ro}` : ''}` },
              { key: 'efw', label: 'Cảnh báo gian lận', value: s.ky90.efw, color: s.ky90.efw ? 'var(--warn)' : undefined, sub: '90 ngày (EFW từ ngân hàng)' },
              { key: 'dt', label: 'Thu 90 ngày', value: tien(s.ky90.tien), sub: `${s.ky90.thanh_cong} giao dịch${s.ky90.doc_het ? '' : ' · chỉ đọc 1000 gần nhất'}` },
              { key: 'du', label: 'Số dư', value: tien(s.so_du.kha_dung), sub: `chờ ${tien(s.so_du.cho)}${s.tai_khoan.lich_rut ? ` · rút ${s.tai_khoan.lich_rut}` : ''}` },
            ]} />}
            {s && <div style={{ marginTop: 10, border: '1px solid var(--line)', borderRadius: 6 }}><Cay label="Chi tiết cổng">
              <NutCay ten={<b>Shop dùng cổng này</b>} phu={`${g.shops.length} shop của mình${ngoai.length ? ` · ${ngoai.length} site khác dùng chung tài khoản (theo webhook) — dispute/hoàn của họ cũng tính vào sức khoẻ tài khoản` : ''}`}>
                {g.shops.map((k) => <NutCay key={k} ten={<span>{tenShop(k)}</span>} phu={cuaHang.find((c) => c.khoa === k)?.domain} />)}
                {ngoai.map((w) => <NutCay key={w.url} mo_nhat ten={<span>{host(w.url)}</span>} phu="site khác (không thuộc /shop) — dùng chung tài khoản Stripe" />)}
              </NutCay>
              <NutCay ten={<b>Webhook</b>} phu={`${s.webhook.length} endpoint · ${s.webhook.filter((w) => w.trang_thai !== 'enabled').length} tắt · ${s.su_kien_treo} sự kiện chưa giao được (≥ 1 giờ)`}>
                <LaBang cot={[{ h: 'Địa chỉ' }, { h: 'Trạng thái', rong: 100 }, { h: 'Loại sự kiện', rong: 110, phai: true }, { h: 'Thuộc', rong: 150 }]}>
                  <tbody>{s.webhook.map((w) => <tr key={w.url} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={oLa()} title={w.url}>{w.url}</td>
                    <td style={{ ...oLa(), color: w.trang_thai === 'enabled' ? undefined : 'var(--warn)' }}>{w.trang_thai === 'enabled' ? 'bật' : w.trang_thai}</td>
                    <td style={oLa(true)}>{w.so_su_kien}</td>
                    <td style={{ ...oLa(), ...phu }}>{w.cua_minh ? 'shop của mình' : 'site khác'}</td></tr>)}</tbody>
                </LaBang>
              </NutCay>
              {(s.tai_khoan.thieu.length > 0 || s.tai_khoan.qua_han.length > 0) && <NutCay ten={<b>Stripe đòi bổ sung</b>} phu="làm trên Stripe Dashboard (chủ tài khoản tự nhập — mos2 không điền hộ)">
                {[...s.tai_khoan.qua_han.map((x) => [x, true] as const), ...s.tai_khoan.thieu.map((x) => [x, false] as const)].map(([x, qua]) =>
                  <NutCay key={x} ten={<span style={{ color: qua ? 'var(--bad)' : 'var(--warn)' }}>{x}{qua ? ' · quá hạn' : ''}</span>} />)}
              </NutCay>}
              <NutCay ten={<b>Rút tiền gần nhất</b>} phu={s.rut.length ? `${s.rut.length} lần` : 'chưa có lần rút nào'}>
                {s.rut.length > 0 && <LaBang cot={[{ h: 'Ngày về', rong: 110 }, { h: 'Số tiền', rong: 110, phai: true }, { h: 'Trạng thái', rong: 110 }, { h: 'Lỗi' }]}>
                  <tbody>{s.rut.map((r) => <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={oLa()}>{r.ngay}</td><td style={oLa(true)}>{tien(r.so)}</td>
                    <td style={{ ...oLa(), color: r.trang_thai === 'failed' ? 'var(--bad)' : undefined }}>{r.trang_thai}</td><td style={{ ...oLa(), ...phu }}>{r.loi ?? '—'}</td></tr>)}</tbody>
                </LaBang>}
              </NutCay>
              <NutCay ten={<b>Lịch sử 30 ngày</b>} phu={g.lichSu.length ? `${g.lichSu.length} ngày đã chụp — xem tỷ lệ có đang leo không` : 'chưa có'}>
                {g.lichSu.length > 0 && <LaBang cot={COT_LS}>
                  <tbody>{[...g.lichSu].reverse().map((l) => { const t = tyLeCong({ ...s, ky90: l.so.ky90, ky30: l.so.ky30 });
                    return <tr key={l.ngay} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={oLa()}>{l.ngay}</td><td style={oLa(true)}>{l.so.ky90.thanh_cong}</td><td style={oLa(true)}>{ptChu(t.dispute)}</td>
                      <td style={oLa(true)}>{ptChu(t.hoan)}</td><td style={oLa(true)}>{ptChu(t.that_bai)}</td><td style={oLa(true)}>{tien(l.so.so_du.kha_dung)}</td></tr>; })}</tbody>
                </LaBang>}
              </NutCay>
            </Cay></div>}
          </Panel>
        );
      })}
      {chuaCo.length > 0 && <Panel pad={12}><span style={{ fontSize: 13 }}><b>Chưa có cổng:</b> {chuaCo.map((c) => c.ten).join(', ')} — chưa có khoá Stripe (SHOP_&lt;KHOÁ&gt;_STRIPE_PK/SK).{' '}
        <a href="/shop?tab=cua_hang">Xem mục Kết nối của cửa hàng</a>.</span></Panel>}
    </div>
    {sua && <SuaCong g={sua} ds={ds} cuaHang={cuaHang} onClose={() => setSua(null)} />}
  </>);
}

/** Thêm (id 0) / sửa phía mos2 của một cổng: loại, tên, tài khoản (CHỈ email/mã), trang quản trị, tiền về cổng nào, shop dùng, ghi chú, ngưỡng.
 *  Không đụng gì phía cổng. Cổng Stripe: loại + mã acct do máy nhận, không sửa ở đây. */
function SuaCong({ g, ds, cuaHang, onClose }: { g: CongDong; ds: CongDong[]; cuaHang: CuaHangDong[]; onClose: () => void }) {
  const moi = g.id === 0;
  const [loai, setLoai] = useState(g.loai);
  const [ten, setTen] = useState(g.ten ?? '');
  const [tk, setTk] = useState(g.taiKhoan ?? '');
  const [link, setLink] = useState(g.link ?? '');
  const [ve, setVe] = useState<number | null>(g.veCongId);
  const [shops, setShops] = useState<string[]>(g.shops);
  const [gc, setGc] = useState(g.ghiChu ?? '');
  const [ng, setNg] = useState<Record<string, string>>(Object.fromEntries(Object.keys(NGUONG_MAC_DINH).map((k) => [k, g.nguong[k] != null ? String(g.nguong[k]) : ''])));
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const kieu = KIEU_CONG[loai] ?? KIEU_CONG.khac!;
  const nhan = ds.filter((x) => x.vai === 'nhan' && x.id !== g.id);
  return (
    <Drawer onClose={onClose} width={620}>
      <div style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{moi ? 'Thêm cổng thanh toán' : `Cổng · ${KIEU_CONG[g.loai]?.ten ?? g.loai} · ${g.ten ?? g.ma}`}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10 }}>
          <PickField label="Loại" value={loai} disabled={!moi} hint={`${VAI_CONG[kieu.vai]}${kieu.api ? ' · máy tự đọc sức khoẻ' : ' · ghi tay (chưa nối API)'}`}
            options={Object.entries(KIEU_CONG).map(([k, x]) => ({ value: k, label: `${x.ten} — ${VAI_CONG[x.vai].toLowerCase()}` }))} onChange={(k) => k && setLoai(k)} />
          <TextField id="cong-ten" label="Tên gọi" placeholder={`${kieu.ten} chính`} value={ten} onChange={(e) => setTen(e.target.value)} />
        </div>
        {loai !== 'stripe' && <TextField id="cong-tk" label="Tài khoản" hint="CHỈ email đăng nhập / mã tài khoản (vd Payoneer ID). Không mật khẩu, không số thẻ / số tài khoản ngân hàng." value={tk} onChange={(e) => setTk(e.target.value)} />}
        <TextField id="cong-link" label="Trang quản trị" placeholder={kieu.link ?? 'https://…'} value={link} onChange={(e) => setLink(e.target.value)} />
        {kieu.vai === 'thu' && <>
          <PickField label="Tiền rút về" value={ve} placeholder="— chưa ghi —" clearable hint={nhan.length ? undefined : 'chưa có cổng nhận (Payoneer/PingPong) — thêm trước rồi chọn ở đây'}
            options={nhan.map((x) => ({ value: x.id, label: `${KIEU_CONG[x.loai]?.ten ?? x.loai} · ${x.ten ?? x.ma}` }))} onChange={(k) => setVe(k ?? null)} />
          <div style={{ display: 'grid', gap: 4 }}><b style={{ fontSize: 13 }}>Shop dùng cổng này</b>
            {loai === 'stripe' ? <span style={{ fontSize: 12.5, ...phu }}>Stripe: máy tự gán theo khoá của từng shop.</span>
              : <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{cuaHang.map((c) => <label key={c.khoa} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={shops.includes(c.khoa)} onChange={(e) => setShops(e.target.checked ? [...shops, c.khoa] : shops.filter((x) => x !== c.khoa))} />{c.ten}</label>)}</span>}
          </div>
        </>}
        <TextAreaField id="cong-gc" label="Ghi chú (ai giữ tài khoản, phí, lưu ý)" rows={3} value={gc} onChange={(e) => setGc(e.target.value)} />
        {kieu.api && <>
          <b style={{ fontSize: 13 }}>Ngưỡng cảnh báo — trống = mặc định</b>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(Object.keys(NGUONG_MAC_DINH) as (keyof NguongCong)[]).map((k) => (
              <TextField key={k} id={`cong-ng-${k}`} label={NHAN_NGUONG[k]} inputMode="decimal" placeholder={String(NGUONG_MAC_DINH[k])} value={ng[k] ?? ''} onChange={(e) => setNg({ ...ng, [k]: e.target.value })} />
            ))}
          </div>
        </>}
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" disabled={dang} onClick={() => batDau(async () => {
            const nguong = Object.fromEntries(Object.entries(ng).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v)]));
            const r = await shopSuaCong(moi ? null : g.id, { loai, ten, taiKhoan: tk, link, veCongId: ve, shops: loai === 'stripe' ? undefined : shops, ghiChu: gc, nguong })
              .catch((e) => ({ ok: false, loi: (e as Error).message }));
            if (r.ok) onClose(); else setLoi(('loi' in r && r.loi) || 'lỗi');
          })}>{dang ? 'Đang lưu…' : 'Lưu'}</button>
          <button className="btn ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </Drawer>
  );
}
