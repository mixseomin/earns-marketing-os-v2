// LÕI GỬI THƯ OUTREACH (nhịp 3, 20/11/2026) — MỘT chỗ cho mọi thư outreach đi ra: nút gửi tay, máy tự gửi mỗi ngày, gửi thử.
// Thay cổng Mailjet gắn cứng (đã chết: chiến dịch tự gửi đứng từ 09/07/2026). Đường gửi chọn theo TÊN MIỀN của địa chỉ gửi
// (bảng outreach_duong_gui, migration 0453); DB chỉ ghi tệp khoá + tên biến, mật khẩu đọc từ tệp trên máy chủ lúc gửi.
// Ba chốt trước khi một thư rời máy: (1) người nhận không nằm trong sổ chặn outreach_chan, (2) tên miền chưa chạm trần ngày,
// (3) có đường gửi đang bật. Thiếu một trong ba → KHÔNG gửi và trả câu lý do đọc được. Mọi thư (kể cả lỗi) ghi vào outreach_thu.
// tra-repo-ok: nối nodemailer (đã là thư viện của nhà, packages/shop/src/thu.ts dùng cùng cách) — không tự viết giao thức thư.
import { readFileSync } from 'node:fs';
import nodemailer from 'nodemailer';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export type DuongGui = {
  id: number; mien: string; host: string; cong: number; khoaTep: string; khoaUser: string; khoaPass: string; dkimTep: string | null; dkimSelector: string | null;
  traLoi: string | null; hopDen: string | null; chanThu: string | null; tranNgay: number; bat: boolean; ghiChu: string | null;
};
export const mienCua = (email: string) => String(email ?? '').trim().toLowerCase().split('@')[1] ?? '';
const chuan = (email: string) => String(email ?? '').trim().toLowerCase();

const tuDong = (r: Record<string, unknown>): DuongGui => ({
  id: Number(r.id), mien: String(r.mien), host: String(r.host), cong: Number(r.cong), khoaTep: String(r.khoa_tep), khoaUser: String(r.khoa_user), khoaPass: String(r.khoa_pass),
  dkimTep: r.dkim_tep ? String(r.dkim_tep) : null, dkimSelector: r.dkim_selector ? String(r.dkim_selector) : null, traLoi: r.tra_loi ? String(r.tra_loi) : null,
  hopDen: r.hop_den ? String(r.hop_den) : null, chanThu: r.chan_thu ? String(r.chan_thu) : null, tranNgay: Number(r.tran_ngay), bat: r.bat === true, ghiChu: r.ghi_chu ? String(r.ghi_chu) : null,
});

export async function dsDuongGui(): Promise<(DuongGui & { homNay: number })[]> {
  const db = getDb(); if (!db) return [];
  try {
    const rs = (await db.execute(sql`
      select d.*, (select count(*)::int from outreach_thu t where t.chieu = 'di' and t.trang_thai = 'ok' and t.luc >= ${dauNgayVn()} and split_part(lower(t.tu), '@', 2) = d.mien) as hom_nay
      from outreach_duong_gui d order by d.mien`)) as unknown as Record<string, unknown>[];
    return rs.map((r) => ({ ...tuDong(r), homNay: Number(r.hom_nay) }));
  } catch { return []; }   // bảng chưa có (máy chưa chạy migration 0453)
}

/** 00:00 hôm nay giờ Việt Nam, dạng ISO — "trần ngày" đếm theo ngày Việt Nam */
export function dauNgayVn(): string {
  const vn = new Date(Date.now() + 7 * 3600_000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600_000).toISOString();
}

/** đọc tệp khoá kiểu KEY=VALUE (có thể có "export "), trả giá trị của một tên biến; không bao giờ in ra */
function docKhoa(tep: string, ten: string): string | null {
  try {
    for (const l of readFileSync(tep, 'utf8').split('\n')) {
      const m = l.replace(/^\s*export\s+/, '').match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m && m[1] === ten) return m[2]!.trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* tệp không đọc được → null, người gọi báo lỗi có tên tệp */ }
  return null;
}

export type KetGui = { ok: true; maThu: string } | { ok: false; loi: string };

/** Kiểm một đường gửi có đủ khoá để gửi không — không gửi gì, không in khoá. Dùng cho widget Đường gửi. */
export function kiemDuongGui(d: DuongGui): string | null {
  if (!d.bat) return 'đường gửi đang tắt';
  if (!docKhoa(d.khoaTep, d.khoaUser) || !docKhoa(d.khoaTep, d.khoaPass)) return `tệp khoá ${d.khoaTep} thiếu ${d.khoaUser} hoặc ${d.khoaPass}`;
  if (d.dkimTep) { try { readFileSync(d.dkimTep, 'utf8'); } catch { return `không đọc được khoá ký ${d.dkimTep}`; } }
  return null;
}

/**
 * Gửi MỘT thư outreach. `thu`: thư gửi thử (tới địa chỉ của nhà) — không tính vào trần, không kiểm sổ chặn, ghi trang_thai 'thu'.
 * Trả lỗi dạng câu đọc được; KHÔNG ném.
 */
export async function guiThuOutreach(o: {
  tuEmail: string; tuTen: string; toi: string; toiTen?: string; tieuDe: string; noiDung: string;
  prospectId?: number | null; campaignId?: number | null; projectId?: string | null; buoc?: number; thu?: boolean;
  /** Message-ID của thư trước trong cùng chuỗi — thư nhắc nối vào đúng luồng thư ở hộp người nhận */
  noiVao?: string | null;
}): Promise<KetGui> {
  const db = getDb(); if (!db) return { ok: false, loi: 'Chưa nối được cơ sở dữ liệu.' };
  const tu = chuan(o.tuEmail), toi = chuan(o.toi), mien = mienCua(tu);
  const ghi = async (trangThai: string, loi: string | null, maThu: string | null) => {
    try {
      await db.execute(sql`insert into outreach_thu (prospect_id, campaign_id, project_id, chieu, buoc, tu, toi, tieu_de, noi_dung, ma_thu, trang_thai, loi)
        values (${o.prospectId ?? null}, ${o.campaignId ?? null}, ${o.projectId ?? null}, 'di', ${o.thu ? -1 : o.buoc ?? 0}, ${tu}, ${toi}, ${o.tieuDe}, ${o.noiDung}, ${maThu}, ${trangThai}, ${loi})`);
    } catch { /* nhật ký hỏng không được làm hỏng lượt gửi */ }
  };
  const hong = async (loi: string): Promise<KetGui> => { await ghi('loi', loi, null); return { ok: false, loi }; };

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toi)) return { ok: false, loi: `Địa chỉ nhận "${o.toi}" không hợp lệ.` };
  if (!mien) return { ok: false, loi: 'Chiến dịch chưa đặt người gửi nên không biết đi đường gửi nào.' };
  let d: DuongGui | null = null;
  try {
    const r = (await db.execute(sql`select * from outreach_duong_gui where mien = ${mien} limit 1`)) as unknown as Record<string, unknown>[];
    d = r[0] ? tuDong(r[0]) : null;
  } catch { return { ok: false, loi: 'Chưa có bảng đường gửi trên máy chủ (migration 0453 chưa chạy).' }; }
  if (!d) return hong(`Chưa có đường gửi cho tên miền ${mien}. Khai tên miền này ở màn Hạ tầng gửi rồi gửi lại.`);
  const thieu = kiemDuongGui(d);
  if (thieu) return hong(`Đường gửi ${mien} chưa dùng được: ${thieu}.`);

  if (!o.thu) {
    const chan = (await db.execute(sql`select ly_do from outreach_chan where email = ${toi} limit 1`)) as unknown as { ly_do: string }[];
    if (chan[0]) return hong(`${toi} nằm trong sổ chặn (${chan[0].ly_do === 'thoi' ? 'đã xin thôi nhận thư' : chan[0].ly_do === 'doi' ? 'thư từng bị dội' : 'chặn tay'}) nên không gửi.`);
    const dem = (await db.execute(sql`select count(*)::int as n from outreach_thu where chieu = 'di' and trang_thai = 'ok' and luc >= ${dauNgayVn()} and split_part(lower(tu), '@', 2) = ${mien}`)) as unknown as { n: number }[];
    if (Number(dem[0]?.n ?? 0) >= d.tranNgay) return hong(`Tên miền ${mien} đã gửi đủ ${d.tranNgay} thư hôm nay (trần ngày của tên miền). Thư này để ngày mai.`);
  }

  // chân thư: câu xin thôi (trả lời là dừng) + dòng tên/địa chỉ bên gửi nếu đã khai. Không gắn link trang nội bộ vào thư.
  const than = [o.noiDung.trim(), '', "If this isn't relevant, reply with \"no\" and I won't write again.", ...(d.chanThu ? [d.chanThu] : [])].join('\n');
  const traLoi = d.traLoi || tu;
  try {
    const t = nodemailer.createTransport({
      host: d.host, port: d.cong, secure: d.cong === 465, requireTLS: d.cong !== 465,
      auth: { user: docKhoa(d.khoaTep, d.khoaUser)!, pass: docKhoa(d.khoaTep, d.khoaPass)! },
      ...(d.dkimTep ? { dkim: { domainName: mien, keySelector: d.dkimSelector || 'mailer', privateKey: readFileSync(d.dkimTep, 'utf8') } } : {}),
    });
    const kq = await t.sendMail({
      from: { name: o.tuTen || mien, address: tu }, to: o.toiTen ? { name: o.toiTen, address: toi } : toi, replyTo: traLoi,
      subject: o.tieuDe, text: than,
      headers: { 'List-Unsubscribe': `<mailto:${traLoi}?subject=unsubscribe>` },
      ...(o.noiVao ? { inReplyTo: o.noiVao, references: [o.noiVao] } : {}),
    });
    const maThu = String(kq.messageId ?? '');
    await ghi(o.thu ? 'thu' : 'ok', null, maThu);
    return { ok: true, maThu };
  } catch (e) {
    return hong(`Máy chủ thư ${d.host} từ chối: ${String((e as Error).message ?? e).slice(0, 200)}`);
  }
}
