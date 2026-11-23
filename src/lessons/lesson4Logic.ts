import { COMMON_SPEC, cleanBySpec, fail, pass, patchWithVerify, verifyMap, type CheckResult, type FieldSpec } from './fieldSpec';
import { isReflectionDone, type LessonCommonState } from '../utils/lessonCommon';
import {
  checkPrimeFactorization,
  divisorList,
  formatPrimeFactorization,
  isPrimeNumber,
  parseNumbers,
  primeFactorsOf,
  sameNumberSet,
} from './powerExpr';

/**
 * 4차시 「소인수분해는 어떻게 할까?」 — 형식·점검·완료 (화면과 분리)
 * 단계: 0 생각 열기·소인수 / 1 소인수분해·함께하기 / 2 예제 1·문제 3 / 3 약수 구하기
 *       4 블록 코딩(외부) / 5 배운 내용 확인하기 / 6 성찰
 */

export type RvWord = '' | 'power' | 'base' | 'exponent' | 'primeFactor' | 'factorization' | 'divisor';

export interface Lesson4State extends LessonCommonState {
  // 0. 생각 열기 · 소인수 · 문제 2
  openB2?: string;
  openB3?: string;
  openDiv12?: string;
  openPrime12?: string;
  openVerified?: boolean;
  p2_16?: string;
  p2_33?: string;
  p2_42?: string;
  p2_80?: string;
  p2Verified?: boolean;
  // 1. 함께하기 · 24를 두 순서로
  tree1?: number[];
  tree2?: number[];
  tree1Result?: string;
  tree2Result?: string;
  treeSame?: '' | 'same' | 'diff';
  treeVerified?: boolean;
  // 2. 예제 1 (90, 나눗셈) · 문제 3
  ladder90?: number[];
  result90?: string;
  ex1Verified?: boolean;
  p3_32?: string;
  p3_63?: string;
  p3_98?: string;
  p3_150?: string;
  p3Verified?: boolean;
  // 3. 소인수분해로 약수 구하기
  t75a?: string;
  t75b?: string;
  t75c?: string;
  t75d?: string;
  t75e?: string;
  t75f?: string;
  div75?: string;
  tableVerified?: boolean;
  talk6?: string;
  talk9?: string;
  talkAlways?: '' | 'yes' | 'no';
  talkVerified?: boolean;
  p4a?: string;
  p4b?: string;
  p4Verified?: boolean;
  cnt40?: string;
  cnt40Reason?: string;
  cntVerified?: boolean;
  // 4. 블록 코딩 (외부 프로그램 실행 결과)
  code5239?: string;
  codeNum?: string;
  codeResult?: string;
  codeVerified?: boolean;
  // 5. 배운 내용 확인하기
  rvBlank1?: RvWord;
  rvBlank2a?: RvWord;
  rvBlank2b?: RvWord;
  rvBlank3?: RvWord;
  rvBlank4?: RvWord;
  rvConceptVerified?: boolean;
  rv2_18?: string;
  rv2_26?: string;
  rv2_35?: string;
  rv2_84?: string;
  rv3_45?: string;
  rv3_56?: string;
  rv3_125?: string;
  rv3_132?: string;
  rv23Verified?: boolean;
  rv5Picks?: string[];
  rv5Verified?: boolean;
  rv4Answer?: string;
  rv4Reason?: string;
  rv4Verified?: boolean;
}

export const L4_MIN_REASON = 15;
export const L4_MIN_ESSAY = 20;

const num = (t: string | undefined) => (/^\s*\d+\s*$/.test(t ?? '') ? Number(t) : null);
const fmt = formatPrimeFactorization;

// ------------------------------------------------------------------
// 0. 생각 열기 · 소인수 · 문제 2
// ------------------------------------------------------------------

export function checkOpen4(s: Lesson4State): CheckResult {
  const msgs: string[] = [];
  if (num(s.openB2) !== 6 || num(s.openB3) !== 4) msgs.push('12를 두 자연수의 곱으로 나타낸 빈칸을 다시 확인해 보세요.');
  if (!sameNumberSet(parseNumbers(s.openDiv12), divisorList(12))) msgs.push('12의 약수를 빠짐없이 썼는지 확인해 보세요. 위의 곱셈식이 도움이 돼요.');
  if (!sameNumberSet(parseNumbers(s.openPrime12), [2, 3])) msgs.push('12의 약수 중에서 소수인 것만 골라 써 보세요. (1은 소수가 아니에요)');
  if (msgs.length) return fail(...msgs);
  return pass('12의 약수 1, 2, 3, 4, 6, 12 중 소수는 2와 3! 이처럼 약수 중에서 소수인 것을 그 수의 소인수라고 해요.');
}

export const P2_NUMBERS = [16, 33, 42, 80] as const;
export const P2_KEY = { 16: 'p2_16', 33: 'p2_33', 42: 'p2_42', 80: 'p2_80' } as const;

function checkPrimeFactorLists(items: readonly number[], get: (n: number) => string | undefined, label: string): string[] {
  const msgs: string[] = [];
  for (const n of items) {
    const got = parseNumbers(get(n));
    if (!sameNumberSet(got, primeFactorsOf(n))) {
      const extra = got.filter((x) => !isPrimeNumber(x) || n % x !== 0);
      msgs.push(
        `${label} ${n}: ${extra.length ? `${[...new Set(extra)].join(', ')}은(는) ${n}의 소인수가 아니에요.` : '빠진 소인수가 있어요.'}`
      );
    }
  }
  return msgs;
}

export function checkProblem2(s: Lesson4State): CheckResult {
  const msgs = checkPrimeFactorLists(P2_NUMBERS, (n) => s[P2_KEY[n as 16]], '');
  if (msgs.length) return fail(...msgs.map((m) => m.trim()), '소인수는 "약수이면서 소수"인 수예요. 같은 수는 한 번만 써요.');
  return pass('16 → 2, 33 → 3, 11, 42 → 2, 3, 7, 80 → 2, 5. 정답!');
}

// ------------------------------------------------------------------
// 1. 소인수 나무 (24를 두 순서로)
// ------------------------------------------------------------------

/** 나무 상태: 고른 소수들과 남은 수, 끝났는지(남은 수가 소수) */
export function treeState(n: number, picks: number[] | undefined): { remaining: number; done: boolean; valid: boolean } {
  let r = n;
  for (const p of picks ?? []) {
    if (!isPrimeNumber(p) || r % p !== 0 || r === p) return { remaining: r, done: false, valid: false };
    r /= p;
  }
  return { remaining: r, done: isPrimeNumber(r), valid: true };
}

export function checkTree(s: Lesson4State): CheckResult {
  const msgs: string[] = [];
  const t1 = treeState(24, s.tree1);
  const t2 = treeState(24, s.tree2);
  if (!t1.valid || !t1.done || (s.tree1 ?? [])[0] !== 2) msgs.push('[순서 1] 2로 먼저 나누어 시작하고, 남은 수가 소수가 될 때까지 가지를 이어 가 보세요.');
  if (!t2.valid || !t2.done || (s.tree2 ?? [])[0] !== 3) msgs.push('[순서 2] 3으로 먼저 나누어 시작하고, 남은 수가 소수가 될 때까지 가지를 이어 가 보세요.');
  for (const [k, label] of [
    ['tree1Result', '[순서 1]'],
    ['tree2Result', '[순서 2]'],
  ] as const) {
    const r = checkPrimeFactorization(s[k], 24);
    if (!r.ok) msgs.push(`${label} 결과: ${r.reason}`);
  }
  if (s.treeSame !== 'same') msgs.push('두 순서의 결과를 비교해 다시 골라 보세요.');
  if (msgs.length) return fail(...msgs);
  return pass('어떤 순서로 나누어도 24 = 2³ × 3! 곱하는 순서를 생각하지 않으면 소인수분해 한 결과는 오직 한 가지예요.');
}

// ------------------------------------------------------------------
// 2. 예제 1 (나눗셈 사다리) · 문제 3
// ------------------------------------------------------------------

/** 나눗셈 사다리: 소수로 나누어 몫이 소수가 될 때까지 */
export function ladderState(n: number, divisors: number[] | undefined): { quotients: number[]; done: boolean; valid: boolean } {
  const quotients: number[] = [];
  let r = n;
  for (const d of divisors ?? []) {
    if (!isPrimeNumber(d) || r % d !== 0 || r === d) return { quotients, done: false, valid: false };
    r /= d;
    quotients.push(r);
  }
  return { quotients, done: isPrimeNumber(r), valid: true };
}

export function checkExample1(s: Lesson4State): CheckResult {
  const l = ladderState(90, s.ladder90);
  if (!l.valid || !l.done) return fail('나눗셈 사다리를 몫이 소수가 될 때까지 이어 가 보세요. 나누는 수는 소수여야 해요.');
  const r = checkPrimeFactorization(s.result90, 90);
  if (!r.ok) return fail(`90의 소인수분해: ${r.reason}`);
  return pass('90 = 2 × 3² × 5. 곱셈식, 가지, 나눗셈 — 어떤 방법으로 해도 결과는 같아요.');
}

export const P3_NUMBERS = [32, 63, 98, 150] as const;
export const P3_KEY = { 32: 'p3_32', 63: 'p3_63', 98: 'p3_98', 150: 'p3_150' } as const;

export function checkProblem3(s: Lesson4State): CheckResult {
  const msgs: string[] = [];
  for (const n of P3_NUMBERS) {
    const r = checkPrimeFactorization(s[P3_KEY[n]], n);
    if (!r.ok) msgs.push(`${n}: ${r.reason}`);
  }
  if (msgs.length) return fail(...msgs);
  return pass(P3_NUMBERS.map((n) => `${n} = ${fmt(n)}`).join(', '));
}

// ------------------------------------------------------------------
// 3. 소인수분해로 약수 구하기
// ------------------------------------------------------------------

/** 75 = 3 × 5² 표: 행 1, 3 / 열 1, 5, 5² */
export const T75_CELLS = [
  { key: 't75a', row: 1, col: 1 },
  { key: 't75b', row: 1, col: 5 },
  { key: 't75c', row: 1, col: 25 },
  { key: 't75d', row: 3, col: 1 },
  { key: 't75e', row: 3, col: 5 },
  { key: 't75f', row: 3, col: 25 },
] as const;

export function checkTable75(s: Lesson4State): CheckResult {
  const wrong = T75_CELLS.filter((c) => num(s[c.key]) !== c.row * c.col);
  if (wrong.length) return fail(`표에서 ${wrong.length}칸을 다시 계산해 보세요. 왼쪽 수와 위쪽 수를 곱해요.`);
  if (!sameNumberSet(parseNumbers(s.div75), divisorList(75))) return fail('표의 수를 모아 75의 약수를 모두 써 보세요.');
  return pass('75 = 3 × 5²의 약수는 3의 약수(1, 3)와 5²의 약수(1, 5, 5²)에서 하나씩 골라 곱한 수: 1, 3, 5, 15, 25, 75');
}

export function checkTalk4(s: Lesson4State): CheckResult {
  if (num(s.talk6) !== 4 || num(s.talk9) !== 3) return fail('6과 9의 약수를 모두 써 보고 개수를 세어 보세요.');
  if (s.talkAlways !== 'no') return fail('6과 9의 약수 개수를 비교해 보고 다시 골라 보세요.');
  return pass('6 < 9이지만 약수는 6이 4개, 9가 3개! 큰 수가 항상 약수가 더 많은 것은 아니에요.');
}

export function checkProblem4(s: Lesson4State): CheckResult {
  const msgs: string[] = [];
  if (!sameNumberSet(parseNumbers(s.p4a), divisorList(100))) msgs.push('(1) 2² × 5²의 약수: 2²의 약수와 5²의 약수에서 하나씩 골라 곱해 보세요. 빠진 것이 있어요.');
  if (!sameNumberSet(parseNumbers(s.p4b), divisorList(54))) msgs.push('(2) 54를 먼저 소인수분해 한 뒤 표를 그려 약수를 구해 보세요.');
  if (msgs.length) return fail(...msgs);
  return pass('100의 약수 9개, 54 = 2 × 3³의 약수 8개를 모두 찾았어요!');
}

export function checkCount40(s: Lesson4State): CheckResult {
  if (num(s.cnt40) !== divisorList(40).length) return fail('40을 소인수분해 하고, 각 소인수의 거듭제곱의 약수 개수를 생각해 보세요.');
  if ((s.cnt40Reason ?? '').trim().length < L4_MIN_REASON) return fail(`어떻게 구했는지 ${L4_MIN_REASON}자 이상 써 주세요.`);
  return pass('40 = 2³ × 5 → 2³의 약수 4개 × 5의 약수 2개 = 8개. 약수를 일일이 쓰지 않고도 개수를 구할 수 있어요!');
}

// ------------------------------------------------------------------
// 4. 블록 코딩 (외부 프로그램을 실행하고 결과를 입력)
// ------------------------------------------------------------------

export function checkCoding(s: Lesson4State): CheckResult {
  const msgs: string[] = [];
  const r1 = checkPrimeFactorization(s.code5239, 5239);
  if (!r1.ok) msgs.push(`활동 1 (5239): ${r1.reason}`);
  const n = num(s.codeNum);
  if (n === null || n < 4 || n > 1_000_000_000) msgs.push('활동 2: 4 이상(10억 이하)의 자연수 하나를 골라 써 주세요.');
  else if (n === 5239) msgs.push('활동 2: 5239가 아닌 다른 수를 골라 보세요.');
  else {
    const r2 = checkPrimeFactorization(s.codeResult, n);
    if (!r2.ok) msgs.push(`활동 2 (${n}): ${r2.reason}`);
  }
  if (msgs.length) return fail(...msgs);
  return pass(`5239 = ${fmt(5239)}, ${n} = ${fmt(n!)} — 큰 수도 프로그램으로 빠르게 소인수분해 할 수 있어요!`);
}

// ------------------------------------------------------------------
// 5. 배운 내용 확인하기
// ------------------------------------------------------------------

export const RV_WORDS: { value: Exclude<RvWord, ''>; label: string }[] = [
  { value: 'power', label: '거듭제곱' },
  { value: 'base', label: '밑' },
  { value: 'exponent', label: '지수' },
  { value: 'divisor', label: '약수' },
  { value: 'primeFactor', label: '소인수' },
  { value: 'factorization', label: '소인수분해' },
];

export function checkReviewConcept(s: Lesson4State): CheckResult {
  const ok =
    s.rvBlank1 === 'power' && s.rvBlank2a === 'base' && s.rvBlank2b === 'exponent' && s.rvBlank3 === 'primeFactor' && s.rvBlank4 === 'factorization';
  return ok ? pass('개념 빈칸을 모두 맞혔어요!') : fail('빈칸 중 다시 확인할 곳이 있어요. 거듭제곱의 밑·지수, 소인수·소인수분해의 뜻을 떠올려 보세요.');
}

export const RV2_NUMBERS = [18, 26, 35, 84] as const;
export const RV2_KEY = { 18: 'rv2_18', 26: 'rv2_26', 35: 'rv2_35', 84: 'rv2_84' } as const;
export const RV3_NUMBERS = [45, 56, 125, 132] as const;
export const RV3_KEY = { 45: 'rv3_45', 56: 'rv3_56', 125: 'rv3_125', 132: 'rv3_132' } as const;

export function checkReview23(s: Lesson4State): CheckResult {
  const msgs = checkPrimeFactorLists(RV2_NUMBERS, (n) => s[RV2_KEY[n as 18]], '2번');
  for (const n of RV3_NUMBERS) {
    const r = checkPrimeFactorization(s[RV3_KEY[n]], n);
    if (!r.ok) msgs.push(`3번 ${n}: ${r.reason}`);
  }
  if (msgs.length) return fail(...msgs);
  return pass('소인수 구하기와 소인수분해 모두 정답!');
}

/** 5번 보기 (108의 약수 찾기) */
export const RV5_OPTIONS = [
  { id: '2^3', label: '2³', value: 8 },
  { id: '3^2', label: '3²', value: 9 },
  { id: '2^2x3^2', label: '2² × 3²', value: 36 },
  { id: '2x3^2x5', label: '2 × 3² × 5', value: 90 },
] as const;

export function checkReview5(s: Lesson4State): CheckResult {
  const want = RV5_OPTIONS.filter((o) => 108 % o.value === 0).map((o) => o.id);
  const got = [...new Set(s.rv5Picks ?? [])];
  if (got.length === want.length && want.every((w) => got.includes(w))) {
    return pass('108 = 2² × 3³이므로 2³과 5가 들어간 수는 약수가 될 수 없어요. 3², 2² × 3²이 약수!');
  }
  return fail('108을 먼저 소인수분해 해 보세요. 그 소인수의 거듭제곱보다 지수가 크거나, 없는 소인수가 들어 있으면 약수가 아니에요.');
}

export function checkReview4(s: Lesson4State): CheckResult {
  if (num(s.rv4Answer) !== 7) return fail('28을 소인수분해 해 보세요. 어떤 자연수의 제곱이 되려면 모든 소인수의 지수가 짝수여야 해요.');
  if ((s.rv4Reason ?? '').trim().length < L4_MIN_ESSAY) return fail(`풀이 과정을 ${L4_MIN_ESSAY}자 이상 써 주세요.`);
  return pass('28 = 2² × 7이므로 7을 곱하면 2² × 7² = (2 × 7)² = 14². 가장 작은 자연수는 7!');
}

// ------------------------------------------------------------------
// 단계 완료 · 정리
// ------------------------------------------------------------------

export function evaluateLesson4Completion(state: LessonCommonState): boolean[] {
  const s = state as Lesson4State;
  return [
    Boolean(s.openVerified && s.p2Verified),
    Boolean(s.treeVerified),
    Boolean(s.ex1Verified && s.p3Verified),
    Boolean(s.tableVerified && s.talkVerified && s.p4Verified && s.cntVerified),
    Boolean(s.codeVerified),
    Boolean(s.rvConceptVerified && s.rv23Verified && s.rv5Verified && s.rv4Verified),
    isReflectionDone(s),
  ];
}

const rvWord = { oneOf: ['power', 'base', 'exponent', 'primeFactor', 'factorization', 'divisor'] } as const;
const str = 'string' as const;
const bool = 'bool' as const;
export const LESSON4_SPEC: FieldSpec = {
  openB2: str, openB3: str, openDiv12: str, openPrime12: str, openVerified: bool,
  p2_16: str, p2_33: str, p2_42: str, p2_80: str, p2Verified: bool,
  tree1: 'numArray', tree2: 'numArray', tree1Result: str, tree2Result: str, treeSame: { oneOf: ['same', 'diff'] }, treeVerified: bool,
  ladder90: 'numArray', result90: str, ex1Verified: bool,
  p3_32: str, p3_63: str, p3_98: str, p3_150: str, p3Verified: bool,
  t75a: str, t75b: str, t75c: str, t75d: str, t75e: str, t75f: str, div75: str, tableVerified: bool,
  talk6: str, talk9: str, talkAlways: { oneOf: ['yes', 'no'] }, talkVerified: bool,
  p4a: str, p4b: str, p4Verified: bool, cnt40: str, cnt40Reason: str, cntVerified: bool,
  code5239: str, codeNum: str, codeResult: str, codeVerified: bool,
  rvBlank1: rvWord, rvBlank2a: rvWord, rvBlank2b: rvWord, rvBlank3: rvWord, rvBlank4: rvWord, rvConceptVerified: bool,
  rv2_18: str, rv2_26: str, rv2_35: str, rv2_84: str, rv3_45: str, rv3_56: str, rv3_125: str, rv3_132: str, rv23Verified: bool,
  rv5Picks: 'strArray', rv5Verified: bool, rv4Answer: str, rv4Reason: str, rv4Verified: bool,
  ...COMMON_SPEC,
};

export function cleanLesson4State(raw: unknown): Lesson4State {
  return cleanBySpec<Lesson4State>(raw, LESSON4_SPEC);
}

const VERIFY_OF = verifyMap<Lesson4State>([
  ['openVerified', ['openB2', 'openB3', 'openDiv12', 'openPrime12']],
  ['p2Verified', ['p2_16', 'p2_33', 'p2_42', 'p2_80']],
  ['treeVerified', ['tree1', 'tree2', 'tree1Result', 'tree2Result', 'treeSame']],
  ['ex1Verified', ['ladder90', 'result90']],
  ['p3Verified', ['p3_32', 'p3_63', 'p3_98', 'p3_150']],
  ['tableVerified', ['t75a', 't75b', 't75c', 't75d', 't75e', 't75f', 'div75']],
  ['talkVerified', ['talk6', 'talk9', 'talkAlways']],
  ['p4Verified', ['p4a', 'p4b']],
  ['cntVerified', ['cnt40', 'cnt40Reason']],
  ['codeVerified', ['code5239', 'codeNum', 'codeResult']],
  ['rvConceptVerified', ['rvBlank1', 'rvBlank2a', 'rvBlank2b', 'rvBlank3', 'rvBlank4']],
  ['rv23Verified', ['rv2_18', 'rv2_26', 'rv2_35', 'rv2_84', 'rv3_45', 'rv3_56', 'rv3_125', 'rv3_132']],
  ['rv5Verified', ['rv5Picks']],
  ['rv4Verified', ['rv4Answer', 'rv4Reason']],
]);

export function patchLesson4(prev: Lesson4State, patch: Partial<Lesson4State>): Lesson4State {
  return patchWithVerify(prev, patch, VERIFY_OF);
}
