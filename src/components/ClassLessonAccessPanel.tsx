import React from 'react';
import { Lock, RotateCcw, Unlock, Users } from 'lucide-react';
import { LESSON_TAB_METADATA, type LessonAccessConfig } from '../utils/mathLogic';
import { classKeyLabel, type ClassLessonAccessMap } from '../utils/classLessonAccess';

/** 적용 대상 '전체(기본)'를 뜻하는 값 */
export const ACCESS_TARGET_ALL = '__all__';

interface ClassLessonAccessPanelProps {
  /** 고를 수 있는 반 (승인된 학생의 반 + 반별 설정이 남아 있는 반) */
  classKeys: string[];
  /** 반 키 → 승인된 학생 수 */
  studentCountByClass: Record<string, number>;
  classMap: ClassLessonAccessMap;
  globalConfig: LessonAccessConfig;
  target: string;
  onChangeTarget: (target: string) => void;
  onResetTarget: () => void;
  syncStatus: 'checking' | 'saving' | 'synced' | 'error';
  /** 마지막 저장·읽기 실패 이유 (있으면 빨간 상자로 표시) */
  errorText?: string | null;
}

/**
 * 반별 차시 잠금: 적용 대상 고르기 + 반 × 차시 현황 표 (2026-11-09~)
 * 실제 열기·잠그기는 아래 차시 카드와 일괄 버튼이 '고른 대상'에 적용합니다.
 */
export const ClassLessonAccessPanel: React.FC<ClassLessonAccessPanelProps> = ({
  classKeys,
  studentCountByClass,
  classMap,
  globalConfig,
  target,
  onChangeTarget,
  onResetTarget,
  syncStatus,
  errorText = null,
}) => {
  const isAll = target === ACCESS_TARGET_ALL;
  const targetHasOwn = !isAll && Object.prototype.hasOwnProperty.call(classMap, target);
  const ownCount = Object.keys(classMap).length;

  const rows: Array<{ key: string; label: string; config: LessonAccessConfig; source: 'global' | 'class' | 'default' }> = [
    { key: ACCESS_TARGET_ALL, label: '전체(기본)', config: globalConfig, source: 'default' },
    ...classKeys.map((key) => {
      const own = Object.prototype.hasOwnProperty.call(classMap, key);
      return {
        key,
        label: classKeyLabel(key),
        config: own ? classMap[key] : globalConfig,
        source: own ? ('class' as const) : ('global' as const),
      };
    }),
  ];

  return (
    <div
      id="teacher-class-lesson-access"
      data-testid="class-lesson-access-panel"
      className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-3.5 sm:p-4 space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <label htmlFor="lesson-access-target" className="flex items-center gap-1.5 text-sm font-extrabold text-violet-900 shrink-0">
          <Users className="h-4 w-4 text-violet-600" />
          적용 대상
        </label>
        <select
          id="lesson-access-target"
          value={target}
          onChange={(e) => onChangeTarget(e.target.value)}
          className="w-full sm:w-auto min-w-0 rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-bold text-slate-900"
        >
          <option value={ACCESS_TARGET_ALL}>전체(기본) — 반별 설정이 없는 반 모두</option>
          {classKeys.map((key) => (
            <option key={key} value={key}>
              {classKeyLabel(key)}
              {` (${studentCountByClass[key] ?? 0}명)`}
              {Object.prototype.hasOwnProperty.call(classMap, key) ? ' · 반별 설정' : ''}
            </option>
          ))}
        </select>
        {targetHasOwn && (
          <button
            type="button"
            onClick={onResetTarget}
            disabled={syncStatus === 'saving'}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-extrabold text-violet-800 hover:bg-violet-100 disabled:opacity-60 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            이 반을 전체 설정으로 되돌리기
          </button>
        )}
      </div>

      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed" data-testid="class-lesson-access-status">
        {isAll ? (
          <>
            아래 버튼은 <strong>전체(기본)</strong> 설정을 바꿉니다. 반별 설정이 있는 반({ownCount}개)에는 적용되지 않습니다.
          </>
        ) : targetHasOwn ? (
          <>
            <strong>{classKeyLabel(target)}</strong>은 <strong className="text-violet-800">반별 설정</strong>을 쓰고 있습니다. 아래 버튼은 이 반에만 적용됩니다.
          </>
        ) : (
          <>
            <strong>{classKeyLabel(target)}</strong>은 지금 <strong>전체 설정을 따르고</strong> 있습니다. 아래에서 차시를 열거나 잠그면 이 반만의 설정이 만들어집니다.
          </>
        )}
        {syncStatus === 'saving' && <span className="ml-1 text-blue-700 font-bold">· 반별 설정 저장 중…</span>}
        {syncStatus === 'error' && (
          <span className="ml-1 text-rose-700 font-bold">· 반별 설정을 서버와 맞추지 못했습니다 (인터넷 연결·보안 규칙 확인)</span>
        )}
      </p>

      {errorText && (
        <div
          role="alert"
          data-testid="class-lesson-access-error"
          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs sm:text-sm font-bold text-rose-800 leading-relaxed break-words"
        >
          {errorText}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-xs" data-testid="class-lesson-access-table">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-2 py-1.5 text-left font-bold">반</th>
              {LESSON_TAB_METADATA.map((m) => (
                <th key={m.num} scope="col" className="px-1 py-1.5 text-center font-bold whitespace-nowrap">
                  {m.num}차시
                </th>
              ))}
              <th scope="col" className="px-2 py-1.5 text-left font-bold whitespace-nowrap">따르는 설정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                data-class-key={row.key}
                className={`border-t border-slate-100 cursor-pointer hover:bg-violet-50 ${row.key === target ? 'bg-violet-100/70' : ''}`}
                onClick={() => onChangeTarget(row.key)}
              >
                <th scope="row" className="px-2 py-1.5 text-left font-bold text-slate-800 whitespace-nowrap">
                  {row.label}
                </th>
                {LESSON_TAB_METADATA.map((m) => {
                  const isOpen = Boolean(row.config[m.num]);
                  return (
                    <td key={m.num} className="px-1 py-1.5 text-center">
                      <span
                        className={`inline-flex items-center justify-center rounded-md px-1.5 py-0.5 ${
                          isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                        title={isOpen ? '열림' : '잠금'}
                        aria-label={`${row.label} ${m.num}차시 ${isOpen ? '열림' : '잠금'}`}
                      >
                        {isOpen ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      </span>
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {row.source === 'class' ? (
                    <span className="font-bold text-violet-800">반별 설정</span>
                  ) : row.source === 'global' ? (
                    <span className="text-slate-500">전체 따름</span>
                  ) : (
                    <span className="text-slate-500">기본</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] sm:text-xs text-slate-500">
        표의 줄을 누르면 그 반이 적용 대상으로 바뀝니다. 반은 가입 정보의 학교·학년·반으로 구분합니다.
      </p>
    </div>
  );
};
