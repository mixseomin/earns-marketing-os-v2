// Tự kiểm bỏ thoại khỏi prompt video (phần thuần ở kieu.ts).
import assert from 'node:assert';
import { boThoaiTrongPrompt } from './kieu';
const p = 'Handheld phone, slight natural shake. The hands give the two hangers a little proud shake so the jeans sway gently. Hangers clink softly, upbeat pop music continues. Female voice-over, stressing each word with pride (Vietnamese): "Chưa tới ba lăm đô." Keep both pairs centered.';
const r = boThoaiTrongPrompt(p);
assert.ok(!r.includes('Chưa tới') && !r.includes('Vietnamese') && !r.includes('voice-over'), r);
assert.ok(r.includes('Handheld phone, slight natural shake.') && r.includes('Keep both pairs centered.'), r);
assert.equal(boThoaiTrongPrompt('No dialogue here. Just motion.'), 'No dialogue here. Just motion.');
assert.ok(!boThoaiTrongPrompt('He says “Hello there” and smiles (English). Then walks.').includes('Hello'), 'ngoặc cong');
console.log('sinh-video.test: ok');
// vật lý thật theo thể loại (19/10/2026 #1 cà phê vọt lên trời; anh: viễn tưởng… ngoại lệ): tổng tài / chưa đặt → có câu trọng lực; viễn tưởng / hoạt hình / kinh dị → miễn
{ const { cauVatLy } = await import('./dien-anh');
  assert.ok(cauVatLy('phim_doc').includes('gravity')); assert.ok(cauVatLy('').includes('gravity'));
  assert.equal(cauVatLy('vien_tuong'), ''); assert.equal(cauVatLy('hoat_hinh'), ''); assert.equal(cauVatLy('kinh_di'), ''); }

// chất liệu vẽ 2D tách khỏi mô hình nặn; câu nhịp gag giữ đủ nhịp theo thứ tự
{
  const { chatLieuPhim } = await import('./kieu');
  const { cauNhipGag } = await import('./prompt-khoi');
  const { CHAT_LIEU } = await import('./prompt-khoi');
  assert.strictEqual(chatLieuPhim({ chat_lieu: '', phong_cach: 'Hand-painted 2D animation, gouache and watercolor backgrounds' }), 've_2d');
  assert.strictEqual(chatLieuPhim({ chat_lieu: '', phong_cach: 'miniature stop-motion felt puppets, 2d paper backdrop' }), 'hoat_hinh');
  assert.ok(!/miniature|never draw/i.test(CHAT_LIEU.ve_2d.giu_video) && CHAT_LIEU.ve_2d.cam.test('a real photographed miniature'));
  const c = cauNhipGag('0-2s: wobble. | 2-4s: clamp | 4-6s: lift\n6-8s: swing');
  assert.ok(c.includes('0-2s: wobble; 2-4s: clamp; 4-6s: lift; 6-8s: swing'), c);
  assert.strictEqual(cauNhipGag(''), '');
}
