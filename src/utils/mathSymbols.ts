import type { LessonTabNumber } from './lessonAccess';

/**
 * 수학 기호 입력기 자료 (Func 저장소의 mathLogic.ts에서 가져와 중1 소인수분해에 맞게 줄임)
 */
export interface MathSymbolItem {
  label: string;
  token: string;
  desc: string;
  shorthand?: string;
  isTemplate?: boolean;
}

export type MathSymbolCategoryId =
  | 'recommended'
  | 'inequality'
  | 'power_root'
  | 'abs_op'
  | 'logic_set'
  | 'greek_var';

export interface MathSymbolCategory {
  id: MathSymbolCategoryId;
  name: string;
  shortName: string;
  items: MathSymbolItem[];
}

/** 1~6차시 공통으로 자주 쓰는 기호 (곱셈·거듭제곱·등호) */
const COMMON_PRIME_SYMBOLS: MathSymbolItem[] = [
  { label: '×', token: ' × ', desc: '곱셈 기호' },
  { label: '²', token: '²', desc: '제곱 (위첨자 2)', shorthand: '^2' },
  { label: '³', token: '³', desc: '세제곱 (위첨자 3)', shorthand: '^3' },
  { label: '=', token: ' = ', desc: '등호' },
  { label: '≠', token: ' ≠ ', desc: '같지 않다', shorthand: '!=' },
  { label: '∴', token: '∴ ', desc: '따라서', shorthand: ':.' },
];

/**
 * 차시별 추천 기호 (수학 기호 입력기 맨 앞줄).
 * 차시 자료를 채울 때 그 차시에 맞게 고칩니다.
 */
export const LESSON_RECOMMENDED_SYMBOLS: Record<LessonTabNumber, MathSymbolItem[]> = {
  1: [
    { label: '1 × □', token: '1 × □', desc: '1과 자기 자신의 곱', isTemplate: true },
    ...COMMON_PRIME_SYMBOLS,
  ],
  2: [
    { label: '1 × □', token: '1 × □', desc: '1과 자기 자신의 곱', isTemplate: true },
    ...COMMON_PRIME_SYMBOLS,
  ],
  3: [
    { label: 'ⁿ', token: 'ⁿ', desc: 'n제곱 (위첨자 n)', shorthand: '^n' },
    { label: '⁴', token: '⁴', desc: '네제곱 (위첨자 4)', shorthand: '^4' },
    { label: '⁵', token: '⁵', desc: '다섯제곱 (위첨자 5)' },
    ...COMMON_PRIME_SYMBOLS,
  ],
  4: [
    { label: '2² × 3', token: '2² × 3', desc: '소인수분해 예시 (12)', isTemplate: true },
    { label: '⁴', token: '⁴', desc: '네제곱 (위첨자 4)', shorthand: '^4' },
    ...COMMON_PRIME_SYMBOLS,
  ],
  5: [
    { label: '2² × 3', token: '2² × 3', desc: '소인수분해 예시 (12)', isTemplate: true },
    { label: '⁴', token: '⁴', desc: '네제곱 (위첨자 4)', shorthand: '^4' },
    ...COMMON_PRIME_SYMBOLS,
  ],
  6: [
    { label: '2² × 3', token: '2² × 3', desc: '소인수분해 예시 (12)', isTemplate: true },
    { label: '⁴', token: '⁴', desc: '네제곱 (위첨자 4)', shorthand: '^4' },
    ...COMMON_PRIME_SYMBOLS,
  ],
};

export const MATH_SYMBOL_CATEGORIES: MathSymbolCategory[] = [
  {
    id: 'inequality',
    name: '부등호 · 등호',
    shortName: '부등호·등호',
    items: [
      { label: '≥', token: ' ≥ ', desc: '크거나 같다 (이상)', shorthand: '>=' },
      { label: '≤', token: ' ≤ ', desc: '작거나 같다 (이하)', shorthand: '<=' },
      { label: '>', token: ' > ', desc: '크다 (초과)' },
      { label: '<', token: ' < ', desc: '작다 (미만)' },
      { label: '=', token: ' = ', desc: '같다 (등호)' },
      { label: '≠', token: ' ≠ ', desc: '같지 않다', shorthand: '!=' },
      { label: '±', token: '±', desc: '플러스마이너스', shorthand: '+-' },
      { label: '≈', token: ' ≈ ', desc: '근사값 (약)' },
      { label: '≡', token: ' ≡ ', desc: '합동 / 항등' },
      { label: '≥ 0', token: ' ≥ 0', desc: '0 이상 (음이 아닌 실수)', isTemplate: true },
      { label: '≤ 0', token: ' ≤ 0', desc: '0 이하', isTemplate: true },
      { label: '= 0', token: ' = 0', desc: '0과 같다', isTemplate: true },
    ],
  },
  {
    id: 'power_root',
    name: '거듭제곱 · 분수',
    shortName: '거듭제곱·분수',
    items: [
      { label: '²', token: '²', desc: '제곱 (위첨자 2)', shorthand: '^2' },
      { label: '³', token: '³', desc: '세제곱 (위첨자 3)', shorthand: '^3' },
      { label: '⁴', token: '⁴', desc: '네제곱 (위첨자 4)', shorthand: '^4' },
      { label: '⁵', token: '⁵', desc: '다섯제곱 (위첨자 5)' },
      { label: 'ⁿ', token: 'ⁿ', desc: 'n제곱 (위첨자 n)', shorthand: '^n' },
      { label: '(□)²', token: '(□)²', desc: '괄호 제곱 감싸기', isTemplate: true },
      { label: '(□)/(□)', token: '(□)/(□)', desc: '분수 틀 삽입', isTemplate: true },
    ],
  },
  {
    id: 'abs_op',
    name: '연산 · 괄호 · 절댓값',
    shortName: '연산·괄호',
    items: [
      { label: '|□|', token: '|□|', desc: '절댓값 감싸기', isTemplate: true },
      { label: '|', token: '|', desc: '절댓값 세로선' },
      { label: '(□)', token: '(□)', desc: '소괄호 감싸기', isTemplate: true },
      { label: '[□]', token: '[□]', desc: '대괄호 감싸기', isTemplate: true },
      { label: '−', token: ' − ', desc: '뺄셈 (마이너스)' },
      { label: '+', token: ' + ', desc: '덧셈 (플러스)' },
      { label: '×', token: ' × ', desc: '곱셈 기호' },
      { label: '·', token: '·', desc: '가운데점 곱셈' },
      { label: '÷', token: ' ÷ ', desc: '나눗셈 기호' },
      { label: '/', token: '/', desc: '분수 슬래시' },
    ],
  },
  {
    id: 'logic_set',
    name: '논리 · 화살표',
    shortName: '논리·화살표',
    items: [
      { label: '∴', token: '∴ ', desc: '따라서 (결론)', shorthand: ':.' },
      { label: '∵', token: '∵ ', desc: '왜냐하면 (이유)', shorthand: 'because' },
      { label: '⇒', token: ' ⇒ ', desc: '이면', shorthand: '=>' },
      { label: '→', token: ' → ', desc: '화살표', shorthand: '->' },
    ],
  },
  {
    id: 'greek_var',
    name: '문자',
    shortName: '문자',
    items: [
      { label: 'a', token: 'a', desc: '문자 a' },
      { label: 'b', token: 'b', desc: '문자 b' },
      { label: 'n', token: 'n', desc: '자연수 n' },
      { label: 'x', token: 'x', desc: '문자 x' },
    ],
  },
];

export interface MathSymbolInsertionResult {
  nextValue: string;
  nextCursorStart: number;
  nextCursorEnd: number;
}

/**
 * 주관식 입력창의 현재 문자열과 커서/선택 영역(selectionStart, selectionEnd)을 기준으로
 * 수학 기호 또는 템플릿('□' 포함)을 스마트하게 삽입하거나 감싼다.
 */
export function applyMathSymbolInsertion(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  token: string
): MathSymbolInsertionResult {
  const safeStart = Math.max(0, Math.min(selectionStart, currentValue.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, currentValue.length));
  const before = currentValue.slice(0, safeStart);
  const selected = currentValue.slice(safeStart, safeEnd);
  const after = currentValue.slice(safeEnd);

  const firstBoxIdx = token.indexOf('□');
  if (firstBoxIdx !== -1) {
    if (selected.length > 0) {
      // 첫 번째 □ 자리에 드래그로 선택한 수식을 넣고, 두 번째 □가 있으면 그 위치로 커서를 이동한다.
      const prefix = token.slice(0, firstBoxIdx);
      const restTemplate = token.slice(firstBoxIdx + 1);
      const secondBoxIdx = restTemplate.indexOf('□');
      if (secondBoxIdx !== -1) {
        const middle = restTemplate.slice(0, secondBoxIdx);
        const suffix = restTemplate.slice(secondBoxIdx + 1).replace(/□/g, '');
        const inserted = `${prefix}${selected}${middle}${suffix}`;
        const cursorTarget = before.length + prefix.length + selected.length + middle.length;
        return {
          nextValue: `${before}${inserted}${after}`,
          nextCursorStart: cursorTarget,
          nextCursorEnd: cursorTarget,
        };
      }
      const suffix = restTemplate.replace(/□/g, '');
      const inserted = `${prefix}${selected}${suffix}`;
      const cursorTarget = before.length + inserted.length;
      return {
        nextValue: `${before}${inserted}${after}`,
        nextCursorStart: cursorTarget,
        nextCursorEnd: cursorTarget,
      };
    } else {
      // 선택 영역이 없을 때는 모든 □를 빈칸으로 치환하되, 첫 번째 □ 위치에 커서를 정확히 배치한다.
      const prefix = token.slice(0, firstBoxIdx);
      const suffix = token.slice(firstBoxIdx + 1).replace(/□/g, '');
      const inserted = `${prefix}${suffix}`;
      const cursorTarget = before.length + prefix.length;
      return {
        nextValue: `${before}${inserted}${after}`,
        nextCursorStart: cursorTarget,
        nextCursorEnd: cursorTarget,
      };
    }
  }

  const nextValue = `${before}${token}${after}`;
  const cursorTarget = before.length + token.length;
  return {
    nextValue,
    nextCursorStart: cursorTarget,
    nextCursorEnd: cursorTarget,
  };
}

export const MATH_SHORTHAND_RULES: ReadonlyArray<{
  shorthand: string;
  replacement: string;
  desc: string;
}> = [
  { shorthand: '<=>', replacement: '⇔', desc: '동치' },
  { shorthand: 'because', replacement: '∵', desc: '왜냐하면' },
  { shorthand: 'sqrt(', replacement: '√(', desc: '제곱근' },
  { shorthand: '>=', replacement: '≥', desc: '크거나 같다' },
  { shorthand: '<=', replacement: '≤', desc: '작거나 같다' },
  { shorthand: '!=', replacement: '≠', desc: '같지 않다' },
  { shorthand: '+-', replacement: '±', desc: '플러스마이너스' },
  { shorthand: '^2', replacement: '²', desc: '제곱' },
  { shorthand: '^3', replacement: '³', desc: '세제곱' },
  { shorthand: '^4', replacement: '⁴', desc: '네제곱' },
  { shorthand: '^n', replacement: 'ⁿ', desc: 'n제곱' },
  { shorthand: '=>', replacement: '⇒', desc: '이면' },
  { shorthand: '->', replacement: '→', desc: '화살표' },
  { shorthand: ':.', replacement: '∴', desc: '따라서' },
];

export interface MathShorthandConversionResult {
  converted: boolean;
  nextValue: string;
  nextCursorPos: number;
  matchedShorthand?: string;
  replacement?: string;
}

/**
 * PC/노트북 키보드 타이핑 중 커서 직전의 문자열이 수학 단축어('>=', '^2', 'sqrt(' 등)와 일치하면
 * 즉시 유니코드 수학 기호로 변환한 문자열과 새 커서 위치를 반환한다.
 */
export function convertMathShorthand(
  value: string,
  cursorPos: number
): MathShorthandConversionResult {
  const safeCursor = Math.max(0, Math.min(cursorPos, value.length));
  const beforeCursor = value.slice(0, safeCursor);
  const afterCursor = value.slice(safeCursor);

  for (const rule of MATH_SHORTHAND_RULES) {
    if (beforeCursor.endsWith(rule.shorthand)) {
      const prefix = beforeCursor.slice(0, beforeCursor.length - rule.shorthand.length);
      const nextValue = `${prefix}${rule.replacement}${afterCursor}`;
      const nextCursorPos = prefix.length + rule.replacement.length;
      return {
        converted: true,
        nextValue,
        nextCursorPos,
        matchedShorthand: rule.shorthand,
        replacement: rule.replacement,
      };
    }
  }

  return {
    converted: false,
    nextValue: value,
    nextCursorPos: safeCursor,
  };
}

export interface MathTextToken {
  type: 'text' | 'radical';
  /** type === 'text'일 때는 일반 문자열, type === 'radical'일 때는 근호(윗줄) 아래에 들어갈 피개방수(radicand) */
  value: string;
  /** 원본 표현이 √(...) 형태였는지 여부 */
  hasParens?: boolean;
  /** 원본 부분 문자열 */
  raw: string;
}

/**
 * 문자열 내의 루트(근호, √) 수식을 파싱하여 일반 텍스트 토큰과 근호(radical + 윗줄 피개방수) 토큰으로 분리한다.
 * - √(ab), √(a × 1/a), √(□) 등 괄호로 감싸진 경우 괄호 내부 전체를 피개방수(value)로 추출한다.
 * - √2, √2m 등 숫자가 바로 뒤따르는 경우 숫자 부분만 피개방수로 추출하여 √2m이 (√2)m으로 정확히 해석되게 한다.
 * - √a, √b, √ab, √a√b, √□ 등 문자나 빈칸 기호가 뒤따르는 경우 해당 문자/기호를 피개방수로 추출한다.
 */
export function tokenizeMathRadicals(text: string): MathTextToken[] {
  if (!text) return [];
  const normalized = text.replace(/\u0305/g, '');
  if (!normalized.includes('√')) {
    return [{ type: 'text', value: normalized, raw: normalized }];
  }

  const tokens: MathTextToken[] = [];
  let i = 0;
  const len = normalized.length;

  while (i < len) {
    const idx = normalized.indexOf('√', i);
    if (idx === -1) {
      const rest = normalized.slice(i);
      tokens.push({ type: 'text', value: rest, raw: rest });
      break;
    }

    if (idx > i) {
      const before = normalized.slice(i, idx);
      tokens.push({ type: 'text', value: before, raw: before });
    }

    const afterIdx = idx + 1;
    if (afterIdx >= len) {
      tokens.push({ type: 'radical', value: '', hasParens: false, raw: '√' });
      break;
    }

    const nextChar = normalized[afterIdx];

    // 1. √(...) 형태: 짝이 맞는 닫는 괄호 ')'까지를 피개방수로 추출
    if (nextChar === '(') {
      let depth = 1;
      let k = afterIdx + 1;
      let foundClose = -1;
      while (k < len) {
        const ch = normalized[k];
        if (ch === '\n') break;
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) {
            foundClose = k;
            break;
          }
        }
        k++;
      }

      if (foundClose !== -1) {
        const inner = normalized.slice(afterIdx + 1, foundClose);
        const raw = normalized.slice(idx, foundClose + 1);
        tokens.push({
          type: 'radical',
          value: inner,
          hasParens: true,
          raw,
        });
        i = foundClose + 1;
        continue;
      } else {
        // 아직 닫는 괄호를 입력 중인 경우 (예: '√(ab' 또는 단축어 안내 'sqrt(→√(')
        const unclosedMatch = normalized.slice(afterIdx + 1).match(/^[0-9a-zA-Z□+\-×·*/]+/);
        if (unclosedMatch && unclosedMatch[0].length > 0) {
          const inner = unclosedMatch[0];
          const raw = `√(${inner}`;
          tokens.push({
            type: 'radical',
            value: `(${inner}`,
            hasParens: false,
            raw,
          });
          i = afterIdx + 1 + inner.length;
          continue;
        } else {
          tokens.push({
            type: 'radical',
            value: '(',
            hasParens: false,
            raw: '√(',
          });
          i = afterIdx + 1;
          continue;
        }
      }
    }

    // 2. √2, √1, √2m 형태: 연속된 숫자만 근호 안(피개방수)으로 묶고 뒤따르는 문자(m 등)는 근호 밖에 배치
    const numMatch = normalized.slice(afterIdx).match(/^[0-9]+(?:\.[0-9]+)?/);
    if (numMatch) {
      const digits = numMatch[0];
      tokens.push({
        type: 'radical',
        value: digits,
        hasParens: false,
        raw: `√${digits}`,
      });
      i = afterIdx + digits.length;
      continue;
    }

    // 3. √a, √b, √ab, √a√b, √□ 형태: 연속된 영문자 또는 □를 피개방수로 추출
    const varMatch = normalized.slice(afterIdx).match(/^(?:□|[a-zA-Z]+)/);
    if (varMatch) {
      const vars = varMatch[0];
      tokens.push({
        type: 'radical',
        value: vars,
        hasParens: false,
        raw: `√${vars}`,
      });
      i = afterIdx + vars.length;
      continue;
    }

    // 4. 단독 근호 기호 '√'
    tokens.push({
      type: 'radical',
      value: '',
      hasParens: false,
      raw: '√',
    });
    i = afterIdx;
  }

  return tokens;
}

