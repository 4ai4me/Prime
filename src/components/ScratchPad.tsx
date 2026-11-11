import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDraggableWindow } from '../utils/useDraggableWindow';
import { Download, Eraser, GripHorizontal, Maximize2, Minimize2, PenLine, RotateCcw, Trash2, X } from 'lucide-react';

/**
 * 문제별 연습장 — 펜(마우스·손가락·태블릿 펜)으로 그림이나 글씨를 쓰는 떠 있는 창
 * ------------------------------------------------------------------
 * - 그린 내용은 선(획) 목록으로 화면 안에서만 보관합니다(서버에 저장하지 않음).
 *   차시 화면을 떠나거나 새로고침하면 사라지므로, 남기려면 [그림 저장]으로 PNG 파일을 내려받습니다.
 *   (Firestore 쓰기 한도·문서 크기 제한 때문에 그림을 저장 데이터에 넣지 않음)
 * - 좌표는 창 크기와 상관없는 고정 크기(1000 × 620)로 기록하므로 [크게] 보기로 바꿔도 그림이 그대로 커집니다.
 * - 태블릿 펜을 한 번 쓰면 그 창에서는 손바닥·손가락 터치를 무시합니다(손바닥이 닿아 선이 그어지는 것 방지).
 */

export const PAD_W = 1000;
export const PAD_H = 620;

export type PadTool = 'pen' | 'eraser';

export interface PadStroke {
  tool: PadTool;
  color: string;
  width: number;
  points: [number, number][];
}

/** 화면 좌표 → 연습장 고정 좌표 (0~PAD_W, 0~PAD_H 범위로 제한) */
export function toPadPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): [number, number] {
  const x = ((clientX - rect.left) / Math.max(rect.width, 1)) * PAD_W;
  const y = ((clientY - rect.top) / Math.max(rect.height, 1)) * PAD_H;
  return [Math.min(Math.max(x, 0), PAD_W), Math.min(Math.max(y, 0), PAD_H)];
}

/** 획 하나를 캔버스에 그립니다 (scale: 고정 좌표 1당 캔버스 픽셀 수) */
export function drawStroke(ctx: CanvasRenderingContext2D, s: PadStroke, scale: number) {
  if (!s.points.length) return;
  ctx.save();
  ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const [x0, y0] = s.points[0];
  if (s.points.length === 1) {
    ctx.beginPath();
    ctx.arc(x0 * scale, y0 * scale, (s.width * scale) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x0 * scale, y0 * scale);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0] * scale, s.points[i][1] * scale);
    ctx.stroke();
  }
  ctx.restore();
}

const COLORS = [
  { value: '#0f172a', label: '검정' },
  { value: '#2563eb', label: '파랑' },
  { value: '#dc2626', label: '빨강' },
] as const;
const WIDTHS = [
  { value: 4, label: '가늘게' },
  { value: 9, label: '굵게' },
] as const;
const ERASER_WIDTH = 34;

/** 문제 제목 옆에 두는 [연습장] 버튼 */
export function ScratchPadButton({ onClick, used, active }: { onClick: () => void; used?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors shrink-0 ${
        active ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <PenLine className="h-3.5 w-3.5" />
      <span>연습장</span>
      {used && !active && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" aria-label="그린 내용 있음" />}
    </button>
  );
}

export interface ScratchPadWindowProps {
  title: string;
  strokes: PadStroke[];
  onChange: (next: PadStroke[]) => void;
  onClose: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
  /** 내려받을 PNG 파일 이름 (확장자 제외) */
  fileName: string;
}

export function ScratchPadWindow({ title, strokes, onChange, onClose, onRequestConfirm, fileName }: ScratchPadWindowProps) {
  const [big, setBig] = useState(false);
  const [tool, setTool] = useState<PadTool>('pen');
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [width, setWidth] = useState<number>(WIDTHS[0].value);
  const [grid, setGrid] = useState(true);
  const drag = useDraggableWindow(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const current = useRef<PadStroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const penSeen = useRef(false);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  /** 캔버스 픽셀 크기를 화면 크기에 맞추고 모든 획을 다시 그림 */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = box.clientWidth;
    const cssH = (cssW * PAD_H) / PAD_W;
    const pxW = Math.round(cssW * dpr);
    const pxH = Math.round(cssH * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / PAD_W;
    for (const s of strokesRef.current) drawStroke(ctx, s, scale);
    if (current.current) drawStroke(ctx, current.current, scale);
  }, []);

  useEffect(() => {
    redraw();
  }, [strokes, big, redraw]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(box);
    return () => ro.disconnect();
  }, [redraw]);

  // Esc로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pointFrom = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current!;
    return toPadPoint(e.clientX, e.clientY, canvas.getBoundingClientRect());
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen') penSeen.current = true;
    if (e.pointerType === 'touch' && penSeen.current) return; // 펜을 쓰는 중이면 손바닥 터치 무시
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (activePointer.current !== null) return; // 두 손가락 동시 입력 무시
    activePointer.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('[ScratchPad] setPointerCapture failed:', err);
    }
    current.current = {
      tool,
      color,
      width: tool === 'eraser' ? ERASER_WIDTH : width,
      points: [pointFrom(e)],
    };
    redraw();
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== e.pointerId || !current.current) return;
    const native = e.nativeEvent as PointerEvent;
    const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [native]) current.current.points.push(pointFrom(ev));
    redraw();
  };

  const finish = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    const stroke = current.current;
    current.current = null;
    if (stroke && stroke.points.length) onChange([...strokesRef.current, stroke]);
  };

  const undo = () => onChange(strokes.slice(0, -1));
  const clearAll = () => {
    if (!strokes.length) return;
    onRequestConfirm('연습장 지우기', `${title} 연습장에 그린 내용을 모두 지울까요?`, () => onChange([]));
  };

  const savePng = () => {
    const out = document.createElement('canvas');
    out.width = PAD_W * 2;
    out.height = PAD_H * 2;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    // 지우개 획이 흰 배경까지 지우지 않도록, 획을 따로 그린 뒤 흰 배경 위에 얹음
    const layer = document.createElement('canvas');
    layer.width = out.width;
    layer.height = out.height;
    const lctx = layer.getContext('2d');
    if (!lctx) return;
    for (const s of strokes) drawStroke(lctx, s, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(layer, 0, 0);
    const a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = `${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const toolBtn = (on: boolean) =>
    `inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${
      on ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
    }`;

  return (
    <div
      ref={drag.windowRef}
      style={{
        ...drag.windowStyle,
        // 크게 보기: 그리기 칸이 화면 높이 안에 들어오도록 너비 제한 (도구 줄·제목 줄 약 190px)
        ...(big ? { maxWidth: `min(1040px, calc((100vh - 190px) * ${PAD_W / PAD_H}))` } : {}),
      }}
      role="dialog"
      aria-label={`${title} 연습장`}
      className={`no-print fixed z-[45] flex flex-col rounded-2xl border border-slate-300 bg-white shadow-2xl ${
        big
          ? 'left-2 right-2 top-3 mx-auto'
          : 'right-2 bottom-20 w-[calc(100vw-16px)] sm:right-4 sm:w-[560px]'
      }`}
    >
      <div
        {...drag.handleProps}
        className="flex items-center justify-between gap-2 rounded-t-2xl border-b border-slate-200 bg-slate-800 px-3 py-2 text-white select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate text-xs sm:text-sm font-extrabold">✏️ 연습장 · {title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setBig((v) => !v);
              drag.resetPosition();
            }}
            className="rounded-md p-1.5 hover:bg-white/15"
            aria-label={big ? '작게 보기' : '크게 보기'}
            title={big ? '작게 보기' : '크게 보기'}
          >
            {big ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-white/15" aria-label="연습장 닫기" title="닫기 (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-2">
        <button type="button" className={toolBtn(tool === 'pen')} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>
          <PenLine className="h-3.5 w-3.5" /> 펜
        </button>
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={`펜 색 ${c.label}`}
            aria-pressed={tool === 'pen' && color === c.value}
            onClick={() => {
              setTool('pen');
              setColor(c.value);
            }}
            className={`h-7 w-7 rounded-full border-2 ${tool === 'pen' && color === c.value ? 'border-slate-800 ring-2 ring-slate-300' : 'border-white ring-1 ring-slate-200'}`}
            style={{ backgroundColor: c.value }}
          />
        ))}
        {WIDTHS.map((w) => (
          <button
            key={w.value}
            type="button"
            className={toolBtn(tool === 'pen' && width === w.value)}
            aria-pressed={tool === 'pen' && width === w.value}
            onClick={() => {
              setTool('pen');
              setWidth(w.value);
            }}
          >
            {w.label}
          </button>
        ))}
        <button type="button" className={toolBtn(tool === 'eraser')} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>
          <Eraser className="h-3.5 w-3.5" /> 지우개
        </button>
        <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />
        <button type="button" className={toolBtn(false)} onClick={undo} disabled={!strokes.length}>
          <RotateCcw className="h-3.5 w-3.5" /> 되돌리기
        </button>
        <button type="button" className={toolBtn(false)} onClick={clearAll} disabled={!strokes.length}>
          <Trash2 className="h-3.5 w-3.5" /> 모두 지우기
        </button>
        <label className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-slate-600">
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} className="accent-slate-700" />
          모눈
        </label>
      </div>

      <div className="p-2">
        <div
          ref={boxRef}
          className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
          style={{
            aspectRatio: `${PAD_W} / ${PAD_H}`,
            backgroundImage: grid
              ? 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)'
              : undefined,
            backgroundSize: grid ? '24px 24px' : undefined,
          }}
        >
          <canvas
            ref={canvasRef}
            data-testid="scratch-canvas"
            className="absolute inset-0 h-full w-full"
            style={{ touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finish}
            onPointerCancel={finish}
            aria-label="연습장 그리기 영역"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
        <p className="text-[11px] text-slate-500">
          이 연습장은 기기 화면에만 있고 선생님께 제출되지 않아요. 이 차시 화면을 떠나거나 새로고침하면 지워집니다.
        </p>
        <button
          type="button"
          onClick={savePng}
          disabled={!strokes.length}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> 그림 저장 (PNG)
        </button>
      </div>
    </div>
  );
}
