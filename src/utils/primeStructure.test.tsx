import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { CURRICULUM_LESSONS, CURRICULUM_UNITS } from '../lessons/curriculum';
import {
  ALL_LESSON_NUMBERS,
  LESSON_ACCESS_PRESETS,
  LESSON_TAB_METADATA,
  PRIME_LESSON_ACCESS_DOC,
  STORAGE_KEY_LESSON_ACCESS,
  buildLessonAccessFirestoreFields,
  createLessonAccessPreset,
  evaluateStudentLessonRenderGate,
  normalizeLessonAccess,
} from './lessonAccess';
import {
  EVAL_CRITERIA,
  LESSON_KEYS,
  STORAGE_KEY_STUDENT,
  cleanStudentState,
  createInitialStudentState,
  ensureTeacherEval,
  getTeacherEvaluationProgress,
  initialWorksheetJson,
} from './studentRecord';
import { LESSON_COLLECTION } from './lessonMerge';
import { PRIME_CLASS_LESSON_ACCESS_DOC, STORAGE_KEY_CLASS_LESSON_ACCESS } from './classLessonAccess';
import { LESSON_FIELD_LABELS, lessonAnswerRows } from '../lessons/answerLabels';
import { getLessonModule, isLessonReady, lessonProgressOf } from '../lessons';
import { LessonPlaceholderView } from '../lessons/LessonPlaceholderView';
import { buildRecordsCsv } from './teacherRecords';

test('단원 구성: 중단원 3개 · 6차시, 교과서 순서와 이름', () => {
  assert.deepEqual(
    CURRICULUM_UNITS.map((u) => u.title),
    ['소수와 합성수', '소인수분해', '최대공약수와 최소공배수']
  );
  assert.deepEqual(ALL_LESSON_NUMBERS, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(
    CURRICULUM_UNITS.flatMap((u) => u.lessons),
    [1, 2, 3, 4, 5, 6],
    '모든 차시가 정확히 한 중단원에 속함'
  );
  for (const l of CURRICULUM_LESSONS) {
    assert.ok(CURRICULUM_UNITS.find((u) => u.num === l.unit)!.lessons.includes(l.num), `${l.num}차시 중단원 일치`);
    assert.equal(l.stages[l.stages.length - 1], '성찰', `${l.num}차시 마지막 단계는 성찰`);
  }
  assert.equal(CURRICULUM_LESSONS[1].extra?.title, '어떻게 색칠하면 될까?');
  assert.equal(CURRICULUM_LESSONS[3].extra?.title, '블록 코딩으로 소인수분해 하기');
  assert.equal(LESSON_TAB_METADATA[4].fullTitle, '최대공약수 (5차시)');
  assert.equal(EVAL_CRITERIA.length, 6);
});

test('Func·Props와 저장 칸이 겹치지 않음 (학생 기록·잠금 설정 분리)', () => {
  assert.equal(LESSON_COLLECTION, 'prime_lessons');
  assert.equal(PRIME_LESSON_ACCESS_DOC, 'prime_lesson_access');
  assert.equal(PRIME_CLASS_LESSON_ACCESS_DOC, 'prime_lesson_access_classes');
  for (const k of [STORAGE_KEY_LESSON_ACCESS, STORAGE_KEY_CLASS_LESSON_ACCESS, STORAGE_KEY_STUDENT]) {
    assert.ok(k.startsWith('prime_'), k);
  }
  assert.deepEqual(LESSON_KEYS, ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']);
});

test('보안 규칙: Prime 저장 칸·잠금 문서가 들어 있고, Func·Props 규칙은 그대로', () => {
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /course == 'func_lessons' \|\| course == 'props_lessons' \|\| course == 'prime_lessons'/);
  assert.match(rules, /match \/\{path=\*\*\}\/prime_lessons\/\{docId\}/);
  assert.match(rules, /settingId == 'prime_lesson_access' &&/);
  assert.match(rules, /settingId == 'prime_lesson_access_classes' &&/);
  // 기존 규칙 유지
  assert.match(rules, /settingId == 'func_lesson_access' &&/);
  assert.match(rules, /settingId == 'func_lesson_access_classes' &&/);
  assert.match(rules, /match \/\{path=\*\*\}\/props_lessons\/\{docId\}/);
});

test('차시 잠금: 서버 칸은 l1~l6, 일괄 버튼은 1차시만 ~ 전체 열기', () => {
  const fields = buildLessonAccessFirestoreFields(createLessonAccessPreset('upTo2'), 'someone@else.com');
  assert.deepEqual(Object.keys(fields), ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'updatedBy']);
  assert.equal(fields.l2, true);
  assert.equal(fields.l3, false);
  assert.equal(fields.updatedBy, 'liha1634@gmail.com', '관리자 메일이 아니면 기본 관리자 메일');
  assert.deepEqual(
    LESSON_ACCESS_PRESETS.map((p) => p.label),
    ['1차시만 열기', '1~2차시 열기', '1~3차시 열기', '1~4차시 열기', '1~5차시 열기', '전체 열기']
  );
  const all = createLessonAccessPreset('allOpen');
  assert.ok(ALL_LESSON_NUMBERS.every((n) => all[n]));
  const none = createLessonAccessPreset('allLocked');
  assert.ok(ALL_LESSON_NUMBERS.every((n) => !none[n]));
  // 서버 문서 읽기: l칸 / 숫자 칸 모두
  const read = normalizeLessonAccess({ l1: true, l2: false, l3: true, l4: false, l5: true, l6: false });
  assert.deepEqual(ALL_LESSON_NUMBERS.map((n) => read[n]), [true, false, true, false, true, false]);
});

test('학생 화면 열기 판단: 확인 전·모두 잠김·이 차시 잠김·허용', () => {
  const upTo2 = createLessonAccessPreset('upTo2');
  assert.equal(evaluateStudentLessonRenderGate(upTo2, 1, false).reason, 'syncing');
  assert.equal(evaluateStudentLessonRenderGate(createLessonAccessPreset('allLocked'), 1, true).reason, 'all_locked');
  const locked = evaluateStudentLessonRenderGate(upTo2, 5, true);
  assert.equal(locked.reason, 'lesson_locked');
  assert.equal(locked.redirectLesson, 1);
  assert.equal(evaluateStudentLessonRenderGate(upTo2, 2, true).canRender, true);
});

test('자료 준비 중 차시: 화면에 질문·활동 계획이 보이고 입력 칸이 없음, 진행은 시작 전', () => {
  for (const l of CURRICULUM_LESSONS) {
    assert.equal(isLessonReady(l.num), false);
    const html = renderToStaticMarkup(<LessonPlaceholderView lesson={l.num} />);
    assert.ok(html.includes(l.question), `${l.num}차시 질문`);
    assert.ok(html.includes('활동지를 준비하고 있어요'));
    assert.ok(!/<(input|textarea|select)/.test(html), '입력 칸 없음');
    if (l.extra) assert.ok(html.includes(l.extra.title));
    const done = getLessonModule(l.num).evaluateCompletion({});
    assert.equal(done.length, l.stages.length);
    assert.equal(lessonProgressOf(l.num, {}, false), 'none');
  }
});

test('학생 기록: 형식이 틀린 값은 빈 기록, 모르는 칸도 보존(자료 채울 때 쓰기 위해), 너무 큰 차시는 버림', () => {
  assert.deepEqual(cleanStudentState('엉망').l1, {});
  const r = createInitialStudentState();
  (r.l3 as Record<string, unknown>).powerAnswer = '2³';
  (r.l5 as Record<string, unknown>).huge = 'x'.repeat(200000);
  const back = cleanStudentState(JSON.parse(JSON.stringify(r)));
  assert.equal((back.l3 as Record<string, unknown>).powerAnswer, '2³');
  assert.deepEqual(back.l5, {});
  // 가입 문서 worksheetJson: 규칙의 크기 제한(2자 이상) 만족, 답안은 넣지 않음
  const ws = initialWorksheetJson(r);
  assert.ok(ws.length >= 2 && ws.length < 300);
});

test('교사 평가 진행: 6개 차시 점수 + 피드백이 모두 있어야 완료', () => {
  const r = createInitialStudentState();
  assert.equal(getTeacherEvaluationProgress(r).status, 'none');
  const ev = ensureTeacherEval(r);
  assert.equal(ev.scores.length, 6);
  ev.scores[0] = 3;
  assert.equal(getTeacherEvaluationProgress(r).status, 'partial');
  ev.scores = [3, 2, 1, 0, 3, 2];
  assert.equal(getTeacherEvaluationProgress(r).status, 'partial', '피드백이 없으면 진행 중');
  ev.feedback = '잘했어요';
  assert.equal(getTeacherEvaluationProgress(r).status, 'complete');
});

test('교사 답안 보기·CSV: 공통 성찰 칸 이름표, 이름표 없는 칸은 기타 기록, 수식 실행 막기', () => {
  for (const k of LESSON_KEYS) assert.ok(LESSON_FIELD_LABELS[k], k);
  const { rows, extra } = lessonAnswerRows('l2', { reflection1: '에라토스테네스의 체', helpSource: 'peer', mystery: '7' });
  assert.equal(rows.find((r) => r.field === 'reflection1')?.text, '에라토스테네스의 체');
  assert.equal(rows.find((r) => r.field === 'helpSource')?.text, '친구나 선생님의 도움을 받았어요');
  assert.deepEqual(extra.map((r) => r.field), ['mystery']);

  const r = createInitialStudentState();
  r.group = '테스트중 1학년 1반';
  r.code = '10101_가나다';
  r.l1.reflection1 = '=1+1';
  const csv = buildRecordsCsv([r]);
  assert.ok(csv.startsWith('﻿'));
  const [header, row] = csv.slice(1).split('\r\n');
  assert.ok(header.includes('"1차시 진행"') && header.includes('"6차시 성찰 1 · 이번 차시에서 알게 된 것"'));
  assert.ok(row.includes(`"'=1+1"`), '엑셀 수식으로 실행되지 않게 앞에 따옴표');
  assert.ok(row.includes('"진행 중"'), '내용이 있는 차시는 진행 중');
});
