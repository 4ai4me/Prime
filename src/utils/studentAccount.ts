/**
 * 학생 가상 정보 계정 — Firebase 연결 부분
 * ------------------------------------------------------------------
 * 순수 규칙(이름·반·코드 형식)은 studentIdentity.ts, 비밀번호 해시는 passwordCore.ts에 있습니다.
 * 보안 규칙(firestore.rules)이 서버에서 다시 확인하므로, 여기의 검사는 안내용입니다.
 *
 *   student_registrations/v2_{이름}      학생 가입 문서 (이름이 곧 문서 키 → 같은 이름은 하나만)
 *   app_settings/class_roster_{년도}      교사가 만든 그 년도의 반 목록 (누구나 읽기, 교사만 쓰기)
 *
 * ⚠️ 이 파일은 Func·Props·Prime·Rational 네 저장소에서 똑같아야 합니다.
 */
import { useEffect, useState } from 'react';
import { signInAnonymously, type User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { hashStudentPassword, makeClaimProof } from './passwordCore';
import {
  FIXED_SCHOOL_NAME,
  REGISTRATION_SCHEMA_V2,
  RESET_CODE_TTL_MINUTES,
  classRosterDocId,
  generateRandomName,
  generateResetCode,
  hashResetCode,
  isV2Registration,
  koreanYearOf,
  normalizeClassRoster,
  studentKeyForName,
  type ClassRoster,
  type GradeOption,
} from './studentIdentity';

/** 새 방식 학생 가입 문서 */
export interface StudentRegistrationDoc {
  studentKey: string;
  schema: typeof REGISTRATION_SCHEMA_V2;
  school: string;
  /** 가입 신청한 년도 (한국 시간) */
  year: string;
  grade: GradeOption;
  className: string;
  /** 랜덤으로 만든 가상 이름 */
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  /** 이 문서의 주인인 Firebase 익명 계정 uid (보안 규칙에서 본인 확인에 사용) */
  uid: string;
  /** 비밀번호 해시 (원문은 저장하지 않음) */
  passwordHash: string;
  claimPasswordHash?: string;
  /** 교사가 발급한 일회용 코드의 해시 (쓰면 빈 값) */
  resetCodeHash?: string;
  resetCodeExpiresAt?: unknown;
  resetProof?: string;
  deviceHash: string;
  ipAddress: string;
  userAgent: string;
  worksheetJson: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// ------------------------------------------------------------------
// 익명 로그인 (학생)
// ------------------------------------------------------------------

let pendingSignIn: Promise<User> | null = null;

/**
 * 학생용 Firebase 익명 로그인.
 * - 이미 로그인된 사용자(익명 또는 교사)가 있으면 그대로 사용합니다.
 * - 익명 계정은 브라우저에 저장되므로 같은 브라우저에서는 계속 같은 계정입니다.
 */
export async function ensureStudentAuth(): Promise<User> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  if (!pendingSignIn) {
    pendingSignIn = signInAnonymously(auth)
      .then((cred) => cred.user)
      .finally(() => {
        pendingSignIn = null;
      });
  }
  return pendingSignIn;
}

function isPermissionDenied(err: unknown): boolean {
  return (err as { code?: string })?.code === 'permission-denied';
}

function registrationRef(studentKey: string) {
  return doc(db, 'student_registrations', studentKey);
}

// ------------------------------------------------------------------
// 이름 중복 확인
// ------------------------------------------------------------------

/**
 * 이 이름을 아직 아무도 쓰지 않는지 확인합니다.
 * 없는 문서는 누구나 확인할 수 있고, 남의 문서는 읽을 수 없으므로 '거부' = 이미 있는 이름입니다.
 */
export async function isNameAvailable(name: string): Promise<boolean> {
  await ensureStudentAuth();
  try {
    const snap = await getDoc(registrationRef(studentKeyForName(name)));
    return !snap.exists();
  } catch (err) {
    if (isPermissionDenied(err)) return false;
    throw err;
  }
}

/** 랜덤 이름을 만들고 중복 확인까지 합니다 (겹치면 다시 만듦). */
export async function pickAvailableName(maxTries = 12): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    const name = generateRandomName();
    if (await isNameAvailable(name)) return name;
  }
  throw new Error('사용할 수 있는 이름을 찾지 못했습니다. 다시 눌러 주세요.');
}

// ------------------------------------------------------------------
// 반 목록
// ------------------------------------------------------------------

export function useClassRoster(year: string): { roster: ClassRoster; loaded: boolean; error: boolean } {
  const [state, setState] = useState<{ roster: ClassRoster; loaded: boolean; error: boolean }>({
    roster: { year, classes: {} },
    loaded: false,
    error: false,
  });
  useEffect(() => {
    setState({ roster: { year, classes: {} }, loaded: false, error: false });
    const unsub = onSnapshot(
      doc(db, 'app_settings', classRosterDocId(year)),
      (snap) => {
        setState({ roster: normalizeClassRoster(year, snap.exists() ? snap.data() : null), loaded: true, error: false });
      },
      (err) => {
        console.error(`Failed to read class roster ${year}:`, err);
        setState({ roster: { year, classes: {} }, loaded: true, error: true });
      }
    );
    return () => unsub();
  }, [year]);
  return state;
}

/** 교사 전용: 한 년도의 반 목록 저장 */
export async function saveClassRoster(roster: ClassRoster, teacherEmail: string): Promise<void> {
  const classes: Record<string, string[]> = {};
  for (const [g, list] of Object.entries(roster.classes)) {
    if (list && list.length > 0) classes[g] = list;
  }
  await setDoc(doc(db, 'app_settings', classRosterDocId(roster.year)), {
    year: roster.year,
    classes,
    updatedBy: teacherEmail.slice(0, 120),
    updatedAt: serverTimestamp(),
  });
}

// ------------------------------------------------------------------
// 가입 신청
// ------------------------------------------------------------------

export type RegisterResult =
  | { kind: 'ok'; doc: StudentRegistrationDoc }
  /** 그사이 다른 학생이 같은 이름으로 먼저 가입함 */
  | { kind: 'taken' };

export async function registerStudent(params: {
  name: string;
  grade: GradeOption;
  className: string;
  password: string;
  worksheetJson: string;
  deviceHash: string;
  userAgent: string;
}): Promise<RegisterResult> {
  const user = await ensureStudentAuth();
  const studentKey = studentKeyForName(params.name);
  const passwordHash = await hashStudentPassword(studentKey, params.password);
  const data = {
    studentKey,
    schema: REGISTRATION_SCHEMA_V2,
    school: FIXED_SCHOOL_NAME,
    year: koreanYearOf(),
    grade: params.grade,
    className: params.className,
    name: params.name,
    status: 'pending' as const,
    uid: user.uid,
    passwordHash,
    deviceHash: params.deviceHash,
    ipAddress: 'mac-only',
    userAgent: params.userAgent.slice(0, 240) || 'Unknown',
    worksheetJson: params.worksheetJson,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(registrationRef(studentKey), data);
  } catch (err) {
    // 이미 있는 문서에 쓰면 '수정'으로 처리되어 거부됨 → 이름이 그사이 쓰였는지 확인
    if (isPermissionDenied(err) && !(await isNameAvailable(params.name))) return { kind: 'taken' };
    throw err;
  }
  const snap = await getDoc(registrationRef(studentKey));
  return { kind: 'ok', doc: snap.data() as StudentRegistrationDoc };
}

// ------------------------------------------------------------------
// 로그인 (이름 + 비밀번호)
// ------------------------------------------------------------------

export type OpenRegistrationResult =
  | { kind: 'ok'; doc: StudentRegistrationDoc }
  | { kind: 'not_found' }
  /** 비밀번호가 맞지 않음 */
  | { kind: 'mismatch' };

/**
 * 학생 본인의 가입 문서를 엽니다.
 * 1) 이 브라우저(익명 계정)에 이미 연결된 문서면 바로 읽고 비밀번호를 확인합니다.
 * 2) 다른 기기에서 가입한 문서면, 비밀번호를 서버(보안 규칙)가 확인한 뒤 이 브라우저로 연결합니다.
 *    (연결되면 앞 기기는 자동으로 로그아웃됩니다)
 */
export async function openOwnRegistration(name: string, password: string): Promise<OpenRegistrationResult> {
  const user = await ensureStudentAuth();
  const studentKey = studentKeyForName(name);
  const ref = registrationRef(studentKey);
  const passwordHash = await hashStudentPassword(studentKey, password);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return { kind: 'not_found' };
    const data = snap.data() as StudentRegistrationDoc;
    if (!isV2Registration(data)) return { kind: 'not_found' };
    if (data.passwordHash !== passwordHash) return { kind: 'mismatch' };
    return { kind: 'ok', doc: data };
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
  }

  try {
    await updateDoc(ref, {
      uid: user.uid,
      claimPasswordHash: makeClaimProof(passwordHash),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isPermissionDenied(err)) return { kind: 'mismatch' };
    throw err;
  }
  const snap = await getDoc(ref);
  if (!snap.exists()) return { kind: 'not_found' };
  return { kind: 'ok', doc: snap.data() as StudentRegistrationDoc };
}

// ------------------------------------------------------------------
// 비밀번호 분실: 일회용 코드
// ------------------------------------------------------------------

export type RedeemResult = { kind: 'ok'; doc: StudentRegistrationDoc } | { kind: 'invalid' };

/**
 * 학생: 이름 + 교사에게 받은 일회용 코드 + 새 비밀번호로 비밀번호를 다시 정합니다.
 * 코드가 틀렸거나, 이미 썼거나, 30분이 지났으면 서버가 거부합니다.
 */
export async function redeemResetCode(name: string, code: string, newPassword: string): Promise<RedeemResult> {
  const user = await ensureStudentAuth();
  const studentKey = studentKeyForName(name);
  const ref = registrationRef(studentKey);
  const [codeHash, passwordHash] = await Promise.all([
    hashResetCode(studentKey, code),
    hashStudentPassword(studentKey, newPassword),
  ]);
  try {
    await updateDoc(ref, {
      uid: user.uid,
      passwordHash,
      resetCodeHash: '',
      resetProof: codeHash,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isPermissionDenied(err) || (err as { code?: string })?.code === 'not-found') return { kind: 'invalid' };
    throw err;
  }
  const snap = await getDoc(ref);
  return { kind: 'ok', doc: snap.data() as StudentRegistrationDoc };
}

/** 교사 전용: 일회용 코드 발급. 코드 원문은 저장하지 않고 이 함수의 결과로 한 번만 보여 줍니다. */
export async function issueResetCode(studentKey: string): Promise<{ code: string; expiresAt: Date }> {
  const code = generateResetCode();
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);
  await updateDoc(registrationRef(studentKey), {
    resetCodeHash: await hashResetCode(studentKey, code),
    resetCodeExpiresAt: Timestamp.fromDate(expiresAt),
    updatedAt: serverTimestamp(),
  });
  return { code, expiresAt };
}

/** 교사 전용: 발급한 코드 취소 */
export async function cancelResetCode(studentKey: string): Promise<void> {
  await updateDoc(registrationRef(studentKey), {
    resetCodeHash: '',
    updatedAt: serverTimestamp(),
  });
}

/** 한 데이터베이스를 쓰는 네 사이트의 차시 문서 묶음 */
const ALL_LESSON_COLLECTIONS = ['func_lessons', 'props_lessons', 'prime_lessons', 'rational_lessons'] as const;

/**
 * 교사 전용: 학생 가입 문서와 네 사이트의 차시 문서를 모두 지웁니다.
 * (가입 문서만 지우면 이름이 풀려 나중에 같은 이름을 받은 학생에게 예전 답안이 보일 수 있음)
 */
export async function deleteStudentEverywhere(studentKey: string): Promise<number> {
  const snaps = await Promise.all(
    ALL_LESSON_COLLECTIONS.map((c) => getDocs(collection(db, 'student_registrations', studentKey, c)))
  );
  const batch = writeBatch(db);
  let n = 0;
  for (const snap of snaps) {
    snap.forEach((d) => {
      batch.delete(d.ref);
      n++;
    });
  }
  batch.delete(registrationRef(studentKey));
  await batch.commit();
  return n;
}
