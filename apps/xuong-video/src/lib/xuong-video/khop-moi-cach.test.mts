// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/khop-moi-cach.test.mts
import assert from 'node:assert';
import { chonCachKhopMoi } from './khop-moi-cach';

assert.strictEqual(chonCachKhopMoi({ chatLieu: 've_2d', ngonNgu: 'vi', soNguoiNoi: 1 }).cach, 'seedance_audio', 'anime tiếng Việt một người nói (#3071 #4)');
assert.strictEqual(chonCachKhopMoi({ chatLieu: 've_2d', ngonNgu: 'vi', soNguoiNoi: 2 }).cach, 'sync_v2', 'hai người nói một lần sinh');
assert.strictEqual(chonCachKhopMoi({ chatLieu: 'nguoi_that', ngonNgu: 'vi', soNguoiNoi: 1 }).cach, 'sync_v2', 'người thật tiếng Việt');
assert.strictEqual(chonCachKhopMoi({ chatLieu: 'nguoi_that', ngonNgu: 'en-US', soNguoiNoi: 1 }).cach, 'seedance_audio', 'người thật tiếng Anh');
assert.strictEqual(chonCachKhopMoi({ chatLieu: 'hoat_hinh', ngonNgu: null, soNguoiNoi: 1 }).cach, 'seedance_audio', 'hoạt hình, không khai ngôn ngữ');
console.log('✓ khop-moi-cach');
