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
    tile7Found: '[도형 활동 1] 타일 7개로 찾은 직사각형',
    tile7Count: '[도형 활동 1] 배열 방법 수',
    tile7Verified: '점검 통과 · 도형 활동 1',
    tile16Found: '[도형 활동 2] 타일 16개로 찾은 직사각형',
    tile16Count: '[도형 활동 2] 배열 방법 수',
    tile16Verified: '점검 통과 · 도형 활동 2',
    tileOneNumbers: '[도형 활동 3] 배열 방법이 한 가지뿐인 타일 개수',
    tileOneFeature: '[도형 활동 3] 그 수들의 특징',
    tileOneVerified: '점검 통과 · 도형 활동 3',
    chPicks: '[도전] 고른 수 5개',
    chReason: '[도전] 찾은 방법 설명',
    chVerified: '점검 통과 · 도전',
  },
  l2: {},
  l3: {
    microDay1: '[생각 열기] 1일 후 마리 수',
    microDay2: '[생각 열기] 2일 후 마리 수',
    microDay3: '[생각 열기] 3일 후 마리 수',
    microDay4: '[생각 열기] 4일 후 마리 수',
    microDay5: '[생각 열기] 5일 후 마리 수',
    microExpr: '[생각 열기] 5일 후 마리 수를 나타낸 식',
    openVerified: '점검 통과 · 생각 열기',
    read23: '[개념] 2³ 읽기',
    bogiBase34: '[보기 ①] 3⁴의 밑',
    bogiExp34: '[보기 ①] 3⁴의 지수',
    bogiExp5: '[보기 ②] 밑 5의 지수',
    bogiExp7: '[보기 ②] 밑 7의 지수',
    blankPower: '[개념 빈칸 ①] 통틀어 2의 (  )',
    blankBase: '[개념 빈칸 ②] 곱하는 수 → (  )',
    blankExp: '[개념 빈칸 ③] 곱해진 개수 → (  )',
    conceptVerified: '점검 통과 · 거듭제곱의 뜻',
    p1a: '[문제 1-(1)] 4 × 4 × 4',
    p1b: '[문제 1-(2)] 2 × 2 × 2 × 2 × 7 × 7 × 7',
    c1a: '[확인 1-(1)] 3 × 3 × 3 × 3 × 3 × 3',
    c1b: '[확인 1-(2)] 2 × 5 × 2 × 2 × 5',
    p1Verified: '점검 통과 · 문제 1',
    mis23: '[오개념] 2³의 값',
    mis32: '[오개념] 3²의 값',
    misBigger: '[오개념] 더 큰 쪽',
    mis33: '[오개념] 3³의 값',
    misReason: '[오개념] 친구가 헷갈린 점',
    misVerified: '점검 통과 · 오개념 점검',
    chDay: '[도전] 처음 1000마리를 넘는 날',
    chExpr: '[도전] 그날 마리 수 (거듭제곱)',
    chVerified: '점검 통과 · 도전',
  },
  l4: {
    openB2: '[생각 열기] 12 = 2 × □',
    openB3: '[생각 열기] 12 = 3 × □',
    openDiv12: '[생각 열기] 12의 약수',
    openPrime12: '[생각 열기] 12의 약수 중 소수',
    openVerified: '점검 통과 · 생각 열기',
    p2_16: '[문제 2-(1)] 16의 소인수',
    p2_33: '[문제 2-(2)] 33의 소인수',
    p2_42: '[문제 2-(3)] 42의 소인수',
    p2_80: '[문제 2-(4)] 80의 소인수',
    p2Verified: '점검 통과 · 문제 2',
    tree1: '[함께하기] 순서 1에서 나눈 소수',
    tree2: '[함께하기] 순서 2에서 나눈 소수',
    tree1Result: '[함께하기] 순서 1 결과',
    tree2Result: '[함께하기] 순서 2 결과',
    treeSame: '[함께하기] 두 결과 비교',
    treeVerified: '점검 통과 · 함께하기',
    ladder90: '[예제 1] 나눗셈에서 나눈 소수',
    result90: '[예제 1] 90의 소인수분해',
    ex1Verified: '점검 통과 · 예제 1',
    p3_32: '[문제 3-(1)] 32',
    p3_63: '[문제 3-(2)] 63',
    p3_98: '[문제 3-(3)] 98',
    p3_150: '[문제 3-(4)] 150',
    p3Verified: '점검 통과 · 문제 3',
    t75a: '[예제 2 표] 1 × 1',
    t75b: '[예제 2 표] 1 × 5',
    t75c: '[예제 2 표] 1 × 5²',
    t75d: '[예제 2 표] 3 × 1',
    t75e: '[예제 2 표] 3 × 5',
    t75f: '[예제 2 표] 3 × 5²',
    div75: '[예제 2] 75의 약수',
    tableVerified: '점검 통과 · 예제 2',
    talk6: '[생각 톡톡] 6의 약수 개수',
    talk9: '[생각 톡톡] 9의 약수 개수',
    talkAlways: '[생각 톡톡] 큰 수가 약수가 항상 더 많을까',
    talkVerified: '점검 통과 · 생각 톡톡',
    p4a: '[문제 4-(1)] 2² × 5²의 약수',
    p4b: '[문제 4-(2)] 54의 약수',
    p4Verified: '점검 통과 · 문제 4',
    cnt40: '[도전] 40의 약수의 개수',
    cnt40Reason: '[도전] 구한 방법',
    cntVerified: '점검 통과 · 도전',
    code5239: '[블록 코딩 활동 1] 5239의 소인수분해',
    codeNum: '[블록 코딩 활동 2] 입력한 수',
    codeResult: '[블록 코딩 활동 2] 결과',
    codeVerified: '점검 통과 · 블록 코딩',
    rvBlank1: '[확인 개념 ①] 통틀어 2의 (  )',
    rvBlank2a: '[확인 개념 ②] 곱하는 수 3 → (  )',
    rvBlank2b: '[확인 개념 ②] 곱해진 개수 4 → (  )',
    rvBlank3: '[확인 개념 ③] 약수 중 소수 → (  )',
    rvBlank4: '[확인 개념 ④] 소인수들만의 곱으로 → (  )',
    rvConceptVerified: '점검 통과 · 확인 개념',
    rv2_18: '[확인 2-(1)] 18의 소인수',
    rv2_26: '[확인 2-(2)] 26의 소인수',
    rv2_35: '[확인 2-(3)] 35의 소인수',
    rv2_84: '[확인 2-(4)] 84의 소인수',
    rv3_45: '[확인 3-(1)] 45',
    rv3_56: '[확인 3-(2)] 56',
    rv3_125: '[확인 3-(3)] 125',
    rv3_132: '[확인 3-(4)] 132',
    rv23Verified: '점검 통과 · 확인 2·3',
    rv5Picks: '[확인 5] 고른 108의 약수',
    rv5Verified: '점검 통과 · 확인 5',
    rv4Answer: '[확인 4 서술형] 답',
    rv4Reason: '[확인 4 서술형] 풀이',
    rv4Verified: '점검 통과 · 확인 4',
  },
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
  { match: /^read23$/, labels: { cube2: '2의 세제곱', square3: '3의 제곱', times3: '2의 3배' } },
  {
    match: /^(blankPower|blankBase|blankExp|rvBlank\w+)$/,
    labels: { power: '거듭제곱', base: '밑', exponent: '지수', multiple: '배수', divisor: '약수', primeFactor: '소인수', factorization: '소인수분해' },
  },
  { match: /^misBigger$/, labels: { a: '2³이 더 크다', b: '3²이 더 크다', same: '같다' } },
  { match: /^treeSame$/, labels: { same: '결과가 같다', diff: '결과가 다르다' } },
  { match: /^talkAlways$/, labels: { yes: '항상 더 많다', no: '항상 그런 것은 아니다' } },
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
  if (Array.isArray(value) && field === 'rv5Picks') {
    return value.map((v) => String(v).replace(/\^(\d)/g, (_, d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).replace(/x/g, ' × ')).join(', ');
  }
  if (Array.isArray(value) && /^tile\d+Found$/.test(field)) {
    return value.map((v) => String(v).replace('x', ' × ')).join(', ');
  }
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
