import React, { useState } from 'react';
import { BookOpen, Eraser, RotateCcw, Sparkles, CircleCheck } from 'lucide-react';
import type { LessonViewProps } from './index';
import { ReflectionStep } from './ReflectionStep';
import { CheckBar, ChoiceGroup, HintToggle, Note, Section, ShortInput, StepFooter, TextAnswer, withVerify } from './ui';
import {
  L2_MIN_REASON,
  MER_KEY,
  MER_NS,
  OX_ITEMS,
  P2_NUMBERS,
  RV1_KEY,
  RV1_NUMBERS,
  RV3_NUMBERS,
  SIEVE_NUMBERS,
  checkMersenne,
  checkProblem2,
  checkReview1,
  checkReview3,
  checkReviewOx,
  checkSieve,
  checkSieveQuestions,
  merValue,
  patchLesson2,
  sieveClick,
  sieveEraseMultiples,
  sieveFinish,
  sieveNext,
  type Lesson2State,
} from './lesson2Logic';
import { getCurriculumLesson } from './curriculum';

/**
 * 2차시 「소수를 어떻게 찾을 수 있을까?」 (교과서 중단원 1. 소수와 합성수 ②)
 * 0 함께하기·에라토스테네스의 체 / 1 문제 2 / 2 배운 내용 확인하기 / 3 수학 이야기 / 4 성찰
 */

type StepProps = {
  s: Lesson2State;
  set: (patch: Partial<Lesson2State>) => void;
  verify: (key: keyof Lesson2State) => void;
};

const CLS3 = [
  { value: 'prime' as const, label: '○ 소수' },
  { value: 'composite' as const, label: '△ 합성수' },
  { value: 'neither' as const, label: '둘 다 아님' },
];
const CLS2 = [
  { value: 'prime' as const, label: '소수' },
  { value: 'composite' as const, label: '합성수' },
];

export const Lesson2View: React.FC<LessonViewProps<Lesson2State>> = ({ step, state: s, onStepChange, onUpdate, onGoToNextLesson }) => {
  const set = (patch: Partial<Lesson2State>) => onUpdate((prev) => patchLesson2(prev, patch)); // 고친 문항의 ✓는 지움
  const verify = (key: keyof Lesson2State) => onUpdate((prev) => ({ ...prev, [key]: true }));
  const total = getCurriculumLesson(2).stages.length;
  const props = { s, set, verify };
  return (
    <div className="space-y-5">
      {step === 0 && <SieveStep {...props} />}
      {step === 1 && <Problem2Step {...props} />}
      {step === 2 && <ReviewStep {...props} />}
      {step === 3 && <StoryStep {...props} />}
      {step === 4 && (
        <>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 sm:p-5 text-sm leading-relaxed break-keep">
            <div className="flex items-center gap-2 font-extrabold text-violet-900">
              <BookOpen className="h-4 w-4" /> 오늘의 핵심
            </div>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-800">
              <li>에라토스테네스의 체: 1을 지우고, 남은 수 중 처음 수에 ○표를 한 뒤 그 수의 배수를 지우는 과정을 반복해요.</li>
              <li>1부터 50까지의 소수: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47</li>
              <li>7 × 7 = 49이므로 50까지는 7의 배수까지만 지우면 남은 수가 모두 소수예요.</li>
            </ul>
          </div>
          <Section badge="성찰" title="이번 차시를 돌아보자" tone="emerald" testId="l2-reflect">
            <ReflectionStep lesson={2} state={s} onChange={(patch) => set(patch)} />
          </Section>
        </>
      )}
      <StepFooter step={step} total={total} onStepChange={onStepChange} onGoToNextLesson={onGoToNextLesson} nextLessonLabel="3차시 · 거듭제곱으로" />
    </div>
  );
};

/** 수 판의 칸 하나 */
const Cell: React.FC<{ n: number; state: 'none' | 'circle' | 'cross' | 'pick'; onClick: () => void; highlight?: boolean }> = ({
  n,
  state,
  onClick,
  highlight,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${n}${state === 'circle' || state === 'pick' ? ' (○표)' : state === 'cross' ? ' (지움)' : ''}`}
    aria-pressed={state === 'circle' || state === 'pick'}
    className={`relative aspect-square w-full rounded-md text-xs sm:text-sm font-extrabold mono transition-colors ${
      state === 'cross'
        ? 'bg-slate-100 text-slate-300 line-through'
        : state === 'circle' || state === 'pick'
        ? 'bg-rose-50 text-rose-700 ring-2 ring-rose-500'
        : highlight
        ? 'bg-amber-100 text-slate-900 ring-2 ring-amber-400'
        : 'bg-amber-50 text-slate-800 hover:bg-amber-100'
    }`}
  >
    {n}
  </button>
);

const SieveStep: React.FC<StepProps> = ({ s, set, verify }) => {
  const [msg, setMsg] = useState<string | null>(null);
  const circled = s.sieveCircled ?? [];
  const crossed = s.sieveCrossed ?? [];
  const next = sieveNext(circled, crossed);
  const click = (n: number) => {
    const r = sieveClick(circled, crossed, n);
    setMsg(r.message ?? null);
    if (!r.message) set({ sieveCircled: r.circled, sieveCrossed: r.crossed });
  };
  const prompt =
    next.kind === 'erase1'
      ? '① 1은 소수가 아니므로 지운다. → 1을 누르세요.'
      : next.kind === 'eraseMultiples'
      ? `${next.p}에 ○표를 했어요. 이제 ${next.p}을(를) 남기고 나머지 ${next.p}의 배수를 모두 지워요.`
      : next.kind === 'circle'
      ? `남은 수 중에서 처음 수에 ○표를 하세요.`
      : '끝! ○표가 남은 수가 1부터 50까지의 소수예요.';

  return (
    <>
      <Section badge="함께하기" title="에라토스테네스의 체로 1부터 50까지의 소수를 찾아보자" tone="amber" testId="l2-sieve">
        <ol className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-800 space-y-1 break-keep">
          <li>❶ 1은 소수가 아니므로 지운다.</li>
          <li>❷ 2에 ○표를 하여 남기고, 나머지 2의 배수를 모두 지운다.</li>
          <li>❸ 3에 ○표를 하여 남기고, 나머지 3의 배수를 모두 지운다.</li>
          <li>❹ 남은 수 중에서 처음 수에 ○표를 하여 남기고, 그 수의 배수를 모두 지우는 과정을 반복한다.</li>
        </ol>
        <div role="status" data-testid="l2-sieve-prompt" className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-sm font-bold text-amber-900 break-keep">
          {prompt}
        </div>
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5" aria-label="1부터 50까지 수 판">
          {SIEVE_NUMBERS.map((n) => (
            <Cell
              key={n}
              n={n}
              state={circled.includes(n) ? 'circle' : crossed.includes(n) ? 'cross' : 'none'}
              onClick={() => click(n)}
              highlight={next.kind === 'eraseMultiples' && next.multiples.includes(n)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {next.kind === 'eraseMultiples' && (
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                const r = sieveEraseMultiples(circled, crossed);
                set({ sieveCircled: r.circled, sieveCrossed: r.crossed });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-amber-600"
            >
              <Eraser className="h-4 w-4" /> {next.p}의 배수 지우기 ({next.multiples.length}개)
            </button>
          )}
          {next.kind === 'circle' && next.canFinish && (
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                const r = sieveFinish(circled, crossed);
                set({ sieveCircled: r.circled, sieveCrossed: r.crossed });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-300 bg-rose-50 px-4 py-2 text-sm font-extrabold text-rose-800 hover:bg-rose-100"
            >
              <CircleCheck className="h-4 w-4" /> 더 지울 수가 없어요 · 남은 수에 모두 ○표
            </button>
          )}
          {(circled.length > 0 || crossed.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                set({ sieveCircled: [], sieveCrossed: [] });
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600"
            >
              <RotateCcw className="h-3.5 w-3.5" /> 처음부터
            </button>
          )}
        </div>
        {msg && <p className="text-sm font-bold text-amber-700">{msg}</p>}
        <CheckBar verified={s.sieveVerified} onCheck={() => withVerify(checkSieve(s), () => verify('sieveVerified'))} />
        <Note>고대 그리스의 수학자 에라토스테네스(B.C. 275?~B.C. 194?)가 고안한 방법이라 '에라토스테네스의 체'라고 해요.</Note>
      </Section>

      <Section badge="생각해 보기" title="체를 다 쓰고 나서 답해 보자" tone="violet" testId="l2-sieveQ">
        <TextAnswer id="l2-sieveReason" label="1. 2에 ○표를 하여 남기고, 나머지 2의 배수를 지우는 이유를 말해 보자." value={s.sieveReason} min={L2_MIN_REASON} onChange={(v) => set({ sieveReason: v })} />
        <ShortInput id="l2-sievePrimes" label="2. 위에서 ○표를 한 수가 소수이다. 1부터 50까지 자연수 중에서 소수를 모두 써 보자." width="full" value={s.sievePrimes} onChange={(v) => set({ sievePrimes: v })} />
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-slate-800 break-keep">3. 몇의 배수까지 지운 뒤부터 더 지울 수가 없었나요?</p>
          <ChoiceGroup
            name="sieveStop"
            ariaLabel="더 지울 수 없었던 때"
            value={s.sieveStop}
            options={[
              { value: '5', label: '5의 배수' },
              { value: '7', label: '7의 배수' },
              { value: '11', label: '11의 배수' },
              { value: '47', label: '47의 배수' },
            ]}
            onChange={(v) => set({ sieveStop: v })}
          />
        </div>
        <HintToggle>2의 배수(4, 6, 8, …)는 약수에 2가 들어 있어요. 약수가 몇 개 이상일까요? / 11의 배수 22, 33, 44는 이미 지워져 있었나요?</HintToggle>
        <CheckBar verified={s.sieveQVerified} onCheck={() => withVerify(checkSieveQuestions(s), () => verify('sieveQVerified'))} />
      </Section>
    </>
  );
};

const Problem2Step: React.FC<StepProps> = ({ s, set, verify }) => {
  const picks = s.p2Picks ?? [];
  const toggle = (n: number) => set({ p2Picks: picks.includes(n) ? picks.filter((x) => x !== n) : [...picks, n].sort((a, b) => a - b) });
  return (
    <Section badge="문제 2" title="51부터 100까지 자연수 중에서 소수를 모두 찾으시오." tone="violet" testId="l2-p2">
      <p className="text-xs text-slate-600 break-keep">소수라고 생각하는 수를 눌러 ○표를 하세요. 다시 누르면 지워져요. (고른 수 {picks.length}개)</p>
      <div className="grid grid-cols-10 gap-1 sm:gap-1.5" aria-label="51부터 100까지 수 판">
        {P2_NUMBERS.map((n) => (
          <Cell key={n} n={n} state={picks.includes(n) ? 'pick' : 'none'} onClick={() => toggle(n)} />
        ))}
      </div>
      <HintToggle>짝수와 5의 배수는 먼저 빼고, 남은 수를 3과 7로 나누어 보세요. 10 × 10 = 100이니까 7까지만 나누어 보면 충분해요.</HintToggle>
      <CheckBar verified={s.p2Verified} onCheck={() => withVerify(checkProblem2(s), () => verify('p2Verified'))} />
    </Section>
  );
};

const ReviewStep: React.FC<StepProps> = ({ s, set, verify }) => {
  const picks3 = s.rv3Picks ?? [];
  const toggle3 = (n: number) => set({ rv3Picks: picks3.includes(n) ? picks3.filter((x) => x !== n) : [...picks3, n] });
  const U: React.FC<{ n: number }> = ({ n }) => (
    <button
      type="button"
      aria-pressed={picks3.includes(n)}
      onClick={() => toggle3(n)}
      className={`mx-0.5 rounded px-1 font-extrabold underline decoration-2 underline-offset-4 ${
        picks3.includes(n) ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-400' : 'text-slate-900 hover:bg-amber-100'
      }`}
    >
      {n}
    </button>
  );
  return (
    <>
      <Section badge="배운 내용 확인하기" title="소수와 합성수의 뜻을 알고, 소수를 찾을 수 있는가?" tone="emerald" testId="l2-rv1">
        <div className="space-y-2">
          <p className="text-sm text-slate-800 break-keep">❶ 1보다 큰 자연수 중에서 1과 자기 자신만을 약수로 갖는 수를 (   )(이)라고 한다.</p>
          <ChoiceGroup name="rvBlank1" ariaLabel="빈칸 1" value={s.rvBlank1} options={CLS2} onChange={(v) => set({ rvBlank1: v })} />
          <p className="text-sm text-slate-800 break-keep">❷ 1보다 큰 자연수 중에서 소수가 아닌 수를 (   )(이)라고 한다.</p>
          <ChoiceGroup name="rvBlank2" ariaLabel="빈칸 2" value={s.rvBlank2} options={CLS2} onChange={(v) => set({ rvBlank2: v })} />
        </div>
        <p className="text-sm font-extrabold text-slate-900">1. 다음에서 소수에는 ○표, 합성수에는 △표를 하시오.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {RV1_NUMBERS.map((n) => (
            <div key={n} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <span className="w-8 text-lg font-extrabold mono">{n}</span>
              <ChoiceGroup name={RV1_KEY[n]} ariaLabel={`${n} 판단`} value={s[RV1_KEY[n]]} options={CLS3} onChange={(v) => set({ [RV1_KEY[n]]: v } as Partial<Lesson2State>)} />
            </div>
          ))}
        </div>
        <CheckBar verified={s.rv1Verified} onCheck={() => withVerify(checkReview1(s), () => verify('rv1Verified'))} />
      </Section>

      <Section badge="확인 2" title="다음에서 옳은 것에는 ○표, 옳지 않은 것에는 ×표를 하시오." tone="violet" testId="l2-rvOx">
        <div className="space-y-2">
          {OX_ITEMS.map((it) => (
            <div key={it.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <span className="text-sm text-slate-800 break-keep">{it.text}</span>
              <ChoiceGroup
                name={it.key}
                ariaLabel={it.text}
                value={s[it.key]}
                options={[
                  { value: 'o' as const, label: '○' },
                  { value: 'x' as const, label: '×' },
                ]}
                onChange={(v) => set({ [it.key]: v } as Partial<Lesson2State>)}
              />
            </div>
          ))}
        </div>
        <CheckBar verified={s.rvOxVerified} onCheck={() => withVerify(checkReviewOx(s), () => verify('rvOxVerified'))} />
      </Section>

      <Section badge="확인 3" title="다음은 훈민정음에 대한 글이다. 밑줄 친 수 중에서 소수를 모두 찾아 눌러 보시오." tone="violet" testId="l2-rv3">
        <p className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm sm:text-base leading-loose text-slate-900 break-keep">
          훈민정음은 한글의 옛 이름으로 세종이 재위 <U n={RV3_NUMBERS[0]} />년에 창제한 문자이다. 창제 초기에는 닿소리 <U n={RV3_NUMBERS[1]} />자와
          홀소리 <U n={RV3_NUMBERS[2]} />자로 총 <U n={RV3_NUMBERS[3]} />자였으나, 점차 <U n={RV3_NUMBERS[4]} />자를 사용하지 않게 되어 현재는 닿소리{' '}
          <U n={RV3_NUMBERS[5]} />자와 홀소리 <U n={RV3_NUMBERS[6]} />자만을 사용하고 있다.
        </p>
        <CheckBar verified={s.rv3Verified} onCheck={() => withVerify(checkReview3(s), () => verify('rv3Verified'))} />
      </Section>
    </>
  );
};

const StoryStep: React.FC<StepProps> = ({ s, set, verify }) => (
  <Section badge="수학 이야기" title="더 큰 소수를 찾아서" tone="sky" testId="l2-story">
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-sm leading-relaxed text-slate-800 space-y-2 break-keep">
      <p>
        소수가 무수히 많다는 사실은 고대 그리스의 수학자 유클리드가 밝혔어요. 그 뒤로 많은 사람이 더 큰 소수를 찾으려고 노력해
        왔어요.
      </p>
      <p>
        15세기까지 알려진 가장 큰 소수는 <strong>2를 13번 곱한 수에서 1을 뺀 수</strong>(8191, 네 자리 수)였지만, 컴퓨터가 나온 뒤로 큰
        소수를 찾는 속도가 빨라졌어요. 2024년에는 <strong>2를 136279841번 곱한 수에서 1을 뺀 수</strong>가 소수라는 것이 밝혀졌는데,
        무려 4102만 자리가 넘는 수예요. (출처: GIMPS, 2024)
      </p>
    </div>
    <p className="text-sm font-extrabold text-slate-900 break-keep">
      2를 몇 번 곱한 수에서 1을 뺀 수는 모두 소수일까? 직접 판단해 보자.
    </p>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            <th className="px-2 py-2 text-left">2를 곱한 횟수</th>
            <th className="px-2 py-2 text-left">계산</th>
            <th className="px-2 py-2 text-left">소수? 합성수?</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {MER_NS.map((n) => (
            <tr key={n}>
              <td className="px-2 py-2 font-bold">{n}번</td>
              <td className="px-2 py-2 mono whitespace-nowrap">
                {Array.from({ length: n }, () => '2').join('×')} − 1 = {merValue(n)}
              </td>
              <td className="px-2 py-2">
                <ChoiceGroup
                  name={MER_KEY[n]}
                  ariaLabel={`2를 ${n}번 곱한 수에서 1을 뺀 수`}
                  value={s[MER_KEY[n]]}
                  options={CLS2}
                  onChange={(v) => set({ [MER_KEY[n]]: v } as Partial<Lesson2State>)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <HintToggle>15와 63은 3으로 나누어 보세요. 127은 2, 3, 5, 7, 11로 나누어떨어지지 않아요. (11 × 11 = 121, 12 × 12 = 144)</HintToggle>
    <CheckBar verified={s.merVerified} onCheck={() => withVerify(checkMersenne(s), () => verify('merVerified'))} />
    {s.merVerified && (
      <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 break-keep">
        <Sparkles className="h-4 w-4" /> 이런 모양의 수가 모두 소수는 아니지만, 지금까지 찾은 가장 큰 소수들은 대부분 이런 모양이에요.
      </p>
    )}
  </Section>
);
