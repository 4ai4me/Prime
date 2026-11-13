import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { Lesson1View } from './Lesson1View';
import { getCurriculumLesson } from './curriculum';
import { fullLesson1 } from './lesson1Fixture';
import type { Lesson1State } from './lesson1Logic';

const render = (step: number, state: Lesson1State = {}) =>
  renderToStaticMarkup(
    <Lesson1View
      lesson={1}
      state={state}
      step={step}
      onStepChange={() => {}}
      onUpdate={() => {}}
      onRequestConfirm={() => {}}
    />
  );

test('1차시 모든 단계가 그려지고, 서술 칸마다 글자 수 표시가 있으며 예시 답(placeholder)이 없다', () => {
  const total = getCurriculumLesson(1).stages.length;
  for (let step = 0; step < total; step++) {
    for (const state of [{}, fullLesson1()]) {
      const html = render(step, state);
      const textareas = (html.match(/<textarea/g) || []).length;
      const badges = (html.match(/최소 \d+자/g) || []).length;
      assert.equal(badges, textareas, `${step}단계: 서술 칸 ${textareas}개, 글자 수 표시 ${badges}개`);
      assert.ok(!/placeholder="/.test(html), `${step}단계에 예시 답 없음`);
      assert.ok(html.includes('이전 단계'), `${step}단계 이동 버튼`);
    }
  }
});

test('단계별 핵심 내용', () => {
  assert.ok(render(0).includes('지구가 더워지는 이유는?'));
  assert.ok(render(0).includes('16, 20의 최대공약수'));
  assert.ok(render(1).includes('6의 약수 모여라'));
  assert.ok(render(2).includes('1과 자기 자신만을 약수로 갖는 수'));
  assert.ok(!render(2).includes('l1-natural-split'), '1의 분류를 맞히기 전에는 자연수 분류 그림을 숨김');
  assert.ok(render(2, fullLesson1()).includes('l1-natural-split'));
  assert.ok(render(3).includes('2는 짝수니까 소수가 아니야'));
  assert.ok(!render(3).includes('증거:'), '합성수를 고르기 전에는 증거 칸 없음');
  assert.ok(render(3, { p1Class11: 'composite' }).includes('증거: 1과 11이 아닌'));
  assert.ok(render(4).includes('2 이상 10 이하의 자연수'));
  assert.ok(render(5).includes('이번 차시 문제를 어떻게 해결했나요?'));
  assert.ok(render(5).includes('오늘의 핵심'));
});

test('점검 통과한 문항에 확인 완료 표시', () => {
  assert.ok(render(1, fullLesson1()).includes('확인 완료'));
  assert.ok(!render(1, {}).includes('확인 완료'));
});
