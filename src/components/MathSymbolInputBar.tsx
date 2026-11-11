import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LESSON_RECOMMENDED_SYMBOLS,
  MATH_SHORTHAND_RULES,
  MATH_SYMBOL_CATEGORIES,
  MathSymbolCategoryId,
  MathSymbolItem,
  applyMathSymbolInsertion,
  convertMathShorthand,
  type LessonTabNumber,
} from '../utils/mathLogic';
import {
  Keyboard,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Delete,
  ArrowLeft,
  ArrowRight,
  Search,
  CheckCircle2,
  Minimize2,
  Maximize2,
  HelpCircle,
} from 'lucide-react';
import { MathText } from './MathText';

interface MathSymbolInputBarProps {
  activeLesson: LessonTabNumber;
}

const STORAGE_KEY_MATH_RECENTS = 'math_detective_recent_symbols_v1';
const STORAGE_KEY_MATH_SHORTHAND = 'math_detective_shorthand_enabled_v1';

function isSubjectiveMathInput(el: Element | null): el is HTMLTextAreaElement | HTMLInputElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) {
    return !el.readOnly && !el.disabled;
  }
  if (el instanceof HTMLInputElement) {
    if (el.readOnly || el.disabled) return false;
    if (el.dataset.mathBarIgnore === 'true') return false;
    // 숫자 전용 단서 입력칸(inputMode="numeric")이나 체크박스/라디오는 제외하고 주관식 수식/문장 입력칸만 대상으로 함
    if (el.type !== 'text') return false;
    if (el.inputMode === 'numeric') return false;
    return true;
  }
  return false;
}

function getFieldDescription(el: HTMLTextAreaElement | HTMLInputElement | null): string {
  if (!el) return '주관식 서술형 입력칸을 클릭(터치)하면 커서 위치에 수식이 바로 입력됩니다';
  if (el.id) {
    const labelEl = document.querySelector(`label[for="${el.id}"]`);
    if (labelEl && labelEl.textContent) {
      return labelEl.textContent.trim().slice(0, 48);
    }
  }
  if (el.placeholder) {
    return el.placeholder.trim().slice(0, 48);
  }
  return '현재 선택된 주관식 서술 입력칸';
}

function setNativeInputValue(
  el: HTMLTextAreaElement | HTMLInputElement,
  nextValue: string,
  cursorStart: number,
  cursorEnd: number
) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(el, nextValue);
  } else {
    el.value = nextValue;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  try {
    el.focus({ preventScroll: true });
    el.setSelectionRange(cursorStart, cursorEnd);
  } catch {
    // ignore selection range error on unsupported inputs
  }
}

export const MathSymbolInputBar: React.FC<MathSymbolInputBarProps> = ({ activeLesson }) => {
  const activeInputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const isComposingRef = useRef<boolean>(false);
  const internalDispatchRef = useRef<boolean>(false);

  const [hasFocusedInput, setHasFocusedInput] = useState<boolean>(false);
  const [activeFieldLabel, setActiveFieldLabel] = useState<string>(
    '주관식 서술형 입력칸을 클릭(터치)하면 커서 위치에 수식이 입력됩니다'
  );
  const [selectedTextPreview, setSelectedTextPreview] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<MathSymbolCategoryId>('recommended');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showShorthandHelp, setShowShorthandHelp] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [autoShorthand, setAutoShorthand] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MATH_SHORTHAND);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [recentSymbols, setRecentSymbols] = useState<MathSymbolItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MATH_RECENTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, 8);
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [lastConversionNotice, setLastConversionNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MATH_SHORTHAND, String(autoShorthand));
    } catch {
      // ignore
    }
  }, [autoShorthand]);

  const recordRecentSymbol = (item: MathSymbolItem) => {
    setRecentSymbols((prev) => {
      const filtered = prev.filter((x) => x.label !== item.label);
      const next = [item, ...filtered].slice(0, 8);
      try {
        localStorage.setItem(STORAGE_KEY_MATH_RECENTS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Track focus and selection across all subjective textarea / text inputs
  useEffect(() => {
    const syncSelectionPreview = (el: HTMLTextAreaElement | HTMLInputElement | null) => {
      if (!el) {
        setSelectedTextPreview('');
        return;
      }
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      if (end > start) {
        setSelectedTextPreview(el.value.slice(start, end).slice(0, 20));
      } else {
        setSelectedTextPreview('');
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (isSubjectiveMathInput(target)) {
        activeInputRef.current = target;
        setHasFocusedInput(true);
        setActiveFieldLabel(getFieldDescription(target));
        syncSelectionPreview(target);
      }
    };

    const handleSelectionChange = () => {
      const activeEl = document.activeElement;
      if (isSubjectiveMathInput(activeEl)) {
        activeInputRef.current = activeEl;
        setHasFocusedInput(true);
        syncSelectionPreview(activeEl);
      }
    };

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false;
    };

    const handleInput = (e: Event) => {
      if (internalDispatchRef.current) return;
      if (!autoShorthand || isComposingRef.current) return;
      const target = e.target as Element | null;
      if (!isSubjectiveMathInput(target)) return;

      const cursorPos = target.selectionStart ?? target.value.length;
      const conv = convertMathShorthand(target.value, cursorPos);
      if (conv.converted) {
        internalDispatchRef.current = true;
        setNativeInputValue(target, conv.nextValue, conv.nextCursorPos, conv.nextCursorPos);
        internalDispatchRef.current = false;
        setLastConversionNotice(`${conv.matchedShorthand} → ${conv.replacement}`);
        setTimeout(() => {
          setLastConversionNotice((prev) =>
            prev === `${conv.matchedShorthand} → ${conv.replacement}` ? null : prev
          );
        }, 2500);
      }
    };

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('compositionstart', handleCompositionStart, true);
    document.addEventListener('compositionend', handleCompositionEnd, true);
    document.addEventListener('input', handleInput, true);

    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('compositionstart', handleCompositionStart, true);
      document.removeEventListener('compositionend', handleCompositionEnd, true);
      document.removeEventListener('input', handleInput, true);
    };
  }, [autoShorthand]);

  const ensureTargetElement = (): HTMLTextAreaElement | HTMLInputElement | null => {
    const current = activeInputRef.current;
    if (current && document.body.contains(current) && isSubjectiveMathInput(current)) {
      return current;
    }
    // 만약 아직 클릭한 입력칸이 없다면 현재 화면에 보이는 첫 번째 주관식 textarea를 자동으로 찾는다.
    const firstTextarea = document.querySelector<HTMLTextAreaElement>(
      'main textarea:not([disabled]):not([readonly])'
    );
    if (firstTextarea) {
      activeInputRef.current = firstTextarea;
      setHasFocusedInput(true);
      setActiveFieldLabel(getFieldDescription(firstTextarea));
      return firstTextarea;
    }
    return null;
  };

  const handleInsertSymbol = (item: MathSymbolItem) => {
    const target = ensureTargetElement();
    if (!target) return;

    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const res = applyMathSymbolInsertion(target.value, start, end, item.token);

    internalDispatchRef.current = true;
    setNativeInputValue(target, res.nextValue, res.nextCursorStart, res.nextCursorEnd);
    internalDispatchRef.current = false;

    recordRecentSymbol(item);
    setSelectedTextPreview('');
    setLastConversionNotice(`입력됨: ${item.label}`);
    setTimeout(() => {
      setLastConversionNotice((prev) => (prev === `입력됨: ${item.label}` ? null : prev));
    }, 1800);
  };

  const handleMoveCursor = (delta: number) => {
    const target = ensureTargetElement();
    if (!target) return;
    const pos = target.selectionEnd ?? target.value.length;
    const nextPos = Math.max(0, Math.min(target.value.length, pos + delta));
    try {
      target.focus({ preventScroll: true });
      target.setSelectionRange(nextPos, nextPos);
      setSelectedTextPreview('');
    } catch {
      // ignore
    }
  };

  const handleBackspace = () => {
    const target = ensureTargetElement();
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    if (start === 0 && end === 0) return;

    const deleteStart = start === end ? Math.max(0, start - 1) : start;
    const nextValue = target.value.slice(0, deleteStart) + target.value.slice(end);
    internalDispatchRef.current = true;
    setNativeInputValue(target, nextValue, deleteStart, deleteStart);
    internalDispatchRef.current = false;
    setSelectedTextPreview('');
  };

  const lessonRecommended = useMemo(
    () => LESSON_RECOMMENDED_SYMBOLS[activeLesson] || LESSON_RECOMMENDED_SYMBOLS[1],
    [activeLesson]
  );

  // 전체 기호 검색 결과
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const list: MathSymbolItem[] = [];
    const allItems = [
      ...lessonRecommended,
      ...MATH_SYMBOL_CATEGORIES.flatMap((c) => c.items),
    ];
    for (const item of allItems) {
      if (seen.has(item.label)) continue;
      if (
        item.label.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        (item.shorthand && item.shorthand.toLowerCase().includes(q))
      ) {
        seen.add(item.label);
        list.push(item);
      }
    }
    return list;
  }, [searchQuery, lessonRecommended]);

  const displayedCategoryItems = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      return searchResults;
    }
    if (activeCategory === 'recommended') {
      return lessonRecommended;
    }
    const found = MATH_SYMBOL_CATEGORIES.find((c) => c.id === activeCategory);
    return found ? found.items : lessonRecommended;
  }, [activeCategory, lessonRecommended, searchQuery, searchResults]);

  if (isMinimized) {
    return (
      <div className="no-print fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsMinimized(false)}
          className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/40 bg-slate-900/95 px-4 py-3 text-xs sm:text-sm font-extrabold text-white shadow-xl backdrop-blur-md hover:bg-slate-800 transition-all ring-2 ring-blue-500/20"
          title="스마트 수학 기호·수식 입력기 열기"
        >
          <Keyboard className="h-4 w-4 text-sky-400" />
          <span>수학 기호 입력기 (0{activeLesson}차시 맞춤)</span>
          <Maximize2 className="h-3.5 w-3.5 text-slate-300" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="전 기기 호환 스마트 수학 기호 입력 도구"
      className="no-print sticky bottom-2 z-30 mx-auto mt-6 w-full max-w-[1160px] px-2 sm:px-0"
    >
      <div className="rounded-2xl border border-slate-300/95 bg-slate-900/95 text-white shadow-xl backdrop-blur-md overflow-hidden">
        {/* Top Status & Control Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/70 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-600/90 px-2 py-0.5 text-[11px] font-extrabold text-white shrink-0">
              <Keyboard className="h-3.5 w-3.5" />
              스마트 수식 키패드
            </span>
            <span className="font-semibold text-sky-300 truncate max-w-[260px] sm:max-w-[420px]">
              {hasFocusedInput ? `입력 대상: ${activeFieldLabel}` : activeFieldLabel}
            </span>
            {selectedTextPreview && (
              <span className="rounded-md bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[11px] font-bold text-amber-200 mono">
                <MathText text={`선택 영역 감싸기 준비됨: “${selectedTextPreview}” → √(□), (□)², |□| 클릭!`} />
              </span>
            )}
            {lastConversionNotice && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[11px] font-bold text-emerald-200 mono">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <MathText text={lastConversionNotice} />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            {/* PC/노트북 단축어 자동 변환 토글 */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setAutoShorthand((prev) => !prev)}
              className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
                autoShorthand
                  ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                  : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
              title="키보드로 >=, <=, ^2, sqrt( 등을 입력할 때 자동으로 ≥, ≤, ², √( 로 변환합니다"
            >
              키보드 단축어 변환 {autoShorthand ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowShorthandHelp((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
                showShorthandHelp
                  ? 'border-sky-400 bg-sky-500/25 text-sky-200'
                  : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
              title="PC·노트북·패드·모바일 수식 입력 도움말"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">입력 팁</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-500/20 px-2.5 py-1 text-[11px] font-extrabold text-sky-200 hover:bg-sky-500/30 transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>추천 1줄로 접기</span>
                </>
              ) : (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>전체 기호·검색 펼치기</span>
                </>
              )}
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsMinimized(true)}
              className="rounded-lg border border-white/15 bg-white/5 p-1 text-slate-300 hover:bg-white/15"
              title="수학 기호 입력기 최소화"
              aria-label="수학 기호 입력기 최소화"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Optional Shorthand & Smart Wrap Guide Drawer */}
        {showShorthandHelp && (
          <div className="border-b border-white/10 bg-slate-800/90 px-4 py-3 text-xs text-slate-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sky-300">
                PC · 노트북 · 태블릿(패드) · 모바일 맞춤 수식 입력 3대 기능
              </strong>
              <span className="text-[11px] text-slate-400">
                버튼을 눌러도 입력창 포커스나 모바일 키보드가 닫히지 않습니다
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 text-[11px] leading-relaxed">
              <div className="rounded-xl bg-slate-900/80 border border-white/10 p-2.5">
                <div className="font-bold text-amber-300 mb-1">1. 블록 감싸기 (□ 템플릿)</div>
                <p className="text-slate-300">
                  입력창에서 <span className="mono text-white">a+b</span>를 드래그한 뒤{' '}
                  <MathText text="√(□)" className="mono font-bold text-sky-300" />,{' '}
                  <span className="mono font-bold text-sky-300">(□)²</span>,{' '}
                  <span className="mono font-bold text-sky-300">|□|</span>를 누르면 자동으로{' '}
                  <MathText text="√(a+b), (a+b)², |a+b|" className="mono text-emerald-300" />로 감싸집니다.
                </p>
              </div>
              <div className="rounded-xl bg-slate-900/80 border border-white/10 p-2.5">
                <div className="font-bold text-emerald-300 mb-1">2. PC·노트북 키보드 단축어</div>
                <p className="text-slate-300 mono">
                  <MathText text={MATH_SHORTHAND_RULES.map((r) => `${r.shorthand}→${r.replacement}`).join(' · ')} />
                </p>
              </div>
              <div className="rounded-xl bg-slate-900/80 border border-white/10 p-2.5">
                <div className="font-bold text-sky-300 mb-1">3. 차시 추천 + 무제한 전체 탭</div>
                <p className="text-slate-300">
                  기본 줄에는 <strong>0{activeLesson}차시 핵심 기호</strong>가 표시되며,{' '}
                  <strong>전체 기호·검색 펼치기</strong>를 누르면 모든 수학 기호를 제한 없이 입력할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Expanded Category Tabs + Korean Keyword Search */}
        {isExpanded && (
          <div className="border-b border-white/10 bg-slate-900 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="수학 기호 분류 탭">
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === 'recommended' && !searchQuery}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setActiveCategory('recommended');
                  setSearchQuery('');
                }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition-all ${
                  activeCategory === 'recommended' && !searchQuery
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white/10 text-slate-300 hover:bg-white/15'
                }`}
              >
                ★ 0{activeLesson}차시 추천 ({lessonRecommended.length})
              </button>
              {MATH_SYMBOL_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === cat.id && !searchQuery}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearchQuery('');
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                    activeCategory === cat.id && !searchQuery
                      ? 'bg-sky-500 text-slate-950 font-extrabold shadow-xs'
                      : 'bg-white/10 text-slate-300 hover:bg-white/15'
                  }`}
                >
                  {cat.shortName}
                </button>
              ))}
            </div>

            {/* Search Input (for finding symbols by Korean name like '루트', '이상', '따라서', '집합') */}
            <div className="relative min-w-[190px] sm:w-60">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                data-math-bar-ignore="true"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="기호 검색 (예: 루트, 이상, 제곱, 따라서)"
                className="w-full rounded-lg border border-white/15 bg-slate-950/90 pl-8 pr-6 py-1 text-xs text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main Symbol Buttons Row / Grid */}
        <div className="px-3.5 py-2.5 space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
            {!isExpanded && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-sky-500/15 border border-sky-400/30 px-2 py-1.5 text-[11px] font-extrabold text-sky-300 shrink-0">
                <Sparkles className="h-3 w-3" />
                0{activeLesson}차시 추천
              </span>
            )}

            {(isExpanded ? displayedCategoryItems : lessonRecommended).map((item) => (
              <button
                key={`${item.label}-${item.token}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInsertSymbol(item)}
                title={
                  item.shorthand
                    ? `${item.desc} (키보드 단축어: ${item.shorthand})`
                    : item.desc
                }
                className={`group relative inline-flex min-h-[38px] min-w-[40px] shrink-0 items-center justify-center gap-1 rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-bold mono transition-all active:scale-95 ${
                  item.isTemplate
                    ? 'border-sky-400/40 bg-sky-500/15 text-sky-100 hover:bg-sky-500/30 hover:border-sky-300'
                    : 'border-white/15 bg-white/10 text-white hover:bg-white/20 hover:border-white/30'
                }`}
              >
                <MathText text={item.label} />
                {isExpanded && item.shorthand && (
                  <span className="ml-1 rounded bg-slate-950/70 px-1 py-0.2 text-[10px] font-normal text-slate-300">
                    {item.shorthand}
                  </span>
                )}
              </button>
            ))}

            {isExpanded && searchQuery && displayedCategoryItems.length === 0 && (
              <span className="text-xs text-slate-400 py-1.5">
                &lsquo;{searchQuery}&rsquo;에 해당하는 기호가 없습니다. (예: 루트, 제곱, 이상, 절댓값, 따라서)
              </span>
            )}

            {/* Quick Cursor & Touch Utility Controls (항상 우측 끝에 배치하여 태블릿/모바일 조작성 극대화) */}
            <div className="ml-auto flex items-center gap-1 shrink-0 pl-1 border-l border-white/10">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleMoveCursor(-1)}
                className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/15 active:scale-95"
                title="커서를 왼쪽으로 1칸 이동"
                aria-label="커서 왼쪽 이동"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleMoveCursor(1)}
                className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/15 active:scale-95"
                title="커서를 오른쪽으로 1칸 이동 (괄호 밖으로 나가기)"
                aria-label="커서 오른쪽 이동"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  handleInsertSymbol({
                    label: '(□)',
                    token: '(□)',
                    desc: '괄호 삽입/감싸기',
                    isTemplate: true,
                  })
                }
                className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-bold mono text-slate-200 hover:bg-white/15 active:scale-95"
                title="소괄호 ( ) 삽입 또는 선택 영역 감싸기"
              >
                ( )
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleBackspace}
                className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-200 hover:bg-rose-500/25 active:scale-95"
                title="커서 앞 글자 또는 선택 영역 지우기"
              >
                <Delete className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">지우기</span>
              </button>
            </div>
          </div>

          {/* Recent Symbols Strip when Expanded */}
          {isExpanded && recentSymbols.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-white/10 text-xs">
              <span className="text-[11px] font-bold text-slate-400 mr-1">최근 사용 기호:</span>
              {recentSymbols.map((item) => (
                <button
                  key={`recent-${item.label}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleInsertSymbol(item)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold mono text-slate-200 hover:bg-white/15"
                  title={`${item.desc} 다시 입력`}
                >
                  <MathText text={item.label} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
