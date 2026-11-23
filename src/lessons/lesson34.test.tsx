import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { getCurriculumLesson } from './curriculum';
import { fullLesson3, fullLesson4 } from './lesson34Fixture';
import * as L3 from './lesson3Logic';
import * as L4 from './lesson4Logic';
import { Lesson3View } from './Lesson3View';
import { Lesson4View } from './Lesson4View';
import { LESSON_FIELD_LABELS, lessonAnswerRows } from './answerLabels';
import { splitLessons } from '../utils/lessonMerge';
import { cleanStudentState, createInitialStudentState } from '../utils/studentRecord';
import { isLessonReady } from './index';

test('3차시: 모든 점검 통과·완료, 빈 기록은 미완료, 단계 수 = curriculum', () => {
  const s = fullLesson3();
  for (const f of [L3.checkOpen3, L3.checkConcept3, L3.checkProblem3, L3.checkMisconception3, L3.checkChallenge3]) {
    assert.equal(f(s).ok, true, f.name + ' ' + f(s).messages.join());
  }
  assert.equal(getCurriculumLesson(3).stages.length, 6);
  assert.deepEqual(L3.evaluateLesson3Completion(s), [true, true, true, true, true, true]);
  assert.ok(L3.evaluateLesson3Completion({}).every((x) => !x));
  assert.equal(isLessonReady(3), true);
});

test('3차시 오답 안내', () => {
  const s = fullLesson3();
  assert.equal(L3.checkOpen3({ ...s, microDay4: '10' }).ok, false);
  assert.equal(L3.checkOpen3({ ...s, microExpr: '2×5' }).ok, false);
  assert.equal(L3.checkOpen3({ ...s, microExpr: '2⁵' }).ok, true, '거듭제곱으로 써도 정답');
  assert.equal(L3.checkConcept3({ ...s, read23: 'square3' }).ok, false);
  const p = L3.checkProblem3({ ...s, p1a: '2⁶', c1b: '5²×2³' });
  assert.equal(p.ok, false);
  assert.ok(p.messages.some((m) => m.startsWith('문제 1-(1)')) && p.messages.some((m) => m.startsWith('확인 1-(2)')));
  assert.equal(L3.checkMisconception3({ ...s, mis33: '9' }).ok, false);
  assert.equal(L3.firstDayOver(1000), 10);
  assert.equal(L3.checkChallenge3({ ...s, chDay: '9' }).ok, false);
  assert.equal(L3.checkChallenge3({ ...s, chExpr: '1024' }).ok, false, '거듭제곱으로 써야 함');
});

test('4차시: 모든 점검 통과·완료, 단계 수 = curriculum', () => {
  const s = fullLesson4();
  const checks = [
    L4.checkOpen4, L4.checkProblem2, L4.checkTree, L4.checkExample1, L4.checkProblem3, L4.checkTable75, L4.checkTalk4,
    L4.checkProblem4, L4.checkCount40, L4.checkCoding, L4.checkReviewConcept, L4.checkReview23, L4.checkReview5, L4.checkReview4,
  ];
  for (const f of checks) assert.equal(f(s).ok, true, f.name + ' ' + f(s).messages.join());
  assert.equal(getCurriculumLesson(4).stages.length, 7);
  assert.deepEqual(L4.evaluateLesson4Completion(s), [true, true, true, true, true, true, true]);
  assert.ok(L4.evaluateLesson4Completion({}).every((x) => !x));
});

test('4차시: 소인수 나무·사다리', () => {
  assert.deepEqual(L4.treeState(24, [2, 2, 2]), { remaining: 3, done: true, valid: true });
  assert.deepEqual(L4.treeState(24, [2, 2]), { remaining: 6, done: false, valid: true });
  assert.equal(L4.treeState(24, [5]).valid, false);
  assert.equal(L4.checkTree({ ...fullLesson4(), tree2: [2, 2, 2] }).ok, false, '순서 2는 3으로 시작');
  assert.equal(L4.checkTree({ ...fullLesson4(), treeSame: 'diff' }).ok, false);
  assert.deepEqual(L4.ladderState(90, [2, 3, 3]).quotients, [45, 15, 5]);
  assert.equal(L4.ladderState(90, [2, 3, 3]).done, true);
  assert.equal(L4.checkExample1({ ladder90: [2, 3], result90: '2×3²×5' }).ok, false);
});

test('4차시 오답 안내', () => {
  const s = fullLesson4();
  const p2 = L4.checkProblem2({ ...s, p2_42: '2, 6, 7', p2_80: '2' });
  assert.equal(p2.ok, false);
  assert.ok(p2.messages.join(' ').includes('6은(는) 42의 소인수가 아니에요'));
  assert.ok(p2.messages.join(' ').includes('80: 빠진 소인수'));
  assert.equal(L4.checkProblem3({ ...s, p3_150: '2×3×5×5' }).ok, false);
  assert.equal(L4.checkTable75({ ...s, t75f: '50' }).ok, false);
  assert.equal(L4.checkTalk4({ ...s, talkAlways: 'yes' }).ok, false);
  assert.equal(L4.checkProblem4({ ...s, p4a: '1, 2, 4, 5, 10, 25, 50, 100' }).ok, false);
  assert.equal(L4.checkCount40({ ...s, cnt40: '6' }).ok, false);
  assert.equal(L4.checkCoding({ ...s, code5239: '13×13×31' }).ok, false);
  assert.equal(L4.checkCoding({ ...s, codeNum: '5239', codeResult: '13²×31' }).ok, false, '다른 수를 골라야 함');
  assert.equal(L4.checkCoding({ ...s, codeNum: '17986', codeResult: '2×17×23²' }).ok, true);
  assert.equal(L4.checkReview5({ ...s, rv5Picks: ['3^2', '2^3'] }).ok, false);
  assert.equal(L4.checkReview4({ ...s, rv4Answer: '14' }).ok, false);
  assert.equal(L4.checkReviewConcept({ ...s, rvBlank3: 'divisor' }).ok, false);
});

test('불러오기 정리·이름표: 3·4차시 모든 칸에 이름표, 정리 전후 JSON 같음', () => {
  for (const [key, spec, full] of [
    ['l3', L3.LESSON3_SPEC, fullLesson3()],
    ['l4', L4.LESSON4_SPEC, fullLesson4()],
  ] as const) {
    const labels = LESSON_FIELD_LABELS[key];
    const missing = Object.keys(spec).filter((f) => !['reflection1', 'reflection2', 'helpSource'].includes(f) && !(f in labels));
    assert.deepEqual(missing, [], `${key} 이름표 없는 칸`);
    const { extra } = lessonAnswerRows(key, full);
    assert.deepEqual(extra, []);
    const r = createInitialStudentState();
    (r as unknown as Record<string, unknown>)[key] = full;
    assert.equal(splitLessons(cleanStudentState(JSON.parse(JSON.stringify(r))))[key], splitLessons(r)[key]);
  }
  assert.deepEqual(L4.cleanLesson4State({ tree1: [2, 'x'], evil: 1, treeSame: 'hm' }), { tree1: [2], treeSame: '' });
  const rows = lessonAnswerRows('l4', fullLesson4()).rows;
  assert.equal(rows.find((r) => r.field === 'rv5Picks')?.text, '3², 2² × 3²');
  assert.equal(rows.find((r) => r.field === 'rvBlank3')?.text, '소인수');
  assert.equal(lessonAnswerRows('l3', fullLesson3()).rows.find((r) => r.field === 'misBigger')?.text, '3²이 더 크다');
});

test('3·4차시 모든 단계 그리기: 서술 칸마다 글자 수 표시, 예시 답 없음', () => {
  const views = [
    [Lesson3View, 3, fullLesson3()],
    [Lesson4View, 4, fullLesson4()],
  ] as const;
  for (const [View, n, full] of views) {
    const total = getCurriculumLesson(n).stages.length;
    for (let step = 0; step < total; step++) {
      for (const state of [{}, full]) {
        const html = renderToStaticMarkup(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <View lesson={n} state={state as any} step={step} onStepChange={() => {}} onUpdate={() => {}} onRequestConfirm={() => {}} />
        );
        const textareas = (html.match(/<textarea/g) || []).length;
        const badges = (html.match(/최소 \d+자/g) || []).length;
        assert.equal(badges, textareas, `${n}차시 ${step}단계`);
        assert.ok(!/placeholder="/.test(html), `${n}차시 ${step}단계 예시 답 없음`);
      }
    }
  }
  const coding = renderToStaticMarkup(
    <Lesson4View lesson={4} state={{}} step={4} onStepChange={() => {}} onUpdate={() => {}} onRequestConfirm={() => {}} />
  );
  assert.ok(coding.includes('href="https://playentry.org/ws/663a43493698b7f47bd2e1b9'), '엔트리 연결');
  assert.ok(coding.includes('rel="noopener noreferrer"'));
});
