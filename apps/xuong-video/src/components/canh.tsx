'use client';
// Một shot trên storyboard: thẻ cảnh, keyframe/clip, form sửa 3 tab.
import { useContext, useEffect, useState, type CSSProperties } from 'react';
import { moNgan, linkTai } from './ngan-chung';
import { dongThoai, tenNoi, LOI_DAN } from '@/lib/xuong-video/am-thanh';
import { THE_LOAI, NHOM_KY_THUAT, dsTheoNhom, hopTheLoai, nhanKyThuat, type TheLoai } from '@/lib/xuong-video/dien-anh';
import { suaCanh, xoaCanh, sinhKeyframe, chonKeyframe, duyetCanh, sinhVideoCanh, lamLaiTuKeyframe, sinhGiong, sinhAmThanh, xoaKeyframe, goiYAICanh, nangCapCanh, chonPhienBan, khopMiengCanh } from '@/lib/actions';
import { LOAI_NHAN_VAT, TRANG_THAI_CANH, thanhPhanCanh, NANG_CAP, KHOP_MIENG, MO_HINH_ANH, MO_HINH_VIDEO, tien, lamTronClip, gioVN, tenCamXuc, type NhanVat, type Canh, type KinhThanh, type LoaiPhim } from '@/lib/xuong-video/kieu';
import { Chon } from './chon';
import { Khoa, KqChay, O, Pill, Nut, Loi, AnhNho, DangSinh, mono, Menu, MucMenu } from './ui';
import { MoHinhCtx, giaVideoUi, giaAnhUi, luaChonAnh, luaChonVideo } from './mo-hinh-ui';
import { GiongNhanVat } from './nhan-vat';
import { NutNghe, ClipNho } from './media';

/** Keyframe nhỏ dưới video (#1218): có video rồi vẫn xem lại được ảnh gốc của clip (rê để phóng to, kèm ảnh so sánh). */
export function KfNho({ url, soSanh }: { url: string; soSanh: string }) {
  return (
    <img src={url} alt="" data-so-sanh={soSanh} title="Keyframe của clip — rê để phóng to"
      style={{ display: 'block', width: 34, height: 34, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)', marginTop: 4 }} />
  );
}

/** Trang phục của người trong shot — sửa ngay trên thẻ (Enter/blur là lưu). Trống = mặc như mô tả nhân vật. */
export function TrangPhucShot({ c, onLuu }: { c: Canh; onLuu: (t: string) => void }) {
  const [v, setV] = useState(c.trang_phuc);
  useEffect(() => { setV(c.trang_phuc); }, [c.trang_phuc]);
  const luu = () => { if (v.trim() !== c.trang_phuc.trim()) onLuu(v.trim()); };
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }} title="Trang phục trong shot này — đè lên bộ đồ trong mô tả nhân vật (mặt, tóc, dáng vẫn giữ)">
      <span style={{ fontSize: 11 }}>👗</span>
      <input className="xv-in" value={v} onChange={(e) => setV(e.target.value)} onBlur={luu} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); luu(); } }}
        placeholder="trang phục trong shot (trống = như mô tả nhân vật) · vd: chỉ mặc áo bra không gọng, không áo ngoài" style={{ fontSize: 11.5, padding: '3px 8px', flex: 1, maxWidth: 560 }} />
    </div>
  );
}

export function CanhRow({ c, nhanVat, kt, khoa, ban, chay, phimLoai }: { c: Canh; nhanVat: NhanVat[]; kt: Required<KinhThanh>; khoa: Khoa; phimLoai: LoaiPhim; ban: (k: string) => boolean; chay: (ten: string, fn: () => Promise<KqChay>) => Promise<void> }) {
  const [mo, setMo] = useState(false);
  const [tabF, setTabF] = useState<'noi_dung' | 'may' | 'ky_thuat'>('noi_dung');
  const [f, setF] = useState<Canh>(c);
  const [ai, setAi] = useState(false);
  const [loiAi, setLoiAi] = useState('');
  const moHinh = useContext(MoHinhCtx);
  // Shot cũ chỉ có chuỗi loi_thoai → mở form thì tách sẵn thành dòng ("Tên: lời") để sửa kiểu kịch bản.
  const tuChuoi = (x: Canh): Canh => (x.thoai.length || !x.loi_thoai.trim() ? x : { ...x, thoai: dongThoai(x, nhanVat) });
  // Danh sách cảnh tự làm mới 4-15 giây/lần (object mới): chỉ đồng bộ khi NỘI DUNG đổi và form sửa đang đóng — không ghi đè chỗ đang sửa.
  const cJson = JSON.stringify(c);
  useEffect(() => { if (!mo) setF(tuChuoi(JSON.parse(cJson) as Canh)); }, [cJson, mo]); // eslint-disable-line react-hooks/exhaustive-deps
  // AI điền form tại chỗ, KHÔNG qua chay() — chay tải lại cảnh và useEffect trên sẽ ghi đè mất phần AI vừa điền.
  const aiVietLai = async () => { setAi(true); setLoiAi(''); const r = await goiYAICanh(c.id, { canh: f.canh, goc_may: f.goc_may, hanh_dong: f.hanh_dong, loi_thoai: f.loi_thoai, nhan_vat: f.nhan_vat }); setAi(false); if (!r.ok) { setLoiAi(r.loi); return; } setF((x) => ({ ...x, ...r.data })); };
  const tt = TRANG_THAI_CANH[c.trang_thai] ?? TRANG_THAI_CANH.nhap;
  const dirty = JSON.stringify(f) !== JSON.stringify(c);
  const tatCaBt = nhanVat.flatMap((v) => (v.bien_the ?? []).map((b) => ({ ...b, nv: v.ten })));
  const doc = kt.ti_le === '9:16';
  const anhKhung: CSSProperties = { width: doc ? 90 : 160, height: doc ? 160 : 90, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)' };
  const k = `c${c.id}`;
  const tp = thanhPhanCanh(c, nhanVat);
  // Ảnh tham chiếu của các đối tượng cần khớp danh tính trong shot — nhân vật, sản phẩm, đạo cụ (bỏ bối cảnh), biến thể đang chọn nếu có —
  // đi kèm khi phóng to keyframe để so (#1215).
  const soSanh = JSON.stringify(tp.ds.filter((x) => x.anh && x.nv.loai !== 'boi_canh').map((x) => ({ ten: `${x.nv.ten}${x.bt ? ` · ${x.bt.ten}` : ''}`, url: x.anh })));
  // Model chọn tại cảnh (mặc định theo kinh thánh) — giá $ hiện trên ô chọn và nút.
  const [mhAnh, setMhAnh] = useState<string>(kt.mo_hinh_anh);
  const [mhVideo, setMhVideo] = useState<string>(kt.mo_hinh_video);
  useEffect(() => { setMhAnh(kt.mo_hinh_anh); setMhVideo(kt.mo_hinh_video); }, [kt.mo_hinh_anh, kt.mo_hinh_video]);
  const giay = mhVideo.startsWith('fal:') ? (c.thoi_luong_s || 5) : lamTronClip(c.thoi_luong_s);
  const dsAnh = moHinh.anh.length ? moHinh.anh : MO_HINH_ANH.map((m) => ({ key: m.key, label: m.label, nhom: '', giaCents: m.gia1k, donVi: 'anh' as const }));
  const dsVideo = moHinh.video.length ? moHinh.video : MO_HINH_VIDEO.map((m) => ({ key: m.key, label: m.label, nhom: '', giaCents: m.giaGiay['720p'], donVi: 'giay' as const }));
  const giaAnh = giaAnhUi(dsAnh, mhAnh);
  const giaVid = giaVideoUi(dsVideo, mhVideo, giay, kt.do_phan_giai);
  const giaNangCap = NANG_CAP.giaGiayCents * (c.thoi_luong_s || 8);
  const lyAnh = (!khoa.google && !khoa.openai && !(mhAnh.startsWith('fal:') && khoa.fal) && 'thiếu khoá ảnh') || (!c.prompt_anh.trim() && 'chưa có prompt ảnh (Sửa cảnh → prompt ảnh)') || (tp.thieu.length > 0 && `thiếu: ${tp.thieu.join('; ')}`);
  const lyVideo = mhVideo.startsWith('fal:') ? !khoa.fal && 'thiếu FAL_KEY' : !khoa.google && 'thiếu GOOGLE_API_KEY';
  const chonAnh = <Chon nho value={mhAnh} onChange={setMhAnh} options={luaChonAnh(dsAnh)} title="Model ảnh cho lần sinh này" minWidth={220} />;
  const chonVideo = <Chon nho value={mhVideo} onChange={setMhVideo} options={luaChonVideo(dsVideo, giay, kt.do_phan_giai)} title="Model video cho lần sinh này" minWidth={240} />;
  // Bước kế của cảnh → MỘT nút chính; còn lại vào menu ⋯ (YDNI).
  const buoc = c.trang_thai === 'dang_sinh' || c.dang_sinh_anh ? 'dang' : c.video_cuoi_url ? 'cuoi' : c.video_url && c.trang_thai === 'xong' ? 'nhap' : c.trang_thai === 'duyet' ? 'duyet' : c.keyframe_url ? 'kf' : 'trong';

  return (
    <div className="xv-canh">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, width: anhKhung.width }}>
          {c.video_cuoi_url ? <div><ClipNho url={c.video_cuoi_url} ten={`#${c.thu_tu} ${c.canh} · bản cuối`} style={anhKhung} /><div style={{ ...mono, color: 'var(--lime)', textAlign: 'center' }}>bản cuối</div>{c.keyframe_url && <KfNho url={c.keyframe_url} soSanh={soSanh} />}</div>
            : c.video_url ? <div><ClipNho url={c.video_url} ten={`#${c.thu_tu} ${c.canh} · nháp`} style={anhKhung} /><div style={{ ...mono, textAlign: 'center' }}>nháp</div>{c.keyframe_url && <KfNho url={c.keyframe_url} soSanh={soSanh} />}</div>
            : c.keyframe_url ? <div style={{ position: 'relative' }}><img src={c.keyframe_url} alt="" data-so-sanh={soSanh} style={anhKhung} />{buoc === 'dang' && <DangSinh chu="" />}</div>
            : <div style={{ ...anhKhung, position: 'relative', display: 'grid', placeItems: 'center', color: 'var(--fg-4)', fontSize: 10, overflow: 'hidden' }}>chưa có{buoc === 'dang' && <DangSinh chu={c.dang_sinh_anh ? 'ảnh' : 'video'} />}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...mono, color: 'var(--fg-2)' }}>#{c.thu_tu}</span>
            <strong style={{ fontSize: 12 }} title={c.goc_may}>{c.canh || 'Cảnh'}</strong>
            <Pill color={tt.color}>{tt.label}</Pill>
            <span style={mono} title={c.phat_s && c.phat_s !== c.thoi_luong_s ? `phát ${c.phat_s}s, clip sinh ${c.thoi_luong_s}s (cắt lấy phần đầu)` : undefined}>{c.phat_s && c.phat_s !== c.thoi_luong_s ? `phát ${c.phat_s}s / clip ${c.thoi_luong_s}s` : `${c.thoi_luong_s}s`}{c.chi_phi_cents > 0 ? ` · đã tốn ${tien(c.chi_phi_cents)}` : ''}</span>
            {c.nhanh && <Pill color="var(--amber)">hook {c.nhanh}</Pill>}
            {c.chu_man && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, border: '1px solid var(--line)', color: 'var(--fg-1)', fontWeight: 600 }} title="Chữ trên màn">✎ {c.chu_man}</span>}
          </div>
          {(
            <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {tp.ds.map(({ nv, bt, anh, thieu }) => (
                <span key={nv.id} title={thieu.length ? thieu.join('\n') : `${nv.ten}${bt ? ` · ${bt.ten}` : ''} — sẵn sàng`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 7px 2px 2px', borderRadius: 999, border: `1px solid ${thieu.length ? 'var(--red)' : 'var(--line)'}`, background: 'var(--bg-1)', fontSize: 10.5 }}>
                  {anh ? <img src={anh} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--red)' }}>!</span>}
                  <span>{nv.ten}{bt && <span style={{ color: 'var(--violet)' }}> · {bt.ten}</span>}</span>
                  {thieu.length > 0 && <span style={{ color: 'var(--red)' }}>thiếu</span>}
                </span>
              ))}
              {/* Thêm/bớt đối tượng ngay trên thẻ (#1210): nhân vật · sản phẩm · bối cảnh · đạo cụ — lưu luôn, keyframe sau tham chiếu đúng. */}
              <Chon nho multi values={c.nhan_vat.map(String)} onValues={(v) => void chay(k, () => suaCanh(c.id, { nhan_vat: v.map(Number) }))} minWidth={120} placeholder="＋ đối tượng"
                title="Thêm / bớt nhân vật, sản phẩm, bối cảnh, đạo cụ có trong shot (ảnh của chúng làm tham chiếu khi sinh keyframe)"
                options={nhanVat.map((v) => ({ value: String(v.id), label: v.ten, nhom: LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label, phu: v.anh_ref.length ? undefined : 'chưa ảnh' }))} />
              {phimLoai === 'quang_cao' && !nhanVat.some((v) => v.loai === 'san_pham' && c.nhan_vat.includes(v.id)) && nhanVat.some((v) => v.loai === 'san_pham') && <span style={{ fontSize: 10.5, color: 'var(--amber)' }}>⚠ shot chưa có sản phẩm</span>}
            </div>
          )}
          <div style={{ fontSize: 11.5, marginTop: 3, color: 'var(--fg-2)' }} title={c.loi_thoai ? `“${c.loi_thoai}”` : undefined}>{c.hanh_dong}</div>
          {nhanVat.some((v) => v.loai === 'nhan_vat' && c.nhan_vat.includes(v.id)) && (
            <TrangPhucShot c={c} onLuu={(t) => void chay(k, () => suaCanh(c.id, { trang_phuc: t }))} />
          )}
          {dongThoai(c, nhanVat).length > 0 && (
            <div style={{ marginTop: 4, padding: '4px 8px', borderLeft: '2px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {dongThoai(c, nhanVat).map((d, i) => (
                <div key={i} style={{ marginBottom: 2, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <b style={{ color: 'var(--cyan)', textTransform: 'uppercase' }}>{tenNoi(d)}</b>
                  {d.dien_xuat && <i style={{ color: 'var(--fg-3)' }}>({d.dien_xuat})</i>}
                  <span style={{ color: 'var(--fg-1)' }}>{d.loi}</span>
                  {d.url && <NutNghe url={d.url} title={`Nghe giọng ${tenNoi(d)}`} />}
                </div>
              ))}
            </div>
          )}
          {(() => { const ds = nhanKyThuat(c.ky_thuat); return ds.length ? <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>{c.phan_doan && <span style={{ ...mono, fontSize: 9.5, color: 'var(--violet)' }}>🎬 {c.phan_doan} ·</span>}{ds.map((x) => <span key={x} style={{ fontSize: 9.5, lineHeight: '15px', padding: '0 5px', borderRadius: 4, border: '1px solid var(--line)', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{x}</span>)}</div> : null; })()}
          {/* Giọng đã nằm ở từng dòng thoại phía trên; ở đây chỉ còn file giọng gộp cũ (không gán được dòng nào) + hiệu ứng. */}
          {((c.thoai_url && !dongThoai(c, nhanVat).some((d) => d.url)) || c.am_thanh_url || c.dang_sinh_am) && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              {c.thoai_url && !dongThoai(c, nhanVat).some((d) => d.url) && <NutNghe url={c.thoai_url} nhan="🗣 giọng" />}
              {c.am_thanh_url && <NutNghe url={c.am_thanh_url} nhan="🔊 hiệu ứng" />}
              {(c.dang_sinh_giong || c.dang_sinh_sfx) && <span style={{ ...mono, color: 'var(--violet)' }}>⏳ đang sinh {[c.dang_sinh_giong && 'giọng', c.dang_sinh_sfx && 'hiệu ứng'].filter(Boolean).join(' + ')}…</span>}
            </div>
          )}
          {tp.thieu.length > 0 && <div style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 3 }}>Chưa sinh được: {tp.thieu.join(' · ')} — chuẩn bị ở mục 2.</div>}
          <Loi>{c.loi}</Loi>
          {c.keyframe_uv.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {c.keyframe_uv.map((u) => (
                <AnhNho key={u} url={u} soSanh={soSanh} vien={u === c.keyframe_url ? 'var(--cyan)' : undefined} title={u === c.keyframe_url ? 'đang chọn' : 'chọn ảnh này làm keyframe'}
                  onClick={() => void chay(k, async () => { await chonKeyframe(c.id, u); })} onXoa={() => chay(k, () => xoaKeyframe(c.id, u))} />
              ))}
            </div>
          )}
          {c.video_phien_ban.length > 1 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={mono}>{c.video_phien_ban.length} phiên bản:</span>
              {c.video_phien_ban.map((v, i) => {
                const dung = v.url === c.video_url || v.url === c.video_cuoi_url;
                return (
                  <Menu key={v.url + i} nhan={`${dung ? '● ' : ''}${i + 1} ${v.ban === 'cuoi' ? 'cuối' : 'nháp'}`}>
                    <div style={{ ...mono, padding: '2px 4px' }}>{v.model}{v.luc ? ` · ${gioVN(v.luc)}` : ''}</div>
                    <MucMenu onClick={() => moNgan({ loai: 'xem', url: v.url, ten: `Cảnh #${c.thu_tu} · phiên bản ${i + 1}` })}>▶ Xem / tải</MucMenu>
                    {v.url !== c.video_url && <MucMenu onClick={() => void chay(i + 'n' + c.id, () => chonPhienBan(c.id, v.url, 'nhap'))}>Dùng làm nháp</MucMenu>}
                    {v.url !== c.video_cuoi_url && <MucMenu onClick={() => void chay(i + 'c' + c.id, () => chonPhienBan(c.id, v.url, 'cuoi'))}>Dùng làm bản cuối</MucMenu>}
                  </Menu>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            {buoc === 'trong' && <>{chonAnh}<Nut chinh ly={lyAnh} ban={ban(k)} onClick={() => void chay(k, () => sinhKeyframe(c.id, 1, mhAnh))} gia={giaAnh}>🖼 Sinh keyframe · {tien(giaAnh)}</Nut></>}
            {buoc === 'kf' && <Nut chinh ban={ban(k)} onClick={() => void chay(k, () => duyetCanh(c.id, true))}>✓ Duyệt keyframe</Nut>}
            {/* Sinh lại ảnh hiện ngay cạnh nút chính (không giấu trong ⋯): sửa trang phục / prompt / đối tượng xong là bấm lại được. Ảnh cũ vẫn giữ làm ứng viên. */}
            {(buoc === 'kf' || buoc === 'duyet' || buoc === 'nhap' || buoc === 'cuoi') && <>{chonAnh}<Nut ly={lyAnh} ban={ban(k)} title="Sinh thêm một ảnh keyframe mới theo prompt / trang phục / đối tượng hiện tại; ảnh cũ vẫn giữ trong dải ứng viên để chọn lại" onClick={() => void chay(k, () => sinhKeyframe(c.id, 1, mhAnh))} gia={giaAnh}>↻ Sinh lại ảnh · {tien(giaAnh)}</Nut></>}
            {buoc === 'duyet' && <>{chonVideo}<Nut chinh ly={lyVideo} ban={ban(k)} onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo))} gia={giaVid}>🎬 Sinh nháp · {giay}s · {tien(giaVid)}</Nut></>}
            {buoc === 'dang' && <span style={{ ...mono, color: 'var(--violet)' }}>{c.dang_sinh_anh ? 'đang sinh ảnh…' : 'đang sinh video, tự kiểm mỗi 10s…'}</span>}
            {(buoc === 'nhap' || buoc === 'cuoi') && <>{chonVideo}<Nut ly={lyVideo} ban={ban(k)} title="Sinh một bản nháp video mới từ keyframe đang chọn; bản cũ vẫn giữ trong danh sách phiên bản" onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo))} gia={giaVid}>↻ Sinh lại nháp · {giay}s · {tien(giaVid)}</Nut></>}
            {buoc === 'nhap' && <Nut chinh ly={!khoa.fal && 'thiếu FAL_KEY'} ban={ban(k)} title="Nâng cấp CHÍNH clip nháp (Topaz ×2): chuyển động, bố cục, nhân vật y hệt bản nháp" onClick={() => void chay(k, () => nangCapCanh(c.id))} gia={giaNangCap}>⬆ Làm bản cuối (nâng cấp nháp, khớp 100%) · {tien(giaNangCap)}</Nut>}
            {buoc === 'cuoi' && <a href={linkTai(c.video_cuoi_url!)} download className="xv-btn chinh" style={{ textDecoration: 'none' }}>⬇ Tải bản cuối</a>}
            {/* Sửa cảnh là việc hay làm nhất sau sinh ảnh → nút riêng cạnh ⋯ (#1228), không chôn trong menu. */}
            <button type="button" className={`xv-btn${mo ? ' chinh' : ''}`} onClick={() => setMo(!mo)} title="Sửa cảnh: nội dung, thoại, máy, prompt">✎ Sửa</button>
            <Menu>
              <div style={{ ...mono, padding: '2px 4px' }}>Model cho các lệnh bên dưới</div>
              <div style={{ display: 'grid', gap: 4 }}>{chonAnh}{chonVideo}</div>
              {c.loi_thoai.trim() && <MucMenu ly={!khoa.fal && 'thiếu FAL_KEY'} onClick={() => void chay(`g${c.id}`, () => sinhGiong(c.tap_id, [c.id]))}>🗣 {c.thoai_url ? 'Sinh lại' : 'Sinh'} giọng shot này</MucMenu>}
              <MucMenu ly={!khoa.fal && 'thiếu FAL_KEY'} onClick={() => void chay(`s${c.id}`, () => sinhAmThanh(c.tap_id, [c.id]))}>🔊 {c.am_thanh_url ? 'Sinh lại' : 'Sinh'} hiệu ứng âm thanh{c.video_url ? ' (từ clip)' : ''}</MucMenu>
              {(buoc === 'nhap' || buoc === 'cuoi') && dongThoai(c, nhanVat).some((d) => d.url) && <MucMenu ly={!khoa.fal && 'thiếu FAL_KEY'} gia={KHOP_MIENG.giaGiayCents * (c.thoi_luong_s || 8)} onClick={() => void chay(k, () => khopMiengCanh(c.id))}>👄 Khớp miệng với giọng đã sinh ({KHOP_MIENG.label}) · {tien(KHOP_MIENG.giaGiayCents * (c.thoi_luong_s || 8))}</MucMenu>}
              {(buoc === 'nhap' || buoc === 'cuoi') && <MucMenu onClick={() => void chay(k, () => lamLaiTuKeyframe(c.id))}>↩ Làm lại từ keyframe (đổi ảnh / duyệt lại — các bản video vẫn giữ trong phiên bản)</MucMenu>}
              {c.trang_thai === 'duyet' && <MucMenu onClick={() => void chay(k, () => duyetCanh(c.id, false))}>↩ Bỏ duyệt keyframe</MucMenu>}
              {c.trang_thai === 'loi' && buoc !== 'nhap' && buoc !== 'cuoi' && c.keyframe_url && <MucMenu ly={lyVideo} onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo))} gia={giaVid}>↻ Sinh lại nháp · {giay}s · {tien(giaVid)}</MucMenu>}
              {(buoc === 'nhap' || buoc === 'cuoi') && <MucMenu ly={lyVideo} onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo, 'cuoi'))} gia={giaVid}>🎬 Bản cuối = sinh lại bằng model đã chọn · {tien(giaVid)} (chuyển động có thể khác nháp)</MucMenu>}
              {buoc === 'cuoi' && <MucMenu ly={!khoa.fal && 'thiếu FAL_KEY'} onClick={() => void chay(k, () => nangCapCanh(c.id))} gia={giaNangCap}>⬆ Nâng cấp lại từ nháp · {tien(giaNangCap)}</MucMenu>}
              {c.video_url && <a data-dong="" href={linkTai(c.video_url)} download className="xv-btn" style={{ textDecoration: 'none' }}>⬇ Tải nháp</a>}
              <MucMenu nguy onClick={() => void chay(k, async () => { await xoaCanh(c.id); })}>🗑 Xoá cảnh</MucMenu>
            </Menu>
          </div>
        </div>
      </div>
      {mo && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
          {/* YDNI: 3 tab thay một form dài phải cuộn — nội dung (hay sửa nhất) mặc định; máy/cảm xúc; thời lượng + prompt (ít đụng). Thanh Lưu luôn thấy. */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {([['noi_dung', 'Nội dung'], ['may', 'Máy · cảm xúc · âm'], ['ky_thuat', 'Thời lượng · prompt']] as const).map(([key, chu]) => <button key={key} type="button" className={`xv-btn${tabF === key ? ' chinh' : ''}`} onClick={() => setTabF(key)}>{chu}</button>)}
          </div>
          {tabF === 'noi_dung' && (
            <div className="xv-grid">
              <O label="Nhãn cảnh"><input className="xv-in" value={f.canh} onChange={(e) => setF({ ...f, canh: e.target.value })} /></O>
              <O label="Đối tượng"><Chon multi values={f.nhan_vat.map(String)} onValues={(v) => setF({ ...f, nhan_vat: v.map(Number) })} options={nhanVat.map((v) => ({ value: String(v.id), label: v.ten, nhom: LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label }))} placeholder="chọn…" /></O>
              <O label="Biến thể" hint="mỗi đối tượng tối đa 1"><Chon multi values={f.bien_the.map(String)} onValues={(v) => setF({ ...f, bien_the: v.map(Number) })} options={tatCaBt.filter((b) => f.nhan_vat.includes(b.nhan_vat_id)).map((b) => ({ value: String(b.id), label: b.ten, nhom: b.nv }))} placeholder="không dùng biến thể" /></O>
              <O span label="Hành động"><textarea className="xv-ta" rows={2} value={f.hanh_dong} onChange={(e) => setF({ ...f, hanh_dong: e.target.value })} /></O>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="xv-lbl" style={{ marginBottom: 4 }} title="Mỗi lượt nói một dòng: nhân vật · diễn xuất · lời. Mỗi dòng sinh giọng riêng theo giọng cố định của nhân vật (đổi ở nút giọng cạnh tên).">Thoại</div>
                {f.thoai.map((d, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px auto 180px 1fr auto', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                    <Chon nho value={d.nhan_vat} onChange={(v) => setF({ ...f, thoai: f.thoai.map((x, j) => (j === i ? { ...x, nhan_vat: v } : x)) })} minWidth={150}
                      options={[{ value: '', label: LOI_DAN }, ...nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => ({ value: v.ten, label: v.ten }))]} />
                {/* Chọn model + giọng của người nói ngay tại dòng (#1221) — giọng cố định theo nhân vật, đổi ở đây là đổi cả phim. */}
                {(() => { const v = nhanVat.find((x) => x.loai === 'nhan_vat' && x.ten === d.nhan_vat); return v ? <GiongNhanVat v={v} onChanged={async () => { await chay(k, async () => undefined); }} /> : <span style={mono}>—</span>; })()}
                    <input className="xv-in" placeholder="diễn xuất: nhìn lên, giơ tay" value={d.dien_xuat} onChange={(e) => setF({ ...f, thoai: f.thoai.map((x, j) => (j === i ? { ...x, dien_xuat: e.target.value } : x)) })} />
                    <input className="xv-in" placeholder="lời nói" value={d.loi} onChange={(e) => setF({ ...f, thoai: f.thoai.map((x, j) => (j === i ? { ...x, loi: e.target.value } : x)) })} />
                    <button type="button" className="xv-btn" title="Bỏ dòng" onClick={() => setF({ ...f, thoai: f.thoai.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                ))}
                <button type="button" className="xv-btn" onClick={() => setF({ ...f, thoai: [...f.thoai, { nhan_vat: f.thoai[f.thoai.length - 1]?.nhan_vat ?? '', dien_xuat: '', loi: '' }] })}>+ Dòng thoại</button>
              </div>
              <O span label="Chữ trên màn" hint="≤ 8 từ: hook, số liệu, ưu đãi, CTA"><input className="xv-in" value={f.chu_man} onChange={(e) => setF({ ...f, chu_man: e.target.value })} placeholder="để trống = không có chữ" /></O>
              <O span label="Trang phục" hint="đè bộ đồ trong mô tả nhân vật, giữ mặt/tóc/dáng — vd: chỉ mặc áo bra, KHÔNG áo ngoài"><input className="xv-in" value={f.trang_phuc} onChange={(e) => setF({ ...f, trang_phuc: e.target.value })} placeholder="để trống = mặc như mô tả nhân vật" /></O>
            </div>
          )}
          {tabF === 'may' && (
            <div className="xv-grid">
              <O label="Góc máy"><input className="xv-in" value={f.goc_may} onChange={(e) => setF({ ...f, goc_may: e.target.value })} /></O>
              <O label="Phân cảnh"><input className="xv-in" value={f.phan_doan} onChange={(e) => setF({ ...f, phan_doan: e.target.value })} /></O>
              <O label={`Khán giả cuối shot: ${tenCamXuc(f.cam_xuc)} (${f.cam_xuc > 0 ? '+' : ''}${f.cam_xuc})`} hint="Cảm xúc ta muốn khán giả có ở cuối shot: -5 tuyệt vọng … 0 trung tính … +5 muốn mua ngay — vẽ đường cong Khán giả trên timeline"><input type="range" min={-5} max={5} step={1} value={f.cam_xuc} onChange={(e) => setF({ ...f, cam_xuc: Number(e.target.value) })} /></O>
              <O label="Âm thanh"><input className="xv-in" value={f.am_thanh} onChange={(e) => setF({ ...f, am_thanh: e.target.value })} /></O>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="xv-lbl" style={{ marginBottom: 4 }} title="Chọn từ thư viện; nhóm hợp thể loại phim đứng đầu; ghép vào prompt ảnh/video khi sinh">Ngôn ngữ điện ảnh · <button type="button" className="xv-lienket" style={{ textTransform: 'none', fontWeight: 400 }} onClick={() => moNgan({ loai: 'thu-vien', tl: kt.the_loai })}>thư viện</button></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 6 }}>
                  {NHOM_KY_THUAT.map((n) => {
                    const tl = (kt.the_loai || undefined) as TheLoai | undefined;
                    const opts = dsTheoNhom(n.key, tl).map((x) => ({ value: x.key, label: x.ten, nhom: hopTheLoai(x, tl) ? `Hợp ${THE_LOAI.find((t) => t.key === tl)?.ten ?? 'mọi thể loại'}` : 'Thể loại khác', title: x.mo_ta }));
                    return (
                      <label key={n.key} style={{ display: 'grid', gap: 2 }}>
                        <span style={{ ...mono }}>{n.icon} {n.ten}</span>
                        {n.key === 'am_thanh'
                          ? <Chon nho multi values={f.ky_thuat.am_thanh ?? []} onValues={(v) => setF({ ...f, ky_thuat: { ...f.ky_thuat, am_thanh: v.slice(0, 3) } })} options={opts} placeholder="chưa chọn" minWidth={200} />
                          : <Chon nho value={(f.ky_thuat as Record<string, string | undefined>)[n.key] ?? ''} onChange={(v) => setF({ ...f, ky_thuat: { ...f.ky_thuat, [n.key]: v } })} options={opts} placeholder="chưa chọn" minWidth={200} />}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {tabF === 'ky_thuat' && (
            <div className="xv-grid">
              <O label="Clip sinh"><Chon value={String(f.thoi_luong_s)} onChange={(v) => setF({ ...f, thoi_luong_s: Number(v) })} options={[3, 4, 5, 6, 8, 10, 12, 15].map((x) => ({ value: String(x), label: `${x} giây`, phu: x > 8 ? 'chỉ model fal' : undefined }))} minWidth={140} /></O>
              <O label="Giây phát" hint="cắt phần đầu clip; trống = cả clip"><input className="xv-in" type="number" min={1} max={15} step={0.5} value={f.phat_s ?? ''} onChange={(e) => setF({ ...f, phat_s: e.target.value === '' ? null : Number(e.target.value) })} placeholder={String(f.thoi_luong_s)} style={{ width: 90 }} /></O>
              <O label="Nhánh hook" hint="trống = thân chung · A/B/C"><input className="xv-in" value={f.nhanh} onChange={(e) => setF({ ...f, nhanh: e.target.value.trim().toUpperCase().slice(0, 2) })} placeholder="—" style={{ width: 70 }} /></O>
              <O span label="Prompt ảnh · tiếng Anh"><textarea className="xv-ta" rows={3} value={f.prompt_anh} onChange={(e) => setF({ ...f, prompt_anh: e.target.value })} style={{ fontFamily: 'var(--font-mono)' }} /></O>
              <O span label="Prompt video · tiếng Anh"><textarea className="xv-ta" rows={3} value={f.prompt_video} onChange={(e) => setF({ ...f, prompt_video: e.target.value })} style={{ fontFamily: 'var(--font-mono)' }} /></O>
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Nut ly={!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY'} ban={ai || ban(k)} title="Claude đọc cảnh trước/sau + tuyến nhân vật + phong cách → điền đủ góc máy, hành động, lời thoại, prompt ảnh, prompt video khớp mạch. Chỉ điền vào form, anh xem rồi Lưu cảnh." onClick={() => void aiVietLai()}>{ai ? '… AI đang viết' : '✨ AI viết lại cảnh (khớp cảnh trước/sau)'}</Nut>
            <Loi>{loiAi}</Loi>
            <Nut ly={!dirty && 'chưa sửa'} ban={ban(k)} chinh onClick={() => void chay(k, async () => {
              await suaCanh(c.id, { canh: f.canh, goc_may: f.goc_may, thoi_luong_s: f.thoi_luong_s, nhan_vat: f.nhan_vat, bien_the: f.bien_the, hanh_dong: f.hanh_dong, loi_thoai: f.loi_thoai, am_thanh: f.am_thanh, prompt_anh: f.prompt_anh, prompt_video: f.prompt_video, phan_doan: f.phan_doan, cam_xuc: f.cam_xuc, ky_thuat: f.ky_thuat, thoai: f.thoai, phat_s: f.phat_s, chu_man: f.chu_man, nhanh: f.nhanh, trang_phuc: f.trang_phuc });
              setMo(false);
            })}>Lưu cảnh</Nut>
            <button type="button" className="xv-btn" onClick={() => { setF(c); setMo(false); }}>Huỷ</button>
          </div>
        </div>
      )}
    </div>
  );
}
