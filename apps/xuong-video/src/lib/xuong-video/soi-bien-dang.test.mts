// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx src/lib/xuong-video/soi-bien-dang.test.mts
// zodSangGemini đọc được zod v3 lẫn v4 ('zod/v4' — khuôn của claude.ts); bản đầu chỉ đọc v3 nên khuôn người xem thành STRING (17/10/2026).
import assert from 'node:assert';
import { z as z3 } from 'zod';
import { z as z4 } from 'zod/v4';
import { zodSangGemini } from './soi-bien-dang';
for (const z of [z3, z4] as const) {
  const zz = z as typeof z4;
  const sc = zodSangGemini(zz.object({ ai: zz.string().describe('Sản phẩm là gì'), ds: zz.array(zz.object({ s: zz.number() })), b: zz.boolean().optional() })) as { type: string; required: string[]; properties: Record<string, { type: string; description?: string; items?: { type: string } }> };
  assert.strictEqual(sc.type, 'OBJECT'); assert.strictEqual(sc.properties.ai!.description, 'Sản phẩm là gì');
  assert.strictEqual(sc.properties.ds!.items!.type, 'OBJECT'); assert.strictEqual(sc.properties.b!.type, 'BOOLEAN'); assert.deepStrictEqual(sc.required, ['ai', 'ds', 'b']);
}
console.log('soi-bien-dang.test: ok');
