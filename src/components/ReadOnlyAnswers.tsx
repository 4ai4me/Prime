/**
 * 학생 답안 읽기 전용 보기 (교사 화면의 '이전 기록'에서 사용, 2026-11-28~)
 * 평가·메모 입력 없이 차시별 답안만 보여 줍니다.
 */
import React from 'react';
import { ALL_LESSON_NUMBERS } from '../utils/lessonAccess';
import { lessonKeyOf, type StudentRecord } from '../utils/studentRecord';
import { getCurriculumLesson } from '../lessons/curriculum';
import { lessonAnswerRows } from '../lessons/answerLabels';
import { AnswerText } from './AnswerText';

export const ReadOnlyAnswers: React.FC<{ record: StudentRecord }> = ({ record }) => (
  <div className="space-y-3">
    {ALL_LESSON_NUMBERS.map((n) => {
      const key = lessonKeyOf(n);
      const { rows } = lessonAnswerRows(key, record[key]);
      const written = rows.filter((r) => r.text.trim());
      return (
        <div key={n} className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="flex items-center justify-between gap-2 text-sm font-extrabold text-slate-900">
            <span>
              {n}차시 · {getCurriculumLesson(n).shortTitle}
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              작성 {written.length}/{rows.length}
            </span>
          </div>
          {written.length > 0 ? (
            <dl className="mt-2 grid gap-2 text-xs sm:text-sm">
              {written.map((r) => (
                <div key={r.field} className="grid sm:grid-cols-[220px_1fr] gap-1 sm:gap-3">
                  <dt className="font-bold text-slate-600">{r.label}</dt>
                  <dd className="whitespace-pre-wrap text-slate-900 break-words">
                    <AnswerText value={r.text} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="mt-1 text-xs text-slate-400">작성한 답안 없음</div>
          )}
        </div>
      );
    })}
  </div>
);
