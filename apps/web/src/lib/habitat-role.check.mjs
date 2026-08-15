// Kiểm luật suy vai cộng đồng (habitat-role.ts) + bảng nối kiểu-bài-đo-được → content_type
// (content-formats.ts). Chạy: node habitat-role.check.mjs
// Repo chưa có test runner nên để dạng script chạy thẳng. Số liệu dưới đây là SỐ THẬT lấy từ
// đợt khảo sát 65 nhóm (2026-08) — luật đổi mà mấy nhóm này nhảy vai sai là gãy ngay ở đây.
//
// Giữ ĐỒNG BỘ với ngưỡng trong habitat-role.ts (NEW_VS_TREND 0.3 · SLOW_FEED 2 · DEAD_ROOM 10).
const NEW_VS_TREND = 0.3, SLOW_FEED = 2, DEAD_ROOM = 10;
const num = (m, k) => { const v = m?.[k]; if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const habitatRole = (m) => {
  const measured = Array.isArray(m?.formatFit);
  const trend = num(m, 'trendMedRx'), fresh = num(m, 'newMedRx'), perDay = num(m, 'postsPerDay');
  if (!measured || trend == null) return 'observe';
  if (trend < DEAD_ROOM) return 'observe';
  if (fresh != null && trend > 0 && fresh / trend >= NEW_VS_TREND) return 'post';
  if (perDay != null && perDay <= SLOW_FEED) return 'post';
  return 'comment';
};

const SURVEY_TO_CONTENT = {
  text: 'text', photo: 'image', album: 'carousel', link: 'link', poll: 'poll',
  comment: 'comment', thread: 'thread', short: 'story', longform: 'video',
  guide: 'doc', listicle: 'doc', share: 'link',
};
const contentTypeFromFit = (fit, allowed) => {
  if (!Array.isArray(fit)) return null;
  const ok = new Set(allowed);
  let best = null;
  for (const r of fit) {
    const eng = Number(r?.medEng);
    if (!r?.format || !Number.isFinite(eng) || eng <= 0) continue;
    const ct = SURVEY_TO_CONTENT[r.format];
    if (!ct || !ok.has(ct)) continue;
    if (!best || eng > best.medEng) best = { contentType: ct, medEng: eng };
  }
  return best;
};

const eq = (got, want, msg) => {
  if (got !== want) { console.error(`FAIL ${msg}: được ${JSON.stringify(got)}, cần ${JSON.stringify(want)}`); process.exitCode = 1; }
  else console.log(`OK   ${msg}`);
};
const fit = [{ format: 'text', n: 9, medEng: 1 }];

// ── Vai, theo số thật ─────────────────────────────────────────────────────────
eq(habitatRole({ formatFit: fit, trendMedRx: 9622, newMedRx: 2 }), 'comment', 'r/AskReddit: bài mới 2 vs trend 9622 → comment');
eq(habitatRole({ formatFit: fit, trendMedRx: 1080, newMedRx: 10, postsPerDay: 18.3 }), 'comment', 'r/riskofrain: feed chạy 18 bài/ngày → comment');
eq(habitatRole({ formatFit: fit, trendMedRx: 1935, newMedRx: 1562, postsPerDay: 1.5 }), 'post', 'r/weddingshaming: bài mới ăn 81% → đăng');
eq(habitatRole({ formatFit: fit, trendMedRx: 32, newMedRx: 6, postsPerDay: 1.4 }), 'post', 'r/astrology: nhịp 1.4 bài/ngày → đăng dù bài mới chỉ 19%');
eq(habitatRole({ formatFit: fit, trendMedRx: 2, newMedRx: 1, postsPerDay: 16.7 }), 'observe', 'r/AstrologyChartShare: trend 2 → phòng gần chết');
eq(habitatRole({ trendMedRx: 500, newMedRx: 400 }), 'observe', 'chưa có formatFit = chưa khảo → không đăng dù số đẹp');
eq(habitatRole({ blocked: 'chưa vào nhóm (nhóm kín)' }), 'observe', 'nhóm kín chưa vào → chờ');
eq(habitatRole({ formatFit: fit, trendMedRx: 10, newMedRx: 1, postsPerDay: 9 }), 'comment', 'đúng ngưỡng chết (10) thì vẫn tính là sống → vào bằng comment');
eq(habitatRole({ formatFit: fit, trendMedRx: 100, newMedRx: 30 }), 'post', 'đúng ngưỡng 30% thì tính là đăng được');

// ── Kiểu bài: số đo thắng, nhưng phải nằm trong cái nền tảng cho phép ─────────
const reddit = ['text', 'image', 'link', 'poll', 'thread', 'comment', 'reply'];
eq(contentTypeFromFit([{ format: 'photo', medEng: 99.5 }, { format: 'text', medEng: 1 }], reddit)?.contentType,
   'image', 'photo 99.5 vs text 1 → ra bài ảnh');
eq(contentTypeFromFit([{ format: 'short', medEng: 500 }, { format: 'text', medEng: 4 }], reddit)?.contentType,
   'text', 'short (→story) không có trên reddit → rơi về kiểu ăn nhì');
eq(contentTypeFromFit([{ format: 'photo', medEng: null }, { format: 'text', medEng: null }], reddit),
   null, 'đo mà chưa có số tương tác → trả null để caller dùng mix nền tảng');
eq(contentTypeFromFit(null, reddit), null, 'chưa khảo → null');
eq(contentTypeFromFit([{ format: 'sequence', medEng: 900 }], reddit), null, 'kiểu không có trong seeding cộng đồng → bỏ, không đoán bừa');

if (!process.exitCode) console.log('\n✓ habitat-role + contentTypeFromFit: tất cả khớp số thật');
