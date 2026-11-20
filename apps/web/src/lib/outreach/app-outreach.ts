// GỌI APP OUTREACH (repo riêng github.com/mixseomin/outreach, outreach.on.tc — tách khỏi mos2 20/11/2026). Lõi gửi thư (đường gửi theo tên miền, sổ chặn,
// trần, nhật ký), dò thư đến và phanh chiến dịch nằm ở app đó; mos2 còn trang outreach của từng dự án + máy tự gửi mos2-outreach.timer → gọi sang đây
// qua cổng lệnh /api/ext/outreach (khoá MOS2_EXT_KEY, cùng box3). App outreach không trả lời → trả { ok: false, loi } bằng lời thường, không ném.
// tra-repo-ok: hàm gọi HTTP nội bộ một chỗ.
const URL_APP = (process.env.OUTREACH_APP_URL || 'http://127.0.0.1:3905').replace(/\/$/, '');

export async function goiOutreach<T extends { ok: boolean; loi?: string }>(viec: string, than: Record<string, unknown> = {}, hanMs = 60_000): Promise<T | { ok: false; loi: string }> {
  const khoa = process.env.MOS2_EXT_KEY;
  if (!khoa) return { ok: false, loi: 'mos2 thiếu khoá MOS2_EXT_KEY nên không gọi được app outreach.' };
  try {
    const r = await fetch(`${URL_APP}/api/ext/outreach`, { method: 'POST', headers: { authorization: `Bearer ${khoa}`, 'content-type': 'application/json' },
      body: JSON.stringify({ viec, ...than }), signal: AbortSignal.timeout(hanMs), cache: 'no-store' });
    const j = (await r.json().catch(() => null)) as T | null;
    if (!j) return { ok: false, loi: `App outreach trả HTTP ${r.status} không đọc được.` };
    return j;
  } catch (e) {
    return { ok: false, loi: `Không gọi được app outreach (${URL_APP}): ${String((e as Error).message ?? e).slice(0, 160)}` };
  }
}

/** 00:00 hôm nay giờ Việt Nam, dạng ISO — trần thư đầu mỗi ngày của chiến dịch đếm theo ngày Việt Nam (cùng định nghĩa với app outreach › gui.ts) */
export function dauNgayVn(): string {
  const vn = new Date(Date.now() + 7 * 3600_000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600_000).toISOString();
}
