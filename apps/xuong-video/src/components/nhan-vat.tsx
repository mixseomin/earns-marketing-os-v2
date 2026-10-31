'use client';
// Mục 2 tuyến nhân vật: anchor, ảnh gốc, biến thể, giọng cố định của từng nhân vật.
import { AnhDaiDien } from './anh-set-3d';
import { useEffect, useState } from 'react';
import { Ngan } from './ngan';
import { SoLienMachXem } from './so-lien-mach-ui';
import { moNgan } from './ngan-chung';
import { ImageAttach } from './image-attach';
import { GIONG, moHinhAm } from '@/lib/xuong-video/am-thanh';
import { luuNhanVat, xoaNhanVat, sinhAnhMau, taiAnhLen, datAnhChinh, dsGiongModel, dsGiongCua, chonGiong, ngheThuGiong, xoaAnhGoc, xoaAnhBienThe, goiYAIAnchor, goiYAIBoAnchor, luuBienThe, xoaBienThe, goiYAIBienThe, sinhAnhBienThe, doiChieuAnchor, mocBienThe } from '@/lib/actions';
import { LOAI_NHAN_VAT, NHOM_BIEN_THE, docKinhThanh, giaAnhCents, tien, gioVN, type NhanVat, type BienThe, type KinhThanh, type LoaiNhanVat } from '@/lib/xuong-video/kieu';
import { Chon } from './chon';
import { Khoa, O, Pill, Seg, Nut, Xoa, Loi, AnhNho, DangSinh, Menu, MucMenu, mono, goiAction } from './ui';
import { useNho } from './nho';
import { NutNghe } from './media';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { nhomCayAnchor } from '@/lib/xuong-video/cay-anchor';

/** Số góc một lượt sinh ảnh gốc anchor (#1351): ảnh chính + góc phụ ngay từ đầu, không phải bấm lần lượt từng góc. */
const BO_GOC = 3;

/** Nhóm biến thể LOOK-BOOK (bề ngoài nhân vật) — có thể khác nhau theo tập (trang phục theo tập). Khớp KHOA_LOOK ở bo-set-3d.ts (giữ cạnh client, không kéo server-only). */
const LOOK_NHOM = new Set(['trang_phuc', 'toc', 'trang_diem', 'do_deo', 'vet', 'trang']);
/** "1,3" → [1,3]; trống → [] (mọi tập). */
const parseTap = (s: string): number[] => s.split(/[,\s]+/).map(Number).filter((x) => Number.isInteger(x) && x > 0);

/** Giọng cố định của một nhân vật (cả bộ phim): chọn model (ElevenLabs tài khoản anh / mọi TTS fal) + giọng, nghe thử. */
export function GiongNhanVat({ v, onChanged }: { v: NhanVat; onChanged: () => Promise<void> }) {
  const [mo, setMo] = useState(false);
  const [dsM, setDsM] = useState<Awaited<ReturnType<typeof dsGiongModel>>>([]);
  const [model, setModel] = useState(v.giong_model);
  const [voice, setVoice] = useState(v.giong_id);
  const [dsG, setDsG] = useState<{ id: string; ten: string }[] | null>(null);
  const [ban, setBan] = useState(''); const [loi, setLoi] = useState('');
  useEffect(() => { if (mo && !dsM.length) void dsGiongModel().then((d) => { setDsM(d); if (!model && d[0]) setModel(d[0].key); }); }, [mo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!mo || !model) return; setDsG(null); void dsGiongCua(model).then(setDsG); }, [mo, model]);
  const giaM = (m: (typeof dsM)[number]) => (m.giaCents == null ? (m.key.startsWith('elevenlabs:') ? 'trong gói' : 'chưa có giá') : `${tien(m.giaCents)}${m.donVi === '1k_ky_tu' ? '/1k ký tự' : m.donVi === 'giay' ? '/giây' : m.donVi === 'luot' ? '/lượt' : ''}`);
  const moTa = (id: string) => Object.values(GIONG).flat().find((g) => g.id === id)?.ta;
  const tenModel = dsM.find((m) => m.key === v.giong_model)?.ten ?? v.giong_model.split('/').slice(-2).join('/');
  return (
    <>
      <button type="button" className="xv-btn" onClick={() => setMo(true)} title={v.giong ? `Mô tả giọng: ${v.giong}` : 'Chọn giọng cố định cho nhân vật'}>🗣 {v.giong_id ? `${v.giong_id}` : 'Chọn giọng'}</button>
      {mo && (
        <Ngan nho onClose={() => setMo(false)} tieuDe={`🗣 Giọng của ${v.ten}`}>
          <div style={{ ...mono, marginBottom: 10 }}>Một giọng cố định cho cả bộ phim: mọi shot {v.ten} nói đều đọc bằng giọng này, cảm xúc đổi theo từng shot.{v.giong ? ` Mô tả giọng đã ghi: “${v.giong}”.` : ''}{v.giong_model ? ` Đang dùng: ${tenModel} · ${v.giong_id}.` : ''}</div>
          <O label="Model giọng"><Chon value={model} onChange={(x) => { setModel(x); setVoice(''); }} minWidth={300} options={dsM.map((m) => ({ value: m.key, label: m.ten, nhom: m.nhom, phu: giaM(m), title: m.giaText }))} placeholder={dsM.length ? 'chọn…' : 'đang tải danh mục…'} /></O>
          <O label="Giọng" hint={dsG && !dsG.length ? 'model này không công bố danh sách giọng — gõ tên/id giọng nếu biết, để trống = giọng mặc định của model' : undefined}>
            {dsG && !dsG.length
              ? <input className="xv-in" value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="tên / id giọng" />
              : <Chon value={voice} onChange={setVoice} minWidth={300} options={(dsG ?? []).map((g) => ({ value: g.id, label: g.ten, phu: moTa(g.id) }))} placeholder={dsG ? 'chọn giọng…' : 'đang tải giọng…'} />}
          </O>
          <Loi>{loi}</Loi>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Nut chinh ly={!model && 'chọn model'} ban={ban === 'luu'} onClick={async () => { setBan('luu'); setLoi(''); const r = await chonGiong(v.id, model, voice); setBan(''); if (!r.ok) { setLoi(r.loi); return; } await onChanged(); }}>Lưu giọng</Nut>
            <Nut ly={(!v.giong_model && 'lưu giọng trước') || ((v.giong_model !== model || v.giong_id !== voice) && 'lưu giọng vừa chọn trước')} ban={ban === 'nghe'} title="Sinh một câu chào ngắn bằng giọng này (~$0.01)" onClick={async () => { setBan('nghe'); setLoi(''); const r = await ngheThuGiong(v.id); setBan(''); if (!r.ok) { setLoi(r.loi); return; } await onChanged(); }}>🎧 Nghe thử</Nut>
            {v.giong_mau_url && <NutNghe url={v.giong_mau_url} nhan="giọng mẫu" />}
          </div>
          {!!v.giong_thu?.length && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...mono, marginBottom: 6 }}>Giọng đã thử ({v.giong_thu.length}) — nghe lại, bấm Dùng để đặt làm giọng của {v.ten}, không sinh lại</div>
              {v.giong_thu.map((g) => {
                const khoa = `${g.model}|${g.voice}`; const dang = g.model === v.giong_model && g.voice === v.giong_id;
                return (
                  <div key={khoa} title={g.cau} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--line)' }}>
                    <NutNghe url={g.url} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b style={{ fontSize: 13 }}>{g.voice}</b> <span style={mono}>{dsM.find((m) => m.key === g.model)?.ten ?? moHinhAm(g.model)?.ten ?? g.model.split('/').slice(-2).join('/')}</span></span>
                    {dang ? <span style={mono}>✓ đang dùng</span>
                      : <Nut ban={ban === khoa} onClick={async () => { setBan(khoa); setLoi(''); const r = await chonGiong(v.id, g.model, g.voice); setBan(''); if (!r.ok) { setLoi(r.loi); return; } setModel(g.model); setVoice(g.voice); await onChanged(); }}>Dùng</Nut>}
                  </div>
                );
              })}
            </div>
          )}
        </Ngan>
      )}
    </>
  );
}

/** chiTiet: CÂY PHIM (tab 📖 Phim) đã liệt kê anchor ở cây trái → mục này chỉ hiện đầu mục + khung chi tiết của anchor đó, không vẽ cây thứ hai. */
export function NhanVatSection({ phimId, nhanVat, kinhThanh, khoa, dangSinh, loiAnh, onChanged, chiTiet }: { chiTiet?: number | null; phimId: number; nhanVat: NhanVat[]; kinhThanh: KinhThanh; khoa: Khoa; dangSinh: { nhanVat: number[]; bienThe: number[] }; loiAnh: { nhanVat: Record<number, string>; bienThe: Record<number, string> }; onChanged: () => Promise<void> }) {
  const [sua, setSua] = useState<Partial<NhanVat> | null>(null);
  const [btMo, setBtMo] = useState<number | null>(null);
  const [ban, setBan] = useState<number | null>(null);
  const [loi, setLoi] = useState<Record<number, string>>({});
  const kt = docKinhThanh(kinhThanh);
  // #1406: lọc nhỏ theo loại anchor — nhãn chỉ ghi tên, số đếm vào hover; nhớ trên URL (nvl).
  const coLoai = LOAI_NHAN_VAT.filter((l) => nhanVat.some((v) => v.loai === l.key));
  const [locLoai, setLocLoai] = useNho<'' | LoaiNhanVat>('xv-nv-loai', '', ['', ...LOAI_NHAN_VAT.map((l) => l.key)], 'nvl');
  const dsHien = locLoai && coLoai.some((l) => l.key === locLoai) ? nhanVat.filter((v) => v.loai === locLoai) : nhanVat;
  // Lọc bảng theo TẬP: các tập có bộ đồ riêng (suy từ dung_tap của biến thể, khỏi cần danh sách tập); chọn tập → look-book chỉ hiện đồ hợp tập đó (+ đồ mọi tập).
  const tapCo = [...new Set(nhanVat.flatMap((v) => (v.bien_the ?? []).flatMap((b) => b.dung_tap ?? [])))].sort((x, y) => x - y);
  const [locTap, setLocTap] = useState<number | null>(null);
  const hopTapHien = (b: BienThe) => locTap == null || !b.dung_tap?.length || b.dung_tap.includes(locTap);
  // Mốc xuất hiện của từng biến thể (shot đầu + tập + số shot) — để hiện "vết cafe · tập 1 · 📍từ #N" ngay trên bàn Thiết kế sản xuất.
  const [moc, setMoc] = useState<Record<number, { tap_so: number; thu_tu: number; canh: string; so_shot: number; cac_tap: number[] }>>({});
  useEffect(() => { let s = true; void mocBienThe(phimId).then((m) => { if (s) setMoc(m); }); return () => { s = false; }; }, [phimId, nhanVat]);
  // Bấm là đẩy vào hàng đợi nền rồi trả ngay → bấm liên tục nhiều anchor được; trạng thái "đang sinh" đọc từ máy chủ.
  // gui[id] = số ảnh gốc lúc bấm lần đầu của mạch này → nút hiện "đang gửi" ngay khi bấm, xong thì báo đã thêm mấy ảnh.
  const [gui, setGui] = useState<Record<number, { goc: number; cho: number }>>({});
  const sinh = async (id: number, soAnh: number, so = BO_GOC) => {
    setLoi((x) => ({ ...x, [id]: '' }));
    setGui((g) => ({ ...g, [id]: { goc: g[id]?.goc ?? soAnh, cho: (g[id]?.cho ?? 0) + 1 } }));
    const r = await sinhAnhMau(id, so);
    setGui((g) => (g[id] ? { ...g, [id]: { ...g[id], cho: g[id].cho - 1 } } : g));
    if (!r.ok) setLoi((x) => ({ ...x, [id]: r.loi }));
    await onChanged();
  };
  // CÂY BỘ BỐI CẢNH (anh 31/10/2026: cấu kiện là đồ thật đoàn phim chuẩn bị → hiện DANH SÁCH DẠNG CÂY, mỗi node một dòng gọn, BẤM MỞ ra card chi tiết).
  // cha của con dù bị lọc khỏi dsHien vẫn hiện làm đầu nhóm → luôn thấy cấu kiện thuộc về đâu.
  // Mục đang xem nằm trong URL (?ac=<id>) — F5 / chia sẻ giữ nguyên (chuẩn YDNI §1).
  const [chon, setChon] = useState<number | null>(() => { try { const v = new URLSearchParams(window.location.search).get('ac'); return v ? Number(v) : null; } catch { return null; } });
  const chonDat = (id: number) => { setChon(id); try { const u = new URL(window.location.href); u.searchParams.set('ac', String(id)); window.history.replaceState(null, '', u); } catch { /* SSR */ } };
  const nhomCay = nhomCayAnchor(dsHien, nhanVat);
  // KHUNG CHI TIẾT (bên phải, rộng) — ẢNH TO dùng hết không gian + mô tả đầy đủ + các góc lớn + nút (chuẩn YDNI §8).
  const the = (v: NhanVat) => {
    const soDang = dangSinh.nhanVat.filter((x) => x === v.id).length + (gui[v.id]?.cho ?? 0);
    const g0 = gui[v.id]; const them = g0 ? v.anh_ref.length - g0.goc : 0;
    const anhChinh = v.anh_ref[0];
    return (
      <div key={v.id} style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 18 }}>{v.ten}</strong>
          <Pill color="var(--fg-3)">{LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label ?? v.loai}</Pill>
          {!!v.tieu_su?.trim() && <button type="button" className="xv-lienket" style={{ fontSize: 13 }} title={`Tiểu sử — bấm để sửa:\n${v.tieu_su}`} onClick={() => setSua(v)}>📖 tiểu sử</button>}
          {soDang > 0 && <span style={{ fontSize: 12, color: 'var(--violet)' }}>⏳ đang sinh {soDang} ảnh…</span>}
          {them > 0 && <span style={{ fontSize: 12, color: 'var(--lime)' }}>✓ +{them} ảnh mới</span>}
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: 'min(440px, 100%)', flexShrink: 0 }}>
            {anhChinh
              ? <img src={anhNho(anhChinh, 640)} alt={v.ten} loading="eager" decoding="async" onClick={() => moNgan({ loai: 'xem', url: anhChinh, ten: v.ten })}
                  style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)', cursor: 'zoom-in', display: 'block', backgroundColor: 'var(--bg-2)', backgroundImage: `url(${anhNho(anhChinh, 160)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              : <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', position: 'relative' }} onClick={v.loai === 'boi_canh' && v.bo_set_id ? () => moNgan({ loai: 'bo-set', setId: v.bo_set_id! }) : undefined}><AnhDaiDien v={v} co={440} />{soDang > 0 && <DangSinh chu={`${soDang} ảnh`} />}</div>}
            {v.anh_ref.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {v.anh_ref.map((u, i) => (
                  <AnhNho key={u} url={u} kich={72} vien={i === 0 ? 'var(--cyan)' : undefined} nhan={i === 0 ? 'chính' : undefined}
                    title={i === 0 ? 'ảnh chính' : 'bấm để đặt làm ảnh chính'}
                    onClick={i ? async () => { await datAnhChinh(v.id, u); await onChanged(); } : () => moNgan({ loai: 'xem', url: u, ten: v.ten })}
                    onXoa={async () => { await xoaAnhGoc(v.id, u); await onChanged(); }} />
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 260, display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{v.mo_ta || <em style={{ color: 'var(--fg-4)' }}>chưa mô tả — bấm Sửa để tả đặc tính</em>}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="xv-btn" onClick={() => setSua(v)}>✎ Sửa</button>
              {v.bo_set_id && <button type="button" className="xv-btn chinh" title="Bộ set 3D của bối cảnh này" onClick={() => moNgan({ loai: 'bo-set', setId: v.bo_set_id! })}>🧊 Xem 3D</button>}
              <Nut ly={(!khoa.google && !khoa.openai && 'thiếu GOOGLE_API_KEY/OPENAI_API_KEY') || (!v.mo_ta.trim() && 'tả đặc tính trước')} title="Một lượt = nhiều ảnh, mỗi ảnh một GÓC khác — qua cổng rẻ nhất trước, song song ~20 giây." onClick={() => void sinh(v.id, v.anh_ref.length)} gia={BO_GOC * giaAnhCents(kt.mo_hinh_anh)}>{v.anh_ref.length ? `✨ Sinh thêm ${BO_GOC} góc` : `✨ Sinh ảnh gốc + góc phụ (${BO_GOC})`} · {tien(BO_GOC * giaAnhCents(kt.mo_hinh_anh))}</Nut>
              <Nut ly={(!khoa.google && !khoa.openai && 'thiếu khoá ảnh') || (!v.mo_ta.trim() && 'tả đặc tính trước')} title="Chỉ sinh thêm MỘT góc kế tiếp" onClick={() => void sinh(v.id, v.anh_ref.length, 1)} gia={giaAnhCents(kt.mo_hinh_anh)}>+1 góc</Nut>
              {v.loai === 'san_pham' && !v.anh_ref.length && <button type="button" className="xv-btn" onClick={() => setSua(v)} title="Thêm ảnh thật: dán Ctrl+V, kéo thả, chọn file, URL">📷 Ảnh thật</button>}
              {v.loai === 'nhan_vat' && <GiongNhanVat v={v} onChanged={onChanged} />}
              {(v.bien_the?.length ?? 0) > 0 && <button type="button" className="xv-btn" onClick={() => setBtMo(v.id)} title="Biến thể — biểu cảm, trang phục, tư thế">🎭 {v.bien_the!.length}</button>}
              <Menu>
                <MucMenu onClick={() => setSua(v)}>📷 Ảnh thật — dán / kéo thả / URL</MucMenu>
                <MucMenu ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!v.anh_ref.length && 'chưa có ảnh gốc') || (!v.mo_ta.trim() && 'chưa có mô tả') || (ban === v.id && 'đang so…')}
                  onClick={async () => { setBan(v.id); setLoi((x) => ({ ...x, [v.id]: '' })); const r = await doiChieuAnchor(v.id); setBan(null); if (!r.ok) setLoi((x) => ({ ...x, [v.id]: r.loi })); await onChanged(); }}>🔍 Đối chiếu ảnh với mô tả (Claude nhìn ảnh)</MucMenu>
                <MucMenu onClick={() => setBtMo(v.id)}>🎭 Biến thể ({v.bien_the?.length ?? 0})</MucMenu>
                <Xoa nhan="anchor" onXoa={async () => { await xoaNhanVat(v.id); await onChanged(); }} />
              </Menu>
              {ban === v.id && <span style={mono}>… đang đối chiếu</span>}
            </div>
            {v.loai === 'san_pham' && !v.anh_ref.length && <div style={{ fontSize: 11.5, color: 'var(--amber)' }}>⚠ Quảng cáo cần ảnh sản phẩm thật — bấm 📷 Ảnh thật để AI giữ đúng màu, dáng, chi tiết.</div>}
            {v.doi_chieu && (v.doi_chieu.khop
              ? <div style={{ fontSize: 12, color: 'var(--lime)' }} title={`Đối chiếu lúc ${gioVN(v.doi_chieu.luc)}`}>✓ Mô tả khớp ảnh gốc</div>
              : <div style={{ fontSize: 12, color: 'var(--amber)', display: 'grid', gap: 3 }}>
                  <div>⚠ Mô tả LỆCH ảnh gốc ({gioVN(v.doi_chieu.luc)}):</div>
                  {v.doi_chieu.lech.slice(0, 6).map((l, i) => <div key={i} style={{ paddingLeft: 10 }}>– {l}</div>)}
                  {v.doi_chieu.mo_ta_de_xuat && <div><button type="button" className="xv-btn" style={{ padding: '1px 7px' }} title={v.doi_chieu.mo_ta_de_xuat}
                    onClick={async () => { await luuNhanVat({ id: v.id, phim_id: v.phim_id, loai: v.loai, ten: v.ten, mo_ta: v.doi_chieu!.mo_ta_de_xuat, anh_ref: v.anh_ref, giong: v.giong, thuoc_id: v.thuoc_id }); await onChanged(); }}>↳ Dùng mô tả viết theo ảnh</button></div>}
                </div>)}
            {/* Thiết kế sản xuất — bàn chuẩn bị theo NHÓM (trang phục · tóc · kính/phụ kiện · trang điểm · vết · trạng thái · biểu cảm · tư thế): mỗi hàng một
                khía cạnh, ảnh mẫu đã làm hiện thumbnail, món CHƯA có ảnh hiện chip hổ phách "📷 <tên>" (cần làm ảnh — như đạo cụ phải mua/làm trước). */}
            {!!v.bien_the?.length && (() => {
              const btHien = v.bien_the!.filter(hopTapHien);   // lọc theo tập đang chọn (đồ mọi tập luôn hiện)
              const nhoms = (NHOM_BIEN_THE[v.loai] ?? NHOM_BIEN_THE.nhan_vat).filter((g) => btHien.some((b) => b.nhom === g.key));
              if (!nhoms.length) return null;
              return (
                <div style={{ display: 'grid', gap: 5 }}>
                  {nhoms.map((g) => (
                    <div key={g.key} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <span style={{ ...mono, minWidth: 92, color: 'var(--fg-3)', lineHeight: '48px' }}>{g.label}</span>
                      {btHien.filter((b) => b.nhom === g.key).map((b) => {
                        const mc = moc[b.id];
                        // Nhãn dưới món: TẬP (từ dung_tap, hoặc suy từ mốc nếu chỉ một tập) + MỐC "từ #N" (shot đầu tiên dùng — thấy vết bật từ đâu).
                        const tapTxt = b.dung_tap?.length ? `tập ${b.dung_tap.join(',')}` : (mc && mc.cac_tap.length === 1 ? `tập ${mc.cac_tap[0]}` : '');
                        const cap = [tapTxt, mc ? `📍từ #${mc.thu_tu}` : ''].filter(Boolean).join(' · ');
                        const tip = `${g.label}: ${b.ten}${b.dung_tap?.length ? ` · gắn tập ${b.dung_tap.join(',')}` : ''}${mc ? ` — xuất hiện từ shot #${mc.thu_tu} (tập ${mc.tap_so}${mc.canh ? `, ${mc.canh}` : ''}), dùng ${mc.so_shot} shot` : ' — chưa dùng ở shot nào'}`;
                        return (
                          <span key={b.id} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, maxWidth: 160 }}>
                            {b.anh_url
                              ? <AnhNho url={b.anh_url} kich={48} title={tip} onClick={() => setBtMo(v.id)} />
                              : <span title={`${tip} — chưa có ảnh mẫu, bấm để làm`} onClick={() => setBtMo(v.id)}
                                  style={{ cursor: 'pointer', fontSize: 10, lineHeight: '20px', padding: '0 7px', borderRadius: 4, border: `1px dashed ${dangSinh.bienThe.includes(b.id) ? 'var(--violet)' : 'var(--amber)'}`, color: dangSinh.bienThe.includes(b.id) ? 'var(--violet)' : 'var(--amber)', whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {dangSinh.bienThe.includes(b.id) ? '⏳ ' : '📷 '}{b.ten}
                                </span>}
                            {cap && <span style={{ fontSize: 9, color: 'var(--fg-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 158 }}>{cap}</span>}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()}
            <Loi>{loi[v.id] || (!dangSinh.nhanVat.includes(v.id) ? loiAnh.nhanVat[v.id] : '')}</Loi>
          </div>
        </div>
      </div>
    );
  };
  // Danh sách phẳng theo thứ tự cây: cha rồi các con (có cờ con + con cuối để vẽ nhánh ├─ └─).
  const dsPhang: { v: NhanVat; laCon: boolean; cuoi: boolean }[] = [];
  for (const { cha, con } of nhomCay) { dsPhang.push({ v: cha, laCon: false, cuoi: con.length === 0 }); con.forEach((c, i) => dsPhang.push({ v: c, laCon: true, cuoi: i === con.length - 1 })); }
  // MỘT DÒNG CÂY: ảnh nhỏ + tên + loại + số ảnh + nút nhanh; bấm cả dòng = mở/đóng card chi tiết (the) bung dưới.
  // MỘT DÒNG CÂY gọn (không kéo rộng): nhánh + ảnh nhỏ + tên + loại + số ảnh; bấm = chọn → khung chi tiết bên trái hiện. Nút Sửa/Sinh ngay trên dòng.
  const chonId = chiTiet !== undefined ? chiTiet : (chon ?? dsPhang[0]?.v.id ?? null);   // mặc định chọn mục đầu → khung chi tiết không bao giờ trống
  const dong = ({ v, laCon, cuoi }: { v: NhanVat; laCon: boolean; cuoi: boolean }) => {
    const sel = chonId === v.id;
    const soDang = dangSinh.nhanVat.filter((x) => x === v.id).length + (gui[v.id]?.cho ?? 0);
    const nhan = v.anh_ref.length ? '●'.repeat(Math.min(3, v.anh_ref.length)) + '○'.repeat(Math.max(0, 3 - v.anh_ref.length)) : '○○○';
    return (
      <div key={v.id} onClick={() => chonDat(v.id)} title="Bấm xem chi tiết bên trái"
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, cursor: 'pointer', marginLeft: laCon ? 18 : 0, background: sel ? 'var(--bg-2)' : 'transparent', borderLeft: `3px solid ${sel ? 'var(--cyan)' : 'transparent'}` }}>
        {laCon && <span style={{ fontFamily: 'monospace', color: 'var(--fg-4)', fontSize: 13 }}>{cuoi ? '└─' : '├─'}</span>}
        <span style={{ width: 28, height: 28, borderRadius: 5, overflow: 'hidden', flexShrink: 0, position: 'relative' }}><AnhDaiDien v={v} co={28} />{soDang > 0 && <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', fontSize: 11 }}>⏳</span>}</span>
        <strong style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{v.ten}</strong>
        <Pill color="var(--fg-3)">{LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label ?? v.loai}</Pill>
        <span style={{ fontSize: 10, letterSpacing: 1, color: v.anh_ref.length ? 'var(--cyan)' : 'var(--fg-4)' }} title={`${v.anh_ref.length} ảnh anchor`}>{nhan}</span>
        <span style={{ display: 'flex', gap: 4, marginLeft: 6 }} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="xv-btn" onClick={() => setSua(v)}>Sửa</button>
          <Nut ly={(!khoa.google && !khoa.openai && 'thiếu khoá ảnh') || (!v.mo_ta.trim() && 'tả đặc tính trước')} title={`Sinh ${BO_GOC} ảnh anchor (góc khác nhau) — ${tien(BO_GOC * giaAnhCents(kt.mo_hinh_anh))}, qua cổng rẻ nhất trước`} onClick={() => void sinh(v.id, v.anh_ref.length)} gia={BO_GOC * giaAnhCents(kt.mo_hinh_anh)}>{v.anh_ref.length ? '✨ +3 góc' : '✨ Sinh ảnh'}</Nut>
        </span>
      </div>
    );
  };
  return (
    <div className="xv-panel">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ flex: 1 }}>2 · Thiết kế sản xuất<small>bàn chuẩn bị của đoàn phim: nhân vật, trang phục, tóc, kính/phụ kiện, đạo cụ, bối cảnh — mỗi món làm ảnh mẫu sẵn, mọi cảnh/tập dùng cùng một bản</small></h3>
        <Nut ban={ban === -1} title="Claude đọc tiền đề + kịch bản các tập + anchor đã có → tạo các anchor còn thiếu (nhân vật, sản phẩm, bối cảnh, đạo cụ). Tạo xong anh sửa/xoá tuỳ ý." onClick={async () => { setBan(-1); setLoi((x) => ({ ...x, [-1]: '' })); const r = await goiYAIBoAnchor(phimId); setBan(null); if (!r.ok) setLoi((x) => ({ ...x, [-1]: r.loi })); await onChanged(); }}>{ban === -1 ? '… AI đang đề xuất' : '✨ AI đề xuất tuyến còn thiếu'}</Nut>
        {chiTiet === undefined && coLoai.length > 1 && <Seg value={coLoai.some((l) => l.key === locLoai) ? locLoai : ''} onChange={setLocLoai}
          options={[{ value: '' as const, label: 'Tất cả', title: `${nhanVat.length} anchor` }, ...coLoai.map((l) => ({ value: l.key, label: `${l.ic} ${l.label}`, title: `${nhanVat.filter((v) => v.loai === l.key).length} ${l.label.toLowerCase()}` }))]} />}
        {tapCo.length > 0 && <Seg value={locTap == null ? '' : String(locTap)} onChange={(v) => setLocTap(v ? Number(v) : null)}
          options={[{ value: '' as const, label: 'Mọi tập', title: 'Hiện look-book của mọi tập' }, ...tapCo.map((t) => ({ value: String(t), label: `Tập ${t}`, title: `Chỉ đồ dùng ở tập ${t} (+ đồ mọi tập)` }))]} />}
        <button type="button" className="xv-btn" onClick={() => setSua({ loai: 'nhan_vat', ten: '', mo_ta: '', anh_ref: [], giong: '' })}>+ Thêm</button>
      </div>
      <Loi>{loi[-1]}</Loi>
      {nhanVat.length === 0 && <div style={mono}>Chưa có anchor. Phim nhiều tập BẮT BUỘC khai nhân vật ở đây trước khi tách cảnh, nếu không mỗi tập Claude sẽ tả một kiểu.</div>}
      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
        {/* DANH SÁCH DẠNG CÂY bên TRÁI — gọn, cố định bề rộng, điều hướng (anh 31/10/2026, chuẩn YDNI §8) */}
        {chiTiet === undefined && <div style={{ flex: '0 0 440px', minWidth: 0, display: 'grid', gap: 2, alignContent: 'start' }}>
          {dsPhang.map((x) => dong(x))}
        </div>}
        {/* KHUNG CHI TIẾT bên PHẢI — panel có viền, CAO BẰNG cây (alignItems stretch → hết khoảng trống), hiện mục đang chọn */}
        <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-1)', padding: 14 }}>
          {(() => { const sv = nhanVat.find((v) => v.id === chonId); return sv
            ? the(sv)
            : <div style={{ ...mono, textAlign: 'center', color: 'var(--fg-4)', paddingTop: 40 }}>Chưa có mục nào</div>; })()}
        </div>
      </div>
      {btMo != null && nhanVat.find((v) => v.id === btMo) && <BienTheDrawer a={nhanVat.find((v) => v.id === btMo)!} khoa={khoa} kt={kt} dangSinh={dangSinh.bienThe} loiBt={loiAnh.bienThe} onClose={() => setBtMo(null)} onChanged={onChanged} />}
      {sua && <NhanVatForm phimId={phimId} goc={sua} dsCha={nhanVat.filter((v) => v.loai === 'boi_canh' || v.loai === 'dao_cu')} onClose={() => setSua(null)} onSaved={async () => { setSua(null); await onChanged(); }} />}
    </div>
  );
}

export function BienTheDrawer({ a, khoa, kt, dangSinh, loiBt, onClose, onChanged }: { a: NhanVat; khoa: Khoa; kt: Required<KinhThanh>; dangSinh: number[]; loiBt: Record<number, string>; onClose: () => void; onChanged: () => Promise<void> }) {
  const nhom = NHOM_BIEN_THE[a.loai] ?? NHOM_BIEN_THE.nhan_vat;
  const [f, setF] = useState({ nhom: nhom[0]!.key, ten: '', mo_ta: '', tap: '' });
  const [ban, setBan] = useState<string | null>(null);
  const [loi, setLoi] = useState('');
  const chay = async (k: string, fn: () => Promise<{ ok: boolean; loi?: string } | void>) => {
    setBan(k); setLoi('');
    setLoi((await goiAction(fn)).loi); setBan(null);
    await onChanged();
  };
  const ds = a.bien_the ?? [];
  const chuaAnh = ds.filter((b) => !b.anh_url);
  const coKhoaAnh = khoa.google || khoa.openai;
  const lyAnh = (!coKhoaAnh && 'thiếu khoá ảnh') || (!a.anh_ref.length && 'anchor chưa có ảnh gốc — Sinh ảnh gốc trước');
  return (
    <Ngan onClose={onClose} tieuDe={`🎭 Biến thể · ${a.ten}`} nut={<Pill color="var(--fg-3)">{LOAI_NHAN_VAT.find((l) => l.key === a.loai)?.label ?? a.loai}</Pill>}>
      <div style={{ ...mono, marginBottom: 10, lineHeight: 1.6 }}>
        Ảnh gốc giữ <b>danh tính</b> (ai/cái gì); biến thể chỉ đổi một thứ ({nhom.map((x) => x.label.toLowerCase()).join(', ')}). Mỗi biến thể sinh TỪ ảnh gốc nên vẫn đúng nhân vật.
        Khi tách cảnh, Claude tự gán biến thể phù hợp cho từng cảnh; keyframe dùng ảnh biến thể đó làm tham chiếu.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {a.anh_ref.slice(0, 3).map((u) => <img key={u} src={anhNho(u, 320)} alt="" onClick={() => moNgan({ loai: 'xem', url: u, ten: a.ten })} style={{ height: 80, borderRadius: 6, border: '1px solid var(--line)', cursor: 'zoom-in' }} />)}
        {!a.anh_ref.length && <span className="xv-loi">Chưa có ảnh gốc — đóng lại, bấm "✨ Sinh ảnh gốc" ở thẻ anchor trước.</span>}
        <span style={{ flex: 1 }} />
        <Nut ly={!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY'} ban={!!ban} title="Claude đọc kịch bản các tập → đề xuất các biến thể cảnh nào cũng cần (vd cảnh khóc → biểu cảm buồn; cảnh đêm → bối cảnh ban đêm)" onClick={() => void chay('ai', () => goiYAIBienThe(a.id))}>{ban === 'ai' ? '… AI đang đề xuất' : '✨ AI đề xuất biến thể theo kịch bản'}</Nut>
        <Nut chinh ly={lyAnh || (chuaAnh.length === 0 && 'mọi biến thể đã có ảnh')} ban={!!ban} title={`${chuaAnh.length} ảnh ≈ ${tien(chuaAnh.length * giaAnhCents(kt.mo_hinh_anh))}`}
          onClick={() => void chay('all', async () => { for (const b of chuaAnh) { const r = await sinhAnhBienThe(b.id); if (!r.ok) return r; } })}>
          {ban === 'all' ? '… đang xếp hàng' : `🖼 Sinh ảnh ${chuaAnh.length} biến thể chưa có (chạy nền, 4 ảnh song song)`}
        </Nut>
      </div>
      <Loi>{loi}</Loi>
      {nhom.map((g) => {
        const nh = ds.filter((b) => b.nhom === g.key);
        return (
          <div key={g.key} className="xv-panel" style={{ padding: 10 }}>
            <h3 style={{ marginBottom: 6 }} title={`${nh.length} mục`}>{g.label}</h3>
            {nh.length === 0 && <div style={mono}>chưa có</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {nh.map((b) => <BienTheThe key={b.id} b={b} ly={lyAnh} dang={dangSinh.includes(b.id)} loiAnh={dangSinh.includes(b.id) ? '' : loiBt[b.id]} ban={ban === `x${b.id}`} chay={chay} />)}
            </div>
          </div>
        );
      })}
      <div className="xv-panel" style={{ padding: 10 }}>
        <h3>Thêm biến thể</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <O label="Nhóm"><Seg options={nhom.map((x) => ({ value: x.key, label: x.label }))} value={f.nhom} onChange={(v) => setF({ ...f, nhom: v })} /></O>
          <O label="Tên"><input className="xv-in" value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} placeholder="vui · buồn · đồ mùa đông · góc cao · ban đêm" style={{ minWidth: 200 }} /></O>
          <O label="Thay đổi gì (tiếng Anh tốt hơn)"><input className="xv-in" value={f.mo_ta} onChange={(e) => setF({ ...f, mo_ta: e.target.value })} placeholder="crying, tears on cheeks, ears drooping" style={{ minWidth: 320 }} /></O>
          {LOOK_NHOM.has(f.nhom) && <O label="Dùng cho tập"><input className="xv-in" value={f.tap} onChange={(e) => setF({ ...f, tap: e.target.value })} placeholder="1,3 — trống = mọi tập" title="Số tập dùng bộ này (phim nhiều tập tủ đồ riêng); trống = mọi tập" style={{ minWidth: 150 }} /></O>}
          <div className="xv-field"><Nut chinh ly={!f.ten.trim() && 'nhập tên'} ban={!!ban} onClick={() => void chay('them', async () => { const r = await luuBienThe({ nhan_vat_id: a.id, nhom: f.nhom, ten: f.ten, mo_ta: f.mo_ta, dung_tap: parseTap(f.tap) }); if (r.ok) setF({ ...f, ten: '', mo_ta: '', tap: '' }); return r; })}>+ Thêm</Nut></div>
        </div>
      </div>
      {(a.loai === 'nhan_vat' || a.loai === 'dao_cu') && <section style={{ marginTop: 18, display: 'grid', gap: 8 }}>
        {/* Sổ liền mạch của nhân vật / đạo cụ qua mọi tập (script supervisor) — cùng sổ với drawer cảnh, lọc theo tên này. */}
        <h3 style={{ margin: 0, fontSize: 14 }}>📒 Sổ liền mạch</h3>
        <SoLienMachXem phimId={a.phim_id} ten={a.ten} />
      </section>}
    </Ngan>
  );
}

/** CHI TIẾT một biến thể look khi chọn node con của nhân vật trong cây (ngăn phải): ảnh mẫu lớn + nhóm/tên + mô tả + tập + MỐC xuất hiện + sinh ảnh + sửa.
 *  Đây là "character/costume breakdown" — mỗi trang phục/tóc/vết là một thành phần độc lập có trang chi tiết riêng. */
export function BienTheChiTiet({ b, nvTen, phimId, dangSinh, loiBt, onChanged }: { b: BienThe; nvTen: string; phimId: number; dangSinh: number[]; loiBt: Record<number, string>; onChanged: () => Promise<void> }) {
  const nhanNhom = NHOM_BIEN_THE.nhan_vat.find((x) => x.key === b.nhom)?.label ?? b.nhom;
  const [ban, setBan] = useState(false);
  const [sua, setSua] = useState(false);
  const [f, setF] = useState({ mo_ta: b.mo_ta, tap: (b.dung_tap ?? []).join(',') });
  const [mc, setMc] = useState<{ tap_so: number; thu_tu: number; canh: string; so_shot: number; cac_tap: number[] } | null>(null);
  useEffect(() => { let s = true; void mocBienThe(phimId).then((m) => { if (s) setMc(m[b.id] ?? null); }); return () => { s = false; }; }, [phimId, b.id]);
  const [loi, setLoi] = useState('');
  // lỗi hiện tại chỗ (Loi) — không alert() native (ui-conventions §3)
  const chay = async (fn: () => Promise<{ ok: boolean; loi?: string } | void>) => { setBan(true); setLoi(''); try { const r = await fn(); if (r && !r.ok) setLoi(r.loi ?? 'lỗi'); await onChanged(); } finally { setBan(false); } };
  const dang = dangSinh.includes(b.id);
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>{b.ten}</h3>
        <Pill color="var(--violet)">{nhanNhom}</Pill>
        <span style={{ ...mono, color: 'var(--fg-3)' }}>của {nvTen}</span>
        {!!b.dung_tap?.length && <Pill color="var(--cyan)">tập {b.dung_tap.join(',')}</Pill>}
        {mc && <span style={{ ...mono, color: 'var(--fg-3)' }} title={`Dùng ${mc.so_shot} shot`}>📍 xuất hiện từ shot #{mc.thu_tu} · tập {mc.tap_so}{mc.canh ? ` · ${mc.canh}` : ''}</span>}
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: 'min(360px, 100%)' }}>
          {b.anh_url
            ? <div style={{ position: 'relative' }}><img src={anhNho(b.anh_url, 640)} loading="eager" decoding="async" alt={b.ten} style={{ width: '100%', borderRadius: 8, display: 'block', background: `center/cover url(${anhNho(b.anh_url, 160)})` }} />{dang && <DangSinh chu="đang sinh" />}</div>
            : <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, border: '1px dashed var(--amber)', display: 'grid', placeItems: 'center', color: 'var(--amber)', fontSize: 13, textAlign: 'center', padding: 12 }}>{dang ? '⏳ đang sinh ảnh mẫu…' : '📷 chưa có ảnh mẫu — bấm "Sinh ảnh mẫu"'}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Nut chinh ban={ban} title="Sinh ảnh mẫu của biến thể này (từ ảnh gốc nhân vật nên giữ đúng danh tính)" onClick={() => void chay(() => sinhAnhBienThe(b.id))}>{dang ? '… đang sinh' : b.anh_url ? '🔄 Sinh lại ảnh' : '🖼 Sinh ảnh mẫu'}</Nut>
            {b.anh_url && <Xoa nhan="ảnh mẫu" ban={ban} onXoa={() => chay(() => xoaAnhBienThe(b.id))} />}
          </div>
          <Loi>{loi || loiBt[b.id] || ''}</Loi>
        </div>
        <div style={{ flex: 1, minWidth: 260, display: 'grid', gap: 8 }}>
          {sua ? (
            <>
              <O label="Mô tả (tiếng Anh tốt hơn)"><textarea className="xv-ta" rows={5} value={f.mo_ta} onChange={(e) => setF({ ...f, mo_ta: e.target.value })} /></O>
              <O label="Dùng cho tập (vd 1,3 — trống = mọi tập)"><input className="xv-in" value={f.tap} onChange={(e) => setF({ ...f, tap: e.target.value })} placeholder="1,3 — trống = mọi tập" /></O>
              <div style={{ display: 'flex', gap: 6 }}>
                <Nut chinh ban={ban} onClick={() => void chay(async () => { const r = await luuBienThe({ id: b.id, nhan_vat_id: b.nhan_vat_id, nhom: b.nhom, ten: b.ten, mo_ta: f.mo_ta, dung_tap: parseTap(f.tap) }); if (r.ok) setSua(false); return r; })}>Lưu</Nut>
                <button type="button" className="xv-btn" onClick={() => setSua(false)}>Huỷ</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--fg-2)' }}>{b.mo_ta || <span style={{ color: 'var(--fg-4)' }}>chưa tả</span>}</div>
              <button type="button" className="xv-btn" style={{ justifySelf: 'start' }} onClick={() => setSua(true)}>✎ Sửa mô tả / tập</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function BienTheThe({ b, ly, dang, loiAnh, ban, chay }: { b: BienThe; ly: string | false; dang: boolean; loiAnh?: string; ban: boolean; chay: (k: string, fn: () => Promise<{ ok: boolean; loi?: string } | void>) => Promise<void> }) {
  const [sua, setSua] = useState(false);
  const [f, setF] = useState({ ten: b.ten, mo_ta: b.mo_ta, tap: (b.dung_tap ?? []).join(',') });
  return (
    <div className="xv-canh" style={{ display: 'flex', gap: 8 }}>
      <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0, borderRadius: 6, overflow: 'hidden' }}>
        {b.anh_url ? <AnhNho url={b.anh_url} kich={64} onClick={() => moNgan({ loai: 'xem', url: b.anh_url!, ten: b.ten })} onXoa={() => chay(`xa${b.id}`, () => xoaAnhBienThe(b.id))} />
          : <div style={{ width: 64, height: 64, background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--fg-4)', fontSize: 10 }}>chưa ảnh</div>}
        {dang && <DangSinh chu="" />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        {sua ? (
          <>
            <input className="xv-in" value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} style={{ marginBottom: 4 }} />
            <textarea className="xv-ta" rows={2} value={f.mo_ta} onChange={(e) => setF({ ...f, mo_ta: e.target.value })} />
            {LOOK_NHOM.has(b.nhom) && <input className="xv-in" value={f.tap} onChange={(e) => setF({ ...f, tap: e.target.value })} placeholder="Dùng cho tập: 1,3 — trống = mọi tập" title="Số tập dùng bộ này; trống = mọi tập" style={{ marginTop: 4 }} />}
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <Nut chinh ban={ban} onClick={() => void chay(`b${b.id}`, async () => { const r = await luuBienThe({ id: b.id, nhan_vat_id: b.nhan_vat_id, nhom: b.nhom, ten: f.ten, mo_ta: f.mo_ta, dung_tap: parseTap(f.tap) }); setSua(false); return r; })}>Lưu</Nut>
              <button type="button" className="xv-btn" onClick={() => setSua(false)}>Huỷ</button>
            </div>
          </>
        ) : (
          <>
            <strong style={{ fontSize: 12 }}>{b.ten}</strong>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={b.mo_ta}>{b.mo_ta}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              <Nut ly={ly} ban={dang} onClick={() => void chay(`b${b.id}`, () => sinhAnhBienThe(b.id))}>{dang ? '… đang sinh' : b.anh_url ? '↻' : '🖼 Sinh'}</Nut>
              <button type="button" className="xv-btn" onClick={() => setSua(true)}>Sửa</button>
              <Xoa nhan="biến thể" ban={ban} onXoa={() => chay(`x${b.id}`, () => xoaBienThe(b.id))} />
            </div>
            {loiAnh && <div className="xv-loi" title={loiAnh}>{loiAnh.slice(0, 140)}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export function NhanVatForm({ phimId, goc, dsCha = [], onClose, onSaved }: { phimId: number; goc: Partial<NhanVat>; dsCha?: NhanVat[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState({ loai: (goc.loai ?? 'nhan_vat') as LoaiNhanVat, ten: goc.ten ?? '', mo_ta: goc.mo_ta ?? '', anh_ref: goc.anh_ref ?? [], giong: goc.giong ?? '', tieu_su: goc.tieu_su ?? '', thuoc_id: goc.thuoc_id ?? null as number | null });
  const [loi, setLoi] = useState('');
  const [luu, setLuu] = useState(false);
  const [ai, setAi] = useState(false);
  const goiY = async () => { setAi(true); setLoi(''); const r = await goiYAIAnchor(phimId, { loai: f.loai, ten: f.ten, mo_ta: f.mo_ta }); setAi(false); if (!r.ok) { setLoi(r.loi); return; } setF((x) => ({ ...x, mo_ta: r.data.mo_ta, giong: r.data.giong || x.giong })); };
  return (
    <Ngan onClose={onClose} nho tieuDe={goc.id ? `Sửa: ${goc.ten}` : 'Thêm anchor'}>
      <O label="Loại"><Seg options={LOAI_NHAN_VAT.map((l) => ({ value: l.key, label: l.label }))} value={f.loai} onChange={(v) => setF({ ...f, loai: v })} /></O>
      {f.loai === 'cau_kien' && <O label="Thuộc về (đạo cụ / bối cảnh cha)" hint="Cấu kiện là đồ thật thuộc một bối cảnh hoặc đạo cụ — chọn cha để nó hiện lồng dạng cây. Vật liệu bề mặt tả trong Đặc tính, không phải một cấu kiện riêng.">
        <select className="xv-in" value={f.thuoc_id ?? ''} onChange={(e) => setF({ ...f, thuoc_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">— (chưa gắn, hiện ở gốc)</option>
          {dsCha.filter((c) => c.id !== goc.id).map((c) => <option key={c.id} value={c.id}>{c.loai === 'boi_canh' ? '🏠' : '🧸'} {c.ten}</option>)}
        </select>
      </O>}
      <O label="Tên *" hint="Claude dùng đúng tên này khi ghi nhân vật của từng cảnh"><input className="xv-in" value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} placeholder="Timo (rùa) · Áo bra X · Khu rừng Thì Thầm" /></O>
      <O label="Đặc tính cố định" hint="Mọi thứ phải GIỐNG NHAU ở mọi cảnh: ngoại hình, màu, trang phục, tỉ lệ, chất liệu, tính cách. Càng cụ thể model càng ít bịa.">
        <textarea className="xv-ta" rows={5} value={f.mo_ta} onChange={(e) => setF({ ...f, mo_ta: e.target.value })} placeholder="Rùa con 8 tuổi, mai xanh rêu có vân lục giác, mắt to nâu, đeo khăn quàng đỏ, tính điềm tĩnh, đi chậm nhưng chắc…" />
        <div style={{ marginTop: 4 }}><Nut ly={!f.ten.trim() && 'đặt tên trước'} ban={ai} title="Claude đọc phong cách + các anchor khác của phim → tả đặc tính khớp, không đụng nhân vật đã có" onClick={() => void goiY()}>{ai ? '… AI đang tả' : '✨ AI tả đặc tính (theo phong cách + tuyến đã có)'}</Nut></div>
      </O>
      {f.loai === 'nhan_vat' && <O label="Tiểu sử" hint="Nguồn gốc · tính cách · sức mạnh · điểm yếu · mong muốn · nỗi sợ · quan hệ · bí mật. Không vào prompt hình — Claude đọc khi viết kịch bản để nhân vật hành động đúng mình; làm nền cho tập phim về chính nhân vật.">
        <textarea className="xv-ta" rows={6} value={f.tieu_su} onChange={(e) => setF({ ...f, tieu_su: e.target.value })} placeholder={'Origin: …\nPersonality: …\nPower: …\nWeakness: …\nWants: …\nFears: …\nRelationships: …\nSecret: …'} />
      </O>}
      {f.loai === 'nhan_vat' && !!goc.am_hieu?.length && (
        <O label="Âm hiệu" hint="Bộ âm cố định của nhân vật (phim không lời) — mọi tập dùng lại cùng file để khán giả nghe là nhận ra.">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {goc.am_hieu.map((a) => <span key={a.url} title={a.mo_ta} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12 }}><NutNghe url={a.url} /> {a.ten}</span>)}
          </div>
        </O>
      )}
      {f.loai === 'nhan_vat' && <O label="Giọng (cho lồng tiếng sau này)"><input className="xv-in" value={f.giong} onChange={(e) => setF({ ...f, giong: e.target.value })} placeholder="giọng trẻ con ấm, chậm rãi" /></O>}
      <O label={f.loai === 'san_pham' ? 'Ảnh sản phẩm THẬT (quảng cáo phải đúng hàng) — dán Ctrl+V, nút Dán (điện thoại), kéo thả, chọn file, hoặc URL' : 'Ảnh tham chiếu — dán / kéo thả / file / URL, hoặc lưu rồi bấm “Sinh ảnh gốc”'}>
        <ImageAttach value={f.anh_ref} onChange={(urls) => setF({ ...f, anh_ref: urls })} max={10} nhanBo="Bỏ ảnh khỏi anchor"
          upload={async (du) => { const r = await taiAnhLen(du); return r.ok ? { ok: true, url: r.data } : { ok: false, error: r.loi }; }} />
      </O>
      <Loi>{loi}</Loi>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <Nut ly={!f.ten.trim() && 'thiếu tên'} ban={luu} chinh onClick={async () => {
          setLuu(true); setLoi('');
          const r = await luuNhanVat({ id: goc.id, phim_id: phimId, ...f });
          setLuu(false);
          if (!r.ok) { setLoi(r.loi); return; }
          await onSaved();
        }}>Lưu</Nut>
        <button type="button" className="xv-btn" onClick={onClose}>Đóng</button>
      </div>
    </Ngan>
  );
}

// ── Tập: kịch bản + storyboard ───────────────────────────────────────────────────────────────────────────────────
