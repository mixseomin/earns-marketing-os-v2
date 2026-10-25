'use client';
import { ChuManXem } from './chu-man';

// Timeline kiểu CapCut cho một tập: màn xem trước ở trên, các track ở dưới chạy chung một thước giây.
//   Hình   — mỗi cảnh một clip, dài bằng số giây THỰC PHÁT (phat_s: cắt từ đầu clip 4/6/8s); kéo mép phải = cắt, kéo thả clip đổi thứ tự.
//   Chữ    — chữ trên màn của từng shot (hook, số liệu, CTA) — bản xuất vẽ đúng chữ này.
//   Thoại  — MỘT làn cho mỗi người nói (#1237), màu theo nhân vật; có file giọng (thoai_url) thì phát file, chưa có thì đọc thử bằng giọng máy.
//   Âm thanh — hiệu ứng/âm nền từng cảnh (am_thanh / am_thanh_url).
//   Nhạc   — nhạc nền cả tập (nhac_url / nhac_mo_ta).
// Nét đứt = mới có mô tả trong kịch bản, chưa sinh file. Toàn bộ chạy ở trình duyệt, không tốn tiền.
import { Fragment, useEffect, useMemo, useRef, useState, type PointerEvent as PE, type ReactNode } from 'react';
import { LOAI_NHAN_VAT, chuManHien, giayPhat, tenCamXuc, tenPhanDoan, camXucMucTieu, lechCamXuc, type Canh, type Lop, type ThongTinQc, type NhanVat, type Tap } from '@/lib/xuong-video/kieu';
import { kyThuat, type KyThuatShot } from '@/lib/xuong-video/dien-anh';
import { lopImpact, nhipHanhDong, themTieng } from '@/lib/xuong-video/nhip-hanh-dong';
import { theTenTap } from '@/lib/xuong-video/the-ten';
import { nhipCat } from '@/lib/xuong-video/nhip-cat';
import { lichSfx, urlSfx, amLuongXem, LUFS_GIONG, LUFS_NHAC_DUOI_GIONG, DU_XEM } from '@/lib/xuong-video/sfx';
import { doLufsAm } from '@/lib/actions';
import { keHoachToc, nguonTai } from '@/lib/xuong-video/toc-do';
import { NutChuyenCanh } from './chuyen-canh-ui';
import { dongThoai, phatTiengClip, tenNoi, cungTen, timNv, lichGiong, giayGiuKet } from '@/lib/xuong-video/am-thanh';
import { BangSinh, type YeuCauBang } from './bang-sinh';
import type { TuyGiong, TuyAm } from '@/lib/actions';
import { mono, Menu, Seg } from './ui';
import { useNho } from './nho';
import { goiTheoKey, boCucGoi } from '@/lib/xuong-video/goi-the-loai';
import { Chon } from './chon';
import { docLT, ghiLT } from '@/lib/luu-tru';
import { lopMoi, idLop, tenLop, tenNhom, chonLopMoi, nhomCua, gopNhom, boNhom, lanLop, gopLaiNhomCu, soNhomCu, themVaoNhom, dsNhom } from '@/lib/xuong-video/lop';
import { useLop, LopXem, LopCongCu, LopNguyenLieu, LopBang, LopNhieu, KhoiLop, KhungHieuUng } from './lop-ui';
import { moNgan } from './ngan-chung';
import { useKichThuoc, TayKeo } from './keo';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { AnhDaiDien } from './anh-set-3d';
import { ThamKhaoShot } from './tham-khao-ui';
import { ChonCta } from './cta-ui';
import { ChipMurch, useDiemMurch } from './diem-murch-noi';
import { ChipPrompt } from './diem-prompt-noi';
import { mayClip } from '@/lib/xuong-video/qc-cam-xuc';
import { laShotCta } from '@/lib/xuong-video/cta';
import { chamDanDat, luatCuaTru } from '@/lib/xuong-video/dan-dat';
import { KY_HIEU_CAT, CU_MAY_LIEN_BANG } from '@/lib/xuong-video/dien-anh-nganh';
import { NganKhuon } from './khuon-ui';
import { NganKhanGia } from './khan-gia-ui';
import { NganRef2v } from './ref2v-ui';
import { soatKhanGia, xepHangYDo, hieuUngKG } from '@/lib/xuong-video/khan-gia';
import { kiemKhuon, xepHang, QUY_CHUAN_DONG, khuonTheoKey, type KetAp } from '@/lib/xuong-video/khuon-chuoi';
import type { TheLoai } from '@/lib/xuong-video/dien-anh';
import { trangThaiDoiTuong, mucDiem, TEN_NHANH, type MucDoiTuong } from '@/lib/xuong-video/trang-thai-doi-tuong';
import { ghiThamSoUrl } from '@/lib/ghi-url';

/** Màu khối làn Đối tượng theo mức điểm (khoiAm cần mã hex để ghép độ trong). */
const MAU_DOI_TUONG: Record<MucDoiTuong, string> = { tot: '#a3e635', vang: '#f5b638', do: '#f87171', trong: '#545a68' };


const MAU_NV = ['#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#60a5fa'];
// Cột nhãn track: kéo mép phải để nới (#1240) — nhớ theo trình duyệt.
const NHAN_W_MAC_DINH = 150;
const KHOA_NHAN_W = 'xv-tl-nhan-w';
const dongHo = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;

/** Sinh ngay trên timeline (#1199): khối nét đứt có nút ＋ — bấm là sinh đúng thứ đó, giá + gợi ý thời điểm ở chú thích. */
export type SinhTaiCho = {
  giong: (canhId: number, tuy: TuyGiong) => void; sfx: (canhId: number, tuy: TuyAm) => void; nhac: (phanDoan: string | undefined, model: string, moTa: string) => void;
  mhNhac: string; ban: (k: string) => boolean; dangPhanDoan: string[]; dangCaTap: boolean;
};
export function Timeline({ canh, nhanVat, tap, tiLe, ngonNgu, chon, onChon, onDoiGiay, onXep, onToanManHinh, sinh, qc, laQc, onDoiCta, onDoiChuyenCanh, onDoiKyThuat, onKhopNhip, onKhopGiong, theShot, onMoShot, theLoai, onDoiKhuon, goi }: {
  /** thẻ shot đang chọn (CanhRow) — hiện ở panel THUỘC TÍNH khi không chọn lớp nào, như panel Properties của After Effects */ theShot?: ReactNode;
  /** bấm một khối của shot trên bất kỳ làn nào → mở ngăn chi tiết shot (anh 18/10/2026: cuộn xuống các làn dưới thì không kéo lên xem panel được) */ onMoShot?: (id: number) => void;
  /** gói thể loại của phim (kinh_thanh.goi, goi-the-loai.ts) — bố cục màn xem mặc định theo gói */ goi?: string;
  /** dòng phim (kinh_thanh.the_loai) — khuôn chuỗi kiểm có hợp dòng không + hover làn 🧭 Khuôn hiện quy chuẩn ngành của dòng */ theLoai?: TheLoai | '';
  /** đã lưu khuôn chuỗi của tập (ngăn 🧭 sửa khuôn) → nạp lại tập */ onDoiKhuon?: () => Promise<void>;
  canh: Canh[]; nhanVat: NhanVat[]; tap: Tap; tiLe: string; ngonNgu: string; chon: number | null; qc?: ThongTinQc | null; /** phim quảng cáo → câu chữ thiếu nguồn tham khảo hiện đỏ */ laQc?: boolean; /** đổi kiểu CTA của phim (thư viện CTA) */ onDoiCta?: (key: string) => void;
  onChon: (id: number) => void; onDoiGiay: (id: number, giay: number) => void;
  /** đổi chuyển cảnh SAU shot id (ky_thuat.chuyen_canh; '' = cắt thẳng) và/hoặc số giây đặt tay (giay: undefined = giữ, null = về mặc định) */ onDoiChuyenCanh?: (id: number, key: string, giay?: number | null) => void; onXep: (ids: number[]) => void; onToanManHinh: () => void; sinh?: SinhTaiCho;
  /** khớp điểm cắt vào phách nhạc nền — trả câu báo */ onKhopNhip?: () => Promise<string>;
  /** khớp giây phát theo giọng — trả câu báo */ onKhopGiong?: () => Promise<string>;
  /** ghi kỹ thuật mới cho vài shot một lượt (gói impact / nhịp hành động thêm tiếng) */ onDoiKyThuat?: (ds: { id: number; ky_thuat: KyThuatShot }[]) => void;
}) {
  // Số giây tạm khi đang kéo mép clip (chưa ghi) — timeline co giãn theo tay ngay.
  const [giayTam, setGiayTam] = useState<Record<number, number>>({});
  const dur = (c: Canh) => giayTam[c.id] ?? giayPhat(c);
  // Điểm Murch từng shot — cùng hook với Lưới (diem-murch-noi.tsx › useDiemMurch), chip góc dưới khối clip làn 🎬 Hình, rê vào xem sáu tiêu chí.
  const { sets, diemM, tbM } = useDiemMurch(canh, nhanVat, tap, laQc);
  const batDau = useMemo(() => { let a = 0; return canh.map((c) => { const s = a; a += dur(c); return s; }); }, [canh, giayTam]); // eslint-disable-line react-hooks/exhaustive-deps
  // Trạng thái + điểm từng đối tượng theo shot (trang-thai-doi-tuong.ts) — làn 'Đối tượng' cuối timeline.
  const doiTuong = useMemo(() => trangThaiDoiTuong(canh, nhanVat, tap.phan_canh, sets, tap.khong_gian), [canh, nhanVat, tap.phan_canh, sets, tap.khong_gian]);
  // Nhân vật của cả tập theo thứ tự xuất hiện (người nói + nhân vật có mặt mà không nói) → mỗi người MỘT nhóm làn: cảm xúc + thoại (#1244).
  const nguoiNoiTap = useMemo(() => {
    const ds: string[] = [];
    const them = (t: string) => { if (!ds.some((x) => cungTen(x, t))) ds.push(t); };
    for (const c of canh) {
      for (const d of dongThoai(c, nhanVat)) them(tenNoi(d));
      for (const id of c.nhan_vat) { const v = nhanVat.find((x) => x.id === id && x.loai === 'nhan_vat'); if (v) them(v.ten); }
    }
    return ds;
  }, [canh, nhanVat]);
  // Nút đọc thử / tắt thoại (chung cho mọi giọng) nằm ở làn thoại của người nói ĐẦU TIÊN.
  const nguoiNoiDau = useMemo(() => { for (const c of canh) { const d = dongThoai(c, nhanVat)[0]; if (d) return tenNoi(d); } return ''; }, [canh, nhanVat]);
  const [daiAm, setDaiAm] = useState<Record<string, number>>({});
  useEffect(() => {
    const can = [...new Set(canh.flatMap((x) => dongThoai(x, nhanVat).map((d) => d.url).filter((u): u is string => !!u)))].filter((u) => daiAm[u] == null);
    const ds = can.map((u) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => { if (Number.isFinite(a.duration)) setDaiAm((m) => ({ ...m, [u]: a.duration })); }; a.src = u; return a; });
    return () => { for (const a of ds) { a.onloadedmetadata = null; a.src = ''; } };
  }, [canh, nhanVat]); // eslint-disable-line react-hooks/exhaustive-deps
  const lich = useMemo(() => lichGiong(canh, nhanVat, (u) => daiAm[u] ?? null), [canh, nhanVat, daiAm]);
  // Giữ hình kết GIU_KET giây sau câu cuối — cùng luật bản xuất (am-thanh.ts › giayGiuKet): phần thêm là shot cuối đứng hình.
  const tong = (() => { const p = canh.reduce((a, c) => a + dur(c), 0); return p + giayGiuKet(canh.reduce((a, c) => a + giayPhat(c), 0), lich); })();

  const [t, setT] = useState(0);
  const [chay, setChay] = useState(false);
  const [docThu, setDocThu] = useState(true);
  // Độ phóng thước nằm trong URL (?tlz=) để F5/chia sẻ giữ nguyên (#1255) — luật chung: mọi trạng thái đổi cách nhìn đều ở URL.
  const [zoom, setZoom] = useState(() => { if (typeof window === 'undefined') return 1; const v = Number(new URLSearchParams(window.location.search).get('tlz')); return v >= 1 && v <= 6 ? v : 1; });
  useEffect(() => { ghiThamSoUrl({ tlz: zoom === 1 ? null : String(zoom) }); }, [zoom]);
  // Cột nhãn, panel trái/phải, chiều cao hàng panel — cùng một cơ chế kéo (keo.tsx, #1276).
  const cotNhan = useKichThuoc(KHOA_NHAN_W, NHAN_W_MAC_DINH, 80, 400);
  const nhanW = cotNhan.v;
  const tayNhan = <div onPointerDown={cotNhan.keo('x')} onDoubleClick={cotNhan.veMacDinh} title="Kéo để nới cột nhãn · nhấp đúp = mặc định" className="xv-keo-cot" />;

  const [rong, setRong] = useState(800);
  const vungRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = vungRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setRong(el.clientWidth)); ro.observe(el); setRong(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const pps = Math.max(12, ((rong - nhanW - 16) / Math.max(tong, 1)) * zoom);   // pixel mỗi giây: vừa khít bề ngang × zoom

  const idx = Math.max(0, batDau.reduce((k, s, i) => (s <= t + 1e-6 ? i : k), 0));
  const c = canh[idx];
  const tTrong = c ? t - batDau[idx]! : 0;
  // Đổi tốc + tiếng hiệu ứng thật — CÙNG kế hoạch với bản xuất (toc-do.ts, sfx.ts).
  const [daiVid, setDaiVid] = useState(0);
  const tocNay = useMemo(() => (c && (c.video_cuoi_url || c.video_url) ? keHoachToc(c.ky_thuat?.toc_do, dur(c), dur(c), daiVid || 8) : null), [c, daiVid, giayTam]); // eslint-disable-line react-hooks/exhaustive-deps
  const vtVid = tocNay ? nguonTai(tocNay, tTrong).vao : tTrong;
  const lichHu = useMemo(() => lichSfx(canh.map((cc, i) => ({ am: cc.ky_thuat?.am_thanh, tu: batDau[i]!, phat: dur(cc) }))), [canh, batDau]); // eslint-disable-line react-hooks/exhaustive-deps
  // Khối phân cảnh: shot liền nhau cùng phan_doan. Dùng cho track Phân cảnh, track Nhạc (nhạc theo phân cảnh) và phát nhạc đúng đoạn.
  const khoiPc: { ten: string; tu: number; den: number }[] = [];
  canh.forEach((cc, i) => { const l = khoiPc[khoiPc.length - 1]; if (l && l.ten === cc.phan_doan) l.den = i; else khoiPc.push({ ten: cc.phan_doan, tu: i, den: i }); });
  const pcHienTai = khoiPc.find((kh) => idx >= kh.tu && idx <= kh.den);
  const nhacPc = pcHienTai ? tap.nhac_phan_canh?.[pcHienTai.ten] : undefined;
  const tNhacPc = pcHienTai ? t - batDau[pcHienTai.tu]! : 0;
  // Bật/tắt từng lớp tiếng khi xem (clip có tiếng sẵn thì tắt bớt để khỏi chồng).
  const [tat, setTat] = useState<Record<string, boolean>>({});
  const [baoNhip, setBaoNhip] = useState('');
  const [dangKhop, setDangKhop] = useState(false);

  // Đồng hồ phát: requestAnimationFrame đẩy t, hết tập thì dừng.
  useEffect(() => {
    if (!chay) return;
    let raf = 0; let truoc = performance.now();
    const buoc = (bay: number) => {
      const dt = (bay - truoc) / 1000; truoc = bay;
      setT((x) => { const y = x + dt; if (y >= tong) { setChay(false); return tong; } return y; });
      raf = requestAnimationFrame(buoc);
    };
    raf = requestAnimationFrame(buoc);
    return () => cancelAnimationFrame(raf);
  }, [chay, tong]);

  // Video + file âm thanh bám theo t: đổi cảnh hoặc tua thì đặt lại currentTime; dừng thì pause.
  const vidRef = useRef<HTMLVideoElement>(null);
  const thoaiRef = useRef<HTMLAudioElement>(null);
  // Giọng theo LỊCH CHUNG với bản xuất (lichGiong): mốc tuyệt đối, độ trễ, một tốc độ cho lời dẫn, lời dẫn vắt qua shot sau. Trước đây
  // phát theo từng shot với bộ đếm dòng không đặt lại → sau shot nhiều câu là mất giọng tới hết phim (phim #5, 10/10/2026).
  const giongNay = lich.filter((g) => g.tu <= t + 1e-6 && t < g.tu + Math.min(g.dai ?? 30, g.cat ?? 30)).pop() ?? null;
  const khoaGiong = giongNay ? `${giongNay.url}@${giongNay.tu}` : '';
  const sfxRef = useRef<HTMLAudioElement>(null);
  // Mức phát thử = mức bản xuất (giọng LUFS_GIONG, nhạc dưới giọng LUFS_NHAC_DUOI_GIONG dB) theo độ to ĐO của từng tệp (doLufsAm, nhớ phía máy chủ).
  const [lufs, setLufs] = useState<Record<string, number | null>>({});
  const urlAm = useMemo(() => [...new Set([...lich.map((g) => g.url), tap.nhac_url, ...Object.values(tap.nhac_phan_canh ?? {})].filter((u): u is string => !!u))], [lich, tap.nhac_url, tap.nhac_phan_canh]);
  useEffect(() => { const can = urlAm.filter((u) => !(u in lufs)); if (can.length) void doLufsAm(can).then((r) => setLufs((d) => ({ ...d, ...r }))); }, [urlAm.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const nhacRef = useRef<HTMLAudioElement>(null);
  const nhacPcRef = useRef<HTMLAudioElement>(null);
  const tuaRef = useRef(0);   // tăng mỗi lần người dùng tua → ép đồng bộ lại
  const [tua, setTua] = useState(0);
  const dongBo = (el: HTMLMediaElement | null, vt: number, coDuoc: boolean) => {
    if (!el) return;
    if (!coDuoc || vt < 0 || (el.duration && vt > el.duration)) { el.pause(); return; }
    if (Math.abs(el.currentTime - vt) > 0.3) el.currentTime = vt;
    if (chay) void el.play().catch(() => { /* trình duyệt chặn tự phát khi chưa có tương tác — người dùng bấm ▶ là chạy */ }); else el.pause();
  };
  useEffect(() => {
    dongBo(vidRef.current, vtVid, true);
    if (c && vidRef.current && tTrong >= dur(c)) vidRef.current.pause();   // hết phần phát (phat_s) thì dừng dù clip còn
    dongBo(sfxRef.current, tTrong, true);
    dongBo(nhacRef.current, nhacPc ? tNhacPc : t, true);
    dongBo(nhacPcRef.current, tNhacPc, true);
  }, [idx, chay, tua, nhacPc]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tốc clip theo đoạn đang chạy; lệch quá 0,3s so với kế hoạch (vừa sang đoạn khác) thì đặt lại vị trí.
  useEffect(() => {
    const el = vidRef.current; if (!el) return;
    const r = tocNay ? nguonTai(tocNay, tTrong).toc : 1;
    if (Math.abs(el.playbackRate - r) > 0.01) el.playbackRate = r;
    if (tocNay && chay && Math.abs(el.currentTime - vtVid) > 0.3) el.currentTime = vtVid;
  }, [t, tocNay, chay]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tiếng hiệu ứng thật: mỗi mục lịch một Audio, phát khi t nằm trong khoảng của nó.
  const hiRef = useRef(new Map<string, HTMLAudioElement>());
  useEffect(() => {
    const dang = new Set<string>();
    for (const m of lichHu) {
      const k = `${m.key}@${m.tu}`; const trong = chay && !tat.sfx && t >= m.tu && t < m.tu + m.dai;
      let a = hiRef.current.get(k);
      if (!trong) { if (a && !a.paused) a.pause(); continue; }
      dang.add(k);
      if (!a) { a = new Audio(urlSfx(m.key)); a.preload = 'auto'; hiRef.current.set(k, a); }
      a.loop = m.lap; a.volume = Math.min(1, Math.pow(10, (m.db - DU_XEM) / 20));   // cùng mức bản xuất, chừa DU_XEM như giọng/nhạc
      if (a.paused) { a.currentTime = m.bo + (t - m.tu); void a.play().catch(() => {}); }
    }
    for (const [k, a] of hiRef.current) if (!dang.has(k) && !a.paused) a.pause();
  }, [t, chay, lichHu, tat.sfx]);
  useEffect(() => () => { for (const a of hiRef.current.values()) a.pause(); }, []);
  useEffect(() => {
    const el = thoaiRef.current; if (!el || !giongNay) return;
    el.playbackRate = giongNay.nhanh;   // trình duyệt giữ cao độ khi đổi tốc độ (preservesPitch mặc định bật) — như atempo của bản xuất
    dongBo(el, (t - giongNay.tu) * giongNay.nhanh, true);
  }, [khoaGiong, chay, tua]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Tiếng sẵn của clip phát theo CÙNG luật bản xuất (am-thanh.ts › phatTiengClip): người nói chưa có giọng riêng, hoặc shot không có lời nào
    // (tiếng cười, tiếng động thật). Shot có lời dẫn thì tắt — clip AI hay tự chèn tiếng nói lạ. Nút "tiếng clip" bật lại khi cần nghe thử.
    const tatClip = !c || !phatTiengClip(c, nhanVat);
    if (vidRef.current) vidRef.current.muted = tat.clip === undefined ? tatClip : !!tat.clip;
    if (thoaiRef.current && giongNay) thoaiRef.current.volume = amLuongXem(lufs[giongNay.url], LUFS_GIONG, 0.6);
    if (nhacRef.current && tap.nhac_url) nhacRef.current.volume = amLuongXem(lufs[tap.nhac_url], LUFS_GIONG - LUFS_NHAC_DUOI_GIONG, 0.2);
    if (nhacPcRef.current && nhacPc) nhacPcRef.current.volume = amLuongXem(lufs[nhacPc], LUFS_GIONG - LUFS_NHAC_DUOI_GIONG, 0.2);
    if (thoaiRef.current) thoaiRef.current.muted = !!tat.thoai;
    if (sfxRef.current) sfxRef.current.muted = !!tat.sfx;
    if (nhacRef.current) nhacRef.current.muted = !!tat.nhac || !!nhacPc;
    if (nhacPcRef.current) nhacPcRef.current.muted = !!tat.nhac;
  });

  // Chưa có file giọng → đọc thử bằng giọng máy của trình duyệt khi vào cảnh (chỉ để nghe nhịp, không phải giọng thật).
  useEffect(() => {
    if (!chay || !docThu || !c?.loi_thoai || c.thoai_url || c.thoai.some((d) => d.url) || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(c.thoai.length ? c.thoai.map((d) => d.loi).join('. ') : c.loi_thoai.replace(/^[^:"“]*:\s*/, '').replace(/["“”]/g, ''));
    u.lang = ngonNgu === 'vi' ? 'vi-VN' : 'en-US'; u.rate = 1.05;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    return () => window.speechSynthesis.cancel();
  }, [idx, chay, docThu]); // eslint-disable-line react-hooks/exhaustive-deps

  const tuaToi = (giay: number) => { setT(Math.max(0, Math.min(tong, giay))); tuaRef.current++; setTua(tuaRef.current); };
  // Vị trí đầu phát nhớ theo tập (#1345): URL ?tlt= (F5 / chia sẻ link mở đúng chỗ — luật #1255) rồi localStorage (mở lại phim).
  // Mở lại thì tua tới đó + chọn đúng shot đang đứng; ghi trễ 400ms để lúc đang phát không ghi URL mỗi khung hình.
  const khoaT = `xv-tlt-${tap.id}`;
  const daKhoiPhuc = useRef(false);
  useEffect(() => {
    if (daKhoiPhuc.current || !canh.length) return;
    daKhoiPhuc.current = true;
    // ?tlt=<tapId>:<giây> — ghi kèm id tập để đổi sang tập khác không mang vị trí của tập cũ theo.
    const [tu, giay] = (new URLSearchParams(window.location.search).get('tlt') ?? '').split(':');
    const g = Number(Number(tu) === tap.id ? giay : docLT(khoaT) ?? 0);
    if (!(g > 0)) return;
    let i = 0; batDau.forEach((b, k) => { if (b <= g) i = k; });
    onChon(canh[i]!.id); tuaToi(g);
  }, [canh.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Shot được chọn từ ngoài timeline (lưới kịch bản, bảng đối tượng) → đầu phát nhảy tới đầu shot đó; đã đứng trong shot thì để nguyên.
  useEffect(() => {
    const i = canh.findIndex((x) => x.id === chon);
    if (i < 0) return;
    if (t < batDau[i]! - 0.01 || t >= batDau[i]! + dur(canh[i]!)) tuaToi(batDau[i]!);
  }, [chon]); // eslint-disable-line react-hooks/exhaustive-deps
  // Đầu phát sang shot khác (kéo vạch, bấm thước, phím, đang phát) → shot đang chọn đi theo, để Thuộc tính / ngăn shot luôn là shot dưới vạch đỏ (#1420).
  // Chỉ chạy khi idx THẬT SỰ đổi — lần dựng đầu để chọn từ ngoài (URL, lưới) giữ nguyên; chọn từ ngoài tua tới shot đó nên idx khớp, không vòng lặp.
  const idxTruoc = useRef(idx);
  useEffect(() => {
    if (idxTruoc.current === idx) return;
    idxTruoc.current = idx;
    const id = canh[idx]?.id;
    if (id != null && id !== chon) onChon(id);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!daKhoiPhuc.current) return;
    const h = setTimeout(() => {
      const v = t > 0.05 ? t.toFixed(1) : null; ghiLT(khoaT, v);
      ghiThamSoUrl({ tlt: v ? `${tap.id}:${v}` : null });
    }, 400);
    return () => clearTimeout(h);
  }, [t, khoaT]);
  // Giữ chuột trên thước giây hoặc vạch đỏ rồi kéo = tua liên tục (scrub) như CapCut; đang chạy thì tạm dừng trong lúc kéo.
  /** Bấm khối của một shot (mọi làn): chọn + tua tới đầu shot + mở ngăn chi tiết shot. Phím ←/→ và lúc phát tự sang shot thì KHÔNG mở ngăn. */
  const [suaKhuon, setSuaKhuon] = useState(false);
  const [suaKG, setSuaKG] = useState(false);
  const [thuRef, setThuRef] = useState<string | null>(null);
  const bamShot = (id: number, i: number) => { onChon(id); tuaToi(batDau[i]!); onMoShot?.(id); };
  const keoDauPhat = (e: PE<HTMLDivElement>, goc: number) => {
    e.preventDefault(); e.stopPropagation();
    const dangChay = chay; setChay(false);
    tuaToi((e.clientX - goc) / pps);
    const move = (ev: PointerEvent) => tuaToi((ev.clientX - goc) / pps);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; if (dangChay) setChay(true); };
    document.body.style.cursor = 'ew-resize';
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  // Phím tắt: Space chạy/dừng, ←/→ lùi/tới 1 cảnh — bỏ qua khi đang gõ trong ô nhập.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (tg.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('.xv-drawer.nho, [data-animatic]')) return;
      // Lớp phủ đang chọn (#1289): Del/Backspace xoá · Esc bỏ chọn · ⌘G gộp nhóm · ⇧⌘G bỏ nhóm.
      if (chonLops.length && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); xoaChon(); return; }
      // Esc khi đang chọn lớp = CHỈ bỏ chọn — chặn để ngăn phim (ngan.tsx, cùng nghe Esc trên window) không đóng theo.
      if (chonLops.length && e.key === 'Escape') { e.stopImmediatePropagation(); setChonLops([]); return; }
      if (chonLops.length && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); if (e.shiftKey) boNhomChon(); else gopChon(); return; }
      if (e.key === ' ') { e.preventDefault(); setChay((x) => { if (!x && t >= tong) setT(0); return !x; }); }
      if (e.key === 'ArrowRight') tuaToi(batDau[Math.min(canh.length - 1, idx + 1)] ?? 0);
      if (e.key === 'ArrowLeft') tuaToi(batDau[Math.max(0, tTrong > 0.5 ? idx : idx - 1)] ?? 0);
    };
    window.addEventListener('keydown', h, true); return () => window.removeEventListener('keydown', h, true);   // pha bắt: chạy trước nghe Esc của ngăn
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Kéo mép phải clip hình → đổi số giây THỰC PHÁT (bước 0,5s, 1–15s); thả tay mới ghi. Ngắn hơn clip = cắt; dài hơn clip = sinh lại clip dài hơn.
  const keoMep = (cc: Canh) => (e: PE<HTMLDivElement>) => {
    e.stopPropagation(); e.preventDefault();
    const x0 = e.clientX; const g0 = giayPhat(cc); let g = g0;
    const move = (ev: PointerEvent) => { g = Math.max(1, Math.min(15, Math.round((g0 + (ev.clientX - x0) / pps) * 2) / 2)); setGiayTam((m) => ({ ...m, [cc.id]: g })); };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (g !== g0) onDoiGiay(cc.id, g);
      setTimeout(() => setGiayTam((m) => { const n = { ...m }; delete n[cc.id]; return n; }), 1500);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const [keo, setKeo] = useState<number | null>(null);
  const [tha, setTha] = useState<number | null>(null);
  const thaVao = (dichId: number) => {
    if (keo == null || keo === dichId) return;
    const ids = canh.map((x) => x.id).filter((x) => x !== keo);
    ids.splice(ids.indexOf(dichId), 0, keo);
    onXep(ids);
  };

  const doc916 = tiLe === '9:16';
  // Lớp phủ tự do (chữ · ảnh · hình khối) — lop-ui.tsx; số đo dùng chung với bản xuất (lop.ts).
  const { lop, dat: datLop, doi: doiLop, loi: loiLop, luu: luuLop } = useLop(tap.id, tap.lop ?? []);
  // Vùng chọn lớp phủ (#1289): nhiều lớp; bấm một lớp trong nhóm = chọn cả nhóm (lop.ts › chonLopMoi).
  const [chonLops, setChonLops] = useState<string[]>([]);
  const [moLan, setMoLan] = useState<string[]>([]);   // làn nhóm đang mở ra từng lớp (chỉ là cách xem, không đổi dữ liệu)
  const dsChonLop = lop.filter((l) => chonLops.includes(l.id));
  const lopChon = dsChonLop.length === 1 ? dsChonLop[0]! : null;
  const setChonLop = (id: string | null) => setChonLops(id ? [id] : []);
  const bamLop = (id: string, them: boolean) => setChonLops((d) => chonLopMoi(lop, d, id, them));
  // Hoàn tác thao tác lớp vừa làm (xoá, bỏ nhóm…) — 10 giây; "↶" trả nguyên mảng lớp trước đó.
  const [vuaXoa, setVuaXoa] = useState<{ truoc: Lop[]; chu: string } | null>(null);
  useEffect(() => { if (!vuaXoa) return; const h = setTimeout(() => setVuaXoa(null), 10000); return () => clearTimeout(h); }, [vuaXoa]);
  const xoaChon = () => { if (!chonLops.length) return; setVuaXoa({ truoc: lop, chu: `đã xoá ${chonLops.length} lớp` }); datLop((ds) => ds.filter((l) => !chonLops.includes(l.id))); setChonLops([]); };
  const gopChon = () => datLop((ds) => gopNhom(ds, chonLops));
  /** Bỏ nhóm — MỘT đường cho nút đầu làn, bảng Thuộc tính và ⇧⌘G: có ↶ hoàn tác ngay, và lớp nhớ nhóm cũ để "Gộp lại" lúc nào cũng được. */
  const boNhomIds = (ids: string[]) => { if (!ids.some((id) => lop.find((l) => l.id === id)?.nhom)) return; setVuaXoa({ truoc: lop, chu: `đã bỏ nhóm ${ids.length} lớp` }); datLop((ds) => boNhom(ds, ids)); };
  const boNhomChon = () => boNhomIds(chonLops);
  /** Chọn cả một tập lớp (bấm tên làn, kéo khung): thường = thay vùng chọn; Shift/⌘ = thêm, hoặc bớt nếu đã chọn hết. */
  const chonIds = (ids: string[], them: boolean) => setChonLops((d) => (!them ? ids : ids.every((x) => d.includes(x)) ? d.filter((x) => !ids.includes(x)) : [...d, ...ids.filter((x) => !d.includes(x))]));
  // Kéo khung chọn trên vùng làn lớp phủ: khối nào chạm khung thì vào vùng chọn (đọc data-lop-ids của khối trên màn — đúng thứ người thấy).
  const vungLop = useRef<HTMLDivElement>(null);
  const [khung, setKhung] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const keoKhung = (e: React.PointerEvent<HTMLDivElement>) => {
    const tg = e.target as HTMLElement;
    if (e.button !== 0 || tg.closest('[data-lop-ids],[data-nhan-lan],[data-thanh-lop],button,input,select,option,textarea,label,a')) return;   // thanh thao tác + mọi ô bấm: không phải chỗ trống
    const them = e.shiftKey || e.metaKey || e.ctrlKey; const x0 = e.clientX, y0 = e.clientY; let k = { x0, y0, x1: x0, y1: y0 };
    const di = (ev: PointerEvent) => { k = { x0, y0, x1: ev.clientX, y1: ev.clientY }; setKhung(k); };
    const xong = () => {
      window.removeEventListener('pointermove', di); window.removeEventListener('pointerup', xong); setKhung(null);
      if (Math.abs(k.x1 - k.x0) < 4 && Math.abs(k.y1 - k.y0) < 4) { if (!them) setChonLops([]); return; }
      const [l, r, t, b] = [Math.min(k.x0, k.x1), Math.max(k.x0, k.x1), Math.min(k.y0, k.y1), Math.max(k.y0, k.y1)];
      const ids = [...(vungLop.current?.querySelectorAll<HTMLElement>('[data-lop-ids]') ?? [])].filter((el) => { const h = el.getBoundingClientRect(); return h.right > l && h.left < r && h.bottom > t && h.top < b; })
        .flatMap((el) => (el.dataset.lopIds ?? '').split(',').filter(Boolean));
      chonIds([...new Set(ids)], them);
    };
    window.addEventListener('pointermove', di); window.addEventListener('pointerup', xong);
  };
  const soCu = soNhomCu(lop);
  const chonNhom = dsChonLop.length > 1 && dsChonLop.every((l) => l.nhom && l.nhom === dsChonLop[0]!.nhom);
  const panTrai = useKichThuoc('xv-tl-trai', 200, 140, 440);
  const panPhai = useKichThuoc('xv-tl-phai2', 420, 260, 720);   // rộng hơn: chứa cả thẻ shot (13/10/2026)
  const hangPan = useKichThuoc(`xv-tl-hang-${doc916 ? 'doc' : 'ngang'}`, doc916 ? 524 : 360, 260, 1000);
  // BỐ CỤC MÀN XEM (thẻ #1402 "cho hết cái này sang phải" + anh 19/10/2026: "có option chỉnh layout cho linh hoạt", tham chiếu CapCut): giữa = hàng panel
  // như cũ; phải / trái = màn xem thành CỘT cao gần hết màn hình, đứng yên khi cuộn timeline (phim dọc 9:16 to + thấy timeline cùng lúc). Tự động: phim dọc
  // → phải, phim ngang → giữa; phim có GÓI THỂ LOẠI thì theo bố cục của gói (boCucGoi). Chọn tay nhớ THEO TỪNG PHIM (không đè phim khác) + URL (?tlb=).
  const [boCucChon, setBoCuc] = useNho<'tu_dong' | 'giua' | 'phai' | 'trai'>(`xv-tl-bo-cuc-${tap.phim_id}`, 'tu_dong', ['tu_dong', 'giua', 'phai', 'trai'], 'tlb');
  const goiPhim = goiTheoKey(goi);
  const boCuc = boCucChon === 'tu_dong' ? (goiPhim ? boCucGoi(goiPhim) : doc916 ? 'phai' : 'giua') : boCucChon;
  const xemCanh = boCuc !== 'giua';
  // Bề rộng THẬT của khung timeline (phim mở trong ngăn kéo hẹp hơn cửa sổ — đo cửa sổ thì cột xem ăn mất timeline) + chiều cao cửa sổ.
  const khungRef = useRef<HTMLDivElement>(null);
  const [man, setMan] = useState({ w: 1600, h: 900 });
  useEffect(() => {
    const el = khungRef.current; const f = () => setMan({ w: el?.clientWidth || window.innerWidth, h: window.innerHeight });
    f(); window.addEventListener('resize', f); const ro = el ? new ResizeObserver(f) : null; if (el) ro!.observe(el);
    return () => { window.removeEventListener('resize', f); ro?.disconnect(); };
  }, []);
  // Bề rộng cột xem KÉO TAY được (anh 19/10/2026: "phải cho resize các khối linh hoạt"): 0 = tự (≤ 40% khung); kéo mép trong để đổi, nhấp đúp = về tự.
  const khoaCot = `xv-tl-cot-xem-${doc916 ? 'doc' : 'ngang'}`;
  const [cotTay, setCotTay] = useState<number>(() => Number(docLT(khoaCot)) || 0);
  const tiLeKhung = (w: number) => Math.round(doc916 ? (w * 16) / 9 : (w * 9) / 16);
  let caoXem = hangPan.v - 44, rongXem = Math.round(doc916 ? (caoXem * 9) / 16 : (caoXem * 16) / 9);
  if (xemCanh) {
    const caoToiDa = Math.max(360, man.h - 80);
    if (cotTay > 0) { rongXem = Math.max(220, Math.min(cotTay, Math.round(man.w * 0.75))); caoXem = tiLeKhung(rongXem); }
    else { caoXem = Math.max(360, man.h - 120); rongXem = Math.round(doc916 ? (caoXem * 9) / 16 : (caoXem * 16) / 9); const tran = Math.round(man.w * 0.4); if (rongXem > tran) { rongXem = tran; caoXem = tiLeKhung(tran); } }
    if (caoXem > caoToiDa) { caoXem = caoToiDa; rongXem = Math.round(doc916 ? (caoXem * 9) / 16 : (caoXem * 16) / 9); }
  }
  const keoCot = (e: PE<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const x0 = e.clientX, w0 = rongXem; let moi = w0;
    const di = (ev: PointerEvent) => { moi = Math.round(Math.max(220, Math.min(man.w * 0.75, w0 + (boCuc === 'phai' ? -1 : 1) * (ev.clientX - x0)))); setCotTay(moi); };
    const xong = () => { el.removeEventListener('pointermove', di); el.removeEventListener('pointerup', xong); el.removeEventListener('pointercancel', xong); ghiLT(khoaCot, String(moi)); };
    el.addEventListener('pointermove', di); el.addEventListener('pointerup', xong); el.addEventListener('pointercancel', xong);
  };
  // Chiều cao khu các làn: kéo góc dưới (resize dọc của trình duyệt) — nhớ theo máy; chưa kéo = tối đa 78% màn hình như cũ.
  const khoaCaoLan = 'xv-tl-cao-lan';
  const [caoLan, setCaoLan] = useState<number>(() => Number(docLT(khoaCaoLan)) || 0);
  useEffect(() => {
    const el = vungRef.current; if (!el) return;
    let h: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => { if (!el.style.height) return; clearTimeout(h); h = setTimeout(() => { const v = el.offsetHeight; setCaoLan(v); ghiLT(khoaCaoLan, String(v)); }, 250); });
    ro.observe(el); return () => { ro.disconnect(); clearTimeout(h); };
  }, []);
  const [dangThaVao, setDangThaVao] = useState<string | null>(null);
  /** Thả lớp `tu` vào chỗ lớp `den` (mảng: cuối = trên cùng; làn hiển thị đảo ngược như After Effects). */
  const doiThuTuLop = (tu: string, den: string) => { if (!tu || tu === den) return; datLop((ds) => { const l = ds.find((x) => x.id === tu); if (!l) return ds; const con = ds.filter((x) => x.id !== tu); const i = con.findIndex((x) => x.id === den); if (i < 0) return ds; const j = ds.findIndex((x) => x.id === tu) < ds.findIndex((x) => x.id === den) ? i + 1 : i; return [...con.slice(0, j), l, ...con.slice(j)]; }); };
  const themLop = (ds: Lop[]) => { datLop((x) => [...x, ...ds]); setChonLop(ds[ds.length - 1]?.id ?? null); setChay(false); };
  const anhSan = [...(qc?.logo_url ? [{ url: qc.logo_url, ten: 'Logo' }] : []), ...(qc?.anh ?? []).map((u, i) => ({ url: u, ten: `Ảnh sản phẩm ${i + 1}` }))];
  const vid = c ? c.video_cuoi_url || c.video_url : null;
  const p = c ? Math.min(1, tTrong / dur(c)) : 0;
  const kb = idx % 2 === 0 ? `scale(${1 + 0.08 * p}) translate(${-1.5 * p}%, ${-1 * p}%)` : `scale(${1.08 - 0.08 * p}) translate(${1.5 * p}%, 0)`;
  const mauNv = (v: NhanVat | null) => (v ? MAU_NV[nhanVat.filter((x) => x.loai === 'nhan_vat').findIndex((x) => x.id === v.id) % MAU_NV.length] ?? '#94a3b8' : '#94a3b8');
  const W = tong * pps;

  // Nút điều khiển của track nằm NGAY ở nhãn track đó (#1230 YDNI: nút cho khối nào thì ở cạnh khối đó, không gom lên trên cùng).
  // keoLop: id lớp phủ — nhãn làn kéo thả được để đổi thứ tự hiển thị (#1276).
  // Ẩn / hiện thành phần (#1296): làn nào ẩn khỏi timeline (nhớ theo trình duyệt) + chữ màn ẩn khỏi khung xem (chỉ khi xem, bản xuất vẫn vẽ).
  const [anLan, setAnLan] = useState<string[]>(() => { try { const v = JSON.parse(docLT('xv-tl-an-lan') ?? '[]') as unknown; return Array.isArray(v) ? v.map(String) : []; } catch { return []; } });
  const doiAnLan = (n: string) => setAnLan((d) => { const m = d.includes(n) ? d.filter((x) => x !== n) : [...d, n]; ghiLT('xv-tl-an-lan', JSON.stringify(m)); return m; });
  const anChuMan = anLan.includes('xem:chu_man');
  // CÂY ĐỐI TƯỢNG: làn nào đang mở nhánh (mẫu · trang phục · vị trí · dáng · kiểm khung…) — nhớ theo trình duyệt.
  const [moCay, setMoCay] = useState<number[]>(() => { try { const v = JSON.parse(docLT('xv-tl-mo-cay') ?? '[]') as unknown; return Array.isArray(v) ? v.map(Number) : []; } catch { return []; } });
  const doiMoCay = (id: number) => setMoCay((d) => { const m = d.includes(id) ? d.filter((x) => x !== id) : [...d, id]; ghiLT('xv-tl-mo-cay', JSON.stringify(m)); return m; });
  const dsLan: string[] = [];
  // Danh sách làn của lần vẽ trước — menu 👁 đọc lúc mở (làn được khai trong lúc vẽ, sau ô thước nơi đặt menu).
  const lanRef = useRef<string[]>([]);
  useEffect(() => { lanRef.current = dsLan; });
  /** dau: thứ đứng trước tên làn (hình đại diện đối tượng, #1415) · anhGoiY: ảnh lớn hiện trong thẻ gợi ý khi rê tên làn. */
  const track = (nhan: string, mo: string, noiDung: ReactNode, cao = 26, nut?: ReactNode, keoLop?: string, onNhan?: (them: boolean) => void, dangChon?: boolean, dau?: ReactNode, anhGoiY?: string) => {
    if (!keoLop && !dsLan.includes(nhan)) dsLan.push(nhan);
    if (!keoLop && nhan !== '🎬 Hình' && anLan.includes(nhan)) return null;
    return (
    <div style={{ display: 'flex', alignItems: 'stretch', height: cao, marginTop: 3, outline: keoLop && dangThaVao === keoLop ? '1px solid var(--cyan)' : undefined }}>
      <div data-goi-y={`${nhan}\n${mo}${onNhan ? '\nbấm tên làn = chọn cả làn · Shift/⌘ + bấm = thêm/bớt' : ''}`} data-nhan-lan="1" data-goi-y-anh={anhGoiY}
        onClick={onNhan ? (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest('button')) return; onNhan(e.shiftKey || e.metaKey || e.ctrlKey); } : undefined}
        {...(keoLop ? { draggable: true, onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData('text/xv-lop', keoLop); e.dataTransfer.effectAllowed = 'move'; },
          onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('text/xv-lop')) { e.preventDefault(); setDangThaVao(keoLop); } },
          onDragLeave: () => setDangThaVao(null), onDrop: (e: React.DragEvent) => { e.preventDefault(); setDangThaVao(null); doiThuTuLop(e.dataTransfer.getData('text/xv-lop'), keoLop); } } : {})}
        style={{ cursor: keoLop ? 'grab' : onNhan ? 'pointer' : undefined,  width: nhanW, flexShrink: 0, position: 'sticky', left: 0, zIndex: 5, background: dangChon ? 'color-mix(in srgb, var(--cyan) 22%, var(--bg-1))' : 'var(--bg-1)', color: dangChon ? 'var(--fg-1)' : undefined, ...mono, display: 'flex', alignItems: 'center', gap: 3, paddingLeft: 4, paddingRight: 4 }}>
        {dau}<span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nhan}</span>{nut}{tayNhan}
      </div>
      {/* Bấm vào CHỖ TRỐNG của làn (không trúng khối nào) = tua đầu phát tới đó (#1398) — mọi làn, không chỉ thước giờ. */}
      <div style={{ position: 'relative', width: W, flexShrink: 0 }} onClick={(e) => { if (e.target === e.currentTarget) tuaToi(Math.max(0, Math.min(tong, e.nativeEvent.offsetX / pps))); }}>{noiDung}</div>
    </div>
  ); };
  /** Làn CON của cây đối tượng: thụt vào, thấp hơn, không vào menu ẩn làn (ẩn theo làn cha). */
  const lanCon = (nhan: string, mo: string, noiDung: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'stretch', height: 20, marginTop: 1 }}>
      {/* Thụt bằng đệm + vạch bóng trong, KHÔNG margin/viền trái: margin làm ô nhãn rộng nhanW+14 → khối của làn con lệch phải 14px so với
          làn cha, và nhãn dính hở khe cho khối cuộn ló qua (#1417, cùng gốc #1413). */}
      <div data-goi-y={mo} style={{ width: nhanW, flexShrink: 0, position: 'sticky', left: 0, zIndex: 5, background: 'var(--bg-1)', color: 'var(--fg-3)', fontSize: 11, display: 'flex', alignItems: 'center', paddingLeft: 44, boxShadow: 'inset 14px 0 0 var(--bg-1), inset 16px 0 0 var(--line)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{nhan}</div>
      {/* Làn con thấp 20px → khối trong đó chữ nhỏ + dòng 14px cho nằm giữa (khoiAm đọc --khoi-co / --khoi-lh). */}
      <div style={{ position: 'relative', width: W, flexShrink: 0, '--khoi-co': '9.5px', '--khoi-lh': '14px' } as React.CSSProperties}>{noiDung}</div>
    </div>
  );
  const nutNho = (chu: string, title: string, tat: boolean, onClick: () => void) => (
    <button type="button" title={title} onClick={onClick} style={{ flexShrink: 0, fontSize: 11, lineHeight: '16px', padding: '0 3px', borderRadius: 3, border: '1px solid var(--line)', background: tat ? 'none' : 'var(--bg-2)', color: tat ? 'var(--fg-4)' : 'var(--fg-2)', cursor: 'pointer', opacity: tat ? 0.6 : 1 }}>{chu}</button>
  );
  const batTat = (k: string) => setTat((x) => ({ ...x, [k]: !x[k] }));
  // Tiếng clip ba nấc: tự (tắt khi shot có giọng/hiệu ứng riêng) → bật hết → tắt hết → tự.
  const vongClip = () => setTat((x) => { const n = { ...x }; if (x.clip === undefined) n.clip = false; else if (x.clip === false) n.clip = true; else delete n.clip; return n; });
  const [yc, setYc] = useState<YeuCauBang | null>(null);
  const ngheRef = useRef<HTMLAudioElement | null>(null);
  const [dangNghe, setDangNghe] = useState('');
  const ngheRieng = (urls: string[]) => {
    const khoa = urls.join('|');
    ngheRef.current?.pause();
    if (dangNghe === khoa) { setDangNghe(''); return; }
    setChay(false);
    let i = 0;
    const phat = () => { const a = new Audio(urls[i]!); ngheRef.current = a; a.onended = () => { i++; if (i < urls.length) phat(); else setDangNghe(''); }; void a.play().catch(() => setDangNghe('')); };
    setDangNghe(khoa); phat();
  };
  useEffect(() => () => ngheRef.current?.pause(), []);
  type NutSinh = { loai: YeuCauBang['loai']; cc?: Canh; phanDoan?: string; giay: number; title: string; dang?: boolean; nghe?: string[] };
  /** kyHieu: chữ đặt trước nội dung khối — mặc định ♪ cho khối âm có file; làn không phải âm thanh (Đối tượng) truyền '' */
  const khoiAm = (x: number, w: number, co: boolean, mau: string, chu: string, title: string, key: number | string, onClick?: () => void, nutSinh?: NutSinh, kyHieu?: string) => (
    <div key={key} data-goi-y={title} onClick={onClick}
      style={{ position: 'absolute', left: x + 1, width: Math.max(4, w - 2), top: 2, bottom: 2, borderRadius: 4, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default',
        background: co ? `${mau}33` : 'transparent', border: `1px ${co ? 'solid' : 'dashed'} ${mau}${co ? '' : '99'}`,
        color: co ? mau : 'var(--fg-3)', fontSize: 'var(--khoi-co, 10px)', lineHeight: 'var(--khoi-lh, 20px)', padding: nutSinh ? '0 22px 0 5px' : '0 5px', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
      {nutSinh?.dang && <div className="xv-dang" style={{ borderRadius: 4 }}><span>⏳ đang sinh</span></div>}
      {nutSinh?.nghe?.length ? (
        // Nghe riêng đúng khối này (#1206) — không cần chạy cả timeline.
        <button type="button" title={dangNghe === nutSinh.nghe.join('|') ? 'Dừng' : 'Nghe riêng'} onClick={(e) => { e.stopPropagation(); ngheRieng(nutSinh.nghe!); }}
          style={{ marginRight: 4, padding: '0 5px', borderRadius: 3, border: `1px solid ${mau}`, background: dangNghe === nutSinh.nghe.join('|') ? mau : 'transparent', color: dangNghe === nutSinh.nghe.join('|') ? '#0b0b0b' : mau, fontSize: 9.5, lineHeight: '14px', cursor: 'pointer', position: 'relative', zIndex: 2 }}>
          {dangNghe === nutSinh.nghe.join('|') ? '■' : '▶'}
        </button>
      ) : kyHieu ?? (co && mau !== '#38d9f5' ? '♪ ' : '')}{chu}
      {nutSinh && (
        // Nút ＋ to, sáng: mở bảng tuỳ chọn (model, giọng, nguồn, mô tả, giá) — không sinh ngay (#1202).
        <button type="button" className="xv-nut-sinh" title={nutSinh.title} disabled={nutSinh.dang}
          onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setYc({ loai: nutSinh.loai, cc: nutSinh.cc, phanDoan: nutSinh.phanDoan, giay: nutSinh.giay, x: r.right, y: r.bottom }); }}
          style={{ position: 'absolute', right: 2, top: 3, bottom: 3, width: 16, padding: 0, borderRadius: 3, border: 0, background: mau, color: '#0b0b0b', fontWeight: 800, fontSize: 11, lineHeight: '14px', cursor: 'pointer' }}>
          {nutSinh.dang ? '⏳' : co ? '↻' : '+'}
        </button>
      )}
    </div>
  );

  if (!canh.length) return null;
  const khungXem = (
        <main style={{ display: 'grid', placeItems: 'center', padding: 8, background: 'var(--bg-0, #0b0b0d)' }} onPointerDown={(e) => { if (!e.shiftKey && !e.metaKey && !e.ctrlKey) setChonLops([]); }}>
          <div style={{ position: 'relative', width: rongXem, height: caoXem, overflow: 'hidden', borderRadius: 4, background: '#000' }}>
            {/* Hiệu ứng khung (lớp ✦, lop.ts › hieuUngKhungTai): rung/zoom/mờ/đen trắng/glitch áp lên hình + lớp phủ; chớp/tối viền/hạt là lớp phủ trên đó, dưới chữ màn. */}
            {/* Hiệu ứng khung + chuyển cảnh + lớp phủ hiệu ứng: MỘT component cho timeline và màn toàn màn hình (KhungHieuUng, lop-ui.tsx). */}
            <KhungHieuUng lop={lop} t={t} rong={rongXem} tTrong={tTrong}
              chuyen={idx > 0 && c ? { anh: canh[idx - 1]!.keyframe_url, key: canh[idx - 1]!.ky_thuat?.chuyen_canh, giay: canh[idx - 1]!.ky_thuat?.giay_cc, phatTruoc: dur(canh[idx - 1]!), phatNay: dur(c) } : undefined}>
              {c && (vid ? <video ref={vidRef} key={vid} src={vid} poster={anhNho(c.keyframe_url, 640) ?? undefined} playsInline preload="auto" onLoadedMetadata={(e) => setDaiVid(e.currentTarget.duration || 0)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : c.keyframe_url ? <img src={anhNho(c.keyframe_url, 640)} alt="" data-khong-phong-to="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: kb }} />
                : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#666', fontSize: 12 }}>#{c.thu_tu} chưa có hình</div>)}
              <LopXem lop={lop} t={t} rong={rongXem} cao={caoXem} chonIds={chonLops} onChon={bamLop} onDoi={doiLop} dangChay={chay} />
            </KhungHieuUng>
            {c?.chu_man && !anChuMan && <ChuManXem chu={c.chu_man} giay={tTrong} rong={rongXem} qc={qc} kieu={c.kieu_chu} phat={giayPhat(c)} />}
            {/* Tải trước clip shot trước / sau (#1366): bấm sang shot kề là hình có ngay; shot xa thì ảnh chờ (poster = keyframe nhỏ) hiện tức thì trong lúc clip tải. */}
            {[canh[idx - 1], canh[idx + 1]].map((k) => k && (k.video_cuoi_url || k.video_url)).filter((u): u is string => !!u).map((u) => <video key={`truoc-${u}`} src={u} preload="auto" muted playsInline style={{ display: 'none' }} />)}
            {giongNay && <audio ref={thoaiRef} key={khoaGiong} src={giongNay.url} preload="auto" />}
            {c?.am_thanh_url && <audio ref={sfxRef} key={c.am_thanh_url} src={c.am_thanh_url} preload="auto" />}
            {tap.nhac_url && <audio ref={nhacRef} src={tap.nhac_url} preload="auto" />}
            {nhacPc && <audio ref={nhacPcRef} key={nhacPc} src={nhacPc} preload="auto" />}
          </div>
        </main>
  );
  return (
    <div ref={khungRef} className="xv-panel" style={{ marginTop: 8, padding: 0, overflow: 'clip', position: 'relative', ...(xemCanh ? { [boCuc === 'phai' ? 'paddingRight' : 'paddingLeft']: rongXem + 17 } : {}) }} data-ngu-canh={`timeline ${t.toFixed(1)}s/${tong}s · cảnh #${c?.thu_tu ?? '?'} đang ở đầu phát`}>
      {xemCanh && <div style={{ position: 'absolute', top: 0, bottom: 0, [boCuc === 'phai' ? 'right' : 'left']: 0, width: rongXem + 17, [boCuc === 'phai' ? 'borderLeft' : 'borderRight']: '1px solid var(--line)', background: 'var(--bg-0, #0b0b0d)' }}>
        <div style={{ position: 'sticky', top: 0 }}>{khungXem}</div>
        <TayKeo truc="x" onPointerDown={keoCot} onDoubleClick={() => { setCotTay(0); ghiLT(khoaCot, null); }} title="Kéo để đổi bề rộng màn xem · nhấp đúp = về tự động"
          style={{ position: 'absolute', top: 0, bottom: 0, [boCuc === 'phai' ? 'left' : 'right']: -2, width: 5, zIndex: 3 }} />
      </div>}
      {/* Bố cục kiểu After Effects (anh 11/10/2026): thanh công cụ · 3 panel CỐ ĐỊNH (Dự án | Khung hình | Thuộc tính) · timeline thứ tự lớp.
          Hàng panel cao cố định = khung hình, panel tự cuộn bên trong → chọn/bỏ chọn lớp chỉ đổi NỘI DUNG panel, không xô timeline (YDNI §bố cục đứng yên). */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <button type="button" className="xv-btn" title="Cảnh trước (←)" onClick={() => tuaToi(batDau[Math.max(0, idx - 1)] ?? 0)}>⏮</button>
        <button type="button" className="xv-btn chinh" style={{ minWidth: 80 }} title="Chạy / dừng (Space)" onClick={() => { if (!chay && t >= tong - 0.05) setT(0); setChay(!chay); }}>{chay ? '⏸ Dừng' : '▶ Chạy'}</button>
        <button type="button" className="xv-btn" title="Cảnh sau (→)" onClick={() => tuaToi(batDau[Math.min(canh.length - 1, idx + 1)] ?? 0)}>⏭</button>
        <span style={{ ...mono, fontSize: 12, color: 'var(--fg-1)', minWidth: 96 }}>{dongHo(t)} / {dongHo(tong)}</span>
        <button type="button" className="xv-btn" onClick={onToanManHinh} title="Xem cả tập toàn màn hình">⛶</button>
        <Seg value={boCuc} onChange={(v) => setBoCuc(v)} options={[{ value: 'trai', label: '◧', title: 'Màn xem bên TRÁI, cao gần hết màn hình — timeline bên phải' }, { value: 'giua', label: '▣', title: 'Màn xem ở GIỮA hàng panel (Dự án | Khung hình | Thuộc tính) như cũ' }, { value: 'phai', label: '◨', title: 'Màn xem bên PHẢI, cao gần hết màn hình — kiểu CapCut (mặc định cho phim dọc 9:16)' }]} />
        <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', margin: '0 4px' }} />
        <LopCongCu t={t} tiLe={doc916 ? 9 / 16 : 16 / 9} onThem={themLop} />
        {onDoiKyThuat && <button type="button" className="xv-btn" title={'Nhịp hành động cả tập: cắt sốc → chớp/rung/zoom + tiếng đập · quất/phóng → tiếng vút · loé trắng → âm doạ.\nĐiểm cắt đã có hiệu ứng thì để nguyên; chạy lại không nhân đôi.'}
          onClick={() => { const r = nhipHanhDong(canh, batDau, lop); if (r.lop.length) datLop((ds) => [...ds, ...r.lop]); if (r.kt.length) onDoiKyThuat(r.kt); setBaoNhip(r.lop.length || r.kt.length ? `⚡ +${r.lop.length / 3} impact · ${r.kt.length} shot thêm tiếng` : '⚡ không có điểm cắt nào cần thêm'); }}>⚡ Nhịp hành động</button>}
        <button type="button" className="xv-btn" title={'Thẻ tên nhân vật (luật the_ten_nhan_vat): shot ĐẦU mỗi nhân vật là chủ thể rõ mặt → tên vàng ~2,5 giây giữa khung.\nThêm thành lớp phủ — sửa chữ / thêm vai / dời / xoá như lớp thường. Bấm lại không nhân đôi.'}
          onClick={() => { const r = theTenTap(canh, batDau, nhanVat, lop); if (r.lop.length) datLop((ds) => [...ds, ...r.lop]); const so = r.lop.filter((l) => !l.ten?.endsWith(' · vai')).length; setBaoNhip(`🏷 +${so} thẻ tên${r.khongCho.length ? ` · chưa có shot rõ mặt: ${r.khongCho.join(', ')}` : ''}`); }}>🏷 Thẻ tên</button>
        {(() => { const n = nhipCat(canh, theLoai); return n.asl > 0 && <span style={{ ...mono, color: n.canhBao.length ? 'var(--warn, #d97706)' : undefined }} title={`Nhịp cắt (luật nhip_cat_doc): trung bình ${n.asl} s/shot${n.asl_thoai != null ? ` · đoạn thoại ${n.asl_thoai} s` : ''}${n.canhBao.length ? `\n${n.canhBao.map((x) => `• ${x.chu}`).join('\n')}` : ''}`}>⏲ {n.asl}s{n.canhBao.length ? ' ⚠' : ''}</span>; })()}
        {onKhopGiong && <button type="button" className="xv-btn" title="Khớp giây phát mỗi shot theo giọng đã sinh: đủ đọc hết câu (tốc ≤1,1×), mốc chữ màn co giãn theo, lớp phủ dời theo shot. 0đ, ↶ Hoàn tác được." onClick={() => { if (dangKhop) return; setDangKhop(true); void onKhopGiong().then((m) => setBaoNhip(m)).finally(() => setDangKhop(false)); }}>⏱ Khớp giọng</button>}
        {baoNhip && <span style={mono}>{baoNhip}</span>}
        <span style={{ flex: 1 }} />
        {vuaXoa && <span style={mono}>{vuaXoa.chu} · <button type="button" className="xv-lienket" onClick={() => { const tr = vuaXoa.truoc; datLop(() => tr); setVuaXoa(null); }}>↶ Hoàn tác</button></span>}
        {loiLop ? <span className="xv-loi">{loiLop}</span> : <span style={{ ...mono, minWidth: 70, textAlign: 'right' }}>{luuLop === 'dang' ? 'đang lưu…' : luuLop === 'xong' ? '✓ đã lưu' : ''}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: xemCanh ? `${panTrai.v}px 4px minmax(0, 1fr)` : `${panTrai.v}px 4px minmax(0, 1fr) 4px ${panPhai.v}px`, height: hangPan.v }}>
        <aside style={{ overflowY: 'auto', padding: 8, display: 'grid', gap: 6, alignContent: 'start' }}>
          <div style={{ ...mono, letterSpacing: 0.5 }}>DỰ ÁN</div>
          {c && <div style={{ fontSize: 12 }}><b>#{c.thu_tu} {c.canh}</b></div>}
          {c && <div style={mono}>phát {dur(c)}s{dur(c) !== (c.thoi_luong_s || 4) ? ` / clip ${c.thoi_luong_s || 4}s` : ''} · {vid ? (c.video_cuoi_url ? 'bản cuối' : 'nháp') : c.keyframe_url ? 'keyframe' : 'chưa có hình'}{c.nhanh ? ` · hook ${c.nhanh}` : ''}</div>}
          {c?.chu_man && <div style={{ fontSize: 11.5 }}>✎ {chuManHien(c.chu_man)}</div>}
          {c?.hanh_dong && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{c.hanh_dong}</div>}
          {c && <div style={mono}>❤ khán giả: {tenCamXuc(c.cam_xuc)}</div>}
          <div style={{ ...mono, letterSpacing: 0.5, marginTop: 6 }}>NGUYÊN LIỆU</div>
          <LopNguyenLieu t={t} anh={anhSan} onThem={themLop} />
          {c && <button type="button" className="xv-lienket xv-mono" style={{ textAlign: 'left' }} onClick={() => moNgan({ loai: 'kho', dich: { canhId: c.id } })}>📦 Kho tài sản → clip / keyframe cho shot này</button>}
          {c && (c.keyframe_url || c.video_url) && <button type="button" className="xv-lienket xv-mono" style={{ textAlign: 'left' }} onClick={() => moNgan({ loai: 'nguon', canhId: c.id })}>🔗 Nguồn của shot này</button>}
          {c && laQc && onDoiCta && laShotCta(c.phan_doan) && <ChonCta hienTai={qc?.cta} onDoi={onDoiCta} />}
          {c && <ThamKhaoShot c={c} laQc={!!laQc} />}
        </aside>
        <TayKeo truc="x" onPointerDown={panTrai.keo('x')} onDoubleClick={panTrai.veMacDinh} />
        {/* Bấm vào chỗ trống (ngoài lớp, trong hay ngoài khung hình) = bỏ chọn (#1288) — lớp và tay nắm tự chặn sự kiện của mình. */}
        {!xemCanh && khungXem}
        {!xemCanh && <TayKeo truc="x" onPointerDown={panPhai.keo('x', -1)} onDoubleClick={panPhai.veMacDinh} />}
        {/* minmax(0,1fr): ô lưới không nở theo nội dung dài (thẻ shot) — co theo bề rộng panel và tự xuống dòng. */}
        <aside style={{ overflowY: 'auto', overflowX: 'hidden', padding: 8, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, alignContent: 'start' }}>
          <div style={{ ...mono, letterSpacing: 0.5 }}>THUỘC TÍNH</div>
          {dsChonLop.length > 1 ? <LopNhieu ds={dsChonLop} onGop={gopChon} onBoNhom={boNhomChon} onXoa={xoaChon} onDong={() => setChonLops([])} />
          : lopChon ? <LopBang l={lopChon} t={t} onDoi={(p) => doiLop(lopChon.id, p)} onDong={() => setChonLop(null)}
            onXoa={() => { datLop((ds) => ds.filter((x) => x.id !== lopChon.id)); setChonLop(null); }}
            onNhanBan={() => { const moi = { ...lopChon, id: idLop(), nhom: undefined, x: Math.min(1, lopChon.x + 0.04), y: Math.min(1, lopChon.y + 0.04) }; datLop((ds) => [...ds, moi]); setChonLop(moi.id); }}
            onLenXuong={(d) => datLop((ds) => { const i = ds.findIndex((x) => x.id === lopChon.id); const j = i + d; if (i < 0 || j < 0 || j >= ds.length) return ds; const n = [...ds]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; })} />
          : theShot ? <>
            <div style={mono}>Shot đang chọn · bấm một lớp trên khung hình hoặc làn 🧩 để sửa lớp đó</div>
            {theShot}
          </> : <>
            <div style={mono}>Bấm một lớp trên khung hình hoặc làn 🧩 để sửa. Đang xem âm thanh của shot #{c?.thu_tu}:</div>
            {c && dongThoai(c, nhanVat).map((d, i) => {
              const v = timNv(nhanVat, tenNoi(d)) ?? null;
              return <div key={i} style={{ fontSize: 11.5 }}><b style={{ color: mauNv(v) }}>🗣 {tenNoi(d)}</b>{d.dien_xuat && <i style={{ color: 'var(--fg-3)' }}> ({d.dien_xuat})</i>}: {d.loi}{!d.url && <span style={{ ...mono, color: 'var(--amber)' }}> · chưa sinh giọng{docThu ? ', đang đọc thử' : ''}</span>}</div>;
            })}
            {c?.am_thanh && <div style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>🔊 {c.am_thanh}{!c.am_thanh_url && <span style={{ ...mono, color: 'var(--amber)' }}> · chưa sinh</span>}</div>}
            {c && !dongThoai(c, nhanVat).length && !c.am_thanh && <div style={mono}>shot này không có thoại / hiệu ứng</div>}
          </>}
        </aside>
      </div>

      <TayKeo truc="y" onPointerDown={hangPan.keo('y')} onDoubleClick={hangPan.veMacDinh} title="Kéo để đổi chiều cao khung hình · nhấp đúp = mặc định" />
      {/* Các track */}
      {/* Không đệm TRÁI ở khung cuộn (#1413): cột nhãn dính left:0 bám mép trong lớp đệm → khe 10px bên trái nhãn để khối đang cuộn ló qua; đầu phát kéo cũng lệch 10px. */}
      {/* Khung cuộn CẢ HAI chiều, cao tối đa 78vh (#1418): overflowX đã biến nó thành hộp cuộn nên sticky-top không bám được trang —
          tự cuộn dọc bên trong thì thước giây + làn 🎬 Hình dính trên cùng khi cuộn xuống các làn dưới. */}
      <div ref={vungRef} title="" style={{ marginTop: 0, padding: '0 10px 0 0', borderTop: '1px solid var(--line)', overflow: 'auto', ...(caoLan ? { height: caoLan } : { maxHeight: '78vh' }), minHeight: 160, resize: 'vertical', position: 'relative', paddingBottom: 4 }}>
        <div style={{ width: W + nhanW, position: 'relative' }}>
          {/* Thước giây — bấm/kéo để tua; dính trên cùng khi cuộn dọc */}
          <div style={{ display: 'flex', height: 24, paddingTop: 6, position: 'sticky', top: 0, zIndex: 9, background: 'var(--bg-1)' }}>
            <div style={{ width: nhanW, flexShrink: 0, position: 'sticky', left: 0, zIndex: 5, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 3, paddingLeft: 4, ...mono }}>
              <span title="Space chạy/dừng · ←/→ đổi cảnh · kéo mép clip = cắt giây phát · kéo clip đổi thứ tự · nét đứt = chưa sinh" style={{ cursor: 'help' }}>⌨</span>
              {nutNho('🔍−', 'Thu nhỏ thước thời gian', zoom <= 1, () => setZoom((z) => Math.max(1, z - 0.5)))}
              <span title="Độ phóng thước thời gian (giữ qua F5)" style={{ minWidth: 22, textAlign: 'center' }}>{zoom}×</span>
              {nutNho('🔍+', 'Phóng to thước thời gian', zoom >= 6, () => setZoom((z) => Math.min(6, z + 0.5)))}
              <Menu nhan={anLan.filter((x) => !x.startsWith('xem:')).length ? `👁 ${anLan.filter((x) => !x.startsWith('xem:')).length} ẩn` : '👁'}>
                <DsLanAn lay={() => lanRef.current} an={anLan} onDoi={doiAnLan} />
              </Menu>
              {tayNhan}
            </div>
            <div style={{ position: 'relative', width: W, cursor: 'pointer' }}
              onPointerDown={(e) => keoDauPhat(e, e.currentTarget.getBoundingClientRect().left)}>
              {Array.from({ length: Math.floor(tong) + 1 }, (_, s) => {
                const nhan = pps >= 40 || s % (pps >= 20 ? 2 : 5) === 0;
                return <div key={s} style={{ position: 'absolute', left: s * pps, bottom: 0, height: nhan ? 10 : 5, borderLeft: '1px solid var(--line)' }}>{nhan && <span style={{ ...mono, fontSize: 9, position: 'absolute', left: 2, top: -9 }}>{s}s</span>}</div>;
              })}
            </div>
          </div>

          {/* Thứ tự làn như After Effects: trên cùng = vẽ trên cùng (chữ màn → lớp phủ → video), rồi làn tham chiếu, rồi âm thanh. */}
          {canh.some((x) => x.chu_man.trim()) && track('✎ Chữ màn', 'Chữ hiện trên màn của từng shot (hook, số liệu, ưu đãi, CTA) — sửa ở form cảnh; bản xuất vẽ đúng chữ này', canh.map((cc, i) => {
            if (!cc.chu_man.trim()) return null;
            return khoiAm(batDau[i]! * pps, dur(cc) * pps, true, '#facc15', chuManHien(cc.chu_man), cc.chu_man, cc.id, () => { bamShot(cc.id, i); });
          }), 26, nutNho(anChuMan ? '🙈' : '👁', anChuMan ? 'Chữ màn đang ẩn khỏi khung xem (bản xuất vẫn có) — bấm để hiện' : 'Ẩn chữ màn khỏi khung xem để nhìn hình sạch (bản xuất vẫn có)', anChuMan, () => doiAnLan('xem:chu_man')))}

          {/* Lớp phủ: mỗi lớp một làn (lớp sau nằm trên), kéo khối đổi giờ — bấm chọn để sửa ở bảng bên phải khung xem. */}
          <div ref={vungLop} onPointerDown={keoKhung}>
          {lop.length > 0 && track('🧩 Lớp phủ', 'Chọn nhiều lớp: kéo khung trên các làn, bấm tên làn (cả làn), hoặc Shift/⌘ + bấm khối → ⛓ Gộp nhóm (⌘G) · Bỏ nhóm (⇧⌘G) · Xoá (Del) · Esc bỏ chọn',
            <div data-thanh-lop="1" style={{ display: 'flex', gap: 6, alignItems: 'center', height: '100%', paddingLeft: 6, borderRadius: 4, ...mono, ...(dsChonLop.length ? { background: 'color-mix(in srgb, var(--cyan) 18%, transparent)', outline: '1px solid var(--cyan)' } : {}) }}>
              {dsChonLop.length > 0 && <b style={{ color: 'var(--fg-1)' }}>✓ {dsChonLop.length} lớp đang chọn</b>}
              {dsChonLop.length > 1 && !chonNhom && <button type="button" className="xv-btn" style={{ padding: '0 8px', lineHeight: '18px' }} title="Gộp các lớp đang chọn thành một nhóm MỚI (⌘G)" onClick={gopChon}>⛓ Nhóm mới {dsChonLop.length} lớp</button>}
              {(() => {
                // Thêm vào nhóm có sẵn: vùng chọn có đúng MỘT nhóm + lớp lẻ → thêm thẳng vào nhóm đó; toàn lớp lẻ → chọn nhóm đích trong menu.
                const ma = [...new Set(dsChonLop.map((l) => l.nhom).filter((x): x is string => !!x))];
                const le = dsChonLop.filter((l) => !l.nhom); if (!le.length) return null;
                const them = (m: string) => { setVuaXoa({ truoc: lop, chu: `đã thêm ${le.length} lớp vào nhóm` }); datLop((ds) => themVaoNhom(ds, le.map((l) => l.id), m)); };
                if (ma.length === 1) { const ten = tenNhom(lop.filter((l) => l.nhom === ma[0])); return <button type="button" className="xv-btn" style={{ padding: '0 8px', lineHeight: '18px', fontWeight: 600 }} title="Giữ nhóm cũ, thêm các lớp lẻ đang chọn vào" onClick={() => them(ma[0]!)}>＋ Thêm {le.length} lớp vào ⛓ {ten}</button>; }
                const nh = dsNhom(lop); if (ma.length || !nh.length) return null;
                return <Chon nut="＋ Thêm vào nhóm…" title="Thêm các lớp đang chọn vào một nhóm có sẵn" value="" onChange={(v) => v && them(v)}
                  options={nh.map((n) => ({ value: n.ma, label: `⛓ ${n.ten}`, phu: `${n.so} lớp · ${n.tu.toFixed(1)}s` }))} />;
              })()}
              {dsChonLop.some((l) => l.nhom) && <button type="button" className="xv-btn" style={{ padding: '0 8px', lineHeight: '18px' }} title="Các lớp đang chọn rời nhóm, thành lớp lẻ (⇧⌘G) — có ↶ hoàn tác; chỉ chọn vài lớp trong nhóm (mở ▸ rồi kéo khung) thì chỉ những lớp đó rời nhóm" onClick={boNhomChon}>{dsChonLop.some((l) => l.nhom && lop.some((x) => x.nhom === l.nhom && !chonLops.includes(x.id))) ? 'Tách khỏi nhóm' : 'Bỏ nhóm'}</button>}
              {dsChonLop.length > 0 && <button type="button" className="xv-btn" style={{ padding: '0 8px', lineHeight: '18px' }} title="Xoá các lớp đang chọn (Del) — có ↶ hoàn tác" onClick={xoaChon}>🗑 Xoá</button>}
              {dsChonLop.length > 0 && <button type="button" className="xv-btn" style={{ padding: '0 8px', lineHeight: '18px' }} title="Bỏ chọn (Esc)" onClick={() => setChonLops([])}>✕ Bỏ chọn</button>}
              {soCu > 0 && nutNho(`⛓ Gộp lại ${soCu} nhóm đã tách`, 'Trả các lớp đã bỏ nhóm về đúng nhóm cũ', false, () => datLop((ds) => gopLaiNhomCu(ds)))}
              {!dsChonLop.length && <span>kéo khung trên làn · bấm tên làn · Shift + bấm khối → chọn nhiều lớp</span>}
            </div>, 22)}
          {lop.length ? lanLop(lop).map((ln) => {
              const le = ln.khoi.length === 1 && ln.khoi[0]!.length === 1 ? ln.khoi[0]![0]! : null; const tat = ln.khoi.flat(); const ids = tat.map((x) => x.id); const an = tat.every((x) => x.an);
              const cungNhom = (l: Lop) => (chonLops.includes(l.id) ? dsChonLop : lop.filter((x) => nhomCua(lop, l.id).includes(x.id)));
              const nutAn = nutNho(an ? '🙈' : '👁', an ? 'Đang ẩn (không hiện, không xuất) — bấm để hiện' : 'Ẩn (không hiện, không xuất)', an, () => datLop((ds) => ds.map((x) => (ids.includes(x.id) ? { ...x, an: !an } : x))));
              if (le) return <Fragment key={ln.key}>{track(`⋮⋮ ${ln.nhan}`, 'Lớp phủ — kéo thân để dời, kéo mép để đổi giờ vào/ra; bấm để sửa',
                <KhoiLop l={le} pps={pps} chon={chonLops.includes(le.id)} cung={cungNhom(le)} onChon={(them) => bamLop(le.id, them)} onDoi={doiLop} />, 20, nutAn, le.id, (them) => bamLop(le.id, them), chonLops.includes(le.id))}</Fragment>;
              const mo = moLan.includes(ln.key);
              const nutMo = nutNho(mo ? '▾' : '▸', mo ? 'Gộp lại thành một làn' : 'Mở ra từng lớp (chớp / rung / zoom…) để sửa riêng — vẫn giữ nhóm', !mo, () => setMoLan((d) => (mo ? d.filter((x) => x !== ln.key) : [...d, ln.key])));
              const nutBo = nutNho('✂', 'Bỏ nhóm: tách mọi nhóm trong làn này thành lớp lẻ — có ↶ hoàn tác, và "⛓ Gộp lại" ở làn 🧩 Lớp phủ trả đúng nhóm cũ', true, () => boNhomIds(ids));
              // Mở ra: mỗi tên lớp con một làn ("Impact · chớp" của cả 8 nhóm chung một làn) — kéo mép đổi giờ riêng lớp, kéo thân dời cả nhóm.
              const con = [...new Set(tat.map((x) => tenLop(x)))];
              return <Fragment key={ln.key}>
                {track(`⛓ ${ln.nhan}${ln.khoi.length > 1 ? ` ×${ln.khoi.length}` : ''}`, 'Nhóm lớp (mỗi khối một nhóm) — kéo khối dời cả nhóm, bấm để chọn cả nhóm; ▸ mở ra từng lớp để sửa riêng',
                  <>{ln.khoi.map((k) => { const l = k[0]!; return <KhoiLop key={l.id} ids={k.map((x) => x.id)} l={{ ...l, tu: Math.min(...k.map((x) => x.tu)), den: Math.max(...k.map((x) => x.den)), ten: ln.nhan }} nhom pps={pps} chon={k.some((x) => chonLops.includes(x.id))} cung={cungNhom(l)} onChon={(them) => bamLop(l.id, them)} onDoi={doiLop} />; })}</>, 20,
                  <>{nutMo}{nutBo}{nutAn}</>, undefined, (them) => chonIds(ids, them), ids.every((x) => chonLops.includes(x)))}
                {mo && con.map((tn) => <Fragment key={tn}>{track(`   ↳ ${tn.split(' · ').slice(1).join(' · ') || tn}`, `${tn} — kéo mép đổi giờ riêng lớp này, kéo thân dời cả nhóm`,
                  <>{tat.filter((x) => tenLop(x) === tn).map((l) => <KhoiLop key={l.id} l={l} pps={pps} chon={chonLops.includes(l.id)} cung={cungNhom(l)} onChon={(them) => bamLop(l.id, them)} onDoi={doiLop} />)}</>, 18, undefined, undefined, (them) => chonIds(tat.filter((x) => tenLop(x) === tn).map((x) => x.id), them), tat.filter((x) => tenLop(x) === tn).every((x) => chonLops.includes(x.id)))}</Fragment>)}
              </Fragment>;
            })
            : track('🧩 Lớp phủ', 'Chữ, ảnh, hình khối tự do đè lên video', <button type="button" className="xv-lienket xv-mono" style={{ lineHeight: '20px', paddingLeft: 6 }} onClick={() => themLop([lopMoi('chu', t)])}>chưa có lớp — bấm để thêm lớp chữ ở giây {t.toFixed(1)}</button>, 20)}
          {khung && <div style={{ position: 'fixed', left: Math.min(khung.x0, khung.x1), top: Math.min(khung.y0, khung.y1), width: Math.abs(khung.x1 - khung.x0), height: Math.abs(khung.y1 - khung.y0), border: '1px solid var(--cyan)', background: 'color-mix(in srgb, var(--cyan) 12%, transparent)', pointerEvents: 'none', zIndex: 50 }} />}
          </div>
          {/* Làn 🎬 Hình dính ngay dưới thước (#1418) — cuộn xuống các làn đối tượng vẫn thấy shot nào đang ở đâu. */}
          <div style={{ position: 'sticky', top: 24, zIndex: 8, background: 'var(--bg-1)', paddingBottom: 3, boxShadow: '0 1px 0 var(--line)' }}>
          {track('🎬 Hình', 'Mỗi cảnh một clip, dài đúng số giây', canh.map((cc, i) => {
            const x = batDau[i]! * pps; const w = dur(cc) * pps; const anh = anhNho(cc.keyframe_url, 160);
            const dangChon = chon === cc.id; const coVid = !!(cc.video_cuoi_url || cc.video_url);
            return (
              <div key={cc.id} draggable onDragStart={() => setKeo(cc.id)} onDragEnd={() => { setKeo(null); setTha(null); }}
                onDragOver={(e) => { e.preventDefault(); setTha(cc.id); }} onDrop={() => { thaVao(cc.id); setKeo(null); setTha(null); }}
                onClick={() => { bamShot(cc.id, i); }}
                data-goi-y={[`#${cc.thu_tu} ${cc.canh}`, `Phát: ${dur(cc)}s${dur(cc) !== (cc.thoi_luong_s || 4) ? ` (clip ${cc.thoi_luong_s || 4}s, cắt phần đầu)` : ''}`, `Hình: ${cc.video_cuoi_url ? 'bản cuối' : cc.video_url ? 'nháp' : cc.keyframe_url ? 'keyframe (chưa có clip)' : 'chưa có'}`, cc.hanh_dong && `Hành động: ${cc.hanh_dong}`, cc.chu_man && `Chữ màn: ${cc.chu_man}`, `Khán giả: ${tenCamXuc(cc.cam_xuc)}`, 'Kéo mép phải = cắt giây · kéo khối = đổi thứ tự'].filter(Boolean).join('\n')}
                style={{ position: 'absolute', left: x + 1, width: Math.max(6, w - 2), top: 0, bottom: 0, borderRadius: 5, overflow: 'hidden', cursor: 'grab',
                  border: `2px solid ${dangChon ? 'var(--cyan)' : tha === cc.id && keo !== cc.id ? 'var(--amber)' : coVid ? '#4ade8088' : 'var(--line)'}`,
                  background: anh ? `url(${anh}) left center / auto 100% repeat-x, #111` : 'var(--bg-2)', opacity: keo === cc.id ? 0.4 : 1 }}>
                {(cc.dang_sinh_anh || cc.trang_thai === 'dang_sinh') && <div className="xv-dang"><span>⏳ {cc.dang_sinh_anh ? 'ảnh' : 'video'}</span></div>}
                <span style={{ position: 'absolute', left: 3, top: 2, fontSize: 10, color: '#fff', textShadow: '0 1px 3px #000', whiteSpace: 'nowrap', zIndex: 2 }}>{coVid ? '▶ ' : ''}#{cc.thu_tu} · {dur(cc)}s</span>
                {/* Hai chip điểm chung MỘT hàng (viTri 'dong'): đặt tuyệt đối trái / phải thì clip hẹp chip P đè lên M, bấm M trúng P. */}
                <div style={{ position: 'absolute', left: 3, right: 10, bottom: 2, display: 'flex', gap: 3, overflow: 'hidden', zIndex: 2 }}>
                  <ChipMurch d={diemM[cc.id]} canh={tbM.canh[cc.phan_doan]} tap={tbM.tap} soShot={cc.thu_tu} viTri="dong" may={mayClip(cc)} />
                  <ChipPrompt d={cc.diem_prompt} soShot={cc.thu_tu} viTri="dong" />
                </div>
                <div onPointerDown={keoMep(cc)} title="Kéo để cắt / kéo dài giây phát" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7, cursor: 'ew-resize', background: 'rgba(255,255,255,.25)' }} />
              </div>
            );
          }).concat(canh.slice(0, -1).map((cc, i) => {
            // Điểm nối giữa hai clip: nút ⇄ chọn chuyển cảnh (ky_thuat.chuyen_canh của shot TRƯỚC) + dải d giây bản xuất hoà hình.
            const sau = canh[i + 1]!;
            return <NutChuyenCanh key={`cc${cc.id}`} trai={batDau[i + 1]! * pps} pps={pps} value={cc.ky_thuat?.chuyen_canh} giayTay={cc.ky_thuat?.giay_cc} phatTruoc={dur(cc)} phatSau={dur(sau)}
              anhTruoc={cc.keyframe_url} anhSau={sau.keyframe_url} tieuDe={`Chuyển #${cc.thu_tu} → #${sau.thu_tu}`} onChon={onDoiChuyenCanh && ((k, g) => onDoiChuyenCanh(cc.id, k, g))}
                onImpact={onDoiChuyenCanh && onDoiKyThuat && (() => { const tc = batDau[i + 1]!; datLop((ds) => [...ds, ...lopImpact(tc)]); onDoiChuyenCanh(cc.id, 'cat_soc'); onDoiKyThuat([{ id: sau.id, ky_thuat: themTieng(sau.ky_thuat, 'dap') }]); })} />;
          })), 48, nutNho(tat.clip === undefined ? '🔈' : tat.clip ? '🔇' : '🔊', `Tiếng có sẵn của clip: ${tat.clip === undefined ? 'tự (tắt khi shot có giọng/hiệu ứng sinh riêng)' : tat.clip ? 'tắt hết' : 'bật hết'} — bấm để đổi`, !!tat.clip, vongClip))}
          </div>

          {/* Phân cảnh (scene): shot liền nhau cùng phan_doan gộp một khối; rê thấy beat · mục tiêu · xung đột · ẩn ý · cảm xúc đầu→cuối. */}
          {canh.some((x) => x.phan_doan) && track('🎞 Phân cảnh', 'Shot cùng phân cảnh gộp một khối — mỗi phân cảnh có mục tiêu, xung đột, cảm xúc đổi từ đầu tới cuối', (() => {
            const khoi: { ten: string; tu: number; den: number }[] = [];
            canh.forEach((cc, i) => { const l = khoi[khoi.length - 1]; if (l && l.ten === cc.phan_doan) l.den = i; else khoi.push({ ten: cc.phan_doan, tu: i, den: i }); });
            const beatMau = (b: string) => MAU_NV[Math.max(0, tap.beats.findIndex((x) => x.ten === b)) % MAU_NV.length]!;
            return khoi.map((kh, j) => {
              const pc = tap.phan_canh.find((x) => x.ten === kh.ten);
              const x = batDau[kh.tu]! * pps; const w = (batDau[kh.den]! + dur(canh[kh.den]!)) * pps - x;
              const mau = pc ? beatMau(pc.beat) : '#64748b';
              const tt = pc ? `${tenPhanDoan(pc.ten)}\nBeat: ${pc.beat} · nhịp ${pc.nhip}\nMục tiêu: ${pc.muc_tieu}\nXung đột: ${pc.xung_dot}${pc.an_y ? `\nẨn ý: ${pc.an_y}` : ''}\nCảm xúc: ${pc.cam_xuc_dau} → ${pc.cam_xuc_cuoi}` : kh.ten || '(chưa đặt phân cảnh)';
              return (
                <div key={j} data-goi-y={`${tt}${onDoiKhuon && kh.ten ? '\n🧪 bấm = thử nhiều shot của cảnh này trong MỘT clip (ref2v, xem giá trước khi sinh)' : ''}`} onClick={() => onDoiKhuon && kh.ten && setThuRef(kh.ten)} style={{ cursor: onDoiKhuon && kh.ten ? 'pointer' : 'default', position: 'absolute', left: x + 1, width: Math.max(4, w - 2), top: 2, bottom: 2, borderRadius: 4, background: `${mau}26`, borderLeft: `3px solid ${mau}`, color: 'var(--fg-2)', fontSize: 10, lineHeight: '20px', padding: '0 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pc?.beat ? <b style={{ color: mau }}>{pc.beat} · </b> : null}{tenPhanDoan(kh.ten) || '—'}{pc ? ` (${pc.cam_xuc_dau > 0 ? '+' : ''}${pc.cam_xuc_dau}→${pc.cam_xuc_cuoi > 0 ? '+' : ''}${pc.cam_xuc_cuoi})` : ''}
                </div>
              );
            });
          })())}

          {/* 🧭 KHUÔN CHUỖI (khuon-chuoi.ts, xv_tap.khuon_chuoi): mỗi lần áp khuôn tô các shot của nó theo BƯỚC — xanh đúng vai, vàng thiếu luật /
              thiếu bước nên có, đỏ sai vai / lùi bước / thiếu bước bắt buộc. Khuôn trải rộng (gài ở cảnh 2, trả ở cảnh 5) tự sang hàng riêng. */}
          {(() => {
            const ket = (tap.khuon_chuoi ?? []).map((a) => kiemKhuon(a, canh, theLoai)).filter((k): k is KetAp => !!k);
            const nutSua = onDoiKhuon ? nutNho('✎', 'Sửa khuôn chuỗi của tập: thêm / bỏ khuôn, chọn shot cho từng bước', false, () => setSuaKhuon(true)) : undefined;
            const moLan0 = 'Khuôn chuỗi shot: mỗi đoạn shot làm một nhiệm vụ kể (làm nhục, vả mặt, kết treo…) — bấm ✎ để áp khuôn';
            if (!ket.length) return track('🧭 Khuôn', moLan0, <span className="xv-mono" style={{ fontSize: 10.5, lineHeight: '26px', paddingLeft: 6, color: 'var(--fg-3)' }}>chưa áp khuôn nào{onDoiKhuon ? ' — bấm ✎ ở tên làn' : ''}</span>, 26, nutSua);
            const viTriShot = new Map(canh.map((c, i) => [c.id, i] as const));
            const qc = theLoai ? QUY_CHUAN_DONG[theLoai] : undefined;
            const moLan = `Khuôn chuỗi shot đang áp: mỗi khối = một shot ở một BƯỚC của khuôn (rê xem mục đích, bước, lỗi, nguồn) · xanh đúng · vàng nên sửa · đỏ sai${qc ? `\nQuy chuẩn dòng phim: ${qc.luat.join(' · ')}\nKhuôn hay dùng: ${qc.khuon.map((k) => khuonTheoKey(k)?.ten ?? k).join(', ')}` : ''}`;
            const MAU = { tot: '#4ade80', vang: '#fbbf24', do: '#f87171' } as const;
            return xepHang(ket, viTriShot).map((hang, h) => (
              <Fragment key={`kh${h}`}>{track(h ? `🧭 Khuôn · ${h + 1}` : '🧭 Khuôn', moLan, hang.flatMap((k) => {
                const vt = k.shots.map((x) => viTriShot.get(x.id)).filter((i): i is number => i != null);
                const lien = vt.every((i, j) => !j || i === vt[j - 1]! + 1);
                const dau = vt.length ? batDau[vt[0]!]! * pps : 0; const cuoi = vt.length ? (batDau[vt[vt.length - 1]!]! + dur(canh[vt[vt.length - 1]!]!)) * pps : 0;
                return [
                  ...(lien && vt.length ? [<div key={`kb${k.ap.khuon}${vt[0]}`} style={{ position: 'absolute', left: dau + 1, width: Math.max(4, cuoi - dau - 2), bottom: 0, height: 2, background: MAU[k.muc], opacity: 0.7, pointerEvents: 'none' }} />] : []),
                  ...k.shots.flatMap((x, j) => {
                    const i = viTriShot.get(x.id); if (i == null) return [];
                    const cc = canh[i]!; const n = x.buocs.length; const x0 = batDau[i]! * pps; const w = (dur(cc) * pps) / n;
                    // Shot gánh nhiều bước → chia ô theo bước, đúng vị trí nhịp trong shot (gợi ý ✂ tách ở ngăn ✎).
                    return x.buocs.map((bi, q) => {
                      const b = k.kh.buoc[bi];
                      const tt = [`${k.kh.ten} · bước ${bi + 1}/${k.kh.buoc.length}: ${b?.ten ?? '?'}${n > 1 ? ` (nhịp ${q + 1}/${n} trong shot #${cc.thu_tu})` : ''}`, b?.ghi, `Mục đích: ${k.kh.muc_dich}`, k.ap.ghi && `Ở đây: ${k.ap.ghi}`,
                        ...x.loi.map((l) => `⚠ ${l}`), ...x.goiY.map((l) => `· ${l}`), ...(j === 0 && q === 0 ? k.loi.map((l) => `⚠ cả khuôn: ${l}`) : []), k.kh.ket && `Kết khuôn: ${k.kh.ket}`,
                        `Nguồn: ${k.kh.nguon.map((nn) => `${nn.phim} — ${nn.ghi}`).join(' · ')}`].filter(Boolean).join('\n');
                      const khoi = khoiAm(x0 + w * q, w, true, MAU[x.muc === 'tot' && j === 0 ? k.muc : x.muc], `${j === 0 && q === 0 ? `${k.kh.ten} › ` : ''}${n > 1 && q === 0 ? '✂ ' : ''}${b?.ten ?? '?'}`, tt, `kh${k.ap.khuon}${x.id}-${q}`, () => bamShot(cc.id, i), undefined, '');
                      // 📖 ở khối đầu mỗi lần áp: mở khuôn trong thư viện (bước · vai · luật · máy · nguồn) — nền khối vẫn mở chi tiết shot.
                      return j === 0 && q === 0 ? [khoi, <button key={`kb${k.ap.khuon}${x.id}`} type="button" title={`Mở khuôn “${k.kh.ten}” trong thư viện`} onClick={(e) => { e.stopPropagation(); moNgan({ loai: 'ky-thuat', ma: `khuon.${k.kh.key}` }); }}
                        style={{ position: 'absolute', left: x0 + Math.max(0, w - 20), top: 5, zIndex: 3, width: 16, height: 16, padding: 0, fontSize: 10, lineHeight: '16px', border: 0, borderRadius: 3, background: 'var(--bg-1)', cursor: 'pointer' }}>📖</button>] : [khoi];
                    }).flat();
                  }),
                  // Bước THIẾU: ô gạch đứt đúng chỗ khuôn chỉ (sau shot đứng trước nó) — bấm mở ngăn ✎ để chèn shot.
                  ...k.thieu.map((t) => {
                    const iSau = t.sau != null ? viTriShot.get(t.sau) : undefined; const iDau = viTriShot.get(k.shots[0]?.id ?? -1);
                    const x = iSau != null ? (batDau[iSau]! + dur(canh[iSau]!)) * pps : iDau != null ? batDau[iDau]! * pps : 0;
                    return <div key={`kt${k.ap.khuon}${t.buoc}${t.sau}`} data-goi-y={`${k.kh.ten} · THIẾU bước ${t.buoc + 1}: ${t.ten}\n${t.ghi}\nNên chèn một shot ở đây — bấm để mở ngăn khuôn (＋ chèn shot, 0đ)`}
                      onClick={() => onDoiKhuon && setSuaKhuon(true)}
                      style={{ position: 'absolute', left: x - 13, width: 26, top: 2, bottom: 2, borderRadius: 4, zIndex: 2, cursor: 'pointer', border: `1px dashed ${MAU[t.muc]}`, background: 'var(--bg-1)', color: MAU[t.muc], fontSize: 12, fontWeight: 700, lineHeight: '20px', textAlign: 'center' }}>＋</div>;
                  }),
                ];
              }), 26, h ? undefined : nutSua)}</Fragment>
            ));
          })()}

          {/* ↪ DẪN DẮT (dan-dat.ts): mỗi điểm cắt một dấu — xanh cắt có lý do, vàng / đỏ: nhảy hình, nhìn mà không cho thấy thứ được nhìn, vào cảnh
              không định vị, khép cảnh giữa chừng, nhảy thời gian không dấu. Điểm tập = 60% điểm cắt + 40% khuôn (khi đã áp khuôn). */}
          {canh.length > 1 && (() => {
            const k = chamDanDat(canh, (tap.phan_canh ?? []) as never, tap.khuon_chuoi ?? [], theLoai);
            const viTriShot = new Map(canh.map((c, i) => [c.id, i] as const));
            const mau = (d: number) => (d >= 90 ? '#4ade80' : d >= 70 ? '#fbbf24' : '#f87171');
            // Chú thích dựng TỪ bảng ký hiệu (dien-anh-nganh.ts) — thêm ký hiệu mới là chú thích tự có, không chép tay hai nơi.
            const chuKyHieuCat = Object.entries(KY_HIEU_CAT).map(([k, g]) => `${g} ${(kyThuat(k, 'chuyen_canh')?.ten ?? k).replace(/ \(.*$/, '')}`).join(' · ');
            const chuCuMayLien = Object.entries(CU_MAY_LIEN_BANG).map(([k, x]) => `${k === 'chuyen_chu_the' ? 'A ↝ B' : x.ky_hieu} ${(kyThuat(k, 'chuyen_dong')?.ten ?? k).replace(/ \(.*$/, '')}`).join(' · ');
            const mo = `Dẫn dắt: mỗi dấu là một điểm cắt giữa hai shot — cắt có lý do không, vào cảnh có biết đang ở đâu / lúc nào, cảnh khép có dứt\nKý hiệu cắt: ${chuKyHieuCat} · ✦ hiệu ứng; số = điểm cắt bị trừ\nDải xanh giữa shot = cú máy LIỀN, không cắt: ${chuCuMayLien}\nĐiểm tập ${k.diem}/100 = điểm cắt ${k.diemCat}${k.diemKhuon != null ? ` × 60% + khuôn ${k.diemKhuon} × 40%` : ''}\n${k.canh.map((c) => `${c.ten}: ${c.diem}${c.tru.length ? ` (${c.tru.map((t) => `−${t.tru} ${t.chu}`).join('; ')})` : ''}`).join('\n')}${k.ngoaiKhuon.length ? `\nShot chưa thuộc khuôn nào: ${k.ngoaiKhuon.map((id) => `#${canh[viTriShot.get(id)!]?.thu_tu}`).join(' ')}` : ''}`;
            // MẠCH DỰNG kiểu HBO đọc bằng mắt: dải giữa shot = cú máy LIỀN MẠCH (chuyển chủ thể A ↝ B, cung, vượt tiền cảnh, một cú máy) — nối mà không cắt;
            // dấu ở điểm cắt = KIỂU cắt (│ thẳng · ■ tắt đen · ◐ hoà tan · ⧉ khớp hình · J/L tiếng…), có trừ điểm thì thay bằng điểm. Ký hiệu: dien-anh-nganh.ts.
            const dai = canh.map((cc, i) => {
              const cd = cc.ky_thuat?.chuyen_dong; const kh = cd ? CU_MAY_LIEN_BANG[cd]?.ky_hieu : undefined; if (!kh) return null;
              const m = cc.may_3d; const a0 = m?.nham ?? m?.khung?.[0]; const b0 = m?.chuyen_toi ?? m?.khung?.find((t) => t !== a0);
              const ten = kyThuat(cd, 'chuyen_dong')?.ten ?? cd!;
              const chu = cd === 'chuyen_chu_the' && a0 && b0 ? `${a0} ${kh} ${b0}` : `${kh} ${ten.replace(/ \(.*$/, '')}`;
              const x0 = batDau[i]! * pps + 14, w = Math.max(16, dur(cc) * pps - 28);
              return <div key={`ml${cc.id}`} data-goi-y={`Shot #${cc.thu_tu} · ${ten} — một cú máy liền, KHÔNG cắt${cd === 'chuyen_chu_the' && a0 && b0 ? `: mở trên ${a0}, máy rời đi rồi dừng trên ${b0}` : ''}\nbấm = mở kỹ thuật trong thư viện`}
                onClick={() => moNgan({ loai: 'ky-thuat', ma: `chuyen_dong.${cd}` })}
                style={{ position: 'absolute', left: x0, width: w, top: 6, height: 14, borderRadius: 7, cursor: 'pointer', fontSize: 9.5, lineHeight: '13px', padding: '0 6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  color: '#22d3ee', border: '1px dashed #22d3ee88', background: '#22d3ee14' }}>{chu}</div>;
            });
            return track('↪ Dẫn dắt', mo, [...dai, ...k.cat.map((c) => {
              const j = viTriShot.get(c.sau); if (j == null || j < 1) return null;
              const x = batDau[j]! * pps; const a = canh[j - 1]!, b = canh[j]!;
              const kc = a.ky_thuat?.chuyen_canh || 'cat'; const kieu = kyThuat(kc, 'chuyen_canh')?.ten ?? kc; const kh = KY_HIEU_CAT[kc] ?? '✦';
              const tt = [`Cắt #${a.thu_tu} → #${b.thu_tu}${c.sangCanh ? ' · sang cảnh' : ''} · ${kh} ${kieu}: ${c.diem}/100`, ...(c.tru.length ? c.tru.map((t) => `−${t.tru} ${t.chu}`) : ['cắt có lý do — không trừ'])].join('\n');
              const w = c.sangCanh ? 30 : 22;
              const luat = c.tru.map((t) => luatCuaTru(t.ma)).find(Boolean);
              return <div key={`dd${c.sau}`} data-goi-y={`${tt}${luat ? '\nbấm = mở luật bị vi phạm trong thư viện' : ''}`} onClick={() => (luat ? moNgan({ loai: 'ky-thuat', ma: `luat.${luat}` }) : bamShot(b.id, j))}
                style={{ position: 'absolute', left: x - w / 2, width: w, top: 4, bottom: 4, borderRadius: 4, cursor: 'pointer', zIndex: 1, fontSize: 9.5, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
                  background: c.tru.length ? `${mau(c.diem)}33` : 'transparent', border: `1px ${c.tru.length ? 'solid' : 'dotted'} ${mau(c.diem)}${c.tru.length ? '' : '88'}`, color: mau(c.diem) }}>
                {c.tru.length ? c.diem : kh}
              </div>;
            })], 26, <span title={`Điểm dẫn dắt cả tập (rê tên làn xem cách tính)`} style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, padding: '0 5px', borderRadius: 3, color: mau(k.diem), border: '1px solid currentColor' }}>{k.diem}</span>);
          })()}

          {/* 🎭 Ý ĐỒ KHÁN GIẢ (khan-gia.ts, xv_tap.khan_gia): mỗi đoạn shot một hiệu ứng đạo diễn muốn khán giả cảm — tò mò, hồi hộp, bất ngờ, đánh lừa A → thật ra B
              (dấu ⟲ ở shot lật), gieo phân vân, sợ, ức chế → hả hê… Viền vàng ⚠ = máy soát theo ngành thấy thiếu (đánh lừa không lật, bất ngờ không gieo…).
              Đoạn chồng nhau tự sang hàng; bấm đoạn hoặc ✎ ở tên làn để sửa. */}
          {(() => {
            const ket = soatKhanGia(tap.khan_gia, canh);
            const nutSua = onDoiKhuon ? nutNho('✎', 'Sửa ý đồ khán giả: đoạn shot nào, khán giả cần cảm gì (đánh lừa ghi A / B + shot lật)', false, () => setSuaKG(true)) : undefined;
            const moLan = 'Ý đồ khán giả: đạo diễn muốn khán giả cảm gì ở từng đoạn — vui, buồn, tò mò, hồi hộp, bất ngờ, đánh lừa (A → thật ra B), gieo phân vân, sợ, ức chế, hả hê, nhẹ nhõm\nViền vàng ⚠ = máy soát theo ngành: đánh lừa phải có cú lật · bất ngờ phải gieo trước · hồi hộp cần khán giả biết trước · hả hê / nhẹ nhõm đến sau căng thẳng\nBấm đoạn hoặc ✎ để sửa; rê xem nguồn ngành của hiệu ứng trong thư viện (📖 trong ngăn sửa)';
            const loiMat = ket.filter((k) => k.tu < 0).length;
            if (!ket.length || loiMat === ket.length) return track('🎭 Ý đồ khán giả', moLan, <span className="xv-mono" style={{ fontSize: 10.5, lineHeight: '26px', paddingLeft: 6, color: 'var(--fg-3)' }}>{loiMat ? `⚠ ${loiMat} đoạn trỏ vào shot đã mất — bấm ✎ chọn lại` : 'chưa ghi ý đồ khán giả'}{onDoiKhuon && !loiMat ? ' — bấm ✎ ở tên làn' : ''}</span>, 26, nutSua);
            return xepHangYDo(ket).map((hang, h) => (
              <Fragment key={`kg${h}`}>{track(h ? `🎭 Ý đồ khán giả · ${h + 1}` : '🎭 Ý đồ khán giả', moLan, hang.flatMap((k) => {
                const hu = hieuUngKG(k.yd.y); const mau = hu?.mau ?? '#94a3b8';
                const x0 = batDau[k.tu]! * pps, x1 = (batDau[k.den]! + dur(canh[k.den]!)) * pps;
                const chu = k.yd.y === 'danh_lua' && (k.yd.a || k.yd.b) ? `${hu?.ic} ${k.yd.a || '?'} → thật ra ${k.yd.b || '?'}` : `${hu?.ic ?? ''} ${hu?.ten ?? k.yd.y}${k.yd.ghi ? ` · ${k.yd.ghi}` : ''}`;
                const tt = [`${hu?.ic ?? ''} ${hu?.ten ?? k.yd.y} · shot #${canh[k.tu]!.thu_tu} → #${canh[k.den]!.thu_tu}`, k.yd.ghi, k.yd.y === 'danh_lua' ? `A (khán giả tin): ${k.yd.a || '—'}\nB (sự thật): ${k.yd.b || '—'}` : '', hu?.mo_ta, ...k.loi.map((l) => `⚠ ${l}`), onDoiKhuon ? 'bấm = sửa ý đồ khán giả' : ''].filter(Boolean).join('\n');
                const lat = k.yd.lat != null ? canh.findIndex((c) => c.id === k.yd.lat) : -1;
                return [
                  <div key={`kg${k.i}`} data-goi-y={tt} onClick={() => onDoiKhuon && setSuaKG(true)}
                    style={{ position: 'absolute', left: x0 + 1, width: Math.max(6, x1 - x0 - 2), top: 3, bottom: 3, borderRadius: 4, cursor: onDoiKhuon ? 'pointer' : 'default', fontSize: 10, lineHeight: '18px', padding: '0 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      background: `${mau}26`, borderLeft: `3px solid ${mau}`, outline: k.loi.length ? '1px solid var(--amber)' : undefined, color: 'var(--fg-2)' }}>
                    {k.loi.length ? '⚠ ' : ''}{chu}
                  </div>,
                  ...(lat >= 0 ? [<div key={`kgl${k.i}`} data-goi-y={`⟲ Cú lật: shot #${canh[lat]!.thu_tu} lộ sự thật — ${k.yd.b || 'B'}`} onClick={() => bamShot(canh[lat]!.id, lat)}
                    style={{ position: 'absolute', left: batDau[lat]! * pps - 9, width: 18, top: 3, bottom: 3, borderRadius: 4, cursor: 'pointer', fontSize: 11, lineHeight: '18px', textAlign: 'center', background: `${mau}55`, color: '#fff', zIndex: 1 }}>⟲</div>] : []),
                ];
              }), 26, h ? undefined : nutSua)}</Fragment>
            ));
          })()}

          {/* Đường cong cảm xúc: điểm ở cuối mỗi shot, -5..+5, vạch giữa = 0. */}
          {/* Hiện cả khi mọi shot ghi 0: "trung tính hết" chính là thứ cần thấy, ẩn làn đi là giấu lỗi. Nét đứt xám = cảm xúc MỤC TIÊU theo loại beat. */}
          {canh.some((x) => x.cam_xuc || camXucMucTieu(x) != null) && track('❤ Khán giả', 'Khán giả cảm thấy gì ở cuối mỗi shot (cảm xúc ta MUỐN họ có): dưới vạch = khó chịu/đau (đúng nỗi đau của họ), trên vạch = tò mò → thích → muốn mua. QC tốt: chạm đáy ở nỗi đau rồi leo lên muốn mua.', (() => {
            const H = 40; const y = (v: number) => H / 2 - (v / 5) * (H / 2 - 4);
            const diem = canh.map((cc, i) => ({ x: (batDau[i]! + dur(cc)) * pps, y: y(cc.cam_xuc), v: cc.cam_xuc, cc }));
            const duong = [`0,${y(0)}`, ...diem.map((d) => `${d.x},${d.y}`)].join(' ');
            const mucTieu = canh.map((cc, i) => { const m = camXucMucTieu(cc); return m == null ? null : `${(batDau[i]! + dur(cc)) * pps},${y(m)}`; }).filter(Boolean).join(' ');
            return (
              <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
                <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeDasharray="3 3" />
                <polygon points={`0,${y(0)} ${duong.split(' ').slice(1).join(' ')} ${diem.length ? `${diem[diem.length - 1]!.x},${y(0)}` : ''}`} fill="rgba(244,114,182,.12)" />
                {mucTieu && <polyline points={mucTieu} fill="none" stroke="var(--fg-3)" strokeWidth={1.5} strokeDasharray="5 4"><title>Cảm xúc mục tiêu theo loại beat</title></polyline>}
                <polyline points={duong} fill="none" stroke="#f472b6" strokeWidth={2} />
                {diem.map((d) => { const lech = lechCamXuc(d.cc); const m = camXucMucTieu(d.cc); return <g key={d.cc.id} style={{ cursor: 'pointer' }} onClick={() => { bamShot(d.cc.id, canh.indexOf(d.cc)); }}>
                  {lech && <circle cx={d.x} cy={d.y} r={7} fill="none" stroke="var(--red)" strokeWidth={1.5} />}
                  <circle cx={d.x} cy={d.y} r={3.5} fill={d.v >= 0 ? '#4ade80' : '#f87171'} />
                  <title>{`#${d.cc.thu_tu} ${d.cc.canh}: ${tenCamXuc(d.v)} (${d.v > 0 ? '+' : ''}${d.v})${m != null ? `\nmục tiêu (${d.cc.phan_doan}): ${tenCamXuc(m)} (${m > 0 ? '+' : ''}${m})` : ''}${lech ? '\n⚠ lệch mục tiêu — sửa cảm xúc ở form shot' : ''}`}</title></g>; })}
                {diem.map((d, i) => (i === 0 || diem[i - 1]!.v !== d.v) && <text key={`t${d.cc.id}`} x={d.x - 4} y={d.v >= 0 ? d.y + 12 : d.y - 6} textAnchor="end" fontSize={9} fill="var(--fg-3)">{tenCamXuc(d.v)}</text>)}
              </svg>
            );
          })(), 40)}

          {/* Máy + ánh sáng của từng shot (từ thư viện điện ảnh). */}
          {canh.some((x) => Object.keys(x.ky_thuat ?? {}).length) && track('🎥 Máy · 💡', 'Cỡ cảnh · chuyển động máy · ánh sáng của từng shot', canh.map((cc, i) => {
            const kt = cc.ky_thuat ?? {};
            const chu = [kyThuat(kt.co_canh, 'co_canh')?.ten, kyThuat(kt.chuyen_dong, 'chuyen_dong')?.ten, kyThuat(kt.anh_sang, 'anh_sang')?.ten].filter(Boolean).join(' · ');
            if (!chu) return null;
            const day = ['co_canh', 'goc', 'chuyen_dong', 'ong_kinh', 'anh_sang', 'mau', 'chuyen_canh', 'nhac'].map((n) => kyThuat((kt as Record<string, string>)[n])?.ten).filter(Boolean).join('\n');
            // Tên kỹ thuật trong khối bấm được → mở đúng mục thư viện (anh 18/10/2026); bấm nền khối vẫn mở chi tiết shot.
            const ds = (['co_canh', 'chuyen_dong', 'anh_sang'] as const).map((n) => [n, kt[n]] as const).filter(([n, k]) => k && kyThuat(k, n));
            return (
              <div key={cc.id} data-goi-y={`${day}\nbấm tên kỹ thuật = mở trong thư viện · bấm nền = chi tiết shot`} onClick={() => bamShot(cc.id, i)}
                style={{ position: 'absolute', left: batDau[i]! * pps + 1, width: Math.max(4, dur(cc) * pps - 2), top: 2, bottom: 2, borderRadius: 4, overflow: 'hidden', cursor: 'pointer', background: '#38d9f533', border: '1px solid #38d9f5', color: '#38d9f5', fontSize: 'var(--khoi-co, 10px)', lineHeight: 'var(--khoi-lh, 20px)', padding: '0 5px', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {ds.map(([n, k], j) => <span key={n}>{j ? ' · ' : ''}<span onClick={(e) => { e.stopPropagation(); moNgan({ loai: 'ky-thuat', ma: `${n}.${k}` }); }} style={{ textDecoration: 'underline dotted', cursor: 'help' }}>{kyThuat(k, n)!.ten.replace(/\s*\(.*\)$/, '')}</span></span>)}
              </div>
            );
          }))}

          {/* MỖI nhân vật một NHÓM làn (#1237, #1244), viền màu nhân vật: 🎭 cảm xúc/diễn xuất theo shot (có mặt mà không nói cũng hiện) · 🗣 thoại. */}
          {nguoiNoiTap.map((ten) => {
            const v = timNv(nhanVat, ten) ?? null;
            const coThoai = canh.some((cc) => dongThoai(cc, nhanVat).some((d) => cungTen(tenNoi(d), ten)));
            const camXuc = canh.map((cc, i) => {
              const cua = dongThoai(cc, nhanVat).filter((d) => cungTen(tenNoi(d), ten));
              const coMat = !!v && cc.nhan_vat.includes(v.id);
              if (!cua.length && !coMat) return null;
              const dx = [...new Set(cua.map((d) => d.dien_xuat.trim()).filter(Boolean))].join(' → ');
              const chu = dx || (cua.length ? 'nói, chưa ghi diễn xuất' : 'có mặt, không nói');
              return khoiAm(batDau[i]! * pps, dur(cc) * pps, !!dx, mauNv(v), chu, `${ten} · shot #${cc.thu_tu}\nCảm xúc: ${chu}${cc.hanh_dong ? `\nHành động: ${cc.hanh_dong}` : ''}`, `cx${cc.id}`, () => { bamShot(cc.id, i); });
            });
            return (
              <div key={ten} className="xv-tl-nhom" style={{ '--mau-nhom': mauNv(v), marginTop: 4 } as React.CSSProperties}>
                {track(`🎭 ${ten}`, `Cảm xúc / diễn xuất của ${ten} theo từng shot (lấy từ diễn xuất của dòng thoại; nét đứt = có mặt nhưng chưa ghi cảm xúc) — sửa ở form shot`, camXuc)}
                {coThoai && track(`🗣 ${ten} · thoại`, `Thoại của ${ten} theo từng shot — bấm khối để sinh giọng cả shot`, canh.map((cc, i) => {
              const dsT = dongThoai(cc, nhanVat);
              const cua = dsT.filter((d) => cungTen(tenNoi(d), ten));
              if (!cua.length) return null;
              const co = cua.filter((d) => d.url).length;
              const tt = cua.map((d, j) => `Câu ${j + 1}: ${d.dien_xuat ? `(${d.dien_xuat}) ` : ''}${d.loi}${d.url ? ' ✓' : ''}`).join('\n');
              return khoiAm(batDau[i]! * pps, dur(cc) * pps, co === cua.length, mauNv(v), `${cc.dang_sinh_giong ? '⏳ ' : ''}${cua.map((d) => d.loi).join(' · ')}${co && co < cua.length ? ` (${co}/${cua.length})` : ''}`, `${ten} · shot #${cc.thu_tu}\n${tt}\nGiọng: ${co}/${cua.length} câu đã sinh`, cc.id, () => { bamShot(cc.id, i); },
                sinh && { loai: 'giong', cc, giay: dur(cc), dang: cc.dang_sinh_giong || sinh.ban(`g${cc.id}`), nghe: cua.map((d) => d.url).filter((u): u is string => !!u), title: `Bấm để chọn model, giọng từng người nói, cảm xúc, phạm vi rồi sinh giọng cả shot` });
            }), 26, ten === nguoiNoiDau ? <>{nutNho('🤖', docThu ? 'Đang đọc thử thoại chưa có giọng bằng giọng máy — bấm để tắt' : 'Bấm để đọc thử thoại chưa có giọng bằng giọng máy', !docThu, () => setDocThu((x) => !x))}{nutNho(tat.thoai ? '🔇' : '🔊', tat.thoai ? 'Thoại đang tắt — bấm để bật' : 'Tắt tiếng thoại', !!tat.thoai, () => batTat('thoai'))}</> : undefined)}
              </div>
            );
          })}

          {track('🔊 Âm thanh', 'Hiệu ứng / âm nền từng cảnh · vạch cam đậm = tiếng hiệu ứng thật của kỹ thuật âm thanh (đập, vút, dâng…) — bản xuất trộn đúng giờ này', [...lichHu.map((m, j) => (
            <div key={`hu${j}`} data-goi-y={`${kyThuat(m.key, 'am_thanh')?.ten ?? m.key} · ${m.tu.toFixed(2)}s → ${(m.tu + m.dai).toFixed(2)}s${m.lap ? ' · lặp' : ''}`}
              style={{ position: 'absolute', left: m.tu * pps, width: Math.max(3, m.dai * pps), bottom: 1, height: 7, borderRadius: 2, background: '#ea580c', opacity: 0.9, zIndex: 2, pointerEvents: 'auto' }} />
          )), ...canh.map((cc, i) => {
            if (!cc.am_thanh.trim()) return null;
            return khoiAm(batDau[i]! * pps, dur(cc) * pps, !!cc.am_thanh_url, '#fb923c', cc.am_thanh, `${cc.am_thanh}\n${cc.am_thanh_url ? 'đã có file' : 'chưa sinh'}`, cc.id, () => { bamShot(cc.id, i); },
              sinh && { loai: 'sfx', cc, giay: dur(cc), dang: cc.dang_sinh_sfx || sinh.ban(`s${cc.id}`), nghe: cc.am_thanh_url ? [cc.am_thanh_url] : [], title: `Bấm để chọn nguồn (clip / mô tả), model, mô tả, số giây rồi sinh` });
          })], 26, nutNho(tat.sfx ? '🔇' : '🔊', tat.sfx ? 'Hiệu ứng đang tắt — bấm để bật' : 'Tắt tiếng hiệu ứng', !!tat.sfx, () => batTat('sfx')))}

          {/* Cùng luật bản xuất (urlCanXuat): có nhạc phân cảnh nào thì vẽ theo phân cảnh; không thì một khối nhạc cả tập — trước đây cứ có tên phân cảnh
              là vẽ "chưa có nhạc" từng khối dù tập đã có bài cả tập (phim #5, 10/10/2026). */}
          {track('🎵 Nhạc', 'Nhạc nền: theo từng phân cảnh (ưu tiên) hoặc một bài cả tập', khoiPc.some((kh) => kh.ten && tap.nhac_phan_canh?.[kh.ten]) || (!tap.nhac_url && khoiPc.some((kh) => kh.ten))
            ? khoiPc.map((kh, j) => {
                const x = batDau[kh.tu]! * pps; const w = (batDau[kh.den]! + dur(canh[kh.den]!)) * pps - x;
                const url = tap.nhac_phan_canh?.[kh.ten];
                const giay = canh.slice(kh.tu, kh.den + 1).reduce((a, x) => a + dur(x), 0);
                return khoiAm(x, w, !!url, '#a78bfa', url ? `${kh.ten}` : `${kh.ten}: chưa có nhạc`, url ? `Nhạc phân cảnh “${kh.ten}”` : `Phân cảnh “${kh.ten}” chưa có nhạc`, `n${j}`, undefined,
                  sinh && kh.ten ? { loai: 'nhac', phanDoan: kh.ten, giay, dang: sinh.ban('nhac') || sinh.dangPhanDoan.includes(kh.ten), nghe: url ? [url] : [], title: `Bấm để chọn model nhạc, mô tả rồi sinh nhạc cho phân cảnh này` } : undefined);
              })
            : khoiAm(0, W, !!tap.nhac_url, '#a78bfa', tap.nhac_mo_ta || 'Nhạc nền cả tập: chưa có', tap.nhac_mo_ta || 'chưa có nhạc nền', 'nhac', undefined,
                sinh && { loai: 'nhac', giay: tong, dang: sinh.ban('nhac1') || sinh.dangCaTap, nghe: tap.nhac_url ? [tap.nhac_url] : [], title: `Bấm để chọn model nhạc, mô tả rồi sinh một bài cả tập` }), 26, <>{onKhopNhip && nutNho(dangKhop ? '⏳' : '🎯', 'Khớp nhịp: dò phách của nhạc nền rồi dời mỗi điểm cắt tới phách gần nhất (về sau ≤0,35s, lùi ≤0,1s — không cụt giọng); lớp phủ dời theo shot. 0đ, ↶ Hoàn tác được.', false, () => { if (dangKhop) return; setDangKhop(true); void onKhopNhip().then((m) => setBaoNhip(m)).finally(() => setDangKhop(false)); })}{nutNho(tat.nhac ? '🔇' : '🔊', tat.nhac ? 'Nhạc đang tắt — bấm để bật' : 'Tắt tiếng nhạc', !!tat.nhac, () => batTat('nhac'))}</>)}

          {/* ĐỐI TƯỢNG (trang-thai-doi-tuong.ts): mỗi người / đạo cụ / sản phẩm / bối cảnh một làn — từng shot: trạng thái (dáng · trạng thái · đồ cầm, hoặc biến thể),
              màu theo điểm 0–10 (mẫu chưa đủ · nhắc tên chưa gắn · khác biến thể · đứt liền mạch · kiểm khung · soi clip); điểm cả tập ở đầu làn. Nét đứt = nhắc tên mà chưa gắn. */}
          {doiTuong.map((r) => (
            <Fragment key={`dt${r.nv.id}`}>
              {track(r.nv.ten, `Trạng thái ${r.nv.ten} theo từng shot · điểm 0–10, trừ khi mẫu chưa đủ / nhắc tên chưa gắn / khác biến thể / đứt liền mạch / kiểm khung / soi clip`, r.o.map((o, i) => {
                if (o.diem == null) return null;
                const cc = canh[i]!;
                return khoiAm(batDau[i]! * pps, dur(cc) * pps, o.co, MAU_DOI_TUONG[o.muc], `${o.loi.length ? '⚠ ' : ''}${o.chu}`,
                  `${r.nv.ten} · shot #${cc.thu_tu} · ${o.diem}/10${o.chu ? `\n${o.chu}` : ''}${o.loi.length ? `\n${o.loi.map((x) => `− ${x}`).join('\n')}` : ''}`, `dt${r.nv.id}-${cc.id}`, () => { bamShot(cc.id, i); }, undefined, '');
              }), 26, r.diem != null ? <span title={`Điểm cả tập: trung bình các shot có ${r.nv.ten}${r.soLoi ? ` · ${r.soLoi} lỗi` : ''}`} style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, padding: '0 5px', borderRadius: 3, color: MAU_DOI_TUONG[r.diem >= 9 ? 'tot' : r.diem >= 5 ? 'vang' : 'do'], border: '1px solid currentColor' }}>{r.diem}</span> : undefined, undefined, undefined, undefined, <>
                <button type="button" title={moCay.includes(r.nv.id) ? 'Thu cây' : 'Mở cây: từng mục đang tính điểm (mẫu, trang phục, vị trí, dáng, kiểm khung…)'} onClick={() => doiMoCay(r.nv.id)}
                  style={{ flexShrink: 0, width: 14, padding: 0, border: 'none', background: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 10 }}>{moCay.includes(r.nv.id) ? '▾' : '▸'}</button>
                <span title={LOAI_NHAN_VAT.find((l) => l.key === r.nv.loai)?.label} style={{ flexShrink: 0, borderRadius: 3, overflow: 'hidden' }}><AnhDaiDien v={r.nv} co={18} /></span></>, r.nv.anh_ref[0] ? anhNho(r.nv.anh_ref[0], 320) : undefined)}
              {moCay.includes(r.nv.id) && !anLan.includes(r.nv.ten) && r.nhanh.map((ma) => (
                <Fragment key={`dt${r.nv.id}-${ma}`}>
                  {lanCon(TEN_NHANH[ma], `${r.nv.ten} › ${TEN_NHANH[ma]}: đúng phần đang tính vào điểm làn — ô vàng / đỏ = nhánh này bị trừ, rê vào xem trừ vì sao`, r.o.map((o, i) => {
                    const n = o.nhanh.find((x) => x.ma === ma); if (!n) return null;
                    const cc = canh[i]!; const tru = n.tru.reduce((a, t) => a + t.diem, 0);
                    return khoiAm(batDau[i]! * pps, dur(cc) * pps, true, MAU_DOI_TUONG[tru ? mucDiem(10 - tru) : 'tot'], `${tru ? `−${tru} ` : ''}${n.chu || '—'}`,
                      `${r.nv.ten} › ${TEN_NHANH[ma]} · shot #${cc.thu_tu}\n${n.chu || '—'}${n.tru.length ? `\n${n.tru.map((t) => `−${t.diem} ${t.chu}`).join('\n')}` : '\nkhông bị trừ'}`, `dt${r.nv.id}-${ma}-${cc.id}`, () => { bamShot(cc.id, i); }, undefined, '');
                  }))}
                </Fragment>
              ))}
            </Fragment>
          ))}

          {thuRef && onDoiKhuon && <NganRef2v tapId={tap.id} phanDoan={thuRef} onClose={() => setThuRef(null)} />}
          {suaKG && onDoiKhuon && <NganKhanGia tapId={tap.id} ds={tap.khan_gia ?? []} canh={canh} onClose={() => setSuaKG(false)} onLuu={onDoiKhuon} />}
          {suaKhuon && onDoiKhuon && <NganKhuon tapId={tap.id} khuon={tap.khuon_chuoi ?? []} canh={canh} theLoai={theLoai} onClose={() => setSuaKhuon(false)} onLuu={onDoiKhuon} />}
          {yc && sinh && <BangSinh yc={yc} nhanVat={nhanVat} tap={tap} mhNhac={sinh.mhNhac} onClose={() => setYc(null)} onGiong={sinh.giong} onSfx={sinh.sfx} onNhac={sinh.nhac} />}
          {/* Đầu phát */}
          <div style={{ position: 'absolute', left: nhanW + t * pps - 1, top: 0, bottom: 0, width: 2, background: '#ef4444', pointerEvents: 'none', zIndex: 10 }}>   {/* trên thước + làn Hình đang dính (z 9/8); nhãn dính của làn = 5, trên mọi thứ trong làn (nút ⇄ = 4) */}
            <div title="Kéo để tua" onPointerDown={(e) => keoDauPhat(e, (vungRef.current?.getBoundingClientRect().left ?? 0) + nhanW - (vungRef.current?.scrollLeft ?? 0))}
              style={{ position: 'absolute', top: 0, left: -7, width: 16, height: 16, background: '#ef4444', borderRadius: '3px 3px 8px 8px', cursor: 'ew-resize', pointerEvents: 'auto', boxShadow: '0 1px 4px #0008' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Menu ẩn / hiện làn (#1296): tick = hiện. 🎬 Hình luôn hiện (là trục của timeline). Lớp phủ ẩn bằng 👁 ở nhãn làn của nó. */
function DsLanAn({ lay, an, onDoi }: { lay: () => string[]; an: string[]; onDoi: (n: string) => void }) {
  const ds = lay().filter((n) => n !== '🎬 Hình');
  return (<>
    <div style={{ ...mono, padding: '2px 4px' }}>Hiện làn nào trên timeline (nhớ theo trình duyệt)</div>
    {ds.map((n) => (
      <label key={n} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, padding: '2px 4px', cursor: 'pointer' }}>
        <input type="checkbox" checked={!an.includes(n)} onChange={() => onDoi(n)} /> {n}
      </label>
    ))}
    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, padding: '2px 4px', cursor: 'pointer', borderTop: '1px solid var(--line)', marginTop: 2 }}>
      <input type="checkbox" checked={!an.includes('xem:chu_man')} onChange={() => onDoi('xem:chu_man')} /> Chữ màn trên khung xem (bản xuất vẫn có)
    </label>
  </>);
}
