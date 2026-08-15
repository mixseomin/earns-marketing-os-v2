// Kiểm luật chọn bài để THẢ CẢM XÚC (pickToEngage trong pick-thread.ts). Chạy: node pick-thread.check.mjs
// Luật: còn mới (≤24h) VÀ đang ít tương tác (≤30) — bài đã đông thì tên mình chìm, thả cũng vô ích.
// Giữ ĐỒNG BỘ với bản trong pick-thread.ts.
const pickToEngage = (threads, take = 5, maxAgeH = 24, maxLikes = 30) => threads
  .filter((t) => t.url && (t.ageH == null || t.ageH <= maxAgeH) && (t.likes == null || t.likes <= maxLikes))
  .sort((a, b) => (a.likes ?? 0) - (b.likes ?? 0) || (a.ageH ?? 99) - (b.ageH ?? 99))
  .slice(0, take);

const eq = (got, want, msg) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.error(`FAIL ${msg}: được ${g}, cần ${w}`); process.exitCode = 1; }
  else console.log(`OK   ${msg}`);
};
const T = [
  { url: 'a', likes: 210, ageH: 3 },
  { url: 'b', likes: 2, ageH: 2 },
  { url: 'c', likes: 6, ageH: 48 },
  { url: 'd', likes: 4, ageH: 1 },
];
eq(pickToEngage(T).map((t) => t.url), ['b', 'd'], 'bỏ bài 210 like (đông) + bài 48h (cũ), giữ 2 bài ít like còn mới');
eq(pickToEngage([{ url: 'x', likes: 99, ageH: 1 }]).map((t) => t.url), [], 'chỉ toàn bài đông like → bỏ lượt, không lấy cho đủ số');
eq(pickToEngage([{ url: 'y', ageH: 2 }, { url: 'z', likes: 0, ageH: 5 }]).map((t) => t.url), ['y', 'z'], 'không đọc được số like = coi như 0 (FB hay giấu số ở bài ế), bài mới hơn đứng trước');
eq(pickToEngage(T, 1).map((t) => t.url), ['b'], 'take giới hạn số bài mỗi lượt');
if (!process.exitCode) console.log('\n✓ pickToEngage: trần like + trần tuổi đều ăn');
