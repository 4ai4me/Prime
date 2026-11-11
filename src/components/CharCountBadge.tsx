import React from 'react';

interface CharCountBadgeProps {
  current?: number;
  text?: string;
  min: number;
  className?: string;
}

/**
 * 실시간 글자 수 표시 및 최소 요구 글자 수 충족 여부 시각화 배지
 * - 지정된 글자 수 미만: 빨간색 (부족한 글자 수 안내)
 * - 지정된 글자 수 이상: 초록색 (조건 충족 안내)
 */
export const CharCountBadge: React.FC<CharCountBadgeProps> = ({
  current,
  text,
  min,
  className = '',
}) => {
  const count = typeof current === 'number' ? current : (text ?? '').trim().length;
  const isSatisfied = count >= min;
  const remaining = min - count;

  return (
    <span
      className={`inline-flex items-center gap-1.5 mono text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${
        isSatisfied
          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
          : 'text-rose-600 bg-rose-50 border border-rose-200'
      } ${className}`}
      aria-live="polite"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          isSatisfied ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
        }`}
      />
      <span>
        현재 <strong className="font-extrabold">{count}</strong>자 / 최소 {min}자
      </span>
      {isSatisfied ? (
        <span className="text-[11px] font-semibold text-emerald-700">✓ 조건 충족</span>
      ) : (
        <span className="text-[11px] font-semibold text-rose-600">
          ({remaining}자 더 필요)
        </span>
      )}
    </span>
  );
};

/**
 * 글자 수에 따른 입력 필드 테두리 스타일 클래스 반환
 */
export function getCharCountBorderClass(current: number, min: number): string {
  if (current === 0) {
    return 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20';
  }
  if (current < min) {
    return 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-500/20';
  }
  return 'border-emerald-300 bg-emerald-50/10 focus:border-emerald-500 focus:ring-emerald-500/20';
}
