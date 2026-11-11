import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { hashStudentPassword } from './passwordCore';

export * from './passwordCore';

/**
 * 학생 비밀번호 사용 설정 (교사가 학생 가입 관리에서 켜고 끔)
 *   app_settings/student_auth { passwordRequired: boolean, updatedBy, updatedAt }
 * - 문서가 없으면 '사용 안 함'으로 봅니다 (기본값).
 * - Func·Props가 같은 설정을 공유합니다.
 */
const POLICY_DOC = () => doc(db, 'app_settings', 'student_auth');

export interface StudentAuthPolicy {
  passwordRequired: boolean;
  /** 서버에서 설정을 한 번이라도 받았는지 (받기 전에는 판단을 미룸) */
  loaded: boolean;
}

export function useStudentAuthPolicy(): StudentAuthPolicy {
  const [policy, setPolicy] = useState<StudentAuthPolicy>({ passwordRequired: false, loaded: false });
  useEffect(() => {
    const unsub = onSnapshot(
      POLICY_DOC(),
      (snap) => {
        setPolicy({ passwordRequired: snap.exists() && snap.data().passwordRequired === true, loaded: true });
      },
      (err) => {
        // 설정을 읽지 못하면 기존 동작(비밀번호 없음)을 유지하되 원인은 남김
        console.error('Failed to read student password policy:', err);
        setPolicy({ passwordRequired: false, loaded: true });
      }
    );
    return () => unsub();
  }, []);
  return policy;
}

/** 교사 전용: 비밀번호 사용 설정 저장 */
export async function saveStudentAuthPolicy(passwordRequired: boolean, teacherEmail: string): Promise<void> {
  await setDoc(POLICY_DOC(), {
    passwordRequired,
    updatedBy: teacherEmail.slice(0, 120),
    updatedAt: serverTimestamp(),
  });
}

/** 학생 본인: 비밀번호가 없을 때 처음 설정 (규칙상 이미 있으면 바꿀 수 없음) */
export async function setInitialStudentPassword(studentKey: string, password: string): Promise<void> {
  const passwordHash = await hashStudentPassword(studentKey, password);
  await updateDoc(doc(db, 'student_registrations', studentKey), {
    passwordHash,
    updatedAt: serverTimestamp(),
  });
}

/** 교사 전용: 비밀번호 초기화 → 학생은 다음 로그인 때 새 비밀번호를 설정 */
export async function resetStudentPassword(studentKey: string): Promise<void> {
  await updateDoc(doc(db, 'student_registrations', studentKey), {
    passwordHash: '',
    updatedAt: serverTimestamp(),
  });
}
