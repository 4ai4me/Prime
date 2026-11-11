import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeacherSaveBar, serializeRuns, teacherSaveBarView } from './TeacherSaveBar';

test('저장 표시: 상태마다 문구와 버튼 사용 가능 여부가 맞다', () => {
  assert.deepEqual(
    [teacherSaveBarView(undefined, true).label, teacherSaveBarView(undefined, true).buttonDisabled],
    ['변경 사항 없음', true]
  );
  const dirty = teacherSaveBarView({ state: 'dirty' }, true);
  assert.equal(dirty.label, '저장되지 않은 변경 있음');
  assert.equal(dirty.buttonDisabled, false);

  const saving = teacherSaveBarView({ state: 'saving' }, true);
  assert.equal(saving.label, '저장 중…');
  assert.equal(saving.buttonDisabled, true);

  const saved = teacherSaveBarView({ state: 'saved', savedAt: new Date(2026, 10, 4, 10, 31).getTime() }, true);
  assert.match(saved.label, /^저장됨 \(.*10:31\)$/);
  assert.equal(saved.buttonDisabled, true);

  const error = teacherSaveBarView({ state: 'error', savedAt: 1 }, true);
  assert.match(error.label, /저장 실패/);
  assert.match(error.label, /입력한 글은 그대로/);
  assert.equal(error.buttonDisabled, false);
  assert.equal(error.buttonText, '다시 저장');
});

test('저장 표시: 서버 명단에 없는 학생은 저장 버튼을 쓸 수 없다', () => {
  const v = teacherSaveBarView({ state: 'dirty' }, false);
  assert.equal(v.buttonDisabled, true);
  assert.match(v.label, /이 기기에만/);
});

test('저장 버튼 화면: 변경이 있을 때만 누를 수 있다', () => {
  const dirty = renderToStaticMarkup(<TeacherSaveBar status={{ state: 'dirty' }} onServer onSave={() => {}} />);
  assert.ok(dirty.includes('저장') && !dirty.includes('disabled=""'));
  const idle = renderToStaticMarkup(<TeacherSaveBar status={undefined} onServer onSave={() => {}} />);
  assert.ok(idle.includes('disabled=""'));
});

test('serializeRuns: 실행 중 여러 번 불러도 겹치지 않고, 끝난 뒤 한 번만 더 실행한다', async () => {
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  let release: () => void = () => {};
  const run = serializeRuns(async () => {
    calls += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    if (calls === 1) await new Promise<void>((r) => (release = r));
    active -= 1;
  });
  const first = run();
  const second = run();
  const third = run();
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second, third]);
  assert.equal(calls, 2, '실행 중 들어온 요청 여러 개는 한 번으로 합쳐진다');
  assert.equal(maxActive, 1, '동시에 두 개가 실행되지 않는다');

  await run();
  assert.equal(calls, 3, '끝난 뒤 부르면 다시 실행된다');
});
