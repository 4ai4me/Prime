/**
 * 모든 차시에 공통인 칸·형식 (studentRecord와 각 차시 로직이 함께 씀 — 서로 불러오는 순환을 피하려고 따로 둠)
 */

/** 성찰 단계 '이번 차시 문제를 어떻게 해결했나요?' — 완료 조건·평가 점수에는 쓰지 않음 */
export type HelpSource = '' | 'ai' | 'hint' | 'peer' | 'self';
export const HELP_SOURCE_OPTIONS: { value: Exclude<HelpSource, ''>; label: string; short: string }[] = [
  { value: 'ai', label: 'AI의 도움을 받았어요', short: 'AI 도움' },
  { value: 'hint', label: '힌트의 도움을 받았어요', short: '힌트 도움' },
  { value: 'peer', label: '친구나 선생님의 도움을 받았어요', short: '친구·선생님 도움' },
  { value: 'self', label: '스스로 해결했어요', short: '스스로 해결' },
];
export function sanitizeHelpSource(v: unknown): HelpSource {
  return v === 'ai' || v === 'hint' || v === 'peer' || v === 'self' ? v : '';
}

/** 모든 차시에 공통으로 있는 성찰 칸 */
export interface LessonCommonState {
  reflection1?: string;
  reflection2?: string;
  helpSource?: HelpSource;
}


/** 성찰 1 최소 글자 수 */
export const REFLECTION_MIN_CHARS = 20;

/** 성찰 단계 완료: 성찰 1이 최소 글자 수 이상 (도움 받은 정도는 완료와 무관) */
export function isReflectionDone(state: LessonCommonState): boolean {
  return (state.reflection1 ?? '').trim().length >= REFLECTION_MIN_CHARS;
}
