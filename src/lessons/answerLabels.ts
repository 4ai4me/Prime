import { HELP_SOURCE_OPTIONS, type LessonKey } from '../utils/studentRecord';

/**
 * 교사 화면 [전체 답안 보기]·CSV에 쓰는 문항 이름표
 * ------------------------------------------------------------------
 * 차시에 입력 칸을 추가하면 그 칸의 이름표를 LESSON_FIELD_LABELS에 꼭 추가합니다.
 * 이름표가 없는 칸도 값이 있으면 '기타 기록'으로 보이지만, 교사가 알아보기 어렵습니다.
 * (answerLabels.test.ts가 각 차시 상태의 칸 이름과 이 표를 비교합니다.)
 */

export const HELP_SOURCE_FIELD = 'helpSource';

/** 모든 차시에 공통인 성찰 칸 (표시 순서대로) */
export const COMMON_FIELD_LABELS: Record<string, string> = {
  reflection1: '성찰 1 · 이번 차시에서 알게 된 것',
  reflection2: '성찰 2 · 더 궁금한 점이나 어려웠던 점',
  [HELP_SOURCE_FIELD]: '해결 방법 (도움 받은 정도)',
};

/** 차시별 문항 이름표 (자료를 채울 때 추가) */
export const LESSON_FIELD_LABELS: Record<LessonKey, Record<string, string>> = {
  l1: {
    connectA: '[단원 열기 1] 6 = □ × □ 의 앞 수',
    connectB: '[단원 열기 1] 6 = □ × □ 의 뒤 수',
    connectExample: '[단원 열기 2] 두 가지 이상이 결합된 예',
    connectVerified: '점검 통과 · 단원 열기',
    prepDiv10: '[준비 1-(1)] 10의 약수',
    prepDiv16: '[준비 1-(2)] 16의 약수',
    prepMul5: '[준비 2-(1)] 5의 배수 3개',
    prepMul12: '[준비 2-(2)] 12의 배수 3개',
    prepGcd915: '[준비 3-(1)] 9, 15의 최대공약수',
    prepGcd1620: '[준비 3-(2)] 16, 20의 최대공약수',
    prepLcm410: '[준비 4-(1)] 4, 10의 최소공배수',
    prepLcm1218: '[준비 4-(2)] 12, 18의 최소공배수',
    prepSure1: '[준비 1] 자기 점검 (약수)',
    prepSure2: '[준비 2] 자기 점검 (배수)',
    prepSure3: '[준비 3] 자기 점검 (최대공약수)',
    prepSure4: '[준비 4] 자기 점검 (최소공배수)',
    prepVerified: '점검 통과 · 준비 학습',
    open6Picks: '[생각 열기] 고른 6의 약수',
    open7Picks: '[생각 열기] 고른 7의 약수',
    openPrimes: '[생각 열기] 7처럼 1과 자기 자신만 약수인 수',
    openVerified: '점검 통과 · 생각 열기',
    talkDivisorCount: '[생각 톡톡] 소수의 약수 개수',
    oneClass: '[개념] 1은 어디에 속할까?',
    conceptVerified: '점검 통과 · 개념 확인',
    myNumber: '[내가 고른 수] 수',
    myDivisors: '[내가 고른 수] 약수',
    myClass: '[내가 고른 수] 판단',
    myVerified: '점검 통과 · 내가 고른 수',
    p1Class11: '[문제 1-(1)] 11',
    p1Class14: '[문제 1-(2)] 14',
    p1Class19: '[문제 1-(3)] 19',
    p1Class27: '[문제 1-(4)] 27',
    p1Divisor11: '[문제 1] 11 — 합성수 증거로 쓴 약수',
    p1Divisor14: '[문제 1] 14 — 합성수 증거로 쓴 약수',
    p1Divisor19: '[문제 1] 19 — 합성수 증거로 쓴 약수',
    p1Divisor27: '[문제 1] 27 — 합성수 증거로 쓴 약수',
    p1Verified: '점검 통과 · 문제 1',
    evenTwo: '[오개념 점검] 2는 소수일까?',
    evenTwoReason: '[오개념 점검] 이유',
    evenVerified: '점검 통과 · 오개념 점검',
    chPicks: '[도전] 고른 수 5개',
    chReason: '[도전] 찾은 방법 설명',
    chVerified: '점검 통과 · 도전',
  },
  l2: {},
  l3: {},
  l4: {},
  l5: {},
  l6: {},
};

export function fieldLabelsOf(key: LessonKey): Record<string, string> {
  return { ...LESSON_FIELD_LABELS[key], ...COMMON_FIELD_LABELS };
}

/** 고르기 문항의 저장 값 → 화면 글 (칸 이름의 앞부분으로 구분) */
const CODE_LABELS: Array<{ match: RegExp; labels: Record<string, string> }> = [
  { match: /^(oneClass|myClass|p1Class\d+)$/, labels: { prime: '소수', composite: '합성수', neither: '소수도 합성수도 아님' } },
  { match: /^prepSure\d$/, labels: { sure: '자신 있어요', need: '학습이 필요해요' } },
  { match: /^evenTwo$/, labels: { yes: '소수이다', no: '소수가 아니다' } },
];

/** 저장된 값 → 교사가 읽을 글 */
export function formatAnswerValue(field: string, value: unknown): string {
  if (value === undefined || value === null) return '';
  const coded = CODE_LABELS.find((c) => c.match.test(field));
  if (coded && typeof value === 'string') return coded.labels[value] ?? '';
  if (field === HELP_SOURCE_FIELD) {
    const opt = HELP_SOURCE_OPTIONS.find((o) => o.value === value);
    return opt ? opt.label : '';
  }
  if (typeof value === 'boolean') return value ? (field.endsWith('Verified') ? '통과' : '예') : '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((v) => formatAnswerValue('', v)).filter(Boolean).join(', ');
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export interface AnswerRow {
  field: string;
  label: string;
  text: string;
}

/** 한 차시 답안 → 표시할 줄 목록 (이름표 순서 + 이름표 없는 칸은 '기타 기록') */
export function lessonAnswerRows(key: LessonKey, state: unknown): { rows: AnswerRow[]; extra: AnswerRow[] } {
  const obj = state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
  const labels = fieldLabelsOf(key);
  const rows: AnswerRow[] = Object.entries(labels).map(([field, label]) => ({
    field,
    label,
    text: formatAnswerValue(field, obj[field]),
  }));
  const extra: AnswerRow[] = Object.keys(obj)
    .filter((f) => !(f in labels))
    .map((field) => ({ field, label: field, text: formatAnswerValue(field, obj[field]) }))
    .filter((r) => r.text.trim() !== '');
  return { rows, extra };
}
