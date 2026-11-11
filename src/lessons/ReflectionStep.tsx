import React from 'react';
import { CharCountBadge, getCharCountBorderClass } from '../components/CharCountBadge';
import { HelpSourcePicker } from '../components/HelpSourcePicker';
import { REFLECTION_MIN_CHARS, type LessonCommonState } from '../utils/studentRecord';
import { COMMON_FIELD_LABELS } from './answerLabels';

/**
 * 모든 차시의 마지막 단계 '성찰' (공용)
 * - 성찰 1·2 서술 칸 + 글자 수 표시(최소 REFLECTION_MIN_CHARS자)
 * - '이번 차시 문제를 어떻게 해결했나요?' 선택 (완료 조건·평가에는 쓰지 않음)
 * 차시 자료를 채울 때 마지막 단계에 <ReflectionStep … />을 넣으면 됩니다.
 */
export function isReflectionDone(state: LessonCommonState): boolean {
  return (state.reflection1 ?? '').trim().length >= REFLECTION_MIN_CHARS;
}

export const ReflectionStep: React.FC<{
  lesson: number;
  state: LessonCommonState;
  onChange: (patch: Partial<LessonCommonState>) => void;
}> = ({ lesson, state, onChange }) => {
  const fields: Array<{ key: 'reflection1' | 'reflection2'; prompt: string }> = [
    { key: 'reflection1', prompt: '이번 차시에서 새롭게 알게 된 것을 자신의 말로 정리해 보세요.' },
    { key: 'reflection2', prompt: '더 궁금한 점이나 어려웠던 점을 적어 보세요.' },
  ];
  return (
    <div className="space-y-5">
      {fields.map(({ key, prompt }) => {
        const value = state[key] ?? '';
        const len = value.trim().length;
        const id = `l${lesson}-${key}`;
        return (
          <div key={key} className="space-y-2">
            <label htmlFor={id} className="block text-sm font-extrabold text-slate-900">
              {COMMON_FIELD_LABELS[key]}
            </label>
            <p className="text-xs text-slate-600">{prompt}</p>
            <textarea
              id={id}
              value={value}
              onChange={(e) => onChange({ [key]: e.target.value.slice(0, 2000) })}
              rows={4}
              className={`w-full rounded-xl border bg-white px-3.5 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 ${getCharCountBorderClass(len, REFLECTION_MIN_CHARS)}`}
            />
            <CharCountBadge text={value} min={REFLECTION_MIN_CHARS} />
          </div>
        );
      })}
      <HelpSourcePicker
        idPrefix={`l${lesson}`}
        value={state.helpSource}
        onChange={(next) => onChange({ helpSource: next })}
      />
    </div>
  );
};
