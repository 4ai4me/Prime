import React from 'react';
import { Atom, BookOpen, Sparkles, Target } from 'lucide-react';
import type { LessonViewProps } from './index';
import { ReflectionStep } from './ReflectionStep';
import {
  CheckBar,
  ChoiceGroup,
  HintToggle,
  NumberCards,
  Section,
  ShortInput,
  StepFooter,
  TextAnswer,
  toggleNumber,
} from './ui';
import {
  CLASS_LABEL,
  L1_CHALLENGE_PICK_COUNT,
  L1_CHALLENGE_RANGE,
  L1_CHALLENGE_TARGET,
  L1_MIN_CHALLENGE,
  L1_MIN_EXAMPLE,
  L1_MIN_REASON,
  L1_P1_NUMBERS,
  P1_CLASS_KEY,
  P1_DIVISOR_KEY,
  PREP_GROUP_TITLES,
  PREP_ITEMS,
  challengeSums,
  checkChallenge,
  checkConcept,
  checkConnect,
  checkEvenTwo,
  checkMyNumber,
  checkOpen,
  checkPrep,
  checkProblem1,
  divisorsOf,
  patchLesson1,
  type Confidence,
  type Lesson1State,
  type PrimeClass,
} from './lesson1Logic';
import { getCurriculumLesson } from './curriculum';

/**
 * 1차시 「소수란 무엇일까?」 (교과서 중단원 1. 소수와 합성수 ①)
 * 0 단원 열기·준비 학습 / 1 생각 열기 / 2 소수와 합성수의 뜻 / 3 문제 1 / 4 도전 / 5 성찰
 */

const PRIME_COMPOSITE: { value: Exclude<PrimeClass, '' | 'neither'>; label: string }[] = [
  { value: 'prime', label: '소수' },
  { value: 'composite', label: '합성수' },
];
const ALL_CLASSES: { value: Exclude<PrimeClass, ''>; label: string }[] = [
  { value: 'prime', label: '소수' },
  { value: 'composite', label: '합성수' },
  { value: 'neither', label: '소수도 합성수도 아니다' },
];
const CONFIDENCE: { value: Exclude<Confidence, ''>; label: string }[] = [
  { value: 'sure', label: '🙂 자신 있어요' },
  { value: 'need', label: '🤔 학습이 필요해요' },
];
const OPEN_CARDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const Lesson1View: React.FC<LessonViewProps<Lesson1State>> = ({
  step,
  state: s,
  onStepChange,
  onUpdate,
  onGoToNextLesson,
}) => {
  const set = (patch: Partial<Lesson1State>) => onUpdate((prev) => patchLesson1(prev, patch)); // 고친 문항의 ✓는 지움
  const verify = (key: keyof Lesson1State, ok: boolean) => {
    if (ok) onUpdate((prev) => ({ ...prev, [key]: true }));
  };
  const total = getCurriculumLesson(1).stages.length;

  return (
    <div className="space-y-5">
      {step === 0 && (
        <>
          <Section badge="단원 열기" title="지구가 더워지는 이유는?" tone="amber" testId="l1-connect">
            <div className="flex gap-3 rounded-xl bg-amber-50/70 border border-amber-200 p-4 text-sm leading-relaxed text-slate-800 break-keep">
              <Atom className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="space-y-1.5">
                <p>
                  물질은 원자라는 기본 요소로 이루어져 있고, 원자들이 결합하면 새로운 물질이 생겨요. 탄소 원자(C) 1개와 산소
                  원자(O) 2개가 결합하면 <strong>이산화 탄소(CO₂)</strong>가 돼요.
                </p>
                <p>
                  이산화 탄소는 지구 온난화를 일으키는 대표적인 온실가스예요. 그래서 배출량을 줄이고 흡수량을 늘려 실질 배출량을
                  0으로 만드는 <strong>탄소 중립</strong>이 필요해요.
                </p>
                <p className="text-amber-800 font-bold">물질을 원자로 쪼개듯, 수도 더 작은 수의 곱으로 쪼갤 수 있을까요?</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-800">1. 6을 1보다 큰 자연수 두 개의 곱으로 나타내 보자.</p>
              <div className="flex items-center gap-2 text-xl font-extrabold mono text-slate-900">
                <span>6 =</span>
                <ShortInput id="l1-connectA" ariaLabel="곱하는 첫 번째 수" width="xs" inputMode="numeric" value={s.connectA} onChange={(v) => set({ connectA: v })} />
                <span>×</span>
                <ShortInput id="l1-connectB" ariaLabel="곱하는 두 번째 수" width="xs" inputMode="numeric" value={s.connectB} onChange={(v) => set({ connectB: v })} />
              </div>
            </div>
            <TextAnswer
              id="l1-connectExample"
              label="2. 탄소와 산소가 결합한 이산화 탄소처럼, 우리 주변에서 두 가지 이상의 요소가 결합되어 이루어진 것의 예를 찾아보자."
              value={s.connectExample}
              min={L1_MIN_EXAMPLE}
              onChange={(v) => set({ connectExample: v })}
            />
            <HintToggle>
              1. 6을 나누어떨어지게 하는 수 중에서 1과 6이 아닌 수를 찾아보세요.
              <br />
              2. 자음과 모음이 결합한 한글, 여러 재료가 섞여 만들어진 물건 등을 떠올려 보세요.
            </HintToggle>
            <CheckBar verified={s.connectVerified} onCheck={() => withVerify(checkConnect(s), () => verify('connectVerified', true))} />
          </Section>

          <Section badge="준비 학습" title="초등학교 5~6학년에서 배운 내용을 확인해 보자" tone="sky" testId="l1-prep">
            {([1, 2, 3, 4] as const).map((g) => {
              const items = PREP_ITEMS.filter((it) => it.group === g);
              const sureKey = `prepSure${g}` as 'prepSure1' | 'prepSure2' | 'prepSure3' | 'prepSure4';
              return (
                <div key={g} className="rounded-xl border border-slate-200 p-3.5 space-y-3">
                  <p className="text-sm font-extrabold text-slate-900">
                    {g}. {PREP_GROUP_TITLES[g]}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((it) => (
                      <ShortInput
                        key={it.key}
                        id={`l1-${it.key}`}
                        label={it.label}
                        width="md"
                        value={s[it.key]}
                        onChange={(v) => set({ [it.key]: v } as Partial<Lesson1State>)}
                      />
                    ))}
                  </div>
                  <ChoiceGroup
                    name={sureKey}
                    ariaLabel={`${g}번 자기 점검`}
                    value={s[sureKey]}
                    options={CONFIDENCE}
                    onChange={(v) => set({ [sureKey]: v } as Partial<Lesson1State>)}
                  />
                </div>
              );
            })}
            <HintToggle>
              약수: 그 수를 나누어떨어지게 하는 수 (1과 자기 자신도 약수예요) · 배수: 그 수를 1배, 2배, 3배, … 한 수
              <br />
              최대공약수: 두 수의 공통인 약수 중 가장 큰 수 · 최소공배수: 두 수의 공통인 배수 중 가장 작은 수
              <br />
              여러 개를 쓸 때는 쉼표(,)로 구분해요.
            </HintToggle>
            <CheckBar verified={s.prepVerified} onCheck={() => withVerify(checkPrep(s), () => verify('prepVerified', true))} />
          </Section>
        </>
      )}

      {step === 1 && (
        <Section badge="생각 열기" title="약수 모여라!" tone="violet" testId="l1-open">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
              <p className="text-sm font-extrabold text-violet-900">📣 6의 약수 모여라! — 6의 약수 카드를 모두 고르세요.</p>
              <NumberCards ariaLabel="6의 약수 카드" numbers={OPEN_CARDS} picked={s.open6Picks} onToggle={(n) => set({ open6Picks: toggleNumber(s.open6Picks, n) })} />
              <p className="text-xs text-slate-600">
                모인 수: <strong className="mono">{(s.open6Picks ?? []).join(', ') || '없음'}</strong> ({(s.open6Picks ?? []).length}개)
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
              <p className="text-sm font-extrabold text-indigo-900">📣 7의 약수 모여라! — 7의 약수 카드를 모두 고르세요.</p>
              <NumberCards ariaLabel="7의 약수 카드" numbers={OPEN_CARDS} picked={s.open7Picks} onToggle={(n) => set({ open7Picks: toggleNumber(s.open7Picks, n) })} />
              <p className="text-xs text-slate-600">
                모인 수: <strong className="mono">{(s.open7Picks ?? []).join(', ') || '없음'}</strong> ({(s.open7Picks ?? []).length}개)
              </p>
            </div>
          </div>
          {s.openVerified && (
            <p className="rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 break-keep">
              6에게는 "1과 나 말고도 더 있네." 하고 2, 3이 달려와요. 7에게는 "1과 나뿐이네."
            </p>
          )}
          <ShortInput
            id="l1-openPrimes"
            label="7과 같이 1과 자기 자신만을 약수로 갖는 수를 3개 이상 말해 보자. (쉼표로 구분)"
            width="full"
            value={s.openPrimes}
            onChange={(v) => set({ openPrimes: v })}
          />
          <HintToggle>6 ÷ □ 가 나누어떨어지는 □를 찾아보세요. 7과 같은 수는 2부터 하나씩 약수를 구해 보면 찾을 수 있어요.</HintToggle>
          <CheckBar verified={s.openVerified} onCheck={() => withVerify(checkOpen(s), () => verify('openVerified', true))} />
        </Section>
      )}

      {step === 2 && (
        <>
          <Section badge="개념" title="소수와 합성수" tone="emerald" testId="l1-concept">
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-2 text-sm sm:text-base leading-relaxed text-slate-900 break-keep">
              <p>
                생각 열기에서 6의 약수는 1, 2, 3, 6이지만 7의 약수는 1과 7뿐이에요.
              </p>
              <p>
                ① 1보다 큰 자연수 중에서 <strong>1과 자기 자신만을 약수로 갖는 수</strong>를{' '}
                <strong className="text-rose-700 text-lg">소수</strong>라고 한다.
              </p>
              <p>
                ② 1보다 큰 자연수 중에서 <strong>소수가 아닌 수</strong>를 <strong className="text-sky-700 text-lg">합성수</strong>라고 한다.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-slate-600 break-keep">
              <p className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                📖 소수(素數)의 素는 '바탕', 합성수(合成數)의 合成은 '두 가지 이상이 합하여 하나를 이룬다'는 뜻이에요.
              </p>
              <p className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                📖 0.2, 0.04 같은 소수는 小數(작은 수)이고, 2, 3, 5 같은 소수는 素數예요. 글자는 같지만 다른 말이에요.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm">
                <div className="text-xs font-bold text-rose-700">보기 · "13은 약수가 1과 자기 자신뿐이야."</div>
                <div className="mt-1 font-extrabold text-slate-900 mono">13의 약수: 1, 13</div>
                <div className="font-extrabold text-rose-700">➡ 13은 소수</div>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-sm">
                <div className="text-xs font-bold text-sky-700">보기 · "15는 1과 자기 자신 이외의 약수도 있어."</div>
                <div className="mt-1 font-extrabold text-slate-900 mono">15의 약수: 1, 3, 5, 15</div>
                <div className="font-extrabold text-sky-700">➡ 15는 합성수</div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
              <p className="text-sm font-extrabold text-slate-900">💬 생각 톡톡 · 소수의 약수는 몇 개일까?</p>
              <div className="flex items-center gap-2 text-sm font-bold">
                <ShortInput id="l1-talk" ariaLabel="소수의 약수 개수" width="xs" inputMode="numeric" value={s.talkDivisorCount} onChange={(v) => set({ talkDivisorCount: v })} />
                <span>개</span>
              </div>
              <p className="text-sm font-extrabold text-slate-900">🤔 1은 소수일까, 합성수일까?</p>
              <ChoiceGroup name="oneClass" ariaLabel="1의 분류" value={s.oneClass} options={ALL_CLASSES} onChange={(v) => set({ oneClass: v })} />
              <HintToggle>1의 약수를 모두 써 보세요. 그리고 소수와 합성수의 뜻 맨 앞에 있는 "1보다 큰 자연수 중에서"를 다시 읽어 보세요.</HintToggle>
              <CheckBar verified={s.conceptVerified} onCheck={() => withVerify(checkConcept(s), () => verify('conceptVerified', true))} />
              {s.conceptVerified && (
                <div data-testid="l1-natural-split" className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
                  <div className="font-extrabold text-slate-800 mb-2">그래서 자연수는 세 가지로 나눌 수 있어요.</div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm font-bold">
                    <div className="rounded-lg bg-white border border-slate-300 px-2 py-2">1<br /><span className="font-semibold text-slate-500">약수 1개</span></div>
                    <div className="rounded-lg bg-rose-50 border border-rose-200 px-2 py-2 text-rose-800">소수<br /><span className="font-semibold">약수 2개</span></div>
                    <div className="rounded-lg bg-sky-50 border border-sky-200 px-2 py-2 text-sky-800">합성수<br /><span className="font-semibold">약수 3개 이상</span></div>
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section badge="내가 판별" title="2부터 100까지의 수 중 하나를 골라 소수인지 합성수인지 판별해 보자" tone="violet" testId="l1-my">
            <div className="flex flex-wrap items-end gap-3">
              <ShortInput id="l1-myNumber" label="고른 수" width="xs" inputMode="numeric" value={s.myNumber} onChange={(v) => set({ myNumber: v })} />
              <ShortInput id="l1-myDivisors" label="그 수의 약수 (모두, 쉼표로 구분)" width="md" value={s.myDivisors} onChange={(v) => set({ myDivisors: v })} />
            </div>
            <ChoiceGroup name="myClass" ariaLabel="고른 수의 분류" value={s.myClass} options={PRIME_COMPOSITE} onChange={(v) => set({ myClass: v })} />
            <CheckBar verified={s.myVerified} onCheck={() => withVerify(checkMyNumber(s), () => verify('myVerified', true))} />
          </Section>
        </>
      )}

      {step === 3 && (
        <>
          <Section badge="문제 1" title="다음 수가 소수인지 합성수인지 말하시오." tone="violet" testId="l1-p1">
            <div className="grid gap-3 sm:grid-cols-2">
              {L1_P1_NUMBERS.map((n, i) => {
                const classKey = P1_CLASS_KEY[n];
                const divKey = P1_DIVISOR_KEY[n];
                return (
                  <div key={n} className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                    <div className="text-lg font-extrabold text-slate-900 mono">
                      ({i + 1}) {n}
                    </div>
                    <ChoiceGroup
                      name={classKey}
                      ariaLabel={`${n}의 분류`}
                      value={s[classKey]}
                      options={PRIME_COMPOSITE}
                      onChange={(v) => set({ [classKey]: v } as Partial<Lesson1State>)}
                    />
                    {s[classKey] === 'composite' && (
                      <ShortInput
                        id={`l1-${divKey}`}
                        label={`증거: 1과 ${n}이 아닌 ${n}의 약수 하나`}
                        width="xs"
                        inputMode="numeric"
                        value={s[divKey]}
                        onChange={(v) => set({ [divKey]: v } as Partial<Lesson1State>)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <HintToggle>2, 3, 5, 7로 차례로 나누어 보세요. 1과 자기 자신이 아닌 수로 나누어떨어지면 합성수예요.</HintToggle>
            <CheckBar verified={s.p1Verified} onCheck={() => withVerify(checkProblem1(s), () => verify('p1Verified', true))} />
          </Section>

          <Section badge="오개념 점검" title='친구가 말했어요. "2는 짝수니까 소수가 아니야." 정말 그럴까?' tone="rose" testId="l1-even">
            <ChoiceGroup
              name="evenTwo"
              ariaLabel="2는 소수일까"
              value={s.evenTwo}
              options={[
                { value: 'yes', label: '2는 소수이다' },
                { value: 'no', label: '2는 소수가 아니다' },
              ]}
              onChange={(v) => set({ evenTwo: v })}
            />
            <TextAnswer id="l1-evenTwoReason" label="그렇게 생각한 이유" value={s.evenTwoReason} min={L1_MIN_REASON} onChange={(v) => set({ evenTwoReason: v })} />
            <HintToggle>소수인지 아닌지는 짝수·홀수가 아니라 약수의 개수로 정해요. 2의 약수를 모두 써 보세요.</HintToggle>
            <CheckBar verified={s.evenVerified} onCheck={() => withVerify(checkEvenTwo(s), () => verify('evenVerified', true))} />
          </Section>
        </>
      )}

      {step === 4 && <ChallengeStep s={s} set={set} verify={verify} />}

      {step === 5 && (
        <>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 sm:p-5 text-sm leading-relaxed break-keep">
            <div className="flex items-center gap-2 font-extrabold text-violet-900">
              <BookOpen className="h-4 w-4" /> 오늘의 핵심
            </div>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-800">
              <li>소수: 1보다 큰 자연수 중 1과 자기 자신만을 약수로 갖는 수 (약수 2개)</li>
              <li>합성수: 1보다 큰 자연수 중 소수가 아닌 수 (약수 3개 이상)</li>
              <li>1은 소수도 합성수도 아니에요. 2는 짝수지만 소수예요.</li>
            </ul>
          </div>
          <Section badge="성찰" title="이번 차시를 돌아보자" tone="emerald" testId="l1-reflect">
            <ReflectionStep lesson={1} state={s} onChange={(patch) => set(patch)} />
          </Section>
        </>
      )}

      <StepFooter step={step} total={total} onStepChange={onStepChange} onGoToNextLesson={onGoToNextLesson} nextLessonLabel="2차시 · 소수 찾기로" />
    </div>
  );
};

const ChallengeStep: React.FC<{
  s: Lesson1State;
  set: (patch: Partial<Lesson1State>) => void;
  verify: (key: keyof Lesson1State, ok: boolean) => void;
}> = ({ s, set, verify }) => {
  const picks = s.chPicks ?? [];
  const { pickSum, divisorSum, diff } = challengeSums(picks);
  return (
    <Section badge="도전 · 상" title="조건을 만족시키는 수 5개를 찾아라!" tone="amber" testId="l1-challenge">
      <p className="rounded-xl bg-amber-50/70 border border-amber-200 px-4 py-3 text-sm sm:text-base leading-relaxed text-slate-900 break-keep">
        2 이상 10 이하의 자연수 중에서 5개를 선택하여 각 수의 약수를 모두 더하였더니 선택한 5개의 수의 합보다{' '}
        <strong>{L1_CHALLENGE_TARGET}만큼</strong> 컸다. 이때 선택한 수 5개를 모두 구하시오.
      </p>
      <NumberCards
        ariaLabel="도전 수 고르기"
        numbers={L1_CHALLENGE_RANGE}
        picked={picks}
        max={L1_CHALLENGE_PICK_COUNT}
        onToggle={(n) => set({ chPicks: toggleNumber(s.chPicks, n) })}
      />
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">고른 수</th>
              <th className="px-3 py-2 text-left">약수</th>
              <th className="px-3 py-2 text-right">약수의 합</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 mono">
            {picks.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-3 text-center text-slate-500 font-sans">
                  위에서 수를 골라 보세요. ({L1_CHALLENGE_PICK_COUNT}개)
                </td>
              </tr>
            ) : (
              picks.map((n) => {
                const d = divisorsOf(n);
                return (
                  <tr key={n}>
                    <td className="px-3 py-1.5 font-bold">{n}</td>
                    <td className="px-3 py-1.5">{d.join(', ')}</td>
                    <td className="px-3 py-1.5 text-right">{d.reduce((a, b) => a + b, 0)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div data-testid="l1-challenge-board" className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
          <div className="text-[11px] font-bold text-slate-500">고른 수의 합</div>
          <div className="text-xl font-extrabold mono">{pickSum}</div>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
          <div className="text-[11px] font-bold text-slate-500">약수를 모두 더한 값</div>
          <div className="text-xl font-extrabold mono">{divisorSum}</div>
        </div>
        <div
          className={`rounded-xl border p-2.5 ${
            picks.length === L1_CHALLENGE_PICK_COUNT && diff === L1_CHALLENGE_TARGET
              ? 'bg-emerald-50 border-emerald-300'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500">차이 (목표 {L1_CHALLENGE_TARGET})</div>
          <div className="text-xl font-extrabold mono">{diff}</div>
        </div>
      </div>
      <TextAnswer
        id="l1-chReason"
        label="어떻게 찾았는지 설명해 보자. (소수와 합성수의 뜻을 이용해서)"
        value={s.chReason}
        min={L1_MIN_CHALLENGE}
        rows={4}
        onChange={(v) => set({ chReason: v })}
      />
      <HintToggle>
        <span className="flex items-start gap-1.5">
          <Target className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            모든 자연수는 1과 자기 자신을 약수로 가져요. 그래서 (약수의 합) = (고른 수의 합) + (1 × 5) + (1과 자기 자신 이외의
            약수의 합)이에요. 차이가 {L1_CHALLENGE_TARGET}이 되려면 "1과 자기 자신 이외의 약수의 합"이 얼마여야 할까요? 소수는 그런
            약수가 하나도 없어요.
          </span>
        </span>
      </HintToggle>
      <CheckBar verified={s.chVerified} onCheck={() => withVerify(checkChallenge(s), () => verify('chVerified', true))} />
      {s.chVerified && (
        <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
          <Sparkles className="h-4 w-4" /> {CLASS_LABEL.prime}를 이용해 조건을 만족하는 수를 찾았어요!
        </p>
      )}
    </Section>
  );
};

/** 점검 결과가 맞으면 확인 표시를 남기고, 결과를 그대로 화면에 돌려줌 */
function withVerify<T extends { ok: boolean }>(result: T, onOk: () => void): T {
  if (result.ok) onOk();
  return result;
}
