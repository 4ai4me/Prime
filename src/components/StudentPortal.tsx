/**
 * 학생 입장 화면 (가상 정보 가입·로그인·비밀번호 재설정) — 2026-11-28~
 * ------------------------------------------------------------------
 * ⚠️ 이 파일은 Func·Props·Prime·Rational 네 저장소에서 똑같아야 합니다.
 *    사이트마다 다른 부분(제목·첫 활동지)은 props로 받습니다.
 */
import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  RefreshCw,
  Shuffle,
  UserPlus,
} from 'lucide-react';
import { db } from '../firebase';
import { validateStudentPassword } from '../utils/authLogic';
import { getClientNetworkIdentity } from '../utils/deviceFingerprint';
import { recordStudentAccessLog } from '../utils/auditLogger';
import {
  ensureStudentAuth,
  openOwnRegistration,
  pickAvailableName,
  redeemResetCode,
  registerStudent,
  useClassRoster,
  type StudentRegistrationDoc,
} from '../utils/studentAccount';
import {
  ACTIVE_STUDENT_KEY_STORAGE,
  FIXED_SCHOOL_NAME,
  GRADE_OPTIONS,
  RESET_CODE_TTL_MINUTES,
  isGradeOption,
  isV2Registration,
  isValidStudentName,
  isWellFormedResetCode,
  koreanYearOf,
  v2FullLabel,
  validateV2RegistrationInput,
  type GradeOption,
} from '../utils/studentIdentity';

export interface StudentPortalProps {
  /** 예: '이하연 수학 교실 · 함수일까 대응일까' */
  siteLabel: string;
  /** 예: '함수 활동지' */
  worksheetName: string;
  /** 가입 문서에 넣을 첫 활동지(JSON). 사이트마다 형식이 다름 */
  buildInitialWorksheetJson: (identity: { groupLabel: string; codeLabel: string }) => string;
  onApproved: (doc: StudentRegistrationDoc) => void;
}

type Tab = 'login' | 'register' | 'reset';
type Msg = { text: string; type: 'good' | 'warn' } | null;

function readActiveKey(): string {
  try {
    return localStorage.getItem(ACTIVE_STUDENT_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

function saveActiveKey(key: string) {
  try {
    if (key) localStorage.setItem(ACTIVE_STUDENT_KEY_STORAGE, key);
    else localStorage.removeItem(ACTIVE_STUDENT_KEY_STORAGE);
  } catch {
    // 기기 저장 공간을 못 쓰면 이번 화면에서만 기억
  }
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400';
const labelClass = 'block text-sm font-bold text-slate-800 mb-1.5';

/** 비밀번호 칸 + 재확인 칸 + 조건 표시 */
const PasswordFields: React.FC<{
  idPrefix: string;
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  label?: string;
}> = ({ idPrefix, password, confirm, onPassword, onConfirm, label = '비밀번호' }) => {
  const [show, setShow] = useState(false);
  const checks = validateStudentPassword(password).checks;
  const confirmOk = confirm.length > 0 && confirm === password;
  const items: [string, boolean][] = [
    ['8~32자리', checks.length],
    ['대문자(A-Z)', checks.upper],
    ['소문자(a-z)', checks.lower],
    ['숫자(0-9)', checks.digit],
    ['특수문자(!@# 등)', checks.special],
  ];
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-pw`} className={labelClass}>
            {label}
          </label>
          <input
            id={`${idPrefix}-pw`}
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            maxLength={32}
            required
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            placeholder="대문자·소문자·숫자·특수문자 포함 8자 이상"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-pw2`} className={labelClass}>
            {label} 확인
          </label>
          <input
            id={`${idPrefix}-pw2`}
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            maxLength={32}
            required
            value={confirm}
            onChange={(e) => onConfirm(e.target.value)}
            placeholder="한 번 더 입력"
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        {items.map(([text, ok]) => (
          <span key={text} className={ok ? 'font-bold text-emerald-700' : 'text-slate-500'}>
            {ok ? '✓ ' : '· '}
            {text}
          </span>
        ))}
        <span className={confirmOk ? 'font-bold text-emerald-700' : confirm ? 'font-bold text-rose-600' : 'text-slate-500'}>
          {confirmOk ? '✓ 확인 일치' : confirm ? '✗ 확인 불일치' : '· 확인 일치'}
        </span>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50"
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {show ? '가리기' : '보기'}
        </button>
      </div>
    </div>
  );
};

export const StudentPortal: React.FC<StudentPortalProps> = ({
  siteLabel,
  worksheetName,
  buildInitialWorksheetJson,
  onApproved,
}) => {
  const [tab, setTab] = useState<Tab>('login');
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [activeKey, setActiveKey] = useState<string>(readActiveKey);
  const [myDoc, setMyDoc] = useState<StudentRegistrationDoc | null>(null);

  // 가입 신청
  const year = koreanYearOf();
  const { roster, loaded: rosterLoaded, error: rosterError } = useClassRoster(year);
  const [regName, setRegName] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [regGrade, setRegGrade] = useState<GradeOption | ''>('');
  const [regClass, setRegClass] = useState('');
  const [regPw, setRegPw] = useState('');
  const [regPw2, setRegPw2] = useState('');
  const [justRegistered, setJustRegistered] = useState<string | null>(null);

  // 로그인
  const [loginName, setLoginName] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // 비밀번호 재설정
  const [resetName, setResetName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPw, setResetPw] = useState('');
  const [resetPw2, setResetPw2] = useState('');

  const classList = regGrade ? roster.classes[regGrade] || [] : [];

  const switchTab = (t: Tab) => {
    setTab(t);
    setMsg(null);
  };

  const forget = (text?: string) => {
    saveActiveKey('');
    setActiveKey('');
    setMyDoc(null);
    if (text) setMsg({ text, type: 'warn' });
  };

  // 이 기기에 연결된 내 가입 문서: 승인되면 바로 활동지로
  useEffect(() => {
    if (!activeKey) {
      setMyDoc(null);
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | null = null;
    ensureStudentAuth()
      .then(() => {
        if (cancelled) return;
        unsub = onSnapshot(
          doc(db, 'student_registrations', activeKey),
          (snap) => {
            const data = snap.exists() ? (snap.data() as StudentRegistrationDoc) : null;
            if (!data || !isV2Registration(data)) {
              forget('가입 정보를 찾을 수 없습니다. 다시 로그인하거나 새로 가입해 주세요.');
              return;
            }
            setMyDoc(data);
            if (data.status === 'approved') onApproved(data);
          },
          (err) => {
            console.error('Registration listener error:', err);
            // 다른 기기에서 같은 이름으로 로그인하면 이 기기의 연결이 끊김
            forget('다른 기기에서 로그인되어 이 기기의 연결이 해제되었습니다. 이름과 비밀번호로 다시 로그인해 주세요.');
          }
        );
      })
      .catch((err) => {
        console.error('Anonymous sign-in failed:', err);
        setMsg({ text: '학생 로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', type: 'warn' });
      });
    return () => {
      cancelled = true;
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, onApproved]);

  const logAccess = async (d: StudentRegistrationDoc, eventType: 'login' | 'register') => {
    try {
      const net = await getClientNetworkIdentity();
      await recordStudentAccessLog({
        profile: d,
        eventType,
        status: d.status,
        deviceHash: net.deviceHash,
        userAgent: net.userAgent,
        updateRegistrationUpdatedAt: d.status === 'approved',
      });
    } catch (err) {
      console.warn('Access log skipped:', err);
    }
  };

  const handleMakeName = async () => {
    setNameBusy(true);
    setMsg(null);
    try {
      setRegName(await pickAvailableName());
    } catch (err) {
      console.error('Random name failed:', err);
      setMsg({ text: '이름을 만들지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.', type: 'warn' });
    } finally {
      setNameBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const check = validateV2RegistrationInput(
      { name: regName, grade: regGrade, className: regClass, password: regPw, passwordConfirm: regPw2 },
      rosterLoaded ? roster : null,
      validateStudentPassword
    );
    if (!check.ok) {
      setMsg({ text: check.error, type: 'warn' });
      return;
    }
    if (!isGradeOption(regGrade)) return;
    setBusy(true);
    try {
      const net = await getClientNetworkIdentity();
      const identity = { year, grade: regGrade, className: regClass, name: regName };
      const res = await registerStudent({
        name: regName,
        grade: regGrade,
        className: regClass,
        password: regPw,
        worksheetJson: buildInitialWorksheetJson({
          groupLabel: `${year} ${regGrade} ${regClass}`,
          codeLabel: regName,
        }),
        deviceHash: net.deviceHash,
        userAgent: net.userAgent,
      });
      if (res.kind === 'taken') {
        setRegName('');
        setMsg({ text: '그사이 다른 학생이 이 이름으로 먼저 가입했습니다. [랜덤 이름 만들기]를 다시 눌러 주세요.', type: 'warn' });
        return;
      }
      setRegPw('');
      setRegPw2('');
      setJustRegistered(v2FullLabel(identity));
      saveActiveKey(res.doc.studentKey);
      setActiveKey(res.doc.studentKey);
      void logAccess(res.doc, 'register');
      setMsg({ text: '가입 신청이 접수되었습니다. 선생님이 교실에서 확인하고 승인하면 바로 활동지가 열립니다.', type: 'good' });
    } catch (err) {
      console.error('Registration failed:', err);
      setMsg({
        text: '가입 신청을 저장하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요. (계속 안 되면 선생님께 알려 주세요)',
        type: 'warn',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const name = loginName.trim();
    if (!isValidStudentName(name)) {
      setMsg({ text: '가입할 때 받은 이름(한글 2~4자)을 입력해 주세요.', type: 'warn' });
      return;
    }
    if (!loginPw) {
      setMsg({ text: '비밀번호를 입력해 주세요.', type: 'warn' });
      return;
    }
    setBusy(true);
    try {
      const res = await openOwnRegistration(name, loginPw);
      if (res.kind === 'not_found') {
        setMsg({ text: '이 이름으로 가입한 학생이 없습니다. 이름을 다시 확인하거나 먼저 가입을 신청해 주세요.', type: 'warn' });
        return;
      }
      if (res.kind === 'mismatch') {
        setMsg({
          text: '비밀번호가 맞지 않습니다. 비밀번호를 잊었다면 선생님께 일회용 코드를 받아 [비밀번호 재설정]에서 새로 정해 주세요.',
          type: 'warn',
        });
        return;
      }
      setLoginPw('');
      saveActiveKey(res.doc.studentKey);
      setActiveKey(res.doc.studentKey);
      void logAccess(res.doc, 'login');
      if (res.doc.status === 'pending') {
        setMsg({ text: '아직 선생님 승인을 기다리고 있습니다. 승인되면 바로 활동지가 열립니다.', type: 'warn' });
      } else if (res.doc.status === 'rejected') {
        setMsg({ text: '가입 신청이 반려되었습니다. 선생님께 문의해 주세요.', type: 'warn' });
      }
    } catch (err) {
      console.error('Login failed:', err);
      setMsg({ text: '로그인 중 오류가 발생했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.', type: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const name = resetName.trim();
    if (!isValidStudentName(name)) {
      setMsg({ text: '가입할 때 받은 이름(한글 2~4자)을 입력해 주세요.', type: 'warn' });
      return;
    }
    if (!isWellFormedResetCode(resetCode)) {
      setMsg({ text: '선생님께 받은 일회용 코드 8자리를 그대로 입력해 주세요. (예: ABCD-EFGH)', type: 'warn' });
      return;
    }
    const pw = validateStudentPassword(resetPw);
    if (!pw.ok) {
      setMsg({ text: pw.error || '비밀번호 형식을 확인해 주세요.', type: 'warn' });
      return;
    }
    if (resetPw !== resetPw2) {
      setMsg({ text: '새 비밀번호 확인이 일치하지 않습니다.', type: 'warn' });
      return;
    }
    setBusy(true);
    try {
      const res = await redeemResetCode(name, resetCode, resetPw);
      if (res.kind === 'invalid') {
        setMsg({
          text: `코드가 맞지 않거나 이미 썼거나 ${RESET_CODE_TTL_MINUTES}분이 지났습니다. 이름과 코드를 확인하고, 안 되면 선생님께 새 코드를 받아 주세요.`,
          type: 'warn',
        });
        return;
      }
      setResetCode('');
      setResetPw('');
      setResetPw2('');
      saveActiveKey(res.doc.studentKey);
      setActiveKey(res.doc.studentKey);
      void logAccess(res.doc, 'login');
      setMsg({ text: '새 비밀번호로 바뀌었습니다. 다음부터는 새 비밀번호로 로그인하세요.', type: 'good' });
    } catch (err) {
      console.error('Password reset failed:', err);
      setMsg({ text: '비밀번호를 바꾸지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.', type: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  const tabButton = (t: Tab, icon: React.ReactNode, text: string) => (
    <button
      type="button"
      onClick={() => switchTab(t)}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors whitespace-nowrap ${
        tab === t ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
      }`}
    >
      {icon}
      {text}
    </button>
  );

  return (
    <div className="mt-5 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
      {msg && (
        <div
          role="status"
          className={`mb-5 flex items-start gap-2.5 rounded-xl border p-4 text-sm font-semibold ${
            msg.type === 'good' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {msg.type === 'good' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 방금 가입한 학생: 이름을 꼭 적어 두도록 크게 보여 줌 */}
      {justRegistered && (
        <div className="mb-6 rounded-2xl border-2 border-blue-300 bg-blue-50 p-5 text-center">
          <div className="text-sm font-bold text-blue-800">내 이름 — 로그인할 때 필요합니다. 꼭 적어 두세요!</div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{justRegistered}</div>
        </div>
      )}

      {/* 이 기기에 연결된 내 가입 정보 (승인 대기·반려) */}
      {myDoc && myDoc.status !== 'approved' && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/70 p-5">
          <div className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
            <Clock className="h-4 w-4 text-amber-600" />
            {myDoc.status === 'pending' ? '선생님 승인 대기 중' : '가입 신청 반려됨'}
          </div>
          <div className="mt-3 text-base text-slate-800">
            <strong>{v2FullLabel(myDoc)}</strong>
          </div>
          <p className="mt-2 text-xs sm:text-sm text-amber-900/90">
            {myDoc.status === 'pending'
              ? `선생님이 교실에서 확인한 뒤 [가입 승인]을 누르면 새로고침 없이 바로 ${worksheetName} 화면이 열립니다.`
              : '선생님께 문의해 주세요.'}
          </p>
          <button
            type="button"
            onClick={() => {
              forget();
              setJustRegistered(null);
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            다른 이름으로 로그인
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-5 mb-6">
        {tabButton('login', <LogIn className="h-4 w-4" />, '로그인')}
        {tabButton('register', <UserPlus className="h-4 w-4" />, '처음 가입 신청')}
        {tabButton('reset', <KeyRound className="h-4 w-4" />, '비밀번호 재설정')}
      </div>

      <div className="mb-6">
        <div className="text-xs font-extrabold text-blue-600 mb-1">{siteLabel} (통합 계정)</div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          {tab === 'login' ? '학생 로그인' : tab === 'register' ? '처음 가입 신청' : '비밀번호 재설정'}
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
          {tab === 'login' &&
            '가입할 때 받은 이름과 비밀번호로 들어옵니다. 선생님의 다른 수학 수업 사이트에서 가입했어도 같은 이름으로 들어올 수 있습니다.'}
          {tab === 'register' &&
            '실제 이름·학번·생년월일은 입력하지 않습니다. 랜덤으로 받은 이름으로 가입하고, 선생님이 교실에서 확인한 뒤 승인합니다.'}
          {tab === 'reset' &&
            '비밀번호를 잊었을 때만 씁니다. 선생님께 일회용 코드를 받아 새 비밀번호를 정하세요. 코드는 한 번만, 30분 안에 쓸 수 있습니다.'}
        </p>
      </div>

      {tab === 'login' && (
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="stu-login-name" className={labelClass}>
                이름 (가입할 때 받은 이름)
              </label>
              <input
                id="stu-login-name"
                type="text"
                autoComplete="username"
                maxLength={4}
                required
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="예: 김하늘"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="stu-login-pw" className={labelClass}>
                비밀번호
              </label>
              <input
                id="stu-login-pw"
                type="password"
                autoComplete="current-password"
                maxLength={32}
                required
                value={loginPw}
                onChange={(e) => setLoginPw(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[48px] rounded-xl bg-blue-600 px-5 py-3 text-base font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? '확인 중...' : '로그인'}
          </button>
        </form>
      )}

      {tab === 'register' && (
        <form onSubmit={handleRegister} className="space-y-5">
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <div className={labelClass}>학교</div>
              <div className="rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-base font-semibold text-slate-700">
                {FIXED_SCHOOL_NAME}
              </div>
            </div>
            <div>
              <div className={labelClass}>년도</div>
              <div className="rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-base font-semibold text-slate-700 mono">
                {year}년
              </div>
            </div>
          </div>

          <div>
            <div className={labelClass}>이름 (랜덤으로 만들어짐 · 직접 입력할 수 없음)</div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                aria-live="polite"
                className={`min-w-[9rem] rounded-xl border px-4 py-2.5 text-lg font-extrabold ${
                  regName ? 'border-emerald-300 bg-emerald-50 text-slate-900' : 'border-dashed border-slate-300 bg-slate-50 text-slate-400'
                }`}
              >
                {regName || '아직 없음'}
              </div>
              <button
                type="button"
                onClick={handleMakeName}
                disabled={nameBusy || busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Shuffle className="h-4 w-4" />
                {nameBusy ? '만들고 중복 확인 중...' : regName ? '다른 이름 만들기' : '랜덤 이름 만들기'}
              </button>
              {regName && <span className="text-xs font-bold text-emerald-700">✓ 중복 확인 완료 — 쓸 수 있는 이름입니다</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="stu-reg-grade" className={labelClass}>
                학년
              </label>
              <select
                id="stu-reg-grade"
                value={regGrade}
                onChange={(e) => {
                  setRegGrade(e.target.value as GradeOption | '');
                  setRegClass('');
                }}
                className={`${inputClass} font-semibold`}
              >
                <option value="">학년 선택</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="stu-reg-class" className={labelClass}>
                반
              </label>
              <select
                id="stu-reg-class"
                value={regClass}
                disabled={!regGrade || classList.length === 0}
                onChange={(e) => setRegClass(e.target.value)}
                className={`${inputClass} font-semibold disabled:bg-slate-100 disabled:text-slate-400`}
              >
                <option value="">
                  {!regGrade
                    ? '학년을 먼저 선택'
                    : !rosterLoaded
                    ? '반 목록 불러오는 중...'
                    : classList.length === 0
                    ? '아직 만든 반이 없음'
                    : '반 선택'}
                </option>
                {classList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {regGrade && rosterLoaded && classList.length === 0 && (
            <p className="text-xs font-semibold text-amber-700">
              {rosterError
                ? '반 목록을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'
                : `선생님이 아직 ${year}년 ${regGrade} 반을 만들지 않았습니다. 선생님께 알려 주세요.`}
            </p>
          )}

          <div className="pt-4 border-t border-slate-100">
            <PasswordFields
              idPrefix="stu-reg"
              password={regPw}
              confirm={regPw2}
              onPassword={setRegPw}
              onConfirm={setRegPw2}
            />
            <p className="mt-2 text-xs text-slate-500">
              다른 사이트(게임, SNS 등)에서 쓰는 비밀번호와 다르게 정하세요. 비밀번호를 모르면 로그인할 수 없습니다.
            </p>
          </div>

          <button
            type="submit"
            disabled={busy || nameBusy}
            className="w-full min-h-[48px] rounded-xl bg-blue-600 px-5 py-3 text-base font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? '처리 중...' : '가입 신청하기'}
          </button>
        </form>
      )}

      {tab === 'reset' && (
        <form onSubmit={handleReset} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="stu-reset-name" className={labelClass}>
                이름 (가입할 때 받은 이름)
              </label>
              <input
                id="stu-reset-name"
                type="text"
                autoComplete="username"
                maxLength={4}
                required
                value={resetName}
                onChange={(e) => setResetName(e.target.value)}
                placeholder="예: 김하늘"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="stu-reset-code" className={labelClass}>
                일회용 코드 (선생님께 받은 8자리)
              </label>
              <input
                id="stu-reset-code"
                type="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                maxLength={9}
                required
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                placeholder="예: ABCD-EFGH"
                className={`${inputClass} mono tracking-widest`}
              />
            </div>
          </div>
          <PasswordFields
            idPrefix="stu-reset"
            label="새 비밀번호"
            password={resetPw}
            confirm={resetPw2}
            onPassword={setResetPw}
            onConfirm={setResetPw2}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[48px] rounded-xl bg-blue-600 px-5 py-3 text-base font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? '확인 중...' : '새 비밀번호로 바꾸기'}
          </button>
        </form>
      )}
    </div>
  );
};

