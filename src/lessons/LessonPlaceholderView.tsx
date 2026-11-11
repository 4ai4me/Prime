import React from 'react';
import { BookOpen, Hourglass, Sparkles } from 'lucide-react';
import { getCurriculumLesson, getCurriculumUnit, lessonBadge, type LessonNumber } from './curriculum';

/**
 * 자료 준비 중인 차시 화면.
 * 교과서 자료가 오면 이 화면 대신 그 차시의 LessonNView가 연결됩니다 (src/lessons/index.tsx).
 * 입력 칸이 없으므로 학생 기록은 만들어지지 않습니다.
 */
export const LessonPlaceholderView: React.FC<{ lesson: LessonNumber }> = ({ lesson }) => {
  const info = getCurriculumLesson(lesson);
  const unit = getCurriculumUnit(info.unit);
  const plannedSteps = info.stages.filter((s) => s !== '성찰');
  return (
    <div data-testid={`lesson-placeholder-${lesson}`} className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-bold text-violet-700">
        <BookOpen className="h-4 w-4" />
        <span>
          중단원 {unit.num}. {unit.title} · {lessonBadge(lesson)}차시 · {info.question}
        </span>
      </div>

      <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 p-6 sm:p-8 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-violet-600 shadow-xs">
          <Hourglass className="h-6 w-6" />
        </div>
        <p className="text-base sm:text-lg font-extrabold text-slate-900">활동지를 준비하고 있어요</p>
        <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto break-keep">
          선생님이 이 차시의 탐구 활동을 곧 올려 줄 거예요. 지금은 입력할 칸이 없으니 기다려 주세요.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="text-sm font-extrabold text-slate-800">이 차시에서 할 활동</div>
        <ol className="mt-2.5 space-y-2">
          {plannedSteps.map((title, i) => (
            <li key={title} className="flex items-start gap-2.5 text-sm text-slate-700">
              <span className="mono mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-slate-100 px-1 text-[11px] font-extrabold text-slate-600">
                {i + 1}
              </span>
              <span className="break-keep">{title}</span>
            </li>
          ))}
          <li className="flex items-start gap-2.5 text-sm text-slate-700">
            <span className="mono mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-slate-100 px-1 text-[11px] font-extrabold text-slate-600">
              {plannedSteps.length + 1}
            </span>
            <span>성찰 · 이번 차시 돌아보기</span>
          </li>
        </ol>
        {info.extra && (
          <div className="mt-3.5 inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-900">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>{info.extra.label}</span>
            <span className="text-amber-700 font-semibold">· {info.extra.title}</span>
          </div>
        )}
      </div>
    </div>
  );
};
