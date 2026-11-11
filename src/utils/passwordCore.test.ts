import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashStudentPassword,
  hasStudentPassword,
  isPasswordHash,
  makeClaimProof,
  needsPasswordSetup,
} from './passwordCore';

// 보안 규칙(firestore.rules)의 claimPasswordHash 형식과 같아야 함
const RULES_CLAIM_PATTERN = /^[0-9a-f]{64}:[A-Za-z0-9]{8,64}$/;

test('해시 방식 고정: Func·Props가 같은 값을 만들어야 함 (바뀌면 기존 비밀번호가 모두 무효)', async () => {
  // sha256("props-func-student-pw-v1|stu_abc_g1_c01_n01|Abcd1234!") — 외부 도구(sha256sum)로 확인한 값
  assert.equal(
    await hashStudentPassword('stu_abc_g1_c01_n01', 'Abcd1234!'),
    '18c91b717c0bb179dfb64278a2913b4479ac528c97d2a3103d7a78c9e3e09372'
  );
});

test('같은 비밀번호라도 학생마다 해시가 다르고, 비밀번호가 다르면 해시가 다르다', async () => {
  const a = await hashStudentPassword('stu_a', 'Abcd1234!');
  const b = await hashStudentPassword('stu_b', 'Abcd1234!');
  const c = await hashStudentPassword('stu_a', 'Abcd1234?');
  assert.ok(isPasswordHash(a) && isPasswordHash(b) && isPasswordHash(c));
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test('재연결 증명은 규칙 형식을 따르고, 매번 달라지며, 앞부분이 해시와 같다', async () => {
  const h = await hashStudentPassword('stu_a', 'Abcd1234!');
  const p1 = makeClaimProof(h);
  const p2 = makeClaimProof(h);
  assert.match(p1, RULES_CLAIM_PATTERN);
  assert.notEqual(p1, p2, '임의값 때문에 매번 달라야 함 (예전 증명 재사용 방지)');
  assert.equal(p1.split(':')[0], h);
});

test('비밀번호 설정 필요 여부', () => {
  const hash = 'a'.repeat(64);
  assert.equal(needsPasswordSetup(false, {}), false, '사용 안 함이면 요구하지 않음 (기본값)');
  assert.equal(needsPasswordSetup(true, {}), true, '사용 중 + 비밀번호 없음 → 설정 필요');
  assert.equal(needsPasswordSetup(true, { passwordHash: '' }), true, '초기화된 학생 → 설정 필요');
  assert.equal(needsPasswordSetup(true, { passwordHash: hash }), false);
  assert.equal(hasStudentPassword({ passwordHash: 'not-a-hash' }), false);
  assert.equal(isPasswordHash(''), false);
});
