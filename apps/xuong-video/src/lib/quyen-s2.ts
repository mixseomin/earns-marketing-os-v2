// QUYỀN STUDIO 2 CHO NGƯỜI KHÔNG PHẢI QUẢN TRỊ (anh 20/11/2026: "đội muốn dùng s2 để làm video mới" → "làm đến nhịp 6"). Mọi server action của studio
// tự hỏi admin() — giữ nguyên cho studio.on.tc. Hai route của Studio 2 (/api/xv/doc, /api/xv/ghi) đi qua chayS2 ở đây: người dùng thường CHỈ chạy được
// hàm có trong LUAT, trên phim CỦA MÌNH (xv_phim.owner_user_id), khi quản trị đã cấp quyền ở bảng xv_s2_quyen (dung = được dùng, sinh = được bấm bước
// tốn tiền). Qua cửa thì hàm chạy trong ngữ cảnh AsyncLocalStorage; admin() của actions.ts hỏi duocS2() để nhận người đó cho đúng lượt này.
// Chưa cấp quyền = không vào được gì (mặc định đóng). Mỗi lượt GHI ghi một dòng vào sổ xv_s2_luot: ai bấm, bước nào, phim nào, được hay bị từ chối.
import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from './auth';

const ALS = new AsyncLocalStorage<{ userId: number }>();
/** đang ở trong một lượt Studio 2 đã qua kiểm quyền của đúng người này */
export const duocS2 = (userId: number): boolean => ALS.getStore()?.userId === userId;

type Doi = 'phim' | 'tap' | 'canh' | 'job' | 'viec' | 'khong';
/** hàm người dùng thường được gọi qua Studio 2: đối số đầu trỏ vào thứ gì (để dò ra phim) · tien = bước tốn tiền (cần quyền `sinh`) */
const LUAT: Record<string, { doi: Doi; tien?: boolean }> = {
  // đọc
  toiS2: { doi: 'khong' }, dsPhimS2: { doi: 'khong' }, dsGoiTheLoai: { doi: 'khong' }, dsTemplateS2: { doi: 'khong' }, dsMauPhim: { doi: 'khong' }, docTemplate: { doi: 'khong' },
  docPhim: { doi: 'phim' }, quyTrinhTap: { doi: 'phim' }, dsCanh: { doi: 'tap' }, uocTien: { doi: 'tap' }, uocAm: { doi: 'tap' }, nhatKyTap: { doi: 'tap' }, nhatKyCanh: { doi: 'canh' }, docCoSoS2: { doi: 'tap' },
  docViecNen: { doi: 'viec' }, trangThaiXuat: { doi: 'job' },
  // ghi không tốn tiền
  taoPhimS2: { doi: 'khong' }, taoPhimTuTemplate: { doi: 'khong' }, taoTap: { doi: 'phim' }, suaPhim: { doi: 'phim' }, suaTap: { doi: 'tap' }, suaCanh: { doi: 'canh' }, xepCanh: { doi: 'tap' }, themCanh: { doi: 'tap' },
  duyetNguoiXemTayAction: { doi: 'tap' }, luuKhuonChuoi: { doi: 'tap' }, chonKeyframe: { doi: 'canh' }, duyetCanh: { doi: 'canh' }, duyetAnimatic: { doi: 'tap' }, xuatTap: { doi: 'tap' },
  // ghi tốn tiền
  taoPhimMau: { doi: 'khong', tien: true }, phanTichAstrolasS2: { doi: 'tap', tien: true }, vietKichBanTap: { doi: 'tap', tien: true }, tachCanhTap: { doi: 'tap', tien: true }, batDauNguoiXem: { doi: 'tap', tien: true }, suaTheoNguoiXem: { doi: 'tap', tien: true },
  goiYAIKinhThanh: { doi: 'phim', tien: true }, goiYAIBoAnchor: { doi: 'phim', tien: true }, sinhAnhThieuAction: { doi: 'phim', tien: true }, sinhKeyframe: { doi: 'canh', tien: true },
  sinhGiong: { doi: 'tap', tien: true }, sinhVideoCanh: { doi: 'canh', tien: true }, sinhNhac: { doi: 'tap', tien: true },
};
/** hàm vừa tạo ra một phim → phim đó thuộc về người bấm */
const TAO_PHIM = new Set(['taoPhim', 'taoPhimMau', 'taoPhimTuTemplate']);
type Row = Record<string, unknown>;
type Db = NonNullable<ReturnType<typeof getDb>>;

export type QuyenS2 = { dung: boolean; sinh: boolean };
export async function quyenCua(userId: number): Promise<QuyenS2> {
  const db = getDb();
  if (!db) return { dung: false, sinh: false };
  const r = (await db.execute(sql`SELECT dung, sinh FROM xv_s2_quyen WHERE user_id = ${userId}`)) as unknown as Row[];
  return { dung: !!r[0]?.dung, sinh: !!r[0]?.sinh };
}
const soNguyen = (x: unknown): number | null => { const v = Number(x); return Number.isInteger(v) && v > 0 ? v : null; };
/** dò phim mà lượt gọi này đụng tới, theo đối số đầu */
async function phimCua(db: Db, doi: Doi, a0: unknown): Promise<number | null> {
  if (doi === 'viec') { const o = (a0 && typeof a0 === 'object' ? a0 : {}) as Row; return o.tapId != null ? phimCua(db, 'tap', o.tapId) : phimCua(db, 'job', o.id); }
  const id = soNguyen(a0);
  if (!id) return null;
  if (doi === 'phim') return id;
  const r = (doi === 'tap' ? await db.execute(sql`SELECT phim_id AS p FROM xv_tap WHERE id = ${id}`)
    : doi === 'canh' ? await db.execute(sql`SELECT t.phim_id AS p FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${id}`)
    : await db.execute(sql`SELECT coalesce(j.phim_id, (SELECT t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = j.canh_id)) AS p FROM xv_job j WHERE j.id = ${id}`)) as unknown as Row[];
  return soNguyen(r[0]?.p);
}
const idPhimTu = (kq: unknown): number | null => { const d = (kq && typeof kq === 'object' ? (kq as Row).data : null); return soNguyen(d) ?? soNguyen((d && typeof d === 'object' ? (d as Row).phimId ?? (d as Row).phim : null)); };

/** Chạy một hàm của route Studio 2 dưới đúng quyền của người đang đăng nhập. Bị từ chối → ném lỗi có câu nói rõ vì sao (route trả câu đó cho trang). */
export async function chayS2<T>(loai: 'doc' | 'ghi', ham: string, args: unknown[], f: () => Promise<T>): Promise<T> {
  const me = await getCurrentUser(), db = getDb(), t0 = Date.now(), luat = LUAT[ham];
  const so = async (phimId: number | null, ok: boolean, loi: string) => { if (loai !== 'ghi' || !db || !me) return;
    await db.execute(sql`INSERT INTO xv_s2_luot (user_id, email, ham, phim_id, ok, loi, ms) VALUES (${me.id}, ${me.email}, ${ham}, ${phimId}, ${ok}, ${loi.slice(0, 500)}, ${Date.now() - t0})`).catch((e) => console.error('[studio2 sổ lượt]', e)); };
  const chay = async (phimId: number | null, trongS2: boolean): Promise<T> => {
    try { const kq = await (trongS2 && me ? ALS.run({ userId: me.id }, f) : f());
      const tuChoi = kq && typeof kq === 'object' && (kq as Row).ok === false ? String((kq as Row).loi ?? '') : '';
      const moi = !tuChoi && TAO_PHIM.has(ham) ? idPhimTu(kq) : null;
      if (moi && db && me) await db.execute(sql`UPDATE xv_phim SET owner_user_id = ${me.id} WHERE id = ${moi} AND owner_user_id IS NULL`);
      await so(phimId ?? moi ?? idPhimTu(kq), !tuChoi, tuChoi); return kq; }
    catch (e) { await so(phimId, false, e instanceof Error ? e.message : String(e)); throw e; }
  };
  if (!me || !db || me.role === 'admin') return chay(db && luat ? await phimCua(db, luat.doi, args[0]).catch(() => null) : null, false);
  if (!luat) return f();   // hàm ngoài luật: để nguyên như trước (tự hỏi admin() → người thường nhận rỗng / "không có quyền")
  const tuChoi = async (cau: string, phimId: number | null = null): Promise<never> => { await so(phimId, false, cau); throw new Error(cau); };
  const q = await quyenCua(me.id);
  if (ham === 'toiS2') return chay(null, true);
  if (!q.dung) return tuChoi('tài khoản này chưa được cấp quyền dùng Studio 2 — nhờ quản trị cấp ở mục Đội');
  if (luat.tien && !q.sinh) return tuChoi('bước này tốn tiền; tài khoản chưa được cấp quyền bấm bước tốn tiền — nhờ quản trị cấp ở mục Đội');
  if (luat.doi === 'khong') return chay(null, true);
  const phimId = await phimCua(db, luat.doi, args[0]);
  if (!phimId) return tuChoi('không dò được phim của lượt này');
  const chu = (await db.execute(sql`SELECT 1 AS co FROM xv_phim WHERE id = ${phimId} AND owner_user_id = ${me.id}`)) as unknown as Row[];
  if (!chu[0]) return tuChoi(`phim #${phimId} không phải phim của bạn`, phimId);
  return chay(phimId, true);
}
