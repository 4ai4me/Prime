import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Lightbulb, ClipboardCheck } from 'lucide-react';
import { CharCountBadge, getCharCountBorderClass } from '../components/CharCountBadge';

/**
 * 차시 화면 공용 부품 (모든 차시가 같은 모양을 쓰도록)
 * - Section: 활동 상자 / HintToggle: 💡 힌트 보기 / CheckBar: [점검] 버튼과 결과
 * - TextAnswer: 서술 칸(글자 수 표시 필수) / ShortInput: 짧은 답 칸 / ChoiceGroup: 하나 고르기
 * - NumberCards: 숫자 카드 고르기 / StepFooter: 이전·다음 단계
 */

export const Section: React.FC<{
  badge: string;
  title: React.ReactNode;
  tone?: 'violet' | 'amber' | 'sky' | 'emerald' | 'rose';
  children: React.ReactNode;
  testId?: string;
}> = ({ badge, title, tone = 'violet', children, testId }) => {
  const toneClass = {
    violet: 'bg-violet-100 text-violet-800',
    amber: 'bg-amber-100 text-amber-800',
    sky: 'bg-sky-100 text-sky-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    rose: 'bg-rose-100 text-rose-800',
  }[tone];
  return (
    <section data-testid={testId} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
      <div className="flex items-start gap-2.5 flex-wrap">
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-extrabold ${toneClass}`}>{badge}</span>
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 break-keep leading-snug">{title}</h3>
      </div>
      {children}
    </section>
  );
};

export const HintToggle: React.FC<{ label?: string; children: React.ReactNode }> = ({ label = '힌트 보기', children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
      >
        <Lightbulb className="h-3.5 w-3.5" />
        💡 {open ? '힌트 닫기' : label}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-3 text-sm text-amber-950 leading-relaxed break-keep">
          {children}
        </div>
      )}
    </div>
  );
};

export interface CheckOutcome {
  ok: boolean;
  messages: string[];
}

/** [점검] 버튼: 누르면 onCheck 결과를 보여 주고, 맞으면 ✓ 표시 */
export const CheckBar: React.FC<{
  verified: boolean | undefined;
  onCheck: () => CheckOutcome;
  label?: string;
  testId?: string;
}> = ({ verified, onCheck, label = '점검', testId }) => {
  const [result, setResult] = useState<CheckOutcome | null>(null);
  // 답을 고쳐 ✓가 지워지면 예전 '맞아요' 안내도 지움
  const shown = result && result.ok && !verified ? null : result;
  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setResult(onCheck())}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-violet-700"
        >
          <ClipboardCheck className="h-4 w-4" />
          {label}
        </button>
        {verified && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> 확인 완료
          </span>
        )}
      </div>
      {shown && (
        <div
          role="status"
          className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed break-keep ${
            shown.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-950'
          }`}
        >
          {shown.messages.map((m, i) => (
            <p key={i} className="flex items-start gap-1.5">
              {shown.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              )}
              <span>{m}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

/** 서술 칸 — 글자 수 표시(CharCountBadge)와 테두리 색을 항상 붙임 */
export const TextAnswer: React.FC<{
  id: string;
  label: React.ReactNode;
  value: string | undefined;
  min: number;
  rows?: number;
  onChange: (v: string) => void;
}> = ({ id, label, value, min, rows = 3, onChange }) => {
  const text = value ?? '';
  const len = text.trim().length;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-slate-800 break-keep">
        {label}
      </label>
      <textarea
        id={id}
        value={text}
        rows={rows}
        onChange={(e) => onChange(e.target.value.slice(0, 2000))}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 ${getCharCountBorderClass(len, min)}`}
      />
      <CharCountBadge text={text} min={min} />
    </div>
  );
};

/** 짧은 답 칸 (숫자·수 목록) */
export const ShortInput: React.FC<{
  id: string;
  label?: React.ReactNode;
  value: string | undefined;
  onChange: (v: string) => void;
  width?: 'xs' | 'sm' | 'md' | 'full';
  inputMode?: 'numeric' | 'text';
  ariaLabel?: string;
  status?: 'ok' | 'bad' | null;
}> = ({ id, label, value, onChange, width = 'sm', inputMode = 'text', ariaLabel, status = null }) => {
  const w = { xs: 'w-16', sm: 'w-28', md: 'w-full sm:w-64', full: 'w-full' }[width];
  return (
    <span className="inline-flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-bold text-slate-800">
          {label}
        </label>
      )}
      <input
        id={id}
        value={value ?? ''}
        aria-label={ariaLabel}
        inputMode={inputMode}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value.slice(0, 200))}
        className={`${w} rounded-lg border bg-white px-3 py-2 text-base mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 ${
          status === 'bad' ? 'border-amber-400' : status === 'ok' ? 'border-emerald-400' : 'border-slate-300 focus:border-violet-500'
        }`}
      />
    </span>
  );
};

/** 하나 고르기 (같은 것을 다시 누르면 선택 해제) */
export function ChoiceGroup<T extends string>({
  name,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  name: string;
  value: T | '' | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T | '') => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5" data-name={name}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? '' : o.value)}
            className={`min-h-[38px] rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors ${
              on ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** 숫자 카드 여러 개 고르기 */
export const NumberCards: React.FC<{
  numbers: readonly number[];
  picked: number[] | undefined;
  onToggle: (n: number) => void;
  ariaLabel: string;
  max?: number;
}> = ({ numbers, picked, onToggle, ariaLabel, max }) => {
  const set = new Set(picked ?? []);
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {numbers.map((n) => {
        const on = set.has(n);
        const disabled = !on && max !== undefined && set.size >= max;
        return (
          <button
            key={n}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(n)}
            className={`h-12 w-12 rounded-xl border-2 text-lg font-extrabold mono transition-all ${
              on
                ? 'border-violet-600 bg-violet-600 text-white shadow-sm scale-105'
                : 'border-slate-300 bg-white text-slate-800 hover:border-violet-400 disabled:opacity-40'
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
};

export function toggleNumber(list: number[] | undefined, n: number): number[] {
  const cur = list ?? [];
  return cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b);
}

/** 단계 아래 이전·다음 버튼 */
export const StepFooter: React.FC<{
  step: number;
  total: number;
  onStepChange: (n: number) => void;
  onGoToNextLesson?: () => void;
  nextLessonLabel?: string;
}> = ({ step, total, onStepChange, onGoToNextLesson, nextLessonLabel = '다음 차시로' }) => (
  <div className="no-print flex items-center justify-between gap-3 pt-2">
    <button
      type="button"
      disabled={step === 0}
      onClick={() => onStepChange(step - 1)}
      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
    >
      <ArrowLeft className="h-4 w-4" /> 이전 단계
    </button>
    {step < total - 1 ? (
      <button
        type="button"
        onClick={() => onStepChange(step + 1)}
        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
      >
        다음 단계 <ArrowRight className="h-4 w-4" />
      </button>
    ) : (
      onGoToNextLesson && (
        <button
          type="button"
          onClick={onGoToNextLesson}
          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
        >
          {nextLessonLabel} <ArrowRight className="h-4 w-4" />
        </button>
      )
    )}
  </div>
);
