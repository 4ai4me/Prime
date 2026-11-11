import React from 'react';
import { MathText } from './MathText';

/**
 * 교사 화면에서 학생 답안을 표시할 때 사용합니다.
 * - 값이 비어 있으면 눈에 띄는 색의 '미작성'을 표시합니다.
 * - 값 안에 '미작성'이 섞여 있으면(예: "단계 확인: 0/4\n미작성") 그 부분만 강조합니다.
 */

/** '미작성' 강조 스타일 (교사가 한눈에 알아볼 수 있도록 빨간 굵은 글씨) */
export const UNWRITTEN_CLASS = 'font-bold text-rose-600';

export function UnwrittenMark({ text = '미작성' }: { text?: string }) {
  return <span className={UNWRITTEN_CLASS}>{text}</span>;
}

const UNWRITTEN_PATTERN = /(\(미작성\)|미작성)/;

function highlightUnwritten(text: string): React.ReactNode {
  const parts = text.split(UNWRITTEN_PATTERN);
  return parts.map((part, i) =>
    UNWRITTEN_PATTERN.test(part) ? (
      <UnwrittenMark key={i} text={part} />
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

export function AnswerText({ value, math = false }: { value: unknown; math?: boolean }) {
  const text = value === null || value === undefined ? '' : String(value);
  if (text.trim() === '') return <UnwrittenMark />;
  if (UNWRITTEN_PATTERN.test(text)) return <>{highlightUnwritten(text)}</>;
  return math ? <MathText text={text} /> : <>{text}</>;
}
