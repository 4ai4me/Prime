import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonAccessPreset, isLessonEnabled } from './mathLogic';
import {
  buildClassLessonAccessFirestoreClasses,
  classKeyLabel,
  collectClassKeys,
  makeClassKey,
  normalizeClassLessonAccess,
  resolveStudentLessonAccess,
  withClassLessonAccess,
} from './classLessonAccess';

const open = (cfg: Parameters<typeof isLessonEnabled>[0]) => [1, 2, 3, 4, 5, 6].filter((n) => isLessonEnabled(cfg, n as 1));

test('반 키: 학교·학년·반, 앞자리 0과 공백은 같은 반으로', () => {
  assert.equal(makeClassKey({ school: '수일고', grade: '1', classNum: '3' }), '수일고|1|3');
  assert.equal(makeClassKey({ school: ' 수일고 ', grade: '01', classNum: '03' }), '수일고|1|3');
  assert.equal(makeClassKey({ school: '수일고', grade: '1', classNum: '' }), null);
  assert.equal(makeClassKey(null), null);
  assert.equal(classKeyLabel('수일고|1|3'), '수일고 1학년 3반');
});

test('수용 기준 ①②: 1반 1~5차시, 2반 1~4차시, 반 설정 없는 3반은 전체 설정', () => {
  const global = createLessonAccessPreset('upTo3');
  let map = withClassLessonAccess({}, '수일고|1|1', createLessonAccessPreset('upTo5'));
  map = withClassLessonAccess(map, '수일고|1|2', createLessonAccessPreset('upTo4'));

  const c1 = resolveStudentLessonAccess(global, map, '수일고|1|1');
  const c2 = resolveStudentLessonAccess(global, map, '수일고|1|2');
  const c3 = resolveStudentLessonAccess(global, map, '수일고|1|3');
  assert.equal(c1.source, 'class');
  assert.equal(isLessonEnabled(c1.config, 5), true, '1반은 5차시 열림');
  assert.equal(isLessonEnabled(c2.config, 5), false, '2반은 5차시 잠김');
  assert.deepEqual(open(c2.config), [1, 2, 3, 4]);
  assert.equal(c3.source, 'global');
  assert.deepEqual(open(c3.config), [1, 2, 3]);
  // 반을 알 수 없는 경우(교사 화면 등)도 전체 설정
  assert.equal(resolveStudentLessonAccess(global, map, null).source, 'global');
});

test('수용 기준 ③: 전체 설정으로 되돌리면 그 반만 빠지고 원래 묶음은 그대로', () => {
  const map = withClassLessonAccess({}, '수일고|1|2', createLessonAccessPreset('upTo4'));
  const reset = withClassLessonAccess(map, '수일고|1|2', null);
  assert.deepEqual(Object.keys(reset), []);
  assert.deepEqual(Object.keys(map), ['수일고|1|2'], '원래 묶음 변경 없음');
  const global = createLessonAccessPreset('upTo1');
  assert.deepEqual(open(resolveStudentLessonAccess(global, reset, '수일고|1|2').config), [1]);
});

test('서버 형식: 저장값 그대로 읽힘, 칸이 빠지거나 틀린 반은 버리고 전체 설정을 따름', () => {
  const map = withClassLessonAccess({}, '수일고|2|5', createLessonAccessPreset('upTo2', 'liha1634@gmail.com'));
  const classes = buildClassLessonAccessFirestoreClasses(map);
  assert.deepEqual(Object.keys(classes['수일고|2|5']), ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']);
  const back = normalizeClassLessonAccess({ classes, updatedBy: 'x' });
  assert.deepEqual(back.skipped, []);
  assert.deepEqual(open(back.map['수일고|2|5']), [1, 2]);
  assert.equal(back.map['수일고|2|5'].updatedBy, undefined, '반 설정에는 수정자·시각을 넣지 않음');

  const broken = normalizeClassLessonAccess({
    classes: {
      '수일고|1|1': { l1: true, l2: false }, // 칸 부족 → 열림으로 채우지 않음
      '수일고|1|2': 'oops',
      '이상한키': { l1: true, l2: true, l3: true, l4: true, l5: true, l6: true },
      '수일고|1|3': { l1: true, l2: true, l3: false, l4: false, l5: false, l6: false },
    },
  });
  assert.deepEqual(Object.keys(broken.map), ['수일고|1|3']);
  assert.deepEqual(broken.skipped.sort(), ['수일고|1|1', '수일고|1|2', '이상한키'].sort());
  assert.deepEqual(normalizeClassLessonAccess(null).map, {});
  assert.deepEqual(normalizeClassLessonAccess({ classes: 3 }).map, {});
});

test('반 목록: 승인된 학생만, 중복 없이 학년·반 순서', () => {
  const keys = collectClassKeys([
    { school: '수일고', grade: '1', classNum: '10', status: 'approved' },
    { school: '수일고', grade: '1', classNum: '2', status: 'approved' },
    { school: '수일고', grade: '1', classNum: '02', status: 'approved' },
    { school: '수일고', grade: '2', classNum: '1', status: 'pending' },
    { school: '수일고', grade: '', classNum: '1', status: 'approved' },
  ]);
  assert.deepEqual(keys, ['수일고|1|2', '수일고|1|10']);
});

test('저장 실패 이유: Firebase 오류 코드별 안내', async () => {
  const { describeClassLessonAccessError } = await import('./classLessonAccess');
  const denied = describeClassLessonAccessError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' });
  assert.ok(denied.includes('permission-denied') && denied.includes('ai-studio-526dd59d') && denied.includes('규칙'));
  assert.ok(describeClassLessonAccessError({ code: 'firestore/unavailable' }).includes('인터넷'));
  const other = describeClassLessonAccessError(new Error('boom'));
  assert.ok(other.includes('오류 코드 없음') && other.includes('boom'));
  assert.ok(describeClassLessonAccessError({ code: 'invalid-argument', message: 'bad field' }).includes('bad field'));
});
