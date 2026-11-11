import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStudentState } from './mathLogic';
import {
  LESSON_KEYS,
  assembleRecord,
  findChangedLessons,
  splitLessons,
  teacherJson,
  type StudentLessonSnapshot,
} from './lessonMerge';

function legacyRecord() {
  const r = createInitialStudentState();
  r.group = '하연고 1학년 1반';
  r.code = '10101_테스트';
  r.updatedAt = '2026-10-01T00:00:00.000Z';
  r.teacherMemo = '예전 메모';
  return r;
}

test('차시 문서가 없으면 예전 worksheetJson 내용을 그대로 사용한다 (기존 데이터 보존)', () => {
  const legacy = legacyRecord();
  const out = assembleRecord(legacy, { lessons: {} });
  assert.deepEqual(splitLessons(out), splitLessons(legacy));
  assert.equal(out.teacherMemo, '예전 메모');
  assert.equal(out.group, legacy.group);
  assert.equal(out.code, legacy.code);
});

test('차시 문서가 있는 차시만 덮어쓰고 나머지 차시는 예전 내용을 유지한다', () => {
  const legacy = legacyRecord();
  const edited = structuredClone(legacy);
  (edited.l3 as unknown as Record<string, unknown>).openMeaningReason = '새로 쓴 답';
  const snap: StudentLessonSnapshot = {
    lessons: {
      l3: { studentKey: 'k', lesson: 3, data: JSON.stringify(edited.l3), clientUpdatedAt: '2026-10-30T00:00:00.000Z' },
    },
  };
  const out = assembleRecord(legacy, snap);
  assert.equal((out.l3 as unknown as Record<string, unknown>).openMeaningReason, '새로 쓴 답');
  for (const k of LESSON_KEYS) {
    if (k === 'l3') continue;
    assert.equal(JSON.stringify(out[k]), JSON.stringify(legacy[k]), `${k}는 예전 내용이어야 함`);
  }
  assert.equal(out.updatedAt, '2026-10-30T00:00:00.000Z', '최신 차시 시각을 활동지 시각으로 사용');
});

test('손상된 차시 문서는 건너뛰고 예전 내용을 사용한다 (덮어쓰기·오류 없음)', () => {
  const legacy = legacyRecord();
  const out = assembleRecord(legacy, {
    lessons: { l1: { studentKey: 'k', lesson: 1, data: '{깨진 json', clientUpdatedAt: '' } },
  });
  assert.equal(JSON.stringify(out.l1), JSON.stringify(legacy.l1));
});

test('교사 평가 문서가 있으면 평가·메모를 그것으로 사용한다', () => {
  const legacy = legacyRecord();
  const withEval = structuredClone(legacy);
  withEval.teacherMemo = '새 메모';
  const out = assembleRecord(legacy, {
    lessons: {},
    teacher: { studentKey: 'k', data: teacherJson(withEval) },
  });
  assert.equal(out.teacherMemo, '새 메모');
});

test('바뀐 차시만 저장 대상으로 고른다', () => {
  const server = legacyRecord();
  const serverJson = splitLessons(server);
  const local = structuredClone(server);
  assert.deepEqual(findChangedLessons(local, serverJson), [], '변경 없으면 저장 안 함');

  (local.l2 as unknown as Record<string, unknown>).bogi2Reason = '수정';
  (local.l5 as unknown as Record<string, unknown>).someNewAnswer = 'x';
  assert.deepEqual(findChangedLessons(local, serverJson), ['l2', 'l5']);

  // 교사 평가·메모 변경은 학생 차시 저장 대상이 아님
  const memoOnly = structuredClone(server);
  memoOnly.teacherMemo = '바뀐 메모';
  assert.deepEqual(findChangedLessons(memoOnly, serverJson), []);
});

test('차시 하나의 크기는 활동지 전체보다 훨씬 작다 (쓰기 단위 절감 확인)', () => {
  const r = legacyRecord();
  const whole = Buffer.byteLength(JSON.stringify(r));
  const parts = splitLessons(r);
  const largest = Math.max(...LESSON_KEYS.map((k) => Buffer.byteLength(parts[k])));
  assert.ok(largest < whole, `가장 큰 차시(${largest}B) < 전체(${whole}B)`);
});
