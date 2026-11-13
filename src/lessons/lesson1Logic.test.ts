import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSON1_FIELDS,
  PREP_ITEMS,
  challengeSums,
  checkChallenge,
  checkConcept,
  checkConnect,
  checkEvenTwo,
  checkMyNumber,
  checkOpen,
  checkPrep,
  checkProblem1,
  classify,
  cleanLesson1State,
  divisorsOf,
  evaluateLesson1Completion,
  isPrime,
  parseNumberList,
  patchLesson1,
  type Lesson1State,
} from './lesson1Logic';
import { LESSON_FIELD_LABELS, lessonAnswerRows } from './answerLabels';
import { fullLesson1 } from './lesson1Fixture';
import { CURRICULUM_LESSONS } from './curriculum';
import { splitLessons } from '../utils/lessonMerge';
import { cleanStudentState, createInitialStudentState } from '../utils/studentRecord';

test('수 계산: 약수·소수·분류', () => {
  assert.deepEqual(divisorsOf(16), [1, 2, 4, 8, 16]);
  assert.deepEqual([2, 9, 11, 27, 97].map(isPrime), [true, false, true, false, true]);
  assert.equal(classify(1), 'neither');
  assert.equal(classify(2), 'prime');
  assert.equal(classify(15), 'composite');
  assert.deepEqual(parseNumberList('1,2 ,5  10'), [1, 2, 5, 10]);
  assert.deepEqual(parseNumberList(''), []);
});

test('단원 열기: 6 = 2 × 3 (순서 무관), 1 × 6 은 안 됨, 결합 예 글자 수 필요', () => {
  const ex = '물은 수소와 산소가 결합해서 만들어진다';
  assert.equal(checkConnect({ connectA: '3', connectB: '2', connectExample: ex }).ok, true);
  assert.equal(checkConnect({ connectA: '1', connectB: '6', connectExample: ex }).ok, false);
  assert.equal(checkConnect({ connectA: '2', connectB: '4', connectExample: ex }).ok, false);
  assert.equal(checkConnect({ connectA: '2', connectB: '3', connectExample: '물' }).ok, false);
});

test('준비 학습: 교과서 답 통과, 순서·띄어쓰기 무관, 배수는 서로 다른 3개, 틀린 문항만 알려 줌', () => {
  const ok = fullLesson1();
  assert.equal(checkPrep(ok).ok, true);
  assert.equal(checkPrep({ ...ok, prepDiv10: '10 5 2 1', prepMul5: '25, 5, 100' }).ok, true);
  const bad = checkPrep({ ...ok, prepDiv16: '1, 2, 4, 16', prepMul12: '12, 12, 24', prepLcm1218: '216' });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.wrong, ['prepDiv16', 'prepMul12', 'prepLcm1218']);
  assert.ok(!bad.messages.join(' ').includes('36'), '정답을 알려 주지 않음');
  assert.equal(PREP_ITEMS.length, 8);
});

test('생각 열기: 6·7의 약수 카드, 7처럼 약수가 2개인 수 3개 이상', () => {
  const ok = fullLesson1();
  assert.equal(checkOpen(ok).ok, true);
  assert.equal(checkOpen({ ...ok, open6Picks: [1, 2, 3] }).ok, false);
  assert.equal(checkOpen({ ...ok, openPrimes: '2, 3' }).ok, false);
  const r = checkOpen({ ...ok, openPrimes: '2, 3, 9, 1' });
  assert.equal(r.ok, false);
  assert.ok(r.messages.join(' ').includes('9의 약수: 1, 3, 9'));
});

test('개념: 소수의 약수 2개, 1은 소수도 합성수도 아님 / 내가 고른 수 판별', () => {
  assert.equal(checkConcept({ talkDivisorCount: '2', oneClass: 'neither' }).ok, true);
  assert.equal(checkConcept({ talkDivisorCount: '2', oneClass: 'prime' }).ok, false);
  assert.equal(checkMyNumber({ myNumber: '13', myDivisors: '13, 1', myClass: 'prime' }).ok, true);
  assert.equal(checkMyNumber({ myNumber: '15', myDivisors: '1, 3, 5, 15', myClass: 'prime' }).ok, false);
  assert.equal(checkMyNumber({ myNumber: '1', myDivisors: '1', myClass: 'neither' }).ok, false, '2~100에서 고름');
});

test('문제 1: 11·19 소수, 14·27 합성수 + 1과 자기 자신이 아닌 약수 증거', () => {
  const ok = fullLesson1();
  assert.equal(checkProblem1(ok).ok, true);
  assert.equal(checkProblem1({ ...ok, p1Class27: 'prime' }).ok, false);
  assert.equal(checkProblem1({ ...ok, p1Divisor27: '27' }).ok, false);
  assert.equal(checkProblem1({ ...ok, p1Divisor14: '4' }).ok, false);
  assert.equal(checkProblem1({ ...ok, p1Divisor14: '2', p1Divisor27: '3' }).ok, true);
});

test('오개념: 2는 짝수지만 소수 — 이유 필요', () => {
  assert.equal(checkEvenTwo({ evenTwo: 'no', evenTwoReason: '2는 짝수라서 소수가 아니다' }).ok, false);
  assert.equal(checkEvenTwo({ evenTwo: 'yes', evenTwoReason: '' }).ok, false);
  assert.equal(checkEvenTwo({ evenTwo: 'yes', evenTwoReason: '2의 약수는 1과 2뿐이다' }).ok, true);
});

test('도전: 2~10에서 5개, 약수의 합이 8 더 큰 경우는 2, 3, 5, 7, 9 하나뿐', () => {
  const nums = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  const winners: number[][] = [];
  const pick = (start: number, chosen: number[]) => {
    if (chosen.length === 5) {
      if (challengeSums(chosen).diff === 8) winners.push(chosen);
      return;
    }
    for (let i = start; i < nums.length; i++) pick(i + 1, [...chosen, nums[i]]);
  };
  pick(0, []);
  assert.deepEqual(winners, [[2, 3, 5, 7, 9]]);
  const reason = '소수는 1과 자기 자신 말고 약수가 없어서 남는 3을 9로 맞췄다';
  assert.equal(checkChallenge({ chPicks: [9, 7, 5, 3, 2], chReason: reason }).ok, true);
  assert.equal(checkChallenge({ chPicks: [2, 3, 5, 7], chReason: reason }).ok, false);
  assert.equal(checkChallenge({ chPicks: [2, 3, 5, 7, 4], chReason: reason }).ok, false);
  assert.equal(checkChallenge({ chPicks: [2, 3, 5, 7, 9], chReason: '짧음' }).ok, false);
});

test('단계 완료: 단계 수 = curriculum 단계 수, 모두 맞히면 전부 완료, 빈 기록은 모두 미완료', () => {
  const stages = CURRICULUM_LESSONS[0].stages;
  assert.equal(stages.length, 6);
  assert.equal(stages[stages.length - 1], '성찰');
  assert.deepEqual(evaluateLesson1Completion(fullLesson1()), [true, true, true, true, true, true]);
  assert.deepEqual(evaluateLesson1Completion({}), [false, false, false, false, false, false]);
});

test('답을 고치면 그 문항의 ✓만 지워짐 (다른 문항 ✓는 유지)', () => {
  const s = fullLesson1();
  const next = patchLesson1(s, { p1Class11: 'composite' });
  assert.equal(next.p1Verified, false);
  assert.equal(next.openVerified, true);
  const same = patchLesson1(s, { p1Class11: 'prime' });
  assert.equal(same.p1Verified, true, '같은 값으로 다시 고르면 그대로');
});

test('불러오기 정리: 형식이 틀린 값은 버리고, 없는 칸에 빈 값을 붙이지 않음', () => {
  const dirty = cleanLesson1State({
    connectA: 2, // 숫자 → 버림 (문자열 칸)
    open6Picks: [1, 2, 'x', 2, 3.5, 6],
    oneClass: 'hacker',
    evil: '<script>',
    connectVerified: 'true',
  });
  assert.deepEqual(dirty, { open6Picks: [1, 2, 6], oneClass: '' });
  const full = fullLesson1();
  assert.deepEqual(cleanLesson1State(JSON.parse(JSON.stringify(full))), full);
  // 학생 기록 전체를 거쳐도 1차시 JSON이 같음 (불필요한 재저장 없음)
  const r = createInitialStudentState();
  r.l1 = full;
  assert.equal(splitLessons(cleanStudentState(JSON.parse(JSON.stringify(r)))).l1, splitLessons(r).l1);
});

test('교사 답안 보기: 1차시 모든 칸에 이름표, 고르기 값은 한국어로', () => {
  const labels = LESSON_FIELD_LABELS.l1;
  const missing = LESSON1_FIELDS.filter((f) => !['reflection1', 'reflection2', 'helpSource'].includes(f) && !(f in labels));
  assert.deepEqual(missing, [], '이름표 없는 칸');
  const { rows, extra } = lessonAnswerRows('l1', fullLesson1());
  assert.deepEqual(extra, []);
  const text = (f: string) => rows.find((r) => r.field === f)?.text;
  assert.equal(text('p1Class14'), '합성수');
  assert.equal(text('oneClass'), '소수도 합성수도 아님');
  assert.equal(text('chPicks'), '2, 3, 5, 7, 9');
  assert.equal(text('p1Verified'), '통과');
  assert.equal(text('evenTwo'), '소수이다');
});
