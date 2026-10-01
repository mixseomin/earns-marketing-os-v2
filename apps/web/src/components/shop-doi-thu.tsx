'use client';
// /shop › Đối thủ (anh chốt 02/10/2026): ai đang bán cùng/gần mẫu với sản phẩm của mình — trang đích, giá, quảng cáo họ đang chạy. Hai cây (ui/cay.tsx):
//   • Theo sản phẩm của mình: sản phẩm mình → sản phẩm đối thủ (giá so với mình, mức khớp, trang đích) → quảng cáo đẩy sản phẩm đó.
//   • Theo đối thủ: đối thủ (kênh bán, web, Thư viện QC Meta) → sản phẩm của họ → quảng cáo.
//   • Theo góc quảng cáo: sản phẩm mình → góc bán (giảm đau, bác sĩ khuyên, khuyến mãi…) → quảng cáo của các đối thủ — để soạn QC cho mình.
// Sổ: shop_doi_thu / shop_doi_thu_sp / shop_doi_thu_qc (migration 0206). Không xoá — thôi theo dõi bằng cờ.
// URL: ?dtv=sp|dt|goc (cây) · ?dt=<loại>&dtId=<id | moi-<cha>> (drawer).
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Cay, Drawer, FilterChips, LaBang, LinkChip, NutCay, Panel, PickField, Pill, SelectField, StatsStrip, TextAreaField, TextField, oLa, type CotLa } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { useShallowParam } from '@/lib/url-shallow';
import { DINH_DANG_QC, KENH_BAN, KHOP_DOI_THU, NEN_TANG_QC, gio, linkThuVienQc, soNgayChay, tien } from '@/lib/shop/buoc';
import type { BienTheDong, SanPhamDong } from '@/lib/shop/doc';
import type { DoiThuDong, QcDoiThu, SpDoiThu } from '@/lib/shop/doi-thu-doc';
import { shopSuaDoiThu, shopSuaQcDoiThu, shopSuaSpDoiThu } from '@/lib/actions/shop';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const MAU: Record<string, string> = { ok: 'var(--ok)', warn: 'var(--warn)', muted: 'var(--fg-3)' };
const host = (u: string | null) => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : ''; } catch { return u ?? ''; } };

function PillKhop({ k }: { k: string }) { const x = KHOP_DOI_THU[k] ?? [k, 'muted']; return <Pill color={MAU[x[1]] ?? "var(--fg-3)"} label={x[0]} uppercase={false} mono={false} />; }
/** Giá đối thủ so với giá mình: rẻ hơn (đỏ — mình đắt hơn) / đắt hơn (xanh). */
function SoGia({ gia, cuaMinh }: { gia: number | null; cuaMinh: number | null }) {
  if (gia == null) return <span style={phu}>giá —</span>;
  if (cuaMinh == null) return <b>{tien(gia)}</b>;
  const lech = Math.round(((gia - cuaMinh) / cuaMinh) * 100);
  return <span><b>{tien(gia)}</b> <span style={{ color: lech < -5 ? 'var(--bad)' : lech > 5 ? 'var(--ok)' : 'var(--fg-3)', fontSize: 12 }}>{lech === 0 ? 'bằng mình' : lech < 0 ? `rẻ hơn mình ${-lech}%` : `đắt hơn mình ${lech}%`}</span></span>;
}
/** Bảng quảng cáo đối thủ — cột cố định (ui/cay LaBang) nên mọi nhóm trong cây thẳng cột; xếp theo SỐ NGÀY ĐÃ CHẠY (dài nhất trước — QC sống lâu
 *  là QC có lãi). Bấm một dòng → thẻ xem trước creative ngay bên dưới (toàn văn, ảnh lớn, tiêu đề, CTA…). Sửa = nút riêng. */
function BangQc({ ds, sua, anGoc }: { ds: { x: QcDoiThu; tenDt?: string }[]; sua: (id: number) => void; /** nhóm đã là góc (cây theo góc) → bỏ cột trùng */ anGoc?: boolean }) {
  const [mo, setMo] = useState<Set<number>>(new Set());
  const coDt = ds.some((y) => y.tenDt);
  // cột phụ hẹp, hook (thứ đọc nhiều nhất) ăn phần còn lại; ngày bắt đầu nằm trong title của 'Đã chạy'
  const cot: CotLa[] = [{ h: '', rong: 52 }, ...(coDt ? [{ h: 'Đối thủ', rong: 120 }] : []), { h: 'Dạng', rong: 72 }, { h: 'Hook (câu mở đầu)' },
    ...(anGoc ? [] : [{ h: 'Góc bán', rong: 140 }]), { h: 'Ưu đãi', rong: 130 }, { h: 'Đã chạy', rong: 92, phai: true }, { h: 'Trạng thái', rong: 96 }, { h: '', rong: 96 }];
  const xep = [...ds].map((y) => ({ ...y, ngay: soNgayChay(y.x.batDau, y.x.dangChay, y.x.luc) })).sort((a, b) => (b.ngay ?? -1) - (a.ngay ?? -1));
  return (
    <LaBang cot={cot}>
      {xep.map(({ x, tenDt, ngay }) => {
        const anh = x.anh ?? (x.media && /\.(jpe?g|png|webp|gif)(\?|$)|fbcdn|scontent/i.test(x.media) ? x.media : null);
        const dangMo = mo.has(x.id);
        return (
          <tbody key={x.id} style={{ borderTop: '1px solid var(--line)' }}>
            <tr onClick={() => setMo((s) => { const n = new Set(s); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; })} style={{ cursor: 'pointer', background: dangMo ? 'var(--bg-2)' : undefined }} title="Bấm để xem creative">
              <td style={oLa()}>{anh ? <img src={x.anh ? `${x.anh}?w=160` : anh} alt="" width={40} height={40} loading="lazy" style={{ objectFit: 'cover', borderRadius: 4, display: 'block', border: '1px solid var(--line)' }} /> : <span style={phu}>—</span>}</td>
              {coDt && <td style={oLa()} title={tenDt}><b style={{ fontWeight: 500 }}>{tenDt}</b></td>}
              <td style={{ ...oLa(), ...phu }} title={x.soPhienBan ? `${x.soPhienBan} phiên bản` : undefined}>{x.dinhDang ? DINH_DANG_QC[x.dinhDang] ?? x.dinhDang : '—'}{x.soPhienBan ? ` ·${x.soPhienBan}` : ''}</td>
              <td style={{ ...oLa(), fontStyle: x.hook ? 'italic' : undefined }} title={x.hook ?? ''}>{x.hook ? `“${x.hook}”` : <span style={phu}>chưa chép</span>}</td>
              {!anGoc && <td style={oLa()} title={x.goc ?? ''}>{x.goc ?? '—'}</td>}
              <td style={oLa()} title={x.uuDai ?? ''}>{x.uuDai ?? '—'}</td>
              <td style={{ ...oLa(true), fontWeight: 600, color: ngay == null ? 'var(--fg-3)' : ngay >= 30 ? 'var(--ok)' : ngay < 7 ? 'var(--fg-3)' : undefined }}
                title={`${x.batDau ? `chạy từ ${x.batDau}` : 'chưa rõ ngày bắt đầu'} — tính tới hôm nay (đang chạy) / lần thấy gần nhất (đã dừng). ≥ 30 ngày: QC sống lâu, dấu hiệu có lãi`}>{ngay == null ? '—' : `${ngay} ngày`}</td>
              <td style={{ ...oLa(), color: x.dangChay ? 'var(--ok)' : 'var(--fg-3)' }}>{x.dangChay == null ? '—' : x.dangChay ? 'đang chạy' : 'đã dừng'}</td>
              <td style={{ ...oLa(true), overflow: 'visible' }} onClick={(e) => e.stopPropagation()}>
                <span style={{ display: 'inline-flex', gap: 4 }}><LinkChip href={x.link} tone="neutral" size="xs" title="Mở QC này trong Thư viện quảng cáo">TV ↗</LinkChip><button className="btn ghost" title="Sửa" onClick={() => sua(x.id)}>✎</button></span></td>
            </tr>
            {dangMo && <tr><td colSpan={cot.length} style={{ padding: 0 }}><TheQc x={x} anh={anh} tenDt={tenDt} ngay={ngay} /></td></tr>}
          </tbody>
        );
      })}
    </LaBang>
  );
}

/** Thẻ xem trước quảng cáo, dựng theo bố cục quảng cáo Meta: tên page → toàn văn → media → thanh dưới (tên miền · tiêu đề · mô tả · nút CTA),
 *  bên phải là thông số để soạn QC cho mình (định dạng, góc, ưu đãi, ngày chạy, phiên bản, trang đích). */
function TheQc({ x, anh, tenDt, ngay }: { x: QcDoiThu; anh: string | null; tenDt?: string; ngay: number | null }) {
  const lon = x.anh ? `${x.anh}?w=720` : anh;
  const video = x.dinhDang === 'video' || x.dinhDang === 'ugc_video';
  const van = (x.noiDung ?? x.hook ?? '').replace(/ \/ /g, '\n');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 420px) minmax(0, 1fr)', gap: 16, padding: '8px 12px 14px 14px', alignItems: 'start' }}>
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-2)' }}>
        <div style={{ padding: '10px 12px 6px', fontSize: 13 }}><b>{tenDt ?? 'Đối thủ'}</b><div style={{ ...phu, fontSize: 11.5 }}>Được tài trợ</div></div>
        {van && <div style={{ padding: '0 12px 10px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{van}</div>}
        {lon ? <div style={{ position: 'relative' }}>
          <img src={lon} alt="" style={{ width: '100%', display: 'block', background: 'var(--bg)' }} />
          {video && <a href={x.link} target="_blank" rel="noreferrer" title="Video — mở Thư viện quảng cáo để xem"
            style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
            <span style={{ width: 56, height: 56, borderRadius: 28, background: 'rgba(0,0,0,.55)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 22 }}>▶</span></a>}
        </div> : <div style={{ padding: 24, textAlign: 'center', ...phu, fontSize: 12.5, borderTop: '1px solid var(--line)' }}>{x.media ? 'Ảnh chưa lưu được — mở Thư viện để xem' : 'Chưa có ảnh'}</div>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderTop: '1px solid var(--line)' }}>
          <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 2 }}>
            {x.landing && <span style={{ ...phu, fontSize: 11, textTransform: 'uppercase' }}>{host(x.landing)}</span>}
            {x.tieuDe && <b style={{ fontSize: 13.5 }}>{x.tieuDe}</b>}
            {x.moTa && <span style={{ ...phu, fontSize: 12 }}>{x.moTa}</span>}
          </div>
          {x.cta && <span style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{x.cta}</span>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px 12px', fontSize: 13 }}>
        {([['Nền tảng', `${NEN_TANG_QC[x.nenTang] ?? x.nenTang}${x.dinhDang ? ` · ${DINH_DANG_QC[x.dinhDang] ?? x.dinhDang}` : ''}`],
          ['Trạng thái', x.dangChay == null ? 'chưa rõ' : x.dangChay ? 'đang chạy' : 'đã dừng'], ['Chạy từ', x.batDau], ['Đã chạy', ngay == null ? null : `${ngay} ngày`],
          ['Phiên bản', x.soPhienBan ? `${x.soPhienBan} phiên bản cùng nội dung` : null], ['Góc bán', x.goc], ['Ưu đãi', x.uuDai], ['Nút', x.cta],
          ['Ghi chú', x.ghiChu], ['Xem lúc', x.luc ? gio(x.luc) : null]] as [string, string | null][])
          .map(([k, v]) => <span key={k} style={{ display: 'contents' }}><span style={phu}>{k}</span><span>{v ?? '—'}</span></span>)}
        <span style={phu}>Trang đích</span><span>{x.landing ? <LinkChip href={x.landing} tone="neutral" size="xs">{host(x.landing)} ↗</LinkChip> : '—'}</span>
        <span style={phu}>Thư viện QC</span><span><LinkChip href={x.link} tone="neutral" size="xs">mở quảng cáo này ↗</LinkChip></span>
      </div>
    </div>
  );
}

export function BangDoiThu({ ds, sanPham, bienThe, ch }: { ds: DoiThuDong[]; sanPham: SanPhamDong[]; bienThe: BienTheDong[]; ch: string }) {
  const modal = useModalParam('dt');
  const [cay, setCay] = useShallowParam('dtv', 'sp');
  const [mo, setMo] = useState<Set<string>>(new Set());
  const doi = (k: string) => setMo((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const sps = sanPham.filter((p) => ch === 'all' || p.cuaHang === ch);
  const idSp = new Set(sps.map((p) => p.id));
  // đối thủ trong phạm vi: có sản phẩm nối với sản phẩm của shop đang lọc (Mọi cửa hàng: tất cả)
  const dsCh = ds.filter((d) => ch === 'all' || d.sp.some((s) => s.sanPhamId != null && idSp.has(s.sanPhamId)));
  const giaMinh = useMemo(() => { const m = new Map<number, number>(); for (const b of bienThe) if (b.giaBan != null) m.set(b.sanPhamId, Math.min(m.get(b.sanPhamId) ?? Infinity, b.giaBan)); return m; }, [bienThe]);
  const theoSp = useMemo(() => { const m = new Map<number, { d: DoiThuDong; s: SpDoiThu }[]>(); for (const d of dsCh) for (const s of d.sp) if (s.sanPhamId != null) m.set(s.sanPhamId, [...(m.get(s.sanPhamId) ?? []), { d, s }]); return m; }, [dsCh]);
  const chuaNoi = dsCh.flatMap((d) => d.sp.filter((s) => s.sanPhamId == null).map((s) => ({ d, s })));
  const qcDangChay = dsCh.flatMap((d) => d.qc).filter((x) => x.dangChay).length;
  const tenSp = (id: number | null) => sanPham.find((p) => p.id === id)?.ten ?? null;

  return (<>
    <div style={{ marginBottom: 10 }}>
      <StatsStrip minColWidth={150} cards={[
        { key: 'dt', label: 'Đối thủ theo dõi', value: dsCh.filter((d) => d.theoDoi).length, sub: `${dsCh.filter((d) => d.kenhBan === 'dtc').length} web riêng · ${dsCh.filter((d) => d.kenhBan !== 'dtc').length} trên chợ` },
        { key: 'sp', label: 'Sản phẩm đối thủ', value: dsCh.reduce((t, d) => t + d.sp.length, 0), sub: `${dsCh.flatMap((d) => d.sp).filter((s) => s.khop === 'dung_mau').length} cùng mẫu (đã so ảnh)` },
        { key: 'qc', label: 'Quảng cáo đang chạy', value: qcDangChay, sub: `${dsCh.reduce((t, d) => t + d.qc.length, 0)} đã ghi · ${dsCh.filter((d) => linkThuVienQc(d.fbPageId)).length} có Thư viện QC` },
        { key: 'kp', label: 'Sản phẩm chưa có đối thủ', value: sps.filter((p) => !theoSp.has(p.id)).length, color: sps.some((p) => !theoSp.has(p.id)) ? 'var(--warn)' : undefined, sub: `trên ${sps.length} sản phẩm` },
      ]} />
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
      <FilterChips urlKey="dtv" value={cay} onChange={setCay} options={[{ value: 'sp', label: 'Theo sản phẩm của mình' }, { value: 'dt', label: 'Theo đối thủ' }, { value: 'goc', label: 'Theo góc quảng cáo', title: 'Sản phẩm mình → góc bán → quảng cáo của đối thủ: nhìn ra góc nào nhiều người chạy, góc nào còn trống' }]} />
      <span style={{ flex: 1 }} />
      <button className="btn" onClick={() => modal.open('doi-thu', 'moi')}>+ Đối thủ</button>
    </div>

    {cay === 'sp' && <Panel pad={0}><Cay label="Đối thủ theo sản phẩm của mình">
      {sps.map((p) => {
        const ls = theoSp.get(p.id) ?? [], gm = giaMinh.get(p.id) ?? null, k = `p${p.id}`;
        const gia = ls.map((x) => x.s.gia).filter((x): x is number => x != null);
        const qcs = ls.flatMap((x) => x.d.qc.filter((q) => q.spId === x.s.id));
        // QC đang chạy của mọi đối thủ đụng sản phẩm này (kể cả QC chưa gắn trang cụ thể của họ)
        const tongQc = dsCh.filter((d) => ls.some((x) => x.d.id === d.id)).reduce((t, d) => t + d.qc.filter((q) => q.dangChay).length, 0);
        return (
          <NutCay key={k} mo={mo.has(k)} onDoi={ls.length ? () => doi(k) : undefined}
            dau={p.anh ? <img src={p.anh} alt="" width={40} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} /> : <span style={{ width: 40 }} />}
            ten={<><b style={{ fontSize: 14 }}>{p.ten}</b><span style={phu}>giá mình {tien(gm)}</span>
              {!ls.length && <Pill color="var(--warn)" label="chưa có đối thủ" uppercase={false} mono={false} />}
              {tongQc > 0 && <Pill color="var(--accent)" label={`${tongQc} QC đối thủ đang chạy`} uppercase={false} mono={false} />}</>}
            phu={ls.length ? <>{new Set(ls.map((x) => x.d.id)).size} đối thủ · {ls.length} trang · giá đối thủ {gia.length ? `${tien(Math.min(...gia))}${Math.max(...gia) !== Math.min(...gia) ? `–${tien(Math.max(...gia))}` : ''}` : '—'} · {ls.filter((x) => x.s.khop === 'dung_mau').length} cùng mẫu</> : <>{p.cuaHang}</>}>
            {ls.length > 0 && ls.map(({ d, s }) => {
              const qs = d.qc.filter((q) => q.spId === s.id);
              return (
                <NutCay key={s.id} mo={mo.has(`s${s.id}`)} onDoi={qs.length ? () => doi(`s${s.id}`) : undefined} mo_nhat={!d.theoDoi}
                  ten={<><b style={{ fontWeight: 500 }}>{d.ten}</b><span style={phu}>›</span><span>{s.ten ?? host(s.url)}</span><PillKhop k={s.khop} /></>}
                  phu={<><SoGia gia={s.gia} cuaMinh={gm} />{s.giaGoc ? <span style={phu}> · gạch {tien(s.giaGoc)}</span> : null}<span style={phu}> · {KENH_BAN[d.kenhBan] ?? d.kenhBan}{qs.length ? ` · ${qs.length} QC` : ''}{s.ghiChu ? ` · ${s.ghiChu}` : ''}</span></>}
                  phai={<><LinkChip href={s.url} tone="neutral" size="xs">trang đích ↗</LinkChip><button className="btn ghost" onClick={() => modal.open('sp', s.id)}>Sửa</button></>}>
                  {qs.length > 0 && <BangQc ds={qs.map((x) => ({ x }))} sua={(id) => modal.open('qc', id)} />}
                </NutCay>
              );
            })}
          </NutCay>
        );
      })}
      {chuaNoi.length > 0 && <NutCay mo={mo.has('chua')} onDoi={() => doi('chua')} ten={<b>Chưa nối sản phẩm của mình</b>} phu={`${chuaNoi.length} trang đối thủ — mở để nối`}>
        {chuaNoi.map(({ d, s }) => <NutCay key={s.id} onChon={() => modal.open('sp', s.id)} ten={<><b style={{ fontWeight: 500 }}>{d.ten}</b><span style={phu}>›</span><span>{s.ten ?? host(s.url)}</span></>}
          phu={<SoGia gia={s.gia} cuaMinh={null} />} phai={<LinkChip href={s.url} tone="neutral" size="xs">trang đích ↗</LinkChip>} />)}
      </NutCay>}
    </Cay></Panel>}

    {cay === 'dt' && <Panel pad={0}><Cay label="Đối thủ">
      {!dsCh.length && <div style={{ padding: 14, ...phu }}>Chưa có đối thủ nào{ch !== 'all' ? ' cho cửa hàng này' : ''}.</div>}
      {dsCh.map((d) => {
        const k = `d${d.id}`, tv = linkThuVienQc(d.fbPageId);
        const qcLe = d.qc.filter((q) => q.spId == null || !d.sp.some((s) => s.id === q.spId));
        return (
          <NutCay key={k} mo={mo.has(k)} onDoi={() => doi(k)} mo_nhat={!d.theoDoi}
            ten={<><b style={{ fontSize: 14 }}>{d.ten}</b><Pill color="var(--fg-2)" label={KENH_BAN[d.kenhBan] ?? d.kenhBan} uppercase={false} mono={false} />
              {!d.theoDoi && <Pill color="var(--fg-3)" label="thôi theo dõi" uppercase={false} mono={false} />}
              {d.qc.some((q) => q.dangChay) && <Pill color="var(--accent)" label={`${d.qc.filter((q) => q.dangChay).length} QC đang chạy`} uppercase={false} mono={false} />}</>}
            phu={<>{d.sp.length} sản phẩm · {d.qc.length} quảng cáo · đụng: {[...new Set(d.sp.map((s) => tenSp(s.sanPhamId)).filter(Boolean))].join(', ') || '—'}{d.nguonTim ? ` · tìm qua: ${d.nguonTim}` : ''} · cập nhật {gio(d.capNhat)}</>}
            phai={<>
              {d.website && <LinkChip href={d.website} tone="neutral" size="xs">{host(d.website)} ↗</LinkChip>}
              {d.fbPageUrl && <LinkChip href={d.fbPageUrl} tone="neutral" size="xs">Page ↗</LinkChip>}
              {tv && <LinkChip href={tv} tone="neutral" size="xs">Thư viện QC ↗</LinkChip>}
              {d.tiktok && <LinkChip href={d.tiktok} tone="neutral" size="xs">TikTok ↗</LinkChip>}
              <button className="btn ghost" onClick={() => modal.open('doi-thu', d.id)}>Sửa</button>
            </>}>
            {d.ghiChu && <NutCay ten={<span style={{ ...phu, fontSize: 12.5 }}>{d.ghiChu}</span>} />}
            {d.sp.map((s) => {
              const qs = d.qc.filter((q) => q.spId === s.id);
              return (
                <NutCay key={s.id} mo={mo.has(`s${s.id}`)} onDoi={qs.length ? () => doi(`s${s.id}`) : undefined}
                  ten={<><span>{s.ten ?? host(s.url)}</span><PillKhop k={s.khop} /></>}
                  phu={<><SoGia gia={s.gia} cuaMinh={s.sanPhamId != null ? giaMinh.get(s.sanPhamId) ?? null : null} /><span style={phu}> · {s.sanPhamId != null ? `đụng ${tenSp(s.sanPhamId)}` : 'chưa nối sản phẩm mình'}{qs.length ? ` · ${qs.length} QC` : ''}</span></>}
                  phai={<><LinkChip href={s.url} tone="neutral" size="xs">trang đích ↗</LinkChip><button className="btn ghost" onClick={() => modal.open('sp', s.id)}>Sửa</button></>}>
                  {qs.length > 0 && <BangQc ds={qs.map((x) => ({ x }))} sua={(id) => modal.open('qc', id)} />}
                </NutCay>
              );
            })}
            {qcLe.length > 0 && <NutCay ten={<span style={{ ...phu, fontSize: 12.5 }}>{qcLe.length} quảng cáo chưa gắn sản phẩm cụ thể của họ</span>}><BangQc ds={qcLe.map((x) => ({ x }))} sua={(id) => modal.open('qc', id)} /></NutCay>}
            <NutCay ten={<span style={{ display: 'flex', gap: 6 }}>
              <button className="btn ghost" onClick={() => modal.open('sp', `moi-${d.id}`)}>+ Sản phẩm của họ</button>
              <button className="btn ghost" onClick={() => modal.open('qc', `moi-${d.id}`)}>+ Quảng cáo</button></span>} />
          </NutCay>
        );
      })}
    </Cay></Panel>}

    {cay === 'goc' && <Panel pad={0}><Cay label="Quảng cáo đối thủ theo góc">
      {sps.map((p) => {
        // QC gắn sản phẩm của mình qua sản phẩm của đối thủ; QC chưa gắn sản phẩm của họ thì tính cho mọi sản phẩm mình mà đối thủ đó đụng
        const qcs = dsCh.flatMap((d) => d.qc.filter((q) => {
          const s2 = d.sp.find((x) => x.id === q.spId);
          return s2 ? s2.sanPhamId === p.id : d.sp.some((x) => x.sanPhamId === p.id);
        }).map((q) => ({ d, q })));
        const nhom = new Map<string, typeof qcs>();
        for (const x of qcs) { const g = x.q.goc?.trim() || 'chưa ghi góc'; nhom.set(g, [...(nhom.get(g) ?? []), x]); }
        const k = `g${p.id}`;
        return (
          <NutCay key={k} mo={mo.has(k)} onDoi={qcs.length ? () => doi(k) : undefined}
            dau={p.anh ? <img src={p.anh} alt="" width={40} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} /> : <span style={{ width: 40 }} />}
            ten={<><b style={{ fontSize: 14 }}>{p.ten}</b>{!qcs.length && <Pill color="var(--warn)" label="chưa có QC đối thủ" uppercase={false} mono={false} />}</>}
            phu={qcs.length ? <>{qcs.length} quảng cáo · {qcs.filter((x) => x.q.dangChay).length} đang chạy · {nhom.size} góc: {[...nhom.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 4).map(([g, v]) => `${g} (${v.length})`).join(', ')}</> : p.cuaHang}>
            {qcs.length > 0 && [...nhom.entries()].sort((a, b) => b[1].length - a[1].length).map(([g, v]) => (
              <NutCay key={g} mo={mo.has(`${k}:${g}`)} onDoi={() => doi(`${k}:${g}`)}
                ten={<><b>{g}</b><span style={phu}>{v.length} QC · {new Set(v.map((x) => x.d.id)).size} đối thủ · {v.filter((x) => x.q.dangChay).length} đang chạy</span>
                  {(() => { const n = Math.max(-1, ...v.map((x) => soNgayChay(x.q.batDau, x.q.dangChay, x.q.luc) ?? -1)); return n > 0 ? <span style={{ color: n >= 30 ? 'var(--ok)' : undefined, fontSize: 12.5 }}>QC lâu nhất {n} ngày</span> : null; })()}</>}
                phu={[...new Set(v.map((x) => x.q.dinhDang).filter(Boolean))].map((x) => DINH_DANG_QC[x!] ?? x).join(' · ') || undefined}>
                <BangQc anGoc ds={v.map(({ d, q }) => ({ x: q, tenDt: d.ten }))} sua={(id) => modal.open('qc', id)} />
              </NutCay>
            ))}
          </NutCay>
        );
      })}
    </Cay></Panel>}

    {modal.value && <DrawerDoiThu loai={modal.value} id={modal.id} ds={ds} sanPham={sanPham} onClose={() => modal.close()} />}
  </>);
}

/** Một drawer cho ba loại bản ghi (đối thủ · sản phẩm của họ · quảng cáo). id = số (sửa) | 'moi' | 'moi-<id đối thủ>' (thêm). */
function DrawerDoiThu({ loai, id, ds, sanPham, onClose }: { loai: string; id: string | null; ds: DoiThuDong[]; sanPham: SanPhamDong[]; onClose: () => void }) {
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const moi = !id || id.startsWith('moi');
  const cha = id?.startsWith('moi-') ? Number(id.slice(4)) : null;
  const nId = moi ? null : Number(id);
  const d = loai === 'doi-thu' && nId ? ds.find((x) => x.id === nId) : null;
  const s = loai === 'sp' && nId ? ds.flatMap((x) => x.sp.map((y) => ({ ...y, doiThuId: x.id }))).find((y) => y.id === nId) : null;
  const q = loai === 'qc' && nId ? ds.flatMap((x) => x.qc.map((y) => ({ ...y, doiThuId: x.id }))).find((y) => y.id === nId) : null;
  const doiThuId = cha ?? s?.doiThuId ?? q?.doiThuId ?? null;
  const chu = doiThuId ? ds.find((x) => x.id === doiThuId) : null;
  const luu = (f: () => Promise<{ ok: boolean; loi?: string }>) => batDau(async () => { setLoi(null); const r = await f().catch((e) => ({ ok: false, loi: (e as Error).message })); if (r.ok) onClose(); else setLoi(r.loi ?? 'lỗi'); });

  const [vd, setVd] = useState({ ten: d?.ten ?? '', website: d?.website ?? '', kenhBan: d?.kenhBan ?? 'dtc', fbPageUrl: d?.fbPageUrl ?? '', fbPageId: d?.fbPageId ?? '', tiktok: d?.tiktok ?? '', nguonTim: d?.nguonTim ?? '', ghiChu: d?.ghiChu ?? '', theoDoi: d?.theoDoi ?? true });
  const [vs, setVs] = useState({ doiThuId: doiThuId ?? ds[0]?.id ?? 0, sanPhamId: s?.sanPhamId ?? null as number | null, ten: s?.ten ?? '', url: s?.url ?? '', gia: s?.gia?.toString() ?? '', giaGoc: s?.giaGoc?.toString() ?? '', khop: s?.khop ?? 'chua_xac_nhan', ghiChu: s?.ghiChu ?? '' });
  const [vq, setVq] = useState({ spId: q?.spId ?? null as number | null, nenTang: q?.nenTang ?? 'meta', link: q?.link ?? '', hook: q?.hook ?? '', landing: q?.landing ?? '', batDau: q?.batDau ?? '', dangChay: q?.dangChay ?? true as boolean | null, ghiChu: q?.ghiChu ?? '',
    tieuDe: q?.tieuDe ?? '', cta: q?.cta ?? '', dinhDang: q?.dinhDang ?? '', goc: q?.goc ?? '', uuDai: q?.uuDai ?? '', media: q?.media ?? '' });
  const so = (x: string) => (x.trim() === '' ? null : Number(x));
  const tieuDe = loai === 'doi-thu' ? (moi ? 'Thêm đối thủ' : `Đối thủ · ${d?.ten ?? ''}`) : loai === 'sp' ? `${moi ? 'Thêm' : 'Sửa'} sản phẩm của ${chu?.ten ?? 'đối thủ'}` : `${moi ? 'Thêm' : 'Sửa'} quảng cáo của ${chu?.ten ?? 'đối thủ'}`;

  return (
    <Drawer onClose={onClose} width={620}>
      <div style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{tieuDe}</h2>
        {loai === 'doi-thu' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 10 }}>
            <TextField id="dt-ten" label="Tên (brand / cửa hàng)" value={vd.ten} onChange={(e) => setVd({ ...vd, ten: e.target.value })} />
            <PickField label="Bán ở" value={vd.kenhBan} options={Object.entries(KENH_BAN).map(([k, t]) => ({ value: k, label: t }))} onChange={(k) => k && setVd({ ...vd, kenhBan: k })} />
          </div>
          <TextField id="dt-web" label="Website" placeholder="https://…" value={vd.website} onChange={(e) => setVd({ ...vd, website: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10 }}>
            <TextField id="dt-fb" label="Facebook Page" placeholder="https://www.facebook.com/…" value={vd.fbPageUrl} onChange={(e) => setVd({ ...vd, fbPageUrl: e.target.value })} />
            <TextField id="dt-fbid" label="Page ID" mono hint="Có thì hiện link Thư viện QC" value={vd.fbPageId} onChange={(e) => setVd({ ...vd, fbPageId: e.target.value })} />
          </div>
          <TextField id="dt-tt" label="TikTok" placeholder="https://www.tiktok.com/@…" value={vd.tiktok} onChange={(e) => setVd({ ...vd, tiktok: e.target.value })} />
          <TextField id="dt-ng" label="Tìm ra bằng cách nào" value={vd.nguonTim} onChange={(e) => setVd({ ...vd, nguonTim: e.target.value })} />
          <TextAreaField id="dt-gc" label="Ghi chú (góc bán, điểm mạnh/yếu)" rows={3} value={vd.ghiChu} onChange={(e) => setVd({ ...vd, ghiChu: e.target.value })} />
          {!moi && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={vd.theoDoi} onChange={(e) => setVd({ ...vd, theoDoi: e.target.checked })} /> Đang theo dõi</label>}
          <div><button className="btn primary" disabled={dang} onClick={() => luu(() => shopSuaDoiThu(nId, vd))}>{dang ? 'Đang lưu…' : 'Lưu'}</button></div>
        </>}
        {loai === 'sp' && <>
          {!chu && <PickField label="Đối thủ" value={vs.doiThuId} options={ds.map((x) => ({ value: x.id, label: x.ten }))} onChange={(k) => k && setVs({ ...vs, doiThuId: k })} />}
          <TextField id="dts-url" label="Trang sản phẩm / trang đích của họ" placeholder="https://…" value={vs.url} onChange={(e) => setVs({ ...vs, url: e.target.value })} />
          <TextField id="dts-ten" label="Tên sản phẩm của họ" value={vs.ten} onChange={(e) => setVs({ ...vs, ten: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 10 }}>
            <PickField label="Đụng sản phẩm nào của mình" value={vs.sanPhamId} placeholder="— chưa nối —" clearable
              options={sanPham.map((p) => ({ value: p.id, label: `${p.cuaHang} · ${p.ten}` }))} onChange={(k) => setVs({ ...vs, sanPhamId: k ?? null })} />
            <TextField id="dts-gia" label="Giá (USD)" inputMode="decimal" value={vs.gia} onChange={(e) => setVs({ ...vs, gia: e.target.value })} />
            <TextField id="dts-goc" label="Giá gạch" inputMode="decimal" value={vs.giaGoc} onChange={(e) => setVs({ ...vs, giaGoc: e.target.value })} />
          </div>
          <SelectField id="dts-khop" label="Mức khớp" value={vs.khop} onChange={(e) => setVs({ ...vs, khop: e.target.value })}>
            {Object.entries(KHOP_DOI_THU).map(([k, x]) => <option key={k} value={k}>{x[0]}</option>)}</SelectField>
          <TextAreaField id="dts-gc" label="Ghi chú (góc bán, ưu đãi, review…)" rows={3} value={vs.ghiChu} onChange={(e) => setVs({ ...vs, ghiChu: e.target.value })} />
          <div><button className="btn primary" disabled={dang} onClick={() => luu(() => shopSuaSpDoiThu(nId, { ...vs, gia: so(vs.gia), giaGoc: so(vs.giaGoc) }))}>{dang ? 'Đang lưu…' : 'Lưu'}</button></div>
        </>}
        {loai === 'qc' && doiThuId && <>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
            <SelectField id="dtq-nt" label="Nền tảng" value={vq.nenTang} onChange={(e) => setVq({ ...vq, nenTang: e.target.value })}>
              {Object.entries(NEN_TANG_QC).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</SelectField>
            <TextField id="dtq-link" label="Link quảng cáo / thư viện" placeholder="https://…" value={vq.link} onChange={(e) => setVq({ ...vq, link: e.target.value })} />
          </div>
          <TextAreaField id="dtq-hook" label="Câu mở đầu / tiêu đề (chép nguyên văn)" rows={3} value={vq.hook} onChange={(e) => setVq({ ...vq, hook: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 150px', gap: 10 }}>
            <TextField id="dtq-td" label="Tiêu đề (dưới media)" value={vq.tieuDe} onChange={(e) => setVq({ ...vq, tieuDe: e.target.value })} />
            <TextField id="dtq-cta" label="Nút CTA" placeholder="Shop Now" value={vq.cta} onChange={(e) => setVq({ ...vq, cta: e.target.value })} />
            <PickField label="Định dạng" value={vq.dinhDang} placeholder="—" clearable options={Object.entries(DINH_DANG_QC).map(([k, t]) => ({ value: k, label: t }))} onChange={(k) => setVq({ ...vq, dinhDang: k ?? '' })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <TextField id="dtq-goc" label="Góc bán" placeholder="giảm đau bunion · bác sĩ khuyên · khách 60+ kể…" value={vq.goc} onChange={(e) => setVq({ ...vq, goc: e.target.value })} />
            <TextField id="dtq-ud" label="Ưu đãi trên QC" placeholder="Buy 2 get 1 · 50% off" value={vq.uuDai} onChange={(e) => setVq({ ...vq, uuDai: e.target.value })} />
          </div>
          <TextField id="dtq-media" label="Media (link ảnh / video)" placeholder="https://…" value={vq.media} onChange={(e) => setVq({ ...vq, media: e.target.value })} />
          <TextField id="dtq-land" label="Trang đích quảng cáo trỏ tới" placeholder="https://…" value={vq.landing} onChange={(e) => setVq({ ...vq, landing: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px', gap: 10 }}>
            <PickField label="Đẩy sản phẩm nào của họ" value={vq.spId} placeholder="— chưa rõ —" clearable
              options={(chu?.sp ?? []).map((x) => ({ value: x.id, label: x.ten ?? host(x.url) }))} onChange={(k) => setVq({ ...vq, spId: k ?? null })} />
            <TextField id="dtq-ngay" label="Chạy từ" type="date" value={vq.batDau} onChange={(e) => setVq({ ...vq, batDau: e.target.value })} />
            <SelectField id="dtq-chay" label="Trạng thái" value={vq.dangChay == null ? '' : vq.dangChay ? '1' : '0'} onChange={(e) => setVq({ ...vq, dangChay: e.target.value === '' ? null : e.target.value === '1' })}>
              <option value="1">đang chạy</option><option value="0">đã dừng</option><option value="">chưa rõ</option></SelectField>
          </div>
          <TextAreaField id="dtq-gc" label="Ghi chú (góc, định dạng video/ảnh, ưu đãi)" rows={2} value={vq.ghiChu} onChange={(e) => setVq({ ...vq, ghiChu: e.target.value })} />
          <div><button className="btn primary" disabled={dang} onClick={() => luu(() => shopSuaQcDoiThu(nId, { ...vq, doiThuId }))}>{dang ? 'Đang lưu…' : 'Lưu'}</button></div>
        </>}
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
        <div><button className="btn ghost" onClick={onClose}>Đóng</button></div>
      </div>
    </Drawer>
  );
}
