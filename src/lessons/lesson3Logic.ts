import { COMMON_SPEC, cleanBySpec, fail, pass, patchWithVerify, verifyMap, type CheckResult, type FieldSpec } from './fieldSpec';
import { isReflectionDone, type LessonCommonState } from '../utils/lessonCommon';
import { checkPowerForm, parseProduct, type PowerFactor } from './powerExpr';

/**
 * 3차시 「거듭제곱이란 무엇일까?」 — 형식·점검·완료 (화면과 분리)
 * 단계: 0 생각 열기(미생물) / 1 거듭제곱의 뜻 / 2 문제 1 / 3 오개념 점검 / 4 도전 / 5 성찰
 */

export type Word = '' | 'power' | 'base' | 'exponent' | 'multiple';

export interface Lesson3State extends LessonCommonState {
  // 0. 생각 열기
  microDay1?: string;
  microDay2?: string;
  microDay3?: string;
  microDay4?: string;
  microDay5?: string;
  microExpr?: string;
  openVerified?: boolean;
  // 1. 거듭제곱의 뜻
  read23?: '' | 'cube2' | 'square3' | 'times3';
  bogiBase34?: string;
  bogiExp34?: string;
  bogiExp5?: string;
  bogiExp7?: string;
  blankPower?: Word;
  blankBase?: Word;
  blankExp?: Word;
  conceptVerified?: boolean;
  // 2. 문제 1 (+ 배운 내용 확인하기 1)
  p1a?: string;
  p1b?: string;
  c1a?: string;
  c1b?: string;
  p1Verified?: boolean;
  // 3. 오개념 점검
  mis23?: string;
  mis32?: string;
  misBigger?: '' | 'a' | 'b' | 'same';
  mis33?: string;
  misReason?: string;
  misVerified?: boolean;
  // 4. 도전
  chDay?: string;
  chExpr?: string;
  chVerified?: boolean;
}

export const L3_MIN_REASON = 10;
export const MICRO_DAYS = [1, 2, 3, 4, 5] as const;
export const CHALLENGE_LIMIT = 1000;

const ones = (base: number, count: number): PowerFactor[] => Array.from({ length: count }, () => ({ base, exp: 1 }));

/** 문제 1과 확인하기 1의 원래 식 */
export const L3_POWER_ITEMS: { key: 'p1a' | 'p1b' | 'c1a' | 'c1b'; label: string; expr: string; factors: PowerFactor[] }[] = [
  { key: 'p1a', label: '문제 1-(1)', expr: '4 × 4 × 4', factors: ones(4, 3) },
  { key: 'p1b', label: '문제 1-(2)', expr: '2 × 2 × 2 × 2 × 7 × 7 × 7', factors: [...ones(2, 4), ...ones(7, 3)] },
  { key: 'c1a', label: '확인 1-(1)', expr: '3 × 3 × 3 × 3 × 3 × 3', factors: ones(3, 6) },
  { key: 'c1b', label: '확인 1-(2)', expr: '2 × 5 × 2 × 2 × 5', factors: [2, 5, 2, 2, 5].map((b) => ({ base: b, exp: 1 })) },
];

const num = (t: string | undefined) => (/^\s*\d+\s*$/.test(t ?? '') ? Number(t) : null);

export function checkOpen3(s: Lesson3State): CheckResult {
  const keys = ['microDay1', 'microDay2', 'microDay3', 'microDay4', 'microDay5'] as const;
  const wrong = MICRO_DAYS.filter((d, i) => num(s[keys[i]]) !== 2 ** d);
  if (wrong.length) return fail(`${wrong.map((d) => `${d}일 후`).join(', ')}의 마리 수를 다시 확인해 보세요. 하루가 지날 때마다 2배가 돼요.`);
  const p = parseProduct(s.microExpr);
  if (!p || p.value !== 32 || p.factors.some((f) => f.base !== 2)) {
    return fail('5일 후의 마리 수를 "1마리에 2를 몇 번 곱했는지" 보이는 곱셈식으로 써 보세요.');
  }
  return pass('5일 후에는 2 × 2 × 2 × 2 × 2 = 32마리! 같은 수 2를 5번 곱했어요. 이걸 간단히 쓰는 방법을 배워 볼까요?');
}

export const WORD_OPTIONS: { value: Exclude<Word, ''>; label: string }[] = [
  { value: 'power', label: '거듭제곱' },
  { value: 'base', label: '밑' },
  { value: 'exponent', label: '지수' },
  { value: 'multiple', label: '배수' },
];

export function checkConcept3(s: Lesson3State): CheckResult {
  const msgs: string[] = [];
  if (s.read23 !== 'cube2') msgs.push('2³을 읽는 방법을 다시 골라 보세요. 2를 몇 번 곱한 것인지 생각해 보세요.');
  if (num(s.bogiBase34) !== 3 || num(s.bogiExp34) !== 4) msgs.push('3⁴의 밑과 지수를 다시 확인해 보세요. 밑은 곱하는 수, 지수는 곱한 개수예요.');
  if (num(s.bogiExp5) !== 3 || num(s.bogiExp7) !== 2) msgs.push('5³ × 7²에서 5와 7이 각각 몇 번 곱해졌는지 세어 보세요.');
  if (s.blankPower !== 'power' || s.blankBase !== 'base' || s.blankExp !== 'exponent') msgs.push('개념 정리 빈칸의 낱말을 다시 확인해 보세요.');
  if (msgs.length) return fail(...msgs);
  return pass('2³은 2의 세제곱, 3⁴의 밑은 3·지수는 4! 밑이 다른 5³ × 7²는 더 간단히 나타낼 수 없어요.');
}

export function checkProblem3(s: Lesson3State): CheckResult {
  const msgs: string[] = [];
  for (const it of L3_POWER_ITEMS) {
    const r = checkPowerForm(s[it.key], it.factors);
    if (!r.ok) msgs.push(`${it.label}: ${r.reason}`);
  }
  if (msgs.length) return fail(...msgs);
  return pass('4³, 2⁴ × 7³, 3⁶, 2³ × 5² — 모두 맞아요! 곱하는 순서가 섞여 있어도 같은 수끼리 모아 거듭제곱으로 나타내요.');
}

export function checkMisconception3(s: Lesson3State): CheckResult {
  const msgs: string[] = [];
  if (num(s.mis23) !== 8 || num(s.mis32) !== 9) msgs.push('2³과 3²의 값을 다시 계산해 보세요. 2³ = 2 × 2 × 2예요.');
  if (s.misBigger !== 'b') msgs.push('두 값 중 어느 쪽이 큰지 다시 골라 보세요.');
  if (num(s.mis33) !== 27) msgs.push('3³은 3을 몇 번 곱한 것인지 생각하고 값을 다시 구해 보세요.');
  if ((s.misReason ?? '').trim().length < L3_MIN_REASON) msgs.push(`친구가 무엇을 헷갈렸는지 ${L3_MIN_REASON}자 이상 써 주세요.`);
  if (msgs.length) return fail(...msgs);
  return pass('2³ = 8, 3² = 9로 서로 달라요. 3³ = 3 × 3 × 3 = 27이고, 3 × 3 = 9는 3³이 아니라 3²이에요. 밑과 지수를 바꾸거나 곱셈을 덧셈처럼 계산하지 않도록 해요.');
}

/** 1마리가 매일 2배 → n일 후 2ⁿ마리. 처음으로 LIMIT를 넘는 날 */
export function firstDayOver(limit: number): number {
  let d = 0;
  while (2 ** d <= limit) d++;
  return d;
}

export function checkChallenge3(s: Lesson3State): CheckResult {
  const day = firstDayOver(CHALLENGE_LIMIT);
  if (num(s.chDay) !== day) return fail('2를 한 번씩 더 곱해 보며 처음으로 1000마리를 넘는 날을 찾아보세요. (넘는 날 = 1000보다 커지는 첫날)');
  const p = parseProduct(s.chExpr);
  if (!p || p.factors.length !== 1 || p.factors[0].base !== 2 || p.factors[0].exp !== day) {
    return fail('그날의 마리 수를 거듭제곱 하나로 나타내 보세요. (밑은 2)');
  }
  return pass(`${day}일 후에 2^${day} = ${2 ** day}마리로 처음 1000마리를 넘어요. ${day - 1}일 후는 ${2 ** (day - 1)}마리였어요.`);
}

export function evaluateLesson3Completion(state: LessonCommonState): boolean[] {
  const s = state as Lesson3State;
  return [
    Boolean(s.openVerified),
    Boolean(s.conceptVerified),
    Boolean(s.p1Verified),
    Boolean(s.misVerified),
    Boolean(s.chVerified),
    isReflectionDone(s),
  ];
}

const wordKind = { oneOf: ['power', 'base', 'exponent', 'multiple'] } as const;
export const LESSON3_SPEC: FieldSpec = {
  microDay1: 'string', microDay2: 'string', microDay3: 'string', microDay4: 'string', microDay5: 'string',
  microExpr: 'string', openVerified: 'bool',
  read23: { oneOf: ['cube2', 'square3', 'times3'] },
  bogiBase34: 'string', bogiExp34: 'string', bogiExp5: 'string', bogiExp7: 'string',
  blankPower: wordKind, blankBase: wordKind, blankExp: wordKind, conceptVerified: 'bool',
  p1a: 'string', p1b: 'string', c1a: 'string', c1b: 'string', p1Verified: 'bool',
  mis23: 'string', mis32: 'string', misBigger: { oneOf: ['a', 'b', 'same'] }, mis33: 'string', misReason: 'string', misVerified: 'bool',
  chDay: 'string', chExpr: 'string', chVerified: 'bool',
  ...COMMON_SPEC,
};

export function cleanLesson3State(raw: unknown): Lesson3State {
  return cleanBySpec<Lesson3State>(raw, LESSON3_SPEC);
}

const VERIFY_OF = verifyMap<Lesson3State>([
  ['openVerified', ['microDay1', 'microDay2', 'microDay3', 'microDay4', 'microDay5', 'microExpr']],
  ['conceptVerified', ['read23', 'bogiBase34', 'bogiExp34', 'bogiExp5', 'bogiExp7', 'blankPower', 'blankBase', 'blankExp']],
  ['p1Verified', ['p1a', 'p1b', 'c1a', 'c1b']],
  ['misVerified', ['mis23', 'mis32', 'misBigger', 'mis33', 'misReason']],
  ['chVerified', ['chDay', 'chExpr']],
]);

export function patchLesson3(prev: Lesson3State, patch: Partial<Lesson3State>): Lesson3State {
  return patchWithVerify(prev, patch, VERIFY_OF);
}
