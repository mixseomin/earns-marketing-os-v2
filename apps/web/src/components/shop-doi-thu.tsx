'use client';
// /shop › Đối thủ (anh chốt 02/10/2026): ai đang bán cùng/gần mẫu với sản phẩm của mình — trang đích, giá, quảng cáo họ đang chạy. Hai cây (ui/cay.tsx):
//   • Theo sản phẩm của mình: sản phẩm mình → sản phẩm đối thủ (giá so với mình, mức khớp, trang đích) → quảng cáo đẩy sản phẩm đó.
//   • Theo đối thủ: đối thủ (kênh bán, web, Thư viện QC Meta) → sản phẩm của họ → quảng cáo.
//   • Theo góc quảng cáo: sản phẩm mình → góc bán (giảm đau, bác sĩ khuyên, khuyến mãi…) → quảng cáo của các đối thủ — để soạn QC cho mình.
// Sổ: shop_doi_thu / shop_doi_thu_sp / shop_doi_thu_qc (migration 0206). Không xoá — thôi theo dõi bằng cờ.
// URL: ?dtv=sp|dt|goc (cây) · ?dt=<loại>&dtId=<id | moi-<cha>> (drawer).
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Cay, Drawer, FilterChips, LinkChip, NutCay, Panel, Pill, SelectField, StatsStrip, TextAreaField, TextField } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { DINH_DANG_QC, KENH_BAN, KHOP_DOI_THU, NEN_TANG_QC, gio, linkThuVienQc, tien } from '@/lib/shop/buoc';
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
/** Một quảng cáo đối thủ: media (ảnh/thumbnail thật) · định dạng · hook nguyên văn · headline · CTA · góc · ưu đãi · ngày chạy · trang đích. */
function DongQc({ x, sua, tenDt }: { x: QcDoiThu; sua: () => void; tenDt?: string }) {
  const anh = x.media && /\.(jpe?g|png|webp|gif)(\?|$)|fbcdn|scontent/i.test(x.media) ? x.media : null;
  return (
    <NutCay onChon={sua}
      dau={anh ? <img src={anh} alt="" width={56} height={56} loading="lazy" style={{ objectFit: 'cover', borderRadius: 4, flex: 'none', border: '1px solid var(--line)' }} /> : undefined}
      ten={<>{tenDt && <b style={{ fontWeight: 500 }}>{tenDt}</b>}<span style={{ ...phu, fontSize: 12 }}>{NEN_TANG_QC[x.nenTang] ?? x.nenTang}{x.dinhDang ? ` · ${DINH_DANG_QC[x.dinhDang] ?? x.dinhDang}` : ''}{x.soPhienBan ? ` · ${x.soPhienBan} phiên bản` : ''}</span>
        {x.hook ? <span style={{ fontStyle: 'italic' }}>“{x.hook.length > 160 ? `${x.hook.slice(0, 160)}…` : x.hook}”</span> : <span style={phu}>chưa chép nội dung</span>}
        {x.dangChay != null && <Pill color={x.dangChay ? 'var(--ok)' : 'var(--fg-3)'} label={x.dangChay ? 'đang chạy' : 'đã dừng'} uppercase={false} mono={false} />}
        {x.goc && <Pill color="var(--accent)" label={x.goc} uppercase={false} mono={false} />}
        {x.uuDai && <Pill color="var(--warn)" label={x.uuDai} uppercase={false} mono={false} />}</>}
      phu={<>{x.noiDung && x.noiDung !== x.hook && <details onClick={(e) => e.stopPropagation()} style={{ margin: '2px 0 4px' }}><summary style={{ cursor: 'pointer' }}>toàn văn ({x.noiDung.length} ký tự)</summary>
        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--fg-2)', fontSize: 12.5, lineHeight: 1.5, padding: '4px 0', maxWidth: 760 }}>{x.noiDung.replace(/ \/ /g, '\n')}</div></details>}
        {x.tieuDe ? <>tiêu đề “{x.tieuDe}”{x.moTa ? ` — ${x.moTa}` : ''} · </> : ''}{x.cta ? `nút ${x.cta} · ` : ''}{x.batDau ? `chạy từ ${x.batDau}` : 'chưa rõ ngày chạy'}{x.landing ? ` · trỏ tới ${host(x.landing)}` : ''}{x.ghiChu ? ` · ${x.ghiChu}` : ''}{x.luc ? ` · xem ${gio(x.luc)}` : ''}</>}
      phai={<>{x.media && !anh && <LinkChip href={x.media} tone="neutral" size="xs">media ↗</LinkChip>}{x.landing && <LinkChip href={x.landing} tone="neutral" size="xs">trang đích ↗</LinkChip>}<LinkChip href={x.link} tone="neutral" size="xs">xem QC ↗</LinkChip></>} />
  );
}

export function BangDoiThu({ ds, sanPham, bienThe, ch }: { ds: DoiThuDong[]; sanPham: SanPhamDong[]; bienThe: BienTheDong[]; ch: string }) {
  const modal = useModalParam('dt');
  const [cay, setCay] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dtv')) || 'sp');
  useEffect(() => { const u = new URLSearchParams(window.location.search); if (cay !== 'sp') u.set('dtv', cay); else u.delete('dtv'); window.history.replaceState(window.history.state, '', `${window.location.pathname}?${u.toString()}`); }, [cay]);
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
                  {qs.length > 0 && qs.map((x) => <DongQc key={x.id} x={x} sua={() => modal.open('qc', x.id)} />)}
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
                  {qs.length > 0 && qs.map((x) => <DongQc key={x.id} x={x} sua={() => modal.open('qc', x.id)} />)}
                </NutCay>
              );
            })}
            {qcLe.map((x) => <DongQc key={x.id} x={x} sua={() => modal.open('qc', x.id)} />)}
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
                ten={<><b>{g}</b><span style={phu}>{v.length} QC · {new Set(v.map((x) => x.d.id)).size} đối thủ · {v.filter((x) => x.q.dangChay).length} đang chạy</span></>}
                phu={[...new Set(v.map((x) => x.q.dinhDang).filter(Boolean))].map((x) => DINH_DANG_QC[x!] ?? x).join(' · ') || undefined}>
                {v.map(({ d, q }) => <DongQc key={q.id} x={q} tenDt={d.ten} sua={() => modal.open('qc', q.id)} />)}
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
            <SelectField id="dt-kenh" label="Bán ở" value={vd.kenhBan} onChange={(e) => setVd({ ...vd, kenhBan: e.target.value })}>
              {Object.entries(KENH_BAN).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</SelectField>
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
          {!chu && <SelectField id="dts-dt" label="Đối thủ" value={String(vs.doiThuId)} onChange={(e) => setVs({ ...vs, doiThuId: Number(e.target.value) })}>
            {ds.map((x) => <option key={x.id} value={x.id}>{x.ten}</option>)}</SelectField>}
          <TextField id="dts-url" label="Trang sản phẩm / trang đích của họ" placeholder="https://…" value={vs.url} onChange={(e) => setVs({ ...vs, url: e.target.value })} />
          <TextField id="dts-ten" label="Tên sản phẩm của họ" value={vs.ten} onChange={(e) => setVs({ ...vs, ten: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 10 }}>
            <SelectField id="dts-sp" label="Đụng sản phẩm nào của mình" value={vs.sanPhamId == null ? '' : String(vs.sanPhamId)} onChange={(e) => setVs({ ...vs, sanPhamId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— chưa nối —</option>{sanPham.map((p) => <option key={p.id} value={p.id}>{p.cuaHang} · {p.ten}</option>)}</SelectField>
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
            <SelectField id="dtq-dd" label="Định dạng" value={vq.dinhDang} onChange={(e) => setVq({ ...vq, dinhDang: e.target.value })}>
              <option value="">—</option>{Object.entries(DINH_DANG_QC).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</SelectField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <TextField id="dtq-goc" label="Góc bán" placeholder="giảm đau bunion · bác sĩ khuyên · khách 60+ kể…" value={vq.goc} onChange={(e) => setVq({ ...vq, goc: e.target.value })} />
            <TextField id="dtq-ud" label="Ưu đãi trên QC" placeholder="Buy 2 get 1 · 50% off" value={vq.uuDai} onChange={(e) => setVq({ ...vq, uuDai: e.target.value })} />
          </div>
          <TextField id="dtq-media" label="Media (link ảnh / video)" placeholder="https://…" value={vq.media} onChange={(e) => setVq({ ...vq, media: e.target.value })} />
          <TextField id="dtq-land" label="Trang đích quảng cáo trỏ tới" placeholder="https://…" value={vq.landing} onChange={(e) => setVq({ ...vq, landing: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px', gap: 10 }}>
            <SelectField id="dtq-sp" label="Đẩy sản phẩm nào của họ" value={vq.spId == null ? '' : String(vq.spId)} onChange={(e) => setVq({ ...vq, spId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— chưa rõ —</option>{(chu?.sp ?? []).map((x) => <option key={x.id} value={x.id}>{x.ten ?? host(x.url)}</option>)}</SelectField>
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
