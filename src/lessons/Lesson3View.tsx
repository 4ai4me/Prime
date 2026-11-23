import React, { useState } from 'react';
import { BookOpen, Microscope, Sparkles } from 'lucide-react';
import type { LessonViewProps } from './index';
import { ReflectionStep } from './ReflectionStep';
import { CheckBar, ChoiceGroup, ConceptBox, HintToggle, Note, Section, ShortInput, StepFooter, TextAnswer, withVerify } from './ui';
import {
  CHALLENGE_LIMIT,
  L3_MIN_REASON,
  L3_POWER_ITEMS,
  MICRO_DAYS,
  WORD_OPTIONS,
  checkChallenge3,
  checkConcept3,
  checkMisconception3,
  checkOpen3,
  checkProblem3,
  patchLesson3,
  type Lesson3State,
} from './lesson3Logic';
import { getCurriculumLesson } from './curriculum';

/**
 * 3차시 「거듭제곱이란 무엇일까?」 (교과서 중단원 2. 소인수분해 ①)
 * 0 생각 열기 / 1 거듭제곱의 뜻 / 2 문제 1 / 3 오개념 점검 / 4 도전 / 5 성찰
 */

const DAY_KEYS = ['microDay1', 'microDay2', 'microDay3', 'microDay4', 'microDay5'] as const;

export const Lesson3View: React.FC<LessonViewProps<Lesson3State>> = ({ step, state: s, onStepChange, onUpdate, onGoToNextLesson }) => {
  const set = (patch: Partial<Lesson3State>) => onUpdate((prev) => patchLesson3(prev, patch)); // 고친 문항의 ✓는 지움
  const verify = (key: keyof Lesson3State) => onUpdate((prev) => ({ ...prev, [key]: true }));
  const total = getCurriculumLesson(3).stages.length;

  return (
    <div className="space-y-5">
      {step === 0 && <MicrobeStep s={s} set={set} verify={verify} />}

      {step === 1 && (
        <Section badge="개념" title="거듭제곱" tone="emerald" testId="l3-concept">
          <ConceptBox>
            <p>같은 수를 여러 번 곱할 때는 곱하는 수와 그 수가 곱해진 개수를 이용하여 간단히 나타낸다.</p>
            <p className="mono font-bold text-center text-lg">2 × 2 = 2² &nbsp;&nbsp; 2 × 2 × 2 = 2³ &nbsp;&nbsp; 2 × 2 × 2 × 2 = 2⁴ &nbsp; …</p>
            <p>
              2², 2³, 2⁴, …을 각각 2의 제곱, 2의 세제곱, 2의 네제곱, …이라 읽고, 이들을 통틀어 2의{' '}
              <strong className="text-rose-700">거듭제곱</strong>이라고 한다. 곱하는 수 2를 거듭제곱의{' '}
              <strong className="text-rose-700">밑</strong>, 2가 곱해진 개수 2, 3, 4, …를 거듭제곱의{' '}
              <strong className="text-rose-700">지수</strong>라고 한다.
            </p>
            <div className="flex items-center justify-center gap-6 pt-1">
              <div className="relative inline-block text-4xl font-extrabold mono text-slate-900">
                2<sup className="text-2xl text-rose-600">4</sup>
              </div>
              <div className="text-sm text-slate-700">
                <div>
                  위의 작은 수 <strong className="text-rose-600">4</strong> → 지수 (곱해진 개수)
                </div>
                <div>
                  아래의 큰 수 <strong>2</strong> → 밑 (곱하는 수)
                </div>
              </div>
            </div>
          </ConceptBox>
          <div className="grid gap-2 sm:grid-cols-2">
            <Note>2¹ = 2로 정한다.</Note>
            <Note>거듭제곱은 '반복하여 스스로 곱한다'는 뜻이고, 지수(指數)의 指는 '가리키다'라는 뜻이에요.</Note>
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
            <p className="text-sm font-extrabold text-slate-900">1. 2³을 바르게 읽은 것을 고르세요.</p>
            <ChoiceGroup
              name="read23"
              ariaLabel="2³ 읽기"
              value={s.read23}
              options={[
                { value: 'square3', label: '3의 제곱' },
                { value: 'cube2', label: '2의 세제곱' },
                { value: 'times3', label: '2의 3배' },
              ]}
              onChange={(v) => set({ read23: v })}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/40 p-3.5 space-y-2">
              <div className="text-xs font-bold text-teal-700">보기 ①</div>
              <div className="text-center text-lg font-extrabold mono">3 × 3 × 3 × 3 = 3⁴</div>
              <div className="flex flex-wrap items-end gap-3 text-sm">
                <ShortInput id="l3-bogiBase34" label="밑" width="xs" inputMode="numeric" value={s.bogiBase34} onChange={(v) => set({ bogiBase34: v })} />
                <ShortInput id="l3-bogiExp34" label="지수" width="xs" inputMode="numeric" value={s.bogiExp34} onChange={(v) => set({ bogiExp34: v })} />
              </div>
            </div>
            <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-3.5 space-y-2">
              <div className="text-xs font-bold text-amber-700">보기 ②</div>
              <div className="text-center text-lg font-extrabold mono">5 × 5 × 5 × 7 × 7 = 5³ × 7²</div>
              <div className="flex flex-wrap items-end gap-3 text-sm">
                <ShortInput id="l3-bogiExp5" label="밑 5의 지수" width="xs" inputMode="numeric" value={s.bogiExp5} onChange={(v) => set({ bogiExp5: v })} />
                <ShortInput id="l3-bogiExp7" label="밑 7의 지수" width="xs" inputMode="numeric" value={s.bogiExp7} onChange={(v) => set({ bogiExp7: v })} />
              </div>
              <p className="text-xs text-slate-600 break-keep">밑이 서로 다르면 더 간단히 나타낼 수 없고, 밑이 작은 수부터 차례로 써요.</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
            <p className="text-sm font-extrabold text-slate-900">2. 빈칸에 알맞은 낱말을 고르세요.</p>
            {(
              [
                ['blankPower', '① 2², 2³, 2⁴, …을 통틀어 2의 (    )(이)라고 한다.'],
                ['blankBase', '② 3⁴에서 곱하는 수 3을 거듭제곱의 (    )(이)라고 한다.'],
                ['blankExp', '③ 3⁴에서 3이 곱해진 개수 4를 거듭제곱의 (    )(이)라고 한다.'],
              ] as const
            ).map(([key, sentence]) => (
              <div key={key} className="space-y-1.5">
                <p className="text-sm text-slate-800 break-keep">{sentence}</p>
                <ChoiceGroup name={key} ariaLabel={sentence} value={s[key]} options={WORD_OPTIONS} onChange={(v) => set({ [key]: v } as Partial<Lesson3State>)} />
              </div>
            ))}
          </div>
          <HintToggle>2³ = 2 × 2 × 2 → 2를 3번 곱했어요. 밑은 "곱하는 수", 지수는 "곱해진 개수"예요.</HintToggle>
          <CheckBar verified={s.conceptVerified} onCheck={() => withVerify(checkConcept3(s), () => verify('conceptVerified'))} />
        </Section>
      )}

      {step === 2 && (
        <Section badge="문제 1" title="다음을 거듭제곱으로 나타내시오." tone="violet" testId="l3-p1">
          <p className="text-xs text-slate-600 break-keep">
            아래 수학 기호 입력기의 ², ³, ⁴, ⁵ 버튼을 쓰거나, 키보드로 <span className="mono">^</span>를 쓴 뒤 지수를 써도 돼요. (예: 2^5)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {L3_POWER_ITEMS.map((it) => (
              <div key={it.key} className="rounded-xl border border-slate-200 p-3.5 space-y-2">
                <div className="text-xs font-bold text-violet-700">{it.label.startsWith('확인') ? '배운 내용 확인하기 1' : '문제 1'} · {it.label.split('-')[1]}</div>
                <div className="text-base font-extrabold mono text-slate-900 break-all">{it.expr}</div>
                <ShortInput id={`l3-${it.key}`} ariaLabel={`${it.expr}를 거듭제곱으로`} width="full" value={s[it.key]} onChange={(v) => set({ [it.key]: v } as Partial<Lesson3State>)} />
              </div>
            ))}
          </div>
          <HintToggle>같은 수끼리 모아 몇 번 곱했는지 세어 보세요. 밑이 다른 수가 섞여 있으면 작은 수부터 거듭제곱의 곱으로 써요.</HintToggle>
          <CheckBar verified={s.p1Verified} onCheck={() => withVerify(checkProblem3(s), () => verify('p1Verified'))} />
        </Section>
      )}

      {step === 3 && (
        <Section badge="오개념 점검" title="밑과 지수를 헷갈리지 않았나요?" tone="rose" testId="l3-mis">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
              <p className="text-sm font-extrabold">1. 값을 구해 보세요.</p>
              <div className="flex flex-wrap items-center gap-2 text-lg font-extrabold mono">
                <span>2³ =</span>
                <ShortInput id="l3-mis23" ariaLabel="2의 세제곱 값" width="xs" inputMode="numeric" value={s.mis23} onChange={(v) => set({ mis23: v })} />
                <span className="ml-3">3² =</span>
                <ShortInput id="l3-mis32" ariaLabel="3의 제곱 값" width="xs" inputMode="numeric" value={s.mis32} onChange={(v) => set({ mis32: v })} />
              </div>
              <ChoiceGroup
                name="misBigger"
                ariaLabel="어느 쪽이 클까"
                value={s.misBigger}
                options={[
                  { value: 'a', label: '2³이 더 크다' },
                  { value: 'b', label: '3²이 더 크다' },
                  { value: 'same', label: '같다' },
                ]}
                onChange={(v) => set({ misBigger: v })}
              />
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
              <p className="text-sm font-extrabold break-keep">2. 친구가 "3³ = 3 × 3 = 9"라고 했어요. 바르게 고쳐 보세요.</p>
              <div className="flex items-center gap-2 text-lg font-extrabold mono">
                <span>3³ =</span>
                <ShortInput id="l3-mis33" ariaLabel="3의 세제곱 값" width="xs" inputMode="numeric" value={s.mis33} onChange={(v) => set({ mis33: v })} />
              </div>
            </div>
          </div>
          <TextAnswer id="l3-misReason" label="3. 친구는 무엇을 헷갈렸을까요? (밑, 지수라는 말을 써서)" value={s.misReason} min={L3_MIN_REASON} onChange={(v) => set({ misReason: v })} />
          <HintToggle>2³은 2를 3번 곱한 것이고, 3²은 3을 2번 곱한 것이에요. 3 × 3은 3을 몇 번 곱한 것일까요?</HintToggle>
          <CheckBar verified={s.misVerified} onCheck={() => withVerify(checkMisconception3(s), () => verify('misVerified'))} />
        </Section>
      )}

      {step === 4 && <PowerChallenge s={s} set={set} verify={verify} />}

      {step === 5 && (
        <>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 sm:p-5 text-sm leading-relaxed break-keep">
            <div className="flex items-center gap-2 font-extrabold text-violet-900">
              <BookOpen className="h-4 w-4" /> 오늘의 핵심
            </div>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-800">
              <li>같은 수를 여러 번 곱한 것을 거듭제곱으로 간단히 나타내요. (2 × 2 × 2 = 2³)</li>
              <li>밑: 곱하는 수, 지수: 곱해진 개수. 2³과 3²은 서로 달라요.</li>
              <li>밑이 다른 거듭제곱의 곱(5³ × 7²)은 밑이 작은 수부터 차례로 써요.</li>
            </ul>
          </div>
          <Section badge="성찰" title="이번 차시를 돌아보자" tone="emerald" testId="l3-reflect">
            <ReflectionStep lesson={3} state={s} onChange={(patch) => set(patch)} />
          </Section>
        </>
      )}

      <StepFooter step={step} total={total} onStepChange={onStepChange} onGoToNextLesson={onGoToNextLesson} nextLessonLabel="4차시 · 소인수분해로" />
    </div>
  );
};

type StepProps = {
  s: Lesson3State;
  set: (patch: Partial<Lesson3State>) => void;
  verify: (key: keyof Lesson3State) => void;
};

const MicrobeStep: React.FC<StepProps> = ({ s, set, verify }) => {
  const [day, setDay] = useState(0);
  const count = 2 ** day;
  return (
    <Section badge="생각 열기" title="미생물은 며칠 뒤 몇 마리가 될까?" tone="amber" testId="l3-open">
      <div className="flex gap-3 rounded-xl bg-amber-50/70 border border-amber-200 p-4 text-sm leading-relaxed text-slate-800 break-keep">
        <Microscope className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          현미경으로 미생물 1마리를 관찰하고 있어요. 이 미생물은 <strong>하루가 지날 때마다 2배</strong>가 돼요. 하루가 지나면
          2마리, 이틀 후에는 2 × 2 = 4(마리)가 되겠지요?
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setDay((d) => Math.min(5, d + 1))}
            disabled={day >= 5}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-amber-600 disabled:opacity-40"
          >
            하루 지나기 ▶
          </button>
          <button type="button" onClick={() => setDay(0)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600">
            처음으로
          </button>
          <span className="text-sm font-bold text-slate-800">
            {day === 0 ? '오늘' : `${day}일 후`}
          </span>
        </div>
        <div data-testid="l3-microbes" className="flex flex-wrap gap-1 min-h-[28px]" aria-label={`미생물 ${count}마리`}>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className="inline-block h-5 w-5 rounded-full bg-gradient-to-br from-sky-300 to-sky-600 border border-sky-700/40" />
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-center">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-600">
              <th className="px-2 py-2">지난 날</th>
              {MICRO_DAYS.map((d) => (
                <th key={d} className="px-2 py-2">
                  {d}일 후
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="px-2 py-2 text-xs text-slate-600">마리 수</th>
              {MICRO_DAYS.map((d, i) => (
                <td key={d} className="px-1 py-2">
                  <ShortInput id={`l3-${DAY_KEYS[i]}`} ariaLabel={`${d}일 후 마리 수`} width="xs" inputMode="numeric" value={s[DAY_KEYS[i]]} onChange={(v) => set({ [DAY_KEYS[i]]: v } as Partial<Lesson3State>)} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <ShortInput id="l3-microExpr" label="미생물 1마리가 5일 후에는 모두 몇 마리가 되는지 식으로 나타내 보자." width="full" value={s.microExpr} onChange={(v) => set({ microExpr: v })} />
      <HintToggle>하루마다 "× 2"가 하나씩 늘어나요. 1일 후 2, 2일 후 2 × 2, 3일 후 2 × 2 × 2, …</HintToggle>
      <CheckBar verified={s.openVerified} onCheck={() => withVerify(checkOpen3(s), () => verify('openVerified'))} />
    </Section>
  );
};

const PowerChallenge: React.FC<StepProps> = ({ s, set, verify }) => {
  const [n, setN] = useState(5);
  return (
    <Section badge="도전" title={`미생물이 처음으로 ${CHALLENGE_LIMIT}마리를 넘는 날은 며칠 후일까?`} tone="amber" testId="l3-challenge">
      <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
        <p className="text-sm text-slate-700 break-keep">지수를 바꿔 가며 2의 거듭제곱을 계산해 보세요.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" aria-label="지수 줄이기" onClick={() => setN((x) => Math.max(1, x - 1))} className="h-10 w-10 rounded-xl border border-slate-300 text-lg font-extrabold">
            −
          </button>
          <span data-testid="l3-power-calc" className="text-2xl font-extrabold mono">
            2<sup className="text-base text-rose-600">{n}</sup> = {(2 ** n).toLocaleString('ko-KR')}
          </span>
          <button type="button" aria-label="지수 늘리기" onClick={() => setN((x) => Math.min(20, x + 1))} className="h-10 w-10 rounded-xl border border-slate-300 text-lg font-extrabold">
            +
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <span className="inline-flex items-end gap-1.5 text-sm font-bold">
          <ShortInput id="l3-chDay" label="처음 넘는 날" width="xs" inputMode="numeric" value={s.chDay} onChange={(v) => set({ chDay: v })} />
          <span className="pb-2">일 후</span>
        </span>
        <ShortInput id="l3-chExpr" label="그날의 마리 수 (거듭제곱으로)" width="sm" value={s.chExpr} onChange={(v) => set({ chExpr: v })} />
      </div>
      <HintToggle>n일 후의 마리 수는 2ⁿ마리예요. 1000보다 처음 커지는 n을 찾아보세요.</HintToggle>
      <CheckBar verified={s.chVerified} onCheck={() => withVerify(checkChallenge3(s), () => verify('chVerified'))} />
      {s.chVerified && (
        <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
          <Sparkles className="h-4 w-4" /> 거듭제곱을 쓰면 아주 큰 수도 짧게 나타낼 수 있어요!
        </p>
      )}
    </Section>
  );
};
