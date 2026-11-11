import React from 'react';
import { tokenizeMathRadicals } from '../utils/mathLogic';

export interface MathRadicalProps {
  radicand: string;
  hasParens?: boolean;
  className?: string;
}

/**
 * 근호(√) 갈고리와 피개방수 상단의 수평 윗줄(vinculum)이 빈틈없이 연결된 온전한 루트 기호를 렌더링한다.
 * - 한글 산세리프 폰트에서 '√'가 체크 표시(V)처럼 보이는 문제를 원천 차단하기 위해
 *   벡터 SVG 근호 획과 상단 오버라인(border-top)을 결합하여 표시한다.
 * - 스크린리더 및 텍스트 복사(textContent) 호환을 위해 원본 '√' 및 괄호 텍스트를 sr-only로 유지한다.
 */
export const MathRadical: React.FC<MathRadicalProps> = ({
  radicand,
  hasParens = false,
  className = '',
}) => {
  const displayRadicand = radicand.length > 0 ? radicand : '\u00A0';
  const ariaDescription =
    radicand.length > 0 && radicand !== '(' ? `루트 ${radicand}` : '루트';

  return (
    <span
      className={`math-radical ${className}`.trim()}
      role="math"
      aria-label={ariaDescription}
    >
      <span className="math-radical-surd" aria-hidden="true">
        <svg
          viewBox="0 0 12 20"
          preserveAspectRatio="none"
          className="math-radical-svg"
          focusable="false"
        >
          <path
            d="M 0.8 11.4 L 3.0 9.8 L 6.0 18.2 L 11.3 0.85 L 12.6 0.85"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
      <span className="sr-only">√{hasParens ? '(' : ''}</span>
      <span className="math-radical-body">
        {radicand.includes('√') ? <MathText text={radicand} /> : displayRadicand}
      </span>
      {hasParens && <span className="sr-only">)</span>}
    </span>
  );
};

export interface MathTextProps {
  text?: string | null;
  className?: string;
}

export const normalizeMathSymbols = (str: string): string => {
  return str
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\le(q)?\b/g, '≤')
    .replace(/\\ge(q)?\b/g, '≥')
    .replace(/\\ne(q)?\b/g, '≠')
    .replace(/\\pm\b/g, '±');
};

/**
 * 문자열 내의 모든 루트 수식(√(ab), √a, √b, √2, √(□) 등)을 찾아
 * 윗줄(vinculum)이 연결된 온전한 수학 근호(<MathRadical />)로 변환하여 렌더링한다.
 */
export const MathText: React.FC<MathTextProps> = ({ text, className }) => {
  if (!text) return null;
  const normalizedText = normalizeMathSymbols(text);
  if (!normalizedText.includes('√')) {
    return className ? <span className={className}>{normalizedText}</span> : <>{normalizedText}</>;
  }

  const tokens = tokenizeMathRadicals(normalizedText);
  const content = tokens.map((tok, idx) => {
    if (tok.type === 'radical') {
      return (
        <MathRadical
          key={idx}
          radicand={tok.value}
          hasParens={tok.hasParens}
        />
      );
    }
    return <React.Fragment key={idx}>{tok.value}</React.Fragment>;
  });

  return className ? <span className={className}>{content}</span> : <>{content}</>;
};

export interface MathPreviewBoxProps {
  text: string;
  placeholder?: string;
  className?: string;
}

/**
 * 주관식 서술형 입력창(<textarea>) 아래에 온전한 근호(윗줄 포함) 수식 표기를 실시간으로 보여 주는 미리보기 컴포넌트.
 */
export const MathPreviewBox: React.FC<MathPreviewBoxProps> = ({
  text,
  placeholder = '',
  className = '',
}) => {
  const trimmed = text.trim();
  const hasUserRadical = trimmed.includes('√');
  const hasPlaceholderRadical = !trimmed && placeholder.includes('√');

  if (!hasUserRadical && !hasPlaceholderRadical) {
    return null;
  }

  const targetText = hasUserRadical ? text : placeholder;

  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm transition-colors ${
        hasUserRadical
          ? 'border-blue-200 bg-blue-50/70 text-slate-900'
          : 'border-slate-200 bg-slate-100/75 text-slate-600'
      } ${className}`.trim()}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          className={`text-[11px] font-extrabold ${
            hasUserRadical ? 'text-blue-700' : 'text-slate-500'
          }`}
        >
          {hasUserRadical
            ? '실시간 수식 표기 확인 (온전한 근호 윗줄 적용)'
            : '작성 예시 수식 표기 (온전한 근호 윗줄 적용)'}
        </span>
      </div>
      <div className="leading-relaxed whitespace-pre-wrap break-words font-medium">
        <MathText text={targetText} />
      </div>
    </div>
  );
};
