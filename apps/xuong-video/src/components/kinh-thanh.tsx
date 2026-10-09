'use client';
// Mục 0 sản phẩm · 1 kinh thánh của phim (thể loại, giọng kể, model mặc định…).
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ImageAttach } from './image-attach';
import { THE_LOAI, type TheLoai } from '@/lib/xuong-video/dien-anh';
import { suaPhim, taiAnhLen, layTuLinkSanPham, goiYAIKinhThanh } from '@/lib/actions';
import { MO_HINH_ANH, MO_HINH_VIDEO, MO_HINH_CHU, docKinhThanh, QC_TRONG, type ThongTinQc, thieuQc, gioVN, type Phim, type KinhThanh } from '@/lib/xuong-video/kieu';
import { Chon } from './chon';
import { MauQcForm } from './mau-qc';
import { Khoa, O, Seg, Nut, Loi, mono } from './ui';
import { MoHinhCtx, luaChonAnh, luaChonVideo } from './mo-hinh-ui';
import { docLT, ghiLT } from '@/lib/luu-tru';

export function KinhThanhForm({ phim, khoa, onSaved }: { phim: Phim; khoa: Khoa; onSaved: () => Promise<void> }) {
  // Ngăn phim tự làm mới 4-15 giây/lần → phim.kinh_thanh là object MỚI mỗi lần dù nội dung y nguyên. Đồng bộ theo NỘI DUNG (chuỗi JSON)
  // và chỉ khi anh không đang sửa dở — trước đây mỗi lần làm mới ghi đè chỗ đang sửa: chọn thể loại bị nhảy về, "Lấy từ link" điền xong
  // rồi mất (#1207, #1208).
  const gocJson = JSON.stringify(phim.kinh_thanh ?? {});
  const goc = useMemo(() => docKinhThanh(JSON.parse(gocJson) as KinhThanh), [gocJson]);
  const moHinh = useContext(MoHinhCtx);
  const [kt, setKt] = useState<Required<KinhThanh>>(goc);
  const [moTa, setMoTa] = useState(phim.mo_ta);
  const [luu, setLuu] = useState(false);
  const [ai, setAi] = useState(false);
  const [loiAi, setLoiAi] = useState('');
  const dirty = JSON.stringify(kt) !== JSON.stringify(goc) || moTa !== phim.mo_ta;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  useEffect(() => { if (!dirtyRef.current) { setKt(goc); setMoTa(phim.mo_ta); } }, [goc, phim.mo_ta]);
  // Tự lưu 1,5 giây sau lần sửa cuối — không còn mất vì quên bấm Lưu.
  const [luuLuc, setLuuLuc] = useState('');
  const luuNgay = useCallback(async (k: Required<KinhThanh>, m: string) => {
    setLuu(true); await suaPhim(phim.id, { kinh_thanh: k, mo_ta: m }); setLuu(false);
    setLuuLuc(gioVN(new Date(), { giay: true, chiGio: true }));
    await onSaved();
  }, [phim.id, onSaved]);
  useEffect(() => { if (!dirty) return; const t = setTimeout(() => void luuNgay(kt, moTa), 1500); return () => clearTimeout(t); }, [kt, moTa, dirty, luuNgay]);
  // Mở/đóng khung do anh bấm; chỉ quyết định MỘT lần lúc mở (open điều khiển theo state làm khung tự gập khi vừa chọn thể loại).
  // Anh đã thu gọn/mở thì GIỮ như vậy (nhớ theo phim, qua F5 và lượt tự làm mới) — #1212. Chưa từng bấm: mở khi còn thiếu.
  const khoaMo = (ten: string) => `xv-mo-${ten}-${phim.id}`;
  const docMo = (ten: string, macDinh: boolean) => { const v = docLT(khoaMo(ten)); return v == null ? macDinh : v === '1'; };
  const ghiMo = (ten: string, v: boolean) => ghiLT(khoaMo(ten), v ? '1' : '0');
  // Đọc trạng thái đã lưu NGAY từ đầu (form này chỉ dựng ở trình duyệt, sau khi tải phim — không có SSR). CHỈ ghi khi anh bấm tiêu đề:
  // trước đây ghi trong onToggle, mà trình duyệt bắn toggle cho cả lần mở MẶC ĐỊNH lúc tải trang → đè "đã thu gọn" thành "mở".
  const [moKhung, setMoKhungS] = useState(() => docMo('kt', !goc.phong_cach || !goc.the_loai));
  const latKhung = (e: React.MouseEvent) => { e.preventDefault(); setMoKhungS((v) => { ghiMo('kt', !v); return !v; }); };
  const set = <K extends keyof KinhThanh>(k: K, v: Required<KinhThanh>[K]) => setKt((x) => ({ ...x, [k]: v }));
  // Phim quảng cáo: khai sản phẩm/dịch vụ TRƯỚC — mọi nút AI đọc nó (#1201).
  const laQc = phim.loai === 'quang_cao';
  const qc: ThongTinQc = { ...QC_TRONG, ...(kt.qc ?? {}) };
  const setQc = (p: Partial<ThongTinQc>) => setKt((x) => ({ ...x, qc: { ...QC_TRONG, ...(x.qc ?? {}), ...p } }));
  const thieuSp = !!thieuQc(phim.loai, { ...kt, qc });
  const [docLink, setDocLink] = useState(false);
  const [moQc, setMoQcS] = useState(() => docMo('qc', !(goc.qc?.ten || goc.qc?.link)));
  const latQc = (e: React.MouseEvent) => { e.preventDefault(); setMoQcS((v) => { ghiMo('qc', !v); return !v; }); };
  const layLink = async () => {
    setDocLink(true); setLoiAi('');
    const r = await layTuLinkSanPham(phim.id, qc.link);
    setDocLink(false);
    if (!r.ok) { setLoiAi(r.loi); return; }
    setQc({ ...r.data, ten: qc.ten || r.data.ten, anh: [...new Set([...qc.anh, ...r.data.anh])].slice(0, 10) });
  };
  // ✨ riêng từng ô (thể loại / logline / chủ đề): cùng một lượt Claude đọc sản phẩm + tiền đề + nhân vật, chỉ điền đúng ô được bấm.
  const [aiO, setAiO] = useState('');
  const goiYMot = async (k: 'the_loai' | 'logline' | 'chu_de') => {
    setAiO(k); setLoiAi('');
    const r = await goiYAIKinhThanh(phim.id);
    setAiO('');
    if (!r.ok) { setLoiAi(r.loi); return; }
    const v = r.data[k];
    if (k === 'the_loai') { if (v && THE_LOAI.some((t) => t.key === v)) set('the_loai', v as TheLoai); } else if (v) set(k, v);
  };
  const nutAi = (k: 'the_loai' | 'logline' | 'chu_de') => (
    <button type="button" className="xv-btn" disabled={!!aiO || thieuSp} title={thieuSp ? 'khai sản phẩm/dịch vụ ở mục 0 trước' : 'AI gợi ý riêng ô này (đọc sản phẩm, tiền đề, nhân vật)'} onClick={() => void goiYMot(k)}
      style={{ padding: '0 6px', fontSize: 10.5, lineHeight: '16px', marginLeft: 6, textTransform: 'none' }}>{aiO === k ? '… AI' : '✨ AI'}</button>
  );
  const goiY = async () => { setAi(true); setLoiAi(''); const r = await goiYAIKinhThanh(phim.id); setAi(false); if (!r.ok) { setLoiAi(r.loi); return; } set('phong_cach', r.data.phong_cach); setMoTa(r.data.mo_ta); if (r.data.the_loai && THE_LOAI.some((t) => t.key === r.data.the_loai)) set('the_loai', r.data.the_loai as TheLoai); if (r.data.logline) set('logline', r.data.logline); if (r.data.chu_de) set('chu_de', r.data.chu_de); };
  return (
    <>
      {laQc && (
        <details className="xv-det xv-panel" open={moQc} style={{ borderColor: thieuSp ? 'var(--amber)' : 'var(--line)' }}>
          <summary onClick={latQc}>0 · Sản phẩm / dịch vụ được quảng cáo <small>{thieuSp ? '⚠ khai trước — AI gợi ý, viết kịch bản, tách cảnh đều dựa vào đây' : `${qc.ten}${qc.anh.length ? ` · ${qc.anh.length} ảnh` : ''}${qc.uu_dai ? ` · ${qc.uu_dai}` : ''}`}</small></summary>
          <div className="xv-grid">
            <O span label="Link trang sản phẩm" hint="dán link → bấm Lấy từ link: AI đọc trang, điền sẵn tên, điểm nổi bật, đối tượng, ưu đãi + kéo ảnh sản phẩm về (~$0.01)">
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="xv-in" value={qc.link} onChange={(e) => setQc({ link: e.target.value })} placeholder="https://shop.com/products/…" />
                <Nut ly={(!/^https?:\/\//.test(qc.link.trim()) && 'dán link http(s) trước') || (!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY')} ban={docLink} onClick={() => void layLink()}>{docLink ? '… AI đang đọc trang' : '🔗 Lấy từ link'}</Nut>
              </div>
            </O>
            <O label="Tên sản phẩm / dịch vụ"><input className="xv-in" value={qc.ten} onChange={(e) => setQc({ ten: e.target.value })} placeholder="Gentle Lift Bra" /></O>
            <O label="Khách hàng mục tiêu"><input className="xv-in" value={qc.doi_tuong} onChange={(e) => setQc({ doi_tuong: e.target.value })} placeholder="Phụ nữ Mỹ 50+, mỏi vai vì bra gọng" /></O>
            <O label="Ưu đãi / lời kêu gọi"><input className="xv-in" value={qc.uu_dai} onChange={(e) => setQc({ uu_dai: e.target.value })} placeholder="50%+ OFF · Mua 2 tặng 1 · Shop now" /></O>
            <O label="Thị trường · ngôn ngữ"><input className="xv-in" value={qc.thi_truong} onChange={(e) => setQc({ thi_truong: e.target.value })} placeholder="Mỹ · tiếng Anh" /></O>
            <O span label="Điểm nổi bật / lợi ích (có thật)"><textarea className="xv-ta" rows={3} value={qc.diem_noi_bat} onChange={(e) => setQc({ diem_noi_bat: e.target.value })} placeholder="Không gọng, nâng nhẹ từ hai bên, vải dệt liền mềm, dây vai bản rộng, cài trước…" /></O>
            <O span label="Ảnh sản phẩm thật" hint="dán Ctrl+V · nút Dán (điện thoại) · kéo thả · chọn file · URL. Lưu kinh thánh → ảnh vào anchor sản phẩm, AI giữ đúng màu/dáng khi sinh cảnh.">
              <ImageAttach value={qc.anh} onChange={(urls) => setQc({ anh: urls })} max={10} nhanBo="Bỏ ảnh"
                upload={async (du) => { const r = await taiAnhLen(du); return r.ok ? { ok: true, url: r.data } : { ok: false, error: r.loi }; }} />
            </O>
            <MauQcForm phimId={phim.id} qc={qc} setQc={setQc} coAnthropic={khoa.anthropic} />
          </div>
        </details>
      )}
    <details className="xv-det xv-panel" open={moKhung}>
      <summary onClick={latKhung}>1 · Kinh thánh của bộ phim <small>{kt.phong_cach ? `${kt.ti_le} · ${kt.do_phan_giai}` : 'chưa đặt phong cách'} · {kt.the_loai ? `🎭 ${THE_LOAI.find((t) => t.key === kt.the_loai)?.ten}` : <b style={{ color: 'var(--amber)' }}>⚠ chưa chọn thể loại (thư viện điện ảnh dựa vào đây)</b>}{kt.logline ? ` · “${kt.logline.slice(0, 70)}”` : ''}</small></summary>

      <div className="xv-grid" style={{ marginTop: 10 }}>
        <O span label="Phong cách hình ảnh" hint="Viết như tả cho hoạ sĩ: chất liệu, bảng màu, ánh sáng, lens. Tiếng Việt hay Anh đều được. Nối vào đầu mọi prompt để các tập giống nhau.">
          <textarea className="xv-ta" rows={2} value={kt.phong_cach} onChange={(e) => set('phong_cach', e.target.value)} placeholder={laQc ? "Quay thật kiểu UGC, ánh sáng cửa sổ, cầm tay, chân thực…" : "3D hoạt hình kiểu Pixar, màu ấm, ánh sáng mềm buổi sáng, khu rừng cổ tích…"} />
        </O>
        <O span label="Mô tả / tiền đề"><textarea className="xv-ta" rows={2} value={moTa} onChange={(e) => setMoTa(e.target.value)} placeholder="Bộ phim kể về… / Sản phẩm là… bán cho…" /></O>
        <O label={<>Thể loại{nutAi('the_loai')}</>} hint="quyết định thư viện cỡ cảnh / ánh sáng / âm thanh / nhạc Claude chọn cho từng shot"><Chon value={kt.the_loai} onChange={(v) => set('the_loai', v as TheLoai)} options={THE_LOAI.map((t) => ({ value: t.key, label: t.ten, title: t.mo_ta, phu: t.mo_ta.split(',')[0] }))} placeholder="chọn thể loại…" minWidth={220} /></O>
        <O label={<>Logline{nutAi('logline')}</>} hint="một câu: ai · muốn gì · cái gì cản"><input className="xv-in" value={kt.logline} onChange={(e) => set('logline', e.target.value)} placeholder={laQc ? "Phụ nữ 50+ mỏi vai vì bra gọng tìm được chiếc bra nâng mặc cả ngày quên" : "Rùa con chậm chạp phải băng qua rừng úa để cứu cây mẹ trước khi mùa đông tới"} /></O>
        <O label={<>Chủ đề{nutAi('chu_de')}</>} hint="điều bộ phim muốn nói"><input className="xv-in" value={kt.chu_de} onChange={(e) => set('chu_de', e.target.value)} placeholder={laQc ? "Thoải mái mà vẫn đẹp" : "Chậm mà bền, đi cùng nhau thì tới"} /></O>
        <O label="Khung hình"><Seg options={[{ value: '9:16', label: '9:16 dọc' }, { value: '16:9', label: '16:9 ngang' }]} value={kt.ti_le} onChange={(v) => set('ti_le', v)} /></O>
        <O label="Độ phân giải video"><Seg options={[{ value: '720p', label: '720p (rẻ)' }, { value: '1080p', label: '1080p' }]} value={kt.do_phan_giai} onChange={(v) => set('do_phan_giai', v)} /></O>
        <O label="Model ảnh (mặc định)"><Chon value={kt.mo_hinh_anh} onChange={(v) => set('mo_hinh_anh', v as Required<KinhThanh>['mo_hinh_anh'])} options={luaChonAnh(moHinh.anh.length ? moHinh.anh : MO_HINH_ANH.map((m) => ({ key: m.key, label: m.label, nhom: '', giaCents: m.gia1k, donVi: 'anh' as const })))} /></O>
        <O label="Model video (mặc định)"><Chon value={kt.mo_hinh_video} onChange={(v) => set('mo_hinh_video', v as Required<KinhThanh>['mo_hinh_video'])} options={luaChonVideo(moHinh.video.length ? moHinh.video : MO_HINH_VIDEO.map((m) => ({ key: m.key, label: m.label, nhom: '', giaCents: m.giaGiay['720p'], donVi: 'giay' as const })), 5, kt.do_phan_giai)} /></O>
        <O label="Model chữ (kịch bản, tách cảnh)"><Chon value={kt.mo_hinh_chu} onChange={(v) => set('mo_hinh_chu', v as Required<KinhThanh>['mo_hinh_chu'])} options={MO_HINH_CHU.map((m) => ({ value: m.key, label: m.label, nhom: 'Anthropic' }))} /></O>
        <O label="Ngôn ngữ lời thoại"><Chon value={kt.ngon_ngu} onChange={(v) => set('ngon_ngu', v)} options={[{ value: 'vi', label: 'Tiếng Việt' }, { value: 'en', label: 'English' }]} /></O>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Nut ly={!dirty && 'đã lưu'} ban={luu} chinh onClick={() => void luuNgay(kt, moTa)}>Lưu kinh thánh</Nut>
        <span style={{ ...mono, color: dirty ? 'var(--amber)' : 'var(--lime)' }}>{luu ? '… đang lưu' : dirty ? '● chưa lưu — tự lưu sau 1,5 giây' : luuLuc ? `✓ đã lưu ${luuLuc}` : '✓ đã lưu'}</span>
        <Nut ly={thieuSp && 'khai sản phẩm/dịch vụ ở mục 0 trước (hoặc dán link rồi bấm Lấy từ link)'} ban={ai} title="Claude đọc tên phim, loại, sản phẩm (quảng cáo), tuyến nhân vật, các tập đã có → viết phong cách + tiền đề + thể loại + logline. Chỉ điền vào ô, anh xem rồi Lưu." onClick={() => void goiY()}>{ai ? '… AI đang viết' : '✨ AI gợi ý phong cách + tiền đề'}</Nut>
      </div>
      <Loi>{loiAi}</Loi>
    </details>
    </>
  );
}
