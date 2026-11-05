// tự kiểm: cổng nạp chung (napVideo) thay gạch ngang dài trong chữ đăng — node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/bo-gach-dai.test.mts
import assert from 'node:assert';
import { boGachDai } from './may';
const d = boGachDai({ title: 'Agincourt — the mud won', description: 'A field–and mud.\n\nImages: Commons', hook: { goc: 'x — y' } });
assert.equal(d.title, 'Agincourt - the mud won');
assert.equal(d.description, 'A field - and mud.\n\nImages: Commons', 'giữ xuống dòng');
assert.equal(d.hook.goc, 'x — y', 'chỉ đụng title / description');
assert.equal(boGachDai(null), null);
console.log('bo-gach-dai: đạt');
