import { isReflectionDone, sanitizeHelpSource, type LessonCommonState } from '../utils/lessonCommon';

/**
 * 1차시 「소수란 무엇일까?」 — 입력 형식·점검(채점)·단계 완료 판정 (화면과 분리, 단위 테스트 대상)
 * 단계: 0 단원 열기·준비 학습 / 1 생각 열기 / 2 소수와 합성수의 뜻 / 3 문제 1 / 4 도형(타일 배열) / 5 도전 / 6 성찰
 */

export type PrimeClass = '' | 'prime' | 'composite' | 'neither';
export type Confidence = '' | 'sure' | 'need';
export type YesNo = '' | 'yes' | 'no';

export interface Lesson1State extends LessonCommonState {
  // 0. 단원 열기 · 수학과 연결 짓기
  connectA?: string;
  connectB?: string;
  connectExample?: string;
  connectVerified?: boolean;
  // 0. 준비 학습 (약수·배수·최대공약수·최소공배수)
  prepDiv10?: string;
  prepDiv16?: string;
  prepMul5?: string;
  prepMul12?: string;
  prepGcd915?: string;
  prepGcd1620?: string;
  prepLcm410?: string;
  prepLcm1218?: string;
  prepSure1?: Confidence;
  prepSure2?: Confidence;
  prepSure3?: Confidence;
  prepSure4?: Confidence;
  prepVerified?: boolean;
  // 1. 생각 열기 · 약수 모여라
  open6Picks?: number[];
  open7Picks?: number[];
  openPrimes?: string;
  openVerified?: boolean;
  // 2. 소수와 합성수의 뜻
  talkDivisorCount?: string;
  oneClass?: PrimeClass;
  conceptVerified?: boolean;
  myNumber?: string;
  myDivisors?: string;
  myClass?: PrimeClass;
  myVerified?: boolean;
  // 3. 문제 1
  p1Class11?: PrimeClass;
  p1Class14?: PrimeClass;
  p1Class19?: PrimeClass;
  p1Class27?: PrimeClass;
  /** 합성수라고 고른 수의 증거: 1과 자기 자신이 아닌 약수 하나 (합성수를 고른 칸만 씀) */
  p1Divisor11?: string;
  p1Divisor14?: string;
  p1Divisor19?: string;
  p1Divisor27?: string;
  p1Verified?: boolean;
  evenTwo?: YesNo;
  evenTwoReason?: string;
  evenVerified?: boolean;
  // 4. 도형을 이용하여 소수와 합성수 이해하기 (타일 배열, 2026-11-13 추가)
  /** 찾은 직사각형 배열 ('작은 수x큰 수', 예: '1x7') */
  tile7Found?: string[];
  tile7Count?: string;
  tile7Verified?: boolean;
  tile16Found?: string[];
  tile16Count?: string;
  tile16Verified?: boolean;
  /** 활동 3: 배열 방법이 한 가지뿐인 타일 개수들 */
  tileOneNumbers?: string;
  tileOneFeature?: string;
  tileOneVerified?: boolean;
  // 5. 도전 · 수준별 (상)
  chPicks?: number[];
  chReason?: string;
  chVerified?: boolean;
}

/** 서술 칸 최소 글자 수 (화면의 글자 수 표시와 채점에 같은 값을 씀) */
export const L1_MIN_EXAMPLE = 10;
export const L1_MIN_REASON = 10;
export const L1_MIN_CHALLENGE = 20;
export const L1_MIN_TILE_FEATURE = 15;

export const L1_P1_NUMBERS = [11, 14, 19, 27] as const;
export const L1_CHALLENGE_RANGE = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const L1_CHALLENGE_PICK_COUNT = 5;
export const L1_CHALLENGE_TARGET = 8;

// ------------------------------------------------------------------
// 수 계산
// ------------------------------------------------------------------

export function divisorsOf(n: number): number[] {
  if (!Number.isInteger(n) || n < 1) return [];
  const out: number[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d);
  return out;
}

export function isPrime(n: number): boolean {
  return divisorsOf(n).length === 2;
}

export function classify(n: number): PrimeClass {
  if (!Number.isInteger(n) || n < 1) return '';
  if (n === 1) return 'neither';
  return isPrime(n) ? 'prime' : 'composite';
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

export function lcm(a: number, b: number): number {
  return a && b ? Math.abs(a * b) / gcd(a, b) : 0;
}

/** "1, 2, 5, 10" · "1 2 5 10" · "1,2,5,10" → [1, 2, 5, 10] (자연수만, 입력 순서 그대로) */
export function parseNumberList(text: string | undefined): number[] {
  return (String(text ?? '').match(/\d+/g) ?? []).map(Number).filter((n) => Number.isSafeInteger(n));
}

/** 칸 하나에 자연수 하나만 썼을 때 그 수, 아니면 null */
export function parseSingleNumber(text: string | undefined): number | null {
  const s = String(text ?? '').trim();
  return /^\d+$/.test(s) ? Number(s) : null;
}

function sameSet(a: number[], b: number[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

export const CLASS_LABEL: Record<Exclude<PrimeClass, ''>, string> = {
  prime: '소수',
  composite: '합성수',
  neither: '소수도 합성수도 아님',
};

// ------------------------------------------------------------------
// 점검(채점) — 맞으면 ok, 틀리면 학생에게 보여 줄 안내 문장들
// ------------------------------------------------------------------

export interface CheckResult {
  ok: boolean;
  messages: string[];
}

const pass = (msg: string): CheckResult => ({ ok: true, messages: [msg] });
const fail = (...messages: string[]): CheckResult => ({ ok: false, messages });

/** 단원 열기 1: 6을 1보다 큰 자연수 두 개의 곱으로 */
export function checkConnect(s: Lesson1State): CheckResult {
  const a = parseSingleNumber(s.connectA);
  const b = parseSingleNumber(s.connectB);
  if (a === null || b === null) return fail('두 칸에 자연수를 하나씩 써 주세요.');
  if (a <= 1 || b <= 1) return fail('1보다 큰 자연수 두 개를 써야 해요. 1 × 6 은 조건에 맞지 않아요.');
  if (a * b !== 6) return fail(`${a} × ${b} = ${a * b} 이에요. 곱이 6이 되도록 다시 생각해 보세요.`);
  if ((s.connectExample ?? '').trim().length < L1_MIN_EXAMPLE) {
    return fail(`6 = ${a} × ${b} 은 맞아요! 아래 2번(결합된 예)도 ${L1_MIN_EXAMPLE}자 이상 써 주세요.`);
  }
  return pass(`6 = ${a} × ${b} — 6은 더 작은 두 수의 곱으로 쪼갤 수 있어요.`);
}

export interface PrepItem {
  key: 'prepDiv10' | 'prepDiv16' | 'prepMul5' | 'prepMul12' | 'prepGcd915' | 'prepGcd1620' | 'prepLcm410' | 'prepLcm1218';
  group: 1 | 2 | 3 | 4;
  label: string;
  check: (text: string | undefined) => boolean;
}

const divisorItem = (key: PrepItem['key'], n: number): PrepItem => ({
  key,
  group: 1,
  label: `(${n === 10 ? 1 : 2}) ${n}의 약수`,
  check: (t) => sameSet(parseNumberList(t), divisorsOf(n)),
});
const multipleItem = (key: PrepItem['key'], n: number, no: 1 | 2): PrepItem => ({
  key,
  group: 2,
  label: `(${no}) ${n}의 배수 3개`,
  check: (t) => {
    const list = parseNumberList(t);
    return list.length === 3 && new Set(list).size === 3 && list.every((x) => x > 0 && x % n === 0);
  },
});
const singleItem = (key: PrepItem['key'], group: 3 | 4, label: string, answer: number): PrepItem => ({
  key,
  group,
  label,
  check: (t) => parseSingleNumber(t) === answer,
});

export const PREP_ITEMS: PrepItem[] = [
  divisorItem('prepDiv10', 10),
  divisorItem('prepDiv16', 16),
  multipleItem('prepMul5', 5, 1),
  multipleItem('prepMul12', 12, 2),
  singleItem('prepGcd915', 3, '(1) 9, 15의 최대공약수', gcd(9, 15)),
  singleItem('prepGcd1620', 3, '(2) 16, 20의 최대공약수', gcd(16, 20)),
  singleItem('prepLcm410', 4, '(1) 4, 10의 최소공배수', lcm(4, 10)),
  singleItem('prepLcm1218', 4, '(2) 12, 18의 최소공배수', lcm(12, 18)),
];

export const PREP_GROUP_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: '다음 수의 약수를 모두 구하시오.',
  2: '다음 수의 배수를 3개씩 구하시오.',
  3: '다음 두 수의 최대공약수를 구하시오.',
  4: '다음 두 수의 최소공배수를 구하시오.',
};

/** 준비 학습: 틀린 칸만 알려 줌 (정답은 알려 주지 않음) */
export function checkPrep(s: Lesson1State): CheckResult & { wrong: PrepItem['key'][] } {
  const wrong = PREP_ITEMS.filter((it) => !it.check(s[it.key])).map((it) => it.key);
  if (wrong.length === 0) return { ...pass('준비 학습 8문항을 모두 맞혔어요!'), wrong };
  const labels = PREP_ITEMS.filter((it) => wrong.includes(it.key)).map((it) => it.label);
  return { ...fail(`다시 확인할 문항: ${labels.join(', ')}`, '약수는 빠짐없이, 배수는 서로 다른 3개를 써 주세요.'), wrong };
}

/** 생각 열기: 6의 약수 카드, 7의 약수 카드, 7처럼 약수가 1과 자기 자신뿐인 수 */
export function checkOpen(s: Lesson1State): CheckResult {
  const msgs: string[] = [];
  if (!sameSet(s.open6Picks ?? [], divisorsOf(6))) msgs.push('6의 약수 카드를 다시 확인해 보세요. (6을 나누어떨어지게 하는 수)');
  if (!sameSet(s.open7Picks ?? [], divisorsOf(7))) msgs.push('7의 약수 카드를 다시 확인해 보세요.');
  const list = [...new Set(parseNumberList(s.openPrimes))];
  if (list.length < 3) msgs.push('7과 같은 수를 3개 이상 써 주세요.');
  const notPrime = list.filter((n) => !isPrime(n));
  if (notPrime.length > 0) {
    const detail = notPrime.map((n) => (n === 1 ? '1의 약수: 1 (하나뿐)' : `${n}의 약수: ${divisorsOf(n).join(', ')}`));
    msgs.push(`${notPrime.join(', ')}은(는) 약수가 '1과 자기 자신' 두 개뿐인 수가 아니에요. (${detail.join(' / ')})`);
  }
  if (msgs.length) return fail(...msgs);
  return pass(`6의 약수는 1, 2, 3, 6으로 4개, 7의 약수는 1, 7로 2개예요. ${list.join(', ')}도 약수가 1과 자기 자신뿐이에요.`);
}

/** 개념: 생각 톡톡(소수의 약수 개수) + 1의 분류 */
export function checkConcept(s: Lesson1State): CheckResult {
  const msgs: string[] = [];
  if (parseSingleNumber(s.talkDivisorCount) !== 2) msgs.push('소수의 약수는 무엇과 무엇인지 떠올려 보세요. 그러면 몇 개인지 알 수 있어요.');
  if (s.oneClass !== 'neither') msgs.push('1의 약수는 몇 개인지 생각해 보고, 소수와 합성수의 뜻에서 "1보다 큰 자연수"라는 말을 다시 읽어 보세요.');
  if (msgs.length) return fail(...msgs);
  return pass('소수의 약수는 1과 자기 자신, 2개! 1은 소수도 합성수도 아니에요.');
}

/** 내가 고른 수 판별 (2~100) */
export function checkMyNumber(s: Lesson1State): CheckResult {
  const n = parseSingleNumber(s.myNumber);
  if (n === null || n < 2 || n > 100) return fail('2부터 100까지의 자연수 하나를 골라 써 주세요.');
  if (!sameSet(parseNumberList(s.myDivisors), divisorsOf(n))) return fail(`${n}의 약수를 빠짐없이, 정확히 썼는지 확인해 보세요.`);
  if (s.myClass !== classify(n)) return fail(`약수의 개수를 보고 ${n}이(가) 소수인지 합성수인지 다시 판단해 보세요.`);
  return pass(`${n}의 약수는 ${divisorsOf(n).length}개 → ${n}은(는) ${CLASS_LABEL[classify(n) as 'prime' | 'composite']}예요.`);
}

export const P1_CLASS_KEY = { 11: 'p1Class11', 14: 'p1Class14', 19: 'p1Class19', 27: 'p1Class27' } as const;
export const P1_DIVISOR_KEY = { 11: 'p1Divisor11', 14: 'p1Divisor14', 19: 'p1Divisor19', 27: 'p1Divisor27' } as const;

/** 문제 1: 네 수 판별 + 합성수라고 고른 수는 1과 자기 자신이 아닌 약수 하나 (증거) */
export function checkProblem1(s: Lesson1State): CheckResult {
  const msgs: string[] = [];
  const unanswered = L1_P1_NUMBERS.filter((n) => !s[P1_CLASS_KEY[n]]);
  if (unanswered.length) msgs.push(`${unanswered.join(', ')}에 대해 소수인지 합성수인지 골라 주세요.`);
  const wrong = L1_P1_NUMBERS.filter((n) => s[P1_CLASS_KEY[n]] && s[P1_CLASS_KEY[n]] !== classify(n));
  if (wrong.length) msgs.push(`${wrong.join(', ')}의 판단을 다시 확인해 보세요. 2, 3, 5, 7로 나누어 보면 도움이 돼요.`);
  for (const n of L1_P1_NUMBERS) {
    if (s[P1_CLASS_KEY[n]] !== 'composite' || classify(n) !== 'composite') continue;
    const d = parseSingleNumber(s[P1_DIVISOR_KEY[n]]);
    if (d === null || d === 1 || d === n || n % d !== 0) {
      msgs.push(`${n}이(가) 합성수인 증거로, 1과 ${n}이 아닌 ${n}의 약수를 하나 써 주세요.`);
    }
  }
  if (msgs.length) return fail(...msgs);
  return pass('11, 19는 소수, 14, 27은 합성수예요. 합성수는 1과 자기 자신 이외의 약수가 있어요.');
}

/** 오개념 점검: 2는 짝수인데 소수일까? */
export function checkEvenTwo(s: Lesson1State): CheckResult {
  if (s.evenTwo !== 'yes') return fail('2의 약수를 모두 써 보세요. 약수가 1과 자기 자신뿐인지 확인해 보세요.');
  if ((s.evenTwoReason ?? '').trim().length < L1_MIN_REASON) return fail(`그렇게 생각한 이유를 ${L1_MIN_REASON}자 이상 써 주세요.`);
  return pass('맞아요. 2의 약수는 1, 2뿐이라 소수예요. 2는 짝수인 유일한 소수랍니다. 소수가 모두 홀수인 것은 아니에요!');
}

// ------------------------------------------------------------------
// 도형(타일 배열): 정사각형 타일 n개를 직사각형으로 늘어놓는 방법
// 1×6과 6×1처럼 돌리면 같은 모양은 한 가지로 셈 (교과서: 6개 → 1×6, 2×3 두 가지)
// ------------------------------------------------------------------

/** 'a×b' 기록 키 (작은 수가 앞) */
export function tileKey(a: number, b: number): string {
  return `${Math.min(a, b)}x${Math.max(a, b)}`;
}

/** n개 타일의 모든 직사각형 배열 키 */
export function tileArrangements(n: number): string[] {
  const out: string[] = [];
  for (const d of divisorsOf(n)) if (d * d <= n) out.push(tileKey(d, n / d));
  return out;
}

/** 한 줄에 a개씩 놓으면? 딱 맞으면 줄 수, 아니면 남는 타일 수 */
export function tryTileRow(n: number, a: number): { ok: true; rows: number; key: string } | { ok: false; left: number } {
  if (!Number.isInteger(a) || a < 1 || a > n) return { ok: false, left: n };
  if (n % a === 0) return { ok: true, rows: n / a, key: tileKey(a, n / a) };
  return { ok: false, left: n % a };
}

export function checkTiles(n: 7 | 16, found: string[] | undefined, count: string | undefined): CheckResult {
  const all = tileArrangements(n);
  const got = [...new Set(found ?? [])];
  const missing = all.length - got.filter((k) => all.includes(k)).length;
  if (missing > 0) return fail(`타일 ${n}개로 만들 수 있는 직사각형을 ${missing}가지 더 찾아보세요. 한 줄에 놓는 개수를 1부터 바꿔 가며 해 보세요.`);
  if (parseSingleNumber(count) !== all.length) return fail('찾은 직사각형을 보고, 배열하는 방법이 몇 가지인지 다시 세어 보세요. (돌리면 같은 모양은 한 가지)');
  return pass(
    `타일 ${n}개 → ${all.map((k) => k.replace('x', ' × ')).join(', ')}로 ${all.length}가지! ${n}의 약수는 ${divisorsOf(n).join(', ')}이에요.`
  );
}

/** 활동 3: 배열 방법이 한 가지뿐인 타일 개수 (2 이상 3개) + 특징 서술 */
export function checkTileOne(s: Lesson1State): CheckResult {
  const list = [...new Set(parseNumberList(s.tileOneNumbers))].filter((n) => n >= 2);
  const wrong = list.filter((n) => tileArrangements(n).length !== 1);
  if (wrong.length) {
    return fail(
      `${wrong.join(', ')}개는 직사각형으로 배열하는 방법이 한 가지가 아니에요. (${wrong
        .map((n) => `${n}개: ${tileArrangements(n).map((k) => k.replace('x', '×')).join(', ')}`)
        .join(' / ')})`
    );
  }
  if (list.length < 3) return fail('배열 방법이 한 가지뿐인 타일 개수를 2 이상의 수로 3개 이상 찾아 써 주세요.');
  if ((s.tileOneFeature ?? '').trim().length < L1_MIN_TILE_FEATURE) return fail(`그 수들의 특징을 ${L1_MIN_TILE_FEATURE}자 이상 써 주세요.`);
  return pass(
    `${list.join(', ')}개는 한 줄로 늘어놓는 방법(1 × 자기 자신)밖에 없어요. 약수가 1과 자기 자신뿐인 수, 곧 소수예요! 합성수 개수의 타일은 직사각형 방법이 두 가지 이상이에요.`
  );
}

/** 도전: 고른 5개 수의 약수를 모두 더한 값과 고른 수의 합 */
export function challengeSums(picks: number[] | undefined): { pickSum: number; divisorSum: number; diff: number } {
  const list = [...new Set(picks ?? [])];
  const pickSum = list.reduce((a, b) => a + b, 0);
  const divisorSum = list.reduce((a, n) => a + divisorsOf(n).reduce((x, y) => x + y, 0), 0);
  return { pickSum, divisorSum, diff: divisorSum - pickSum };
}

export function checkChallenge(s: Lesson1State): CheckResult {
  const picks = [...new Set(s.chPicks ?? [])];
  if (picks.length !== L1_CHALLENGE_PICK_COUNT) return fail(`2부터 10까지의 수 중에서 정확히 ${L1_CHALLENGE_PICK_COUNT}개를 골라 주세요.`);
  const { diff } = challengeSums(picks);
  if (diff !== L1_CHALLENGE_TARGET) return fail(`지금은 약수의 합이 고른 수의 합보다 ${diff}만큼 커요. ${L1_CHALLENGE_TARGET}만큼 커지도록 다시 골라 보세요.`);
  if ((s.chReason ?? '').trim().length < L1_MIN_CHALLENGE) return fail(`어떻게 찾았는지 ${L1_MIN_CHALLENGE}자 이상 설명해 주세요.`);
  return pass('정답! 2, 3, 5, 7, 9를 골랐어요. 소수 4개는 "1과 자기 자신 이외의 약수"가 없고, 9는 3이 하나 더 있어요.');
}

// ------------------------------------------------------------------
// 단계 완료 (교사 진행 표·학생 진행 막대)
// ------------------------------------------------------------------

export function evaluateLesson1Completion(state: LessonCommonState): boolean[] {
  const s = state as Lesson1State;
  return [
    Boolean(s.connectVerified && s.prepVerified),
    Boolean(s.openVerified),
    Boolean(s.conceptVerified && s.myVerified),
    Boolean(s.p1Verified && s.evenVerified),
    Boolean(s.tile7Verified && s.tile16Verified && s.tileOneVerified),
    Boolean(s.chVerified),
    isReflectionDone(s),
  ];
}

/**
 * 점검을 통과한 뒤 답을 고치면 ✓를 지웁니다 (고친 답이 틀릴 수 있으므로 다시 점검).
 * 고친 칸 → 지울 확인 표시
 */
export const L1_VERIFY_OF: Partial<Record<keyof Lesson1State, keyof Lesson1State>> = {
  connectA: 'connectVerified',
  connectB: 'connectVerified',
  connectExample: 'connectVerified',
  prepDiv10: 'prepVerified',
  prepDiv16: 'prepVerified',
  prepMul5: 'prepVerified',
  prepMul12: 'prepVerified',
  prepGcd915: 'prepVerified',
  prepGcd1620: 'prepVerified',
  prepLcm410: 'prepVerified',
  prepLcm1218: 'prepVerified',
  open6Picks: 'openVerified',
  open7Picks: 'openVerified',
  openPrimes: 'openVerified',
  talkDivisorCount: 'conceptVerified',
  oneClass: 'conceptVerified',
  myNumber: 'myVerified',
  myDivisors: 'myVerified',
  myClass: 'myVerified',
  p1Class11: 'p1Verified',
  p1Divisor11: 'p1Verified',
  p1Divisor19: 'p1Verified',
  p1Class14: 'p1Verified',
  p1Class19: 'p1Verified',
  p1Class27: 'p1Verified',
  p1Divisor14: 'p1Verified',
  p1Divisor27: 'p1Verified',
  evenTwo: 'evenVerified',
  evenTwoReason: 'evenVerified',
  tile7Found: 'tile7Verified',
  tile7Count: 'tile7Verified',
  tile16Found: 'tile16Verified',
  tile16Count: 'tile16Verified',
  tileOneNumbers: 'tileOneVerified',
  tileOneFeature: 'tileOneVerified',
  chPicks: 'chVerified',
  chReason: 'chVerified',
};

/** 답 고치기: 바뀐 칸에 딸린 ✓를 지움 */
export function patchLesson1(prev: Lesson1State, patch: Partial<Lesson1State>): Lesson1State {
  const next: Lesson1State = { ...prev, ...patch };
  for (const key of Object.keys(patch) as (keyof Lesson1State)[]) {
    const v = L1_VERIFY_OF[key];
    if (v && JSON.stringify(prev[key]) !== JSON.stringify(patch[key]) && next[v]) {
      (next as Record<string, unknown>)[v] = false;
    }
  }
  return next;
}

// ------------------------------------------------------------------
// 불러오기 정리 (서버·기기에서 읽은 값 → 안전한 형식). 없는 칸에 빈 값을 새로 붙이지 않음
// ------------------------------------------------------------------

const STRING_FIELDS: (keyof Lesson1State)[] = [
  'connectA', 'connectB', 'connectExample',
  'prepDiv10', 'prepDiv16', 'prepMul5', 'prepMul12', 'prepGcd915', 'prepGcd1620', 'prepLcm410', 'prepLcm1218',
  'openPrimes', 'talkDivisorCount', 'myNumber', 'myDivisors', 'p1Divisor11', 'p1Divisor14', 'p1Divisor19', 'p1Divisor27', 'evenTwoReason', 'chReason',
  'tile7Count', 'tile16Count', 'tileOneNumbers', 'tileOneFeature',
  'reflection1', 'reflection2',
];
const BOOL_FIELDS: (keyof Lesson1State)[] = [
  'connectVerified', 'prepVerified', 'openVerified', 'conceptVerified', 'myVerified', 'p1Verified', 'evenVerified', 'chVerified',
  'tile7Verified', 'tile16Verified', 'tileOneVerified',
];
const NUM_ARRAY_FIELDS: (keyof Lesson1State)[] = ['open6Picks', 'open7Picks', 'chPicks'];
const TILE_KEY_FIELDS: (keyof Lesson1State)[] = ['tile7Found', 'tile16Found'];
const CLASS_FIELDS: (keyof Lesson1State)[] = ['oneClass', 'myClass', 'p1Class11', 'p1Class14', 'p1Class19', 'p1Class27'];
const CONF_FIELDS: (keyof Lesson1State)[] = ['prepSure1', 'prepSure2', 'prepSure3', 'prepSure4'];

export const LESSON1_FIELDS: (keyof Lesson1State)[] = [
  ...STRING_FIELDS, ...BOOL_FIELDS, ...NUM_ARRAY_FIELDS, ...TILE_KEY_FIELDS, ...CLASS_FIELDS, ...CONF_FIELDS, 'evenTwo', 'helpSource',
];

/** 칸 하나 정리. 버릴 값이면 undefined */
function cleanField(k: keyof Lesson1State, v: unknown): unknown {
  if (STRING_FIELDS.includes(k)) return typeof v === 'string' ? v.slice(0, 2000) : undefined;
  if (BOOL_FIELDS.includes(k)) return typeof v === 'boolean' ? v : undefined;
  if (NUM_ARRAY_FIELDS.includes(k)) {
    if (!Array.isArray(v)) return undefined;
    return [...new Set(v.filter((x): x is number => Number.isInteger(x) && x >= 1 && x <= 100))].slice(0, 20);
  }
  if (TILE_KEY_FIELDS.includes(k)) {
    if (!Array.isArray(v)) return undefined;
    return [...new Set(v.filter((x): x is string => typeof x === 'string' && /^\d{1,3}x\d{1,3}$/.test(x)))].slice(0, 20);
  }
  if (CLASS_FIELDS.includes(k)) return v === 'prime' || v === 'composite' || v === 'neither' ? v : '';
  if (CONF_FIELDS.includes(k)) return v === 'sure' || v === 'need' ? v : '';
  if (k === 'evenTwo') return v === 'yes' || v === 'no' ? v : '';
  if (k === 'helpSource') return sanitizeHelpSource(v);
  return undefined; // 모르는 칸은 버림
}

/** 불러온 1차시 답안 정리 — 칸 순서를 그대로 지켜서, 정리 전후 JSON이 같으면 다시 저장하지 않게 함 */
export function cleanLesson1State(raw: unknown): Lesson1State {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const cleaned = cleanField(k as keyof Lesson1State, v);
    if (cleaned !== undefined) out[k] = cleaned;
  }
  return out as Lesson1State;
}
