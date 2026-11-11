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
  l1: {},
  l2: {},
  l3: {},
  l4: {},
  l5: {},
  l6: {},
};

export function fieldLabelsOf(key: LessonKey): Record<string, string> {
  return { ...LESSON_FIELD_LABELS[key], ...COMMON_FIELD_LABELS };
}

/** 저장된 값 → 교사가 읽을 글 */
export function formatAnswerValue(field: string, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (field === HELP_SOURCE_FIELD) {
    const opt = HELP_SOURCE_OPTIONS.find((o) => o.value === value);
    return opt ? opt.label : '';
  }
  if (typeof value === 'boolean') return value ? '예' : '';
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
