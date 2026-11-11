import { ALL_LESSON_NUMBERS, type LessonTabNumber } from './lessonAccess';
import {
  EVAL_CRITERIA,
  StudentRecord,
  csvSafe,
  ensureTeacherEval,
  getTeacherEvaluationProgress,
  lessonHasContent,
  lessonKeyOf,
} from './studentRecord';
import { LESSON_PROGRESS_LABEL, lessonProgressOf, type LessonProgress } from '../lessons';
import { fieldLabelsOf, lessonAnswerRows } from '../lessons/answerLabels';

/**
 * 교사 화면 학생 기록 표의 순수 계산 (Firebase에 의존하지 않음 — 단위 테스트 대상)
 */

export const LESSON_CHIP_CLASS: Record<LessonProgress, string> = {
  done: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  progress: 'border-amber-200 bg-amber-50 text-amber-800',
  none: 'border-slate-200 bg-slate-50 text-slate-500',
};

/** 학생 기록 → 차시 진행 상태 */
export function recordLessonProgress(x: StudentRecord, n: LessonTabNumber): LessonProgress {
  const state = x[lessonKeyOf(n)];
  return lessonProgressOf(n, state, lessonHasContent(state));
}

/** 교사 화면 기록 표의 CSV (차시별 모든 문항 + 평가) */
export function buildRecordsCsv(records: StudentRecord[]): string {
  const answerCols: { header: string; value: (x: StudentRecord) => string }[] = [];
  for (const n of ALL_LESSON_NUMBERS) {
    const key = lessonKeyOf(n);
    for (const [field, label] of Object.entries(fieldLabelsOf(key))) {
      answerCols.push({
        header: `${n}차시 ${label}`,
        value: (x) => lessonAnswerRows(key, x[key]).rows.find((r) => r.field === field)?.text ?? '',
      });
    }
    answerCols.push({
      header: `${n}차시 기타 기록`,
      value: (x) =>
        lessonAnswerRows(key, x[key])
          .extra.map((r) => `${r.label}: ${r.text}`)
          .join(' / '),
    });
  }
  const headers = [
    '학급',
    '식별코드',
    '수정 시각',
    ...ALL_LESSON_NUMBERS.map((n) => `${n}차시 진행`),
    ...answerCols.map((c) => c.header),
    '교사 메모',
    '교사 평가 상태',
    '교사 평가 진행율(%)',
    ...EVAL_CRITERIA.map((t) => `교사 평정_${t}`),
    '학생 피드백',
    '다음 탐구 제안',
  ];
  const rows = records.map((orig) => {
    const x = { ...orig, evaluation: orig.evaluation ? { ...orig.evaluation, scores: [...orig.evaluation.scores] } : undefined };
    const ev = ensureTeacherEval(x);
    const prog = getTeacherEvaluationProgress(x);
    return [
      x.group,
      x.code,
      x.updatedAt,
      ...ALL_LESSON_NUMBERS.map((n) => LESSON_PROGRESS_LABEL[recordLessonProgress(x, n)]),
      ...answerCols.map((c) => c.value(x)),
      x.teacherMemo || '',
      prog.statusLabel,
      prog.percent,
      ...ev.scores.slice(0, EVAL_CRITERIA.length).map((v) => (v === null ? '' : v)),
      ev.feedback,
      ev.nextStep,
    ];
  });
  return '﻿' + [headers, ...rows].map((r) => r.map(csvSafe).join(',')).join('\r\n');
}

