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
