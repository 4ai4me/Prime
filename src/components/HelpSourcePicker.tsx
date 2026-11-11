import React from 'react';
import { Bot, Dumbbell, Lightbulb, Users } from 'lucide-react';
import { HELP_SOURCE_OPTIONS, HelpSource } from '../utils/mathLogic';

/**
 * 성찰 단계: 이번 차시를 어떻게 해결했는지 하나 고르기 (모든 차시 공용 — 각 차시 helpSource 칸, src/lessons/ReflectionStep.tsx).
 * 선택지: AI · 힌트 · 친구나 선생님(2026-11-06 추가) · 스스로
 * 같은 버튼을 다시 누르면 선택이 풀린다(잘못 누른 것을 되돌릴 수 있게).
 * 완료 조건·평가에는 쓰지 않는다.
 */

const ICONS = { ai: Bot, hint: Lightbulb, peer: Users, self: Dumbbell } as const;

const SELECTED_CLASS = {
  ai: 'border-violet-500 bg-violet-600 text-white shadow-sm',
  hint: 'border-amber-500 bg-amber-500 text-white shadow-sm',
  peer: 'border-sky-500 bg-sky-600 text-white shadow-sm',
  self: 'border-emerald-500 bg-emerald-600 text-white shadow-sm',
} as const;

export interface HelpSourcePickerProps {
  value: HelpSource | undefined;
  onChange: (next: HelpSource) => void;
  /** 접근성용 고유 id 앞부분 (차시마다 다르게) */
  idPrefix: string;
}

/** 버튼을 눌렀을 때의 다음 값: 같은 것을 다시 누르면 선택 해제 */
export function nextHelpSource(current: HelpSource | undefined, clicked: Exclude<HelpSource, ''>): HelpSource {
  return current === clicked ? '' : clicked;
}

export const HelpSourcePicker: React.FC<HelpSourcePickerProps> = ({ value, onChange, idPrefix }) => {
  const titleId = `${idPrefix}-help-title`;
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 space-y-3">
      <div>
        <p id={titleId} className="text-sm sm:text-base font-extrabold text-slate-900">
          이번 차시 문제를 어떻게 해결했나요?
        </p>
        <p className="mt-0.5 text-xs sm:text-sm font-semibold text-sky-800">
          도움을 받아도 혼내지 않아요. 솔직히 답변해 주세요.
        </p>
      </div>
      <div role="radiogroup" aria-labelledby={titleId} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {HELP_SOURCE_OPTIONS.map(({ value: v, label }) => {
          const selected = value === v;
          const Icon = ICONS[v];
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(nextHelpSource(value, v))}
              className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors ${
                selected ? SELECTED_CLASS[v] : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
