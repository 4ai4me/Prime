import React, { useEffect, useState } from 'react';
import {
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import { db, auth, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import {
  ADMIN_TEACHER_EMAIL,
  StudentIdentityInput,
  buildSafeStudentKey,
  formatDeviceHashAsMac,
  isAuthorizedAdminEmail,
  normalizeBirthDate,
  validateStudentPassword,
  validateStudentRegistrationInput,
} from '../utils/authLogic';
import { ClientNetworkIdentity, getClientNetworkIdentity } from '../utils/deviceFingerprint';
import {
  StudentRecord,
  createInitialStudentState,
  initialWorksheetJson,
} from '../utils/studentRecord';
import {
  ShieldCheck,
  UserCheck,
  Clock,
  Lock,
  LogIn,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import { recordStudentAccessLog } from '../utils/auditLogger';
import { ensureStudentAuth, openOwnRegistration } from '../utils/studentAuth';
import {
  hashStudentPassword,
  needsPasswordSetup,
  setInitialStudentPassword,
  useStudentAuthPolicy,
} from '../utils/studentPassword';

export interface FirestoreStudentRegistrationDoc {
  studentKey: string;
  school: string;
  grade: string;
  classNum: string;
  studentNum: string;
  birthDate: string;
  name: string;
  deviceHash: string;
  ipAddress: string;
  userAgent: string;
  status: 'pending' | 'approved' | 'rejected';
  worksheetJson: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  /** 이 문서의 주인인 Firebase 익명 계정 uid (보안 규칙에서 본인 확인에 사용) */
  uid?: string;
  claimName?: string;
  claimBirthDate?: string;
  /** 비밀번호 해시 (비밀번호를 설정하지 않았으면 없음 또는 빈 값). 원문은 저장하지 않음 */
  passwordHash?: string;
  claimPasswordHash?: string;
}

interface AuthGateViewProps {
  currentUser: User | null;
  onStudentApprovedLogin: (
    regDoc: FirestoreStudentRegistrationDoc,
    worksheet: StudentRecord
  ) => void;
  onAdminTeacherLogin: () => void;
}

const SAVED_STUDENT_KEY_STORAGE = 'math_detective_active_student_key_v1';

export const AuthGateView: React.FC<AuthGateViewProps> = ({
  currentUser,
  onStudentApprovedLogin,
  onAdminTeacherLogin,
}) => {
  const [portalMode, setPortalMode] = useState<'student' | 'teacher'>('student');
  const [studentSubTab, setStudentSubTab] = useState<'login' | 'register'>('login');

  const [form, setForm] = useState<StudentIdentityInput>({
    school: '',
    grade: '1',
    classNum: '',
    studentNum: '',
    birthDate: '',
    name: '',
    password: '',
  });

  const [netInfo, setNetInfo] = useState<ClientNetworkIdentity>({
    deviceHash: 'DEV_LOADING00000',
    ipAddress: 'mac-only',
    userAgent: '',
  });

  const [activeStudentKey, setActiveStudentKey] = useState<string>(() => {
    try {
      return localStorage.getItem(SAVED_STUDENT_KEY_STORAGE) || '';
    } catch {
      return '';
    }
  });

  const [pendingDoc, setPendingDoc] = useState<FirestoreStudentRegistrationDoc | null>(null);
  // 학생 비밀번호 사용 설정 (교사가 학생 가입 관리에서 켜고 끔, 기본: 사용 안 함)
  const policy = useStudentAuthPolicy();
  const passwordOn = policy.passwordRequired;
  // 기존 가입자 비밀번호 처음 설정 폼
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'good' | 'warn' } | null>(null);

  useEffect(() => {
    getClientNetworkIdentity().then(setNetInfo);
  }, []);

  // Listen to activeStudentKey registration status in real time
  useEffect(() => {
    if (!activeStudentKey) {
      setPendingDoc(null);
      return;
    }
    // 비밀번호 사용 설정을 받은 뒤에 판단 (받기 전에 입장시키지 않음)
    if (!policy.loaded) return;
    const ref = doc(db, 'student_registrations', activeStudentKey);
    let cancelled = false;
    let unsub: (() => void) | null = null;
    // 익명 로그인이 준비된 뒤에 구독해야 보안 규칙의 본인 확인을 통과합니다.
    ensureStudentAuth()
      .then(() => {
        if (cancelled) return;
        unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setPendingDoc(null);
          return;
        }
        const data = snap.data() as FirestoreStudentRegistrationDoc;
        setPendingDoc(data);
        // 비밀번호 사용이 켜져 있는데 아직 비밀번호가 없으면, 먼저 비밀번호를 설정해야 입장 가능
        if (data.status === 'approved' && !needsPasswordSetup(policy.passwordRequired, data)) {
          const groupLabel = `${data.school} ${data.grade}학년 ${data.classNum}반`.slice(0, 25);
          const codeLabel = `${data.grade}${String(data.classNum).padStart(2, '0')}${String(
            data.studentNum
          ).padStart(2, '0')}_${data.name}`.slice(0, 25);
          // 답안은 로그인 뒤 Prime 차시 문서(prime_lessons)에서 불러옵니다 (가입 문서의 worksheetJson은 Func·Props 보존용이라 읽지 않음)
          const fresh = createInitialStudentState();
          fresh.group = groupLabel;
          fresh.code = codeLabel;
          onStudentApprovedLogin(data, fresh);
        }
      },
      (error) => {
        console.error('Registration listener error:', error);
        // 다른 기기에서 다시 로그인했거나 예전 방식으로 가입한 경우: 다시 로그인 필요
        try {
          localStorage.removeItem(SAVED_STUDENT_KEY_STORAGE);
        } catch {}
        setActiveStudentKey('');
        setStatusMsg({
          text: '보안 확인이 필요합니다. 학적 정보와 이름·생년월일을 입력해 다시 로그인해 주세요.',
          type: 'warn',
        });
      }
    );
      })
      .catch((err) => {
        console.error('Anonymous sign-in failed:', err);
        setStatusMsg({
          text: '학생 로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          type: 'warn',
        });
      });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [activeStudentKey, onStudentApprovedLogin, policy.loaded, policy.passwordRequired]);

  // If teacher is already logged in with authorized email
  useEffect(() => {
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, currentUser.emailVerified)) {
      if (portalMode === 'teacher') {
        onAdminTeacherLogin();
      }
    }
  }, [currentUser, portalMode, onAdminTeacherLogin]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    // 비밀번호 사용이 켜져 있으면 가입 시 비밀번호 필수
    const validation = validateStudentRegistrationInput(form, { enforcePassword: passwordOn });
    if (!validation.ok) {
      setStatusMsg({ text: validation.error || '입력값을 확인해 주세요.', type: 'warn' });
      return;
    }

    setLoading(true);
    try {
      const latestNet = await getClientNetworkIdentity();
      setNetInfo(latestNet);

      const sKey = buildSafeStudentKey(form);
      const normalizedBirth = normalizeBirthDate(form.birthDate);

      // 1. Check if this device (MAC/Hardware Hash) already registered another account
      const deviceLockRef = doc(db, 'device_locks', latestNet.deviceHash);
      let deviceSnap;
      try {
        deviceSnap = await getDoc(deviceLockRef);
      } catch {
        // non-blocking
      }

      if (deviceSnap && deviceSnap.exists()) {
        const lockData = deviceSnap.data() as { studentKey?: string };
        if (lockData.studentKey && lockData.studentKey !== sKey) {
          // In school classrooms, computer lab PCs and tablet carts are shared across morning and afternoon classes.
          // Allow registration and rebind device lock so afternoon students are not locked out.
          console.info(
            `School shared device detected. Updating device link from ${lockData.studentKey} to ${sKey}`
          );
        }
      }

      // 2. Check if this studentKey already exists (서버 규칙이 본인 여부를 확인)
      const studentUser = await ensureStudentAuth();
      const regRef = doc(db, 'student_registrations', sKey);
      const opened = await openOwnRegistration(sKey, form.name, normalizedBirth, form.password || '');

      if (opened.kind === 'password_required') {
        setStatusMsg({
          text: '이미 가입된 학생입니다. [승인된 학생 입장] 탭에서 비밀번호를 함께 입력해 로그인해 주세요.',
          type: 'warn',
        });
        setLoading(false);
        return;
      }

      if (opened.kind === 'ok') {
        const existing = opened.doc;
        try {
          localStorage.setItem(SAVED_STUDENT_KEY_STORAGE, sKey);
        } catch {}
        setActiveStudentKey(sKey);
        setStatusMsg({
          text:
            existing.status === 'approved'
              ? '이미 승인된 계정입니다. 활동지 화면으로 이동합니다.'
              : '이미 가입 신청이 접수되어 관리자 승인 대기 중입니다.',
          type: existing.status === 'approved' ? 'good' : 'warn',
        });
        setLoading(false);
        return;
      }
      if (opened.kind === 'mismatch') {
        setStatusMsg({
          text: '이미 동일한 학교·학년·반·번호로 등록된 학생이 존재합니다. 학적 정보를 다시 확인하거나 교사에게 문의해 주세요.',
          type: 'warn',
        });
        setLoading(false);
        return;
      }

      // 3. Create initial worksheet payload & atomic batch write (student_registrations + device_locks)
      const initialWorksheet = createInitialStudentState();
      initialWorksheet.group = `${form.school.trim()} ${form.grade.trim()}학년 ${form.classNum.trim()}반`.slice(0, 25);
      initialWorksheet.code = `${form.grade.trim()}${String(form.classNum.trim()).padStart(2, '0')}${String(form.studentNum.trim()).padStart(2, '0')}_${form.name.trim()}`.slice(0, 25);

      // 비밀번호는 원문이 아닌 해시만 저장
      const passwordHash = passwordOn ? await hashStudentPassword(sKey, form.password || '') : '';

      const batch = writeBatch(db);
      batch.set(regRef, {
        studentKey: sKey,
        school: form.school.trim().slice(0, 40),
        grade: String(parseInt(form.grade.trim(), 10)),
        classNum: String(parseInt(form.classNum.trim(), 10)),
        studentNum: String(parseInt(form.studentNum.trim(), 10)),
        birthDate: normalizedBirth.slice(0, 12),
        name: form.name.trim().slice(0, 25),
        deviceHash: latestNet.deviceHash,
        ipAddress: latestNet.ipAddress,
        userAgent: latestNet.userAgent,
        status: 'pending',
        worksheetJson: initialWorksheetJson(initialWorksheet),
        uid: studentUser.uid,
        ...(passwordHash ? { passwordHash } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(deviceLockRef, {
        deviceHash: latestNet.deviceHash,
        studentKey: sKey,
        ipAddress: latestNet.ipAddress,
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `student_registrations/${sKey}`);
      }

      try {
        localStorage.setItem(SAVED_STUDENT_KEY_STORAGE, sKey);
      } catch {}
      setActiveStudentKey(sKey);

      // Record student access log for register event
      try {
        await recordStudentAccessLog({
          studentKey: sKey,
          school: form.school.trim(),
          grade: form.grade.trim(),
          classNum: form.classNum.trim(),
          studentNum: form.studentNum.trim(),
          name: form.name.trim(),
          eventType: 'register',
          status: 'pending',
          deviceHash: latestNet.deviceHash,
          ipAddress: latestNet.ipAddress,
          userAgent: latestNet.userAgent,
        });
      } catch (logErr) {
        console.warn('Register log skipped:', logErr);
      }

      setStatusMsg({
        text: '가입 신청이 정상 접수되었습니다! 관리자(교사) 승인 후 즉시 활동지가 열립니다.',
        type: 'good',
      });
    } catch {
      setStatusMsg({
        text: '가입 신청 처리 중 오류가 발생했습니다. 입력 정보를 다시 확인해 주세요.',
        type: 'warn',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    // 로그인은 비밀번호 형식을 검사하지 않음 (비밀번호가 설정된 학생만 서버가 확인)
    const validation = validateStudentRegistrationInput(form, { enforcePassword: false });
    if (!validation.ok) {
      setStatusMsg({ text: validation.error || '입력값을 확인해 주세요.', type: 'warn' });
      return;
    }

    setLoading(true);
    try {
      const sKey = buildSafeStudentKey(form);
      const normalizedBirth = normalizeBirthDate(form.birthDate);
      // 이름·생년월일 확인은 Firestore 보안 규칙(서버)이 수행합니다.
      // (다른 학생의 문서는 목록 조회도, 열람도 할 수 없습니다)
      const opened = await openOwnRegistration(sKey, form.name, normalizedBirth, form.password || '');

      if (opened.kind === 'password_required') {
        setStatusMsg({
          text: '비밀번호를 설정한 학생입니다. 비밀번호를 함께 입력해 주세요. (비밀번호를 잊었다면 선생님께 초기화를 요청하세요)',
          type: 'warn',
        });
        setLoading(false);
        return;
      }

      if (opened.kind === 'not_found') {
        setStatusMsg({
          text: '일치하는 가입 신청 내역이 없습니다. 학교 이름을 가입할 때와 똑같이 입력했는지 확인하거나, 먼저 [학생 신규 가입 신청] 탭에서 가입을 신청해 주세요.',
          type: 'warn',
        });
        setLoading(false);
        return;
      }

      if (opened.kind === 'mismatch') {
        setStatusMsg({
          text: form.password
            ? '이름·생년월일 또는 비밀번호가 등록된 정보와 일치하지 않습니다. (비밀번호를 잊었다면 선생님께 초기화를 요청하세요)'
            : '이름 또는 생년월일이 등록된 정보와 일치하지 않습니다.',
          type: 'warn',
        });
        setLoading(false);
        return;
      }

      const matchedDoc = opened.doc;

      try {
        localStorage.setItem(SAVED_STUDENT_KEY_STORAGE, matchedDoc.studentKey);
      } catch {}
      setActiveStudentKey(matchedDoc.studentKey);

      // Record access log and update updatedAt so afternoon login is immediately recorded in Firestore
      try {
        const latestNet = await getClientNetworkIdentity();
        await recordStudentAccessLog({
          studentKey: matchedDoc.studentKey,
          school: matchedDoc.school,
          grade: matchedDoc.grade,
          classNum: matchedDoc.classNum,
          studentNum: matchedDoc.studentNum,
          name: matchedDoc.name,
          eventType: 'login',
          status: matchedDoc.status,
          deviceHash: latestNet.deviceHash,
          ipAddress: latestNet.ipAddress,
          userAgent: latestNet.userAgent,
          updateRegistrationUpdatedAt: matchedDoc.status === 'approved',
        });
      } catch (logErr) {
        console.warn('Login audit log recording skipped:', logErr);
      }

      if (matchedDoc.status === 'pending') {
        setStatusMsg({
          text: '현재 관리자(교사)의 가입 승인을 기다리고 있습니다. 교사가 승인하면 자동으로 입장됩니다.',
          type: 'warn',
        });
      } else if (matchedDoc.status === 'rejected') {
        setStatusMsg({
          text: '가입 신청이 반려되었습니다. 담당 교사에게 문의해 주세요.',
          type: 'warn',
        });
      }
    } catch {
      setStatusMsg({
        text: '학생 정보 조회 중 오류가 발생했습니다.',
        type: 'warn',
      });
    } finally {
      setLoading(false);
    }
  };

  // 기존 가입자: 비밀번호 사용이 켜진 뒤 처음 로그인하면 비밀번호를 먼저 설정
  const handleSetupPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingDoc) return;
    const check = validateStudentPassword(setupPassword);
    if (!check.ok) {
      setStatusMsg({ text: check.error || '비밀번호 형식을 확인해 주세요.', type: 'warn' });
      return;
    }
    if (setupPassword !== setupPasswordConfirm) {
      setStatusMsg({ text: '비밀번호 확인이 일치하지 않습니다. 다시 입력해 주세요.', type: 'warn' });
      return;
    }
    setSetupBusy(true);
    try {
      await setInitialStudentPassword(pendingDoc.studentKey, setupPassword);
      setSetupPassword('');
      setSetupPasswordConfirm('');
      setStatusMsg({
        text:
          pendingDoc.status === 'approved'
            ? '비밀번호가 설정되었습니다. 활동지 화면으로 이동합니다. 다음부터는 로그인할 때 이 비밀번호를 입력하세요.'
            : '비밀번호가 설정되었습니다. 선생님 승인 후 활동지가 열립니다.',
        type: 'good',
      });
    } catch (err) {
      console.error('Initial password setup failed:', err);
      setStatusMsg({
        text: '비밀번호 저장에 실패했습니다. 네트워크를 확인한 뒤 다시 시도하거나, 이미 비밀번호가 있다면 선생님께 초기화를 요청하세요.',
        type: 'warn',
      });
    } finally {
      setSetupBusy(false);
    }
  };

  const handleGoogleTeacherLogin = async () => {
    setStatusMsg(null);
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const user = res.user;
      if (!isAuthorizedAdminEmail(user.email, user.emailVerified)) {
        await signOut(auth);
        setStatusMsg({
          text: `접근 거부: 교사(관리자) 모드는 지정된 유일 관리자 계정(${ADMIN_TEACHER_EMAIL})으로만 로그인할 수 있습니다. (현재 시도 계정: ${
            user.email || '알 수 없음'
          })`,
          type: 'warn',
        });
        setLoading(false);
        return;
      }
      onAdminTeacherLogin();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = err instanceof Error ? err.message : '로그인 취소 또는 오류';
      if (code === 'auth/unauthorized-domain') {
        setStatusMsg({
          text: `도메인 승인 필요: 현재 호스팅 도메인(${window.location.hostname})에서 Google 로그인을 사용하려면 Firebase 콘솔(Authentication → Settings → Authorized domains)에 '${window.location.hostname}' 도메인을 추가해 주세요.`,
          type: 'warn',
        });
      } else {
        setStatusMsg({
          text: `Google 인증 안내 (${ADMIN_TEACHER_EMAIL} 전용): ${msg}`,
          type: 'warn',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const pwdValidation = validateStudentPassword(form.password || '');

  return (
    <div className="mx-auto max-w-3xl py-2 sm:py-6">
      {/* Mode Switcher: Student Mode vs Teacher Admin Mode */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 rounded-2xl border border-slate-200/80 bg-slate-100/90 p-1.5">
        <button
          type="button"
          onClick={() => {
            setPortalMode('student');
            setStatusMsg(null);
          }}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-2.5 sm:py-3 px-2 sm:px-4 text-xs sm:text-base font-bold transition-all text-center ${
            portalMode === 'student'
              ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="h-4 w-4 shrink-0" />
          <span>학생 모드 (입장 · 가입 신청)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setPortalMode('teacher');
            setStatusMsg(null);
          }}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-2.5 sm:py-3 px-2 sm:px-4 text-xs sm:text-base font-bold transition-all text-center ${
            portalMode === 'teacher'
              ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>교사(관리자) 모드</span>
        </button>
      </div>

      {statusMsg && (
        <div
          role="status"
          className={`mt-4 flex items-start gap-2.5 rounded-xl border p-4 text-sm font-semibold ${
            statusMsg.type === 'good'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {statusMsg.type === 'good' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {portalMode === 'student' ? (
        <div className="mt-5 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
          {/* 비밀번호 사용이 켜졌는데 아직 비밀번호가 없는 기존 가입자: 먼저 비밀번호 설정 */}
          {pendingDoc && pendingDoc.status !== 'rejected' && needsPasswordSetup(passwordOn, pendingDoc) && (
            <form
              onSubmit={handleSetupPasswordSubmit}
              className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5"
              aria-label="비밀번호 설정"
            >
              <div className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
                <KeyRound className="h-4 w-4" />
                비밀번호를 먼저 설정해 주세요
              </div>
              <p className="mt-2 text-xs leading-relaxed text-amber-900">
                <strong>
                  {pendingDoc.school} {pendingDoc.grade}학년 {pendingDoc.classNum}반 {pendingDoc.studentNum}번 {pendingDoc.name}
                </strong>{' '}
                학생, 이제부터 로그인할 때 비밀번호가 필요합니다. 활동지를 열기 전에 비밀번호를 만들어 주세요.
                (대문자·소문자·숫자·특수문자를 모두 포함한 8~32자리)
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={32}
                  required
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="새 비밀번호"
                  className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm"
                  aria-label="새 비밀번호"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={32}
                  required
                  value={setupPasswordConfirm}
                  onChange={(e) => setSetupPasswordConfirm(e.target.value)}
                  placeholder="새 비밀번호 확인"
                  className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm"
                  aria-label="새 비밀번호 확인"
                />
              </div>
              <button
                type="submit"
                disabled={setupBusy}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-60"
              >
                {setupBusy ? '저장 중…' : '비밀번호 설정하고 계속하기'}
              </button>
            </form>
          )}

          {/* If student has an active pending/rejected registration on this device, show live status card */}
          {pendingDoc && pendingDoc.status !== 'approved' && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/70 p-5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
                  <Clock className="h-4 w-4 text-amber-600" />
                  {pendingDoc.status === 'pending'
                    ? '관리자(교사) 가입 승인 대기 중'
                    : '가입 신청 반려됨'}
                </div>
                <span className="text-xs font-bold text-amber-800">
                  {pendingDoc.status === 'pending' ? '실시간 승인 연동 중' : '반려됨'}
                </span>
              </div>
              <div className="mt-3 text-sm text-slate-800 space-y-1">
                <div>
                  <strong>신청 학생:</strong> {pendingDoc.school} {pendingDoc.grade}학년{' '}
                  {pendingDoc.classNum}반 {pendingDoc.studentNum}번 <strong>{pendingDoc.name}</strong> (생년월일: {pendingDoc.birthDate})
                </div>
                <div className="text-xs text-slate-500 mono">
                  등록 기기 MAC 주소 식별자: {formatDeviceHashAsMac(pendingDoc.deviceHash)}
                </div>
              </div>
              <p className="mt-3 text-xs sm:text-sm text-amber-900/90">
                선생님(관리자)이 교사 모드에서 <strong>[가입 승인]</strong>을 누르면 새로고침 없이 즉시 소인수분해 활동지 화면이 열립니다.
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.removeItem(SAVED_STUDENT_KEY_STORAGE);
                    } catch {}
                    setActiveStudentKey('');
                    setPendingDoc(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  다른 학적 정보로 조회 / 전환
                </button>
              </div>
            </div>
          )}

          {/* Student Sub-tabs: Login vs Sign-up Request */}
          <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-5 mb-6">
            <button
              type="button"
              onClick={() => {
                setStudentSubTab('login');
                setStatusMsg(null);
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors whitespace-nowrap ${
                studentSubTab === 'login'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <LogIn className="h-4 w-4" />
              승인된 학생 입장 (로그인)
            </button>

            <button
              type="button"
              onClick={() => {
                setStudentSubTab('register');
                setStatusMsg(null);
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors whitespace-nowrap ${
                studentSubTab === 'register'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              학생 신규 가입 신청
            </button>
          </div>

          <div className="mb-6">
            <div className="text-xs font-extrabold text-blue-600 mb-1">이하연 수학 교실 · 소인수분해 탐구 (통합 계정 연동)</div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {studentSubTab === 'login'
                ? '학생 입장하기'
                : '학생 신규 가입 신청'}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
              {studentSubTab === 'login'
                ? '이 수업 또는 선생님의 다른 수학 수업 사이트에서 이미 가입·승인된 학생은 다시 가입할 필요 없이 학적 정보로 바로 입장할 수 있습니다.'
                : '이미 승인된 학생은 [승인된 학생 입장] 탭을 이용해 주세요. 처음 이용하는 학생만 가입을 신청하세요.'}
            </p>
          </div>

          <form
            onSubmit={studentSubTab === 'login' ? handleStudentLoginSubmit : handleRegisterSubmit}
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="stu-school" className="block text-sm font-bold text-slate-800 mb-1.5">
                  학교 이름
                </label>
                <input
                  id="stu-school"
                  type="text"
                  required
                  maxLength={40}
                  value={form.school}
                  onChange={(e) => setForm((p) => ({ ...p, school: e.target.value }))}
                  placeholder="예: ○○중학교"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label htmlFor="stu-name" className="block text-sm font-bold text-slate-800 mb-1.5">
                  학생 이름
                </label>
                <input
                  id="stu-name"
                  type="text"
                  required
                  maxLength={25}
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="예: 홍길동"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3.5">
              <div>
                <label htmlFor="stu-grade" className="block text-sm font-bold text-slate-800 mb-1.5">
                  학년
                </label>
                <select
                  id="stu-grade"
                  value={form.grade}
                  onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white px-3 py-2.5 text-base mono font-semibold text-slate-900"
                >
                  {[1, 2, 3, 4, 5, 6].map((g) => (
                    <option key={g} value={String(g)}>
                      {g}학년
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="stu-class" className="block text-sm font-bold text-slate-800 mb-1.5">
                  반
                </label>
                <input
                  id="stu-class"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={5}
                  value={form.classNum}
                  onChange={(e) => setForm((p) => ({ ...p, classNum: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder="예: 9"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white px-3.5 py-2.5 text-base mono font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400"
                />
              </div>

              <div>
                <label htmlFor="stu-num" className="block text-sm font-bold text-slate-800 mb-1.5">
                  번호
                </label>
                <input
                  id="stu-num"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={5}
                  value={form.studentNum}
                  onChange={(e) => setForm((p) => ({ ...p, studentNum: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder="예: 15"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white px-3.5 py-2.5 text-base mono font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="stu-birth" className="block text-sm font-bold text-slate-800 mb-1.5">
                생년월일 (8자리 또는 6자리)
              </label>
              <input
                id="stu-birth"
                type="text"
                inputMode="numeric"
                required
                maxLength={12}
                value={form.birthDate}
                onChange={(e) => setForm((p) => ({ ...p, birthDate: e.target.value }))}
                placeholder="예: 20100212 또는 100212"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white px-3.5 py-2.5 text-base mono font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400"
              />
            </div>

            {/* Password Input Field (Created per requirement: Upper, Lower, Number, Special, 8~32 chars — Currently in Disabled Mode) */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label
                  htmlFor="stu-password"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700"
                >
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  비밀번호 (대문자·소문자·숫자·특수문자 포함 8~32자리)
                </label>
                <span className="text-xs font-semibold text-slate-500">
                  {passwordOn ? '사용 중 (가입 시 필수 · 로그인 시 설정한 학생만)' : '현재 비활성화 모드 (입력 불필요)'}
                </span>
              </div>

              <input
                id="stu-password"
                type="password"
                disabled={!passwordOn}
                minLength={8}
                maxLength={32}
                value={form.password || ''}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder={
                  passwordOn
                    ? '대문자, 소문자, 숫자, 특수문자 포함 8~32자리 입력'
                    : '비활성화 모드 — 비밀번호 입력 없이 학적 정보만으로 신청·입장 가능합니다'
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-600">비밀번호 규격:</span>
                {[
                  ['8~32자리', pwdValidation.checks.length],
                  ['대문자(A-Z)', pwdValidation.checks.upper],
                  ['소문자(a-z)', pwdValidation.checks.lower],
                  ['숫자(0-9)', pwdValidation.checks.digit],
                  ['특수문자(!@# 등)', pwdValidation.checks.special],
                ].map(([ruleLabel, ok], i) => (
                  <React.Fragment key={String(ruleLabel)}>
                    {i > 0 && <span aria-hidden="true" className="text-slate-300">·</span>}
                    <span
                      className={
                        passwordOn && ok
                          ? 'font-bold text-emerald-700'
                          : 'text-slate-500'
                      }
                    >
                      {ruleLabel}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Device / MAC Duplicate Guard Info Box (MAC-only, no IP check) */}
            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600 space-y-1 border border-slate-200/70">
              <div className="font-bold flex items-center gap-1.5 text-slate-800">
                <Fingerprint className="h-4 w-4 text-blue-600" />
                중복 가입 방지용 기기 고유 MAC 주소 식별자 자동 인증
              </div>
              <div className="mono text-xs text-slate-700">
                기기 MAC 주소 식별값: <strong className="text-slate-900">{formatDeviceHashAsMac(netInfo.deviceHash)}</strong>
              </div>
              <p className="text-[11px] text-slate-500">
                * 학교 공용 네트워크(동일 IP) 환경을 고려하여 IP는 검사하지 않으며, 기기 고유 MAC 주소 식별자 및 학번 기준으로만 중복 신청을 방지합니다.
              </p>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-xl bg-blue-600 px-5 py-3 text-base font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
              >
                {loading
                  ? '처리 중...'
                  : studentSubTab === 'login'
                  ? '승인 확인 후 학생 모드 입장하기'
                  : '관리자 승인 요청 및 가입 신청하기'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-start gap-3.5">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-600">
                이하연 수학 교실 · 유일 관리자 전용 인증
              </div>
              <h2 className="mt-0.5 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                교사(관리자) 전용 Google 이메일 인증
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
                교사 모드는 유일한 관리자 이메일 계정(<strong className="mono text-slate-900">{ADMIN_TEACHER_EMAIL}</strong>)으로 Google 인증을 완료한 경우에만 열립니다.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-xs sm:text-sm text-slate-600 space-y-2 border border-slate-200/70">
            <div>
              <strong className="text-slate-900">가입 신청 학생 승인 관리</strong> · 학생이 신청한 학교/학년/반/번호/생년월일/이름과 기기 MAC 주소 식별값 중복 여부를 확인한 후 <strong>[가입 승인]</strong> 또는 <strong>[반려]</strong> 처리합니다.
            </div>
            <div>
              <strong className="text-slate-900">실시간 기록실 연동</strong> · 승인된 학생들이 작성하는 차시별 소인수분해 탐구 답안과 루브릭 평정, 피드백 PDF 인쇄, CSV 내려받기를 통합 관리합니다.
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleTeacherLogin}
            className="w-full min-h-[50px] inline-flex items-center justify-center gap-2.5 rounded-xl bg-slate-900 px-6 py-3.5 text-base font-bold text-white hover:bg-slate-800 transition-colors"
          >
            <ShieldCheck className="h-5 w-5 text-sky-400" />
            {loading
              ? 'Google 계정 확인 중...'
              : `Google 계정(${ADMIN_TEACHER_EMAIL})으로 관리자 인증하기`}
          </button>
        </div>
      )}
    </div>
  );
};
