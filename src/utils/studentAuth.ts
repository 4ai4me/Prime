import { signInAnonymously, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { isSameBirthDate } from './authLogic';
import { hasStudentPassword, hashStudentPassword, makeClaimProof } from './passwordCore';
import type { FirestoreStudentRegistrationDoc } from '../components/AuthGateView';

/**
 * 학생용 Firebase 익명 로그인.
 * - 이미 로그인된 사용자(익명 또는 교사)가 있으면 그대로 사용합니다.
 * - 익명 계정은 브라우저에 저장되므로 같은 브라우저에서는 계속 같은 계정입니다.
 */
let pendingSignIn: Promise<User> | null = null;

export async function ensureStudentAuth(): Promise<User> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  // 여러 곳에서 동시에 호출돼도 익명 계정은 하나만 만들도록 진행 중인 요청을 공유
  if (!pendingSignIn) {
    pendingSignIn = signInAnonymously(auth)
      .then((cred) => cred.user)
      .finally(() => {
        pendingSignIn = null;
      });
  }
  return pendingSignIn;
}

export type OpenRegistrationResult =
  | { kind: 'ok'; doc: FirestoreStudentRegistrationDoc }
  | { kind: 'not_found' }
  /** 이름·생년월일(또는 비밀번호가 설정된 학생의 비밀번호)이 맞지 않음 */
  | { kind: 'mismatch' }
  /** 비밀번호가 설정된 학생인데 비밀번호를 입력하지 않음 */
  | { kind: 'password_required' };

function isPermissionDenied(err: unknown): boolean {
  return (err as { code?: string })?.code === 'permission-denied';
}

/** 서버 규칙과 같은 방식으로 생년월일을 숫자만 남겨 보냅니다. */
export function birthDigits(raw: string): string {
  return (raw || '').replace(/[^0-9]/g, '');
}

/**
 * 학생 본인의 가입 문서를 엽니다.
 * 1) 이미 이 브라우저(익명 계정)에 연결된 문서면 바로 읽습니다.
 *    비밀번호가 설정된 학생이면 입력한 비밀번호도 확인합니다.
 * 2) 다른 기기에서 가입했거나 예전 방식으로 가입한 문서면,
 *    이름·생년월일(+ 비밀번호가 설정된 학생은 비밀번호)을 서버(Firestore 보안 규칙)가
 *    확인한 뒤 이 브라우저로 연결합니다.
 * @param password 입력한 비밀번호 (비밀번호 사용 설정이 꺼져 있으면 빈 값)
 */
export async function openOwnRegistration(
  studentKey: string,
  name: string,
  birthDate: string,
  password = ''
): Promise<OpenRegistrationResult> {
  const user = await ensureStudentAuth();
  const regRef = doc(db, 'student_registrations', studentKey);
  const passwordHash = password ? await hashStudentPassword(studentKey, password) : '';

  try {
    const snap = await getDoc(regRef);
    if (!snap.exists()) return { kind: 'not_found' };
    const data = snap.data() as FirestoreStudentRegistrationDoc;
    if (data.name.trim() !== name.trim() || !isSameBirthDate(data.birthDate, birthDate)) {
      return { kind: 'mismatch' };
    }
    if (hasStudentPassword(data)) {
      if (!passwordHash) return { kind: 'password_required' };
      if (passwordHash !== data.passwordHash) return { kind: 'mismatch' };
    }
    return { kind: 'ok', doc: data };
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
  }

  // 아직 이 브라우저에 연결되지 않은 문서 → 이름·생년월일(+비밀번호)로 연결 요청 (서버가 검증)
  try {
    await updateDoc(regRef, {
      uid: user.uid,
      claimName: name.trim().slice(0, 25),
      claimBirthDate: birthDigits(birthDate).slice(0, 8),
      // 비밀번호를 입력한 경우에만 증명을 보냄 (비밀번호가 없는 학생은 규칙이 검사하지 않음)
      ...(passwordHash ? { claimPasswordHash: makeClaimProof(passwordHash) } : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isPermissionDenied(err)) return { kind: 'mismatch' };
    throw err;
  }

  const snap = await getDoc(regRef);
  if (!snap.exists()) return { kind: 'not_found' };
  return { kind: 'ok', doc: snap.data() as FirestoreStudentRegistrationDoc };
}
