import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STUDENT_PASSWORD_FEATURE_ENABLED,
  isAuthorizedAdminEmail,
  buildSafeStudentKey,
  normalizeBirthDate,
  isSameBirthDate,
  validateStudentPassword,
  validateStudentRegistrationInput,
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

test('buildSafeStudentKey produces valid Firestore ID matching ^[a-zA-Z0-9_\\-]+$', () => {
  const key = buildSafeStudentKey({
    school: '수일고등학교',
    grade: '1',
    classNum: '9',
    studentNum: '1',
  });
  assert.match(key, /^[a-zA-Z0-9_\-]+$/);
  assert.ok(key.length >= 3 && key.length <= 120);
  assert.ok(key.endsWith('_g1_c09_n01'));
});

test('validateStudentRegistrationInput validates school, grade, class, number, birthDate, and name', () => {
  const valid = validateStudentRegistrationInput({
    school: '수일고등학교',
    grade: '1',
    classNum: '9',
    studentNum: '1',
    birthDate: '2010-02-12',
    name: '강유진',
  });
  assert.equal(valid.ok, true);

  const invalidBirth = validateStudentRegistrationInput({
    school: '수일고등학교',
    grade: '1',
    classNum: '9',
    studentNum: '1',
    birthDate: '123',
    name: '강유진',
  });
  assert.equal(invalidBirth.ok, false);
});

test('validateStudentPassword enforces 8..32 chars, uppercase, lowercase, digit, and special char, and feature flag is disabled by default', () => {
  assert.equal(STUDENT_PASSWORD_FEATURE_ENABLED, false);

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

test('isSameBirthDate matches 6-digit YYMMDD and 8-digit YYYY-MM-DD', () => {
  assert.equal(isSameBirthDate('100212', '2010-02-12'), true);
  assert.equal(isSameBirthDate('20100212', '100212'), true);
  assert.equal(isSameBirthDate('100212', '100213'), false);
});

test('computeDeterministicDeviceHash and formatDeviceHashAsMac produce consistent identifiers', () => {
  const hash = computeDeterministicDeviceHash('iPadOS_Safari_820x1180_token123');
  assert.match(hash, /^DEV_[0-9A-F]{12}$/);
  const mac = formatDeviceHashAsMac(hash);
  assert.match(mac, /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/);
  assert.equal(normalizeBirthDate('20090512'), '2009-05-12');
});
