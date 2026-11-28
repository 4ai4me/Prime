import React, { useEffect, useState } from 'react';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { ADMIN_TEACHER_EMAIL, isAuthorizedAdminEmail } from '../utils/authLogic';
import { createInitialStudentState, initialWorksheetJson } from '../utils/studentRecord';
import { ShieldCheck, UserCheck, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { StudentRegistrationDoc } from '../utils/studentAccount';
import { StudentPortal } from './StudentPortal';

/** 학생 가입 문서 (2026-11-28~ 가상 정보 방식). 예전 이름을 그대로 두어 다른 파일의 import를 유지 */
export type FirestoreStudentRegistrationDoc = StudentRegistrationDoc;

interface AuthGateViewProps {
  currentUser: User | null;
  onStudentApprovedLogin: (regDoc: FirestoreStudentRegistrationDoc) => void;
  onAdminTeacherLogin: () => void;
}

/** 이 사이트의 첫 활동지 (가입 문서의 worksheetJson — 답안은 prime_lessons 차시 문서에 저장) */
function buildInitialWorksheetJson(identity: { groupLabel: string; codeLabel: string }): string {
  const initial = createInitialStudentState();
  initial.group = identity.groupLabel.slice(0, 25);
  initial.code = identity.codeLabel.slice(0, 25);
  return initialWorksheetJson(initial);
}

export const AuthGateView: React.FC<AuthGateViewProps> = ({
  currentUser,
  onStudentApprovedLogin,
  onAdminTeacherLogin,
}) => {
  const [portalMode, setPortalMode] = useState<'student' | 'teacher'>('student');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'good' | 'warn' } | null>(null);

  // If teacher is already logged in with authorized email
  useEffect(() => {
    if (currentUser && isAuthorizedAdminEmail(currentUser.email, currentUser.emailVerified)) {
      if (portalMode === 'teacher') {
        onAdminTeacherLogin();
      }
    }
  }, [currentUser, portalMode, onAdminTeacherLogin]);

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
        <StudentPortal
          siteLabel="이하연 수학 교실 · 소인수분해 탐구"
          worksheetName="소인수분해 활동지"
          buildInitialWorksheetJson={buildInitialWorksheetJson}
          onApproved={onStudentApprovedLogin}
        />
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
              <strong className="text-slate-900">가입 신청 학생 승인 관리</strong> · 교실에서 학생 얼굴과 화면의 가상 이름(년도·학년·반)을 확인한 후 <strong>[가입 승인]</strong> 또는 <strong>[반려]</strong> 처리합니다.
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
