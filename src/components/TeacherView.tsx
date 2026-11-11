import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  StudentLessonSnapshot,
  assembleRecord,
  listenAllStudentLessons,
  saveTeacherEvaluation,
  teacherJson,
} from '../utils/lessonStore';
import {
  StudentRecord,
  EVAL_CRITERIA,
  EVAL_DESCRIPTIONS,
  EVAL_SCORE_LABELS,
  createInitialStudentState,
  csvSafe,
  ensureTeacherEval,
  getTeacherEvaluationProgress,
  lessonKeyOf,
  studentKey,
} from '../utils/studentRecord';
import {
  ALL_LESSON_NUMBERS,
  LESSON_ACCESS_PRESETS,
  LESSON_TAB_METADATA,
  createLessonAccessPreset,
  type LessonAccessConfig,
  type LessonAccessPreset,
  type LessonTabNumber,
} from '../utils/lessonAccess';
import { formatDeviceHashAsMac } from '../utils/authLogic';
import {
  classKeyLabel,
  collectClassKeys,
  compareClassKeys,
  makeClassKey,
  type ClassLessonAccessMap,
} from '../utils/classLessonAccess';
import { codeLabelOf, groupLabelOf } from '../utils/studentDraft';
import { ACCESS_TARGET_ALL, ClassLessonAccessPanel } from './ClassLessonAccessPanel';
import { FirestoreStudentRegistrationDoc } from './AuthGateView';
import {
  Download,
  Printer,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  UserCheck,
  Fingerprint,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  AlertCircle,
  Activity,
  Sun,
  Moon,
  LogIn,
  UserPlus,
  Save,
  Lock,
  Unlock,
  KeyRound,
  FileText,
} from 'lucide-react';
import { StudentAccessLog } from '../utils/auditLogger';
import { AnswerText } from './AnswerText';
import {
  hasStudentPassword,
  resetStudentPassword,
  saveStudentAuthPolicy,
  useStudentAuthPolicy,
} from '../utils/studentPassword';
import { TeacherSaveBar, TeacherSaveStatus, serializeRuns } from './TeacherSaveBar';
import { getCurriculumLesson } from '../lessons/curriculum';
import { LESSON_PROGRESS_LABEL, isLessonReady } from '../lessons';
import { lessonAnswerRows } from '../lessons/answerLabels';
import { LESSON_CHIP_CLASS, buildRecordsCsv, recordLessonProgress } from '../utils/teacherRecords';

/**
 * 교사용 기록실 (Func 저장소의 TeacherView를 소인수분해 6차시용으로 옮긴 것)
 * - 차시 잠금(전체·반별), 가입 승인·비밀번호, 접속 기록: Func와 같은 화면
 * - 학생 기록 표·상세 평가: 차시 내용과 상관없이 동작하도록 새로 만듦
 *   (문항 이름은 src/lessons/answerLabels.ts, 차시 진행은 src/lessons/index.tsx)
 */

/** 교사 평가 입력을 모아서 저장하는 대기 시간 */
const TEACHER_SAVE_DELAY_MS = 1500;

interface TeacherViewProps {
  adminEmail: string;
  records: StudentRecord[];
  selectedKey: string;
  onSelectStudent: (key: string) => void;
  onUpdateRecords: React.Dispatch<React.SetStateAction<StudentRecord[]>>;
  onPrintStudentReport: (student: StudentRecord) => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
  lessonAccess: LessonAccessConfig;
  lessonAccessSyncStatus?: 'checking' | 'saving' | 'synced' | 'local_only' | 'error';
  lessonAccessLastSyncedAt?: Date | null;
  onUpdateLessonAccess: (nextConfig: LessonAccessConfig, reasonLabel?: string) => Promise<boolean> | void;
  onForceSyncLessonAccessToServer?: () => Promise<boolean> | void;
  onRefreshLessonAccessFromServer?: () => Promise<void> | void;
  classLessonAccess?: ClassLessonAccessMap;
  classLessonAccessSyncStatus?: 'checking' | 'saving' | 'synced' | 'error';
  classLessonAccessError?: string | null;
  onUpdateClassLessonAccess?: (
    classKey: string,
    config: LessonAccessConfig | null,
    reasonLabel?: string
  ) => Promise<boolean>;
}

const EMPTY_CLASS_LESSON_ACCESS: ClassLessonAccessMap = {};

export const TeacherView: React.FC<TeacherViewProps> = ({
  adminEmail,
  records,
  selectedKey,
  onSelectStudent,
  onUpdateRecords,
  onPrintStudentReport,
  onRequestConfirm,
  lessonAccess,
  lessonAccessSyncStatus = 'synced',
  lessonAccessLastSyncedAt = null,
  onUpdateLessonAccess,
  onForceSyncLessonAccessToServer,
  onRefreshLessonAccessFromServer,
  classLessonAccess = EMPTY_CLASS_LESSON_ACCESS,
  classLessonAccessSyncStatus = 'synced',
  classLessonAccessError = null,
  onUpdateClassLessonAccess,
}) => {
  const detailRef = useRef<HTMLDivElement | null>(null);

  const [cloudRegistrations, setCloudRegistrations] = useState<FirestoreStudentRegistrationDoc[]>([]);
  // 학생 비밀번호 사용 설정 (Func·Props와 공용)
  const studentAuthPolicy = useStudentAuthPolicy();
  const passwordSetCount = cloudRegistrations.filter((r) => hasStudentPassword(r)).length;
  // 학생별 차시 문서(student_registrations/{studentKey}/prime_lessons/*)
  const [lessonDocsByStudent, setLessonDocsByStudent] = useState<Map<string, StudentLessonSnapshot>>(() => new Map());
  // 교사 평가 저장 대기 (학생 문서 키 → 저장할 기록). 입력할 때마다 저장하지 않고 잠시 모아서 저장
  const pendingTeacherSavesRef = useRef<Map<string, StudentRecord>>(new Map());
  const teacherSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTeacherJsonRef = useRef<Map<string, string>>(new Map());
  const teacherSaveFailedRef = useRef<Set<string>>(new Set());
  const [teacherSaveStatus, setTeacherSaveStatus] = useState<Record<string, TeacherSaveStatus>>({});
  const setSaveStatus = useCallback(
    (regKey: string, next: (prev: TeacherSaveStatus | undefined) => TeacherSaveStatus) => {
      setTeacherSaveStatus((all) => ({ ...all, [regKey]: next(all[regKey]) }));
    },
    []
  );
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [notice, setNotice] = useState<{ text: string; type: 'good' | 'warn' | 'info' }>({
    text: '학생 가입 신청 내역과 승인된 학생들의 탐구 답안이 실시간으로 동기화됩니다.',
    type: 'info',
  });

  const [isLessonAccessOpen, setIsLessonAccessOpen] = useState(true);
  const [isApprovalOpen, setIsApprovalOpen] = useState(true);
  const [isRecordsOpen, setIsRecordsOpen] = useState(true);
  const [approvalSearchName, setApprovalSearchName] = useState('');
  const [recordsSearchName, setRecordsSearchName] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterEvalStatus, setFilterEvalStatus] = useState<'all' | 'complete' | 'partial' | 'none'>('all');

  const [accessLogs, setAccessLogs] = useState<StudentAccessLog[]>([]);
  const [isAccessLogsOpen, setIsAccessLogsOpen] = useState<boolean>(true);
  const [accessTimeFilter, setAccessTimeFilter] = useState<'all' | 'today' | 'morning' | 'afternoon'>('all');
  const [accessEventFilter, setAccessEventFilter] = useState<'all' | 'login' | 'register' | 'save' | 'resume'>('all');
  const [accessSearch, setAccessSearch] = useState<string>('');

  const applySnapshotDocs = useCallback((docs: FirestoreStudentRegistrationDoc[]) => {
    setCloudRegistrations(docs);
  }, []);

  // 승인된 가입 문서 + Prime 차시 문서 + 교사 평가 문서를 합쳐 교사 화면의 학생 기록을 만듭니다.
  useEffect(() => {
    const approved: { regKey: string; record: StudentRecord }[] = [];
    for (const data of cloudRegistrations) {
      if (data.status !== 'approved') continue;
      try {
        const base = createInitialStudentState();
        base.group = groupLabelOf(data);
        base.code = codeLabelOf(data);
        const lessonSnap = lessonDocsByStudent.get(data.studentKey) || { lessons: {} };
        approved.push({ regKey: data.studentKey, record: assembleRecord(base, lessonSnap) });
      } catch (err) {
        console.warn(`Skipping malformed record for ${data.studentKey}:`, err);
      }
    }
    if (approved.length === 0) return;

    onUpdateRecords((prevRecords) => {
      const merged = [...prevRecords];
      for (const { regKey, record: cw } of approved) {
        const k = studentKey(cw);
        const idx = merged.findIndex((item) => studentKey(item) === k);
        if (idx >= 0) {
          const old = merged[idx];
          if (pendingTeacherSavesRef.current.has(regKey)) {
            // 아직 서버로 보내지 않은 교사 입력이 있으면 화면의 평가를 유지 (입력 중 덮어쓰기 방지)
            cw.teacherMemo = old.teacherMemo;
            cw.evaluation = old.evaluation;
          } else {
            cw.teacherMemo = cw.teacherMemo || old.teacherMemo || '';
            cw.evaluation = cw.evaluation || old.evaluation;
          }
          merged[idx] = cw;
        } else {
          merged.push(cw);
        }
      }
      return merged;
    });
  }, [cloudRegistrations, lessonDocsByStudent, onUpdateRecords]);

  // 모든 학생의 Prime 차시 문서 실시간 수신
  useEffect(() => {
    const unsub = listenAllStudentLessons(
      (byStudent) => setLessonDocsByStudent(byStudent),
      (error) => {
        console.error('Lesson documents listener error:', error);
        setNotice({
          text: `학생 차시 기록 실시간 동기화 확인 필요: ${error instanceof Error ? error.message : String(error)}`,
          type: 'warn',
        });
      }
    );
    return () => unsub();
  }, []);

  // 대기 중인 교사 평가를 서버에 저장 (입력 후 자동 저장, [저장] 버튼, 화면 떠날 때 공용)
  const runTeacherFlush = useCallback(async () => {
    if (teacherSaveTimerRef.current) {
      clearTimeout(teacherSaveTimerRef.current);
      teacherSaveTimerRef.current = null;
    }
    const pending = Array.from(pendingTeacherSavesRef.current.entries());
    for (const [regKey, record] of pending) {
      const json = teacherJson(record);
      if (lastSavedTeacherJsonRef.current.get(regKey) === json) {
        pendingTeacherSavesRef.current.delete(regKey);
        setSaveStatus(regKey, (prev) => ({ state: 'saved', savedAt: prev?.savedAt ?? Date.now() }));
        continue;
      }
      setSaveStatus(regKey, (prev) => ({ ...prev, state: 'saving' }));
      try {
        await saveTeacherEvaluation(regKey, record);
        lastSavedTeacherJsonRef.current.set(regKey, json);
        if (pendingTeacherSavesRef.current.get(regKey) === record) {
          pendingTeacherSavesRef.current.delete(regKey);
          setSaveStatus(regKey, () => ({ state: 'saved', savedAt: Date.now() }));
        } else {
          setSaveStatus(regKey, () => ({ state: 'dirty', savedAt: Date.now() }));
        }
        if (teacherSaveFailedRef.current.delete(regKey)) {
          setNotice({ text: '평가 저장 완료: 앞서 실패했던 평가·피드백을 서버에 저장했습니다.', type: 'good' });
        }
      } catch (err) {
        console.error(`Teacher evaluation save failed for ${regKey}:`, err);
        setSaveStatus(regKey, (prev) => ({ ...prev, state: 'error' }));
        teacherSaveFailedRef.current.add(regKey);
        setNotice({
          text: `평가 저장 실패: 네트워크 상태를 확인해 주세요. 입력한 내용은 이 화면에 남아 있으며 [저장] 버튼이나 다음 입력 때 다시 저장을 시도합니다. (${
            err instanceof Error ? err.message : String(err)
          })`,
          type: 'warn',
        });
      }
    }
  }, [setSaveStatus]);

  // 저장이 진행 중일 때 또 불리면 겹쳐 보내지 않고, 끝난 뒤 한 번 더 확인
  const flushTeacherSaves = useMemo(() => serializeRuns(runTeacherFlush), [runTeacherFlush]);

  // 화면을 떠나거나 창을 전환할 때 대기 중인 평가를 바로 저장
  useEffect(() => {
    const flushNow = () => {
      void flushTeacherSaves();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', handleVisibility);
      flushNow();
    };
  }, [flushTeacherSaves]);

  const handleManualRefreshRegistrations = useCallback(async () => {
    try {
      const q = query(collection(db, 'student_registrations'), where('status', 'in', ['pending', 'approved', 'rejected']));
      const snap = await getDocs(q);
      const docs: FirestoreStudentRegistrationDoc[] = [];
      snap.forEach((d) => {
        docs.push(d.data() as FirestoreStudentRegistrationDoc);
      });
      applySnapshotDocs(docs);
      setNotice({ text: `학생 가입 신청 목록을 새로고침했습니다. (현재 총 ${docs.length}명)`, type: 'good' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '조회 오류';
      setNotice({ text: `가입 신청 목록 조회 중 오류: ${msg}`, type: 'warn' });
    }
  }, [applySnapshotDocs]);

  // 가입 신청 실시간 수신
  useEffect(() => {
    const q = query(collection(db, 'student_registrations'), where('status', 'in', ['pending', 'approved', 'rejected']));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: FirestoreStudentRegistrationDoc[] = [];
        snap.forEach((d) => {
          docs.push(d.data() as FirestoreStudentRegistrationDoc);
        });
        applySnapshotDocs(docs);
      },
      (error) => {
        console.error('Admin registration listener error:', error);
        setNotice({ text: `실시간 가입 목록 동기화 확인 필요: ${error.message}`, type: 'warn' });
      }
    );
    return () => unsub();
  }, [applySnapshotDocs, adminEmail]);

  // 접속 기록 실시간 수신
  useEffect(() => {
    const qLogs = query(
      collection(db, 'student_access_logs'),
      where('status', 'in', ['pending', 'approved', 'rejected', 'teacher'])
    );
    const unsub = onSnapshot(
      qLogs,
      (snap) => {
        const list: StudentAccessLog[] = [];
        snap.forEach((d) => {
          list.push(d.data() as StudentAccessLog);
        });
        const parseTime = (val: unknown): number => {
          if (!val) return 0;
          if (typeof (val as { toMillis?: () => number }).toMillis === 'function') {
            return (val as { toMillis: () => number }).toMillis();
          }
          if (val instanceof Date) return val.getTime();
          const parsed = new Date(String(val)).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };
        list.sort((a, b) => parseTime(b.createdAt) - parseTime(a.createdAt));
        setAccessLogs(list);
      },
      (error) => {
        console.error('Access logs listener error:', error);
      }
    );
    return () => unsub();
  }, []);

  const handleUpdateStudentStatus = async (
    reg: FirestoreStudentRegistrationDoc,
    nextStatus: 'approved' | 'rejected' | 'pending'
  ) => {
    const ref = doc(db, 'student_registrations', reg.studentKey);
    try {
      await updateDoc(ref, {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setNotice({
        text: `${reg.school} ${reg.grade}학년 ${reg.classNum}반 ${reg.studentNum}번 ${reg.name} 학생을 [${
          nextStatus === 'approved' ? '가입 승인' : nextStatus === 'rejected' ? '반려' : '대기'
        }] 처리했습니다.`,
        type: nextStatus === 'approved' ? 'good' : 'info',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `student_registrations/${reg.studentKey}`);
    }
  };

  const handleBulkApprovePending = async () => {
    const pendings = cloudRegistrations.filter((r) => r.status === 'pending');
    if (!pendings.length) return;
    try {
      for (const reg of pendings) {
        await updateDoc(doc(db, 'student_registrations', reg.studentKey), {
          status: 'approved',
          updatedAt: serverTimestamp(),
        });
      }
      setNotice({
        text: `승인 대기 중이던 학생 ${pendings.length}명을 일괄 승인 처리했습니다.`,
        type: 'good',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'student_registrations');
    }
  };

  // ------------------------------------------------------------------
  // 학생 비밀번호 관리 (사용 설정 · 초기화)
  // ------------------------------------------------------------------
  const handleToggleStudentPassword = (nextOn: boolean) => {
    onRequestConfirm(
      nextOn ? '학생 비밀번호 사용 켜기' : '학생 비밀번호 사용 끄기',
      nextOn
        ? '켜면 ① 새로 가입하는 학생은 비밀번호를 반드시 입력하고, ② 비밀번호가 없는 기존 가입 학생은 다음 로그인 때 비밀번호를 먼저 설정해야 활동지가 열리며, ③ 비밀번호를 설정한 학생은 다른 기기에서 로그인할 때 비밀번호가 필요합니다. 이 설정은 함수(Func)·명제(Props)·소인수분해(Prime) 사이트에 함께 적용됩니다. 켤까요?'
        : '끄면 새로 가입하는 학생은 비밀번호 없이 가입하고, 비밀번호가 없는 학생에게 설정을 요구하지 않습니다. 이미 비밀번호를 설정한 학생은 보안을 위해 로그인할 때 계속 비밀번호가 필요합니다 (필요하면 학생별로 초기화하세요). 끌까요?',
      async () => {
        try {
          await saveStudentAuthPolicy(nextOn, adminEmail);
          setNotice({
            text: nextOn ? '학생 비밀번호 사용을 켰습니다.' : '학생 비밀번호 사용을 껐습니다.',
            type: 'good',
          });
        } catch (err) {
          console.error('Failed to save student password policy:', err);
          setNotice({
            text: `비밀번호 사용 설정 저장 실패: ${err instanceof Error ? err.message : String(err)} (교사 Google 로그인 상태와 보안 규칙 게시 여부를 확인해 주세요)`,
            type: 'warn',
          });
        }
      }
    );
  };

  const handleResetStudentPassword = (reg: FirestoreStudentRegistrationDoc) => {
    onRequestConfirm(
      '학생 비밀번호 초기화',
      `${reg.school} ${reg.grade}-${reg.classNum}-${reg.studentNum} ${reg.name} 학생의 비밀번호를 초기화할까요? 학생은 다음 로그인 때 이름·생년월일로 입장한 뒤 새 비밀번호를 설정하게 됩니다. (활동지 내용은 그대로 유지됩니다)`,
      async () => {
        try {
          await resetStudentPassword(reg.studentKey);
          setNotice({ text: `${reg.name} 학생의 비밀번호를 초기화했습니다.`, type: 'good' });
        } catch (err) {
          console.error(`Password reset failed for ${reg.studentKey}:`, err);
          setNotice({
            text: `비밀번호 초기화 실패: ${err instanceof Error ? err.message : String(err)}`,
            type: 'warn',
          });
        }
      }
    );
  };

  const handleDeleteStudentRegistration = (reg: FirestoreStudentRegistrationDoc) => {
    onRequestConfirm(
      '가입 신청 및 기기 잠금 삭제',
      `${reg.school} ${reg.grade}-${reg.classNum}-${reg.studentNum} ${reg.name} 학생의 가입 기록과 기기 중복 방지 잠금(MAC ${formatDeviceHashAsMac(
        reg.deviceHash
      )})을 모두 삭제할까요?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'student_registrations', reg.studentKey));
          await deleteDoc(doc(db, 'device_locks', reg.deviceHash));
          setNotice({
            text: `${reg.name} 학생의 가입 기록 및 기기 잠금이 해제되었습니다.`,
            type: 'info',
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `student_registrations/${reg.studentKey}`);
        }
      }
    );
  };

  // Detect duplicate MAC address (deviceHash) across registrations for teacher warning badge
  const deviceCounts: Record<string, number> = {};
  for (const r of cloudRegistrations) {
    if (r.deviceHash) deviceCounts[r.deviceHash] = (deviceCounts[r.deviceHash] || 0) + 1;
  }

  const pendingCount = cloudRegistrations.filter((r) => r.status === 'pending').length;
  const approvedCount = cloudRegistrations.filter((r) => r.status === 'approved').length;
  const rejectedCount = cloudRegistrations.filter((r) => r.status === 'rejected').length;

  const filteredRegistrations = cloudRegistrations
    .filter((r) => {
      if (approvalFilter !== 'all' && r.status !== approvalFilter) return false;
      if (approvalSearchName.trim()) {
        const q = approvalSearchName.trim().toLowerCase();
        const matchName = (r.name || '').toLowerCase().includes(q);
        const matchCode = `${r.grade}${r.classNum}${r.studentNum}`.includes(q);
        const matchSchool = (r.school || '').toLowerCase().includes(q);
        return matchName || matchCode || matchSchool;
      }
      return true;
    })
    .slice()
    .sort((a, b) => {
      const gDiff = (parseInt(a.grade, 10) || 0) - (parseInt(b.grade, 10) || 0);
      if (gDiff !== 0) return gDiff;
      const cDiff = (parseInt(a.classNum, 10) || 0) - (parseInt(b.classNum, 10) || 0);
      if (cDiff !== 0) return cDiff;
      const nDiff = (parseInt(a.studentNum, 10) || 0) - (parseInt(b.studentNum, 10) || 0);
      if (nDiff !== 0) return nDiff;
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });

  const parseLogDate = (val: unknown): Date | null => {
    if (!val) return null;
    if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate();
    }
    if (val instanceof Date) return val;
    const d = new Date(String(val));
    return isNaN(d.getTime()) ? null : d;
  };

  const formatLogTimestamp = (val: unknown): string => {
    const d = parseLogDate(val);
    if (!d) return '-';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours < 12 ? '오전' : '오후';
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${y}-${m}-${day} ${ampm} ${displayHour}:${mins}:${secs}`;
  };

  const formatEventBadge = (ev: string) => {
    switch (ev) {
      case 'login':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
            <LogIn className="h-3 w-3" /> 로그인
          </span>
        );
      case 'register':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">
            <UserPlus className="h-3 w-3" /> 가입 신청
          </span>
        );
      case 'save':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
            <Save className="h-3 w-3" /> 클라우드 저장
          </span>
        );
      case 'resume':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-bold text-cyan-700 border border-cyan-200">
            <RefreshCw className="h-3 w-3" /> 세션 복귀
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
            {ev}
          </span>
        );
    }
  };

  const todayStr = new Date().toDateString();
  const todayLogs = accessLogs.filter((log) => {
    const d = parseLogDate(log.createdAt);
    return d && d.toDateString() === todayStr;
  });
  const morningLogsCount = todayLogs.filter((log) => {
    const d = parseLogDate(log.createdAt);
    return d && d.getHours() < 12;
  }).length;
  const afternoonLogsCount = todayLogs.filter((log) => {
    const d = parseLogDate(log.createdAt);
    return d && d.getHours() >= 12;
  }).length;
  const uniqueDevicesCount = new Set(accessLogs.map((l) => l.deviceHash)).size;

  const filteredAccessLogs = accessLogs.filter((log) => {
    const d = parseLogDate(log.createdAt);
    if (accessTimeFilter === 'today') {
      if (!d || d.toDateString() !== todayStr) return false;
    } else if (accessTimeFilter === 'morning') {
      if (!d || d.toDateString() !== todayStr || d.getHours() >= 12) return false;
    } else if (accessTimeFilter === 'afternoon') {
      if (!d || d.toDateString() !== todayStr || d.getHours() < 12) return false;
    }

    if (accessEventFilter !== 'all' && log.eventType !== accessEventFilter) {
      return false;
    }

    if (accessSearch.trim()) {
      const q = accessSearch.trim().toLowerCase();
      const match =
        log.name.toLowerCase().includes(q) ||
        log.school.toLowerCase().includes(q) ||
        log.studentKey.toLowerCase().includes(q) ||
        log.ipAddress.toLowerCase().includes(q) ||
        formatDeviceHashAsMac(log.deviceHash).toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  const handleExportAccessLogsCSV = () => {
    if (filteredAccessLogs.length === 0) {
      setNotice({ text: '내보낼 접속 로그가 없습니다.', type: 'warn' });
      return;
    }
    const headers = [
      '접속시각',
      '이벤트구분',
      '승인상태',
      '학교',
      '학년',
      '반',
      '번호',
      '이름',
      '학생식별키',
      '기기MAC식별자',
      'IP주소',
      'UserAgent',
    ];
    const rows = filteredAccessLogs.map((log) => {
      const timeStr = formatLogTimestamp(log.createdAt);
      return [
        csvSafe(timeStr),
        csvSafe(log.eventType),
        csvSafe(log.status),
        csvSafe(log.school),
        csvSafe(log.grade),
        csvSafe(log.classNum),
        csvSafe(log.studentNum),
        csvSafe(log.name),
        csvSafe(log.studentKey),
        csvSafe(formatDeviceHashAsMac(log.deviceHash)),
        csvSafe(log.ipAddress),
        csvSafe(log.userAgent),
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `소인수분해_학생_접속로그_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const enabledLessonCount = ALL_LESSON_NUMBERS.filter((n) => lessonAccess[n]).length;
  const lockedLessonNumbers = ALL_LESSON_NUMBERS.filter((n) => !lessonAccess[n]);

  // 반별 차시 잠금 (2026-11-09~): 차시 카드·일괄 버튼은 '적용 대상'(전체 또는 한 반)에 적용
  const [accessTarget, setAccessTarget] = useState<string>(ACCESS_TARGET_ALL);
  const { lessonClassKeys, studentCountByClass } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of cloudRegistrations) {
      if (r.status !== 'approved') continue;
      const key = makeClassKey(r);
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
    // 학생이 없어도 반별 설정이 남아 있는 반은 보여 줌 (되돌릴 수 있도록)
    const keys = new Set([...collectClassKeys(cloudRegistrations), ...Object.keys(classLessonAccess)]);
    return { lessonClassKeys: Array.from(keys).sort(compareClassKeys), studentCountByClass: counts };
  }, [cloudRegistrations, classLessonAccess]);
  // 고른 반이 목록에서 사라지면(학생 없음 + 반별 설정 되돌림) 전체로 돌아감
  useEffect(() => {
    if (accessTarget !== ACCESS_TARGET_ALL && !lessonClassKeys.includes(accessTarget)) {
      setAccessTarget(ACCESS_TARGET_ALL);
    }
  }, [accessTarget, lessonClassKeys]);
  const isClassTarget = accessTarget !== ACCESS_TARGET_ALL && Boolean(onUpdateClassLessonAccess);
  const targetLessonAccess: LessonAccessConfig =
    isClassTarget && Object.prototype.hasOwnProperty.call(classLessonAccess, accessTarget)
      ? classLessonAccess[accessTarget]
      : lessonAccess;
  const targetEnabledLessonCount = ALL_LESSON_NUMBERS.filter((n) => targetLessonAccess[n]).length;
  const targetPrefix = isClassTarget ? `[${classKeyLabel(accessTarget)}] ` : '';

  // 고른 대상에 저장: 반이면 반별 설정, 아니면 전체 설정
  const saveTargetLessonAccess = async (nextConfig: LessonAccessConfig, label: string) => {
    if (isClassTarget && onUpdateClassLessonAccess) {
      return onUpdateClassLessonAccess(accessTarget, nextConfig, label);
    }
    return onUpdateLessonAccess(nextConfig, label);
  };

  const handleResetClassTarget = async () => {
    if (!isClassTarget || !onUpdateClassLessonAccess) return;
    const ok = await onUpdateClassLessonAccess(accessTarget, null, '전체 설정으로 되돌림');
    setNotice({
      text:
        ok === false
          ? `[반별 차시 잠금] ${classKeyLabel(accessTarget)}을 전체 설정으로 되돌리지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.`
          : `[반별 차시 잠금] ${classKeyLabel(accessTarget)}은 이제 전체 설정을 따릅니다.`,
      type: ok === false ? 'warn' : 'good',
    });
  };

  const handleToggleSingleLesson = async (lessonNum: LessonTabNumber) => {
    const nextVal = !targetLessonAccess[lessonNum];
    const nextConfig: LessonAccessConfig = {
      ...targetLessonAccess,
      [lessonNum]: nextVal,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    };
    const meta = LESSON_TAB_METADATA.find((m) => m.num === lessonNum);
    const label = `${meta ? meta.fullTitle : `${lessonNum}차시`} ${
      nextVal ? '활성화(열림)' : '비활성화(선행 잠금)'
    }`;
    const ok = await saveTargetLessonAccess(nextConfig, label);
    setNotice({
      text:
        ok === false
          ? isClassTarget
            ? `[반별 차시 잠금] ${targetPrefix}${label} — 서버에 저장하지 못해 바뀌지 않았습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.`
            : `[차시 접근 설정] ${label} — 현재 브라우저에는 반영되었으나 서버 동기화 확인이 필요합니다. [서버 저장] 버튼을 눌러주세요.`
          : isClassTarget
          ? `[반별 차시 잠금 저장 완료] ${targetPrefix}${label} — 이 반 학생 화면에만 바로 반영되었습니다.`
          : `[차시 접근 서버 저장 완료] ${label} 설정이 클라우드 서버에 저장되어 반별 설정이 없는 반의 학생 화면에 즉시 반영되었습니다.`,
      type: ok === false ? 'warn' : nextVal ? 'good' : 'info',
    });
  };

  const handleApplyLessonPreset = async (preset: LessonAccessPreset, presetLabel: string) => {
    const nextConfig = createLessonAccessPreset(preset, adminEmail);
    const ok = await saveTargetLessonAccess(nextConfig, presetLabel);
    setNotice({
      text:
        ok === false
          ? isClassTarget
            ? `[반별 차시 잠금] ${targetPrefix}'${presetLabel}' — 서버에 저장하지 못해 바뀌지 않았습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.`
            : `[차시 일괄 설정] '${presetLabel}' — 서버 동기화 확인이 필요합니다. [서버 저장] 버튼을 눌러주세요.`
          : isClassTarget
          ? `[반별 차시 잠금 저장 완료] ${targetPrefix}'${presetLabel}' — 이 반 학생 화면에만 바로 반영되었습니다.`
          : `[차시 일괄 서버 저장 완료] '${presetLabel}' 설정이 클라우드 서버에 저장되어 반별 설정이 없는 반의 학생 화면에 즉시 반영되었습니다.`,
      type: ok === false ? 'warn' : 'good',
    });
  };

  const handleManualServerSaveClick = async () => {
    if (onForceSyncLessonAccessToServer) {
      const ok = await onForceSyncLessonAccessToServer();
      setNotice({
        text:
          ok === false
            ? '차시 잠금 설정 서버 저장 중 오류가 발생했습니다. 네트워크 연결을 확인 후 다시 시도해 주세요.'
            : `현재 차시 활성/잠금 설정(열림 ${enabledLessonCount}개, 잠금 ${lockedLessonNumbers.length}개)이 클라우드 서버에 확실하게 저장되었습니다. 모든 PC와 다른 브라우저에서도 즉시 동일하게 잠금 적용됩니다.`,
        type: ok === false ? 'warn' : 'good',
      });
    } else {
      await onUpdateLessonAccess(
        {
          ...lessonAccess,
          updatedAt: new Date().toISOString(),
          updatedBy: adminEmail,
        },
        '현재 차시 잠금 설정 서버 강제 동기화'
      );
    }
  };

  // ------------------------------------------------------------------
  // 학생 기록 표 · 상세 평가
  // ------------------------------------------------------------------
  const uniqueGroups = Array.from(new Set(records.map((r) => (r.group || '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'ko')
  );
  const isAnyRecordsFilterActive = recordsSearchName.trim() !== '' || filterGroup !== 'all' || filterEvalStatus !== 'all';
  const resetRecordsFilters = () => {
    setRecordsSearchName('');
    setFilterGroup('all');
    setFilterEvalStatus('all');
  };

  const filteredSortedRecords = records
    .filter((x) => {
      if (recordsSearchName.trim()) {
        const q = recordsSearchName.trim().toLowerCase();
        if (!(x.code || '').toLowerCase().includes(q) && !(x.group || '').toLowerCase().includes(q)) return false;
      }
      if (filterGroup !== 'all' && (x.group || '').trim() !== filterGroup) return false;
      if (filterEvalStatus !== 'all' && getTeacherEvaluationProgress(x).status !== filterEvalStatus) return false;
      return true;
    })
    .slice()
    .sort((a, b) => (a.group || '').localeCompare(b.group || '', 'ko') || (a.code || '').localeCompare(b.code || '', 'ko'));

  const selectedStudent = records.find((v) => studentKey(v) === selectedKey) || null;

  // 화면의 학생 기록 키(학급::학번_이름)로 서버 가입 문서를 찾는다
  const findCloudRegistration = (recordKey: string | null) =>
    recordKey ? cloudRegistrations.find((r) => `${groupLabelOf(r)}::${codeLabelOf(r)}` === recordKey) : undefined;
  const selectedRegKey = findCloudRegistration(selectedKey)?.studentKey ?? null;

  const updateSelectedStudent = (updater: (item: StudentRecord) => StudentRecord) => {
    if (!selectedStudent) return;
    const base: StudentRecord = {
      ...selectedStudent,
      evaluation: selectedStudent.evaluation
        ? { ...selectedStudent.evaluation, scores: [...selectedStudent.evaluation.scores] }
        : undefined,
    };
    const updatedItem = updater(base);
    onUpdateRecords((prev) => prev.map((item) => (studentKey(item) === selectedKey ? updatedItem : item)));
    const matchCloud = findCloudRegistration(selectedKey);
    if (matchCloud) {
      // 평가·메모는 교사 전용 문서에만 저장. 1.5초 동안 모아서 저장
      pendingTeacherSavesRef.current.set(matchCloud.studentKey, updatedItem);
      setSaveStatus(matchCloud.studentKey, (prev) => ({ ...prev, state: 'dirty' }));
      if (teacherSaveTimerRef.current) clearTimeout(teacherSaveTimerRef.current);
      teacherSaveTimerRef.current = setTimeout(() => {
        void flushTeacherSaves();
      }, TEACHER_SAVE_DELAY_MS);
    }
  };

  const handleSelectRecord = (key: string) => {
    onSelectStudent(key);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const handleExportCSV = () => {
    if (!filteredSortedRecords.length) {
      setNotice({ text: '내보낼 학생 기록이 없습니다.', type: 'warn' });
      return;
    }
    const blob = new Blob([buildRecordsCsv(filteredSortedRecords)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `소인수분해_1-${ALL_LESSON_NUMBERS.length}차시_학급응답_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const selectedEval = selectedStudent
    ? ensureTeacherEval({
        ...selectedStudent,
        evaluation: selectedStudent.evaluation
          ? { ...selectedStudent.evaluation, scores: [...selectedStudent.evaluation.scores] }
          : undefined,
      })
    : null;

  return (
    <div className="space-y-6">
      <div
        role="status"
        className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-semibold ${
          notice.type === 'good'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : notice.type === 'warn'
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-slate-200 bg-slate-50 text-slate-700'
        }`}
      >
        {notice.text}
      </div>

      {/* SECTION 0: Lesson Access ON/OFF Management (Prevent Jumping Ahead) */}
      <div
        id="teacher-lesson-access-card"
        className="rounded-2xl border border-indigo-200/90 bg-white p-5 sm:p-7 shadow-xs"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsLessonAccessOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              aria-expanded={isLessonAccessOpen}
              aria-label="차시별 학습 활성/잠금 메뉴 접기/펼치기"
            >
              {isLessonAccessOpen ? (
                <>
                  <ChevronUp className="h-4 w-4 text-slate-600" />
                  <span>접기</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 text-slate-600" />
                  <span>펼치기</span>
                </>
              )}
            </button>
            <div>
              <div className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                <span>수업 진도 통제 · 학습자 차시 선행 방지 설정 (클라우드 서버 실시간 연동)</span>
              </div>
              <h2 className="mt-0.5 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                차시별 학습 활성(ON) / 비활성(OFF) 관리
                <span
                  className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${
                    targetEnabledLessonCount === ALL_LESSON_NUMBERS.length
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : targetEnabledLessonCount === 0
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                  }`}
                >
                  {isClassTarget ? `${classKeyLabel(accessTarget)} ` : '현재 '}열림 {targetEnabledLessonCount}개 / 전체 {ALL_LESSON_NUMBERS.length}차시
                </span>
              </h2>
            </div>
          </div>

          {/* 일괄 설정 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {LESSON_ACCESS_PRESETS.map(({ preset, label }) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleApplyLessonPreset(preset, label)}
                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition-colors ${
                  preset === 'allOpen'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                }`}
              >
                {preset === 'allOpen' ? (
                  <Unlock className="h-3.5 w-3.5 text-emerald-600" />
                ) : preset === 'upTo1' ? (
                  <Lock className="h-3.5 w-3.5 text-indigo-600" />
                ) : null}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cloud Server Sync Verification & Explicit Save Action Bar */}
        <div
          id="teacher-lesson-access-sync-bar"
          className={`mt-4 rounded-xl border px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            lessonAccessSyncStatus === 'synced'
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
              : lessonAccessSyncStatus === 'saving' || lessonAccessSyncStatus === 'checking'
              ? 'border-blue-200 bg-blue-50/70 text-blue-950'
              : 'border-amber-300 bg-amber-50/80 text-amber-950'
          }`}
        >
          <div className="space-y-0.5 text-xs sm:text-sm">
            <div className="font-extrabold flex items-center gap-1.5 flex-wrap">
              {lessonAccessSyncStatus === 'synced' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    클라우드 서버 저장 완료 · 모든 PC 및 다른 브라우저(크롬·엣지·사파리·태블릿) 학생 화면에 동일 적용됨
                  </span>
                </>
              ) : lessonAccessSyncStatus === 'saving' || lessonAccessSyncStatus === 'checking' ? (
                <>
                  <RefreshCw className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                  <span>클라우드 서버에 차시 잠금 설정을 동기화하고 있습니다…</span>
                </>
              ) : lessonAccessSyncStatus === 'error' ? (
                <>
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span className="text-rose-700">
                    클라우드 서버에서 차시 잠금 설정을 확인하지 못했습니다 · 인터넷 연결 또는 Firebase 사용량 한도를 확인한 뒤 [서버 상태 확인]을 눌러 주세요 (학생 화면은 마지막으로 받은 설정을 사용합니다)
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    로컬 설정 상태 · 우측 [차시 잠금 설정 서버 저장] 버튼을 누르면 모든 PC·브라우저에 즉시 강제 적용됩니다
                  </span>
                </>
              )}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-600">
              {lockedLessonNumbers.length > 0 ? (
                <span>
                  전체 설정 잠금(OFF) 차시:{' '}
                  <strong className="text-rose-700">
                    {lockedLessonNumbers.map((n) => `${n}차시`).join(', ')}
                  </strong>{' '}
                  (학습자 진입·URL 우회·선행 입력 완전 차단 중)
                </span>
              ) : (
                <span>전체 설정: 1~{ALL_LESSON_NUMBERS.length}차시가 모두 열려 있습니다 (선행 제한 없음)</span>
              )}
              {lessonAccessLastSyncedAt && (
                <span className="ml-2 mono text-slate-500">
                  · 마지막 서버 동기화: {lessonAccessLastSyncedAt.toLocaleTimeString('ko-KR')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {onRefreshLessonAccessFromServer && (
              <button
                type="button"
                onClick={() => onRefreshLessonAccessFromServer()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
                title="클라우드 서버에 저장된 최신 차시 잠금 설정을 다시 불러와 확인합니다"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>서버 상태 확인</span>
              </button>
            )}
            <button
              type="button"
              id="btn-save-lesson-access-server"
              onClick={handleManualServerSaveClick}
              disabled={lessonAccessSyncStatus === 'saving'}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-extrabold text-white shadow-xs transition-all active:scale-95"
              title="현재 ON/OFF 차시 잠금 설정을 클라우드 서버(Firestore)에 즉시 저장하여 모든 PC와 다른 브라우저에 강제 적용합니다"
            >
              <Save className="h-4 w-4" />
              <span>
                {lessonAccessSyncStatus === 'saving'
                  ? '서버 저장 중…'
                  : '차시 잠금 설정 서버 저장 (전체 PC·브라우저 적용)'}
              </span>
            </button>
          </div>
        </div>

        {onUpdateClassLessonAccess && (
          <ClassLessonAccessPanel
            classKeys={lessonClassKeys}
            studentCountByClass={studentCountByClass}
            classMap={classLessonAccess}
            globalConfig={lessonAccess}
            target={accessTarget}
            onChangeTarget={setAccessTarget}
            onResetTarget={handleResetClassTarget}
            syncStatus={classLessonAccessSyncStatus}
            errorText={classLessonAccessError}
          />
        )}

        {isLessonAccessOpen && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              각 차시를 <strong>ON(활성)</strong> 또는 <strong>OFF(비활성·잠금)</strong>으로 전환하면 클라우드 서버에 즉시 저장되며, 필요 시 상단 <strong>[차시 잠금 설정 서버 저장]</strong> 버튼으로 언제든 수동 강제 저장할 수 있습니다.
              비활성(OFF)된 차시는 자물쇠(<Lock className="inline h-3.5 w-3.5 text-slate-500" />)로 잠기며, 다른 PC나 다른 브라우저에서 접속한 학생도 탭 클릭·다음 차시 이동·URL 직접 입력(<code className="mono text-xs">?lesson=2</code>) 등 모든 경로에서 접근이 원천 차단됩니다.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LESSON_TAB_METADATA.map((item) => {
                const isEnabled = Boolean(targetLessonAccess[item.num]);
                return (
                  <div
                    key={item.num}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${
                      isEnabled
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-slate-200 bg-slate-50/80 opacity-85'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-extrabold mono ${
                            isEnabled
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {item.badge}차시
                        </span>
                        <div className="mt-1.5 text-sm font-extrabold text-slate-900">
                          {item.shortTitle}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${
                          isEnabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700 text-white'
                        }`}
                      >
                        {isEnabled ? (
                          <>
                            <Unlock className="h-3 w-3" />
                            <span>ON · 열림</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" />
                            <span>OFF · 잠금</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                      <span className="text-[11px] font-semibold text-slate-600">
                        {isEnabled ? '학생 접속·풀이 가능' : '학생 진입·선행 차단됨'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isEnabled}
                        aria-label={`${item.fullTitle} 활성 여부 전환`}
                        onClick={() => handleToggleSingleLesson(item.num)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors whitespace-nowrap ${
                          isEnabled
                            ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {isEnabled ? '잠그기 (OFF)' : '열기 (ON)'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 1: Student Registration Approval Management (Admin Only) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsApprovalOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              aria-expanded={isApprovalOpen}
              aria-label="학생 가입 신청 승인 메뉴 접기/펼치기"
            >
              {isApprovalOpen ? (
                <>
                  <ChevronUp className="h-4 w-4 text-slate-600" />
                  <span>접기</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 text-slate-600" />
                  <span>펼치기</span>
                </>
              )}
            </button>
            <div>
              <div className="text-xs font-bold text-blue-600">
                학생 가입 관리 · 관리자 ({adminEmail})
              </div>
              <h2 className="mt-0.5 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                학생 가입 신청 승인 · 기기(MAC 주소) 중복 관리
                {!isApprovalOpen && (
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    신청 {cloudRegistrations.length}명 (대기 {pendingCount} · 승인 {approvedCount} · 반려 {rejectedCount})
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleManualRefreshRegistrations}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              새로고침
            </button>
            {pendingCount > 0 && isApprovalOpen && (
              <button
                type="button"
                onClick={handleBulkApprovePending}
                className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                대기 일괄 승인 ({pendingCount}명)
              </button>
            )}
          </div>
        </div>

        {isApprovalOpen && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
            {pendingCount > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div className="text-xs sm:text-sm text-amber-900 font-bold">
                    현재 승인 대기 중인 학생이 <span className="underline font-extrabold text-amber-950">{pendingCount}명</span> 있습니다.
                    교사가 가입을 승인해야 학생 활동지가 클라우드에 실시간 저장되고 아래 탐구 기록실에 표시됩니다.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBulkApprovePending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-extrabold transition-colors shadow-xs"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  대기 학생 {pendingCount}명 즉시 일괄 승인
                </button>
              </div>
            )}

            {/* 학생 비밀번호 사용 설정 (기본: 사용 안 함) */}
            <div
              className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                studentAuthPolicy.passwordRequired ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
                  <KeyRound className="h-4 w-4 text-blue-600" />
                  학생 비밀번호 사용:{' '}
                  {studentAuthPolicy.passwordRequired ? (
                    <span className="text-blue-700">사용 중</span>
                  ) : (
                    <span className="text-slate-500">사용 안 함</span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] sm:text-xs text-slate-500">
                  켜면 가입 시 비밀번호가 필수가 되고, 비밀번호가 없는 기존 학생은 다음 로그인 때 비밀번호를 먼저 설정합니다.
                  비밀번호 설정 학생 {passwordSetCount}명 / 전체 {cloudRegistrations.length}명 · 선생님의 모든 수학 수업 사이트(함수·명제·소인수분해) 공통 설정
                </div>
              </div>
              <button
                type="button"
                disabled={!studentAuthPolicy.loaded}
                onClick={() => handleToggleStudentPassword(!studentAuthPolicy.passwordRequired)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                  studentAuthPolicy.passwordRequired
                    ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {studentAuthPolicy.passwordRequired ? '비밀번호 사용 끄기' : '비밀번호 사용 켜기'}
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              학생이 <strong>학교 / 학년 / 반 / 번호 / 생년월일 / 이름</strong>으로 가입을 신청하면 이곳에 실시간으로 표시됩니다.
              학교 공용 네트워크 환경을 고려하여 IP는 검사하지 않으며, <strong>기기 고유 MAC 주소 식별자</strong> 기준으로만 중복을 식별합니다.
            </p>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
              {/* Student Name Search Input */}
              <div className="relative min-w-[220px] sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={approvalSearchName}
                  onChange={(e) => setApprovalSearchName(e.target.value)}
                  placeholder="학생 이름 검색 (예: 홍길동)..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {approvalSearchName && (
                  <button
                    type="button"
                    onClick={() => setApprovalSearchName('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="검색어 지우기"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setApprovalFilter('all')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                    approvalFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  전체 ({cloudRegistrations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalFilter('pending')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                    approvalFilter === 'pending'
                      ? 'bg-amber-600 text-white'
                      : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  승인 대기 ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalFilter('approved')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                    approvalFilter === 'approved'
                      ? 'bg-emerald-600 text-white'
                      : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  승인 완료 ({approvedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalFilter('rejected')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                    approvalFilter === 'rejected'
                      ? 'bg-rose-600 text-white'
                      : 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  반려됨 ({rejectedCount})
                </button>
              </div>
            </div>

            {/* Approval Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                    <th className="py-3 px-3.5 text-left">상태</th>
                    <th className="py-3 px-3.5 text-left">학교 / 학년 / 반 / 번호</th>
                    <th className="py-3 px-3.5 text-left">이름</th>
                    <th className="py-3 px-3.5 text-left">생년월일</th>
                    <th className="py-3 px-3.5 text-left">기기 고유 MAC 주소 식별자 (중복 점검)</th>
                    <th className="py-3 px-3.5 text-left">비밀번호</th>
                    <th className="py-3 px-3.5 text-left">관리자 승인 처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRegistrations.length > 0 ? (
                    filteredRegistrations.map((reg) => {
                      const isDupDev = reg.deviceHash && deviceCounts[reg.deviceHash] > 1;
                      return (
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
                            {reg.school} {reg.grade}학년 {reg.classNum}반 {reg.studentNum}번
                          </td>
                          <td className="py-3 px-3.5 font-bold text-slate-900">{reg.name}</td>
                          <td className="py-3 px-3.5 mono text-xs text-slate-600">{reg.birthDate}</td>
                          <td className="py-3 px-3.5 mono text-xs">
                            <div className="flex items-center gap-1.5">
                              <Fingerprint className="h-3.5 w-3.5 text-blue-600" />
                              <span className="text-slate-700">MAC: {formatDeviceHashAsMac(reg.deviceHash)}</span>
                              {isDupDev && (
                                <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold">
                                  <ShieldAlert className="h-3.5 w-3.5" /> 동일 MAC 중복 ({deviceCounts[reg.deviceHash]}명)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-xs">
                            {hasStudentPassword(reg) ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                                  <KeyRound className="h-3.5 w-3.5" /> 설정됨
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleResetStudentPassword(reg)}
                                  className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                                  title="비밀번호를 잊은 학생: 초기화 후 다음 로그인 때 새로 설정"
                                >
                                  초기화
                                </button>
                              </div>
                            ) : (
                              <span className={studentAuthPolicy.passwordRequired ? 'font-bold text-rose-600' : 'text-slate-400'}>
                                {studentAuthPolicy.passwordRequired ? '미설정 (다음 로그인 때 설정)' : '없음'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {reg.status !== 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStudentStatus(reg, 'approved')}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  가입 승인
                                </button>
                              )}
                              {reg.status !== 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStudentStatus(reg, 'rejected')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                                >
                                  반려
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteStudentRegistration(reg)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                        {approvalSearchName
                          ? `'${approvalSearchName}' 학생 이름을 포함하는 가입 신청 내역이 없습니다.`
                          : '현재 해당 상태의 학생 가입 신청 내역이 없습니다.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION: Real-time Student Access Logs (Live Audit Trail) */}
      <div className="rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 p-5 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAccessLogsOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition-colors shadow-2xs"
              aria-expanded={isAccessLogsOpen}
              aria-label="학생 실시간 접속 로그 메뉴 접기/펼치기"
            >
              {isAccessLogsOpen ? (
                <>
                  <ChevronUp className="h-4 w-4 text-indigo-600" />
                  <span>접기</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 text-indigo-600" />
                  <span>펼치기</span>
                </>
              )}
            </button>
            <div>
              <div className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Firestore 실시간 수신 모니터링
              </div>
              <h2 className="mt-0.5 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                학생 실시간 접속 로그
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  누적 {accessLogs.length}건 · 오늘 {todayLogs.length}건
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportAccessLogsCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition-all shadow-2xs"
              title="현재 필터링된 접속 로그를 CSV 파일로 저장합니다"
            >
              <Download className="h-3.5 w-3.5" />
              <span>접속 로그 CSV 다운로드</span>
            </button>
          </div>
        </div>

        {isAccessLogsOpen && (
          <div className="mt-5 pt-4 border-t border-indigo-100 space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              학생들이 <strong>가입 신청, 로그인, 세션 복귀, 활동지 클라우드 저장</strong>을 수행할 때마다 실시간으로 기록되는 접속 감사 로그(Audit Trail)입니다.
              오전 수업과 오후 수업의 시간대별 접속 인원 및 기기 정보를 한눈에 파악할 수 있습니다.
            </p>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-indigo-500" />
                  오늘 총 접속
                </div>
                <div className="mt-1 text-2xl font-black text-slate-900">
                  {todayLogs.length} <span className="text-xs font-semibold text-slate-500">건</span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  누적 총 {accessLogs.length}건
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 shadow-2xs">
                <div className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  🌅 오전 접속 (12시 전)
                </div>
                <div className="mt-1 text-2xl font-black text-amber-900">
                  {morningLogsCount} <span className="text-xs font-semibold text-amber-700">건</span>
                </div>
                <div className="mt-0.5 text-[11px] text-amber-700">
                  00:00 ~ 11:59 발생 기록
                </div>
              </div>

              <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3.5 shadow-2xs">
                <div className="text-xs font-bold text-sky-700 flex items-center gap-1.5">
                  <Moon className="h-3.5 w-3.5 text-sky-500" />
                  🌇 오후 접속 (12시 후)
                </div>
                <div className="mt-1 text-2xl font-black text-sky-900">
                  {afternoonLogsCount} <span className="text-xs font-semibold text-sky-700">건</span>
                </div>
                <div className="mt-0.5 text-[11px] text-sky-700">
                  12:00 ~ 23:59 발생 기록
                </div>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3.5 shadow-2xs">
                <div className="text-xs font-bold text-purple-700 flex items-center gap-1.5">
                  <Fingerprint className="h-3.5 w-3.5 text-purple-500" />
                  고유 접속 기기
                </div>
                <div className="mt-1 text-2xl font-black text-purple-900">
                  {uniqueDevicesCount} <span className="text-xs font-semibold text-purple-700">대</span>
                </div>
                <div className="mt-0.5 text-[11px] text-purple-700">
                  MAC 식별자 기준
                </div>
              </div>
            </div>

            {/* Controls: Time Filter, Event Filter, Search */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap pt-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-extrabold text-slate-500 mr-1">시간대:</span>
                <button
                  type="button"
                  onClick={() => setAccessTimeFilter('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    accessTimeFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  전체 ({accessLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAccessTimeFilter('today')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    accessTimeFilter === 'today'
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  오늘 ({todayLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAccessTimeFilter('morning')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    accessTimeFilter === 'morning'
                      ? 'bg-amber-600 text-white'
                      : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  🌅 오전 ({morningLogsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAccessTimeFilter('afternoon')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    accessTimeFilter === 'afternoon'
                      ? 'bg-sky-600 text-white'
                      : 'border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
                  }`}
                >
                  🌇 오후 ({afternoonLogsCount})
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={accessEventFilter}
                  onChange={(e) => setAccessEventFilter(e.target.value as any)}
                  className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">모든 이벤트 구분</option>
                  <option value="login">로그인</option>
                  <option value="register">가입 신청</option>
                  <option value="save">클라우드 저장</option>
                  <option value="resume">세션 복귀</option>
                </select>

                <div className="relative min-w-[200px] sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={accessSearch}
                    onChange={(e) => setAccessSearch(e.target.value)}
                    placeholder="학생명, 학적, MAC, IP 검색..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {accessSearch && (
                    <button
                      type="button"
                      onClick={() => setAccessSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Access Logs Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs max-h-[460px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 font-extrabold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">접속 시각 (KST)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">이벤트 구분</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">학생 정보 (학적 · 성명)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">승인 상태</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">기기 식별자 (MAC 주소)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">접속 환경 (IP · 브라우저)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAccessLogs.length > 0 ? (
                    filteredAccessLogs.map((log) => {
                      const d = parseLogDate(log.createdAt);
                      const isAfternoon = d ? d.getHours() >= 12 : false;
                      return (
                        <tr key={log.logId} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-800">
                            <span className="flex items-center gap-1.5">
                              {isAfternoon ? (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[10px]">
                                  오후
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                                  오전
                                </span>
                              )}
                              <span>{formatLogTimestamp(log.createdAt)}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {formatEventBadge(log.eventType)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900">
                              {log.school} {log.grade}학년 {log.classNum}반 {log.studentNum}번
                            </div>
                            <div className="text-[11px] font-semibold text-indigo-700">
                              {log.name}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {log.status === 'approved' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" /> 승인 완료
                              </span>
                            ) : log.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                                <Clock className="h-3 w-3" /> 승인 대기
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                                <XCircle className="h-3 w-3" /> 반려
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            <div className="flex items-center gap-1 font-bold text-slate-800">
                              <Fingerprint className="h-3 w-3 text-slate-400" />
                              {formatDeviceHashAsMac(log.deviceHash)}
                            </div>
                            <div className="text-[10px] text-slate-600 truncate max-w-[140px]" title={log.studentKey}>
                              {log.studentKey}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600">
                            <div className="font-mono text-slate-700">{log.ipAddress}</div>
                            <div className="text-[10px] text-slate-600 truncate max-w-[260px]" title={log.userAgent}>
                              {log.userAgent}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        {accessSearch || accessTimeFilter !== 'all' || accessEventFilter !== 'all'
                          ? '선택한 필터 조건에 부합하는 접속 로그가 없습니다.'
                          : '기록된 학생 실시간 접속 로그가 아직 없습니다.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>


      {/* 학생 탐구 기록 · 평가 */}
      <div id="teacher-records-card" className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsRecordsOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              aria-expanded={isRecordsOpen}
              aria-label="학생 탐구 기록 메뉴 접기/펼치기"
            >
              {isRecordsOpen ? (
                <>
                  <ChevronUp className="h-4 w-4 text-slate-600" />
                  <span>접기</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 text-slate-600" />
                  <span>펼치기</span>
                </>
              )}
            </button>
            <div>
              <div className="text-xs font-bold text-violet-700 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>승인된 학생의 차시별 답안 · 선생님 평가</span>
              </div>
              <h2 className="mt-0.5 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                학생 탐구 기록 · 평가
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  {filteredSortedRecords.length}명 표시 / 전체 {records.length}명
                </span>
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
            title="지금 표에 보이는 학생의 모든 답안과 평가를 CSV로 저장합니다"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV 내려받기</span>
          </button>
        </div>

        {isRecordsOpen && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              차시 칸은 학생 진행 상태입니다(<strong>완료</strong> · <strong>진행 중</strong> · <strong>시작 전</strong>).
              자료 준비 중인 차시는 학생이 입력할 칸이 없어 모두 <strong>시작 전</strong>으로 보입니다. 학생을 누르면 아래에서 답안을 보고 평가할 수 있습니다.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-wrap">
              <div className="relative min-w-[220px] sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={recordsSearchName}
                  onChange={(e) => setRecordsSearchName(e.target.value)}
                  placeholder="이름·학번·학급 검색..."
                  aria-label="학생 기록 검색"
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
                {recordsSearchName && (
                  <button
                    type="button"
                    onClick={() => setRecordsSearchName('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="검색어 지우기"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                aria-label="학급 거르기"
                className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-700"
              >
                <option value="all">모든 학급</option>
                {uniqueGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select
                value={filterEvalStatus}
                onChange={(e) => setFilterEvalStatus(e.target.value as typeof filterEvalStatus)}
                aria-label="평가 상태 거르기"
                className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-700"
              >
                <option value="all">모든 평가 상태</option>
                <option value="none">미평가</option>
                <option value="partial">평가 진행 중</option>
                <option value="complete">평가 완료</option>
              </select>
              {isAnyRecordsFilterActive && (
                <button
                  type="button"
                  onClick={resetRecordsFilters}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  거르기 해제
                </button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                    <th className="py-3 px-3 text-left">학급 · 학번 이름</th>
                    {LESSON_TAB_METADATA.map((m) => (
                      <th key={m.num} className="py-3 px-1.5 text-center" title={`${m.fullTitle} · ${m.unitTitle}`}>
                        {m.num}차시
                      </th>
                    ))}
                    <th className="py-3 px-3 text-left">평가</th>
                    <th className="py-3 px-3 text-left">보기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredSortedRecords.length > 0 ? (
                    filteredSortedRecords.map((x) => {
                      const key = studentKey(x);
                      const prog = getTeacherEvaluationProgress(x);
                      const isSelected = key === selectedKey;
                      return (
                        <tr key={key} className={isSelected ? 'bg-violet-50/60' : 'hover:bg-slate-50/80'}>
                          <td className="py-2.5 px-3">
                            <div className="text-[11px] text-slate-500">{x.group || '—'}</div>
                            <div className="font-bold text-slate-900">{x.code || '—'}</div>
                          </td>
                          {ALL_LESSON_NUMBERS.map((n) => {
                            const p = recordLessonProgress(x, n);
                            return (
                              <td key={n} className="py-2.5 px-1.5 text-center">
                                <span
                                  className={`inline-block rounded-md border px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${LESSON_CHIP_CLASS[p]}`}
                                  title={`${getCurriculumLesson(n).shortTitle}${isLessonReady(n) ? '' : ' (자료 준비 중)'}`}
                                >
                                  {LESSON_PROGRESS_LABEL[p]}
                                </span>
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 text-xs font-bold whitespace-nowrap">
                            <span
                              className={
                                prog.status === 'complete'
                                  ? 'text-emerald-700'
                                  : prog.status === 'partial'
                                  ? 'text-amber-700'
                                  : 'text-slate-500'
                              }
                            >
                              {prog.statusLabel}
                              {prog.status === 'partial' ? ` ${prog.percent}%` : ''}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => handleSelectRecord(key)}
                              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                                isSelected
                                  ? 'bg-violet-600 text-white'
                                  : 'border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'
                              }`}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              답안 · 평가
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={ALL_LESSON_NUMBERS.length + 3} className="py-8 px-4 text-center text-slate-500">
                        {records.length === 0
                          ? '아직 승인된 학생이 없습니다. 위에서 가입 신청을 승인하면 여기에 표시됩니다.'
                          : '거르기 조건에 맞는 학생이 없습니다.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedStudent && selectedEval && (
              <div
                ref={detailRef}
                id="teacher-student-detail"
                className="rounded-2xl border border-violet-200 bg-violet-50/30 p-4 sm:p-5 space-y-5 scroll-mt-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs font-bold text-violet-700">{selectedStudent.group}</div>
                    <div className="text-lg font-extrabold text-slate-900">{selectedStudent.code}</div>
                    <div className="text-[11px] text-slate-500 mono">
                      마지막 수정 {selectedStudent.updatedAt ? new Date(selectedStudent.updatedAt).toLocaleString('ko-KR') : '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onPrintStudentReport(selectedStudent)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      평가서 인쇄 / PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectStudent('')}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      닫기
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {ALL_LESSON_NUMBERS.map((n, i) => {
                    const key = lessonKeyOf(n);
                    const { rows, extra } = lessonAnswerRows(key, selectedStudent[key]);
                    const written = rows.filter((r) => r.text.trim()).length;
                    const score = selectedEval.scores[i];
                    return (
                      <div key={n} className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="text-sm font-extrabold text-slate-900">
                            {n}차시 · {getCurriculumLesson(n).shortTitle}
                            {!isLessonReady(n) && (
                              <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                자료 준비 중
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-slate-500">
                            작성 {written}/{rows.length}
                          </span>
                        </div>
                        <dl className="mt-2.5 grid gap-2 text-xs sm:text-sm">
                          {rows.map((r) => (
                            <div key={r.field} className="grid sm:grid-cols-[220px_1fr] gap-1 sm:gap-3">
                              <dt className="font-bold text-slate-600">{r.label}</dt>
                              <dd className="whitespace-pre-wrap text-slate-900 break-words">
                                <AnswerText value={r.text} />
                              </dd>
                            </div>
                          ))}
                          {extra.length > 0 && (
                            <div className="grid sm:grid-cols-[220px_1fr] gap-1 sm:gap-3">
                              <dt className="font-bold text-amber-700">기타 기록 (이름표 없음)</dt>
                              <dd className="whitespace-pre-wrap text-slate-900 break-words">
                                {extra.map((r) => `${r.label}: ${r.text}`).join('\n')}
                              </dd>
                            </div>
                          )}
                        </dl>
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                          <label htmlFor={`score-${n}`} className="text-xs font-bold text-slate-700">
                            {EVAL_CRITERIA[i]} 평정
                          </label>
                          <select
                            id={`score-${n}`}
                            value={score === null || score === undefined ? '' : String(score)}
                            onChange={(e) => {
                              const v = e.target.value === '' ? null : Number(e.target.value);
                              updateSelectedStudent((item) => {
                                const ev = ensureTeacherEval(item);
                                ev.scores[i] = v;
                                return item;
                              });
                            }}
                            title={EVAL_DESCRIPTIONS[i]}
                            className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs font-bold text-slate-700"
                          >
                            <option value="">미평가</option>
                            {[0, 1, 2, 3].map((s) => (
                              <option key={s} value={s}>
                                {EVAL_SCORE_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-extrabold text-slate-900">학생에게 주는 피드백</span>
                    <textarea
                      value={selectedEval.feedback}
                      onChange={(e) =>
                        updateSelectedStudent((item) => {
                          ensureTeacherEval(item).feedback = e.target.value.slice(0, 4000);
                          return item;
                        })
                      }
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-extrabold text-slate-900">다음 탐구를 위한 제안</span>
                    <textarea
                      value={selectedEval.nextStep}
                      onChange={(e) =>
                        updateSelectedStudent((item) => {
                          ensureTeacherEval(item).nextStep = e.target.value.slice(0, 4000);
                          return item;
                        })
                      }
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </label>
                  <label className="block space-y-1.5 md:col-span-2">
                    <span className="text-sm font-extrabold text-slate-900">교사 메모 (학생 평가 결과 창에는 보이지 않음)</span>
                    <textarea
                      value={selectedStudent.teacherMemo || ''}
                      onChange={(e) =>
                        updateSelectedStudent((item) => ({ ...item, teacherMemo: e.target.value.slice(0, 4000) }))
                      }
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </label>
                </div>

                <TeacherSaveBar
                  status={selectedRegKey ? teacherSaveStatus[selectedRegKey] : undefined}
                  onServer={selectedRegKey !== null}
                  onSave={() => void flushTeacherSaves()}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
