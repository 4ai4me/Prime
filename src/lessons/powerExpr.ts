/**
 * 거듭제곱·소인수분해 식 읽기 (3·4차시 공용, 화면과 분리 — 단위 테스트 대상)
 *
 * 학생이 쓰는 여러 모양을 모두 읽습니다.
 *   2⁵ · 2^5 · 2²×3 · 2^2*3 · 2² x 3 · 2²·3 · 2 × 3² × 5
 * 위첨자 숫자(⁰~⁹)는 ^숫자로 바꿔 읽습니다.
 */

export interface PowerFactor {
  base: number;
  exp: number;
}

export interface ParsedProduct {
  /** 쓴 순서 그대로의 인수 */
  factors: PowerFactor[];
  /** 곱한 값 (너무 크면 Infinity) */
  value: number;
}

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

/** 위첨자 → ^숫자, 곱셈 기호 → ×, 공백 제거 */
export function normalizeExpr(text: string | undefined): string {
  let s = String(text ?? '').trim();
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^' + [...m].map((c) => SUPERSCRIPT[c]).join(''));
  s = s.replace(/[x*·∙⋅X]/g, '×');
  s = s.replace(/\s+/g, '');
  return s;
}

/** 식을 읽어 인수 목록으로. 읽을 수 없으면 null */
export function parseProduct(text: string | undefined): ParsedProduct | null {
  const s = normalizeExpr(text);
  if (!s) return null;
  const parts = s.split('×');
  const factors: PowerFactor[] = [];
  for (const p of parts) {
    const m = /^(\d{1,6})(?:\^(\d{1,2}))?$/.exec(p);
    if (!m) return null;
    const base = Number(m[1]);
    const exp = m[2] === undefined ? 1 : Number(m[2]);
    if (base < 1 || exp < 1) return null;
    factors.push({ base, exp });
  }
  let value = 1;
  for (const f of factors) {
    value *= f.base ** f.exp;
    if (!Number.isSafeInteger(value)) {
      value = Infinity;
      break;
    }
  }
  return { factors, value };
}

export function isPrimeNumber(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

/** n의 소인수분해 (밑이 작은 순) */
export function primeFactorize(n: number): PowerFactor[] {
  const out: PowerFactor[] = [];
  let x = n;
  for (let p = 2; p * p <= x; p++) {
    let e = 0;
    while (x % p === 0) {
      x /= p;
      e++;
    }
    if (e) out.push({ base: p, exp: e });
  }
  if (x > 1) out.push({ base: x, exp: 1 });
  return out;
}

/** 인수 목록 → 화면 글자 (예: 2³ × 3) */
export function formatFactors(factors: PowerFactor[]): string {
  const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
  return factors.map((f) => (f.exp === 1 ? String(f.base) : `${f.base}${sup(f.exp)}`)).join(' × ');
}

export function formatPrimeFactorization(n: number): string {
  return formatFactors(primeFactorize(n));
}

export interface ExprCheck {
  ok: boolean;
  /** 틀렸을 때 학생에게 보여 줄 까닭 (정답은 말하지 않음) */
  reason?: string;
}

/**
 * 거듭제곱으로 나타낸 식 점검 (3차시 문제 1 등)
 * - 값이 원래 곱과 같아야 함
 * - 같은 밑은 한 번만 (거듭제곱으로 묶기)
 * - 밑이 서로 다르면 작은 수부터
 * - 원래 식의 밑을 그대로 써야 함 (4×4×4를 2⁶으로 바꾸지 않음)
 */
export function checkPowerForm(text: string | undefined, original: PowerFactor[]): ExprCheck {
  const parsed = parseProduct(text);
  if (!parsed) return { ok: false, reason: '식을 읽을 수 없어요. 예를 들어 □², □³처럼 써 주세요.' };
  const want = mergeFactors(original);
  if (parsed.value !== want.reduce((a, f) => a * f.base ** f.exp, 1)) return { ok: false, reason: '값이 원래 식과 달라요. 같은 수가 몇 번 곱해졌는지 다시 세어 보세요.' };
  const bases = parsed.factors.map((f) => f.base);
  if (new Set(bases).size !== bases.length) return { ok: false, reason: '같은 수는 하나의 거듭제곱으로 묶어 써요.' };
  const wantBases = want.map((f) => f.base).sort((a, b) => a - b);
  if ([...bases].sort((a, b) => a - b).join() !== wantBases.join()) return { ok: false, reason: '원래 곱해진 수를 밑으로 써야 해요.' };
  if (bases.some((b, i) => i > 0 && bases[i - 1] > b)) return { ok: false, reason: '밑이 서로 다를 때는 작은 수부터 차례로 써요.' };
  if (parsed.factors.some((f) => f.exp !== want.find((w) => w.base === f.base)!.exp)) {
    return { ok: false, reason: '지수(곱해진 개수)를 다시 세어 보세요.' };
  }
  return { ok: true };
}

/** 같은 밑을 모아 지수를 더함 (밑 작은 순) */
export function mergeFactors(list: PowerFactor[]): PowerFactor[] {
  const map = new Map<number, number>();
  for (const f of list) map.set(f.base, (map.get(f.base) ?? 0) + f.exp);
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([base, exp]) => ({ base, exp }));
}

/**
 * 소인수분해 결과 점검 (4차시)
 * - 값이 n, 모든 밑이 소수, 같은 소인수는 거듭제곱으로 한 번만, 밑 작은 순, 지수 1은 쓰지 않아도 됨
 */
export function checkPrimeFactorization(text: string | undefined, n: number): ExprCheck {
  const parsed = parseProduct(text);
  if (!parsed) return { ok: false, reason: '식을 읽을 수 없어요. 예를 들어 2² × 3처럼 써 주세요.' };
  if (parsed.value !== n) return { ok: false, reason: `곱한 값이 ${n}이 아니에요.` };
  const notPrime = parsed.factors.map((f) => f.base).filter((b) => !isPrimeNumber(b));
  if (notPrime.length) return { ok: false, reason: `${[...new Set(notPrime)].join(', ')}은(는) 소수가 아니에요. 더 쪼갤 수 있어요.` };
  const bases = parsed.factors.map((f) => f.base);
  if (new Set(bases).size !== bases.length) return { ok: false, reason: '같은 소인수는 거듭제곱으로 묶어 써요.' };
  if (bases.some((b, i) => i > 0 && bases[i - 1] > b)) return { ok: false, reason: '소인수는 작은 수부터 차례로 써요.' };
  return { ok: true };
}

/** 소인수 목록 점검 ("2, 3, 7") */
export function primeFactorsOf(n: number): number[] {
  return primeFactorize(n).map((f) => f.base);
}

/** n의 약수 (작은 순) */
export function divisorList(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d);
  return out;
}

/** "1, 2, 5" → [1, 2, 5] */
export function parseNumbers(text: string | undefined): number[] {
  return (String(text ?? '').match(/\d+/g) ?? []).map(Number).filter((x) => Number.isSafeInteger(x));
}

export function sameNumberSet(a: number[], b: number[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}
