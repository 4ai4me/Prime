import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPowerForm,
  checkPrimeFactorization,
  formatPrimeFactorization,
  normalizeExpr,
  parseProduct,
  primeFactorize,
} from './powerExpr';
import { cleanBySpec, patchWithVerify } from './fieldSpec';

test('식 읽기: 위첨자·^·곱셈 기호 여러 모양', () => {
  assert.equal(normalizeExpr('2⁴ × 7³'), '2^4×7^3');
  assert.equal(normalizeExpr('2^4 * 7^3'), '2^4×7^3');
  assert.equal(normalizeExpr('2^10'), '2^10');
  assert.equal(normalizeExpr('2¹⁰'), '2^10');
  assert.deepEqual(parseProduct('2²x3')?.factors, [{ base: 2, exp: 2 }, { base: 3, exp: 1 }]);
  assert.equal(parseProduct('2²×3')?.value, 12);
  assert.equal(parseProduct('2+3'), null);
  assert.equal(parseProduct(''), null);
});

test('거듭제곱 표현 점검: 값·묶기·밑 그대로·작은 수부터', () => {
  const four = [{ base: 4, exp: 1 }, { base: 4, exp: 1 }, { base: 4, exp: 1 }];
  assert.equal(checkPowerForm('4³', four).ok, true);
  assert.equal(checkPowerForm('4^3', four).ok, true);
  assert.equal(checkPowerForm('2⁶', four).ok, false, '밑을 바꾸면 안 됨');
  assert.equal(checkPowerForm('4×4×4', four).ok, false, '묶지 않음');
  assert.equal(checkPowerForm('3⁴', four).ok, false);
  const mix = [2, 5, 2, 2, 5].map((b) => ({ base: b, exp: 1 }));
  assert.equal(checkPowerForm('2³×5²', mix).ok, true);
  assert.equal(checkPowerForm('5²×2³', mix).ok, false, '작은 수부터');
});

test('소인수분해 점검', () => {
  assert.equal(formatPrimeFactorization(90), '2 × 3² × 5');
  assert.equal(formatPrimeFactorization(5239), '13² × 31');
  assert.equal(formatPrimeFactorization(17986), '2 × 17 × 23²');
  assert.deepEqual(primeFactorize(600), [{ base: 2, exp: 3 }, { base: 3, exp: 1 }, { base: 5, exp: 2 }]);
  assert.equal(checkPrimeFactorization('2×3²×5', 90).ok, true);
  assert.equal(checkPrimeFactorization('2×3×3×5', 90).ok, false);
  assert.equal(checkPrimeFactorization('2×45', 90).ok, false);
  assert.equal(checkPrimeFactorization('3²×2×5', 90).ok, false);
  assert.equal(checkPrimeFactorization('2⁵', 32).ok, true);
  assert.equal(checkPrimeFactorization('4×8', 32).ok, false);
});

test('칸 정리: 모르는 칸·형식 틀린 값 버림, 순서 유지 / 고치면 ✓ 지움', () => {
  const spec = { a: 'string', b: 'bool', c: { oneOf: ['x', 'y'] }, d: 'numArray' } as const;
  assert.deepEqual(cleanBySpec({ d: [1, 'a', 2], a: 3, c: 'z', evil: 1, b: true }, spec), { d: [1, 2], c: '', b: true });
  assert.deepEqual(Object.keys(cleanBySpec({ b: true, a: 'q' }, spec)), ['b', 'a']);
  const s = { a: '1', ok: true };
  assert.equal(patchWithVerify(s, { a: '2' }, { a: 'ok' }).ok, false);
  assert.equal(patchWithVerify(s, { a: '1' }, { a: 'ok' }).ok, true);
});
