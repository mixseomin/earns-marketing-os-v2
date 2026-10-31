'use client';
import { ThanhPhanTap } from './thanh-phan-ui';
import { kgCua } from '@/lib/xuong-video/khong-gian';
// Mục 3 một tập: brief → kịch bản → tách cảnh → storyboard/timeline → âm thanh → xuất.
import { HoSoTap } from './ho-so';
import { useCallback, useEffect, useRef, useState } from 'react';
import { khaiNguCanh } from '@/lib/ngu-canh';
import { Timeline } from './timeline';
import { LuoiKichBan } from './luoi-kich-ban';
import { Ngan } from './ngan';
import { moNgan } from './ngan-chung';
import { MO_HINH_AM } from '@/lib/xuong-video/am-thanh';
import { quyTrinh, phimQt } from '@/lib/xuong-video/quy-trinh';
import { kiemQc } from '@/lib/xuong-video/kiem-qc';
import { luuKhuonTap, apDiemNhan, dsCanh, suaTap, vietKichBanTap, tachCanhTap, suaCanh, datKhungLaiTat, themCanh, sinhKeyframe, uocTien, sinhVideoCanh, kiemVideo, xepCanh, sinhGiong, sinhAmThanh, sinhNhac, uocAm, goiYAIBrief, xuatTap, xuatLongTiengVi, daDangMayTap, trangThaiXuat, khopNhipNhac, khopGiongTapAction, doiCta } from '@/lib/actions';
import { thanhPhanCanh, docKinhThanh, giaChuUoc, tien, thieuQc, giayPhat, cacNhanh, locNhanh, thoiLuongMacDinh, gioVN, coMau, giayMau, banHien, type Phim, type NhanVat, type Tap, type Canh } from '@/lib/xuong-video/kieu';
import { Chon } from './chon';
import { Khoa, TabPhim, KqChay, O, Nut, Loi, Menu, MucMenu, mono, goiAction } from './ui';
import { GiongNhanVat } from './nhan-vat';
import { Animatic } from './animatic';
import { theoNgonNgu } from '@/lib/xuong-video/ban-dich';
import { CanhRow } from './canh';
import { ChayChon } from './chay-chon';
import { BangDoiTuong } from './bang-doi-tuong';
import { BaiDangKem } from './bai-dang';
import { DichPhim } from './dich-phim';
import { useNho } from './nho';
import { useDinhKy } from './dinh-ky';
import { NguoiXem } from './nguoi-xem-ui';
import { MayDungStoryboard } from './may-dung-ui';
import { PhanCanhVe } from './phan-canh-ve';
import { chanNguoiXem } from '@/lib/xuong-video/nguoi-xem';

export function TapView({ tap, phim, nhanVat, khoa, onChanged, tab, onMoNut }: { tap: Tap; phim: Phim; nhanVat: NhanVat[]; khoa: Khoa; onChanged: () => Promise<void>; tab: TabPhim; /** nhảy tới một nút trên cây phim (vd 'nv-<id>') */ onMoNut?: (nut: string) => void }) {
  const [kichBan, setKichBan] = useState(tap.kich_ban);
  const [tenTap, setTenTap] = useState(tap.ten);
  const [brief, setBrief] = useState(tap.brief);
  const [thoiLuong, setThoiLuong] = useState(tap.thoi_luong_s ?? thoiLuongMacDinh(phim.loai));
  // Nhánh hook đang xem (A/B/C) — thân chung + hook của nhánh; bản xuất cũng theo nhánh.
  const [nhanh, setNhanh] = useState<string | null>(null);
  // Bản xuất đang dựng (job id) — hỏi máy chủ 5s/lần tới khi xong rồi tải lại tập để danh sách bản xuất hiện tệp mới.
  const [jobXuat, setJobXuat] = useState<number | null>(null);
  const [loiXuat, setLoiXuat] = useState('');
  useDinhKy(async () => {
    if (jobXuat == null) return;
    const r = await trangThaiXuat(jobXuat); if (r.trang_thai === 'cho') return;
    setJobXuat(null); if (r.trang_thai === 'loi') setLoiXuat(r.loi || 'xuất lỗi'); else { setLoiXuat(r.loi ? `Đã xuất, ${r.loi}` : ''); await onChanged(); }
  }, jobXuat == null ? null : 5000, { caKhiAn: true });
  const [soCanh, setSoCanh] = useState(0);
  const [canh, setCanh] = useState<Canh[] | null>(null);
  // shot KẾ cùng phân đoạn, cùng nhánh chính — sơ đồ khung cuối cần biết shot sau (cắt giữa động tác: đầu bắt đầu quay theo hướng shot sau)
  const shotSau = (c: Canh): Canh | null => (canh ?? []).filter((x) => x.phan_doan === c.phan_doan && x.thu_tu > c.thu_tu && (x.nhanh ?? '') === (c.nhanh ?? '')).sort((a, b) => a.thu_tu - b.thu_tu)[0] ?? null;
  // Bận theo TỪNG nút (không một khoá chung): bấm keyframe cảnh 2 không khoá nút cảnh 3, 4… — chỉ Tách cảnh mới khoá cả tập.
  const [banSet, setBanSet] = useState<ReadonlySet<string>>(new Set());
  const ban = (k: string) => banSet.has(k);
  const banTach = banSet.has('tach');
  const [loi, setLoi] = useState('');
  const [animatic, setAnimatic] = useState(false);
  const [moChon, setMoChon] = useState(false);
  const [moBang, setMoBang] = useState(false);
  // 3c xem dạng timeline (mặc định, kiểu CapCut) hoặc danh sách; nhớ theo trình duyệt.
  const [xem, setXem] = useNho<'timeline' | 'luoi' | 'ds' | 'phan_canh'>('xv-xem-3c', 'timeline', ['timeline', 'luoi', 'ds', 'phan_canh'], 'sbx');   // ?sbx= — link mở đúng kiểu xem (#1255)
  // Tiếng đang xem trên timeline + toàn màn hình: '' = bản gốc, 'vi' = bản lồng tiếng Việt đã lưu trong shot (ban-dich.ts › theoNgonNgu). Nhớ trên URL (?tln=vi).
  const [tiengXem, setTiengXem] = useNho<'' | 'vi'>('xv-tln', '', ['', 'vi'], 'tln');
  const [chonCanh, setChonCanh] = useState<number | null>(null);
  const [xemShot, setXemShot] = useState<number | null>(null);   // shot mở chi tiết từ lưới (ngăn kéo)
  const [uoc, setUoc] = useState<{ anh1: number; videoTong: number; soCanhDuyet: number; giayDuyet: number } | null>(null);
  const [uocA, setUocA] = useState<Awaited<ReturnType<typeof uocAm>> | null>(null);
  const [mhNhac, setMhNhac] = useState('cassetteai/music-generator');
  const [loiUoc, setLoiUoc] = useState('');
  const kt = docKinhThanh(phim.kinh_thanh);
  const hien = banHien(tap.xuat);
  const mayDung = phim.loai === 'may_dung';
  // Bản lồng tiếng Việt đã lưu trong shot (ban-dich.ts) — timeline + toàn màn hình xem bằng nút 🇻🇳 trên hàng Storyboard.
  const vi = canh ? theoNgonNgu(locNhanh(canh, nhanh), 'vi') : null; const xemVi = tiengXem === 'vi' && kt.ngon_ngu !== 'vi' && !!vi?.coDich;
  const kyTuLoi = locNhanh(canh ?? [], 'A').reduce((a, c) => a + (c.thoai ?? []).reduce((b, d) => b + d.loi.trim().length, 0), 0);
  const thieuSp = thieuQc(phim.loai, kt);
  // Có QC mẫu → tách cảnh bám mẫu: số shot + thời lượng lấy từ mẫu, ô nhập tay khoá lại cho khỏi hiểu nhầm.
  const mauQc = phim.loai === 'quang_cao' && coMau(kt.qc) ? kt.qc.mau! : null;
  // Dấu vân của danh sách cảnh: đổi (sinh xong keyframe/video, duyệt, thêm/bớt cảnh) → báo phim tải lại để chip thống kê
  // đầu phim chạy theo thời gian thực (card #1191). So dấu chứ không báo mỗi lần hỏi, để không tải phim vô ích mỗi 4 giây.
  const dauCanh = useRef('');
  // NHẸ (anh 31/10/2026 "Storyboard nặng quá"): hỏi định kỳ mà danh sách shot KHÔNG đổi → giữ nguyên mảng cũ (không vẽ lại timeline) và không
  // tính lại giá; giá âm thanh chỉ hỏi lại khi shot đổi hoặc nhạc đang sinh. Trước đây 8s/lần: thay mảng mới + uocTien + uocAm (gọi dsCanh lần
  // hai + đọc danh mục giọng) — server action Next chạy NỐI ĐUÔI, nên mỗi cú bấm phải xếp hàng sau đống hỏi đó.
  const jsonCanh = useRef('');
  const dangNhacRef = useRef(0);
  const taiCanh = useCallback(async () => {
    const ds = await dsCanh(tap.id);
    const j = JSON.stringify(ds);
    const doi = j !== jsonCanh.current;
    if (doi) { jsonCanh.current = j; setCanh(ds); setUoc(await uocTien(tap.id)); }
    // Giá âm thanh nạp riêng (lần đầu phải đọc danh mục giọng fal, chậm) — không bắt danh sách cảnh hay dòng nút âm thanh chờ nó.
    if (doi || dangNhacRef.current > 0) void uocAm(tap.id).then((u) => { setUocA(u); setLoiUoc(''); }).catch((e) => setLoiUoc(`Không tính được giá âm thanh: ${e instanceof Error ? e.message : String(e)}`));
    if (!doi) return;
    const dau = ds.map((c) => `${c.id}:${c.trang_thai}:${c.keyframe_uv.length}:${c.video_url ? 1 : 0}:${c.video_cuoi_url ? 1 : 0}:${c.thoi_luong_s}:${c.chi_phi_cents}`).join('|');
    if (dauCanh.current && dau !== dauCanh.current) void onChanged();
    dauCanh.current = dau;
  }, [tap.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void taiCanh(); }, [taiCanh]);
  // 🔎 Tìm nhanh (tim-nhanh.tsx) mở sổ / bộ set / nối khung của ĐÚNG tập đang xem.
  useEffect(() => khaiNguCanh({ phimId: phim.id, tenPhim: phim.ten, tapId: tap.id, soTap: tap.so, tenTap: tap.ten }), [phim.id, phim.ten, tap.id, tap.so, tap.ten]);
  useEffect(() => { setKichBan(tap.kich_ban); setTenTap(tap.ten); setBrief(tap.brief); }, [tap.kich_ban, tap.ten, tap.brief]);

  // Poll Veo khi có cảnh đang sinh (Veo chạy 1-3 phút). Dừng ngay khi không còn job chạy.
  const dangSinh = (canh ?? []).some((c) => c.trang_thai === 'dang_sinh');
  const dangSinhAnh = (canh ?? []).some((c) => c.dang_sinh_anh || c.dang_sinh_am) || (uocA?.dangNhac ?? 0) > 0;
  // Nhạc sinh xong không đổi danh sách cảnh → phải tự báo phim tải lại thì khối nhạc mới hiện file (không bắt F5).
  const dangNhacTruoc = useRef(0);
  useEffect(() => { dangNhacRef.current = uocA?.dangNhac ?? 0; }, [uocA?.dangNhac]);
  useEffect(() => { const n = uocA?.dangNhac ?? 0; if (dangNhacTruoc.current > 0 && n < dangNhacTruoc.current) void onChanged(); dangNhacTruoc.current = n; }, [uocA?.dangNhac]); // eslint-disable-line react-hooks/exhaustive-deps
  // Thời gian thực: có việc ảnh đang chạy → hỏi lại 4s/lần; không có → 15s/lần (bấm ở tab khác / Worker xong muộn vẫn tự hiện). Tab ẩn thì thôi.
  // Nhàn rỗi vẫn hỏi 8s/lần: job do script trên box hay cửa sổ khác bắt đầu phải hiện ⏳ trên trang mà không cần F5 (anh 09/10/2026).
  useDinhKy(taiCanh, banTach ? null : dangSinhAnh ? 4000 : 8000);
  useDinhKy(async () => { const r = await kiemVideo(tap.id); if (r.vuaXong || r.conChay === 0) await taiCanh(); }, dangSinh ? 10_000 : null, { caKhiAn: true });

  /** Chạy một thao tác; trả câu lỗi ('' = được). taiCho: người gọi tự hiện lỗi NGAY CHỖ BẤM (thẻ shot) → không đẩy lên dòng lỗi đầu tập,
   *  nơi người bấm ở shot #7 không nhìn thấy (13/10/2026: bấm Sinh nháp bị chặn mà không thấy gì). */
  const chay = async (ten: string, fn: () => Promise<KqChay>, taiCho = false): Promise<string> => {
    setBanSet((s) => new Set(s).add(ten)); if (!taiCho) setLoi('');
    const { loi: l } = await goiAction(fn);
    setBanSet((s) => { const n = new Set(s); n.delete(ten); return n; });
    if (!taiCho) setLoi(l);
    await taiCanh(); await onChanged();
    return l;
  };
  const kbDirty = kichBan !== tap.kich_ban || tenTap !== tap.ten || brief !== tap.brief;
  const soDuyet = (canh ?? []).filter((c) => c.trang_thai === 'duyet').length;
  const chuaKeyframe = (canh ?? []).filter((c) => !c.keyframe_url).length;
  const sanSang = (canh ?? []).filter((c) => !c.keyframe_url && thanhPhanCanh(c, nhanVat).thieu.length === 0);
  const kemThieu = chuaKeyframe - sanSang.length;

  // Chọn nhánh hook (A/B/C) — dùng ở nút 🎞 Storyboard của tập lẫn nút ⬇ Xuất của tập.
  const chonNhanh = !!canh?.length && cacNhanh(canh).length > 0 && (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }} title="Cùng một thân, nhiều hook để A/B trên Meta/TikTok — chọn nhánh để xem / xuất">
      <span style={mono}>hook:</span>
      {cacNhanh(canh).map((h) => <button key={h} type="button" className={`xv-btn${(nhanh ?? cacNhanh(canh)[0]) === h ? ' chinh' : ''}`} style={{ padding: '1px 7px' }} onClick={() => setNhanh(h)}>{h}</button>)}
    </span>
  );
  // Bộ kiểm "đạt chưa" (0đ, tức thì) gọn thành MỘT nút trên thanh (#1311 YDNI): số mục chưa đạt; bấm mở danh sách — mục hỏng trước, kèm cách sửa.
  const qcDs = canh?.length ? kiemQc({ loai: phim.loai, canh, nhanVat, qc: kt.qc, mucTieuS: tap.thoi_luong_s ?? thoiLuong, nhanh, ngonNgu: kt.ngon_ngu, lop: tap.lop }) : [];
  const qcHong = qcDs.filter((x) => !x.ok);
  const nutQc = qcDs.length > 0 && (
    <Menu nhan={qcHong.length ? `⚠ ${qcHong.length} mục chưa đạt ▾` : '✓ đạt bộ kiểm ▾'}>
      <div style={{ ...mono, padding: '2px 4px' }}>Bộ kiểm quảng cáo (0đ) — đỏ thì sửa shot (form cảnh / kéo mép / ＋ đối tượng) hoặc tách lại</div>
      {[...qcHong, ...qcDs.filter((x) => x.ok)].map((x) => (
        <div key={x.key} style={{ display: 'grid', gap: 2, padding: '3px 4px', borderLeft: `2px solid ${x.ok ? 'var(--lime)' : 'var(--red)'}` }}>
          <span style={{ fontSize: 11.5, color: x.ok ? 'var(--lime)' : 'var(--red)' }}>{x.ok ? '✓' : '✗'} {x.chu}</span>
          {!x.ok && x.chiTiet && <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{x.chiTiet}</span>}
        </div>
      ))}
    </Menu>
  );
  // 🎬 Quy trình chuẩn ngành (quy-trinh.ts): tiền kỳ → sản xuất → hậu kỳ; mục gác cổng (keyframe/video/xuất) chưa đạt thì máy chủ cũng từ chối.
  const qtDs = canh?.length ? quyTrinh({ tap, phim: phimQt(phim.loai, kt), canh: locNhanh(canh, nhanh), canhA: locNhanh(canh, 'A'), nhanVat }) : [];
  const qtThieu = qtDs.filter((x) => !x.ok);
  const congKe = qtThieu.find((x) => x.cong)?.cong;
  const nutQt = qtDs.length > 0 && (
    <Menu nhan={qtThieu.length ? `🎬 Quy trình ${qtDs.length - qtThieu.length}/${qtDs.length}${congKe ? ` · chặn ${congKe === 'keyframe' ? 'keyframe' : congKe === 'video' ? 'video' : 'xuất'}` : ''} ▾` : '🎬 Đủ quy trình ▾'}>
      <div style={{ ...mono, padding: '2px 4px' }}>Quy trình chuẩn ngành — mục có 🔒 chưa đạt thì máy chủ không cho chạy bước đó (không tốn tiền oan)</div>
      {(['Tiền kỳ', 'Sản xuất', 'Hậu kỳ'] as const).map((nh) => (
        <div key={nh} style={{ display: 'grid', gap: 2 }}>
          <b style={{ fontSize: 11, color: 'var(--fg-2)', padding: '4px 4px 0' }}>{nh}</b>
          {qtDs.filter((x) => x.nhom === nh).map((x) => (
            <div key={x.key} style={{ display: 'grid', gap: 2, padding: '3px 4px', borderLeft: `2px solid ${x.ok ? 'var(--lime)' : x.cong ? 'var(--red)' : 'var(--amber)'}` }}>
              <span style={{ fontSize: 11.5, color: x.ok ? 'var(--lime)' : x.cong ? 'var(--red)' : 'var(--amber)' }}>{x.ok ? '✓' : x.cong ? '🔒' : '○'} {x.ten}{!x.ok && x.cong ? ` — chặn ${x.cong}` : ''}</span>
              {!x.ok && <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{x.thieu.slice(0, 4).join(' · ')}{x.thieu.length > 4 ? ` · +${x.thieu.length - 4}` : ''}</span>}
              {!x.ok && <span style={{ ...mono }}>{x.lam}</span>}
              {!x.ok && x.key === 'shot_list' && <button type="button" className="xv-btn" style={{ justifySelf: 'start' }} disabled={ban('nhip')}
                title="Đổi chuyển động máy đúng các shot phạm luật nhịp hình (trùng shot trước / quá nhiều shot máy đứng yên). Không đổi cỡ cảnh. 0đ, ↶ Hoàn tác được."
                onClick={() => void chay('nhip', async () => { const r = await daDangMayTap(tap.id); await taiCanh(); return r; })}>🎥 Chuyển động máy theo nhịp (0đ)</button>}
            </div>
          ))}
        </div>
      ))}
    </Menu>
  );
  const giayPhatTong = canh?.length ? Math.round(locNhanh(canh, nhanh).reduce((a, c) => a + giayPhat(c), 0) * 10) / 10 : 0;
  return (
    <div>
      {/* Thứ tự theo mạch, trái → phải rồi xuống: 3a brief → 3b kịch bản → 3c storyboard. */}
      {tab === 'thanh_phan' && (canh === null ? <span style={mono}>…</span> : <ThanhPhanTap canh={canh} nhanVat={nhanVat} onXemShot={setXemShot} onMoAnchor={onMoNut ? (id) => onMoNut(`nv-${id}`) : undefined} />)}
      {tab === 'ho_so' && <HoSoTap tap={tap} phim={phim} canh={canh ?? []} nhanVat={nhanVat} onChanged={onChanged} />}
      {tab === 'kich_ban' && (<>
      {phim.loai === 'phim' && <O label="Tên tập"><input className="xv-in" value={tenTap} onChange={(e) => setTenTap(e.target.value)} placeholder="Cuộc đua bắt đầu" style={{ maxWidth: 420 }} /></O>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 2fr) minmax(320px, 3fr)', gap: 12, alignItems: 'start' }}>
        <div>
          <O label={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>3a · Brief (ý tưởng tập này) <Nut ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || thieuSp} ban={banTach || ban('brief')} title="Claude đọc tiền đề + tuyến nhân vật + tóm tắt các tập trước → gợi ý brief cho tập này" onClick={() => void chay('brief', async () => { const r = await goiYAIBrief(tap.id, thoiLuong); if (r.ok) setBrief(r.data); return r; })}>{ban('brief') ? '… AI' : '✨ AI gợi ý brief'}</Nut></span>}
            hint="Bỏ qua nếu đã có kịch bản sẵn — dán thẳng vào ô 3b bên phải.">
            <textarea className="xv-ta" rows={12} value={brief} onChange={(e) => setBrief(e.target.value)} onBlur={() => { if (brief !== tap.brief) void suaTap(tap.id, { brief }).then(onChanged); }}
              placeholder={phim.loai === 'quang_cao' ? 'Sản phẩm, điểm bán chính, khách mục tiêu, hook mở đầu, CTA…' : phim.loai === 'phim' ? 'Tập này kể gì, xung đột, kết tập mở ra tập sau…' : 'Ý tưởng, hook 3 giây đầu, twist, CTA…'} />
          </O>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="xv-in" type="number" min={8} max={300} value={thoiLuong} onChange={(e) => setThoiLuong(Number(e.target.value) || 30)} style={{ width: 70 }} title="tổng giây" />
            <span style={mono}>giây</span>
            <Nut ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || thieuSp || (!brief.trim() && 'viết brief trước')} ban={banTach || ban('viet')} title="Viết kịch bản từ brief → điền sang ô 3b"
              onClick={() => void chay('viet', async () => { const r = await vietKichBanTap(tap.id, brief, thoiLuong); if (r.ok) setKichBan(r.data); return r; })}>
              {ban('viet') ? '… đang viết' : '✍ Claude viết kịch bản →'}
            </Nut>
          </div>
        </div>
        <div>
          <O label="3b · Kịch bản"><textarea className="xv-ta" rows={12} value={kichBan} onChange={(e) => setKichBan(e.target.value)} placeholder={'Dán kịch bản, hoặc viết brief ở 3a rồi bấm "Claude viết kịch bản".\nCảnh 1: … \nCảnh 2: …'} /></O>
          {tap.tom_tat && <div style={{ ...mono, marginTop: -4, marginBottom: 6 }}>Tóm tắt (tập sau đọc): {tap.tom_tat}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Nut ly={!kbDirty && 'chưa sửa'} ban={banTach || ban('luu')} onClick={() => void chay('luu', async () => { await suaTap(tap.id, { kich_ban: kichBan, ten: tenTap, brief }); })}>Lưu brief + kịch bản</Nut>
            <DichPhim tap={tap} ngonNgu={kt.ngon_ngu} coAnthropic={khoa.anthropic} ban={banTach} onChanged={onChanged} />
            <span style={{ flex: 1 }} />
            {mauQc ? <span style={mono} title="Số shot + giây lấy từ bảng xương sống của QC mẫu (mục 0)">🎯 bám QC mẫu: {mauQc.shots.length} shot · {giayMau(mauQc)}s</span>
              : <input className="xv-in" type="number" min={0} max={40} value={soCanh || ''} onChange={(e) => setSoCanh(Number(e.target.value) || 0)} placeholder="số cảnh (tự)" style={{ width: 110 }} />}
            <Nut chinh ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!kichBan.trim() && 'chưa có kịch bản')} ban={banTach || ban('tach')}
              title={mauQc ? `Claude tách bám 1:1 QC mẫu: ${mauQc.shots.length} shot, đúng giây, đúng loại, chữ màn cùng ý — chỉ đổi sản phẩm` : 'Claude đọc kịch bản + anchor + biến thể → bảng cảnh 3c bên dưới. Cảnh đã có keyframe giữ nguyên.'}
              onClick={() => void chay('tach', async () => { if (kbDirty) await suaTap(tap.id, { kich_ban: kichBan, ten: tenTap, brief }); return tachCanhTap(tap.id, soCanh, thoiLuong); })}>
              {ban('tach') ? '… Claude đang tách' : mauQc ? '✂ Tách cảnh theo QC mẫu ↓' : '✂ Tách cảnh ↓'}
            </Nut>
          </div>
        </div>
      </div>
      {uoc && uoc.soCanhDuyet > 0 && <div style={{ ...mono, marginTop: 8, color: 'var(--amber)' }}>Đang chờ sinh video: {uoc.soCanhDuyet} cảnh · {uoc.giayDuyet}s ≈ {tien(uoc.videoTong)}</div>}
      </>)}
      {/* Kiểm người xem có hiểu không: luôn ở nút 📝 Kịch bản của tập (trên cây); chưa đạt thì hiện ĐẦU nút 🎞 Storyboard của tập / Xuất — đúng chỗ nó đang chặn keyframe + xuất. */}
      {/* Máy Dựng (may_dung) dựng bằng máy: không có lượt AI nào để kiểm người xem / quy trình / sinh — storyboard riêng (may-dung-ui.tsx). */}
      {!mayDung && !!canh?.length && (tab === 'kich_ban' || chanNguoiXem(tap.thu_nguoi_xem, locNhanh(canh, 'A')).length > 0) && (
        <NguoiXem tap={tap} canh={locNhanh(canh, 'A')} moHinhChu={kt.mo_hinh_chu} coAnthropic={khoa.anthropic} onChanged={onChanged} onMoShot={tab === 'storyboard' ? (so) => { const x = canh.find((c) => c.thu_tu === so); if (x) setChonCanh(x.id); } : undefined} />
      )}
      <Loi>{loi}</Loi>

      {tab === 'storyboard' && !mayDung && (
      <div className="xv-dinh" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
        {/* MỘT hàng đầu cho cả tab (13/10/2026 — trước là 5 hàng chồng: tiêu đề, tập, trạng thái, kiểu xem, tiếng). */}
        {!!canh?.length && <span style={{ display: 'inline-flex', gap: 2 }}>
          <button type="button" className={`xv-btn${xem === 'timeline' ? ' chinh' : ''}`} onClick={() => setXem('timeline')}>🎞 Timeline</button>
          <button type="button" className={`xv-btn${xem === 'luoi' ? ' chinh' : ''}`} onClick={() => setXem('luoi')} title="Lưới kịch bản: cả tập trên một màn — hình · mốc giờ · chữ màn · lời đọc, xếp theo phân cảnh">▤ Lưới</button>
          <button type="button" className={`xv-btn${xem === 'ds' ? ' chinh' : ''}`} onClick={() => setXem('ds')} title="Danh sách cảnh: mọi thẻ shot xếp dọc">☰ Cảnh</button>
          <button type="button" className={`xv-btn${xem === 'phan_canh' ? ' chinh' : ''}`} onClick={() => setXem('phan_canh')} title="Phân cảnh từng cảnh, tổng quan → chi tiết: tờ phác bố trí · thumbnail cả cảnh · bảng khối · keyframe đọc như truyện tranh">🎬 Phân cảnh</button>
        </span>}
        <strong style={{ fontSize: 12 }}>{canh?.length ?? '…'} cảnh{canh?.length ? ` · ${giayPhatTong}s` : ''}</strong>
        {chonNhanh}
        {nutQt}{nutQc}
        <span style={{ flex: 1 }} />
        {kt.ngon_ngu !== 'vi' && !!canh?.length && <>
          {xemVi && !!vi?.thieu && <span style={{ ...mono, color: 'var(--red)' }} title="Câu mới / đã sửa sau lần lồng tiếng — im khi xem. Bấm lại 🇻🇳 Lồng tiếng Việt ở nút ⬇ Xuất của tập (trên cây) (câu đã đọc dùng lại).">{vi.thieu} câu chưa có giọng Việt</span>}
          <button type="button" className={`xv-btn${xemVi ? ' chinh' : ''}`} disabled={!vi?.coDich} onClick={() => setTiengXem(xemVi ? '' : 'vi')}
            title={vi?.coDich ? (xemVi ? 'Đang xem + nghe bản lồng tiếng Việt — bấm để về bản gốc' : 'Xem + nghe bản lồng tiếng Việt trên timeline (chữ màn dịch, giọng Việt từng nhân vật). Sửa giây/chuyển cảnh vẫn áp vào bản gốc.') : 'Chưa có bản lồng tiếng Việt — bấm 🇻🇳 Lồng tiếng Việt ở nút ⬇ Xuất của tập (trên cây)'}>🇻🇳</button>
        </>}
        {/* Công cụ xem (0đ) gọn thành nút icon nhỏ (#1211, #1311); nối khung là công tắc + sơ đồ trong cùng một menu. */}
        <button type="button" className="xv-btn" style={{ opacity: 0.8 }} disabled={!(canh ?? []).some((c) => c.keyframe_url)} title="▶ Xem animatic cả tập (0đ) — đúng thứ tự, số giây, hiệu ứng, chuyển cảnh" onClick={() => setAnimatic(true)}>▶</button>
        <Menu nhan={tap.noi_khung ? '⛓ nối' : '⛓'}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, padding: '3px 4px', cursor: 'pointer' }} title="Khung cuối của mỗi clip = keyframe cảnh kế → các clip nối liền mạch; bản cuối sinh lại cũng giữ đúng hai đầu">
            <input type="checkbox" checked={tap.noi_khung} onChange={(e) => void chay('noi', async () => { await suaTap(tap.id, { noi_khung: e.target.checked }); })} /> Nối khung — khung cuối clip = keyframe cảnh sau
          </label>
          <MucMenu onClick={() => moNgan({ loai: 'noi-khung', tapId: tap.id })}>⛓ Sơ đồ nối khung cả tập (0đ)</MucMenu>
        </Menu>
        <button type="button" className={`xv-btn${moBang ? ' chinh' : ''}`} style={{ opacity: moBang ? 1 : 0.8 }} disabled={!canh?.length} title="▦ Đối tượng × shot: shot nào dùng sản phẩm/người/bối cảnh nào; đỏ = thiếu ảnh, vàng = khác màu / nhắc tên chưa gắn. 0đ" onClick={() => setMoBang((x) => !x)}>▦</button>
        {/* Sinh tốn tiền đi qua bảng chọn shot (chay-chon.tsx): thấy trước shot nào chưa chạy được / hệ quả nối khung, thoại — rồi mới bấm. */}
        <button type="button" className={`xv-btn${moChon ? ' chinh' : ''}`} disabled={!canh?.length || banTach}
          title={`Sinh theo lựa chọn: chọn shot để sinh keyframe hoặc video nháp — ${sanSang.length} shot sẵn sàng sinh keyframe${kemThieu ? `, ${kemThieu} còn thiếu thành phần` : ''}; ${soDuyet} shot đã duyệt chờ video${uoc ? ` (≈ ${tien(uoc.videoTong)})` : ''}`}
          onClick={() => setMoChon((x) => !x)}>☑ Sinh{soDuyet || sanSang.length ? ` · ${sanSang.length} 🖼 · ${soDuyet} 🎬` : ''}</button>
        <button type="button" className="xv-btn" disabled={banTach || ban('them')} onClick={() => void chay('them', async () => { await themCanh(tap.id); })}>+ Cảnh</button>
      </div>
      )}
      {tab === 'storyboard' && moBang && !!canh?.length && <BangDoiTuong canh={canh} nhanVat={nhanVat} onChonShot={setChonCanh} onDong={() => setMoBang(false)} />}
      {tab === 'storyboard' && moChon && !!canh?.length && (
        <ChayChon canh={canh} nhanVat={nhanVat} kt={kt} phimQt={phimQt(phim.loai, kt)} noiKhung={tap.noi_khung} tap={tap} ban={ban('chon')} onDong={() => setMoChon(false)}
          onChay={(viec, ids, model) => void chay('chon', async () => { for (const id of ids) { const r = viec === 'keyframe' ? await sinhKeyframe(id, 1, model) : await sinhVideoCanh(id, model, 'nhap', true); if (!r.ok) return r; } })} />
      )}
      {tab === 'xuat' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 12 }}>{canh?.length ?? '…'} cảnh · {giayPhatTong}s{tap.thoi_luong_s ? ` / mục tiêu ${tap.thoi_luong_s}s` : ''}</strong>
          {!mayDung && <>{chonNhanh}{nutQt}{nutQc}</>}
          <span style={{ flex: 1 }} />
          <Nut chinh ly={!(canh ?? []).some((c) => c.video_url || c.video_cuoi_url || c.keyframe_url) && 'chưa có clip/keyframe nào'} ban={jobXuat != null}
            title="Dựng MP4 hoàn chỉnh trên máy chủ (0đ): nối clip theo giây phát, giọng + hiệu ứng + nhạc, chữ màn (shot nào có), end card ưu đãi, chuẩn âm -14 LUFS, 1080p. Shot chưa có clip dùng keyframe tĩnh."
            onClick={async () => { setLoiXuat(''); const r = await xuatTap(tap.id, nhanh ?? cacNhanh(canh ?? [])[0] ?? null); if (!r.ok) setLoiXuat(r.loi); else setJobXuat(r.data); }}>
            {jobXuat != null ? '… đang dựng bản xuất (30–90s)' : `⬇ Xuất MP4${cacNhanh(canh ?? []).length ? ` · hook ${nhanh ?? cacNhanh(canh ?? [])[0]}` : ''}`}
          </Nut>
          {/* Bản lồng tiếng Việt: cùng hình + nhịp, chữ màn dịch, mọi câu đọc lại bằng đúng giọng nhân vật (ban-dich.ts) — vừa để người chỉ
              biết tiếng Việt xem hộ, vừa là track tiếng Việt gắn vào video gốc trên YouTube. Không thay bản xuất chính. */}
          {!mayDung && kt.ngon_ngu !== 'vi' && <Nut ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!(canh ?? []).some((c) => c.video_url || c.video_cuoi_url || c.keyframe_url) && 'chưa có clip/keyframe nào')} ban={jobXuat != null} gia={giaChuUoc(kt.mo_hinh_chu, 2500, 2500)}
            title={`Lồng tiếng Việt: dịch chữ màn + lời (1 lượt Claude, cùng nội dung thì nhớ bản dịch, 0đ lần sau), đọc lại ~${kyTuLoi} ký tự bằng đúng giọng từng nhân vật (tính vào gói ElevenLabs; câu đã đọc thì dùng lại). Ra MP4 để gửi người xem hộ + track tiếng M4A để gắn vào video gốc trên YouTube. Không thay bản xuất chính.`}
            onClick={async () => { setLoiXuat(''); const r = await xuatLongTiengVi(tap.id); if (!r.ok) setLoiXuat(r.loi); else setJobXuat(r.data); }}>🇻🇳 Lồng tiếng Việt · ~{tien(giaChuUoc(kt.mo_hinh_chu, 2500, 2500))} + {kyTuLoi} ký tự</Nut>}
          {/* Kho tài sản (ít dùng) → sau ⋯: cả tập thành khuôn QC dùng lại; tạo tập mới từ khuôn đã lưu. */}
          {!mayDung && <Menu>
            <MucMenu onClick={() => void chay('nhan', () => apDiemNhan(tap.id))}>✨ Điểm nhấn tự động — mỗi điểm cắt một hiệu ứng hình + tiếng theo loại shot (hook zoom + pop, nỗi đau rung + đập, CTA zoom + ka-ching…) · 0đ</MucMenu>
            <MucMenu onClick={() => void chay('khuon', () => luuKhuonTap(tap.id))}>🧩 Lưu tập làm khuôn QC — giây từng shot, chữ màn + lời, góc máy, prompt, kiểu chữ, bài đăng</MucMenu>
            <MucMenu onClick={() => moNgan({ loai: 'kho', dich: { phimId: tap.phim_id } })}>🧩 Tạo tập từ khuôn trong kho (chưa có hình/giọng)</MucMenu>
          </Menu>}
        </div>
      )}
      {tab === 'xuat' && <Loi>{loiXuat}</Loi>}
      {tab === 'xuat' && phim.loai === 'quang_cao' && <BaiDangKem tap={tap} coAnthropic={khoa.anthropic} thieuSp={thieuSp} onChanged={onChanged} />}
      {tab === 'xuat' && hien.ds.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
          <span style={mono}>Đã xuất:</span>
          {hien.ds.map((b) => (
            <span key={b.url} style={{ display: 'inline-flex', gap: 4 }}>
              <button type="button" className="xv-btn" onClick={() => moNgan({ loai: 'xem', url: b.url, ten: `${b.long_tieng ? `Lồng tiếng ${b.long_tieng}` : 'Bản xuất'}${b.nhanh ? ` · hook ${b.nhanh}` : ''} · ${b.giay}s` })} title={`${b.giay}s · ${gioVN(b.luc)}${b.canh_bao?.length ? `\nCHƯA ĐẠT:\n${b.canh_bao.join('\n')}` : ''}`} style={b.canh_bao?.length ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined}>{b.canh_bao?.length ? '⚠' : b.long_tieng === 'vi' ? '🇻🇳' : b.long_tieng ? '🌐' : '🎬'} {b.long_tieng ? `lồng tiếng ${b.long_tieng}` : b.nhanh ? `hook ${b.nhanh}` : 'bản'} · {b.giay}s · {gioVN(b.luc, { chiGio: true })}</button>
              {b.am_url && <a className="xv-btn" href={b.am_url} download title="Track tiếng (M4A) — YouTube Studio › Ngôn ngữ › Thêm âm thanh, gắn vào video gốc">🎧 track</a>}
            </span>
          ))}
        </div>
      )}
      {/* Cờ đỏ của bản CHÍNH mới nhất: máy đo sau xuất (khoảng im, lẫn giọng lời dẫn, thiếu nhạc) — không phải nghe lại mới biết. */}
      {tab === 'xuat' && !!hien.chinh?.canh_bao?.length && <Loi>{`Bản mới nhất chưa đạt: ${hien.chinh.canh_bao.join(' · ')}`}</Loi>}
      {tab === 'xuat' && hien.chinh && (
        <video key={hien.chinh.url} src={hien.chinh.url} controls preload="metadata" style={{ marginTop: 8, maxHeight: 420, borderRadius: 8, background: '#000', aspectRatio: kt.ti_le === '9:16' ? '9 / 16' : '16 / 9' }} />
      )}
      {tab === 'am_thanh' && (canh === null ? <span style={mono}>…</span> : !canh.length ? <div style={mono}>Chưa có cảnh — tách cảnh ở nút 📝 Kịch bản của tập (trên cây) trước.</div> : null)}
      {tab === 'am_thanh' && !!canh?.length && (() => {
        const u = uocA ?? { dangPhanDoan: [] as string[], dangCaTap: false, giong: 0, soThoai: canh.filter((c) => c.loi_thoai.trim()).length, sfx: 0, soSfx: canh.length, nhac: {} as Record<string, number>, giay: canh.reduce((a, c) => a + (c.thoi_luong_s || 5), 0), soPhanCanh: new Set(canh.map((c) => c.phan_doan).filter(Boolean)).size, dangNhac: 0 };
        const gia = (c: number) => (uocA ? tien(c) : '…');
        const nvNoi = nhanVat.filter((v) => v.loai === 'nhan_vat');
        return (
        <div className="xv-panel" style={{ marginTop: 8, padding: 10, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 12 }}>🗣 Giọng nhân vật</b><span style={mono}>(một giọng cố định cả bộ phim — bấm để chọn / nghe thử)</span>
            {nvNoi.map((v) => <span key={v.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 11.5 }}>{v.ten}:</span><GiongNhanVat v={v} onChanged={onChanged} /></span>)}
            {!nvNoi.length && <span style={mono}>chưa có nhân vật nào (tab 📖 Phim)</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ ...mono, gridColumn: '1 / -1', width: '100%', color: 'var(--fg-2)' }}>Thứ tự nên làm: <b>1.</b> chọn giọng nhân vật → sinh giọng (rẻ, làm sớm để biết độ dài thoại) · <b>2.</b> có video nháp rồi mới sinh hiệu ứng (sinh từ clip, khớp hành động) · <b>3.</b> chốt thứ tự + số giây rồi sinh nhạc theo phân cảnh. Hoặc bấm <b>＋</b> trên từng khối nét đứt ở timeline.</div>
          <b style={{ fontSize: 12 }}>🔊 Âm thanh</b>

          <Nut ly={(!khoa.fal && 'thiếu FAL_KEY') || (!u.soThoai && 'chưa shot nào có lời thoại')} ban={ban('giong')} gia={uocA ? u.giong : undefined} title="Đọc lời thoại mọi shot bằng giọng cố định của từng nhân vật (chọn ở tab 📖 Phim), cảm xúc theo shot" onClick={() => void chay('giong', () => sinhGiong(tap.id))}>🗣 Sinh giọng {u.soThoai} shot · {gia(u.giong)}</Nut>
          <Nut ly={(!khoa.fal && 'thiếu FAL_KEY') || (!u.soSfx && 'chưa shot nào có clip hay mô tả âm thanh')} ban={ban('sfx')} gia={uocA ? u.sfx : undefined} title="Shot có clip → sinh tiếng từ chính clip (khớp hành động); chưa có clip → từ mô tả âm thanh + kỹ thuật âm thanh của shot" onClick={() => void chay('sfx', () => sinhAmThanh(tap.id))}>🔊 Sinh hiệu ứng {u.soSfx} shot · {gia(u.sfx)}</Nut>
          <Chon nho value={mhNhac} onChange={setMhNhac} minWidth={200} title="Model nhạc" options={MO_HINH_AM.filter((m) => m.loai === 'nhac').map((m) => ({ value: m.key, label: m.ten, phu: `${tien(m.gia)}/phút`, title: m.ghiChu }))} />
          <Nut ly={(!khoa.fal && 'thiếu FAL_KEY') || (!u.soPhanCanh && 'chưa có phân cảnh — tách lại cảnh')} ban={ban('nhac')} gia={uocA ? u.nhac[mhNhac] : undefined} title="Mỗi phân cảnh một đoạn nhạc riêng: dài bằng phân cảnh, theo cảm xúc đầu→cuối + nhịp + kỹ thuật nhạc của các shot" onClick={() => void chay('nhac', () => sinhNhac(tap.id, mhNhac, '*'))}>🎵 Nhạc theo {u.soPhanCanh} phân cảnh · {gia(u.nhac[mhNhac] ?? 0)}</Nut>
          <Nut ly={!khoa.fal && 'thiếu FAL_KEY'} ban={ban('nhac1')} gia={uocA ? u.nhac[mhNhac] : undefined} title="Một bài nền chạy suốt cả tập" onClick={() => void chay('nhac1', () => sinhNhac(tap.id, mhNhac))}>🎵 Một bài cả tập ({u.giay}s)</Nut>
          <button type="button" className="xv-btn" title="Chọn nhạc nền đã sinh từ kho (0đ) — nhạc nào sinh xong cũng tự vào kho" onClick={() => moNgan({ loai: 'kho', dich: { tapId: tap.id } })}>📦 Nhạc từ kho</button>
          {u.dangNhac > 0 && <span style={{ ...mono, color: 'var(--violet)' }}>⏳ đang sinh {u.dangNhac} đoạn âm…</span>}
          {loiUoc && <span className="xv-loi">{loiUoc}</span>}
        </div>
        </div>
        );
      })()}

      {tab === 'storyboard' && (canh === null ? <span style={mono}>…</span> : canh.length === 0 ? (
        <div className="xv-panel" style={{ marginTop: 8, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Chưa có cảnh nào</div>
          <div style={{ ...mono, marginBottom: 12 }}>Bước 1 của mạch: Claude đọc kịch bản + tuyến nhân vật → chia thành cảnh (góc máy, hành động, lời thoại, prompt ảnh/video). Sau đó mới sinh keyframe → duyệt → video.</div>
          <Nut chinh ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!kichBan.trim() && 'ô Kịch bản bên trái đang trống — dán kịch bản hoặc bấm Claude viết kịch bản')} ban={banTach || ban('tach')}
            onClick={() => void chay('tach', async () => { if (kbDirty) await suaTap(tap.id, { kich_ban: kichBan, ten: tenTap, brief }); return tachCanhTap(tap.id, soCanh, thoiLuong); })}>
            {ban('tach') ? '… Claude đang tách cảnh (≈20s)' : '✂ Tách cảnh bằng Claude'}
          </Nut>
          <span style={{ ...mono, marginLeft: 10 }}>hoặc <button type="button" className="xv-btn" disabled={banTach || ban('them')} onClick={() => void chay('them', async () => { await themCanh(tap.id); })}>+ Cảnh</button> tự viết</span>
        </div>
      ) : mayDung ? <MayDungStoryboard tap={tap} canh={canh} /> : (
        <>
          {xem === 'timeline' ? (() => {
            const canhNhanh = locNhanh(canh, nhanh);
            const cc = canhNhanh.find((x) => x.id === chonCanh) ?? canhNhanh[0]!;   // thẻ shot bên dưới luôn sửa bản GỐC
            return (
              <>
                <Timeline canh={xemVi && vi ? vi.canh : canhNhanh} nhanVat={nhanVat} tap={tap} qc={kt.qc} laQc={phim.loai === 'quang_cao'} onDoiCta={(key) => void chay('cta', () => doiCta(phim.id, key))} tiLe={kt.ti_le} ngonNgu={xemVi ? 'vi' : kt.ngon_ngu} chon={cc.id} onChon={setChonCanh} onMoShot={setXemShot} theLoai={kt.the_loai} goi={kt.goi} onDoiKhuon={onChanged} onToanManHinh={() => setAnimatic(true)}
                  // Kéo mép = đổi giây PHÁT: ngắn hơn clip là cắt (không tốn tiền); dài hơn clip thì clip phải sinh lại dài hơn.
                  onDoiGiay={(id, g) => void chay(`c${id}`, () => { const c0 = canh.find((x) => x.id === id); return suaCanh(id, { phat_s: g, ...(c0 && g > (c0.thoi_luong_s || 4) ? { thoi_luong_s: Math.ceil(g) } : {}) }); })}
                  onKhopGiong={async () => { const r = await khopGiongTapAction(tap.id); await taiCanh(); await onChanged(); return r.ok ? `⏱ ${r.data.doi} shot đổi giây theo giọng · tổng ${r.data.tong}s${r.data.thieu ? ` · ${r.data.thieu} shot chưa có giọng` : ''}` : `⏱ ${r.loi}`; }}
                  onKhopNhip={async () => { const r = await khopNhipNhac(tap.id); await taiCanh(); await onChanged(); return r.ok ? `🎯 ${r.data.khop}/${r.data.diemCat} điểm cắt trúng phách (${r.data.bpm.join(' / ')} BPM) · ${r.data.doi} shot đổi giây phát` : `🎯 ${r.loi}`; }}
                  onDoiKhungLai={(id, tat) => void chay(`kl${id}`, () => datKhungLaiTat(id, tat))}
                  onDoiKyThuat={(ds) => void chay('kt', async () => { for (const x of ds) { const r = await suaCanh(x.id, { ky_thuat: x.ky_thuat }); if (!r.ok) return r; } return { ok: true as const }; })}
                  onDoiChuyenCanh={(id, key, giay) => void chay(`c${id}`, () => { const c0 = canh.find((x) => x.id === id); const kt0 = c0?.ky_thuat ?? {}; return suaCanh(id, { ky_thuat: { ...kt0, chuyen_canh: key || undefined, giay_cc: giay === undefined ? kt0.giay_cc : giay ?? undefined } }); })}
                  sinh={xemVi ? undefined : {
                    giong: (id, tuy) => void chay(`g${id}`, () => sinhGiong(tap.id, [id], tuy)),
                    sfx: (id, tuy) => void chay(`s${id}`, () => sinhAmThanh(tap.id, [id], undefined, tuy)),
                    nhac: (pd, model, moTa) => void chay(pd ? 'nhac' : 'nhac1', () => sinhNhac(tap.id, model, pd, moTa)),
                    mhNhac, ban: (k) => banTach || ban(k), dangPhanDoan: uocA?.dangPhanDoan ?? [], dangCaTap: uocA?.dangCaTap ?? false,
                  }}
                  // Thẻ shot đang chọn nằm ở panel THUỘC TÍNH bên phải (bố cục After Effects) — không còn chồng dưới timeline (13/10/2026).
                  theShot={<div data-ngu-canh={`tập #${tap.id} ${tap.ten} · cảnh đang mở #${cc.thu_tu} (id ${cc.id}) ${cc.canh} · ${cc.trang_thai}`}>
                    <CanhRow key={cc.id} c={cc} kg={kgCua(tap.khong_gian, cc)} sau={shotSau(cc)} nhanVat={nhanVat} kt={kt} khoa={khoa} phimLoai={phim.loai} ban={(k) => banTach || ban(k)} chay={chay} />
                  </div>}
                  onXep={(ids) => { setCanh((ds) => ds && ids.map((id, i) => ({ ...ds.find((x) => x.id === id)!, thu_tu: i + 1 }))); void chay('xep', () => xepCanh(tap.id, ids)); }} />
              </>
            );
          })() : xem === 'phan_canh' ? (
            <PhanCanhVe tap={tap} canh={locNhanh(canh, nhanh)} onMo={(id) => setXemShot(id)} />
          ) : xem === 'luoi' ? (
            <LuoiKichBan canh={locNhanh(canh, nhanh)} nhanVat={nhanVat} tap={tap} tiLe={kt.ti_le} laQc={phim.loai === 'quang_cao'} moHinhChu={kt.mo_hinh_chu} onChanged={async () => { await taiCanh(); await onChanged(); }} onMo={(id) => setXemShot(id)} />
          ) : (
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>{canh.map((c) => <CanhRow key={c.id} c={c} kg={kgCua(tap.khong_gian, c)} sau={shotSau(c)} nhanVat={nhanVat} kt={kt} khoa={khoa} phimLoai={phim.loai} ban={(k) => banTach || ban(k)} chay={chay} />)}</div>
          )}
        </>
      ))}
      {/* Bấm thẻ lưới = mở CHI TIẾT shot trong ngăn kéo (#1357), không đổi màn; muốn tới đúng chỗ trên timeline thì bấm link ở đầu ngăn. */}
      {xemShot != null && canh && (() => {
        const c = canh.find((x) => x.id === xemShot);
        if (!c) return null;
        return (
          <Ngan onClose={() => setXemShot(null)} tieuDe={`Shot #${c.thu_tu} · ${c.canh}`}
            nut={<button type="button" className="xv-btn" title="Đóng ngăn, chuyển sang Timeline và đặt con trỏ ở đầu shot này" onClick={() => { setXemShot(null); setChonCanh(c.id); setXem('timeline'); }}>⏱ Mở trên timeline</button>}>
            <CanhRow key={c.id} c={c} kg={kgCua(tap.khong_gian, c)} sau={shotSau(c)} nhanVat={nhanVat} kt={kt} khoa={khoa} phimLoai={phim.loai} ban={(k) => banTach || ban(k)} chay={chay} chiTiet />
          </Ngan>
        );
      })()}
      {animatic && canh && <Animatic canh={xemVi && vi ? vi.canh : locNhanh(canh, nhanh)} lop={tap.lop} qc={kt.qc} tiLe={kt.ti_le} ngonNgu={xemVi ? 'vi' : kt.ngon_ngu} onClose={() => setAnimatic(false)} />}
    </div>
  );
}

// ── Animatic: xem cả tập từ keyframe (0 đồng) ──────────────────────────────────────────────────────────────────
// Mỗi cảnh: ưu tiên bản cuối → nháp → keyframe (zoom/lia nhẹ kiểu Ken Burns) trong đúng số giây; trên hình chỉ có chữ màn, lời thoại ghi dưới khung và đọc bằng
// giọng trình duyệt (miễn phí). Mục đích: duyệt nhịp, thứ tự, độ dài TRƯỚC khi tốn tiền video.
