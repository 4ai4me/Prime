import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BIRD_NAMES,
  BLOCKED_NAME_PARTS,
  FIXED_SCHOOL_NAME,
  GRADE_OPTIONS,
  LEGACY_PROFILE_STORAGE_KEY,
  ACTIVE_STUDENT_KEY_STORAGE,
  allClassNamesOf,
  classRosterDocId,
  compareV2Identity,
  formatResetCode,
  generateRandomName,
  generateResetCode,
  hashResetCode,
  isBlockedName,
  isLegacyViewOpen,
  isV2Registration,
  isV2StudentKey,
  isValidClassName,
  isValidStudentName,
  isWellFormedResetCode,
  koreanYearOf,
  legacyArchiveKey,
  legacySerialLabel,
  normalizeClassRoster,
  normalizeResetCode,
  purgeLegacyLocalData,
  regenerateGradeClasses,
  scrubLegacyJson,
  shuffled,
  studentKeyForName,
  v2FullLabel,
  v2GroupLabel,
  validateV2RegistrationInput,
  type ClassRoster,
  type StorageLike,
} from './studentIdentity';
import { validateStudentPassword } from './authLogic';

// 보안 규칙(firestore.rules)과 같은 형식이어야 함
const RULES_NAME = /^[가-힣]{2,4}$/;
const RULES_KEY = /^v2_[가-힣]{2,4}$/;
const RULES_CLASS = /^[가-힣]{1,8}반$/;

/** 같은 값이 나오는 난수 (시험용) */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('고정값: 학교 이름·학년 선택지', () => {
  assert.equal(FIXED_SCHOOL_NAME, '하연 학교');
  assert.deepEqual([...GRADE_OPTIONS], ['중1', '중2', '중3', '고1', '고2', '고3']);
});

test('년도는 한국 시간 기준 (12/31 밤 = 다음 해 아님, 1/1 새벽 KST = 새 해)', () => {
  assert.equal(koreanYearOf(new Date('2026-12-31T14:59:59Z')), '2026'); // KST 23:59:59
  assert.equal(koreanYearOf(new Date('2026-12-31T15:00:00Z')), '2027'); // KST 2027-01-01 00:00
  assert.equal(koreanYearOf(new Date('2026-11-28T06:00:00Z')), '2026');
});

test('랜덤 이름: 2~4자 한글, 규칙 형식과 같음, 금지 이름 없음 (5000번)', () => {
  const rnd = seeded(7);
  const lengths = new Set<number>();
  for (let i = 0; i < 5000; i++) {
    const n = generateRandomName(rnd);
    assert.ok(RULES_NAME.test(n), `형식 오류: ${n}`);
    assert.ok(isValidStudentName(n));
    assert.ok(!isBlockedName(n), `금지 이름: ${n}`);
    assert.ok(!n.includes('하연'));
    assert.ok(RULES_KEY.test(studentKeyForName(n)));
    lengths.add(n.length);
  }
  assert.deepEqual([...lengths].sort(), [2, 3, 4]);
});

test('랜덤 이름: 놀림·혐오·성적인 말이 들어간 이름은 만들지 않음 (20만 번)', () => {
  const rnd = seeded(2026);
  for (let i = 0; i < 200000; i++) {
    const n = generateRandomName(rnd);
    const bad = BLOCKED_NAME_PARTS.find((w) => n.includes(w));
    assert.equal(bad, undefined, `${n}에 '${bad}'가 들어 있음`);
  }
  for (const n of ['김성기', '황보지윤', '변태수', '노예린', '고아라', '구라현', '변기수', '나가라', '이운지', '박성인']) {
    assert.equal(isBlockedName(n), true, n);
  }
  for (const n of ['김하늘', '이서준', '박지우', '최예린']) {
    assert.equal(isBlockedName(n), false, n);
  }
});

test('금지어 목록: 이름 음절로 실제로 만들어질 수 있는 위험한 말을 모두 포함', () => {
  // 성 끝 글자 또는 이름 음절 + 이름 음절로 만들어질 수 있는 말 중 위험한 것 (2026-11-28 점검)
  const reachable = [
    '성기', '보지', '고환', '성인', '명기', '오나', '변태', '수유', '모유', '임산', '변기', '변소', '배설', '지린',
    '가래', '구린', '구리', '노예', '하인', '천민', '고아', '노인', '백인', '황인', '운지', '공산', '도라', '재수',
    '추하', '추태', '고래', '모기', '기린', '염소', '여우', '여시', '오리', '소주', '양주', '탁주', '주정', '구라',
    '호로', '호래', '동정', '배란', '천한', '빈민', '노화', '노가다', '전범', '강도', '범인', '원수', '인민', '하수',
    '추한', '가라', '별로', '아기', '아가', '유아', '동성',
  ];
  for (const w of reachable) assert.ok((BLOCKED_NAME_PARTS as readonly string[]).includes(w), w);
});

test('랜덤 이름: 매번 다르게 나옴 (1000번 중 겹침이 드묾)', () => {
  const set = new Set<string>();
  for (let i = 0; i < 1000; i++) set.add(generateRandomName());
  assert.ok(set.size > 950, `겹침이 많음: ${1000 - set.size}`);
});

test('이름 검사: 직접 입력한 이상한 값은 통과하지 않음', () => {
  for (const bad of ['', '김', '홍길동전설', 'Kim', '김 하늘', '김하늘1', '김하늘!']) {
    assert.equal(isValidStudentName(bad), false, bad);
  }
  assert.equal(isV2StudentKey('v2_김하늘'), true);
  assert.equal(isV2StudentKey('stu_c2d8_g1_c03_n15'), false);
  assert.equal(isV2StudentKey('v2_Kim'), false);
});

test('새 방식 문서 구분: schema 2 + 키 = v2_이름 일 때만', () => {
  const ok = { schema: 2, studentKey: 'v2_김하늘', name: '김하늘' };
  assert.equal(isV2Registration(ok), true);
  assert.equal(isV2Registration({ ...ok, schema: undefined }), false);
  assert.equal(isV2Registration({ ...ok, name: '김바다' }), false);
  // 예전 방식 문서
  assert.equal(
    isV2Registration({ studentKey: 'stu_abc_g1_c03_n15', name: '홍길동', birthDate: '100212' }),
    false
  );
  assert.equal(isV2Registration(null), false);
});

test('새 이름 목록: 서로 다르고, 반 이름 규칙 형식과 같음, 한 년도에 충분한 개수', () => {
  assert.equal(new Set(BIRD_NAMES).size, BIRD_NAMES.length);
  for (const b of BIRD_NAMES) assert.ok(RULES_CLASS.test(`${b}반`), b);
  assert.ok(BIRD_NAMES.length >= 6 * 15, `새 이름 ${BIRD_NAMES.length}개 — 6학년 × 15반을 채우지 못함`);
  assert.ok(BIRD_NAMES.includes('참새') && BIRD_NAMES.includes('병아리') && BIRD_NAMES.includes('독수리'));
});

test('반 만들기: 개수만큼, 같은 년도 안에서 겹치지 않음', () => {
  let roster: ClassRoster = { year: '2026', classes: {} };
  const rnd = seeded(3);
  for (const g of GRADE_OPTIONS) {
    const res = regenerateGradeClasses(roster, g, 15, [], rnd);
    assert.ok(res.ok);
    if (res.ok) roster = res.roster;
  }
  const all = allClassNamesOf(roster);
  assert.equal(all.length, 90);
  assert.equal(new Set(all).size, 90, '같은 년도에 같은 반 이름이 있음');
  for (const n of all) assert.ok(isValidClassName(n));
});

test('반 다시 만들기: 학생이 있는 반은 남기고 나머지만 새로', () => {
  const roster: ClassRoster = { year: '2026', classes: { 중1: ['참새반', '까치반', '제비반'], 중2: ['독수리반'] } };
  const res = regenerateGradeClasses(roster, '중1', 4, ['까치반'], seeded(11));
  assert.ok(res.ok);
  if (!res.ok) return;
  const list = res.roster.classes.중1 || [];
  assert.equal(list.length, 4);
  assert.equal(list[0], '까치반');
  assert.ok(!list.includes('독수리반'), '다른 학년 반 이름과 겹침');
  assert.deepEqual(res.roster.classes.중2, ['독수리반']);
});

test('반 다시 만들기: 학생이 있는 반 수보다 적게는 못 줄임', () => {
  const roster: ClassRoster = { year: '2026', classes: { 고1: ['참새반', '까치반'] } };
  const res = regenerateGradeClasses(roster, '고1', 1, ['참새반', '까치반']);
  assert.equal(res.ok, false);
  const zero = regenerateGradeClasses(roster, '고1', 0, []);
  assert.ok(zero.ok && zero.roster.classes.고1 === undefined);
  assert.equal(regenerateGradeClasses(roster, '고1', 16, []).ok, false);
});

test('반 목록 읽기: 형식이 틀린 칸은 버림', () => {
  const r = normalizeClassRoster('2026', {
    classes: { 중1: ['참새반', '참새반', 'Bird', 3], 대1: ['까치반'], 고3: '까치반' },
  });
  assert.deepEqual(r.classes, { 중1: ['참새반'] });
  assert.equal(classRosterDocId('2027'), 'class_roster_2027');
});

test('가입 입력 검사: 이름·학년·반(목록 안)·비밀번호·재확인', () => {
  const roster: ClassRoster = { year: '2026', classes: { 중1: ['참새반'] } };
  const base = { name: '김하늘', grade: '중1', className: '참새반', password: 'Abcd123!', passwordConfirm: 'Abcd123!' };
  assert.deepEqual(validateV2RegistrationInput(base, roster, validateStudentPassword), { ok: true });
  assert.equal(validateV2RegistrationInput({ ...base, name: '' }, roster, validateStudentPassword).ok, false);
  assert.equal(validateV2RegistrationInput({ ...base, grade: '1' }, roster, validateStudentPassword).ok, false);
  assert.equal(validateV2RegistrationInput({ ...base, className: '까치반' }, roster, validateStudentPassword).ok, false);
  assert.equal(validateV2RegistrationInput(base, null, validateStudentPassword).ok, false);
  assert.equal(
    validateV2RegistrationInput({ ...base, password: 'abcd1234', passwordConfirm: 'abcd1234' }, roster, validateStudentPassword).ok,
    false
  );
  assert.equal(validateV2RegistrationInput({ ...base, passwordConfirm: 'Abcd123?' }, roster, validateStudentPassword).ok, false);
});

test('일회용 코드: 8자, 헷갈리는 글자 없음, 입력 정리', async () => {
  for (let i = 0; i < 200; i++) {
    const c = generateResetCode();
    assert.equal(c.length, 8);
    assert.ok(!/[IO01]/.test(c), c);
    assert.ok(isWellFormedResetCode(c));
  }
  assert.equal(formatResetCode('abcdefgh'), 'ABCD-EFGH');
  assert.equal(normalizeResetCode(' abcd-efgh '), 'ABCDEFGH');
  assert.equal(isWellFormedResetCode('ABCD-EFG0'), false);
  // 하이픈·소문자로 입력해도 같은 해시 (학생이 보이는 대로 입력)
  assert.equal(await hashResetCode('v2_김하늘', 'abcd-efgh'), await hashResetCode('v2_김하늘', 'ABCDEFGH'));
  // 학생마다 해시가 다름
  assert.notEqual(await hashResetCode('v2_김하늘', 'ABCDEFGH'), await hashResetCode('v2_김바다', 'ABCDEFGH'));
  assert.match(await hashResetCode('v2_김하늘', 'ABCDEFGH'), /^[0-9a-f]{64}$/);
});

test('이전 기록 보기: 2027-03-31(한국 시간)까지만', () => {
  assert.equal(isLegacyViewOpen(new Date('2027-03-31T14:59:59Z')), true); // KST 23:59:59
  assert.equal(isLegacyViewOpen(new Date('2027-03-31T15:00:00Z')), false); // KST 4/1 00:00
  assert.equal(legacySerialLabel(7), '이전기록-007');
  assert.equal(legacyArchiveKey(12), 'legacy_012');
});

test('예전 기록 가명 처리: 개인정보 항목을 비우고 글 속 실명을 바꿈 (안에 품은 JSON까지)', () => {
  const inner = JSON.stringify({ group: '수일고 1학년 3반', code: '10315_홍길동', l1: { memo: '홍길동 잘함' } });
  const json = JSON.stringify({
    group: '수일고 1학년 3반',
    code: '10315_홍길동',
    teacherMemo: '홍길동 학생 발표 좋음',
    l1: { answer: 'f(x)=2x' },
    funcWorksheet: inner,
    list: ['홍길동', 3],
  });
  const out = scrubLegacyJson(json, ['홍길동']);
  assert.ok(!out.includes('홍길동'), out);
  assert.ok(!out.includes('수일고'), out);
  assert.ok(!out.includes('10315'), out);
  const parsed = JSON.parse(out);
  assert.equal(parsed.group, '');
  assert.equal(parsed.teacherMemo, '○○○ 학생 발표 좋음');
  assert.deepEqual(parsed.l1, { answer: 'f(x)=2x' });
  assert.equal(JSON.parse(parsed.funcWorksheet).group, '');
  // JSON이 아니어도 실명은 바꿈
  assert.equal(scrubLegacyJson('홍길동 메모', ['홍길동']), '○○○ 메모');
});

test('정렬: 년도(최근) → 학년 → 반 → 이름, 표시 문구', () => {
  const list = [
    { year: '2026', grade: '고1', className: '참새반', name: '나' },
    { year: '2027', grade: '중1', className: '참새반', name: '다' },
    { year: '2026', grade: '중1', className: '까치반', name: '가' },
  ].sort(compareV2Identity);
  assert.deepEqual(list.map((x) => x.name), ['다', '가', '나']);
  assert.equal(v2GroupLabel({ year: '2026', grade: '중1', className: '참새반' }), '2026 중1 참새반');
  assert.equal(v2FullLabel({ year: '2026', grade: '중1', className: '참새반', name: '김하늘' }), '2026 중1 참새반 김하늘');
});

test('무작위 섞기: 원소는 그대로', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffled(src, seeded(5));
  assert.deepEqual([...out].sort(), src);
});

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

test('기기 정리: 예전 로그인 정보·실명 보관본은 지우고 새 방식 것은 남김', () => {
  const s = new MemoryStorage();
  s.setItem(LEGACY_PROFILE_STORAGE_KEY, JSON.stringify({ studentKey: 'stu_x_g1_c03_n15', name: '홍길동' }));
  s.setItem(ACTIVE_STUDENT_KEY_STORAGE, 'stu_x_g1_c03_n15');
  s.setItem('func_discovery_lessons_student_v1::stu_x_g1_c03_n15', '{"code":"10315_홍길동"}');
  s.setItem('func_discovery_lessons_student_v1::v2_김하늘', '{"code":"김하늘"}');
  s.setItem('func_discovery_lessons_teacher_v1', '[{"code":"10315_홍길동"}]');
  s.setItem('rational_lessons_student_v1', '{"code":"10315_홍길동"}');
  s.setItem('func_class_lesson_access_v1', '{"classes":{"수일고등학교|1|3":{}}}');
  s.setItem('math_detective_device_hw_token_v1', 'abc');
  const removed = purgeLegacyLocalData(s);
  assert.equal(removed, 6);
  assert.equal(s.getItem('func_class_lesson_access_v1'), null);
  assert.equal(s.getItem(LEGACY_PROFILE_STORAGE_KEY), null);
  assert.equal(s.getItem(ACTIVE_STUDENT_KEY_STORAGE), null);
  assert.equal(s.getItem('func_discovery_lessons_student_v1::v2_김하늘'), '{"code":"김하늘"}');
  assert.equal(s.getItem('math_detective_device_hw_token_v1'), 'abc');

  // 두 번째부터: 새 방식 로그인 정보와 활동지 보관본은 지우지 않음
  s.setItem(LEGACY_PROFILE_STORAGE_KEY, JSON.stringify({ schema: 2, studentKey: 'v2_김하늘', name: '김하늘' }));
  s.setItem(ACTIVE_STUDENT_KEY_STORAGE, 'v2_김하늘');
  s.setItem('func_discovery_lessons_student_v1', '{"code":"김하늘"}');
  assert.equal(purgeLegacyLocalData(s), 0);
  assert.equal(s.getItem(ACTIVE_STUDENT_KEY_STORAGE), 'v2_김하늘');

  // 예전 프로필이 다시 생기면 다시 지움
  s.setItem(LEGACY_PROFILE_STORAGE_KEY, JSON.stringify({ studentKey: 'stu_y', name: '임꺽정' }));
  assert.equal(purgeLegacyLocalData(s), 1);
});
