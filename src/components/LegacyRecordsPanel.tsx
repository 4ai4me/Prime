/**
 * 교사 화면: 이전 기록 (2026-11-28 이전 가입 학생, 가명 처리) — 읽기 전용, 2027-03-31까지
 * ------------------------------------------------------------------
 * 개인정보 정리 후 '이전기록-001'처럼 무작위 번호와 학년만 남은 기록을 봅니다.
 * 학생은 볼 수 없고(보안 규칙), 교사도 고칠 수 없습니다(이 화면에는 저장 기능이 없음).
 * 사이트마다 활동지 형식이 달라서 기록을 만드는 함수와 보여 주는 화면은 props로 받습니다.
 * ⚠️ 이 파일은 Func·Props·Prime·Rational 네 저장소에서 똑같아야 합니다.
 */
import React, { useMemo, useState } from 'react';
import { Archive, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { loadLegacyArchives, type LegacyArchiveDoc } from '../utils/legacyCleanup';

interface SnapshotLike {
  lessons: object;
  teacher?: unknown;
}

export interface LegacyRecordsPanelProps<S extends SnapshotLike, R> {
  /** 이 사이트의 차시 문서 (교사 화면이 이미 받고 있는 것, 키 = 문서 키) */
  lessonDocsByStudent: Map<string, S>;
  buildRecord: (archive: LegacyArchiveDoc, snap: S) => R;
  renderRecord: (record: R) => React.ReactNode;
}

function hasSiteData(snap: SnapshotLike | undefined): boolean {
  return !!snap && (Object.keys(snap.lessons).length > 0 || !!snap.teacher);
}

export function LegacyRecordsPanel<S extends SnapshotLike, R>({
  lessonDocsByStudent,
  buildRecord,
  renderRecord,
}: LegacyRecordsPanelProps<S, R>) {
  const [open, setOpen] = useState(false);
  const [archives, setArchives] = useState<LegacyArchiveDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setArchives(await loadLegacyArchives());
    } catch (err) {
      console.error('Failed to load legacy archives:', err);
      setError((err as { message?: string })?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const list = useMemo(
    () => (archives || []).filter((a) => showAll || hasSiteData(lessonDocsByStudent.get(a.studentKey))),
    [archives, showAll, lessonDocsByStudent]
  );

  const selectedArchive = list.find((a) => a.studentKey === selected) || null;
  let selectedRecord: R | null = null;
  let buildError = false;
  if (selectedArchive) {
    try {
      const snap = (lessonDocsByStudent.get(selectedArchive.studentKey) || { lessons: {} }) as S;
      selectedRecord = buildRecord(selectedArchive, snap);
    } catch (err) {
      console.warn(`Legacy record ${selectedArchive.studentKey} is unreadable:`, err);
      buildError = true;
    }
  }

  return (
    <div className="no-print rounded-2xl border border-slate-300 bg-slate-50 p-5 sm:p-7 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const next = !open;
              setOpen(next);
              if (next && archives === null) void load();
            }}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {open ? '접기' : '펼치기'}
          </button>
          <div>
            <div className="text-xs font-bold text-slate-500">2027-03-31까지 · 읽기 전용</div>
            <h2 className="mt-0.5 flex items-center gap-2 text-lg sm:text-xl font-extrabold text-slate-900">
              <Archive className="h-5 w-5 text-slate-500" />
              이전 기록 (2026-11-28 이전 가입)
            </h2>
          </div>
        </div>
        {open && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            새로고침
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            예전 개인정보(실명·학교·반·번호·생년월일)를 지운 기록입니다. 번호는 무작위로 붙였으므로 누구의 기록인지 알 수 없습니다. 학생은 볼 수
            없고, 이 화면에서는 고칠 수 없습니다. 2027년 4월 1일부터는 이 칸이 보이지 않습니다.
          </p>
          {error && <div className="text-xs font-bold text-rose-700">불러오지 못했습니다: {error}</div>}
          {loading && <div className="text-xs text-slate-500">불러오는 중…</div>}
          {archives && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-700">
                  이 사이트 기록이 있는 번호 {list.length}개{showAll ? ' (전체 표시 중)' : ''} / 전체 {archives.length}개
                </span>
                <label className="inline-flex items-center gap-1 font-semibold text-slate-600">
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                  기록 없는 번호도 보기
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((a) => (
                  <button
                    key={a.studentKey}
                    type="button"
                    onClick={() => setSelected(a.studentKey === selected ? null : a.studentKey)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
                      a.studentKey === selected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {a.legacySerial}
                    {a.grade ? ` · ${a.grade}학년` : ''}
                  </button>
                ))}
                {list.length === 0 && <span className="text-xs text-slate-500">표시할 이전 기록이 없습니다.</span>}
              </div>
              {selectedArchive && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 text-sm font-extrabold text-slate-900">
                    {selectedArchive.legacySerial} {selectedArchive.grade ? `· ${selectedArchive.grade}학년` : ''} (읽기 전용)
                  </div>
                  {buildError || selectedRecord === null ? (
                    <div className="text-xs font-bold text-rose-700">이 기록은 형식이 맞지 않아 보여 줄 수 없습니다.</div>
                  ) : (
                    renderRecord(selectedRecord)
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
