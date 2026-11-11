import { useCallback, useRef, useState } from 'react';
import type React from 'react';

/**
 * 떠 있는 창(비모달 상세 비교 창)을 제목 표시줄을 잡고 끌어서 옮기는 기능.
 * - Pointer Events를 사용하므로 마우스·터치(패드)·펜에서 모두 동작합니다.
 * - 제목 표시줄에 touch-action: none 을 주어 패드에서 끌 때 화면이 대신 스크롤되지 않게 합니다.
 * - 제목 표시줄 안의 버튼(인쇄·최소화·최대화·닫기)을 누를 때는 끌기를 시작하지 않습니다.
 * - 창이 화면 밖으로 완전히 나가지 않도록 제목 표시줄 일부가 항상 보이게 제한합니다.
 */

export interface Offset {
  x: number;
  y: number;
}

/** 화면 안에 남겨 둘 최소 크기(px): 제목 표시줄을 다시 잡을 수 있을 만큼 */
export const KEEP_VISIBLE_PX = 64;

/**
 * 창의 새 왼쪽·위 좌표를 화면 안으로 제한합니다 (순수 함수 — 단위 테스트 대상).
 * 가로: 창 너비 중 최소 keepVisible만큼은 화면에 남김 / 세로: 제목 표시줄이 화면 위·아래로 사라지지 않게.
 */
export function clampWindowPosition(
  pos: { left: number; top: number },
  size: { width: number },
  viewport: { width: number; height: number },
  keepVisible = KEEP_VISIBLE_PX
): { left: number; top: number } {
  const minLeft = keepVisible - size.width;
  const maxLeft = viewport.width - keepVisible;
  const minTop = 0;
  const maxTop = viewport.height - keepVisible;
  return {
    left: Math.min(Math.max(pos.left, minLeft), Math.max(minLeft, maxLeft)),
    top: Math.min(Math.max(pos.top, minTop), Math.max(minTop, maxTop)),
  };
}

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [role="button"]';

export function useDraggableWindow(enabled: boolean) {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef<Offset>(offset);
  const dragStart = useRef<{ pointerX: number; pointerY: number; offset: Offset } | null>(null);

  const applyOffset = (next: Offset) => {
    offsetRef.current = next;
    setOffset(next);
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return; // 왼쪽 버튼만
      if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return; // 버튼 클릭은 그대로
      dragStart.current = { pointerX: e.clientX, pointerY: e.clientY, offset: offsetRef.current };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {
        // 일부 오래된 브라우저: 포인터 캡처 미지원 — 끌기는 계속 동작(창 밖으로 빠르게 움직이면 놓칠 수 있음)
        console.warn('setPointerCapture unsupported:', err);
      }
      setDragging(true);
      e.preventDefault();
    },
    [enabled]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const start = dragStart.current;
    const el = windowRef.current;
    if (!start || !el) return;
    const wanted: Offset = {
      x: start.offset.x + (e.clientX - start.pointerX),
      y: start.offset.y + (e.clientY - start.pointerY),
    };
    // 현재 위치(이동 적용 상태)에서 이동 전 기준 위치를 구한 뒤, 새 위치를 화면 안으로 제한
    const rect = el.getBoundingClientRect();
    const baseLeft = rect.left - offsetRef.current.x;
    const baseTop = rect.top - offsetRef.current.y;
    const clamped = clampWindowPosition(
      { left: baseLeft + wanted.x, top: baseTop + wanted.y },
      { width: rect.width },
      { width: window.innerWidth, height: window.innerHeight }
    );
    applyOffset({ x: clamped.left - baseLeft, y: clamped.top - baseTop });
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      console.warn('releasePointerCapture failed:', err);
    }
  }, []);

  /** 창을 처음 위치(오른쪽 아래)로 되돌림 */
  const resetPosition = useCallback(() => applyOffset({ x: 0, y: 0 }), []);

  return {
    windowRef,
    dragging,
    resetPosition,
    /** 창 요소에 줄 style (끌기가 꺼져 있으면 이동 없음) */
    windowStyle: enabled ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined,
    /** 제목 표시줄에 줄 이벤트·style */
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      style: enabled
        ? ({ touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' } as React.CSSProperties)
        : undefined,
    },
  };
}
