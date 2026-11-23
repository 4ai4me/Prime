import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import * as L2 from './lesson2Logic';
import { Lesson2View } from './Lesson2View';
import { getCurriculumLesson } from './curriculum';
import { LESSON_FIELD_LABELS, lessonAnswerRows } from './answerLabels';
import { splitLessons } from '../utils/lessonMerge';
import { cleanStudentState, createInitialStudentState } from '../utils/studentRecord';
import { isLessonReady } from './index';

/** 체를 안내대로 끝까지 돌리기 (마지막에 '남은 수에 모두 ○') */
function runSieve(): { circled: number[]; crossed: number[]; clicks: number } {
  let c: number[] = [];
  let x: number[] = [];
  let clicks = 0;
  for (let guard = 0; guard < 200; guard++) {
    const next = L2.sieveNext(c, x);
    if (next.kind === 'done') break;
    if (next.kind === 'erase1') ({ circled: c, crossed: x } = L2.sieveClick(c, x, 1));
    else if (next.kind === 'eraseMultiples') ({ circled: c, crossed: x } = L2.sieveEraseMultiples(c, x));
    else if (next.canFinish) ({ circled: c, crossed: x } = L2.sieveFinish(c, x));
    else ({ circled: c, crossed: x } = L2.sieveClick(c, x, next.n));
    clicks++;
  }
  return { circled: c, crossed: x, clicks };
}

export function fullLesson2(): L2.Lesson2State {
  const { circled, crossed } = runSieve();
  return {
    sieveCircled: circled, sieveCrossed: crossed, sieveVerified: true,
    sieveReason: '2의 배수는 2를 약수로 가지므로 합성수이기 때문이다', sieveStop: '7',
    sievePrimes: '2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47', sieveQVerified: true,
    p2Picks: [53, 59, 61, 67, 71, 73, 79, 83, 89, 97], p2Verified: true,
    rvBlank1: 'prime', rvBlank2: 'composite',
    rv1_1: 'neither', rv1_12: 'composite', rv1_23: 'prime', rv1_41: 'prime', rv1_57: 'composite', rv1_74: 'composite', rv1Verified: true,
    rvOx1: 'o', rvOx2: 'x', rvOx3: 'x', rvOx4: 'o', rvOxVerified: true,
    rv3Picks: [17, 11], rv3Verified: true,
    mer2: 'prime', mer3: 'prime', mer4: 'composite', mer5: 'prime', mer6: 'composite', mer7: 'prime', merVerified: true,
    reflection1: '에라토스테네스의 체로 소수를 빠르게 찾을 수 있다는 것을 알았다',
  };
}

test('에라토스테네스의 체: 1 지우기 → 2·3·5·7 ○와 배수 지우기 → 남은 수 모두 ○ = 50까지의 소수 15개', () => {
  assert.deepEqual(L2.PRIMES_TO_50, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]);
  const { circled, crossed } = runSieve();
  assert.deepEqual([...circled].sort((a, b) => a - b), L2.PRIMES_TO_50);
  assert.equal(circled.length + crossed.length, 50);
  assert.equal(L2.checkSieve({ sieveCircled: circled, sieveCrossed: crossed }).ok, true);
});

test('체 순서 지키기: 1 먼저, 배수 지우기 전에 다음 수 안 됨, 가장 작은 남은 수만 ○, 7 다음부터 끝내기 가능', () => {
  assert.ok(L2.sieveClick([], [], 2).message?.includes('1을 지워요'));
  let s = L2.sieveClick([], [], 1);
  assert.deepEqual(s.crossed, [1]);
  assert.ok(L2.sieveClick(s.circled, s.crossed, 3).message?.includes('처음 수'));
  s = L2.sieveClick(s.circled, s.crossed, 2);
  assert.deepEqual(s.circled, [2]);
  const next = L2.sieveNext(s.circled, s.crossed);
  assert.equal(next.kind, 'eraseMultiples');
  assert.ok(L2.sieveClick(s.circled, s.crossed, 3).message?.includes('2의 배수'));
  s = L2.sieveEraseMultiples(s.circled, s.crossed);
  assert.equal(s.crossed.length, 1 + 24, '4, 6, …, 50');
  assert.equal(L2.sieveFinish(s.circled, s.crossed).circled.length, 1, '3에서는 아직 끝낼 수 없음');
  // 7까지 진행
  for (const p of [3, 5, 7]) {
    s = L2.sieveClick(s.circled, s.crossed, p);
    s = L2.sieveEraseMultiples(s.circled, s.crossed);
  }
  const n = L2.sieveNext(s.circled, s.crossed);
  assert.deepEqual(n, { kind: 'circle', n: 11, canFinish: true });
});

test('2차시 점검: 모두 통과·완료, 오답 안내', () => {
  const s = fullLesson2();
  for (const f of [L2.checkSieve, L2.checkSieveQuestions, L2.checkProblem2, L2.checkReview1, L2.checkReviewOx, L2.checkReview3, L2.checkMersenne]) {
    assert.equal(f(s).ok, true, f.name + ' ' + f(s).messages.join());
  }
  assert.equal(getCurriculumLesson(2).stages.length, 5);
  assert.deepEqual(L2.evaluateLesson2Completion(s), [true, true, true, true, true]);
  assert.ok(L2.evaluateLesson2Completion({}).every((x) => !x));
  assert.equal(isLessonReady(2), true);
  assert.equal(L2.checkSieveQuestions({ ...s, sieveStop: '11' }).ok, false);
  const p2 = L2.checkProblem2({ ...s, p2Picks: [51, 53, 59, 61, 67, 71, 73, 79, 83, 89] });
  assert.equal(p2.ok, false);
  assert.ok(p2.messages[0].includes('51') && p2.messages[1].includes('1개'));
  assert.ok(!p2.messages.join('').includes('97'), '빠진 소수를 알려 주지 않음');
  assert.equal(L2.checkReview1({ ...s, rv1_57: 'prime' }).ok, false);
  assert.equal(L2.checkReviewOx({ ...s, rvOx2: 'o' }).ok, false);
  assert.equal(L2.checkReview3({ ...s, rv3Picks: [17] }).ok, false);
  assert.equal(L2.checkMersenne({ ...s, mer6: 'prime' }).ok, false);
});

test('2차시 이름표·정리·화면', () => {
  const full = fullLesson2();
  const labels = LESSON_FIELD_LABELS.l2;
  const missing = Object.keys(L2.LESSON2_SPEC).filter((f) => !['reflection1', 'reflection2', 'helpSource'].includes(f) && !(f in labels));
  assert.deepEqual(missing, []);
  const { rows, extra } = lessonAnswerRows('l2', full);
  assert.deepEqual(extra, []);
  const t = (f: string) => rows.find((r) => r.field === f)?.text;
  assert.equal(t('rvBlank1'), '소수');
  assert.equal(t('rvOx2'), '×');
  assert.equal(t('sieveStop'), '7의 배수');
  assert.equal(t('mer4'), '합성수');
  const r = createInitialStudentState();
  r.l2 = full;
  assert.equal(splitLessons(cleanStudentState(JSON.parse(JSON.stringify(r)))).l2, splitLessons(r).l2);
  const total = getCurriculumLesson(2).stages.length;
  for (let step = 0; step < total; step++) {
    for (const state of [{}, full]) {
      const html = renderToStaticMarkup(<Lesson2View lesson={2} state={state} step={step} onStepChange={() => {}} onUpdate={() => {}} onRequestConfirm={() => {}} />);
      assert.equal((html.match(/최소 \d+자/g) || []).length, (html.match(/<textarea/g) || []).length, `${step}단계`);
      assert.ok(!/placeholder="/.test(html));
    }
  }
  const board = renderToStaticMarkup(<Lesson2View lesson={2} state={{}} step={0} onStepChange={() => {}} onUpdate={() => {}} onRequestConfirm={() => {}} />);
  assert.equal((board.match(/aria-label="\d+"/g) || []).length, 50, '1~50 칸');
});
