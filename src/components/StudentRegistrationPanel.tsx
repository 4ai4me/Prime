/**
 * 교사 화면: 학생 가입 관리 (가상 정보 방식, 2026-11-28~)
 * ------------------------------------------------------------------
 *  - 새 이름 반 만들기 (년도별, 학년마다 개수 입력 → 랜덤 생성)
 *  - 가입 신청 승인·반려·삭제 (교실에서 얼굴과 화면의 가상 이름을 확인한 뒤)
 *  - 비밀번호를 잊은 학생에게 일회용 코드 발급
 *  - 예전 방식 개인정보 정리(1회)
 * ⚠️ 이 파일은 Func·Props·Prime·Rational 네 저장소에서 똑같아야 합니다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  Search,
  Shuffle,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { db } from '../firebase';
import {
  cancelResetCode,
  deleteStudentEverywhere,
  issueResetCode,
  saveClassRoster,
  useClassRoster,
  type StudentRegistrationDoc,
} from '../utils/studentAccount';
import {
  GRADE_OPTIONS,
  MAX_CLASSES_PER_GRADE,
  RESET_CODE_TTL_MINUTES,
  compareV2Identity,
  formatResetCode,
  isV2Registration,
  koreanYearOf,
  regenerateGradeClasses,
  v2FullLabel,
  type GradeOption,
} from '../utils/studentIdentity';
import {
  runLegacyCleanup,
  scanLegacyData,
  type LegacyCleanupProgress,
  type LegacyCleanupResult,
  type LegacyScanResult,
} from '../utils/legacyCleanup';

type NoticeFn = (text: string, type: 'good' | 'warn' | 'info') => void;
type ConfirmFn = (title: string, message: string, onConfirm: () => void) => void;

function errText(err: unknown): string {
  const e = err as { code?: string; message?: string };
  return `${e?.code ? `${e.code}: ` : ''}${e?.message || String(err)}`.slice(0, 200);
}

function formatTime(val: unknown): string {
  const t = val as { toDate?: () => Date };
  if (t && typeof t.toDate === 'function') {
    return t.toDate().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return '-';
}

// ------------------------------------------------------------------
// 새 이름 반 만들기
// ------------------------------------------------------------------

const ClassRosterEditor: React.FC<{
  registrations: StudentRegistrationDoc[];
  adminEmail: string;
  onNotice: NoticeFn;
  onRequestConfirm: ConfirmFn;
}> = ({ registrations, adminEmail, onNotice, onRequestConfirm }) => {
  const thisYear = koreanYearOf();
  const yearOptions = [String(Number(thisYear) - 1), thisYear, String(Number(thisYear) + 1)];
  const [year, setYear] = useState(thisYear);
  const { roster, loaded, error } = useClassRoster(year);
  const [counts, setCounts] = useState<Partial<Record<GradeOption, string>>>({});
  const [saving, setSaving] = useState(false);

  // 반마다 가입한 학생 수 (이 년도)
  const studentsPerClass = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of registrations) {
      if (r.year !== year) continue;
      const k = `${r.grade}|${r.className}`;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [registrations, year]);

  const generate = (grade: GradeOption) => {
    const raw = (counts[grade] ?? String((roster.classes[grade] || []).length)).trim();
    const count = Number(raw);
    const keep = (roster.classes[grade] || []).filter((c) => (studentsPerClass.get(`${grade}|${c}`) || 0) > 0);
    const res = regenerateGradeClasses(roster, grade, count, keep);
    if (!res.ok) {
      onNotice(res.error, 'warn');
      return;
    }
    const next = res.roster.classes[grade] || [];
    const current = roster.classes[grade] || [];
    const removed = current.filter((c) => !next.includes(c));
    onRequestConfirm(
      `${year}년 ${grade} 반 만들기`,
      `${grade} 반을 ${count}개로 만듭니다.\n새 반: ${next.filter((c) => !current.includes(c)).join(', ') || '없음'}` +
        (keep.length ? `\n그대로 두는 반(가입한 학생 있음): ${keep.join(', ')}` : '') +
        (removed.length ? `\n없어지는 반(가입한 학생 없음): ${removed.join(', ')}` : '') +
        '\n저장할까요?',
      async () => {
        setSaving(true);
        try {
          await saveClassRoster(res.roster, adminEmail);
          onNotice(`${year}년 ${grade} 반 ${count}개를 저장했습니다. 학생 가입 화면에 바로 나타납니다.`, 'good');
          setCounts((p) => ({ ...p, [grade]: undefined }));
        } catch (err) {
          console.error('Failed to save class roster:', err);
          onNotice(`반 목록 저장 실패 (${errText(err)}). 새 보안 규칙이 게시되었는지 확인해 주세요.`, 'warn');
        } finally {
          setSaving(false);
        }
      }
    );
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-extrabold text-violet-900">새 이름 반 만들기</div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
          년도
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년{y === thisYear ? ' (올해 — 지금 가입하는 학생)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
        학년마다 반 개수를 넣고 [만들기]를 누르면 새 이름 반이 랜덤으로 만들어집니다. 같은 년도 안에서는 반 이름이 겹치지 않고, 년도가
        다르면 같은 이름이어도 다른 반입니다. 학생은 <strong>가입한 날의 년도</strong> 반 중에서 고릅니다. 가입한 학생이 있는 반은 다시
        만들어도 그대로 남습니다. 실제 반과 새 이름 반의 대응은 오프라인으로 관리해 주세요.
      </p>
      {error && <div className="text-xs font-bold text-rose-700">반 목록을 불러오지 못했습니다. 새 보안 규칙이 게시되었는지 확인해 주세요.</div>}
      <div className="grid gap-2">
        {GRADE_OPTIONS.map((g) => {
          const list = roster.classes[g] || [];
          return (
            <div key={g} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="w-8 text-sm font-extrabold text-slate-900">{g}</span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {!loaded ? (
                  <span className="text-xs text-slate-400">불러오는 중…</span>
                ) : list.length === 0 ? (
                  <span className="text-xs text-slate-400">아직 없음</span>
                ) : (
                  list.map((c) => {
                    const n = studentsPerClass.get(`${g}|${c}`) || 0;
                    return (
                      <span
                        key={c}
                        className={`rounded-md border px-2 py-0.5 text-xs font-bold ${
                          n > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {c}
                        {n > 0 && <span className="ml-1 font-semibold">({n}명)</span>}
                      </span>
                    );
                  })
                )}
              </div>
              <input
                type="number"
                min={0}
                max={MAX_CLASSES_PER_GRADE}
                aria-label={`${g} 반 개수`}
                value={counts[g] ?? String(list.length)}
                onChange={(e) => setCounts((p) => ({ ...p, [g]: e.target.value }))}
                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm mono"
              />
              <button
                type="button"
                disabled={!loaded || saving}
                onClick={() => generate(g)}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                <Shuffle className="h-3.5 w-3.5" />
                {list.length ? '다시 만들기' : '만들기'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 예전 개인정보 정리 (1회)
// ------------------------------------------------------------------

const LegacyCleanupCard: React.FC<{ onNotice: NoticeFn; onRequestConfirm: ConfirmFn }> = ({ onNotice, onRequestConfirm }) => {
  const [scan, setScan] = useState<LegacyScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LegacyCleanupProgress | null>(null);
  const [result, setResult] = useState<LegacyCleanupResult | null>(null);

  const refresh = async () => {
    setScanError(null);
    try {
      setScan(await scanLegacyData());
    } catch (err) {
      console.error('Legacy scan failed:', err);
      setScanError(errText(err));
    }
  };
  useEffect(() => {
    void refresh();
  }, []);

  if (scan && scan.legacyRegistrations === 0 && scan.deviceLocks === 0 && scan.legacyAccessLogs === 0 && !result) {
    return null; // 정리할 것이 없음
  }

  const run = () => {
    if (!scan) return;
    onRequestConfirm(
      '예전 개인정보 모두 삭제 (되돌릴 수 없음)',
      `예전 방식으로 가입한 학생 ${scan.legacyRegistrations}명의 실명·생년월일·학교·반·번호를 데이터베이스에서 지웁니다.\n` +
        `· 활동지 기록은 '이전기록-001'처럼 무작위 번호와 학년만 붙여 교사 화면에 2027-03-31까지 읽기 전용으로 남깁니다.\n` +
        `· 기기 잠금 ${scan.deviceLocks}개, 예전 접속 기록 ${scan.legacyAccessLogs}개도 지웁니다.\n` +
        '백업은 만들지 않습니다. 지운 뒤에는 되돌릴 수 없습니다. 진행할까요?',
      async () => {
        setResult(null);
        setProgress({ done: 0, total: scan.legacyRegistrations, step: '시작하는 중' });
        try {
          const res = await runLegacyCleanup(setProgress);
          setResult(res);
          onNotice(
            `예전 개인정보를 지웠습니다: 이전기록 ${res.archived}명, 옮긴 차시 문서 ${res.movedLessonDocs}개, 기기 잠금 ${res.deletedDeviceLocks}개, 접속 기록 ${res.deletedAccessLogs}개, 예전 반별 잠금 ${res.cleanedClassAccessKeys}개.`,
            'good'
          );
        } catch (err) {
          console.error('Legacy cleanup failed:', err);
          onNotice(
            `정리 중 멈췄습니다 (${errText(err)}). 처리된 학생은 그대로 정리된 상태입니다. 다시 누르면 남은 것만 이어서 처리합니다.`,
            'warn'
          );
        } finally {
          setProgress(null);
          void refresh();
        }
      }
    );
  };

  return (
    <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-extrabold text-rose-900">
        <Trash2 className="h-4 w-4" />
        예전 방식 개인정보 정리
      </div>
      {scanError ? (
        <div className="text-xs font-bold text-rose-800">확인하지 못했습니다: {scanError}</div>
      ) : !scan ? (
        <div className="text-xs text-rose-800">남은 예전 정보를 확인하는 중…</div>
      ) : (
        <div className="text-xs sm:text-sm text-rose-900 leading-relaxed">
          아직 남은 예전 정보: 가입 문서 <strong>{scan.legacyRegistrations}명</strong> · 기기 잠금 {scan.deviceLocks}개 · 예전 접속 기록{' '}
          {scan.legacyAccessLogs}개 (이전기록으로 바꾼 학생 {scan.archives}명). 예전 학생은 이미 어떤 경로로도 입장할 수 없습니다.
        </div>
      )}
      {progress && (
        <div className="text-xs font-bold text-rose-900">
          {progress.step}… {progress.done}/{progress.total}
        </div>
      )}
      {result && (
        <div className="text-xs font-bold text-emerald-800">
          정리 완료: 이전기록 {result.archived}명 · 차시 문서 {result.movedLessonDocs}개 · 기기 잠금 {result.deletedDeviceLocks}개 · 접속 기록{' '}
          {result.deletedAccessLogs}개
        </div>
      )}
      <button
        type="button"
        disabled={!scan || !!progress}
        onClick={run}
        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {progress ? '정리 중…' : '예전 개인정보 모두 삭제'}
      </button>
    </div>
  );
};

// ------------------------------------------------------------------
// 가입 관리 전체
// ------------------------------------------------------------------

export interface StudentRegistrationPanelProps {
  /** 가입 문서 목록 (새 방식만 표시하고 예전 방식은 무시) */
  registrations: StudentRegistrationDoc[];
  adminEmail: string;
  onNotice: NoticeFn;
  onRequestConfirm: ConfirmFn;
}

export const StudentRegistrationPanel: React.FC<StudentRegistrationPanelProps> = ({
  registrations,
  adminEmail,
  onNotice,
  onRequestConfirm,
}) => {
  const regs = useMemo(() => registrations.filter((r) => isV2Registration(r)), [registrations]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [issued, setIssued] = useState<{ reg: StudentRegistrationDoc; code: string; expiresAt: Date } | null>(null);

  const pendingCount = regs.filter((r) => r.status === 'pending').length;
  const approvedCount = regs.filter((r) => r.status === 'approved').length;
  const rejectedCount = regs.filter((r) => r.status === 'rejected').length;

  const shown = regs
    .filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      const q = search.trim();
      if (!q) return true;
      return v2FullLabel(r).includes(q);
    })
    .sort((a, b) => {
      // 승인 대기 먼저 → 년도·학년·반·이름
      const pa = a.status === 'pending' ? 0 : 1;
      const pb = b.status === 'pending' ? 0 : 1;
      return pa - pb || compareV2Identity(a, b);
    });

  const setStatus = async (reg: StudentRegistrationDoc, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'student_registrations', reg.studentKey), { status, updatedAt: serverTimestamp() });
      onNotice(`${v2FullLabel(reg)} 학생을 [${status === 'approved' ? '가입 승인' : '반려'}] 처리했습니다.`, status === 'approved' ? 'good' : 'info');
    } catch (err) {
      console.error(`Status update failed for ${reg.studentKey}:`, err);
      onNotice(`처리하지 못했습니다 (${errText(err)}).`, 'warn');
    }
  };

  const approveAllPending = () => {
    const pendings = regs.filter((r) => r.status === 'pending');
    if (!pendings.length) return;
    onRequestConfirm(
      '승인 대기 학생 모두 승인',
      `승인 대기 중인 ${pendings.length}명을 한꺼번에 승인합니다. 교실에서 모든 학생의 화면을 확인했을 때만 쓰세요. 승인할까요?`,
      async () => {
        let ok = 0;
        for (const r of pendings) {
          try {
            await updateDoc(doc(db, 'student_registrations', r.studentKey), { status: 'approved', updatedAt: serverTimestamp() });
            ok++;
          } catch (err) {
            console.error(`Bulk approve failed for ${r.studentKey}:`, err);
          }
        }
        onNotice(`${ok}명을 승인했습니다${ok < pendings.length ? ` (${pendings.length - ok}명 실패 — 다시 시도해 주세요)` : ''}.`, ok === pendings.length ? 'good' : 'warn');
      }
    );
  };

  const issueCode = (reg: StudentRegistrationDoc) => {
    onRequestConfirm(
      '일회용 코드 발급',
      `${v2FullLabel(reg)} 학생의 비밀번호 재설정용 일회용 코드를 만듭니다. 코드는 지금 한 번만 보이며 ${RESET_CODE_TTL_MINUTES}분 동안 한 번 쓸 수 있습니다. 학생 얼굴을 확인한 뒤 직접 알려 주세요. (기존 비밀번호는 학생이 새로 정하기 전까지 그대로 쓸 수 있습니다)`,
      async () => {
        try {
          const res = await issueResetCode(reg.studentKey);
          setIssued({ reg, ...res });
        } catch (err) {
          console.error(`Reset code failed for ${reg.studentKey}:`, err);
          onNotice(`코드를 만들지 못했습니다 (${errText(err)}).`, 'warn');
        }
      }
    );
  };

  const remove = (reg: StudentRegistrationDoc) => {
    onRequestConfirm(
      '학생 삭제',
      `${v2FullLabel(reg)} 학생의 가입 정보와 네 사이트(함수·명제·소인수분해·정수와 유리수)의 활동지 기록을 모두 지웁니다. 지우면 이 이름은 다른 학생이 받을 수 있게 됩니다. 되돌릴 수 없습니다. 지울까요?`,
      async () => {
        try {
          const n = await deleteStudentEverywhere(reg.studentKey);
          onNotice(`${v2FullLabel(reg)} 학생을 지웠습니다 (활동지 문서 ${n}개 포함).`, 'info');
        } catch (err) {
          console.error(`Delete failed for ${reg.studentKey}:`, err);
          onNotice(`지우지 못했습니다 (${errText(err)}).`, 'warn');
        }
      }
    );
  };

  const filterButton = (key: typeof filter, label: string, n: number, on: string, off: string) => (
    <button
      type="button"
      onClick={() => setFilter(key)}
      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${filter === key ? on : off}`}
    >
      {label} ({n})
    </button>
  );

  return (
    <div className="space-y-4">
      <LegacyCleanupCard onNotice={onNotice} onRequestConfirm={onRequestConfirm} />

      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-xs sm:text-sm text-amber-900 font-bold">
              승인 대기 중인 학생이 <span className="underline font-extrabold text-amber-950">{pendingCount}명</span> 있습니다. 교실에서 학생
              얼굴과 화면의 이름(년도·학년·반)을 확인한 뒤 승인해 주세요.
            </div>
          </div>
          <button
            type="button"
            onClick={approveAllPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-extrabold transition-colors shadow-xs"
          >
            <CheckCircle2 className="h-4 w-4" />
            대기 {pendingCount}명 모두 승인
          </button>
        </div>
      )}

      <ClassRosterEditor registrations={regs} adminEmail={adminEmail} onNotice={onNotice} onRequestConfirm={onRequestConfirm} />

      <p className="text-sm text-slate-600 leading-relaxed">
        학생은 <strong>랜덤 이름 · 학년 · 새 이름 반 · 비밀번호</strong>로 가입합니다 (실명·학번·생년월일 없음). 비밀번호는 항상 필수이고,
        잊은 학생에게는 <strong>[코드 발급]</strong>으로 일회용 코드를 알려 주세요.
      </p>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
        <div className="relative min-w-[220px] sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·반 검색 (예: 김하늘, 참새반)..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium placeholder-slate-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="검색어 지우기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterButton('all', '전체', regs.length, 'bg-slate-900 text-white', 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100')}
          {filterButton('pending', '승인 대기', pendingCount, 'bg-amber-600 text-white', 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100')}
          {filterButton('approved', '승인 완료', approvedCount, 'bg-emerald-600 text-white', 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100')}
          {filterButton('rejected', '반려됨', rejectedCount, 'bg-rose-600 text-white', 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100')}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
              <th className="py-3 px-3.5 text-left">상태</th>
              <th className="py-3 px-3.5 text-left">년도 / 학년 / 반</th>
              <th className="py-3 px-3.5 text-left">이름</th>
              <th className="py-3 px-3.5 text-left">신청 시각</th>
              <th className="py-3 px-3.5 text-left">비밀번호 분실</th>
              <th className="py-3 px-3.5 text-left">승인 처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {shown.length > 0 ? (
              shown.map((reg) => (
                <tr key={reg.studentKey} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3.5">
                    {reg.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-800">
                        <Clock className="h-3.5 w-3.5" /> 승인 대기
                      </span>
                    )}
                    {reg.status === 'approved' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-800">
                        <UserCheck className="h-3.5 w-3.5" /> 승인됨
                      </span>
                    )}
                    {reg.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-800">
                        <XCircle className="h-3.5 w-3.5" /> 반려됨
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3.5 font-semibold text-slate-800">
                    {reg.year} {reg.grade} {reg.className}
                  </td>
                  <td className="py-3 px-3.5 text-base font-extrabold text-slate-900">{reg.name}</td>
                  <td className="py-3 px-3.5 mono text-xs text-slate-600">{formatTime(reg.createdAt)}</td>
                  <td className="py-3 px-3.5 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => issueCode(reg)}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                        title="비밀번호를 잊은 학생에게 일회용 코드 발급"
                      >
                        <KeyRound className="h-3.5 w-3.5" /> 코드 발급
                      </button>
                      {reg.resetCodeHash ? <span className="text-[11px] font-bold text-amber-700">발급됨</span> : null}
                    </div>
                  </td>
                  <td className="py-3 px-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {reg.status !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => setStatus(reg, 'approved')}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          가입 승인
                        </button>
                      )}
                      {reg.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => setStatus(reg, 'rejected')}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          반려
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(reg)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                  {search ? `'${search}'에 해당하는 학생이 없습니다.` : '해당 상태의 가입 신청이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {issued && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="일회용 코드"
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl text-center space-y-3">
            <div className="text-sm font-bold text-slate-600">{v2FullLabel(issued.reg)}</div>
            <div className="text-xs font-bold text-amber-700">비밀번호 재설정 일회용 코드 (이 창을 닫으면 다시 볼 수 없음)</div>
            <div className="text-4xl font-extrabold tracking-[0.2em] mono text-slate-900">{formatResetCode(issued.code)}</div>
            <div className="text-xs text-slate-600">
              {issued.expiresAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}까지 한 번만 쓸 수 있습니다. 학생은 로그인
              화면의 [비밀번호 재설정]에서 이름·코드·새 비밀번호를 입력합니다.
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const reg = issued.reg;
                  setIssued(null);
                  try {
                    await cancelResetCode(reg.studentKey);
                    onNotice(`${v2FullLabel(reg)} 학생의 일회용 코드를 취소했습니다.`, 'info');
                  } catch (err) {
                    onNotice(`코드를 취소하지 못했습니다 (${errText(err)}). 30분이 지나면 저절로 못 쓰게 됩니다.`, 'warn');
                  }
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                코드 취소
              </button>
              <button
                type="button"
                onClick={() => setIssued(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                알려 주었음 · 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
