// ĐƯỜNG MÁY của một shot (anh 16/10/2026: làm phim hoàn toàn bằng Blender — bước 1 "chuyển động máy"). Máy lúc MỞ = may_3d (dat / nhin / ống kính);
// máy lúc KẾT tính từ mã chuyển động của shot (ky_thuat.chuyen_dong) theo SỐ NGHỀ đã có ở dien-anh-nganh.ts › may_di (đẩy vào: chủ thể ×1,6 ·
// lùi ra ×0,5 · lia 30° · quay vòng 60° · zoom gắt ×2,5…) — một nguồn số cho cả thư viện kỹ thuật lẫn bản diễn Blender. Toạ độ dữ liệu: cm,
// x phải, y sâu vào bàn, z lên. Blender (dung-set.py › dien_shot) nội suy mở → kết theo `toc`, cộng rung tay khi `rung`.
import { NGANH, CU_MAY_KHUNG_KET, type MayDi } from './dien-anh-nganh';
import type { May3d, VatSet } from './kieu';

export type DuongMay = { kieu: MayDi['kieu']; dat: number[]; nhin: number[]; ong_kinh: number; toc: MayDi['toc']; rung?: boolean; /** cú máy liền mạch cần khung màu chỗ kết (CU_MAY_KHUNG_KET) — dung-set.py dựng thêm khung kết */ ket?: boolean; /** vật che chủ thể lúc kết dù đã cẩu máy — phải đặt lại máy shot */ che?: string };

type V3 = [number, number, number];
const v = (p: number[]): V3 => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
const cong = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const tru = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nhan = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dai = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const tron = (a: V3): number[] => a.map((x) => Math.round(x * 100) / 100);
/** Xoay quanh trục đứng z (độ, dương = ngược chiều kim đồng hồ nhìn từ trên). */
const xoayZ = (a: V3, g: number): V3 => { const r = (g * Math.PI) / 180; return [a[0] * Math.cos(r) - a[1] * Math.sin(r), a[0] * Math.sin(r) + a[1] * Math.cos(r), a[2]]; };

/** Hộp bao (cm) của đồ vật trên set — cùng công thức khối dung-set.py › khoi (tâm ĐÁY, cỡ rộng × sâu × cao, phần xoay quanh gốc theo `xoay`).
 *  Bỏ mặt nền (bàn / tường / sàn: `nen`), dây (đi sát mặt bàn), đồ tuỳ chọn không bật trong shot. Dùng để đường máy không xuyên đồ vật. */
export type Hop = { ten: string; min: V3; max: V3 };
export function hopVat(vat: VatSet[], them: string[] = []): Hop[] {
  const out: Hop[] = [];
  const mot = (ten: string, p: { hinh: string; tam?: number[]; co?: number[] }, goc = [0, 0], xoay = 0) => {
    if (p.hinh === 'day' || !p.tam || !p.co) return;
    const a = (xoay * Math.PI) / 180; const [x, y, z] = v(p.tam); const [w, d, h] = v(p.co);
    const gx = goc[0]! + x * Math.cos(a) - y * Math.sin(a), gy = goc[1]! + x * Math.sin(a) + y * Math.cos(a);
    const rx = (Math.abs(w * Math.cos(a)) + Math.abs(d * Math.sin(a))) / 2, ry = (Math.abs(w * Math.sin(a)) + Math.abs(d * Math.cos(a))) / 2;
    out.push({ ten, min: [gx - rx, gy - ry, z], max: [gx + rx, gy + ry, z + h] });
  };
  for (const vt of vat) {
    if (vt.nen || (vt.tuy_chon && !them.includes(vt.ten))) continue;
    if ('phan' in vt) for (const p of vt.phan) mot(vt.ten, p, vt.goc, vt.xoay ?? 0); else mot(vt.ten, vt);
  }
  return out;
}
const trong = (p: V3, hs: Hop[], le = 0.3) => hs.find((b) => [0, 1, 2].every((i) => p[i]! > b.min[i]! - le && p[i]! < b.max[i]! + le));

/** Máy lúc kết của shot; null = máy đứng yên (không có mã, mã tĩnh, hoặc kiểu bay tự do chưa dựng được — FPV / hyperlapse). */
export function duongMay(m: Pick<May3d, 'dat' | 'nhin' | 'ong_kinh' | 'vi_tri' | 'khung' | 'nham' | 'chuyen_toi'>, chuyenDong: string | undefined | null, can: Hop[] = [], cao: (ten: string) => number = () => 2): DuongMay | null {
  const md = chuyenDong ? NGANH[`chuyen_dong.${chuyenDong}`]?.may_di : undefined;
  if (!md) return null;
  const rung = chuyenDong === 'cam_tay';
  if (md.kieu === 'dung' || md.kieu === 'tu_do') return rung ? { kieu: md.kieu, dat: m.dat, nhin: m.nhin, ong_kinh: m.ong_kinh, toc: md.toc, rung } : null;
  const dat = v(m.dat), nhin = v(m.nhin); const D = tru(dat, nhin); const kc = dai(D) || 1;
  // Chủ thể đầu tiên (khung / hai vị trí đầu không ẩn) và quãng nó đi trong shot — máy theo / trượt / lia bám theo nó.
  const ten = m.nham ?? m.khung?.[0] ?? m.vi_tri.find((x) => !x.an)?.ten;
  const ct = m.vi_tri.find((x) => x.ten === ten);
  const di: V3 = ct?.den ? tru(v(ct.den), v(ct.tam)) : [0, 0, 0];
  // Trục ngang của khung (phải màn hình) = hướng nhìn × trục đứng.
  const huong = nhan(tru(nhin, dat), 1 / kc); const phai = ((): V3 => { const p: V3 = [huong[1], -huong[0], 0]; const l = Math.hypot(p[0], p[1]) || 1; return [p[0] / l, p[1] / l, 0]; })();
  const ngangDi = di[0] * phai[0] + di[1] * phai[1];
  const chieu = ngangDi < 0 ? -1 : 1;   // lia / trượt / vòng về phía chủ thể đi; đứng yên thì sang phải
  let datK = dat, nhinK = nhin, ok = m.ong_kinh; let cheBoi = '';
  // Chủ thể KẾT của cú chuyển chủ thể: khai `chuyen_toi`, không thì người / vật thứ hai của khung (không ẩn, khác chủ thể mở).
  const ctKet = md.kieu === 'chuyen' ? m.vi_tri.find((x) => x.ten === m.chuyen_toi) ?? m.vi_tri.find((x) => !x.an && x.ten !== ten && (!m.khung || m.khung.includes(x.ten))) : undefined;
  const dichCt = ctKet ?? ct;
  switch (md.kieu) {
    case 'tien': case 'lui': datK = cong(nhin, nhan(D, 1 / (md.ti_le ?? (md.kieu === 'tien' ? 1.6 : 0.5)))); break;   // chủ thể ×ti_le ⇔ khoảng cách ÷ti_le
    case 'len': case 'xuong': { const k = 1 / (md.ti_le ?? 1); datK = cong(dat, [0, 0, kc * (k - 1)]); break; }   // cẩu: nâng (ti_le < 1) / hạ (> 1) máy, giữ điểm nhìn
    case 'zoom': {   // zoom VÀO chủ thể: ống kính dài ra + đầu máy quay về chỗ chủ thể (lúc kết), không zoom vào điểm nhìn giữa khung
      ok = m.ong_kinh * (md.ti_le ?? 1.4);
      if (ct) {
        // Thân lúc kết = cao khối × hệ số phồng khai trong dien ('phong3' = ×3, #14 Lint phồng gấp ba): nhắm GIỮA thân đó, zoom tối đa tới khi thân
        // cao ~70 % khung (khung dọc: cảm biến 36 mm theo chiều cao → khung cao = khoảng cách × 36 / ống kính).
        const ph = (ct.dien ?? []).map((x) => /^phong(\d+(?:\.\d+)?)?/.exec(x)).filter(Boolean).reduce((a, x) => a * Number(x![1] ?? 3), 1);
        const hs = cao(ct.ten) * ph; const p = v(ct.den ?? ct.tam);
        nhinK = [p[0], p[1], Math.max(nhin[2], p[2] + hs / 2)];
        ok = Math.min(ok, Math.max(m.ong_kinh, (0.55 * dai(tru(dat, nhinK)) * 36) / hs));   // 55 %: chừa lông / tóc ngoài khối khai
      }
      break;
    }
    case 'lia': nhinK = cong(dat, xoayZ(tru(nhin, dat), -chieu * (md.goc ?? 30))); break;   // lia: máy đứng, đầu máy xoay
    case 'nghieng': nhinK = cong(nhin, [0, 0, Math.tan(((md.goc ?? 25) * Math.PI) / 180) * kc]); break;   // nghiêng lên
    case 'vong': datK = cong(nhin, xoayZ(D, chieu * (md.goc ?? 60))); break;   // quay vòng quanh điểm nhìn
    case 'ngang': {   // tracking: máy chạy SONG SONG cả quãng chủ thể đi (giữ khoảng cách + chỗ trong khung — #28 chỉ trượt phần ngang thì chủ thể
      // đi chéo ra khỏi khung); chủ thể đứng yên thì trượt ngang 20 % khoảng cách máy
      // Chủ thể đi XA (quá 1,5 lần khoảng cách máy — #28 trượt 48 cm dọc cáp, máy cách 15 cm): dolly chỉ dời 35 % quãng, đầu máy lia bám đủ quãng
      // (người quay không đẩy dolly xuyên đồ vật trên set — dời nguyên quãng thì máy chui qua chân đèn bàn).
      if (dai(di) > 1.5 * kc && ct?.den) { const d = v(ct.den); datK = cong(dat, nhan(di, 0.35)); nhinK = [d[0], d[1], d[2] + 1]; break; }   // đầu máy lia tới ĐÚNG chỗ kết (giữa thân ~1 cm)
      const dv = dai(di) > 0.3 ? di : nhan(phai, 0.2 * kc); datK = cong(dat, dv); nhinK = cong(nhin, dv); break;
    }
    case 'theo': datK = cong(dat, di); nhinK = cong(nhin, di); break;   // bám theo: máy dời đúng quãng chủ thể đi
    case 'chuyen': {   // CHUYỂN CHỦ THỂ (relay shot, kiểu HBO): máy đứng, đầu máy rời A rồi DỪNG trên B — nhắm 85 % chiều cao B (mặt người / thân vật) ở chỗ B đứng lúc kết
      if (!ctKet) { nhinK = cong(dat, xoayZ(tru(nhin, dat), -chieu * 70)); break; }   // không có B → lia 70° như cũ
      const p = v(ctKet.den ?? ctKet.tam); nhinK = [p[0], p[1], p[2] + cao(ctKet.ten) * 0.85];
      break;
    }
  }
  nhinK = [nhinK[0], nhinK[1], Math.max(nhinK[2], 0)];   // điểm nhìn không dưới mặt bàn
  // Máy không chui xuống dưới mặt bàn (z = 0): chủ thể trượt dốc xuống thì máy bám theo dừng ở 0,3 cm (hoặc chỗ thấp ban đầu nếu đã thấp hơn) — #28.
  datK = [datK[0], datK[1], Math.max(datK[2], Math.min(dat[2], 0.3))];
  // KHÔNG XUYÊN ĐỒ VẬT (#28: dolly chui vào chân Yellow iMac → nửa clip đen): dò 12 điểm trên đường máy (cùng nhịp nhanh dần – chậm dần như Blender);
  // chạm vật thì thu ngắn quãng dời máy (60 % → 35 % → 15 % → đứng yên), điểm nhìn / ống kính giữ nguyên — máy đứng lại, đầu máy vẫn bám chủ thể.
  if (can.length && !trong(dat, can)) {
    const goc = datK; const thong = (d: V3) => Array.from({ length: 13 }, (_, i) => i / 12).every((t) => !trong(cong(dat, nhan(tru(d, dat), t * t * (3 - 2 * t))), can));
    for (const k of [1, 0.6, 0.35, 0.15, 0]) { const d = cong(dat, nhan(tru(goc, dat), k)); if (thong(d)) { datK = d; break; } }
  }
  // ĐƯỜNG NHÌN bị che lúc kết (#28: máy đứng lại sau chân iMac → nửa sau clip chỉ thấy chân máy vàng): cẩu máy lên từng nấc tới khi nhìn thấy chủ thể
  // (người quay boom lên vượt vật chắn), đường máy vẫn phải thông.
  if (can.length && dichCt) {
    const dich = v(dichCt.den ?? dichCt.tam); const thay = (d: V3) => Array.from({ length: 21 }, (_, i) => (i + 1) / 22).every((t) => !trong(cong(d, nhan(tru(dich, d), t)), can, 0.1));
    if (!thay(datK)) {
      let ok = false;
      for (const len of [1, 2, 4, 6, 9, 13, 18, 25]) { const d: V3 = [datK[0], datK[1], datK[2] + len]; if (thay(d) && !trong(d, can)) { datK = d; ok = true; break; } }
      if (!ok) cheBoi = Array.from({ length: 21 }, (_, i) => (i + 1) / 22).map((t) => trong(cong(datK, nhan(tru(dich, datK), t)), can, 0.1)?.ten).find(Boolean) ?? '?';
    }
  }
  return { kieu: md.kieu, dat: tron(datK), nhin: tron(nhinK), ong_kinh: Math.round(ok * 10) / 10, toc: md.toc, ...(rung ? { rung } : {}), ...(CU_MAY_KHUNG_KET.includes(chuyenDong!) ? { ket: true } : {}), ...(cheBoi ? { che: cheBoi } : {}) };
}
