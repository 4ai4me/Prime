import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  ALL_LESSON_NUMBERS,
  DEFAULT_LESSON_ACCESS,
  LESSON_TAB_METADATA,
  PRIME_LESSON_ACCESS_DOC,
  STORAGE_KEY_LESSON_ACCESS,
  buildLessonAccessFirestoreFields,
  evaluateStudentLessonRenderGate,
  getFirstEnabledLesson,
  hasAnyLockedLesson,
  isLessonEnabled,
  isLessonTabNumber,
  normalizeLessonAccess,
  type LessonAccessConfig,
  type LessonTabNumber,
} from './utils/lessonAccess';
import {
  CLASSROOM_BRAND_NAME,
  EVAL_CRITERIA,
  STORAGE_KEY_STUDENT,
  STORAGE_KEY_TEACHER,
  StudentRecord,
  cleanStudentState,
  createInitialStudentState,
  ensureTeacherEval,
  getTeacherEvaluationProgress,
  lessonKeyOf,
  mergeStudentStates,
} from './utils/studentRecord';
import { ADMIN_TEACHER_EMAIL, formatDeviceHashAsMac, isAuthorizedAdminEmail } from './utils/authLogic';
import {
  PRIME_CLASS_LESSON_ACCESS_DOC,
  MAX_CLASS_LESSON_ACCESS,
  STORAGE_KEY_CLASS_LESSON_ACCESS,
  buildClassLessonAccessFirestoreClasses,
  classKeyLabel,
  describeClassLessonAccessError,
  makeClassKey,
  normalizeClassLessonAccess,
  resolveStudentLessonAccess,
  withClassLessonAccess,
  type ClassLessonAccessMap,
} from './utils/classLessonAccess';
import { COURSE_INFO, CURRICULUM_UNITS, getCurriculumLesson, lessonBadge } from './lessons/curriculum';
import { getLessonModule, isLessonReady } from './lessons';
import { lessonAnswerRows } from './lessons/answerLabels';
import { TeacherView } from './components/TeacherView';
import { AuthGateView, FirestoreStudentRegistrationDoc } from './components/AuthGateView';
import { StudentEvaluationModal } from './components/StudentEvaluationModal';
import { MathSymbolInputBar } from './components/MathSymbolInputBar';
import { recordStudentAccessLog } from './utils/auditLogger';
import { ensureStudentAuth } from './utils/studentAuth';
import { codeLabelOf, groupLabelOf, isRecordOfStudent, studentDraftKey } from './utils/studentDraft';
import { needsPasswordSetup, useStudentAuthPolicy } from './utils/studentPassword';
import {
  LessonJsonMap,
  assembleRecord,
  findChangedLessons,
  listenTeacherEvaluation,
  loadStudentLessons,
  saveLessons,
  splitLessons,
} from './utils/lessonStore';
import {
  Printer,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  LogOut,
  ShieldCheck,
  UserCheck,
  Award,
  RotateCw,
  Zap,
  Lock,
} from 'lucide-react';

// 학생 활동지 자동 저장 대기 시간: 입력이 멈춘 뒤 이 시간이 지나면 한 번 저장 (탭 전환·닫기 시에는 즉시 저장)
const AUTOSAVE_DELAY_MS = 10000;
// 저장 실패 시 자동 재시도 간격
const SAVE_RETRY_DELAY_MS = 30000;
// 로그아웃할 때 마지막 저장을 기다리는 최대 시간 (오프라인이면 저장이 끝나지 않으므로)
const LOGOUT_SAVE_WAIT_MS = 5000;

// 학생 세션 보관 키 (AuthGateView와 같은 이름 — Func·Props와 같은 브라우저에서 같은 학생으로 바로 입장)
const PROFILE_STORAGE_KEY = 'math_detective_approved_profile_v1';
const ACTIVE_STUDENT_STORAGE_KEY = 'math_detective_active_student_key_v1';

type StepMap = Record<LessonTabNumber, number>;

function initialSteps(): StepMap {
  let initialStep = 0;
  try {
    const s = Number(new URLSearchParams(window.location.search).get('step'));
    if (Number.isInteger(s) && s >= 0 && s <= 9) initialStep = s;
  } catch {
    // 주소를 읽지 못하면 첫 단계
  }
  const out = {} as StepMap;
  for (const n of ALL_LESSON_NUMBERS) {
    out[n] = Math.min(initialStep, getCurriculumLesson(n).stages.length - 1);
  }
  return out;
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [sessionMode, setSessionMode] = useState<'gate' | 'student' | 'teacher'>(() => {
    try {
      const m = new URLSearchParams(window.location.search).get('mode');
      if (m === 'student' || m === 'teacher') return m;
    } catch {
      // 주소를 읽지 못하면 첫 화면
    }
    return 'gate';
  });
  const [approvedProfile, setApprovedProfile] = useState<FirestoreStudentRegistrationDoc | null>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // 기억한 학생 정보가 깨졌으면 다시 로그인
    }
    return null;
  });

  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [student, setStudent] = useState<StudentRecord>(() => {
    try {
      // 학생 세션이 남아 있으면 그 학생의 기기 보관본만 불러옴 (다른 학생 답안이 섞이지 않도록)
      const rawProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
      const profile = rawProfile ? (JSON.parse(rawProfile) as FirestoreStudentRegistrationDoc) : null;
      if (profile?.studentKey) {
        const draft = localStorage.getItem(studentDraftKey(STORAGE_KEY_STUDENT, profile.studentKey));
        if (draft) return cleanStudentState(JSON.parse(draft));
        return createInitialStudentState();
      }
      const raw = localStorage.getItem(STORAGE_KEY_STUDENT);
      if (raw) return cleanStudentState(JSON.parse(raw));
    } catch (err) {
      console.warn('Saved worksheet on this device is unreadable; starting fresh:', err);
    }
    return createInitialStudentState();
  });

  const [teacherRecords, setTeacherRecords] = useState<StudentRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TEACHER);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => {
              try {
                return cleanStudentState(item);
              } catch {
                return null;
              }
            })
            .filter((x): x is StudentRecord => x !== null);
        }
      }
    } catch {
      // 교사 화면 보관본이 깨졌으면 서버에서 다시 받음
    }
    return [];
  });

  const [lessonAccess, setLessonAccess] = useState<LessonAccessConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LESSON_ACCESS);
      if (raw) return normalizeLessonAccess(JSON.parse(raw));
    } catch {
      // 서버 값을 기다림
    }
    return { ...DEFAULT_LESSON_ACCESS };
  });
  const [isLessonAccessServerChecked, setIsLessonAccessServerChecked] = useState<boolean>(false);
  const [lessonAccessSyncStatus, setLessonAccessSyncStatus] = useState<
    'checking' | 'saving' | 'synced' | 'local_only' | 'error'
  >('checking');
  const [lessonAccessLastSyncedAt, setLessonAccessLastSyncedAt] = useState<Date | null>(null);
  const lessonAccessRef = useRef<LessonAccessConfig>(lessonAccess);
  useEffect(() => {
    lessonAccessRef.current = lessonAccess;
  }, [lessonAccess]);

  // 반별 차시 잠금: 학생의 반 설정이 있으면 반 설정, 없으면 위 전체 설정을 따름
  const [classLessonAccess, setClassLessonAccess] = useState<ClassLessonAccessMap>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CLASS_LESSON_ACCESS);
      if (raw) return normalizeClassLessonAccess(JSON.parse(raw)).map;
    } catch {
      // 브라우저에 기억한 값이 깨졌으면 서버 값을 기다림
    }
    return {};
  });
  const classLessonAccessRef = useRef<ClassLessonAccessMap>(classLessonAccess);
  const [isClassLessonAccessChecked, setIsClassLessonAccessChecked] = useState<boolean>(false);
  const [classLessonAccessSyncStatus, setClassLessonAccessSyncStatus] = useState<
    'checking' | 'saving' | 'synced' | 'error'
  >('checking');
  const [classLessonAccessError, setClassLessonAccessError] = useState<string | null>(null);
  const studentClassKey = sessionMode === 'student' ? makeClassKey(approvedProfile) : null;
  // 학생 화면에 실제로 적용하는 잠금 (교사 화면에서는 전체 설정과 같음)
  const effectiveLessonAccess = useMemo(
    () => resolveStudentLessonAccess(lessonAccess, classLessonAccess, studentClassKey).config,
    [lessonAccess, classLessonAccess, studentClassKey]
  );
  const effectiveLessonAccessRef = useRef<LessonAccessConfig>(effectiveLessonAccess);
  effectiveLessonAccessRef.current = effectiveLessonAccess;
  // 학생은 전체·반별 두 설정을 모두 받은 뒤에 차시를 보여 줌 (반 설정이 늦게 와서 잘못 이동되지 않도록)
  const isStudentAccessChecked =
    isLessonAccessServerChecked && (sessionMode !== 'student' || isClassLessonAccessChecked);

  const [activeLessonTab, setActiveLessonTab] = useState<LessonTabNumber>(() => {
    let initialLesson: LessonTabNumber = ALL_LESSON_NUMBERS[0];
    try {
      const l = Number(new URLSearchParams(window.location.search).get('lesson'));
      if (isLessonTabNumber(l)) initialLesson = l;
      const rawAccess = localStorage.getItem(STORAGE_KEY_LESSON_ACCESS);
      if (rawAccess) {
        const parsedAccess = normalizeLessonAccess(JSON.parse(rawAccess));
        if (!isLessonEnabled(parsedAccess, initialLesson)) {
          const fallback = getFirstEnabledLesson(parsedAccess);
          if (fallback !== null) initialLesson = fallback;
        }
      }
    } catch {
      // 첫 차시
    }
    return initialLesson;
  });
  const [steps, setSteps] = useState<StepMap>(initialSteps);
  const [selectedTeacherKey, setSelectedTeacherKey] = useState<string>('');
  const [printingStudent, setPrintingStudent] = useState<StudentRecord | null>(null);
  const [isEvalModalOpen, setIsEvalModalOpen] = useState<boolean>(false);

  const [toast, setToast] = useState<{ text: string; type: 'good' | 'warn' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = useCallback((text: string, type: 'good' | 'warn' = 'good') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  // 학생 비밀번호 사용 설정 (Func·Props와 공용, 기본: 사용 안 함)
  const studentAuthPolicy = useStudentAuthPolicy();
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 저장 함수(saveNow)가 항상 최신 값을 쓰도록 렌더링마다 갱신
  const studentRef = useRef(student);
  studentRef.current = student;
  const approvedProfileRef = useRef(approvedProfile);
  approvedProfileRef.current = approvedProfile;
  const sessionModeRef = useRef(sessionMode);
  sessionModeRef.current = sessionMode;
  // 저장을 한 번에 하나씩 순서대로 실행 (같은 내용을 겹쳐 저장하지 않도록)
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveErrorNotifiedRef = useRef(false);
  const saveNowRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));
  // 서버에 저장되어 있는 차시별 내용(JSON). null이면 아직 서버에서 불러오지 못한 상태이므로
  // 자동 저장을 하지 않습니다 (불러오기 전의 오래된 내용으로 서버의 최신 내용을 덮어쓰지 않기 위해).
  const serverLessonJsonRef = useRef<LessonJsonMap | null>(null);
  const [lessonLoadNonce, setLessonLoadNonce] = useState(0);

  // Firebase 로그인 상태
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      // 로그인된 사용자가 없으면 학생용 익명 계정으로 자동 로그인
      if (!u) {
        ensureStudentAuth().catch((err) => console.error('Anonymous sign-in failed:', err));
      }
      if (u && isAuthorizedAdminEmail(u.email, u.emailVerified)) {
        setSessionMode('teacher');
      }
    });
    return () => unsub();
  }, []);

  /**
   * 지금 바로 클라우드에 저장 (바뀐 차시만).
   * - 바뀐 내용이 없으면 아무것도 쓰지 않고 true.
   * - 저장이 끝난 뒤에만 true(저장됨)로 처리. 실패하면 false + 자동 재시도 예약.
   */
  const saveNow = useCallback((): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      const profile = approvedProfileRef.current;
      if (sessionModeRef.current !== 'student' || !profile?.studentKey) return true;
      const serverJson = serverLessonJsonRef.current;
      // 서버 내용을 아직 불러오지 못함: 덮어쓰지 않음 (입력 내용은 기기에 보관 중)
      if (!serverJson) return false;
      const record = studentRef.current;
      const changed = findChangedLessons(record, serverJson);
      if (changed.length === 0) return true;

      setCloudSyncStatus('saving');
      try {
        const saved = await saveLessons(profile.studentKey, record, changed);
        if (serverLessonJsonRef.current) {
          serverLessonJsonRef.current = { ...serverLessonJsonRef.current, ...saved };
        }
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        saveErrorNotifiedRef.current = false;
        const stillChanged =
          serverLessonJsonRef.current !== null &&
          findChangedLessons(studentRef.current, serverLessonJsonRef.current).length > 0;
        setCloudSyncStatus(stillChanged ? 'saving' : 'saved');
        setLastSavedAt(new Date());
        return true;
      } catch (err) {
        console.error(`Cloud save failed (${changed.join(', ')}):`, err);
        setCloudSyncStatus('error');
        if (!saveErrorNotifiedRef.current) {
          saveErrorNotifiedRef.current = true;
          showToast(
            '클라우드 저장에 실패했습니다. 입력한 내용은 이 기기에 보관되어 있고, 30초마다 자동으로 다시 저장을 시도합니다.',
            'warn'
          );
        }
        if (!retryTimerRef.current) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            void saveNowRef.current();
          }, SAVE_RETRY_DELAY_MS);
        }
        return false;
      }
    };
    const next = saveChainRef.current.then(run, run);
    saveChainRef.current = next.catch(() => false);
    return next;
  }, [showToast]);
  saveNowRef.current = saveNow;

  /** 아직 클라우드에 저장되지 않은 변경이 있는지 */
  const hasUnsavedChanges = useCallback((): boolean => {
    if (sessionModeRef.current !== 'student' || !approvedProfileRef.current?.studentKey) return false;
    const serverJson = serverLessonJsonRef.current;
    if (!serverJson) return false;
    return findChangedLessons(studentRef.current, serverJson).length > 0;
  }, []);

  // 기기 보관(localStorage) + 입력이 멈추고 10초 뒤 자동 저장 예약
  useEffect(() => {
    try {
      const key =
        sessionMode === 'student' && approvedProfile?.studentKey
          ? studentDraftKey(STORAGE_KEY_STUDENT, approvedProfile.studentKey)
          : STORAGE_KEY_STUDENT;
      localStorage.setItem(key, JSON.stringify(student));
    } catch (err) {
      console.warn('Failed to keep worksheet on this device:', err);
    }

    if (sessionMode !== 'student' || !approvedProfile?.studentKey) return;
    const serverJson = serverLessonJsonRef.current;
    if (!serverJson) return;
    if (findChangedLessons(student, serverJson).length === 0) return;

    setCloudSyncStatus('saving');
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      void saveNow();
    }, AUTOSAVE_DELAY_MS);
  }, [student, sessionMode, approvedProfile, saveNow]);

  // 단계·차시를 옮길 때: 기다리지 않고 바로 저장 (바뀐 내용이 없으면 저장하지 않음)
  useEffect(() => {
    void saveNow();
  }, [steps, activeLessonTab, saveNow]);

  // 탭 전환·닫기 시 즉시 저장, 인터넷이 다시 연결되면 재시도, 저장 안 된 내용이 있으면 닫기 전 확인
  useEffect(() => {
    const flushNow = () => {
      void saveNow();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      void saveNow();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('online', flushNow);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('online', flushNow);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [saveNow, hasUnsavedChanges]);

  // 학생 로그인 후: 서버의 Prime 차시 문서를 불러옵니다. 불러오기가 끝나야 자동 저장이 시작됩니다.
  useEffect(() => {
    if (sessionMode !== 'student' || !approvedProfile?.studentKey || !firebaseUser) return;
    const profile = approvedProfile;
    let cancelled = false;
    serverLessonJsonRef.current = null;

    const groupLabel = groupLabelOf(profile);
    const codeLabel = codeLabelOf(profile);

    loadStudentLessons(profile.studentKey)
      .then((snap) => {
        if (cancelled) return;
        const base = createInitialStudentState();
        base.group = groupLabel;
        base.code = codeLabel;
        const assembled = assembleRecord(base, snap);
        serverLessonJsonRef.current = splitLessons(assembled);
        setStudent((prev) => {
          // 화면의 내용이 같은 학생의 것일 때만 합침 (다른 학생 답안이 섞이지 않도록)
          const merged = isRecordOfStudent(prev, profile) ? mergeStudentStates(assembled, prev) : assembled;
          merged.group = groupLabel;
          merged.code = codeLabel;
          return merged;
        });
        setCloudSyncStatus('saved');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load lesson documents:', err);
        setCloudSyncStatus('error');
        showToast(
          (err as { code?: string })?.code === 'permission-denied'
            ? '서버의 활동지를 불러올 권한이 없습니다. 다시 로그인하거나 선생님께 알려주세요. (입력 내용은 이 기기에 보관됩니다)'
            : '서버의 활동지를 불러오지 못했습니다. 네트워크를 확인한 뒤 [지금 저장]을 눌러 다시 시도해 주세요. (입력 내용은 이 기기에 보관됩니다)',
          'warn'
        );
      });
    return () => {
      cancelled = true;
    };
  }, [sessionMode, approvedProfile, firebaseUser, lessonLoadNonce, showToast]);

  // 교사 평가·메모 실시간 수신 (교사 전용 문서, 학생은 읽기만)
  useEffect(() => {
    if (sessionMode !== 'student' || !approvedProfile?.studentKey || !firebaseUser) return;
    const unsub = listenTeacherEvaluation(
      approvedProfile.studentKey,
      (teacher) => {
        if (!teacher) return;
        let remote: { evaluation?: StudentRecord['evaluation']; teacherMemo?: string };
        try {
          remote = JSON.parse(teacher.data);
        } catch (err) {
          console.warn('Teacher evaluation document is malformed:', err);
          return;
        }
        setStudent((prev) => {
          const nextEval = remote.evaluation ?? prev.evaluation;
          const nextMemo = typeof remote.teacherMemo === 'string' ? remote.teacherMemo : prev.teacherMemo;
          if (JSON.stringify(nextEval) === JSON.stringify(prev.evaluation) && nextMemo === prev.teacherMemo) {
            return prev;
          }
          return { ...prev, evaluation: nextEval, teacherMemo: nextMemo };
        });
      },
      (err) => {
        console.error('Teacher evaluation listener error:', err);
      }
    );
    return () => unsub();
  }, [sessionMode, approvedProfile?.studentKey, firebaseUser]);

  // 가입 문서 감시: 다른 기기에서 같은 학생으로 다시 로그인해 이 기기의 연결이 끊긴 경우 처음 화면으로
  useEffect(() => {
    if (sessionMode !== 'student' || !approvedProfile?.studentKey || !firebaseUser) return;
    const unsub = onSnapshot(
      doc(db, 'student_registrations', approvedProfile.studentKey),
      (snap) => {
        if (!studentAuthPolicy.loaded || !snap.exists()) return;
        if (needsPasswordSetup(studentAuthPolicy.passwordRequired, snap.data())) {
          void saveNow();
          setSessionMode('gate');
          showToast('이제부터 비밀번호가 필요합니다. 비밀번호를 설정한 뒤 계속해 주세요.', 'warn');
        }
      },
      (error) => {
        console.error('Student registration listener error:', error);
        if ((error as { code?: string })?.code === 'permission-denied') {
          try {
            localStorage.removeItem(ACTIVE_STUDENT_STORAGE_KEY);
            localStorage.removeItem(PROFILE_STORAGE_KEY);
          } catch (storageErr) {
            console.warn('Failed to clear saved student session:', storageErr);
          }
          setApprovedProfile(null);
          setSessionMode('gate');
          showToast('다른 기기에서 같은 학생으로 로그인되어 이 기기의 연결이 해제되었습니다. 다시 로그인해 주세요.', 'warn');
        }
      }
    );
    return () => unsub();
  }, [
    sessionMode,
    approvedProfile?.studentKey,
    firebaseUser,
    showToast,
    studentAuthPolicy.loaded,
    studentAuthPolicy.passwordRequired,
    saveNow,
  ]);

  // 교사 화면 기록 보관
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TEACHER, JSON.stringify(teacherRecords));
    } catch {
      // 저장 공간이 없어도 화면은 그대로
    }
  }, [teacherRecords]);

  // 인쇄가 끝나면 인쇄용 표시 해제
  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-report');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const requestConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ title, message, onConfirm });
  }, []);

  const applyServerLessonAccessSnapshot = useCallback((rawServerData: unknown) => {
    const normalized = normalizeLessonAccess(rawServerData);
    lessonAccessRef.current = normalized;
    setLessonAccess(normalized);
    setIsLessonAccessServerChecked(true);
    setLessonAccessSyncStatus('synced');
    setLessonAccessLastSyncedAt(normalized.updatedAt ? new Date(normalized.updatedAt) : new Date());
    try {
      localStorage.setItem(STORAGE_KEY_LESSON_ACCESS, JSON.stringify(normalized));
    } catch {
      // 저장 공간이 없어도 화면 값은 그대로
    }
  }, []);

  const persistLessonAccessToCloud = useCallback(
    async (configToSave: LessonAccessConfig, reasonLabel?: string): Promise<boolean> => {
      const normalized = normalizeLessonAccess(configToSave);
      lessonAccessRef.current = normalized;
      setLessonAccess(normalized);
      try {
        localStorage.setItem(STORAGE_KEY_LESSON_ACCESS, JSON.stringify(normalized));
      } catch {
        // 저장 공간이 없어도 서버 저장은 계속
      }

      setLessonAccessSyncStatus('saving');
      try {
        const fields = buildLessonAccessFirestoreFields(normalized, firebaseUser?.email || ADMIN_TEACHER_EMAIL);
        // Prime 전용 잠금 문서에만 저장 (Func·Props의 잠금 문서는 건드리지 않음)
        const targetRef = doc(db, 'app_settings', PRIME_LESSON_ACCESS_DOC);
        await setDoc(targetRef, { ...fields, updatedAt: serverTimestamp() });

        // 서버에서 다시 읽어 확인 (다른 PC·브라우저에도 같은 값이 적용되는지)
        try {
          const verifiedSnap = await getDocFromServer(targetRef);
          if (verifiedSnap.exists()) {
            applyServerLessonAccessSnapshot(verifiedSnap.data());
          } else {
            setIsLessonAccessServerChecked(true);
            setLessonAccessSyncStatus('synced');
            setLessonAccessLastSyncedAt(new Date());
          }
        } catch {
          setIsLessonAccessServerChecked(true);
          setLessonAccessSyncStatus('synced');
          setLessonAccessLastSyncedAt(new Date());
        }

        if (reasonLabel) {
          showToast(`클라우드 서버 저장 완료: ${reasonLabel} (모든 PC·브라우저 학생에게 즉시 적용됨)`, 'good');
        }
        return true;
      } catch (err) {
        console.error(`Failed to sync ${PRIME_LESSON_ACCESS_DOC} to Firestore:`, err);
        setLessonAccessSyncStatus('error');
        if (reasonLabel) {
          showToast(
            '차시 잠금 서버 저장 확인 필요: 네트워크 상태를 확인하고 [차시 잠금 설정 서버 저장] 버튼을 다시 눌러주세요.',
            'warn'
          );
        }
        return false;
      }
    },
    [firebaseUser, applyServerLessonAccessSnapshot, showToast]
  );

  const refreshLessonAccessFromServer = useCallback(async () => {
    const targetRef = doc(db, 'app_settings', PRIME_LESSON_ACCESS_DOC);
    try {
      let snap;
      try {
        snap = await getDocFromServer(targetRef);
      } catch {
        snap = await getDoc(targetRef);
      }
      if (snap.exists()) {
        applyServerLessonAccessSnapshot(snap.data());
        return;
      }
      // 서버 문서가 아직 없으면: 교사가 들어왔을 때 지금 값으로 만들어 둠
      if (sessionMode === 'teacher' || hasAnyLockedLesson(lessonAccessRef.current)) {
        await persistLessonAccessToCloud(lessonAccessRef.current);
      } else {
        setIsLessonAccessServerChecked(true);
        setLessonAccessSyncStatus('local_only');
      }
    } catch (err) {
      // 서버에서 읽지 못함 (네트워크·사용량 한도 등): '확인 중'에 멈추지 않고 오류로 표시
      console.error('Failed to read lesson access settings from server:', err);
      setIsLessonAccessServerChecked(true);
      setLessonAccessSyncStatus((prev) => (prev === 'synced' ? prev : 'error'));
    }
  }, [sessionMode, applyServerLessonAccessSnapshot, persistLessonAccessToCloud]);

  // 차시 잠금: 실시간 구독, 처음 서버 확인, 창 전환 시 다시 확인, 다른 탭 변경 반영, 뒤로 가기
  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsLessonAccessServerChecked(true);
    }, 2500);
    // 15초가 지나도 서버 응답이 없으면 '확인 중' 대신 연결 문제로 표시
    const stuckTimer = setTimeout(() => {
      if (isMounted) setLessonAccessSyncStatus((prev) => (prev === 'checking' ? 'error' : prev));
    }, 15000);

    void refreshLessonAccessFromServer();

    const unsubFirestore = onSnapshot(
      doc(db, 'app_settings', PRIME_LESSON_ACCESS_DOC),
      (docSnap) => {
        if (!docSnap.exists()) return;
        applyServerLessonAccessSnapshot(docSnap.data());
      },
      (err) => {
        console.error('Lesson access listener error:', err);
        setIsLessonAccessServerChecked(true);
        setLessonAccessSyncStatus((prev) => (prev === 'synced' ? prev : 'error'));
      }
    );

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_LESSON_ACCESS && e.newValue) {
        try {
          const parsed = normalizeLessonAccess(JSON.parse(e.newValue));
          lessonAccessRef.current = parsed;
          setLessonAccess(parsed);
        } catch {
          // 깨진 값은 무시
        }
      }
    };
    const handleWindowFocusOrVisible = () => {
      if (document.visibilityState === 'hidden') return;
      void refreshLessonAccessFromServer();
    };
    const handlePopState = () => {
      try {
        const l = Number(new URLSearchParams(window.location.search).get('lesson'));
        if (isLessonTabNumber(l)) {
          if (isLessonEnabled(effectiveLessonAccessRef.current, l)) {
            setActiveLessonTab(l);
          } else {
            const firstOpen = getFirstEnabledLesson(effectiveLessonAccessRef.current);
            if (firstOpen !== null) setActiveLessonTab(firstOpen);
          }
        }
      } catch {
        // 주소를 읽지 못하면 그대로
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleWindowFocusOrVisible);
    document.addEventListener('visibilitychange', handleWindowFocusOrVisible);
    window.addEventListener('popstate', handlePopState);
    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      clearTimeout(stuckTimer);
      unsubFirestore();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocusOrVisible);
      document.removeEventListener('visibilitychange', handleWindowFocusOrVisible);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [applyServerLessonAccessSnapshot, refreshLessonAccessFromServer]);

  // 잠긴 차시를 보고 있던 학생은 열린 차시로 옮기고, 주소의 ?lesson= 도 고침
  useEffect(() => {
    if (sessionMode !== 'student') return;
    if (!isStudentAccessChecked) return;
    // 처음 열 때 이미 열린 차시로 바뀐 경우에도 주소에 잠긴 차시 번호가 남지 않게 함 (새로고침·즐겨찾기 우회 방지)
    try {
      const url = new URL(window.location.href);
      const asked = Number(url.searchParams.get('lesson'));
      if (isLessonTabNumber(asked) && asked !== activeLessonTab && !isLessonEnabled(effectiveLessonAccess, asked)) {
        url.searchParams.set('lesson', String(activeLessonTab));
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      // 주소를 고치지 못해도 화면은 열린 차시
    }
    if (!isLessonEnabled(effectiveLessonAccess, activeLessonTab)) {
      const firstOpen = getFirstEnabledLesson(effectiveLessonAccess);
      const lockedMeta = LESSON_TAB_METADATA.find((m) => m.num === activeLessonTab);
      if (firstOpen !== null && firstOpen !== activeLessonTab) {
        setActiveLessonTab(firstOpen);
        const openMeta = LESSON_TAB_METADATA.find((m) => m.num === firstOpen);
        setToast({
          text: `${lockedMeta ? lockedMeta.fullTitle : `${activeLessonTab}차시`}는 현재 선생님이 잠가 두어 열려 있는 ${
            openMeta ? openMeta.fullTitle : `${firstOpen}차시`
          }로 이동했습니다.`,
          type: 'warn',
        });
      }
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('lesson')) {
          if (firstOpen !== null) url.searchParams.set('lesson', String(firstOpen));
          else url.searchParams.delete('lesson');
          window.history.replaceState({}, '', url.toString());
        }
      } catch {
        // 주소를 고치지 못해도 화면은 열린 차시
      }
    }
  }, [sessionMode, isStudentAccessChecked, effectiveLessonAccess, activeLessonTab]);

  const handleUpdateLessonAccess = useCallback(
    async (nextConfig: LessonAccessConfig, reasonLabel?: string): Promise<boolean> =>
      persistLessonAccessToCloud(nextConfig, reasonLabel),
    [persistLessonAccessToCloud]
  );

  // 반별 차시 잠금: 서버 문서 실시간 구독 (학생·교사 모두)
  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsClassLessonAccessChecked(true);
    }, 2500);
    const unsub = onSnapshot(
      doc(db, 'app_settings', PRIME_CLASS_LESSON_ACCESS_DOC),
      (snap) => {
        const { map, skipped } = snap.exists()
          ? normalizeClassLessonAccess(snap.data())
          : { map: {} as ClassLessonAccessMap, skipped: [] as string[] };
        if (skipped.length > 0) {
          console.warn('반별 차시 잠금: 형식이 맞지 않아 전체 설정을 따르는 반', skipped);
        }
        classLessonAccessRef.current = map;
        setClassLessonAccess(map);
        setIsClassLessonAccessChecked(true);
        setClassLessonAccessSyncStatus('synced');
        try {
          localStorage.setItem(
            STORAGE_KEY_CLASS_LESSON_ACCESS,
            JSON.stringify({ classes: buildClassLessonAccessFirestoreClasses(map) })
          );
        } catch {
          // 저장 공간이 없어도 화면 값은 그대로 사용
        }
      },
      (err) => {
        console.error('Class lesson access listener error:', err);
        setIsClassLessonAccessChecked(true);
        setClassLessonAccessSyncStatus('error');
        setClassLessonAccessError(`반별 설정을 읽지 못했습니다 — ${describeClassLessonAccessError(err)}`);
      }
    );
    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsub();
    };
  }, []);

  // 반별 차시 잠금 저장: config가 null이면 그 반을 '전체 설정 따름'으로 되돌림
  const handleUpdateClassLessonAccess = useCallback(
    async (classKey: string, config: LessonAccessConfig | null, reasonLabel?: string): Promise<boolean> => {
      const prev = classLessonAccessRef.current;
      const next = withClassLessonAccess(prev, classKey, config);
      if (Object.keys(next).length > MAX_CLASS_LESSON_ACCESS) {
        showToast(
          `반별 잠금은 ${MAX_CLASS_LESSON_ACCESS}개 반까지 저장할 수 있습니다. 쓰지 않는 반을 전체 설정으로 되돌린 뒤 다시 시도해 주세요.`,
          'warn'
        );
        return false;
      }
      classLessonAccessRef.current = next;
      setClassLessonAccess(next);
      setClassLessonAccessSyncStatus('saving');
      try {
        await setDoc(doc(db, 'app_settings', PRIME_CLASS_LESSON_ACCESS_DOC), {
          classes: buildClassLessonAccessFirestoreClasses(next),
          updatedBy: (firebaseUser?.email || ADMIN_TEACHER_EMAIL).slice(0, 120),
          updatedAt: serverTimestamp(),
        });
        setClassLessonAccessSyncStatus('synced');
        setClassLessonAccessError(null);
        if (reasonLabel) {
          showToast(`서버 저장 완료: ${classKeyLabel(classKey)} ${reasonLabel} (그 반 학생 화면에 바로 적용됨)`, 'good');
        }
        return true;
      } catch (err) {
        console.error(`Failed to save ${PRIME_CLASS_LESSON_ACCESS_DOC}:`, err);
        // 저장되지 않았으므로 화면도 저장 전 값으로 되돌림
        classLessonAccessRef.current = prev;
        setClassLessonAccess(prev);
        setClassLessonAccessSyncStatus('error');
        const reason = describeClassLessonAccessError(err);
        setClassLessonAccessError(reason);
        showToast(`${classKeyLabel(classKey)} 반별 잠금 저장 실패 — ${reason}`, 'warn');
        return false;
      }
    },
    [firebaseUser, showToast]
  );

  const handleForceSyncLessonAccessToServer = useCallback(
    async (): Promise<boolean> =>
      persistLessonAccessToCloud(lessonAccessRef.current, '현재 차시 잠금 설정 전체 PC·브라우저 강제 동기화'),
    [persistLessonAccessToCloud]
  );

  const handleSelectStudentLesson = useCallback(
    (targetTab: LessonTabNumber, resetStepToZero = false) => {
      if (sessionMode === 'student' && !isLessonEnabled(effectiveLessonAccess, targetTab)) {
        const meta = LESSON_TAB_METADATA.find((m) => m.num === targetTab);
        showToast(
          `현재 선생님이 ${meta ? meta.fullTitle : `${targetTab}차시`}를 잠가 두어 아직 들어갈 수 없습니다.`,
          'warn'
        );
        return;
      }
      if (resetStepToZero) setSteps((prev) => ({ ...prev, [targetTab]: 0 }));
      setActiveLessonTab(targetTab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [sessionMode, effectiveLessonAccess, showToast]
  );

  const handleManualForceSave = async () => {
    if (!approvedProfile?.studentKey) {
      showToast('승인된 학생 계정 정보가 없어 클라우드에 저장할 수 없습니다.', 'warn');
      return;
    }
    const serverJson = serverLessonJsonRef.current;
    if (!serverJson) {
      // 서버 내용을 아직 불러오지 못한 상태: 덮어쓰지 않고 다시 불러오기를 시도
      setLessonLoadNonce((n) => n + 1);
      showToast('서버의 활동지를 다시 불러오는 중입니다. 잠시 후 [지금 저장]을 다시 눌러 주세요.', 'warn');
      return;
    }
    if (findChangedLessons(student, serverJson).length === 0) {
      setCloudSyncStatus('saved');
      showToast('모든 내용이 이미 클라우드에 저장되어 있습니다.', 'good');
      return;
    }
    const ok = await saveNow();
    if (ok) {
      showToast('클라우드에 최신 활동지가 즉시 저장되었습니다.', 'good');
      recordStudentAccessLog({
        studentKey: approvedProfile.studentKey,
        school: approvedProfile.school,
        grade: approvedProfile.grade,
        classNum: approvedProfile.classNum,
        studentNum: approvedProfile.studentNum,
        name: approvedProfile.name,
        eventType: 'save',
        status: 'approved',
        deviceHash: approvedProfile.deviceHash,
        ipAddress: approvedProfile.ipAddress,
        userAgent: approvedProfile.userAgent,
      }).catch((logErr) => console.warn('Save audit log skipped:', logErr));
    } else {
      showToast(
        '클라우드 저장 중 오류가 발생했습니다. 네트워크 연결을 확인하세요. (입력 내용은 이 기기에 보관되며 자동으로 다시 시도합니다)',
        'warn'
      );
    }
  };

  const handleStudentApprovedLogin = useCallback(
    (regDoc: FirestoreStudentRegistrationDoc, worksheet: StudentRecord) => {
      const groupLabel = groupLabelOf(regDoc);
      const codeLabel = codeLabelOf(regDoc);
      // 차시 문서 불러오기는 로그인 후 effect에서 수행 (끝나기 전까지 자동 저장하지 않음)
      serverLessonJsonRef.current = null;
      setApprovedProfile(regDoc);
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(regDoc));
        localStorage.setItem(ACTIVE_STUDENT_STORAGE_KEY, regDoc.studentKey);
      } catch {
        // 기억하지 못해도 이번 접속은 계속
      }
      setStudent((prev) => {
        // 이 학생이 이 기기에 남긴 보관본만 합침 (공용 기기에서 앞 학생 답안이 섞이지 않도록)
        let local: StudentRecord | null = null;
        try {
          const raw = localStorage.getItem(studentDraftKey(STORAGE_KEY_STUDENT, regDoc.studentKey));
          if (raw) local = cleanStudentState(JSON.parse(raw));
        } catch (err) {
          console.warn('Saved draft for this student is unreadable; ignoring it:', err);
        }
        if (!local && isRecordOfStudent(prev, regDoc)) local = prev;
        const merged = local ? mergeStudentStates(worksheet, local) : worksheet;
        merged.group = groupLabel;
        merged.code = codeLabel;
        return merged;
      });
      setCloudSyncStatus('idle');
      setSessionMode('student');
      recordStudentAccessLog({
        studentKey: regDoc.studentKey,
        school: regDoc.school,
        grade: regDoc.grade,
        classNum: regDoc.classNum,
        studentNum: regDoc.studentNum,
        name: regDoc.name,
        eventType: 'resume',
        status: 'approved',
        deviceHash: regDoc.deviceHash,
        ipAddress: regDoc.ipAddress,
        userAgent: regDoc.userAgent,
        updateRegistrationUpdatedAt: true,
      }).catch(() => {});
    },
    []
  );

  const handleAdminTeacherLogin = useCallback(() => {
    setSessionMode('teacher');
  }, []);

  const handleExitMode = async () => {
    // 교사·학생 모두 로그아웃. 학생은 다음 접속 때 새 익명 계정이 만들어지므로
    // 공용 기기에서 다음 사람이 이전 학생의 문서에 접근할 수 없습니다.
    const leavingStudentKey = sessionMode === 'student' ? approvedProfile?.studentKey : undefined;
    if (leavingStudentKey) {
      const allSaved = await Promise.race([
        saveNow(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), LOGOUT_SAVE_WAIT_MS)),
      ]);
      if (allSaved) {
        try {
          localStorage.removeItem(studentDraftKey(STORAGE_KEY_STUDENT, leavingStudentKey));
        } catch (err) {
          console.warn('Failed to remove saved draft:', err);
        }
      } else {
        showToast(
          '아직 클라우드에 저장되지 않은 내용이 있어 이 기기에 보관해 두었습니다. 같은 학생이 이 기기로 다시 로그인하면 자동으로 저장됩니다.',
          'warn'
        );
      }
    }
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    serverLessonJsonRef.current = null;
    try {
      await signOut(auth);
    } catch {
      // 이미 로그아웃됨
    }
    try {
      localStorage.removeItem(ACTIVE_STUDENT_STORAGE_KEY);
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    } catch {
      // 지우지 못해도 다음 로그인 때 다시 확인함
    }
    setApprovedProfile(null);
    if (leavingStudentKey) setStudent(createInitialStudentState());
    setSessionMode('gate');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrintStudentReport = (targetStudent: StudentRecord) => {
    setPrintingStudent(targetStudent);
    document.body.classList.add('printing-report');
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const doneMap = useMemo(() => {
    const out = {} as Record<LessonTabNumber, boolean[]>;
    for (const n of ALL_LESSON_NUMBERS) {
      out[n] = getLessonModule(n).evaluateCompletion(student[lessonKeyOf(n)]);
    }
    return out;
  }, [student]);

  const studentRenderGate = evaluateStudentLessonRenderGate(
    effectiveLessonAccess,
    activeLessonTab,
    isStudentAccessChecked
  );
  const displayLessonTab: LessonTabNumber =
    sessionMode === 'student' ? studentRenderGate.effectiveLesson : activeLessonTab;
  const activeInfo = getCurriculumLesson(displayLessonTab);
  const activeUnit = CURRICULUM_UNITS.find((u) => u.num === activeInfo.unit);
  const activeDone = doneMap[displayLessonTab];
  const activeStep = steps[displayLessonTab];
  const activeReady = isLessonReady(displayLessonTab);
  const ActiveLessonView = getLessonModule(displayLessonTab).View;
  const studentEvalProg = getTeacherEvaluationProgress(student);

  return (
    <>
      <div id="app-shell" className="min-h-screen flex flex-col">
        {/* 맨 위 막대: 브랜드 · 과정 · 로그인 상태 */}
        <div className="no-print border-b border-white/10 bg-[#070b14] text-slate-300 px-4 sm:px-6 py-3">
          <div className="mx-auto max-w-[1160px] flex items-center justify-between gap-2 sm:gap-6">
            <div className="text-sm sm:text-base font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2">
              <span className="text-violet-300">{CLASSROOM_BRAND_NAME}</span>
              <span aria-hidden="true" className="hidden sm:inline text-slate-600">·</span>
              <span className="hidden sm:inline">Prime Factor Lab</span>
            </div>

            <div className="hidden md:flex items-center gap-3 text-xs font-medium text-slate-400 whitespace-nowrap shrink-0">
              <span>{COURSE_INFO.grade}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>
                {COURSE_INFO.unitRoman}. {COURSE_INFO.unitTitle}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>관찰 · 분해 · 추론 · 설명</span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {sessionMode !== 'gate' ? (
                <>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-violet-200 whitespace-nowrap">
                    {sessionMode === 'teacher' ? (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />
                        교사(관리자) 모드 · {firebaseUser?.email || ADMIN_TEACHER_EMAIL}
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                        학생 모드 · {approvedProfile?.school} {approvedProfile?.grade}-{approvedProfile?.classNum}-
                        {approvedProfile?.studentNum} {approvedProfile?.name}
                      </>
                    )}
                  </span>
                  {sessionMode === 'student' && (
                    <button
                      type="button"
                      onClick={handleManualForceSave}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 text-xs font-bold transition-all shadow-xs active:scale-95"
                      title="현재 작성한 활동지를 클라우드에 즉시 저장합니다"
                    >
                      {cloudSyncStatus === 'saving' ? (
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Zap className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                      )}
                      <span>{cloudSyncStatus === 'saving' ? '저장 중…' : '지금 저장'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleExitMode}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 whitespace-nowrap shrink-0"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="sm:hidden">로그아웃</span>
                    <span className="hidden sm:inline">로그아웃 / 모드 전환</span>
                  </button>
                </>
              ) : (
                <span className="text-xs font-medium text-slate-400 whitespace-nowrap">학생 · 교사 승인제 플랫폼</span>
              )}
            </div>
          </div>
        </div>

        {/* 머리 배너 */}
        <header className="hero-bg text-white pt-8 pb-8 px-4 sm:px-6 border-b border-slate-800">
          <div className="mx-auto max-w-[1160px] relative z-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_340px] items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-violet-300 flex-wrap">
                  <span>01 — {lessonBadge(ALL_LESSON_NUMBERS.length)}차시 통합 탐구 프로젝트</span>
                  <span aria-hidden="true" className="text-slate-600">/</span>
                  <span className="text-slate-300">{CURRICULUM_UNITS.map((u) => u.title).join(' · ')}</span>
                </div>
                <h1
                  className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.14] text-white"
                  style={{ textWrap: 'balance' }}
                >
                  {COURSE_INFO.unitRoman}. <span className="text-violet-300">{COURSE_INFO.unitTitle}</span>
                </h1>
                <p className="mt-3 text-base sm:text-xl text-slate-200 font-semibold">{COURSE_INFO.headline}</p>
                <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
                  {COURSE_INFO.subtitle}
                </p>
              </div>

              <div className="hidden lg:flex flex-col items-end justify-center">
                <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xs">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-white/10">
                    <span className="font-semibold text-slate-200">대단원 구성</span>
                    <span className="mono text-violet-300">01 — {lessonBadge(ALL_LESSON_NUMBERS.length)}차시</span>
                  </div>
                  <div className="py-3 space-y-2 text-xs">
                    {CURRICULUM_UNITS.map((u) => (
                      <div key={u.num} className="flex items-center justify-between gap-3 text-slate-300 whitespace-nowrap">
                        <span>
                          <span className="mono text-violet-300">{u.num}</span> {u.title}
                        </span>
                        <span className="mono text-white font-semibold">
                          {u.lessons.map((n) => `${n}차시`).join(' · ')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 whitespace-nowrap">
                    <span>소수 → 소인수분해 → 최대공약수·최소공배수</span>
                    <span className="mono text-slate-300">2 · 3 · 5 · 7 …</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 학생 화면: 중단원별 차시 탭 + 진행 현황 */}
            {sessionMode === 'student' && (
              <div
                role="tablist"
                aria-label="학생 차시 선택"
                className="no-print mt-7 pt-5 border-t border-white/10 flex flex-col gap-4"
              >
                <div className="grid gap-3 md:grid-cols-3">
                  {CURRICULUM_UNITS.map((unit) => (
                    <div
                      key={unit.num}
                      data-testid={`unit-group-${unit.num}`}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
                    >
                      <div className="px-1 pb-2 text-[11px] font-extrabold text-violet-200 tracking-wide">
                        중단원 {unit.num} · {unit.title}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {unit.lessons.map((tabNum) => {
                          const meta = LESSON_TAB_METADATA.find((m) => m.num === tabNum)!;
                          const isUnlocked = isLessonEnabled(effectiveLessonAccess, tabNum);
                          const isSelected = activeLessonTab === tabNum && isUnlocked;
                          return (
                            <button
                              key={tabNum}
                              type="button"
                              role="tab"
                              aria-selected={isSelected}
                              aria-disabled={!isUnlocked}
                              onClick={() => handleSelectStudentLesson(tabNum)}
                              title={
                                isUnlocked
                                  ? `${meta.fullTitle} 학습하기`
                                  : `${meta.fullTitle} — 선생님이 잠가 두어 들어갈 수 없습니다`
                              }
                              className={`min-h-[42px] flex-1 min-w-[120px] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-white text-slate-900 shadow-sm'
                                  : isUnlocked
                                  ? 'bg-white/10 text-slate-200 border border-white/15 hover:bg-white/15'
                                  : 'bg-slate-900/60 text-slate-400 border border-dashed border-slate-600/80 opacity-75 cursor-not-allowed'
                              }`}
                            >
                              <span
                                className={`mono text-xs font-extrabold ${
                                  isSelected ? 'text-violet-600' : isUnlocked ? 'text-violet-300' : 'text-slate-500'
                                }`}
                              >
                                {meta.badge}
                              </span>
                              <span>{meta.shortTitle}</span>
                              {!isUnlocked && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300 border border-amber-400/30">
                                  <Lock className="h-3 w-3" />
                                  <span>잠김</span>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2">
                    <h3 className="text-sm sm:text-base font-extrabold text-white whitespace-nowrap">나의 탐구 진행 현황</h3>
                    <span className="mono text-xs font-bold text-violet-100 bg-violet-950/70 border border-violet-400/30 px-2 py-0.5 rounded-md">
                      {ALL_LESSON_NUMBERS.map((n) =>
                        isLessonReady(n)
                          ? `${n}차시 ${doneMap[n].filter(Boolean).length}/${doneMap[n].length}`
                          : `${n}차시 준비 중`
                      ).join(' · ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsEvalModalOpen(true)}
                      className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 shadow-xs border ${
                        studentEvalProg.status === 'complete'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40 ring-2 ring-emerald-400/30'
                          : studentEvalProg.status === 'partial'
                          ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400/40 ring-2 ring-amber-400/30'
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                      }`}
                      title="선생님이 입력한 평가 결과와 피드백 확인"
                    >
                      <Award className={`h-4 w-4 ${studentEvalProg.status !== 'none' ? 'text-amber-200' : 'text-violet-200'}`} />
                      <span>평가 결과</span>
                      {studentEvalProg.status === 'complete' && (
                        <span className="rounded-full bg-emerald-300 text-emerald-950 text-[10px] px-1.5 py-0.5 font-black">
                          평가 완료
                        </span>
                      )}
                      {studentEvalProg.status === 'partial' && (
                        <span className="rounded-full bg-amber-200 text-amber-950 text-[10px] px-1.5 py-0.5 font-black">
                          진행 중 {studentEvalProg.percent}%
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-white/20 transition-all whitespace-nowrap shrink-0 shadow-xs"
                      title="현재 활동지 화면 인쇄 / PDF 저장"
                    >
                      <Printer className="h-4 w-4 text-violet-200" />
                      <span>현재 화면 인쇄 / PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1160px] flex-1 px-4 sm:px-6 py-7">
          {toast && (
            <div
              role="status"
              className={`no-print mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-sm font-semibold shadow-xs ${
                toast.type === 'good'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {toast.type === 'good' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                )}
                <span>{toast.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-xs font-bold underline opacity-80 hover:opacity-100 shrink-0 whitespace-nowrap"
              >
                닫기
              </button>
            </div>
          )}

          {sessionMode === 'gate' && (
            <AuthGateView
              currentUser={firebaseUser}
              onStudentApprovedLogin={handleStudentApprovedLogin}
              onAdminTeacherLogin={handleAdminTeacherLogin}
            />
          )}

          {sessionMode === 'student' && (
            <section aria-label="학생 탐구 활동 영역" className="space-y-6">
              {/* 학생 정보 · 저장 상태 · 차시 개요 */}
              <div className="no-print rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>선생님 승인 완료 · 학생 모드 · 클라우드 자동 저장</span>
                    </div>
                    <div className="mt-1 text-base sm:text-lg font-extrabold text-slate-900">
                      {approvedProfile
                        ? `${approvedProfile.school} ${approvedProfile.grade}학년 ${approvedProfile.classNum}반 ${approvedProfile.studentNum}번 ${approvedProfile.name}`
                        : `${student.group} ${student.code}`}
                    </div>
                    {approvedProfile && (
                      <div className="text-xs text-slate-500 mono mt-1">
                        생년월일 {approvedProfile.birthDate} · 기기 식별자 {formatDeviceHashAsMac(approvedProfile.deviceHash)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
                        cloudSyncStatus === 'saving'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : cloudSyncStatus === 'saved'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : cloudSyncStatus === 'error'
                          ? 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                      title={
                        cloudSyncStatus === 'saved' && lastSavedAt
                          ? `마지막 클라우드 저장: ${lastSavedAt.toLocaleTimeString('ko-KR')}`
                          : undefined
                      }
                    >
                      {cloudSyncStatus === 'saving' && (
                        <>
                          <RotateCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
                          <span>클라우드 동기화 중…</span>
                        </>
                      )}
                      {cloudSyncStatus === 'saved' && (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>
                            클라우드 저장 완료 ({lastSavedAt ? lastSavedAt.toLocaleTimeString('ko-KR') : '방금'})
                          </span>
                        </>
                      )}
                      {cloudSyncStatus === 'error' && (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                          <span>클라우드 저장 재시도 필요</span>
                        </>
                      )}
                      {cloudSyncStatus === 'idle' && (
                        <>
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>동기화 대기</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleManualForceSave}
                      className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50/90 hover:bg-blue-100 text-blue-700 px-3 py-2 text-xs font-extrabold transition-colors"
                      title="작성한 탐구 내용을 지금 바로 클라우드에 저장합니다"
                    >
                      <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span>지금 저장</span>
                    </button>
                  </div>
                </div>

                <div className="pt-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-slate-500">
                    <span className="font-bold text-violet-700">
                      {lessonBadge(displayLessonTab)}차시 · 중단원 {activeInfo.unit}. {activeUnit?.title}
                    </span>
                    <span className="font-semibold mono text-slate-600">
                      {activeReady
                        ? `권장 시간 45분 · 단계 완료 ${activeDone.filter(Boolean).length} / ${activeDone.length}`
                        : '활동지 준비 중'}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-900 break-keep">{activeInfo.question}</h2>
                  {activeInfo.extra && (
                    <p className="mt-1 text-xs sm:text-sm text-slate-600">
                      <span className="font-bold text-amber-700">{activeInfo.extra.label}</span> · {activeInfo.extra.title}
                    </p>
                  )}
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-violet-600 transition-all duration-200"
                      style={{
                        width: `${activeDone.length ? (activeDone.filter(Boolean).length / activeDone.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 단계 이동 (활동지가 준비된 차시만) */}
              {studentRenderGate.canRender && activeReady && (
                <nav
                  aria-label="탐구 단계 이동"
                  className={`no-print grid gap-2 sm:gap-3 ${
                    activeInfo.stages.length === 6
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
                      : activeInfo.stages.length >= 5
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                      : activeInfo.stages.length === 4
                      ? 'grid-cols-2 sm:grid-cols-4'
                      : activeInfo.stages.length === 3
                      ? 'grid-cols-3'
                      : 'grid-cols-2'
                  }`}
                >
                  {activeInfo.stages.map((title, idx) => {
                    const isCurrent = activeStep === idx;
                    const isComplete = activeDone[idx];
                    return (
                      <button
                        key={title}
                        type="button"
                        aria-current={isCurrent ? 'step' : undefined}
                        onClick={() => {
                          if (!isLessonEnabled(effectiveLessonAccess, displayLessonTab)) return;
                          setSteps((prev) => ({ ...prev, [displayLessonTab]: idx }));
                        }}
                        className={`min-h-[68px] sm:min-h-[76px] rounded-xl border p-2 sm:p-3 flex flex-col items-center justify-center text-center transition-all ${
                          isCurrent
                            ? 'border-violet-600 bg-violet-50/70 text-violet-950 ring-1 ring-violet-600 shadow-xs'
                            : isComplete
                            ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900 hover:bg-emerald-50'
                            : 'border-slate-200/90 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <strong className="mono text-[10px] sm:text-xs font-extrabold">
                          {lessonBadge(idx + 1)} {isComplete ? '✓' : ''}
                        </strong>
                        <span className="mt-1 text-[11px] sm:text-sm font-bold leading-tight break-keep">{title}</span>
                      </button>
                    );
                  })}
                </nav>
              )}

              {/* 차시 활동 카드 */}
              <section
                aria-live="polite"
                className="print-card rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-8 shadow-xs"
              >
                <div className="hidden print:block mb-4 pb-3 border-b border-slate-300 text-slate-900">
                  <div className="text-xs font-extrabold tracking-wider text-violet-700">PRIME FACTOR WORKSHEET</div>
                  <div className="text-lg font-extrabold mt-0.5">
                    {COURSE_INFO.unitRoman}. {COURSE_INFO.unitTitle} ({displayLessonTab}차시 탐구 활동지)
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    학생:{' '}
                    {approvedProfile
                      ? `${approvedProfile.school} ${approvedProfile.grade}학년 ${approvedProfile.classNum}반 ${approvedProfile.studentNum}번 ${approvedProfile.name}`
                      : `${student.group} ${student.code}`}
                  </div>
                </div>

                {studentRenderGate.reason === 'syncing' ? (
                  <div
                    id="student-lesson-syncing-gate"
                    className="rounded-2xl border border-blue-200 bg-blue-50/60 p-8 text-center space-y-3"
                  >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      <RotateCw className="h-6 w-6 animate-spin" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                      선생님의 차시 열림/잠금 설정을 확인하고 있습니다…
                    </h3>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                      지금 수업 진도에 맞게 열려 있는 차시 정보를 불러오고 있습니다.
                    </p>
                  </div>
                ) : studentRenderGate.reason === 'all_locked' ? (
                  <div
                    id="student-all-lessons-locked-gate"
                    className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center space-y-3"
                  >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <Lock className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">지금은 모든 차시가 잠겨 있습니다</h3>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                      선생님이 수업 진도에 맞춰 차시를 열면 화면이 자동으로 열립니다. 잠시만 기다려 주세요.
                    </p>
                  </div>
                ) : studentRenderGate.reason === 'lesson_locked' ? (
                  <div
                    id="student-single-lesson-locked-gate"
                    className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center space-y-4"
                  >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <Lock className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">이 차시는 아직 잠겨 있습니다</h3>
                      <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                        선생님이 아직 이 차시를 열지 않았습니다. 지금 열려 있는 차시로 이동해 탐구를 이어가세요.
                      </p>
                    </div>
                    {studentRenderGate.redirectLesson !== null && (
                      <button
                        type="button"
                        onClick={() => handleSelectStudentLesson(studentRenderGate.redirectLesson!, true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-xs transition-colors"
                      >
                        <span>{studentRenderGate.redirectLesson}차시로 이동하기</span>
                      </button>
                    )}
                  </div>
                ) : (
                  isLessonEnabled(effectiveLessonAccess, activeLessonTab) && (
                    <ActiveLessonView
                      key={activeLessonTab}
                      lesson={activeLessonTab}
                      state={student[lessonKeyOf(activeLessonTab)]}
                      step={steps[activeLessonTab]}
                      onStepChange={(next) => {
                        setSteps((prev) => ({ ...prev, [activeLessonTab]: next }));
                        window.scrollTo({ top: 180, behavior: 'smooth' });
                      }}
                      onUpdate={(updater) =>
                        setStudent((prev) => {
                          // 잠긴 차시의 답안은 바꾸지 않음
                          if (!isLessonEnabled(effectiveLessonAccessRef.current, activeLessonTab)) return prev;
                          const key = lessonKeyOf(activeLessonTab);
                          return { ...prev, updatedAt: new Date().toISOString(), [key]: updater(prev[key]) };
                        })
                      }
                      onGoToNextLesson={
                        activeLessonTab < ALL_LESSON_NUMBERS[ALL_LESSON_NUMBERS.length - 1]
                          ? () => handleSelectStudentLesson((activeLessonTab + 1) as LessonTabNumber, true)
                          : undefined
                      }
                      onRequestConfirm={requestConfirm}
                    />
                  )
                )}
              </section>
            </section>
          )}

          {sessionMode === 'teacher' && (
            <section aria-label="교사용 기록실 영역">
              <TeacherView
                adminEmail={firebaseUser?.email || ADMIN_TEACHER_EMAIL}
                records={teacherRecords}
                selectedKey={selectedTeacherKey}
                onSelectStudent={setSelectedTeacherKey}
                onUpdateRecords={setTeacherRecords}
                onPrintStudentReport={handlePrintStudentReport}
                onRequestConfirm={requestConfirm}
                lessonAccess={lessonAccess}
                lessonAccessSyncStatus={lessonAccessSyncStatus}
                lessonAccessLastSyncedAt={lessonAccessLastSyncedAt}
                onUpdateLessonAccess={handleUpdateLessonAccess}
                onForceSyncLessonAccessToServer={handleForceSyncLessonAccessToServer}
                onRefreshLessonAccessFromServer={refreshLessonAccessFromServer}
                classLessonAccess={classLessonAccess}
                classLessonAccessSyncStatus={classLessonAccessSyncStatus}
                classLessonAccessError={classLessonAccessError}
                onUpdateClassLessonAccess={handleUpdateClassLessonAccess}
              />
            </section>
          )}

          {sessionMode !== 'gate' && <MathSymbolInputBar activeLesson={displayLessonTab} />}
        </main>

        <footer className="no-print border-t border-slate-200/80 bg-white mt-10">
          <div className="mx-auto max-w-[1160px] px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div>
              <span className="font-extrabold text-violet-700">{CLASSROOM_BRAND_NAME}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="font-bold text-slate-800">
                {COURSE_INFO.unitRoman}. {COURSE_INFO.unitTitle}
              </span>
              <span className="mx-2 text-slate-300">·</span>
              <span>{COURSE_INFO.grade} 탐구 프로젝트</span>
            </div>
            <div>
              학생 모드 · 교사(관리자 <span className="mono">{ADMIN_TEACHER_EMAIL}</span>) 승인제 통합 플랫폼
            </div>
          </div>
        </footer>

        {confirmDialog && (
          <div
            className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h3 id="confirm-dialog-title" className="text-lg font-extrabold text-slate-900">
                {confirmDialog.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{confirmDialog.message}</p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fn = confirmDialog.onConfirm;
                    setConfirmDialog(null);
                    fn();
                  }}
                  className="min-h-[42px] rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        <StudentEvaluationModal
          isOpen={isEvalModalOpen}
          onClose={() => setIsEvalModalOpen(false)}
          student={student}
          lessonAccess={effectiveLessonAccess}
          onGoToLesson={(lesson) => {
            setIsEvalModalOpen(false);
            handleSelectStudentLesson(lesson);
          }}
        />
      </div>

      {/* 학생 개별 평가서 인쇄 영역 (교사 화면에서 인쇄할 때만 보임) */}
      <section id="print-report-sheet" className="hidden" aria-label="학생 개별 피드백 인쇄">
        {printingStudent && <PrintReport student={printingStudent} />}
      </section>
    </>
  );
}

/** 학생 개별 평가서 (인쇄용) */
const PrintReport: React.FC<{ student: StudentRecord }> = ({ student }) => {
  const ev = ensureTeacherEval({ ...student, evaluation: student.evaluation ? { ...student.evaluation } : undefined });
  const prog = getTeacherEvaluationProgress(student);
  return (
    <div className="text-[#18283b] space-y-4">
      <div className="flex items-center justify-between border-b-2 border-[#18283b] pb-2">
        <div>
          <div className="text-xs tracking-[2px] text-violet-700 font-extrabold">
            {CLASSROOM_BRAND_NAME} · PRIME FACTOR LAB · INDIVIDUAL FEEDBACK
          </div>
          <h2 className="text-2xl font-extrabold mt-0.5">
            {COURSE_INFO.unitRoman}. {COURSE_INFO.unitTitle} — 개별 탐구 평가 결과서
          </h2>
        </div>
        <div className="text-right text-xs font-bold text-[#516780]">
          <div>발행일: {new Date().toLocaleDateString('ko-KR')}</div>
        </div>
      </div>
      <div className="border-b border-[#ccd5df] py-2 text-sm">
        <strong>학급:</strong> {student.group || '—'} &nbsp;|&nbsp; <strong>학번·이름:</strong> {student.code || '—'}{' '}
        &nbsp;|&nbsp; <strong>평가 상태:</strong> {prog.statusLabel} ({prog.percent}%)
      </div>
      <h3 className="text-lg font-bold pt-2">1. 차시별 탐구 기록</h3>
      {ALL_LESSON_NUMBERS.map((n) => {
        const { rows, extra } = lessonAnswerRows(lessonKeyOf(n), student[lessonKeyOf(n)]);
        const written = [...rows, ...extra].filter((r) => r.text.trim());
        return (
          <div key={n} className="border-b border-[#ccd5df] py-2 text-sm whitespace-pre-wrap">
            <strong>
              {n}차시 {getCurriculumLesson(n).shortTitle}:
            </strong>{' '}
            {written.length ? written.map((r) => `[${r.label}] ${r.text}`).join('\n') : '미작성'}
          </div>
        );
      })}
      <h3 className="text-lg font-bold pt-2">2. 선생님 평가 ({EVAL_CRITERIA.length}개 차시, 각 0~3점)</h3>
      <div className="grid grid-cols-3 gap-3">
        {EVAL_CRITERIA.map((title, i) => (
          <div key={title} className="rounded-xl border border-[#d2dbe8] p-3 text-center">
            <div className="text-xs font-semibold">{title}</div>
            <strong className="block text-2xl font-extrabold mt-1">{ev.scores[i] === null ? '—' : ev.scores[i]}</strong>
            <small className="text-xs text-[#596678]">/ 3</small>
          </div>
        ))}
      </div>
      <h3 className="text-lg font-bold pt-2">3. 선생님 피드백</h3>
      <div className="rounded-lg border border-[#ddd] p-3 text-sm whitespace-pre-wrap">
        {ev.feedback || '아직 작성된 피드백이 없습니다.'}
      </div>
      <h3 className="text-lg font-bold pt-2">4. 다음 탐구를 위한 제안</h3>
      <div className="rounded-lg border border-[#ddd] p-3 text-sm whitespace-pre-wrap">
        {ev.nextStep || '아직 작성된 제안이 없습니다.'}
      </div>
    </div>
  );
};
