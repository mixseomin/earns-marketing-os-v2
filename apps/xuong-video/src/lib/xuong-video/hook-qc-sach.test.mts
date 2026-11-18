import assert from 'node:assert';
import { sachHook } from './hook-qc.mjs';

assert.equal(sachHook('#sponsored You need to think strategically'), 'You need to think strategically');
assert.equal(sachHook('Sponsored: Big news for vets'), 'Big news for vets');
assert.equal(sachHook('#ad #sponsored Hi there'), 'Hi there');
assert.equal(sachHook('Paid off your loan?'), 'Paid off your loan?');
assert.equal(sachHook('Ads that work'), 'Ads that work');
assert.equal(sachHook('Great deal | Sponsored'), 'Great deal');
console.log('hook-qc sachHook: ok');
