// VẬN HÀNH CHIẾN DỊCH OUTREACH (nhịp 2–4, 20/11/2026) — lõi KHÔNG tự kiểm quyền: hai lớp gọi nó tự gác cửa
// (server action lib/actions/outreach-he.ts kiểm quản trị; cổng lệnh app/api/ext/outreach kiểm khoá MOS2_EXT_KEY) → màn hình và dòng lệnh chạy CÙNG một mã.
// Gồm: tạo chiến dịch theo kiểu · lời chào lấy từ report của một ngách (dự án bán report theo ngách) · số liệu + thư nháp của một chiến dịch · gửi thử · bật tắt tự gửi.
// tra-repo-ok: dán keo nội bộ giữa các bảng outreach nhà và kho spy.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { moSpy } from '@/lib/ke-hoach-goc';
import { KIEU, maKieu } from './kieu';
import { BAN_SOAN } from './thuan';
import { guiThuOutreach, mienCua } from './gui';
import type { LoiChao, ThuChuoi } from './soan-thu';

type Loi = { ok: false; loi: string };
const khongDb: Loi = { ok: false, loi: 'Chưa nối được cơ sở dữ liệu.' };

export async function taoChienDich(o: { da: string; ten: string; kieu: string; tuEmail: string; tuTen: string; tran?: number; cachNgay?: number; soNhac?: number; chao?: LoiChao | null; ngach?: { spId: number; ten: string; slug: string } | null }): Promise<{ ok: true; id: number } | Loi> {
  const db = getDb(); if (!db) return khongDb;
  const ten = o.ten.trim(), tuEmail = o.tuEmail.trim().toLowerCase();
  if (!ten) return { ok: false, loi: 'Chiến dịch cần một cái tên.' };
  if (!Object.prototype.hasOwnProperty.call(KIEU, o.kieu)) return { ok: false, loi: 'Kiểu chiến dịch không có trong sổ kiểu.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tuEmail)) return { ok: false, loi: 'Địa chỉ người gửi không hợp lệ.' };
  const da = (await db.execute(sql`select 1 from projects where id = ${o.da} limit 1`)) as unknown as unknown[];
  if (!da.length) return { ok: false, loi: `Không có dự án "${o.da}" trong MOS2.` };
  const duong = (await db.execute(sql`select 1 from outreach_duong_gui where mien = ${mienCua(tuEmail)} and bat limit 1`)) as unknown as unknown[];
  if (!duong.length) return { ok: false, loi: `Chưa có đường gửi cho tên miền ${mienCua(tuEmail)}. Khai tên miền ở màn Hạ tầng gửi trước, không thì chiến dịch tạo ra cũng không gửi được.` };
  const trung = (await db.execute(sql`select 1 from outreach_campaigns where project_id = ${o.da} and lower(name) = ${ten.toLowerCase()} limit 1`)) as unknown as unknown[];
  if (trung.length) return { ok: false, loi: 'Dự án này đã có chiến dịch cùng tên.' };
  const cauHinh = { ...(o.chao ? { chao: o.chao } : {}), ...(o.ngach ? { ngach: o.ngach } : {}) };
  // chiến dịch mới LUÔN ở chế độ gửi tay: máy không tự gửi thư nào cho tới khi người vận hành bật tự gửi
  const ins = (await db.execute(sql`
    insert into outreach_campaigns (tenant_id, project_id, name, type, status, goal, from_email, from_name, daily_cap, followup_gap_days, max_followups, auto_send, cau_hinh)
    values ('self', ${o.da}, ${ten}, ${o.kieu}, 'active', ${KIEU[maKieu(o.kieu)].dich}, ${tuEmail}, ${o.tuTen.trim() || null}, ${Math.max(1, Math.min(200, o.tran ?? 10))},
            ${Math.max(1, Math.min(30, o.cachNgay ?? 4))}, ${Math.max(0, Math.min(5, o.soNhac ?? 2))}, false, ${JSON.stringify(cauHinh)}::jsonb)
    returning id::int as id`)) as unknown as { id: number }[];
  return { ok: true, id: ins[0]!.id };
}

/**
 * Lời chào dựng từ REPORT của một ngách trong kho spy (dự án bán report theo ngách — AngleBrief): các phát hiện là key_takeaways + nỗi đau + phản đối
 * hàng đầu của chính report, cơ sở là số cuộc trò chuyện report ghi nhận. Bài hướng dẫn miễn phí chỉ gắn khi trang đó trả 200.
 */
export async function chaoTuReport(spId: number, o: { benGui: string; kyTen: string; gocSite: string; banGi: string; gia?: string }): Promise<{ ok: true; chao: LoiChao; ngach: { spId: number; ten: string; slug: string } } | Loi> {
  let r: { ten: string; slug: string; noi_dung: Record<string, unknown>; meta: { so_nguon?: number } | null } | undefined;
  const pg = await moSpy();
  try { r = (await pg<NonNullable<typeof r>[]>`select s.ten, b.slug, b.noi_dung, b.meta from goc_sp s join report_ban b on b.sp_id = s.id where s.id = ${spId}`)[0]; }
  catch (e) { return { ok: false, loi: `Không đọc được kho spy: ${String((e as Error).message ?? e).slice(0, 160)}` }; }
  finally { await pg.end(); }
  if (!r) return { ok: false, loi: 'Ngách này chưa có report.' };
  const chu = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const mang = (k: string) => (Array.isArray(r!.noi_dung[k]) ? (r!.noi_dung[k] as unknown[]) : []);
  const phatHien = [
    ...mang('key_takeaways').slice(0, 4).map(chu),
    ...mang('pains').slice(0, 2).map((x) => chu((x as { pain?: string }).pain)).map((x) => (x ? `Buyers complain: ${x}` : '')),
    ...mang('objections').slice(0, 2).map((x) => chu((x as { objection?: string }).objection)).map((x) => (x ? `Common objection: ${x}` : '')),
    ...mang('triggers').slice(0, 1).map((x) => chu((x as { trigger?: string }).trigger)).map((x) => (x ? `Buying trigger: ${x}` : '')),
  ].filter(Boolean).map((x) => x.replace(/[—–]/g, '-'));
  if (phatHien.length < 3) return { ok: false, loi: 'Report của ngách này chưa đủ phát hiện để viết thư.' };
  const goc = o.gocSite.replace(/\/$/, ''), guide = `${goc}/guides/${r.slug}-ad-hooks`;
  let coGuide = false;
  try { coGuide = (await fetch(guide, { method: 'GET', headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36' }, signal: AbortSignal.timeout(10_000), cache: 'no-store' })).ok; } catch { /* không kiểm được → không gắn */ }
  const soNguon = Number(r.meta?.so_nguon ?? 0);
  return { ok: true, ngach: { spId, ten: r.ten, slug: r.slug }, chao: {
    ben_gui: o.benGui, ky_ten: o.kyTen, ban_gi: o.banGi, ngach: r.ten, phat_hien: phatHien,
    co_so: soNguon ? `${soNguon.toLocaleString('en-US')} buyer conversations about ${r.ten}` : `buyer conversations about ${r.ten}`,
    ...(coGuide ? { link_mien_phi: guide } : {}), link_ban: `${goc}/r/${r.slug}`, ...(o.gia ? { gia: o.gia } : {}),
    cam: ['how the research data is collected', 'any performance result or guarantee', 'that you are a customer of theirs'],
  } };
}

export type MotChienDich = {
  id: number; da: string; ten: string; kieu: string; tuEmail: string | null; tuTen: string | null; tuGui: boolean; tran: number; cachNgay: number; soNhac: number;
  chao: LoiChao | null; ngach: { spId: number; ten: string; slug: string } | null; daXet: number;
  n: number; choGui: number; coChuoi: number; daGui: number; traLoi: number;
  /** chờ gửi, có email, chưa có chuỗi thư */ chuaSoan: number; /** máy xét không bán đúng ngách → đã đưa khỏi hàng chờ */ khongHop: number;
  /** diem / nhanXet: điểm 0–100 và nhận xét của lượt chấm thư đầu (soan-thu.ts) */
  nhap: { id: number; ten: string; email: string; website: string; soQc: number | null; chuoi: ThuChuoi[]; diem: number | null; nhanXet: string | null }[];
  /** số người chờ gửi mà chuỗi thư soạn theo kế hoạch CŨ (khác số thư / luật hiện tại) */ banCu: number;
  /** máy đã tự tắt tự gửi vì chỉ số xấu: lý do + lúc */ phanh: { ly_do: string; luc: string } | null;
};
/** số liệu + thư nháp (tối đa `soNhap` người chờ gửi đã có chuỗi) của một chiến dịch — cho ngăn vận hành và cho việc duyệt */
export async function docMotChienDich(id: number, soNhap = 5): Promise<MotChienDich | null> {
  const db = getDb(); if (!db) return null;
  const c = ((await db.execute(sql`
    select c.id::int as id, coalesce(c.project_id, '') as da, c.name as ten, c.type as kieu, c.from_email as tu_email, c.from_name as tu_ten, c.auto_send as tu_gui, c.daily_cap::int as tran,
           c.followup_gap_days::int as cach_ngay, c.max_followups::int as so_nhac, c.cau_hinh,
           (select count(*)::int from outreach_prospects p where p.campaign_id = c.id) as n,
           (select count(*)::int from outreach_prospects p where p.campaign_id = c.id and p.status = 'to_send') as cho_gui,
           (select count(*)::int from outreach_prospects p where p.campaign_id = c.id and p.du_lieu ? 'chuoi' and p.status <> 'khong_hop') as co_chuoi,
           (select count(*)::int from outreach_prospects p where p.campaign_id = c.id and p.sent_at is not null) as da_gui,
           (select count(*)::int from outreach_prospects p where p.campaign_id = c.id and p.replied_at is not null) as tra_loi,
           (select count(*)::int from outreach_prospects p where p.campaign_id = c.id and p.status = 'to_send' and p.email is not null and p.email <> '' and not (p.du_lieu ? 'chuoi')) as chua_soan,
           (select count(*)::int from outreach_prospects p where p.campaign_id = c.id and p.status = 'khong_hop') as khong_hop,
           (select count(*)::int from outreach_prospects p where p.campaign_id = c.id and p.status = 'to_send' and p.sent_at is null and p.du_lieu ? 'chuoi'
              and coalesce(p.du_lieu->'soan'->>'ke_hoach', '') <> ('kh' || least(4, c.max_followups + 1)::text || case when coalesce((c.cau_hinh->'chao'->>'link_dau')::boolean, false) then 'l' else '' end || ${`-${BAN_SOAN}`})) as ban_cu
    from outreach_campaigns c where c.id = ${id} limit 1`)) as unknown as Record<string, unknown>[])[0];
  if (!c) return null;
  const ch = (c.cau_hinh ?? {}) as { chao?: LoiChao; ngach?: MotChienDich['ngach']; da_xet?: string[]; phanh?: { ly_do?: string; luc?: string } };
  const nhap = (await db.execute(sql`
    select p.id::int as id, coalesce(nullif(p.company, ''), p.agent_name) as ten, p.email, p.website, (p.du_lieu->>'so_qc')::int as so_qc, p.du_lieu->'chuoi' as chuoi,
           (p.du_lieu->'cham'->>'diem')::int as diem, p.du_lieu->'cham'->>'nhan_xet' as nhan_xet
    from outreach_prospects p where p.campaign_id = ${id} and p.status = 'to_send' and p.du_lieu ? 'chuoi' order by p.id limit ${Math.max(0, Math.min(200, soNhap))}`)) as unknown as { id: number; ten: string; email: string; website: string; so_qc: number | null; chuoi: ThuChuoi[]; diem: number | null; nhan_xet: string | null }[];
  return {
    id: Number(c.id), da: String(c.da), ten: String(c.ten), kieu: String(c.kieu), tuEmail: c.tu_email ? String(c.tu_email) : null, tuTen: c.tu_ten ? String(c.tu_ten) : null,
    tuGui: c.tu_gui === true, tran: Number(c.tran), cachNgay: Number(c.cach_ngay), soNhac: Number(c.so_nhac), chao: ch.chao ?? null, ngach: ch.ngach ?? null, daXet: ch.da_xet?.length ?? 0,
    n: Number(c.n), choGui: Number(c.cho_gui), coChuoi: Number(c.co_chuoi), daGui: Number(c.da_gui), traLoi: Number(c.tra_loi), chuaSoan: Number(c.chua_soan), khongHop: Number(c.khong_hop), banCu: Number(c.ban_cu),
    phanh: ch.phanh?.ly_do ? { ly_do: String(ch.phanh.ly_do), luc: String(ch.phanh.luc ?? '') } : null,
    nhap: nhap.map((p) => ({ id: p.id, ten: p.ten, email: p.email, website: p.website, soQc: p.so_qc, chuoi: Array.isArray(p.chuoi) ? p.chuoi : [], diem: p.diem == null ? null : Number(p.diem), nhanXet: p.nhan_xet ?? null })),
  };
}

/** Gửi THỬ thư đầu của một người nhận trong chiến dịch tới địa chỉ của nhà — đúng đường gửi thật, không đổi trạng thái người nhận, không tính vào trần. */
export async function guiThuThu(campaignId: number, toi: string, prospectId?: number): Promise<{ ok: true; ten: string; maThu: string } | Loi> {
  const db = getDb(); if (!db) return khongDb;
  const p = ((await db.execute(sql`
    select p.id::int as id, coalesce(nullif(p.company, ''), p.agent_name) as ten, p.email_subject, p.email_body, c.from_email, c.from_name, c.project_id
    from outreach_prospects p join outreach_campaigns c on c.id = p.campaign_id
    where p.campaign_id = ${campaignId} and coalesce(p.email_body, '') <> '' ${prospectId ? sql`and p.id = ${prospectId}` : sql``} order by p.id limit 1`)) as unknown as Record<string, unknown>[])[0];
  if (!p) return { ok: false, loi: 'Chiến dịch chưa có thư nháp nào để gửi thử. Soạn thư trước.' };
  if (!p.from_email) return { ok: false, loi: 'Chiến dịch chưa đặt người gửi.' };
  const kq = await guiThuOutreach({ tuEmail: String(p.from_email), tuTen: String(p.from_name ?? ''), toi, tieuDe: String(p.email_subject ?? ''), noiDung: String(p.email_body), prospectId: Number(p.id), campaignId, projectId: String(p.project_id ?? ''), thu: true });
  return kq.ok ? { ok: true, ten: String(p.ten), maThu: kq.maThu } : { ok: false, loi: kq.loi };
}

/** bật / tắt máy tự gửi + trần thư đầu mỗi ngày + nhịp nhắc (số lần nhắc 0–3 → chuỗi 1–4 thư; cách nhau mấy ngày). Bật lại tự gửi thì gỡ dấu phanh cũ. */
export async function datCachGui(campaignId: number, o: { tuGui?: boolean; tran?: number; soNhac?: number; cachNgay?: number }): Promise<{ ok: true } | Loi> {
  const db = getDb(); if (!db) return khongDb;
  if (o.tuGui) {
    const c = ((await db.execute(sql`select (select count(*)::int from outreach_prospects p where p.campaign_id = c.id and p.status = 'to_send' and p.email is not null and p.email <> '' and coalesce(p.email_body, '') = '') as thieu from outreach_campaigns c where c.id = ${campaignId}`)) as unknown as { thieu: number }[])[0];
    if (!c) return { ok: false, loi: 'Không thấy chiến dịch này.' };
    if (c.thieu > 0) return { ok: false, loi: `Còn ${c.thieu} người chờ gửi chưa có thư nháp. Soạn thư cho đủ rồi mới bật tự gửi.` };
  }
  await db.execute(sql`update outreach_campaigns set auto_send = coalesce(${o.tuGui ?? null}, auto_send), daily_cap = coalesce(${o.tran == null ? null : Math.max(1, Math.min(200, o.tran))}, daily_cap),
    max_followups = coalesce(${o.soNhac == null ? null : Math.max(0, Math.min(3, Math.round(o.soNhac)))}, max_followups), followup_gap_days = coalesce(${o.cachNgay == null ? null : Math.max(1, Math.min(30, Math.round(o.cachNgay)))}, followup_gap_days),
    cau_hinh = case when ${o.tuGui === true} then coalesce(cau_hinh, '{}'::jsonb) - 'phanh' else cau_hinh end, updated_at = now() where id = ${campaignId}`);
  return { ok: true };
}
