import React from 'react';
import { BookOpen, ExternalLink, Blocks, Sparkles } from 'lucide-react';
import type { LessonViewProps } from './index';
import { ReflectionStep } from './ReflectionStep';
import { CheckBar, ChoiceGroup, ConceptBox, HintToggle, Note, Section, ShortInput, StepFooter, TextAnswer, withVerify } from './ui';
import { SplitBuilder } from './SplitBuilder';
import {
  L4_MIN_ESSAY,
  L4_MIN_REASON,
  P2_KEY,
  P2_NUMBERS,
  P3_KEY,
  P3_NUMBERS,
  RV2_KEY,
  RV2_NUMBERS,
  RV3_KEY,
  RV3_NUMBERS,
  RV5_OPTIONS,
  RV_WORDS,
  T75_CELLS,
  checkCoding,
  checkCount40,
  checkExample1,
  checkOpen4,
  checkProblem2,
  checkProblem3,
  checkProblem4,
  checkReview23,
  checkReview4,
  checkReview5,
  checkReviewConcept,
  checkTable75,
  checkTalk4,
  checkTree,
  patchLesson4,
  type Lesson4State,
} from './lesson4Logic';
import { BLOCK_CODING_URL, getCurriculumLesson } from './curriculum';

/**
 * 4차시 「소인수분해는 어떻게 할까?」 (교과서 중단원 2. 소인수분해 ②)
 * 0 생각 열기·소인수 / 1 함께하기 / 2 예제 1·문제 3 / 3 약수 구하기 / 4 블록 코딩 / 5 배운 내용 확인하기 / 6 성찰
 */

type StepProps = {
  s: Lesson4State;
  set: (patch: Partial<Lesson4State>) => void;
  verify: (key: keyof Lesson4State) => void;
};

export const Lesson4View: React.FC<LessonViewProps<Lesson4State>> = ({ step, state: s, onStepChange, onUpdate, onGoToNextLesson }) => {
  const set = (patch: Partial<Lesson4State>) => onUpdate((prev) => patchLesson4(prev, patch)); // 고친 문항의 ✓는 지움
  const verify = (key: keyof Lesson4State) => onUpdate((prev) => ({ ...prev, [key]: true }));
  const total = getCurriculumLesson(4).stages.length;
  const props = { s, set, verify };
  return (
    <div className="space-y-5">
      {step === 0 && <OpenStep {...props} />}
      {step === 1 && <TreeStep {...props} />}
      {step === 2 && <MethodsStep {...props} />}
      {step === 3 && <DivisorStep {...props} />}
      {step === 4 && <CodingStep {...props} />}
      {step === 5 && <ReviewStep {...props} />}
      {step === 6 && (
        <>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 sm:p-5 text-sm leading-relaxed break-keep">
            <div className="flex items-center gap-2 font-extrabold text-violet-900">
              <BookOpen className="h-4 w-4" /> 오늘의 핵심
            </div>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-800">
              <li>소인수: 어떤 자연수의 약수 중에서 소수인 것 (12의 소인수는 2, 3)</li>
              <li>소인수분해: 자연수를 그 수의 소인수들만의 곱으로 나타내는 것. 순서를 생각하지 않으면 결과는 한 가지뿐!</li>
              <li>소인수분해를 이용하면 약수와 약수의 개수를 쉽게 구할 수 있어요.</li>
            </ul>
          </div>
          <Section badge="성찰" title="이번 차시를 돌아보자" tone="emerald" testId="l4-reflect">
            <ReflectionStep lesson={4} state={s} onChange={(patch) => set(patch)} />
          </Section>
        </>
      )}
      <StepFooter step={step} total={total} onStepChange={onStepChange} onGoToNextLesson={onGoToNextLesson} nextLessonLabel="5차시 · 최대공약수로" />
    </div>
  );
};

const OpenStep: React.FC<StepProps> = ({ s, set, verify }) => (
  <>
    <Section badge="생각 열기" title="12를 두 자연수의 곱으로 나타내 보자." tone="amber" testId="l4-open">
      <div className="flex flex-wrap gap-3">
        <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 mono font-extrabold">12 = 1 × 12</div>
        <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 mono font-extrabold flex items-center gap-1.5">
          12 = 2 × <ShortInput id="l4-openB2" ariaLabel="12 = 2 × 빈칸" width="xs" inputMode="numeric" value={s.openB2} onChange={(v) => set({ openB2: v })} />
        </div>
        <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 mono font-extrabold flex items-center gap-1.5">
          12 = 3 × <ShortInput id="l4-openB3" ariaLabel="12 = 3 × 빈칸" width="xs" inputMode="numeric" value={s.openB3} onChange={(v) => set({ openB3: v })} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ShortInput id="l4-openDiv12" label="12의 약수를 모두 써 보자." width="full" value={s.openDiv12} onChange={(v) => set({ openDiv12: v })} />
        <ShortInput id="l4-openPrime12" label="그중에서 소수인 것을 모두 써 보자." width="full" value={s.openPrime12} onChange={(v) => set({ openPrime12: v })} />
      </div>
      <CheckBar verified={s.openVerified} onCheck={() => withVerify(checkOpen4(s), () => verify('openVerified'))} />
      <ConceptBox testId="l4-concept-prime-factor">
        <p>
          12의 약수는 1, 2, 3, 4, 6, 12이고, 이 중에서 소수인 것은 2와 3이다. 이와 같이 어떤 자연수의 약수 중에서 소수인 것을 그
          자연수의 <strong className="text-rose-700">소인수</strong>라고 한다.
        </p>
      </ConceptBox>
      <Note>약수를 인수라고도 해요. 약수는 '나누어떨어진다', 인수는 '어떤 수를 곱하여 그 수가 된다'는 뜻이지만 같은 뜻으로 써요.</Note>
    </Section>
    <Section badge="문제 2" title="다음 수의 소인수를 모두 구하시오." tone="violet" testId="l4-p2">
      <div className="grid gap-3 sm:grid-cols-2">
        {P2_NUMBERS.map((n, i) => (
          <ShortInput key={n} id={`l4-${P2_KEY[n]}`} label={`(${i + 1}) ${n}`} width="full" value={s[P2_KEY[n]]} onChange={(v) => set({ [P2_KEY[n]]: v } as Partial<Lesson4State>)} />
        ))}
      </div>
      <HintToggle>먼저 약수를 구하고, 그중 소수만 골라요. 2, 3, 5, 7, 11로 나누어떨어지는지 확인해 보세요.</HintToggle>
      <CheckBar verified={s.p2Verified} onCheck={() => withVerify(checkProblem2(s), () => verify('p2Verified'))} />
    </Section>
  </>
);

const TreeStep: React.FC<StepProps> = ({ s, set, verify }) => (
  <Section badge="함께하기" title="24를 두 가지 순서로 소인수분해 해 보자." tone="sky" testId="l4-tree">
    <ConceptBox>
      <p>
        20을 소인수들만의 곱으로 나타내면 20 = 2 × 2 × 5 = 2² × 5이다. 이와 같이 어떤 자연수를 그 수의 소인수들만의 곱으로
        나타내는 것을 <strong className="text-rose-700">소인수분해</strong> 한다고 한다.
      </p>
    </ConceptBox>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <SplitBuilder n={24} mode="tree" title="[순서 1] 2로 먼저 나누기" testId="l4-tree1" firstPrime={2} picks={s.tree1} onChange={(p) => set({ tree1: p })} />
        <ShortInput id="l4-tree1Result" label="24 = (거듭제곱을 써서)" width="full" value={s.tree1Result} onChange={(v) => set({ tree1Result: v })} />
      </div>
      <div className="space-y-2">
        <SplitBuilder n={24} mode="tree" title="[순서 2] 3으로 먼저 나누기" testId="l4-tree2" firstPrime={3} picks={s.tree2} onChange={(p) => set({ tree2: p })} />
        <ShortInput id="l4-tree2Result" label="24 = (거듭제곱을 써서)" width="full" value={s.tree2Result} onChange={(v) => set({ tree2Result: v })} />
      </div>
    </div>
    <div className="space-y-1.5">
      <p className="text-sm font-extrabold text-slate-900">[순서 1]과 [순서 2]의 결과를 비교해 보자.</p>
      <ChoiceGroup
        name="treeSame"
        ariaLabel="두 순서의 결과 비교"
        value={s.treeSame}
        options={[
          { value: 'same', label: '결과가 같다' },
          { value: 'diff', label: '결과가 다르다' },
        ]}
        onChange={(v) => set({ treeSame: v })}
      />
    </div>
    <HintToggle>같은 소인수는 거듭제곱으로 묶고, 작은 소인수부터 써요. 예: 2 × 2 × 5 = 2² × 5</HintToggle>
    <CheckBar verified={s.treeVerified} onCheck={() => withVerify(checkTree(s), () => verify('treeVerified'))} />
    <Note>소인수분해 한 결과는 보통 크기가 작은 소인수부터 차례대로 쓰고, 같은 소인수의 곱은 거듭제곱으로 나타내요.</Note>
  </Section>
);

const MethodsStep: React.FC<StepProps> = ({ s, set, verify }) => (
  <>
    <Section badge="예제 1" title="90을 소인수분해 하시오." tone="violet" testId="l4-ex1">
      <div className="grid gap-3 md:grid-cols-3 text-sm">
        <div className="rounded-xl border border-slate-200 p-3 mono space-y-0.5">
          <div className="text-xs font-bold text-slate-500 font-sans">방법 ① 곱셈식</div>
          <div>90 = 2 × 45</div>
          <div>&nbsp;&nbsp;&nbsp;= 2 × 3 × 15</div>
          <div>&nbsp;&nbsp;&nbsp;= 2 × 3 × 3 × 5</div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3 mono space-y-0.5">
          <div className="text-xs font-bold text-slate-500 font-sans">방법 ② 가지</div>
          <div>90 ⟨ 2 · 45</div>
          <div>&nbsp;&nbsp;45 ⟨ 3 · 15</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;15 ⟨ 3 · 5</div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 text-xs text-slate-700 break-keep">
          <div className="font-bold text-sky-800">방법 ③ 나눗셈</div>
          아래에서 직접 해 보세요. 나누어떨어지는 소수로 계속 나누고, 몫이 소수가 되면 멈춰요.
        </div>
      </div>
      <SplitBuilder n={90} mode="ladder" title="방법 ③ 나눗셈으로 90 소인수분해" testId="l4-ladder90" picks={s.ladder90} onChange={(p) => set({ ladder90: p })} />
      <ShortInput id="l4-result90" label="90 = (거듭제곱을 써서)" width="md" value={s.result90} onChange={(v) => set({ result90: v })} />
      <CheckBar verified={s.ex1Verified} onCheck={() => withVerify(checkExample1(s), () => verify('ex1Verified'))} />
    </Section>
    <Section badge="문제 3" title="다음 수를 소인수분해 하시오." tone="violet" testId="l4-p3">
      <div className="grid gap-3 sm:grid-cols-2">
        {P3_NUMBERS.map((n, i) => (
          <ShortInput key={n} id={`l4-${P3_KEY[n]}`} label={`(${i + 1}) ${n} =`} width="full" value={s[P3_KEY[n]]} onChange={(v) => set({ [P3_KEY[n]]: v } as Partial<Lesson4State>)} />
        ))}
      </div>
      <HintToggle>위의 나눗셈 방법을 공책에 해 보세요. 답은 작은 소인수부터, 같은 소인수는 거듭제곱으로 써요.</HintToggle>
      <CheckBar verified={s.p3Verified} onCheck={() => withVerify(checkProblem3(s), () => verify('p3Verified'))} />
    </Section>
  </>
);

const DivisorStep: React.FC<StepProps> = ({ s, set, verify }) => (
  <>
    <Section badge="예제 2" title="소인수분해를 이용하여 75의 약수를 모두 구하시오." tone="violet" testId="l4-table75">
      <p className="text-sm text-slate-800 break-keep">
        75 = 3 × 5²이므로 75의 약수는 3의 약수 1, 3과 5²의 약수 1, 5, 5² 중에서 각각 하나씩 골라 서로 곱한 것이다. 표를 완성해 보자.
      </p>
      <div className="overflow-x-auto">
        <table className="text-center text-sm mono">
          <thead>
            <tr>
              <th className="border border-slate-300 bg-slate-100 px-3 py-2">×</th>
              {['1', '5', '5²'].map((h) => (
                <th key={h} className="border border-slate-300 bg-slate-100 px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 3].map((row) => (
              <tr key={row}>
                <th className="border border-slate-300 bg-slate-100 px-3 py-2">{row}</th>
                {T75_CELLS.filter((c) => c.row === row).map((c) => (
                  <td key={c.key} className="border border-slate-300 px-1.5 py-1.5">
                    <ShortInput id={`l4-${c.key}`} ariaLabel={`${row} × ${c.col === 25 ? '5²' : c.col}`} width="xs" inputMode="numeric" value={s[c.key]} onChange={(v) => set({ [c.key]: v } as Partial<Lesson4State>)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ShortInput id="l4-div75" label="75의 약수 (모두)" width="full" value={s.div75} onChange={(v) => set({ div75: v })} />
      <CheckBar verified={s.tableVerified} onCheck={() => withVerify(checkTable75(s), () => verify('tableVerified'))} />
    </Section>

    <Section badge="생각 톡톡" title="큰 수는 작은 수보다 약수가 항상 더 많을까?" tone="sky" testId="l4-talk">
      <div className="flex flex-wrap items-end gap-4 text-sm font-bold">
        <span className="inline-flex items-end gap-1.5">
          <ShortInput id="l4-talk6" label="6의 약수 개수" width="xs" inputMode="numeric" value={s.talk6} onChange={(v) => set({ talk6: v })} />
          <span className="pb-2">개</span>
        </span>
        <span className="inline-flex items-end gap-1.5">
          <ShortInput id="l4-talk9" label="9의 약수 개수" width="xs" inputMode="numeric" value={s.talk9} onChange={(v) => set({ talk9: v })} />
          <span className="pb-2">개</span>
        </span>
      </div>
      <ChoiceGroup
        name="talkAlways"
        ariaLabel="큰 수가 항상 약수가 더 많을까"
        value={s.talkAlways}
        options={[
          { value: 'yes', label: '항상 더 많다' },
          { value: 'no', label: '항상 그런 것은 아니다' },
        ]}
        onChange={(v) => set({ talkAlways: v })}
      />
      <CheckBar verified={s.talkVerified} onCheck={() => withVerify(checkTalk4(s), () => verify('talkVerified'))} />
    </Section>

    <Section badge="문제 4" title="소인수분해를 이용하여 다음 수의 약수를 모두 구하시오." tone="violet" testId="l4-p4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ShortInput id="l4-p4a" label="(1) 2² × 5²" width="full" value={s.p4a} onChange={(v) => set({ p4a: v })} />
        <ShortInput id="l4-p4b" label="(2) 54" width="full" value={s.p4b} onChange={(v) => set({ p4b: v })} />
      </div>
      <HintToggle>(1)은 2²의 약수(1, 2, 2²)와 5²의 약수(1, 5, 5²)로 표를 그려 보세요. (2)는 먼저 54를 소인수분해 해요.</HintToggle>
      <CheckBar verified={s.p4Verified} onCheck={() => withVerify(checkProblem4(s), () => verify('p4Verified'))} />
    </Section>

    <Section badge="도전 · 상" title="40의 약수는 모두 몇 개일까? 약수를 다 쓰지 않고 구해 보자." tone="amber" testId="l4-cnt40">
      <span className="inline-flex items-end gap-1.5 text-sm font-bold">
        <ShortInput id="l4-cnt40" label="40의 약수의 개수" width="xs" inputMode="numeric" value={s.cnt40} onChange={(v) => set({ cnt40: v })} />
        <span className="pb-2">개</span>
      </span>
      <TextAnswer id="l4-cnt40Reason" label="어떻게 구했는지 설명해 보자." value={s.cnt40Reason} min={L4_MIN_REASON} onChange={(v) => set({ cnt40Reason: v })} />
      <HintToggle>40 = 2³ × 5. 2³의 약수는 몇 개, 5의 약수는 몇 개일까요? 표의 칸 수를 생각해 보세요.</HintToggle>
      <CheckBar verified={s.cntVerified} onCheck={() => withVerify(checkCount40(s), () => verify('cntVerified'))} />
    </Section>
  </>
);


const CodingStep: React.FC<StepProps> = ({ s, set, verify }) => (
  <Section badge="교구 & 공학 도구" title="블록 코딩으로 소인수분해 하기" tone="violet" testId="l4-coding">
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-extrabold text-violet-900">
        <Blocks className="h-4 w-4" /> 블록 프로그램은 이런 순서로 소인수분해 해요
      </div>
      <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-800 break-keep">
        <li>자연수 하나를 입력받는다.</li>
        <li>나누는 수 i를 2로 정한다.</li>
        <li>
          입력한 수가 1이 될 때까지 반복한다.
          <ul className="mt-1 list-disc pl-5 space-y-0.5 text-slate-700">
            <li>i로 나누어떨어지면 → i를 소인수 목록에 넣고, 입력한 수를 i로 나눈다.</li>
            <li>나누어떨어지지 않으면 → i를 1만큼 키운다.</li>
          </ul>
        </li>
        <li>소인수 목록을 거듭제곱으로 정리해 말한다.</li>
      </ol>
      <p className="text-xs text-slate-600 break-keep">예: 600을 입력하면 2³ × 3 × 5²라고 말해요.</p>
    </div>
    {BLOCK_CODING_URL ? (
      <a
        href={BLOCK_CODING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-violet-700"
      >
        <ExternalLink className="h-4 w-4" /> 엔트리 블록 코딩 열기 (새 창)
      </a>
    ) : (
      <div data-testid="l4-coding-pending" className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 break-keep">
        🔗 블록 코딩 프로그램 연결은 선생님이 곧 열어 줄 거예요. 그동안 위 순서대로 공책에 직접 따라가 보며 결과를 구해 보세요.
      </div>
    )}
    <ShortInput id="l4-code5239" label="활동 1. 5239를 입력하여 소인수분해 해 보자. 5239 =" width="md" value={s.code5239} onChange={(v) => set({ code5239: v })} />
    <div className="flex flex-wrap items-end gap-3">
      <ShortInput id="l4-codeNum" label="활동 2. 다른 수를 입력해 보자. 입력한 수" width="sm" inputMode="numeric" value={s.codeNum} onChange={(v) => set({ codeNum: v })} />
      <ShortInput id="l4-codeResult" label="프로그램이 말한 결과" width="md" value={s.codeResult} onChange={(v) => set({ codeResult: v })} />
    </div>
    <CheckBar verified={s.codeVerified} onCheck={() => withVerify(checkCoding(s), () => verify('codeVerified'))} />
    {s.codeVerified && (
      <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
        <Sparkles className="h-4 w-4" /> 공학 도구를 쓰면 손으로 하기 힘든 큰 수도 쉽게 소인수분해 할 수 있어요.
      </p>
    )}
  </Section>
);

const ReviewStep: React.FC<StepProps> = ({ s, set, verify }) => {
  const toggle5 = (id: string) => {
    const cur = s.rv5Picks ?? [];
    set({ rv5Picks: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  const blanks: Array<[keyof Lesson4State, string]> = [
    ['rvBlank1', '① 2², 2³, 2⁴, …을 각각 2의 제곱, 2의 세제곱, 2의 네제곱, …이라 읽고, 이들을 통틀어 2의 (   )(이)라고 한다.'],
    ['rvBlank2a', '② 3⁴에서 곱하는 수 3을 거듭제곱의 (   )(이)라고 한다.'],
    ['rvBlank2b', '② 3이 곱해진 개수 4를 거듭제곱의 (   )(이)라고 한다.'],
    ['rvBlank3', '③ 어떤 자연수의 약수 중에서 소수인 것을 그 자연수의 (   )(이)라고 한다.'],
    ['rvBlank4', '④ 어떤 자연수를 그 수의 소인수들만의 곱으로 나타내는 것을 (   ) 한다고 한다.'],
  ];
  return (
    <>
      <Section badge="배운 내용 확인하기" title="빈칸에 알맞은 것을 고르시오." tone="emerald" testId="l4-rv-concept">
        {blanks.map(([key, sentence]) => (
          <div key={key} className="space-y-1.5">
            <p className="text-sm text-slate-800 break-keep">{sentence}</p>
            <ChoiceGroup name={key} ariaLabel={sentence} value={s[key] as string} options={RV_WORDS} onChange={(v) => set({ [key]: v } as Partial<Lesson4State>)} />
          </div>
        ))}
        <CheckBar verified={s.rvConceptVerified} onCheck={() => withVerify(checkReviewConcept(s), () => verify('rvConceptVerified'))} />
      </Section>

      <Section badge="확인 2 · 3" title="소인수 구하기 · 소인수분해 하기" tone="violet" testId="l4-rv23">
        <p className="text-sm font-extrabold text-slate-900">2. 다음 수의 소인수를 모두 구하시오.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {RV2_NUMBERS.map((n, i) => (
            <ShortInput key={n} id={`l4-${RV2_KEY[n]}`} label={`(${i + 1}) ${n}`} width="full" value={s[RV2_KEY[n]]} onChange={(v) => set({ [RV2_KEY[n]]: v } as Partial<Lesson4State>)} />
          ))}
        </div>
        <p className="text-sm font-extrabold text-slate-900">3. 다음 수를 소인수분해 하시오.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {RV3_NUMBERS.map((n, i) => (
            <ShortInput key={n} id={`l4-${RV3_KEY[n]}`} label={`(${i + 1}) ${n} =`} width="full" value={s[RV3_KEY[n]]} onChange={(v) => set({ [RV3_KEY[n]]: v } as Partial<Lesson4State>)} />
          ))}
        </div>
        <CheckBar verified={s.rv23Verified} onCheck={() => withVerify(checkReview23(s), () => verify('rv23Verified'))} />
      </Section>

      <Section badge="확인 5" title="다음에서 108의 약수를 모두 찾으시오." tone="violet" testId="l4-rv5">
        <div role="group" aria-label="108의 약수 고르기" className="flex flex-wrap gap-2">
          {RV5_OPTIONS.map((o) => {
            const on = (s.rv5Picks ?? []).includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle5(o.id)}
                className={`min-h-[42px] rounded-xl border-2 px-4 py-2 text-base font-extrabold mono ${
                  on ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-violet-400'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <CheckBar verified={s.rv5Verified} onCheck={() => withVerify(checkReview5(s), () => verify('rv5Verified'))} />
      </Section>

      <Section badge="확인 4 · 서술형" title="28 × □이(가) 어떤 자연수의 제곱이 되게 하려고 한다. □ 안에 들어갈 수 있는 가장 작은 자연수를 구하는 풀이 과정과 답을 쓰시오." tone="rose" testId="l4-rv4">
        <TextAnswer id="l4-rv4Reason" label="풀이" value={s.rv4Reason} min={L4_MIN_ESSAY} rows={5} onChange={(v) => set({ rv4Reason: v })} />
        <ShortInput id="l4-rv4Answer" label="답" width="xs" inputMode="numeric" value={s.rv4Answer} onChange={(v) => set({ rv4Answer: v })} />
        <HintToggle>28을 소인수분해 해 보세요. 어떤 자연수의 제곱은 소인수분해 했을 때 모든 지수가 짝수예요. (예: 6² = 2² × 3²)</HintToggle>
        <CheckBar verified={s.rv4Verified} onCheck={() => withVerify(checkReview4(s), () => verify('rv4Verified'))} />
      </Section>
    </>
  );
};
