'use client';
// Mục 2 tuyến nhân vật: anchor, ảnh gốc, biến thể, giọng cố định của từng nhân vật.
import { useEffect, useState } from 'react';
import { Ngan } from './ngan';
import { moNgan } from './ngan-chung';
import { ImageAttach } from './image-attach';
import { GIONG } from '@/lib/xuong-video/am-thanh';
import { luuNhanVat, xoaNhanVat, sinhAnhMau, taiAnhLen, datAnhChinh, dsGiongModel, dsGiongCua, chonGiong, ngheThuGiong, xoaAnhGoc, xoaAnhBienThe, goiYAIAnchor, goiYAIBoAnchor, luuBienThe, xoaBienThe, goiYAIBienThe, sinhAnhBienThe, doiChieuAnchor } from '@/lib/actions';
import { LOAI_NHAN_VAT, NHOM_BIEN_THE, nhanNhom, docKinhThanh, giaAnhCents, tien, gioVN, type NhanVat, type BienThe, type KinhThanh, type LoaiNhanVat } from '@/lib/xuong-video/kieu';
import { Chon } from './chon';
import { Khoa, O, Pill, Seg, Nut, Xoa, Loi, AnhNho, DangSinh, mono } from './ui';
import { NutNghe } from './media';

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
        </Ngan>
      )}
    </>
  );
}

export function NhanVatSection({ phimId, nhanVat, kinhThanh, khoa, dangSinh, loiAnh, onChanged }: { phimId: number; nhanVat: NhanVat[]; kinhThanh: KinhThanh; khoa: Khoa; dangSinh: { nhanVat: number[]; bienThe: number[] }; loiAnh: { nhanVat: Record<number, string>; bienThe: Record<number, string> }; onChanged: () => Promise<void> }) {
  const [sua, setSua] = useState<Partial<NhanVat> | null>(null);
  const [btMo, setBtMo] = useState<number | null>(null);
  const [ban, setBan] = useState<number | null>(null);
  const [loi, setLoi] = useState<Record<number, string>>({});
  const kt = docKinhThanh(kinhThanh);
  // Bấm là đẩy vào hàng đợi nền rồi trả ngay → bấm liên tục nhiều anchor được; trạng thái "đang sinh" đọc từ máy chủ.
  // gui[id] = số ảnh gốc lúc bấm lần đầu của mạch này → nút hiện "đang gửi" ngay khi bấm, xong thì báo đã thêm mấy ảnh.
  const [gui, setGui] = useState<Record<number, { goc: number; cho: number }>>({});
  const sinh = async (id: number, soAnh: number) => {
    setLoi((x) => ({ ...x, [id]: '' }));
    setGui((g) => ({ ...g, [id]: { goc: g[id]?.goc ?? soAnh, cho: (g[id]?.cho ?? 0) + 1 } }));
    const r = await sinhAnhMau(id);
    setGui((g) => (g[id] ? { ...g, [id]: { ...g[id], cho: g[id].cho - 1 } } : g));
    if (!r.ok) setLoi((x) => ({ ...x, [id]: r.loi }));
    await onChanged();
  };
  return (
    <div className="xv-panel">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ flex: 1 }}>2 · Tuyến nhân vật · sản phẩm · bối cảnh<small>anchor: đặc tính cố định + ảnh mẫu → mọi cảnh, mọi tập tham chiếu cùng một bản</small></h3>
        <Nut ban={ban === -1} title="Claude đọc tiền đề + kịch bản các tập + anchor đã có → tạo các anchor còn thiếu (nhân vật, sản phẩm, bối cảnh, đạo cụ). Tạo xong anh sửa/xoá tuỳ ý." onClick={async () => { setBan(-1); setLoi((x) => ({ ...x, [-1]: '' })); const r = await goiYAIBoAnchor(phimId); setBan(null); if (!r.ok) setLoi((x) => ({ ...x, [-1]: r.loi })); await onChanged(); }}>{ban === -1 ? '… AI đang đề xuất' : '✨ AI đề xuất tuyến còn thiếu'}</Nut>
        <button type="button" className="xv-btn" onClick={() => setSua({ loai: 'nhan_vat', ten: '', mo_ta: '', anh_ref: [], giong: '' })}>+ Thêm</button>
      </div>
      <Loi>{loi[-1]}</Loi>
      {nhanVat.length === 0 && <div style={mono}>Chưa có anchor. Phim nhiều tập BẮT BUỘC khai nhân vật ở đây trước khi tách cảnh, nếu không mỗi tập Claude sẽ tả một kiểu.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
        {nhanVat.map((v) => {
          const soDang = dangSinh.nhanVat.filter((x) => x === v.id).length + (gui[v.id]?.cho ?? 0);
          const g0 = gui[v.id]; const them = g0 ? v.anh_ref.length - g0.goc : 0;
          return (
          <div key={v.id} className="xv-anchor" style={{ flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 72, height: 72, flexShrink: 0, position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
                {v.anh_ref[0] ? <img src={v.anh_ref[0]} alt="" onClick={() => moNgan({ loai: 'xem', url: v.anh_ref[0]!, ten: v.ten })} style={{ width: 72, height: 72, objectFit: 'cover', display: 'block', cursor: 'zoom-in' }} />
                  : <div style={{ width: 72, height: 72, background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--fg-4)' }}>?</div>}
                {soDang > 0 && <DangSinh chu={`${soDang} ảnh`} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><strong style={{ fontSize: 12 }}>{v.ten}</strong><Pill color="var(--fg-3)">{LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label ?? v.loai}</Pill></div>
                <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={v.mo_ta}>{v.mo_ta || <em style={{ color: 'var(--fg-4)' }}>chưa mô tả</em>}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="xv-btn" onClick={() => setSua(v)}>Sửa</button>
                  <Nut ly={(!khoa.google && !khoa.openai && 'thiếu GOOGLE_API_KEY/OPENAI_API_KEY') || (!v.mo_ta.trim() && 'tả đặc tính trước')} title={`Sinh ảnh gốc (${v.loai === 'nhan_vat' ? 'character sheet: nhiều góc + biểu cảm' : 'ảnh tham chiếu'}) từ mô tả (~${tien(giaAnhCents(kt.mo_hinh_anh))}/ảnh, ~20 giây). Bấm nhiều lần = sinh song song nhiều ảnh; mỗi lần thêm đổi góc khác.`} onClick={() => void sinh(v.id, v.anh_ref.length)} gia={giaAnhCents(kt.mo_hinh_anh)}>{v.anh_ref.length ? '✨ Sinh thêm ảnh gốc' : '✨ Sinh ảnh gốc'} · {tien(giaAnhCents(kt.mo_hinh_anh))}</Nut>
                  <button type="button" className="xv-btn" onClick={() => setSua(v)} title="Thêm ảnh thật: dán Ctrl+V, nút Dán (điện thoại), kéo thả, chọn file, URL">📷 Ảnh thật</button>
                  <Nut ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!v.anh_ref.length && 'chưa có ảnh gốc') || (!v.mo_ta.trim() && 'chưa có mô tả')} ban={ban === v.id} title="Claude NHÌN ảnh gốc so với mô tả: màu, chất liệu, chi tiết, chữ/logo — lệch thì đề xuất mô tả theo ảnh (ảnh sản phẩm có ren mà mô tả ghi không ren → cả kịch bản sai)"
                    onClick={async () => { setBan(v.id); setLoi((x) => ({ ...x, [v.id]: '' })); const r = await doiChieuAnchor(v.id); setBan(null); if (!r.ok) setLoi((x) => ({ ...x, [v.id]: r.loi })); await onChanged(); }}>{ban === v.id ? '… đang so' : '🔍 Đối chiếu ảnh'}</Nut>
                  {v.loai === 'nhan_vat' && <GiongNhanVat v={v} onChanged={onChanged} />}
                  <button type="button" className="xv-btn" onClick={() => setBtMo(v.id)} title="Biểu cảm, trang phục, tư thế / góc máy, thời điểm… — mỗi biến thể sinh từ ảnh gốc nên giữ đúng danh tính">🎭 Biến thể ({v.bien_the?.length ?? 0})</button>
                  <Xoa nhan="anchor" onXoa={async () => { await xoaNhanVat(v.id); await onChanged(); }} />
                </div>
                {(soDang > 0 || them > 0) && (
                  <div style={{ ...mono, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {soDang > 0 && <span style={{ color: 'var(--violet)' }}>⏳ đang sinh {soDang} ảnh (~20 giây/ảnh)…</span>}
                    {them > 0 && <span style={{ color: 'var(--lime)' }}>✓ đã thêm {them} ảnh gốc mới (đang là ảnh chính)</span>}
                  </div>
                )}
                {v.loai === 'san_pham' && !v.anh_ref.length && <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 4 }}>⚠ Quảng cáo cần ảnh sản phẩm thật — bấm 📷 Ảnh thật để dán/tải ảnh, AI sẽ giữ đúng màu, dáng, chi tiết.</div>}
                {v.doi_chieu && (v.doi_chieu.khop
                  ? <div style={{ fontSize: 10.5, color: 'var(--lime)', marginTop: 4 }} title={`Đối chiếu lúc ${gioVN(v.doi_chieu.luc)}`}>✓ Mô tả khớp ảnh gốc</div>
                  : <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 4, display: 'grid', gap: 3 }}>
                      <div>⚠ Mô tả LỆCH ảnh gốc ({gioVN(v.doi_chieu.luc)}):</div>
                      {v.doi_chieu.lech.slice(0, 5).map((l, i) => <div key={i} style={{ paddingLeft: 10 }}>– {l}</div>)}
                      {v.doi_chieu.mo_ta_de_xuat && <div><button type="button" className="xv-btn" style={{ padding: '1px 7px' }} title={v.doi_chieu.mo_ta_de_xuat}
                        onClick={async () => { await luuNhanVat({ id: v.id, phim_id: v.phim_id, loai: v.loai, ten: v.ten, mo_ta: v.doi_chieu!.mo_ta_de_xuat, anh_ref: v.anh_ref, giong: v.giong }); await onChanged(); }}>↳ Dùng mô tả viết theo ảnh</button></div>}
                    </div>)}
                <Loi>{loi[v.id] || (!dangSinh.nhanVat.includes(v.id) ? loiAnh.nhanVat[v.id] : '')}</Loi>
              </div>
            </div>
            {(v.anh_ref.length > 1 || !!v.bien_the?.length) && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                {v.anh_ref.length > 1 && v.anh_ref.map((u, i) => (
                  <AnhNho key={u} url={u} kich={34} vien={i === 0 ? 'var(--cyan)' : undefined} nhan={i === 0 ? 'chính' : undefined}
                    title={i === 0 ? 'ảnh chính (thẻ + tham chiếu ưu tiên khi sinh cảnh)' : 'bấm để đặt làm ảnh chính'}
                    onClick={i ? async () => { await datAnhChinh(v.id, u); await onChanged(); } : undefined}
                    onXoa={async () => { await xoaAnhGoc(v.id, u); await onChanged(); }} />
                ))}
                {v.anh_ref.length > 1 && !!v.bien_the?.length && <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', margin: '0 3px' }} />}
                {(v.bien_the ?? []).slice(0, 14).map((b) => b.anh_url
                  ? <AnhNho key={b.id} url={b.anh_url} kich={24} title={`${nhanNhom(v.loai, b.nhom)}: ${b.ten}`} onClick={() => setBtMo(v.id)} />
                  : <span key={b.id} title={`${nhanNhom(v.loai, b.nhom)}: ${b.ten} — chưa có ảnh`} onClick={() => setBtMo(v.id)}
                      style={{ cursor: 'pointer', fontSize: 9.5, lineHeight: '15px', padding: '0 5px', borderRadius: 4, border: `1px solid ${dangSinh.bienThe.includes(b.id) ? 'var(--violet)' : 'var(--line)'}`, color: dangSinh.bienThe.includes(b.id) ? 'var(--violet)' : 'var(--fg-3)', whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {dangSinh.bienThe.includes(b.id) ? '⏳ ' : ''}{b.ten}
                    </span>)}
                {(v.bien_the?.length ?? 0) > 14 && <span style={{ ...mono, fontSize: 9.5 }} onClick={() => setBtMo(v.id)}>+{v.bien_the!.length - 14}</span>}
              </div>
            )}
          </div>
          );
        })}
      </div>
      {btMo != null && nhanVat.find((v) => v.id === btMo) && <BienTheDrawer a={nhanVat.find((v) => v.id === btMo)!} khoa={khoa} kt={kt} dangSinh={dangSinh.bienThe} loiBt={loiAnh.bienThe} onClose={() => setBtMo(null)} onChanged={onChanged} />}
      {sua && <NhanVatForm phimId={phimId} goc={sua} onClose={() => setSua(null)} onSaved={async () => { setSua(null); await onChanged(); }} />}
    </div>
  );
}

export function BienTheDrawer({ a, khoa, kt, dangSinh, loiBt, onClose, onChanged }: { a: NhanVat; khoa: Khoa; kt: Required<KinhThanh>; dangSinh: number[]; loiBt: Record<number, string>; onClose: () => void; onChanged: () => Promise<void> }) {
  const nhom = NHOM_BIEN_THE[a.loai] ?? NHOM_BIEN_THE.nhan_vat;
  const [f, setF] = useState({ nhom: nhom[0]!.key, ten: '', mo_ta: '' });
  const [ban, setBan] = useState<string | null>(null);
  const [loi, setLoi] = useState('');
  const chay = async (k: string, fn: () => Promise<{ ok: boolean; loi?: string } | void>) => {
    setBan(k); setLoi('');
    try { const r = await fn(); if (r && !r.ok) setLoi(r.loi ?? 'lỗi'); } catch (e) { setLoi(`Không gọi được máy chủ (${e instanceof Error ? e.message.slice(0, 80) : 'lỗi mạng'}) — studio vừa cập nhật thì bấm ↻ Tải lại.`); } finally { setBan(null); }
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
        {a.anh_ref.slice(0, 3).map((u) => <img key={u} src={u} alt="" onClick={() => moNgan({ loai: 'xem', url: u, ten: a.ten })} style={{ height: 80, borderRadius: 6, border: '1px solid var(--line)', cursor: 'zoom-in' }} />)}
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
            <h3 style={{ marginBottom: 6 }}>{g.label}<small>{nh.length}</small></h3>
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
          <div className="xv-field"><Nut chinh ly={!f.ten.trim() && 'nhập tên'} ban={!!ban} onClick={() => void chay('them', async () => { const r = await luuBienThe({ nhan_vat_id: a.id, ...f }); if (r.ok) setF({ ...f, ten: '', mo_ta: '' }); return r; })}>+ Thêm</Nut></div>
        </div>
      </div>
    </Ngan>
  );
}

export function BienTheThe({ b, ly, dang, loiAnh, ban, chay }: { b: BienThe; ly: string | false; dang: boolean; loiAnh?: string; ban: boolean; chay: (k: string, fn: () => Promise<{ ok: boolean; loi?: string } | void>) => Promise<void> }) {
  const [sua, setSua] = useState(false);
  const [f, setF] = useState({ ten: b.ten, mo_ta: b.mo_ta });
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
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <Nut chinh ban={ban} onClick={() => void chay(`b${b.id}`, async () => { const r = await luuBienThe({ id: b.id, nhan_vat_id: b.nhan_vat_id, nhom: b.nhom, ...f }); setSua(false); return r; })}>Lưu</Nut>
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

export function NhanVatForm({ phimId, goc, onClose, onSaved }: { phimId: number; goc: Partial<NhanVat>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState({ loai: (goc.loai ?? 'nhan_vat') as LoaiNhanVat, ten: goc.ten ?? '', mo_ta: goc.mo_ta ?? '', anh_ref: goc.anh_ref ?? [], giong: goc.giong ?? '' });
  const [loi, setLoi] = useState('');
  const [luu, setLuu] = useState(false);
  const [ai, setAi] = useState(false);
  const goiY = async () => { setAi(true); setLoi(''); const r = await goiYAIAnchor(phimId, { loai: f.loai, ten: f.ten, mo_ta: f.mo_ta }); setAi(false); if (!r.ok) { setLoi(r.loi); return; } setF((x) => ({ ...x, mo_ta: r.data.mo_ta, giong: r.data.giong || x.giong })); };
  return (
    <Ngan onClose={onClose} nho tieuDe={goc.id ? `Sửa: ${goc.ten}` : 'Thêm anchor'}>
      <O label="Loại"><Seg options={LOAI_NHAN_VAT.map((l) => ({ value: l.key, label: l.label }))} value={f.loai} onChange={(v) => setF({ ...f, loai: v })} /></O>
      <O label="Tên *" hint="Claude dùng đúng tên này khi ghi nhân vật của từng cảnh"><input className="xv-in" value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} placeholder="Timo (rùa) · Áo bra X · Khu rừng Thì Thầm" /></O>
      <O label="Đặc tính cố định" hint="Mọi thứ phải GIỐNG NHAU ở mọi cảnh: ngoại hình, màu, trang phục, tỉ lệ, chất liệu, tính cách. Càng cụ thể model càng ít bịa.">
        <textarea className="xv-ta" rows={5} value={f.mo_ta} onChange={(e) => setF({ ...f, mo_ta: e.target.value })} placeholder="Rùa con 8 tuổi, mai xanh rêu có vân lục giác, mắt to nâu, đeo khăn quàng đỏ, tính điềm tĩnh, đi chậm nhưng chắc…" />
        <div style={{ marginTop: 4 }}><Nut ly={!f.ten.trim() && 'đặt tên trước'} ban={ai} title="Claude đọc phong cách + các anchor khác của phim → tả đặc tính khớp, không đụng nhân vật đã có" onClick={() => void goiY()}>{ai ? '… AI đang tả' : '✨ AI tả đặc tính (theo phong cách + tuyến đã có)'}</Nut></div>
      </O>
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
