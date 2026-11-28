import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAuthorizedAdminEmail,
  validateStudentPassword,
  computeDeterministicDeviceHash,
  formatDeviceHashAsMac,
} from './authLogic.ts';

test('isAuthorizedAdminEmail strictly allows verified liha1634@gmail.com', () => {
  assert.equal(isAuthorizedAdminEmail('liha1634@gmail.com', true), true);
  assert.equal(isAuthorizedAdminEmail('LIHA1634@gmail.com', true), true);
  assert.equal(isAuthorizedAdminEmail('liha1634@gmail.com', false), false);
  assert.equal(isAuthorizedAdminEmail('otherteacher@gmail.com', true), false);
  assert.equal(isAuthorizedAdminEmail(null, true), false);
});

test('validateStudentPassword enforces 8..32 chars, uppercase, lowercase, digit, and special char', () => {

  // Valid password
  const good = validateStudentPassword('MathDet#2026');
  assert.equal(good.ok, true);

  // Too short (< 8)
  assert.equal(validateStudentPassword('Aa1!567').ok, false);

  // Too long (> 32)
  assert.equal(validateStudentPassword('Aa1!' + 'x'.repeat(30)).ok, false);

  // Missing uppercase
  assert.equal(validateStudentPassword('mathdet#2026').ok, false);

  // Missing lowercase
  assert.equal(validateStudentPassword('MATHDET#2026').ok, false);

  // Missing digit
  assert.equal(validateStudentPassword('MathDetective#').ok, false);

  // Missing special character
  assert.equal(validateStudentPassword('MathDet2026').ok, false);
});

test('computeDeterministicDeviceHash and formatDeviceHashAsMac produce consistent identifiers', () => {
  const hash = computeDeterministicDeviceHash('iPadOS_Safari_820x1180_token123');
  assert.match(hash, /^DEV_[0-9A-F]{12}$/);
  const mac = formatDeviceHashAsMac(hash);
  assert.match(mac, /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/);
});
