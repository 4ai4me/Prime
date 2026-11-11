import React, { useEffect } from 'react';
import { Award, Lock, X, ArrowRight } from 'lucide-react';
import {
  EVAL_CRITERIA,
  EVAL_DESCRIPTIONS,
  EVAL_SCORE_LABELS,
  StudentRecord,
  getTeacherEvalAverage,
  getTeacherEvaluationProgress,
} from '../utils/studentRecord';
import {
  ALL_LESSON_NUMBERS,
  isLessonEnabled,
  type LessonAccessConfig,
  type LessonTabNumber,
} from '../utils/lessonAccess';

/**
 * 학생용 「평가 결과」 창: 선생님이 입력한 차시별 점수(0~3)와 피드백을 봅니다.
 * (Func의 같은 창을 단순하게 옮긴 것 — 차시 자료가 채워지면 자동 루브릭 요약을 덧붙일 수 있음)
 */
export interface StudentEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentRecord;
  lessonAccess?: LessonAccessConfig;
  onGoToLesson?: (lesson: LessonTabNumber) => void;
}

export const StudentEvaluationModal: React.FC<StudentEvaluationModalProps> = ({
  isOpen,
  onClose,
  student,
  lessonAccess,
  onGoToLesson,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const ev = student.evaluation;
  const scores = ev?.scores ?? [];
  const prog = getTeacherEvaluationProgress(student);
  const avg = getTeacherEvalAverage(scores);

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-eval-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-violet-600" />
            <h2 id="student-eval-title" className="text-lg font-extrabold text-slate-900">
              평가 결과
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                prog.status === 'complete'
                  ? 'bg-emerald-100 text-emerald-800'
                  : prog.status === 'partial'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {prog.statusLabel}
              {prog.status === 'partial' ? ` ${prog.percent}%` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {prog.status === 'none' ? (
            <p className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
              아직 선생님이 평가를 입력하지 않았습니다. 활동을 마치면 선생님이 점수와 피드백을 남겨 줄 거예요.
            </p>
          ) : (
            avg !== null && (
              <p className="text-sm text-slate-700">
                평가한 차시 평균 <strong className="text-violet-700">{avg.toFixed(1)}점</strong> / 3점
              </p>
            )
          )}

          <ul className="space-y-2.5">
            {ALL_LESSON_NUMBERS.map((n, i) => {
              const score = scores[i];
              const open = lessonAccess ? isLessonEnabled(lessonAccess, n) : true;
              return (
                <li key={n} className="rounded-xl border border-slate-200 p-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">{EVAL_CRITERIA[i]}</div>
                    <div className="text-xs text-slate-500 break-keep">{EVAL_DESCRIPTIONS[i]}</div>
                    {onGoToLesson && (
                      <button
                        type="button"
                        disabled={!open}
                        onClick={() => onGoToLesson(n)}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:underline disabled:text-slate-400 disabled:no-underline"
                      >
                        {open ? (
                          <>
                            {n}차시로 가기 <ArrowRight className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" /> 잠긴 차시
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                      typeof score === 'number' ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {typeof score === 'number' ? EVAL_SCORE_LABELS[score] : '미평가'}
                  </span>
                </li>
              );
            })}
          </ul>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">선생님 피드백</h3>
            <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700">
              {ev?.feedback?.trim() || '아직 작성된 피드백이 없습니다.'}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">다음 탐구를 위한 제안</h3>
            <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700">
              {ev?.nextStep?.trim() || '아직 작성된 제안이 없습니다.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
