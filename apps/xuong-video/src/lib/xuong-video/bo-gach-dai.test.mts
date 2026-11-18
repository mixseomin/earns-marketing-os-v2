import assert from 'node:assert';
import { boGachDai } from './may-de';

assert.strictEqual(boGachDai('BAH — the part most people miss.'), 'BAH, the part most people miss.');
assert.strictEqual(boGachDai('Pick 2–4 options'), 'Pick 2-4 options');
assert.strictEqual(boGachDai('Retire at 20 years — or wait?'), 'Retire at 20 years, or wait?');
assert.strictEqual(boGachDai('End here —'), 'End here');
assert.deepStrictEqual(boGachDai({ chu: { title: 'A — B' }, de: { lua: ['x – y', 'z'], n: 3 } }), { chu: { title: 'A, B' }, de: { lua: ['x, y', 'z'], n: 3 } });
assert.ok(!/[—–]/.test(JSON.stringify(boGachDai({ a: ['—', 'b—c', 'd –– e'] }))));
console.log('bo-gach-dai: ok');
