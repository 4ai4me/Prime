import { COMMON_SPEC, cleanBySpec, fail, pass, patchWithVerify, verifyMap, type CheckResult, type FieldSpec } from './fieldSpec';
import { isReflectionDone, type LessonCommonState } from '../utils/lessonCommon';
import { isPrimeNumber, parseNumbers, sameNumberSet } from './powerExpr';

/**
 * 2차시 「소수를 어떻게 찾을 수 있을까?」 — 에라토스테네스의 체 (화면과 분리)
 * 단계: 0 함께하기·에라토스테네스의 체 / 1 문제 2 (51~100) / 2 배운 내용 확인하기 / 3 수학 이야기 / 4 성찰
 */

export type PCls = '' | 'prime' | 'composite' | 'neither';
export type OX = '' | 'o' | 'x';

export interface Lesson2State extends LessonCommonState {
  // 0. 에라토스테네스의 체 (1~50)
  sieveCircled?: number[];
  sieveCrossed?: number[];
  sieveVerified?: boolean;
  sieveReason?: string;
  sieveStop?: '' | '5' | '7' | '11' | '47';
  sievePrimes?: string;
  sieveQVerified?: boolean;
  // 1. 문제 2 (51~100)
  p2Picks?: number[];
  p2Verified?: boolean;
  // 2. 배운 내용 확인하기
  rvBlank1?: '' | 'prime' | 'composite';
  rvBlank2?: '' | 'prime' | 'composite';
  rv1_1?: PCls;
  rv1_12?: PCls;
  rv1_23?: PCls;
  rv1_41?: PCls;
  rv1_57?: PCls;
  rv1_74?: PCls;
  rv1Verified?: boolean;
  rvOx1?: OX;
  rvOx2?: OX;
  rvOx3?: OX;
  rvOx4?: OX;
  rvOxVerified?: boolean;
  rv3Picks?: number[];
  rv3Verified?: boolean;
  // 3. 수학 이야기 (2를 n번 곱한 수에서 1을 뺀 수)
  mer2?: PCls;
  mer3?: PCls;
  mer4?: PCls;
  mer5?: PCls;
  mer6?: PCls;
  mer7?: PCls;
  merVerified?: boolean;
}

export const SIEVE_MAX = 50;
export const L2_MIN_REASON = 10;

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const SIEVE_NUMBERS = range(1, SIEVE_MAX);
export const PRIMES_TO_50 = SIEVE_NUMBERS.filter(isPrimeNumber);
export const P2_NUMBERS = range(51, 100);
export const PRIMES_51_100 = P2_NUMBERS.filter(isPrimeNumber);

// ------------------------------------------------------------------
// 에라토스테네스의 체: 다음에 할 일 계산 (화면이 이 결과대로 안내)
// ------------------------------------------------------------------

export type SieveNext =
  | { kind: 'erase1' }
  | { kind: 'circle'; n: number; canFinish: boolean }
  | { kind: 'eraseMultiples'; p: number; multiples: number[] }
  | { kind: 'done' };

/** 지금 상태에서 다음에 할 일 */
export function sieveNext(circled: number[] | undefined, crossed: number[] | undefined, max = SIEVE_MAX): SieveNext {
  const c = new Set(circled ?? []);
  const x = new Set(crossed ?? []);
  if (!x.has(1)) return { kind: 'erase1' };
  // 마지막으로 ○한 수의 배수가 남아 있으면 먼저 지움
  const last = (circled ?? [])[(circled ?? []).length - 1];
  if (last !== undefined) {
    const multiples: number[] = [];
    for (let m = last * 2; m <= max; m += last) if (!x.has(m)) multiples.push(m);
    if (multiples.length) return { kind: 'eraseMultiples', p: last, multiples };
  }
  for (let n = 2; n <= max; n++) {
    if (!c.has(n) && !x.has(n)) return { kind: 'circle', n, canFinish: n * n > max };
  }
  return { kind: 'done' };
}

/** 체 판 상태 → 다음 상태 (클릭·버튼). 잘못된 동작은 message로 알려 주고 상태는 그대로 */
export function sieveClick(
  circled: number[] | undefined,
  crossed: number[] | undefined,
  n: number
): { circled: number[]; crossed: number[]; message?: string } {
  const c = [...(circled ?? [])];
  const x = [...(crossed ?? [])];
  const next = sieveNext(c, x);
  if (c.includes(n)) return { circled: c, crossed: x, message: `${n}에는 이미 ○표를 했어요.` };
  if (x.includes(n)) return { circled: c, crossed: x, message: `${n}은(는) 이미 지운 수예요.` };
  if (next.kind === 'erase1') {
    if (n === 1) return { circled: c, crossed: [...x, 1] };
    return { circled: c, crossed: x, message: '① 1은 소수가 아니므로 먼저 1을 지워요.' };
  }
  if (next.kind === 'eraseMultiples') {
    return { circled: c, crossed: x, message: `먼저 ${next.p}의 배수를 모두 지워요. [${next.p}의 배수 지우기]를 누르세요.` };
  }
  if (next.kind === 'circle') {
    if (n === next.n) return { circled: [...c, n], crossed: x };
    return { circled: c, crossed: x, message: `남은 수 중에서 가장 처음 수(가장 작은 수)에 ○표를 해요.` };
  }
  return { circled: c, crossed: x };
}

export function sieveEraseMultiples(circled: number[] | undefined, crossed: number[] | undefined): { circled: number[]; crossed: number[] } {
  const next = sieveNext(circled, crossed);
  if (next.kind !== 'eraseMultiples') return { circled: [...(circled ?? [])], crossed: [...(crossed ?? [])] };
  return { circled: [...(circled ?? [])], crossed: [...(crossed ?? []), ...next.multiples] };
}

/** 남은 수에 모두 ○ (다음 수의 제곱이 판의 끝보다 클 때만) */
export function sieveFinish(circled: number[] | undefined, crossed: number[] | undefined, max = SIEVE_MAX): { circled: number[]; crossed: number[] } {
  const next = sieveNext(circled, crossed, max);
  const c = [...(circled ?? [])];
  const x = [...(crossed ?? [])];
  if (next.kind !== 'circle' || !next.canFinish) return { circled: c, crossed: x };
  const rest = range(2, max).filter((n) => !c.includes(n) && !x.includes(n));
  return { circled: [...c, ...rest], crossed: x };
}

export function checkSieve(s: Lesson2State): CheckResult {
  const c = s.sieveCircled ?? [];
  const x = s.sieveCrossed ?? [];
  if (sieveNext(c, x).kind !== 'done') return fail('아직 ○표도 지우기도 하지 않은 수가 남아 있어요. 안내에 따라 끝까지 해 보세요.');
  if (!sameNumberSet(c, PRIMES_TO_50)) return fail('○표 한 수를 다시 확인해 보세요.');
  return pass(`○표 한 수 ${PRIMES_TO_50.length}개가 바로 1부터 50까지의 소수예요!`);
}

export function checkSieveQuestions(s: Lesson2State): CheckResult {
  const msgs: string[] = [];
  if ((s.sieveReason ?? '').trim().length < L2_MIN_REASON) msgs.push(`1. 2의 배수를 지우는 이유를 ${L2_MIN_REASON}자 이상 써 주세요.`);
  if (!sameNumberSet(parseNumbers(s.sievePrimes), PRIMES_TO_50)) msgs.push('2. 1부터 50까지의 소수를 빠짐없이, 정확히 썼는지 확인해 보세요.');
  if (s.sieveStop !== '7') msgs.push('3. 판에서 어떤 수의 배수를 지운 뒤부터 더 지울 수가 없었는지 다시 확인해 보세요.');
  if (msgs.length) return fail(...msgs);
  return pass(
    '2 이외의 2의 배수는 2를 약수로 가지므로 약수가 3개 이상인 합성수예요. 그래서 지워요. 또 7 × 7 = 49이므로 7의 배수까지만 지우면 50까지의 소수가 모두 남아요.'
  );
}

export function checkProblem2(s: Lesson2State): CheckResult {
  const picks = [...new Set(s.p2Picks ?? [])];
  const wrong = picks.filter((n) => !isPrimeNumber(n));
  const missing = PRIMES_51_100.filter((n) => !picks.includes(n)).length;
  const msgs: string[] = [];
  if (wrong.length) msgs.push(`${wrong.join(', ')}은(는) 소수가 아니에요. 2, 3, 5, 7로 나누어 보세요.`);
  if (missing) msgs.push(`아직 찾지 못한 소수가 ${missing}개 있어요.`);
  if (msgs.length) return fail(...msgs);
  return pass(`51부터 100까지의 소수는 ${PRIMES_51_100.join(', ')} (${PRIMES_51_100.length}개)!`);
}

// ------------------------------------------------------------------
// 배운 내용 확인하기
// ------------------------------------------------------------------

export const RV1_NUMBERS = [1, 12, 23, 41, 57, 74] as const;
export const RV1_KEY = { 1: 'rv1_1', 12: 'rv1_12', 23: 'rv1_23', 41: 'rv1_41', 57: 'rv1_57', 74: 'rv1_74' } as const;

function classOf(n: number): PCls {
  if (n === 1) return 'neither';
  return isPrimeNumber(n) ? 'prime' : 'composite';
}

export function checkReview1(s: Lesson2State): CheckResult {
  const msgs: string[] = [];
  if (s.rvBlank1 !== 'prime' || s.rvBlank2 !== 'composite') msgs.push('빈칸 ❶ ❷의 낱말을 다시 확인해 보세요.');
  const wrong = RV1_NUMBERS.filter((n) => s[RV1_KEY[n]] !== classOf(n));
  if (wrong.length) msgs.push(`1번에서 ${wrong.join(', ')}을(를) 다시 판단해 보세요.`);
  if (msgs.length) return fail(...msgs);
  return pass('23, 41은 소수, 12, 57, 74는 합성수, 1은 소수도 합성수도 아니에요. 57 = 3 × 19에 주의!');
}

export const OX_ITEMS = [
  { key: 'rvOx1', text: '(1) 소수의 약수는 2개이다.', answer: 'o' },
  { key: 'rvOx2', text: '(2) 소수는 모두 홀수이다.', answer: 'x' },
  { key: 'rvOx3', text: '(3) 약수가 2개인 합성수가 있다.', answer: 'x' },
  { key: 'rvOx4', text: '(4) 20보다 작은 소수는 8개이다.', answer: 'o' },
] as const;

export function checkReviewOx(s: Lesson2State): CheckResult {
  const wrong = OX_ITEMS.filter((it) => s[it.key] !== it.answer);
  if (wrong.length) return fail(`${wrong.map((w) => w.text.slice(0, 3)).join(', ')}을(를) 다시 생각해 보세요.`);
  return pass('2는 짝수인 소수, 합성수의 약수는 3개 이상, 20보다 작은 소수는 2, 3, 5, 7, 11, 13, 17, 19로 8개!');
}

/** 3번 훈민정음 글의 밑줄 친 수 */
export const RV3_NUMBERS = [25, 17, 11, 28, 4, 14, 10] as const;

export function checkReview3(s: Lesson2State): CheckResult {
  const want = RV3_NUMBERS.filter(isPrimeNumber);
  if (sameNumberSet(s.rv3Picks ?? [], want)) return pass('밑줄 친 수 중 소수는 17과 11!');
  return fail('밑줄 친 수를 하나씩 약수의 개수로 판단해 보세요.');
}

// ------------------------------------------------------------------
// 수학 이야기: 2를 n번 곱한 수에서 1을 뺀 수
// ------------------------------------------------------------------

export const MER_NS = [2, 3, 4, 5, 6, 7] as const;
export const MER_KEY = { 2: 'mer2', 3: 'mer3', 4: 'mer4', 5: 'mer5', 6: 'mer6', 7: 'mer7' } as const;
export const merValue = (n: number) => 2 ** n - 1;

export function checkMersenne(s: Lesson2State): CheckResult {
  const wrong = MER_NS.filter((n) => s[MER_KEY[n]] !== classOf(merValue(n)));
  if (wrong.length) return fail(`${wrong.map((n) => `${n}번 곱한 경우`).join(', ')}를 다시 판단해 보세요. 수를 먼저 계산하고 약수를 찾아요.`);
  return pass('3, 7, 31, 127은 소수, 15와 63은 합성수! 이런 모양의 수 중에서 아주 큰 소수가 계속 발견되고 있어요.');
}

// ------------------------------------------------------------------
// 단계 완료 · 정리
// ------------------------------------------------------------------

export function evaluateLesson2Completion(state: LessonCommonState): boolean[] {
  const s = state as Lesson2State;
  return [
    Boolean(s.sieveVerified && s.sieveQVerified),
    Boolean(s.p2Verified),
    Boolean(s.rv1Verified && s.rvOxVerified && s.rv3Verified),
    Boolean(s.merVerified),
    isReflectionDone(s),
  ];
}

const cls = { oneOf: ['prime', 'composite', 'neither'] } as const;
const ox = { oneOf: ['o', 'x'] } as const;
const pc = { oneOf: ['prime', 'composite'] } as const;
export const LESSON2_SPEC: FieldSpec = {
  sieveCircled: 'numArray', sieveCrossed: 'numArray', sieveVerified: 'bool',
  sieveReason: 'string', sieveStop: { oneOf: ['5', '7', '11', '47'] }, sievePrimes: 'string', sieveQVerified: 'bool',
  p2Picks: 'numArray', p2Verified: 'bool',
  rvBlank1: pc, rvBlank2: pc,
  rv1_1: cls, rv1_12: cls, rv1_23: cls, rv1_41: cls, rv1_57: cls, rv1_74: cls, rv1Verified: 'bool',
  rvOx1: ox, rvOx2: ox, rvOx3: ox, rvOx4: ox, rvOxVerified: 'bool',
  rv3Picks: 'numArray', rv3Verified: 'bool',
  mer2: cls, mer3: cls, mer4: cls, mer5: cls, mer6: cls, mer7: cls, merVerified: 'bool',
  ...COMMON_SPEC,
};

export function cleanLesson2State(raw: unknown): Lesson2State {
  return cleanBySpec<Lesson2State>(raw, LESSON2_SPEC);
}

const VERIFY_OF = verifyMap<Lesson2State>([
  ['sieveVerified', ['sieveCircled', 'sieveCrossed']],
  ['sieveQVerified', ['sieveReason', 'sieveStop', 'sievePrimes']],
  ['p2Verified', ['p2Picks']],
  ['rv1Verified', ['rvBlank1', 'rvBlank2', 'rv1_1', 'rv1_12', 'rv1_23', 'rv1_41', 'rv1_57', 'rv1_74']],
  ['rvOxVerified', ['rvOx1', 'rvOx2', 'rvOx3', 'rvOx4']],
  ['rv3Verified', ['rv3Picks']],
  ['merVerified', ['mer2', 'mer3', 'mer4', 'mer5', 'mer6', 'mer7']],
]);

export function patchLesson2(prev: Lesson2State, patch: Partial<Lesson2State>): Lesson2State {
  return patchWithVerify(prev, patch, VERIFY_OF);
}
