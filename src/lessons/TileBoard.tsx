import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { tryTileRow } from './lesson1Logic';

/**
 * 정사각형 타일 놀이판 (1차시 도형 활동)
 * - 기록 모드(n, found, onChange): 한 줄에 놓을 개수를 정해 늘어놓고, 직사각형이 되면 [기록]
 * - 자유 모드(free): 타일 개수도 바꿔 가며 실험 (기록하지 않음)
 */

const MAX_W = 260; // 휴대폰 폭에서도 넘치지 않는 그림 최대 너비(px)
const MAX_H = 220; // 세로로 긴 배열(16 × 1 등)의 최대 높이(px)

/** 타일 rows × cols 그림 (마지막 줄에 lastRow개만 놓인 미완성 모양도 그림) */
export const TileRect: React.FC<{ cols: number; rows: number; lastRow?: number; label?: string; tone?: 'ok' | 'bad' }> = ({
  cols,
  rows,
  lastRow,
  label,
  tone = 'ok',
}) => {
  const totalRowsForSize = rows + (lastRow ? 1 : 0);
  // 너무 길거나 높으면 타일을 작게 (가로 MAX_W, 세로 MAX_H 안에)
  const size = Math.max(6, Math.min(26, Math.floor(MAX_W / Math.max(cols, 1)), Math.floor(MAX_H / Math.max(totalRowsForSize, 1))));
  const totalRows = rows + (lastRow ? 1 : 0);
  const w = cols * size;
  const h = totalRows * size;
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < totalRows; r++) {
    const count = r === rows && lastRow ? lastRow : cols;
    for (let c = 0; c < cols; c++) {
      const filled = c < count;
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={c * size + 0.5}
          y={r * size + 0.5}
          width={size - 1}
          height={size - 1}
          rx={2}
          className={filled ? (tone === 'ok' ? 'fill-violet-200 stroke-violet-600' : 'fill-amber-200 stroke-amber-600') : 'fill-transparent stroke-slate-300'}
          strokeDasharray={filled ? undefined : '3 2'}
          strokeWidth={1}
        />
      );
    }
  }
  return (
    <figure className="inline-flex flex-col items-center gap-1">
      <svg width={w + 1} height={h + 1} viewBox={`0 0 ${w + 1} ${h + 1}`} role="img" aria-label={label ?? `${rows} × ${cols}`}>
        {cells}
      </svg>
      {label && <figcaption className="text-xs font-extrabold mono text-slate-700">{label}</figcaption>}
    </figure>
  );
};

type BoardProps =
  | { free: true; n?: undefined; found?: undefined; onChange?: undefined }
  | { free?: false; n: number; found: string[] | undefined; onChange: (found: string[]) => void };

export const TileBoard: React.FC<BoardProps> = (props) => {
  const [freeN, setFreeN] = useState('12');
  const [perRow, setPerRow] = useState('');
  const n = props.free ? Number(freeN) || 0 : props.n;
  const a = Number(perRow);
  const tried = perRow.trim() && n > 0 ? tryTileRow(n, a) : null;
  const found = props.free ? [] : props.found ?? [];
  const testId = props.free ? 'tile-board-free' : `tile-board-${n}`;

  const record = () => {
    if (props.free || !tried || !tried.ok || found.includes(tried.key)) return;
    props.onChange([...found, tried.key].sort((x, y) => Number(x.split('x')[0]) - Number(y.split('x')[0])));
  };

  return (
    <div data-testid={testId} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
      <div className="flex flex-wrap items-end gap-3 text-sm font-bold text-slate-800">
        {props.free ? (
          <label className="inline-flex flex-col gap-1">
            타일 개수
            <input
              value={freeN}
              inputMode="numeric"
              aria-label="타일 개수"
              onChange={(e) => setFreeN(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-2 mono"
            />
          </label>
        ) : (
          <span className="pb-2">타일 {n}개</span>
        )}
        <label className="inline-flex flex-col gap-1">
          한 줄에 놓을 타일 수
          <input
            value={perRow}
            inputMode="numeric"
            aria-label={`타일 ${props.free ? '' : n + '개 '}한 줄에 놓을 수`}
            onChange={(e) => setPerRow(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-2 mono"
          />
        </label>
        {props.free && n > 40 && <span className="pb-2 text-xs text-amber-700">40개 이하로 실험해 보세요.</span>}
      </div>

      {tried && n <= 40 && (
        <div className="overflow-x-auto">
          {tried.ok ? (
            <div className="flex flex-wrap items-end gap-3">
              <TileRect cols={a} rows={tried.rows} label={`${tried.rows} × ${a}`} />
              <span className="text-sm font-bold text-emerald-700">직사각형이 돼요!</span>
              {!props.free && (
                <button
                  type="button"
                  onClick={record}
                  disabled={found.includes(tried.key)}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-violet-700 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {found.includes(tried.key) ? '이미 기록한 모양' : '이 방법 기록하기'}
                </button>
              )}
            </div>
          ) : a >= 1 && a <= n ? (
            <div className="flex flex-wrap items-end gap-3">
              <TileRect cols={a} rows={Math.floor(n / a)} lastRow={tried.left} tone="bad" />
              <span className="text-sm font-bold text-amber-700 break-keep">
                마지막 줄에 {tried.left}개만 남아 직사각형이 안 돼요.
              </span>
            </div>
          ) : (
            <p className="text-sm font-bold text-amber-700">1부터 {n}까지의 수를 넣어 보세요.</p>
          )}
        </div>
      )}

      {!props.free && (
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-slate-600">기록한 직사각형 ({found.length}가지)</div>
          {found.length === 0 ? (
            <p className="text-xs text-slate-500">아직 없어요. 직사각형이 되면 [이 방법 기록하기]를 누르세요.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {found.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-sm font-extrabold mono text-violet-800">
                  {k.replace('x', ' × ')}
                  <button
                    type="button"
                    aria-label={`${k.replace('x', ' × ')} 지우기`}
                    onClick={() => props.onChange(found.filter((x) => x !== k))}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
