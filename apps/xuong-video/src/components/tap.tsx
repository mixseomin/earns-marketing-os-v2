'use client';
// Mục 3 một tập: brief → kịch bản → tách cảnh → storyboard/timeline → âm thanh → xuất.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Timeline } from './timeline';
import { moNgan } from './ngan-chung';
import { MO_HINH_AM } from '@/lib/xuong-video/am-thanh';
import { kiemQc } from '@/lib/xuong-video/kiem-qc';
import { dsCanh, suaTap, vietKichBanTap, tachCanhTap, suaCanh, themCanh, sinhKeyframe, uocTien, sinhVideoCanh, kiemVideo, xepCanh, sinhGiong, sinhAmThanh, sinhNhac, uocAm, goiYAIBrief, xuatTap, trangThaiXuat } from '@/lib/actions';
import { thanhPhanCanh, docKinhThanh, giaAnhCents, giaVideoCents, tien, thieuQc, giayPhat, cacNhanh, locNhanh, thoiLuongMacDinh, gioVN, type Phim, type NhanVat, type Tap, type Canh } from '@/lib/xuong-video/kieu';
import { Chon } from './chon';
import { Khoa, TabPhim, KqChay, O, Nut, Loi, mono } from './ui';
import { GiongNhanVat } from './nhan-vat';
import { Animatic } from './animatic';
import { CanhRow } from './canh';
import { useNho } from './nho';
import { useDinhKy } from './dinh-ky';

export function TapView({ tap, phim, nhanVat, khoa, onChanged, tab }: { tap: Tap; phim: Phim; nhanVat: NhanVat[]; khoa: Khoa; onChanged: () => Promise<void>; tab: TabPhim }) {
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
  // Bận theo TỪNG nút (không một khoá chung): bấm keyframe cảnh 2 không khoá nút cảnh 3, 4… — chỉ Tách cảnh mới khoá cả tập.
  const [banSet, setBanSet] = useState<ReadonlySet<string>>(new Set());
  const ban = (k: string) => banSet.has(k);
  const banTach = banSet.has('tach');
  const [loi, setLoi] = useState('');
  const [animatic, setAnimatic] = useState(false);
  // 3c xem dạng timeline (mặc định, kiểu CapCut) hoặc danh sách; nhớ theo trình duyệt.
  const [xem, setXem] = useNho<'timeline' | 'ds'>('xv-xem-3c', 'timeline', ['timeline', 'ds']);
  const [chonCanh, setChonCanh] = useState<number | null>(null);
  const [uoc, setUoc] = useState<{ anh1: number; videoTong: number; soCanhDuyet: number; giayDuyet: number } | null>(null);
  const [uocA, setUocA] = useState<Awaited<ReturnType<typeof uocAm>> | null>(null);
  const [mhNhac, setMhNhac] = useState('cassetteai/music-generator');
  const [loiUoc, setLoiUoc] = useState('');
  const kt = docKinhThanh(phim.kinh_thanh);
  const thieuSp = thieuQc(phim.loai, kt);
  // Dấu vân của danh sách cảnh: đổi (sinh xong keyframe/video, duyệt, thêm/bớt cảnh) → báo phim tải lại để chip thống kê
  // đầu phim chạy theo thời gian thực (card #1191). So dấu chứ không báo mỗi lần hỏi, để không tải phim vô ích mỗi 4 giây.
  const dauCanh = useRef('');
  const taiCanh = useCallback(async () => {
    const ds = await dsCanh(tap.id);
    setCanh(ds); setUoc(await uocTien(tap.id));
    // Giá âm thanh nạp riêng (lần đầu phải đọc danh mục giọng fal, chậm) — không bắt danh sách cảnh hay dòng nút âm thanh chờ nó.
    void uocAm(tap.id).then((u) => { setUocA(u); setLoiUoc(''); }).catch((e) => setLoiUoc(`Không tính được giá âm thanh: ${e instanceof Error ? e.message : String(e)}`));
    const dau = ds.map((c) => `${c.id}:${c.trang_thai}:${c.keyframe_uv.length}:${c.video_url ? 1 : 0}:${c.video_cuoi_url ? 1 : 0}:${c.thoi_luong_s}:${c.chi_phi_cents}`).join('|');
    if (dauCanh.current && dau !== dauCanh.current) void onChanged();
    dauCanh.current = dau;
  }, [tap.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void taiCanh(); }, [taiCanh]);
  useEffect(() => { setKichBan(tap.kich_ban); setTenTap(tap.ten); setBrief(tap.brief); }, [tap.kich_ban, tap.ten, tap.brief]);

  // Poll Veo khi có cảnh đang sinh (Veo chạy 1-3 phút). Dừng ngay khi không còn job chạy.
  const dangSinh = (canh ?? []).some((c) => c.trang_thai === 'dang_sinh');
  const dangSinhAnh = (canh ?? []).some((c) => c.dang_sinh_anh || c.dang_sinh_am) || (uocA?.dangNhac ?? 0) > 0;
  // Nhạc sinh xong không đổi danh sách cảnh → phải tự báo phim tải lại thì khối nhạc mới hiện file (không bắt F5).
  const dangNhacTruoc = useRef(0);
  useEffect(() => { const n = uocA?.dangNhac ?? 0; if (dangNhacTruoc.current > 0 && n < dangNhacTruoc.current) void onChanged(); dangNhacTruoc.current = n; }, [uocA?.dangNhac]); // eslint-disable-line react-hooks/exhaustive-deps
  // Thời gian thực: có việc ảnh đang chạy → hỏi lại 4s/lần; không có → 15s/lần (bấm ở tab khác / Worker xong muộn vẫn tự hiện). Tab ẩn thì thôi.
  useDinhKy(taiCanh, banTach ? null : dangSinhAnh ? 4000 : 15000);
  useDinhKy(async () => { const r = await kiemVideo(tap.id); if (r.vuaXong || r.conChay === 0) await taiCanh(); }, dangSinh ? 10_000 : null, { caKhiAn: true });

  const chay = async (ten: string, fn: () => Promise<KqChay>) => {
    setBanSet((s) => new Set(s).add(ten)); setLoi('');
    try { const r = await fn(); if (r && !r.ok) setLoi(r.loi ?? 'lỗi'); } catch (e) { setLoi(`Không gọi được máy chủ (${e instanceof Error ? e.message.slice(0, 80) : 'lỗi mạng'}) — studio vừa cập nhật thì bấm ↻ Tải lại.`); } finally { setBanSet((s) => { const n = new Set(s); n.delete(ten); return n; }); }
    await taiCanh(); await onChanged();
  };
  const kbDirty = kichBan !== tap.kich_ban || tenTap !== tap.ten || brief !== tap.brief;
  const soDuyet = (canh ?? []).filter((c) => c.trang_thai === 'duyet').length;
  const chuaKeyframe = (canh ?? []).filter((c) => !c.keyframe_url).length;
  const sanSang = (canh ?? []).filter((c) => !c.keyframe_url && thanhPhanCanh(c, nhanVat).thieu.length === 0);
  const kemThieu = chuaKeyframe - sanSang.length;

  // Chọn nhánh hook (A/B/C) — dùng ở tab Storyboard lẫn tab Xuất.
  const chonNhanh = !!canh?.length && cacNhanh(canh).length > 0 && (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }} title="Cùng một thân, nhiều hook để A/B trên Meta/TikTok — chọn nhánh để xem / xuất">
      <span style={mono}>hook:</span>
      {cacNhanh(canh).map((h) => <button key={h} type="button" className={`xv-btn${(nhanh ?? cacNhanh(canh)[0]) === h ? ' chinh' : ''}`} style={{ padding: '1px 7px' }} onClick={() => setNhanh(h)}>{h}</button>)}
    </span>
  );
  const giayPhatTong = canh?.length ? Math.round(locNhanh(canh, nhanh).reduce((a, c) => a + giayPhat(c), 0) * 10) / 10 : 0;
  return (
    <div>
      {/* Thứ tự theo mạch, trái → phải rồi xuống: 3a brief → 3b kịch bản → 3c storyboard. */}
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
            <span style={{ flex: 1 }} />
            <input className="xv-in" type="number" min={0} max={40} value={soCanh || ''} onChange={(e) => setSoCanh(Number(e.target.value) || 0)} placeholder="số cảnh (tự)" style={{ width: 110 }} />
            <Nut chinh ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!kichBan.trim() && 'chưa có kịch bản')} ban={banTach || ban('tach')}
              title="Claude đọc kịch bản + anchor + biến thể → bảng cảnh 3c bên dưới. Cảnh đã có keyframe giữ nguyên."
              onClick={() => void chay('tach', async () => { if (kbDirty) await suaTap(tap.id, { kich_ban: kichBan, ten: tenTap, brief }); return tachCanhTap(tap.id, soCanh, thoiLuong); })}>
              {ban('tach') ? '… Claude đang tách' : '✂ Tách cảnh ↓'}
            </Nut>
          </div>
        </div>
      </div>
      <div style={{ ...mono, marginTop: 8, lineHeight: 1.6 }}>
        Mạch: 3a brief → 3b kịch bản → <b>Tách cảnh</b> → 3c storyboard: <b>Sinh keyframe</b> ({tien(giaAnhCents(kt.mo_hinh_anh))}/ảnh) → chọn + <b>Duyệt</b> → <b>Sinh video</b> ({tien(giaVideoCents(kt.mo_hinh_video, kt.do_phan_giai, 8))}/8s).
        {uoc && uoc.soCanhDuyet > 0 && <span style={{ color: 'var(--amber)' }}> · Đang chờ sinh video: {uoc.soCanhDuyet} cảnh · {uoc.giayDuyet}s ≈ {tien(uoc.videoTong)}</span>}
      </div>
      </>)}
      <Loi>{loi}</Loi>

      {tab === 'storyboard' && (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 12 }}>Storyboard · {canh?.length ?? '…'} cảnh{canh?.length ? ` · phát ${giayPhatTong}s` : ''}</strong>
        {chonNhanh}
        <Nut ly={!(canh ?? []).some((c) => c.keyframe_url) && 'chưa có keyframe nào'} title="Xem cả tập từ keyframe (và clip đã có): đúng thứ tự, đúng số giây, có zoom nhẹ + lời thoại. Không tốn tiền." onClick={() => setAnimatic(true)}>▶ Xem animatic (0đ)</Nut>
        <label style={{ ...mono, display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer' }} title="Khung cuối của mỗi clip = keyframe cảnh kế → các clip nối liền mạch; bản cuối sinh lại cũng giữ đúng hai đầu">
          <input type="checkbox" checked={tap.noi_khung} onChange={(e) => void chay('noi', async () => { await suaTap(tap.id, { noi_khung: e.target.checked }); })} /> Nối khung (khung cuối = keyframe cảnh sau)
        </label>
        <span style={{ flex: 1 }} />
        <Nut ly={(!khoa.google && !khoa.openai && 'thiếu GOOGLE_API_KEY/OPENAI_API_KEY') || ((canh?.length ?? 0) === 0 && 'chưa có cảnh — bấm ✂ Tách cảnh trước') || (chuaKeyframe === 0 && 'mọi cảnh đã có keyframe') || (sanSang.length === 0 && `${kemThieu} cảnh còn thiếu thành phần (ảnh gốc/biến thể) — chuẩn bị ở mục 2`)} ban={banTach || ban('kf-all')}
          title={`Sinh 1 keyframe cho mỗi cảnh đủ thành phần (${sanSang.length} cảnh ≈ ${tien(sanSang.length * giaAnhCents(kt.mo_hinh_anh))})`}
          gia={sanSang.length * giaAnhCents(kt.mo_hinh_anh)} onClick={() => void chay('kf-all', async () => { for (const c of sanSang) { const r = await sinhKeyframe(c.id, 1); if (!r.ok) return r; } })}>
          {ban('kf-all') ? '… đang sinh ảnh' : `🖼 Sinh keyframe ${sanSang.length} cảnh sẵn sàng${kemThieu ? ` (${kemThieu} cảnh còn thiếu thành phần)` : ''}`}
        </Nut>
        <Nut chinh ly={(!khoa.google && !khoa.fal && 'thiếu khoá video (GOOGLE_API_KEY/FAL_KEY)') || ((canh?.length ?? 0) === 0 && 'chưa có cảnh — bấm ✂ Tách cảnh trước') || (soDuyet === 0 && 'chưa có cảnh nào được duyệt keyframe')} ban={banTach || ban('vid-all')}
          title={uoc ? `Veo: ${uoc.soCanhDuyet} cảnh · ${uoc.giayDuyet}s ≈ ${tien(uoc.videoTong)} — trừ vào khoá Google` : ''}
          gia={uoc?.videoTong} onClick={() => void chay('vid-all', async () => { for (const c of (canh ?? []).filter((x) => x.trang_thai === 'duyet')) { const r = await sinhVideoCanh(c.id); if (!r.ok) return r; } })}>
          {ban('vid-all') ? '… đang gửi Veo' : `🎬 Sinh video ${soDuyet} cảnh đã duyệt${uoc ? ` (≈ ${tien(uoc.videoTong)})` : ''}`}
        </Nut>
        <button type="button" className="xv-btn" disabled={banTach || ban('them')} onClick={() => void chay('them', async () => { await themCanh(tap.id); })}>+ Cảnh</button>
      </div>
      )}
      {tab === 'xuat' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 12 }}>Bản xuất · {canh?.length ?? '…'} cảnh · phát {giayPhatTong}s{tap.thoi_luong_s ? ` / mục tiêu ${tap.thoi_luong_s}s` : ''}</strong>
          {chonNhanh}
          <span style={{ flex: 1 }} />
          <Nut chinh ly={!(canh ?? []).some((c) => c.video_url || c.video_cuoi_url || c.keyframe_url) && 'chưa có clip/keyframe nào'} ban={jobXuat != null}
            title="Dựng MP4 hoàn chỉnh trên máy chủ (0đ): nối clip theo giây phát, giọng + hiệu ứng + nhạc, chữ màn (shot nào có), end card ưu đãi, chuẩn âm -14 LUFS, 1080p. Shot chưa có clip dùng keyframe tĩnh."
            onClick={async () => { setLoiXuat(''); const r = await xuatTap(tap.id, nhanh ?? cacNhanh(canh ?? [])[0] ?? null); if (!r.ok) setLoiXuat(r.loi); else setJobXuat(r.data); }}>
            {jobXuat != null ? '… đang dựng bản xuất (30–90s)' : `⬇ Xuất MP4${cacNhanh(canh ?? []).length ? ` · hook ${nhanh ?? cacNhanh(canh ?? [])[0]}` : ''}`}
          </Nut>
        </div>
      )}
      {tab === 'xuat' && <Loi>{loiXuat}</Loi>}
      {tab === 'xuat' && tap.xuat.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
          <span style={mono}>Đã xuất:</span>
          {tap.xuat.slice().reverse().slice(0, 6).map((b) => (
            <button key={b.url} type="button" className="xv-btn" onClick={() => moNgan({ loai: 'xem', url: b.url, ten: `Bản xuất${b.nhanh ? ` · hook ${b.nhanh}` : ''} · ${b.giay}s` })} title={`${b.giay}s · ${gioVN(b.luc)}`}>🎬 {b.nhanh ? `hook ${b.nhanh}` : 'bản'} · {b.giay}s · {gioVN(b.luc, { chiGio: true })}</button>
          ))}
        </div>
      )}
      {tab === 'xuat' && tap.xuat.length > 0 && (
        <video key={tap.xuat[tap.xuat.length - 1]!.url} src={tap.xuat[tap.xuat.length - 1]!.url} controls preload="metadata" style={{ marginTop: 8, maxHeight: 420, borderRadius: 8, background: '#000', aspectRatio: kt.ti_le === '9:16' ? '9 / 16' : '16 / 9' }} />
      )}
      {/* Bộ kiểm "đạt chưa" (0đ, tức thì): quảng cáo chấm hook/sản phẩm/bằng chứng/CTA/tốc độ nói; mọi loại chấm độ dài so với mục tiêu. */}
      {(tab === 'storyboard' || tab === 'xuat') && !!canh?.length && (() => {
        const ds = kiemQc({ loai: phim.loai, canh, nhanVat, qc: kt.qc, mucTieuS: tap.thoi_luong_s ?? thoiLuong, nhanh });
        if (!ds.length) return null;
        const hong = ds.filter((x) => !x.ok).length;
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }} title="Mỗi mục là một thứ quảng cáo thật đo được — đỏ thì sửa shot (form cảnh / kéo mép / ＋ đối tượng) hoặc tách lại">
            <span style={{ ...mono, color: hong ? 'var(--amber)' : 'var(--lime)' }}>{hong ? `${hong} mục chưa đạt` : '✓ đạt bộ kiểm'}</span>
            {ds.map((x) => <span key={x.key} title={x.chiTiet ?? x.chu} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 999, border: `1px solid ${x.ok ? 'var(--lime)' : 'var(--red)'}`, color: x.ok ? 'var(--lime)' : 'var(--red)', cursor: x.chiTiet ? 'help' : 'default' }}>{x.ok ? '✓' : '✗'} {x.chu}</span>)}
          </div>
        );
      })()}
      {tab === 'am_thanh' && (canh === null ? <span style={mono}>…</span> : !canh.length ? <div style={mono}>Chưa có cảnh — tách cảnh ở tab Kịch bản trước.</div> : null)}
      {tab === 'am_thanh' && !!canh?.length && (() => {
        const u = uocA ?? { dangPhanDoan: [] as string[], dangCaTap: false, giong: 0, soThoai: canh.filter((c) => c.loi_thoai.trim()).length, sfx: 0, soSfx: canh.length, nhac: {} as Record<string, number>, giay: canh.reduce((a, c) => a + (c.thoi_luong_s || 5), 0), soPhanCanh: new Set(canh.map((c) => c.phan_doan).filter(Boolean)).size, dangNhac: 0 };
        const gia = (c: number) => (uocA ? tien(c) : '…');
        const nvNoi = nhanVat.filter((v) => v.loai === 'nhan_vat');
        return (
        <div className="xv-panel" style={{ marginTop: 8, padding: 10, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 12 }}>🗣 Giọng nhân vật</b><span style={mono}>(một giọng cố định cả bộ phim — bấm để chọn / nghe thử)</span>
            {nvNoi.map((v) => <span key={v.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 11.5 }}>{v.ten}:</span><GiongNhanVat v={v} onChanged={onChanged} /></span>)}
            {!nvNoi.length && <span style={mono}>chưa có nhân vật nào ở mục 2</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ ...mono, gridColumn: '1 / -1', width: '100%', color: 'var(--fg-2)' }}>Thứ tự nên làm: <b>1.</b> chọn giọng nhân vật → sinh giọng (rẻ, làm sớm để biết độ dài thoại) · <b>2.</b> có video nháp rồi mới sinh hiệu ứng (sinh từ clip, khớp hành động) · <b>3.</b> chốt thứ tự + số giây rồi sinh nhạc theo phân cảnh. Hoặc bấm <b>＋</b> trên từng khối nét đứt ở timeline.</div>
          <b style={{ fontSize: 12 }}>🔊 Âm thanh</b>

          <Nut ly={(!khoa.fal && 'thiếu FAL_KEY') || (!u.soThoai && 'chưa shot nào có lời thoại')} ban={ban('giong')} gia={uocA ? u.giong : undefined} title="Đọc lời thoại mọi shot bằng giọng cố định của từng nhân vật (chọn ở mục 2), cảm xúc theo shot" onClick={() => void chay('giong', () => sinhGiong(tap.id))}>🗣 Sinh giọng {u.soThoai} shot · {gia(u.giong)}</Nut>
          <Nut ly={(!khoa.fal && 'thiếu FAL_KEY') || (!u.soSfx && 'chưa shot nào có clip hay mô tả âm thanh')} ban={ban('sfx')} gia={uocA ? u.sfx : undefined} title="Shot có clip → sinh tiếng từ chính clip (khớp hành động); chưa có clip → từ mô tả âm thanh + kỹ thuật âm thanh của shot" onClick={() => void chay('sfx', () => sinhAmThanh(tap.id))}>🔊 Sinh hiệu ứng {u.soSfx} shot · {gia(u.sfx)}</Nut>
          <Chon nho value={mhNhac} onChange={setMhNhac} minWidth={200} title="Model nhạc" options={MO_HINH_AM.filter((m) => m.loai === 'nhac').map((m) => ({ value: m.key, label: m.ten, phu: `${tien(m.gia)}/phút`, title: m.ghiChu }))} />
          <Nut ly={(!khoa.fal && 'thiếu FAL_KEY') || (!u.soPhanCanh && 'chưa có phân cảnh — tách lại cảnh')} ban={ban('nhac')} gia={uocA ? u.nhac[mhNhac] : undefined} title="Mỗi phân cảnh một đoạn nhạc riêng: dài bằng phân cảnh, theo cảm xúc đầu→cuối + nhịp + kỹ thuật nhạc của các shot" onClick={() => void chay('nhac', () => sinhNhac(tap.id, mhNhac, '*'))}>🎵 Nhạc theo {u.soPhanCanh} phân cảnh · {gia(u.nhac[mhNhac] ?? 0)}</Nut>
          <Nut ly={!khoa.fal && 'thiếu FAL_KEY'} ban={ban('nhac1')} gia={uocA ? u.nhac[mhNhac] : undefined} title="Một bài nền chạy suốt cả tập" onClick={() => void chay('nhac1', () => sinhNhac(tap.id, mhNhac))}>🎵 Một bài cả tập ({u.giay}s)</Nut>
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
      ) : (
        <>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button type="button" className={`xv-btn${xem === 'timeline' ? ' chinh' : ''}`} onClick={() => setXem('timeline')}>🎞 Timeline</button>
            <button type="button" className={`xv-btn${xem === 'ds' ? ' chinh' : ''}`} onClick={() => setXem('ds')}>☰ Danh sách cảnh</button>
          </div>
          {xem === 'timeline' ? (() => {
            const canhNhanh = locNhanh(canh, nhanh);
            const cc = canhNhanh.find((x) => x.id === chonCanh) ?? canhNhanh[0]!;
            return (
              <>
                <Timeline canh={canhNhanh} nhanVat={nhanVat} tap={tap} tiLe={kt.ti_le} ngonNgu={kt.ngon_ngu} chon={cc.id} onChon={setChonCanh} onToanManHinh={() => setAnimatic(true)}
                  // Kéo mép = đổi giây PHÁT: ngắn hơn clip là cắt (không tốn tiền); dài hơn clip thì clip phải sinh lại dài hơn.
                  onDoiGiay={(id, g) => void chay(`c${id}`, () => { const c0 = canh.find((x) => x.id === id); return suaCanh(id, { phat_s: g, ...(c0 && g > (c0.thoi_luong_s || 4) ? { thoi_luong_s: Math.ceil(g) } : {}) }); })}
                  sinh={{
                    giong: (id, tuy) => void chay(`g${id}`, () => sinhGiong(tap.id, [id], tuy)),
                    sfx: (id, tuy) => void chay(`s${id}`, () => sinhAmThanh(tap.id, [id], undefined, tuy)),
                    nhac: (pd, model, moTa) => void chay(pd ? 'nhac' : 'nhac1', () => sinhNhac(tap.id, model, pd, moTa)),
                    mhNhac, ban: (k) => banTach || ban(k), dangPhanDoan: uocA?.dangPhanDoan ?? [], dangCaTap: uocA?.dangCaTap ?? false,
                  }}
                  onXep={(ids) => { setCanh((ds) => ds && ids.map((id, i) => ({ ...ds.find((x) => x.id === id)!, thu_tu: i + 1 }))); void chay('xep', () => xepCanh(tap.id, ids)); }} />
                <div data-ngu-canh={`tập #${tap.id} ${tap.ten} · cảnh đang mở #${cc.thu_tu} (id ${cc.id}) ${cc.canh} · ${cc.trang_thai}`}>
                  <CanhRow key={cc.id} c={cc} nhanVat={nhanVat} kt={kt} khoa={khoa} phimLoai={phim.loai} ban={(k) => banTach || ban(k)} chay={chay} />
                </div>
              </>
            );
          })() : (
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>{canh.map((c) => <CanhRow key={c.id} c={c} nhanVat={nhanVat} kt={kt} khoa={khoa} phimLoai={phim.loai} ban={(k) => banTach || ban(k)} chay={chay} />)}</div>
          )}
        </>
      ))}
      {animatic && canh && <Animatic canh={canh} tiLe={kt.ti_le} ngonNgu={kt.ngon_ngu} onClose={() => setAnimatic(false)} />}
    </div>
  );
}

// ── Animatic: xem cả tập từ keyframe (0 đồng) ──────────────────────────────────────────────────────────────────
// Mỗi cảnh: ưu tiên bản cuối → nháp → keyframe (zoom/lia nhẹ kiểu Ken Burns) trong đúng số giây; trên hình chỉ có chữ màn, lời thoại ghi dưới khung và đọc bằng
// giọng trình duyệt (miễn phí). Mục đích: duyệt nhịp, thứ tự, độ dài TRƯỚC khi tốn tiền video.
