// Vai của một cộng đồng trong việc seeding, SUY TỪ SỐ ĐO chứ không đặt tay.
//
// Khảo sát 65 nhóm (2026-08) cho ra một quy luật lặp lại: bài ĐĂNG MỚI ở nhóm to gần như vô hình
// (r/AskReddit tương tác trung vị bài mới = 2 trong khi bài trend = 9.622; r/army 5 vs 670;
// r/astrologymemes 7 vs 1.021), còn ở nhóm nhỏ nhịp thấp thì bài mới sống gần bằng bài trend
// (r/weddingshaming 1.562/1.935; r/bridezillas 342/343). Ranh giới rơi vào ~2 bài/ngày — dưới mức
// đó bài còn nằm trên feed đủ lâu để người ta thấy.
//
// Nên "đăng đều mọi nhóm" là sai với số liệu: nhóm to phải vào bằng COMMENT trên bài đang trend,
// nhóm nhỏ mới đăng bài. Hàm này là chỗ DUY NHẤT quyết định điều đó — scheduler, cockpit và vault
// đều đọc ở đây, đừng chép ngưỡng đi nơi khác.
export type HabitatRole = 'post' | 'comment' | 'observe';

/** Tương tác bài mới ≥ ngần này so với bài trend thì đăng vẫn còn ăn. */
const NEW_VS_TREND = 0.3;
/** Nhịp đăng dưới ngần này (bài/ngày) thì bài mới không bị đẩy trôi. */
const SLOW_FEED = 2;
/** Bài trend dưới ngần này = phòng gần chết, đừng tốn lượt. */
const DEAD_ROOM = 10;

export interface HabitatRoleResult {
  role: HabitatRole;
  /** Một câu giải thích lấy từ chính số đo — hiện lên UI để không ai phải đoán vì sao. */
  why: string;
}

type Meta = Record<string, unknown> | null | undefined;
const num = (m: Meta, k: string): number | null => {
  const v = m?.[k];
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function habitatRole(scrapedMeta: Meta): HabitatRoleResult {
  const measured = Array.isArray(scrapedMeta?.formatFit);
  const trend = num(scrapedMeta, 'trendMedRx');
  const fresh = num(scrapedMeta, 'newMedRx');
  const perDay = num(scrapedMeta, 'postsPerDay');

  if (!measured || trend == null) {
    const blocked = typeof scrapedMeta?.blocked === 'string' ? scrapedMeta.blocked : '';
    return { role: 'observe', why: blocked ? `chưa đo được: ${blocked}` : 'chưa khảo sát — chưa có cơ sở để đăng' };
  }
  if (trend < DEAD_ROOM) {
    return { role: 'observe', why: `bài trend chỉ ${trend} tương tác — phòng gần chết` };
  }
  if (fresh != null && trend > 0 && fresh / trend >= NEW_VS_TREND) {
    return { role: 'post', why: `bài mới ăn ${Math.round((fresh / trend) * 100)}% so với bài trend` };
  }
  if (perDay != null && perDay <= SLOW_FEED) {
    return { role: 'post', why: `chỉ ${perDay} bài/ngày — bài mới còn nằm lâu trên feed` };
  }
  return {
    role: 'comment',
    why: fresh != null
      ? `bài mới ${fresh} vs bài trend ${trend} — đăng thì chìm, comment mới gặp người`
      : `bài trend ${trend} nhưng bài mới không đo được — vào bằng comment cho chắc`,
  };
}

export const ROLE_META: Record<HabitatRole, { label: string; short: string; color: string }> = {
  post: { label: 'Đăng bài', short: 'đăng', color: 'var(--ok)' },
  comment: { label: 'Comment bài trend', short: 'comment', color: 'var(--info)' },
  observe: { label: 'Chưa đăng', short: 'chờ', color: 'var(--fg-4)' },
};
