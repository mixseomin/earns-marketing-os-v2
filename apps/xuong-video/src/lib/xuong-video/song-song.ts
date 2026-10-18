// CHẠY SONG SONG có trần (anh 18/10/2026: "sinh nhiều ảnh gửi đồng loạt song song cho nhanh thay vì tuần tự") — một chỗ cho mọi vòng sinh ảnh
// (keyframe, ảnh gốc, biến thể, ảnh học LoRA, thử LoRA). Trần mặc định 4 lượt cùng lúc (XV_SONG_SONG đổi được): Google / fal giới hạn tốc độ theo khoá,
// dồn cả lượt một lúc là ăn lỗi 429. Kết quả giữ đúng thứ tự đầu vào; một lượt ném lỗi không làm dừng các lượt khác (ra { loi }).
export const TRAN_SONG_SONG = Math.max(1, Number(process.env.XV_SONG_SONG) || 4);
export async function songSong<T, R>(ds: readonly T[], fn: (x: T, i: number) => Promise<R>, tran = TRAN_SONG_SONG): Promise<({ ok: true; data: R } | { ok: false; loi: string })[]> {
  const ra: ({ ok: true; data: R } | { ok: false; loi: string })[] = new Array(ds.length);
  let tiep = 0;
  const tho = async () => {
    for (let i = tiep++; i < ds.length; i = tiep++) {
      try { ra[i] = { ok: true, data: await fn(ds[i]!, i) }; } catch (e) { ra[i] = { ok: false, loi: e instanceof Error ? e.message : String(e) }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(tran, ds.length) }, tho));
  return ra;
}
