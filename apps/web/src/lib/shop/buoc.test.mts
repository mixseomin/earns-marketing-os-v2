import assert from 'node:assert';
import { tachBienThe } from './buoc';
const ca: [string, string, string][] = [
  ['Dark Gray-36', 'Dark Gray', '36'], ['M-Black', 'Black', 'M'], ['2XL-Dark Brown Leopard Print', 'Dark Brown Leopard Print', '2XL'],
  ['Advanced Black-75AB', 'Advanced Black', '75AB'], ['8814 Black-36', '8814 Black', '36'], ['Black / M', 'Black', 'M'], ['Skin Color-XL', 'Skin Color', 'XL'],
  ['3XL-Skin Color', 'Skin Color', '3XL'], ['Khaki-M', 'Khaki', 'M'], ['Black-38D', 'Black', '38D'], ['Black', 'Black', ''],
];
for (const [ten, mau, co] of ca) assert.deepStrictEqual(tachBienThe(ten), { mau, co }, ten);
console.log(`tachBienThe: ${ca.length}/${ca.length} đúng`);
