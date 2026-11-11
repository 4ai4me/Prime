import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HelpSourcePicker, nextHelpSource } from './HelpSourcePicker';
import {
  cleanStudentState,
  createInitialStudentState,
  mergeStudentStates,
  sanitizeHelpSource,
  type StudentRecord,
} from '../utils/studentRecord';
import { splitLessons } from '../utils/lessonMerge';
import { ReflectionStep, isReflectionDone } from '../lessons/ReflectionStep';

const withId = (r: StudentRecord) => {
  r.group = '테스트중 1학년 3반';
  r.code = '10301_가나다';
  return r;
};

test('선택 버튼: 안내 문구와 버튼 4개가 보이고, 고른 버튼만 선택 표시된다', () => {
  const html = renderToStaticMarkup(<HelpSourcePicker idPrefix="l1" value="hint" onChange={() => {}} />);
  assert.ok(html.includes('도움을 받아도 혼내지 않아요. 솔직히 답변해 주세요.'));
  for (const t of ['AI의 도움을 받았어요', '힌트의 도움을 받았어요', '친구나 선생님의 도움을 받았어요', '스스로 해결했어요']) {
    assert.ok(html.includes(t), t);
  }
  assert.equal((html.match(/aria-checked="true"/g) || []).length, 1);
  assert.equal((html.match(/aria-checked="false"/g) || []).length, 3);
});

test('하나만 선택: 같은 버튼을 다시 누르면 선택이 풀린다', () => {
  assert.equal(nextHelpSource(undefined, 'ai'), 'ai');
  assert.equal(nextHelpSource('ai', 'self'), 'self');
  assert.equal(nextHelpSource('self', 'self'), '');
});

test('불러오기: 정해진 값만 남기고, 이상한 값은 미선택으로 바꾼다', () => {
  assert.equal(sanitizeHelpSource('peer'), 'peer');
  assert.equal(sanitizeHelpSource('cheat'), '');
  const r = withId(createInitialStudentState());
  (r.l2 as Record<string, unknown>).helpSource = '<script>';
  r.l3.helpSource = 'self';
  const cleaned = cleanStudentState(JSON.parse(JSON.stringify(r)));
  assert.equal(cleaned.l2.helpSource, '');
  assert.equal(cleaned.l3.helpSource, 'self');
});

test('값이 없던 기록은 불러와도 차시 JSON이 같다 (불필요한 재저장 없음)', () => {
  const r = withId(createInitialStudentState());
  r.l1.reflection1 = '소수는 약수가 2개인 수';
  const before = splitLessons(r);
  const after = splitLessons(cleanStudentState(JSON.parse(JSON.stringify(r))));
  assert.deepEqual(after, before);
  assert.ok(!after.l1.includes('helpSource'));
});

test('기기 간 합치기: 선택 값이 차시 기록과 함께 남는다', () => {
  const local = withId(createInitialStudentState());
  local.l4.helpSource = 'ai';
  local.l4.reflection1 = '소인수분해는 소수의 곱으로 나타내는 것';
  local.updatedAt = '2026-11-11T02:00:00.000Z';
  const remote = withId(createInitialStudentState());
  remote.updatedAt = '2026-11-11T01:00:00.000Z';
  assert.equal(mergeStudentStates(remote, local).l4.helpSource, 'ai');
});

test('공용 성찰 단계: 서술 칸 2개에 글자 수 표시, 도움 받은 정도 선택, 완료는 성찰 1 글자 수로만', () => {
  const html = renderToStaticMarkup(<ReflectionStep lesson={2} state={{ reflection1: '짧음' }} onChange={() => {}} />);
  assert.equal((html.match(/<textarea/g) || []).length, 2);
  assert.equal((html.match(/최소 20자/g) || []).length, 2, '서술 칸마다 글자 수 표시');
  assert.ok(html.includes('이번 차시 문제를 어떻게 해결했나요?'));
  assert.equal(isReflectionDone({ reflection1: '짧음' }), false);
  assert.equal(isReflectionDone({ reflection1: '가'.repeat(20), helpSource: '' }), true);
  assert.equal(isReflectionDone({ reflection1: '가'.repeat(20), helpSource: 'ai' }), true, '도움 받은 정도는 완료와 무관');
});
