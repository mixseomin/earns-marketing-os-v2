// DỮ LIỆU của outreach.on.tc — đọc bảng outreach sẵn có của MOS2 (outreach_campaigns, outreach_prospects) cho MỌI dự án trong một lần.
// Bọc React cache(): một lượt vẽ nhiều widget cùng cần bảng chiến dịch / người nhận chỉ tốn MỘT truy vấn mỗi loại.
// Phép đếm theo nhóm trạng thái lấy từ sổ lib/outreach/kieu.ts (TT_*) — bảng, phễu, dải số cùng một định nghĩa.
// tra-repo-ok: hàm đọc nội bộ trên bảng nhà, không phải khối mã nhiều thao tác.
import { cache } from 'react';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { TT_CHET, TT_CHO, TT_DANG, TT_TRA_LOI, kieuCua, maKieu, type MaKieu } from './kieu';

const iso = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
const ds = (a: string[]) => sql.join(a.map((x) => sql`${x}`), sql`, `);

export type ChienDich = {
  id: number; da: string; ten: string; kieu: MaKieu; kieuGoc: string; chay: boolean; tuGui: boolean; tran: number; tuEmail: string | null; tuTen: string | null;
  n: number; coEmail: number; choGui: number; daGui: number; traLoi: number; thang: number; chet: number; doi: number; toiHan: number; guiCuoi: string | null;
};

/** mọi chiến dịch + phễu của nó. "thang" đếm theo trạng thái thắng của ĐÚNG kiểu chiến dịch (sổ kiểu). */
export const docChienDich = cache(async (): Promise<ChienDich[]> => {
  const db = getDb(); if (!db) return [];
  const rs = (await db.execute(sql`
    select c.id::int as id, coalesce(c.project_id, '') as da, c.name as ten, c.type as kieu, c.status as trang_thai, c.auto_send as tu_gui, c.daily_cap::int as tran,
           c.from_email as tu_email, c.from_name as tu_ten,
           count(p.id)::int as n,
           count(p.id) filter (where p.email is not null and p.email <> '')::int as co_email,
           count(p.id) filter (where p.status in (${ds(TT_CHO)}))::int as cho_gui,
           count(p.id) filter (where p.sent_at is not null)::int as da_gui,
           count(p.id) filter (where p.replied_at is not null or p.status in (${ds(TT_TRA_LOI)}))::int as tra_loi,
           count(p.id) filter (where p.status in (${ds(TT_CHET)}))::int as chet,
           count(p.id) filter (where p.status = 'bounced')::int as doi,
           count(p.id) filter (where p.status in (${ds(TT_DANG)}) and p.next_followup_at <= now() and (p.snooze_until is null or p.snooze_until <= now()))::int as toi_han,
           max(p.sent_at) as gui_cuoi
    from outreach_campaigns c left join outreach_prospects p on p.campaign_id = c.id
    group by c.id order by c.project_id, c.id`)) as unknown as Record<string, unknown>[];
  // thắng theo kiểu: đếm riêng vì mỗi kiểu có bộ trạng thái thắng khác nhau
  const thang = (await db.execute(sql`
    select p.campaign_id::int as cd, p.status as tt, count(*)::int as n from outreach_prospects p where p.campaign_id is not null group by 1, 2`)) as unknown as { cd: number; tt: string; n: number }[];
  return rs.map((r) => {
    const kieuGoc = String(r.kieu ?? ''), k = kieuCua(kieuGoc), id = Number(r.id);
    return {
      id, da: String(r.da), ten: String(r.ten), kieu: maKieu(kieuGoc), kieuGoc, chay: String(r.trang_thai) === 'active', tuGui: r.tu_gui === true, tran: Number(r.tran ?? 0),
      tuEmail: r.tu_email ? String(r.tu_email) : null, tuTen: r.tu_ten ? String(r.tu_ten) : null,
      n: Number(r.n), coEmail: Number(r.co_email), choGui: Number(r.cho_gui), daGui: Number(r.da_gui), traLoi: Number(r.tra_loi),
      thang: thang.filter((t) => t.cd === id && (k.thang as readonly string[]).includes(t.tt)).reduce((a, t) => a + t.n, 0),
      chet: Number(r.chet), doi: Number(r.doi), toiHan: Number(r.toi_han), guiCuoi: iso(r.gui_cuoi),
    };
  });
});

export type NguoiNhan = {
  id: number; da: string; cd: number | null; cdTen: string | null; kieu: MaKieu; ten: string; congTy: string | null; email: string | null; website: string;
  tt: string; nguon: string; guiLuc: string | null; traLoiLuc: string | null; hen: string | null; lan: number; taoLuc: string | null;
};
export const TRAN_NGUOI_NHAN = 5000;

/** người nhận của mọi dự án, mới đụng tới trước (trả lời → gửi → tạo). Quá TRAN_NGUOI_NHAN thì cắt và widget ghi rõ đang cắt. */
export const docNguoiNhan = cache(async (): Promise<{ ds: NguoiNhan[]; tong: number }> => {
  const db = getDb(); if (!db) return { ds: [], tong: 0 };
  const rs = (await db.execute(sql`
    select p.id::int as id, coalesce(p.project_id, '') as da, p.campaign_id::int as cd, c.name as cd_ten, c.type as kieu, p.agent_name as ten, p.company as cong_ty, p.email, p.website,
           p.status as tt, p.source as nguon, p.sent_at as gui_luc, p.replied_at as tra_loi_luc, p.next_followup_at as hen, p.followup_count::int as lan, p.created_at as tao_luc,
           count(*) over ()::int as tong
    from outreach_prospects p left join outreach_campaigns c on c.id = p.campaign_id
    order by coalesce(p.replied_at, p.sent_at, p.created_at) desc nulls last limit ${TRAN_NGUOI_NHAN}`)) as unknown as Record<string, unknown>[];
  return {
    tong: Number(rs[0]?.tong ?? 0),
    ds: rs.map((r) => ({
      id: Number(r.id), da: String(r.da), cd: r.cd == null ? null : Number(r.cd), cdTen: r.cd_ten ? String(r.cd_ten) : null, kieu: maKieu(r.kieu as string | null),
      ten: String(r.ten ?? ''), congTy: r.cong_ty ? String(r.cong_ty) : null, email: r.email ? String(r.email) : null, website: String(r.website ?? ''),
      tt: String(r.tt), nguon: String(r.nguon ?? ''), guiLuc: iso(r.gui_luc), traLoiLuc: iso(r.tra_loi_luc), hen: iso(r.hen), lan: Number(r.lan ?? 0), taoLuc: iso(r.tao_luc),
    })),
  };
});

/** dự án có outreach (có chiến dịch hoặc có người nhận) — bộ chọn dự án trên đầu trang */
export const docDuAnOutreach = cache(async (): Promise<string[]> => {
  const [cd, nn] = await Promise.all([docChienDich(), docNguoiNhan()]);
  return [...new Set([...cd.map((c) => c.da), ...nn.ds.map((p) => p.da)].filter(Boolean))].sort();
});

/** lọc theo dự án đang chọn (?da); rỗng / lạ = mọi dự án */
export const locDa = <T extends { da: string }>(rs: T[], da: string | undefined) => (da ? rs.filter((r) => r.da === da) : rs);

export const SO_NGAY_DUNG = 3;
const ngayTu = (isoStr: string | null) => (isoStr ? Math.floor((Date.now() - Date.parse(isoStr)) / 86_400_000) : null);
/** chiến dịch bật tự gửi, còn thư chờ có email, mà quá SO_NGAY_DUNG ngày không gửi được thư nào → đang ĐỨNG (đường gửi hỏng, lịch không chạy, hoặc thiếu nội dung thư) */
export const dangDung = (c: ChienDich) => c.chay && c.tuGui && c.tran > 0 && c.choGui + c.toiHan > 0 && (ngayTu(c.guiCuoi) ?? 999) > SO_NGAY_DUNG;
export const soNgayTu = ngayTu;
