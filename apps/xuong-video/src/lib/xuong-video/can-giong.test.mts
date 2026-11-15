// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/can-giong.test.mts
// Số liệu THẬT (phim #3071, 15/11/2026): âm lượng 10 bin / giây đo bằng ffmpeg trên clip đã soát bằng mắt, giãn ra 100 điểm / giây.
import assert from 'node:assert';
import { khopTheoTiengClip, khoangNoi, doanShot, duongAmLuong, DIEM_GIAY } from './can-giong';

const gian = (s: string) => { const v = s.trim().split(/\s+/).map((x) => Number(x.split(':')[1]) * 150); const o = new Float32Array(v.length * 10); v.forEach((x, i) => o.fill(x, i * 10, i * 10 + 10)); return o; };
// #4 lần 2 (job 8326): clip 4,1 s; mắt: miệng mở 0,75–1,8 s. Giọng "Nhóc, lại đây!" (file gốc), trễ câu 0,1 s.
const c4 = gian('0.0:0 0.1:0 0.2:0 0.3:0 0.4:1 0.5:1 0.6:1 0.7:2 0.8:15 0.9:22 1.0:0 1.1:0 1.2:0 1.3:1 1.4:14 1.5:8 1.6:17 1.7:13 1.8:5 1.9:1 2.0:0 2.1:1 2.2:1 2.3:1 2.4:1 2.5:2 2.6:1 2.7:1 2.8:2 2.9:1 3.0:2 3.1:1 3.2:1 3.3:1 3.4:1 3.5:1 3.6:1 3.7:1 3.8:1 3.9:0');
const g4 = gian('0.0:25 0.1:53 0.2:5 0.3:0 0.4:0 0.5:48 0.6:54 0.7:43 0.8:9');
const r4 = khopTheoTiengClip({ clip: c4, doan: [0, 3.65], phat: 2, cau: [{ giong: g4, tre: 0.1 }] });
assert.ok(r4.loi === null && Math.abs(r4.vao - 0.68) <= 0.05 && r4.toc >= 1.2 && r4.toc <= 1.3, JSON.stringify(r4));   // mắt: miệng mở 0,8 s; tiếng clip 1,0 s cho câu 0,8 s → chạy nhanh 1,25 (máy cũ đặt 0,15)
// #6 lần 4 (job 8325): mắt: miệng mở 0,6–2,0 s. Giọng "Chú cho cháu 5k." có tiếng 0,1–1,29 s, trễ câu 0,1 s → điểm vào 0,4 (máy cũ: 0,62 rồi 0,15)
const c6 = gian('0.0:1 0.1:1 0.2:0 0.3:0 0.4:1 0.5:2 0.6:22 0.7:11 0.8:20 0.9:8 1.0:23 1.1:5 1.2:19 1.3:18 1.4:1 1.5:21 1.6:22 1.7:5 1.8:15 1.9:19 2.0:4 2.1:2 2.2:2 2.3:1 2.4:2 2.5:2 2.6:2 2.7:2 2.8:2 2.9:2 3.0:2 3.1:1 3.2:1 3.3:1 3.4:1 3.5:1 3.6:2 3.7:2 3.8:2 3.9:2');
const g6 = new Float32Array(140).fill(0); g6.fill(3000, 10, 129);
const r6 = khopTheoTiengClip({ clip: c6, doan: [0, 3.65], phat: 2, cau: [{ giong: g6, tre: 0.1 }] });
assert.ok(r6.loi === null && Math.abs(r6.vao - 0.36) <= 0.05 && r6.toc >= 1.13 && r6.toc <= 1.25, JSON.stringify(r6));   // tiếng clip 1,4 s cho câu 1,19 s → nhanh 1,18 ("nói chậm quá")
// #10 (job 8338, cụm B): mắt: miệng mở 0,2–1,3 s; tiếng clip mở nhỏ 0,2 s rồi hét "nhé!" 1,1 s. Giọng "Đi nhanh về nhanh nhé!" có tiếng từ 0,05 s, trễ câu 0.
// Ngưỡng 30 % đỉnh đo đầu câu 0,4 s → điểm vào trễ ~0,2 s; đúng phải ~0,2 − 0,05 × tốc ≈ 0,15
const c10 = gian('0.0:0.35 0.1:0.53 0.2:7.06 0.3:7.49 0.4:12.42 0.5:6.07 0.6:14.1 0.7:7.93 0.8:13.61 0.9:6.32 1.0:12.33 1.1:26.06 1.2:21.96 1.3:8.24 1.4:1.33 1.5:1.17 1.6:1.14 1.7:1.06 1.8:1.19 1.9:1.15 2.0:1.3 2.1:1.92 2.2:1.43 2.3:2.37 2.4:1.44 2.5:1.43 2.6:1.27 2.7:1.58 2.8:1.46 2.9:2.83 3.0:1.39 3.1:3.3 3.2:1.51 3.3:1.5 3.4:1.79 3.5:1.87 3.6:1.95 3.7:1.56 3.8:1.45 3.9:1.29');
const g10 = new Float32Array(100).fill(0.3); g10.fill(9000, 5, 95); g10.fill(4074, 5, 10);
const r10 = khopTheoTiengClip({ clip: c10, doan: [0, 3.55], phat: 2, cau: [{ giong: g10, tre: 0 }] });
assert.ok(r10.loi === null && r10.noi!.bd <= 0.25 && Math.abs(r10.vao - 0.15) <= 0.08, JSON.stringify(r10));
// #6 lần 3 (job 8322, câu lệnh lặp câu thoại): model nói HAI lần 1,2–2,0 và 2,6–3,8 s → chặn "nói lặp"
const c6b = gian('0.0:0 0.1:0 0.2:1 0.3:0 0.4:0 0.5:0 0.6:0 0.7:1 0.8:1 0.9:0 1.0:0 1.1:0 1.2:7 1.3:22 1.4:5 1.5:16 1.6:12 1.7:23 1.8:20 1.9:23 2.0:10 2.1:0 2.2:0 2.3:0 2.4:1 2.5:0 2.6:4 2.7:26 2.8:6 2.9:22 3.0:4 3.1:18 3.2:13 3.3:19 3.4:15 3.5:7 3.6:20 3.7:18 3.8:2 3.9:0');
assert.ok(khopTheoTiengClip({ clip: c6b, doan: [0, 3.65], phat: 2, cau: [{ giong: g6, tre: 0.1 }] }).loi!.includes('nói lặp'));
// #6 lần 2 (câu dồn vào đuôi, nói ở 3,7 s, clip 5,1 s): nói đúng một lần nhưng vào 3,5 + phát 2 lố đoạn 0–4,65 → chặn
const c6c = new Float32Array(510).fill(150); c6c.fill(4000, 370, 490);
assert.ok(khopTheoTiengClip({ clip: c6c, doan: [0, 4.65], phat: 2, cau: [{ giong: g6, tre: 0.1 }] }).loi!.includes('lố khỏi đoạn'));
// tiếng động lẻ (> ngưỡng thấp) cách xa câu không kéo đầu câu lên sớm
const dong = new Float32Array(300).fill(100); dong.fill(1200, 20, 40); dong.fill(6000, 150, 250);
assert.deepStrictEqual(khoangNoi(dong), { bd: 1.5, kt: 2.5 });
// clip im lặng → chặn "không nói"; file giọng câm → chặn
assert.ok(khopTheoTiengClip({ clip: new Float32Array(400).fill(150), doan: [0, 3.65], phat: 2, cau: [{ giong: g6, tre: 0.1 }] }).loi!.includes('không có tiếng nói'));
assert.ok(khopTheoTiengClip({ clip: c6, doan: [0, 3.65], phat: 2, cau: [{ giong: new Float32Array(100), tre: 0.1 }] }).loi!.includes('file giọng'));
// tiếng tách ngắn (< 50 ms) không tính là nói
const tach = new Float32Array(300).fill(100); tach.fill(5000, 50, 53); tach.fill(3000, 150, 250);
assert.deepStrictEqual(khoangNoi(tach), { bd: 1.5, kt: 2.5 });
// đoạn shot: cụm 3 shot cắt ở 0,1 / 2,0 / 4,5, clip 7 s
assert.deepStrictEqual(doanShot([0.1, 2.0, 4.5], 7), [[0, 1.95], [2, 4.45], [4.5, 6.55]]);
assert.strictEqual(duongAmLuong(new Int16Array(8000).fill(100), 8000).length, DIEM_GIAY);
console.log('✓ can-giong (khớp thoại theo tiếng clip — số đo thật #4, #6)');
