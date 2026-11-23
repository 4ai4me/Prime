import React, { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { isPrimeNumber } from './powerExpr';

/**
 * 소인수 나무·나눗셈 사다리 만들기 (4차시)
 * 학생이 나눌 소수를 하나씩 고르면 가지(또는 사다리)가 자라고, 남은 수가 소수가 되면 끝납니다.
 * 나누어떨어지지 않는 수를 고르면 그 까닭을 보여 주고 기록하지 않습니다.
 */

const PRIME_BUTTONS = [2, 3, 5, 7, 11, 13] as const;

export const SplitBuilder: React.FC<{
  n: number;
  picks: number[] | undefined;
  onChange: (picks: number[]) => void;
  mode: 'tree' | 'ladder';
  title: string;
  testId: string;
  /** 첫 번째로 나눌 수를 정해 둔 경우 (순서 1은 2, 순서 2는 3) */
  firstPrime?: number;
}> = ({ n, picks, onChange, mode, title, testId, firstPrime }) => {
  const list = picks ?? [];
  const [msg, setMsg] = useState<string | null>(null);
  // 지금까지의 몫
  const values: number[] = [n];
  for (const p of list) values.push(values[values.length - 1] / p);
  const remaining = values[values.length - 1];
  const done = isPrimeNumber(remaining);

  const pick = (p: number) => {
    if (done) return;
    if (list.length === 0 && firstPrime !== undefined && p !== firstPrime) {
      setMsg(`이 순서에서는 ${firstPrime}(으)로 먼저 나누어 시작해요.`);
      return;
    }
    if (remaining % p !== 0) {
      setMsg(`${remaining}은(는) ${p}(으)로 나누어떨어지지 않아요.`);
      return;
    }
    setMsg(null);
    onChange([...list, p]);
  };

  return (
    <div data-testid={testId} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
      <div className="text-sm font-extrabold text-slate-900">{title}</div>

      {mode === 'tree' ? (
        <div className="space-y-1 mono text-base" aria-label={`${n}의 소인수 나무`}>
          {list.map((p, i) => (
            <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${i * 1.25}rem` }}>
              <span className="font-extrabold text-slate-900">{values[i]}</span>
              <span className="text-slate-400">⟨</span>
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-sky-100 px-1.5 font-extrabold text-sky-800">{p}</span>
              <span className="text-slate-400">·</span>
              <span className={`font-extrabold ${i === list.length - 1 && done ? 'inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-sky-100 px-1.5 text-sky-800' : 'text-slate-700'}`}>
                {values[i + 1]}
              </span>
            </div>
          ))}
          {list.length === 0 && <div className="font-extrabold text-slate-900">{n}</div>}
        </div>
      ) : (
        <div className="mono text-base" aria-label={`${n}의 나눗셈 사다리`}>
          {list.map((p, i) => (
            <div key={i} className="flex items-center">
              <span className="w-10 text-right font-extrabold text-sky-700">{p}</span>
              <span className="px-1 text-slate-500">)</span>
              <span className="border-b-2 border-l-2 border-slate-500 px-2 font-extrabold text-slate-900">{values[i]}</span>
            </div>
          ))}
          <div className="flex items-center">
            <span className="w-10" />
            <span className="px-1" />
            <span className={`px-2 font-extrabold ${done ? 'text-sky-700' : 'text-slate-900'}`}>{remaining}</span>
          </div>
        </div>
      )}

      {done && list.length > 0 ? (
        <p className="text-sm font-bold text-emerald-700 break-keep">
          남은 수 {remaining}은(는) 소수라서 더 나눌 수 없어요. → {n} = {[...list, remaining].join(' × ')}
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-600">
            {remaining}을(를) 나눌 소수를 고르세요.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRIME_BUTTONS.map((p) => (
              <button
                key={p}
                type="button"
                aria-label={`${p}(으)로 나누기`}
                onClick={() => pick(p)}
                className="h-10 min-w-10 rounded-lg border-2 border-sky-300 bg-sky-50 px-2 text-base font-extrabold mono text-sky-800 hover:bg-sky-100"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
      {msg && (
        <p role="status" className="text-sm font-bold text-amber-700">
          {msg}
        </p>
      )}
      {list.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setMsg(null);
            onChange(list.slice(0, -1));
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <Undo2 className="h-3.5 w-3.5" /> 한 단계 되돌리기
        </button>
      )}
    </div>
  );
};
