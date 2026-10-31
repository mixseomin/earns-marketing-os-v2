import assert from 'node:assert';
import { laRoas, mucRoas, gocRoas } from './etp-roas';

for (const t of ['★ ROAS 1 · Y roas 1 duplicate by 65720', 'Dup by 68596 ROAS 1.1', 'Dup by 66168 ROAS 1.2',
  'S_FB_The-Dragons-Silly-Captive_167292_EN_EP8_x10_D69655_ROAS1', 'S_FB_Max_153695_EN_VD-FULL-EP1_V1_D2 (ROAS)'])
  assert.ok(laRoas(t), t);
for (const t of ['Dup by 68596 5', 'Dup by 68624 1', 'S_FB_Prosaic_ROASTED_x2', '2110 Number One Nobody EN - canh that', null, ''])
  assert.ok(!laRoas(t), String(t));
assert.strictEqual(mucRoas('Dup by 68596 ROAS 1.1'), 1.1);
assert.strictEqual(mucRoas('★ X roas 1 duplicate by 65720'), 1);
assert.strictEqual(mucRoas('S_FB_x10_D69655_ROAS1'), null);
assert.strictEqual(gocRoas('Dup by 68596 ROAS 1.1'), 68596);
assert.strictEqual(gocRoas('★ X roas 1.3 duplicate by 65720'), 65720);
assert.strictEqual(gocRoas('S_FB_x10_D69655_ROAS1'), 69655);
assert.strictEqual(gocRoas('S_FB_Max_V1_D2 (ROAS)'), null);
console.log('etp-roas: ok');
